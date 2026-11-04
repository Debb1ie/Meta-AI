import json

import httpx

from app.providers import glofas


def test_assess_peak_includes_today():
    river = glofas.RIVERS[0]
    item = {
        "daily": {
            "time": ["2026-11-04", "2026-11-05", "2026-11-06"],
            "river_discharge": [795.0, 657.0, 600.0],
        }
    }
    thresholds = {"advisory": 1948.0, "warning": 2500.0, "critical": 3000.0, "median": 500.0}

    result = glofas._assess(river, item, thresholds, "2026-11-04")

    assert result["current_m3s"] == 795.0
    assert result["peak"] == {"date": "2026-11-04", "discharge_m3s": 795.0}


def test_climatology_batches_large_history_requests(monkeypatch):
    calls = []

    def fake_fetch(params, rivers=glofas.RIVERS):
        calls.append(len(rivers))
        return [{"daily": {"river_discharge": [float(i)] * 365}} for i in range(len(rivers))]

    monkeypatch.setattr(glofas, "_fetch", fake_fetch)

    result = glofas._climatology_live()

    assert calls == [4, 4, 4, 4, 1]
    assert len(result) == len(glofas.RIVERS)


def _isolate(monkeypatch, tmp_path):
    monkeypatch.setattr(glofas, "_cache", {})
    monkeypatch.setattr(glofas, "LAST_GOOD_FILE", tmp_path / "last.json")


def test_bundled_thresholds_avoid_the_history_download(monkeypatch, tmp_path):
    _isolate(monkeypatch, tmp_path)

    def no_network(*a, **k):
        raise AssertionError("history should not be downloaded while the bundled file is recent")

    monkeypatch.setattr(glofas, "_climatology_live", no_network)
    monkeypatch.setattr(glofas, "BUNDLED_CLIMATOLOGY_MAX_AGE_DAYS", 10_000)
    result = glofas._climatology()
    assert len(result) == len(glofas.RIVERS)
    assert all(t["advisory"] < t["warning"] < t["critical"] for t in result)


def test_rate_limited_outlook_falls_back_to_snapshot_and_pauses(monkeypatch, tmp_path):
    _isolate(monkeypatch, tmp_path)
    calls = []

    def limited(params, rivers=glofas.RIVERS):
        calls.append(1)
        raise glofas.OutlookUnavailable("Open-Meteo Flood request failed: 429 Too Many Requests")

    monkeypatch.setattr(glofas, "_fetch", limited)
    monkeypatch.setattr(glofas, "BUNDLED_CLIMATOLOGY_MAX_AGE_DAYS", 10_000)
    first = glofas.outlook()
    assert first["stale"] is True and len(first["rivers"]) == len(glofas.RIVERS)
    assert "busy" in first["stale_reason"] and "429" not in first["stale_reason"]
    glofas.outlook()
    assert len(calls) == 1  # the second request is served from the fallback without a live call


def test_last_good_file_beats_older_snapshot(monkeypatch, tmp_path):
    _isolate(monkeypatch, tmp_path)
    snap = json.loads(glofas.SNAPSHOT_FILE.read_text())
    newer = {**snap, "fetched_at": "2999-01-01T00:00:00+00:00", "rivers": snap["rivers"][:1]}
    glofas.LAST_GOOD_FILE.write_text(json.dumps(newer))
    assert glofas._fallback()["fetched_at"] == newer["fetched_at"]


def test_fetch_retries_on_429(monkeypatch):
    request = httpx.Request("GET", "https://flood-api.open-meteo.com/v1/flood")
    responses = [httpx.Response(429, headers={"Retry-After": "0"}, request=request), httpx.Response(200, json=[{"daily": {}}], request=request)]
    monkeypatch.setattr(glofas.httpx, "get", lambda *a, **k: responses.pop(0))
    monkeypatch.setattr(glofas.time, "sleep", lambda s: None)
    assert glofas._fetch({"daily": "river_discharge"}) == [{"daily": {}}]
    assert responses == []
