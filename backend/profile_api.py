"""Extended profile API for Aida 2.0 medical card and onboarding."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from module_config import apply_legacy_module_settings, effective_module_map, module_settings_projection
from puzzle_api import widgets_for_goals

logger = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc)


def _default_privacy() -> Dict[str, Any]:
    return {
        "include_in_ai_context": True,
        "share_documents": False,
        "show_notification_details": False,
        "allow_wearable_ai": True,
    }


def _module_settings_for_goals(goals: List[str] | None) -> Dict[str, bool]:
    selected = {str(goal) for goal in (goals or []) if goal}
    if not selected:
        return {}
    general = "general" in selected
    chronic = "chronic" in selected
    women_selected = bool(selected & {"women", "cycle", "pregnancy_planning", "pregnancy"})
    return {
        "general": general,
        "labs": general or chronic or "labs" in selected,
        "symptoms": general or chronic or "symptoms" in selected,
        "pressure": general or chronic or "pressure" in selected,
        "sleep": general or "sleep" in selected or "mental" in selected,
        "mental": general or "mental" in selected or "sleep" in selected,
        "chronic": chronic,
        "meds": chronic or "meds" in selected,
        "women": women_selected,
    }


class Surgery(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    date: Optional[str] = None
    note: Optional[str] = None


class ProfileFull(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    kind: str
    dob: Optional[str] = None
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    blood_type: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    chronic_conditions: List[str] = Field(default_factory=list)
    mental_conditions: List[str] = Field(default_factory=list)
    diagnoses: List[str] = Field(default_factory=list)
    surgeries: List[Surgery] = Field(default_factory=list)
    avatar_url: Optional[str] = None
    privacy: Dict[str, Any] = Field(default_factory=_default_privacy)
    module_settings: Dict[str, bool] = Field(default_factory=dict)
    module_config: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    goals: List[str] = Field(default_factory=list)
    onboarding_completed: bool = False
    women_health: Dict[str, Any] = Field(default_factory=dict)
    lifestyle: Dict[str, Any] = Field(default_factory=dict)
    emergency_contacts: List[Dict[str, Any]] = Field(default_factory=list)
    preferred_locale: Optional[str] = None
    timezone: Optional[str] = None
    accessibility: Dict[str, Any] = Field(default_factory=dict)
    access_role: Optional[str] = None
    is_owner: bool = False
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class ProfileCreate(BaseModel):
    name: str
    kind: str
    dob: Optional[str] = None
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    blood_type: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    chronic_conditions: List[str] = Field(default_factory=list)
    mental_conditions: List[str] = Field(default_factory=list)
    diagnoses: List[str] = Field(default_factory=list)
    surgeries: List[Surgery] = Field(default_factory=list)
    avatar_url: Optional[str] = None
    privacy: Dict[str, Any] = Field(default_factory=dict)
    module_settings: Dict[str, bool] = Field(default_factory=dict)
    goals: List[str] = Field(default_factory=list)
    onboarding_completed: bool = False
    women_health: Dict[str, Any] = Field(default_factory=dict)
    lifestyle: Dict[str, Any] = Field(default_factory=dict)
    emergency_contacts: List[Dict[str, Any]] = Field(default_factory=list)
    preferred_locale: Optional[str] = None
    timezone: Optional[str] = None
    accessibility: Dict[str, Any] = Field(default_factory=dict)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    blood_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    mental_conditions: Optional[List[str]] = None
    diagnoses: Optional[List[str]] = None
    surgeries: Optional[List[Surgery]] = None
    avatar_url: Optional[str] = None
    privacy: Optional[Dict[str, Any]] = None
    module_settings: Optional[Dict[str, bool]] = None
    goals: Optional[List[str]] = None
    onboarding_completed: Optional[bool] = None
    women_health: Optional[Dict[str, Any]] = None
    lifestyle: Optional[Dict[str, Any]] = None
    emergency_contacts: Optional[List[Dict[str, Any]]] = None
    preferred_locale: Optional[str] = None
    timezone: Optional[str] = None
    accessibility: Optional[Dict[str, Any]] = None


def _normalize(doc: Dict[str, Any], access_role: Optional[str] = None) -> Dict[str, Any]:
    out = dict(doc)
    out.setdefault("allergies", [])
    out.setdefault("chronic_conditions", [])
    out.setdefault("mental_conditions", [])
    out.setdefault("diagnoses", [])
    out.setdefault("surgeries", [])
    privacy = _default_privacy()
    privacy.update(out.get("privacy") or {})
    out["privacy"] = privacy
    out.setdefault("module_settings", {})
    legacy_module_settings = dict(out.get("module_settings") or {})
    out["module_config"] = effective_module_map(out)
    out["module_settings"] = module_settings_projection(out["module_config"], legacy_module_settings)
    out.setdefault("goals", [])
    out.setdefault("onboarding_completed", False)
    out.setdefault("women_health", {})
    out.setdefault("lifestyle", {})
    out.setdefault("emergency_contacts", [])
    out.setdefault("preferred_locale", None)
    out.setdefault("timezone", None)
    out.setdefault("accessibility", {})
    out["access_role"] = access_role
    out["is_owner"] = access_role == "owner"
    return out


def build_profile_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/profiles", tags=["profiles"])

    async def current_grant(account_id: str, profile_id: str):
        grant = await db.access_grants.find_one({"account_id": account_id, "profile_id": profile_id}, {"_id": 0})
        if not grant or grant.get("revoked_at"):
            return None
        return grant

    async def require_access(account_id: str, profile_id: str, write: bool = False):
        grant = await current_grant(account_id, profile_id)
        if not grant:
            raise HTTPException(404, "Profile not found")
        role = str(grant.get("role") or "viewer")
        if write and role not in {"owner", "editor"}:
            raise HTTPException(404, "Profile not found")
        return grant

    async def require_owner(account_id: str, profile_id: str):
        grant = await current_grant(account_id, profile_id)
        if not grant or str(grant.get("role") or "") != "owner":
            raise HTTPException(404, "Profile not found")

    async def sync_goal_puzzle(profile_id: str, effective_goals: List[str]) -> None:
        try:
            existing_puzzle = await db.puzzle.find_one({"profile_id": profile_id}, {"_id": 0})
            puzzle_source = str((existing_puzzle or {}).get("source") or "")
            can_sync_goal_puzzle = not existing_puzzle or puzzle_source in {"onboarding_goals", "goals", "goals_fallback"}
            if can_sync_goal_puzzle:
                await db.puzzle.update_one(
                    {"profile_id": profile_id},
                    {"$set": {
                        "profile_id": profile_id,
                        "widgets": widgets_for_goals(effective_goals),
                        "source": "goals",
                        "updated_at": _now(),
                    }},
                    upsert=True,
                )
        except Exception:
            logger.exception("Goal puzzle background sync failed: profile_id=%s", profile_id)

    @router.get("", response_model=List[ProfileFull])
    async def list_profiles(account: Dict[str, Any] = Depends(auth.require_account)):
        grants = await db.access_grants.find({"account_id": account["id"]}, {"_id": 0}).to_list(500)
        active_grants = {
            str(grant.get("profile_id")): grant
            for grant in grants
            if grant.get("profile_id") and not grant.get("revoked_at")
        }
        if not active_grants:
            return []
        docs = await db.profiles.find({}, {"_id": 0}).sort("created_at", 1).to_list(1000)
        return [
            _normalize(d, str(active_grants[str(d.get("id"))].get("role") or "viewer"))
            for d in docs
            if str(d.get("id")) in active_grants
        ]

    @router.post("", response_model=ProfileFull)
    async def create_profile(data: ProfileCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        payload = data.model_dump()
        payload["account_id"] = account["id"]
        privacy = _default_privacy()
        privacy.update(payload.get("privacy") or {})
        payload["privacy"] = privacy
        if payload.get("module_settings"):
            legacy_settings = dict(payload["module_settings"])
            payload["module_config"] = apply_legacy_module_settings(payload, legacy_settings)
            payload["module_settings"] = module_settings_projection(payload["module_config"], legacy_settings)
            payload["module_settings_source"] = "user"
        p = ProfileFull(**payload, access_role="owner", is_owner=True)
        doc = p.model_dump(exclude={"access_role", "is_owner"})
        doc["account_id"] = account["id"]
        await db.profiles.insert_one(doc)
        try:
            await db.access_grants.insert_one({"id": str(uuid.uuid4()), "account_id": account["id"], "profile_id": p.id, "role": "owner", "created_at": _now(), "revoked_at": None})
        except Exception:
            await db.profiles.delete_one({"id": p.id})
            raise
        return p

    @router.get("/{profile_id}", response_model=ProfileFull)
    async def get_profile(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        account_id = str(account["id"])
        grant = await require_access(account_id, profile_id)
        doc = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Profile not found")
        return _normalize(doc, str(grant.get("role") or "viewer"))

    @router.put("/{profile_id}", response_model=ProfileFull)
    async def update_profile(
        profile_id: str,
        data: ProfileUpdate,
        background_tasks: BackgroundTasks,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        account_id = str(account["id"])
        grant = await require_access(account_id, profile_id, write=True)
        current = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        if not current:
            raise HTTPException(404, "Profile not found")
        patch = data.model_dump(exclude_unset=True)
        if "privacy" in patch and patch["privacy"] is not None:
            merged = _default_privacy()
            merged.update(current.get("privacy") or {})
            merged.update(patch["privacy"] or {})
            patch["privacy"] = merged

        if "module_settings" in patch and patch["module_settings"] is not None:
            incoming_settings = dict(patch["module_settings"] or {})
            legacy_settings = dict(current.get("module_settings") or {})
            legacy_settings.update(incoming_settings)
            config = apply_legacy_module_settings(current, incoming_settings)
            patch["module_config"] = config
            patch["module_settings"] = module_settings_projection(config, legacy_settings)
            patch["module_settings_source"] = "user"

        was_completed = bool(current.get("onboarding_completed"))
        finishing_onboarding = patch.get("onboarding_completed") is True and not was_completed
        goals_changed = "goals" in patch and list(patch.get("goals") or []) != list(current.get("goals") or [])
        effective_goals = list(patch.get("goals") if "goals" in patch else (current.get("goals") or []))

        has_user_module_config = any(
            str(item.get("source") or "") == "user"
            for item in (current.get("module_config") or {}).values()
            if isinstance(item, dict)
        ) if isinstance(current.get("module_config"), dict) else False

        if "module_settings" not in patch and (finishing_onboarding or goals_changed):
            current_settings = current.get("module_settings") or {}
            if not has_user_module_config and (finishing_onboarding or not current_settings or current.get("module_settings_source") == "goals"):
                patch["module_settings"] = _module_settings_for_goals(effective_goals)
                patch["module_settings_source"] = "goals"

        patch["updated_at"] = _now()
        await db.profiles.update_one({"id": profile_id}, {"$set": patch})

        if finishing_onboarding:
            background_tasks.add_task(sync_goal_puzzle, profile_id, effective_goals)
        elif was_completed and goals_changed:
            await sync_goal_puzzle(profile_id, effective_goals)

        doc = dict(current)
        doc.update(patch)
        return _normalize(doc, str(grant.get("role") or "viewer"))

    @router.delete("/{profile_id}")
    async def delete_profile(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_owner(str(account["id"]), profile_id)
        await db.profiles.delete_one({"id": profile_id})
        for collection in (
            db.labs, db.symptoms, db.medications, db.medication_events, db.chat_messages,
            db.vitals, db.checkins, db.tasks, db.files, db.candidates, db.puzzle,
            db.circadian_events, db.circadian_plans, db.nutrition_entries, db.access_grants,
        ):
            await collection.delete_many({"profile_id": profile_id})
        return {"ok": True}

    return router
