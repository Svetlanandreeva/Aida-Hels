"""Aggregated Home API for the web-first Aida baseline.

The endpoint deliberately returns per-section state instead of inventing medical
values when a source is empty or unavailable. One failing source is isolated and
does not make the entire Home request fail.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends

from access_control import require_profile_access
from medication_api import _TIME_RE, _effective_times, _minutes, _normalize_med


def _error_state(exc: BaseException) -> Dict[str, Any]:
    return {"state": "error", "error": exc.__class__.__name__}


def _list_state(items) -> Dict[str, Any]:
    values = list(items or [])
    return {"state": "data" if values else "no_data", "items": values}


def _readiness_state(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {"state": "insufficient_data", "value": None, "scores": {}}
    scores = value.get("scores") or {}
    usable = [score for score in scores.values() if isinstance(score, (int, float)) and score > 0]
    if not usable:
        return {"state": "insufficient_data", "value": None, "scores": scores}
    return {"state": "data", "value": value.get("overall"), "scores": scores}


def _lab_status_state(labs) -> Dict[str, Any]:
    normal = 0
    outside = 0
    for lab in labs or []:
        for marker in lab.get("biomarkers") or []:
            status = marker.get("status")
            if status == "normal":
                normal += 1
            elif status in {"high", "low"}:
                outside += 1
    if normal + outside == 0:
        return {"state": "no_data", "in_range": None, "out_of_range": None}
    return {"state": "data", "in_range": normal, "out_of_range": outside}


async def _medication_day(db, profile_id: str, date: str, now_local: Optional[str]) -> Dict[str, Any]:
    meds = await db.medications.find({"profile_id": profile_id, "active": True}, {"_id": 0}).to_list(300)
    events = await db.medication_events.find({"profile_id": profile_id}, {"_id": 0}).to_list(1000)
    rhythm = await db.circadian_events.find({"profile_id": profile_id, "local_date": date}, {"_id": 0}).to_list(50)
    wake = next((event for event in reversed(rhythm) if event.get("kind") == "wake"), None)
    wake_time = str((wake or {}).get("local_time") or "") or None
    event_map = {
        (event.get("medication_id"), event.get("scheduled_at")): event
        for event in events
        if str(event.get("scheduled_at") or "").startswith(date)
    }
    current_minutes = _minutes(now_local) if now_local and _TIME_RE.match(now_local) else None
    slots = []
    for raw in meds:
        medication = _normalize_med(raw)
        effective = _effective_times(medication, wake_time)
        for index, item in enumerate(effective):
            time = item["time"]
            scheduled_at = f"{date}T{time}:00"
            event = event_map.get((medication.get("id"), scheduled_at))
            next_time = effective[index + 1]["time"] if index + 1 < len(effective) else None
            expired = bool(event is None and current_minutes is not None and next_time and current_minutes >= _minutes(next_time))
            status = event.get("status") if event else ("missed" if expired else "pending")
            slots.append({
                "id": f"{medication.get('id')}:{date}:{time}",
                "medication_id": medication.get("id"),
                "name": medication.get("name"),
                "dose": medication.get("dose"),
                "time": time,
                "planned_time": item["planned_time"],
                "anchor": item["anchor"],
                "scheduled_at": scheduled_at,
                "meal_relation": medication.get("meal_relation"),
                "status": status,
                "can_take": status == "pending",
                "occurred_at": event.get("occurred_at") if event else None,
            })
    slots.sort(key=lambda item: item["time"])
    return {"state": "data" if slots else "no_data", "date": date, "wake_time": wake_time, "slots": slots}


def build_home_router(db, auth, legacy) -> APIRouter:
    router = APIRouter(prefix="/api/home", tags=["home"])

    @router.get("/{profile_id}")
    async def home(
        profile_id: str,
        date: Optional[str] = None,
        now_local: Optional[str] = None,
        language: str = "ru",
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, profile_id)
        local_date = date or datetime.now(timezone.utc).date().isoformat()

        async def medications():
            rows = await db.medications.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", -1).to_list(300)
            return [_normalize_med(row) for row in rows]

        async def tasks():
            return await db.tasks.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", -1).to_list(400)

        async def puzzle():
            row = await db.puzzle.find_one({"profile_id": profile_id}, {"_id": 0})
            return row or {"profile_id": profile_id, "widgets": []}

        results = await asyncio.gather(
            legacy.readiness(profile_id),
            legacy.gamification(profile_id),
            medications(),
            legacy.list_symptoms(profile_id),
            legacy.list_labs(profile_id),
            puzzle(),
            legacy.overview(profile_id, language),
            tasks(),
            _medication_day(db, profile_id, local_date, now_local),
            return_exceptions=True,
        )
        readiness, game, meds, symptoms, labs, puzzle_value, overview, task_rows, medication_day = results

        def safe_list(value):
            return _error_state(value) if isinstance(value, BaseException) else _list_state(value)

        labs_section = safe_list(labs)
        lab_items = [] if isinstance(labs, BaseException) else list(labs or [])

        return {
            "profile_id": profile_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "readiness": _error_state(readiness) if isinstance(readiness, BaseException) else _readiness_state(readiness),
            "gamification": _error_state(game) if isinstance(game, BaseException) else {"state": "data", "value": game},
            "medications": safe_list(meds),
            "symptoms": safe_list(symptoms),
            "labs": labs_section,
            "lab_status": _error_state(labs) if isinstance(labs, BaseException) else _lab_status_state(lab_items),
            "puzzle": _error_state(puzzle_value) if isinstance(puzzle_value, BaseException) else {"state": "data", "value": puzzle_value},
            "overview": _error_state(overview) if isinstance(overview, BaseException) else {
                "state": "data" if (overview or {}).get("attention") or (overview or {}).get("ai_summary") else "no_data",
                "attention": (overview or {}).get("attention") or [],
                "ai_summary": (overview or {}).get("ai_summary"),
            },
            "tasks": safe_list(task_rows),
            "medication_day": _error_state(medication_day) if isinstance(medication_day, BaseException) else medication_day,
        }

    return router
