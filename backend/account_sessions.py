"""Authenticated account-session management for lost-device recovery.

The routes intentionally expose only session metadata that is useful to the
account owner. Session tokens are never persisted or returned here.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from auth_api import bearer


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _current_session_id(credentials: HTTPAuthorizationCredentials, auth_service) -> str:
    """Return the already-authenticated access token's server-side session id."""
    try:
        claims = jwt.decode(
            credentials.credentials,
            auth_service._require_secret(),
            algorithms=["HS256"],
            issuer=auth_service.jwt_issuer,
            options={"require": ["exp", "iat", "sub", "sid"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Invalid session") from exc
    if claims.get("typ") != "access" or not claims.get("sid"):
        raise HTTPException(401, "Invalid session")
    return str(claims["sid"])


async def _audit(db, *, account_id: str, session_id: Optional[str], action: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    await db.audit_events.insert_one({
        "id": str(uuid.uuid4()),
        "account_id": account_id,
        "subject_profile_id": None,
        "event_type": action,
        "entity_type": "account_session",
        "entity_id": session_id,
        "metadata": metadata or {},
        "created_at": _now_iso(),
    })


def build_account_session_router(db, auth_service) -> APIRouter:
    router = APIRouter(prefix="/api/account/sessions", tags=["account-sessions"])

    @router.get("")
    async def list_sessions(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
        account: Dict[str, Any] = Depends(auth_service.require_account),
    ):
        if not credentials:
            raise HTTPException(401, "Authentication required")
        account_id = str(account.get("id") or "")
        current_session_id = _current_session_id(credentials, auth_service)
        rows = await db.sessions.find({"account_id": account_id}, {"_id": 0}).to_list(5000)
        rows.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        sessions = []
        for row in rows:
            sessions.append({
                "id": str(row.get("id") or ""),
                "created_at": row.get("created_at"),
                "expires_at": row.get("expires_at"),
                "revoked_at": row.get("revoked_at"),
                "active": not bool(row.get("revoked_at")) and str(row.get("expires_at") or "") > _now_iso(),
                "is_current": str(row.get("id") or "") == current_session_id,
            })
        return {"sessions": sessions}

    @router.delete("/{session_id}")
    async def revoke_session_by_id(
        session_id: str,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
        account: Dict[str, Any] = Depends(auth_service.require_account),
    ):
        if not credentials:
            raise HTTPException(401, "Authentication required")
        account_id = str(account.get("id") or "")
        current_session_id = _current_session_id(credentials, auth_service)
        session = await db.sessions.find_one({"id": session_id, "account_id": account_id}, {"_id": 0})
        if not session:
            # Do not reveal another account's session ids.
            raise HTTPException(404, "Session not found")
        if not session.get("revoked_at"):
            await db.sessions.update_one(
                {"id": session_id, "account_id": account_id},
                {"$set": {"revoked_at": _now_iso()}},
            )
            await _audit(
                db,
                account_id=account_id,
                session_id=session_id,
                action="account.session.revoked",
                metadata={"self_revoked": session_id == current_session_id},
            )
        return {"ok": True, "session_id": session_id, "current_session_revoked": session_id == current_session_id}

    @router.post("/revoke-others")
    async def revoke_other_sessions(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
        account: Dict[str, Any] = Depends(auth_service.require_account),
    ):
        if not credentials:
            raise HTTPException(401, "Authentication required")
        account_id = str(account.get("id") or "")
        current_session_id = _current_session_id(credentials, auth_service)
        rows = await db.sessions.find({"account_id": account_id}, {"_id": 0}).to_list(5000)
        now = _now_iso()
        revoked_ids = []
        for row in rows:
            sid = str(row.get("id") or "")
            if not sid or sid == current_session_id or row.get("revoked_at"):
                continue
            await db.sessions.update_one(
                {"id": sid, "account_id": account_id},
                {"$set": {"revoked_at": now}},
            )
            revoked_ids.append(sid)
        await _audit(
            db,
            account_id=account_id,
            session_id=current_session_id,
            action="account.sessions.others_revoked",
            metadata={"revoked_count": len(revoked_ids)},
        )
        return {"ok": True, "current_session_id": current_session_id, "revoked_count": len(revoked_ids)}

    return router
