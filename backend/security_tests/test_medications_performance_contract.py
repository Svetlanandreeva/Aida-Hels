from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_medications_screen_keeps_shell_visible_and_bounds_sources():
    source = read("frontend/app/medications.tsx")
    assert "LOAD_TIMEOUT_MS = 3500" in source
    assert 'withTimeout(api.listMeds(activeId),LOAD_TIMEOUT_MS,"medications_list")' in source
    assert 'withTimeout(getMedicationDay(activeId,today),LOAD_TIMEOUT_MS,"medications_day")' in source
    assert "Promise.allSettled" in source
    assert 'loading?<View style={styles.loading}' in source
    assert 'error?<Pressable onPress={load} style={styles.error}' in source
    assert "{loading ? (\n        <View style={styles.center}" not in source
