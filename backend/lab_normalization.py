"""Conservative canonicalization helpers for confirmed laboratory results.

The helpers preserve the source text and only derive numeric/reference fields
when the source text is explicit. They intentionally do not invent reference
ranges or perform medical unit conversion without an explicit mapping.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

_NUMERIC_RE = re.compile(r"^\s*([-+]?\d+(?:[\.,]\d+)?)\s*$")
_RANGE_RE = re.compile(r"^\s*([-+]?\d+(?:[\.,]\d+)?)\s*[-–—]\s*([-+]?\d+(?:[\.,]\d+)?)\s*$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_analyte_code(name: str) -> str:
    text = unicodedata.normalize("NFKC", str(name or "")).strip().lower()
    text = re.sub(r"[^0-9a-zа-яё]+", "_", text, flags=re.IGNORECASE)
    return text.strip("_") or "unknown"


def normalize_unit(unit: Optional[str]) -> Optional[str]:
    if not unit:
        return None
    text = unicodedata.normalize("NFKC", str(unit)).replace("μ", "µ").strip()
    text = re.sub(r"\s+", " ", text)
    return text or None


def exact_numeric(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    match = _NUMERIC_RE.match(str(value or ""))
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", "."))
    except ValueError:
        return None


def parse_reference(reference: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    if not reference:
        return None, None
    match = _RANGE_RE.match(str(reference).replace("\u00a0", " "))
    if not match:
        return None, None
    try:
        low = float(match.group(1).replace(",", "."))
        high = float(match.group(2).replace(",", "."))
    except ValueError:
        return None, None
    return (low, high) if low <= high else (high, low)


def abnormal_flag(status: Any) -> str:
    value = str(status or "unknown").strip().lower()
    if value in {"normal", "high", "low", "critical"}:
        return value
    return "unknown"


def canonical_lab_result(
    *,
    report_id: str,
    profile_id: str,
    biomarker: Dict[str, Any],
    observed_at: str,
    source_file_id: Optional[str],
    confirmed_by_account_id: str,
    source_hash: Optional[str] = None,
) -> Dict[str, Any]:
    name = str(biomarker.get("name") or "").strip()
    raw_value = str(biomarker.get("value") or "").strip()
    raw_unit = str(biomarker.get("unit") or "").strip() or None
    reference = str(biomarker.get("reference") or "").strip() or None
    reference_low, reference_high = parse_reference(reference)
    numeric = exact_numeric(raw_value)
    normalized_unit = normalize_unit(raw_unit)
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "result_id": None,  # populated below for compatibility with the formal data model
        "report_id": report_id,
        "profile_id": profile_id,
        "subject_profile_id": profile_id,
        "analyte_original": name,
        "analyte_code": normalize_analyte_code(name),
        "value_original": raw_value,
        "unit_original": raw_unit,
        "value_normalized": numeric,
        "unit_normalized": normalized_unit,
        "reference_low": reference_low,
        "reference_high": reference_high,
        "reference_text": reference,
        "abnormal_flag": abnormal_flag(biomarker.get("status")),
        "ocr_confidence": biomarker.get("ocr_confidence"),
        "verification_status": "user_confirmed",
        "observed_at": observed_at,
        "source_type": "upload",
        "source_file_id": source_file_id,
        "source_hash": source_hash,
        "confirmed_by_account_id": confirmed_by_account_id,
        "created_at": now,
        "updated_at": now,
    }


def finalize_result_id(result: Dict[str, Any]) -> Dict[str, Any]:
    result["result_id"] = result["id"]
    return result
