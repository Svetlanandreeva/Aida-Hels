"""Aida pet game layered on top of the existing gamification XP/level system."""

from __future__ import annotations

import asyncio
import hashlib
import os
from datetime import datetime, timezone
from typing import Any, Dict
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import server as legacy_server
from access_control import require_profile_access

COMMON_PETS = ("cat", "bunny", "fox", "panda")
RARE_PETS = ("dragon", "phoenix", "moon_fox", "star_cat")
CARE_COSTS = {"feed": 5, "play": 8, "groom": 6}
DAILY_JOURNAL_REWARD = 10
_CARE_LOCKS: Dict[str, asyncio.Lock] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _care_lock(profile_id: str) -> asyncio.Lock:
    lock = _CARE_LOCKS.get(profile_id)
    if lock is None:
        lock = asyncio.Lock()
        _CARE_LOCKS[profile_id] = lock
    return lock


def _rare_percent() -> int:
    raw = os.environ.get("AIDA_PET_RARE_PERCENT", "10")
    try:
        return max(0, min(100, int(raw)))
    except (TypeError, ValueError):
        return 10


def _stable_roll(profile_id: str) -> tuple[int, int]:
    secret = os.environ.get("JWT_SECRET", "aida-pet-v1")
    digest = hashlib.sha256(f"{secret}:{profile_id}:pet-v1".encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % 100, int.from_bytes(digest[4:8], "big")


def _pet_for_profile(profile_id: str) -> tuple[str, str]:
    rarity_roll, pet_roll = _stable_roll(profile_id)
    rarity = "rare" if rarity_roll < _rare_percent() else "common"
    pool = RARE_PETS if rarity == "rare" else COMMON_PETS
    return rarity, pool[pet_roll % len(pool)]


def _profile_zone(profile: Dict[str, Any] | None):
    tz_name = str((profile or {}).get("timezone") or "UTC")
    try:
        return ZoneInfo(tz_name)
    except Exception:
        return timezone.utc


def profile_local_day(profile: Dict[str, Any] | None, now: datetime | None = None) -> str:
    return (now or _now()).astimezone(_profile_zone(profile)).date().isoformat()


def _parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


async def _coin_ledger(db, profile_id: str):
    return await db.game_coin_ledger.find({"profile_id": profile_id}, {"_id": 0}).to_list(10000)


async def coin_balance(db, profile_id: str) -> int:
    rows = await _coin_ledger(db, profile_id)
    return int(sum(int(row.get("amount") or 0) for row in rows))


async def award_daily_journal_coins(db, profile_id: str, local_day: str) -> bool:
    """Atomically upsert at most one +10 journal transaction per local day."""
    tx_id = f"journal:{profile_id}:{local_day}"
    result = await db.game_coin_ledger.update_one(
        {"id": tx_id},
        {"$set": {
            "id": tx_id,
            "profile_id": profile_id,
            "kind": "daily_journal",
            "amount": DAILY_JOURNAL_REWARD,
            "local_day": local_day,
        }},
        upsert=True,
    )
    return bool(result.get("upserted"))


async def reconcile_journal_rewards(db, profile: Dict[str, Any]) -> None:
    """Backfill one journal reward per local day from saved check-ins."""
    profile_id = str(profile.get("id") or "")
    if not profile_id:
        return
    rows = await db.checkins.find({"profile_id": profile_id}, {"_id": 0}).to_list(5000)
    zone = _profile_zone(profile)
    local_days = set()
    for row in rows:
        timestamp = _parse_timestamp(row.get("date") or row.get("created_at"))
        if timestamp:
            local_days.add(timestamp.astimezone(zone).date().isoformat())
    for local_day in sorted(local_days):
        await award_daily_journal_coins(db, profile_id, local_day)


async def _game_state(db, profile_id: str) -> Dict[str, Any]:
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0}) or {"id": profile_id}
    await reconcile_journal_rewards(db, profile)
    game = await db.pet_games.find_one({"profile_id": profile_id}, {"_id": 0}) or {}
    legacy = await legacy_server.gamification(profile_id)
    level = int(legacy.get("level") or 1)
    rarity = game.get("rarity")
    pet_code = game.get("pet_code")
    rare = rarity == "rare"
    return {
        **legacy,
        "profile_id": profile_id,
        "coins": await coin_balance(db, profile_id),
        "pet": {
            "claimed": bool(pet_code),
            "claim_available": level >= 2 and not pet_code,
            "pet_code": pet_code,
            "rarity": rarity,
            "level": level if pet_code else None,
            "care": game.get("care") or {"feed": 0, "play": 0, "groom": 0},
            "claimed_at": game.get("claimed_at"),
        },
        "benefits": {
            "subscription_discount_percent": 50 if rare else 0,
            "partner_discount_percent": 50 if rare else 0,
            "partner_discount_requires_active_offer": True,
        },
        "economy": {
            "daily_journal_reward": DAILY_JOURNAL_REWARD,
            "care_costs": CARE_COSTS,
            "rare_percent": _rare_percent(),
        },
    }


