from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LAYOUT = ROOT / "frontend" / "app" / "_layout.tsx"


def test_web_bootstrap_does_not_statically_import_native_startup_modules():
    layout = LAYOUT.read_text(encoding="utf-8")

    assert 'import * as SplashScreen from "expo-splash-screen"' not in layout
    assert 'import * as SystemUI from "expo-system-ui"' not in layout
    assert 'Platform.OS !== "web"' in layout
    assert 'import("expo-splash-screen")' in layout
    assert 'import("expo-system-ui")' in layout


def test_native_splash_lifecycle_is_still_preserved():
    layout = LAYOUT.read_text(encoding="utf-8")

    assert "SplashScreen.preventAutoHideAsync()" in layout
    assert "SplashScreen.hideAsync()" in layout
    assert "SystemUI.setBackgroundColorAsync(colors.surface)" in layout
