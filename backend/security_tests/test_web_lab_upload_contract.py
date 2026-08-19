from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
API = ROOT / "frontend" / "src" / "api.ts"


def test_web_uploads_use_real_blob_and_keep_native_descriptor():
    source = API.read_text(encoding="utf-8")

    assert 'Platform.OS === "web"' in source
    assert 'fetch(file.uri)' in source
    assert 'fileResponse.blob()' in source
    assert 'form.append("file", blob, file.name)' in source
    assert 'form.append("file", { uri: file.uri, name: file.name, type: file.type })' in source


def test_lab_upload_is_bounded_and_uses_shared_multipart_path():
    source = API.read_text(encoding="utf-8")

    assert 'await appendUploadFile(form, file, "lab")' in source
    assert 'uploadForm<LabImportPreview>("/labs/upload", form, "lab_upload")' in source
    assert 'withTimeout(apiFetch(path, { method: "POST", body: form as any }), 15000, label)' in source
    assert 'withTimeout(fileResponse.blob(), 5000' in source
