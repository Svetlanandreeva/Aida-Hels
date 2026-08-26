from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_canonical_lab_status_uses_explicit_reference_range():
    source = read("backend/lab_normalization.py")
    assert "def derive_abnormal_flag" in source
    assert 'return "low"' in source
    assert 'return "high"' in source
    assert 'return "normal"' in source
    assert '"status_source"' in source


def test_ai_context_prefers_canonical_lab_results():
    source = read("backend/ai_context.py")
    assert "db.lab_results.find" in source
    assert '"recent_lab_results"' in source
    assert '"lab_trends"' in source
    assert "build_lab_trends(lab_results)" in source
    assert '"aida-context-v2"' in source


def test_lab_trends_are_descriptive_and_evidence_linked():
    source = read("backend/lab_analysis.py")
    assert "def build_lab_trends" in source
    assert '"insufficient_history"' in source
    assert '"delta_from_previous"' in source
    assert '"result_id"' in source
    assert "derived_reference_flag" in source
