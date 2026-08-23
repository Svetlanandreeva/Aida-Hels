"""Normalized medication reference search for Aida.

The application stores a stable medication reference together with the display
name. RLS Aurora is used as the production catalogue because it exposes both
trade-name and active-substance searches and stable active-substance IDs that
can later be passed to the interaction service.

Credentials are optional at import/startup time. If they are not configured,
the API reports the catalogue as unavailable and the UI can still let the user
enter a medication manually without pretending it was normalized.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, Iterable, Optional

import httpx
from fastapi import APIRouter, Query

_PROVIDER = "rls_aurora"
_DEFAULT_BASE_URL = "https://rls-aurora.ru"
_DEFAULT_TIMEOUT_SECONDS = 4.0


def _text(value: Any) -> Optional[str]:
    value = str(value or "").strip()
    return value or None


def _integer(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _norm(value: Any) -> str:
    return " ".join(str(value or "").casefold().replace("ё", "е").split())


def normalize_rls_item(row: Dict[str, Any]) -> Dict[str, Any]:
    """Map an RLS inventory row to Aida's provider-independent contract."""
    packing_id = _integer(row.get("packing_id"))
    active_substance_id = _integer(row.get("as_id"))
    trade_name = _text(row.get("trade_name_rus")) or _text(row.get("lat_name")) or _text(row.get("prep_short"))
    active_ingredient = _text(row.get("as_name_rus"))
    return {
        "reference_source": _PROVIDER,
        "reference_id": f"packing:{packing_id}" if packing_id is not None else None,
        "trade_name": trade_name,
        "active_ingredient": active_ingredient,
        "active_substance_id": active_substance_id,
        "dosage_form": _text(row.get("dosage_form_full_name")) or _text(row.get("dosage_form_short_name")),
        "strength": _text(row.get("dose")),
        "registration": _text(row.get("registration")),
        "manufacturer": _text(row.get("producer_tran")) or _text(row.get("firms")),
        "description": _text(row.get("prep_full")) or _text(row.get("prep_short")),
        "updated_at_source": _text(row.get("actdate")),
    }


def _score(item: Dict[str, Any], query: str) -> tuple[int, int, str]:
    q = _norm(query)
    trade = _norm(item.get("trade_name"))
    active = _norm(item.get("active_ingredient"))
    if trade == q:
        rank = 0
    elif active == q:
        rank = 1
    elif trade.startswith(q):
        rank = 2
    elif active.startswith(q):
        rank = 3
    elif q and q in trade:
        rank = 4
    elif q and q in active:
        rank = 5
    else:
        rank = 6
    label = trade or active
    return (rank, len(label), label)


