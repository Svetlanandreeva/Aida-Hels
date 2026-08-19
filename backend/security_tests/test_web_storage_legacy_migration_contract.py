from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WEB_STORAGE = ROOT / "frontend" / "src" / "utils" / "storage" / "index.web.ts"


def test_web_storage_caches_legacy_miss_per_key():
    source = WEB_STORAGE.read_text(encoding="utf-8")

    assert 'LEGACY_MIGRATION_MARKER_PREFIX = "aida.storage.legacyChecked:"' in source
    assert 'store?.getItem(marker) === "1"' in source
    assert 'store?.setItem(marker, "1")' in source
    assert 'if (legacy === undefined) return fallback' in source


def test_web_storage_writes_and_removals_block_legacy_resurrection():
    source = WEB_STORAGE.read_text(encoding="utf-8")

    assert 'store.setItem(legacyMarkerKey(key), "1")' in source
    assert 'store?.setItem(legacyMarkerKey(key), "1")' in source
    assert 'void legacyRemove(key)' in source


def test_legacy_async_storage_remains_dynamic_only():
    source = WEB_STORAGE.read_text(encoding="utf-8")

    assert 'import("@react-native-async-storage/async-storage")' in source
    assert 'from "@react-native-async-storage/async-storage"' not in source
