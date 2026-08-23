from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_home_api_uses_device_local_time_for_next_medication():
    source = (ROOT / "frontend" / "src" / "homeApi.ts").read_text(encoding="utf-8")
    assert "now_local: localTime()" in source
    assert "now.getHours() * 60 + now.getMinutes()" in source
    assert "nextSlot" in source
    assert "⚠ Укажите точное время" in source
    assert "No more doses today" in source


def test_missing_medication_time_gets_post_onboarding_prompt():
    layout = (ROOT / "frontend" / "app" / "_layout.tsx").read_text(encoding="utf-8")
    screen = (ROOT / "frontend" / "app" / "medication-time-setup.tsx").read_text(encoding="utf-8")
    assert "MedicationTimePromptGate" in layout
    assert 'router.replace("/medication-time-setup"' in layout
    assert 'Stack.Screen name="medication-time-setup"' in layout
    assert "med.active && !(med.times || []).length" in layout
    assert "updateMedicationSchedule" in screen
    assert "TIME_RE" in screen
    assert "Аида использует дату и локальное время этого устройства" in screen


def test_native_reminder_sync_requires_exact_times():
    source = (ROOT / "frontend" / "src" / "hooks" / "use-medication-reminder-sync.ts").read_text(encoding="utf-8")
    assert "const times = Array.isArray(medication.times) ? medication.times : []" in source
    assert "times.length" in source
    assert "scheduleMedicationReminders" in source
