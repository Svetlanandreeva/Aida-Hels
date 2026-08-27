from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_social_oauth_callback_has_specific_storage_diagnostics():
    source = (ROOT / "backend" / "social_auth.py").read_text(encoding="utf-8")
    assert "Social OAuth account persistence failed" in source
    assert '"oauth_error": "temporary_unavailable"' in source


def test_yandex_oauth_contract_uses_current_pkce_flow():
    source = (ROOT / "backend" / "social_auth.py").read_text(encoding="utf-8")
    assert '"code_challenge_method": "S256"' in source
    assert '"code_verifier": state_record["code_verifier"]' in source
    assert '"https://oauth.yandex.ru/token"' in source
