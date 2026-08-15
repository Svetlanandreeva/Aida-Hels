"""Safe AI-to-data workflow for Aida 2.0.

AI suggestions are stored as pending CandidateRecords. They do not become
medical facts until an explicit approve action materializes them into a
canonical collection. Rejections remain auditable.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from access_control import require_profile_access, require_record_access
from permissions import write_audit


def _now() -> datetime:
    return datetime.now(timezone.utc)


ALLOWED_TARGETS = {
    "symptom": "symptoms",
    "medication": "medications",
    "vital": "vitals",
    "checkin": "checkins",
    "task": "tasks",
}


class CandidateRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    profile_id: str
    proposed_by: Literal["ai", "user", "import"] = "ai"
    entity_type: Literal["symptom", "medication", "vital", "checkin", "task"]
    payload: Dict[str, Any]
    rationale: Optional[str] = None
    status: Literal["pending", "approved", "rejected"] = "pending"
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    reviewed_at: Optional[datetime] = None
    reviewer_account_id: Optional[str] = None
    approved_entity_id: Optional[str] = None


class CandidateCreate(BaseModel):
    profile_id: str
    proposed_by: Literal["ai", "user", "import"] = "ai"
    entity_type: Literal["symptom", "medication", "vital", "checkin", "task"]
    payload: Dict[str, Any]
    rationale: Optional[str] = None


class ReviewRequest(BaseModel):
    # Backward-compatible field; server derives the reviewer from auth.
    reviewer_account_id: Optional[str] = None


def build_candidate_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/candidates", tags=["candidates"])

    @router.get("", response_model=List[CandidateRecord])
    async def list_candidates(
        profile_id: str,
        status: Optional[str] = None,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, profile_id)
        query: Dict[str, Any] = {"profile_id": profile_id}
        if status:
            query["status"] = status
        return await db.candidates.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)

    @router.post("", response_model=CandidateRecord)
    async def create_candidate(
        data: CandidateCreate,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, data.profile_id, write=True)
        payload = dict(data.payload)
        payload.pop("profile_id", None)
        payload.pop("id", None)
        candidate = CandidateRecord(**data.model_dump(exclude={"payload"}), payload=payload)
        await db.candidates.insert_one(candidate.model_dump())
        await write_audit(
            db,
            action="candidate.created",
            entity_type="candidate",
            entity_id=candidate.id,
            account_id=str(account["id"]),
            profile_id=candidate.profile_id,
            source="ai" if candidate.proposed_by == "ai" else "user",
            metadata={"target_entity_type": candidate.entity_type},
        )
        return candidate

    @router.post("/{candidate_id}/approve")
    async def approve_candidate(
        candidate_id: str,
        review: ReviewRequest,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        candidate = await require_record_access(db, auth, account, "candidates", candidate_id, write=True)
        if candidate.get("status") != "pending":
            raise HTTPException(409, "Candidate has already been reviewed")

        target_name = ALLOWED_TARGETS.get(candidate.get("entity_type"))
        if not target_name:
            raise HTTPException(400, "Unsupported candidate target")

        payload = dict(candidate.get("payload") or {})
        entity_id = str(uuid.uuid4())
        payload["id"] = entity_id
        payload["profile_id"] = candidate["profile_id"]
        payload.setdefault("source", "ai_confirmed")
        payload.setdefault("created_at", _now())
        payload["updated_at"] = _now()
        await getattr(db, target_name).insert_one(payload)

        reviewed_at = _now()
        reviewer_account_id = str(account["id"])
        await db.candidates.update_one(
            {"id": candidate_id},
            {"$set": {
                "status": "approved",
                "reviewed_at": reviewed_at,
                "reviewer_account_id": reviewer_account_id,
                "approved_entity_id": entity_id,
                "updated_at": reviewed_at,
            }},
        )
        await write_audit(
            db,
            action="candidate.approved",
            entity_type=target_name,
            entity_id=entity_id,
            account_id=reviewer_account_id,
            profile_id=candidate["profile_id"],
            source="user",
            metadata={"candidate_id": candidate_id},
        )
        return {"ok": True, "candidate_id": candidate_id, "entity_id": entity_id}

    @router.post("/{candidate_id}/reject")
    async def reject_candidate(
        candidate_id: str,
        review: ReviewRequest,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        candidate = await require_record_access(db, auth, account, "candidates", candidate_id, write=True)
        if candidate.get("status") != "pending":
            raise HTTPException(409, "Candidate has already been reviewed")

        reviewed_at = _now()
        reviewer_account_id = str(account["id"])
        await db.candidates.update_one(
            {"id": candidate_id},
            {"$set": {
                "status": "rejected",
                "reviewed_at": reviewed_at,
                "reviewer_account_id": reviewer_account_id,
                "updated_at": reviewed_at,
            }},
        )
        await write_audit(
            db,
            action="candidate.rejected",
            entity_type="candidate",
            entity_id=candidate_id,
            account_id=reviewer_account_id,
            profile_id=candidate["profile_id"],
            source="user",
        )
        return {"ok": True, "candidate_id": candidate_id}

    return router
