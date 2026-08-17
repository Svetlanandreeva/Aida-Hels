#!/usr/bin/env python3
"""Read-only production smoke for the Aida WEB baseline.

Requires explicit test-account credentials and never registers users or mutates
health data. This is safe to run after a deploy while the full browser E2E is
performed separately.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = os.environ.get("AIDA_SMOKE_BASE_URL", "https://aidaassistent.ru").rstrip("/")
EMAIL = os.environ.get("AIDA_SMOKE_EMAIL", "").strip()
PASSWORD = os.environ.get("AIDA_SMOKE_PASSWORD", "")
TIMEOUT = float(os.environ.get("AIDA_SMOKE_TIMEOUT", "15"))


def request(path: str, *, method: str = "GET", body=None, token: str | None = None):
    headers = {"Accept": "application/json"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            raw = response.read().decode("utf-8")
            payload = json.loads(raw) if raw else None
            return response.status, payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} -> HTTP {exc.code}: {raw[:500]}") from exc


def expect(status: int, expected: int, label: str):
    if status != expected:
        raise RuntimeError(f"{label}: expected HTTP {expected}, got {status}")
    print(f"OK  {label}")


def main() -> int:
    if not EMAIL or not PASSWORD:
        print("AIDA_SMOKE_EMAIL and AIDA_SMOKE_PASSWORD are required", file=sys.stderr)
        return 2

    status, health = request("/api/")
    expect(status, 200, "backend health")
    if not isinstance(health, dict) or health.get("status") != "ok":
        raise RuntimeError(f"backend health payload is unexpected: {health!r}")

    status, session = request("/api/auth/login", method="POST", body={"email": EMAIL, "password": PASSWORD})
    expect(status, 200, "login")
    token = (session or {}).get("access_token")
    if not token:
        raise RuntimeError("login response has no access_token")

    status, me = request("/api/auth/me", token=token)
    expect(status, 200, "session restore")
    if ((me or {}).get("account") or {}).get("email", "").lower() != EMAIL.lower():
        raise RuntimeError("/auth/me returned a different account")

    status, profiles = request("/api/profiles", token=token)
    expect(status, 200, "profile list")
    if not isinstance(profiles, list) or not profiles:
        raise RuntimeError("test account has no profiles")

    profile_id = str(profiles[0].get("id") or "")
    if not profile_id:
        raise RuntimeError("first profile has no id")

    status, home = request(f"/api/home/{urllib.parse.quote(profile_id, safe='')}", token=token)
    expect(status, 200, "aggregated Home API")
    if (home or {}).get("profile_id") != profile_id:
        raise RuntimeError("Home API profile_id mismatch")

    status, sessions = request("/api/account/sessions", token=token)
    expect(status, 200, "account session list")
    if not isinstance(sessions, list):
        raise RuntimeError("session list payload is not a list")

    print("PASS Aida production read-only WEB smoke")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        raise SystemExit(1)
