"""Social sign-in for Aida via Yandex ID and VK ID.

The browser never receives provider client secrets or Aida access tokens in the
redirect URL. OAuth state/PKCE data and one-time completion tickets are stored
server-side and expire quickly.
"""

from __future__ import annotations

import base64
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


class SocialStartRequest(BaseModel):
    return_uri: str = Field(min_length=1, max_length=1000)


class SocialCompleteRequest(BaseModel):
    ticket: str = Field(min_length=20, max_length=512)


class SocialAuthService:
    providers = ("yandex", "vk")

    def __init__(self, db, auth_service):
        self.db = db
        self.auth_service = auth_service
        self.state_minutes = int(os.environ.get("OAUTH_STATE_MINUTES", "10"))
        self.ticket_minutes = int(os.environ.get("OAUTH_TICKET_MINUTES", "5"))

    def _config(self, provider: str) -> Dict[str, str]:
        if provider == "yandex":
            return {
                "client_id": os.environ.get("YANDEX_CLIENT_ID", "").strip(),
                "client_secret": os.environ.get("YANDEX_CLIENT_SECRET", "").strip(),
                "callback": os.environ.get("YANDEX_REDIRECT_URI", "").strip(),
            }
        if provider == "vk":
            return {
                "client_id": os.environ.get("VK_CLIENT_ID", "").strip(),
                "client_secret": os.environ.get("VK_CLIENT_SECRET", "").strip(),
                "callback": os.environ.get("VK_REDIRECT_URI", "").strip(),
            }
        raise HTTPException(404, "Unknown social provider")

    def configured(self, provider: str) -> bool:
        cfg = self._config(provider)
        return bool(cfg["client_id"] and cfg["client_secret"] and cfg["callback"])

    @staticmethod
    def _validate_return_uri(return_uri: str) -> str:
        value = return_uri.strip()
        allowed = [item.strip() for item in os.environ.get("OAUTH_ALLOWED_RETURN_URIS", "https://aidaassistent.ru/auth").split(",") if item.strip()]
        if value not in allowed:
            raise HTTPException(400, "OAuth return URI is not allowed")
        return value

    async def start(self, provider: str, return_uri: str) -> Dict[str, Any]:
        cfg = self._config(provider)
        if not self.configured(provider):
            raise HTTPException(503, f"{provider.upper()} login is not configured")

        state = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(64)
        now = _now()
        await self.db.oauth_states.insert_one({
            "id": str(uuid.uuid4()),
            "provider": provider,
            "state_hash": _hash(state),
            "code_verifier": verifier,
            "return_uri": self._validate_return_uri(return_uri),
            "created_at": _iso(now),
            "expires_at": _iso(now + timedelta(minutes=self.state_minutes)),
            "used_at": None,
        })

        if provider == "yandex":
            params = {
                "response_type": "code",
                "client_id": cfg["client_id"],
                "redirect_uri": cfg["callback"],
                "state": state,
                "code_challenge": _pkce_challenge(verifier),
                "code_challenge_method": "S256",
                "force_confirm": "no",
            }
            url = "https://oauth.yandex.ru/authorize?" + urlencode(params)
        else:
            params = {
                "response_type": "code",
                "client_id": cfg["client_id"],
                "redirect_uri": cfg["callback"],
                "state": state,
                "code_challenge": _pkce_challenge(verifier),
                "code_challenge_method": "S256",
                "scope": "email",
            }
            url = "https://id.vk.ru/authorize?" + urlencode(params)
        return {"authorization_url": url}

    async def _consume_state(self, provider: str, state: str) -> Dict[str, Any]:
        record = await self.db.oauth_states.find_one({"provider": provider, "state_hash": _hash(state)}, {"_id": 0})
        now = _iso(_now())
        if not record or record.get("used_at") or str(record.get("expires_at") or "") <= now:
            raise HTTPException(400, "OAuth state is invalid or expired")
        await self.db.oauth_states.update_one({"id": record.get("id")}, {"$set": {"used_at": now}})
        return record

    async def _exchange_yandex(self, code: str, state_record: Dict[str, Any]) -> Dict[str, str]:
        cfg = self._config("yandex")
        async with httpx.AsyncClient(timeout=20) as client:
            token_res = await client.post(
                "https://oauth.yandex.ru/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": cfg["client_id"],
                    "client_secret": cfg["client_secret"],
                    "redirect_uri": cfg["callback"],
                    "code_verifier": state_record["code_verifier"],
                },
            )
            if token_res.status_code >= 400:
                raise HTTPException(502, "Yandex ID token exchange failed")
            access_token = str(token_res.json().get("access_token") or "")
            if not access_token:
                raise HTTPException(502, "Yandex ID returned no access token")
            info_res = await client.get(
                "https://login.yandex.ru/info",
                params={"format": "json"},
                headers={"Authorization": f"OAuth {access_token}"},
            )
            if info_res.status_code >= 400:
                raise HTTPException(502, "Yandex ID profile request failed")
            info = info_res.json()
        email = str(info.get("default_email") or "").strip().lower()
        return {
            "provider_user_id": str(info.get("id") or ""),
            "email": email,
            "name": str(info.get("real_name") or info.get("display_name") or email.split("@")[0] or "Yandex user"),
        }

    async def _exchange_vk(self, code: str, state_record: Dict[str, Any], device_id: str) -> Dict[str, str]:
        cfg = self._config("vk")
        if not device_id:
            raise HTTPException(400, "VK ID device_id is missing")
        async with httpx.AsyncClient(timeout=20) as client:
            token_res = await client.post(
                "https://id.vk.ru/oauth2/auth",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "code_verifier": state_record["code_verifier"],
                    "client_id": cfg["client_id"],
                    "client_secret": cfg["client_secret"],
                    "device_id": device_id,
                    "redirect_uri": cfg["callback"],
                },
            )
            if token_res.status_code >= 400:
                raise HTTPException(502, "VK ID token exchange failed")
            token_data = token_res.json()
            access_token = str(token_data.get("access_token") or "")
            if not access_token:
                raise HTTPException(502, "VK ID returned no access token")
            info_res = await client.post(
                "https://id.vk.ru/oauth2/user_info",
                data={"access_token": access_token, "client_id": cfg["client_id"]},
            )
            if info_res.status_code >= 400:
                raise HTTPException(502, "VK ID profile request failed")
            info_data = info_res.json()
            info = info_data.get("user") or info_data
        email = str(info.get("email") or token_data.get("email") or "").strip().lower()
        return {
            "provider_user_id": str(info.get("user_id") or info.get("id") or token_data.get("user_id") or ""),
            "email": email,
            "name": " ".join(part for part in [str(info.get("first_name") or "").strip(), str(info.get("last_name") or "").strip()] if part).strip() or email.split("@")[0] or "VK user",
        }

    async def callback(self, provider: str, code: str, state: str, device_id: str = "") -> str:
        if provider not in self.providers:
            raise HTTPException(404, "Unknown social provider")
        record = await self._consume_state(provider, state)
        identity_data = await (self._exchange_yandex(code, record) if provider == "yandex" else self._exchange_vk(code, record, device_id))
        if not identity_data["provider_user_id"] or not identity_data["email"]:
            raise HTTPException(502, "Social provider did not return required account data")

        identity = await self.db.oauth_identities.find_one({
            "provider": provider,
            "provider_user_id": identity_data["provider_user_id"],
        }, {"_id": 0})
        account = None
        if identity:
            account = await self.db.accounts.find_one({"id": identity.get("account_id")}, {"_id": 0})
        else:
            existing = await self.db.accounts.find_one({"email": identity_data["email"]}, {"_id": 0})
            if existing:
                # Do not silently attach a provider to an existing medical account.
                raise HTTPException(409, "An Aida account with this email already exists. Sign in with your password and link the provider in account settings.")
            account_id = str(uuid.uuid4())
            profile_id = str(uuid.uuid4())
            now = _iso(_now())
            account = {
                "id": account_id,
                "email": identity_data["email"],
                "name": identity_data["name"],
                "password_hash": "",
                "email_verified_at": now,
                "created_at": now,
                "updated_at": now,
                "disabled_at": None,
            }
            await self.db.accounts.insert_one(account)
            await self.db.profiles.insert_one({
                "id": profile_id,
                "account_id": account_id,
                "name": identity_data["name"] or "Мой профиль",
                "kind": "me",
                "allergies": [], "chronic_conditions": [], "diagnoses": [], "surgeries": [],
                "privacy": {"include_in_ai_context": True, "share_documents": False},
                "module_settings": {},
                "created_at": now, "updated_at": now,
            })
            await self.db.access_grants.insert_one({
                "id": str(uuid.uuid4()), "account_id": account_id, "profile_id": profile_id,
                "role": "owner", "created_at": now, "revoked_at": None,
            })
            await self.db.oauth_identities.insert_one({
                "id": str(uuid.uuid4()), "account_id": account_id, "provider": provider,
                "provider_user_id": identity_data["provider_user_id"], "email": identity_data["email"],
                "created_at": now, "updated_at": now,
            })

        if not account or account.get("disabled_at"):
            raise HTTPException(403, "Account unavailable")

        ticket = secrets.token_urlsafe(48)
        now = _now()
        await self.db.oauth_tickets.insert_one({
            "id": str(uuid.uuid4()), "ticket_hash": _hash(ticket), "account_id": account["id"],
            "created_at": _iso(now), "expires_at": _iso(now + timedelta(minutes=self.ticket_minutes)), "used_at": None,
        })
        separator = "&" if "?" in record["return_uri"] else "?"
        return f"{record['return_uri']}{separator}oauth_ticket={ticket}"

    async def complete(self, ticket: str) -> Dict[str, Any]:
        record = await self.db.oauth_tickets.find_one({"ticket_hash": _hash(ticket)}, {"_id": 0})
        now = _iso(_now())
        if not record or record.get("used_at") or str(record.get("expires_at") or "") <= now:
            raise HTTPException(400, "OAuth completion ticket is invalid or expired")
        await self.db.oauth_tickets.update_one({"id": record.get("id")}, {"$set": {"used_at": now}})
        account = await self.db.accounts.find_one({"id": record.get("account_id")}, {"_id": 0})
        if not account:
            raise HTTPException(400, "Account unavailable")
        session = await self.auth_service.create_session(str(account["id"]))
        public = {"id": account.get("id"), "email": account.get("email"), "name": account.get("name"), "created_at": account.get("created_at")}
        return {**session, "account": public}


def build_social_auth_router(db, auth_service) -> APIRouter:
    service = SocialAuthService(db, auth_service)
    router = APIRouter(prefix="/api/auth/oauth", tags=["auth"])

    @router.get("/providers")
    async def providers():
        return {provider: {"configured": service.configured(provider)} for provider in service.providers}

    @router.post("/{provider}/start")
    async def start(provider: str, data: SocialStartRequest):
        return await service.start(provider, data.return_uri)

    @router.get("/{provider}/callback")
    async def callback(provider: str, request: Request):
        code = str(request.query_params.get("code") or "")
        state = str(request.query_params.get("state") or "")
        device_id = str(request.query_params.get("device_id") or "")
        if not code or not state:
            raise HTTPException(400, "OAuth callback is missing code or state")
        return RedirectResponse(await service.callback(provider, code, state, device_id), status_code=302)

    @router.post("/complete")
    async def complete(data: SocialCompleteRequest):
        return await service.complete(data.ticket)

    return router
