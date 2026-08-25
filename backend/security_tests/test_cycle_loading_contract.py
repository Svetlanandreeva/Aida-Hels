from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_cycle_requests_are_bounded_and_independent():
    source = (ROOT / "frontend" / "app" / "cycle.tsx").read_text(encoding="utf-8")
    assert "CYCLE_TIMEOUT_MS = 3500" in source
    assert "Promise.allSettled" in source
    assert 'withTimeout(cycleApi.get(activeId),CYCLE_TIMEOUT_MS,"cycle_data")' in source
    assert 'withTimeout(cycleApi.forecast(activeId),CYCLE_TIMEOUT_MS,"cycle_forecast")' in source
    assert 'withTimeout(syncCycleWindowReminder' in source


def test_cycle_shell_stays_visible_while_loading_or_after_partial_error():
    source = (ROOT / "frontend" / "app" / "cycle.tsx").read_text(encoding="utf-8")
    assert 'testID="cycle-loading-state"' in source
    assert 'testID="cycle-error-state"' in source
    assert 'onPress={()=>void load()}' in source
    assert 'loading?<ActivityIndicator style={{marginTop:40}}' not in source
    assert 'loading?' in source
    loading_index = source.index('testID="cycle-loading-state"')
    today_card_index = source.index('ru?"Сегодня":"Today"')
    assert loading_index < today_card_index
