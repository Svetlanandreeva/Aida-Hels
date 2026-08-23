"""Nutrition diary with open food references and privacy-preserving history.

Aida persists nutrition data from open sources (USDA FoodData Central and Open
Food Facts) or user-entered values. Detailed food names are kept only for a
short recent window. After 20 hours, detailed rows are compacted into one
meal-level aggregate containing the meal type, local timing and nutrition
summary. This keeps long-term analysis useful without retaining an unnecessary
product-by-product history.
"""
from __future__ import annotations

import re
import statistics
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from access_control import require_profile_access, require_record_access
from nutrition_reference import cross_check_reference, provider_status, resolve_reference, search_food_references

_ALLOWED_MEALS = {"breakfast", "lunch", "dinner", "snack", "other"}
_ALLOWED_SOURCES = {"manual", "usda", "openfoodfacts"}
_COMPACTION_HOURS = 20
_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
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

# Conservative checks run only for normalized medication active ingredients.
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


def _entry_nutrients(entry: Dict[str, Any]) -> Dict[str, float]:
    if entry.get("source") == "aggregate" or entry.get("compacted") is True:
        raw = entry.get("nutrients") or {}
        quantity = 1.0
    else:
        raw = entry.get("stored_nutrients") or entry.get("manual_nutrients") or {}
        quantity = _as_float(entry.get("quantity")) or 1.0
    out: Dict[str, float] = {}
    for key in _NUTRIENT_KEYS:
        number = _as_float(raw.get(key)) if isinstance(raw, dict) else None
        if number is not None:
            out[key] = round(number * quantity, 2)
    return out


def _entry_local_date(entry: Dict[str, Any]) -> Optional[str]:
    local_date = str(entry.get("local_date") or "").strip()
    if _DATE_RE.match(local_date):
        try:
            return date.fromisoformat(local_date).isoformat()
        except ValueError:
            pass
    dt = _parse_dt(entry.get("eaten_at"))
    return dt.date().isoformat() if dt else None


def _minutes_of_day(entry: Dict[str, Any]) -> Optional[int]:
    local_time = str(entry.get("local_time") or "").strip()
    if _TIME_RE.match(local_time):
        hour, minute = local_time.split(":", 1)
        return int(hour) * 60 + int(minute)
    dt = _parse_dt(entry.get("eaten_at"))
    return dt.hour * 60 + dt.minute if dt else None


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


def _public_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    out = {
        "id": entry.get("id"),
        "profile_id": entry.get("profile_id"),
        "label": entry.get("label") if entry.get("source") != "aggregate" else None,
        "meal_type": entry.get("meal_type"),
        "eaten_at": entry.get("eaten_at"),
        "local_date": entry.get("local_date"),
        "local_time": entry.get("local_time"),
        "timezone_offset_min": entry.get("timezone_offset_min"),
        "source": entry.get("source"),
        "quantity": entry.get("quantity") or 1,
        "serving_description": entry.get("serving_description"),
        "nutrients": _entry_nutrients(entry),
        "verification_status": entry.get("verification_status") or "unverified",
        "compacted": bool(entry.get("compacted") or entry.get("source") == "aggregate"),
        "detail_count": int(entry.get("detail_count") or 1),
        "note": entry.get("note"),
    }
    if not out["compacted"]:
        out["reference_source"] = entry.get("reference_source")
        out["reference_id"] = entry.get("reference_id")
        out["cross_check"] = entry.get("cross_check") or None
    return out


def _sum_nutrients(entries: List[Dict[str, Any]]) -> Dict[str, float]:
    totals = {key: 0.0 for key in _NUTRIENT_KEYS}
    present = set()
    for entry in entries:
        for key, value in _entry_nutrients(entry).items():
            totals[key] = round(totals[key] + float(value), 2)
            present.add(key)
    return {key: totals[key] for key in _NUTRIENT_KEYS if key in present}


