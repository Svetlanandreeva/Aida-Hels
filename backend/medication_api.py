"""Medication schedules and intake event log for Aida 2.0."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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


def _normalize_med(doc):
    if not doc:
        return doc
    result = dict(doc)
    result["times"] = _times(result.get("times"))
    meal = str(result.get("meal_relation") or "any").lower()
    result["meal_relation"] = meal if meal in _ALLOWED_MEAL else "any"
    result.setdefault("active", True)
    result.setdefault("schedule", None)
    result.setdefault("dose", None)
    result.setdefault("notes", None)
    result.setdefault("start_date", None)
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


class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    dose: Optional[str] = None
    schedule: Optional[str] = None
    times: Optional[List[str]] = None
    meal_relation: Optional[str] = None
    active: Optional[bool] = None
    start_date: Optional[str] = None
    notes: Optional[str] = None


class IntakeMark(BaseModel):
    scheduled_at: str
    status: str


def build_medication_router(db) -> APIRouter:
    router = APIRouter(prefix="/api/medications", tags=["medications"])

    @router.get("")
    async def list_medications(profile_id: str):
        docs = await db.medications.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", -1).to_list(300)
        return [_normalize_med(doc) for doc in docs]

    @router.post("")
    async def create_medication(data: MedicationCreate):
        payload = data.model_dump()
        payload["name"] = payload["name"].strip()
        if not payload["name"]:
            raise HTTPException(400, "Medication name is required")
        payload["times"] = _times(payload.get("times"))
        meal = str(payload.get("meal_relation") or "any").lower()
        if meal not in _ALLOWED_MEAL:
            raise HTTPException(400, "Invalid meal relation")
        payload["meal_relation"] = meal
        payload.update({"id": str(uuid.uuid4()), "created_at": _now(), "updated_at": _now()})
        await db.medications.insert_one(payload)
        return _normalize_med(payload)

    @router.put("/{medication_id}")
    async def update_medication(medication_id: str, data: MedicationUpdate):
        existing = await db.medications.find_one({"id": medication_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Medication not found")
        patch = {k: v for k, v in data.model_dump().items() if v is not None}
        if "name" in patch:
            patch["name"] = str(patch["name"]).strip()
            if not patch["name"]:
                raise HTTPException(400, "Medication name is required")
        if "times" in patch:
            patch["times"] = _times(patch["times"])
        if "meal_relation" in patch:
            meal = str(patch["meal_relation"]).lower()
            if meal not in _ALLOWED_MEAL:
                raise HTTPException(400, "Invalid meal relation")
            patch["meal_relation"] = meal
        patch["updated_at"] = _now()
        await db.medications.update_one({"id": medication_id}, {"$set": patch})
        return _normalize_med({**existing, **patch})

    @router.delete("/{medication_id}")
    async def delete_medication(medication_id: str):
        await db.medications.delete_one({"id": medication_id})
        await db.medication_events.delete_many({"medication_id": medication_id})
        return {"ok": True}

    @router.get("/events/list")
    async def list_events(profile_id: str, date: Optional[str] = None):
        query = {"profile_id": profile_id}
        docs = await db.medication_events.find(query, {"_id": 0}).sort("scheduled_at", -1).to_list(1000)
        if date:
            docs = [doc for doc in docs if str(doc.get("scheduled_at") or "").startswith(date)]
        return docs

    @router.post("/{medication_id}/events")
    async def mark_intake(medication_id: str, data: IntakeMark):
        med = await db.medications.find_one({"id": medication_id}, {"_id": 0})
        if not med:
            raise HTTPException(404, "Medication not found")
        status = data.status.strip().lower()
        if status not in _ALLOWED_EVENT:
            raise HTTPException(400, "Status must be taken or skipped")
        scheduled_at = data.scheduled_at.strip()
        if not scheduled_at:
            raise HTTPException(400, "scheduled_at is required")

        existing = await db.medication_events.find_one(
            {"medication_id": medication_id, "scheduled_at": scheduled_at}, {"_id": 0}
        )
        occurred_at = _now()
        if existing:
            patch = {"status": status, "occurred_at": occurred_at, "updated_at": occurred_at}
            await db.medication_events.update_one(
                {"medication_id": medication_id, "scheduled_at": scheduled_at}, {"$set": patch}
            )
            return {**existing, **patch}

        event = {
            "id": str(uuid.uuid4()),
            "profile_id": med.get("profile_id"),
            "medication_id": medication_id,
            "medication_name": med.get("name"),
            "scheduled_at": scheduled_at,
            "occurred_at": occurred_at,
            "status": status,
            "created_at": occurred_at,
            "updated_at": occurred_at,
        }
        await db.medication_events.insert_one(event)
        return event

    @router.get("/schedule/day")
    async def day_schedule(profile_id: str, date: str):
        meds = await db.medications.find({"profile_id": profile_id, "active": True}, {"_id": 0}).to_list(300)
        events = await db.medication_events.find({"profile_id": profile_id}, {"_id": 0}).to_list(1000)
        event_map = {
            (e.get("medication_id"), e.get("scheduled_at")): e
            for e in events
            if str(e.get("scheduled_at") or "").startswith(date)
        }

        slots = []
        for raw in meds:
            med = _normalize_med(raw)
            for time in med.get("times") or []:
                scheduled_at = f"{date}T{time}:00"
                event = event_map.get((med.get("id"), scheduled_at))
                slots.append({
                    "id": f"{med.get('id')}:{date}:{time}",
                    "medication_id": med.get("id"),
                    "name": med.get("name"),
                    "dose": med.get("dose"),
                    "time": time,
                    "scheduled_at": scheduled_at,
                    "meal_relation": med.get("meal_relation"),
                    "status": event.get("status") if event else "pending",
                    "occurred_at": event.get("occurred_at") if event else None,
                })
        slots.sort(key=lambda item: item["time"])
        return {"profile_id": profile_id, "date": date, "slots": slots}

    return router
