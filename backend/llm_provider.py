"""Explicit LLM provider contract for the legacy-compatible Aida chat layer.

The application imports LlmChat/UserMessage/FileContentWithMimeType from this
module rather than depending on an undeclared third-party package throughout the
codebase. The current adapter is the local compatibility implementation; a future
provider can replace it here without changing medical/business routes.
"""
from __future__ import annotations

from emergentintegrations.llm.chat import FileContentWithMimeType, LlmChat, UserMessage

PROVIDER_CONTRACT_VERSION = "aida-llm-v1"
DEFAULT_PROVIDER = "gemini"
DEFAULT_MODEL = "gemini-3-flash-preview"

__all__ = [
    "FileContentWithMimeType",
    "LlmChat",
    "UserMessage",
    "PROVIDER_CONTRACT_VERSION",
    "DEFAULT_PROVIDER",
    "DEFAULT_MODEL",
]
