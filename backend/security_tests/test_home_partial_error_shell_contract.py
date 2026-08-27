from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOME = ROOT / "frontend" / "src" / "emergent" / "screens" / "Home.tsx"


def test_home_keeps_dashboard_visible_during_loading_and_errors():
    source = HOME.read_text(encoding="utf-8")
    assert "if (health.loading)" not in source
    assert "if (health.error)" not in source
    assert 'testID="home-loading-inline"' in source
    assert 'testID="home-load-error-inline"' in source
    assert "health.reload()" in source
    assert "<ScrollView" in source


def test_home_saved_data_message_is_inline_not_full_screen():
    source = HOME.read_text(encoding="utf-8")
    assert "Сохранённые данные остаются на экране" in source
    assert "saved values are already available below" in source
