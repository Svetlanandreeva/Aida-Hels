"""Tests for new endpoints added in iteration 2: vitals, checkins, tasks, overview."""
import pytest


# ============ Vitals (bp + others) ============

class TestVitals:
    def test_bp_flow(self, api_client, base_url, me_profile):
        pid = me_profile["id"]
        payload = {"profile_id": pid, "kind": "bp", "systolic": 128, "diastolic": 82, "pulse": 72}
        r = api_client.post(f"{base_url}/api/vitals", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["kind"] == "bp"
        assert v["systolic"] == 128 and v["diastolic"] == 82
        assert v.get("date")
        vid = v["id"]

        # List filtered by kind=bp
        r = api_client.get(f"{base_url}/api/vitals", params={"profile_id": pid, "kind": "bp"}, timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert any(x["id"] == vid for x in arr)
        assert all(x["kind"] == "bp" for x in arr)

        # Delete
        r = api_client.delete(f"{base_url}/api/vitals/{vid}", timeout=15)
        assert r.status_code == 200

    def test_weight_vital(self, api_client, base_url, me_profile):
        pid = me_profile["id"]
        r = api_client.post(f"{base_url}/api/vitals",
                            json={"profile_id": pid, "kind": "weight", "value": 62.5, "unit": "kg"},
                            timeout=15)
        assert r.status_code == 200
        v = r.json()
        assert v["kind"] == "weight" and v["value"] == 62.5
        api_client.delete(f"{base_url}/api/vitals/{v['id']}", timeout=15)


# ============ Check-ins ============

class TestCheckins:
    def test_checkin_flow(self, api_client, base_url, me_profile):
        pid = me_profile["id"]
        payload = {"profile_id": pid, "mood": 4, "energy": 3, "stress": 2, "anxiety": 2, "sleep": 4,
                   "triggers": "TEST"}
        r = api_client.post(f"{base_url}/api/checkins", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["mood"] == 4 and c["sleep"] == 4
        assert c.get("date")
        cid = c["id"]

        r = api_client.get(f"{base_url}/api/checkins", params={"profile_id": pid}, timeout=15)
        assert r.status_code == 200
        assert any(x["id"] == cid for x in r.json())

        r = api_client.delete(f"{base_url}/api/checkins/{cid}", timeout=15)
        assert r.status_code == 200


# ============ Tasks ============

class TestTasks:
    def test_task_flow(self, api_client, base_url, me_profile):
        pid = me_profile["id"]
        r = api_client.post(f"{base_url}/api/tasks",
                            json={"profile_id": pid, "title": "TEST_Task",
                                  "kind": "custom", "due": "2025-06-01"}, timeout=15)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["title"] == "TEST_Task"
        assert t["done"] is False
        tid = t["id"]

        # Toggle
        r = api_client.put(f"{base_url}/api/tasks/{tid}/toggle", timeout=15)
        assert r.status_code == 200
        assert r.json()["done"] is True

        # Toggle back
        r = api_client.put(f"{base_url}/api/tasks/{tid}/toggle", timeout=15)
        assert r.status_code == 200
        assert r.json()["done"] is False

        # List
        r = api_client.get(f"{base_url}/api/tasks", params={"profile_id": pid}, timeout=15)
        assert r.status_code == 200
        assert any(x["id"] == tid for x in r.json())

        # Delete
        r = api_client.delete(f"{base_url}/api/tasks/{tid}", timeout=15)
        assert r.status_code == 200

    def test_toggle_nonexistent(self, api_client, base_url):
        r = api_client.put(f"{base_url}/api/tasks/nonexistent/toggle", timeout=15)
        assert r.status_code == 404


# ============ Overview ============

class TestOverview:
    def test_overview_ru(self, api_client, base_url, me_profile):
        r = api_client.get(f"{base_url}/api/overview/{me_profile['id']}",
                           params={"language": "ru"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "attention" in d and "ai_summary" in d
        assert isinstance(d["attention"], list)
        # ai_summary is best-effort but Gemini should respond
        if d.get("ai_summary") is not None:
            assert isinstance(d["ai_summary"], str) and len(d["ai_summary"]) > 0

    def test_overview_404(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/overview/nonexistent", timeout=15)
        assert r.status_code == 404
