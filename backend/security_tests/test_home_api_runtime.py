import copy
from typing import Any, Dict, Iterable, Optional

from fastapi import FastAPI
from fastapi.testclient import TestClient

from home_api import build_home_router


class _Cursor:
    def __init__(self, rows: Iterable[Dict[str, Any]]):
        self.rows = [copy.deepcopy(row) for row in rows]

    def sort(self, key: str, direction: int):
        self.rows.sort(key=lambda row: str(row.get(key) or ""), reverse=direction < 0)
        return self

    async def to_list(self, limit: int):
        return self.rows[:limit]


class _Collection:
    def __init__(self, rows=None):
        self.rows = [copy.deepcopy(row) for row in (rows or [])]

    @staticmethod
    def _matches(row: Dict[str, Any], query: Dict[str, Any]) -> bool:
        return all(row.get(key) == value for key, value in query.items())

    def find(self, query: Dict[str, Any], projection: Optional[Dict[str, int]] = None):
        rows = [row for row in self.rows if self._matches(row, query)]
        if projection and projection.get("_id") == 0:
            rows = [{k: v for k, v in row.items() if k != "_id"} for row in rows]
        return _Cursor(rows)

    async def find_one(self, query: Dict[str, Any], projection: Optional[Dict[str, int]] = None):
        rows = await self.find(query, projection).to_list(1)
        return rows[0] if rows else None


class _Db:
    def __init__(self):
        self.medications = _Collection()
        self.medication_events = _Collection()
        self.circadian_events = _Collection()
        self.tasks = _Collection()
        self.puzzle = _Collection()


class _Auth:
    async def require_account(self):
        return {"id": "account-1"}

    async def has_profile_access(self, account_id: str, profile_id: str, write: bool = False):
        return account_id == "account-1" and profile_id == "profile-1"


class _Legacy:
    def __init__(self):
        self.fail_overview = False
        self.labs = []
        self.symptoms = []

    async def readiness(self, profile_id):
        return {"scores": {"profile": 0, "labs": 0, "symptoms": 0, "medications": 0}, "overall": 0}

    async def gamification(self, profile_id):
        return {"xp": 0, "level": 1, "quests": []}

    async def list_symptoms(self, profile_id):
        return self.symptoms

    async def list_labs(self, profile_id):
        return self.labs

    async def overview(self, profile_id, language="ru"):
        if self.fail_overview:
            raise RuntimeError("overview unavailable")
        return {"attention": [], "ai_summary": None}


def _client():
    db = _Db()
    auth = _Auth()
    legacy = _Legacy()
    app = FastAPI()
    app.include_router(build_home_router(db, auth, legacy))
    return TestClient(app), db, legacy


def test_home_returns_explicit_empty_states_without_fake_medical_values():
    client, _, _ = _client()
    response = client.get("/api/home/profile-1?date=2026-08-17&now_local=10:00")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["readiness"]["state"] == "insufficient_data"
    assert body["readiness"]["value"] is None
    assert body["lab_status"] == {"state": "no_data", "in_range": None, "out_of_range": None}
    assert body["medications"]["state"] == "no_data"
    assert body["symptoms"]["state"] == "no_data"
    assert body["labs"]["state"] == "no_data"
    assert body["tasks"]["state"] == "no_data"
    assert body["medication_day"]["state"] == "no_data"
    assert body["overview"]["state"] == "no_data"


def test_home_aggregates_real_values_and_preserves_wake_anchored_medication_schedule():
    client, db, legacy = _client()
    db.medications.rows.append({
        "id": "med-1",
        "profile_id": "profile-1",
        "name": "Aida Med",
        "dose": "10 mg",
        "times": ["08:00", "20:00"],
        "meal_relation": "after",
        "active": True,
        "first_dose_anchor": "wake",
        "wake_offset_minutes": 30,
        "created_at": "2026-08-16T10:00:00Z",
    })
    db.circadian_events.rows.append({
        "id": "wake-1",
        "profile_id": "profile-1",
        "kind": "wake",
        "local_date": "2026-08-17",
        "local_time": "09:00",
    })
    db.tasks.rows.append({"id": "task-1", "profile_id": "profile-1", "title": "Measure pressure", "created_at": "2026-08-17T08:00:00Z"})
    db.puzzle.rows.append({"profile_id": "profile-1", "widgets": [{"id": "readiness", "enabled": True}]})
    legacy.labs = [{
        "id": "lab-1",
        "profile_id": "profile-1",
        "title": "CBC",
        "biomarkers": [
            {"name": "A", "value": "1", "status": "normal"},
            {"name": "B", "value": "2", "status": "high"},
        ],
    }]
    legacy.symptoms = [{"id": "symptom-1", "profile_id": "profile-1", "name": "Headache", "severity": 4}]

    response = client.get("/api/home/profile-1?date=2026-08-17&now_local=10:00")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["lab_status"] == {"state": "data", "in_range": 1, "out_of_range": 1}
    assert body["medications"]["state"] == "data"
    assert body["tasks"]["items"][0]["id"] == "task-1"
    assert body["medication_day"]["state"] == "data"
    first_slot = body["medication_day"]["slots"][0]
    assert first_slot["planned_time"] == "08:00"
    assert first_slot["time"] == "09:30"
    assert first_slot["anchor"] == "wake"


def test_home_isolates_one_failed_source_instead_of_failing_the_whole_screen():
    client, _, legacy = _client()
    legacy.fail_overview = True
    response = client.get("/api/home/profile-1?date=2026-08-17")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["overview"]["state"] == "error"
    assert body["labs"]["state"] == "no_data"
    assert body["medications"]["state"] == "no_data"


def test_home_denies_cross_profile_access():
    client, _, _ = _client()
    response = client.get("/api/home/profile-2")
    assert response.status_code == 404
