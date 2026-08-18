from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_public_landing_is_not_blocked_by_auth_or_profile_bootstrap():
    layout = read("frontend/app/_layout.tsx")
    assert 'const PUBLIC_ROUTES = new Set(["", "auth", "register", "reset-password", "terms", "privacy-policy"])' in layout
    assert "if (publicRoute) return stack;" in layout
    assert "PUBLIC_ROUTES.has(route) || loading || !activeProfile" in layout
    assert 'if (Platform.OS !== "web" && !loaded && !error)' in layout


def test_session_and_profile_bootstrap_are_time_bounded():
    auth = read("frontend/src/auth.tsx")
    store = read("frontend/src/store.tsx")
    assert "SESSION_RESTORE_TIMEOUT_MS = 3000" in auth
    assert 'withTimeout((async () => {' in auth
    assert '"auth_restore"' in auth
    assert "PROFILE_BOOTSTRAP_TIMEOUT_MS = 3500" in store
    assert 'withTimeout(api.listProfiles(), PROFILE_BOOTSTRAP_TIMEOUT_MS, "profiles_list")' in store
    assert '"profile_create"' in store
