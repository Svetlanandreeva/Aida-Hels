from datetime import date, timedelta

from sleep_personalization import build_sleep_insight


def _events(start: date, days: int, bedtime: str, wake: str):
    out = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        # Post-midnight bedtime and wake on the same local calendar day.
        out.append({"kind": "bedtime", "local_date": d, "local_time": bedtime})
        out.append({"kind": "wake", "local_date": d, "local_time": wake})
    return out


def test_sleep_engine_waits_for_longitudinal_data():
    start = date(2026, 1, 1)
    events = _events(start, 10, "02:00", "12:00")
    checkins = [{"date": (start + timedelta(days=i)).isoformat(), "energy": 5, "mood": 5, "sleep": 5} for i in range(10)]
    insight = build_sleep_insight(events, checkins, [])
    assert insight["status"] == "learning"
    assert insight["suggested_window"] is None
    assert insight["minimum_days"] == 28


def test_sleep_engine_can_learn_late_personal_window_without_population_target():
    start = date(2026, 1, 1)
    events = []
    checkins = []
    for i in range(35):
        d = (start + timedelta(days=i)).isoformat()
        late = i % 2 == 0
        bedtime = "02:00" if late else "23:00"
        wake = "12:00" if late else "08:00"
        events += [{"kind": "bedtime", "local_date": d, "local_time": bedtime}, {"kind": "wake", "local_date": d, "local_time": wake}]
        checkins.append({"date": d, "energy": 5 if late else 2, "mood": 5 if late else 3, "sleep": 5 if late else 3, "stress": 1 if late else 3, "anxiety": 1 if late else 3})
    insight = build_sleep_insight(events, checkins, [])
    assert insight["status"] == "personalized"
    assert insight["suggested_window"]["start"] == "01:30"
    assert insight["suggested_window"]["end"] == "02:30"
    assert "медицинская норма" in insight["message_ru"]


def test_repeated_poor_sleep_prompts_clinical_review_without_diagnosis():
    start = date(2026, 1, 1)
    events = _events(start, 30, "00:30", "08:30")
    checkins = [{"date": (start + timedelta(days=i)).isoformat(), "sleep": 2, "energy": 2} for i in range(12)]
    insight = build_sleep_insight(events, checkins, [])
    assert insight["clinical_prompt"] is not None
    text = insight["clinical_prompt"]["message_ru"].lower()
    assert "не ставит диагноз" in text
    assert "врач" in text
