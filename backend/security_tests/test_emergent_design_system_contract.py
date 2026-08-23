from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_emergent_dark_tokens_are_the_shared_mobile_theme():
    theme = _read("frontend/src/theme.ts")

    assert 'surface: "#050505"' in theme
    assert 'surfaceSecondary: "#111111"' in theme
    assert 'surfaceTertiary: "#1C1C1E"' in theme
    assert 'brandPrimary: "#FF2D55"' in theme
    assert 'brandSecondary: "#3A000A"' in theme
    assert 'display: "Manrope-ExtraBold"' in theme
    assert "export const CONTENT_MAX = 720" in theme


def test_navigation_keeps_module_config_and_pet_entitlement_gates():
    tabs = _read("frontend/app/(tabs)/_layout.tsx")

    for route, module_code in {
        "mind": "mental",
        "pressure": "pressure",
        "body": "body",
        "labs": "labs",
        "tasks": "tasks",
    }.items():
        assert f'{route}: "{module_code}"' in tabs

    assert "getModuleConfig(activeId)" in tabs
    assert "getPetGame(activeId)" in tabs
    assert 'if (name === "companion") return petUnlocked' in tabs


def test_preview_placeholder_does_not_replace_production_aida_chat():
    chat = _read("frontend/app/(tabs)/chat.tsx")

    assert "api.sendChat(activeId, text, lang)" in chat
    assert "Полноценный чат появится скоро" not in chat


def test_public_and_authenticated_shells_use_the_same_dark_canvas():
    layout = _read("frontend/app/_layout.tsx")
    landing = _read("frontend/app/index.tsx")
    app_json = _read("frontend/app.json")

    assert '<StatusBar style="light" />' in layout
    assert "backgroundColor: colors.surface" in landing
    assert app_json.count('"backgroundColor": "#050505"') >= 2


def test_authenticated_shell_stays_bottom_aligned_at_desktop_widths():
    layout = _read("frontend/app/(tabs)/_layout.tsx")
    tab_bar = _read("frontend/src/components/ResponsiveTabBar.tsx")

    assert 'tabBarPosition: "bottom"' in layout
    assert "sidebarShell" not in tab_bar
    assert "maxWidth: 720" in tab_bar
