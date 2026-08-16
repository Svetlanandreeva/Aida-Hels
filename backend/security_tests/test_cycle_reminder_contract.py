from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_cycle_reminder_is_profile_scoped_and_forecast_driven():
    notifications = (ROOT / "frontend" / "src" / "notifications.ts").read_text(encoding="utf-8")
    cycle_screen = (ROOT / "frontend" / "app" / "cycle.tsx").read_text(encoding="utf-8")

    assert "aida:cycle-reminder:${profileId}" in notifications
    assert "window_start" in notifications
    assert "window_end" in notifications
    assert "estimated_next_start" in notifications
    assert "syncCycleWindowReminder" in cycle_screen
    assert "show_notification_details" in cycle_screen


def test_cycle_reminder_replaces_stale_schedule_and_has_no_population_default():
    notifications = (ROOT / "frontend" / "src" / "notifications.ts").read_text(encoding="utf-8")
    cycle_api = (ROOT / "backend" / "cycle_api.py").read_text(encoding="utf-8")

    assert "cancelScheduledNotificationAsync(existing.id)" in notifications
    assert "existing.signature !== signature" in notifications
    assert "28" not in cycle_api
    assert '"state": "insufficient_data"' in cycle_api


def test_cycle_notification_is_not_worded_as_exact_medical_fact():
    notifications = (ROOT / "frontend" / "src" / "notifications.ts").read_text(encoding="utf-8")

    assert "прогнозное окно" in notifications
    assert "Это ориентир, а не точная дата" in notifications
