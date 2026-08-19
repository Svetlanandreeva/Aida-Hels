from pathlib import Path


ROOT_LAYOUT = Path(__file__).resolve().parents[2] / "frontend" / "app" / "_layout.tsx"


def test_authenticated_public_auth_routes_return_to_private_app():
    source = ROOT_LAYOUT.read_text(encoding="utf-8")
    assert 'route === "" || route === "auth" || route === "register" || route === "reset-password"' in source
    assert 'router.replace("/(tabs)" as any)' in source
