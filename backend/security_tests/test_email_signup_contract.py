from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_email_registration_creates_session_without_verification_gate():
    main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    auth_api = (ROOT / "backend" / "auth_api.py").read_text(encoding="utf-8")
    frontend_auth = (ROOT / "frontend" / "src" / "auth.tsx").read_text(encoding="utf-8")
    register_screen = (ROOT / "frontend" / "app" / "register.tsx").read_text(encoding="utf-8")

    assert '@router.post("/register")' in auth_api
    assert 'session = await service.create_session(account_id)' in auth_api
    assert 'return {**session, "account": _public_account(account), "profile_id": profile_id}' in auth_api

    auth_index = main.index('app.include_router(auth_router)')
    legacy_email_index = main.index('app.include_router(build_email_signup_router(_google_db))')
    assert auth_index < legacy_email_index

    assert 'await withTimeout(register("Мой профиль", cleanEmail, password, null)' in register_screen
    assert 'router.replace("/onboarding"' in register_screen
    assert 'verification_required' not in register_screen
    assert 'Подтвердите email' not in register_screen
    assert 'const register = useCallback' in frontend_auth


def test_legacy_verification_routes_remain_available_but_do_not_gate_primary_register():
    signup = (ROOT / "backend" / "email_signup.py").read_text(encoding="utf-8")
    main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")

    assert 'router.get("/verify-email")' in signup
    assert 'router.post("/resend-verification")' in signup
    assert 'build_email_signup_router(_google_db)' in main
    assert 'app.include_router(auth_router)' in main
