import copy
from typing import Any, Dict, Iterable, Optional

from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth_api import build_auth_router
from medication_api import build_medication_router
from profile_api import build_profile_router
from task_api import build_task_router


class _Cursor:
    def __init__(self, rows: Iterable[Dict[str, Any]]):
        self.rows = [copy.deepcopy(row) for row in rows]

    def sort(self, key: str, direction: int):
        self.rows.sort(key=lambda row: str(row.get(key) or ""), reverse=direction < 0)
        return self

    async def to_list(self, limit: int):
        return self.rows[:limit]


class _Collection:
    def __init__(self):
        self.rows: list[Dict[str, Any]] = []

    @staticmethod
    def _matches(row: Dict[str, Any], query: Dict[str, Any]) -> bool:
        return all(row.get(key) == value for key, value in query.items())

    @staticmethod
    def _project(row: Dict[str, Any], projection: Optional[Dict[str, int]]):
        result = copy.deepcopy(row)
        if projection and projection.get("_id") == 0:
            result.pop("_id", None)
        return result

    async def insert_one(self, document: Dict[str, Any]):
        self.rows.append(copy.deepcopy(document))
        return object()

    async def find_one(self, query: Dict[str, Any], projection: Optional[Dict[str, int]] = None):
        for row in self.rows:
            if self._matches(row, query):
                return self._project(row, projection)
        return None

    def find(self, query: Dict[str, Any], projection: Optional[Dict[str, int]] = None):
        return _Cursor(self._project(row, projection) for row in self.rows if self._matches(row, query))

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any]):
        for row in self.rows:
            if self._matches(row, query):
                row.update(copy.deepcopy(update.get("$set", {})))
                break
        return object()

    async def delete_one(self, query: Dict[str, Any]):
        for index, row in enumerate(self.rows):
            if self._matches(row, query):
                self.rows.pop(index)
                break
        return object()

    async def delete_many(self, query: Dict[str, Any]):
        self.rows = [row for row in self.rows if not self._matches(row, query)]
        return object()


class _Db:
    def __init__(self):
        for name in (
            "accounts",
            "profiles",
            "access_grants",
            "sessions",
            "password_resets",
            "puzzle",
            "labs",
            "symptoms",
            "medications",
            "medication_events",
            "chat_messages",
            "vitals",
            "checkins",
            "tasks",
            "files",
            "candidates",
            "circadian_events",
            "circadian_plans",
        ):
            setattr(self, name, _Collection())


def _client(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "runtime-e2e-secret-0123456789abcdef-0123456789abcdef")
    monkeypatch.setenv("JWT_ISSUER", "aida-runtime-e2e")
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_FROM", raising=False)

    db = _Db()
    auth_router, auth_service = build_auth_router(db)
    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(build_profile_router(db, auth_service))
    app.include_router(build_medication_router(db, auth_service))
    app.include_router(build_task_router(db, auth_service))
    return TestClient(app), db


