from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_lab_pipeline_handles_motor_update_result_attributes():
    source = (ROOT / "backend/lab_pipeline.py").read_text(encoding="utf-8")
    assert 'getattr(result, "matched_count", 0)' in source
    assert 'getattr(claim, "matched_count", 0)' in source
    assert 'result.get("matched_count")' not in source
    assert 'claim.get("matched_count")' not in source
