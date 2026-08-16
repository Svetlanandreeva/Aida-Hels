"""Cross-cutting APIs required for the first Aida user-testing release.

These endpoints deliberately reuse the existing canonical collections instead of
creating parallel stores. They are small contracts for family access, privacy /
session management, emergency cards, export, body-system availability and a
transparent wellness-age estimate.
"""
from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from ai_context import build_ai_context


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _age(dob: Optional[str]) -> Optional[float]:
    if not dob:
        return None
    try:
        born = date.fromisoformat(str(dob)[:10])
    except ValueError:
        return None
    today = _now().date()
    return (today - born).days / 365.2425


def _latest_numeric(rows: List[Dict[str, Any]], *names: str) -> Optional[float]:
    wanted = {name.lower() for name in names}
    for row in rows:
        label = str(row.get("metric") or row.get("type") or row.get("kind") or "").lower()
        if label in wanted:
            value = row.get("value")
            try:
                value = float(value)
            except (TypeError, ValueError):
                continue
            if math.isfinite(value):
                return value
    return None


class ShareRequest(BaseModel):
    email: EmailStr
    role: Literal["viewer", "editor"] = "viewer"
    expires_at: Optional[datetime] = None


class RevokeSessionRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=128)


def build_user_testing_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["user-testing-foundation"])

    async def require_access(account_id: str, profile_id: str, *, write: bool = False):
        if not await auth.has_profile_access(account_id, profile_id, write=write):
            raise HTTPException(404, "Profile not found")

    async def require_owner(account_id: str, profile_id: str):
        grant = await db.access_grants.find_one({"account_id": account_id, "profile_id": profile_id}, {"_id": 0})
        if not grant or grant.get("revoked_at") or str(grant.get("role")) != "owner":
            raise HTTPException(404, "Profile not found")

    @router.get("/family/{profile_id}")
    async def list_family_access(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_owner(str(account["id"]), profile_id)
        grants = await db.access_grants.find({"profile_id": profile_id}, {"_id": 0}).to_list(500)
        accounts = await db.accounts.find({}, {"_id": 0}).to_list(5000)
        account_map = {str(item.get("id")): item for item in accounts}
        result = []
        now = _now()
        for grant in grants:
            if grant.get("revoked_at"):
                continue
            expires = grant.get("expires_at")
            if expires:
                try:
                    dt = expires if isinstance(expires, datetime) else datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt <= now:
                        continue
                except ValueError:
                    pass
            target = account_map.get(str(grant.get("account_id")), {})
            result.append({
                "id": grant.get("id"),
                "account_id": grant.get("account_id"),
                "email": target.get("email"),
                "name": target.get("name"),
                "role": grant.get("role"),
                "expires_at": grant.get("expires_at"),
                "created_at": grant.get("created_at"),
            })
        return {"profile_id": profile_id, "access": result}

    @router.post("/family/{profile_id}/share")
    async def share_profile(profile_id: str, data: ShareRequest, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_owner(str(account["id"]), profile_id)
        target = await db.accounts.find_one({"email": str(data.email).strip().lower()}, {"_id": 0})
        if not target:
            raise HTTPException(404, "Aida account with this email was not found")
        target_id = str(target.get("id"))
        if target_id == str(account["id"]):
            raise HTTPException(409, "Owner already has access")
        existing = await db.access_grants.find_one({"account_id": target_id, "profile_id": profile_id}, {"_id": 0})
        payload = {
            "role": data.role,
            "expires_at": data.expires_at,
            "revoked_at": None,
            "updated_at": _now(),
        }
        if existing:
            await db.access_grants.update_one({"id": existing.get("id")}, {"$set": payload})
            grant_id = existing.get("id")
        else:
            grant_id = str(uuid.uuid4())
            await db.access_grants.insert_one({
                "id": grant_id,
                "account_id": target_id,
                "profile_id": profile_id,
                "created_at": _now(),
                **payload,
            })
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()), "account_id": account["id"], "profile_id": profile_id,
            "action": "profile.share", "target_account_id": target_id, "role": data.role, "created_at": _now(),
        })
        return {"ok": True, "grant_id": grant_id}

    @router.delete("/family/{profile_id}/share/{grant_id}")
    async def revoke_share(profile_id: str, grant_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_owner(str(account["id"]), profile_id)
        grant = await db.access_grants.find_one({"id": grant_id, "profile_id": profile_id}, {"_id": 0})
        if not grant or str(grant.get("role")) == "owner":
            raise HTTPException(404, "Access grant not found")
        await db.access_grants.update_one({"id": grant_id}, {"$set": {"revoked_at": _now()}})
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()), "account_id": account["id"], "profile_id": profile_id,
            "action": "profile.share.revoke", "target_account_id": grant.get("account_id"), "created_at": _now(),
        })
        return {"ok": True}

    @router.get("/privacy/sessions")
    async def list_sessions(account: Dict[str, Any] = Depends(auth.require_account)):
        rows = await db.sessions.find({"account_id": account["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return {"sessions": [{
            "id": row.get("id"), "created_at": row.get("created_at"), "expires_at": row.get("expires_at"),
            "revoked_at": row.get("revoked_at"), "active": not bool(row.get("revoked_at")),
        } for row in rows]}

    @router.post("/privacy/sessions/revoke")
    async def revoke_session(data: RevokeSessionRequest, account: Dict[str, Any] = Depends(auth.require_account)):
        row = await db.sessions.find_one({"id": data.session_id, "account_id": account["id"]}, {"_id": 0})
        if not row:
            raise HTTPException(404, "Session not found")
        await db.sessions.update_one({"id": data.session_id}, {"$set": {"revoked_at": _now()}})
        return {"ok": True}

    @router.post("/privacy/sessions/revoke-all")
    async def revoke_all_sessions(account: Dict[str, Any] = Depends(auth.require_account)):
        await auth.revoke_all_sessions(str(account["id"]))
        return {"ok": True}

    @router.get("/emergency-card/{profile_id}")
    async def emergency_card(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_access(str(account["id"]), profile_id)
        profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        if not profile:
            raise HTTPException(404, "Profile not found")
        meds = await db.medications.find({"profile_id": profile_id, "active": True}, {"_id": 0}).to_list(100)
        return {
            "profile_id": profile_id,
            "name": profile.get("name"),
            "dob": profile.get("dob"),
            "blood_type": profile.get("blood_type"),
            "allergies": profile.get("allergies") or [],
            "chronic_conditions": profile.get("chronic_conditions") or [],
            "diagnoses": profile.get("diagnoses") or [],
            "medications": [{"name": m.get("name"), "dose": m.get("dose"), "schedule": m.get("schedule")} for m in meds],
            "emergency_contacts": profile.get("emergency_contacts") or [],
            "generated_at": _now(),
        }

    @router.get("/export/{profile_id}")
    async def export_profile(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_access(str(account["id"]), profile_id)
        profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        collections = {
            "labs": db.labs,
            "symptoms": db.symptoms,
            "medications": db.medications,
            "medication_events": db.medication_events,
            "measurements": db.vitals,
            "checkins": db.checkins,
            "tasks": db.tasks,
            "documents": db.files,
        }
        payload: Dict[str, Any] = {"schema_version": "aida-export-v1", "exported_at": _now(), "profile": profile}
        for name, collection in collections.items():
            payload[name] = await collection.find({"profile_id": profile_id}, {"_id": 0}).to_list(10000)
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()), "account_id": account["id"], "profile_id": profile_id,
            "action": "profile.export", "created_at": _now(),
        })
        return payload

    @router.get("/ai/context/{profile_id}")
    async def inspect_context(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_access(str(account["id"]), profile_id)
        return await build_ai_context(db, profile_id, as_json=False)

    @router.get("/insights/biological-age/{profile_id}")
    async def biological_age(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_access(str(account["id"]), profile_id)
        profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        chronological = _age((profile or {}).get("dob"))
        if chronological is None:
            return {"state": "insufficient_data", "reason": "date_of_birth_missing", "age": None}
        vitals = await db.vitals.find({"profile_id": profile_id}, {"_id": 0}).sort("observed_at", -1).to_list(500)
        height = (profile or {}).get("height_cm")
        weight = _latest_numeric(vitals, "weight") or (profile or {}).get("weight_kg")
        resting_hr = _latest_numeric(vitals, "resting_heart_rate")
        vo2 = _latest_numeric(vitals, "vo2_max")
        steps = _latest_numeric(vitals, "steps")
        factors: List[Dict[str, Any]] = []
        delta = 0.0
        if height and weight:
            bmi = float(weight) / ((float(height) / 100.0) ** 2)
            effect = max(-2.0, min(4.0, abs(bmi - 22.0) * 0.35 - 0.8))
            delta += effect
            factors.append({"metric": "bmi", "value": round(bmi, 1), "effect_years": round(effect, 1)})
        if resting_hr is not None:
            effect = max(-2.5, min(3.5, (resting_hr - 62.0) / 9.0))
            delta += effect
            factors.append({"metric": "resting_heart_rate", "value": resting_hr, "effect_years": round(effect, 1)})
        if vo2 is not None:
            effect = max(-3.5, min(3.5, (35.0 - vo2) / 5.0))
            delta += effect
            factors.append({"metric": "vo2_max", "value": vo2, "effect_years": round(effect, 1)})
        if steps is not None:
            effect = max(-2.0, min(2.0, (7000.0 - steps) / 3500.0))
            delta += effect
            factors.append({"metric": "steps", "value": steps, "effect_years": round(effect, 1)})
        if len(factors) < 2:
            return {"state": "insufficient_data", "reason": "need_at_least_two_supported_metrics", "age": None, "chronological_age": round(chronological, 1), "factors": factors}
        estimate = max(18.0, chronological + delta / len(factors))
        return {
            "state": "data", "age": round(estimate, 1), "chronological_age": round(chronological, 1),
            "factors": factors, "method": "aida_wellness_estimate_v1", "clinical": False,
            "explanation": "Wellness estimate based only on available measurements; it is not a validated medical age or diagnosis.",
        }

    @router.get("/insights/body-systems/{profile_id}")
    async def body_systems(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_access(str(account["id"]), profile_id)
        labs = await db.labs.find({"profile_id": profile_id}, {"_id": 0}).to_list(1000)
        vitals = await db.vitals.find({"profile_id": profile_id}, {"_id": 0}).to_list(5000)
        symptoms = await db.symptoms.find({"profile_id": profile_id}, {"_id": 0}).to_list(1000)
        names = " ".join(str(b.get("name") or "").lower() for l in labs for b in (l.get("biomarkers") or []))
        metrics = {str(v.get("metric") or v.get("type") or v.get("kind") or "").lower() for v in vitals}
        symptom_text = " ".join(str(s.get("name") or "").lower() for s in symptoms)
        definitions = [
            ("cardiovascular", "Сердечно-сосудистая", {"heart_rate", "resting_heart_rate", "blood_pressure_systolic", "blood_pressure_diastolic"}, ("холест", "ldl", "hdl")),
            ("metabolic", "Метаболическая", {"weight", "body_fat_percentage"}, ("глюк", "инсулин", "hba1c")),
            ("respiratory", "Дыхательная", {"spo2", "respiratory_rate", "vo2_max"}, ()),
            ("sleep_recovery", "Сон и восстановление", {"sleep_stage", "sleep_session", "hrv_sdnn", "hrv_rmssd"}, ()),
            ("endocrine", "Эндокринная", set(), ("ттг", "tsh", "т4", "t3", "кортиз")),
            ("hematologic", "Кроветворная", set(), ("гемоглоб", "феррит", "эритроц", "лейкоц")),
        ]
        result = []
        for key, label, metric_keys, lab_tokens in definitions:
            evidence = sum(1 for m in metric_keys if m in metrics) + sum(1 for token in lab_tokens if token in names)
            if key in symptom_text:
                evidence += 1
            result.append({"id": key, "label": label, "state": "data" if evidence else "no_data", "evidence_count": evidence})
        return {"systems": result, "diagnostic": False}

    return router
