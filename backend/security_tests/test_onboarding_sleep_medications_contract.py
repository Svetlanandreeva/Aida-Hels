from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_sleep_times_are_masked_and_support_irregular_ranges():
    source = read("frontend/app/onboarding-lifestyle.tsx")
    assert "const formatTimeInput" in source
    assert 'value.replace(/\\D/g, "").slice(0, 4)' in source
    assert "const normalizeTime" in source
    assert 'keyboardType="number-pad"' in source
    assert 'inputMode="numeric"' in source
    assert "maxLength={5}" in source
    assert "Нет регулярного времени сна" in source
    assert 'sleep_schedule_mode: noRegularSleepTime ? "range" : "regular"' in source
    for marker in ("bedtime_range_start", "bedtime_range_end", "wake_time_range_start", "wake_time_range_end"):
        assert marker in source


def test_wellbeing_uses_colored_zero_to_five_continuous_scale():
    source = read("frontend/app/onboarding-lifestyle.tsx")
    assert "const SCALE = [0, 1, 2, 3, 4, 5]" in source
    assert "const SCALE_COLORS" in source
    assert "colors.error" in source and "colors.success" in source
    assert 'import { LinearGradient } from "expo-linear-gradient"' in source
    assert "<LinearGradient" in source
    assert "scaleTrack" in source and "scaleTickRow" in source and "scaleThumb" in source
    assert 'accessibilityRole="adjustable"' in source
    assert "onResponderMove=" in source
    assert "scaleBar" not in source and "scaleTickSelected" not in source and "scaleSegment" not in source
    assert "stress_level: stressWellbeing === null ? null : 5 - stressWellbeing" in source


def test_mental_medication_prompt_moved_off_lifestyle_step():
    lifestyle = read("frontend/app/onboarding-lifestyle.tsx")
    medications = read("frontend/app/onboarding-medications.tsx")
    assert "Психическое здоровье" not in lifestyle
    assert "Принимаемые препараты" not in lifestyle
    assert "Принимаете ли вы на ежедневной основе какие-либо препараты?" in medications
    assert 'router.push("/onboarding-medications"' in lifestyle


def test_daily_medication_editor_uses_free_cached_reference_catalog_and_structured_dose():
    frontend = read("frontend/app/onboarding-medications.tsx")
    reference_client = read("frontend/src/medicationReferenceApi.ts")
    backend = read("backend/medication_api.py")
    reference_backend = read("backend/medication_reference.py")
    env_example = read("backend/.env.example")

    assert "COMMON_MEDICATIONS" not in frontend
    assert "searchMedicationReferences" in frontend
    assert 'testID="medication-name-dropdown"' in frontend
    assert 'testID="selected-medication-reference"' in frontend
    assert "active_ingredient" in frontend
    assert "reference_source: selectedReference?.reference_source" in frontend
    assert "reference_id: selectedReference?.reference_id" in frontend
    assert 'testID="onboarding-medication-dose"' in frontend
    assert 'const DAY_PARTS = ["morning", "day", "evening"]' in frontend
    assert '["before", ru ? "До еды"' in frontend
    assert '["after", ru ? "После еды"' in frontend
    assert 'dose_unit: doseUnit' in frontend
    assert 'day_parts: dayParts' in frontend
    assert 'meal_relation: mealRelation' in frontend

    assert "/reference/medications/search" in reference_client
    assert 'provider: "aida_catalog"' in reference_client
    assert "active_substance_id" in reference_client
    assert "dose_amount: Optional[float]" in backend
    assert "day_parts: List[str]" in backend
    assert "reference_source: Optional[str]" in backend
    assert "reference_id: Optional[str]" in backend
    assert 'reference_source == "aida_catalog"' in backend
    assert "reference_verification_status" in backend
    assert "active_substance_id" in backend
    assert "resolve_reference" in backend
    assert '_ALLOWED_DAY_PARTS = {"morning", "day", "evening"}' in backend
    assert '_ALLOWED_DOSE_UNITS = {"mg", "tablet"}' in backend

    assert "db.medication_catalog" in reference_backend
    assert "_cache_matches" in reference_backend
    assert "_lookup_rxnorm" in reference_backend
    assert "_lookup_pubchem" in reference_backend
    assert "_lookup_wikidata" in reference_backend
    assert "RLS_AURORA_USERNAME" not in env_example
    assert "RLS_AURORA_PASSWORD" not in env_example


def test_medication_day_parts_do_not_invent_clock_times():
    frontend = read("frontend/app/onboarding-medications.tsx")
    backend = read("backend/medication_api.py")
    assert "times: []" in frontend
    assert 'schedule: dayParts.join(",")' in frontend
    assert "def _effective_times" in backend
    assert 'times = list(med.get("times") or [])' in backend
    assert "if not times:" in backend
    assert "return []" in backend
