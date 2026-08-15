"""Normalized wearable / smart-device ingestion API for Aida.

Native clients (HealthKit, Health Connect) and approved cloud connectors (Garmin,
Oura, Google Health, Samsung Health) translate provider-specific records into the
same sample shape before uploading them here.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

Provider = Literal[
    "apple_health",
    "health_connect",
    "garmin",
    "oura",
    "google_health",
    "samsung_health",
]

SUPPORTED_PROVIDERS: Dict[str, Dict[str, Any]] = {
    "apple_health": {
        "label": "Apple Health / Apple Watch",
        "mode": "native",
        "platform": "ios",
        "status": "ready",
    },
    "health_connect": {
        "label": "Health Connect",
        "mode": "native",
        "platform": "android",
        "status": "ready_for_native_module",
    },
    "google_health": {
        "label": "Google Health / Fitbit",
        "mode": "oauth",
        "platform": "cloud",
        "status": "credentials_required",
    },
    "garmin": {
        "label": "Garmin Connect",
        "mode": "oauth",
        "platform": "cloud",
        "status": "partner_approval_required",
    },
    "oura": {
        "label": "Oura Ring",
        "mode": "oauth",
        "platform": "cloud",
        "status": "credentials_required",
    },
    "samsung_health": {
        "label": "Samsung Health",
        "mode": "native",
        "platform": "android",
        "status": "partner_approval_required",
    },
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class WearableSample(BaseModel):
    external_id: Optional[str] = None
    metric: str
    value: float
    unit: str
    start_at: datetime
    end_at: Optional[datetime] = None
    source_name: Optional[str] = None
    device_name: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WearableSyncRequest(BaseModel):
    profile_id: str
    provider: Provider
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    samples: List[WearableSample] = Field(default_factory=list, max_length=5000)


class WearableSyncResponse(BaseModel):
    ok: bool = True
    provider: Provider
    inserted: int
    skipped: int
    last_sync_at: datetime


def build_wearables_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/health/wearables", tags=["wearables"])

    async def require_access(account_id: str, profile_id: str, write: bool = False):
        if not await auth.has_profile_access(account_id, profile_id, write=write):
            raise HTTPException(404, "Profile not found")

    @router.get("/providers")
    async def list_providers(account: Dict[str, Any] = Depends(auth.require_account)):
        # Authentication is intentional even though this is static metadata: the
        # device-connection screen is part of the private health application.
        return SUPPORTED_PROVIDERS

    @router.post("/sync", response_model=WearableSyncResponse)
    async def sync_wearable(
        data: WearableSyncRequest,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_access(str(account["id"]), data.profile_id, write=True)
        synced_at = _now()
        inserted = 0
        skipped = 0

        for sample in data.samples:
            if sample.external_id:
                existing = await db.vitals.find_one(
                    {
                        "profile_id": data.profile_id,
                        "source": data.provider,
                        "external_id": sample.external_id,
                    },
                    {"_id": 0},
                )
                if existing:
                    skipped += 1
                    continue

            await db.vitals.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "profile_id": data.profile_id,
                    "source": data.provider,
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
            )
            inserted += 1

        return WearableSyncResponse(
            provider=data.provider,
            inserted=inserted,
            skipped=skipped,
            last_sync_at=synced_at,
        )

    @router.get("/status/{profile_id}")
    async def wearable_status(
        profile_id: str,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_access(str(account["id"]), profile_id)
        rows = await (
            db.vitals.find({"profile_id": profile_id}, {"_id": 0})
            .sort("synced_at", -1)
            .to_list(500)
        )
        providers: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            provider = str(row.get("source") or "")
            if provider not in SUPPORTED_PROVIDERS or provider in providers:
                continue
            providers[provider] = {
                "connected": True,
                "last_sync_at": row.get("synced_at"),
                "device": {
                    "name": row.get("device_name"),
                    "model": row.get("device_model"),
                    "os_version": row.get("os_version"),
                },
            }
        return {
            key: providers.get(key, {"connected": False, "last_sync_at": None, "device": None})
            for key in SUPPORTED_PROVIDERS
        }

    @router.get("/latest/{profile_id}")
    async def latest_wearable_samples(
        profile_id: str,
        provider: Optional[Provider] = None,
        limit: int = 100,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_access(str(account["id"]), profile_id)
        query: Dict[str, Any] = {"profile_id": profile_id}
        if provider:
            query["source"] = provider
        else:
            query["source"] = {"$in": list(SUPPORTED_PROVIDERS)}
        limit = max(1, min(limit, 500))
        return await db.vitals.find(query, {"_id": 0}).sort("start_at", -1).to_list(limit)

    return router
