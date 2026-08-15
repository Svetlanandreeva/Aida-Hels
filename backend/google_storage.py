"""Google Sheets storage adapter for Aida 2.0.

The adapter exposes the tiny subset of Motor/Mongo methods used by the current
FastAPI code while storing all structured user data in Google Sheets.
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import requests
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"
SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"

SHEET_NAMES = {
    "profiles": "profiles",
    "labs": "labs",
    "symptoms": "symptoms",
    "medications": "medications",
    "medication_events": "medication_events",
    "vitals": "vitals",
    "checkins": "checkins",
    "tasks": "tasks",
    "chat_messages": "chat",
    "puzzle": "puzzle",
    "files": "files",
    "accounts": "accounts",
    "access_grants": "access_grants",
    "audit_log": "audit_log",
    "candidates": "candidates",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _col(n: int) -> str:
    out = ""
    while n:
        n, r = divmod(n - 1, 26)
        out = chr(65 + r) + out
    return out or "A"


def _encode(value: Any) -> str:
    if value is None:
        return ""
    return json.dumps(value, ensure_ascii=False, default=str, separators=(",", ":"))


def _decode(value: Any) -> Any:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except Exception:
        return value


def _matches(doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
    for key, expected in (query or {}).items():
        actual = doc.get(key)
        if isinstance(expected, dict):
            for op, target in expected.items():
                a = str(actual) if actual is not None else None
                t = str(target)
                if op == "$gte" and (a is None or a < t):
                    return False
                if op == "$gt" and (a is None or a <= t):
                    return False
                if op == "$lte" and (a is None or a > t):
                    return False
                if op == "$lt" and (a is None or a >= t):
                    return False
                if op == "$in" and actual not in target:
                    return False
        elif actual != expected:
            return False
    return True


class SheetsHTTP:
    def __init__(self, spreadsheet_id: str, service_account_json: str):
        self.spreadsheet_id = spreadsheet_id
        info = json.loads(service_account_json)
        self.credentials = service_account.Credentials.from_service_account_info(
            info, scopes=[SHEETS_SCOPE]
        )
        self.auth_request = GoogleAuthRequest()
        self.auth_lock = threading.RLock()

    def headers(self) -> Dict[str, str]:
        with self.auth_lock:
            if not self.credentials.valid:
                self.credentials.refresh(self.auth_request)
            return {
                "Authorization": f"Bearer {self.credentials.token}",
                "Content-Type": "application/json",
            }

    def _base(self, suffix: str) -> str:
        return f"{SHEETS_API}/{self.spreadsheet_id}/{suffix}"

    def get_rows(self, sheet: str) -> List[List[Any]]:
        rng = quote(f"'{sheet}'!A:ZZ", safe="")
        r = requests.get(self._base(f"values/{rng}"), headers=self.headers(), timeout=20)
        r.raise_for_status()
        return r.json().get("values", [])

    def update(self, sheet: str, range_a1: str, values: List[List[Any]]) -> None:
        rng = quote(f"'{sheet}'!{range_a1}", safe="")
        r = requests.put(
            self._base(f"values/{rng}?valueInputOption=RAW"),
            headers=self.headers(),
            json={"majorDimension": "ROWS", "values": values},
            timeout=20,
        )
        r.raise_for_status()

    def append(self, sheet: str, values: List[List[Any]]) -> None:
        rng = quote(f"'{sheet}'!A:ZZ", safe="")
        r = requests.post(
            self._base(f"values/{rng}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"),
            headers=self.headers(),
            json={"majorDimension": "ROWS", "values": values},
            timeout=20,
        )
        r.raise_for_status()

    def clear_row(self, sheet: str, row_number: int, width: int) -> None:
        rng = quote(f"'{sheet}'!A{row_number}:{_col(max(width, 1))}{row_number}", safe="")
        r = requests.post(self._base(f"values/{rng}:clear"), headers=self.headers(), json={}, timeout=20)
        r.raise_for_status()


class LazyCursor:
    def __init__(self, collection: "SheetsCollection", query: Dict[str, Any]):
        self.collection = collection
        self.query = query
        self.sort_field: Optional[str] = None
        self.sort_direction = 1

    def sort(self, field: str, direction: int):
        self.sort_field = field
        self.sort_direction = direction
        return self

    async def to_list(self, length: int):
        _, rows = await self.collection._read()
        docs = [dict(doc) for _, doc in rows if _matches(doc, self.query)]
        if self.sort_field:
            docs.sort(
                key=lambda d: (d.get(self.sort_field) is None, str(d.get(self.sort_field) or "")),
                reverse=self.sort_direction < 0,
            )
        return docs[:length]


class SheetsCollection:
    def __init__(self, http: SheetsHTTP, name: str):
        self.http = http
        self.sheet = SHEET_NAMES.get(name, name)
        self.lock = asyncio.Lock()

    def _read_sync(self):
        rows = self.http.get_rows(self.sheet)
        if not rows:
            return [], []
        headers = [str(v).strip() for v in rows[0]]
        docs = []
        for row_number, row in enumerate(rows[1:], start=2):
            if not any(str(v).strip() for v in row):
                continue
            doc: Dict[str, Any] = {}
            for i, h in enumerate(headers):
                if h and i < len(row):
                    val = _decode(row[i])
                    if val is not None:
                        doc[h] = val
            if doc:
                docs.append((row_number, doc))
        return headers, docs

    async def _read(self):
        return await asyncio.to_thread(self._read_sync)

    async def _headers_for(self, headers: List[str], doc: Dict[str, Any]):
        new_headers = list(headers)
        for key in doc.keys():
            if key not in new_headers:
                new_headers.append(key)
        if not new_headers:
            new_headers = list(doc.keys())
        if new_headers != headers:
            await asyncio.to_thread(
                self.http.update,
                self.sheet,
                f"A1:{_col(len(new_headers))}1",
                [new_headers],
            )
        return new_headers

    async def _append_unlocked(self, doc: Dict[str, Any]):
        payload = dict(doc)
        payload.setdefault("created_at", _now())
        payload["updated_at"] = _now()
        headers, _ = await self._read()
        headers = await self._headers_for(headers, payload)
        await asyncio.to_thread(
            self.http.append,
            self.sheet,
            [[_encode(payload.get(h)) for h in headers]],
        )
        return payload

    def find(self, query: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None):
        return LazyCursor(self, query or {})

    async def find_one(self, query: Dict[str, Any], projection: Optional[Dict[str, Any]] = None):
        _, rows = await self._read()
        for _, doc in rows:
            if _matches(doc, query):
                return dict(doc)
        return None

    async def insert_one(self, doc: Dict[str, Any]):
        async with self.lock:
            payload = await self._append_unlocked(doc)
        return {"inserted_id": payload.get("id")}

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False):
        async with self.lock:
            headers, rows = await self._read()
            patch = dict(update.get("$set", update))
            for row_number, doc in rows:
                if not _matches(doc, query):
                    continue
                doc.update(patch)
                doc["updated_at"] = _now()
                headers = await self._headers_for(headers, doc)
                await asyncio.to_thread(
                    self.http.update,
                    self.sheet,
                    f"A{row_number}:{_col(len(headers))}{row_number}",
                    [[_encode(doc.get(h)) for h in headers]],
                )
                return {"matched_count": 1, "modified_count": 1}
            if upsert:
                payload = dict(query)
                payload.update(patch)
                await self._append_unlocked(payload)
                return {"matched_count": 0, "modified_count": 0, "upserted": True}
        return {"matched_count": 0, "modified_count": 0}

    async def delete_one(self, query: Dict[str, Any]):
        async with self.lock:
            headers, rows = await self._read()
            for row_number, doc in rows:
                if _matches(doc, query):
                    await asyncio.to_thread(self.http.clear_row, self.sheet, row_number, len(headers))
                    return {"deleted_count": 1}
        return {"deleted_count": 0}

    async def delete_many(self, query: Dict[str, Any]):
        async with self.lock:
            headers, rows = await self._read()
            targets = [row_number for row_number, doc in rows if _matches(doc, query)]
            for row_number in targets:
                await asyncio.to_thread(self.http.clear_row, self.sheet, row_number, len(headers))
            return {"deleted_count": len(targets)}

    async def count_documents(self, query: Dict[str, Any]):
        _, rows = await self._read()
        return sum(1 for _, doc in rows if _matches(doc, query))


class GoogleSheetsDB:
    def __init__(self, http: SheetsHTTP):
        self.http = http
        self.collections: Dict[str, SheetsCollection] = {}

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self.collections:
            self.collections[name] = SheetsCollection(self.http, name)
        return self.collections[name]


class DisabledStorage:
    def __getattr__(self, name: str):
        raise RuntimeError(
            "Google storage is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and "
            "GOOGLE_SHEETS_SPREADSHEET_ID."
        )


def build_storage_from_env():
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    spreadsheet_id = os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", "").strip()
    if not raw or not spreadsheet_id:
        return DisabledStorage()
    return GoogleSheetsDB(SheetsHTTP(spreadsheet_id, raw))
