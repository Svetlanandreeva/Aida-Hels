from pathlib import Path


MIND_SCREEN = (Path(__file__).resolve().parents[2] / "frontend" / "app" / "mind.tsx").read_text(encoding="utf-8")


def test_mind_screen_keeps_onboarding_diagnosis_visible_without_checkins():
    assert "activeProfile?.mental_conditions" in MIND_SCREEN
    assert 'testID="mind-diagnosis-card"' in MIND_SCREEN
    assert "items.length === 0 && !loading" in MIND_SCREEN


def test_mind_screen_loads_current_medications_for_context_matching():
    assert "api.listMeds(activeId)" in MIND_SCREEN
    assert "active_ingredient" in MIND_SCREEN
    assert "isMentalMedication" in MIND_SCREEN
    assert 'testID="mind-related-medications-card"' in MIND_SCREEN
