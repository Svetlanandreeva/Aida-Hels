from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_email_registration_requires_verification_before_session():
    signup = (ROOT / "backend" / "email_signup.py").read_text(encoding="utf-8")
    main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    frontend_auth = (ROOT / "frontend" / "src" / "auth.tsx").read_text(encoding="utf-8")
    screen = (ROOT / "frontend" / "app" / "auth.tsx").read_text(encoding="utf-8")

    assert '"password_hash": ""' in signup
    assert '"pending_password_hash"' in signup
    assert '"email_verified_at": None' in signup
    assert 'router.post("/register")' in signup
    assert 'router.get("/verify-email")' in signup
    assert 'router.post("/resend-verification")' in signup
    assert 'auth_router.routes = [route for route in auth_router.routes' in main
    assert 'build_email_signup_router(_google_db)' in main
    assert 'verification_required' in frontend_auth
    assert 'resendVerification' in frontend_auth
    assert 'type Mode = "login" | "register" | "forgot" | "verify"' in screen
    assert 'src: "/aida-logo.svg"' in screen
    assert 'Продолжить с Яндекс ID' in screen
