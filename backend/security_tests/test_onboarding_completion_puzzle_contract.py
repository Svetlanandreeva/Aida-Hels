from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_final_onboarding_still_builds_goal_puzzle():
    profile_source = (ROOT / "backend/profile_api.py").read_text(encoding="utf-8")
    lifestyle_source = (ROOT / "frontend/app/onboarding-lifestyle.tsx").read_text(encoding="utf-8")
    medications_source = (ROOT / "frontend/app/onboarding-medications.tsx").read_text(encoding="utf-8")

    assert 'onboarding_completed: false' in lifestyle_source
    assert 'onboarding_completed: true' in medications_source
    assert 'finishing_onboarding = patch.get("onboarding_completed") is True and not was_completed' in profile_source
    assert 'async def sync_goal_puzzle(profile_id: str, effective_goals: List[str]) -> None:' in profile_source
    assert '"widgets": widgets_for_goals(effective_goals)' in profile_source
    assert 'if finishing_onboarding:' in profile_source
    assert 'background_tasks.add_task(sync_goal_puzzle, profile_id, effective_goals)' in profile_source
    assert 'elif was_completed and goals_changed:' in profile_source
