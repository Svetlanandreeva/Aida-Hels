from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DOCUMENTS = ROOT / "frontend" / "app" / "documents.tsx"


def test_web_document_upload_uses_browser_blob_and_bounded_request():
    source = DOCUMENTS.read_text(encoding="utf-8")
    assert 'Platform.OS === "web"' in source
    assert "fetch(file.uri)" in source
    assert "fileResponse.blob()" in source
    assert 'form.append("file", blob, file.name)' in source
    assert 'apiFetch("/documents/upload"' in source
    assert '12000' in source
    assert '"document_upload"' in source


def test_document_upload_failure_keeps_retryable_user_state():
    source = DOCUMENTS.read_text(encoding="utf-8")
    assert "setUploadError" in source
    assert "setPendingFile(file)" in source
    assert 'testID="document-upload-error"' in source
    assert "Повторить отправку" in source
    assert "uploadSelected(pendingFile)" in source


def test_native_document_upload_path_remains_available():
    source = DOCUMENTS.read_text(encoding="utf-8")
    assert "api.uploadDocument(activeId, type, note, file)" in source
