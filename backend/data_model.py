"""Canonical production data models for Aida 2.0.

These models define the ownership/permission layer separately from medical
profiles. They are intentionally storage-agnostic and can be used with the
Google Sheets adapter today and a relational database later without changing
frontend contracts.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    display_name: Optional[str] = None
    status: Literal["active", "pending", "disabled"] = "active"
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    last_login_at: Optional[datetime] = None


class AccessGrant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: str
    profile_id: str
    role: Literal["owner", "caregiver", "viewer"] = "owner"
    permissions: List[str] = Field(default_factory=lambda: ["read", "write"])
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    revoked_at: Optional[datetime] = None


class AuditEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: Optional[str] = None
    profile_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    source: Literal["user", "ai", "import", "system"] = "user"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)


class RecordMeta(BaseModel):
    """Metadata shared by medical records and imports."""

    account_id: Optional[str] = None
    profile_id: str
    source: Literal["manual", "upload", "device", "ai", "import"] = "manual"
    verification_status: Literal["unverified", "verified", "rejected"] = "unverified"
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
