"""Production entrypoint for Aida 2.0."""

from __future__ import annotations

import os
import sys
import types

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from google_storage import build_storage_from_env

_google_db = build_storage_from_env()


class _GoogleCompatClient:
    def __init__(self, *args, **kwargs):
        self.db = _google_db

    def __getitem__(self, name):
        return self.db

    def close(self):
        return None


_motor_pkg = types.ModuleType("motor")
_motor_asyncio = types.ModuleType("motor.motor_asyncio")
_motor_asyncio.AsyncIOMotorClient = _GoogleCompatClient
_motor_pkg.motor_asyncio = _motor_asyncio
sys.modules["motor"] = _motor_pkg
sys.modules["motor.motor_asyncio"] = _motor_asyncio

os.environ.setdefault("MONGO_URL", "google-sheets://aida")
os.environ.setdefault("DB_NAME", "aida")

import server as legacy_server  # noqa: E402
from auth_api import build_auth_router  # noqa: E402
from candidate_records import build_candidate_router  # noqa: E402
from documents import build_documents_router  # noqa: E402
from healthkit_api import build_healthkit_router  # noqa: E402
from lab_pipeline import build_lab_router  # noqa: E402
from lab_trends import build_lab_trends_router  # noqa: E402
from medication_api import build_medication_router  # noqa: E402
from profile_api import build_profile_router  # noqa: E402
from puzzle_api import build_puzzle_router  # noqa: E402
from secure_legacy_api import build_secure_legacy_router  # noqa: E402
from task_api import build_task_router  # noqa: E402
from timeline_api import build_timeline_router  # noqa: E402
from wearable_api import build_wearable_router  # noqa: E402

legacy_server.app.router.on_startup = [
    handler
    for handler in legacy_server.app.router.on_startup
    if getattr(handler, "__name__", "") != "_startup"
]

_legacy_get_profile_context = legacy_server.get_profile_context


async def _privacy_aware_profile_context(profile_id: str) -> str:
    profile = await _google_db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        return ""
    privacy = profile.get("privacy") or {}
    if privacy.get("include_in_ai_context") is False:
        return ""
    return await _legacy_get_profile_context(profile_id)


legacy_server.get_profile_context = _privacy_aware_profile_context

_REPLACED_LEGACY_PREFIXES = (
    "/api/profiles",
    "/api/labs",
    "/api/symptoms",
    "/api/medications",
    "/api/chat",
    "/api/report/",
    "/api/analytics/readiness/",
    "/api/gamification/",
    "/api/puzzle/",
    "/api/seed",
    "/api/vitals",
    "/api/checkins",
    "/api/tasks",
    "/api/overview/",
)

legacy_server.app.router.routes = [
    route
    for route in legacy_server.app.router.routes
    if not str(getattr(route, "path", "")).startswith(_REPLACED_LEGACY_PREFIXES)
]

# Remove legacy wildcard CORS. Same-origin production needs no CORS entry;
# trusted cross-origin web clients can be listed explicitly in AIDA_CORS_ORIGINS.
legacy_server.app.user_middleware = [
    middleware
    for middleware in legacy_server.app.user_middleware
    if middleware.cls is not CORSMiddleware
]
legacy_server.app.middleware_stack = None

auth_router, auth_service = build_auth_router(_google_db)
app = legacy_server.app

cors_origins = [
    origin.strip()
    for origin in os.environ.get("AIDA_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

_PUBLIC_API_PATHS = {
    "/api/",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
}


@app.middleware("http")
async def require_authenticated_api(request: Request, call_next):
    """Fail closed for API routes missed by feature-specific dependencies."""
    path = request.url.path
    if request.method == "OPTIONS" or not path.startswith("/api") or path in _PUBLIC_API_PATHS:
        return await call_next(request)

    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return JSONResponse({"detail": "Authentication required"}, status_code=401)

    try:
        account = await auth_service.account_from_token(token.strip())
    except HTTPException as exc:
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    request.state.account = account
    profile_id = request.query_params.get("profile_id")
    if profile_id:
        write = request.method not in {"GET", "HEAD", "OPTIONS"}
        allowed = await auth_service.has_profile_access(
            str(account.get("id") or ""),
            profile_id,
            write=write,
        )
        if not allowed:
            return JSONResponse({"detail": "Profile not found"}, status_code=404)

    return await call_next(request)


app.include_router(auth_router)
app.include_router(build_profile_router(_google_db, auth_service))
app.include_router(build_secure_legacy_router(_google_db, auth_service))
app.include_router(build_puzzle_router(_google_db, auth_service))
app.include_router(build_task_router(_google_db, auth_service))
app.include_router(build_medication_router(_google_db, auth_service))
app.include_router(build_timeline_router(_google_db))
app.include_router(build_candidate_router(_google_db, auth_service))
app.include_router(build_lab_router(_google_db, auth_service))
app.include_router(build_lab_trends_router(_google_db))
app.include_router(build_documents_router(_google_db, auth_service))
app.include_router(build_healthkit_router(_google_db, auth_service))
app.include_router(build_wearable_router(_google_db, auth_service))
