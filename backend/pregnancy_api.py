"""Pregnancy/planning context for Aida 2.0.

Planning and confirmed pregnancy are distinct states. Gestational timing is derived
only from user-provided LMP or estimated due date; no pregnancy is inferred from
cycle data or planning intent.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_date(value: Optional[str], field: str) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except Exception as exc:
        raise HTTPException(422, f"Invalid {field}") from exc


class PregnancyUpsert(BaseModel):
    profile_id: str
    status: Literal["planning", "pregnant", "postpartum", "completed"]
    lmp_date: Optional[str] = None
    estimated_due_date: Optional[str] = None
    confirmed_at: Optional[str] = None
    outcome: Optional[str] = None
    ended_at: Optional[str] = None
    notes: Optional[str] = None


def _derived(record: Dict[str, Any]) -> Dict[str, Any]:
    status = str(record.get("status") or "")
    if status != "pregnant":
        return {"state": status or "insufficient_data", "gestational_days": None, "gestational_week": None}

    lmp = _parse_date(record.get("lmp_date"), "lmp_date")
    due = _parse_date(record.get("estimated_due_date"), "estimated_due_date")
    today = date.today()
    basis = None
    if lmp:
        gestational_days = (today - lmp).days
        basis = "lmp_date"
    elif due:
        # Standard obstetric due-date convention is used only as a reversible date
        # calculation from the user's explicit EDD, not as evidence of pregnancy.
        gestational_days = 280 - (due - today).days
        basis = "estimated_due_date"
    else:
        return {
            "state": "insufficient_data",
            "gestational_days": None,
            "gestational_week": None,
            "basis": None,
            "message": "Недостаточно данных для расчёта срока",
        }

    if gestational_days < 0:
        return {"state": "insufficient_data", "gestational_days": None, "gestational_week": None, "basis": basis, "message": "Дата находится в будущем"}
    week = gestational_days // 7
    day = gestational_days % 7
    estimated_due = due or (lmp + timedelta(days=280) if lmp else None)
    return {
        "state": "data",
        "gestational_days": gestational_days,
        "gestational_week": week,
        "gestational_day_in_week": day,
        "estimated_due_date": estimated_due.isoformat() if estimated_due else None,
        "basis": basis,
        "disclaimer": "Расчёт срока является календарной оценкой по указанной вами дате и не подтверждает беременность или медицинское состояние.",
    }


def build_pregnancy_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/pregnancy", tags=["pregnancy"])

    async def require(account: Dict[str, Any], profile_id: str, write: bool = False):
        if not await auth.has_profile_access(str(account["id"]), profile_id, write=write):
            raise HTTPException(404, "Profile not found")

    @router.get("/{profile_id}")
    async def get_context(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require(account, profile_id)
        rows = await db.pregnancies.find({"profile_id": profile_id}, {"_id": 0}).sort("updated_at", -1).to_list(50)
        current = next((row for row in rows if row.get("is_current") is not False), None)
        if not current:
            return {"profile_id": profile_id, "state": "no_data", "record": None, "derived": {"state": "no_data"}}
        return {"profile_id": profile_id, "state": "data", "record": current, "derived": _derived(current)}

    @router.put("/{profile_id}")
    async def save_context(profile_id: str, data: PregnancyUpsert, account: Dict[str, Any] = Depends(auth.require_account)):
        if data.profile_id != profile_id:
            raise HTTPException(422, "profile_id mismatch")
        await require(account, profile_id, write=True)
        _parse_date(data.lmp_date, "lmp_date")
        _parse_date(data.estimated_due_date, "estimated_due_date")
        _parse_date(data.confirmed_at, "confirmed_at")
        _parse_date(data.ended_at, "ended_at")
        if data.status == "planning" and data.confirmed_at:
            raise HTTPException(422, "Planning must not be marked as confirmed pregnancy")

        now = _now_iso()
        current = await db.pregnancies.find_one({"profile_id": profile_id, "is_current": True}, {"_id": 0})
        payload = {**data.model_dump(), "profile_id": profile_id, "updated_at": now, "is_current": True}
        if current:
            await db.pregnancies.update_one({"id": current.get("id")}, {"$set": payload})
            payload["id"] = current.get("id")
            payload["created_at"] = current.get("created_at")
        else:
            payload.update({"id": str(uuid.uuid4()), "created_at": now})
            await db.pregnancies.insert_one(payload)
        return {"record": payload, "derived": _derived(payload)}

    @router.post("/{profile_id}/complete")
    async def complete_context(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require(account, profile_id, write=True)
        current = await db.pregnancies.find_one({"profile_id": profile_id, "is_current": True}, {"_id": 0})
        if not current:
            raise HTTPException(404, "Pregnancy context not found")
        await db.pregnancies.update_one({"id": current.get("id")}, {"$set": {"is_current": False, "ended_at": current.get("ended_at") or date.today().isoformat(), "updated_at": _now_iso()}})
        return {"ok": True}

    return router
