import asyncio

import httpx
import pytest
from fastapi import HTTPException

from routers import eco_calendar


@pytest.fixture(autouse=True)
def clear_cache():
    eco_calendar._cache.clear()


def _mock_client(monkeypatch, handler):
    async_client = httpx.AsyncClient
    monkeypatch.setattr(
        eco_calendar.httpx,
        "AsyncClient",
        lambda **kwargs: async_client(transport=httpx.MockTransport(handler), **kwargs),
    )


def _fetch(start="2026-09-28", end="2026-10-02"):
    return asyncio.run(eco_calendar.get_eco_calendar(start, end, {"sub": "test"}))


def test_fred_release_dates_are_normalized_and_paginated(monkeypatch):
    monkeypatch.setenv("FRED_API_KEY", "test-key")
    seen = []

    def handler(request):
        params = request.url.params
        seen.append(dict(params))
        assert request.url.path == "/fred/releases/dates"
        assert params["api_key"] == "test-key"
        assert params["file_type"] == "json"
        assert params["realtime_start"] == "2026-09-28"
        assert params["realtime_end"] == "2026-10-02"
        assert params["include_release_dates_with_no_data"] == "true"
        assert params["sort_order"] == "desc"
        if params["offset"] == "0":
            return httpx.Response(200, json={
                "count": 6,
                "release_dates": [
                    {"release_id": 3, "release_name": "Future date", "date": "2026-10-03"},
                    {"release_id": 1, "release_name": "Employment Situation", "date": "2026-10-02"},
                ],
            })
        assert params["offset"] == "2"
        return httpx.Response(200, json={
            "count": 6,
            "release_dates": [
                {"release_id": 2, "release_name": "Gross Domestic Product", "date": "2026-09-30"},
                {"release_id": 4, "release_name": "Older date", "date": "2026-09-25"},
            ],
        })

    _mock_client(monkeypatch, handler)
    events = _fetch()
    assert len(seen) == 2
    assert [event["event"] for event in events] == ["Gross Domestic Product", "Employment Situation"]
    assert events[0] == {
        "actual": None,
        "country": "",
        "estimate": None,
        "event": "Gross Domestic Product",
        "impact": "unknown",
        "prev": None,
        "time": "2026-09-30 00:00:00",
        "time_known": False,
        "unit": "",
    }
    assert _fetch() == events
    assert len(seen) == 2  # cached


def test_missing_key_and_invalid_range(monkeypatch):
    monkeypatch.delenv("FRED_API_KEY", raising=False)
    with pytest.raises(HTTPException) as error:
        _fetch()
    assert error.value.status_code == 503
    assert "FRED_API_KEY" in error.value.detail

    with pytest.raises(HTTPException) as error:
        _fetch("2026-10-02", "2026-09-28")
    assert error.value.status_code == 422


def test_fred_error_does_not_expose_key(monkeypatch):
    monkeypatch.setenv("FRED_API_KEY", "secret-test-key")
    _mock_client(monkeypatch, lambda request: httpx.Response(500))
    with pytest.raises(HTTPException) as error:
        _fetch()
    assert error.value.status_code == 502
    assert "secret-test-key" not in error.value.detail


def test_invalid_fred_key(monkeypatch):
    monkeypatch.setenv("FRED_API_KEY", "secret-test-key")
    _mock_client(monkeypatch, lambda request: httpx.Response(
        400, json={"error_message": "Bad Request. The value for variable api_key is not valid."},
    ))
    with pytest.raises(HTTPException) as error:
        _fetch()
    assert error.value.status_code == 503
    assert error.value.detail == "Clé FRED invalide"
