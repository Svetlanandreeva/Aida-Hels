import asyncio

from medication_reference import MedicationReferenceService, _finalize_candidate


class FakeCursor:
    def __init__(self, collection):
        self.collection = collection

    async def to_list(self, length):
        self.collection.reads += 1
        return [dict(row) for row in self.collection.rows.values()][:length]


class FakeCollection:
    def __init__(self, rows=None):
        self.rows = {row["id"]: dict(row) for row in (rows or [])}
        self.reads = 0
        self.writes = 0

    def find(self, query=None, projection=None):
        return FakeCursor(self)

    async def find_one(self, query, projection=None):
        row = self.rows.get(query.get("id"))
        return dict(row) if row else None

    async def update_one(self, query, update, upsert=False):
        self.writes += 1
        row = dict(self.rows.get(query.get("id"), {}))
        row.update(query)
        row.update(update.get("$set", update))
        self.rows[row["id"]] = row
        return {"matched_count": 1 if query.get("id") in self.rows else 0}


class FakeDB:
    def __init__(self, rows=None):
        self.medication_catalog = FakeCollection(rows)


def atarax_item():
    return _finalize_candidate({
        "trade_name": "Атаракс",
        "active_ingredient": "Гидроксизин",
        "active_substance_id": "wikidata:Q0001",
        "aliases": ["Atarax", "hydroxyzine"],
        "verification_status": "probable",
        "confidence": 0.74,
        "source_names": ["Wikidata"],
        "source_urls": ["https://www.wikidata.org/wiki/Q0002"],
        "external_ids": {"wikidata_product": "Q0002"},
    })


def test_catalog_item_uses_stable_internal_reference():
    item = atarax_item()

    assert item is not None
    assert item["reference_source"] == "aida_catalog"
    assert item["reference_id"].startswith("medref_")
    assert item["trade_name"] == "Атаракс"
    assert item["active_ingredient"] == "Гидроксизин"
    assert item["verification_status"] == "probable"


def test_google_sheet_catalog_is_loaded_into_ram_and_reused(monkeypatch):
    item = atarax_item()
    db = FakeDB([item])
    service = MedicationReferenceService(db)

    async def no_external(query):
        return [], ["RxNorm", "PubChem", "Wikidata"], True

    monkeypatch.setattr(service, "_lookup_external", no_external)

    first = asyncio.run(service.search("Атаракс", 12))
    second = asyncio.run(service.search("Атаракс", 12))

    assert first["items"][0]["active_ingredient"] == "Гидроксизин"
    assert first["cache_hit"] is True
    assert second["cache_hit"] is True
    assert db.medication_catalog.reads == 1


def test_cache_miss_is_normalized_and_persisted(monkeypatch):
    db = FakeDB()
    service = MedicationReferenceService(db)
    candidate = _finalize_candidate({
        "trade_name": "Atarax",
        "active_ingredient": "hydroxyzine",
        "active_substance_id": "rxnorm:5553",
        "aliases": ["Атаракс", "hydroxyzine"],
        "verification_status": "verified",
        "confidence": 0.98,
        "source_names": ["RxNorm"],
        "source_urls": ["https://rxnav.nlm.nih.gov/REST/rxcui/123"],
        "external_ids": {"rxnorm_product_rxcui": "123"},
    })

    async def fake_external(query):
        return [candidate], ["RxNorm"], True

    monkeypatch.setattr(service, "_lookup_external", fake_external)
    result = asyncio.run(service.search("Atarax", 12))

    assert result["items"][0]["active_ingredient"] == "hydroxyzine"
    assert result["items"][0]["reference_source"] == "aida_catalog"
    assert db.medication_catalog.writes == 1
    assert candidate["id"] in db.medication_catalog.rows


def test_selected_reference_is_resolved_from_server_side_catalog():
    item = atarax_item()
    db = FakeDB([item])
    service = MedicationReferenceService(db)

    resolved = asyncio.run(service.resolve_reference("aida_catalog", item["id"]))

    assert resolved is not None
    assert resolved["active_ingredient"] == "Гидроксизин"
    assert asyncio.run(service.resolve_reference("manual", item["id"])) is None
    assert asyncio.run(service.resolve_reference("aida_catalog", "not-a-catalog-id")) is None


def test_exact_manual_name_can_reuse_cached_alias():
    item = atarax_item()
    db = FakeDB([item])
    service = MedicationReferenceService(db)

    resolved = asyncio.run(service.resolve_exact_trade_name("Atarax"))

    assert resolved is not None
    assert resolved["trade_name"] == "Атаракс"
    assert resolved["active_ingredient"] == "Гидроксизин"
