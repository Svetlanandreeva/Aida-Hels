from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_landing_signup_ctas_open_dedicated_registration_screen():
    landing = (ROOT / "frontend" / "app" / "index.tsx").read_text(encoding="utf-8")
    assert 'router.push("/register")' in landing
    assert landing.count('router.push("/register")') >= 3


def test_registration_screen_contains_required_hierarchy_fields_and_validation():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    required_tokens = [
        '"name"',
        '"email"',
        '"phone"',
        '"password"',
        '"confirm"',
        '"consent"',
        'password !== confirm',
        'router.push("/terms"',
        'router.push("/privacy"',
        'register(name.trim(), cleanEmail, password)',
    ]
    for token in required_tokens:
        assert token in register, f"registration hierarchy token missing: {token}"


def test_phone_limit_is_disclosed_until_backend_phone_auth_exists():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    assert "Вход и восстановление по телефону подключаются отдельным backend-шагом" in register
    assert "Phone sign-in and recovery are a separate backend step" in register
