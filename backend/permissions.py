"""Permission and audit helpers for Aida 2.0.

Enforcement is activated by the authentication layer. Keeping these helpers
separate prevents medical endpoints from inventing their own access rules.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from data_model import AuditEvent


ROLE_PERMISSIONS = {
    "owner": {"read", "write", "share", "delete"},
    "caregiver": {"read", "write"},
    "viewer": {"read"},
}


async def get_profile_grant(db, account_id: str, profile_id: str) -> Optional[Dict[str, Any]]:
    grant = await db.access_grants.find_one(
        {"account_id": account_id, "profile_id": profile_id}, {"_id": 0}
    )
    if not grant or grant.get("revoked_at"):
        return None
    return grant


async def has_profile_permission(db, account_id: str, profile_id: str, permission: str) -> bool:
    grant = await get_profile_grant(db, account_id, profile_id)
    if not grant:
        return False
    explicit = set(grant.get("permissions") or [])
    role_defaults = ROLE_PERMISSIONS.get(grant.get("role"), set())
    return permission in explicit or permission in role_defaults


async def write_audit(
    db,
    *,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    account_id: Optional[str] = None,
    profile_id: Optional[str] = None,
    source: str = "user",
    metadata: Optional[Dict[str, Any]] = None,
):
    event = AuditEvent(
        account_id=account_id,
        profile_id=profile_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        source=source,
        metadata=metadata or {},
    )
    await db.audit_log.insert_one(event.model_dump())
    return event
