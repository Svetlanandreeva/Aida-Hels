"""Deterministic processing for confirmed canonical laboratory results.

This module does not diagnose. It derives only facts supported by the stored
result: reference-range position and simple within-analyte direction over time.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional


def _parse_time(value: Any) -> datetime:
    text = str(value or "").strip()
    if not text:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = datetime.fromisoformat(text[:10]).replace(tzinfo=timezone.utc)
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def derived_reference_flag(row: Dict[str, Any]) -> str:
    """Return low/high/normal only when numeric value and explicit bounds exist."""
    value = row.get("value_normalized")
    low = row.get("reference_low")
    high = row.get("reference_high")
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return str(row.get("abnormal_flag") or "unknown")
    if isinstance(low, (int, float)) and value < low:
        return "low"
    if isinstance(high, (int, float)) and value > high:
        return "high"
    if isinstance(low, (int, float)) or isinstance(high, (int, float)):
        return "normal"
    return str(row.get("abnormal_flag") or "unknown")


def result_quality(row: Dict[str, Any]) -> str:
    confidence = row.get("ocr_confidence")
    if row.get("verification_status") == "user_confirmed":
        if isinstance(confidence, (int, float)) and confidence < 0.6:
            return "confirmed_low_ocr_confidence"
        return "confirmed"
    if isinstance(confidence, (int, float)) and confidence < 0.6:
        return "low_ocr_confidence"
    return "unverified"


def compact_result(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "result_id": row.get("result_id") or row.get("id"),
        "report_id": row.get("report_id"),
        "analyte_code": row.get("analyte_code"),
        "analyte_original": row.get("analyte_original"),
        "value_original": row.get("value_original"),
        "unit_original": row.get("unit_original"),
        "value_normalized": row.get("value_normalized"),
        "unit_normalized": row.get("unit_normalized"),
        "reference_low": row.get("reference_low"),
        "reference_high": row.get("reference_high"),
        "reference_text": row.get("reference_text"),
        "abnormal_flag": derived_reference_flag(row),
        "verification_status": row.get("verification_status") or "unverified",
        "quality": result_quality(row),
        "ocr_confidence": row.get("ocr_confidence"),
        "observed_at": row.get("observed_at"),
        "source_type": row.get("source_type"),
        "source_file_id": row.get("source_file_id"),
    }


def build_lab_trends(rows: Iterable[Dict[str, Any]], *, max_points: int = 8) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in rows:
        code = str(row.get("analyte_code") or "").strip()
        if code and isinstance(row.get("value_normalized"), (int, float)):
            grouped[code].append(row)

    trends: List[Dict[str, Any]] = []
    for code, items in grouped.items():
        items.sort(key=lambda row: _parse_time(row.get("observed_at")))
        usable = items[-max_points:]
        if not usable:
            continue
        latest = usable[-1]
        previous = usable[-2] if len(usable) > 1 else None
        direction = "insufficient_history"
        delta: Optional[float] = None
        if previous is not None:
            latest_value = float(latest["value_normalized"])
            previous_value = float(previous["value_normalized"])
            delta = latest_value - previous_value
            scale = max(abs(previous_value), abs(latest_value), 1.0)
            tolerance = scale * 0.01
            direction = "stable" if abs(delta) <= tolerance else ("up" if delta > 0 else "down")
        trends.append({
            "analyte_code": code,
            "analyte_original": latest.get("analyte_original"),
            "unit_normalized": latest.get("unit_normalized"),
            "direction": direction,
            "delta_from_previous": delta,
            "latest_flag": derived_reference_flag(latest),
            "point_count": len(usable),
            "points": [
                {
                    "result_id": row.get("result_id") or row.get("id"),
                    "observed_at": row.get("observed_at"),
                    "value": row.get("value_normalized"),
                    "flag": derived_reference_flag(row),
                }
                for row in usable
            ],
        })
    trends.sort(key=lambda item: (item["latest_flag"] == "normal", item["analyte_code"]))
    return trends
