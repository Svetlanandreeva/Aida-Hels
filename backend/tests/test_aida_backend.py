"""Backend API tests for Aida Health MVP.

Covers: seed, profiles CRUD, analytics/readiness, gamification, puzzle,
symptoms, medications, labs, chat (Gemini), report, and labs/upload (Gemini vision).
"""
import io
import time
import pytest
import requests


# ============ Health / Seed ============

class TestHealthAndSeed:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("app") == "Aida"
        assert body.get("status") == "ok"

    def test_seed_returns_profiles(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/seed", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "profiles" in data
        assert len(data["profiles"]) >= 3
        kinds = {p["kind"] for p in data["profiles"]}
        assert kinds == {"me", "child", "relative"}

    def test_seed_idempotent(self, api_client, base_url):
        r1 = api_client.post(f"{base_url}/api/seed", timeout=30)
        r2 = api_client.post(f"{base_url}/api/seed", timeout=30)
        assert r1.status_code == 200 and r2.status_code == 200
        # Second call should return seeded=False (already seeded)
        assert r2.json().get("seeded") is False
        # profile count consistent
        assert len(r1.json()["profiles"]) == len(r2.json()["profiles"])


# ============ Profiles CRUD ============

class TestProfiles:
    def test_list_profiles(self, api_client, base_url, seeded_profiles):
        r = api_client.get(f"{base_url}/api/profiles", timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 3

    def test_create_update_delete_profile(self, api_client, base_url):
        # Create
        payload = {"name": "TEST_Profile", "kind": "relative", "sex": "male", "height_cm": 180}
        r = api_client.post(f"{base_url}/api/profiles", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["name"] == "TEST_Profile"
        assert p["kind"] == "relative"
        pid = p["id"]

        # Verify GET
        r = api_client.get(f"{base_url}/api/profiles/{pid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == pid

        # Update
        r = api_client.put(f"{base_url}/api/profiles/{pid}", json={"weight_kg": 82.5, "allergies": ["dust"]}, timeout=15)
        assert r.status_code == 200
        upd = r.json()
        assert upd["weight_kg"] == 82.5
        assert upd["allergies"] == ["dust"]

        # Delete
        r = api_client.delete(f"{base_url}/api/profiles/{pid}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Verify 404
        r = api_client.get(f"{base_url}/api/profiles/{pid}", timeout=15)
        assert r.status_code == 404


# ============ Analytics / Readiness ============

class TestReadiness:
    def test_readiness_scores(self, api_client, base_url, me_profile):
        r = api_client.get(f"{base_url}/api/analytics/readiness/{me_profile['id']}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "scores" in data and "overall" in data
        for k in ("profile", "labs", "symptoms", "medications"):
            assert k in data["scores"]
            assert 0 <= data["scores"][k] <= 100
        assert 0 <= data["overall"] <= 100

    def test_readiness_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/analytics/readiness/nonexistent-id", timeout=15)
        assert r.status_code == 404


# ============ Gamification ============

class TestGamification:
    def test_gamification(self, api_client, base_url, me_profile):
        r = api_client.get(f"{base_url}/api/gamification/{me_profile['id']}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("xp", "level", "xp_to_next", "companion", "quests"):
            assert k in d
        assert isinstance(d["quests"], list) and len(d["quests"]) == 5
        assert d["level"] >= 1
        assert d["companion"].get("name") == "Аида"


# ============ Puzzle ============

class TestPuzzle:
    def test_get_default_puzzle(self, api_client, base_url, me_profile):
        # Ensure clean state by hitting new profile
        r = api_client.get(f"{base_url}/api/puzzle/{me_profile['id']}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "widgets" in d
        assert len(d["widgets"]) >= 5

    def test_save_and_read_puzzle(self, api_client, base_url, me_profile):
        pid = me_profile["id"]
        widgets = [
            {"id": "companion", "enabled": True, "order": 0},
            {"id": "readiness", "enabled": False, "order": 1},
        ]
        r = api_client.post(f"{base_url}/api/puzzle/{pid}", json={"profile_id": pid, "widgets": widgets}, timeout=15)
        assert r.status_code == 200
        # GET back
        r = api_client.get(f"{base_url}/api/puzzle/{pid}", timeout=15)
        assert r.status_code == 200
        got = r.json()
        assert len(got["widgets"]) == 2
        ids = {w["id"] for w in got["widgets"]}
        assert ids == {"companion", "readiness"}


# ============ Symptoms CRUD ============

class TestSymptoms:
    def test_symptom_flow(self, api_client, base_url, me_profile):
        pid = me_profile["id"]
        # Create
        r = api_client.post(f"{base_url}/api/symptoms",
                            json={"profile_id": pid, "name": "TEST_Cough", "severity": 4}, timeout=15)
        assert r.status_code == 200, r.text
        s = r.json()
        assert s["name"] == "TEST_Cough"
        assert s["severity"] == 4
        assert s.get("date")  # auto-filled
        sid = s["id"]

        # List
        r = api_client.get(f"{base_url}/api/symptoms", params={"profile_id": pid}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert any(x["id"] == sid for x in items)

        # Delete
        r = api_client.delete(f"{base_url}/api/symptoms/{sid}", timeout=15)
        assert r.status_code == 200

        # Verify removed
        r = api_client.get(f"{base_url}/api/symptoms", params={"profile_id": pid}, timeout=15)
        assert not any(x["id"] == sid for x in r.json())


# ============ Medications CRUD ============

class TestMedications:
    def test_medication_flow(self, api_client, base_url, me_profile):
        pid = me_profile["id"]
        # Create
        r = api_client.post(f"{base_url}/api/medications",
                            json={"profile_id": pid, "name": "TEST_Ibuprofen", "dose": "200mg",
                                  "schedule": "1 tab, 2x/day"}, timeout=15)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["name"] == "TEST_Ibuprofen"
        mid = m["id"]

        # Update
        r = api_client.put(f"{base_url}/api/medications/{mid}",
                           json={"profile_id": pid, "name": "TEST_Ibuprofen", "dose": "400mg",
                                 "schedule": "1 tab, 1x/day", "active": False}, timeout=15)
        assert r.status_code == 200
        upd = r.json()
        assert upd["dose"] == "400mg"
        assert upd["active"] is False

        # List
        r = api_client.get(f"{base_url}/api/medications", params={"profile_id": pid}, timeout=15)
        assert r.status_code == 200
        assert any(x["id"] == mid for x in r.json())

        # Delete
        r = api_client.delete(f"{base_url}/api/medications/{mid}", timeout=15)
        assert r.status_code == 200


# ============ Labs (manual) ============

class TestLabs:
    def test_lab_manual_flow(self, api_client, base_url, me_profile):
        pid = me_profile["id"]
        payload = {
            "profile_id": pid,
            "title": "TEST_Manual Lab",
            "date": "2025-06-01",
            "lab_name": "TEST Lab",
            "biomarkers": [
                {"name": "Hemoglobin", "value": "130", "unit": "g/L", "reference": "120-150", "status": "normal"}
            ],
            "source": "manual",
        }
        r = api_client.post(f"{base_url}/api/labs", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        lab = r.json()
        assert lab["title"] == "TEST_Manual Lab"
        assert len(lab["biomarkers"]) == 1
        lid = lab["id"]

        # List
        r = api_client.get(f"{base_url}/api/labs", params={"profile_id": pid}, timeout=15)
        assert r.status_code == 200
        assert any(l["id"] == lid for l in r.json())

        # Delete
        r = api_client.delete(f"{base_url}/api/labs/{lid}", timeout=15)
        assert r.status_code == 200


# ============ AI Chat (Gemini 3 Flash) ============

class TestChat:
    def test_chat_and_persist(self, api_client, base_url, me_profile):
        pid = me_profile["id"]
        # Clear chat first
        api_client.delete(f"{base_url}/api/chat", params={"profile_id": pid}, timeout=15)

        r = api_client.post(
            f"{base_url}/api/chat",
            params={"language": "ru"},
            json={"profile_id": pid, "text": "Привет! Как ты?"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "user" in d and "assistant" in d
        assert d["user"]["role"] == "user"
        assert d["assistant"]["role"] == "assistant"
        assert isinstance(d["assistant"]["text"], str) and len(d["assistant"]["text"]) > 0

        # Verify persistence
        r = api_client.get(f"{base_url}/api/chat", params={"profile_id": pid}, timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs[-2:]]
        assert "user" in roles and "assistant" in roles


# ============ Doctor Report ============

class TestReport:
    def test_report(self, api_client, base_url, me_profile):
        r = api_client.get(f"{base_url}/api/report/{me_profile['id']}",
                           params={"days": 90, "language": "ru"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("profile", "labs", "symptoms", "medications", "ai_summary", "period_days"):
            assert k in d
        assert d["period_days"] == 90
        # ai_summary is best-effort; if present must be non-empty string
        if d.get("ai_summary") is not None:
            assert isinstance(d["ai_summary"], str)
            assert len(d["ai_summary"]) > 10


# ============ Labs Upload (Gemini Vision OCR) ============

class TestLabUpload:
    def test_upload_lab_image(self, base_url, me_profile):
        # Build a tiny fake image (PNG). Gemini may return generic fields; we only check the endpoint contract.
        # Use a minimal valid PNG (1x1 white pixel).
        import base64
        png_b64 = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        )
        img_bytes = base64.b64decode(png_b64)

        files = {"file": ("test.png", io.BytesIO(img_bytes), "image/png")}
        data = {"profile_id": me_profile["id"], "language": "ru"}
        r = requests.post(f"{base_url}/api/labs/upload", data=data, files=files, timeout=120)
        assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text[:500]}"
        lab = r.json()
        # Must return a lab-shaped object
        for k in ("id", "profile_id", "title", "date", "biomarkers", "source"):
            assert k in lab, f"Missing key {k} in response: {lab}"
        assert lab["profile_id"] == me_profile["id"]
        assert lab["source"] == "upload"
        assert isinstance(lab["biomarkers"], list)