def _auth(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_register_restore_onboarding_critical_api_login_logout_and_recovery(monkeypatch):
    client, db = _client(monkeypatch)
    email = "runtime-e2e@example.com"
    password = "Aida-runtime-2026!"

    register = client.post(
        "/api/auth/register",
        json={"name": "Runtime User", "email": email, "password": password},
    )
    assert register.status_code == 200, register.text
    session = register.json()
    first_token = session["access_token"]
    profile_id = session["profile_id"]
    assert session["account"]["email"] == email

    duplicate = client.post(
        "/api/auth/register",
        json={"name": "Duplicate", "email": email, "password": password},
    )
    assert duplicate.status_code == 409

    restored = client.get("/api/auth/me", headers=_auth(first_token))
    assert restored.status_code == 200, restored.text
    assert restored.json()["account"]["email"] == email

    profiles = client.get("/api/profiles", headers=_auth(first_token))
    assert profiles.status_code == 200, profiles.text
    assert len(profiles.json()) == 1
    assert profiles.json()[0]["id"] == profile_id
    assert profiles.json()[0]["onboarding_completed"] is False

    onboarding = client.put(
        f"/api/profiles/{profile_id}",
        headers=_auth(first_token),
        json={
            "name": "Runtime User",
            "goals": ["general", "labs", "meds", "sleep"],
            "onboarding_completed": True,
            "preferred_locale": "ru",
            "timezone": "Asia/Yekaterinburg",
        },
    )
    assert onboarding.status_code == 200, onboarding.text
    onboarded = onboarding.json()
    assert onboarded["onboarding_completed"] is True
    assert onboarded["module_settings"]["general"] is True
    assert onboarded["module_settings"]["labs"] is True
    assert onboarded["module_settings"]["meds"] is True
    assert onboarded["module_settings"]["sleep"] is True
    assert onboarded["is_owner"] is True
    assert any(row.get("profile_id") == profile_id for row in db.puzzle.rows)

    medication = client.post(
        "/api/medications",
        headers=_auth(first_token),
        json={
            "profile_id": profile_id,
            "name": "Runtime Medication",
            "dose": "10 mg",
            "times": ["09:00", "21:00"],
            "meal_relation": "after",
            "active": True,
        },
    )
    assert medication.status_code == 200, medication.text
    medication_id = medication.json()["id"]
    assert medication.json()["times"] == ["09:00", "21:00"]
    assert medication.json()["meal_relation"] == "after"

    medications = client.get(f"/api/medications?profile_id={profile_id}", headers=_auth(first_token))
    assert medications.status_code == 200, medications.text
    assert [item["id"] for item in medications.json()] == [medication_id]

    intake = client.post(
        f"/api/medications/{medication_id}/events",
        headers=_auth(first_token),
        json={"scheduled_at": "2026-08-17T09:00:00+05:00", "status": "taken"},
    )
    assert intake.status_code == 200, intake.text
    assert intake.json()["status"] == "taken"

    events = client.get(
        f"/api/medications/events/list?profile_id={profile_id}&date=2026-08-17",
        headers=_auth(first_token),
    )
    assert events.status_code == 200, events.text
    assert len(events.json()) == 1
    assert events.json()[0]["medication_id"] == medication_id

    task = client.post(
        "/api/tasks",
        headers=_auth(first_token),
        json={
            "profile_id": profile_id,
            "title": "Принять лекарство",
            "kind": "medication",
            "source_type": "medication",
            "source_id": medication_id,
        },
    )
    assert task.status_code == 200, task.text
    task_id = task.json()["id"]
    assert task.json()["done"] is False
    assert task.json()["action_route"] == "/medications"

    toggled = client.put(f"/api/tasks/{task_id}/toggle", headers=_auth(first_token))
    assert toggled.status_code == 200, toggled.text
    assert toggled.json()["done"] is True
    assert toggled.json()["status"] == "done"

    tasks = client.get(f"/api/tasks?profile_id={profile_id}", headers=_auth(first_token))
    assert tasks.status_code == 200, tasks.text
    assert len(tasks.json()) == 1
    assert tasks.json()[0]["id"] == task_id
    assert tasks.json()[0]["done"] is True

    relaunch_restore = client.get("/api/auth/me", headers=_auth(first_token))
    assert relaunch_restore.status_code == 200

    login = client.post("/api/auth/login", json={"identifier": email, "password": password})
    assert login.status_code == 200, login.text
    second_token = login.json()["access_token"]
    assert second_token != first_token

    second_session_meds = client.get(f"/api/medications?profile_id={profile_id}", headers=_auth(second_token))
    second_session_tasks = client.get(f"/api/tasks?profile_id={profile_id}", headers=_auth(second_token))
    assert second_session_meds.status_code == 200
    assert second_session_tasks.status_code == 200
    assert second_session_meds.json()[0]["id"] == medication_id
    assert second_session_tasks.json()[0]["id"] == task_id

    bad_login = client.post("/api/auth/login", json={"identifier": email, "password": "wrong-password"})
    assert bad_login.status_code == 401

    forgot_known = client.post("/api/auth/forgot-password", json={"identifier": email})
    forgot_unknown = client.post("/api/auth/forgot-password", json={"identifier": "missing@example.com"})
    assert forgot_known.status_code == 200
    assert forgot_unknown.status_code == 200
    assert forgot_known.json() == forgot_unknown.json() == {"ok": True}
    assert db.password_resets.rows
    assert all("token" not in row for row in db.password_resets.rows)
    assert all(row.get("token_hash") for row in db.password_resets.rows)

    logout = client.post("/api/auth/logout", headers=_auth(first_token))
    assert logout.status_code == 200, logout.text
    assert client.get("/api/auth/me", headers=_auth(first_token)).status_code == 401
    assert client.get(f"/api/medications?profile_id={profile_id}", headers=_auth(first_token)).status_code == 401
    assert client.get(f"/api/tasks?profile_id={profile_id}", headers=_auth(first_token)).status_code == 401

    still_active = client.get("/api/auth/me", headers=_auth(second_token))
    assert still_active.status_code == 200, still_active.text
    post_login_profiles = client.get("/api/profiles", headers=_auth(second_token))
    assert post_login_profiles.status_code == 200
    assert post_login_profiles.json()[0]["onboarding_completed"] is True