async def _compact_old_entries(db, profile_id: str) -> int:
    """Collapse detailed food rows older than 20h into meal-level aggregates.

    The aggregate intentionally excludes product names and provider identifiers.
    Open-source provenance is reduced to source names and verification counts so
    long-term analysis can reason about data quality without keeping food detail.
    """
    rows = await db.nutrition_entries.find({"profile_id": profile_id}, {"_id": 0}).sort("eaten_at", 1).to_list(500)
    cutoff = _now() - timedelta(hours=_COMPACTION_HOURS)
    detailed: List[Dict[str, Any]] = []
    aggregates: Dict[tuple[str, str], List[Dict[str, Any]]] = {}
    for row in rows:
        day = _entry_local_date(row)
        meal = str(row.get("meal_type") or "other")
        if not day:
            continue
        if row.get("source") == "aggregate" or row.get("compacted") is True:
            aggregates.setdefault((day, meal), []).append(row)
            continue
        age_anchor = _parse_dt(row.get("created_at")) or _parse_dt(row.get("eaten_at"))
        if age_anchor and age_anchor <= cutoff:
            detailed.append(row)

    grouped: Dict[tuple[str, str], List[Dict[str, Any]]] = {}
    for row in detailed:
        day = _entry_local_date(row)
        if not day:
            continue
        grouped.setdefault((day, str(row.get("meal_type") or "other")), []).append(row)

    compacted_count = 0
    for key, group in grouped.items():
        day, meal = key
        existing = aggregates.get(key, [])
        all_for_total = [*existing, *group]
        nutrients = _sum_nutrients(all_for_total)
        times = sorted(
            str(row.get("local_time")) for row in all_for_total
            if _TIME_RE.match(str(row.get("local_time") or ""))
        )
        eaten_values = [dt for dt in (_parse_dt(row.get("eaten_at")) for row in all_for_total) if dt]
        detail_count = sum(int(row.get("detail_count") or 1) for row in all_for_total)
        source_names = sorted({str(row.get("reference_source") or row.get("source") or "manual") for row in all_for_total if row.get("source") != "aggregate"})
        verification_counts: Dict[str, int] = {}
        for row in all_for_total:
            status = str(row.get("verification_status") or "unverified")
            verification_counts[status] = verification_counts.get(status, 0) + int(row.get("detail_count") or 1)
        aggregate_payload = {
            "profile_id": profile_id,
            "label": None,
            "meal_type": meal,
            "eaten_at": min(eaten_values) if eaten_values else _now(),
            "local_date": day,
            "local_time": times[0] if times else None,
            "timezone_offset_min": next((row.get("timezone_offset_min") for row in all_for_total if row.get("timezone_offset_min") is not None), None),
            "source": "aggregate",
            "quantity": 1.0,
            "nutrients": nutrients,
            "compacted": True,
            "detail_count": detail_count,
            "source_provenance": source_names,
            "verification_counts": verification_counts,
            "verification_status": "meal_aggregate",
            "updated_at": _now(),
        }
        if existing:
            keeper = existing[0]
            await db.nutrition_entries.update_one({"id": keeper["id"]}, {"$set": aggregate_payload})
            remove_ids = [str(row.get("id")) for row in [*existing[1:], *group] if row.get("id")]
        else:
            aggregate_payload.update({"id": str(uuid.uuid4()), "created_at": _now()})
            await db.nutrition_entries.insert_one(aggregate_payload)
            remove_ids = [str(row.get("id")) for row in group if row.get("id")]
        if remove_ids:
            await db.nutrition_entries.delete_many({"id": {"$in": remove_ids}})
        compacted_count += len(group)
    return compacted_count


