from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_primary_navigation_matches_product_hierarchy():
    layout = read("frontend/app/(tabs)/_layout.tsx")
    expected = ["index", "mind", "pressure", "body", "labs", "chat", "tasks"]
    for route in expected:
        assert f'<Tabs.Screen name="{route}"' in layout
        assert f'"{route}"' in layout.split("PRIMARY_TABS", 1)[1]
    assert '<Tabs.Screen name="health" options={{ href: null }}' in layout
    assert '<Tabs.Screen name="profile" options={{ href: null }}' in layout


def test_primary_navigation_reuses_existing_section_screens():
    wrappers = {
        "frontend/app/(tabs)/mind.tsx": '../mind',
        "frontend/app/(tabs)/pressure.tsx": '../pressure',
        "frontend/app/(tabs)/labs.tsx": '../labs',
    }
    for path, target in wrappers.items():
        source = read(path)
        assert f'from "{target}"' in source
