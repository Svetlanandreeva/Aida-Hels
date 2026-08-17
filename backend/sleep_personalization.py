"""Personalized, non-diagnostic sleep pattern insights for Aida.

The engine deliberately avoids population bedtime targets. It only emits a
personalized timing suggestion after enough longitudinal data exists and uses
association language rather than causal claims.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import mean
from typing import Any, Dict, List, Optional, Tuple


def _dt(date_value: str, time_value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(f"{str(date_value)[:10]}T{time_value}:00")
    except Exception:
        return None


def _score_checkin(doc: Dict[str, Any]) -> Optional[float]:
    vals: List[float] = []
    for key in ("energy", "mood", "sleep"):
        value = doc.get(key)
        if isinstance(value, (int, float)):
            vals.append(float(value))
    for key in ("stress", "anxiety"):
        value = doc.get(key)
        if isinstance(value, (int, float)):
            vals.append(6.0 - float(value))
    return mean(vals) if vals else None


def _clock_minutes(dt: datetime) -> int:
    # Treat post-midnight bedtimes as the continuation of the previous evening,
    # so early-morning clock values sort after late-evening values.
    minutes = dt.hour * 60 + dt.minute
    return minutes + (24 * 60 if dt.hour < 6 else 0)


def _fmt_clock(minutes: int) -> str:
    minutes %= 24 * 60
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _pair_nights(events: List[Dict[str, Any]]) -> List[Tuple[datetime, datetime]]:
    beds, wakes = [], []
    for event in events:
        stamp = _dt(str(event.get("local_date") or ""), str(event.get("local_time") or ""))
        if not stamp:
            continue
        if event.get("kind") == "bedtime":
            beds.append(stamp)
        elif event.get("kind") == "wake":
            wakes.append(stamp)
    beds.sort(); wakes.sort()
    pairs: List[Tuple[datetime, datetime]] = []
    for wake in wakes:
        candidates = [bed for bed in beds if timedelta(hours=2) <= wake - bed <= timedelta(hours=18)]
        if candidates:
            pairs.append((max(candidates), wake))
    return pairs


def build_sleep_insight(events: List[Dict[str, Any]], checkins: List[Dict[str, Any]], symptoms: List[Dict[str, Any]]) -> Dict[str, Any]:
    pairs = _pair_nights(events)
    dates = sorted({str(e.get("local_date") or "")[:10] for e in events if e.get("local_date")})
    span_days = 0
    if len(dates) >= 2:
        try:
            span_days = (datetime.fromisoformat(dates[-1]) - datetime.fromisoformat(dates[0])).days + 1
        except Exception:
            span_days = 0

    checkin_by_date: Dict[str, List[float]] = defaultdict(list)
    poor_sleep_dates = set()
    for doc in checkins:
        date = str(doc.get("date") or doc.get("created_at") or "")[:10]
        score = _score_checkin(doc)
        if date and score is not None:
            checkin_by_date[date].append(score)
        sleep = doc.get("sleep")
        if date and isinstance(sleep, (int, float)) and float(sleep) <= 2:
            poor_sleep_dates.add(date)

    linked = []
    for bed, wake in pairs:
        scores = checkin_by_date.get(wake.date().isoformat()) or []
        if scores:
            linked.append({"bed": bed, "wake": wake, "score": mean(scores), "duration_h": (wake - bed).total_seconds() / 3600})

    result: Dict[str, Any] = {
        "status": "learning",
        "days_observed": span_days,
        "paired_nights": len(pairs),
        "outcome_linked_nights": len(linked),
        "minimum_days": 28,
        "message_ru": "Аида пока изучает ваш личный режим сна. Для устойчивой рекомендации нужно около месяца данных.",
        "message_en": "Aida is still learning your personal sleep pattern. About a month of data is needed for a stable suggestion.",
        "suggested_window": None,
        "confidence": "low",
        "clinical_prompt": None,
    }

    insomnia_mentions = sum(1 for s in symptoms if "бессон" in str(s.get("name") or "").lower() or "insomnia" in str(s.get("name") or "").lower())
    persistent_poor_sleep = span_days >= 21 and len(poor_sleep_dates) >= 9
    if insomnia_mentions >= 3 or persistent_poor_sleep:
        result["clinical_prompt"] = {
            "level": "review",
            "message_ru": "За последние недели повторяются признаки проблем со сном. Аида не ставит диагноз бессонницы: если трудно заснуть, сон часто прерывается или это заметно мешает днём, стоит обсудить это с врачом или специалистом по сну.",
            "message_en": "Sleep difficulties have repeated over recent weeks. Aida does not diagnose insomnia; if falling asleep, staying asleep, or daytime functioning is regularly affected, consider discussing it with a clinician or sleep specialist.",
        }

    if span_days < 28 or len(linked) < 14:
        return result

    buckets: Dict[int, List[float]] = defaultdict(list)
    for item in linked:
        bucket = int(round(_clock_minutes(item["bed"]) / 60.0) * 60)
        buckets[bucket].append(item["score"])
    eligible = [(bucket, values) for bucket, values in buckets.items() if len(values) >= 4]
    if not eligible:
        result["message_ru"] = "Данных уже достаточно по времени, но пока мало повторов одинакового режима, чтобы советовать конкретное окно сна."
        result["message_en"] = "There is enough elapsed time, but not enough repeated nights in similar windows to suggest a specific bedtime yet."
        return result

    overall = mean([item["score"] for item in linked])
    best_bucket, best_values = max(eligible, key=lambda pair: mean(pair[1]))
    lift = mean(best_values) - overall
    if lift < 0.25:
        result["status"] = "stable_no_preference"
        result["confidence"] = "medium"
        result["message_ru"] = "За этот период Аида не видит убедительной связи между конкретным временем отхода ко сну и вашим самочувствием. Жёсткое время навязывать не будем."
        result["message_en"] = "Aida does not see a convincing association between a specific bedtime and your wellbeing in this period, so it will not impose a fixed target."
        return result

    center = best_bucket
    start, end = center - 30, center + 30
    result.update({
        "status": "personalized",
        "confidence": "medium" if len(best_values) < 7 else "high",
        "suggested_window": {"start": _fmt_clock(start), "end": _fmt_clock(end), "samples": len(best_values)},
        "message_ru": f"По вашим данным за последний период дни после сна с отходом примерно в {_fmt_clock(start)}–{_fmt_clock(end)} чаще сопровождались лучшей энергией и самочувствием. Это наблюдаемая связь, а не медицинская норма; можно мягко стараться не уходить заметно позже этого окна, если вам комфортно.",
        "message_en": f"In your recent data, days after bedtimes around {_fmt_clock(start)}–{_fmt_clock(end)} were more often associated with better energy and wellbeing. This is an observed association, not a medical norm; you may gently aim not to drift much later if it feels comfortable.",
    })
    return result
