"""Production LLM provider adapter for Aida AI/OCR routes.

The public contract intentionally stays compatible with the historical
LlmChat/UserMessage/FileContentWithMimeType API, while runtime calls go directly
to the supported Gemini REST API. This keeps medical/business routes independent
from a provider SDK and removes the old always-failing placeholder.
"""
from __future__ import annotations

import base64
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

PROVIDER_CONTRACT_VERSION = "aida-llm-v2"
DEFAULT_PROVIDER = "gemini"
DEFAULT_MODEL = "gemini-3.6-flash"
_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
_MODEL_ALIASES = {
    # Historical Aida configuration. Keep old deploys working after the preview
    # model was retired instead of forcing every route to know provider churn.
    "gemini-3-flash-preview": DEFAULT_MODEL,
}


class ProviderUnavailableError(RuntimeError):
    """Raised when an AI/OCR provider cannot be used safely."""


@dataclass(slots=True)
class FileContentWithMimeType:
    file_path: str
    mime_type: str


@dataclass(slots=True)
class UserMessage:
    text: str
    file_contents: list[FileContentWithMimeType] = field(default_factory=list)


def _gemini_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        prompt_feedback = payload.get("promptFeedback") or {}
        raise ProviderUnavailableError(
            "Gemini returned no candidates"
            + (f": {prompt_feedback}" if prompt_feedback else "")
        )
    parts = ((candidates[0].get("content") or {}).get("parts") or [])
    text = "".join(str(part.get("text") or "") for part in parts).strip()
    if not text:
        raise ProviderUnavailableError("Gemini returned an empty response")
    return text


class LlmChat:
    """Small provider-agnostic facade backed by Gemini REST in production."""

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
        provider = (self.provider or DEFAULT_PROVIDER).lower().strip()
        if provider != "gemini":
            raise ProviderUnavailableError(f"Unsupported Aida LLM provider: {provider}")

        api_key = (os.environ.get("GEMINI_API_KEY") or self.api_key or "").strip()
        if not api_key:
            raise ProviderUnavailableError("GEMINI_API_KEY is not configured")

        requested_model = (os.environ.get("GEMINI_MODEL") or self.model or DEFAULT_MODEL).strip()
        model = _MODEL_ALIASES.get(requested_model, requested_model)
        parts: list[dict[str, Any]] = [{"text": message.text}]

        for attachment in message.file_contents:
            path = Path(attachment.file_path)
            if not path.is_file():
                raise ProviderUnavailableError(f"Attachment not found: {path.name}")
            raw = path.read_bytes()
            if not raw:
                raise ProviderUnavailableError(f"Attachment is empty: {path.name}")
            parts.append(
                {
                    "inlineData": {
                        "mimeType": attachment.mime_type or "application/octet-stream",
                        "data": base64.b64encode(raw).decode("ascii"),
                    }
                }
            )

        body: dict[str, Any] = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json",
            },
        }
        if self.system_message.strip():
            body["systemInstruction"] = {"parts": [{"text": self.system_message.strip()}]}

        url = f"{_GEMINI_BASE_URL}/models/{model}:generateContent"
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
                response = await client.post(
                    url,
                    headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                    json=body,
                )
        except httpx.HTTPError as exc:
            raise ProviderUnavailableError(f"Gemini request failed: {exc}") from exc

        if response.status_code >= 400:
            try:
                error_payload = response.json()
                detail = ((error_payload.get("error") or {}).get("message") or "").strip()
            except Exception:
                detail = ""
            suffix = f": {detail}" if detail else ""
            raise ProviderUnavailableError(f"Gemini API returned HTTP {response.status_code}{suffix}")

        try:
            payload = response.json()
        except ValueError as exc:
            raise ProviderUnavailableError("Gemini returned invalid JSON") from exc
        return _gemini_text(payload)


__all__ = [
    "FileContentWithMimeType",
    "LlmChat",
    "ProviderUnavailableError",
    "UserMessage",
    "PROVIDER_CONTRACT_VERSION",
    "DEFAULT_PROVIDER",
    "DEFAULT_MODEL",
]
