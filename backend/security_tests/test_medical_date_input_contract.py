from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_last_period_input_is_masked_and_numeric_only():
    onboarding = read("frontend/app/onboarding-medical.tsx")

    assert "const formatDateInput" in onboarding
    assert 'source.replace(/\\D/g, "").slice(0, 8)' in onboarding
    assert 'placeholder={ru ? "ДД.ММ.ГГГГ" : "DD.MM.YYYY"}' in onboarding
    assert 'keyboardType="number-pad"' in onboarding
    assert 'inputMode="numeric"' in onboarding
    assert "maxLength={10}" in onboarding
    assert 'testID="last-period-date"' in onboarding


def test_last_period_date_is_validated_and_saved_as_iso():
    onboarding = read("frontend/app/onboarding-medical.tsx")

    assert "const parseDisplayDateToIso" in onboarding
    assert "Date.UTC(year, month, 0)" in onboarding
    assert "normalizedLastPeriod > todayIso()" in onboarding
    assert "Дата начала последней менструации не может быть в будущем" in onboarding
    assert "last_period_start: normalizedLastPeriod" in onboarding
    assert "isoToDisplayDate(currentWomen.last_period_start)" in onboarding
