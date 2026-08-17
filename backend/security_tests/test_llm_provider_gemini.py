from pathlib import Path

import pytest

import llm_provider


class FakeResponse:
    status_code = 200

    def json(self):
        return {"candidates": [{"content": {"parts": [{"text": '{"ok":true}'}]}}]}


class FakeClient:
    last_url = None
    last_headers = None
    last_json = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers=None, json=None):
        type(self).last_url = url
        type(self).last_headers = headers
        type(self).last_json = json
        return FakeResponse()


@pytest.mark.asyncio
async def test_gemini_provider_sends_inline_document(monkeypatch, tmp_path: Path):
    sample = tmp_path / "lab.pdf"
    sample.write_bytes(b"%PDF-test")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.setattr(llm_provider.httpx, "AsyncClient", FakeClient)

    chat = llm_provider.LlmChat("legacy-key", "session", "system").with_model(
        "gemini", "gemini-3-flash-preview"
    )
    result = await chat.send_message(
        llm_provider.UserMessage(
            text="extract",
            file_contents=[llm_provider.FileContentWithMimeType(str(sample), "application/pdf")],
        )
    )

    assert result == '{"ok":true}'
    assert FakeClient.last_url.endswith("/models/gemini-3.6-flash:generateContent")
    assert FakeClient.last_headers["x-goog-api-key"] == "test-key"
    parts = FakeClient.last_json["contents"][0]["parts"]
    assert parts[0] == {"text": "extract"}
    assert parts[1]["inlineData"]["mimeType"] == "application/pdf"
    assert parts[1]["inlineData"]["data"]
    assert FakeClient.last_json["generationConfig"]["responseMimeType"] == "application/json"


@pytest.mark.asyncio
async def test_gemini_provider_rejects_missing_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    chat = llm_provider.LlmChat("", "session", "system").with_model("gemini", "gemini-3.6-flash")
    with pytest.raises(llm_provider.ProviderUnavailableError, match="GEMINI_API_KEY"):
        await chat.send_message(llm_provider.UserMessage(text="hello"))
