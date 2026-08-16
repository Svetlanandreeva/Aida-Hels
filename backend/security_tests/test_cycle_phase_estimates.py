from datetime import date

from cycle_api import _build_phase_estimates


def test_phase_estimates_do_not_infer_ovulation_without_personal_evidence():
    result = _build_phase_estimates(
        starts=[date(2026, 6, 1), date(2026, 7, 1), date(2026, 7, 31)],
        next_start=date(2026, 8, 30),
        period_length=5,
        ovulation_tests=[],
    )

    assert result["state"] == "data"
    assert [phase["key"] for phase in result["phases"]] == ["menstrual"]
    assert result["ovulation"]["state"] == "insufficient_data"
    assert result["ovulation"]["evidence_count"] == 0


def test_phase_estimates_use_only_profile_positive_test_history_for_ovulation_window():
    result = _build_phase_estimates(
        starts=[date(2026, 5, 1), date(2026, 6, 1), date(2026, 7, 1)],
        next_start=date(2026, 8, 1),
        period_length=5,
        ovulation_tests=[
            {"observed_at": "2026-05-15", "value": "positive"},
            {"observed_at": "2026-06-16", "value": "positive"},
            {"observed_at": "2026-06-18", "value": "negative"},
        ],
    )

    ovulation = result["ovulation"]
    assert ovulation["state"] == "predicted"
    assert ovulation["basis"] == "personal_positive_ovulation_tests"
    assert ovulation["evidence_count"] == 2
    assert ovulation["window_start"] == "2026-07-14"
    assert ovulation["window_end"] == "2026-07-16"
    assert all(phase["status"] == "predicted" for phase in result["phases"])


def test_menstrual_phase_requires_user_period_length_and_never_uses_hidden_five_day_default():
    result = _build_phase_estimates(
        starts=[date(2026, 6, 1), date(2026, 7, 1)],
        next_start=date(2026, 8, 1),
        period_length=None,
        ovulation_tests=[],
    )

    assert result["state"] == "insufficient_data"
    assert result["phases"] == []
