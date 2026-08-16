"""Evidence-aware AI context builder for Aida.

The LLM receives only data from the active profile that the authenticated
application has already authorized. Every included fact keeps provenance,
freshness and a stable evidence id so generated explanations can distinguish
source data from inference.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _evidence_id(kind: str, row: Dict[str, Any]) -> str:
    return f"{kind}:{row.get('id') or row.get('external_id') or row.get('source_fingerprint') or 'unknown'}"


def _compact(kind: str, row: Dict[str, Any], keys: Iterable[str]) -> Dict[str, Any]:
    item = {key: row.get(key) for key in keys if row.get(key) is not None}
    item["evidence_id"] = _evidence_id(kind, row)
    item["source"] = row.get("source") or row.get("provider_id") or "user"
    item["verification_status"] = row.get("verification_status") or "unverified"
    item["observed_at"] = row.get("observed_at") or row.get("date") or row.get("created_at")
    return item


async def build_ai_context(db, profile_id: str, *, as_json: bool = True) -> str | Dict[str, Any]:
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        return "" if as_json else {}

    privacy = profile.get("privacy") or {}
    if privacy.get("include_in_ai_context") is False:
        return "" if as_json else {}

    medications = await db.medications.find({"profile_id": profile_id, "active": True}, {"_id": 0}).to_list(100)
    symptoms = await db.symptoms.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(20)
    labs = await db.labs.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(12)
    vitals = await db.vitals.find({"profile_id": profile_id}, {"_id": 0}).sort("observed_at", -1).to_list(80)
    checkins = await db.checkins.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(14)

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
            "chronic_conditions": profile.get("chronic_conditions") or [],
            "diagnoses": profile.get("diagnoses") or [],
            "goals": profile.get("goals") or [],
            "women_health": profile.get("women_health") or {},
        },
        "active_medications": [
            _compact("medication", row, ("name", "dose", "schedule", "times", "meal_relation", "start_date"))
            for row in medications
        ],
        "recent_symptoms": [
            _compact("symptom", row, ("name", "severity", "note", "date")) for row in symptoms
        ],
        "recent_labs": [
            {
                **_compact("lab", row, ("title", "date", "lab_name", "source")),
                "biomarkers": (row.get("biomarkers") or [])[:30],
            }
            for row in labs
        ],
        "recent_measurements": [
            _compact(
                "vital",
                row,
                (
                    "kind", "metric", "type", "value", "unit", "systolic", "diastolic", "pulse",
                    "start_at", "end_at", "device_name", "provider_id",
                ),
            )
            for row in vitals
        ],
        "recent_checkins": [
            _compact("checkin", row, ("mood", "energy", "stress", "anxiety", "sleep", "triggers", "note", "date"))
            for row in checkins
        ],
        "rules": {
            "missing_data_is_not_zero": True,
            "do_not_infer_medical_facts_without_evidence": True,
            "do_not_mix_profiles": True,
            "wearable_values_are_source_reported_not_diagnoses": True,
        },
    }
    return json.dumps(context, ensure_ascii=False, default=str) if as_json else context
