"""Canonical per-profile module configuration for Aida.

Medical/domain module configuration is intentionally separate from Home widget
layout. ``profile.module_settings`` remains a backward-compatible projection of
``enabled`` while ``profile.module_config`` is the source of truth for the
independent enabled/Home/AI/notification scopes.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from access_control import require_profile_access


def _now() -> datetime:
    return datetime.now(timezone.utc)


MODULE_REGISTRY: List[Dict[str, Any]] = [
    {"module_code": "nutrition", "order": 0, "enabled": False, "show_on_home": False, "allow_ai_analytics": False, "notifications_enabled": False},
    {"module_code": "labs", "order": 1, "enabled": True, "show_on_home": True, "allow_ai_analytics": True, "notifications_enabled": False},
    {"module_code": "symptoms", "order": 2, "enabled": True, "show_on_home": True, "allow_ai_analytics": True, "notifications_enabled": False},
    {"module_code": "pressure", "order": 3, "enabled": True, "show_on_home": True, "allow_ai_analytics": True, "notifications_enabled": False},
    {"module_code": "sleep", "order": 4, "enabled": True, "show_on_home": True, "allow_ai_analytics": True, "notifications_enabled": True},
    {"module_code": "mental", "order": 5, "enabled": True, "show_on_home": True, "allow_ai_analytics": True, "notifications_enabled": False},
    {"module_code": "meds", "order": 6, "enabled": True, "show_on_home": True, "allow_ai_analytics": True, "notifications_enabled": True},
    {"module_code": "body", "order": 7, "enabled": True, "show_on_home": False, "allow_ai_analytics": True, "notifications_enabled": False},
    {"module_code": "chronic", "order": 8, "enabled": True, "show_on_home": False, "allow_ai_analytics": True, "notifications_enabled": False},
    {"module_code": "women", "order": 9, "enabled": True, "show_on_home": True, "allow_ai_analytics": True, "notifications_enabled": False},
    {"module_code": "weight", "order": 10, "enabled": True, "show_on_home": False, "allow_ai_analytics": True, "notifications_enabled": False},
    {"module_code": "documents", "order": 11, "enabled": True, "show_on_home": False, "allow_ai_analytics": False, "notifications_enabled": False},
    {"module_code": "tasks", "order": 12, "enabled": True, "show_on_home": True, "allow_ai_analytics": False, "notifications_enabled": True},
]

_REGISTRY_BY_CODE = {item["module_code"]: item for item in MODULE_REGISTRY}

_GOAL_MAP = {
    "labs": {"labs", "general", "chronic"},
    "symptoms": {"symptoms", "general", "chronic"},
    "pressure": {"pressure", "general", "chronic"},
    "sleep": {"sleep", "mental", "general"},
    "mental": {"mental", "sleep", "general"},
    "meds": {"meds", "chronic"},
    "chronic": {"chronic"},
    "women": {"women", "cycle", "pregnancy_planning", "pregnancy"},
}

_CONFIG_FIELDS = ("enabled", "show_on_home", "allow_ai_analytics", "notifications_enabled", "order")


def _stored_config_map(value: Any) -> Dict[str, Dict[str, Any]]:
    if isinstance(value, dict):
        return {
            str(code): dict(config)
            for code, config in value.items()
            if str(code) in _REGISTRY_BY_CODE and isinstance(config, dict)
        }
    if isinstance(value, list):
        result: Dict[str, Dict[str, Any]] = {}
        for item in value:
            if not isinstance(item, dict):
                continue
            code = str(item.get("module_code") or "")
            if code in _REGISTRY_BY_CODE:
                result[code] = dict(item)
        return result
    return {}


def effective_module_map(profile: Dict[str, Any] | None) -> Dict[str, Dict[str, Any]]:
    """Resolve a complete registry without requiring an eager data migration.

    Resolution order is: stored ModuleConfig -> explicit legacy module_settings
    -> onboarding goals -> registry defaults. A missing nutrition preference is
    deliberately opt-in/fail-closed.

    Legacy ``module_settings`` previously controlled both module availability
    and AI inclusion, so migration preserves that behavior until the user makes
    the new scopes explicit.
    """
    profile = profile or {}
    stored = _stored_config_map(profile.get("module_config"))
    legacy = profile.get("module_settings") if isinstance(profile.get("module_settings"), dict) else {}
    legacy_source = str(profile.get("module_settings_source") or "")
    goals = {str(goal) for goal in (profile.get("goals") or []) if goal}
    result: Dict[str, Dict[str, Any]] = {}

    for definition in MODULE_REGISTRY:
        code = definition["module_code"]
        config = dict(definition)
        source = "preset"

        if code in legacy:
            enabled = legacy.get(code) is not False
            config["enabled"] = enabled
            if code not in {"documents", "tasks"}:
                config["allow_ai_analytics"] = enabled
            if legacy_source == "user":
                source = "user"
            elif legacy_source == "goals":
                source = "goals"
            else:
                source = "migration"
        elif code in _GOAL_MAP and goals:
            config["enabled"] = bool(goals & _GOAL_MAP[code])
            source = "goals"

        stored_item = stored.get(code)
        if stored_item:
            for field in _CONFIG_FIELDS:
                if field in stored_item and stored_item[field] is not None:
                    if field == "order":
                        try:
                            config[field] = int(stored_item[field])
                        except (TypeError, ValueError):
                            pass
                    else:
                        config[field] = bool(stored_item[field])
            source = str(stored_item.get("source") or source)
            updated_at = stored_item.get("updated_at")
        else:
            updated_at = None

        config["source"] = source
        config["updated_at"] = updated_at
        result[code] = config

    return result


def module_settings_projection(config: Dict[str, Dict[str, Any]]) -> Dict[str, bool]:
    return {code: item.get("enabled") is not False for code, item in config.items() if code in _REGISTRY_BY_CODE}


def module_enabled(profile: Dict[str, Any] | None, code: str) -> bool:
    item = effective_module_map(profile).get(code)
    return bool(item and item.get("enabled") is True)


def module_home_allowed(profile: Dict[str, Any] | None, code: str) -> bool:
    item = effective_module_map(profile).get(code)
    return bool(item and item.get("enabled") is True and item.get("show_on_home") is True)


def module_ai_allowed(profile: Dict[str, Any] | None, code: str) -> bool:
    item = effective_module_map(profile).get(code)
    return bool(item and item.get("enabled") is True and item.get("allow_ai_analytics") is True)


def module_notifications_allowed(profile: Dict[str, Any] | None, code: str) -> bool:
    item = effective_module_map(profile).get(code)
    return bool(item and item.get("enabled") is True and item.get("notifications_enabled") is True)


def apply_legacy_module_settings(profile: Dict[str, Any], settings: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Mirror old ``module_settings`` writes into ModuleConfig.

    This keeps older clients (including the existing Nutrition opt-in screen)
    functional during the migration without letting them overwrite Home/AI/
    notification scopes.
    """
    config = effective_module_map(profile)
    now = _now()
    for code, value in (settings or {}).items():
        if code not in config:
            continue
        config[code] = {
            **config[code],
            "enabled": value is not False,
            "source": "user",
            "updated_at": now,
        }
    return config


