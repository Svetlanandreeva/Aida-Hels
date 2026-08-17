from home_api import _error_state, _lab_status_state, _list_state, _readiness_state


def test_empty_list_state_is_explicit_no_data_not_fake_zero():
    assert _list_state([]) == {"state": "no_data", "items": []}


def test_readiness_without_usable_scores_is_insufficient_data_not_zero():
    empty = _readiness_state(None)
    assert empty == {"state": "insufficient_data", "value": None, "scores": {}}

    zeros = _readiness_state({"overall": 0, "scores": {"sleep": 0, "activity": 0}})
    assert zeros["state"] == "insufficient_data"
    assert zeros["value"] is None
    assert zeros["scores"] == {"sleep": 0, "activity": 0}


def test_lab_status_without_markers_uses_none_counts_not_medical_zero():
    state = _lab_status_state([])
    assert state == {"state": "no_data", "in_range": None, "out_of_range": None}


def test_lab_status_with_real_markers_returns_data_counts():
    state = _lab_status_state(
        [
            {
                "biomarkers": [
                    {"name": "A", "status": "normal"},
                    {"name": "B", "status": "high"},
                    {"name": "C", "status": "low"},
                    {"name": "D", "status": "unknown"},
                ]
            }
        ]
    )
    assert state == {"state": "data", "in_range": 1, "out_of_range": 2}


def test_source_failure_is_isolated_as_error_state():
    state = _error_state(RuntimeError("boom"))
    assert state == {"state": "error", "error": "RuntimeError"}
    assert "value" not in state
    assert "items" not in state
