import asyncio
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi import HTTPException

import social_auth
from social_auth import SocialAuthService, _json_object

ROOT = Path(__file__).resolve().parents[2]


class _StateCollection:
    def __init__(self):
        self.rows = []

    async def insert_one(self, document):
        self.rows.append(dict(document))
        return object()


class _StartDb:
    def __init__(self):
        self.oauth_states = _StateCollection()


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


def test_vk_authorization_url_matches_current_vkid_contract(monkeypatch):
    monkeypatch.setenv("VK_CLIENT_ID", "54732218")
    monkeypatch.delenv("VK_CLIENT_SECRET", raising=False)
    monkeypatch.setenv("VK_REDIRECT_URI", "https://aidaassistent.ru/api/auth/oauth/vk/callback")
    monkeypatch.setenv("OAUTH_ALLOWED_RETURN_URIS", "https://aidaassistent.ru/auth")

    service = SocialAuthService(db=_StartDb(), auth_service=None)
    result = asyncio.run(service.start("vk", "https://aidaassistent.ru/auth"))
    parsed = urlparse(result["authorization_url"])
    params = parse_qs(parsed.query)

    assert parsed.scheme == "https"
    assert parsed.netloc == "id.vk.ru"
    assert parsed.path == "/authorize"
    assert params["client_id"] == ["54732218"]
    assert params["app_id"] == ["54732218"]
    assert params["code_challenge_method"] == ["s256"]
    assert params["sdk_type"] == ["vkid"]
    assert params["redirect_uri"] == ["https://aidaassistent.ru/api/auth/oauth/vk/callback"]
    assert params["scope"] == ["email"]
    assert params["state"][0]
    assert params["code_challenge"][0]


def test_vk_token_exchange_matches_current_vkid_contract(monkeypatch):
    monkeypatch.setenv("VK_CLIENT_ID", "54732218")
    monkeypatch.setenv("VK_CLIENT_SECRET", "legacy-secret-must-not-be-sent")
    monkeypatch.setenv("VK_REDIRECT_URI", "https://aidaassistent.ru/api/auth/oauth/vk/callback")
    calls = []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, **kwargs):
            calls.append((url, kwargs))
            if url.endswith("/oauth2/auth"):
                return httpx.Response(200, json={
                    "access_token": "vk-access-token",
                    "state": "callback-state",
                    "user_id": "42",
                    "email": "vk@example.test",
                })
            return httpx.Response(200, json={
                "user": {
                    "user_id": "42",
                    "email": "vk@example.test",
                    "first_name": "VK",
                    "last_name": "User",
                }
            })

    monkeypatch.setattr(social_auth.httpx, "AsyncClient", FakeClient)
    service = SocialAuthService(db=None, auth_service=None)
    result = asyncio.run(service._exchange_vk(
        "one-time-code",
        {"code_verifier": "pkce-verifier"},
        "device-123",
        "callback-state",
    ))

    token_url, token_kwargs = calls[0]
    assert token_url == "https://id.vk.ru/oauth2/auth"
    assert token_kwargs["data"] == {"code": "one-time-code"}
    assert token_kwargs["params"] == {
        "grant_type": "authorization_code",
        "redirect_uri": "https://aidaassistent.ru/api/auth/oauth/vk/callback",
        "client_id": "54732218",
        "code_verifier": "pkce-verifier",
        "state": "callback-state",
        "device_id": "device-123",
    }
    assert "client_secret" not in token_kwargs["params"]
    assert "client_secret" not in token_kwargs["data"]

    info_url, info_kwargs = calls[1]
    assert info_url == "https://id.vk.ru/oauth2/user_info"
    assert info_kwargs["params"] == {"client_id": "54732218"}
    assert info_kwargs["data"] == {"access_token": "vk-access-token"}
    assert result["provider_user_id"] == "42"
    assert result["email"] == "vk@example.test"


def test_callback_storage_and_partial_social_account_are_hardened():
    source = (ROOT / "backend" / "social_auth.py").read_text(encoding="utf-8")
    assert "Social OAuth account persistence failed" in source
    assert "Social OAuth completion persistence failed" in source
    assert 'if existing and str(existing.get("password_hash") or "")' in source
    assert "Recover a partially-created social account" in source
    assert 'request.query_params.get("payload")' in source
    assert '"oauth_error": _callback_error_code(exc)' in source


def test_web_social_callback_allows_bounded_sheet_backoff():
    source = (ROOT / "frontend" / "app" / "auth.tsx").read_text(encoding="utf-8")
    assert 'withTimeout(completeSocialLogin(ticket), 20000, "social_callback")' in source
    assert 'params.get("oauth_error")' in source
    assert 'params.get("oauth_provider")' in source


def test_production_startup_forces_all_oauth_storage_collections_ready():
    source = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    assert "async def _validate_social_auth_storage()" in source
    for name in ("oauth_states", "oauth_identities", "oauth_tickets"):
        assert f'"{name}"' in source
    assert "await collection.count_documents({})" in source
