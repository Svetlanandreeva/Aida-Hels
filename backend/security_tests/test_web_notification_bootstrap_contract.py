from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MEDICATION_SYNC = ROOT / "frontend" / "src" / "hooks" / "use-medication-reminder-sync.ts"
SLEEP_SYNC = ROOT / "frontend" / "src" / "hooks" / "use-sleep-recommendation-sync.ts"


def test_reminder_hooks_do_not_statically_pull_notifications_into_web_bootstrap():
    medication = MEDICATION_SYNC.read_text(encoding="utf-8")
    sleep = SLEEP_SYNC.read_text(encoding="utf-8")

    for source in (medication, sleep):
        assert 'from "@/src/notifications"' not in source
        assert 'await import("@/src/notifications")' in source
        assert 'Platform.OS === "web"' in source


def test_notification_runtime_is_loaded_only_after_native_guard_and_deferred_timer():
    medication = MEDICATION_SYNC.read_text(encoding="utf-8")
    sleep = SLEEP_SYNC.read_text(encoding="utf-8")

    for source in (medication, sleep):
        guard = source.index('Platform.OS === "web"')
        timer = source.index("setTimeout")
        dynamic_import = source.index('await import("@/src/notifications")')
        assert guard < timer < dynamic_import
