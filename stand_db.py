from __future__ import annotations

import base64
import json
import os
from copy import deepcopy
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

SPREADSHEET_ID = os.environ.get("GOOGLE_SPREADSHEET_ID", "")
SERVICE_ACCOUNT_B64 = os.environ.get("GOOGLE_SERVICE_ACCOUNT_B64", "")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

ALIASES = {
    "meds": "medications",
    "messages": "chat",
    "chat_messages": "chat",
    "puzzles": "puzzle",
    "puzzle_configs": "puzzle",
}

JSON_FIELDS = {
    "profiles": {"allergies": "allergies_json", "chronic_conditions": "chronic_conditions_json"},
    "labs": {"biomarkers": "biomarkers_json"},
    "puzzle": {"widgets": "widgets_json"},
}


def _get(doc: Dict[str, Any], key: str) -> Any:
    value: Any = doc
    for part in key.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def _match_value(actual: Any, expected: Any) -> bool:
    if isinstance(expected, dict):
        for op, value in expected.items():
            if op == "$gte" and not (actual is not None and actual >= value): return False
            if op == "$gt" and not (actual is not None and actual > value): return False
            if op == "$lte" and not (actual is not None and actual <= value): return False
            if op == "$lt" and not (actual is not None and actual < value): return False
            if op == "$in" and actual not in value: return False
            if op == "$ne" and actual == value: return False
            if op == "$exists" and bool(actual is not None) != bool(value): return False
        return True
    return actual == expected


def _matches(doc: Dict[str, Any], query: Optional[Dict[str, Any]]) -> bool:
    if not query: return True
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(doc, branch) for branch in expected): return False
            continue
        if key == "$and":
            if not all(_matches(doc, branch) for branch in expected): return False
            continue
        if not _match_value(_get(doc, key), expected): return False
    return True


