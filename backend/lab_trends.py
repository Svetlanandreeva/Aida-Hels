"""Lab biomarker trend aggregation for Aida 2.0.

Only exact numeric values already stored from real lab reports are plotted.
Reference strings and statuses are preserved verbatim; this module does not
invent or normalize medical reference ranges.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter


_NUM_RE = re.compile(r"[-+]?\d+(?:[\.,]\d+)?")


def _name_key(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _unit_key(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _numeric(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if not isinstance(value, str):
        return None

    text = value.strip().replace("\u00a0", " ")
    # A bounded result is not an exact measurement. Plotting <0.1 as 0.1 or
    # >200 as 200 would manufacture precision that is not present in the lab.
    if text.startswith(("<", ">", "≤", "≥", "~", "≈")):
        return None

    match = _NUM_RE.search(text)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def build_lab_trends_router(db) -> APIRouter:
    router = APIRouter(prefix="/api/labs", tags=["lab-trends"])

    @router.get("/trends")
    async def lab_trends(profile_id: str):
        labs = await db.labs.find({"profile_id": profile_id}, {"_id": 0}).sort("date", 1).to_list(500)
        grouped: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
        display_names: Dict[str, str] = {}
        display_units: Dict[Tuple[str, str], Optional[str]] = {}

        for lab in labs:
            lab_date = str(lab.get("date") or "")
            for biomarker in lab.get("biomarkers") or []:
                name = str(biomarker.get("name") or "").strip()
                if not name:
                    continue

                numeric_value = _numeric(biomarker.get("value"))
                if numeric_value is None:
                    continue

                name_key = _name_key(name)
                unit = biomarker.get("unit")
                unit_key = _unit_key(unit)
                group_key = (name_key, unit_key)
                display_names.setdefault(name_key, name)
                display_units.setdefault(group_key, str(unit).strip() if unit else None)

                grouped[group_key].append({
                    "lab_id": lab.get("id"),
                    "lab_title": lab.get("title"),
                    "date": lab_date,
                    "value": numeric_value,
                    "raw_value": biomarker.get("value"),
                    "unit": str(unit).strip() if unit else None,
                    "reference": biomarker.get("reference"),
                    "status": biomarker.get("status") or "unknown",
                    "verification_status": lab.get("verification_status") or "unverified",
                })

        series = []
        for (name_key, unit_key), points in grouped.items():
            points.sort(key=lambda p: (p.get("date") or "", p.get("lab_id") or ""))
            if len(points) < 2:
                continue

            latest = points[-1]
            previous = points[-2]
            delta = latest["value"] - previous["value"]
            percent_change = None
            if previous["value"] != 0:
                percent_change = round(delta / abs(previous["value"]) * 100, 1)

            series.append({
                "key": f"{name_key}::{unit_key}",
                "name": display_names[name_key],
                "unit": display_units[(name_key, unit_key)],
                "points": points,
                "count": len(points),
                "latest": latest,
                "delta": round(delta, 4),
                "percent_change": percent_change,
            })

        series.sort(key=lambda item: ((item["name"] or "").lower(), item.get("unit") or ""))
        return {
            "profile_id": profile_id,
            "series": series,
            "series_count": len(series),
            "lab_count": len(labs),
        }

    return router
