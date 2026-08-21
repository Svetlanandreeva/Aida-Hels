from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_home_backend_bounds_each_aggregate_source():
    source = read("backend/home_api.py")
    assert "HOME_SECTION_TIMEOUT_SECONDS" in source
    assert "asyncio.wait_for" in source
    assert "return_exceptions=True" in source
    for call in (
        "legacy.readiness(profile_id)",
        "legacy.gamification(profile_id)",
        "medications()",
        "symptoms()",
        "labs()",
        "puzzle()",
        "overview()",
        "tasks()",
        "medication_day()",
        "cycle_summary()",
    ):
        assert f"_bounded({call})" in source


def test_home_client_has_hard_request_deadline():
    source = read("frontend/src/homeApi.ts")
    assert 'import { withTimeout } from "@/src/async"' in source
    assert "withTimeout(" in source
    assert '"home"' in source
    assert '"home_json"' in source
