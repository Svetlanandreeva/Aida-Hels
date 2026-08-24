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


def test_tasks_screen_uses_device_local_calendar_date():
    source = read("frontend/app/(tabs)/tasks.tsx")
    assert "new Date().toISOString().slice(0, 10)" not in source
    assert "value.getFullYear()" in source
    assert "value.getMonth() + 1" in source
    assert "value.getDate()" in source


def test_task_delete_rolls_back_when_backend_delete_fails():
    source = read("frontend/app/(tabs)/tasks.tsx")
    assert "const previousTasks = tasks;" in source
    assert "await api.deleteTask(id);" in source
    assert "await cancelTaskReminder(current.notification_id);" in source
    assert "setTasks(previousTasks);" in source
    assert "Не удалось удалить задачу. Изменение отменено." in source
    assert "api.deleteTask(id).catch(() => {})" not in source
    assert source.index("await api.deleteTask(id);") < source.index("await cancelTaskReminder(current.notification_id);")
