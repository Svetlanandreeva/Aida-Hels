from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOG_PROVIDER = ROOT / "frontend" / "src" / "components" / "LogProvider.tsx"


def source() -> str:
    return LOG_PROVIDER.read_text(encoding="utf-8")


def test_lab_upload_never_silently_drops_selected_file_without_target():
    text = source()
    assert "labTarget || activeId || profiles[0]?.id" in text
    assert "Сначала выберите профиль" in text
    assert 'testID="lab-upload-error"' in text


def test_web_document_picker_preserves_browser_file_via_object_url():
    text = source()
    assert "(a as any).file" in text
    assert "URL.createObjectURL(browserFile)" in text
    assert "URL.revokeObjectURL(uploadUri)" in text
    assert "copyToCacheDirectory: true" in text
