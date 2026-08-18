from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_registration_keyboard_flow_and_autofill_contract():
    source = read("frontend/app/register.tsx")
    assert "useRef<TextInput>" in source
    assert 'autoComplete="name"' in source
    assert 'autoComplete="email"' in source
    assert 'autoComplete="tel"' in source
    assert source.count('autoComplete="new-password"') >= 2
    assert 'returnKeyType="next"' in source
    assert 'returnKeyType="done"' in source
    assert "emailRef.current?.focus()" in source
    assert "phoneRef.current?.focus()" in source
    assert "passwordRef.current?.focus()" in source
    assert "confirmRef.current?.focus()" in source


def test_registration_accessibility_contract():
    source = read("frontend/app/register.tsx")
    assert 'accessibilityRole="checkbox"' in source
    assert "accessibilityState={{ checked: consent }}" in source
    assert 'accessibilityRole="link"' in source
    assert 'accessibilityRole="alert"' in source
    assert "accessibilityLiveRegion=\"polite\"" in source
    assert "accessibilityState={{ disabled: busy, busy }}" in source
    assert "showPassword ?" in source
    assert "minHeight: 44" in source


def test_registration_keeps_design_lock_geometry():
    source = read("frontend/app/register.tsx")
    assert 'maxWidth: 620' in source
    assert 'minHeight: 54' in source
    assert 'borderRadius: radius.pill' in source
    assert 'backgroundColor: colors.surface' in source