def _food_medication_flags(entries: List[Dict[str, Any]], medications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    flags: List[Dict[str, Any]] = []
    seen = set()
    # Compacted rows have no food label by design, so food-specific interaction
    # checks apply only to the recent detailed window.
    for med in medications:
        ingredient = _normalized_ingredient(med)
        if not ingredient:
            continue
        med_name = med.get("trade_name") or med.get("name") or ingredient
        med_times = [_med_time_minutes(value) for value in (med.get("times") or [])]
        med_times = [value for value in med_times if value is not None]
        for entry in entries:
            label = str(entry.get("label") or "").lower()
            if not label:
                continue
            key_base = (str(entry.get("id")), str(med.get("id")))
            if any(name in ingredient for name in _GRAPEFRUIT_MEDICATIONS) and any(word in label for word in _GRAPEFRUIT_WORDS):
                key = (*key_base, "grapefruit")
                if key not in seen:
                    seen.add(key)
                    flags.append({
                        "severity": "check", "kind": "food_medication", "food": entry.get("label"),
                        "medication": med_name, "active_ingredient": med.get("active_ingredient"),
                        "message": "Грейпфрут может менять действие некоторых лекарств. Проверьте инструкцию именно к вашему препарату и уточните у врача или фармацевта.",
                        "action": "Не меняйте препарат самостоятельно; уточните, нужно ли исключить грейпфрут.",
                        "evidence_url": "https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix",
                    })
            if "fexofenadine" in ingredient and any(word in label for word in _FEXOFENADINE_JUICE_WORDS):
                key = (*key_base, "fruit_juice")
                if key not in seen:
                    seen.add(key)
                    flags.append({
                        "severity": "check", "kind": "food_medication", "food": entry.get("label"),
                        "medication": med_name, "active_ingredient": med.get("active_ingredient"),
                        "message": "Некоторые фруктовые соки могут снижать всасывание фексофенадина.",
                        "action": "Сверьте способ приёма с инструкцией к препарату или фармацевтом.",
                        "evidence_url": "https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix",
                    })
            if ("warfarin" in ingredient or "варфарин" in ingredient) and any(word in label for word in _WARFARIN_WORDS):
                key = (*key_base, "vitamin_k")
                if key not in seen:
                    seen.add(key)
                    flags.append({
                        "severity": "info", "kind": "food_medication", "food": entry.get("label"),
                        "medication": med_name, "active_ingredient": med.get("active_ingredient"),
                        "message": "При варфарине важнее стабильное потребление продуктов с витамином K, а не их резкая отмена.",
                        "action": "Не делайте больших изменений в рационе без согласования с врачом, который контролирует INR.",
                        "evidence_url": "https://medlineplus.gov/druginfo/meds/a682277.html",
                    })
            if "levothyroxine" in ingredient or "левотироксин" in ingredient:
                meal_minute = _minutes_of_day(entry)
                if meal_minute is not None and any(0 <= meal_minute - med_minute < 60 for med_minute in med_times):
                    key = (*key_base, "levothyroxine_meal")
                    if key not in seen:
                        seen.add(key)
                        flags.append({
                            "severity": "check", "kind": "timing", "food": entry.get("label"),
                            "medication": med_name, "active_ingredient": med.get("active_ingredient"),
                            "message": "Еда отмечена менее чем через час после левотироксина; пища может влиять на его всасывание.",
                            "action": "Сверьте назначенный интервал с инструкцией врача; не меняйте дозу самостоятельно.",
                            "evidence_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=83854522-f22e-491f-8392-c8b1f9441760",
                        })
    return flags[:20]


def _daily_totals(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    days: Dict[str, Dict[str, Any]] = {}
    for entry in entries:
        day = _entry_local_date(entry)
        if not day:
            continue
        bucket = days.setdefault(day, {"date": day, "entries": 0, "entries_with_nutrients": 0, **{key: 0.0 for key in _NUTRIENT_KEYS}})
        bucket["entries"] += int(entry.get("detail_count") or 1)
        nutrients = _entry_nutrients(entry)
        if nutrients:
            bucket["entries_with_nutrients"] += int(entry.get("detail_count") or 1)
        for key in _NUTRIENT_KEYS:
            value = _as_float(nutrients.get(key))
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
                "kind": "fiber_pattern", "level": "attention", "title": "В дневнике мало клетчатки",
                "text": "По зарегистрированным приёмам пищи среднее количество клетчатки выглядит низким. Аида может предложить более богатые клетчаткой варианты, учитывая диагнозы и лекарства.",
            })
        sat_share = []
        for day in complete_days:
            calories = float(day.get("calories") or 0)
            saturated = float(day.get("saturated_fat_g") or 0)
            if calories > 0:
                sat_share.append((saturated * 9) / calories)
        if sat_share and statistics.mean(sat_share) > 0.10:
            insights.append({
                "kind": "saturated_fat_pattern", "level": "attention", "title": "Высокая доля насыщенных жиров",
                "text": "В зарегистрированном рационе заметна высокая доля энергии из насыщенных жиров. Это наблюдение по дневнику, а не диагноз.",
            })

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
            "kind": "meal_gap_pattern", "level": "info", "title": "Есть длинные интервалы между приёмами пищи",
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
                "kind": "energy_association", "level": "info",
                "title": "Провалы энергии совпадают с более низким зарегистрированным рационом",
                "text": "В дни с низкой оценкой энергии в дневнике зарегистрировано заметно меньше энергии из пищи, чем в ваши более энергичные дни. Это корреляция и не доказывает причину.",
            })
    return insights[:8]


async def build_nutrition_context(db, profile_id: str, *, limit: int = 100) -> Dict[str, Any]:
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    modules = (profile or {}).get("module_settings") or {}
    if not profile or modules.get("nutrition") is not True:
        return {"enabled": False, "entries": [], "daily": [], "insights": [], "food_medication_flags": []}
    await _compact_old_entries(db, profile_id)
    rows = await db.nutrition_entries.find({"profile_id": profile_id}, {"_id": 0}).sort("eaten_at", -1).to_list(limit)
    checkins = await db.checkins.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(30) if modules.get("mental") is not False else []
    medications = await db.medications.find({"profile_id": profile_id, "active": True}, {"_id": 0}).to_list(100) if modules.get("meds") is not False else []
    daily = _daily_totals(rows)
    public_entries = [_public_entry(row) for row in rows]
    return {
        "enabled": True,
        "provider": provider_status(),
        "entries": public_entries[:40],
        "daily": daily[:14],
        "insights": _pattern_insights(rows, daily, checkins),
        "food_medication_flags": _food_medication_flags(public_entries, medications),
        "detail_retention_hours": _COMPACTION_HOURS,
    }


