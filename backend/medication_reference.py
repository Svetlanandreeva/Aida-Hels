"""Free medication reference search with Google Sheets persistence and RAM cache.

The catalogue is deliberately infrastructure-light:
- Google Sheets is the durable, shared cache (``medication_catalog``);
- the production process keeps a small RAM index so autocomplete does not read
  the spreadsheet for every keystroke;
- on a cache miss the backend queries free public reference services (RxNorm,
  PubChem and Wikidata), normalizes the result and writes it back to Sheets.

No paid medication-provider credentials are required. Client-supplied active
ingredient metadata is never trusted: a selected result is resolved again from
Aida's own catalogue by its stable internal reference id before it is stored on
the medical profile.
"""
from __future__ import annotations

import asyncio
import hashlib
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Query

_PROVIDER = "aida_catalog"
_MIN_QUERY_LENGTH = 3
_CACHE_REFRESH_SECONDS = 300.0
_EXTERNAL_QUERY_TTL_SECONDS = 600.0
_MAX_CACHE_ROWS = 10000
_DEFAULT_TIMEOUT_SECONDS = 3.5
_RXNORM = "https://rxnav.nlm.nih.gov"
_PUBCHEM = "https://pubchem.ncbi.nlm.nih.gov"
_WIKIDATA_API = "https://www.wikidata.org/w/api.php"
_BRAND_RE = re.compile(r"\[([^\]]+)\]")
_CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    return text or None


def _norm(value: Any) -> str:
    return " ".join(str(value or "").casefold().replace("ё", "е").split())


def _string_list(value: Any) -> list[str]:
    values = value if isinstance(value, list) else [value]
    out: list[str] = []
    seen: set[str] = set()
    for item in values:
        text = _text(item)
        if not text:
            continue
        key = _norm(text)
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def _catalog_id(trade_name: Any, active_ingredient: Any) -> str:
    payload = f"{_norm(trade_name)}|{_norm(active_ingredient)}".encode("utf-8")
    return "medref_" + hashlib.sha256(payload).hexdigest()[:24]


def _verification_rank(value: Any) -> int:
    return {"verified": 3, "probable": 2, "unverified": 1}.get(str(value or ""), 0)


def _score(item: Dict[str, Any], query: str) -> tuple[int, int, int, str]:
    q = _norm(query)
    trade = _norm(item.get("trade_name"))
    active = _norm(item.get("active_ingredient"))
    aliases = [_norm(alias) for alias in _string_list(item.get("aliases"))]
    if trade == q:
        rank = 0
    elif active == q:
        rank = 1
    elif q in aliases:
        rank = 2
    elif trade.startswith(q):
        rank = 3
    elif active.startswith(q):
        rank = 4
    elif any(alias.startswith(q) for alias in aliases):
        rank = 5
    elif q and q in trade:
        rank = 6
    elif q and q in active:
        rank = 7
    elif any(q and q in alias for alias in aliases):
        rank = 8
    else:
        rank = 99
    confidence = int(float(item.get("confidence") or 0) * 1000)
    label = trade or active
    return (rank, -confidence, len(label), label)


