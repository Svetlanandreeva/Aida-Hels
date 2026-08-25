from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REGISTER = ROOT / "frontend" / "app" / "register.tsx"


def test_registration_exposes_social_options_before_email_flow():
    source = REGISTER.read_text(encoding="utf-8")
    social = source.index('testID="register-social-options"')
    email_step = source.index('testID="register-email-step"')
    assert social < email_step
    assert 'testID={`register-social-${provider}`}' in source


def test_registration_is_two_step_for_compact_mobile_layout():
    source = REGISTER.read_text(encoding="utf-8")
    assert 'type RegisterStep = "email" | "password";' in source
    assert 'testID="register-email-continue"' in source
    assert 'testID="register-password-step"' in source
    assert 'testID="register-edit-email"' in source
    assert 'setStep("password")' in source


def test_password_fields_are_not_rendered_in_initial_email_branch():
    source = REGISTER.read_text(encoding="utf-8")
    email_branch = source.index('step === "email" ? (')
    password_branch = source.index('testID="register-password-step"')
    password_field = source.index('testID="register-password"')
    assert email_branch < password_branch < password_field
