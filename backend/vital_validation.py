"""Sanity validation for user-entered health measurements.

These are intentionally broad data-quality bounds, not clinical reference ranges.
They prevent malformed/impossible values from entering the medical history while
leaving clinical interpretation to the rest of the product.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException


RANGES: Dict[str, Tuple[float, float]] = {
    "systolic": (30.0, 350.0),
    "diastolic": (20.0, 250.0),
    "pulse": (20.0, 300.0),
    "weight": (0.1, 500.0),
    "temperature": (25.0, 45.0),
    "spo2": (1.0, 100.0),
    "waist": (10.0, 300.0),
}


def _finite_number(value: Any, field: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(422, f"Invalid {field}")
    if not math.isfinite(number):
        raise HTTPException(422, f"Invalid {field}")
    return number


def _bounded(value: Any, field: str) -> float:
    number = _finite_number(value, field)
    low, high = RANGES[field]
    if number < low or number > high:
        raise HTTPException(422, f"{field} is outside supported input range")
    return number


def validate_vital_payload(data: Any) -> None:
    """Validate a VitalCreate-like object before persistence."""

    kind = str(getattr(data, "kind", "") or "")
    if kind == "bp":
        systolic = _bounded(getattr(data, "systolic", None), "systolic")
        diastolic = _bounded(getattr(data, "diastolic", None), "diastolic")
        if systolic <= diastolic:
            raise HTTPException(422, "Systolic pressure must be greater than diastolic pressure")
        pulse: Optional[Any] = getattr(data, "pulse", None)
        if pulse is not None:
            _bounded(pulse, "pulse")
        return

    if kind not in {"weight", "temperature", "pulse", "spo2", "waist"}:
        raise HTTPException(422, "Unsupported vital kind")

    value = getattr(data, "value", None)
    _bounded(value, kind)
