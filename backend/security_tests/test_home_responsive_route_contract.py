from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_home_route_uses_separate_mobile_and_desktop_presentations():
    source = (ROOT / "frontend/app/(tabs)/index.tsx").read_text(encoding="utf-8")
    assert 'width >= 900' in source
    assert '<HomeEditorial />' in source
    assert '<DesktopHomeAdapter />' in source


def test_desktop_tab_bar_is_compact_and_not_full_bleed():
    source = (ROOT / "frontend/src/components/ResponsiveTabBar.tsx").read_text(encoding="utf-8")
    assert 'shellDesktop' in source
    assert 'innerDesktop' in source
    assert 'maxWidth: 920' in source
