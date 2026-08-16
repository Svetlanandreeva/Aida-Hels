from pathlib import Path

SRC = (Path(__file__).resolve().parents[1] / "cycle_api.py").read_text(encoding="utf-8")


def test_cycle_forecast_is_profile_scoped_and_not_population_defaulted():
    assert '"profile_id": profile_id' in SRC
    assert '"event_type": "period_start"' in SRC
    assert 'statistics.median(plausible)' in SRC
    assert 'basis = "personal_history"' in SRC
    assert 'basis = "user_settings"' in SRC
    assert 'cycle_length = 28' not in SRC
    assert '"state": "insufficient_data"' in SRC


def test_cycle_forecast_keeps_uncertainty_and_safety_language():
    assert '"window_start"' in SRC
    assert '"window_end"' in SRC
    assert '"confidence"' in SRC
    assert 'не является подтверждением овуляции или беременности' in SRC


def test_cycle_mutations_require_profile_write_access():
    assert 'await require(account, data.profile_id, write=True)' in SRC
    assert 'await require(account, str(event.get("profile_id") or ""), write=True)' in SRC