def _project(doc: Dict[str, Any], projection: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    result = deepcopy(doc)
    if projection:
        for key, value in projection.items():
            if value == 0: result.pop(key, None)
    return result


def _serial(value: Any) -> Any:
    if isinstance(value, (datetime, date)): return value.isoformat()
    if isinstance(value, bool): return value
    if value is None: return ""
    return value


class StandCursor:
    def __init__(self, docs: Iterable[Dict[str, Any]], projection: Optional[Dict[str, Any]] = None):
        self._docs = [_project(d, projection) for d in docs]

    def sort(self, key: str, direction: int = 1):
        self._docs.sort(key=lambda d: (_get(d, key) is None, _get(d, key)), reverse=direction < 0)
        return self

    def limit(self, count: int):
        self._docs = self._docs[:count]
        return self

    async def to_list(self, length: Optional[int] = None):
        return deepcopy(self._docs if length is None else self._docs[:length])


class GoogleCollection:
    def __init__(self, db: "StandDB", name: str):
        self.db = db
        self.name = ALIASES.get(name, name)

    def _headers(self) -> List[str]:
        values = self.db.sheets.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range=f"{self.name}!1:1"
        ).execute().get("values", [[]])
        return values[0] if values else []

    def _decode(self, headers: List[str], row: List[Any]) -> Dict[str, Any]:
        raw = {h: row[i] if i < len(row) else "" for i, h in enumerate(headers)}
        reverse = {v: k for k, v in JSON_FIELDS.get(self.name, {}).items()}
        doc: Dict[str, Any] = {}
        for key, value in raw.items():
            if not key or value == "": continue
            if key in reverse:
                try: doc[reverse[key]] = json.loads(value)
                except Exception: doc[reverse[key]] = []
            else:
                doc[key] = value
        for numeric in ("height_cm", "weight_kg", "severity", "mood", "energy", "stress", "anxiety", "sleep", "systolic", "diastolic", "pulse", "value"):
            if numeric in doc:
                try: doc[numeric] = float(doc[numeric])
                except Exception: pass
        for boolean in ("active", "done"):
            if boolean in doc and isinstance(doc[boolean], str):
                doc[boolean] = doc[boolean].lower() in ("true", "1", "yes")
        return doc

    def _encode(self, headers: List[str], doc: Dict[str, Any]) -> List[Any]:
        forward = JSON_FIELDS.get(self.name, {})
        mapped = dict(doc)
        for source, target in forward.items():
            if source in mapped:
                mapped[target] = json.dumps(mapped.pop(source), ensure_ascii=False, default=str)
        return [_serial(mapped.get(h)) for h in headers]

    def _all(self) -> tuple[List[str], List[Dict[str, Any]]]:
        headers = self._headers()
        if not headers: return [], []
        rows = self.db.sheets.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range=f"{self.name}!A2:Z"
        ).execute().get("values", [])
        return headers, [self._decode(headers, r) for r in rows if any(str(x).strip() for x in r)]

    def _rewrite(self, headers: List[str], docs: List[Dict[str, Any]]):
        api = self.db.sheets.spreadsheets().values()
        api.clear(spreadsheetId=SPREADSHEET_ID, range=f"{self.name}!A2:Z", body={}).execute()
        if docs:
            api.update(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{self.name}!A2",
                valueInputOption="RAW",
                body={"values": [self._encode(headers, d) for d in docs]},
            ).execute()

    async def find_one(self, query=None, projection=None):
        _, docs = self._all()
        for doc in docs:
            if _matches(doc, query): return _project(doc, projection)
        return None

    def find(self, query=None, projection=None):
        _, docs = self._all()
        return StandCursor((d for d in docs if _matches(d, query)), projection)

    async def insert_one(self, doc: Dict[str, Any]):
        headers = self._headers()
        self.db.sheets.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{self.name}!A:Z",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [self._encode(headers, doc)]},
        ).execute()
        return {"inserted_id": doc.get("id")}

    async def count_documents(self, query=None):
        _, docs = self._all()
        return sum(1 for d in docs if _matches(d, query))

    async def update_one(self, query, update, upsert=False):
        headers, docs = self._all()
        for doc in docs:
            if _matches(doc, query):
                doc.update(deepcopy(update.get("$set", {})))
                self._rewrite(headers, docs)
                return {"matched_count": 1, "modified_count": 1}
        if upsert:
            new_doc = deepcopy(query)
            new_doc.update(deepcopy(update.get("$set", {})))
            docs.append(new_doc)
            self._rewrite(headers, docs)
            return {"matched_count": 0, "modified_count": 0, "upserted_id": new_doc.get("id")}
        return {"matched_count": 0, "modified_count": 0}

    async def delete_one(self, query):
        headers, docs = self._all()
        for i, doc in enumerate(docs):
            if _matches(doc, query):
                docs.pop(i)
                self._rewrite(headers, docs)
                return {"deleted_count": 1}
        return {"deleted_count": 0}

    async def delete_many(self, query):
        headers, docs = self._all()
        kept = [d for d in docs if not _matches(d, query)]
        deleted = len(docs) - len(kept)
        if deleted: self._rewrite(headers, kept)
        return {"deleted_count": deleted}


class StandDB:
    def __init__(self):
        if not SPREADSHEET_ID or not SERVICE_ACCOUNT_B64:
            raise RuntimeError("Google Sheets storage is not configured")
        info = json.loads(base64.b64decode(SERVICE_ACCOUNT_B64).decode("utf-8"))
        credentials = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        self.sheets = build("sheets", "v4", credentials=credentials, cache_discovery=False)
        self._collections: Dict[str, GoogleCollection] = {}

    def __getattr__(self, name: str) -> GoogleCollection:
        if name.startswith("_"): raise AttributeError(name)
        return self._collections.setdefault(name, GoogleCollection(self, name))

    def __getitem__(self, name: str) -> GoogleCollection:
        return self.__getattr__(name)


class StandClient:
    def close(self):
        return None
