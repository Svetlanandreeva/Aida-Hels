from pathlib import Path


def test_lab_upload_uses_production_gemini_adapter_and_review_gate():
    source = Path(__file__).resolve().parents[1].joinpath("lab_pipeline.py").read_text()

    assert "from llm_provider import FileContentWithMimeType, LlmChat, UserMessage" in source
    assert 'os.environ.get("GEMINI_API_KEY")' in source
    assert '.with_model("gemini"' in source
    assert '"verification_status": "unverified"' in source
    assert '"status": "needs_review"' in source
    assert '"status": "recognized"' in source


def test_lab_ocr_prompt_forbids_fabricated_medical_values():
    source = Path(__file__).resolve().parents[1].joinpath("lab_pipeline.py").read_text()

    assert "Не придумывай отсутствующие значения" in source
    assert "Не угадывай значения, нормы, даты и названия" in source
    assert "Если показатель не читается — не добавляй его" in source
