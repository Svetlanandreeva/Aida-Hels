"""User-confirmed wake/bedtime anchors for adaptive medication scheduling."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from access_control import require_profile_access

_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def _now():
    return datetime.now(timezone.utc)


class RhythmEventCreate(BaseModel):
    profile_id: str
    kind: str  # wake | bedtime
    local_date: str
    local_time: str
    source: str = "manual"


class BedtimePlan(BaseModel):
    profile_id: str
    local_date: str
    planned_time: str


def build_circadian_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/circadian", tags=["circadian"])

    @router.get("/day")
    async def get_day(profile_id: str, date: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        events = await db.circadian_events.find({"profile_id": profile_id, "local_date": date}, {"_id": 0}).to_list(50)
        plan = await db.circadian_plans.find_one({"profile_id": profile_id, "local_date": date}, {"_id": 0})
        wake = next((e for e in reversed(events) if e.get("kind") == "wake"), None)
        bedtime = next((e for e in reversed(events) if e.get("kind") == "bedtime"), None)
        return {"profile_id": profile_id, "date": date, "wake": wake, "bedtime": bedtime, "plan": plan}

    @router.post("/events")
    async def create_event(data: RhythmEventCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        kind = data.kind.strip().lower()
        if kind not in {"wake", "bedtime"}:
            raise HTTPException(400, "kind must be wake or bedtime")
        if not _TIME_RE.match(data.local_time):
            raise HTTPException(400, "local_time must be HH:MM")
        payload = {
            "id": str(uuid.uuid4()),
            "profile_id": data.profile_id,
            "kind": kind,
            "local_date": data.local_date,
            "local_time": data.local_time,
            "source": data.source if data.source in {"manual", "wearable", "import"} else "manual",
            "recorded_at": _now(),
        }
        existing = await db.circadian_events.find_one({"profile_id": data.profile_id, "local_date": data.local_date, "kind": kind, "source": payload["source"]}, {"_id": 0})
        if existing:
            await db.circadian_events.update_one({"id": existing["id"]}, {"$set": payload})
            return {**existing, **payload}
        await db.circadian_events.insert_one(payload)
        return payload

    @router.post("/bedtime-plan")
    async def save_bedtime_plan(data: BedtimePlan, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        if not _TIME_RE.match(data.planned_time):
            raise HTTPException(400, "planned_time must be HH:MM")
        payload = {
            "profile_id": data.profile_id,
            "local_date": data.local_date,
            "planned_time": data.planned_time,
            "updated_at": _now(),
        }
        await db.circadian_plans.update_one({"profile_id": data.profile_id, "local_date": data.local_date}, {"$set": payload}, upsert=True)
        return payload

    return router
