"""Generic medical-document storage endpoints.

Unlike the lab pipeline, these endpoints only store the original document and
metadata. They never coerce a discharge summary, prescription or doctor's note
into a laboratory result.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from google_drive_storage import build_drive_storage_from_env


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_documents_router(db) -> APIRouter:
    router = APIRouter(prefix="/api/documents", tags=["documents"])
    drive = build_drive_storage_from_env()

    @router.get("")
    async def list_documents(profile_id: str):
        return await db.files.find(
            {"profile_id": profile_id, "purpose": "medical_document"}, {"_id": 0}
        ).sort("created_at", -1).to_list(500)

    @router.post("/upload")
    async def upload_document(
        profile_id: str = Form(...),
        document_type: str = Form("other"),
        note: Optional[str] = Form(None),
        file: UploadFile = File(...),
    ):
        if not drive:
            raise HTTPException(503, "Google Drive storage is not configured")

        content = await file.read()
        if not content:
            raise HTTPException(400, "Empty file")
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(413, "File is too large")

        original_name = file.filename or "medical-document"
        mime = file.content_type or "application/octet-stream"
        stored_name = f"doc-{profile_id[:8]}-{uuid.uuid4().hex[:10]}-{original_name}"

        try:
            meta = await asyncio.to_thread(
                drive.upload_bytes,
                name=stored_name,
                mime_type=mime,
                content=content,
            )
        except Exception as exc:
            raise HTTPException(502, f"Could not store document: {exc}")

        record = {
            "id": str(uuid.uuid4()),
            "profile_id": profile_id,
            "name": original_name,
            "mime_type": mime,
            "size_bytes": len(content),
            "drive_file_id": meta.get("id"),
            "drive_url": meta.get("webViewLink"),
            "purpose": "medical_document",
            "document_type": document_type,
            "note": note,
            "status": "stored",
            "verification_status": "unverified",
            "source": "upload",
            "created_at": _now(),
        }
        await db.files.insert_one(record)
        return record

    return router
