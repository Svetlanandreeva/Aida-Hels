"""Cycle tracking API for Aida 2.0.

Forecasts are derived only from the selected profile's own confirmed period-start
history or an explicitly configured typical cycle length. No population default
is silently substituted when personal evidence is insufficient.
"""
from __future__ import annotations

import statistics
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CycleEventCreate(BaseModel):
    profile_id: str
    event_type: Literal["period_start", "period_end", "symptom", "ovulation_test", "note"]
    observed_at: str
    value: Optional[str] = None
    note: Optional[str] = None
    source_type: Literal["manual", "device", "import"] = "manual"


class CycleSettingsUpdate(BaseModel):
    profile_id: str
    typical_cycle_length: Optional[int] = Field(default=None, ge=15, le=60)
    typical_period_length: Optional[int] = Field(default=None, ge=1, le=14)
    reminders_enabled: bool = False


def _as_date(value: str) -> date:
    try:
        return date.fromisoformat(value[:10])
    except Exception as exc:
        raise HTTPException(422, "Invalid date") from exc


def _positive_ovulation_test(value: Any) -> bool:
    normalized = str(value or "").strip().lower()
    return normalized in {"positive", "положительный", "+", "true", "1", "lh_positive"}


def _preceding_start(target: date, starts: list[date]) -> Optional[date]:
    prior = [item for item in starts if item <= target]
    return prior[-1] if prior else None


def _build_phase_estimates(
    *,
    starts: list[date],
    next_start: date,
    period_length: Optional[int],
    ovulation_tests: list[Dict[str, Any]],
) -> Dict[str, Any]:
    """Build profile-specific phase estimates without population timing assumptions.

    Menstrual range is derived only when the user supplied a typical period length.
    Ovulation-related ranges exist only when this same profile has positive ovulation-test
    evidence that can be linked to a preceding recorded period start. We deliberately do
    not infer ovulation from a generic day-14/luteal-phase assumption.
    """
    if not starts:
        return {"state": "insufficient_data", "reason": "no_period_start"}

    last = starts[-1]
    phases: list[Dict[str, Any]] = []
    if period_length:
        menstrual_end = min(last + timedelta(days=int(period_length) - 1), next_start - timedelta(days=1))
        phases.append({
            "key": "menstrual",
            "label": "Менструальная фаза",
            "start": last.isoformat(),
            "end": menstrual_end.isoformat(),
            "status": "predicted",
            "basis": "user_period_length",
        })

    positive_offsets: list[int] = []
    positive_dates: list[date] = []
    for item in ovulation_tests:
        if not _positive_ovulation_test(item.get("value")) or not item.get("observed_at"):
            continue
        observed = _as_date(str(item["observed_at"]))
        start = _preceding_start(observed, starts)
        if not start:
            continue
        offset = (observed - start).days
        if 5 <= offset <= 40:
            positive_offsets.append(offset)
            positive_dates.append(observed)

    ovulation: Dict[str, Any]
    if len(positive_offsets) >= 2:
        median_offset = int(round(statistics.median(positive_offsets)))
        spread = int(round(statistics.median([abs(v - median_offset) for v in positive_offsets])))
        uncertainty = max(1, spread)
        center = last + timedelta(days=median_offset)
        window_start = center - timedelta(days=uncertainty)
        window_end = center + timedelta(days=uncertainty)
        ovulation = {
            "state": "predicted",
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
            "basis": "personal_positive_ovulation_tests",
            "evidence_count": len(positive_offsets),
            "confidence": "medium" if len(positive_offsets) < 5 else "high",
            "disclaimer": "Окно рассчитано только по вашей истории положительных тестов и не подтверждает овуляцию в текущем цикле.",
        }
        if period_length:
            menstrual_end = last + timedelta(days=int(period_length) - 1)
            follicular_start = menstrual_end + timedelta(days=1)
            follicular_end = window_start - timedelta(days=1)
            if follicular_start <= follicular_end:
                phases.append({
                    "key": "follicular",
                    "label": "Фолликулярная фаза",
                    "start": follicular_start.isoformat(),
                    "end": follicular_end.isoformat(),
                    "status": "predicted",
                    "basis": "personal_ovulation_test_history",
                })
        phases.append({
            "key": "ovulation_window",
            "label": "Окно возможной овуляции",
            "start": window_start.isoformat(),
            "end": window_end.isoformat(),
            "status": "predicted",
            "basis": "personal_positive_ovulation_tests",
        })
        luteal_start = window_end + timedelta(days=1)
        luteal_end = next_start - timedelta(days=1)
        if luteal_start <= luteal_end:
            phases.append({
                "key": "luteal",
                "label": "Лютеиновая фаза",
                "start": luteal_start.isoformat(),
                "end": luteal_end.isoformat(),
                "status": "predicted",
                "basis": "personal_ovulation_test_history",
            })
    else:
        ovulation = {
            "state": "insufficient_data",
            "basis": "none",
            "evidence_count": len(positive_offsets),
            "message": "Недостаточно персональных положительных тестов для оценки овуляционного окна.",
        }

    return {
        "state": "data" if phases else "insufficient_data",
        "phases": phases,
        "ovulation": ovulation,
        "disclaimer": "Все фазы являются расчётными диапазонами. Фактические события имеют приоритет над прогнозом.",
    }


