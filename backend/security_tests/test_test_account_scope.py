from pathlib import Path


def test_test_account_seed_is_opt_in_and_profile_scoped():
    source = (Path(__file__).resolve().parents[1] / "test_account_seed.py").read_text(encoding="utf-8")

    assert 'AIDA_TEST_ACCOUNT_ENABLED' in source
    assert 'AIDA_TEST_ACCOUNT_PASSWORD' in source
    assert 'delete_many({"profile_id": profile_id})' in source
    assert '"profile_id": profile_id' in source
    assert 'is_test_account' in source
    assert 'is_test_profile' in source

    # Regression guard: never reintroduce the old global seed pattern.
    assert 'count_documents({})' not in source
    assert 'delete_many({})' not in source


def test_production_entrypoint_removes_legacy_global_seed():
    source = (Path(__file__).resolve().parents[1] / "main.py").read_text(encoding="utf-8")
    assert '"/api/seed"' in source
    assert 'getattr(handler, "__name__", "") != "_startup"' in source
    assert 'seed_test_account(_google_db)' in source
