from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_auth_keeps_recovery_near_password_and_legal_links():
    source = read("frontend/app/auth.tsx")
    assert 'testID="auth-forgot-link"' in source
    assert source.index('testID="auth-forgot-link"') < source.index('testID="auth-submit"')
    assert 'router.push("/terms")' in source
    assert 'router.push("/privacy-policy")' in source
    assert "Продолжая, вы соглашаетесь с" in source


def test_social_and_data_requests_are_time_bounded():
    auth = read("frontend/app/auth.tsx")
    devices = read("frontend/app/devices.tsx")
    body = read("frontend/app/body.tsx")
    helper = read("frontend/src/async.ts")
    assert "Promise.race" in helper
    assert "withTimeout(startSocialLogin" in auth
    assert "withTimeout(wearableStatus" in devices
    assert "Promise.allSettled" in devices
    assert "Promise.allSettled" in body
    assert "withTimeout(api.biologicalAge" in body
    assert "withTimeout(getBodySystems" in body


def test_organism_does_not_fail_whole_screen_for_one_request():
    source = read("frontend/app/body.tsx")
    assert "systemsError" in source
    assert "ageError" in source
    assert "Promise.allSettled" in source
    assert "Promise.all([api.biologicalAge" not in source


def test_promo_uses_approved_logo_asset_on_web():
    source = read("frontend/app/index.tsx")
    assert 'uri: "/aida-logo.svg"' in source
    assert "brandLogoCompact" in source
