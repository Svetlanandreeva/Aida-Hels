from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
COMPAT = ROOT / "frontend" / "src" / "lab-runtime-compat.ts"
API = ROOT / "frontend" / "src" / "api.ts"


def test_lab_runtime_compat_does_not_override_hardened_upload_path():
    compat = COMPAT.read_text(encoding="utf-8")
    api = API.read_text(encoding="utf-8")

    assert "api.uploadLab =" not in compat
    assert "originalUploadLab" not in compat
    assert "appendWebFile" not in compat
    assert 'await appendUploadFile(form, file, "lab")' in api
    assert 'uploadForm<LabImportPreview>("/labs/upload", form, "lab_upload")' in api


def test_lab_runtime_compat_keeps_bounded_list_and_review_operations():
    compat = COMPAT.read_text(encoding="utf-8")

    assert "LAB_LIST_TIMEOUT_MS = 7000" in compat
    assert "LAB_SAVE_TIMEOUT_MS = 15000" in compat
    assert "withTimeout(originalListLabs" in compat
    assert "withTimeout(originalUpdateLabImport" in compat
    assert "withTimeout(originalCommitLabImport" in compat
