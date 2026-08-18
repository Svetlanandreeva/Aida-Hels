from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_medications_screen_keeps_shell_visible_and_bounds_sources():
    source = read("frontend/app/medications.tsx")
    assert "MEDICATION_LOAD_TIMEOUT_MS = 3500" in source
    assert 'withTimeout(api.listMeds(activeId), MEDICATION_LOAD_TIMEOUT_MS, "medications_list")' in source
    assert 'withTimeout(getMedicationDay(activeId, localDateString()), MEDICATION_LOAD_TIMEOUT_MS, "medications_day")' in source
    assert "Promise.allSettled" in source
    assert 'testID="medications-loading-state"' in source
    assert 'testID="medications-retry-banner"' in source
    assert 'testID="medications-error-state"' in source
    assert "{loading ? (\n        <View style={styles.center}" not in source
