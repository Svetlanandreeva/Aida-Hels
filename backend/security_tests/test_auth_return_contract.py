from pathlib import Path


ROOT_LAYOUT = Path(__file__).resolve().parents[2] / "frontend" / "app" / "_layout.tsx"
REGISTER_SCREEN = Path(__file__).resolve().parents[2] / "frontend" / "app" / "register.tsx"
RESET_SCREEN = Path(__file__).resolve().parents[2] / "frontend" / "app" / "reset-password.tsx"


def test_only_public_root_performs_global_authenticated_redirect():
    source = ROOT_LAYOUT.read_text(encoding="utf-8")
    assert 'if (hasAppAccess && route === "") router.replace("/(tabs)" as any);' in source
    assert 'route === "auth" || route === "register"' not in source


def test_authenticated_session_mounts_app_providers_on_public_auth_routes():
    source = ROOT_LAYOUT.read_text(encoding="utf-8")
    assert 'if (publicRoute && !hasAppAccess) return stack;' in source
    assert 'if (publicRoute) return stack;' not in source


def test_registration_and_reset_own_their_success_navigation():
    register_source = REGISTER_SCREEN.read_text(encoding="utf-8")
    reset_source = RESET_SCREEN.read_text(encoding="utf-8")
    assert 'router.replace("/onboarding" as any)' in register_source
    assert 'router.replace("/(tabs)" as any)' in reset_source