def build_cycle_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/cycle", tags=["cycle"])

    async def require(account: Dict[str, Any], profile_id: str, write: bool = False):
        if not await auth.has_profile_access(str(account["id"]), profile_id, write=write):
            raise HTTPException(404, "Profile not found")

    @router.get("/{profile_id}")
    async def get_cycle(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require(account, profile_id)
        events = await db.cycle_events.find({"profile_id": profile_id}, {"_id": 0}).sort("observed_at", -1).to_list(1000)
        settings = await db.cycle_settings.find_one({"profile_id": profile_id}, {"_id": 0}) or {}
        return {"profile_id": profile_id, "events": events, "settings": settings}

    @router.post("/events")
    async def add_event(data: CycleEventCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require(account, data.profile_id, write=True)
        _as_date(data.observed_at)
        event = {"id": str(uuid.uuid4()), **data.model_dump(), "created_at": _now_iso()}
        await db.cycle_events.insert_one(event)
        return event

    @router.delete("/events/{event_id}")
    async def delete_event(event_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        event = await db.cycle_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(404, "Cycle event not found")
        await require(account, str(event.get("profile_id") or ""), write=True)
        await db.cycle_events.delete_one({"id": event_id})
        return {"ok": True}

    @router.put("/settings")
    async def save_settings(data: CycleSettingsUpdate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require(account, data.profile_id, write=True)
        payload = {**data.model_dump(), "updated_at": _now_iso()}
        current = await db.cycle_settings.find_one({"profile_id": data.profile_id}, {"_id": 0})
        if current:
            await db.cycle_settings.update_one({"profile_id": data.profile_id}, {"$set": payload})
        else:
            payload["id"] = str(uuid.uuid4())
            await db.cycle_settings.insert_one(payload)
        return payload

    @router.get("/{profile_id}/forecast")
    async def forecast(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require(account, profile_id)
        starts = await db.cycle_events.find({"profile_id": profile_id, "event_type": "period_start"}, {"_id": 0}).sort("observed_at", 1).to_list(1000)
        ovulation_tests = await db.cycle_events.find({"profile_id": profile_id, "event_type": "ovulation_test"}, {"_id": 0}).sort("observed_at", 1).to_list(1000)
        settings = await db.cycle_settings.find_one({"profile_id": profile_id}, {"_id": 0}) or {}
        dates = sorted({_as_date(str(item.get("observed_at"))) for item in starts if item.get("observed_at")})
        intervals = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]
        plausible = [v for v in intervals if 15 <= v <= 60]
        configured = settings.get("typical_cycle_length")

        if len(plausible) >= 2:
            cycle_length = int(round(statistics.median(plausible)))
            spread = int(round(statistics.median([abs(v - cycle_length) for v in plausible]))) if plausible else 0
            confidence = "high" if len(plausible) >= 5 and spread <= 3 else "medium"
            basis = "personal_history"
        elif configured:
            cycle_length = int(configured)
            spread = 3
            confidence = "low"
            basis = "user_settings"
        else:
            return {
                "state": "insufficient_data",
                "profile_id": profile_id,
                "message": "Недостаточно личных данных для прогноза",
                "evidence_count": len(dates),
            }

        if not dates:
            return {"state": "insufficient_data", "profile_id": profile_id, "message": "Нет даты начала последней менструации", "evidence_count": 0}
        last = dates[-1]
        next_start = last + timedelta(days=cycle_length)
        uncertainty = max(2, spread)
        today = date.today()
        cycle_day = (today - last).days + 1 if today >= last else None
        phase_estimates = _build_phase_estimates(
            starts=dates,
            next_start=next_start,
            period_length=settings.get("typical_period_length"),
            ovulation_tests=ovulation_tests,
        )
        return {
            "state": "data",
            "profile_id": profile_id,
            "cycle_day": cycle_day,
            "last_period_start": last.isoformat(),
            "estimated_next_start": next_start.isoformat(),
            "window_start": (next_start - timedelta(days=uncertainty)).isoformat(),
            "window_end": (next_start + timedelta(days=uncertainty)).isoformat(),
            "estimated_cycle_length": cycle_length,
            "confidence": confidence,
            "basis": basis,
            "evidence_count": len(dates),
            "phase_estimates": phase_estimates,
            "disclaimer": "Прогноз основан на вашей истории и не является подтверждением овуляции или беременности.",
        }

    return router
