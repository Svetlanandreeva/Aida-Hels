import asyncio

from medication_reference import MedicationReferenceService, normalize_rls_item


def test_rls_inventory_row_maps_to_normalized_medication_contract():
    item = normalize_rls_item({
        "packing_id": 12345,
        "trade_name_rus": "Атаракс",
        "as_id": 987,
        "as_name_rus": "Гидроксизин",
        "dosage_form_full_name": "таблетки, покрытые пленочной оболочкой",
        "dose": "25 мг",
        "registration": "ЛП-000000, действует",
        "producer_tran": "Производитель",
        "prep_full": "Атаракс 25 мг таблетки",
        "actdate": "2026-08-22",
    })

    assert item["reference_source"] == "rls_aurora"
    assert item["reference_id"] == "packing:12345"
    assert item["trade_name"] == "Атаракс"
    assert item["active_ingredient"] == "Гидроксизин"
    assert item["active_substance_id"] == 987
    assert item["strength"] == "25 мг"


def test_unconfigured_catalog_does_not_fake_reference_results(monkeypatch):
    monkeypatch.delenv("RLS_AURORA_USERNAME", raising=False)
    monkeypatch.delenv("RLS_AURORA_PASSWORD", raising=False)
    service = MedicationReferenceService()

    result = asyncio.run(service.search("атар", 12))

    assert result["items"] == []
    assert result["provider"] == "rls_aurora"
    assert result["provider_ready"] is False
    assert result["provider_available"] is False


def test_invalid_reference_id_is_not_resolved_without_network(monkeypatch):
    monkeypatch.setenv("RLS_AURORA_USERNAME", "configured-user")
    monkeypatch.setenv("RLS_AURORA_PASSWORD", "configured-password")
    service = MedicationReferenceService()

    assert asyncio.run(service.resolve_reference("rls_aurora", "not-a-packing-id")) is None
    assert asyncio.run(service.resolve_reference("other", "packing:123")) is None
