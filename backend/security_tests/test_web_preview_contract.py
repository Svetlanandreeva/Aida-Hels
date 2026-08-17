from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUTH = ROOT / "frontend" / "src" / "auth.tsx"
STORE = ROOT / "frontend" / "src" / "store.tsx"
LAYOUT = ROOT / "frontend" / "app" / "_layout.tsx"


def test_web_preview_never_mints_or_sets_a_fake_bearer_token():
    auth = AUTH.read_text(encoding="utf-8")
    assert 'const WEB_PREVIEW_DEFAULT = Platform.OS === "web"' in auth
    assert "setPreview(WEB_PREVIEW_DEFAULT)" in auth
    assert 'setApiToken("preview' not in auth
    assert 'setToken("preview' not in auth


def test_web_preview_uses_only_a_local_blank_profile():
    store = STORE.read_text(encoding="utf-8")
    assert 'id: "preview-profile"' in store
    assert 'name: "Предпросмотр"' in store
    assert "onboarding_completed: true" in store
    assert "if (preview)" in store
    assert "setProfiles([PREVIEW_PROFILE])" in store


def test_router_can_render_internal_shell_without_treating_preview_as_authentication():
    layout = LAYOUT.read_text(encoding="utf-8")
    assert "const hasAppAccess = Boolean(token) || preview" in layout
    assert "if (!hasAppAccess) return stack" in layout
    assert "<AppProvider><ProfileGate><LogProvider>" in layout
