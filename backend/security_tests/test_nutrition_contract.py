from pathlib import Path

import nutrition_api
import nutrition_reference
from nutrition_api import _daily_totals, _food_medication_flags, _pattern_insights


ROOT = Path(__file__).resolve().parents[2]


def test_nutrition_is_explicit_opt_in_in_ai_context():
    source = (ROOT / "backend/ai_context.py").read_text(encoding="utf-8")
    assert 'modules.get("nutrition") is True' in source
    assert '"nutrition_module_is_explicit_opt_in": True' in source
    assert '"never_recommend_stopping_or_changing_medication_dose_from_nutrition_data": True' in source


def test_nutrition_context_respects_other_disabled_modules():
    source = (ROOT / "backend/nutrition_api.py").read_text(encoding="utf-8")
    assert 'modules.get("mental") is not False' in source
    assert 'modules.get("meds") is not False' in source


def test_frontend_sends_device_local_meal_clock_and_has_profile_setting():
    screen = (ROOT / "frontend/app/nutrition.tsx").read_text(encoding="utf-8")
    profile = (ROOT / "frontend/app/(tabs)/profile.tsx").read_text(encoding="utf-8")
    assert "now.getFullYear()" in screen
    assert "now.getHours()" in screen
    assert "timezone_offset_min: -now.getTimezoneOffset()" in screen
    assert 'testID="nutrition-setting-toggle"' in profile
    assert 'router.push("/nutrition"' in profile


def test_profile_delete_cascades_to_nutrition_entries():
    source = (ROOT / "backend/profile_api.py").read_text(encoding="utf-8")
    assert "db.nutrition_entries" in source


def test_detailed_food_history_compacts_after_20_hours():
    assert nutrition_api._COMPACTION_HOURS == 20
    assert nutrition_api._COMPACTION_HOURS < 24
    source = (ROOT / "backend/nutrition_api.py").read_text(encoding="utf-8")
    assert '"source": "aggregate"' in source
    assert '"label": None' in source
    assert '"nutrients": nutrients' in source
    assert 'await db.nutrition_entries.delete_many({"id": {"$in": remove_ids}})' in source
    assert "source_provenance" in source


def test_open_sources_are_persistent_sources_and_fatsecret_is_not_analysis_dependency():
    source = (ROOT / "backend/nutrition_reference.py").read_text(encoding="utf-8")
    env = (ROOT / "backend/.env.example").read_text(encoding="utf-8")
    assert '"license": "CC0-1.0"' in source
    assert '"license": "ODbL-1.0"' in source
    assert "USDA_FDC_API_KEY" in env
    assert "platform.fatsecret.com" not in source
    assert "standard API terms restrict" in source


def test_open_source_cross_check_compares_macros_without_copying_secondary_product():
    primary = {
        "name": "Oatmeal",
        "nutrients": {"calories": 100, "protein_g": 4, "carbs_g": 18, "fat_g": 2},
    }
    secondary = {
        "name": "Oatmeal oats",
        "nutrients": {"calories": 105, "protein_g": 4.2, "carbs_g": 18.5, "fat_g": 2.1},
    }
    result = nutrition_reference._comparison(primary, secondary)
    assert result["status"] == "matched"
    assert "nutrients" not in result
    assert "name" not in result


def test_unverified_medication_never_creates_food_interaction_flag():
    entries = [{"id": "e1", "label": "grapefruit", "local_date": "2026-08-23", "local_time": "09:30"}]
    unverified = [{
        "id": "m1",
        "name": "Some brand",
        "active_ingredient": "atorvastatin",
        "reference_verification_status": "unverified",
        "times": ["09:00"],
    }]
    assert _food_medication_flags(entries, unverified) == []

    verified = [{**unverified[0], "reference_verification_status": "verified"}]
    flags = _food_medication_flags(entries, verified)
    assert flags
    assert flags[0]["active_ingredient"] == "atorvastatin"
    assert flags[0]["evidence_url"].startswith("https://")


def test_compacted_meal_has_no_food_specific_interaction_flag():
    entries = [{
        "id": "e1",
        "label": None,
        "meal_type": "breakfast",
        "source": "aggregate",
        "compacted": True,
        "local_date": "2026-08-23",
        "local_time": "09:30",
        "nutrients": {"calories": 400, "protein_g": 20},
    }]
    meds = [{
        "id": "m1",
        "name": "Atorvastatin",
        "active_ingredient": "atorvastatin",
        "reference_verification_status": "verified",
        "times": ["09:00"],
    }]
    assert _food_medication_flags(entries, meds) == []


def test_levothyroxine_timing_uses_local_device_time():
    entries = [{
        "id": "e1",
        "label": "breakfast",
        "eaten_at": "2026-08-23T04:30:00Z",
        "local_date": "2026-08-23",
        "local_time": "09:30",
    }]
    meds = [{
        "id": "m1",
        "name": "Levothyroxine",
        "active_ingredient": "levothyroxine",
        "reference_verification_status": "verified",
        "times": ["09:00"],
    }]
    flags = _food_medication_flags(entries, meds)
    assert any(flag["kind"] == "timing" for flag in flags)


def test_daily_totals_group_by_device_local_date_for_detail_and_aggregate():
    entries = [
        {
            "id": "e1",
            "source": "manual",
            "eaten_at": "2026-08-22T20:30:00Z",
            "local_date": "2026-08-23",
            "local_time": "01:30",
            "quantity": 1,
            "stored_nutrients": {"calories": 350, "protein_g": 20},
        },
        {
            "id": "e2",
            "source": "aggregate",
            "compacted": True,
            "local_date": "2026-08-23",
            "local_time": "13:00",
            "detail_count": 2,
            "nutrients": {"calories": 600, "protein_g": 30},
        },
    ]
    daily = _daily_totals(entries)
    assert daily[0]["date"] == "2026-08-23"
    assert daily[0]["calories"] == 950
    assert daily[0]["protein_g"] == 50
    assert daily[0]["entries"] == 3


def test_energy_pattern_is_described_as_association_not_causation():
    daily = [
        {"date": "2026-08-20", "calories": 900, "entries_with_nutrients": 2, "fiber_g": 20, "saturated_fat_g": 5},
        {"date": "2026-08-21", "calories": 1000, "entries_with_nutrients": 2, "fiber_g": 20, "saturated_fat_g": 5},
        {"date": "2026-08-22", "calories": 1800, "entries_with_nutrients": 2, "fiber_g": 20, "saturated_fat_g": 5},
    ]
    checkins = [
        {"date": "2026-08-20", "energy": 2},
        {"date": "2026-08-21", "energy": 1},
        {"date": "2026-08-22", "energy": 5},
    ]
    insights = _pattern_insights([], daily, checkins)
    energy = next(item for item in insights if item["kind"] == "energy_association")
    assert "корреляц" in energy["text"].lower()
    assert "не доказывает причину" in energy["text"].lower()


def test_warfarin_guidance_prefers_consistency_not_blanket_avoidance():
    entries = [{"id": "e1", "label": "spinach salad", "local_date": "2026-08-23", "local_time": "13:00"}]
    meds = [{
        "id": "m1",
        "name": "Warfarin",
        "active_ingredient": "warfarin",
        "reference_verification_status": "verified",
        "times": ["20:00"],
    }]
    flags = _food_medication_flags(entries, meds)
    assert flags
    text = f"{flags[0]['message']} {flags[0]['action']}".lower()
    assert "стабиль" in text
    assert "резк" in text
