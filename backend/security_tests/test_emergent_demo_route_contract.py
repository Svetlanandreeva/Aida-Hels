from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LANDING = ROOT / "frontend" / "src" / "emergent" / "screens" / "Landing.tsx"
DEMO = ROOT / "frontend" / "app" / "demo.tsx"
LAYOUT = ROOT / "frontend" / "app" / "_layout.tsx"


def test_landing_demo_button_opens_the_public_demo_route():
    landing = LANDING.read_text(encoding="utf-8")
    layout = LAYOUT.read_text(encoding="utf-8")

    # The legacy /demo route remains a compatibility entry point, but the
    # visible CTA is now labelled as login and the route redirects to auth.
    assert 'testID="hero-demo-button"' in landing
    assert 'router.push("/demo" as any)' in landing
    assert '"demo"' in layout.split("const PUBLIC_ROUTES", 1)[1].split(";", 1)[0]
    assert '<Stack.Screen name="demo" />' in layout


def test_demo_route_redirects_to_auth_instead_of_rendering_demo_content():
    demo = DEMO.read_text(encoding="utf-8")

    assert 'import { Redirect } from "expo-router"' in demo
    assert 'return <Redirect href="/auth" />' in demo
    assert 'const d = t.demo' not in demo
    assert 'demo-task-' not in demo
    assert 'setTasks' not in demo
