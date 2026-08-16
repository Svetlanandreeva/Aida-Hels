from medication_api import _effective_times


def test_wake_anchor_shifts_first_dose_when_user_wakes_late():
    med = {"times": ["10:00", "14:00", "20:00"], "first_dose_anchor": "wake", "wake_offset_minutes": 0}
    slots = _effective_times(med, "12:00")
    assert [s["time"] for s in slots] == ["12:00", "14:00", "20:00"]
    assert slots[0]["anchor"] == "wake"
    assert slots[0]["planned_time"] == "10:00"


def test_wake_anchor_never_pulls_first_dose_earlier_than_plan():
    med = {"times": ["10:00", "14:00", "20:00"], "first_dose_anchor": "wake", "wake_offset_minutes": 0}
    slots = _effective_times(med, "08:00")
    assert [s["time"] for s in slots] == ["10:00", "14:00", "20:00"]
    assert slots[0]["anchor"] == "clock"


def test_fixed_schedule_ignores_wake_time():
    med = {"times": ["10:00", "14:00"], "first_dose_anchor": "clock"}
    slots = _effective_times(med, "12:00")
    assert [s["time"] for s in slots] == ["10:00", "14:00"]
