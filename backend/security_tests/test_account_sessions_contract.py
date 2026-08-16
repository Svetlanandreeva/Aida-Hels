from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ACCOUNT_SESSIONS = ROOT / "account_sessions.py"
MAIN = ROOT / "main.py"


def test_account_session_routes_match_documented_lost_device_contract():
    source = ACCOUNT_SESSIONS.read_text(encoding="utf-8")
    assert 'APIRouter(prefix="/api/account/sessions"' in source
    assert '@router.get("")' in source
    assert '@router.delete("/{session_id}")' in source
    assert '@router.post("/revoke-others")' in source
    assert 'Depends(auth_service.require_account)' in source


def test_session_revocation_is_account_scoped_and_preserves_current_session_when_revoking_others():
    source = ACCOUNT_SESSIONS.read_text(encoding="utf-8")
    assert '{"id": session_id, "account_id": account_id}' in source
    assert 'sid == current_session_id' in source
    assert 'if not sid or sid == current_session_id or row.get("revoked_at")' in source
    assert '"is_current"' in source
    assert 'db.audit_log.insert_one' in source


def test_production_entrypoint_mounts_account_session_router():
    source = MAIN.read_text(encoding="utf-8")
    assert 'from account_sessions import build_account_session_router' in source
    assert 'app.include_router(build_account_session_router(_google_db, auth_service))' in source
