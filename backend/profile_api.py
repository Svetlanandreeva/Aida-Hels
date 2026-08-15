"""Extended profile API for Aida 2.0 medical card."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


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
    diagnoses: List[str] = Field(default_factory=list)
    surgeries: List[Surgery] = Field(default_factory=list)
    avatar_url: Optional[str] = None
    privacy: Dict[str, Any] = Field(default_factory=lambda: {
        "include_in_ai_context": True,
        "share_documents": False,
    })
    module_settings: Dict[str, bool] = Field(default_factory=dict)
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
    diagnoses: List[str] = Field(default_factory=list)
    surgeries: List[Surgery] = Field(default_factory=list)
    avatar_url: Optional[str] = None
    privacy: Dict[str, Any] = Field(default_factory=dict)
    module_settings: Dict[str, bool] = Field(default_factory=dict)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    blood_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    diagnoses: Optional[List[str]] = None
    surgeries: Optional[List[Surgery]] = None
    avatar_url: Optional[str] = None
    privacy: Optional[Dict[str, Any]] = None
    module_settings: Optional[Dict[str, bool]] = None


def _normalize(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(doc)
    out.setdefault("allergies", [])
    out.setdefault("chronic_conditions", [])
    out.setdefault("diagnoses", [])
    out.setdefault("surgeries", [])
    out.setdefault("privacy", {"include_in_ai_context": True, "share_documents": False})
    out.setdefault("module_settings", {})
    return out


def build_profile_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/profiles", tags=["profiles"])

    async def require_access(account_id: str, profile_id: str, write: bool = False):
        if not await auth.has_profile_access(account_id, profile_id, write=write):
            # Do not distinguish missing from inaccessible profiles.
            raise HTTPException(404, "Profile not found")

    @router.get("", response_model=List[ProfileFull])
    async def list_profiles(account: Dict[str, Any] = Depends(auth.require_account)):
        grants = await db.access_grants.find({"account_id": account["id"]}, {"_id": 0}).to_list(500)
        profile_ids = {
            str(grant.get("profile_id"))
            for grant in grants
            if grant.get("profile_id") and not grant.get("revoked_at")
        }
        if not profile_ids:
            return []
        docs = await db.profiles.find({}, {"_id": 0}).sort("created_at", 1).to_list(1000)
        return [_normalize(d) for d in docs if str(d.get("id")) in profile_ids]

    @router.post("", response_model=ProfileFull)
    async def create_profile(data: ProfileCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        payload = data.model_dump()
        payload["account_id"] = account["id"]
        p = ProfileFull(**payload)
        doc = p.model_dump()
        doc["account_id"] = account["id"]
        await db.profiles.insert_one(doc)
        try:
            await db.access_grants.insert_one({
                "id": str(uuid.uuid4()),
                "account_id": account["id"],
                "profile_id": p.id,
                "role": "owner",
                "created_at": _now(),
                "revoked_at": None,
            })
        except Exception:
            await db.profiles.delete_one({"id": p.id})
            raise
        return p

    @router.get("/{profile_id}", response_model=ProfileFull)
    async def get_profile(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_access(str(account["id"]), profile_id)
        doc = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Profile not found")
        return _normalize(doc)

    @router.put("/{profile_id}", response_model=ProfileFull)
    async def update_profile(profile_id: str, data: ProfileUpdate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_access(str(account["id"]), profile_id, write=True)
        current = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        if not current:
            raise HTTPException(404, "Profile not found")
        patch = data.model_dump(exclude_unset=True)
        patch["updated_at"] = _now()
        await db.profiles.update_one({"id": profile_id}, {"$set": patch})
        doc = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        return _normalize(doc)

    @router.delete("/{profile_id}")
    async def delete_profile(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_access(str(account["id"]), profile_id, write=True)
        await db.profiles.delete_one({"id": profile_id})
        for collection in (
            db.labs,
            db.symptoms,
            db.medications,
            db.medication_events,
            db.chat_messages,
            db.vitals,
            db.checkins,
            db.tasks,
            db.files,
            db.candidates,
            db.puzzle,
            db.access_grants,
        ):
            await collection.delete_many({"profile_id": profile_id})
        return {"ok": True}

    return router
