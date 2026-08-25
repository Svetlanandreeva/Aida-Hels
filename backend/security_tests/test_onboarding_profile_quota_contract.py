from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_onboarding_draft_profile_writes_happen_only_when_advancing_questions():
    source = read("frontend/app/onboarding.tsx")

    assert "const persistDraft = async" in source
    assert "await persistDraft();" in source
    assert "const next = async" in source
    assert "onChangeText={setName}" in source
    assert "onChangeText={setHeight}" in source
    assert "onChangeText={setWeight}" in source
    assert "DRAFT_SAVE_DEBOUNCE_MS" not in source
    assert "draftTimerRef" not in source
    assert "scheduleDraft" not in source


def test_incomplete_onboarding_goal_edits_do_not_fan_out_to_puzzle_storage():
    source = read("backend/profile_api.py")
    after_profile_write = source.split("await db.profiles.update_one", 1)[1]

    assert "async def sync_goal_puzzle(profile_id: str, effective_goals: List[str]) -> None:" in source
    assert "if finishing_onboarding:" in after_profile_write
    assert "background_tasks.add_task(sync_goal_puzzle, profile_id, effective_goals)" in after_profile_write
    assert "elif was_completed and goals_changed:" in after_profile_write
    assert "if finishing_onboarding or goals_changed:" not in after_profile_write
