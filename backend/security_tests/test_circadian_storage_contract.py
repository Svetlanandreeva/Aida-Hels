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