class NutritionEntryCreate(BaseModel):
    profile_id: str
    label: str = ""
    meal_type: str = "other"
    eaten_at: datetime = Field(default_factory=_now)
    local_date: Optional[str] = None
    local_time: Optional[str] = None
    timezone_offset_min: Optional[int] = None
    source: str = "manual"
    reference_id: Optional[str] = None
    quantity: float = 1.0
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
            **provider_status(),
            "detail_retention_hours": _COMPACTION_HOURS,
        }

    @router.get("/foods/search")
    async def search_foods(
        profile_id: str,
        q: str = Query(min_length=2, max_length=120),
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, profile_id)
        items = await search_food_references(q.strip(), limit=12)
        return {"providers": provider_status(), "items": items}

    @router.get("/entries")
    async def list_entries(
        profile_id: str,
        limit: int = Query(default=100, ge=1, le=300),
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, profile_id)
        await _compact_old_entries(db, profile_id)
        rows = await db.nutrition_entries.find({"profile_id": profile_id}, {"_id": 0}).sort("eaten_at", -1).to_list(limit)
        return [_public_entry(row) for row in rows]

    @router.post("/entries")
    async def create_entry(data: NutritionEntryCreate, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, data.profile_id, write=True)
        await _compact_old_entries(db, data.profile_id)
        source = data.source.strip().lower()
        if source not in _ALLOWED_SOURCES:
            raise HTTPException(400, "Invalid nutrition source")
        meal = data.meal_type.strip().lower()
        if meal not in _ALLOWED_MEALS:
            raise HTTPException(400, "Invalid meal type")
        if data.quantity <= 0 or data.quantity > 100:
            raise HTTPException(400, "Quantity must be between 0 and 100")
        offset = None if data.timezone_offset_min is None else max(-840, min(840, int(data.timezone_offset_min)))
        label = data.label.strip()
        reference = None
        cross_check = None
        if source == "manual":
            if not label:
                raise HTTPException(400, "Food label is required")
            stored_nutrients = {
                key: value for key, value in {
                    "calories": data.calories, "protein_g": data.protein_g, "carbs_g": data.carbs_g,
                    "fat_g": data.fat_g, "fiber_g": data.fiber_g, "sugar_g": data.sugar_g,
                    "saturated_fat_g": data.saturated_fat_g, "sodium_mg": data.sodium_mg,
                    "potassium_mg": data.potassium_mg,
                }.items() if value is not None and value >= 0
            }
            verification_status = "user_entered"
            reference_source = None
            reference_id = None
            serving_description = None
        else:
            reference_id = str(data.reference_id or "").strip()
            if not reference_id:
                raise HTTPException(400, "Nutrition reference id is required")
            reference = await resolve_reference(source, reference_id)
            label = str(reference.get("name") or "").strip()
            stored_nutrients = dict(reference.get("nutrients") or {})
            if not label or not stored_nutrients:
                raise HTTPException(502, "Nutrition reference is incomplete")
            cross_check = await cross_check_reference(reference)
            verification_status = {
                "matched": "cross_checked",
                "close": "cross_checked_close",
                "mismatch": "source_disagreement",
            }.get(str(cross_check.get("status") or ""), "source_only")
            reference_source = source
            serving_description = reference.get("serving_description") or "100 г"

        payload: Dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "profile_id": data.profile_id,
            "label": label,
            "meal_type": meal,
            "eaten_at": data.eaten_at,
            "local_date": _validated_local_date(data.local_date, data.eaten_at),
            "local_time": _validated_local_time(data.local_time, data.eaten_at),
            "timezone_offset_min": offset,
            "source": source,
            "quantity": float(data.quantity),
            "stored_nutrients": stored_nutrients,
            "serving_description": serving_description,
            "reference_source": reference_source,
            "reference_id": reference_id,
            "reference_license": reference.get("license") if reference else None,
            "cross_check": cross_check,
            "verification_status": verification_status,
            "note": (data.note or "").strip() or None,
            "compacted": False,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.nutrition_entries.insert_one(payload)
        return _public_entry(payload)

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
