from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_landing_signup_ctas_open_dedicated_registration_screen():
    landing = (ROOT / "frontend" / "app" / "index.tsx").read_text(encoding="utf-8")
    assert 'router.push("/register")' in landing
    assert landing.count('router.push("/register")') >= 3


def test_registration_screen_is_auth_first_and_profile_second():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    required_tokens = [
        '"email"',
        '"password"',
        '"confirm"',
        '"consent"',
        'password !== confirm',
        'router.push("/terms"',
        'router.push("/privacy-policy"',
        'register("Мой профиль", cleanEmail, password, null)',
        'router.replace("/onboarding"',
        'Продолжить с Яндекс ID',
        'Продолжить с VK ID',
        'Дальше: имя, дата рождения, пол, рост, вес и цели.',
    ]
    for token in required_tokens:
        assert token in register, f"registration auth-first token missing: {token}"

    assert 'testID="register-phone"' not in register
    assert 'testID="register-name"' not in register


def test_email_registration_defers_personal_data_to_onboarding():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    onboarding = (ROOT / "frontend" / "app" / "onboarding.tsx").read_text(encoding="utf-8")

    assert 'Personal/profile data is intentionally collected on the next onboarding step.' in register
    assert 'router.replace("/onboarding"' in register
    assert 'Мой профиль' in register
    assert "name" in onboarding.lower()


def test_registration_no_longer_claims_phone_is_collected_on_step_one():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    assert "он сохранится в аккаунте" not in register
    assert "Phone sign-in and recovery are a separate backend step" not in register
    assert "Сначала выберите способ регистрации" in register
