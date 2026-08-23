from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_family_share_is_owner_only_and_does_not_copy_medical_data():
    source = (ROOT / "family_api.py").read_text(encoding="utf-8")
    assert 'str(grant.get("role") or "") != "owner"' in source
    assert "await owner_grant(str(account[\"id\"]), profile_id)" in source
    assert "db.labs" not in source
    assert "db.vitals" not in source
    assert "db.medications" not in source
    assert "access_grants" in source


def test_family_roles_are_limited_to_viewer_or_editor():
    source = (ROOT / "family_api.py").read_text(encoding="utf-8")
    assert 'Literal["viewer", "editor"]' in source
    assert 'Owner access cannot be revoked here' in source


def test_profile_list_is_derived_from_access_grants_not_all_profiles():
    source = (ROOT / "profile_api.py").read_text(encoding="utf-8")
    assert "active_grants" in source
    assert 'db.access_grants.find({"account_id": account["id"]}' in source
    assert 'if str(d.get("id")) in active_grants' in source
    assert 'out["access_role"] = access_role' in source


def test_frontend_switches_subject_by_profile_id_and_surfaces_role():
    family = (ROOT.parent / "frontend" / "app" / "family.tsx").read_text(encoding="utf-8")
    store = (ROOT.parent / "frontend" / "src" / "store.tsx").read_text(encoding="utf-8")
    assert "setActive(p.id)" in family
    assert "p.access_role" in family
    assert 'const ACTIVE_KEY = "aida.activeProfileId"' in store
    assert '`${ACTIVE_KEY}.${account.id}`' in store
    assert '`${PROFILE_CACHE_KEY}.${account.id}`' in store
    assert "profiles.find((p) => p.id === activeId)" in store
