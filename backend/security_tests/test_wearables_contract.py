from datetime import datetime, timedelta, timezone

from wearables_api import WearableSample, sample_fingerprint, sample_state


def _sample(**overrides):
    data = {
        "metric": "heart_rate",
        "value": 72.0,
        "unit": "count/min",
        "start_at": datetime(2026, 8, 16, 0, 0, tzinfo=timezone.utc),
        "source_name": "Health Connect",
        "device_name": "Watch",
    }
    data.update(overrides)
    return WearableSample(**data)


def test_fingerprint_is_stable_for_identical_provider_record():
    a = sample_fingerprint("android_health_connect", "profile-1", _sample())
    b = sample_fingerprint("android_health_connect", "profile-1", _sample())
    assert a == b


def test_fingerprint_separates_hrv_methods_and_values():
    sdnn = sample_fingerprint("apple_health", "profile-1", _sample(metric="hrv_sdnn", value=42.0, unit="ms"))
    rmssd = sample_fingerprint("android_health_connect", "profile-1", _sample(metric="hrv_rmssd", value=42.0, unit="ms"))
    assert sdnn != rmssd


def test_status_is_not_connected_without_real_measurement():
    assert sample_state(None) == "not_connected"


def test_status_marks_old_measurement_stale():
    now = datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc)
    latest = {"end_at": now - timedelta(days=3)}
    assert sample_state(latest, now=now) == "stale"


def test_status_keeps_recent_measurement_as_data():
    now = datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc)
    latest = {"end_at": now - timedelta(hours=2)}
    assert sample_state(latest, now=now) == "data"
