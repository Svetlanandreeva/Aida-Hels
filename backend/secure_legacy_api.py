"""Authenticated wrappers for legacy Aida health endpoints.

The original Aida2 server module remains the implementation source for several
health features during migration. This router is the only production exposure
for those endpoints and enforces account/profile authorization before invoking
legacy handlers.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

import server as legacy_server
from access_control import require_profile_access, require_record_access
from ai_context import build_ai_context
from vital_validation import validate_vital_payload


def _history_allowed(profile: Dict[str, Any]) -> bool:
    privacy = profile.get("privacy") or {}
    if privacy.get("include_in_ai_context") is False:
        return False
    modules = profile.get("module_settings") or {}
    return not any(value is False for value in modules.values())


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
        if not legacy_server.EMERGENT_LLM_KEY:
            raise HTTPException(500, "LLM key is not configured")

        profile = await db.profiles.find_one({"id": req.profile_id}, {"_id": 0})
        if not profile:
            raise HTTPException(404, "Profile not found")

        user_msg = legacy_server.ChatMessage(profile_id=req.profile_id, role="user", text=req.text)
        await db.chat_messages.insert_one(user_msg.model_dump())

        context = await build_ai_context(db, req.profile_id)
        lang_hint = "Отвечай на русском." if language.startswith("ru") else "Reply in English."
        system = legacy_server.AIDA_SYSTEM_PROMPT + f"\n\n{lang_hint}"
        if context:
            system += f"\n\nКонтекст пользователя (JSON):\n{context}"
        else:
            system += "\n\nМедицинский контекст профиля недоступен. Не утверждай, что знаешь сохранённые данные профиля."

        history_text = ""
        if _history_allowed(profile):
            history = await db.chat_messages.find({"profile_id": req.profile_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
            history.reverse()
            history_text = "\n".join([f"{m['role'].upper()}: {m['text']}" for m in history[:-1]])

        prompt = req.text if not history_text else f"История:\n{history_text}\n\nТекущий вопрос: {req.text}"
        try:
            chat_client = legacy_server.LlmChat(
                api_key=legacy_server.EMERGENT_LLM_KEY,
                # A fresh provider session prevents an old server-side conversation
                # cache from retaining data after privacy/module settings change.
                session_id=f"aida-{req.profile_id}-{uuid.uuid4()}",
                system_message=system,
            ).with_model("gemini", legacy_server.GEMINI_MODEL)
            resp = await chat_client.send_message(legacy_server.UserMessage(text=prompt))
            answer = resp if isinstance(resp, str) else str(resp)
        except Exception as exc:
            logging.exception("Chat failed")
            raise HTTPException(500, "Chat failed") from exc

        ai_msg = legacy_server.ChatMessage(profile_id=req.profile_id, role="assistant", text=answer.strip())
        await db.chat_messages.insert_one(ai_msg.model_dump())
        return {"user": user_msg.model_dump(), "assistant": ai_msg.model_dump()}

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
