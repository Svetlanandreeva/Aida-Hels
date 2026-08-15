"""Unified health timeline aggregator for Aida 2.0.

The endpoint normalizes existing factual records into one reverse-chronological
stream. It never creates synthetic health events. New source modules can be
added to SOURCES when their production storage exists.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from fastapi import APIRouter, HTTPException, Query


ALLOWED_TYPES = {
    "lab",
    "symptom",
    "medication",
    "medication_intake",
    "vital",
    "checkin",
    "document",
    "task",
}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _time(value: Any, fallback: Any = None) -> str:
    raw = _text(value) or _text(fallback)
    if not raw:
        return "1970-01-01T00:00:00+00:00"
    # Date-only values sort correctly beside ISO datetimes after adding midnight.
    if len(raw) == 10 and raw[4:5] == "-" and raw[7:8] == "-":
        return f"{raw}T00:00:00+00:00"
    return raw


def _cursor_key(event: Dict[str, Any]) -> Tuple[str, str, str]:
    return (
        _text(event.get("occurred_at")),
        _text(event.get("type")),
        _text(event.get("id")),
    )


def _encode_cursor(key: Tuple[str, str, str]) -> str:
    raw = json.dumps(list(key), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_cursor(value: str) -> Tuple[str, str, str]:
    try:
        padded = value + "=" * (-len(value) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
        if not isinstance(decoded, list) or len(decoded) != 3:
            raise ValueError
        return tuple(str(part) for part in decoded)  # type: ignore[return-value]
    except Exception as exc:
        raise HTTPException(400, "Invalid timeline cursor") from exc


def _event(
    event_type: str,
    source: Dict[str, Any],
    *,
    occurred_at: Any,
    title: str,
    subtitle: Optional[str] = None,
    status: Optional[str] = None,
    route: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    event_id: Optional[str] = None,
) -> Dict[str, Any]:
    source_id = _text(source.get("id"))
    return {
        "id": event_id or f"{event_type}:{source_id}",
        "type": event_type,
        "source_id": source_id or None,
        "occurred_at": _time(occurred_at, source.get("created_at")),
        "title": title,
        "subtitle": subtitle,
        "status": status,
        "route": route,
        "details": details or {},
    }


def _lab_event(doc: Dict[str, Any]) -> Dict[str, Any]:
    biomarkers = doc.get("biomarkers") or []
    abnormal = sum(1 for b in biomarkers if isinstance(b, dict) and b.get("status") in ("high", "low"))
    return _event(
        "lab",
        doc,
        occurred_at=doc.get("date"),
        title=_text(doc.get("title")) or "Lab result",
        subtitle=_text(doc.get("lab_name")) or None,
        status="attention" if abnormal else ("normal" if biomarkers else "unknown"),
        route="/labs",
        details={
            "biomarker_count": len(biomarkers),
            "abnormal_count": abnormal,
            "verification_status": doc.get("verification_status") or "unverified",
        },
    )


def _symptom_event(doc: Dict[str, Any]) -> Dict[str, Any]:
    severity = doc.get("severity")
    return _event(
        "symptom",
        doc,
        occurred_at=doc.get("date"),
        title=_text(doc.get("name")) or "Symptom",
        subtitle=_text(doc.get("note")) or None,
        status="attention" if isinstance(severity, (int, float)) and severity >= 7 else "logged",
        route="/history",
        details={"severity": severity},
    )


def _medication_event(doc: Dict[str, Any]) -> Dict[str, Any]:
    times = doc.get("times") or []
    return _event(
        "medication",
        doc,
        occurred_at=doc.get("start_date") or doc.get("created_at"),
        title=_text(doc.get("name")) or "Medication",
        subtitle=" · ".join(filter(None, [_text(doc.get("dose")), _text(doc.get("schedule"))])) or None,
        status="active" if doc.get("active", True) else "inactive",
        route="/medications",
        details={"times": times, "meal_relation": doc.get("meal_relation") or "any"},
    )


def _intake_event(doc: Dict[str, Any]) -> Dict[str, Any]:
    return _event(
        "medication_intake",
        doc,
        occurred_at=doc.get("occurred_at") or doc.get("scheduled_at"),
        title=_text(doc.get("medication_name")) or "Medication intake",
        subtitle=_text(doc.get("scheduled_at")) or None,
        status=_text(doc.get("status")) or "unknown",
        route="/medications",
        details={"scheduled_at": doc.get("scheduled_at")},
    )


def _vital_event(doc: Dict[str, Any]) -> Dict[str, Any]:
    kind = _text(doc.get("kind")) or "measurement"
    if kind == "bp":
        value = f"{doc.get('systolic', '—')}/{doc.get('diastolic', '—')}"
        if doc.get("pulse") is not None:
            value += f" · pulse {doc.get('pulse')}"
        title = "Blood pressure"
        route = "/pressure"
    else:
        raw = doc.get("value")
        value = f"{raw if raw is not None else '—'} {_text(doc.get('unit'))}".strip()
        title = kind.replace("_", " ").title()
        route = "/measurements"
    return _event(
        "vital",
        doc,
        occurred_at=doc.get("date"),
        title=title,
        subtitle=value,
        status="logged",
        route=route,
        details={"kind": kind, "note": doc.get("note")},
    )


def _checkin_event(doc: Dict[str, Any]) -> Dict[str, Any]:
    return _event(
        "checkin",
        doc,
        occurred_at=doc.get("date"),
        title="Wellbeing check-in",
        subtitle=_text(doc.get("note")) or None,
        status="logged",
        route="/mind",
        details={
            key: doc.get(key)
            for key in ("mood", "energy", "stress", "anxiety", "sleep", "triggers")
            if doc.get(key) is not None
        },
    )


def _document_event(doc: Dict[str, Any]) -> Dict[str, Any]:
    return _event(
        "document",
        doc,
        occurred_at=doc.get("created_at"),
        title=_text(doc.get("name")) or "Medical document",
        subtitle=_text(doc.get("document_type")) or None,
        status=_text(doc.get("verification_status")) or _text(doc.get("status")) or "stored",
        route="/documents",
        details={"purpose": doc.get("purpose"), "drive_url": doc.get("drive_url")},
    )


def _task_event(doc: Dict[str, Any]) -> Dict[str, Any]:
    status = _text(doc.get("status")) or ("done" if doc.get("done") else "pending")
    occurred = doc.get("updated_at") if status == "done" else doc.get("due") or doc.get("created_at")
    return _event(
        "task",
        doc,
        occurred_at=occurred,
        title=_text(doc.get("title")) or "Task",
        subtitle=_text(doc.get("kind")) or None,
        status=status,
        route=_text(doc.get("action_route")) or "/(tabs)/tasks",
        details={"due": doc.get("due"), "reminder_at": doc.get("reminder_at")},
    )


async def _docs(collection, profile_id: str, length: int = 2000):
    return await collection.find({"profile_id": profile_id}, {"_id": 0}).to_list(length)


def build_timeline_router(db) -> APIRouter:
    router = APIRouter(prefix="/api/timeline", tags=["timeline"])

    @router.get("")
    async def timeline(
        profile_id: str,
        types: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = Query(30, ge=1, le=100),
    ):
        selected: Set[str] = set(ALLOWED_TYPES)
        if types:
            selected = {item.strip() for item in types.split(",") if item.strip()}
            invalid = selected - ALLOWED_TYPES
            if invalid:
                raise HTTPException(400, f"Unknown timeline types: {', '.join(sorted(invalid))}")

        events: List[Dict[str, Any]] = []

        # Fetch only requested source sheets. Sheets storage has no joins; doing
        # normalization here keeps the client contract stable and filterable.
        if "lab" in selected:
            events.extend(_lab_event(doc) for doc in await _docs(db.labs, profile_id, 1000))
        if "symptom" in selected:
            events.extend(_symptom_event(doc) for doc in await _docs(db.symptoms, profile_id, 2000))
        if "medication" in selected:
            events.extend(_medication_event(doc) for doc in await _docs(db.medications, profile_id, 1000))
        if "medication_intake" in selected:
            events.extend(_intake_event(doc) for doc in await _docs(db.medication_events, profile_id, 3000))
        if "vital" in selected:
            events.extend(_vital_event(doc) for doc in await _docs(db.vitals, profile_id, 3000))
        if "checkin" in selected:
            events.extend(_checkin_event(doc) for doc in await _docs(db.checkins, profile_id, 3000))
        if "document" in selected:
            docs = await _docs(db.files, profile_id, 2000)
            events.extend(_document_event(doc) for doc in docs if doc.get("purpose") in ("medical_document", "lab_source"))
        if "task" in selected:
            events.extend(_task_event(doc) for doc in await _docs(db.tasks, profile_id, 3000))

        events.sort(key=_cursor_key, reverse=True)

        if cursor:
            cursor_key = _decode_cursor(cursor)
            events = [event for event in events if _cursor_key(event) < cursor_key]

        page = events[:limit]
        has_more = len(events) > limit
        next_cursor = _encode_cursor(_cursor_key(page[-1])) if has_more and page else None

        counts: Dict[str, int] = {}
        for event in events:
            counts[event["type"]] = counts.get(event["type"], 0) + 1

        return {
            "profile_id": profile_id,
            "events": page,
            "next_cursor": next_cursor,
            "has_more": has_more,
            "types": sorted(selected),
            "remaining_counts": counts,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    return router
