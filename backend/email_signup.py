"""Email-verified registration for Aida.

New password accounts are created in a pending state and become usable only
after the user opens a short-lived verification link delivered by SMTP.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import secrets
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any, Dict, Optional
from urllib.parse import quote

import bcrypt
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _email(value: str) -> str:
    return value.strip().lower()


def _phone(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip()
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    # Common Russian local notation: 8XXXXXXXXXX -> +7XXXXXXXXXX.
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if not 7 <= len(digits) <= 15:
        raise HTTPException(422, "Invalid phone number")
    return f"+{digits}"


def _password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=40)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class EmailSignupService:
    def __init__(self, db):
        self.db = db
        self.verify_minutes = int(os.environ.get("EMAIL_VERIFY_MINUTES", "30"))

    def _smtp_configured(self) -> bool:
        return bool(os.environ.get("SMTP_HOST", "").strip() and os.environ.get("SMTP_FROM", "").strip())

    async def _send_verification_email(self, email: str, raw_token: str) -> None:
        host = os.environ.get("SMTP_HOST", "").strip()
        sender = os.environ.get("SMTP_FROM", "").strip()
        if not host or not sender:
            raise HTTPException(503, "Email verification delivery is not configured")

        port = int(os.environ.get("SMTP_PORT", "587"))
        username = os.environ.get("SMTP_USERNAME", "").strip()
        password = os.environ.get("SMTP_PASSWORD", "")
        use_ssl = os.environ.get("SMTP_SSL", "false").lower() == "true"
        starttls = os.environ.get("SMTP_STARTTLS", "true").lower() == "true"
        base_url = os.environ.get(
            "EMAIL_VERIFY_BASE_URL",
            "https://aidaassistent.ru/api/auth/verify-email",
        ).strip()
        verify_url = f"{base_url}{'&' if '?' in base_url else '?'}token={quote(raw_token)}"

        message = EmailMessage()
        message["Subject"] = "Aida — подтвердите email"
        message["From"] = sender
        message["To"] = email
        message.set_content(
            "Подтвердите email для аккаунта Aida.\n\n"
            f"Откройте ссылку: {verify_url}\n\n"
            f"Ссылка действует {self.verify_minutes} минут. Если аккаунт создавали не вы, просто проигнорируйте письмо."
        )

        def _send() -> None:
            client = smtplib.SMTP_SSL(host, port, timeout=20) if use_ssl else smtplib.SMTP(host, port, timeout=20)
            try:
                if not use_ssl and starttls:
                    client.starttls()
                if username:
                    client.login(username, password)
                client.send_message(message)
            finally:
                try:
                    client.quit()
                except Exception:
                    pass

        try:
            await asyncio.to_thread(_send)
        except HTTPException:
            raise
        except Exception as exc:
            logging.exception("Email verification SMTP delivery failed")
            raise HTTPException(503, "Email verification delivery failed") from exc

    async def _issue_token(self, account_id: str, email: str) -> None:
        raw_token = secrets.token_urlsafe(48)
        now = _now()
        await self.db.email_verifications.insert_one({
            "id": str(uuid.uuid4()),
            "account_id": account_id,
            "token_hash": _token_hash(raw_token),
            "created_at": _iso(now),
            "expires_at": _iso(now + timedelta(minutes=self.verify_minutes)),
            "used_at": None,
        })
        try:
            await self._send_verification_email(email, raw_token)
        except Exception:
            await self.db.email_verifications.delete_many({"account_id": account_id, "used_at": None})
            raise

    async def register(self, data: RegisterRequest) -> Dict[str, Any]:
        email = _email(str(data.email))
        phone = _phone(data.phone)
        existing = await self.db.accounts.find_one({"email": email}, {"_id": 0})
        if existing and str(existing.get("password_hash") or ""):
            raise HTTPException(409, "Account already exists")

        if phone:
            by_phone = await self.db.accounts.find_one({"phone": phone}, {"_id": 0})
            if by_phone and str(by_phone.get("id") or "") != str((existing or {}).get("id") or ""):
                raise HTTPException(409, "Phone number already in use")

        now = _iso(_now())
        created = False
        if existing:
            account_id = str(existing.get("id") or "")
            if not account_id:
                raise HTTPException(409, "Account already exists")
            await self.db.accounts.update_one(
                {"id": account_id},
                {"$set": {
                    "name": data.name.strip(),
                    "phone": phone,
                    "pending_password_hash": _password_hash(data.password),
                    "email_verified_at": None,
                    "updated_at": now,
                }},
            )
        else:
            created = True
            account_id = str(uuid.uuid4())
            await self.db.accounts.insert_one({
                "id": account_id,
                "email": email,
                "phone": phone,
                "name": data.name.strip(),
                "password_hash": "",
                "pending_password_hash": _password_hash(data.password),
                "email_verified_at": None,
                "created_at": now,
                "updated_at": now,
                "disabled_at": None,
            })

        try:
            await self.db.email_verifications.delete_many({"account_id": account_id, "used_at": None})
            await self._issue_token(account_id, email)
        except Exception:
            if created:
                await self.db.accounts.delete_one({"id": account_id})
            raise

        return {"verification_required": True, "email": email}

    async def resend(self, email_value: str) -> Dict[str, bool]:
        email = _email(email_value)
        account = await self.db.accounts.find_one({"email": email}, {"_id": 0})
        if account and not str(account.get("password_hash") or "") and account.get("pending_password_hash"):
            account_id = str(account.get("id") or "")
            await self.db.email_verifications.delete_many({"account_id": account_id, "used_at": None})
            await self._issue_token(account_id, email)
        return {"ok": True}

    async def verify(self, raw_token: str) -> str:
        token_hash = _token_hash(raw_token)
        record = await self.db.email_verifications.find_one({"token_hash": token_hash}, {"_id": 0})
        now = _iso(_now())
        if not record or record.get("used_at") or str(record.get("expires_at") or "") <= now:
            return "/auth?verify_error=1"

        account_id = str(record.get("account_id") or "")
        account = await self.db.accounts.find_one({"id": account_id}, {"_id": 0})
        pending_hash = str((account or {}).get("pending_password_hash") or "")
        if not account or not pending_hash:
            return "/auth?verify_error=1"

        await self.db.accounts.update_one(
            {"id": account_id},
            {"$set": {
                "password_hash": pending_hash,
                "pending_password_hash": None,
                "email_verified_at": now,
                "updated_at": now,
            }},
        )
        await self.db.email_verifications.update_one({"id": record.get("id")}, {"$set": {"used_at": now}})

        grant = await self.db.access_grants.find_one({"account_id": account_id}, {"_id": 0})
        if not grant:
            profile_id = str(uuid.uuid4())
            name = str(account.get("name") or "").strip() or "Мой профиль"
            await self.db.profiles.insert_one({
                "id": profile_id,
                "account_id": account_id,
                "name": name,
                "kind": "me",
                "allergies": [],
                "chronic_conditions": [],
                "diagnoses": [],
                "surgeries": [],
                "privacy": {"include_in_ai_context": True, "share_documents": False},
                "module_settings": {},
                "created_at": now,
                "updated_at": now,
            })
            await self.db.access_grants.insert_one({
                "id": str(uuid.uuid4()),
                "account_id": account_id,
                "profile_id": profile_id,
                "role": "owner",
                "created_at": now,
                "revoked_at": None,
            })

        return "/auth?verified=1"


def build_email_signup_router(db) -> APIRouter:
    service = EmailSignupService(db)
    router = APIRouter(prefix="/api/auth", tags=["auth"])

    @router.post("/register")
    async def register(data: RegisterRequest):
        return await service.register(data)

    @router.post("/resend-verification")
    async def resend_verification(data: ResendVerificationRequest):
        return await service.resend(str(data.email))

    @router.get("/verify-email")
    async def verify_email(token: str):
        if len(token) < 20:
            return RedirectResponse("/auth?verify_error=1", status_code=302)
        return RedirectResponse(await service.verify(token), status_code=302)

    return router
