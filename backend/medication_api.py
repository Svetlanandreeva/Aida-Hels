"""Medication schedules and intake event log for Aida 2.0."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from access_control import require_profile_access, require_record_access

_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
_ALLOWED_MEAL = {"any", "before", "with", "after"}
_ALLOWED_EVENT = {"taken", "skipped"}


def _now():
    return datetime.now(timezone.utc)


def _times(values) -> List[str]:
    out = []
    for value in values or []:
        text = str(value).strip()
        if _TIME_RE.match(text) and text not in out:
            out.append(text)
    return sorted(out)


def _notification_ids(values) -> List[str]:
    out = []
    for value in values or []:
        text = str(value).strip()
        if text and text not in out:
            out.append(text)
    return out[:64]


def _normalize_med(doc):
    if not doc:
        return doc
    result = dict(doc)
    result["times"] = _times(result.get("times"))
    result["notification_ids"] = _notification_ids(result.get("notification_ids"))
    meal = str(result.get("meal_relation") or "any").lower()
    result["meal_relation"] = meal if meal in _ALLOWED_MEAL else "any"
    result.setdefault("active", True)
    result.setdefault("schedule", None)
    result.setdefault("dose", None)
    result.setdefault("notes", None)
    result.setdefault("start_date", None)
    result.setdefault("first_dose_anchor", "clock")
    result.setdefault("wake_offset_minutes", 0)
    return result


class MedicationCreate(BaseModel):
    profile_id: str
    name: str
    dose: Optional[str] = None
    schedule: Optional[str] = None
    times: List[str] = Field(default_factory=list)
    meal_relation: str = "any"
    active: bool = True
    start_date: Optional[str] = None
    notes: Optional[str] = None
    notification_ids: List[str] = Field(default_factory=list)
    first_dose_anchor: str = "clock"  # clock | wake
    wake_offset_minutes: int = 0


class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    dose: Optional[str] = None
    schedule: Optional[str] = None
    times: Optional[List[str]] = None
    meal_relation: Optional[str] = None
    active: Optional[bool] = None
    start_date: Optional[str] = None
    notes: Optional[str] = None
    notification_ids: Optional[List[str]] = None
    first_dose_anchor: Optional[str] = None
    wake_offset_minutes: Optional[int] = None


class IntakeMark(BaseModel):
    scheduled_at: str
    status: str


def _minutes(value: str) -> int:
    h, m = value.split(":")
    return int(h) * 60 + int(m)


def _hhmm(total: int) -> str:
    total %= 24 * 60
    return f"{total // 60:02d}:{total % 60:02d}"


def _effective_times(med: Dict[str, Any], wake_time: Optional[str]) -> List[Dict[str, Any]]:
    times = list(med.get("times") or [])
    if not times:
        return []
    effective = [{"planned_time": t, "time": t, "anchor": "clock"} for t in times]
    if med.get("first_dose_anchor") == "wake" and wake_time and _TIME_RE.match(wake_time):
        offset = max(-240, min(720, int(med.get("wake_offset_minutes") or 0)))
        wake_based = _hhmm(_minutes(wake_time) + offset)
        # Never pull a wake-anchored dose earlier than its planned clock time.
        if _minutes(wake_based) > _minutes(times[0]):
            effective[0] = {"planned_time": times[0], "time": wake_based, "anchor": "wake"}
    return effective


def build_medication_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/medications", tags=["medications"])

    @router.get("")
    async def list_medications(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        docs = await db.medications.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", -1).to_list(300)
        return [_normalize_med(doc) for doc in docs]

    @router.post("")
    async def create_medication(data: MedicationCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        payload = data.model_dump()
        payload["name"] = payload["name"].strip()
        if not payload["name"]:
            raise HTTPException(400, "Medication name is required")
        payload["times"] = _times(payload.get("times"))
        payload["notification_ids"] = _notification_ids(payload.get("notification_ids"))
        if payload.get("first_dose_anchor") not in {"clock", "wake"}:
            raise HTTPException(400, "first_dose_anchor must be clock or wake")
        payload["wake_offset_minutes"] = max(-240, min(720, int(payload.get("wake_offset_minutes") or 0)))
        meal = str(payload.get("meal_relation") or "any").lower()
        if meal not in _ALLOWED_MEAL:
            raise HTTPException(400, "Invalid meal relation")
        payload["meal_relation"] = meal
        payload.update({"id": str(uuid.uuid4()), "created_at": _now(), "updated_at": _now()})
        await db.medications.insert_one(payload)
        return _normalize_med(payload)

    @router.put("/{medication_id}")
    async def update_medication(medication_id: str, data: MedicationUpdate, account: Dict[str, Any] = Depends(auth.require_account)):
        existing = await require_record_access(db, auth, account, "medications", medication_id, write=True)
        patch = {k: v for k, v in data.model_dump().items() if v is not None}
        if "name" in patch:
            patch["name"] = str(patch["name"]).strip()
            if not patch["name"]:
                raise HTTPException(400, "Medication name is required")
        if "times" in patch:
            patch["times"] = _times(patch["times"])
        if "notification_ids" in patch:
            patch["notification_ids"] = _notification_ids(patch["notification_ids"])
        if "first_dose_anchor" in patch and patch["first_dose_anchor"] not in {"clock", "wake"}:
            raise HTTPException(400, "first_dose_anchor must be clock or wake")
        if "wake_offset_minutes" in patch:
            patch["wake_offset_minutes"] = max(-240, min(720, int(patch["wake_offset_minutes"])))
        if "meal_relation" in patch:
            meal = str(patch["meal_relation"]).lower()
            if meal not in _ALLOWED_MEAL:
                raise HTTPException(400, "Invalid meal relation")
            patch["meal_relation"] = meal
        patch["updated_at"] = _now()
        await db.medications.update_one({"id": medication_id}, {"$set": patch})
        return _normalize_med({**existing, **patch})

    @router.delete("/{medication_id}")
    async def delete_medication(medication_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_record_access(db, auth, account, "medications", medication_id, write=True)
        await db.medications.delete_one({"id": medication_id})
        await db.medication_events.delete_many({"medication_id": medication_id})
        return {"ok": True}

    @router.get("/events/list")
    async def list_events(profile_id: str, date: Optional[str] = None, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        docs = await db.medication_events.find({"profile_id": profile_id}, {"_id": 0}).sort("scheduled_at", -1).to_list(1000)
        if date:
            docs = [doc for doc in docs if str(doc.get("scheduled_at") or "").startswith(date)]
        return docs

    @router.post("/{medication_id}/events")
    async def mark_intake(medication_id: str, data: IntakeMark, account: Dict[str, Any] = Depends(auth.require_account)):
        med = await require_record_access(db, auth, account, "medications", medication_id, write=True)
        status = data.status.strip().lower()
        if status not in _ALLOWED_EVENT:
            raise HTTPException(400, "Status must be taken or skipped")
        scheduled_at = data.scheduled_at.strip()
        if not scheduled_at:
            raise HTTPException(400, "scheduled_at is required")
        existing = await db.medication_events.find_one({"medication_id": medication_id, "scheduled_at": scheduled_at}, {"_id": 0})
        occurred_at = _now()
        if existing:
            patch = {"status": status, "occurred_at": occurred_at, "updated_at": occurred_at}
            await db.medication_events.update_one({"medication_id": medication_id, "scheduled_at": scheduled_at}, {"$set": patch})
            return {**existing, **patch}
        event = {"id": str(uuid.uuid4()), "profile_id": med.get("profile_id"), "medication_id": medication_id, "medication_name": med.get("name"), "scheduled_at": scheduled_at, "occurred_at": occurred_at, "status": status, "created_at": occurred_at, "updated_at": occurred_at}
        await db.medication_events.insert_one(event)
        return event

    @router.get("/schedule/day")
    async def day_schedule(profile_id: str, date: str, now_local: Optional[str] = None, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        meds = await db.medications.find({"profile_id": profile_id, "active": True}, {"_id": 0}).to_list(300)
        events = await db.medication_events.find({"profile_id": profile_id}, {"_id": 0}).to_list(1000)
        rhythm = await db.circadian_events.find({"profile_id": profile_id, "local_date": date}, {"_id": 0}).to_list(50)
        wake = next((e for e in reversed(rhythm) if e.get("kind") == "wake"), None)
        wake_time = str((wake or {}).get("local_time") or "") or None
        event_map = {(e.get("medication_id"), e.get("scheduled_at")): e for e in events if str(e.get("scheduled_at") or "").startswith(date)}
        current_minutes = _minutes(now_local) if now_local and _TIME_RE.match(now_local) else None
        slots = []
        for raw in meds:
            med = _normalize_med(raw)
            effective = _effective_times(med, wake_time)
            for index, item in enumerate(effective):
                time = item["time"]
                scheduled_at = f"{date}T{time}:00"
                event = event_map.get((med.get("id"), scheduled_at))
                next_time = effective[index + 1]["time"] if index + 1 < len(effective) else None
                expired = bool(event is None and current_minutes is not None and next_time and current_minutes >= _minutes(next_time))
                status = event.get("status") if event else ("missed" if expired else "pending")
                slots.append({
                    "id": f"{med.get('id')}:{date}:{time}",
                    "medication_id": med.get("id"),
                    "name": med.get("name"),
                    "dose": med.get("dose"),
                    "time": time,
                    "planned_time": item["planned_time"],
                    "anchor": item["anchor"],
                    "scheduled_at": scheduled_at,
                    "meal_relation": med.get("meal_relation"),
                    "status": status,
                    "can_take": status == "pending",
                    "occurred_at": event.get("occurred_at") if event else None,
                })
        slots.sort(key=lambda item: item["time"])
        return {"profile_id": profile_id, "date": date, "wake_time": wake_time, "slots": slots}

    return router
