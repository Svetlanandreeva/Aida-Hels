"""Apple Health / HealthKit sync API for Aida 2.0."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


class HealthSample(BaseModel):
    external_id: Optional[str] = None
    metric: str
    value: float
    unit: str
    start_at: datetime
    end_at: Optional[datetime] = None
    source_name: Optional[str] = None
    device_name: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AppleHealthSyncRequest(BaseModel):
    profile_id: str
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    samples: List[HealthSample] = Field(default_factory=list, max_length=5000)


class AppleHealthSyncResponse(BaseModel):
    ok: bool = True
    inserted: int
    skipped: int
    last_sync_at: datetime


def build_healthkit_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/health/apple", tags=["apple-health"])

    async def require_access(account_id: str, profile_id: str, write: bool = False):
        if not await auth.has_profile_access(account_id, profile_id, write=write):
            raise HTTPException(404, "Profile not found")

    @router.post("/sync", response_model=AppleHealthSyncResponse)
    async def sync_apple_health(
        data: AppleHealthSyncRequest,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_access(str(account["id"]), data.profile_id, write=True)

        inserted = 0
        skipped = 0
        synced_at = _now()

        for sample in data.samples:
            if sample.external_id:
                existing = await db.vitals.find_one(
                    {
                        "profile_id": data.profile_id,
                        "source": "apple_health",
                        "external_id": sample.external_id,
                    },
                    {"_id": 0},
                )
                if existing:
                    skipped += 1
                    continue

            doc = {
                "id": str(uuid.uuid4()),
                "profile_id": data.profile_id,
                "source": "apple_health",
                "external_id": sample.external_id,
                "metric": sample.metric,
                "type": sample.metric,
                "value": sample.value,
                "unit": sample.unit,
                "start_at": sample.start_at,
                "end_at": sample.end_at or sample.start_at,
                "source_name": sample.source_name,
                "device_name": sample.device_name or data.device_name,
                "device_model": data.device_model,
                "os_version": data.os_version,
                "metadata": sample.metadata,
                "synced_at": synced_at,
            }
            await db.vitals.insert_one(doc)
            inserted += 1

        return AppleHealthSyncResponse(
            inserted=inserted,
            skipped=skipped,
            last_sync_at=synced_at,
        )

    @router.get("/status/{profile_id}")
    async def apple_health_status(
        profile_id: str,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_access(str(account["id"]), profile_id)
        rows = await (
            db.vitals.find({"profile_id": profile_id, "source": "apple_health"}, {"_id": 0})
            .sort("synced_at", -1)
            .to_list(1)
        )
        if not rows:
            return {"connected": False, "last_sync_at": None, "device": None}
        latest = rows[0]
        return {
            "connected": True,
            "last_sync_at": latest.get("synced_at"),
            "device": {
                "name": latest.get("device_name"),
                "model": latest.get("device_model"),
                "os_version": latest.get("os_version"),
            },
        }

    @router.get("/latest/{profile_id}")
    async def latest_apple_health(
        profile_id: str,
        limit: int = 100,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_access(str(account["id"]), profile_id)
        limit = max(1, min(limit, 500))
        rows = await (
            db.vitals.find({"profile_id": profile_id, "source": "apple_health"}, {"_id": 0})
            .sort("start_at", -1)
            .to_list(limit)
        )
        return rows

    return router
