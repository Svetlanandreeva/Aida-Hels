from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_async_timeout_helper_exists():
    source = read("frontend/src/async.ts")
    assert "Promise.race" in source
    assert "withTimeout" in source


def test_devices_never_block_entire_screen_on_request():
    source = read("frontend/app/devices.tsx")
    assert "Promise.allSettled" in source
    assert "withTimeout(wearableStatus" in source
    assert "loadError" in source
    assert "Повторить" in source
    assert "{loading ? <View style={styles.center}" not in source


def test_body_keeps_shell_visible_and_times_out_independent_requests():
    source = read("frontend/app/body.tsx")
    assert "Promise.allSettled" in source
    assert "withTimeout(api.biologicalAge" in source
    assert "withTimeout(getBodySystems" in source
    assert "systemsError" in source
    assert "ageError" in source
    assert "Обновляем данные организма" in source


def test_auth_recovery_is_adjacent_to_password_and_legal_links_exist():
    source = read("frontend/app/auth.tsx")
    password_pos = source.index('testID="auth-password"')
    forgot_pos = source.index('testID="auth-forgot-link"')
    submit_pos = source.index('testID="auth-submit"')
    assert password_pos < forgot_pos < submit_pos
    assert 'router.push("/terms")' in source
    assert 'router.push("/privacy-policy")' in source
    assert "Продолжая, вы соглашаетесь" in source
    assert "withTimeout(startSocialLogin" in source
