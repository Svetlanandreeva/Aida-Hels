from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional


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
            if op == "$gte" and not (actual is not None and actual >= value):
                return False
            if op == "$gt" and not (actual is not None and actual > value):
                return False
            if op == "$lte" and not (actual is not None and actual <= value):
                return False
            if op == "$lt" and not (actual is not None and actual < value):
                return False
            if op == "$in" and actual not in value:
                return False
            if op == "$ne" and actual == value:
                return False
            if op == "$exists" and bool(actual is not None) != bool(value):
                return False
        return True
    return actual == expected


def _matches(doc: Dict[str, Any], query: Optional[Dict[str, Any]]) -> bool:
    if not query:
        return True
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(doc, branch) for branch in expected):
                return False
            continue
        if key == "$and":
            if not all(_matches(doc, branch) for branch in expected):
                return False
            continue
        if not _match_value(_get(doc, key), expected):
            return False
    return True


def _project(doc: Dict[str, Any], projection: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    result = deepcopy(doc)
    if not projection:
        return result
    excluded = {k for k, v in projection.items() if v == 0}
    for key in excluded:
        result.pop(key, None)
    return result


class StandCursor:
    def __init__(self, docs: Iterable[Dict[str, Any]], projection: Optional[Dict[str, Any]] = None):
        self._docs = [_project(d, projection) for d in docs]

    def sort(self, key: str, direction: int = 1):
        reverse = direction < 0

        def sort_key(doc: Dict[str, Any]):
            value = _get(doc, key)
            if isinstance(value, datetime):
                return (0, value.timestamp())
            return (value is None, value)

        self._docs.sort(key=sort_key, reverse=reverse)
        return self

    def limit(self, count: int):
        self._docs = self._docs[:count]
        return self

    async def to_list(self, length: Optional[int] = None):
        if length is None:
            return deepcopy(self._docs)
        return deepcopy(self._docs[:length])


class StandCollection:
    def __init__(self):
        self.docs: List[Dict[str, Any]] = []

    async def find_one(self, query: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None):
        for doc in self.docs:
            if _matches(doc, query):
                return _project(doc, projection)
        return None

    def find(self, query: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None):
        return StandCursor((d for d in self.docs if _matches(d, query)), projection)

    async def insert_one(self, doc: Dict[str, Any]):
        self.docs.append(deepcopy(doc))
        return {"inserted_id": doc.get("id")}

    async def delete_one(self, query: Dict[str, Any]):
        for index, doc in enumerate(self.docs):
            if _matches(doc, query):
                self.docs.pop(index)
                return {"deleted_count": 1}
        return {"deleted_count": 0}

    async def delete_many(self, query: Dict[str, Any]):
        before = len(self.docs)
        self.docs = [doc for doc in self.docs if not _matches(doc, query)]
        return {"deleted_count": before - len(self.docs)}

    async def count_documents(self, query: Optional[Dict[str, Any]] = None):
        return sum(1 for doc in self.docs if _matches(doc, query))

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False):
        for doc in self.docs:
            if _matches(doc, query):
                if "$set" in update:
                    doc.update(deepcopy(update["$set"]))
                return {"matched_count": 1, "modified_count": 1}
        if upsert:
            new_doc = deepcopy(query)
            if "$set" in update:
                new_doc.update(deepcopy(update["$set"]))
            self.docs.append(new_doc)
            return {"matched_count": 0, "modified_count": 0, "upserted_id": new_doc.get("id")}
        return {"matched_count": 0, "modified_count": 0}


class StandDB:
    def __init__(self):
        self._collections: Dict[str, StandCollection] = {}

    def __getattr__(self, name: str) -> StandCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        return self._collections.setdefault(name, StandCollection())

    def __getitem__(self, name: str) -> StandCollection:
        return self.__getattr__(name)


class StandClient:
    def close(self):
        return None
