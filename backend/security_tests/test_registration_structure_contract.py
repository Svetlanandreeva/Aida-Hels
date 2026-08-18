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
        'register(name.trim(), cleanEmail, password, cleanPhone || null)',
        'testID="register-phone"',
    ]
    for token in required_tokens:
        assert token in register, f"registration hierarchy token missing: {token}"


def test_registration_phone_is_sent_and_persisted_by_verified_signup_flow():
    auth = (ROOT / "frontend" / "src" / "auth.tsx").read_text(encoding="utf-8")
    signup = (ROOT / "backend" / "email_signup.py").read_text(encoding="utf-8")

    assert 'phone: phone?.trim() || null' in auth
    assert 'phone: Optional[str]' in signup
    assert 'phone = _phone(data.phone)' in signup
    assert '"phone": phone' in signup
    assert 'Phone number already in use' in signup


def test_registration_no_longer_claims_phone_is_disconnected():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    assert "Вход и восстановление по телефону подключаются отдельным backend-шагом" not in register
    assert "Phone sign-in and recovery are a separate backend step" not in register
    assert "он сохранится в аккаунте" in register
