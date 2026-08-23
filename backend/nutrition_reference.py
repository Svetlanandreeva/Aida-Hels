"""Open nutrition reference providers for Aida.

USDA FoodData Central is public-domain CC0. Open Food Facts is open data under
ODbL/Database Contents License. These sources may provide the persistent
nutrition values used by Aida. FatSecret is intentionally not part of this
module: its standard API terms restrict using its Content for nutrition/health
advice, so it must not influence Aida's medical/nutrition analysis without a
separate written agreement.
"""
from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException

_USDA_BASE = "https://api.nal.usda.gov/fdc/v1"
_OFF_SEARCH = "https://world.openfoodfacts.org/cgi/search.pl"
_OFF_PRODUCT = "https://world.openfoodfacts.org/api/v2/product"
_USER_AGENT = "Aida/2.0 (https://aidaassistent.ru)"

_NUTRIENT_KEYS = (
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "sugar_g",
    "saturated_fat_g",
    "sodium_mg",
    "potassium_mg",
)

_USDA_IDS = {
    1008: "calories",
    1003: "protein_g",
    1005: "carbs_g",
    1004: "fat_g",
    1079: "fiber_g",
    2000: "sugar_g",
    1258: "saturated_fat_g",
    1093: "sodium_mg",
    1092: "potassium_mg",
}


def _as_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return round(float(value), 3)
    except (TypeError, ValueError):
        return None


