from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
API = ROOT / "frontend" / "src" / "api.ts"
LLM = ROOT / "backend" / "llm_provider.py"


def test_lab_upload_client_waits_longer_than_gemini_ocr():
    api_source = API.read_text(encoding="utf-8")
    llm_source = LLM.read_text(encoding="utf-8")
    assert 'label === "lab_upload" ? 150000 : 15000' in api_source
    assert 'httpx.Timeout(90.0, connect=10.0)' in llm_source
