from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_gemini_36_request_avoids_deprecated_sampling_parameters():
    source = read("backend/llm_provider.py")
    assert 'DEFAULT_MODEL = "gemini-3.6-flash"' in source
    assert '"responseMimeType": "application/json"' in source
    assert '"temperature":' not in source


def test_screen_header_has_safe_fallback_when_browser_history_is_empty():
    source = read("frontend/src/components/ScreenHeader.tsx")
    assert "router.canGoBack()" in source
    assert "router.replace(fallbackHref as any)" in source
    assert 'fallbackHref = "/"' in source
