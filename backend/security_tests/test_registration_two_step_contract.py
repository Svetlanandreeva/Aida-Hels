from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_registration_keeps_social_options_before_email_step():
    source = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    social = source.index('testID="register-social-options"')
    email = source.index('testID="register-email-step"')
    password = source.index('testID="register-password-step"')
    assert social < email
    assert social < password


def test_registration_is_explicitly_two_step():
    source = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")
    assert 'type RegisterStep = "email" | "password"' in source
    assert 'setStep("password")' in source
    assert 'setStep("email")' in source
