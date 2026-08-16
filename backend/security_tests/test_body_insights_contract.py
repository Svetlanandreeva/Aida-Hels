from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_body_insights_requires_profile_access_and_never_scores_system_health():
    source = (ROOT / "body_insights.py").read_text(encoding="utf-8")
    assert "require_profile_access" in source
    assert '"state": "data" if evidence else "no_data"' in source
    assert '"evidence_count": len(evidence)' in source
    assert '"interpretation": "observations_available" if evidence else "insufficient_data"' in source
    assert '"health_score"' not in source
    assert '"system_score"' not in source


def test_biological_age_fails_closed_until_validated_model_exists():
    source = (ROOT / "body_insights.py").read_text(encoding="utf-8")
    assert '"state": "insufficient_data"' in source
    assert '"age": None' in source
    assert '"reason": "validated_model_not_enabled"' in source


def test_body_ui_links_to_evidence_details():
    app_root = ROOT.parent / "frontend" / "app"
    body = (app_root / "body.tsx").read_text(encoding="utf-8")
    detail = (app_root / "body-system.tsx").read_text(encoding="utf-8")
    assert 'pathname:"/body-system"' in body
    assert "body-map-" in body
    assert "getBodySystem" in detail
    assert "provenance" in detail.lower()
