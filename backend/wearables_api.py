"""Unified wearable/device ingestion API for Aida.

Native system bridges (Apple Health / Android Health Connect) and cloud
connectors normalize their data into one canonical measurement contract. A
separate connection registry keeps permission/sync state even when a connected
device has not produced any samples yet.
"""

from __future__ import annotations

import hashlib
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


PROVIDERS: Dict[str, Dict[str, Any]] = {
    "apple_health": {
        "name": "Apple Health",
        "devices": ["Apple Watch", "iPhone", "HealthKit-compatible devices"],
        "mode": "native_system",
        "platform": "ios",
        "ready": True,
        "capabilities": ["heart_rate", "resting_heart_rate", "hrv_sdnn", "steps", "active_energy", "sleep", "spo2", "respiratory_rate", "wrist_temperature", "vo2_max", "weight", "body_fat"],
    },
    "android_health_connect": {
        "name": "Health Connect",
        "devices": ["Samsung Galaxy Watch", "Fitbit", "Xiaomi", "Android health devices"],
        "mode": "native_system",
        "platform": "android",
        "ready": True,
        "capabilities": ["heart_rate", "hrv_rmssd", "steps", "active_energy", "sleep", "spo2", "respiratory_rate", "skin_temperature", "vo2_max", "weight", "body_fat"],
    },
    "fitbit": {"name": "Fitbit", "devices": ["Fitbit watches and trackers"], "mode": "cloud_oauth", "platform": "cloud", "ready": False, "capabilities": []},
    "garmin": {"name": "Garmin", "devices": ["Garmin watches and trackers"], "mode": "cloud_partner", "platform": "cloud", "ready": False, "capabilities": []},
    "oura": {"name": "Oura", "devices": ["Oura Ring"], "mode": "cloud_oauth", "platform": "cloud", "ready": False, "capabilities": []},
    "withings": {"name": "Withings", "devices": ["Withings watches", "scales", "sleep devices", "blood-pressure devices"], "mode": "cloud_oauth", "platform": "cloud", "ready": False, "capabilities": []},
}

CORE_METRICS = {
    "heart_rate", "resting_heart_rate", "hrv_sdnn", "hrv_rmssd", "steps", "active_energy", "total_energy", "distance",
    "sleep_stage", "sleep_session", "spo2", "respiratory_rate", "wrist_temperature", "skin_temperature", "body_temperature",
    "basal_temperature", "vo2_max", "weight", "body_fat_percentage", "lean_body_mass", "blood_pressure_systolic", "blood_pressure_diastolic",
}

