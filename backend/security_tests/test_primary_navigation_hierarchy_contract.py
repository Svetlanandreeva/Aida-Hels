from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def _primary_tab_module_block(layout: str) -> str:
    marker = "const PRIMARY_TAB_MODULES"
    before, found, after = layout.partition(marker)
    assert found, "PRIMARY_TAB_MODULES must define the canonical primary navigation map"
    block, end, _ = after.partition("};")
    assert end, "PRIMARY_TAB_MODULES must be a closed object literal"
    return block


def test_primary_navigation_matches_product_hierarchy():
    layout = read("frontend/app/(tabs)/_layout.tsx")
    primary_map = _primary_tab_module_block(layout)

    expected = ["index", "mind", "pressure", "body", "labs", "chat", "tasks"]
    for route in expected:
        assert f'<Tabs.Screen name="{route}"' in layout
        assert f"{route}:" in primary_map

    # The pet is a conditional game route rather than a medical ModuleConfig tab.
    # It becomes visible only after the level-2 unlock and therefore stays outside
    # PRIMARY_TAB_MODULES while still being part of the product navigation hierarchy.
    assert '<Tabs.Screen name="companion"' in layout
    assert 'if (name === "companion") return petUnlocked;' in layout

    # Legacy aggregation/profile routes remain addressable but must not appear in
    # the primary navigation shell.
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
