from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HOME = ROOT / "frontend" / "app" / "(tabs)" / "index.tsx"
READINESS = ROOT / "frontend" / "src" / "components" / "ReadinessProgressCard.tsx"
BODY = ROOT / "frontend" / "app" / "body.tsx"
PRESSURE = ROOT / "frontend" / "app" / "pressure.tsx"
LABS = ROOT / "frontend" / "app" / "labs.tsx"


def test_readiness_details_do_not_silently_turn_source_errors_into_no_data():
    source = READINESS.read_text(encoding="utf-8")
    assert "detailsError" in source
    assert 'testID="readiness-details-error"' in source
    assert "Это техническая ошибка, а не отсутствие данных" in source
    assert 'if (vitalsResult.status === "fulfilled") setVitals(vitalsResult.value)' in source
    assert 'if (checkinsResult.status === "fulfilled") setCheckins(checkinsResult.value)' in source


def test_core_medical_screens_keep_error_separate_from_empty_state():
    body = BODY.read_text(encoding="utf-8")
    pressure = PRESSURE.read_text(encoding="utf-8")
    labs = LABS.read_text(encoding="utf-8")
    assert "systemsError" in body and "Не удалось обновить системы" in body
    assert "ageError" in body and "Оценка возраста сейчас недоступна" in body
    assert "setError(true)" in pressure and "Не удалось загрузить давление" in pressure
    assert "setLoadError(true)" in labs and "Не удалось загрузить анализы" in labs


def test_home_must_keep_section_errors_visible():
    source = HOME.read_text(encoding="utf-8")
    # This contract intentionally describes the canonical state model from
    # Notion §26. The Home implementation must preserve backend section states
    # instead of reducing every failed source to an empty list.
    assert "home.medications.state" in source
    assert "home.symptoms.state" in source
    assert "home.labs.state" in source
    assert "home.overview.state" in source
