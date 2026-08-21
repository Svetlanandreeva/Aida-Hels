from home_api import _attention_allowed, _module_enabled
from profile_api import _module_settings_for_goals
from puzzle_api import widgets_for_goals


def _widget_map(goals):
    return {item["id"]: item for item in widgets_for_goals(goals)}


def test_legacy_profile_keeps_home_backward_compatible():
    profile = {"goals": [], "module_settings": {}}
    assert _module_enabled(profile, "labs") is True
    assert _module_enabled(profile, "pressure") is True
    assert _module_enabled(profile, "meds") is True


def test_general_goal_enables_core_health_modules():
    settings = _module_settings_for_goals(["general"])
    assert settings["labs"] is True
    assert settings["symptoms"] is True
    assert settings["pressure"] is True
    assert settings["mental"] is True
    assert settings["sleep"] is True
    assert settings["meds"] is False
    assert settings["women"] is False


def test_specific_goal_keeps_unrelated_modules_out():
    profile = {
        "goals": ["labs"],
        "module_settings": _module_settings_for_goals(["labs"]),
    }
    assert _module_enabled(profile, "labs") is True
    assert _module_enabled(profile, "pressure") is False
    assert _module_enabled(profile, "meds") is False


def test_goal_based_puzzle_prioritizes_relevant_cards():
    widgets = _widget_map(["labs"])
    assert widgets["latest_lab"]["enabled"] is True
    assert widgets["latest_lab"]["show_on_home"] is True
    assert widgets["next_medication"]["enabled"] is False
    assert widgets["recent_symptom"]["enabled"] is False


def test_medication_goal_enables_medication_card_and_notification():
    widgets = _widget_map(["meds"])
    assert widgets["next_medication"]["enabled"] is True
    assert widgets["next_medication"]["show_on_home"] is True
    assert widgets["next_medication"]["notifications"] is True


def test_attention_respects_module_configuration():
    profile = {
        "goals": ["labs"],
        "module_settings": _module_settings_for_goals(["labs"]),
    }
    assert _attention_allowed(profile, {"type": "lab"}) is True
    assert _attention_allowed(profile, {"type": "bp"}) is False
    assert _attention_allowed(profile, {"type": "symptom"}) is False


def test_explicit_module_setting_wins_over_goal_fallback():
    profile = {
        "goals": ["general"],
        "module_settings": {"labs": False},
    }
    assert _module_enabled(profile, "labs") is False
