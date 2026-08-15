"""Production entrypoint for Aida 2.0."""

from __future__ import annotations

import os
import sys
import types

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
from task_api import build_task_router  # noqa: E402
from timeline_api import build_timeline_router  # noqa: E402

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

legacy_server.app.router.routes = [
    route
    for route in legacy_server.app.router.routes
    if not (
        (
            getattr(route, "path", None) == "/api/labs/upload"
            and "POST" in (getattr(route, "methods", None) or set())
        )
        or str(getattr(route, "path", "")).startswith("/api/profiles")
        or str(getattr(route, "path", "")).startswith("/api/puzzle/")
        or str(getattr(route, "path", "")).startswith("/api/tasks")
        or str(getattr(route, "path", "")).startswith("/api/medications")
    )
]

auth_router, auth_service = build_auth_router(_google_db)

app = legacy_server.app
app.include_router(auth_router)
app.include_router(build_profile_router(_google_db, auth_service))
app.include_router(build_puzzle_router(_google_db))
app.include_router(build_task_router(_google_db))
app.include_router(build_medication_router(_google_db))
app.include_router(build_timeline_router(_google_db))
app.include_router(build_candidate_router(_google_db))
app.include_router(build_lab_router(_google_db))
app.include_router(build_lab_trends_router(_google_db))
app.include_router(build_documents_router(_google_db))
app.include_router(build_healthkit_router(_google_db, auth_service))
