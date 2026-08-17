from pathlib import Path


def test_web_auth_preview_requires_explicit_build_flag():
    source = Path(__file__).parents[2] / "frontend" / "src" / "auth.tsx"
    text = source.read_text(encoding="utf-8")

    assert 'EXPO_PUBLIC_AIDA_WEB_PREVIEW' in text
    assert 'Platform.OS === "web"' not in text
    assert 'const WEB_PREVIEW_DEFAULT = process.env.EXPO_PUBLIC_AIDA_WEB_PREVIEW === "true";' in text


def test_real_web_auth_endpoints_remain_wired():
    source = Path(__file__).parents[2] / "frontend" / "src" / "auth.tsx"
    text = source.read_text(encoding="utf-8")

    for endpoint in (
        '/auth/register',
        '/auth/login',
        '/auth/me',
        '/auth/logout',
        '/auth/forgot-password',
        '/auth/reset-password',
    ):
        assert endpoint in text
