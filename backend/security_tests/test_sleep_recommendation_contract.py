from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT.parent / "frontend"


def test_sleep_personalization_needs_longitudinal_data_and_never_uses_population_bedtime():
    text = (ROOT / "sleep_personalization.py").read_text(encoding="utf-8")
    assert '"minimum_days": 28' in text
    assert "span_days < 28" in text
    assert "observed association" in text or "наблюдаемая связь" in text
    assert "23:00" not in text


def test_clinical_prompt_suppresses_personalized_push():
    hook = (FRONTEND / "src" / "hooks" / "use-sleep-recommendation-sync.ts").read_text(encoding="utf-8")
    assert "clinicallyFlagged" in hook
    assert "!clinicallyFlagged" in hook
    assert "aida_signals" in hook


def test_sleep_notification_points_back_to_sleep_screen():
    notifications = (FRONTEND / "src" / "notifications.ts").read_text(encoding="utf-8")
    assert "schedulePersonalSleepWindowReminder" in notifications
    assert 'url: "/sleep-rhythm"' in notifications


def test_sleep_screen_exposes_personal_insight_card():
    screen = (FRONTEND / "app" / "sleep-rhythm.tsx").read_text(encoding="utf-8")
    assert "SleepInsightCard" in screen
