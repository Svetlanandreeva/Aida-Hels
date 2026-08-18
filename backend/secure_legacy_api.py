"""Authenticated wrappers for legacy Aida health endpoints.

The original Aida2 server module remains the implementation source for several
health features during migration. This router is the only production exposure
for those endpoints and enforces account/profile authorization before invoking
legacy handlers.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends

import server as legacy_server
from access_control import require_profile_access, require_record_access
from vital_validation import validate_vital_payload


def build_secure_legacy_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["health"])

    @router.get("/labs")
    async def list_labs(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await legacy_server.list_labs(profile_id)

    @router.post("/labs")
    async def create_lab(data: legacy_server.LabTestCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        return await legacy_server.create_lab(data)

    @router.delete("/labs/{lab_id}")
    async def delete_lab(lab_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_record_access(db, auth, account, "labs", lab_id, write=True)
        return await legacy_server.delete_lab(lab_id)

    @router.get("/symptoms")
    async def list_symptoms(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await legacy_server.list_symptoms(profile_id)

    @router.post("/symptoms")
    async def create_symptom(data: legacy_server.SymptomCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        return await legacy_server.create_symptom(data)

    @router.delete("/symptoms/{symptom_id}")
    async def delete_symptom(symptom_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_record_access(db, auth, account, "symptoms", symptom_id, write=True)
        return await legacy_server.delete_symptom(symptom_id)

    @router.get("/chat")
    async def list_chat(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await legacy_server.list_chat(profile_id)

    @router.post("/chat")
    async def chat(req: legacy_server.ChatRequest, language: str = "ru", account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, req.profile_id, write=True)
        return await legacy_server.chat(req, language)

    @router.delete("/chat")
    async def clear_chat(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id, write=True)
        return await legacy_server.clear_chat(profile_id)

    @router.get("/report/{profile_id}")
    async def doctor_report(profile_id: str, days: int = 90, language: str = "ru", account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await legacy_server.doctor_report(profile_id, days, language)

    @router.get("/analytics/readiness/{profile_id}")
    async def readiness(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await legacy_server.readiness(profile_id)

    @router.get("/gamification/{profile_id}")
    async def gamification(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await legacy_server.gamification(profile_id)

    @router.get("/vitals")
    async def list_vitals(profile_id: str, kind: Optional[str] = None, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await legacy_server.list_vitals(profile_id, kind)

    @router.post("/vitals")
    async def create_vital(data: legacy_server.VitalCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        validate_vital_payload(data)
        return await legacy_server.create_vital(data)

    @router.delete("/vitals/{vital_id}")
    async def delete_vital(vital_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_record_access(db, auth, account, "vitals", vital_id, write=True)
        return await legacy_server.delete_vital(vital_id)

    @router.get("/checkins")
    async def list_checkins(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await legacy_server.list_checkins(profile_id)

    @router.post("/checkins")
    async def create_checkin(data: legacy_server.CheckinCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        return await legacy_server.create_checkin(data)

    @router.delete("/checkins/{checkin_id}")
    async def delete_checkin(checkin_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_record_access(db, auth, account, "checkins", checkin_id, write=True)
        return await legacy_server.delete_checkin(checkin_id)

    @router.get("/overview/{profile_id}")
    async def overview(profile_id: str, language: str = "ru", account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await legacy_server.overview(profile_id, language)

    return router
