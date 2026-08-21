from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
AUTH_CLIENT = ROOT / "frontend" / "src" / "auth.tsx"
AUTH_SCREEN = ROOT / "frontend" / "app" / "auth.tsx"
SOCIAL_AUTH = ROOT / "backend" / "social_auth.py"
ENV_EXAMPLE = ROOT / "backend" / ".env.example"
YANDEX_DEPLOY = ROOT / ".github" / "workflows" / "deploy-yandex.yml"
PRODUCTION_DEPLOY = ROOT / ".github" / "workflows" / "deploy-ruvds.yml"


def test_yandex_cloud_deploy_stays_removed():
    assert not YANDEX_DEPLOY.exists()


def test_yandex_id_and_vk_are_supported_social_auth_providers():
    client = AUTH_CLIENT.read_text(encoding="utf-8")
    screen = AUTH_SCREEN.read_text(encoding="utf-8")
    backend = SOCIAL_AUTH.read_text(encoding="utf-8")
    env_example = ENV_EXAMPLE.read_text(encoding="utf-8")

    assert 'export type SocialProvider = "yandex" | "vk";' in client
    assert 'socialLogin("yandex")' in screen
    assert 'socialLogin("vk")' in screen
    assert 'providers = ("yandex", "vk")' in backend
    assert 'https://oauth.yandex.ru/authorize?' in backend
    assert 'https://oauth.yandex.ru/token' in backend
    assert 'https://login.yandex.ru/info' in backend
    assert 'https://id.vk.ru/authorize?' in backend
    assert 'YANDEX_CLIENT_ID=' in env_example
    assert 'YANDEX_CLIENT_SECRET=' in env_example
    assert 'YANDEX_REDIRECT_URI=https://aidaassistent.ru/api/auth/oauth/yandex/callback' in env_example


def test_production_deploy_persists_and_smoke_tests_social_auth_configuration():
    deploy = PRODUCTION_DEPLOY.read_text(encoding="utf-8")

    assert 'YANDEX_CLIENT_ID: ${{ secrets.YANDEX_CLIENT_ID }}' in deploy
    assert 'YANDEX_CLIENT_SECRET: ${{ secrets.YANDEX_CLIENT_SECRET }}' in deploy
    assert 'VK_CLIENT_ID: ${{ secrets.VK_CLIENT_ID }}' in deploy
    assert 'VK_CLIENT_SECRET: ${{ secrets.VK_CLIENT_SECRET }}' in deploy
    assert 'YANDEX_REDIRECT_URI' in deploy
    assert 'VK_REDIRECT_URI' in deploy
    assert 'OAUTH_ALLOWED_RETURN_URIS' in deploy
    assert '/api/auth/oauth/providers' in deploy
    assert 'data.get("yandex", {}).get("configured") is True' in deploy
    assert 'data.get("vk", {}).get("configured") is True' in deploy
