from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_lab_ocr_does_not_require_drive_folder_configuration():
    drive = read("backend/google_drive_storage.py")
    pipeline = read("backend/lab_pipeline.py")
    assert "class EphemeralDriveStorage" in drive
    assert "if not folder_id:" in drive
    assert "return EphemeralDriveStorage()" in drive
    assert 'GOOGLE_DRIVE_UPLOADS_FOLDER_ID' in drive
    assert 'if not drive:' in pipeline
    assert 'Google Drive storage is not configured' in pipeline
