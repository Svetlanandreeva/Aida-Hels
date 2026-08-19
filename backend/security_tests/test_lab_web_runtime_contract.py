from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_web_lab_upload_uses_browser_blob_instead_of_rn_formdata_file_object():
    source = read("frontend/src/lab-runtime-compat.ts")
    assert 'Platform.OS !== "web"' in source
    assert 'const blob = await response.blob()' in source
    assert 'form.append("file", blob, file.name' in source
    assert 'apiFetch("/labs/upload"' in source


def test_lab_list_upload_and_save_requests_are_bounded():
    source = read("frontend/src/lab-runtime-compat.ts")
    assert "LAB_LIST_TIMEOUT_MS = 7000" in source
    assert "LAB_UPLOAD_TIMEOUT_MS = 60000" in source
    assert "LAB_SAVE_TIMEOUT_MS = 15000" in source
    assert '"labs_list"' in source
    assert '"lab_upload"' in source
    assert '"lab_review_save"' in source
    assert '"lab_commit"' in source


def test_lab_runtime_fix_is_deferred_until_authenticated_app_access():
    layout = read("frontend/app/_layout.tsx")
    assert 'import "@/src/lab-runtime-compat";' not in layout
    assert 'await import("@/src/lab-runtime-compat")' in layout
    assert 'const DeferredLogProvider = lazy(async () =>' in layout
    assert '<Suspense fallback={<StartupPreview />}>' in layout
    assert '<DeferredLogProvider>{stack}</DeferredLogProvider>' in layout
