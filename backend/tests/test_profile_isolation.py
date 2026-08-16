import asyncio

import pytest
from fastapi import HTTPException

from access_control import require_profile_access, require_record_access


class FakeAuth:
    def __init__(self, grants):
        self.grants = grants

    async def has_profile_access(self, account_id: str, profile_id: str, write: bool = False) -> bool:
        role = self.grants.get((account_id, profile_id))
        if role is None:
            return False
        if not write:
            return True
        return role in {"owner", "editor"}


class FakeCollection:
    def __init__(self, records):
        self.records = records

    async def find_one(self, query, projection=None):
        record_id = query.get("id")
        for record in self.records:
            if record.get("id") == record_id:
                return dict(record)
        return None


class FakeDb:
    def __init__(self):
        self.lab_results = FakeCollection([
            {"id": "lab-a", "profile_id": "profile-a", "value": 11},
            {"id": "lab-b", "profile_id": "profile-b", "value": 22},
        ])


def run(coro):
    return asyncio.run(coro)


def test_account_cannot_read_another_profiles_data():
    auth = FakeAuth({("account-a", "profile-a"): "owner", ("account-b", "profile-b"): "owner"})

    run(require_profile_access(auth, {"id": "account-a"}, "profile-a"))

    with pytest.raises(HTTPException) as exc:
        run(require_profile_access(auth, {"id": "account-a"}, "profile-b"))

    assert exc.value.status_code == 404
    assert exc.value.detail == "Profile not found"


def test_account_cannot_read_record_owned_by_another_profile():
    auth = FakeAuth({("account-a", "profile-a"): "owner", ("account-b", "profile-b"): "owner"})
    db = FakeDb()

    own = run(require_record_access(db, auth, {"id": "account-a"}, "lab_results", "lab-a"))
    assert own["profile_id"] == "profile-a"

    with pytest.raises(HTTPException) as exc:
        run(require_record_access(db, auth, {"id": "account-a"}, "lab_results", "lab-b"))

    assert exc.value.status_code == 404


def test_viewer_cannot_write_even_when_read_access_exists():
    auth = FakeAuth({("account-a", "profile-shared"): "viewer"})

    run(require_profile_access(auth, {"id": "account-a"}, "profile-shared", write=False))

    with pytest.raises(HTTPException) as exc:
        run(require_profile_access(auth, {"id": "account-a"}, "profile-shared", write=True))

    assert exc.value.status_code == 404
