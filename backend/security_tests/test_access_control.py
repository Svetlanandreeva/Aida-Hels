import asyncio

import pytest
from fastapi import HTTPException

from access_control import require_profile_access, require_record_access
from healthkit_api import HealthSample
from wearable_api import WearableSyncRequest, build_wearable_router


class FakeAuth:
    def __init__(self, allowed):
        self.allowed = allowed
        self.calls = []

    async def has_profile_access(self, account_id, profile_id, write=False):
        self.calls.append((account_id, profile_id, write))
        return (account_id, profile_id, write) in self.allowed


class FakeCollection:
    def __init__(self, records):
        self.records = records

    async def find_one(self, query, projection=None):
        return self.records.get(query.get("id"))


class FakeDB:
    def __init__(self, records):
        self.tasks = FakeCollection(records)


def test_profile_access_allows_owned_profile():
    auth = FakeAuth({("acct-1", "profile-1", False)})
    asyncio.run(require_profile_access(auth, {"id": "acct-1"}, "profile-1"))
    assert auth.calls == [("acct-1", "profile-1", False)]


def test_profile_access_hides_foreign_profile():
    auth = FakeAuth(set())
    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_profile_access(auth, {"id": "acct-1"}, "profile-2"))
    assert exc.value.status_code == 404


def test_record_mutation_requires_write_access_to_record_profile():
    auth = FakeAuth({("acct-1", "profile-1", True)})
    db = FakeDB({"task-1": {"id": "task-1", "profile_id": "profile-1"}})
    record = asyncio.run(
        require_record_access(db, auth, {"id": "acct-1"}, "tasks", "task-1", write=True)
    )
    assert record["profile_id"] == "profile-1"
    assert auth.calls == [("acct-1", "profile-1", True)]


def test_record_access_rejects_foreign_record():
    auth = FakeAuth(set())
    db = FakeDB({"task-2": {"id": "task-2", "profile_id": "profile-2"}})
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            require_record_access(db, auth, {"id": "acct-1"}, "tasks", "task-2", write=True)
        )
    assert exc.value.status_code == 404


class FakeVitals:
    def __init__(self):
        self.rows = []

    async def find_one(self, query, projection=None):
        for row in self.rows:
            if all(row.get(key) == value for key, value in query.items()):
                return dict(row)
        return None

    async def insert_one(self, doc):
        self.rows.append(dict(doc))
        return None


class FakeWearableDB:
    def __init__(self):
        self.vitals = FakeVitals()


class FakeWearableAuth:
    def __init__(self, allowed):
        self.allowed = allowed
        self.calls = []

    async def has_profile_access(self, account_id, profile_id, write=False):
        self.calls.append((account_id, profile_id, write))
        return (account_id, profile_id, write) in self.allowed

    async def require_account(self):
        return {"id": "acct-1"}


def _wearable_sync_endpoint(db, auth):
    router = build_wearable_router(db, auth)
    for route in router.routes:
        if getattr(route, "path", "") == "/api/health/wearables/sync":
            return route.endpoint
    raise AssertionError("wearable sync endpoint not found")


def _wearable_payload():
    return WearableSyncRequest(
        profile_id="profile-1",
        provider="health_connect",
        samples=[
            HealthSample(
                external_id="hc-record-1",
                metric="steps",
                value=1234,
                unit="count",
                start_at="2026-08-15T10:00:00Z",
                end_at="2026-08-15T11:00:00Z",
                source_name="com.example.health",
                device_name="Example Watch",
            )
        ],
    )


def test_wearable_sync_rejects_foreign_profile():
    db = FakeWearableDB()
    auth = FakeWearableAuth(set())
    endpoint = _wearable_sync_endpoint(db, auth)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(endpoint(_wearable_payload(), {"id": "acct-1"}))

    assert exc.value.status_code == 404
    assert db.vitals.rows == []
    assert auth.calls == [("acct-1", "profile-1", True)]


def test_wearable_sync_deduplicates_external_id():
    db = FakeWearableDB()
    auth = FakeWearableAuth({("acct-1", "profile-1", True)})
    endpoint = _wearable_sync_endpoint(db, auth)
    payload = _wearable_payload()

    first = asyncio.run(endpoint(payload, {"id": "acct-1"}))
    second = asyncio.run(endpoint(payload, {"id": "acct-1"}))

    assert first.inserted == 1
    assert first.skipped == 0
    assert second.inserted == 0
    assert second.skipped == 1
    assert len(db.vitals.rows) == 1
