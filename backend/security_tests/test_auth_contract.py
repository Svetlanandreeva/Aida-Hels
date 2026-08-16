from pathlib import Path


AUTH = Path(__file__).resolve().parents[1] / "auth_api.py"
FRONTEND_AUTH = Path(__file__).resolve().parents[2] / "frontend" / "src" / "auth.tsx"
AUTH_SCREEN = Path(__file__).resolve().parents[2] / "frontend" / "app" / "auth.tsx"
RESET_SCREEN = Path(__file__).resolve().parents[2] / "frontend" / "app" / "reset-password.tsx"
DEPLOY = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "deploy-ruvds.yml"


def test_passwords_and_reset_tokens_are_not_stored_in_plaintext():
    source = AUTH.read_text(encoding="utf-8")
    assert "bcrypt.hashpw" in source
    assert "bcrypt.checkpw" in source
    assert "hashlib.sha256" in source
    assert '"password_hash"' in source
    assert '"token_hash"' in source
    assert '"password": data.password' not in source
    assert '"token": raw_token' not in source


def test_forgot_password_is_enumeration_safe_and_reset_revokes_sessions():
    source = AUTH.read_text(encoding="utf-8")
    assert "Always return the same response to avoid email/account enumeration" in source
    assert 'return {"ok": True}' in source
    assert "revoke_all_sessions(account_id)" in source
    assert "used_at" in source
    assert "expires_at" in source


def test_frontend_supports_session_restore_and_complete_reset_flow():
    auth = FRONTEND_AUTH.read_text(encoding="utf-8")
    reset = RESET_SCREEN.read_text(encoding="utf-8")
    assert 'apiFetch("/auth/me"' in auth
    assert 'authRequest("/auth/register"' in auth
    assert 'authRequest("/auth/login"' in auth
    assert 'authRequest("/auth/forgot-password"' in auth
    assert 'authRequest("/auth/reset-password"' in auth
    assert "secureSet(AUTH_TOKEN_KEY" in auth
    assert "secureRemove(AUTH_TOKEN_KEY" in auth
    assert "useLocalSearchParams" in reset
    assert "resetPassword(token, password)" in reset


def test_production_deploy_bootstraps_jwt_secret_without_rotating_valid_sessions():
    deploy = DEPLOY.read_text(encoding="utf-8")
    assert "Ensure persistent production auth secret" in deploy
    assert "JWT_SECRET" in deploy
    assert "secrets.token_hex(32)" in deploy
    assert "if existing and len(existing) >= 32:" in deploy
    assert "chmod 600 .env" in deploy
    assert "preserving existing value" in deploy


def test_auth_screen_distinguishes_server_configuration_and_network_failures():
    screen = AUTH_SCREEN.read_text(encoding="utf-8")
    assert "Authentication is not configured" in screen
    assert "Request failed (503)" in screen
    assert "Failed to fetch" in screen
    assert "Network request failed" in screen
    assert "Сервис входа и регистрации ещё настраивается на сервере" in screen
    assert "Нет связи с сервером" in screen
