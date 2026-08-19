from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_registration_keyboard_flow_and_autofill_contract():
    source = read("frontend/app/register.tsx")
    assert 'autoComplete="email"' in source
    assert source.count('autoComplete="new-password"') >= 2
    assert source.count('returnKeyType="next"') >= 2
    assert 'returnKeyType="done"' in source
    assert 'onSubmitEditing={() => { if (consent && !busy) submitEmail(); }}' in source
    assert 'testID="register-email"' in source
    assert 'testID="register-password"' in source
    assert 'testID="register-confirm"' in source


def test_registration_accessibility_contract():
    source = read("frontend/app/register.tsx")
    assert 'accessibilityRole="checkbox"' in source
    assert "accessibilityState={{ checked: consent }}" in source
    assert 'accessibilityRole="link"' in source
    assert 'accessibilityRole="alert"' in source
    assert 'accessibilityLiveRegion="polite"' in source
    assert "accessibilityState={{ disabled: busy || socialBusy !== null, busy }}" in source
    assert "accessibilityState={{ disabled: busy || disabled, busy }}" in source
    assert "showPassword ?" in source
    assert "minHeight: 44" in source


def test_registration_social_methods_share_locked_visual_language():
    source = read("frontend/app/register.tsx")
    assert 'provider="yandex"' in source
    assert 'provider="vk"' in source
    assert "styles.socialButton" in source
    assert "styles.providerMark" in source


def test_registration_keeps_design_lock_geometry():
    source = read("frontend/app/register.tsx")
    assert 'maxWidth: 620' in source
    assert 'minHeight: 50' in source
    assert 'borderRadius: radius.md' in source
    assert 'backgroundColor: colors.surface' in source
