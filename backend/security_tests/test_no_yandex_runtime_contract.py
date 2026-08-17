from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
AUTH_CLIENT = ROOT / "frontend" / "src" / "auth.tsx"
AUTH_SCREEN = ROOT / "frontend" / "app" / "auth.tsx"
SOCIAL_AUTH = ROOT / "backend" / "social_auth.py"
ENV_EXAMPLE = ROOT / "backend" / ".env.example"
YANDEX_DEPLOY = ROOT / ".github" / "workflows" / "deploy-yandex.yml"


def test_yandex_cloud_and_id_are_not_runtime_paths_anymore():
    assert not YANDEX_DEPLOY.exists()
    for path in (AUTH_CLIENT, AUTH_SCREEN, SOCIAL_AUTH, ENV_EXAMPLE):
        text = path.read_text(encoding="utf-8").lower()
        assert "yandex" not in text
        assert "яндекс" not in text


def test_vk_remains_the_only_social_auth_provider():
    client = AUTH_CLIENT.read_text(encoding="utf-8")
    screen = AUTH_SCREEN.read_text(encoding="utf-8")
    backend = SOCIAL_AUTH.read_text(encoding="utf-8")

    assert 'export type SocialProvider = "vk";' in client
    assert 'provider="vk"' in screen
    assert 'testID={`auth-social-${provider}`}' in screen
    assert 'providers = ("vk",)' in backend
    assert 'https://id.vk.ru/authorize?' in backend
