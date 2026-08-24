from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LAYOUT = ROOT / "frontend" / "app" / "_layout.tsx"


def test_authenticated_log_runtime_imports_are_parallelized():
    source = LAYOUT.read_text(encoding="utf-8")
    block_start = source.index("const DeferredLogProvider = lazy")
    block_end = source.index("const DeferredAuthenticatedSyncRuntime", block_start)
    block = source[block_start:block_end]

    assert "Promise.all" in block
    assert 'import("@/src/lab-runtime-compat")' in block
    assert 'import("@/src/components/LogProvider")' in block
    assert 'await import("@/src/lab-runtime-compat")' not in block
    assert "return { default: module.LogProvider };" in block


def test_public_routes_still_bypass_authenticated_runtime():
    source = LAYOUT.read_text(encoding="utf-8")
    public_return = source.index("if (publicRoute && !hasAppAccess) return stack;")
    provider_render = source.index("<DeferredLogProvider>{stack}</DeferredLogProvider>")
    assert public_return < provider_render
