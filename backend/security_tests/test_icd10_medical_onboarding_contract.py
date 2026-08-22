import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_pinned_icd10_catalog_is_present_and_large_enough():
    catalog = json.loads(read("backend/data/icd10_ru.json"))
    assert len(catalog) >= 10000
    assert any(item.get("code") == "I10" for item in catalog)
    assert any(str(item.get("code") or "").startswith("F") for item in catalog)
    assert all(item.get("code") and item.get("name") for item in catalog[:100])


def test_production_exposes_authenticated_local_icd10_search():
    main_source = read("backend/main.py")
    search_source = read("backend/icd10_api.py")
    assert "from icd10_api import build_icd10_router" in main_source
    assert "app.include_router(build_icd10_router())" in main_source
    assert 'prefix="/api/reference/icd10"' in search_source
    assert '@router.get("/search")' in search_source
    assert 'group == "mental" and not code_norm.startswith("F")' in search_source
    assert "DATA_PATH" in search_source and "icd10_ru.json" in search_source


def test_profile_contract_keeps_chronic_and_mental_conditions_separate():
    backend_profile = read("backend/profile_api.py")
    frontend_api = read("frontend/src/api.ts")
    ai_context = read("backend/ai_context.py")
    assert "mental_conditions: List[str]" in backend_profile
    assert 'out.setdefault("mental_conditions", [])' in backend_profile
    assert "mental_conditions?: string[]" in frontend_api
    assert '"mental_conditions": (profile.get("mental_conditions") or [])' in ai_context


def test_medical_onboarding_uses_conditional_icd10_pickers():
    onboarding = read("frontend/app/onboarding-medical.tsx")
    picker = read("frontend/src/components/DiagnosisPicker.tsx")
    lifestyle = read("frontend/app/onboarding-lifestyle.tsx")
    card = read("frontend/app/medical-card.tsx")

    assert 'testID="chronic-diagnosis-picker"' in onboarding
    assert 'testID="mental-diagnosis-picker"' in onboarding
    assert "mentalOnly" in onboarding
    assert "chronic_conditions: hasChronic ? chronicConditions : []" in onboarding
    assert "mental_conditions: hasMental ? mentalConditions : []" in onboarding
    assert 'Field label={ru ? "Хронические заболевания"' not in onboarding
    assert 'Field label={ru ? "Диагнозы"' not in onboarding
    assert "searchIcd10" in picker
    assert "Название или код МКБ-10" in picker
    assert "mentalDiagnoses" not in lifestyle
    assert 'title={lang === "ru" ? "Психические расстройства"' in card
