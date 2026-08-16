from pathlib import Path

from pregnancy_api import _derived


ROOT = Path(__file__).resolve().parents[1]


def test_planning_is_never_derived_as_pregnancy():
    result = _derived({"status": "planning", "lmp_date": "2026-01-01"})
    assert result["state"] == "planning"
    assert result["gestational_week"] is None


def test_pregnancy_without_explicit_timing_is_insufficient_data():
    result = _derived({"status": "pregnant"})
    assert result["state"] == "insufficient_data"
    assert result["gestational_week"] is None


def test_pregnancy_api_does_not_infer_status_from_cycle_storage():
    source = (ROOT / "pregnancy_api.py").read_text()
    assert "cycle_events.find" not in source
    assert 'status: Literal["planning", "pregnant", "postpartum", "completed"]' in source
    assert "Planning must not be marked as confirmed pregnancy" in source


def test_production_entrypoint_wires_pregnancy_router():
    source = (ROOT / "main.py").read_text()
    assert "build_pregnancy_router" in source
    assert "app.include_router(build_pregnancy_router" in source
