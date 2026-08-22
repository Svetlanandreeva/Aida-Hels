from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_onboarding_medical_uses_shared_responsive_layout_and_accessible_progress():
    source = read("frontend/app/onboarding-medical.tsx")
    assert 'useResponsiveLayout' in source
    assert 'paddingHorizontal: responsive.contentPadding' in source
    assert 'accessibilityRole="progressbar"' in source
    assert 'accessibilityValue={{ min: 0, max: 4, now: 2' in source
    assert 'AIDA · 2/4' in source
    assert 'width: "50%"' in source


def test_onboarding_medical_choices_and_actions_have_semantics_and_touch_targets():
    source = read("frontend/app/onboarding-medical.tsx")
    assert 'accessibilityRole="radio"' in source
    assert 'accessibilityState={{ selected: planning === id }}' in source
    assert 'accessibilityRole="switch"' in source
    assert 'accessibilityState={{ checked: value }}' in source
    assert 'chip:{minHeight:44' in source
    assert 'responsive.isCompactPhone && s.actionsCompact' in source
    assert 'accessibilityRole="alert"' in source


def test_onboarding_medical_design_lock_keeps_existing_surface_tokens():
    source = read("frontend/app/onboarding-medical.tsx")
    assert 'backgroundColor:colors.surfaceSecondary' in source
    assert 'borderRadius:radius.lg' in source
    assert 'fontFamily:fonts.display' in source
    assert 'backgroundColor:colors.onSurface' in source
