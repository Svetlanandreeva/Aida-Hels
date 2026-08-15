"""Personalized Home/Puzzle configuration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field


def _now():
    return datetime.now(timezone.utc)


class WidgetConfig(BaseModel):
    id: str
    enabled: bool = True
    show_on_home: bool = True
    order: int = 0
    allow_ai_analytics: bool = True
    notifications: bool = False


class PuzzleConfig(BaseModel):
    profile_id: str
    widgets: List[WidgetConfig] = Field(default_factory=list)


DEFAULT_WIDGETS = [
    WidgetConfig(id="companion", order=0, allow_ai_analytics=False),
    WidgetConfig(id="readiness", order=1),
    WidgetConfig(id="next_medication", order=2, notifications=True),
    WidgetConfig(id="recent_symptom", order=3),
    WidgetConfig(id="latest_lab", order=4),
    WidgetConfig(id="quests", order=5, allow_ai_analytics=False),
    WidgetConfig(id="quick_note", order=6, enabled=False, show_on_home=False, allow_ai_analytics=False),
]


def _merge_defaults(stored):
    by_id = {w.get("id"): w for w in (stored or []) if w.get("id")}
    result = []
    for default in DEFAULT_WIDGETS:
        data = default.model_dump()
        data.update(by_id.pop(default.id, {}))
        result.append(WidgetConfig(**data).model_dump())
    for extra in by_id.values():
        try:
            result.append(WidgetConfig(**extra).model_dump())
        except Exception:
            continue
    return sorted(result, key=lambda w: w["order"])


def build_puzzle_router(db) -> APIRouter:
    router = APIRouter(prefix="/api/puzzle", tags=["puzzle"])

    @router.get("/{profile_id}")
    async def get_puzzle(profile_id: str):
        doc = await db.puzzle.find_one({"profile_id": profile_id}, {"_id": 0})
        return {
            "profile_id": profile_id,
            "widgets": _merge_defaults((doc or {}).get("widgets")),
            "updated_at": (doc or {}).get("updated_at"),
        }

    @router.post("/{profile_id}")
    async def save_puzzle(profile_id: str, config: PuzzleConfig):
        widgets = [w.model_dump() for w in sorted(config.widgets, key=lambda x: x.order)]
        data = {
            "profile_id": profile_id,
            "widgets": widgets,
            "updated_at": _now(),
        }
        await db.puzzle.update_one({"profile_id": profile_id}, {"$set": data}, upsert=True)
        return data

    return router
