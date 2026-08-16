"""Family profile sharing and access management for Aida 2.0."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_email(value: str) -> str:
    return value.strip().lower()


class ShareProfileRequest(BaseModel):
    email: EmailStr
    role: Literal["viewer", "editor"] = "viewer"
    expires_at: str | None = None


def build_family_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/family", tags=["family"])

    async def owner_grant(account_id: str, profile_id: str) -> Dict[str, Any]:
        grant = await db.access_grants.find_one(
            {"account_id": account_id, "profile_id": profile_id}, {"_id": 0}
        )
        if not grant or grant.get("revoked_at") or str(grant.get("role") or "") != "owner":
            raise HTTPException(404, "Profile not found")
        return grant

    @router.get("/{profile_id}")
    async def list_profile_access(
        profile_id: str,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        if not await auth.has_profile_access(str(account["id"]), profile_id, write=False):
            raise HTTPException(404, "Profile not found")

        grants = await db.access_grants.find({"profile_id": profile_id}, {"_id": 0}).to_list(500)
        visible = []
        for grant in grants:
            if grant.get("revoked_at"):
                continue
            target = await db.accounts.find_one({"id": grant.get("account_id")}, {"_id": 0})
            visible.append({
                "id": grant.get("id"),
                "account_id": grant.get("account_id"),
                "name": (target or {}).get("name"),
                "email": (target or {}).get("email"),
                "role": grant.get("role") or "viewer",
                "created_at": grant.get("created_at"),
                "expires_at": grant.get("expires_at"),
                "is_current_account": str(grant.get("account_id") or "") == str(account["id"]),
            })

        own = next((item for item in visible if item["is_current_account"]), None)
        return {
            "profile_id": profile_id,
            "current_role": (own or {}).get("role"),
            "can_manage": (own or {}).get("role") == "owner",
            "access": visible,
        }

    @router.post("/{profile_id}/share")
    async def share_profile(
        profile_id: str,
        data: ShareProfileRequest,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await owner_grant(str(account["id"]), profile_id)
        email = _normalize_email(str(data.email))
        target = await db.accounts.find_one({"email": email}, {"_id": 0})
        if not target or target.get("disabled_at"):
            raise HTTPException(404, "Account not found")
        target_id = str(target.get("id") or "")
        if target_id == str(account["id"]):
            raise HTTPException(409, "Profile owner already has access")

        existing = await db.access_grants.find_one(
            {"account_id": target_id, "profile_id": profile_id}, {"_id": 0}
        )
        now = _now_iso()
        if existing:
            if str(existing.get("role") or "") == "owner":
                raise HTTPException(409, "Owner access cannot be replaced")
            await db.access_grants.update_one(
                {"id": existing.get("id")},
                {"$set": {
                    "role": data.role,
                    "expires_at": data.expires_at,
                    "revoked_at": None,
                    "updated_at": now,
                }},
            )
            grant_id = str(existing.get("id"))
        else:
            grant_id = str(uuid.uuid4())
            await db.access_grants.insert_one({
                "id": grant_id,
                "account_id": target_id,
                "profile_id": profile_id,
                "role": data.role,
                "created_at": now,
                "updated_at": now,
                "expires_at": data.expires_at,
                "revoked_at": None,
            })

        return {
            "id": grant_id,
            "profile_id": profile_id,
            "account_id": target_id,
            "name": target.get("name"),
            "email": target.get("email"),
            "role": data.role,
            "expires_at": data.expires_at,
        }

    @router.delete("/{profile_id}/share/{grant_id}")
    async def revoke_profile_access(
        profile_id: str,
        grant_id: str,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await owner_grant(str(account["id"]), profile_id)
        grant = await db.access_grants.find_one({"id": grant_id, "profile_id": profile_id}, {"_id": 0})
        if not grant or grant.get("revoked_at"):
            raise HTTPException(404, "Access grant not found")
        if str(grant.get("role") or "") == "owner":
            raise HTTPException(409, "Owner access cannot be revoked here")
        await db.access_grants.update_one(
            {"id": grant_id}, {"$set": {"revoked_at": _now_iso()}}
        )
        return {"ok": True}

    return router
