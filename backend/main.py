"""Production entrypoint for Aida 2.0."""

from __future__ import annotations

import logging
import os
import sys
import types
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

# Production auth/storage configuration must be loaded by the production
# entrypoint itself. Do not rely on legacy server.py import side effects.
ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")

from google_storage import build_storage_from_env  # noqa: E402

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

# server.py is retained as a compatibility module, but its Motor client is replaced
# before import. No Mongo connection is made by this production entrypoint.
os.environ.setdefault("MONGO_URL", "google-sheets://aida")
os.environ.setdefault("DB_NAME", "aida")

import server as legacy_server  # noqa: E402
from account_sessions import build_account_session_router  # noqa: E402
from ai_context import build_ai_context  # noqa: E402
from auth_api import build_auth_router  # noqa: E402
from body_insights import build_body_insights_router  # noqa: E402
from candidate_records import build_candidate_router  # noqa: E402
from circadian_api import build_circadian_router  # noqa: E402
from cycle_api import build_cycle_router  # noqa: E402
from documents import build_documents_router  # noqa: E402
from email_signup import build_email_signup_router  # noqa: E402
from family_api import build_family_router  # noqa: E402
from healthkit_api import build_healthkit_router  # noqa: E402
from home_api import build_home_router  # noqa: E402
from icd10_api import build_icd10_router  # noqa: E402
from lab_pipeline import build_lab_router  # noqa: E402
from lab_trends import build_lab_trends_router  # noqa: E402
from medication_api import build_medication_router  # noqa: E402
from medication_reference import build_medication_reference_router  # noqa: E402
from pregnancy_api import build_pregnancy_router  # noqa: E402
from profile_api import build_profile_router  # noqa: E402
from puzzle_api import build_puzzle_router  # noqa: E402
from secure_legacy_api import build_secure_legacy_router  # noqa: E402
from social_auth import build_social_auth_router  # noqa: E402
from task_api import build_task_router  # noqa: E402
from test_account_seed import seed_test_account  # noqa: E402
from timeline_api import build_timeline_router  # noqa: E402
from user_testing_api import build_user_testing_router  # noqa: E402
from wearable_cloud_oauth import build_wearable_cloud_oauth_router  # noqa: E402
from wearables_api import build_wearables_router  # noqa: E402

legacy_server.app.router.on_startup = [handler for handler in legacy_server.app.router.on_startup if getattr(handler, "__name__", "") != "_startup"]


async def _privacy_aware_profile_context(profile_id: str) -> str:
    return await build_ai_context(_google_db, profile_id, as_json=True)


legacy_server.get_profile_context = _privacy_aware_profile_context

_REPLACED_LEGACY_PREFIXES = (
    "/api/profiles", "/api/labs", "/api/symptoms", "/api/medications", "/api/chat", "/api/report/",
    "/api/analytics/readiness/", "/api/gamification/", "/api/puzzle/", "/api/seed", "/api/vitals",
    "/api/checkins", "/api/tasks", "/api/overview/",
)
legacy_server.app.router.routes = [route for route in legacy_server.app.router.routes if not str(getattr(route, "path", "")).startswith(_REPLACED_LEGACY_PREFIXES)]
legacy_server.app.user_middleware = [middleware for middleware in legacy_server.app.user_middleware if middleware.cls is not CORSMiddleware]
legacy_server.app.middleware_stack = None

auth_router, auth_service = build_auth_router(_google_db)
app = legacy_server.app

cors_origins = [origin.strip() for origin in os.environ.get("AIDA_CORS_ORIGINS", "").split(",") if origin.strip()]
if cors_origins:
    app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=cors_origins, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

_PUBLIC_API_PATHS = {
    "/api/",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/resend-verification",
    "/api/auth/verify-email",
}
_PUBLIC_API_PREFIXES = ("/api/auth/oauth/",)


@app.middleware("http")
async def require_authenticated_api(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS" or not path.startswith("/api") or path in _PUBLIC_API_PATHS or path.startswith(_PUBLIC_API_PREFIXES):
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
        allowed = await auth_service.has_profile_access(str(account.get("id") or ""), profile_id, write=write)
        if not allowed:
            return JSONResponse({"detail": "Profile not found"}, status_code=404)
    return await call_next(request)


app.include_router(auth_router)
app.include_router(build_email_signup_router(_google_db))
app.include_router(build_social_auth_router(_google_db, auth_service))
app.include_router(build_account_session_router(_google_db, auth_service))
app.include_router(build_profile_router(_google_db, auth_service))
app.include_router(build_icd10_router())
app.include_router(build_medication_reference_router())
app.include_router(build_family_router(_google_db, auth_service))
app.include_router(build_secure_legacy_router(_google_db, auth_service))
app.include_router(build_puzzle_router(_google_db, auth_service))
app.include_router(build_task_router(_google_db, auth_service))
app.include_router(build_medication_router(_google_db, auth_service))
app.include_router(build_home_router(_google_db, auth_service, legacy_server))
app.include_router(build_circadian_router(_google_db, auth_service))
app.include_router(build_cycle_router(_google_db, auth_service))
app.include_router(build_pregnancy_router(_google_db, auth_service))
app.include_router(build_body_insights_router(_google_db, auth_service))
app.include_router(build_timeline_router(_google_db))
app.include_router(build_candidate_router(_google_db, auth_service))
app.include_router(build_lab_router(_google_db, auth_service))
app.include_router(build_lab_trends_router(_google_db))
app.include_router(build_documents_router(_google_db, auth_service))
app.include_router(build_healthkit_router(_google_db, auth_service))
app.include_router(build_wearables_router(_google_db, auth_service))
app.include_router(build_wearable_cloud_oauth_router(_google_db, auth_service))
app.include_router(build_user_testing_router(_google_db, auth_service))


@app.on_event("startup")
async def _validate_auth_configuration() -> None:
    # Fail the backend startup instead of serving a deceptively healthy API with
    # broken registration/login session creation.
    auth_service._require_secret()


@app.on_event("startup")
async def _validate_social_auth_storage() -> None:
    # OAuth state is used during provider launch, while identities and tickets are
    # first touched only after the provider callback. Force all three collections
    # to be readable/creatable at startup so a green deploy cannot hide a callback-only
    # Google Sheets failure from the user.
    for collection_name in ("oauth_states", "oauth_identities", "oauth_tickets"):
        collection = getattr(_google_db, collection_name)
        await collection.count_documents({})
    logging.info("Social OAuth storage is ready: states, identities and tickets")


@app.on_event("startup")
async def _seed_opt_in_test_account() -> None:
    result = await seed_test_account(_google_db)
    if result.get("enabled"):
        logging.info("Aida test account seeded in Google storage: email=%s profile_id=%s", result.get("email"), result.get("profile_id"))
