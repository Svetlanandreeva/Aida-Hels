import os

from wearable_cloud_oauth import provider_configuration


def test_cloud_provider_configuration_is_not_ready_without_credentials(monkeypatch):
    for key in (
        "OURA_CLIENT_ID",
        "OURA_CLIENT_SECRET",
        "AIDA_TOKEN_ENCRYPTION_KEY",
    ):
        monkeypatch.delenv(key, raising=False)
    config = provider_configuration("oura")
    assert config["configured"] is False
    assert "client_id" in config["missing"]
    assert "client_secret" in config["missing"]
    assert "token_encryption_key" in config["missing"]


def test_cloud_provider_configuration_uses_explicit_credentials(monkeypatch):
    from cryptography.fernet import Fernet

    monkeypatch.setenv("OURA_CLIENT_ID", "client")
    monkeypatch.setenv("OURA_CLIENT_SECRET", "secret")
    monkeypatch.setenv("AIDA_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    config = provider_configuration("oura")
    assert config["configured"] is True
    assert config["missing"] == []
    assert config["redirect_uri"].endswith("/oauth/wearables/oura/callback")
