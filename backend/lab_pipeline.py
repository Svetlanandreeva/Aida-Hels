"""Authorized medical-document upload and OCR pipeline for Aida 2.0.

Uploaded laboratory documents are staged first. OCR output is a pending import
candidate and is never inserted into canonical lab history until the user
reviews the preview and explicitly commits it.
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
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from access_control import require_profile_access, require_record_access
from google_drive_storage import build_drive_storage_from_env
from llm_provider import FileContentWithMimeType, LlmChat, UserMessage
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


def _ocr_key() -> str:
    """Prefer the explicit Gemini key while keeping the legacy key as fallback."""
    return (os.environ.get("GEMINI_API_KEY") or EMERGENT_LLM_KEY or "").strip()


class LabBiomarkerEdit(BaseModel):
    name: str
    value: str
    unit: Optional[str] = None
    reference: Optional[str] = None
    status: str = "unknown"


class LabImportEdit(BaseModel):
    title: str
    date: str
    lab_name: Optional[str] = None
    biomarkers: List[LabBiomarkerEdit] = Field(default_factory=list)
    ai_summary: Optional[str] = None


def _clean_biomarkers(items: List[Dict[str, Any]] | List[LabBiomarkerEdit]) -> list[Dict[str, Any]]:
    cleaned: list[Dict[str, Any]] = []
    for raw in items:
        item = raw.model_dump() if isinstance(raw, LabBiomarkerEdit) else dict(raw)
        name = str(item.get("name") or "").strip()
        value = str(item.get("value") or "").strip()
        if not name or not value:
            continue
        status = str(item.get("status") or "unknown").strip().lower()
        if status not in {"normal", "high", "low", "unknown"}:
            status = "unknown"
        cleaned.append({
            "name": name,
            "value": value,
            "unit": str(item.get("unit") or "").strip() or None,
            "reference": str(item.get("reference") or "").strip() or None,
            "status": status,
        })
    return cleaned


def _preview(candidate: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(candidate.get("payload") or {})
    return {
        "import_id": candidate["id"],
        "status": candidate.get("status") or "pending",
        "profile_id": candidate["profile_id"],
        "title": payload.get("title") or "Лабораторный анализ",
        "date": payload.get("date") or "unknown",
        "lab_name": payload.get("lab_name"),
        "biomarkers": payload.get("biomarkers") or [],
        "ai_summary": payload.get("ai_summary"),
        "file": {
            "id": candidate.get("source_file_id"),
            "drive_file_id": candidate.get("drive_file_id"),
            "drive_url": candidate.get("drive_url"),
            "name": candidate.get("source_file_name"),
        },
    }


def build_lab_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["labs"])
    drive = build_drive_storage_from_env()

    @router.post("/labs/upload")
    async def upload_lab(
        profile_id: str = Form(...),
        language: str = Form("ru"),
        file: UploadFile = File(...),
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, profile_id, write=True)

        if not drive:
            raise HTTPException(503, "Google Drive storage is not configured")
        api_key = _ocr_key()
        if not api_key:
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
            raise HTTPException(502, "Could not store document") from exc

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
                "Не придумывай отсутствующие значения. Если показатель не читается — не добавляй его. "
                f'Язык summary: {"русский" if language.startswith("ru") else "английский"}.'
            )
            chat = LlmChat(
                api_key=api_key,
                session_id=f"lab-ocr-{uuid.uuid4()}",
                system_message=(
                    "Ты медицинский OCR-парсер. Извлекай только явно видимые данные из документа. "
                    "Не угадывай значения, нормы, даты и названия. Возвращай только валидный JSON."
                ),
            ).with_model("gemini", os.environ.get("GEMINI_MODEL") or GEMINI_MODEL)
            attachment = FileContentWithMimeType(file_path=tmp_path, mime_type=mime)
            response = await chat.send_message(UserMessage(text=schema_hint, file_contents=[attachment]))
            parsed = _extract_json(response if isinstance(response, str) else str(response))
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

        biomarkers = _clean_biomarkers(parsed.get("biomarkers") or [])
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

        import_id = str(uuid.uuid4())
        candidate = {
            "id": import_id,
            "profile_id": profile_id,
            "proposed_by": "import",
            "entity_type": "lab_import",
            "status": "pending",
            "payload": {
                "title": str(parsed.get("title") or "Лабораторный анализ").strip() or "Лабораторный анализ",
                "date": str(parsed.get("date") or "").strip() or "unknown",
                "lab_name": parsed.get("lab_name"),
                "biomarkers": biomarkers,
                "ai_summary": parsed.get("ai_summary"),
            },
            "source_file_id": file_record_id,
            "source_file_name": original_name,
            "drive_file_id": drive_meta.get("id"),
            "drive_url": drive_meta.get("webViewLink"),
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.candidates.insert_one(candidate)
        await db.files.update_one(
            {"id": file_record_id},
            {"$set": {"status": "awaiting_confirmation", "lab_import_id": import_id, "updated_at": _now()}},
        )
        return _preview(candidate)

    @router.get("/lab-imports/{import_id}/preview")
    async def get_lab_preview(
        import_id: str,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        candidate = await require_record_access(db, auth, account, "candidates", import_id)
        if candidate.get("entity_type") != "lab_import":
            raise HTTPException(404, "Lab import not found")
        return _preview(candidate)

    @router.patch("/lab-imports/{import_id}")
    async def update_lab_preview(
        import_id: str,
        data: LabImportEdit,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        candidate = await require_record_access(db, auth, account, "candidates", import_id, write=True)
        if candidate.get("entity_type") != "lab_import":
            raise HTTPException(404, "Lab import not found")
        if candidate.get("status") != "pending":
            raise HTTPException(409, "Lab import has already been reviewed")
        biomarkers = _clean_biomarkers(data.biomarkers)
        if not biomarkers:
            raise HTTPException(400, "At least one biomarker with a name and value is required")
        payload = {
            "title": data.title.strip() or "Лабораторный анализ",
            "date": data.date.strip() or "unknown",
            "lab_name": (data.lab_name or "").strip() or None,
            "biomarkers": biomarkers,
            "ai_summary": data.ai_summary,
        }
        updated_at = _now()
        result = await db.candidates.update_one(
            {"id": import_id, "status": "pending"},
            {"$set": {"payload": payload, "updated_at": updated_at}},
        )
        if not result.get("matched_count"):
            raise HTTPException(409, "Lab import changed while it was being reviewed")
        candidate["payload"] = payload
        candidate["updated_at"] = updated_at
        return _preview(candidate)

    @router.post("/lab-imports/{import_id}/commit")
    async def commit_lab_import(
        import_id: str,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        candidate = await require_record_access(db, auth, account, "candidates", import_id, write=True)
        if candidate.get("entity_type") != "lab_import":
            raise HTTPException(404, "Lab import not found")
        if candidate.get("status") != "pending":
            raise HTTPException(409, "Lab import has already been reviewed")

        payload = dict(candidate.get("payload") or {})
        biomarkers_raw = _clean_biomarkers(payload.get("biomarkers") or [])
        if not biomarkers_raw:
            raise HTTPException(400, "Lab import has no valid biomarkers")

        claim_time = _now()
        claim = await db.candidates.update_one(
            {"id": import_id, "status": "pending"},
            {"$set": {
                "status": "committing",
                "reviewer_account_id": str(account["id"]),
                "updated_at": claim_time,
            }},
        )
        if not claim.get("matched_count"):
            raise HTTPException(409, "Lab import is already being committed or reviewed")

        biomarkers = [Biomarker(**item) for item in biomarkers_raw]
        lab = LabTest(
            profile_id=candidate["profile_id"],
            title=str(payload.get("title") or "Лабораторный анализ"),
            date=str(payload.get("date") or "unknown"),
            lab_name=payload.get("lab_name"),
            biomarkers=biomarkers,
            ai_summary=payload.get("ai_summary"),
            source="upload",
        )
        lab_doc = lab.model_dump()
        lab_doc.update({
            "source_file_id": candidate.get("source_file_id"),
            "drive_file_id": candidate.get("drive_file_id"),
            "verification_status": "user_confirmed",
            "confirmed_by_account_id": str(account["id"]),
            "confirmed_at": claim_time,
            "updated_at": claim_time,
        })
        try:
            await db.labs.insert_one(lab_doc)
        except Exception:
            await db.candidates.update_one(
                {"id": import_id, "status": "committing"},
                {"$set": {"status": "pending", "updated_at": _now()}},
            )
            raise

        reviewed_at = _now()
        await db.candidates.update_one(
            {"id": import_id, "status": "committing"},
            {"$set": {
                "status": "approved",
                "reviewed_at": reviewed_at,
                "reviewer_account_id": str(account["id"]),
                "approved_entity_id": lab.id,
                "updated_at": reviewed_at,
            }},
        )
        if candidate.get("source_file_id"):
            await db.files.update_one(
                {"id": candidate["source_file_id"]},
                {"$set": {"status": "recognized", "lab_id": lab.id, "updated_at": reviewed_at}},
            )
        return lab_doc

    @router.post("/lab-imports/{import_id}/cancel")
    async def cancel_lab_import(
        import_id: str,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        candidate = await require_record_access(db, auth, account, "candidates", import_id, write=True)
        if candidate.get("entity_type") != "lab_import":
            raise HTTPException(404, "Lab import not found")
        if candidate.get("status") != "pending":
            raise HTTPException(409, "Lab import has already been reviewed")
        reviewed_at = _now()
        result = await db.candidates.update_one(
            {"id": import_id, "status": "pending"},
            {"$set": {
                "status": "rejected",
                "reviewed_at": reviewed_at,
                "reviewer_account_id": str(account["id"]),
                "updated_at": reviewed_at,
            }},
        )
        if not result.get("matched_count"):
            raise HTTPException(409, "Lab import changed while it was being reviewed")
        if candidate.get("source_file_id"):
            await db.files.update_one(
                {"id": candidate["source_file_id"]},
                {"$set": {"status": "review_cancelled", "updated_at": reviewed_at}},
            )
        return {"ok": True, "import_id": import_id}

    return router
