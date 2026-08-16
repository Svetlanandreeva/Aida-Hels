from puzzle_api import widgets_for_goals


def _by_id(goals):
    return {item["id"]: item for item in widgets_for_goals(goals)}


def test_no_goals_keeps_safe_default_home():
    widgets = _by_id([])
    assert widgets["readiness"]["show_on_home"] is True
    assert widgets["next_medication"]["show_on_home"] is True
    assert widgets["recent_symptom"]["show_on_home"] is True
    assert widgets["latest_lab"]["show_on_home"] is True


def test_labs_only_does_not_surface_unrelated_medication_or_symptom_cards():
    widgets = _by_id(["labs"])
    assert widgets["latest_lab"]["enabled"] is True
    assert widgets["latest_lab"]["show_on_home"] is True
    assert widgets["next_medication"]["show_on_home"] is False
    assert widgets["recent_symptom"]["show_on_home"] is False


def test_medication_goal_enables_medication_widget_and_notifications():
    widgets = _by_id(["meds"])
    assert widgets["next_medication"]["enabled"] is True
    assert widgets["next_medication"]["show_on_home"] is True
    assert widgets["next_medication"]["notifications"] is True
    assert widgets["latest_lab"]["show_on_home"] is False


def test_mental_sleep_and_womens_goals_enable_quick_entry_without_fake_health_values():
    for goal in ("mental", "sleep", "women", "pregnancy"):
        widgets = _by_id([goal])
        assert widgets["quick_note"]["enabled"] is True
        assert widgets["quick_note"]["show_on_home"] is True
        assert widgets["next_medication"]["show_on_home"] is False
        assert widgets["latest_lab"]["show_on_home"] is False


def test_chronic_goal_surfaces_cross_domain_cards():
    widgets = _by_id(["chronic"])
    assert widgets["next_medication"]["show_on_home"] is True
    assert widgets["recent_symptom"]["show_on_home"] is True
    assert widgets["latest_lab"]["show_on_home"] is True
