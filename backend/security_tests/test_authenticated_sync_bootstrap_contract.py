from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LAYOUT = ROOT / "frontend" / "app" / "_layout.tsx"
RUNTIME = ROOT / "frontend" / "src" / "components" / "AuthenticatedSyncRuntime.tsx"


def test_public_bootstrap_does_not_statically_import_authenticated_sync_hooks():
    layout = LAYOUT.read_text(encoding="utf-8")

    assert 'from "@/src/hooks/use-medication-reminder-sync"' not in layout
    assert 'from "@/src/hooks/use-sleep-recommendation-sync"' not in layout
    assert 'import("@/src/components/AuthenticatedSyncRuntime")' in layout
    assert '<Suspense fallback={null}>' in layout
    assert '<DeferredAuthenticatedSyncRuntime />' in layout


def test_deferred_runtime_preserves_authenticated_sync_behavior():
    runtime = RUNTIME.read_text(encoding="utf-8")

    assert 'from "@/src/hooks/use-medication-reminder-sync"' in runtime
    assert 'from "@/src/hooks/use-sleep-recommendation-sync"' in runtime
    assert "useMedicationReminderSync();" in runtime
    assert "useSleepRecommendationSync();" in runtime
    assert "return null;" in runtime