def _dedupe(items: Iterable[Dict[str, Any]]) -> list[Dict[str, Any]]:
    out: list[Dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()
    for item in items:
        if not item.get("trade_name"):
            continue
        key = (
            _norm(item.get("trade_name")),
            _norm(item.get("active_ingredient")),
            _norm(item.get("dosage_form")),
            _norm(item.get("strength")),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


class MedicationReferenceService:
    def __init__(self) -> None:
        self.base_url = os.environ.get("RLS_AURORA_BASE_URL", _DEFAULT_BASE_URL).rstrip("/")
        self.username = os.environ.get("RLS_AURORA_USERNAME", "").strip()
        self.password = os.environ.get("RLS_AURORA_PASSWORD", "").strip()
        try:
            self.timeout_seconds = max(1.0, min(float(os.environ.get("RLS_AURORA_TIMEOUT_SECONDS", _DEFAULT_TIMEOUT_SECONDS)), 10.0))
        except ValueError:
            self.timeout_seconds = _DEFAULT_TIMEOUT_SECONDS

    @property
    def configured(self) -> bool:
        return bool(self.username and self.password)

    async def _inventory(self, **params: Any) -> list[Dict[str, Any]]:
        if not self.configured:
            return []
        url = f"{self.base_url}/api/inventory_complete"
        timeout = httpx.Timeout(self.timeout_seconds)
        async with httpx.AsyncClient(
            auth=httpx.BasicAuth(self.username, self.password),
            timeout=timeout,
            headers={"Accept": "application/json", "User-Agent": "Aida/2.0 medication-reference"},
        ) as client:
            response = await client.get(url, params=params)
            if response.status_code == 204:
                return []
            response.raise_for_status()
            payload = response.json()
        if isinstance(payload, list):
            return [row for row in payload if isinstance(row, dict)]
        if isinstance(payload, dict):
            for key in ("items", "data", "results"):
                rows = payload.get(key)
                if isinstance(rows, list):
                    return [row for row in rows if isinstance(row, dict)]
            # Some lookup methods return one inventory object directly.
            if payload.get("packing_id") is not None:
                return [payload]
        return []

    async def search(self, query: str, limit: int = 12) -> Dict[str, Any]:
        query = " ".join(str(query or "").strip().split())
        safe_limit = max(1, min(int(limit), 20))
        if len(query) < 3:
            return {
                "items": [],
                "provider": _PROVIDER,
                "provider_ready": self.configured,
                "provider_available": self.configured,
                "minimum_query_length": 3,
            }
        if not self.configured:
            return {
                "items": [],
                "provider": _PROVIDER,
                "provider_ready": False,
                "provider_available": False,
                "minimum_query_length": 3,
            }

        trade_result, substance_result = await asyncio.gather(
            self._inventory(tn_like=query),
            self._inventory(mnn_like=query, search_from_start=0),
            return_exceptions=True,
        )
        rows: list[Dict[str, Any]] = []
        successful_calls = 0
        for result in (trade_result, substance_result):
            if isinstance(result, Exception):
                continue
            successful_calls += 1
            rows.extend(result)

        normalized = _dedupe(normalize_rls_item(row) for row in rows)
        normalized.sort(key=lambda item: _score(item, query))
        return {
            "items": normalized[:safe_limit],
            "provider": _PROVIDER,
            "provider_ready": True,
            "provider_available": successful_calls > 0,
            "minimum_query_length": 3,
        }

    async def resolve_reference(self, reference_source: str, reference_id: str) -> Optional[Dict[str, Any]]:
        """Resolve a client selection to canonical provider data.

        Client-supplied active ingredients are never trusted. A selected RLS
        packing is looked up again on the backend before it becomes part of the
        medical profile or AI context.
        """
        if reference_source != _PROVIDER or not self.configured:
            return None
        prefix, separator, raw_id = str(reference_id or "").partition(":")
        if separator != ":" or prefix != "packing":
            return None
        packing_id = _integer(raw_id)
        if packing_id is None:
            return None
        rows = await self._inventory(packing_id=packing_id)
        for row in rows:
            if _integer(row.get("packing_id")) == packing_id:
                return normalize_rls_item(row)
        return None

    async def resolve_exact_trade_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Best-effort normalization for legacy/manual create flows.

        No network call is made unless production credentials are configured.
        Only an exact normalized trade-name match is accepted so the backend
        never guesses the active substance from a fuzzy result.
        """
        name = " ".join(str(name or "").strip().split())
        if len(name) < 3 or not self.configured:
            return None
        try:
            rows = await self._inventory(tn_like=name)
        except (httpx.HTTPError, ValueError):
            return None
        target = _norm(name)
        matches = [normalize_rls_item(row) for row in rows]
        exact = [item for item in matches if _norm(item.get("trade_name")) == target]
        if not exact:
            return None
        exact.sort(key=lambda item: (
            0 if item.get("active_substance_id") is not None else 1,
            0 if item.get("strength") else 1,
            _norm(item.get("trade_name")),
        ))
        return exact[0]


_service: MedicationReferenceService | None = None


def medication_reference_service() -> MedicationReferenceService:
    global _service
    if _service is None:
        _service = MedicationReferenceService()
    return _service


def build_medication_reference_router() -> APIRouter:
    router = APIRouter(prefix="/api/reference/medications", tags=["reference"])

    @router.get("/search")
    async def search_medications(
        q: str = Query(..., min_length=3, max_length=120),
        limit: int = Query(12, ge=1, le=20),
    ) -> Dict[str, Any]:
        return await medication_reference_service().search(q, limit)

    return router
