from pathlib import Path


def _backend_source() -> str:
    return Path(__file__).resolve().parents[1].joinpath("lab_pipeline.py").read_text()


def _frontend_source(relative: str) -> str:
    root = Path(__file__).resolve().parents[2]
    return root.joinpath("frontend", relative).read_text()


def test_lab_upload_uses_production_gemini_adapter_and_stages_before_commit():
    source = _backend_source()

    assert "from llm_provider import FileContentWithMimeType, LlmChat, UserMessage" in source
    assert 'os.environ.get("GEMINI_API_KEY")' in source
    assert '.with_model("gemini"' in source
    assert '"status": "needs_review"' in source
    assert '"status": "awaiting_confirmation"' in source
    assert '"entity_type": "lab_import"' in source
    assert "await db.candidates.insert_one(candidate)" in source

    upload_block = source.split('@router.post("/labs/upload")', 1)[1].split('@router.get("/lab-imports/{import_id}/preview")', 1)[0]
    assert "await db.labs.insert_one" not in upload_block


def test_lab_review_routes_are_explicit_and_commit_is_user_confirmed():
    source = _backend_source()

    assert '@router.get("/lab-imports/{import_id}/preview")' in source
    assert '@router.patch("/lab-imports/{import_id}")' in source
    assert '@router.post("/lab-imports/{import_id}/commit")' in source
    assert '@router.post("/lab-imports/{import_id}/cancel")' in source
    assert '"verification_status": "user_confirmed"' in source
    assert '"status": "committing"' in source
    assert 'if not claim.get("matched_count")' in source

    commit_block = source.split('async def commit_lab_import', 1)[1].split('@router.post("/lab-imports/{import_id}/cancel")', 1)[0]
    assert "await db.labs.insert_one(lab_doc)" in commit_block


def test_lab_review_ui_requires_confirmation_and_supports_correction_or_cancel():
    provider = _frontend_source("src/components/LogProvider.tsx")
    api = _frontend_source("src/api.ts")

    assert "setLabPreview(preview)" in provider
    assert 'testID="lab-preview-confirm"' in provider
    assert 'testID="lab-preview-cancel"' in provider
    assert "await api.updateLabImport" in provider
    assert "await api.commitLabImport" in provider
    assert "await api.cancelLabImport" in provider
    assert "Анализ распознан и сохранён" not in provider

    assert "updateLabImport:" in api
    assert "commitLabImport:" in api
    assert "cancelLabImport:" in api


def test_lab_ocr_prompt_forbids_fabricated_medical_values():
    source = _backend_source()

    assert "Не придумывай отсутствующие значения" in source
    assert "Не угадывай значения, нормы, даты и названия" in source
    assert "Если показатель не читается — не добавляй его" in source
