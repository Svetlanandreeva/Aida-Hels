from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_onboarding_step1_uses_shared_responsive_layout_and_accessible_progress():
    source = read("frontend/app/onboarding.tsx")
    assert 'useResponsiveLayout' in source
    assert 'paddingHorizontal: responsive.contentPadding' in source
    assert 'accessibilityRole="progressbar"' in source
    assert 'accessibilityValue={{ min: 0, max: 4, now: 1' in source
    assert 'AIDA · 1/4' in source
    assert 'progressFill:{height:4,width:"25%"' in source


def test_onboarding_step1_selectors_and_actions_have_semantics_and_touch_targets():
    source = read("frontend/app/onboarding.tsx")
    assert 'accessibilityRole="radio"' in source
    assert 'accessibilityState={{ selected: sex === v }}' in source
    assert 'accessibilityRole="checkbox"' in source
    assert 'accessibilityState={{ checked: selected }}' in source
    assert 'chip:{minHeight:44' in source
    assert 'accessibilityRole="alert"' in source
    assert 'accessibilityState={{ disabled: !canSave || busy, busy }}' in source


def test_onboarding_step1_tiny_phone_layout_can_wrap_without_changing_design_tokens():
    source = read("frontend/app/onboarding.tsx")
    assert 'dateRow:{flexDirection:"row",flexWrap:"wrap"' in source
    assert 'datePart:{flex:1,minWidth:80}' in source
    assert 'dateYear:{flex:1.25,minWidth:112}' in source
    assert 'backgroundColor:colors.surfaceSecondary' in source
    assert 'borderRadius:radius.lg' in source
    assert 'fontFamily:fonts.display' in source
    assert 'backgroundColor:colors.onSurface' in source
