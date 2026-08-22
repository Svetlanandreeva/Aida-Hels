from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_lifestyle_onboarding_exposes_progress_and_selection_semantics():
    source = read("frontend/app/onboarding-lifestyle.tsx")
    assert 'accessibilityRole="progressbar"' in source
    assert "accessibilityValue={{ min: 0, max: 4, now: 3" in source
    assert 'accessibilityState={{ selected: active }}' in source
    assert 'accessibilityState={{ selected: value === item }}' in source
    assert "const SCALE = [0, 1, 2, 3, 4, 5]" in source
    assert "const SCALE_COLORS" in source


def test_lifestyle_fields_and_actions_have_accessible_contract():
    source = read("frontend/app/onboarding-lifestyle.tsx")
    assert "accessibilityLabel={props.accessibilityLabel || label}" in source
    assert 'accessibilityRole="alert"' in source
    assert 'accessibilityState={{ disabled: !canSave || busy, busy }}' in source
    assert 'accessibilityState={{ disabled: busy }}' in source


def test_lifestyle_controls_are_resilient_on_small_screens():
    source = read("frontend/app/onboarding-lifestyle.tsx")
    assert "minHeight:44" in source
    assert 'actions:{flexDirection:"row",flexWrap:"wrap"' in source
    assert 'primaryText:{color:colors.onSurfaceInverse,fontWeight:"800",textAlign:"center",flexShrink:1}' in source
    assert "pressed:{opacity:.82}" in source
