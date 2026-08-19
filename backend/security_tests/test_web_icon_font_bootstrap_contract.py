from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ICON_FONTS = ROOT / "frontend" / "src" / "hooks" / "use-icon-fonts.ts"


def test_web_bootstrap_only_eagerly_loads_ionicons_and_defers_other_families():
    source = ICON_FONTS.read_text(encoding="utf-8")

    assert 'const WEB_CRITICAL_ICON_FONTS' in source
    assert 'ionicons: cdnUrl("Ionicons")' in source
    assert 'family !== "ionicons"' in source
    assert 'requestIdleCallback' in source
    assert 'Font.loadAsync(WEB_DEFERRED_ICON_FONTS)' in source
    assert 'isWeb ? WEB_CRITICAL_ICON_FONTS' in source


def test_native_expo_go_keeps_full_icon_font_map():
    source = ICON_FONTS.read_text(encoding="utf-8")

    assert 'ExecutionEnvironment.StoreClient' in source
    assert 'isExpoGo ? cdnIconFontMap() : {}' in source
