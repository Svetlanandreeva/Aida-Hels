"""Local Russian ICD-10 reference search used by medical onboarding."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query

DATA_PATH = Path(__file__).resolve().parent / "data" / "icd10_ru.json"
_CODE_LOOKALIKES = str.maketrans({
    "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H", "К": "K",
    "М": "M", "О": "O", "Р": "P", "Т": "T", "Х": "X", "У": "Y",
})


def _normalize_name(value: str) -> str:
    return " ".join(str(value or "").casefold().replace("ё", "е").split())


def _normalize_code(value: str) -> str:
    return re.sub(r"[^A-Z0-9.]", "", str(value or "").upper().translate(_CODE_LOOKALIKES))


@lru_cache(maxsize=1)
def _catalog() -> tuple[tuple[str, str, str, str], ...]:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    items: list[tuple[str, str, str, str]] = []
    for row in payload:
        code = str(row.get("code") or "").strip().upper()
        name = str(row.get("name") or "").strip()
        if code and name:
            items.append((code, name, _normalize_code(code), _normalize_name(name)))
    return tuple(items)


def _score(query_name: str, query_code: str, code_norm: str, name_norm: str) -> int | None:
    if query_code and code_norm == query_code:
        return 0
    if query_code and code_norm.startswith(query_code):
        return 1
    if name_norm == query_name:
        return 2
    if name_norm.startswith(query_name):
        return 3
    if any(word.startswith(query_name) for word in name_norm.split()):
        return 4
    if query_name in name_norm:
        return 5
    return None


def build_icd10_router() -> APIRouter:
    router = APIRouter(prefix="/api/reference/icd10", tags=["reference"])

    @router.get("/search")
    async def search_icd10(
        q: str = Query(..., min_length=1, max_length=80),
        group: str = Query("all", max_length=16),
        limit: int = Query(12, ge=1, le=20),
    ) -> dict[str, Any]:
        query = " ".join(q.strip().split())
        if not query:
            return {"items": []}
        if group not in {"all", "mental"}:
            group = "all"

        query_name = _normalize_name(query)
        # Treat the input as an ICD code only when it contains a digit. This keeps
        # Cyrillic look-alike normalization useful for "А01" without letting words
        # such as "астма" accidentally compete as code prefixes.
        query_code = _normalize_code(query) if any(char.isdigit() for char in query) else ""
        ranked: list[tuple[int, int, str, str]] = []
        for code, name, code_norm, name_norm in _catalog():
            if group == "mental" and not code_norm.startswith("F"):
                continue
            score = _score(query_name, query_code, code_norm, name_norm)
            if score is None:
                continue
            ranked.append((score, len(name), code, name))

        ranked.sort(key=lambda item: (item[0], item[1], item[2]))
        return {
            "items": [{"code": code, "name": name} for _, _, code, name in ranked[:limit]],
            "group": group,
        }

    return router
