from pathlib import Path

from module_config import (
    MODULE_REGISTRY,
    ModulePatch,
    apply_legacy_module_settings,
    apply_module_patches,
    effective_module_map,
    module_ai_allowed,
    module_home_allowed,
    module_notifications_allowed,
    module_settings_projection,
)


EXPECTED_CODES = {
    "nutrition", "labs", "symptoms", "pressure", "sleep", "mental", "meds",
    "body", "chronic", "women", "weight", "documents", "tasks",
}


def test_registry_is_complete_and_nutrition_is_opt_in():
    assert {item["module_code"] for item in MODULE_REGISTRY} == EXPECTED_CODES
    config = effective_module_map({})
    assert set(config) == EXPECTED_CODES
    assert config["nutrition"]["enabled"] is False
    assert config["nutrition"]["allow_ai_analytics"] is False


def test_legacy_settings_migrate_without_losing_old_ai_behavior():
    profile = {"module_settings": {"nutrition": True, "labs": False}}
    config = effective_module_map(profile)
    assert config["nutrition"]["source"] == "migration"
    assert config["nutrition"]["enabled"] is True
    assert config["nutrition"]["allow_ai_analytics"] is True
    assert config["labs"]["enabled"] is False
    assert config["labs"]["allow_ai_analytics"] is False


def test_scopes_are_independent_and_enabled_is_required():
    profile = {}
    config = apply_module_patches(profile, [
        ModulePatch(
            module_code="labs",
            enabled=True,
            show_on_home=False,
            allow_ai_analytics=True,
            notifications_enabled=False,
        )
    ])
    projected = module_settings_projection(config)
    migrated = {"module_config": config, "module_settings": projected}
    assert module_home_allowed(migrated, "labs") is False
    assert module_ai_allowed(migrated, "labs") is True
    assert module_notifications_allowed(migrated, "labs") is False

    config = apply_module_patches(migrated, [ModulePatch(module_code="labs", enabled=False)])
    disabled = {"module_config": config, "module_settings": module_settings_projection(config)}
    assert module_home_allowed(disabled, "labs") is False
    assert module_ai_allowed(disabled, "labs") is False


def test_legacy_client_write_only_changes_enabled_scope():
    original = apply_module_patches({}, [
        ModulePatch(module_code="sleep", show_on_home=False, allow_ai_analytics=False, notifications_enabled=False)
    ])
    profile = {"module_config": original, "module_settings": module_settings_projection(original)}
    updated = apply_legacy_module_settings(profile, {"sleep": True})
    assert updated["sleep"]["enabled"] is True
    assert updated["sleep"]["show_on_home"] is False
    assert updated["sleep"]["allow_ai_analytics"] is False
    assert updated["sleep"]["notifications_enabled"] is False
    assert updated["sleep"]["source"] == "user"


def test_settings_ui_separates_modules_from_home_cards():
    repo_root = Path(__file__).resolve().parents[2]
    source = (repo_root / "frontend" / "app" / "settings.tsx").read_text()
    assert 'getModuleConfig(activeId)' in source
    assert 'patchModuleConfig(activeId' in source
    assert 'МОЯ АИДА — МОДУЛИ' in source
    assert 'ГЛАВНАЯ — КАРТОЧКИ' in source
    assert 'nutrition:' in source
    assert 'settings-module-ai-' in source
    assert 'settings-module-notifications-' in source


def test_home_and_ai_use_canonical_module_permissions():
    repo_root = Path(__file__).resolve().parents[2]
    ai_source = (repo_root / "backend" / "ai_context.py").read_text()
    home_source = (repo_root / "backend" / "home_api.py").read_text()
    puzzle_source = (repo_root / "backend" / "puzzle_api.py").read_text()
    assert 'module_ai_allowed(profile, "nutrition")' in ai_source
    assert 'module_ai_allowed(profile, "labs")' in ai_source
    assert 'effective_module_map(profile)' in home_source
    assert 'apply_module_home_visibility(widgets, profile)' in home_source
    assert 'configured_show_on_home' in puzzle_source


def test_module_notification_gate_is_used_by_native_sync_hooks():
    repo_root = Path(__file__).resolve().parents[2]
    meds = (repo_root / "frontend" / "src" / "hooks" / "use-medication-reminder-sync.ts").read_text()
    sleep = (repo_root / "frontend" / "src" / "hooks" / "use-sleep-recommendation-sync.ts").read_text()
    assert 'notifications_enabled' in meds
    assert 'findModule(moduleResponse, "meds")' in meds
    assert 'notifications_enabled' in sleep
    assert 'findModule(moduleResponse, "sleep")' in sleep
