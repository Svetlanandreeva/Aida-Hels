from pathlib import Path

from module_config import MODULE_REGISTRY, effective_module_map, module_settings_for_goals


ROOT = Path(__file__).resolve().parents[2]
ONBOARDING = ROOT / "frontend" / "app" / "onboarding.tsx"
TABS_LAYOUT = ROOT / "frontend" / "app" / "(tabs)" / "_layout.tsx"
SETTINGS = ROOT / "frontend" / "app" / "settings.tsx"


def registry_codes():
    return {item["module_code"] for item in MODULE_REGISTRY}


def test_goal_projection_explicitly_covers_every_ready_module():
    settings = module_settings_for_goals(["labs"])
    assert set(settings) == registry_codes()
    assert settings["labs"] is True
    assert settings["pressure"] is False
    assert settings["mental"] is False
    assert settings["body"] is False
    assert settings["documents"] is False
    assert settings["tasks"] is False
    assert settings["nutrition"] is False


def test_empty_goal_source_is_minimal_not_broad_preset():
    config = effective_module_map({"goals": [], "module_settings": {}, "module_settings_source": "goals"})
    assert set(config) == registry_codes()
    assert all(item["enabled"] is False for item in config.values())
    assert all(item["source"] == "goals" for item in config.values())


def test_legacy_profile_without_goal_source_keeps_compatibility_defaults():
    config = effective_module_map({"goals": [], "module_settings": {}})
    assert config["labs"]["enabled"] is True
    assert config["tasks"]["enabled"] is True
    assert config["nutrition"]["enabled"] is False
    assert config["labs"]["source"] == "preset"


def test_manual_module_config_wins_over_onboarding_goals():
    config = effective_module_map({
        "goals": ["labs"],
        "module_config": {
            "pressure": {
                "module_code": "pressure",
                "enabled": True,
                "source": "user",
            }
        },
    })
    assert config["labs"]["enabled"] is True
    assert config["pressure"]["enabled"] is True
    assert config["pressure"]["source"] == "user"
    assert config["tasks"]["enabled"] is False


def test_weight_goal_enables_weight_and_body_but_not_nutrition():
    settings = module_settings_for_goals(["weight"])
    assert settings["weight"] is True
    assert settings["body"] is True
    assert settings["nutrition"] is False


def test_personal_app_frontend_contract():
    onboarding = ONBOARDING.read_text(encoding="utf-8")
    tabs = TABS_LAYOUT.read_text(encoding="utf-8")
    settings = SETTINGS.read_text(encoding="utf-8")
    assert '["weight", "Вес / образ жизни", "Weight / lifestyle"]' in onboarding
    assert '["other", "Другое", "Other"]' in onboarding
    assert "getModuleConfig" in tabs
    assert "PRIMARY_TAB_MODULES" in tabs
    assert 'index: null' in tabs and 'chat: null' in tabs
    assert "enabledModules === null" in tabs
    assert "enableAllModules" in settings
    assert "Хочу отслеживать всё" in settings
