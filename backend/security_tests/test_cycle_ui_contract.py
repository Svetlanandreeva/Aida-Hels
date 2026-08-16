from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CYCLE_UI = (ROOT / "frontend" / "app" / "cycle.tsx").read_text(encoding="utf-8")
NOTIFICATIONS = (ROOT / "frontend" / "src" / "notifications.ts").read_text(encoding="utf-8")


def test_cycle_ui_keeps_personalized_calendar_and_insufficient_data_copy():
    assert 'Расчётные фазы' in CYCLE_UI
    assert 'Аида не подставляет «28 дней» автоматически' in CYCLE_UI
    assert 'Аида не вычисляет овуляцию по универсальному «14-му дню»' in CYCLE_UI
    assert 'calendarDays(month)' in CYCLE_UI
    assert 'periodStarts.has(key)' in CYCLE_UI
    assert 'periodEnds.has(key)' in CYCLE_UI
    assert 'forecast?.state==="data"&&inRange' in CYCLE_UI


def test_cycle_ui_records_ovulation_test_as_evidence_not_as_fact():
    assert 'add("ovulation_test","positive")' in CYCLE_UI
    assert 'Положительный тест на овуляцию' in CYCLE_UI
    assert 'Окно возможной овуляции' in CYCLE_UI
    assert 'расчёт' in CYCLE_UI


def test_cycle_reminder_is_profile_scoped_replaceable_and_privacy_aware():
    assert 'aida:cycle-reminder:${profileId}' in NOTIFICATIONS
    assert 'existing.signature !== signature' in NOTIFICATIONS
    assert 'cancelScheduledNotificationAsync(existing.id)' in NOTIFICATIONS
    assert 'showDetails' in NOTIFICATIONS
    assert 'Это ориентир, а не точная дата.' in NOTIFICATIONS
    assert 'profileId: input.profileId' in NOTIFICATIONS
