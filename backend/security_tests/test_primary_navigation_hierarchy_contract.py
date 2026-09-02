from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_primary_navigation_matches_figma_product_hierarchy():
    layout = read("frontend/app/(tabs)/_layout.tsx")

    expected_primary = ["index", "health", "chat", "tasks", "profile"]
    for route in expected_primary:
        assert f'<Tabs.Screen name="{route}"' in layout
        assert f'"{route}"' in layout

    # Medical detail modules stay addressable but no longer compete with the
    # five canonical mobile tabs from the approved Figma information architecture.
    for route in ["mind", "pressure", "body", "labs", "companion"]:
        assert f'<Tabs.Screen name="{route}" options={{ href: null }}' in layout

    tabbar = read("frontend/src/components/ResponsiveTabBar.tsx")
    for route in expected_primary:
        assert f"{route}:" in tabbar


def test_primary_navigation_reuses_existing_section_screens():
    wrappers = {
        "frontend/app/(tabs)/mind.tsx": '@/src/emergent/screens/Mind',
        "frontend/app/(tabs)/pressure.tsx": '@/src/emergent/screens/Pressure',
        "frontend/app/(tabs)/labs.tsx": '@/src/emergent/screens/Labs',
    }
    for path, target in wrappers.items():
        source = read(path)
        assert f'from "{target}"' in source
