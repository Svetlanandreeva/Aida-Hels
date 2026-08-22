from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_onboarding_draft_profile_writes_are_debounced_and_serialized():
    source = read("frontend/app/onboarding.tsx")

    assert "DRAFT_SAVE_DEBOUNCE_MS = 900" in source
    assert "draftTimerRef" in source
    assert "draftRequestRef" in source
    assert "const scheduleDraft" in source
    assert "scheduleDraft({ goals: next })" in source
    assert "scheduleDraft({ sex: value || null, goals: nextGoals })" in source
    assert "saveDraft({ goals: next })" not in source
    assert "saveDraft({ sex: value || null, goals: nextGoals })" not in source
    assert "if (draftRequestRef.current) await draftRequestRef.current;" in source


def test_incomplete_onboarding_goal_edits_do_not_fan_out_to_puzzle_storage():
    source = read("backend/profile_api.py")

    assert "sync_goal_puzzle = finishing_onboarding or (was_completed and goals_changed)" in source
    assert "if sync_goal_puzzle:" in source
    assert "if finishing_onboarding or goals_changed:" not in source.split("await db.profiles.update_one", 1)[1]
