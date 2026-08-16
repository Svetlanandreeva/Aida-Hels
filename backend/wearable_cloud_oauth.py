"""Encrypted OAuth foundation for cloud wearable providers.

Provider credentials and endpoints come from environment variables. Oura and
Withings public endpoints have documented defaults; Fitbit/Garmin authorization
URLs stay environment-driven so production does not guess vendor configuration.
Tokens are encrypted before they are stored inside the account record.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import requests
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cfg(provider: str) -> Dict[str, str]:
    p = provider.upper()
    defaults = {
        "oura": {
            "authorize_url": "https://cloud.ouraring.com/oauth/authorize",
            "token_url": "https://api.ouraring.com/oauth/token",
            "scope": "personal daily heartrate workout spo2Daily",
        },
        "withings": {
            "authorize_url": "https://account.withings.com/oauth2_user/authorize2",
            "token_url": "https://wbsapi.withings.net/v2/oauth2",
            "scope": "user.info,user.metrics,user.activity",
        },
        "fitbit": {"authorize_url": "", "token_url": "https://api.fitbit.com/oauth2/token", "scope": "activity heartrate sleep oxygen_saturation respiratory_rate weight"},
        "garmin": {"authorize_url": "", "token_url": "", "scope": ""},
    }.get(provider, {})
    return {
        "client_id": os.environ.get(f"{p}_CLIENT_ID", "").strip(),
        "client_secret": os.environ.get(f"{p}_CLIENT_SECRET", "").strip(),
        "authorize_url": os.environ.get(f"{p}_AUTHORIZE_URL", defaults.get("authorize_url", "")).strip(),
        "token_url": os.environ.get(f"{p}_TOKEN_URL", defaults.get("token_url", "")).strip(),
        "scope": os.environ.get(f"{p}_SCOPES", defaults.get("scope", "")).strip(),
        "redirect_uri": os.environ.get(f"{p}_REDIRECT_URI", f"https://aidaassistent.ru/oauth/wearables/{provider}/callback").strip(),
    }


def _state_secret() -> bytes:
    secret = os.environ.get("OAUTH_STATE_SECRET", os.environ.get("JWT_SECRET", "")).encode()
    if len(secret) < 32:
        raise HTTPException(503, "OAuth state signing is not configured")
    return secret


def _state(payload: Dict[str, Any]) -> str:
    body = json.dumps(payload, separators=(",", ":"), default=str).encode()
    body64 = base64.urlsafe_b64encode(body).rstrip(b"=")
    sig = hmac.new(_state_secret(), body64, hashlib.sha256).digest()
    return (body64 + b"." + base64.urlsafe_b64encode(sig).rstrip(b"=")).decode()


def _decode_state(value: str) -> Dict[str, Any]:
    try:
        body64, sig64 = value.encode().split(b".", 1)
        expected = hmac.new(_state_secret(), body64, hashlib.sha256).digest()
        supplied = base64.urlsafe_b64decode(sig64 + b"=" * (-len(sig64) % 4))
        if not hmac.compare_digest(expected, supplied):
            raise ValueError("bad signature")
        body = base64.urlsafe_b64decode(body64 + b"=" * (-len(body64) % 4))
        payload = json.loads(body)
        issued = datetime.fromisoformat(str(payload["issued_at"]).replace("Z", "+00:00"))
        if issued.tzinfo is None: issued = issued.replace(tzinfo=timezone.utc)
        if _now() - issued > timedelta(minutes=15):
            raise ValueError("expired")
        return payload
    except Exception as exc:
        raise HTTPException(400, "Invalid OAuth state") from exc


def _fernet() -> Fernet:
    raw = os.environ.get("AIDA_TOKEN_ENCRYPTION_KEY", "").strip()
    if not raw:
        raise HTTPException(503, "Wearable token encryption is not configured")
    try:
        return Fernet(raw.encode())
    except Exception as exc:
        raise HTTPException(503, "Wearable token encryption key is invalid") from exc


def _encrypt(value: Dict[str, Any]) -> str:
    return _fernet().encrypt(json.dumps(value, separators=(",", ":"), default=str).encode()).decode()


def decrypt_connection(value: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(_fernet().decrypt(value.encode()))
    except (InvalidToken, ValueError, json.JSONDecodeError):
        return None


def provider_configuration(provider: str) -> Dict[str, Any]:
    c = _cfg(provider)
    missing = [name for name in ("client_id", "client_secret", "authorize_url", "token_url", "redirect_uri") if not c.get(name)]
    encryption = bool(os.environ.get("AIDA_TOKEN_ENCRYPTION_KEY", "").strip())
    return {"configured": not missing and encryption, "missing": missing + ([] if encryption else ["token_encryption_key"]), "redirect_uri": c.get("redirect_uri")}


def build_wearable_cloud_oauth_router(db, auth) -> APIRouter:
    router = APIRouter(tags=["wearable-cloud-oauth"])
    supported = {"oura", "withings", "fitbit", "garmin"}

    @router.get("/api/health/wearables/cloud/configuration")
    async def configuration(account: Dict[str, Any] = Depends(auth.require_account)):
        _ = account
        return {provider: provider_configuration(provider) for provider in sorted(supported)}

    @router.get("/api/health/wearables/cloud/{provider}/authorize")
    async def authorize(provider: str, profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        if provider not in supported:
            raise HTTPException(404, "Unsupported cloud provider")
        if not await auth.has_profile_access(str(account["id"]), profile_id, write=True):
            raise HTTPException(404, "Profile not found")
        c = _cfg(provider)
        status = provider_configuration(provider)
        if not status["configured"]:
            raise HTTPException(503, {"message": "Provider is not configured", **status})
        state = _state({"account_id": account["id"], "profile_id": profile_id, "provider": provider, "nonce": secrets.token_urlsafe(18), "issued_at": _now().isoformat()})
        params = {"response_type": "code", "client_id": c["client_id"], "redirect_uri": c["redirect_uri"], "state": state}
        if c["scope"]: params["scope"] = c["scope"]
        return {"authorization_url": c["authorize_url"] + "?" + urlencode(params), "provider": provider}

    @router.get("/oauth/wearables/{provider}/callback")
    async def callback(provider: str, code: Optional[str] = Query(default=None), state: str = Query(...), error: Optional[str] = Query(default=None)):
        if provider not in supported:
            raise HTTPException(404, "Unsupported cloud provider")
        payload = _decode_state(state)
        if payload.get("provider") != provider:
            raise HTTPException(400, "Provider mismatch")
        if error or not code:
            return RedirectResponse(f"https://aidaassistent.ru/devices?oauth={provider}&status=denied")
        c = _cfg(provider)
        if not provider_configuration(provider)["configured"]:
            raise HTTPException(503, "Provider is not configured")

        def exchange():
            data = {"grant_type": "authorization_code", "code": code, "redirect_uri": c["redirect_uri"], "client_id": c["client_id"], "client_secret": c["client_secret"]}
            if provider == "withings": data["action"] = "requesttoken"
            response = requests.post(c["token_url"], data=data, timeout=25)
            response.raise_for_status()
            return response.json()

        try:
            token_data = await asyncio.to_thread(exchange)
        except requests.RequestException as exc:
            raise HTTPException(502, "Provider token exchange failed") from exc

        # Withings wraps OAuth fields in body; normalize to one encrypted payload.
        if provider == "withings" and isinstance(token_data.get("body"), dict):
            token_data = token_data["body"]
        if not token_data.get("access_token"):
            raise HTTPException(502, "Provider did not return an access token")

        account_id = str(payload["account_id"])
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        if not account:
            raise HTTPException(404, "Account not found")
        integrations = dict(account.get("integrations") or {})
        integrations[provider] = {
            "profile_id": payload["profile_id"],
            "encrypted_token": _encrypt(token_data),
            "connected_at": _now(),
            "scopes": token_data.get("scope") or c.get("scope"),
        }
        await db.accounts.update_one({"id": account_id}, {"$set": {"integrations": integrations}})
        await db.audit_log.insert_one({"id": secrets.token_urlsafe(18), "account_id": account_id, "profile_id": payload["profile_id"], "action": "wearable.oauth.connected", "provider": provider, "created_at": _now()})
        return RedirectResponse(f"https://aidaassistent.ru/devices?oauth={provider}&status=connected")

    @router.delete("/api/health/wearables/cloud/{provider}")
    async def disconnect(provider: str, account: Dict[str, Any] = Depends(auth.require_account)):
        if provider not in supported:
            raise HTTPException(404, "Unsupported cloud provider")
        current = await db.accounts.find_one({"id": account["id"]}, {"_id": 0}) or {}
        integrations = dict(current.get("integrations") or {})
        integrations.pop(provider, None)
        await db.accounts.update_one({"id": account["id"]}, {"$set": {"integrations": integrations}})
        return {"ok": True}

    return router