class ModulePatch(BaseModel):
    module_code: str
    enabled: Optional[bool] = None
    show_on_home: Optional[bool] = None
    allow_ai_analytics: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    order: Optional[int] = Field(default=None, ge=0, le=1000)


class ModulePatchRequest(BaseModel):
    modules: List[ModulePatch] = Field(min_length=1, max_length=50)


def apply_module_patches(profile: Dict[str, Any], patches: Iterable[ModulePatch]) -> Dict[str, Dict[str, Any]]:
    config = effective_module_map(profile)
    now = _now()
    for patch in patches:
        code = str(patch.module_code or "")
        if code not in config:
            raise HTTPException(400, f"Unknown module_code: {code}")
        current = dict(config[code])
        values = patch.model_dump(exclude_unset=True, exclude={"module_code"})
        for field, value in values.items():
            if value is not None:
                current[field] = int(value) if field == "order" else bool(value)
        current["source"] = "user"
        current["updated_at"] = now
        config[code] = current
    return config


def module_config_response(profile_id: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    config = effective_module_map(profile)
    modules = sorted(config.values(), key=lambda item: (int(item.get("order") or 0), item["module_code"]))
    return {
        "profile_id": profile_id,
        "modules": modules,
        "module_settings": module_settings_projection(config),
        "schema_version": "module-config-v2",
    }


def build_module_config_router(db, auth) -> APIRouter:
    router = APIRouter(prefix="/api/profiles", tags=["profile-modules"])

    @router.get("/{profile_id}/modules")
    async def get_modules(profile_id: str, account: Dict[str, Any] = Depends(auth.require_account)):
        await require_profile_access(auth, account, profile_id)
        profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        if not profile:
            raise HTTPException(404, "Profile not found")
        return module_config_response(profile_id, profile)

    @router.patch("/{profile_id}/modules")
    async def patch_modules(
        profile_id: str,
        request: ModulePatchRequest,
        account: Dict[str, Any] = Depends(auth.require_account),
    ):
        await require_profile_access(auth, account, profile_id, write=True)
        profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
        if not profile:
            raise HTTPException(404, "Profile not found")
        config = apply_module_patches(profile, request.modules)
        projection = module_settings_projection(config)
        await db.profiles.update_one(
            {"id": profile_id},
            {"$set": {
                "module_config": config,
                "module_settings": projection,
                "module_settings_source": "user",
                "updated_at": _now(),
            }},
        )
        updated = dict(profile)
        updated["module_config"] = config
        updated["module_settings"] = projection
        updated["module_settings_source"] = "user"
        return module_config_response(profile_id, updated)

    return router