STALE_AFTER = timedelta(hours=36)
CONNECTION_STATES = {"not_connected", "connected_no_data", "permission_denied", "sync_error", "data", "stale"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def sample_fingerprint(provider: str, profile_id: str, sample: "WearableSample") -> str:
    payload = "|".join([
        provider, profile_id, sample.metric, sample.start_at.astimezone(timezone.utc).isoformat(),
        (sample.end_at or sample.start_at).astimezone(timezone.utc).isoformat(), format(sample.value, ".12g"),
        sample.unit.strip().lower(), (sample.source_name or "").strip().lower(), (sample.device_name or "").strip().lower(),
    ])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def sample_state(latest: Optional[Dict[str, Any]], now: Optional[datetime] = None) -> str:
    if not latest:
        return "not_connected"
    observed = latest.get("end_at") or latest.get("start_at") or latest.get("synced_at")
    if not observed:
        return "data"
    if isinstance(observed, str):
        try:
            observed = datetime.fromisoformat(observed.replace("Z", "+00:00"))
        except ValueError:
            return "data"
    if observed.tzinfo is None:
        observed = observed.replace(tzinfo=timezone.utc)
    return "stale" if (now or _now()) - observed.astimezone(timezone.utc) > STALE_AFTER else "data"


class WearableSample(BaseModel):
    external_id: Optional[str] = None
    metric: str
    value: float
    unit: str = Field(min_length=1, max_length=64)
    start_at: datetime
    end_at: Optional[datetime] = None
    source_name: Optional[str] = None
    device_name: Optional[str] = None
    recording_method: Optional[str] = None
    timezone_offset_minutes: Optional[int] = Field(default=None, ge=-840, le=840)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WearableSyncRequest(BaseModel):
    profile_id: str
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    sync_cursor: Optional[str] = Field(default=None, max_length=1024)
    samples: List[WearableSample] = Field(default_factory=list, max_length=5000)


class WearableConnectionUpdate(BaseModel):
    profile_id: str
    state: Literal["connected_no_data", "permission_denied", "sync_error", "data"]
    error_code: Optional[str] = Field(default=None, max_length=120)
    error_message: Optional[str] = Field(default=None, max_length=500)
    device_name: Optional[str] = Field(default=None, max_length=200)
    device_model: Optional[str] = Field(default=None, max_length=200)
    os_version: Optional[str] = Field(default=None, max_length=120)


class WearableSyncResponse(BaseModel):
    ok: bool = True
    provider: str
    inserted: int
    skipped: int
    rejected: int = 0
    state: str
    last_sync_at: datetime
    sync_cursor: Optional[str] = None


def build_wearables_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/health/wearables", tags=["wearables"])

    async def require_access(account_id: str, profile_id: str, write: bool = False):
        if not await auth.has_profile_access(account_id, profile_id, write=write):
            raise HTTPException(404, "Profile not found")

    async def save_connection(provider: str, profile_id: str, state: str, **patch: Any):
        if state not in CONNECTION_STATES:
            raise ValueError("Unsupported connection state")
        now = _now()
        existing = await db.wearable_connections.find_one({"profile_id": profile_id, "provider_id": provider}, {"_id": 0})
        payload = {"state": state, "updated_at": now, **patch}
        if existing:
            await db.wearable_connections.update_one({"id": existing.get("id")}, {"$set": payload})
        else:
            await db.wearable_connections.insert_one({
                "id": str(uuid.uuid4()), "profile_id": profile_id, "provider_id": provider,
                "created_at": now, **payload,
            })

    @router.get("/providers")
    async def list_providers(account: Dict[str, Any] = Depends(auth.require_account)):
        _ = account
        return {"providers": [{"id": key, **value} for key, value in PROVIDERS.items()], "core_metrics": sorted(CORE_METRICS)}

    @router.post("/{provider}/connection")
    async def update_connection(provider: str, data: WearableConnectionUpdate, account: Dict[str, Any] = Depends(auth.require_account)):
        meta = PROVIDERS.get(provider)
        if not meta:
            raise HTTPException(404, "Unsupported wearable provider")
        await require_access(str(account["id"]), data.profile_id, write=True)
        await save_connection(
            provider, data.profile_id, data.state,
            error_code=data.error_code, error_message=data.error_message,
            device_name=data.device_name, device_model=data.device_model, os_version=data.os_version,
            last_attempt_at=_now(),
        )
        return {"ok": True, "provider": provider, "state": data.state}

    @router.post("/{provider}/sync", response_model=WearableSyncResponse)
    async def sync_provider(provider: str, data: WearableSyncRequest, account: Dict[str, Any] = Depends(auth.require_account)):
        meta = PROVIDERS.get(provider)
        if not meta:
            raise HTTPException(404, "Unsupported wearable provider")
        if not meta.get("ready"):
            raise HTTPException(409, "Provider connector is not enabled")
        await require_access(str(account["id"]), data.profile_id, write=True)

        inserted = skipped = rejected = 0
        synced_at = _now()
        for sample in data.samples:
            metric = sample.metric.strip().lower()
            if metric not in CORE_METRICS or not math.isfinite(sample.value):
                rejected += 1
                continue
            if sample.end_at and sample.end_at < sample.start_at:
                rejected += 1
                continue
            fingerprint = sample_fingerprint(provider, data.profile_id, sample)
            lookup = {"profile_id": data.profile_id, "source": provider, "external_id": sample.external_id} if sample.external_id else {"profile_id": data.profile_id, "source": provider, "source_fingerprint": fingerprint}
            if await db.vitals.find_one(lookup, {"_id": 0}):
                skipped += 1
                continue
            await db.vitals.insert_one({
                "id": str(uuid.uuid4()), "profile_id": data.profile_id, "source": provider, "provider_id": provider,
                "external_id": sample.external_id, "source_record_id": sample.external_id, "source_fingerprint": fingerprint,
                "metric": metric, "type": metric, "value": sample.value, "unit": sample.unit.strip(),
                "start_at": sample.start_at, "end_at": sample.end_at or sample.start_at, "observed_at": sample.end_at or sample.start_at,
                "received_at": synced_at, "source_name": sample.source_name, "device_name": sample.device_name or data.device_name,
                "device_model": data.device_model, "os_version": data.os_version, "recording_method": sample.recording_method,
                "timezone_offset_minutes": sample.timezone_offset_minutes, "metadata": sample.metadata, "sync_cursor": data.sync_cursor,
                "verification_status": "source_reported", "synced_at": synced_at,
            })
            inserted += 1
        state = "data" if inserted or skipped else "connected_no_data"
        await save_connection(
            provider, data.profile_id, state,
            last_sync_at=synced_at, sync_cursor=data.sync_cursor,
            error_code=None, error_message=None,
            device_name=data.device_name, device_model=data.device_model, os_version=data.os_version,
        )
        return WearableSyncResponse(provider=provider, inserted=inserted, skipped=skipped, rejected=rejected, state=state, last_sync_at=synced_at, sync_cursor=data.sync_cursor)

    @router.get("/status/{profile_id}")
    async def wearable_status(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_access(str(account["id"]), profile_id)
        result = []
        for provider, meta in PROVIDERS.items():
            rows = await db.vitals.find({"profile_id": profile_id, "source": provider}, {"_id": 0}).sort("synced_at", -1).to_list(1)
            latest = rows[0] if rows else None
            connection = await db.wearable_connections.find_one({"profile_id": profile_id, "provider_id": provider}, {"_id": 0})
            measured_state = sample_state(latest)
            if latest:
                state = measured_state
            elif connection:
                state = str(connection.get("state") or "connected_no_data")
            else:
                state = "not_connected"
            connected = state in {"connected_no_data", "data", "stale", "sync_error"}
            result.append({
                "id": provider, **meta, "state": state, "connected": connected,
                "last_sync_at": (latest or {}).get("synced_at") or (connection or {}).get("last_sync_at"),
                "last_attempt_at": (connection or {}).get("last_attempt_at"), "freshness": measured_state if latest else state,
                "error": {"code": (connection or {}).get("error_code"), "message": (connection or {}).get("error_message")} if connection and connection.get("error_message") else None,
                "device": {
                    "name": (latest or {}).get("device_name") or (connection or {}).get("device_name"),
                    "model": (latest or {}).get("device_model") or (connection or {}).get("device_model"),
                    "os_version": (latest or {}).get("os_version") or (connection or {}).get("os_version"),
                } if latest or connection else None,
            })
        return {"providers": result}

    return router
