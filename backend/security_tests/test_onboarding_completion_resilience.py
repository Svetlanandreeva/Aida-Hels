from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_successful_profile_update_refreshes_navigation_cache():
    source = (ROOT / "frontend" / "src" / "api.ts").read_text(encoding="utf-8")
    assert 'PROFILE_CACHE_KEY = "aida.profileCache.v1"' in source
    assert "setProfileCacheAccountId" in source
    assert '`${PROFILE_CACHE_KEY}.${PROFILE_CACHE_ACCOUNT_ID}`' in source
    assert "async function cacheUpdatedProfile(profile: Profile)" in source
    assert "await cacheUpdatedProfile(updated);" in source


def test_final_onboarding_does_not_wait_for_optional_puzzle_persistence():
    source = (ROOT / "backend" / "profile_api.py").read_text(encoding="utf-8")
    assert "BackgroundTasks" in source
    assert "if finishing_onboarding:" in source
    assert "background_tasks.add_task(sync_goal_puzzle, profile_id, effective_goals)" in source
    assert "doc = dict(current)" in source
    assert "doc.update(patch)" in source


def test_profile_access_grant_is_reused_instead_of_re_read_after_update():
    source = (ROOT / "backend" / "profile_api.py").read_text(encoding="utf-8")
    assert "grant = await require_access(account_id, profile_id, write=True)" in source
    assert 'return _normalize(doc, str(grant.get("role") or "viewer"))' in source
