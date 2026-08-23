"""Aggregated Home API for the web-first Aida baseline.

The endpoint deliberately returns per-section state instead of inventing medical
values when a source is empty or unavailable. One failing or slow source is
isolated and does not make the entire Home request fail.
"""

from __future__ import annotations

import asyncio
from datetime import date as date_cls, datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends

from access_control import require_profile_access
from medication_api import _TIME_RE, _effective_times, _minutes, _normalize_med
from module_config import effective_module_map, module_enabled, module_home_allowed
from puzzle_api import apply_module_home_visibility, widgets_for_goals

HOME_SECTION_TIMEOUT_SECONDS = 3.5


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


def _profile_is_personalized(profile: Dict[str, Any]) -> bool:
    return bool(profile.get("goals") or profile.get("module_settings") or profile.get("module_config"))


def _module_enabled(profile: Dict[str, Any], key: str) -> bool:
    return module_enabled(profile, key)


def _attention_allowed(profile: Dict[str, Any], item: Dict[str, Any]) -> bool:
    kind = str(item.get("type") or "")
    if kind == "lab":
        return module_home_allowed(profile, "labs")
    if kind == "bp":
        return module_home_allowed(profile, "pressure")
    if kind == "symptom":
        return module_home_allowed(profile, "symptoms")
    return True


async def _bounded(awaitable, timeout: float = HOME_SECTION_TIMEOUT_SECONDS):
    """Bound one Home source so a slow integration cannot stall the dashboard."""
    return await asyncio.wait_for(awaitable, timeout=timeout)


async def _cycle_summary(db, profile_id: str, local_date: str) -> Dict[str, Any]:
    """Return only profile-confirmed cycle facts for Home, never a population default."""
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0}) or {}
    if str(profile.get("sex") or "").lower() != "female":
        return {"state": "not_applicable", "cycle_day": None, "last_period_start": None}

    starts = await db.cycle_events.find(
        {"profile_id": profile_id, "event_type": "period_start"}, {"_id": 0}
    ).sort("observed_at", -1).to_list(1)
    if not starts or not starts[0].get("observed_at"):
        return {"state": "no_data", "cycle_day": None, "last_period_start": None}

    try:
        start = date_cls.fromisoformat(str(starts[0]["observed_at"])[:10])
        today = date_cls.fromisoformat(local_date[:10])
    except ValueError:
        return {"state": "error", "cycle_day": None, "last_period_start": None}

    cycle_day = (today - start).days + 1 if today >= start else None
    if cycle_day is None:
        return {"state": "insufficient_data", "cycle_day": None, "last_period_start": start.isoformat()}
    return {"state": "data", "cycle_day": cycle_day, "last_period_start": start.isoformat()}


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
        profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0}) or {}

        async def medications():
            if not _module_enabled(profile, "meds"):
                return []
            rows = await db.medications.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", -1).to_list(300)
            return [_normalize_med(row) for row in rows]

        async def symptoms():
            if not _module_enabled(profile, "symptoms"):
                return []
            return await legacy.list_symptoms(profile_id)

        async def labs():
            if not _module_enabled(profile, "labs"):
                return []
            return await legacy.list_labs(profile_id)

        async def tasks():
            if not _module_enabled(profile, "tasks"):
                return []
            return await db.tasks.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", -1).to_list(400)

        async def puzzle():
            row = await db.puzzle.find_one({"profile_id": profile_id}, {"_id": 0})
            if row:
                widgets = row.get("widgets") or []
                source = row.get("source") or "legacy"
                updated_at = row.get("updated_at")
            else:
                widgets = widgets_for_goals(profile.get("goals") or [])
                source = "goals_fallback" if profile.get("goals") else "default"
                updated_at = None
            return {
                "profile_id": profile_id,
                "widgets": apply_module_home_visibility(widgets, profile),
                "source": source,
                "updated_at": updated_at,
            }

        async def overview():
            value = await legacy.overview(profile_id, language)
            return {
                **(value or {}),
                "attention": [
                    item for item in ((value or {}).get("attention") or [])
                    if _attention_allowed(profile, item)
                ],
            }

        async def medication_day():
            if not _module_enabled(profile, "meds"):
                return {"state": "not_applicable", "date": local_date, "wake_time": None, "slots": []}
            return await _medication_day(db, profile_id, local_date, now_local)

        async def cycle_summary():
            if not _module_enabled(profile, "women"):
                return {"state": "not_applicable", "cycle_day": None, "last_period_start": None}
            return await _cycle_summary(db, profile_id, local_date)

        results = await asyncio.gather(
            _bounded(legacy.readiness(profile_id)),
            _bounded(legacy.gamification(profile_id)),
            _bounded(medications()),
            _bounded(symptoms()),
            _bounded(labs()),
            _bounded(puzzle()),
            _bounded(overview()),
            _bounded(tasks()),
            _bounded(medication_day()),
            _bounded(cycle_summary()),
            return_exceptions=True,
        )
        readiness, game, meds, symptoms_value, labs_value, puzzle_value, overview_value, task_rows, medication_day_value, cycle_value = results

        def safe_list(value):
            return _error_state(value) if isinstance(value, BaseException) else _list_state(value)

        labs_section = safe_list(labs_value)
        lab_items = [] if isinstance(labs_value, BaseException) else list(labs_value or [])

        modules = effective_module_map(profile)
        return {
            "profile_id": profile_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "personalization": {
                "state": "personalized" if _profile_is_personalized(profile) else "default",
                "goals": profile.get("goals") or [],
                "modules": modules,
            },
            "readiness": _error_state(readiness) if isinstance(readiness, BaseException) else _readiness_state(readiness),
            "gamification": _error_state(game) if isinstance(game, BaseException) else {"state": "data", "value": game},
            "medications": safe_list(meds),
            "symptoms": safe_list(symptoms_value),
            "labs": labs_section,
            "lab_status": _error_state(labs_value) if isinstance(labs_value, BaseException) else _lab_status_state(lab_items),
            "puzzle": _error_state(puzzle_value) if isinstance(puzzle_value, BaseException) else {"state": "data", "value": puzzle_value},
            "overview": _error_state(overview_value) if isinstance(overview_value, BaseException) else {
                "state": "data" if (overview_value or {}).get("attention") or (overview_value or {}).get("ai_summary") else "no_data",
                "attention": (overview_value or {}).get("attention") or [],
                "ai_summary": (overview_value or {}).get("ai_summary"),
            },
            "tasks": safe_list(task_rows),
            "medication_day": _error_state(medication_day_value) if isinstance(medication_day_value, BaseException) else medication_day_value,
            "cycle": _error_state(cycle_value) if isinstance(cycle_value, BaseException) else cycle_value,
        }

    return router
