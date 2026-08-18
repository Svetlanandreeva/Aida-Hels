from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent


def test_google_storage_has_separate_circadian_tabs():
    text = (ROOT / "google_storage.py").read_text(encoding="utf-8")
    assert '"circadian_events": "circadian_events"' in text
    assert '"circadian_plans": "circadian_plans"' in text
    assert "ensure_sheet" in text


def test_profile_delete_cleans_circadian_rows():
    text = (ROOT / "profile_api.py").read_text(encoding="utf-8")
    assert "db.circadian_events" in text
    assert "db.circadian_plans" in text


def test_wearable_sleep_anchor_requires_candidate_review():
    circadian = (ROOT / "circadian_api.py").read_text(encoding="utf-8")
    candidates = (ROOT / "candidate_records.py").read_text(encoding="utf-8")

    assert '@router.post("/wearable-candidates")' in circadian
    assert 'Imported sleep anchors must be reviewed through CandidateRecords' in circadian
    assert '"entity_type": "circadian_event"' in circadian
    assert '"circadian_event": "circadian_events"' in candidates
    assert 'payload["source"] = "wearable_confirmed"' in candidates
    assert 'payload["verification_status"] = "user_confirmed"' in candidates


def test_pending_circadian_candidate_can_be_corrected_without_rewriting_provenance():
    candidates = (ROOT / "candidate_records.py").read_text(encoding="utf-8")
    circadian_api = (REPO_ROOT / "frontend" / "src" / "circadianApi.ts").read_text(encoding="utf-8")

    assert '@router.patch("/{candidate_id}/circadian"' in candidates
    assert 'Only pending candidates can be corrected' in candidates
    assert 'Candidate is not a circadian event' in candidates
    assert 'payload = dict(candidate.get("payload") or {})' in candidates
    assert 'payload.update({"kind": kind, "local_date": local_date, "local_time": local_time})' in candidates
    assert 'action="candidate.corrected"' in candidates
    assert 'corrected_fields' in candidates
    assert 'correctCircadianCandidate' in circadian_api
    assert 'method: "PATCH"' in circadian_api
    assert '/circadian`' in circadian_api


def test_healthkit_sleep_is_staged_as_candidates_before_circadian_use():
    coordinator = (REPO_ROOT / "ios" / "AidaHealthSyncCoordinator.swift").read_text(encoding="utf-8")
    client = (REPO_ROOT / "ios" / "CircadianCandidateClient.swift").read_text(encoding="utf-8")

    assert 'filter { $0.metric == "sleep_stage" }' in coordinator
    assert 'provider: "apple_health"' in coordinator
    assert 'kind: "bedtime"' in coordinator
    assert 'kind: "wake"' in coordinator
    assert 'api/circadian/wearable-candidates' in client
    assert 'Authorization' in client


def test_health_connect_sleep_is_staged_as_candidates_before_circadian_use():
    manager = (REPO_ROOT / "android" / "AidaHealthConnectManager.kt").read_text(encoding="utf-8")
    client = (REPO_ROOT / "android" / "AidaCircadianCandidateClient.kt").read_text(encoding="utf-8")

    assert "readSleepSessions" in manager
    assert "SleepSessionRecord" in manager
    assert 'provider = "android_health_connect"' in client
    assert 'kind = "bedtime"' in client
    assert 'kind = "wake"' in client
    assert "/api/circadian/wearable-candidates" in client
    assert 'setRequestProperty("Authorization", "Bearer $bearerToken")' in client


def test_expo_health_connect_bridge_routes_sleep_sessions_to_candidate_api():
    module_root = REPO_ROOT / "frontend" / "modules" / "aida-health-connect"
    manager = (module_root / "android" / "src" / "main" / "java" / "expo" / "modules" / "aidahealthconnect" / "AidaHealthConnectManager.kt").read_text(encoding="utf-8")
    module = (module_root / "android" / "src" / "main" / "java" / "expo" / "modules" / "aidahealthconnect" / "AidaHealthConnectModule.kt").read_text(encoding="utf-8")
    native_health = (REPO_ROOT / "frontend" / "src" / "native-health.ts").read_text(encoding="utf-8")
    circadian_api = (REPO_ROOT / "frontend" / "src" / "circadianApi.ts").read_text(encoding="utf-8")

    assert "readSleepSessions" in manager
    assert '"sleep_sessions" to sleepSessions' in module
    assert "stageHealthConnectSleep" in native_health
    assert 'provider: "android_health_connect"' in native_health
    assert 'kind: "bedtime"' in native_health
    assert 'kind: "wake"' in native_health
    assert "stageWearableRhythmCandidate" in native_health
    assert 'req("/circadian/wearable-candidates"' in circadian_api
