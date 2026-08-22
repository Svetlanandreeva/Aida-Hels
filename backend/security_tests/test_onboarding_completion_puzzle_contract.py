from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_final_onboarding_still_builds_goal_puzzle():
    profile_source = (ROOT / "backend/profile_api.py").read_text(encoding="utf-8")
    lifestyle_source = (ROOT / "frontend/app/onboarding-lifestyle.tsx").read_text(encoding="utf-8")

    assert 'onboarding_completed: true' in lifestyle_source
    assert 'finishing_onboarding = patch.get("onboarding_completed") is True and not was_completed' in profile_source
    assert 'sync_goal_puzzle = finishing_onboarding or (was_completed and goals_changed)' in profile_source
    assert '"widgets": widgets_for_goals(effective_goals)' in profile_source
