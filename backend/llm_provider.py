"""Explicit LLM provider contract for Aida's legacy-compatible AI/OCR routes.

This module is the only backend surface allowed to define the legacy
LlmChat/UserMessage/FileContentWithMimeType contract. It deliberately has no
runtime dependency on the private ``emergentintegrations`` package.

Until a supported provider adapter is configured, chat/OCR calls fail with a
clear ProviderUnavailableError while the rest of the production backend can
start and serve non-AI routes normally.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

PROVIDER_CONTRACT_VERSION = "aida-llm-v1"
DEFAULT_PROVIDER = "gemini"
DEFAULT_MODEL = "gemini-3-flash-preview"


class ProviderUnavailableError(RuntimeError):
    """Raised when an AI/OCR route is called without a supported provider."""


@dataclass(slots=True)
class FileContentWithMimeType:
    file_path: str
    mime_type: str


@dataclass(slots=True)
class UserMessage:
    text: str
    file_contents: list[FileContentWithMimeType] = field(default_factory=list)


class LlmChat:
    """Stable legacy-compatible facade used by existing Aida routes.

    The facade keeps route code provider-agnostic. A supported production
    adapter can replace ``send_message`` behind this contract without requiring
    medical/business endpoints to import a provider-specific SDK.
    """

    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.provider: str | None = None
        self.model: str | None = None

    def with_model(self, provider: str, model: str) -> "LlmChat":
        self.provider = provider
        self.model = model
        return self

    async def send_message(self, message: UserMessage) -> Any:
        provider = self.provider or DEFAULT_PROVIDER
        model = self.model or DEFAULT_MODEL
        raise ProviderUnavailableError(
            "Aida LLM provider is not configured for runtime use. "
            f"Requested provider={provider!r}, model={model!r}. "
            "Configure a supported provider adapter before using chat/OCR endpoints."
        )


__all__ = [
    "FileContentWithMimeType",
    "LlmChat",
    "ProviderUnavailableError",
    "UserMessage",
    "PROVIDER_CONTRACT_VERSION",
    "DEFAULT_PROVIDER",
    "DEFAULT_MODEL",
]
