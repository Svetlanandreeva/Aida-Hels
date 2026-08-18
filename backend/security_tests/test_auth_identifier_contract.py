from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_backend_login_and_recovery_use_identifier_not_email_only():
    source = (ROOT / "backend" / "auth_api.py").read_text(encoding="utf-8")
    assert "class LoginRequest" in source
    assert "identifier: str" in source
    assert "class ForgotPasswordRequest" in source
    assert "_find_account_by_identifier" in source
    assert "Phone" not in source  # no separate phone-only endpoint; one identifier contract
    assert 'account.get("email")' in source


def test_frontend_exposes_email_or_phone_for_login_and_recovery():
    provider = (ROOT / "frontend" / "src" / "auth.tsx").read_text(encoding="utf-8")
    screen = (ROOT / "frontend" / "app" / "auth.tsx").read_text(encoding="utf-8")
    assert '{ identifier: identifier.trim(), password }' in provider
    assert '{ identifier: identifier.trim() }' in provider
    assert 'Email или телефон' in screen
    assert 'auth-identifier' in screen
    assert 'привязанный email' in screen
