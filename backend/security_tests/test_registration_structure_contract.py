from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_landing_signup_ctas_open_dedicated_registration_screen():
    landing = (ROOT / "frontend" / "src" / "emergent" / "screens" / "Landing.tsx").read_text(encoding="utf-8")
    assert 'mode === "register" ? "/register" : "/auth"' in landing
    assert landing.count('goAuth("register")') >= 2


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
        'provider="yandex"',
        'provider="vk"',
        'Создайте аккаунт — личные данные добавим следующим шагом.',
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
    assert 'личные данные добавим следующим шагом.' in register
    assert "name" in onboarding.lower()


def test_registration_uses_emergent_auth_hierarchy():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    assert 'styles.segment' in register
    assert 'styles.formWrap' in register
    assert 'styles.brandRow' in register
    assert 'styles.logoDot' in register
    assert 'colors.brandPrimary' in register


def test_registration_no_longer_claims_phone_is_collected_on_step_one():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    assert "он сохранится в аккаунте" not in register
    assert "Phone sign-in and recovery are a separate backend step" not in register
    assert "Создайте аккаунт" in register


def test_email_verification_does_not_open_the_app_without_a_session():
    register = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    verification = register.index("if (result.verification_required)")
    navigation = register.index('router.replace("/onboarding" as any)', verification)
    assert 'setVerificationEmail(result.email)' in register[verification:navigation]
    assert 'return;' in register[verification:navigation]
    assert 'resendVerification(verificationEmail)' in register
    assert 'testID="register-go-login"' in register
