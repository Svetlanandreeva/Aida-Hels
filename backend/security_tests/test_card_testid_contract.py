from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CARD_SOURCE = ROOT / "frontend" / "src" / "emergent" / "health.tsx"


def test_card_accepts_and_forwards_test_id():
    source = CARD_SOURCE.read_text(encoding="utf-8")
    assert "testID?: string" in source
    assert "<View testID={testID}" in source
