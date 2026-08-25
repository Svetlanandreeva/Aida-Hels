from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_onboarding_step1_uses_shared_responsive_layout_and_dynamic_progress():
    source = read("frontend/app/onboarding.tsx")
    assert 'useResponsiveLayout' in source
    assert 'paddingHorizontal:responsive.contentPadding' in source or 'paddingHorizontal: responsive.contentPadding' in source
    assert 'AIDA · {index+1}/{steps.length}' in source
    assert 'width:`${((index+1)/steps.length)*100}%`' in source
    assert 'testID={`onboarding-step-${step}`}' in source


def test_onboarding_step1_selectors_and_actions_have_semantics_and_touch_targets():
    source = read("frontend/app/onboarding.tsx")
    assert 'accessibilityRole="checkbox"' in source
    assert 'accessibilityState={{checked:selected}}' in source or 'accessibilityState={{ checked:selected }}' in source
    assert 'accessibilityRole="alert"' in source
    assert 'accessibilityRole="button"' in source
    assert 'choice:{minHeight:52' in source
    assert 'primary:{marginTop:spacing.xl,minHeight:54' in source


def test_onboarding_step1_tiny_phone_layout_keeps_compact_question_geometry():
    source = read("frontend/app/onboarding.tsx")
    assert 'dateRow:{flexDirection:"row",gap:8}' in source
    assert 'input:{minHeight:54' in source
    assert 'content:{width:"100%",maxWidth:620' in source
    assert 'backgroundColor:colors.surfaceSecondary' in source
    assert 'fontFamily:fonts.display' in source
    assert 'backgroundColor:colors.onSurface' in source
