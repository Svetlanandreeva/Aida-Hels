from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_ai_context_prefers_canonical_lab_results_and_builds_trends():
    source = (ROOT / "backend" / "ai_context.py").read_text(encoding="utf-8")
    assert 'db.lab_results.find({"profile_id": profile_id}' in source
    assert '"recent_lab_results": canonical_lab_results' in source
    assert '"lab_trends": build_lab_trends(lab_results)' in source
    assert 'if labs_allowed and not lab_results:' in source
    assert '"recent_labs_legacy"' in source
