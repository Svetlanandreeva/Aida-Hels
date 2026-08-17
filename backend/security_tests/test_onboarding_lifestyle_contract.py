from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_profile_contract_persists_lifestyle():
    backend = read("backend/profile_api.py")
    frontend = read("frontend/src/api.ts")
    assert "lifestyle: Dict[str, Any]" in backend
    assert "lifestyle: Optional[Dict[str, Any]]" in backend
    assert 'out.setdefault("lifestyle", {})' in backend
    assert "lifestyle?: Record<string, any>" in frontend


def test_medical_step_continues_to_lifestyle_instead_of_finishing():
    medical = read("frontend/app/onboarding-medical.tsx")
    assert 'router.push("/onboarding-lifestyle"' in medical
    assert 'onboarding_completed: false' in medical
    assert 'testID="continue-medical-onboarding"' in medical


def test_lifestyle_step_covers_hierarchy_and_finishes_onboarding():
    lifestyle = read("frontend/app/onboarding-lifestyle.tsx")
    for marker in (
        "sleep_quality",
        "sleep_hours",
        "bedtime",
        "wake_time",
        "sleep_issues",
        "stress_level",
        "mood_level",
        "energy_level",
        "physical_activity",
        "nicotine",
        "alcohol",
        "caffeine",
        "work_type",
        "diet_type",
        "diet_restrictions",
        "mental_health",
    ):
        assert marker in lifestyle
    assert "onboarding_completed: true" in lifestyle
    assert 'testID="finish-lifestyle-onboarding"' in lifestyle
