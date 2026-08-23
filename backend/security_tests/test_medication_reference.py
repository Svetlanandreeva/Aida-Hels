import asyncio

from medication_reference import MedicationReferenceService, normalize_rls_item


def _atarax_row():
    return {
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
    }


def test_rls_inventory_row_maps_to_normalized_medication_contract():
    item = normalize_rls_item(_atarax_row())

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


def test_search_combines_trade_name_and_active_ingredient_queries(monkeypatch):
    monkeypatch.setenv("RLS_AURORA_USERNAME", "configured-user")
    monkeypatch.setenv("RLS_AURORA_PASSWORD", "configured-password")
    service = MedicationReferenceService()

    calls = []

    async def fake_inventory(**params):
        calls.append(params)
        if params.get("tn_like") == "атар":
            return [_atarax_row()]
        if params.get("mnn_like") == "гидро":
            return [_atarax_row()]
        return []

    monkeypatch.setattr(service, "_inventory", fake_inventory)

    by_trade = asyncio.run(service.search("атар", 12))
    by_substance = asyncio.run(service.search("гидро", 12))

    assert by_trade["items"][0]["trade_name"] == "Атаракс"
    assert by_trade["items"][0]["active_ingredient"] == "Гидроксизин"
    assert by_substance["items"][0]["trade_name"] == "Атаракс"
    assert any(call.get("tn_like") == "атар" for call in calls)
    assert any(call.get("mnn_like") == "гидро" and call.get("search_from_start") == 0 for call in calls)


def test_reference_selection_is_resolved_by_stable_packing_id(monkeypatch):
    monkeypatch.setenv("RLS_AURORA_USERNAME", "configured-user")
    monkeypatch.setenv("RLS_AURORA_PASSWORD", "configured-password")
    service = MedicationReferenceService()

    async def fake_inventory(**params):
        return [_atarax_row()] if params.get("packing_id") == 12345 else []

    monkeypatch.setattr(service, "_inventory", fake_inventory)
    item = asyncio.run(service.resolve_reference("rls_aurora", "packing:12345"))

    assert item is not None
    assert item["active_substance_id"] == 987
    assert item["active_ingredient"] == "Гидроксизин"


def test_invalid_reference_id_is_not_resolved_without_network(monkeypatch):
    monkeypatch.setenv("RLS_AURORA_USERNAME", "configured-user")
    monkeypatch.setenv("RLS_AURORA_PASSWORD", "configured-password")
    service = MedicationReferenceService()

    assert asyncio.run(service.resolve_reference("rls_aurora", "not-a-packing-id")) is None
    assert asyncio.run(service.resolve_reference("other", "packing:123")) is None
