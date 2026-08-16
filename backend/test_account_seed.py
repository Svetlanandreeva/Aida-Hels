"""Opt-in test account seeding for Aida user testing.

Nothing is seeded unless AIDA_TEST_ACCOUNT_ENABLED=true. All demo medical rows are
scoped to the single test profile created for AIDA_TEST_ACCOUNT_EMAIL. Ordinary
accounts never receive fallback/demo data.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import bcrypt


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


TEST_SCOPED_COLLECTIONS = (
    "labs",
    "symptoms",
    "medications",
    "medication_events",
    "vitals",
    "checkins",
    "tasks",
    "chat_messages",
    "puzzle",
    "files",
    "wearable_samples",
    "wearable_connections",
    "candidates",
)


async def seed_test_account(db) -> Dict[str, Any]:
    enabled = os.environ.get("AIDA_TEST_ACCOUNT_ENABLED", "false").strip().lower() == "true"
    if not enabled:
        return {"enabled": False, "seeded": False}

    email = os.environ.get("AIDA_TEST_ACCOUNT_EMAIL", "test@aidaassistent.ru").strip().lower()
    password = os.environ.get("AIDA_TEST_ACCOUNT_PASSWORD", "")
    if not email or not password or len(password) < 8:
        raise RuntimeError(
            "AIDA_TEST_ACCOUNT_ENABLED=true requires AIDA_TEST_ACCOUNT_EMAIL and "
            "AIDA_TEST_ACCOUNT_PASSWORD (8+ chars)"
        )

    now = _now()
    now_iso = _iso(now)
    account = await db.accounts.find_one({"email": email}, {"_id": 0})
    if account:
        account_id = str(account["id"])
        await db.accounts.update_one(
            {"id": account_id},
            {"$set": {
                "name": "Aida Test",
                "password_hash": _password_hash(password),
                "disabled_at": None,
                "updated_at": now_iso,
                "is_test_account": True,
            }},
        )
    else:
        account_id = str(uuid.uuid4())
        await db.accounts.insert_one({
            "id": account_id,
            "email": email,
            "name": "Aida Test",
            "password_hash": _password_hash(password),
            "created_at": now_iso,
            "updated_at": now_iso,
            "disabled_at": None,
            "is_test_account": True,
        })

    profile = await db.profiles.find_one({"account_id": account_id, "kind": "me"}, {"_id": 0})
    if profile:
        profile_id = str(profile["id"])
    else:
        profile_id = str(uuid.uuid4())
        await db.profiles.insert_one({
            "id": profile_id,
            "account_id": account_id,
            "name": "Тестовый профиль",
            "kind": "me",
            "dob": "1998-04-10",
            "sex": "female",
            "height_cm": 168,
            "weight_kg": 64.2,
            "blood_type": "A+",
            "allergies": [],
            "chronic_conditions": [],
            "diagnoses": [],
            "surgeries": [],
            "privacy": {"include_in_ai_context": True, "share_documents": False},
            "module_settings": {},
            "onboarding_completed": True,
            "is_test_profile": True,
            "created_at": now_iso,
            "updated_at": now_iso,
        })

    grant = await db.access_grants.find_one(
        {"account_id": account_id, "profile_id": profile_id}, {"_id": 0}
    )
    if grant:
        await db.access_grants.update_one(
            {"id": grant["id"]},
            {"$set": {"role": "owner", "revoked_at": None, "updated_at": now_iso}},
        )
    else:
        await db.access_grants.insert_one({
            "id": str(uuid.uuid4()),
            "account_id": account_id,
            "profile_id": profile_id,
            "role": "owner",
            "created_at": now_iso,
            "revoked_at": None,
        })

    # Reset only this test profile. Never delete or mutate rows belonging to another profile.
    for collection_name in TEST_SCOPED_COLLECTIONS:
        collection = getattr(db, collection_name)
        await collection.delete_many({"profile_id": profile_id})

    def days_ago(days: int, hour: int = 8) -> str:
        dt = now - timedelta(days=days)
        return _iso(dt.replace(hour=hour, minute=0, second=0, microsecond=0))

    labs = [
        {
            "id": str(uuid.uuid4()), "profile_id": profile_id, "title": "Общий анализ крови",
            "date": (now - timedelta(days=14)).date().isoformat(), "lab_name": "Тестовая лаборатория",
            "source": "test_seed", "verified": True,
            "biomarkers": [
                {"name": "Гемоглобин", "value": "128", "unit": "г/л", "reference": "120–150", "status": "normal"},
                {"name": "Лейкоциты", "value": "9.8", "unit": "10⁹/л", "reference": "4.0–9.0", "status": "high"},
                {"name": "Ферритин", "value": "24", "unit": "нг/мл", "reference": "15–150", "status": "normal"},
            ],
            "created_at": days_ago(14),
        },
        {
            "id": str(uuid.uuid4()), "profile_id": profile_id, "title": "Биохимия",
            "date": (now - timedelta(days=45)).date().isoformat(), "lab_name": "Тестовая лаборатория",
            "source": "test_seed", "verified": True,
            "biomarkers": [
                {"name": "Глюкоза", "value": "4.8", "unit": "ммоль/л", "reference": "3.9–5.5", "status": "normal"},
                {"name": "Холестерин общий", "value": "4.6", "unit": "ммоль/л", "reference": "<5.2", "status": "normal"},
            ],
            "created_at": days_ago(45),
        },
    ]
    for row in labs:
        await db.labs.insert_one(row)

    for days, systolic, diastolic, pulse in [(0, 122, 78, 70), (2, 128, 82, 72), (5, 135, 85, 74), (8, 141, 91, 78)]:
        await db.vitals.insert_one({
            "id": str(uuid.uuid4()), "profile_id": profile_id, "kind": "bp",
            "systolic": systolic, "diastolic": diastolic, "pulse": pulse,
            "date": days_ago(days), "observed_at": days_ago(days), "source": "test_seed",
            "created_at": days_ago(days),
        })
    for metric, value, unit in [
        ("weight", 64.2, "kg"), ("resting_heart_rate", 67, "bpm"),
        ("steps", 8240, "count"), ("vo2_max", 36.8, "ml/kg/min"),
        ("spo2", 98, "%"), ("hrv_rmssd", 42, "ms"),
    ]:
        await db.vitals.insert_one({
            "id": str(uuid.uuid4()), "profile_id": profile_id, "kind": metric, "metric": metric,
            "value": value, "unit": unit, "date": days_ago(0), "observed_at": days_ago(0),
            "source": "test_seed", "created_at": days_ago(0),
        })

    medication_id = str(uuid.uuid4())
    await db.medications.insert_one({
        "id": medication_id, "profile_id": profile_id, "name": "Витамин D3", "dose": "2000 МЕ",
        "schedule": "08:30", "active": True, "start_date": (now - timedelta(days=30)).date().isoformat(),
        "notes": "Тестовая запись", "source": "test_seed", "created_at": days_ago(30),
    })
    await db.medication_events.insert_one({
        "id": str(uuid.uuid4()), "profile_id": profile_id, "medication_id": medication_id,
        "status": "taken", "scheduled_at": days_ago(1, 8), "taken_at": days_ago(1, 8),
        "source": "test_seed", "created_at": days_ago(1, 8),
    })

    for days, mood, energy, stress, anxiety, sleep in [
        (0, 4, 4, 2, 2, 4), (1, 3, 3, 3, 3, 3), (2, 4, 3, 2, 2, 4),
    ]:
        await db.checkins.insert_one({
            "id": str(uuid.uuid4()), "profile_id": profile_id, "mood": mood, "energy": energy,
            "stress": stress, "anxiety": anxiety, "sleep": sleep, "date": days_ago(days, 21),
            "note": "Тестовый check-in", "source": "test_seed", "created_at": days_ago(days, 21),
        })

    await db.symptoms.insert_one({
        "id": str(uuid.uuid4()), "profile_id": profile_id, "name": "Усталость", "severity": 4,
        "date": days_ago(2, 18), "note": "Тестовая запись", "source": "test_seed", "created_at": days_ago(2, 18),
    })

    for title, kind, done in [
        ("Принять Витамин D3", "medication", False),
        ("Измерить давление", "pressure", False),
        ("Заполнить дневник самочувствия", "diary", True),
    ]:
        await db.tasks.insert_one({
            "id": str(uuid.uuid4()), "profile_id": profile_id, "title": title, "kind": kind,
            "due": now.date().isoformat(), "done": done, "source": "test_seed", "created_at": now_iso,
        })

    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()), "account_id": account_id, "profile_id": profile_id,
        "action": "test_account.seed", "created_at": now_iso,
    })
    return {"enabled": True, "seeded": True, "account_id": account_id, "profile_id": profile_id, "email": email}
