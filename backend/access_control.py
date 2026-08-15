"""Shared authorization helpers for profile-scoped Aida APIs."""

from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException


async def require_profile_access(
    auth,
    account: Dict[str, Any],
    profile_id: str,
    *,
    write: bool = False,
) -> None:
    account_id = str(account.get("id") or "")
    profile_id = str(profile_id or "")
    if not account_id or not profile_id:
        raise HTTPException(404, "Profile not found")
    if not await auth.has_profile_access(account_id, profile_id, write=write):
        # Deliberately do not reveal whether a profile exists.
        raise HTTPException(404, "Profile not found")


async def require_record_access(
    db,
    auth,
    account: Dict[str, Any],
    collection_name: str,
    record_id: str,
    *,
    write: bool = False,
):
    collection = getattr(db, collection_name)
    record = await collection.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Record not found")
    await require_profile_access(
        auth,
        account,
        str(record.get("profile_id") or ""),
        write=write,
    )
    return record
