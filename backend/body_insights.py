"""Evidence-first body systems endpoints for Aida.

This module deliberately does not produce diagnostic organ/system health scores.
It summarizes which sourced records exist for each body system and returns the
supporting evidence so UI/AI can explain where each observation came from.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, Iterable, List

from fastapi import APIRouter, Depends, HTTPException

from access_control import require_profile_access


SYSTEMS: List[Dict[str, Any]] = [
    {"id": "cardiovascular", "label_ru": "Сердечно-сосудистая", "label_en": "Cardiovascular", "keywords": ["давлен", "pressure", "pulse", "пульс", "heart", "серд", "hrv", "cholesterol", "холест"]},
    {"id": "respiratory", "label_ru": "Дыхательная", "label_en": "Respiratory", "keywords": ["spo2", "respirat", "дых", "каш", "cough", "oxygen", "кислород"]},
    {"id": "metabolic", "label_ru": "Обмен веществ", "label_en": "Metabolic", "keywords": ["weight", "вес", "glucose", "глюк", "insulin", "инсулин", "hba1c", "lipid", "триглиц", "bmi"]},
    {"id": "sleep_recovery", "label_ru": "Сон и восстановление", "label_en": "Sleep & recovery", "keywords": ["sleep", "сон", "energy", "энерг"]},
    {"id": "mental", "label_ru": "Психика и самочувствие", "label_en": "Mental wellbeing", "keywords": ["mood", "настро", "stress", "стресс", "anxiety", "тревог", "energy", "энерг"]},
    {"id": "digestive", "label_ru": "Пищеварительная", "label_en": "Digestive", "keywords": ["желуд", "киш", "живот", "stomach", "bowel", "digest", "печен", "liver", "alt", "ast", "билирубин"]},
    {"id": "musculoskeletal", "label_ru": "Опорно-двигательная", "label_en": "Musculoskeletal", "keywords": ["сустав", "мышц", "спин", "joint", "muscle", "back", "vitamin d", "витамин d", "calcium", "кальц"]},
    {"id": "reproductive", "label_ru": "Репродуктивная", "label_en": "Reproductive", "keywords": ["cycle", "цикл", "period", "менстру", "pregnan", "беремен", "ovulat", "овуля"]},
]


def _text(*values: Any) -> str:
    return " ".join(str(v or "") for v in values).lower()


def _matches(system: Dict[str, Any], text: str) -> bool:
    return any(keyword in text for keyword in system["keywords"])


def _safe_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _evidence(kind: str, record: Dict[str, Any], title: str, value: Any = None, unit: Any = None) -> Dict[str, Any]:
    return {
        "id": str(record.get("id") or record.get("record_id") or ""),
        "kind": kind,
        "title": title,
        "value": value,
        "unit": unit,
        "observed_at": _safe_date(record.get("observed_at") or record.get("date") or record.get("created_at")),
        "source": record.get("source") or record.get("source_type") or "manual",
        "verification_status": record.get("verification_status") or "recorded",
    }


async def _collect(db, profile_id: str) -> Dict[str, List[Dict[str, Any]]]:
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0}) or {}
    vitals = await db.vitals.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(250)
    labs = await db.labs.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(100)
    symptoms = await db.symptoms.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(150)
    checkins = await db.checkins.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(120)
    circadian = await db.circadian_events.find({"profile_id": profile_id}, {"_id": 0}).sort("local_date", -1).to_list(180)

    out: Dict[str, List[Dict[str, Any]]] = {system["id"]: [] for system in SYSTEMS}

    # Profile-level weight is a real user-supplied datum, not a generated score.
    if profile.get("weight_kg") is not None:
        out["metabolic"].append(_evidence("profile_measurement", profile, "Weight", profile.get("weight_kg"), "kg"))

    for record in vitals:
        text = _text(record.get("kind"), record.get("metric"), record.get("type"), record.get("note"))
        for system in SYSTEMS:
            if _matches(system, text):
                value = record.get("value")
                if value is None and record.get("systolic") is not None:
                    value = f"{record.get('systolic')}/{record.get('diastolic')}"
                out[system["id"]].append(_evidence("measurement", record, str(record.get("metric") or record.get("kind") or "Measurement"), value, record.get("unit")))

    for lab in labs:
        for biomarker in lab.get("biomarkers") or []:
            text = _text(biomarker.get("name"), lab.get("title"))
            for system in SYSTEMS:
                if _matches(system, text):
                    item = dict(lab)
                    item["id"] = f"{lab.get('id','')}:{biomarker.get('name','')}"
                    out[system["id"]].append(_evidence("lab", item, str(biomarker.get("name") or lab.get("title") or "Lab"), biomarker.get("value"), biomarker.get("unit")))

    for symptom in symptoms:
        text = _text(symptom.get("name"), symptom.get("note"))
        for system in SYSTEMS:
            if _matches(system, text):
                out[system["id"]].append(_evidence("symptom", symptom, str(symptom.get("name") or "Symptom"), symptom.get("severity"), "/10"))

    for checkin in checkins:
        if any(checkin.get(k) is not None for k in ("mood", "stress", "anxiety", "energy")):
            out["mental"].append(_evidence("checkin", checkin, "Wellbeing check-in"))
        if checkin.get("sleep") is not None or checkin.get("energy") is not None:
            out["sleep_recovery"].append(_evidence("checkin", checkin, "Sleep / energy check-in"))

    for event in circadian:
        out["sleep_recovery"].append(_evidence("circadian", event, "Wake" if event.get("kind") == "wake" else "Bedtime", event.get("local_time")))

    for key in out:
        out[key] = out[key][:40]
    return out


def _system_payload(system: Dict[str, Any], evidence: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "id": system["id"],
        "label_ru": system["label_ru"],
        "label_en": system["label_en"],
        "state": "data" if evidence else "no_data",
        "evidence_count": len(evidence),
        "latest_observed_at": evidence[0].get("observed_at") if evidence else None,
        "evidence": evidence,
        "interpretation": "observations_available" if evidence else "insufficient_data",
    }


def _chronological_age(dob: Any) -> int | None:
    if not dob:
        return None
    try:
        born = date.fromisoformat(str(dob)[:10])
    except Exception:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def build_body_insights_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/insights", tags=["body-insights"])

    @router.get("/body-systems/{profile_id}")
    async def body_systems(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        collected = await _collect(db, profile_id)
        return {"profile_id": profile_id, "systems": [_system_payload(s, collected[s["id"]]) for s in SYSTEMS]}

    @router.get("/body-systems/{profile_id}/{system_id}")
    async def body_system(profile_id: str, system_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        system = next((s for s in SYSTEMS if s["id"] == system_id), None)
        if not system:
            raise HTTPException(404, "Body system not found")
        collected = await _collect(db, profile_id)
        return _system_payload(system, collected[system_id])

    @router.get("/biological-age/{profile_id}")
    async def biological_age(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        """Fail-closed placeholder until a validated versioned model is approved.

        The endpoint exists so the UI can render a truthful insufficient-data /
        model-not-approved state instead of inventing a biological age.
        """
        await require_profile_access(auth, account, profile_id)
        profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0}) or {}
        chronological = _chronological_age(profile.get("dob"))
        return {
            "state": "insufficient_data",
            "age": None,
            "chronological_age": chronological,
            "factors": [],
            "reason": "validated_model_not_enabled",
        }

    return router
