from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from vital_validation import validate_vital_payload


def vital(**kwargs):
    defaults = {
        "kind": "weight",
        "systolic": None,
        "diastolic": None,
        "pulse": None,
        "value": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_accepts_valid_blood_pressure_and_measurements():
    validate_vital_payload(vital(kind="bp", systolic=120, diastolic=80, pulse=70))
    validate_vital_payload(vital(kind="weight", value=61.5))
    validate_vital_payload(vital(kind="temperature", value=36.6))
    validate_vital_payload(vital(kind="spo2", value=98))
    validate_vital_payload(vital(kind="waist", value=82))


@pytest.mark.parametrize(
    "payload",
    [
        vital(kind="bp", systolic=80, diastolic=120),
        vital(kind="bp", systolic=float("nan"), diastolic=80),
        vital(kind="bp", systolic=500, diastolic=80),
        vital(kind="pulse", value=-1),
        vital(kind="spo2", value=101),
        vital(kind="temperature", value=80),
        vital(kind="weight", value=0),
        vital(kind="waist", value=float("inf")),
        vital(kind="unknown", value=10),
    ],
)
def test_rejects_malformed_or_impossible_values(payload):
    with pytest.raises(HTTPException) as exc:
        validate_vital_payload(payload)
    assert exc.value.status_code == 422


def test_production_vitals_route_calls_validator_before_persistence():
    source = open("secure_legacy_api.py", encoding="utf-8").read()
    marker = "async def create_vital(data: legacy_server.VitalCreate"
    start = source.index(marker)
    body = source[start : start + 500]
    assert "validate_vital_payload(data)" in body
    assert body.index("validate_vital_payload(data)") < body.index("legacy_server.create_vital(data)")


def test_frontend_surfaces_validation_errors_before_api_save():
    pressure = open("../frontend/app/pressure.tsx", encoding="utf-8").read()
    measurements = open("../frontend/app/measurements.tsx", encoding="utf-8").read()
    assert "validateBloodPressureInput" in pressure
    assert "pressure-validation-error" in pressure
    assert "validateMeasurementInput" in measurements
    assert "measure-validation-error" in measurements
