"""Authentication and session management for Aida 2.0.

Passwords are stored only as bcrypt hashes. Access JWTs are tied to server-side
session rows so logout/password reset can revoke them. Password reset tokens are
stored only as SHA-256 hashes and delivered by SMTP when configured.
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
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

bearer = HTTPBearer(auto_error=False)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _email(value: str) -> str:
    return value.strip().lower()


def _password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _password_ok(password: str, stored_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _public_account(account: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": account.get("id"),
        "email": account.get("email"),
        "name": account.get("name"),
        "created_at": account.get("created_at"),
    }


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    new_password: str = Field(min_length=8, max_length=128)


class AuthService:
    def __init__(self, db):
        self.db = db
        self.jwt_secret = os.environ.get("JWT_SECRET", "").strip()
        self.jwt_issuer = os.environ.get("JWT_ISSUER", "aida-2.0").strip() or "aida-2.0"
        self.access_minutes = int(os.environ.get("JWT_ACCESS_MINUTES", "10080"))  # 7 days
        self.reset_minutes = int(os.environ.get("PASSWORD_RESET_MINUTES", "30"))

    def _require_secret(self) -> str:
        if len(self.jwt_secret) < 32:
            raise HTTPException(503, "Authentication is not configured")
        return self.jwt_secret

    async def create_session(self, account_id: str) -> Dict[str, Any]:
        secret = self._require_secret()
        now = _now()
        expires = now + timedelta(minutes=self.access_minutes)
        session_id = str(uuid.uuid4())
        await self.db.sessions.insert_one({
            "id": session_id,
            "account_id": account_id,
            "created_at": _iso(now),
            "expires_at": _iso(expires),
            "revoked_at": None,
        })
        token = jwt.encode(
            {
                "sub": account_id,
                "sid": session_id,
                "typ": "access",
                "iss": self.jwt_issuer,
                "iat": int(now.timestamp()),
                "exp": int(expires.timestamp()),
            },
            secret,
            algorithm="HS256",
        )
        return {"access_token": token, "token_type": "bearer", "expires_at": _iso(expires)}

    async def account_from_token(self, token: str) -> Dict[str, Any]:
        secret = self._require_secret()
        try:
            claims = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                issuer=self.jwt_issuer,
                options={"require": ["exp", "iat", "sub", "sid"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(401, "Session expired") from exc
        except jwt.PyJWTError as exc:
            raise HTTPException(401, "Invalid session") from exc

        if claims.get("typ") != "access":
            raise HTTPException(401, "Invalid session")
        account_id = str(claims.get("sub") or "")
        session_id = str(claims.get("sid") or "")
        session = await self.db.sessions.find_one({"id": session_id, "account_id": account_id}, {"_id": 0})
        if not session or session.get("revoked_at"):
            raise HTTPException(401, "Session revoked")
        if str(session.get("expires_at") or "") <= _iso(_now()):
            raise HTTPException(401, "Session expired")
        account = await self.db.accounts.find_one({"id": account_id}, {"_id": 0})
        if not account or account.get("disabled_at"):
            raise HTTPException(401, "Account unavailable")
        return account

    async def require_account(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    ) -> Dict[str, Any]:
        if not credentials or credentials.scheme.lower() != "bearer":
            raise HTTPException(401, "Authentication required")
        return await self.account_from_token(credentials.credentials)

    async def revoke_session(self, token: str) -> None:
        try:
            claims = jwt.decode(
                token,
                self._require_secret(),
                algorithms=["HS256"],
                issuer=self.jwt_issuer,
                options={"verify_exp": False},
            )
        except jwt.PyJWTError:
            return
        session_id = str(claims.get("sid") or "")
        account_id = str(claims.get("sub") or "")
        if session_id and account_id:
            await self.db.sessions.update_one(
                {"id": session_id, "account_id": account_id},
                {"$set": {"revoked_at": _iso(_now())}},
            )

    async def revoke_all_sessions(self, account_id: str) -> None:
        sessions = await self.db.sessions.find({"account_id": account_id}, {"_id": 0}).to_list(5000)
        now = _iso(_now())
        for session in sessions:
            if not session.get("revoked_at"):
                await self.db.sessions.update_one({"id": session.get("id")}, {"$set": {"revoked_at": now}})

    async def has_profile_access(self, account_id: str, profile_id: str, write: bool = False) -> bool:
        grant = await self.db.access_grants.find_one(
            {"account_id": account_id, "profile_id": profile_id}, {"_id": 0}
        )
        if not grant or grant.get("revoked_at"):
            return False
        role = str(grant.get("role") or "viewer")
        if not write:
            return True
        return role in {"owner", "editor"}

    async def send_reset_email(self, email: str, reset_token: str) -> bool:
        host = os.environ.get("SMTP_HOST", "").strip()
        sender = os.environ.get("SMTP_FROM", "").strip()
        if not host or not sender:
            logging.warning("Password reset email not sent: SMTP_HOST/SMTP_FROM not configured")
            return False

        port = int(os.environ.get("SMTP_PORT", "587"))
        username = os.environ.get("SMTP_USERNAME", "").strip()
        password = os.environ.get("SMTP_PASSWORD", "")
        use_ssl = os.environ.get("SMTP_SSL", "false").lower() == "true"
        starttls = os.environ.get("SMTP_STARTTLS", "true").lower() == "true"
        base_url = os.environ.get("PASSWORD_RESET_BASE_URL", "frontend://reset-password").strip()
        reset_url = f"{base_url}{'&' if '?' in base_url else '?'}token={quote(reset_token)}"

        message = EmailMessage()
        message["Subject"] = "Aida — восстановление пароля"
        message["From"] = sender
        message["To"] = email
        message.set_content(
            "Вы запросили восстановление пароля Aida.\n\n"
            f"Откройте ссылку: {reset_url}\n\n"
            f"Ссылка действует {self.reset_minutes} минут. Если это были не вы, просто проигнорируйте письмо."
        )

        def _send():
            if use_ssl:
                client = smtplib.SMTP_SSL(host, port, timeout=20)
            else:
                client = smtplib.SMTP(host, port, timeout=20)
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
            return True
        except Exception:
            logging.exception("Password reset SMTP delivery failed")
            return False


def build_auth_router(db) -> tuple[APIRouter, AuthService]:
    service = AuthService(db)
    router = APIRouter(prefix="/api/auth", tags=["auth"])

    @router.post("/register")
    async def register(data: RegisterRequest):
        email = _email(str(data.email))
        if await db.accounts.find_one({"email": email}, {"_id": 0}):
            raise HTTPException(409, "Account already exists")

        account_id = str(uuid.uuid4())
        profile_id = str(uuid.uuid4())
        now = _iso(_now())
        account = {
            "id": account_id,
            "email": email,
            "name": data.name.strip(),
            "password_hash": _password_hash(data.password),
            "created_at": now,
            "updated_at": now,
            "disabled_at": None,
        }
        profile = {
            "id": profile_id,
            "account_id": account_id,
            "name": data.name.strip() or "Мой профиль",
            "kind": "me",
            "allergies": [],
            "chronic_conditions": [],
            "diagnoses": [],
            "surgeries": [],
            "privacy": {"include_in_ai_context": True, "share_documents": False},
            "module_settings": {},
            "created_at": now,
            "updated_at": now,
        }
        grant = {
            "id": str(uuid.uuid4()),
            "account_id": account_id,
            "profile_id": profile_id,
            "role": "owner",
            "created_at": now,
            "revoked_at": None,
        }

        try:
            await db.accounts.insert_one(account)
            await db.profiles.insert_one(profile)
            await db.access_grants.insert_one(grant)
            session = await service.create_session(account_id)
        except Exception:
            # Best-effort compensation because Sheets does not provide transactions.
            await db.access_grants.delete_many({"account_id": account_id})
            await db.profiles.delete_many({"account_id": account_id})
            await db.accounts.delete_one({"id": account_id})
            raise

        return {**session, "account": _public_account(account), "profile_id": profile_id}

    @router.post("/login")
    async def login(data: LoginRequest):
        email = _email(str(data.email))
        account = await db.accounts.find_one({"email": email}, {"_id": 0})
        if not account or not _password_ok(data.password, str(account.get("password_hash") or "")):
            raise HTTPException(401, "Invalid email or password")
        if account.get("disabled_at"):
            raise HTTPException(403, "Account disabled")
        session = await service.create_session(str(account["id"]))
        return {**session, "account": _public_account(account)}

    @router.get("/me")
    async def me(account: Dict[str, Any] = Depends(service.require_account)):
        return {"account": _public_account(account)}

    @router.post("/logout")
    async def logout(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
        account: Dict[str, Any] = Depends(service.require_account),
    ):
        if credentials:
            await service.revoke_session(credentials.credentials)
        return {"ok": True}

    @router.post("/forgot-password")
    async def forgot_password(data: ForgotPasswordRequest):
        # Always return the same response to avoid email/account enumeration.
        email = _email(str(data.email))
        account = await db.accounts.find_one({"email": email}, {"_id": 0})
        if account and not account.get("disabled_at"):
            raw_token = secrets.token_urlsafe(48)
            now = _now()
            expires = now + timedelta(minutes=service.reset_minutes)
            await db.password_resets.insert_one({
                "id": str(uuid.uuid4()),
                "account_id": account.get("id"),
                "token_hash": _token_hash(raw_token),
                "created_at": _iso(now),
                "expires_at": _iso(expires),
                "used_at": None,
            })
            await service.send_reset_email(email, raw_token)
        return {"ok": True}

    @router.post("/reset-password")
    async def reset_password(data: ResetPasswordRequest):
        token_hash = _token_hash(data.token)
        reset = await db.password_resets.find_one({"token_hash": token_hash}, {"_id": 0})
        now = _iso(_now())
        if not reset or reset.get("used_at") or str(reset.get("expires_at") or "") <= now:
            raise HTTPException(400, "Reset link is invalid or expired")

        account_id = str(reset.get("account_id") or "")
        account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
        if not account:
            raise HTTPException(400, "Reset link is invalid or expired")

        await db.accounts.update_one(
            {"id": account_id},
            {"$set": {"password_hash": _password_hash(data.new_password), "updated_at": now}},
        )
        await db.password_resets.update_one({"id": reset.get("id")}, {"$set": {"used_at": now}})
        await service.revoke_all_sessions(account_id)
        session = await service.create_session(account_id)
        account.update({"updated_at": now})
        return {**session, "account": _public_account(account)}

    return router, service
