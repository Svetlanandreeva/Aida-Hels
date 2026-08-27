from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
AUTH_SCREEN = ROOT / "frontend" / "app" / "auth.tsx"


def test_social_oauth_start_timeout_allows_production_storage_latency():
    source = AUTH_SCREEN.read_text(encoding="utf-8")
    match = re.search(r"SOCIAL_START_TIMEOUT_MS\s*=\s*(\d+)", source)
    assert match, "Auth screen must keep a named social OAuth start timeout"
    assert int(match.group(1)) >= 20000
    assert "withTimeout(startSocialLogin(provider, returnUri), SOCIAL_START_TIMEOUT_MS" in source


def test_social_oauth_timeout_message_stays_specific_to_social_start():
    source = AUTH_SCREEN.read_text(encoding="utf-8")
    assert "Сервис входа отвечает слишком долго" in source
    assert "social_${provider}" in source
