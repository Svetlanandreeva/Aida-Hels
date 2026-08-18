from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_production_chat_uses_canonical_context_builder_and_fresh_provider_session():
    source = ROOT.joinpath("secure_legacy_api.py").read_text()

    assert "from ai_context import build_ai_context" in source
    assert "context = await build_ai_context(db, req.profile_id)" in source
    assert "return await legacy_server.chat(req, language)" not in source
    assert 'session_id=f"aida-{req.profile_id}-{uuid.uuid4()}"' in source
    assert "if _history_allowed(profile):" in source
    assert "Медицинский контекст профиля недоступен" in source


def test_context_builder_fails_closed_for_privacy_and_explicitly_disabled_modules():
    source = ROOT.joinpath("ai_context.py").read_text()

    assert 'privacy.get("include_in_ai_context") is False' in source
    for module in ("meds", "symptoms", "labs", "pressure", "mental", "chronic", "women"):
        assert f'_module_enabled(modules, "{module}")' in source
    assert '"respect_module_settings": True' in source


def test_chat_history_is_not_reused_after_privacy_or_module_restriction():
    source = ROOT.joinpath("secure_legacy_api.py").read_text()

    assert 'privacy.get("include_in_ai_context") is False' in source
    assert "any(value is False for value in modules.values())" in source
    assert "return False" in source
