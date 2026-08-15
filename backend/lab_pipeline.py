"""Medical-document upload pipeline.

Flow:
1. Persist the original PDF/photo in Google Drive.
2. Register file metadata in the Google Sheets `files` tab.
3. Run OCR/LLM extraction.
4. Persist only valid extracted lab data as an unverified record.

The pipeline never fabricates an empty lab record when OCR fails.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from emergentintegrations.llm.chat import FileContentWithMimeType, LlmChat, UserMessage

from google_drive_storage import build_drive_storage_from_env
from server import Biomarker, EMERGENT_LLM_KEY, GEMINI_MODEL, LabTest


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_json(raw: str):
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except Exception:
                return None
    return None


def build_lab_router(db) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["labs"])
    drive = build_drive_storage_from_env()

    @router.post("/labs/upload")
    async def upload_lab(
        profile_id: str = Form(...),
        language: str = Form("ru"),
        file: UploadFile = File(...),
    ):
        if not drive:
            raise HTTPException(503, "Google Drive storage is not configured")
        if not EMERGENT_LLM_KEY:
            raise HTTPException(503, "OCR service is not configured")

        content = await file.read()
        if not content:
            raise HTTPException(400, "Empty file")
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(413, "File is too large")

        original_name = file.filename or "medical-document"
        mime = file.content_type or "application/octet-stream"
        stored_name = f"{profile_id[:8]}-{uuid.uuid4().hex[:10]}-{original_name}"

        try:
            drive_meta = await asyncio.to_thread(
                drive.upload_bytes,
                name=stored_name,
                mime_type=mime,
                content=content,
            )
        except Exception as exc:
            logging.exception("Google Drive upload failed")
            raise HTTPException(502, f"Could not store document: {exc}")

        file_record_id = str(uuid.uuid4())
        file_record = {
            "id": file_record_id,
            "profile_id": profile_id,
            "name": original_name,
            "mime_type": mime,
            "size_bytes": len(content),
            "drive_file_id": drive_meta.get("id"),
            "drive_url": drive_meta.get("webViewLink"),
            "purpose": "lab_upload",
            "status": "uploaded",
            "source": "upload",
            "created_at": _now(),
        }
        await db.files.insert_one(file_record)

        suffix = Path(original_name).suffix or (".pdf" if mime == "application/pdf" else ".jpg")
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            schema_hint = (
                'Верни строго JSON: {"title":"...","date":"YYYY-MM-DD",'
                '"lab_name":null,"biomarkers":[{"name":"...","value":"...",'
                '"unit":"...","reference":"...","status":"normal|high|low|unknown"}],'
                '"ai_summary":"..."}. '
                'Не придумывай отсутствующие значения. Если показатель не читается — не добавляй его. '
                f'Язык summary: {"русский" if language.startswith("ru") else "английский"}.'
            )
            system_msg = (
                "Ты медицинский OCR-парсер. Извлекай только явно видимые данные из документа. "
                "Не угадывай значения, нормы, даты и названия. Возвращай только валидный JSON."
            )
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"lab-ocr-{uuid.uuid4()}",
                system_message=system_msg,
            ).with_model("gemini", GEMINI_MODEL)
            attachment = FileContentWithMimeType(file_path=tmp_path, mime_type=mime)
            response = await chat.send_message(
                UserMessage(text=schema_hint, file_contents=[attachment])
            )
            raw = response if isinstance(response, str) else str(response)
            parsed = _extract_json(raw)
        except Exception:
            logging.exception("Lab OCR failed")
            parsed = None
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

        if not parsed or not isinstance(parsed.get("biomarkers"), list):
            await db.files.update_one(
                {"id": file_record_id},
                {"$set": {"status": "needs_review", "updated_at": _now()}},
            )
            raise HTTPException(
                422,
                detail={
                    "message": "Document saved, but recognition needs review",
                    "file_id": file_record_id,
                    "drive_url": drive_meta.get("webViewLink"),
                },
            )

        biomarkers = []
        for item in parsed.get("biomarkers") or []:
            name = str(item.get("name") or "").strip()
            value = str(item.get("value") or "").strip()
            if not name or not value:
                continue
            biomarkers.append(
                Biomarker(
                    name=name,
                    value=value,
                    unit=item.get("unit"),
                    reference=item.get("reference"),
                    status=item.get("status") or "unknown",
                )
            )

        if not biomarkers:
            await db.files.update_one(
                {"id": file_record_id},
                {"$set": {"status": "needs_review", "updated_at": _now()}},
            )
            raise HTTPException(
                422,
                detail={
                    "message": "Document saved, but no reliable biomarkers were extracted",
                    "file_id": file_record_id,
                    "drive_url": drive_meta.get("webViewLink"),
                },
            )

        date = str(parsed.get("date") or "").strip()
        if not date:
            # Unknown date stays unknown; do not silently substitute today's date.
            date = "unknown"

        lab = LabTest(
            profile_id=profile_id,
            title=str(parsed.get("title") or "Лабораторный анализ"),
            date=date,
            lab_name=parsed.get("lab_name"),
            biomarkers=biomarkers,
            ai_summary=parsed.get("ai_summary"),
            source="upload",
        )
        lab_doc = lab.model_dump()
        lab_doc.update({
            "source_file_id": file_record_id,
            "drive_file_id": drive_meta.get("id"),
            "verification_status": "unverified",
            "updated_at": _now(),
        })
        await db.labs.insert_one(lab_doc)
        await db.files.update_one(
            {"id": file_record_id},
            {"$set": {
                "status": "recognized",
                "lab_id": lab.id,
                "updated_at": _now(),
            }},
        )

        return {
            **lab_doc,
            "file": {
                "id": file_record_id,
                "drive_file_id": drive_meta.get("id"),
                "drive_url": drive_meta.get("webViewLink"),
                "name": original_name,
            },
        }

    return router
