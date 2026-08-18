from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_body_uses_system_tiles_instead_of_silhouette():
    source = read("frontend/app/body.tsx")
    assert "SYSTEM_ICONS" in source
    assert "body-system-tile-" in source
    assert "styles.silhouette" not in source
    assert "MAP_POINTS" not in source