def _finalize_candidate(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    trade_name = _text(item.get("trade_name"))
    active_ingredient = _text(item.get("active_ingredient"))
    if not trade_name or not active_ingredient:
        return None
    catalog_id = _text(item.get("id")) or _catalog_id(trade_name, active_ingredient)
    aliases = _string_list([trade_name, active_ingredient, *(_string_list(item.get("aliases")))])
    source_names = _string_list(item.get("source_names"))
    source_urls = _string_list(item.get("source_urls"))
    external_ids = item.get("external_ids") if isinstance(item.get("external_ids"), dict) else {}
    verification_status = str(item.get("verification_status") or "probable")
    try:
        confidence = max(0.0, min(float(item.get("confidence") or 0.0), 1.0))
    except (TypeError, ValueError):
        confidence = 0.0
    return {
        "id": catalog_id,
        "reference_source": _PROVIDER,
        "reference_id": catalog_id,
        "trade_name": trade_name,
        "active_ingredient": active_ingredient,
        "active_substance_id": _text(item.get("active_substance_id")),
        "aliases": aliases,
        "dosage_form": _text(item.get("dosage_form")),
        "strength": _text(item.get("strength")),
        "registration": _text(item.get("registration")),
        "manufacturer": _text(item.get("manufacturer")),
        "description": _text(item.get("description")),
        "verification_status": verification_status,
        "confidence": confidence,
        "source_names": source_names,
        "source_urls": source_urls,
        "external_ids": external_ids,
        "updated_at_source": _text(item.get("updated_at_source")) or _now_iso(),
        "last_verified_at": _text(item.get("last_verified_at")) or _now_iso(),
    }


def _merge_candidates(items: Iterable[Dict[str, Any]]) -> list[Dict[str, Any]]:
    merged: dict[tuple[str, str], Dict[str, Any]] = {}
    for raw in items:
        if not raw:
            continue
        item = _finalize_candidate(raw)
        if not item:
            continue
        key = (_norm(item["trade_name"]), _norm(item["active_ingredient"]))
        current = merged.get(key)
        if current is None:
            merged[key] = item
            continue
        better = item if (
            _verification_rank(item.get("verification_status")),
            float(item.get("confidence") or 0),
        ) > (
            _verification_rank(current.get("verification_status")),
            float(current.get("confidence") or 0),
        ) else current
        other = current if better is item else item
        better["aliases"] = _string_list([*better.get("aliases", []), *other.get("aliases", [])])
        better["source_names"] = _string_list([*better.get("source_names", []), *other.get("source_names", [])])
        better["source_urls"] = _string_list([*better.get("source_urls", []), *other.get("source_urls", [])])
        better["external_ids"] = {**(other.get("external_ids") or {}), **(better.get("external_ids") or {})}
        if not better.get("active_substance_id") and other.get("active_substance_id"):
            better["active_substance_id"] = other["active_substance_id"]
        merged[key] = better
    return list(merged.values())


def _extract_brand(product_name: Any) -> Optional[str]:
    match = _BRAND_RE.search(str(product_name or ""))
    return _text(match.group(1)) if match else None


def _wikidata_label(entity: Dict[str, Any], language: str) -> Optional[str]:
    labels = entity.get("labels") if isinstance(entity.get("labels"), dict) else {}
    value = labels.get(language) if isinstance(labels, dict) else None
    return _text(value.get("value")) if isinstance(value, dict) else None


def _wikidata_aliases(entity: Dict[str, Any]) -> list[str]:
    aliases = entity.get("aliases") if isinstance(entity.get("aliases"), dict) else {}
    out: list[str] = []
    for language in ("ru", "en"):
        for row in aliases.get(language, []) if isinstance(aliases, dict) else []:
            if isinstance(row, dict):
                value = _text(row.get("value"))
                if value:
                    out.append(value)
    for language in ("ru", "en"):
        value = _wikidata_label(entity, language)
        if value:
            out.append(value)
    return _string_list(out)


def _wikidata_ingredient_ids(entity: Dict[str, Any]) -> list[str]:
    claims = entity.get("claims") if isinstance(entity.get("claims"), dict) else {}
    rows = claims.get("P3781", []) if isinstance(claims, dict) else []
    out: list[str] = []
    for claim in rows:
        if not isinstance(claim, dict):
            continue
        mainsnak = claim.get("mainsnak") if isinstance(claim.get("mainsnak"), dict) else {}
        datavalue = mainsnak.get("datavalue") if isinstance(mainsnak, dict) else {}
        value = datavalue.get("value") if isinstance(datavalue, dict) else None
        qid = _text(value.get("id")) if isinstance(value, dict) else None
        if qid and qid.startswith("Q") and qid not in out:
            out.append(qid)
    return out


class MedicationReferenceService:
    def __init__(self, db: Any = None, *, timeout_seconds: float = _DEFAULT_TIMEOUT_SECONDS) -> None:
        self.db = db
        self.timeout_seconds = max(1.0, min(float(timeout_seconds), 8.0))
        self._cache: dict[str, Dict[str, Any]] = {}
        self._cache_loaded_at = 0.0
        self._cache_lock = asyncio.Lock()
        self._external_query_times: dict[str, float] = {}

    @property
    def configured(self) -> bool:
        return True

    async def _load_cache(self, *, force: bool = False) -> None:
        if self.db is None:
            return
        now = time.monotonic()
        if not force and self._cache_loaded_at and now - self._cache_loaded_at < _CACHE_REFRESH_SECONDS:
            return
        async with self._cache_lock:
            now = time.monotonic()
            if not force and self._cache_loaded_at and now - self._cache_loaded_at < _CACHE_REFRESH_SECONDS:
                return
            try:
                rows = await self.db.medication_catalog.find({}).to_list(_MAX_CACHE_ROWS)
            except Exception:
                self._cache_loaded_at = now
                return
            loaded: dict[str, Dict[str, Any]] = {}
            for row in rows:
                item = _finalize_candidate(row)
                if item:
                    loaded[item["id"]] = item
            self._cache = loaded
            self._cache_loaded_at = now

    def _cache_matches(self, query: str, limit: int) -> list[Dict[str, Any]]:
        matches = [item for item in self._cache.values() if _score(item, query)[0] < 99]
        matches.sort(key=lambda item: _score(item, query))
        return [dict(item) for item in matches[:limit]]

    async def _persist(self, items: Iterable[Dict[str, Any]]) -> None:
        for raw in items:
            item = _finalize_candidate(raw)
            if not item:
                continue
            existing = self._cache.get(item["id"])
            merged = _merge_candidates([existing, item] if existing else [item])
            if not merged:
                continue
            saved = merged[0]
            self._cache[saved["id"]] = saved
            if self.db is None:
                continue
            try:
                await self.db.medication_catalog.update_one(
                    {"id": saved["id"]},
                    {"$set": saved},
                    upsert=True,
                )
            except Exception:
                continue

    async def _lookup_pubchem(self, client: httpx.AsyncClient, query: str) -> tuple[list[Dict[str, Any]], bool]:
        url = f"{_PUBCHEM}/rest/pug/compound/name/{quote(query, safe='')}/property/Title/JSON"
        response = await client.get(url)
        if response.status_code == 404:
            return [], True
        response.raise_for_status()
        payload = response.json()
        rows = ((payload.get("PropertyTable") or {}).get("Properties") or []) if isinstance(payload, dict) else []
        if not rows:
            return [], True
        row = rows[0] if isinstance(rows[0], dict) else {}
        cid = _text(row.get("CID"))
        title = _text(row.get("Title"))
        if not cid or not title:
            return [], True
        trade_name = query.strip() if _norm(query) != _norm(title) else title
        item = _finalize_candidate({
            "trade_name": trade_name,
            "active_ingredient": title,
            "active_substance_id": f"pubchem:{cid}",
            "aliases": [query, title],
            "verification_status": "verified",
            "confidence": 0.92,
            "source_names": ["PubChem"],
            "source_urls": [f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}"],
            "external_ids": {"pubchem_cid": cid},
        })
        return ([item] if item else []), True

    async def _rxnorm_ingredients(self, client: httpx.AsyncClient, rxcui: str) -> tuple[list[str], list[str]]:
        response = await client.get(f"{_RXNORM}/REST/rxcui/{quote(rxcui, safe='')}/related.json", params={"tty": "IN PIN MIN"})
        response.raise_for_status()
        payload = response.json()
        groups = ((payload.get("relatedGroup") or {}).get("conceptGroup") or []) if isinstance(payload, dict) else []
        rows: list[tuple[int, str, str]] = []
        priority = {"IN": 0, "PIN": 1, "MIN": 2}
        for group in groups:
            if not isinstance(group, dict):
                continue
            tty = str(group.get("tty") or "")
            for prop in group.get("conceptProperties") or []:
                if not isinstance(prop, dict):
                    continue
                name = _text(prop.get("name"))
                ingredient_id = _text(prop.get("rxcui"))
                if name and ingredient_id:
                    rows.append((priority.get(tty, 9), name, ingredient_id))
        rows.sort(key=lambda row: (row[0], row[1]))
        names: list[str] = []
        ids: list[str] = []
        for _, name, ingredient_id in rows:
            if _norm(name) not in {_norm(value) for value in names}:
                names.append(name)
            if ingredient_id not in ids:
                ids.append(ingredient_id)
        return names[:4], ids[:4]

    async def _lookup_rxnorm(self, client: httpx.AsyncClient, query: str) -> tuple[list[Dict[str, Any]], bool]:
        response = await client.get(f"{_RXNORM}/REST/drugs.json", params={"name": query})
        response.raise_for_status()
        payload = response.json()
        groups = ((payload.get("drugGroup") or {}).get("conceptGroup") or []) if isinstance(payload, dict) else []
        products: list[Dict[str, Any]] = []
        tty_priority = {"SBD": 0, "BPCK": 1, "SCD": 2, "GPCK": 3}
        for group in groups:
            if not isinstance(group, dict):
                continue
            tty = str(group.get("tty") or "")
            for prop in group.get("conceptProperties") or []:
                if not isinstance(prop, dict):
                    continue
                row = dict(prop)
                row["_tty"] = tty
                products.append(row)
        products.sort(key=lambda row: (tty_priority.get(str(row.get("_tty")), 9), len(str(row.get("name") or ""))))
        products = products[:6]
        if not products:
            return [], True

        async def normalize_product(product: Dict[str, Any]) -> Optional[Dict[str, Any]]:
            rxcui = _text(product.get("rxcui"))
            product_name = _text(product.get("name"))
            if not rxcui or not product_name:
                return None
            try:
                ingredient_names, ingredient_ids = await self._rxnorm_ingredients(client, rxcui)
            except (httpx.HTTPError, ValueError):
                return None
            if not ingredient_names or not ingredient_ids:
                return None
            brand = _extract_brand(product_name)
            synonym = _text(product.get("synonym"))
            active = " + ".join(ingredient_names)
            trade = brand or (query.strip() if _norm(query) != _norm(active) else active)
            active_id = "rxnorm:" + "+".join(ingredient_ids)
            return _finalize_candidate({
                "trade_name": trade,
                "active_ingredient": active,
                "active_substance_id": active_id,
                "aliases": [query, product_name, synonym, brand, *ingredient_names],
                "description": product_name,
                "verification_status": "verified",
                "confidence": 0.98,
                "source_names": ["RxNorm"],
                "source_urls": [f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}.html"],
                "external_ids": {
                    "rxnorm_product_rxcui": rxcui,
                    "rxnorm_ingredient_rxcui": ingredient_ids,
                },
            })

        normalized = await asyncio.gather(*(normalize_product(product) for product in products))
        return [item for item in normalized if item], True

    async def _wikidata_entities(self, client: httpx.AsyncClient, ids: list[str]) -> Dict[str, Any]:
        if not ids:
            return {}
        response = await client.get(_WIKIDATA_API, params={
            "action": "wbgetentities",
            "ids": "|".join(ids),
            "props": "labels|aliases|claims",
            "languages": "ru|en",
            "format": "json",
        })
        response.raise_for_status()
        payload = response.json()
        entities = payload.get("entities") if isinstance(payload, dict) else {}
        return entities if isinstance(entities, dict) else {}

    async def _lookup_wikidata(self, client: httpx.AsyncClient, query: str) -> tuple[list[Dict[str, Any]], bool]:
        languages = ["ru", "en"] if _CYRILLIC_RE.search(query) else ["en", "ru"]

        async def search_language(language: str) -> list[str]:
            response = await client.get(_WIKIDATA_API, params={
                "action": "wbsearchentities",
                "search": query,
                "language": language,
                "uselang": language,
                "type": "item",
                "limit": 6,
                "format": "json",
            })
            response.raise_for_status()
            payload = response.json()
            return [str(row.get("id")) for row in payload.get("search", []) if isinstance(row, dict) and str(row.get("id") or "").startswith("Q")]

        search_results = await asyncio.gather(*(search_language(language) for language in languages), return_exceptions=True)
        ids: list[str] = []
        successful_search = False
        for result in search_results:
            if isinstance(result, Exception):
                continue
            successful_search = True
            for qid in result:
                if qid not in ids:
                    ids.append(qid)
        ids = ids[:8]
        if not successful_search:
            return [], False
        if not ids:
            return [], True

        entities = await self._wikidata_entities(client, ids)
        ingredient_ids: list[str] = []
        for qid in ids:
            entity = entities.get(qid)
            if not isinstance(entity, dict):
                continue
            for ingredient_id in _wikidata_ingredient_ids(entity):
                if ingredient_id not in ingredient_ids:
                    ingredient_ids.append(ingredient_id)
        ingredients = await self._wikidata_entities(client, ingredient_ids[:24])

        prefer_ru = bool(_CYRILLIC_RE.search(query))
        items: list[Dict[str, Any]] = []
        for qid in ids:
            entity = entities.get(qid)
            if not isinstance(entity, dict):
                continue
            product_ingredient_ids = _wikidata_ingredient_ids(entity)
            if not product_ingredient_ids:
                continue
            product_aliases = _wikidata_aliases(entity)
            searchable = [_norm(value) for value in product_aliases]
            q = _norm(query)
            if not any(q == value or q in value or value in q for value in searchable if value):
                continue
            trade = _wikidata_label(entity, "ru" if prefer_ru else "en") or _wikidata_label(entity, "en") or _wikidata_label(entity, "ru")
            active_names: list[str] = []
            active_aliases: list[str] = []
            resolved_ids: list[str] = []
            for ingredient_id in product_ingredient_ids:
                ingredient = ingredients.get(ingredient_id)
                if not isinstance(ingredient, dict):
                    continue
                active = _wikidata_label(ingredient, "ru" if prefer_ru else "en") or _wikidata_label(ingredient, "en") or _wikidata_label(ingredient, "ru")
                if active:
                    active_names.append(active)
                active_aliases.extend(_wikidata_aliases(ingredient))
                resolved_ids.append(ingredient_id)
            if not trade or not active_names:
                continue
            items.append({
                "trade_name": trade,
                "active_ingredient": " + ".join(_string_list(active_names)),
                "active_substance_id": "wikidata:" + "+".join(resolved_ids),
                "aliases": [*product_aliases, *active_aliases],
                "verification_status": "probable",
                "confidence": 0.74,
                "source_names": ["Wikidata"],
                "source_urls": [f"https://www.wikidata.org/wiki/{qid}"],
                "external_ids": {
                    "wikidata_product": qid,
                    "wikidata_ingredients": resolved_ids,
                },
            })
        return _merge_candidates(items), True

    async def _lookup_external(self, query: str) -> tuple[list[Dict[str, Any]], list[str], bool]:
        timeout = httpx.Timeout(self.timeout_seconds)
        headers = {
            "Accept": "application/json",
            "User-Agent": "Aida/2.0 medication-reference (+https://aidaassistent.ru)",
        }
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            results = await asyncio.gather(
                self._lookup_rxnorm(client, query),
                self._lookup_pubchem(client, query),
                self._lookup_wikidata(client, query),
                return_exceptions=True,
            )
        items: list[Dict[str, Any]] = []
        sources: list[str] = []
        any_source_available = False
        for source_name, result in zip(("RxNorm", "PubChem", "Wikidata"), results):
            if isinstance(result, Exception):
                continue
            source_items, available = result
            any_source_available = any_source_available or available
            if available:
                sources.append(source_name)
            items.extend(source_items)
        merged = _merge_candidates(items)
        merged.sort(key=lambda item: _score(item, query))
        return merged, sources, any_source_available

    async def search(self, query: str, limit: int = 12) -> Dict[str, Any]:
        query = " ".join(str(query or "").strip().split())
        safe_limit = max(1, min(int(limit), 20))
        if len(query) < _MIN_QUERY_LENGTH:
            return {
                "items": [],
                "provider": _PROVIDER,
                "provider_ready": True,
                "provider_available": True,
                "minimum_query_length": _MIN_QUERY_LENGTH,
                "cache_hit": False,
                "internet_lookup_performed": False,
                "sources_checked": [],
            }

        await self._load_cache()
        cached_before = self._cache_matches(query, safe_limit)
        qkey = _norm(query)
        last_lookup = self._external_query_times.get(qkey)
        lookup_recent = last_lookup is not None and time.monotonic() - last_lookup < _EXTERNAL_QUERY_TTL_SECONDS
        should_lookup = len(cached_before) < min(safe_limit, 5) and not lookup_recent

        sources_checked: list[str] = []
        source_available = False
        if should_lookup:
            self._external_query_times[qkey] = time.monotonic()
            external, sources_checked, source_available = await self._lookup_external(query)
            if external:
                await self._persist(external[:8])

        items = self._cache_matches(query, safe_limit)
        return {
            "items": items,
            "provider": _PROVIDER,
            "provider_ready": True,
            "provider_available": bool(items) or source_available or bool(cached_before),
            "minimum_query_length": _MIN_QUERY_LENGTH,
            "cache_hit": bool(cached_before),
            "internet_lookup_performed": should_lookup,
            "sources_checked": sources_checked,
        }

    async def resolve_reference(self, reference_source: str, reference_id: str) -> Optional[Dict[str, Any]]:
        if reference_source != _PROVIDER:
            return None
        reference_id = str(reference_id or "").strip()
        if not reference_id.startswith("medref_"):
            return None
        await self._load_cache()
        item = self._cache.get(reference_id)
        if item:
            return dict(item)
        if self.db is None:
            return None
        try:
            row = await self.db.medication_catalog.find_one({"id": reference_id})
        except Exception:
            return None
        item = _finalize_candidate(row or {})
        if item:
            self._cache[item["id"]] = item
        return item

    async def resolve_exact_trade_name(self, name: str) -> Optional[Dict[str, Any]]:
        name = " ".join(str(name or "").strip().split())
        if len(name) < _MIN_QUERY_LENGTH:
            return None
        target = _norm(name)
        await self._load_cache()
        for item in self._cache.values():
            if _norm(item.get("trade_name")) == target or target in {_norm(alias) for alias in _string_list(item.get("aliases"))}:
                return dict(item)
        result = await self.search(name, 8)
        for item in result.get("items", []):
            if _norm(item.get("trade_name")) == target or target in {_norm(alias) for alias in _string_list(item.get("aliases"))}:
                return dict(item)
        return None


_services: dict[int, MedicationReferenceService] = {}


def medication_reference_service(db: Any = None) -> MedicationReferenceService:
    if db is None:
        # main.py constructs the medication router with the real GoogleSheetsDB.
        # Reference routes are declared earlier, so resolve their service lazily
        # at request time and reuse that already-created Sheets-backed instance.
        for key, service in reversed(list(_services.items())):
            if key != 0:
                return service
    key = id(db) if db is not None else 0
    service = _services.get(key)
    if service is None:
        service = MedicationReferenceService(db)
        _services[key] = service
    return service


def build_medication_reference_router(db: Any = None) -> APIRouter:
    router = APIRouter(prefix="/api/reference/medications", tags=["reference"])

    @router.get("/search")
    async def search_medications(
        q: str = Query(..., min_length=_MIN_QUERY_LENGTH, max_length=120),
        limit: int = Query(12, ge=1, le=20),
    ) -> Dict[str, Any]:
        return await medication_reference_service(db).search(q, limit)

    return router
