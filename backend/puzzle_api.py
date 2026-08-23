"""Personalized Home/Puzzle card configuration.

Puzzle stores presentation state for concrete Home cards. Domain-module
permissions live in ``module_config`` and are applied as an additional gate when
a card represents a medical module.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from access_control import require_profile_access
from module_config import module_home_allowed


def _now():
    return datetime.now(timezone.utc)


class WidgetConfig(BaseModel):
    id: str
    enabled: bool = True
    show_on_home: bool = True
    order: int = 0
    # Legacy fields remain accepted so previously persisted rows deserialize.
    # They are no longer authoritative for medical-module AI/notifications.
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

HOME_WIDGET_MODULES = {
    "next_medication": "meds",
    "recent_symptom": "symptoms",
    "latest_lab": "labs",
}


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


def apply_module_home_visibility(widgets: List[Dict[str, Any]], profile: Dict[str, Any] | None) -> List[Dict[str, Any]]:
    """Apply ModuleConfig as a non-destructive visibility gate.

    ``configured_show_on_home`` retains the card-level preference. The ordinary
    ``show_on_home`` field returned to existing Home clients is the effective
    value after the medical-module permission has also been applied.
    """
    result: List[Dict[str, Any]] = []
    for raw in widgets or []:
        item = dict(raw)
        module_code = HOME_WIDGET_MODULES.get(str(item.get("id") or ""))
        configured = item.get("show_on_home") is not False
        effective = bool(item.get("enabled") is not False and configured)
        if module_code:
            effective = effective and module_home_allowed(profile, module_code)
        item["module_code"] = module_code
        item["configured_show_on_home"] = configured
        item["effective_show_on_home"] = effective
        item["show_on_home"] = effective
        result.append(item)
    return result


def widgets_for_goals(goals: List[str] | None) -> List[Dict[str, Any]]:
    """Build the first Home layout from onboarding goals.

    This is used only while there is no persisted user-customized Puzzle
    document. Once the user customizes Home in Settings, goal changes must not
    silently overwrite that manual layout.
    """
    selected = {str(goal) for goal in (goals or []) if goal}
    if not selected:
        return _merge_defaults(None)

    widgets = _merge_defaults(None)
    by_id = {item["id"]: item for item in widgets}

    by_id["companion"].update(enabled=True, show_on_home=True)
    by_id["quests"].update(enabled=True, show_on_home=True)
    by_id["readiness"].update(enabled=True, show_on_home=True)

    meds = bool(selected & {"meds", "chronic"})
    symptoms = bool(selected & {"symptoms", "chronic", "general"})
    labs = bool(selected & {"labs", "chronic", "general"})
    quick = bool(selected & {"pressure", "sleep", "mental", "women", "cycle", "pregnancy_planning", "pregnancy"})

    by_id["next_medication"].update(enabled=meds, show_on_home=meds, notifications=meds)
    by_id["recent_symptom"].update(enabled=symptoms, show_on_home=symptoms)
    by_id["latest_lab"].update(enabled=labs, show_on_home=labs)
    by_id["quick_note"].update(enabled=quick, show_on_home=quick)

    return sorted(by_id.values(), key=lambda item: item["order"])


def build_puzzle_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/puzzle", tags=["puzzle"])

    @router.get("/{profile_id}")
    async def get_puzzle(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0}) or {}
        doc = await db.puzzle.find_one({"profile_id": profile_id}, {"_id": 0})
        if doc:
            widgets = _merge_defaults(doc.get("widgets"))
            source = doc.get("source") or "legacy"
            updated_at = doc.get("updated_at")
        else:
            widgets = widgets_for_goals(profile.get("goals") or [])
            source = "goals_fallback" if profile.get("goals") else "default"
            updated_at = None
        return {
            "profile_id": profile_id,
            "widgets": apply_module_home_visibility(widgets, profile),
            "source": source,
            "updated_at": updated_at,
        }

    @router.post("/{profile_id}")
    async def save_puzzle(
        profile_id: str,
        config: PuzzleConfig,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, profile_id, write=True)
        widgets = [w.model_dump() for w in sorted(config.widgets, key=lambda x: x.order)]
        data = {
            "profile_id": profile_id,
            "widgets": widgets,
            "source": "user",
            "updated_at": _now(),
        }
        await db.puzzle.update_one({"profile_id": profile_id}, {"$set": data}, upsert=True)
        return data

    return router
