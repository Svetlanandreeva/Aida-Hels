from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_emergency_card_uses_shared_responsive_and_accessibility_contract():
    source = read("frontend/app/emergency-card.tsx")
    assert 'useResponsiveLayout' in source
    assert 'paddingHorizontal: responsive.contentPadding' in source
    assert 'width: 44, height: 44' in source
    assert 'router.canGoBack()' in source
    assert 'router.replace("/" as any)' in source
    assert 'accessibilityRole="button"' in source
    assert 'accessibilityLabel={ru ? "Назад" : "Back"}' in source
    assert 'flexWrap: "wrap"' in source
    assert 'flexShrink: 1' in source
    assert 'pressed && s.pressed' in source
