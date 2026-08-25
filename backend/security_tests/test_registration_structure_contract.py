from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_landing_signup_ctas_open_dedicated_registration_screen():
    landing = (ROOT / "frontend" / "src" / "emergent" / "screens" / "Landing.tsx").read_text(encoding="utf-8")
    assert 'mode === "register" ? "/register" : "/auth"' in landing
    assert landing.count('goAuth("register")') >= 2


def test_registration_screen_is_auth_first_and_profile_second():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    required_tokens = [
        'type RegisterStep = "email" | "password"',
        'useState<RegisterStep>("email")',
        'testID="register-social-options"',
        'provider="yandex"',
        'provider="vk"',
        'testID="register-email-step"',
        'testID="register-password-step"',
        'testID="register-email-continue"',
        'password !== confirm',
        'router.push("/terms"',
        'router.push("/privacy-policy"',
        'register("Мой профиль", cleanEmail, password, null)',
        'router.replace("/onboarding"',
        'KeyboardAwareScrollView',
        'LangToggle',
        'ThemeToggle',
    ]
    for token in required_tokens:
        assert token in register, f"registration auth-first token missing: {token}"

    assert 'testID="register-phone"' not in register
    assert 'testID="register-name"' not in register


def test_email_registration_defers_personal_data_to_onboarding():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    onboarding = (ROOT / "frontend" / "app" / "onboarding.tsx").read_text(encoding="utf-8")

    assert 'router.replace("/onboarding"' in register
    assert 'Мой профиль' in register
    assert 'личные данные' not in register
    assert "name" in onboarding.lower()


def test_registration_uses_emergent_auth_hierarchy():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    assert 'styles.segment' in register
    assert 'styles.formWrap' in register
    assert 'styles.socialGroup' in register
    assert 'colors.brandPrimary' in register


def test_registration_no_longer_claims_phone_is_collected_on_step_one():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    assert "он сохранится в аккаунте" not in register
    assert "Phone sign-in and recovery are a separate backend step" not in register
    assert "Выберите быстрый вход или зарегистрируйтесь по email." in register


def test_email_registration_navigates_only_after_session_creation():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    session = register.index('await withTimeout(register("Мой профиль", cleanEmail, password, null)')
    navigation = register.index('router.replace("/onboarding" as any)', session)
    assert session < navigation
    assert "verification_required" not in register
