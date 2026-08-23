from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LANDING = ROOT / "frontend" / "src" / "emergent" / "screens" / "Landing.tsx"
DEMO = ROOT / "frontend" / "app" / "demo.tsx"
LAYOUT = ROOT / "frontend" / "app" / "_layout.tsx"


def test_landing_demo_button_opens_the_public_demo_route():
    landing = LANDING.read_text(encoding="utf-8")
    layout = LAYOUT.read_text(encoding="utf-8")

    assert 'testID="hero-demo-button"' in landing
    assert 'router.push("/demo" as any)' in landing
    assert '"demo"' in layout.split("const PUBLIC_ROUTES", 1)[1].split(";", 1)[0]
    assert '<Stack.Screen name="demo" />' in layout


def test_demo_keeps_the_original_interactive_emergent_content():
    demo = DEMO.read_text(encoding="utf-8")

    assert 'const d = t.demo' in demo
    assert 'testID={`demo-task-${index}`}' in demo
    assert "setTasks" in demo
    assert 'testID="demo-back-cta"' in demo
    assert "/auth" not in demo
