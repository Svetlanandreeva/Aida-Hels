"""Evidence-aware AI context builder for Aida.

The LLM receives only data from the active profile that the authenticated
application has already authorized. Every included fact keeps provenance,
freshness, verification/quality and a stable evidence id so generated
explanations can distinguish source data from inference.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _evidence_id(kind: str, row: Dict[str, Any]) -> str:
    return f"{kind}:{row.get('id') or row.get('external_id') or row.get('source_fingerprint') or 'unknown'}"


def _parse_observed_at(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    else:
        text = str(value).strip()
        if not text:
            return None
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            try:
                d = date.fromisoformat(text[:10])
            except ValueError:
                return None
            dt = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _freshness(observed_at: Any, *, now: datetime | None = None) -> Dict[str, Any]:
    observed = _parse_observed_at(observed_at)
    if observed is None:
        return {"status": "unknown", "age_seconds": None}
    current = now or datetime.now(timezone.utc)
    age_seconds = max(0, int((current - observed).total_seconds()))
    if age_seconds <= 24 * 3600:
        status = "fresh"
    elif age_seconds <= 7 * 24 * 3600:
        status = "recent"
    else:
        status = "stale"
    return {"status": status, "age_seconds": age_seconds}


def _compact(kind: str, row: Dict[str, Any], keys: Iterable[str]) -> Dict[str, Any]:
    item = {key: row.get(key) for key in keys if row.get(key) is not None}
    observed_at = row.get("observed_at") or row.get("date") or row.get("created_at")
    item["evidence_id"] = _evidence_id(kind, row)
    item["source"] = row.get("source") or row.get("provider_id") or "user"
    item["verification_status"] = row.get("verification_status") or "unverified"
    item["quality"] = row.get("quality") or row.get("quality_status") or "unknown"
    item["observed_at"] = observed_at
    item["freshness"] = _freshness(observed_at)
    return item


def _module_enabled(settings: Dict[str, Any], key: str) -> bool:
    """Missing settings keep backward compatibility; explicit false is fail-closed."""
    return settings.get(key) is not False


async def build_ai_context(db, profile_id: str, *, as_json: bool = True) -> str | Dict[str, Any]:
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        return "" if as_json else {}

    privacy = profile.get("privacy") or {}
    if privacy.get("include_in_ai_context") is False:
        return "" if as_json else {}

    modules = profile.get("module_settings") or {}
    medications = await db.medications.find({"profile_id": profile_id, "active": True}, {"_id": 0}).to_list(100) if _module_enabled(modules, "meds") else []
    symptoms = await db.symptoms.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(20) if _module_enabled(modules, "symptoms") else []
    labs = await db.labs.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(12) if _module_enabled(modules, "labs") else []
    vitals = await db.vitals.find({"profile_id": profile_id}, {"_id": 0}).sort("observed_at", -1).to_list(80) if _module_enabled(modules, "pressure") else []
    checkins = await db.checkins.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(14) if _module_enabled(modules, "mental") else []

    context: Dict[str, Any] = {
        "schema_version": "aida-context-v1",
        "generated_at": _iso_now(),
        "profile_id": profile_id,
        "profile": {
            "name": profile.get("name"),
            "kind": profile.get("kind"),
            "dob": profile.get("dob"),
            "sex": profile.get("sex"),
            "height_cm": profile.get("height_cm"),
            "weight_kg": profile.get("weight_kg"),
            "allergies": profile.get("allergies") or [],
            "chronic_conditions": (profile.get("chronic_conditions") or []) if _module_enabled(modules, "chronic") else [],
            "diagnoses": (profile.get("diagnoses") or []) if _module_enabled(modules, "chronic") else [],
            "goals": profile.get("goals") or [],
            "women_health": (profile.get("women_health") or {}) if _module_enabled(modules, "women") else {},
        },
        "active_medications": [_compact("medication", row, ("name", "dose", "schedule", "times", "meal_relation", "start_date")) for row in medications],
        "recent_symptoms": [_compact("symptom", row, ("name", "severity", "note", "date")) for row in symptoms],
        "recent_labs": [{**_compact("lab", row, ("title", "date", "lab_name", "source")), "biomarkers": (row.get("biomarkers") or [])[:30]} for row in labs],
        "recent_measurements": [
            _compact("vital", row, ("kind", "metric", "type", "value", "unit", "systolic", "diastolic", "pulse", "start_at", "end_at", "device_name", "provider_id"))
            for row in vitals
        ],
        "recent_checkins": [_compact("checkin", row, ("mood", "energy", "stress", "anxiety", "sleep", "triggers", "note", "date")) for row in checkins],
        "rules": {
            "missing_data_is_not_zero": True,
            "do_not_infer_medical_facts_without_evidence": True,
            "do_not_mix_profiles": True,
            "wearable_values_are_source_reported_not_diagnoses": True,
            "freshness_and_quality_must_be_considered": True,
            "respect_module_settings": True,
        },
    }
    return json.dumps(context, ensure_ascii=False, default=str) if as_json else context
