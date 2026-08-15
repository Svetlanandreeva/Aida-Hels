import asyncio

import pytest
from fastapi import HTTPException

from access_control import require_profile_access, require_record_access


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
