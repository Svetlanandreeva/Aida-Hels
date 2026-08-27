from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HOME_SCREEN = ROOT / "frontend" / "src" / "emergent" / "screens" / "Home.tsx"
HOME_ADAPTER = ROOT / "frontend" / "src" / "emergent" / "health-context.tsx"
HOME_CLIENT = ROOT / "frontend" / "src" / "homeApi.ts"


def test_home_screen_uses_single_aggregated_home_api():
    source = HOME_ADAPTER.read_text(encoding="utf-8")
    assert 'import { getHome } from "@/src/homeApi"' in source
    assert "getHome(activeId, today, lang)" in source
    assert "Promise.allSettled" not in source
    assert "api.readiness(activeId)" not in source
    assert "api.gamification(activeId)" not in source
    assert "api.listMeds(activeId)" not in source
    assert "api.listSymptoms(activeId)" not in source
    assert "api.listLabs(activeId)" not in source
    assert "api.getPuzzle(activeId)" not in source
    assert "api.overview(activeId, lang)" not in source
    assert "api.listTasks(activeId)" not in source


def test_home_screen_preserves_explicit_source_availability_states():
    source = HOME_SCREEN.read_text(encoding="utf-8")
    adapter = HOME_ADAPTER.read_text(encoding="utf-8")
    assert "home.medications.items" in adapter
    assert "home.symptoms.items" in adapter
    assert "home.labs.items" in adapter
    assert "home.tasks.items" in adapter
    assert "home.medication_day.slots" in adapter
    assert "health.error" in source
    assert 'testID="home-load-error-inline"' in source
    assert "Сохранённые данные остаются на экране" in source
    assert "return <View style={[styles.statePage" not in source


def test_home_client_uses_authenticated_api_fetch_and_explicit_query_context():
    source = HOME_CLIENT.read_text(encoding="utf-8")
    assert 'apiFetch(`/home/${encodeURIComponent(profileId)}?' in source
    assert "date," in source
    assert "now_local: localTime()" in source
    assert "language," in source
