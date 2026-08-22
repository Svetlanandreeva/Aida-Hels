from types import SimpleNamespace

import google_storage
from google_storage import SheetsHTTP


def _http_for_test():
    http = object.__new__(SheetsHTTP)
    http.spreadsheet_id = "spreadsheet"
    http.headers = lambda: {"Authorization": "Bearer test", "Content-Type": "application/json"}
    return http


def test_google_sheets_429_is_retried_with_backoff(monkeypatch):
    http = _http_for_test()
    calls = []
    sleeps = []
    responses = [
        SimpleNamespace(status_code=429, headers={"Retry-After": "0"}),
        SimpleNamespace(status_code=200, headers={}),
    ]

    def fake_request(method, url, **kwargs):
        calls.append((method, url))
        return responses.pop(0)

    monkeypatch.setattr(google_storage.requests, "request", fake_request)
    monkeypatch.setattr(google_storage.time, "sleep", sleeps.append)

    response = http._request("POST", "values/test:append")

    assert response.status_code == 200
    assert len(calls) == 2
    assert sleeps == [0.0]


def test_non_quota_write_server_error_is_not_retried(monkeypatch):
    http = _http_for_test()
    calls = []

    def fake_request(method, url, **kwargs):
        calls.append((method, url))
        return SimpleNamespace(status_code=503, headers={})

    monkeypatch.setattr(google_storage.requests, "request", fake_request)
    monkeypatch.setattr(google_storage.time, "sleep", lambda _: None)

    response = http._request("POST", "values/test:append")

    assert response.status_code == 503
    assert len(calls) == 1


def test_transient_read_server_error_is_retried(monkeypatch):
    http = _http_for_test()
    calls = []
    responses = [
        SimpleNamespace(status_code=503, headers={}),
        SimpleNamespace(status_code=200, headers={}),
    ]

    def fake_request(method, url, **kwargs):
        calls.append((method, url))
        return responses.pop(0)

    monkeypatch.setattr(google_storage.requests, "request", fake_request)
    monkeypatch.setattr(google_storage.time, "sleep", lambda _: None)

    response = http._request("GET", "values/test", retry_server_errors=True)

    assert response.status_code == 200
    assert len(calls) == 2


def test_retry_after_is_capped():
    response = SimpleNamespace(headers={"Retry-After": "120"})
    assert SheetsHTTP._retry_delay(response, 0) == 10.0
