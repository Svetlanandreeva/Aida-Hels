from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_medical_card_keeps_shell_available_during_partial_loading_failures():
    source = read("frontend/app/medical-card.tsx")
    assert "MEDICAL_CARD_LOAD_TIMEOUT_MS = 3500" in source
    assert "Promise.allSettled" in source
    assert 'medical_card_medications' in source
    assert 'medical_card_documents' in source
    assert 'testID="medical-card-loading"' in source
    assert 'testID="medical-card-retry"' in source
    assert "if (loading)" not in source
    assert "if (error)" not in source
