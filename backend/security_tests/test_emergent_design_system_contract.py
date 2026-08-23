from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_emergent_dark_tokens_are_the_shared_mobile_theme():
    theme = _read("frontend/src/theme.ts")

    assert 'surface: "#09090B"' in theme
    assert 'surfaceSecondary: "#151517"' in theme
    assert 'brandPrimary: "#F0445B"' in theme
    assert 'brandSecondary: "#3B82F6"' in theme
    assert 'display: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" })' in theme


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
    assert app_json.count('"backgroundColor": "#09090B"') >= 2