def _clean_nutrients(values: Dict[str, Any]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for key in _NUTRIENT_KEYS:
        number = _as_float(values.get(key))
        if number is not None and number >= 0:
            out[key] = number
    return out


def _normalized_name(value: Any) -> str:
    text = re.sub(r"[^a-zа-я0-9]+", " ", str(value or "").lower(), flags=re.IGNORECASE)
    return " ".join(text.split())


def _token_overlap(left: str, right: str) -> float:
    a = set(_normalized_name(left).split())
    b = set(_normalized_name(right).split())
    if not a or not b:
        return 0.0
    return len(a & b) / max(1, min(len(a), len(b)))


def usda_configured() -> bool:
    return bool(os.environ.get("USDA_FDC_API_KEY", "").strip())


def provider_status() -> Dict[str, bool]:
    return {
        "usda_configured": usda_configured(),
        "openfoodfacts_configured": True,
    }


def _usda_nutrients(row: Dict[str, Any]) -> Dict[str, float]:
    values: Dict[str, Any] = {}
    for item in row.get("foodNutrients") or []:
        if not isinstance(item, dict):
            continue
        nutrient = item.get("nutrient") if isinstance(item.get("nutrient"), dict) else {}
        nutrient_id = item.get("nutrientId") or nutrient.get("id")
        try:
            nutrient_id = int(nutrient_id)
        except (TypeError, ValueError):
            nutrient_id = None
        key = _USDA_IDS.get(nutrient_id) if nutrient_id is not None else None
        name = str(item.get("nutrientName") or nutrient.get("name") or "").lower()
        unit = str(item.get("unitName") or nutrient.get("unitName") or "").lower()
        if not key:
            if "energy" in name:
                key = "calories"
            elif name == "protein":
                key = "protein_g"
            elif "carbohydrate" in name and "fiber" not in name:
                key = "carbs_g"
            elif "total lipid" in name or name == "total fat":
                key = "fat_g"
            elif "fiber" in name:
                key = "fiber_g"
            elif "sugars" in name:
                key = "sugar_g"
            elif "saturated" in name and "fat" in name:
                key = "saturated_fat_g"
            elif name == "sodium, na" or name == "sodium":
                key = "sodium_mg"
            elif name == "potassium, k" or name == "potassium":
                key = "potassium_mg"
        if not key:
            continue
        value = _as_float(item.get("value") if "value" in item else item.get("amount"))
        if value is None:
            continue
        if key == "calories" and unit == "kj":
            value = round(value / 4.184, 3)
        elif key in {"sodium_mg", "potassium_mg"} and unit == "g":
            value = round(value * 1000.0, 3)
        values[key] = value
    return _clean_nutrients(values)


def _usda_item(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    food_id = str(row.get("fdcId") or "").strip()
    name = str(row.get("description") or "").strip()
    nutrients = _usda_nutrients(row)
    if not food_id or not name or not nutrients:
        return None
    return {
        "reference_source": "usda",
        "reference_id": food_id,
        "name": name,
        "brand": str(row.get("brandOwner") or row.get("brandName") or "").strip() or None,
        "description": str(row.get("additionalDescriptions") or "").strip() or None,
        "serving_description": "100 г",
        "basis": "per_100g",
        "nutrients": nutrients,
        "license": "CC0-1.0",
    }


async def search_usda(query: str, *, limit: int = 8) -> List[Dict[str, Any]]:
    if not usda_configured():
        return []
    key = os.environ["USDA_FDC_API_KEY"].strip()
    payload = {
        "query": query,
        "pageSize": max(1, min(12, limit)),
        "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)"],
    }
    async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": _USER_AGENT}) as client:
        response = await client.post(f"{_USDA_BASE}/foods/search", params={"api_key": key}, json=payload)
    if response.status_code >= 400:
        return []
    data = response.json()
    out = []
    for row in (data.get("foods") or [])[:limit]:
        if isinstance(row, dict):
            item = _usda_item(row)
            if item:
                out.append(item)
    return out


async def resolve_usda(reference_id: str) -> Dict[str, Any]:
    if not usda_configured():
        raise HTTPException(503, "USDA FoodData Central is not configured")
    key = os.environ["USDA_FDC_API_KEY"].strip()
    async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": _USER_AGENT}) as client:
        response = await client.get(f"{_USDA_BASE}/food/{reference_id}", params={"api_key": key})
    if response.status_code == 404:
        raise HTTPException(404, "USDA food not found")
    if response.status_code >= 400:
        raise HTTPException(502, "USDA FoodData Central request failed")
    item = _usda_item(response.json())
    if not item:
        raise HTTPException(502, "USDA food has no usable nutrient data")
    return item


def _off_nutrients(product: Dict[str, Any]) -> Dict[str, float]:
    n = product.get("nutriments") if isinstance(product.get("nutriments"), dict) else {}
    kcal = _as_float(n.get("energy-kcal_100g"))
    if kcal is None:
        kj = _as_float(n.get("energy_100g"))
        kcal = round(kj / 4.184, 3) if kj is not None else None
    sodium_g = _as_float(n.get("sodium_100g"))
    potassium_g = _as_float(n.get("potassium_100g"))
    return _clean_nutrients({
        "calories": kcal,
        "protein_g": n.get("proteins_100g"),
        "carbs_g": n.get("carbohydrates_100g"),
        "fat_g": n.get("fat_100g"),
        "fiber_g": n.get("fiber_100g"),
        "sugar_g": n.get("sugars_100g"),
        "saturated_fat_g": n.get("saturated-fat_100g"),
        "sodium_mg": sodium_g * 1000.0 if sodium_g is not None else None,
        "potassium_mg": potassium_g * 1000.0 if potassium_g is not None else None,
    })


def _off_item(product: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    code = str(product.get("code") or "").strip()
    name = str(product.get("product_name") or product.get("product_name_en") or "").strip()
    nutrients = _off_nutrients(product)
    if not code or not name or not nutrients:
        return None
    return {
        "reference_source": "openfoodfacts",
        "reference_id": code,
        "name": name,
        "brand": str(product.get("brands") or "").strip() or None,
        "description": str(product.get("generic_name") or "").strip() or None,
        "serving_description": "100 г",
        "basis": "per_100g",
        "nutrients": nutrients,
        "license": "ODbL-1.0",
    }


async def search_openfoodfacts(query: str, *, limit: int = 8) -> List[Dict[str, Any]]:
    params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": max(1, min(12, limit)),
        "fields": "code,product_name,product_name_en,brands,generic_name,nutriments",
    }
    async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": _USER_AGENT}) as client:
        response = await client.get(_OFF_SEARCH, params=params)
    if response.status_code >= 400:
        return []
    data = response.json()
    out = []
    for product in (data.get("products") or [])[:limit]:
        if isinstance(product, dict):
            item = _off_item(product)
            if item:
                out.append(item)
    return out


async def resolve_openfoodfacts(reference_id: str) -> Dict[str, Any]:
    fields = "code,product_name,product_name_en,brands,generic_name,nutriments"
    async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": _USER_AGENT}) as client:
        response = await client.get(f"{_OFF_PRODUCT}/{reference_id}.json", params={"fields": fields})
    if response.status_code == 404:
        raise HTTPException(404, "Open Food Facts product not found")
    if response.status_code >= 400:
        raise HTTPException(502, "Open Food Facts request failed")
    data = response.json()
    product = data.get("product") if isinstance(data.get("product"), dict) else {}
    item = _off_item(product)
    if not item:
        raise HTTPException(502, "Open Food Facts product has no usable nutrient data")
    return item


async def search_food_references(query: str, *, limit: int = 12) -> List[Dict[str, Any]]:
    query = str(query or "").strip()
    if len(query) < 2:
        return []
    usda, off = await _gather_search(query)
    combined = [*usda, *off]
    seen = set()
    out = []
    for item in combined:
        key = (_normalized_name(item.get("name")), _normalized_name(item.get("brand")))
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= limit:
            break
    return out


async def _gather_search(query: str) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    # Keep provider failures independent so the diary remains usable if one open
    # source is temporarily unavailable.
    usda: List[Dict[str, Any]] = []
    off: List[Dict[str, Any]] = []
    try:
        usda = await search_usda(query, limit=6)
    except Exception:
        usda = []
    try:
        off = await search_openfoodfacts(query, limit=8)
    except Exception:
        off = []
    return usda, off


async def resolve_reference(source: str, reference_id: str) -> Dict[str, Any]:
    source = str(source or "").strip().lower()
    reference_id = str(reference_id or "").strip()
    if not reference_id:
        raise HTTPException(400, "Nutrition reference id is required")
    if source == "usda":
        return await resolve_usda(reference_id)
    if source == "openfoodfacts":
        return await resolve_openfoodfacts(reference_id)
    raise HTTPException(400, "Unsupported nutrition reference source")


def _comparison(primary: Dict[str, Any], secondary: Dict[str, Any]) -> Dict[str, Any]:
    left = primary.get("nutrients") or {}
    right = secondary.get("nutrients") or {}
    diffs = []
    for key in ("calories", "protein_g", "carbs_g", "fat_g"):
        a = _as_float(left.get(key))
        b = _as_float(right.get(key))
        if a is None or b is None:
            continue
        denom = max(abs(a), abs(b), 1.0)
        diffs.append(abs(a - b) / denom)
    overlap = _token_overlap(str(primary.get("name") or ""), str(secondary.get("name") or ""))
    if len(diffs) < 3 or overlap < 0.5:
        status = "insufficient"
    elif max(diffs) <= 0.20:
        status = "matched"
    elif sum(diffs) / len(diffs) <= 0.30:
        status = "close"
    else:
        status = "mismatch"
    return {
        "status": status,
        "metrics_compared": len(diffs),
        "name_overlap": round(overlap, 3),
        "max_relative_difference": round(max(diffs), 3) if diffs else None,
    }


async def cross_check_reference(primary: Dict[str, Any]) -> Dict[str, Any]:
    """Compare an open source against the other open source when possible.

    Only the comparison result is intended for persistence. The secondary
    provider's product name/nutrients do not need to be stored in the diary.
    """
    query = str(primary.get("name") or "").strip()
    source = str(primary.get("reference_source") or "").strip().lower()
    if len(query) < 2:
        return {"status": "unavailable", "metrics_compared": 0}
    try:
        candidates = await (search_openfoodfacts(query, limit=5) if source == "usda" else search_usda(query, limit=5))
    except Exception:
        candidates = []
    if not candidates:
        return {"status": "unavailable", "metrics_compared": 0}
    candidates = sorted(candidates, key=lambda item: _token_overlap(query, str(item.get("name") or "")), reverse=True)
    return _comparison(primary, candidates[0])
