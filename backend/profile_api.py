"""Extended profile API for Aida 2.0 medical card and onboarding."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from puzzle_api import widgets_for_goals


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

    async def require_access(account_id: str, profile_id: str, write: bool = False):
        if not await auth.has_profile_access(account_id, profile_id, write=write):
            raise HTTPException(404, "Profile not found")

    async def current_grant(account_id: str, profile_id: str):
        grant = await db.access_grants.find_one({"account_id": account_id, "profile_id": profile_id}, {"_id": 0})
        if not grant or grant.get("revoked_at"):
            return None
        return grant

    async def require_owner(account_id: str, profile_id: str):
        grant = await current_grant(account_id, profile_id)
        if not grant or str(grant.get("role") or "") != "owner":
            raise HTTPException(404, "Profile not found")

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
        await require_access(account_id, profile_id)
        doc = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Profile not found")
        grant = await current_grant(account_id, profile_id)
        return _normalize(doc, str((grant or {}).get("role") or "viewer"))

    @router.put("/{profile_id}", response_model=ProfileFull)
    async def update_profile(profile_id: str, data: ProfileUpdate, account: Dict[str, Any] = Depends(auth.require_account)):
        account_id = str(account["id"])
        await require_access(account_id, profile_id, write=True)
        current = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        if not current:
            raise HTTPException(404, "Profile not found")
        patch = data.model_dump(exclude_unset=True)
        if "privacy" in patch and patch["privacy"] is not None:
            merged = _default_privacy()
            merged.update(current.get("privacy") or {})
            merged.update(patch["privacy"] or {})
            patch["privacy"] = merged

        # A direct module-settings write is a deliberate user customization and
        # must never be silently replaced by later goal edits.
        if "module_settings" in patch and patch["module_settings"] is not None:
            patch["module_settings_source"] = "user"

        was_completed = bool(current.get("onboarding_completed"))
        finishing_onboarding = patch.get("onboarding_completed") is True and not was_completed
        goals_changed = "goals" in patch and list(patch.get("goals") or []) != list(current.get("goals") or [])
        effective_goals = list(patch.get("goals") if "goals" in patch else (current.get("goals") or []))

        # Goals are the source of the first module configuration. Keep that
        # mapping current while the user has not explicitly customized module
        # settings. Explicit module settings always win.
        if "module_settings" not in patch and (finishing_onboarding or goals_changed):
            current_settings = current.get("module_settings") or {}
            if finishing_onboarding or not current_settings or current.get("module_settings_source") == "goals":
                patch["module_settings"] = _module_settings_for_goals(effective_goals)
                patch["module_settings_source"] = "goals"

        patch["updated_at"] = _now()
        await db.profiles.update_one({"id": profile_id}, {"$set": patch})

        # Draft goal changes during onboarding are frequent and must not fan out
        # into extra puzzle reads/writes. Build the goal-based puzzle once when
        # onboarding completes; after completion, keep syncing future goal edits.
        sync_goal_puzzle = finishing_onboarding or (was_completed and goals_changed)
        if sync_goal_puzzle:
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

        doc = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        grant = await current_grant(account_id, profile_id)
        return _normalize(doc, str((grant or {}).get("role") or "viewer"))

    @router.delete("/{profile_id}")
    async def delete_profile(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_owner(str(account["id"]), profile_id)
        await db.profiles.delete_one({"id": profile_id})
        for collection in (
            db.labs, db.symptoms, db.medications, db.medication_events, db.chat_messages,
            db.vitals, db.checkins, db.tasks, db.files, db.candidates, db.puzzle,
            db.circadian_events, db.circadian_plans, db.access_grants,
        ):
            await collection.delete_many({"profile_id": profile_id})
        return {"ok": True}

    return router
