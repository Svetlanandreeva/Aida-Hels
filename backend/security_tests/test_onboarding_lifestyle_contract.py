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


def test_lifestyle_step_covers_hierarchy_and_continues_to_medications():
    lifestyle = read("frontend/app/onboarding-lifestyle.tsx")
    for marker in (
        "sleep_quality",
        "sleep_hours",
        "sleep_schedule_mode",
        "bedtime",
        "wake_time",
        "bedtime_range_start",
        "bedtime_range_end",
        "wake_time_range_start",
        "wake_time_range_end",
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
    ):
        assert marker in lifestyle
    assert "mental_health" not in lifestyle
    assert 'onboarding_completed: false' in lifestyle
    assert 'router.push("/onboarding-medications"' in lifestyle
    assert 'testID="continue-lifestyle-onboarding"' in lifestyle


def test_daily_medications_is_the_final_onboarding_step():
    medications = read("frontend/app/onboarding-medications.tsx")
    assert "Принимаете ли вы на ежедневной основе какие-либо препараты?" in medications
    assert 'testID="medication-name-dropdown"' in medications
    assert 'testID="onboarding-medication-dose"' in medications
    assert 'day_parts: dayParts' in medications
    assert 'meal_relation: mealRelation' in medications
    assert 'dose_unit: doseUnit' in medications
    assert 'onboarding_completed: true' in medications
    assert 'testID="finish-medications-onboarding"' in medications
