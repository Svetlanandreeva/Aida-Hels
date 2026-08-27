from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_lab_ocr_does_not_require_drive_configuration():
    drive = read("backend/google_drive_storage.py")
    assert "class EphemeralDriveStorage" in drive
    assert 'GOOGLE_SERVICE_ACCOUNT_JSON' in drive
    assert 'GOOGLE_DRIVE_UPLOADS_FOLDER_ID' in drive
    assert "if not raw or not folder_id:" in drive
    assert "return EphemeralDriveStorage()" in drive


def test_invalid_drive_configuration_cannot_block_lab_recognition():
    drive = read("backend/google_drive_storage.py")
    assert "try:" in drive
    assert "return GoogleDriveStorage(raw, folder_id)" in drive
    assert "except Exception:" in drive
    assert drive.count("return EphemeralDriveStorage()") >= 2
