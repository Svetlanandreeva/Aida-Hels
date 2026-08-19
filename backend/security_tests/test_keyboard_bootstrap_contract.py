from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LAYOUT = ROOT / "frontend" / "app" / "_layout.tsx"
WEB_ROOT = ROOT / "frontend" / "src" / "components" / "KeyboardRoot.web.tsx"
NATIVE_ROOT = ROOT / "frontend" / "src" / "components" / "KeyboardRoot.native.tsx"


def test_web_bootstrap_does_not_import_keyboard_controller():
    layout = LAYOUT.read_text(encoding="utf-8")
    web = WEB_ROOT.read_text(encoding="utf-8")
    native = NATIVE_ROOT.read_text(encoding="utf-8")

    assert 'from "react-native-keyboard-controller"' not in layout
    assert 'from "@/src/components/KeyboardRoot"' in layout
    assert "react-native-keyboard-controller" not in web
    assert 'from "react-native-keyboard-controller"' in native
    assert "<KeyboardProvider>{children}</KeyboardProvider>" in native
