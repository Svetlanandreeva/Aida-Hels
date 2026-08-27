"""Google Drive file storage for medical documents.

Drive archival is optional for the OCR path. If the service account or uploads
folder is not configured, lab recognition must still work; the source file is
then treated as ephemeral and only the confirmed structured result is persisted
in the medical store.
"""

from __future__ import annotations

import json
import os
import threading
from typing import Dict

import requests
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files"


class EphemeralDriveStorage:
    """Non-blocking fallback when no Drive destination has been configured."""

    def upload_bytes(self, *, name: str, mime_type: str, content: bytes) -> Dict[str, str | None]:
        return {
            "id": None,
            "name": name,
            "mimeType": mime_type,
            "webViewLink": None,
        }


class GoogleDriveStorage:
    def __init__(self, service_account_json: str, folder_id: str):
        info = json.loads(service_account_json)
        self.credentials = service_account.Credentials.from_service_account_info(
            info, scopes=[DRIVE_SCOPE]
        )
        self.auth_request = GoogleAuthRequest()
        self.auth_lock = threading.RLock()
        self.folder_id = folder_id

    def _headers(self) -> Dict[str, str]:
        with self.auth_lock:
            if not self.credentials.valid:
                self.credentials.refresh(self.auth_request)
            return {"Authorization": f"Bearer {self.credentials.token}"}

    def upload_bytes(self, *, name: str, mime_type: str, content: bytes) -> Dict[str, str]:
        metadata = {
            "name": name,
            "parents": [self.folder_id],
        }
        boundary = "aida_upload_boundary"
        body = (
            f"--{boundary}\r\n"
            "Content-Type: application/json; charset=UTF-8\r\n\r\n"
            f"{json.dumps(metadata, ensure_ascii=False)}\r\n"
            f"--{boundary}\r\n"
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("utf-8")

        headers = self._headers()
        headers["Content-Type"] = f"multipart/related; boundary={boundary}"
        r = requests.post(
            f"{DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,mimeType,webViewLink",
            headers=headers,
            data=body,
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        file_id = data["id"]

        # webViewLink is not always returned immediately for uploads; fetch it.
        if not data.get("webViewLink"):
            meta = requests.get(
                f"{DRIVE_FILES_API}/{file_id}?fields=id,name,mimeType,webViewLink",
                headers=self._headers(),
                timeout=20,
            )
            meta.raise_for_status()
            data.update(meta.json())
        return data


def build_drive_storage_from_env():
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    folder_id = os.environ.get("GOOGLE_DRIVE_UPLOADS_FOLDER_ID", "").strip()
    if not raw or not folder_id:
        return EphemeralDriveStorage()
    try:
        return GoogleDriveStorage(raw, folder_id)
    except Exception:
        # Archival must never make the medical OCR path unavailable. Invalid
        # Drive credentials fall back to ephemeral source handling; confirmed
        # structured results are still persisted by the application database.
        return EphemeralDriveStorage()
