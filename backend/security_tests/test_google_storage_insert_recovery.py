import asyncio

import requests

from google_storage import SheetsCollection


class _BaseRecoveryCollection(SheetsCollection):
    def __init__(self):
        self.http = object()
        self.sheet = "oauth_tickets"
        self.lock = asyncio.Lock()
        self.append_calls = 0


class _CommittedBeforeTimeout(_BaseRecoveryCollection):
    async def _append_unlocked(self, doc):
        self.append_calls += 1
        raise requests.ReadTimeout("ambiguous write timeout")

    async def _find_existing_id_unlocked(self, document_id):
        return {"id": document_id, "ticket_hash": "already-committed"}


class _NotCommittedBeforeTimeout(_BaseRecoveryCollection):
    async def _append_unlocked(self, doc):
        self.append_calls += 1
        if self.append_calls == 1:
            raise requests.ReadTimeout("write did not commit")
        return dict(doc)

    async def _find_existing_id_unlocked(self, document_id):
        return None


def test_insert_recovers_when_google_committed_before_timeout():
    collection = _CommittedBeforeTimeout()
    result = asyncio.run(collection.insert_one({"id": "ticket-1"}))
    assert result == {"inserted_id": "ticket-1", "recovered": True}
    assert collection.append_calls == 1


def test_insert_retries_same_document_when_timeout_did_not_commit():
    collection = _NotCommittedBeforeTimeout()
    result = asyncio.run(collection.insert_one({"id": "ticket-2"}))
    assert result == {"inserted_id": "ticket-2"}
    assert collection.append_calls == 2
