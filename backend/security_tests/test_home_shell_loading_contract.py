from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HEALTH_CONTEXT = ROOT / "frontend" / "src" / "emergent" / "health-context.tsx"
HOME = ROOT / "frontend" / "src" / "emergent" / "screens" / "Home.tsx"


def test_home_does_not_enter_blocking_loading_mode():
    context = HEALTH_CONTEXT.read_text(encoding="utf-8")
    home = HOME.read_text(encoding="utf-8")

    assert "const [loading] = useState(false);" in context
    assert "setLoading(true)" not in context
    assert "useEffect(() => { void reload(); }, [reload, refreshTick]);" in context
    assert "if (health.loading)" in home
