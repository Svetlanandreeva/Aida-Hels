from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_home_route_splits_mobile_and_desktop():
    source = (ROOT / "frontend/app/(tabs)/index.tsx").read_text(encoding="utf-8")
    assert "width >= 900" in source
    assert "<HomeEditorial />" in source
    assert "<DesktopHomeAdapter />" in source
