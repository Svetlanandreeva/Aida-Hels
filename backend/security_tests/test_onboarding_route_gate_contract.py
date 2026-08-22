from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_profile_gate_allows_all_onboarding_steps_until_completion():
    source = (ROOT / "frontend/app/_layout.tsx").read_text(encoding="utf-8")

    assert 'const ONBOARDING_ROUTES = new Set(["onboarding", "onboarding-medical", "onboarding-lifestyle"]);' in source
    assert "const inOnboarding = ONBOARDING_ROUTES.has(route);" in source
    assert 'if (!activeProfile.onboarding_completed && !inOnboarding) router.replace("/onboarding" as any);' in source
    assert 'if (activeProfile.onboarding_completed && inOnboarding) router.replace("/(tabs)" as any);' in source
    assert '<Stack.Screen name="onboarding-medical" />' in source
    assert '<Stack.Screen name="onboarding-lifestyle" />' in source
