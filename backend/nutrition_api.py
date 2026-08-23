"""Nutrition diary, FatSecret lookup and evidence-aware nutrition summaries.

FatSecret is used as an optional food reference provider. Per FatSecret's
storable-data rules, only provider identifiers are persisted indefinitely;
provider-returned labels/nutrients are kept in a short-lived snapshot and are
refreshed when needed. User-confirmed diary labels and manual nutrient values
are Aida user data and may be stored normally.
"""
from __future__ import annotations

import os
import re
import statistics
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from access_control import require_profile_access, require_record_access


_ALLOWED_MEALS = {"breakfast", "lunch", "dinner", "snack", "other"}
_ALLOWED_SOURCES = {"manual", "fatsecret"}
_PROVIDER_CACHE_HOURS = 20  # below FatSecret's 24-hour maximum cache window
_TOKEN_SKEW_SECONDS = 120
_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_TOKEN_CACHE: Dict[str, Any] = {"token": None, "expires_at": None}

# Conservative, evidence-backed food/medicine checks. They only run when Aida
# has a normalized active ingredient; a brand name alone is never sufficient.
_GRAPEFRUIT_MEDICATIONS = {
    "simvastatin", "atorvastatin", "nifedipine", "cyclosporine", "buspirone",
    "budesonide", "amiodarone", "fexofenadine",
}
_GRAPEFRUIT_WORDS = (
    "grapefruit", "grapefruit juice", "грейпфрут", "грейпфрутов", "pomelo", "помело",
    "seville orange", "севильск",
)
_WARFARIN_WORDS = (
    "kale", "spinach", "broccoli", "brussels sprouts", "cabbage", "parsley",
    "кейл", "шпинат", "брокколи", "брюссельск", "капуста", "петрушка",
)
_FEXOFENADINE_JUICE_WORDS = (
    "apple juice", "orange juice", "grapefruit juice", "яблочн", "апельсинов", "грейпфрутов",
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return round(float(value), 3)
    except (TypeError, ValueError):
        return None


def _parse_dt(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value or "").strip()
        if not text:
            return None
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _fatsecret_configured() -> bool:
    return bool(os.environ.get("FATSECRET_CLIENT_ID", "").strip() and os.environ.get("FATSECRET_CLIENT_SECRET", "").strip())


async def _fatsecret_token() -> str:
    if not _fatsecret_configured():
        raise HTTPException(503, "FatSecret is not configured")
    cached = str(_TOKEN_CACHE.get("token") or "")
    expires_at = _TOKEN_CACHE.get("expires_at")
    if cached and isinstance(expires_at, datetime) and expires_at > _now() + timedelta(seconds=_TOKEN_SKEW_SECONDS):
        return cached

    client_id = os.environ["FATSECRET_CLIENT_ID"].strip()
    client_secret = os.environ["FATSECRET_CLIENT_SECRET"].strip()
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.post(
            "https://oauth.fatsecret.com/connect/token",
            data={"grant_type": "client_credentials", "scope": "basic"},
            auth=(client_id, client_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if response.status_code >= 400:
        raise HTTPException(502, "FatSecret authentication failed")
    payload = response.json()
    token = str(payload.get("access_token") or "").strip()
    if not token:
        raise HTTPException(502, "FatSecret returned no access token")
    expires_in = max(300, int(payload.get("expires_in") or 3600))
    _TOKEN_CACHE.update({"token": token, "expires_at": _now() + timedelta(seconds=expires_in)})
    return token


async def _fatsecret_get(path: str, params: Dict[str, Any]) -> Dict[str, Any]:
    token = await _fatsecret_token()
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
            f"https://platform.fatsecret.com/rest/{path}",
            params={**params, "format": "json"},
            headers={"Authorization": f"Bearer {token}"},
        )
    if response.status_code >= 400:
        raise HTTPException(502, "FatSecret request failed")
    data = response.json()
    return data if isinstance(data, dict) else {}


async def _search_fatsecret(query: str) -> List[Dict[str, Any]]:
    data = await _fatsecret_get(
        "foods/search/v1",
        {"search_expression": query, "max_results": 12, "page_number": 0},
    )
    foods = ((data.get("foods") or {}).get("food") if isinstance(data.get("foods"), dict) else None) or []
    if isinstance(foods, dict):
        foods = [foods]
    results: List[Dict[str, Any]] = []
    for row in foods[:12]:
        if not isinstance(row, dict) or not row.get("food_id"):
            continue
        results.append({
            "food_id": str(row.get("food_id")),
            "name": str(row.get("food_name") or "").strip(),
            "brand": str(row.get("brand_name") or "").strip() or None,
            "description": str(row.get("food_description") or "").strip() or None,
            "provider": "fatsecret",
        })
    return results


def _servings_from_food(data: Dict[str, Any]) -> tuple[Dict[str, Any], List[Dict[str, Any]]]:
    food = data.get("food") if isinstance(data.get("food"), dict) else data
    if not isinstance(food, dict):
        return {}, []
    servings = ((food.get("servings") or {}).get("serving") if isinstance(food.get("servings"), dict) else None) or []
    if isinstance(servings, dict):
        servings = [servings]
    return food, [row for row in servings if isinstance(row, dict)]


async def _fatsecret_snapshot(food_id: str, serving_id: Optional[str] = None) -> Dict[str, Any]:
    data = await _fatsecret_get("food/v4", {"food_id": food_id})
    food, servings = _servings_from_food(data)
    if not food:
        raise HTTPException(404, "FatSecret food not found")
    selected = None
    if serving_id:
        selected = next((row for row in servings if str(row.get("serving_id")) == str(serving_id)), None)
    if selected is None:
        selected = next((row for row in servings if str(row.get("is_default") or row.get("default_serving") or "").lower() == "true"), None)
    if selected is None and servings:
        selected = servings[0]
    if selected is None:
        raise HTTPException(502, "FatSecret food has no serving information")

    nutrients = {
        "calories": _as_float(selected.get("calories")),
        "protein_g": _as_float(selected.get("protein")),
        "carbs_g": _as_float(selected.get("carbohydrate")),
        "fat_g": _as_float(selected.get("fat")),
        "fiber_g": _as_float(selected.get("fiber")),
        "sugar_g": _as_float(selected.get("sugar")),
        "saturated_fat_g": _as_float(selected.get("saturated_fat")),
        "sodium_mg": _as_float(selected.get("sodium")),
        "potassium_mg": _as_float(selected.get("potassium")),
    }
    nutrients = {key: value for key, value in nutrients.items() if value is not None}
    fetched_at = _now()
    return {
        "food_name": str(food.get("food_name") or "").strip(),
        "brand_name": str(food.get("brand_name") or "").strip() or None,
        "serving_id": str(selected.get("serving_id") or "").strip() or None,
        "serving_description": str(selected.get("serving_description") or "").strip() or None,
        "nutrients": nutrients,
        "fetched_at": fetched_at,
        "expires_at": fetched_at + timedelta(hours=_PROVIDER_CACHE_HOURS),
    }


def _snapshot_valid(entry: Dict[str, Any]) -> bool:
    if entry.get("source") != "fatsecret":
        return True
    snapshot = entry.get("provider_snapshot") or {}
    expires = _parse_dt(snapshot.get("expires_at")) if isinstance(snapshot, dict) else None
    return bool(expires and expires > _now())


def _entry_nutrients(entry: Dict[str, Any]) -> Dict[str, float]:
    if entry.get("source") == "manual":
        raw = entry.get("manual_nutrients") or {}
    elif _snapshot_valid(entry):
        raw = (entry.get("provider_snapshot") or {}).get("nutrients") or {}
    else:
        raw = {}
    quantity = _as_float(entry.get("quantity")) or 1.0
    out: Dict[str, float] = {}
    for key, value in raw.items():
        number = _as_float(value)
        if number is not None:
            out[key] = round(number * quantity, 2)
    return out


async def _hydrate_entry(db, entry: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
    hydrated = dict(entry)
    if hydrated.get("source") != "fatsecret" or _snapshot_valid(hydrated):
        hydrated["nutrients"] = _entry_nutrients(hydrated)
        return hydrated
    food_id = str(hydrated.get("external_food_id") or "").strip()
    if not food_id or not _fatsecret_configured():
        hydrated["nutrients"] = {}
        return hydrated
    try:
        snapshot = await _fatsecret_snapshot(food_id, str(hydrated.get("external_serving_id") or "") or None)
    except HTTPException:
        hydrated["nutrients"] = {}
        return hydrated
    hydrated["provider_snapshot"] = snapshot
    hydrated["external_serving_id"] = snapshot.get("serving_id") or hydrated.get("external_serving_id")
    hydrated["nutrients"] = _entry_nutrients(hydrated)
    if persist:
        await db.nutrition_entries.update_one(
            {"id": hydrated.get("id")},
            {"$set": {
                "provider_snapshot": snapshot,
                "external_serving_id": hydrated.get("external_serving_id"),
                "updated_at": _now(),
            }},
        )
    return hydrated


def _public_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    out = {key: value for key, value in entry.items() if key != "provider_snapshot"}
    snapshot = entry.get("provider_snapshot") or {}
    if isinstance(snapshot, dict) and _snapshot_valid(entry):
        out["provider_name"] = snapshot.get("food_name")
        out["provider_brand"] = snapshot.get("brand_name")
        out["serving_description"] = snapshot.get("serving_description")
    out["nutrients"] = entry.get("nutrients") or _entry_nutrients(entry)
    return out


def _minutes_of_day(entry: Dict[str, Any]) -> Optional[int]:
    local_time = str(entry.get("local_time") or "").strip()
    if _TIME_RE.match(local_time):
        hour, minute = local_time.split(":", 1)
        return int(hour) * 60 + int(minute)
    dt = _parse_dt(entry.get("eaten_at"))
    if not dt:
        return None
    return dt.hour * 60 + dt.minute


def _entry_local_date(entry: Dict[str, Any]) -> Optional[str]:
    local_date = str(entry.get("local_date") or "").strip()
    if _DATE_RE.match(local_date):
        try:
            return date.fromisoformat(local_date).isoformat()
        except ValueError:
            pass
    dt = _parse_dt(entry.get("eaten_at"))
    return dt.date().isoformat() if dt else None


def _med_time_minutes(value: str) -> Optional[int]:
    try:
        hour, minute = str(value).split(":", 1)
        h, m = int(hour), int(minute)
        if 0 <= h <= 23 and 0 <= m <= 59:
            return h * 60 + m
    except (ValueError, TypeError):
        pass
    return None


def _normalized_ingredient(med: Dict[str, Any]) -> str:
    status = str(med.get("reference_verification_status") or "").lower()
    if status not in {"verified", "probable"}:
        return ""
    return str(med.get("active_ingredient") or "").strip().lower()


def _food_medication_flags(entries: List[Dict[str, Any]], medications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    flags: List[Dict[str, Any]] = []
    seen = set()
    for med in medications:
        ingredient = _normalized_ingredient(med)
        if not ingredient:
            continue
        med_name = med.get("trade_name") or med.get("name") or ingredient
        med_times = [_med_time_minutes(value) for value in (med.get("times") or [])]
        med_times = [value for value in med_times if value is not None]
        for entry in entries:
            label = str(entry.get("label") or entry.get("provider_name") or "").lower()
            if not label:
                continue
            key_base = (str(entry.get("id")), str(med.get("id")))

            if any(name in ingredient for name in _GRAPEFRUIT_MEDICATIONS) and any(word in label for word in _GRAPEFRUIT_WORDS):
                key = (*key_base, "grapefruit")
                if key not in seen:
                    seen.add(key)
                    flags.append({
                        "severity": "check",
                        "kind": "food_medication",
                        "food": entry.get("label"),
                        "medication": med_name,
                        "active_ingredient": med.get("active_ingredient"),
                        "message": "Грейпфрут может менять действие некоторых лекарств. Проверьте инструкцию именно к вашему препарату и уточните у врача или фармацевта.",
                        "action": "Не меняйте препарат самостоятельно; уточните, нужно ли исключить грейпфрут.",
                        "evidence_url": "https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix",
                    })

            if "fexofenadine" in ingredient and any(word in label for word in _FEXOFENADINE_JUICE_WORDS):
                key = (*key_base, "fruit_juice")
                if key not in seen:
                    seen.add(key)
                    flags.append({
                        "severity": "check",
                        "kind": "food_medication",
                        "food": entry.get("label"),
                        "medication": med_name,
                        "active_ingredient": med.get("active_ingredient"),
                        "message": "Некоторые фруктовые соки могут снижать всасывание фексофенадина.",
                        "action": "Сверьте способ приёма с инструкцией к препарату или фармацевтом.",
                        "evidence_url": "https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix",
                    })

            if "warfarin" in ingredient or "варфарин" in ingredient:
                if any(word in label for word in _WARFARIN_WORDS):
                    key = (*key_base, "vitamin_k")
                    if key not in seen:
                        seen.add(key)
                        flags.append({
                            "severity": "info",
                            "kind": "food_medication",
                            "food": entry.get("label"),
                            "medication": med_name,
                            "active_ingredient": med.get("active_ingredient"),
                            "message": "При варфарине важнее стабильное потребление продуктов с витамином K, а не их резкая отмена.",
                            "action": "Не делайте больших изменений в рационе без согласования с врачом, который контролирует INR.",
                            "evidence_url": "https://medlineplus.gov/druginfo/meds/a682277.html",
                        })

            if "levothyroxine" in ingredient or "левотироксин" in ingredient:
                meal_minute = _minutes_of_day(entry)
                if meal_minute is not None:
                    close = any(0 <= meal_minute - med_minute < 60 for med_minute in med_times)
                    if close:
                        key = (*key_base, "levothyroxine_meal")
                        if key not in seen:
                            seen.add(key)
                            flags.append({
                                "severity": "check",
                                "kind": "timing",
                                "food": entry.get("label"),
                                "medication": med_name,
                                "active_ingredient": med.get("active_ingredient"),
                                "message": "Еда отмечена менее чем через час после левотироксина; пища может влиять на его всасывание.",
                                "action": "Сверьте назначенный интервал с инструкцией врача; не меняйте дозу самостоятельно.",
                                "evidence_url": "https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=83854522-f22e-491f-8392-c8b1f9441760",
                            })
    return flags[:20]


def _daily_totals(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    days: Dict[str, Dict[str, Any]] = {}
    nutrient_keys = ("calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "saturated_fat_g", "sodium_mg", "potassium_mg")
    for entry in entries:
        day = _entry_local_date(entry)
        if not day:
            continue
        bucket = days.setdefault(day, {"date": day, "entries": 0, "entries_with_nutrients": 0, **{key: 0.0 for key in nutrient_keys}})
        bucket["entries"] += 1
        nutrients = entry.get("nutrients") or _entry_nutrients(entry)
        if nutrients:
            bucket["entries_with_nutrients"] += 1
        for key in nutrient_keys:
            value = _as_float(nutrients.get(key)) if isinstance(nutrients, dict) else None
            if value is not None:
                bucket[key] = round(float(bucket[key]) + value, 2)
    return sorted(days.values(), key=lambda row: row["date"], reverse=True)


def _pattern_insights(entries: List[Dict[str, Any]], daily: List[Dict[str, Any]], checkins: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    insights: List[Dict[str, Any]] = []
    complete_days = [day for day in daily if day.get("entries_with_nutrients", 0) >= 2]
    if len(complete_days) >= 3:
        fiber = statistics.mean(float(day.get("fiber_g") or 0) for day in complete_days)
        if fiber < 18:
            insights.append({
                "kind": "fiber_pattern",
                "level": "attention",
                "title": "В дневнике мало клетчатки",
                "text": "По зарегистрированным продуктам среднее количество клетчатки выглядит низким. Аида может предложить более богатые клетчаткой замены, учитывая диагнозы и лекарства.",
            })
        sat_share = []
        for day in complete_days:
            calories = float(day.get("calories") or 0)
            saturated = float(day.get("saturated_fat_g") or 0)
            if calories > 0:
                sat_share.append((saturated * 9) / calories)
        if sat_share and statistics.mean(sat_share) > 0.10:
            insights.append({
                "kind": "saturated_fat_pattern",
                "level": "attention",
                "title": "Высокая доля насыщенных жиров",
                "text": "В зарегистрированном рационе заметна высокая доля энергии из насыщенных жиров. Это наблюдение по дневнику, а не диагноз.",
            })

    # Long daytime gaps can be relevant to subjective energy. This is deliberately
    # a pattern detector, not a claim of causality.
    by_day: Dict[str, List[int]] = {}
    for entry in entries:
        local_day = _entry_local_date(entry)
        minute = _minutes_of_day(entry)
        if local_day and minute is not None:
            by_day.setdefault(local_day, []).append(minute)
    long_gap_days = 0
    for minutes in by_day.values():
        points = sorted(value for value in minutes if 6 * 60 <= value <= 23 * 60)
        if any(b - a >= 6 * 60 for a, b in zip(points, points[1:])):
            long_gap_days += 1
    if long_gap_days >= 2:
        insights.append({
            "kind": "meal_gap_pattern",
            "level": "info",
            "title": "Есть длинные интервалы между приёмами пищи",
            "text": "В нескольких днях дневника интервал между приёмами пищи был 6 часов или больше. Если провалы энергии возникают в те же часы, это стоит проверить как возможную связь.",
        })

    energy_by_date = {str(row.get("date") or "")[:10]: row.get("energy") for row in checkins if row.get("date")}
    dip_days = [day for day in daily if energy_by_date.get(day["date"]) is not None and float(energy_by_date[day["date"]]) <= 2]
    steady_days = [day for day in daily if energy_by_date.get(day["date"]) is not None and float(energy_by_date[day["date"]]) >= 4]
    if len(dip_days) >= 2 and steady_days:
        dip_cal = statistics.mean(float(day.get("calories") or 0) for day in dip_days)
        steady_cal = statistics.mean(float(day.get("calories") or 0) for day in steady_days)
        if dip_cal > 0 and steady_cal > 0 and dip_cal < steady_cal * 0.8:
            insights.append({
                "kind": "energy_association",
                "level": "info",
                "title": "Провалы энергии совпадают с более низким зарегистрированным рационом",
                "text": "В дни с низкой оценкой энергии в дневнике зарегистрировано заметно меньше энергии из пищи, чем в ваши более энергичные дни. Это корреляция и не доказывает причину.",
            })
    return insights[:8]


async def build_nutrition_context(db, profile_id: str, *, limit: int = 80) -> Dict[str, Any]:
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile or (profile.get("module_settings") or {}).get("nutrition") is not True:
        return {"enabled": False, "entries": [], "daily": [], "insights": [], "food_medication_flags": []}

    rows = await db.nutrition_entries.find({"profile_id": profile_id}, {"_id": 0}).sort("eaten_at", -1).to_list(limit)
    hydrated: List[Dict[str, Any]] = []
    for row in rows:
        hydrated.append(await _hydrate_entry(db, row))
    checkins = await db.checkins.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(30)
    medications = await db.medications.find({"profile_id": profile_id, "active": True}, {"_id": 0}).to_list(100)
    daily = _daily_totals(hydrated)
    return {
        "enabled": True,
        "provider": {"fatsecret_configured": _fatsecret_configured()},
        "entries": [
            {
                "id": row.get("id"),
                "label": row.get("label"),
                "meal_type": row.get("meal_type"),
                "eaten_at": row.get("eaten_at"),
                "local_date": row.get("local_date"),
                "local_time": row.get("local_time"),
                "timezone_offset_min": row.get("timezone_offset_min"),
                "source": row.get("source"),
                "nutrients": row.get("nutrients") or {},
                "external_food_id": row.get("external_food_id"),
                "external_serving_id": row.get("external_serving_id"),
            }
            for row in hydrated[:40]
        ],
        "daily": daily[:14],
        "insights": _pattern_insights(hydrated, daily, checkins),
        "food_medication_flags": _food_medication_flags([_public_entry(row) for row in hydrated], medications),
    }


class NutritionEntryCreate(BaseModel):
    profile_id: str
    label: str
    meal_type: str = "other"
    eaten_at: datetime = Field(default_factory=_now)
    local_date: Optional[str] = None
    local_time: Optional[str] = None
    timezone_offset_min: Optional[int] = None
    source: str = "manual"
    quantity: float = 1.0
    external_food_id: Optional[str] = None
    external_serving_id: Optional[str] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    saturated_fat_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    potassium_mg: Optional[float] = None
    note: Optional[str] = None


def _validated_local_date(value: Optional[str], fallback: datetime) -> str:
    text = str(value or "").strip()
    if text:
        if not _DATE_RE.match(text):
            raise HTTPException(400, "local_date must be YYYY-MM-DD")
        try:
            return date.fromisoformat(text).isoformat()
        except ValueError as exc:
            raise HTTPException(400, "local_date is invalid") from exc
    return fallback.date().isoformat()


def _validated_local_time(value: Optional[str], fallback: datetime) -> str:
    text = str(value or "").strip()
    if text:
        if not _TIME_RE.match(text):
            raise HTTPException(400, "local_time must be HH:MM")
        return text
    return f"{fallback.hour:02d}:{fallback.minute:02d}"


def build_nutrition_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])

    @router.get("/status")
    async def status(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        return {
            "enabled": bool(((profile or {}).get("module_settings") or {}).get("nutrition") is True),
            "fatsecret_configured": _fatsecret_configured(),
            "fatsecret_mode": "food_reference",
        }

    @router.get("/foods/search")
    async def search_foods(
        profile_id: str,
        q: str = Query(min_length=2, max_length=120),
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, profile_id)
        if not _fatsecret_configured():
            return {"configured": False, "items": []}
        items = await _search_fatsecret(q.strip())
        return {"configured": True, "items": items}

    @router.get("/entries")
    async def list_entries(
        profile_id: str,
        limit: int = Query(default=100, ge=1, le=300),
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, profile_id)
        rows = await db.nutrition_entries.find({"profile_id": profile_id}, {"_id": 0}).sort("eaten_at", -1).to_list(limit)
        out = []
        for row in rows:
            out.append(_public_entry(await _hydrate_entry(db, row)))
        return out

    @router.post("/entries")
    async def create_entry(data: NutritionEntryCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        label = data.label.strip()
        if not label:
            raise HTTPException(400, "Food label is required")
        source = data.source.strip().lower()
        if source not in _ALLOWED_SOURCES:
            raise HTTPException(400, "Invalid nutrition source")
        meal = data.meal_type.strip().lower()
        if meal not in _ALLOWED_MEALS:
            raise HTTPException(400, "Invalid meal type")
        if data.quantity <= 0 or data.quantity > 100:
            raise HTTPException(400, "Quantity must be between 0 and 100")
        offset = None if data.timezone_offset_min is None else max(-840, min(840, int(data.timezone_offset_min)))

        payload: Dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "profile_id": data.profile_id,
            "label": label,  # user-confirmed diary label, not provider cache
            "meal_type": meal,
            "eaten_at": data.eaten_at,
            "local_date": _validated_local_date(data.local_date, data.eaten_at),
            "local_time": _validated_local_time(data.local_time, data.eaten_at),
            "timezone_offset_min": offset,
            "source": source,
            "quantity": float(data.quantity),
            "note": (data.note or "").strip() or None,
            "external_food_id": str(data.external_food_id or "").strip() or None,
            "external_serving_id": str(data.external_serving_id or "").strip() or None,
            "created_at": _now(),
            "updated_at": _now(),
            "verification_status": "verified" if source == "fatsecret" else "unverified",
        }
        if source == "fatsecret":
            if not payload["external_food_id"]:
                raise HTTPException(400, "FatSecret food_id is required")
            snapshot = await _fatsecret_snapshot(payload["external_food_id"], payload["external_serving_id"])
            payload["provider_snapshot"] = snapshot
            payload["external_serving_id"] = snapshot.get("serving_id") or payload["external_serving_id"]
        else:
            manual = {
                "calories": data.calories,
                "protein_g": data.protein_g,
                "carbs_g": data.carbs_g,
                "fat_g": data.fat_g,
                "fiber_g": data.fiber_g,
                "sugar_g": data.sugar_g,
                "saturated_fat_g": data.saturated_fat_g,
                "sodium_mg": data.sodium_mg,
                "potassium_mg": data.potassium_mg,
            }
            payload["manual_nutrients"] = {key: value for key, value in manual.items() if value is not None and value >= 0}

        await db.nutrition_entries.insert_one(payload)
        hydrated = await _hydrate_entry(db, payload, persist=False)
        return _public_entry(hydrated)

    @router.delete("/entries/{entry_id}")
    async def delete_entry(entry_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_record_access(db, auth, account, "nutrition_entries", entry_id, write=True)
        await db.nutrition_entries.delete_one({"id": entry_id})
        return {"ok": True}

    @router.get("/summary")
    async def summary(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        return await build_nutrition_context(db, profile_id)

    return router
