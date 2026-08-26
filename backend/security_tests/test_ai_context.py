import asyncio

from ai_context import build_ai_context


class Cursor:
    def __init__(self, rows):
        self.rows = list(rows)

    def sort(self, key, direction):
        reverse = direction == -1
        self.rows.sort(key=lambda row: str(row.get(key) or ""), reverse=reverse)
        return self

    async def to_list(self, limit):
        return self.rows[:limit]


class Collection:
    def __init__(self, rows):
        self.rows = list(rows)

    async def find_one(self, query, projection=None):
        for row in self.rows:
            if all(row.get(k) == v for k, v in query.items()):
                return dict(row)
        return None

    def find(self, query, projection=None):
        return Cursor([
            dict(row)
            for row in self.rows
            if all(row.get(k) == v for k, v in query.items())
        ])


class DB:
    def __init__(self):
        self.profiles = Collection([
            {"id": "p1", "name": "Alice", "privacy": {"include_in_ai_context": True}},
            {"id": "p2", "name": "Bob", "privacy": {"include_in_ai_context": True}},
        ])
        self.medications = Collection([
            {"id": "m1", "profile_id": "p1", "name": "A", "active": True},
            {"id": "m2", "profile_id": "p2", "name": "B", "active": True},
        ])
        self.symptoms = Collection([
            {"id": "s1", "profile_id": "p1", "name": "headache", "date": "2026-08-16"},
            {"id": "s2", "profile_id": "p2", "name": "fever", "date": "2026-08-16"},
        ])
        self.lab_results = Collection([
            {
                "id": "lr1",
                "result_id": "lr1",
                "report_id": "lab1",
                "profile_id": "p1",
                "analyte_original": "Glucose",
                "analyte_code": "glucose",
                "value_original": "5.2",
                "value_normalized": 5.2,
                "unit_original": "mmol/L",
                "unit_normalized": "mmol/L",
                "reference_low": 3.9,
                "reference_high": 5.5,
                "abnormal_flag": "normal",
                "verification_status": "user_confirmed",
                "source_type": "upload",
                "observed_at": "2026-08-16",
            },
            {
                "id": "lr2",
                "result_id": "lr2",
                "report_id": "lab2",
                "profile_id": "p2",
                "analyte_original": "Glucose",
                "analyte_code": "glucose",
                "value_original": "9.9",
                "value_normalized": 9.9,
                "unit_original": "mmol/L",
                "unit_normalized": "mmol/L",
                "verification_status": "user_confirmed",
                "source_type": "upload",
                "observed_at": "2026-08-16",
            },
        ])
        self.labs = Collection([])
        self.vitals = Collection([
            {
                "id": "v1",
                "profile_id": "p1",
                "metric": "heart_rate",
                "value": 72,
                "provider_id": "apple_health",
                "observed_at": "2026-08-16T00:00:00Z",
                "verification_status": "source_verified",
                "quality": "high",
            },
            {
                "id": "v2",
                "profile_id": "p2",
                "metric": "heart_rate",
                "value": 99,
                "provider_id": "android_health_connect",
                "observed_at": "2026-08-16T00:00:00Z",
            },
        ])
        self.checkins = Collection([])


def test_context_never_mixes_profiles_and_keeps_provenance():
    context = asyncio.run(build_ai_context(DB(), "p1", as_json=False))
    assert context["profile_id"] == "p1"
    assert [item["name"] for item in context["active_medications"]] == ["A"]
    assert [item["name"] for item in context["recent_symptoms"]] == ["headache"]
    assert [item["evidence_id"] for item in context["recent_measurements"]] == ["vital:v1"]
    assert [item["value"] for item in context["recent_measurements"]] == [72]
    measurement = context["recent_measurements"][0]
    assert measurement["source"] == "apple_health"
    assert measurement["evidence_id"] == "vital:v1"
    assert measurement["verification_status"] == "source_verified"
    assert measurement["quality"] == "high"
    assert measurement["freshness"]["status"] in {"fresh", "recent", "stale"}
    assert isinstance(measurement["freshness"]["age_seconds"], int)
    assert [item["evidence_id"] for item in context["recent_lab_results"]] == ["lab_result:lr1"]
    assert context["recent_lab_results"][0]["verification_status"] == "user_confirmed"
    serialized = str(context)
    assert "Bob" not in serialized
    assert "fever" not in serialized
    assert "android_health_connect" not in serialized
    assert "9.9" not in serialized


def test_context_marks_missing_timestamp_freshness_unknown():
    context = asyncio.run(build_ai_context(DB(), "p1", as_json=False))
    medication = context["active_medications"][0]
    assert medication["freshness"] == {"status": "unknown", "age_seconds": None}
    assert medication["verification_status"] == "unverified"
    assert medication["quality"] == "unknown"


def test_context_respects_ai_privacy_opt_out():
    db = DB()
    db.profiles = Collection([{"id": "p1", "name": "Alice", "privacy": {"include_in_ai_context": False}}])
    context = asyncio.run(build_ai_context(db, "p1", as_json=False))
    assert context == {}
