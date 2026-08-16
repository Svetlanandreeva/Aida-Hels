"""User-confirmed wake/bedtime anchors for adaptive medication scheduling."""

from __future__ import annotations

import hashlib
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from access_control import require_profile_access
from permissions import write_audit
from sleep_personalization import build_sleep_insight

_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def _now():
    return datetime.now(timezone.utc)


def _validate_local_date(value: str) -> str:
    value = value.strip()
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(400, "local_date must be YYYY-MM-DD") from exc
    return value


class RhythmEventCreate(BaseModel):
    profile_id: str
    kind: str  # wake | bedtime
    local_date: str
    local_time: str
    source: str = "manual"


class WearableRhythmCandidateCreate(BaseModel):
    profile_id: str
    provider: str = Field(min_length=1, max_length=80)
    source_record_id: str = Field(min_length=1, max_length=300)
    kind: str  # wake | bedtime
    local_date: str
    local_time: str
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BedtimePlan(BaseModel):
    profile_id: str
    local_date: str
    planned_time: str
    notification_id: Optional[str] = None


class RecommendationReminder(BaseModel):
    profile_id: str
    local_date: str
    window_end: str
    notification_id: Optional[str] = None


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

    @router.get("/insight")
    async def get_insight(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        events = await db.circadian_events.find({"profile_id": profile_id}, {"_id": 0}).sort("local_date", 1).to_list(500)
        checkins = await db.checkins.find({"profile_id": profile_id}, {"_id": 0}).sort("date", 1).to_list(500)
        symptoms = await db.symptoms.find({"profile_id": profile_id}, {"_id": 0}).sort("date", 1).to_list(500)
        return build_sleep_insight(events, checkins, symptoms)

    @router.post("/events")
    async def create_event(data: RhythmEventCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        kind = data.kind.strip().lower()
        if kind not in {"wake", "bedtime"}:
            raise HTTPException(400, "kind must be wake or bedtime")
        local_date = _validate_local_date(data.local_date)
        if not _TIME_RE.match(data.local_time):
            raise HTTPException(400, "local_time must be HH:MM")
        # Wearable observations are never allowed to bypass CandidateRecords.
        # Canonical direct entry is reserved for a human-entered anchor.
        if data.source.strip().lower() != "manual":
            raise HTTPException(409, "Imported sleep anchors must be reviewed through CandidateRecords")
        payload = {
            "id": str(uuid.uuid4()), "profile_id": data.profile_id, "kind": kind,
            "local_date": local_date, "local_time": data.local_time,
            "source": "manual", "verification_status": "user_entered",
            "recorded_at": _now(),
        }
        existing = await db.circadian_events.find_one({"profile_id": data.profile_id, "local_date": local_date, "kind": kind, "source": "manual"}, {"_id": 0})
        if existing:
            await db.circadian_events.update_one({"id": existing["id"]}, {"$set": payload})
            return {**existing, **payload}
        await db.circadian_events.insert_one(payload)
        return payload

    @router.post("/wearable-candidates")
    async def create_wearable_candidate(data: WearableRhythmCandidateCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        kind = data.kind.strip().lower()
        if kind not in {"wake", "bedtime"}:
            raise HTTPException(400, "kind must be wake or bedtime")
        local_date = _validate_local_date(data.local_date)
        if not _TIME_RE.match(data.local_time):
            raise HTTPException(400, "local_time must be HH:MM")
        provider = data.provider.strip().lower()
        source_record_id = data.source_record_id.strip()
        fingerprint = hashlib.sha256(f"{provider}|{source_record_id}|{kind}".encode("utf-8")).hexdigest()
        existing = await db.candidates.find_one({
            "profile_id": data.profile_id,
            "entity_type": "circadian_event",
            "source_fingerprint": fingerprint,
        }, {"_id": 0})
        if existing:
            return existing

        now = _now()
        candidate = {
            "id": str(uuid.uuid4()),
            "profile_id": data.profile_id,
            "proposed_by": "import",
            "entity_type": "circadian_event",
            "payload": {
                "kind": kind,
                "local_date": local_date,
                "local_time": data.local_time,
                "provider": provider,
                "source_record_id": source_record_id,
                "confidence": data.confidence,
                "metadata": data.metadata,
            },
            "rationale": "Sleep/wake anchor imported from a system health layer; user confirmation is required before it affects circadian personalization or medication timing.",
            "status": "pending",
            "source_fingerprint": fingerprint,
            "created_at": now,
            "updated_at": now,
            "reviewed_at": None,
            "reviewer_account_id": None,
            "approved_entity_id": None,
        }
        await db.candidates.insert_one(candidate)
        await write_audit(
            db,
            action="candidate.created",
            entity_type="candidate",
            entity_id=candidate["id"],
            account_id=str(account["id"]),
            profile_id=data.profile_id,
            source="import",
            metadata={"target_entity_type": "circadian_event", "provider": provider, "source_record_id": source_record_id},
        )
        return candidate

    @router.post("/bedtime-plan")
    async def save_bedtime_plan(data: BedtimePlan, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        local_date = _validate_local_date(data.local_date)
        if not _TIME_RE.match(data.planned_time):
            raise HTTPException(400, "planned_time must be HH:MM")
        payload = {
            "profile_id": data.profile_id, "local_date": local_date,
            "planned_time": data.planned_time,
            "notification_id": (data.notification_id or "").strip() or None,
            "updated_at": _now(),
        }
        await db.circadian_plans.update_one({"profile_id": data.profile_id, "local_date": local_date}, {"$set": payload}, upsert=True)
        return payload

    @router.post("/recommendation-reminder")
    async def save_recommendation_reminder(data: RecommendationReminder, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        local_date = _validate_local_date(data.local_date)
        if not _TIME_RE.match(data.window_end):
            raise HTTPException(400, "window_end must be HH:MM")
        patch = {
            "profile_id": data.profile_id,
            "local_date": local_date,
            "recommendation_window_end": data.window_end,
            "recommendation_notification_id": (data.notification_id or "").strip() or None,
            "updated_at": _now(),
        }
        await db.circadian_plans.update_one({"profile_id": data.profile_id, "local_date": local_date}, {"$set": patch}, upsert=True)
        return patch

    return router
