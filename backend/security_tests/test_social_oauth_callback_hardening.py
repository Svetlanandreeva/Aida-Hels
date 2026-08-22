import asyncio
from pathlib import Path

import httpx
import pytest
from fastapi import HTTPException

import social_auth
from social_auth import SocialAuthService, _json_object

ROOT = Path(__file__).resolve().parents[2]


def test_invalid_provider_json_is_translated_to_gateway_error():
    response = httpx.Response(200, content=b"not-json")
    with pytest.raises(HTTPException) as caught:
        _json_object(response, "invalid upstream response")
    assert caught.value.status_code == 502
    assert caught.value.detail == "invalid upstream response"


def test_yandex_network_failure_is_not_an_unhandled_500(monkeypatch):
    monkeypatch.setenv("YANDEX_CLIENT_ID", "test-client")
    monkeypatch.setenv("YANDEX_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv("YANDEX_REDIRECT_URI", "https://example.test/callback")

    class BrokenClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, **kwargs):
            request = httpx.Request("POST", url)
            raise httpx.ConnectError("network unavailable", request=request)

    monkeypatch.setattr(social_auth.httpx, "AsyncClient", BrokenClient)
    service = SocialAuthService(db=None, auth_service=None)

    with pytest.raises(HTTPException) as caught:
        asyncio.run(service._exchange_yandex("one-time-code", {"code_verifier": "verifier"}))

    assert caught.value.status_code == 502
    assert caught.value.detail == "Yandex ID is temporarily unavailable"


def test_callback_storage_and_partial_social_account_are_hardened():
    source = (ROOT / "backend" / "social_auth.py").read_text(encoding="utf-8")
    assert "Social OAuth account persistence failed" in source
    assert "Social OAuth completion persistence failed" in source
    assert 'if existing and str(existing.get("password_hash") or "")' in source
    assert "Recover a partially-created social account" in source


def test_production_startup_forces_all_oauth_storage_collections_ready():
    source = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    assert "async def _validate_social_auth_storage()" in source
    for name in ("oauth_states", "oauth_identities", "oauth_tickets"):
        assert f'"{name}"' in source
    assert "await collection.count_documents({})" in source