class CareRequest(BaseModel):
    action: str


def build_game_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/game", tags=["game"])

    @router.get("/{profile_id}")
    async def get_game(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await _game_state(db, profile_id)

    @router.post("/{profile_id}/spin")
    async def spin_pet(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id, write=True)
        state = await _game_state(db, profile_id)
        if state["pet"]["claimed"]:
            return state
        if int(state.get("level") or 1) < 2:
            raise HTTPException(409, "Pet unlocks at Aida level 2")

        rarity, pet_code = _pet_for_profile(profile_id)
        now = _now()
        await db.pet_games.update_one(
            {"profile_id": profile_id},
            {"$set": {
                "id": f"pet:{profile_id}",
                "profile_id": profile_id,
                "pet_code": pet_code,
                "rarity": rarity,
                "care": {"feed": 0, "play": 0, "groom": 0},
                "claimed_at": now,
                "updated_at": now,
            }},
            upsert=True,
        )
        if rarity == "rare":
            await db.game_entitlements.update_one(
                {"id": f"rare-pet-discount:{profile_id}"},
                {"$set": {
                    "id": f"rare-pet-discount:{profile_id}",
                    "profile_id": profile_id,
                    "kind": "rare_pet_discount",
                    "discount_percent": 50,
                    "subscription": True,
                    "partners": True,
                    "requires_active_partner_offer": True,
                    "created_at": now,
                }},
                upsert=True,
            )
        return await _game_state(db, profile_id)

    @router.post("/{profile_id}/care")
    async def care_for_pet(data: CareRequest, profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id, write=True)
        action = str(data.action or "")
        if action not in CARE_COSTS:
            raise HTTPException(422, "Unknown care action")

        async with _care_lock(profile_id):
            state = await _game_state(db, profile_id)
            if not state["pet"]["claimed"]:
                raise HTTPException(409, "Pet is not claimed")
            cost = CARE_COSTS[action]
            if int(state.get("coins") or 0) < cost:
                raise HTTPException(409, "Not enough coins")

            now = _now()
            tx_id = f"care:{profile_id}:{now.timestamp()}:{action}"
            await db.game_coin_ledger.insert_one({
                "id": tx_id,
                "profile_id": profile_id,
                "kind": f"care_{action}",
                "amount": -cost,
                "created_at": now,
            })
            game = await db.pet_games.find_one({"profile_id": profile_id}, {"_id": 0}) or {}
            care = dict(game.get("care") or {"feed": 0, "play": 0, "groom": 0})
            care[action] = int(care.get(action) or 0) + 1
            await db.pet_games.update_one(
                {"profile_id": profile_id},
                {"$set": {"care": care, "updated_at": now}},
                upsert=True,
            )
        return await _game_state(db, profile_id)

    return router
