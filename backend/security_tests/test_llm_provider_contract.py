import asyncio
from pathlib import Path

import pytest

from llm_provider import (
    DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    FileContentWithMimeType,
    LlmChat,
    PROVIDER_CONTRACT_VERSION,
    ProviderUnavailableError,
    UserMessage,
)


def test_provider_contract_has_no_private_runtime_dependency():
    source = Path(__file__).resolve().parents[1].joinpath("llm_provider.py").read_text()
    assert "from emergentintegrations" not in source
    assert "import emergentintegrations" not in source


def test_legacy_message_shape_is_preserved():
    attachment = FileContentWithMimeType(file_path="/tmp/lab.pdf", mime_type="application/pdf")
    message = UserMessage(text="parse", file_contents=[attachment])
    chat = LlmChat(api_key="test", session_id="session", system_message="system").with_model(
        DEFAULT_PROVIDER, DEFAULT_MODEL
    )

    assert PROVIDER_CONTRACT_VERSION == "aida-llm-v1"
    assert message.text == "parse"
    assert message.file_contents[0].mime_type == "application/pdf"
    assert chat.provider == DEFAULT_PROVIDER
    assert chat.model == DEFAULT_MODEL


def test_unconfigured_provider_fails_closed_with_clear_error():
    chat = LlmChat(api_key="test", session_id="session", system_message="system")

    with pytest.raises(ProviderUnavailableError, match="not configured"):
        asyncio.run(chat.send_message(UserMessage(text="hello")))
