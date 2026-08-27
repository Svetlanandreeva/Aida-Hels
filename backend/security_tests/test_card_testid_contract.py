from pathlib import Path


def test_card_accepts_and_forwards_test_id():
    source = Path("frontend/src/emergent/health.tsx").read_text(encoding="utf-8")
    assert "testID?: string" in source
    assert "<View testID={testID}" in source
