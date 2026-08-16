from medication_api import MedicationCreate, MedicationUpdate, _notification_ids


def test_notification_ids_are_deduplicated_and_bounded():
    values = ["n1", "n1", "", "n2"] + [f"n{i}" for i in range(3, 80)]
    result = _notification_ids(values)
    assert result[:2] == ["n1", "n2"]
    assert len(result) == 64
    assert len(result) == len(set(result))


def test_medication_models_accept_persisted_notification_ids():
    created = MedicationCreate(profile_id="p1", name="Test", notification_ids=["a", "b"])
    assert created.notification_ids == ["a", "b"]
    updated = MedicationUpdate(notification_ids=[])
    assert updated.notification_ids == []
