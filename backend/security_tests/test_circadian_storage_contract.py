from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_google_storage_has_separate_circadian_tabs():
    text = (ROOT / "google_storage.py").read_text(encoding="utf-8")
    assert '"circadian_events": "circadian_events"' in text
    assert '"circadian_plans": "circadian_plans"' in text
    assert "ensure_sheet" in text


def test_profile_delete_cleans_circadian_rows():
    text = (ROOT / "profile_api.py").read_text(encoding="utf-8")
    assert "db.circadian_events" in text
    assert "db.circadian_plans" in text


def test_wearable_sleep_anchor_requires_candidate_review():
    circadian = (ROOT / "circadian_api.py").read_text(encoding="utf-8")
    candidates = (ROOT / "candidate_records.py").read_text(encoding="utf-8")

    assert '@router.post("/wearable-candidates")' in circadian
    assert 'Imported sleep anchors must be reviewed through CandidateRecords' in circadian
    assert '"entity_type": "circadian_event"' in circadian
    assert '"circadian_event": "circadian_events"' in candidates
    assert 'payload["source"] = "wearable_confirmed"' in candidates
    assert 'payload["verification_status"] = "user_confirmed"' in candidates
