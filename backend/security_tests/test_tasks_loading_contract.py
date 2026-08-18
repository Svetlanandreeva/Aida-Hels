from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_tasks_screen_has_bounded_nonblocking_loading():
    source = read("frontend/app/(tabs)/tasks.tsx")
    assert "TASK_LOAD_TIMEOUT_MS = 3500" in source
    assert 'withTimeout(api.listTasks(activeId), TASK_LOAD_TIMEOUT_MS, "tasks_list")' in source
    assert 'testID="tasks-loading-state"' in source
    assert 'testID="tasks-retry-banner"' in source
    assert '{loading ? (\n        <View style={styles.center}' not in source
