from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_profile_export_request_is_bounded_and_retryable():
    source = (ROOT / "frontend/app/export-data.tsx").read_text(encoding="utf-8")
    assert "EXPORT_TIMEOUT_MS=15000" in source
    assert 'withTimeout(api.exportProfile(activeId),EXPORT_TIMEOUT_MS,"profile_export")' in source
    assert "finally{setBusy(false)}" in source
    assert "Попробуйте ещё раз" in source
    assert 'accessibilityRole="alert"' in source
