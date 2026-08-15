"""Actionable tasks and reminder metadata for Aida 2.0."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


def _now():
    return datetime.now(timezone.utc)


ACTION_ROUTES = {
    "medication": "/medications",
    "pressure": "/pressure",
    "diary": "/mind",
    "lab": "/labs",
    "upload": "/documents",
    "visit": "/medical-card",
    "measurement": "/measurements",
    "custom": None,
}


class TaskCreate(BaseModel):
    profile_id: str
    title: str
    kind: str = "custom"
    due: Optional[str] = None
    reminder_at: Optional[str] = None
    notification_id: Optional[str] = None
    action_route: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    notes: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    kind: Optional[str] = None
    due: Optional[str] = None
    reminder_at: Optional[str] = None
    notification_id: Optional[str] = None
    action_route: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    done: Optional[bool] = None


def _normalize_task(doc):
    if not doc:
        return doc
    result = dict(doc)
    result.setdefault("status", "done" if result.get("done") else "pending")
    result["done"] = result.get("status") == "done" or bool(result.get("done"))
    result.setdefault("reminder_at", None)
    result.setdefault("notification_id", None)
    result.setdefault("action_route", ACTION_ROUTES.get(result.get("kind", "custom")))
    result.setdefault("source_type", None)
    result.setdefault("source_id", None)
    result.setdefault("notes", None)
    return result


def build_task_router(db) -> APIRouter:
    router = APIRouter(prefix="/api/tasks", tags=["tasks"])

    @router.get("")
    async def list_tasks(profile_id: str):
        docs = await db.tasks.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
        return [_normalize_task(doc) for doc in docs]

    @router.post("")
    async def create_task(data: TaskCreate):
        payload = data.model_dump()
        payload.update({
            "id": str(uuid.uuid4()),
            "status": "pending",
            "done": False,
            "created_at": _now(),
            "updated_at": _now(),
        })
        if not payload.get("action_route"):
            payload["action_route"] = ACTION_ROUTES.get(payload.get("kind", "custom"))
        await db.tasks.insert_one(payload)
        return _normalize_task(payload)

    @router.put("/{task_id}")
    async def update_task(task_id: str, data: TaskUpdate):
        existing = await db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Task not found")
        patch = {k: v for k, v in data.model_dump().items() if v is not None}
        if "kind" in patch and "action_route" not in patch:
            patch["action_route"] = ACTION_ROUTES.get(patch["kind"])
        if "done" in patch and "status" not in patch:
            patch["status"] = "done" if patch["done"] else "pending"
        if "status" in patch:
            patch["done"] = patch["status"] == "done"
        patch["updated_at"] = _now()
        await db.tasks.update_one({"id": task_id}, {"$set": patch})
        return _normalize_task({**existing, **patch})

    @router.put("/{task_id}/toggle")
    async def toggle_task(task_id: str):
        existing = await db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Task not found")
        normalized = _normalize_task(existing)
        next_status = "pending" if normalized["done"] else "done"
        patch = {"status": next_status, "done": next_status == "done", "updated_at": _now()}
        await db.tasks.update_one({"id": task_id}, {"$set": patch})
        return _normalize_task({**existing, **patch})

    @router.delete("/{task_id}")
    async def delete_task(task_id: str):
        await db.tasks.delete_one({"id": task_id})
        return {"ok": True}

    return router
