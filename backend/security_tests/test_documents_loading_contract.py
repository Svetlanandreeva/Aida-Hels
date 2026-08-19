from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_documents_screen_keeps_shell_available_and_bounds_list_refresh():
    source = read("frontend/app/documents.tsx")
    assert "DOCUMENTS_TIMEOUT_MS = 3500" in source
    assert "withTimeout(api.listDocuments(activeId), DOCUMENTS_TIMEOUT_MS" in source
    assert 'testID="upload-medical-document"' in source
    assert 'testID="documents-loading-state"' in source
    assert 'testID="documents-error-state"' in source
    assert "Previously loaded documents remain available" in source
    assert "Здесь появятся медицинские документы, которые вы загрузите в профиль." in source
    assert "Original medical files from Google Drive will appear here." not in source
