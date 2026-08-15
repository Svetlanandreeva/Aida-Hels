import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL (public URL for testing)
load_dotenv(Path(__file__).parent.parent.parent / "frontend" / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not set in frontend/.env")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def seeded_profiles(api_client):
    """Ensure DB has seeded profiles; returns list of profiles."""
    r = api_client.post(f"{BASE_URL}/api/seed", timeout=30)
    assert r.status_code == 200, f"Seed failed: {r.status_code} {r.text}"
    data = r.json()
    assert "profiles" in data
    profiles = data["profiles"]
    assert len(profiles) >= 3, f"Expected 3+ profiles, got {len(profiles)}"
    return profiles


@pytest.fixture(scope="session")
def me_profile(seeded_profiles):
    me = next((p for p in seeded_profiles if p["kind"] == "me"), None)
    assert me is not None, "No 'me' profile found"
    return me
