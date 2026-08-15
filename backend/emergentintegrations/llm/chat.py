"""Compatibility shim for the legacy Emergent LLM client.

The production backend can boot without the private emergentintegrations package.
AI/OCR endpoints will return a clear runtime error until a supported provider is wired.
"""


class UserMessage:
    def __init__(self, text: str, file_contents=None):
        self.text = text
        self.file_contents = file_contents or []


class FileContentWithMimeType:
    def __init__(self, file_path: str, mime_type: str):
        self.file_path = file_path
        self.mime_type = mime_type


class LlmChat:
    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.provider = None
        self.model = None

    def with_model(self, provider: str, model: str):
        self.provider = provider
        self.model = model
        return self

    async def send_message(self, message: UserMessage):
        raise RuntimeError(
            "Legacy Emergent LLM adapter is unavailable in production. "
            "Configure the supported AI provider before using chat/OCR endpoints."
        )
