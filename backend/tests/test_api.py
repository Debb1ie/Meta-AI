"""API integration: seeds the simulated scenario into an isolated database."""

import io

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers import open_meteo


@pytest.fixture(scope="module")
def client():
    # No network in tests: weather is reported unavailable.
    def unavailable(*_a, **_k):
        raise open_meteo.WeatherUnavailable("offline in tests")

    original = open_meteo.fetch_forecast
    open_meteo.fetch_forecast = unavailable
    with TestClient(app, headers={"X-Admin-Token": "test-admin"}) as c:
        # Production warms every forecast in the background before pages use them; do the same.
        from app.main import _warm_forecasts

        _warm_forecasts()
        yield c
    open_meteo.fetch_forecast = original


def test_overview_reports_every_station(client):
    d = client.get("/api/overview").json()
    assert d["station_count"] == 5 and d["any_simulated"] is True
    assert sum(d["risk_counts"].values()) == 5
    assert d["weather_available"] is False
    for row in d["stations"]:
        assert row["status"] == "ok"
        assert set(row["forecast"]) == {"1", "3", "6", "24"}
        assert row["risk"]["explanation"]


def test_station_report_has_provenance_and_freshness(client):
    d = client.get("/api/stations/sim-mid").json()
    assert d["freshness"]["data_kind"] == "simulated"
    assert d["provenance"][0]["is_simulated"] is True
    assert d["forecast"]["backtests"]["6"]
    assert client.get("/api/stations/nope").status_code == 404


def test_threshold_update_changes_risk(client):
    before = client.get("/api/stations/sim-upper").json()
    cur = before["forecast"]["current_level_m"]
    body = {"advisory_m": cur + 10, "warning_m": cur + 11, "critical_m": cur + 12, "rise_rate_m_per_h": 5, "source": "test"}
    assert client.put("/api/stations/sim-upper/thresholds", json=body).status_code == 200
    assert client.get("/api/stations/sim-upper").json()["risk"]["level"] == "normal"
    bad = {**body, "warning_m": body["advisory_m"] - 1}
    assert client.put("/api/stations/sim-upper/thresholds", json=bad).status_code == 422


CSV = "time,station,level,rain\n" + "\n".join(
    f"2026-09-{1 + i // 24:02d} {i % 24:02d}:00,csv-a,{2 + (i % 24) / 100:.2f},0" for i in range(24 * 8)
) + "\nbad-date,csv-a,1,0\n"


def test_csv_preview_then_import(client):
    files = {"file": ("obs.csv", io.BytesIO(CSV.encode()), "text/csv")}
    prev = client.post("/api/data/preview", files=files, data={"source_timezone": "Asia/Manila"}).json()
    assert prev["unknown_stations"] == ["csv-a"]
    assert prev["report"]["issues"]["invalid_timestamp"] == 1

    files = {"file": ("obs.csv", io.BytesIO(CSV.encode()), "text/csv")}
    r = client.post("/api/data/import", files=files, data={"source_timezone": "Asia/Manila"})
    assert r.status_code == 422  # metadata required for a new station

    station = (
        '[{"id":"csv-a","name":"CSV A","latitude":14.6,"longitude":121.0,"advisory_m":3,"warning_m":4,'
        '"critical_m":5,"threshold_source":"test values"}]'
    )
    files = {"file": ("obs.csv", io.BytesIO(CSV.encode()), "text/csv")}
    r = client.post("/api/data/import", files=files, data={"source_timezone": "Asia/Manila", "new_stations": station})
    assert r.status_code == 200, r.text
    ds = r.json()["dataset"]
    assert ds["rows_imported"] == 24 * 8 and ds["rows_rejected"] == 1 and ds["is_simulated"] is False

    # The import starts training in the background; the page shows "warming" until it is done.
    import time

    for _ in range(60):
        report = client.get("/api/stations/csv-a").json()
        if report["forecast"]["status"] != "warming":
            break
        time.sleep(0.5)
    assert report["freshness"]["data_kind"] == "observed"
    assert report["forecast"]["status"] == "ok"
    assert report["forecast"]["ml_available"] is False  # 8 days < ML minimum
    names = [d["name"] for d in client.get("/api/datasets").json()]
    assert "obs.csv" in names


def test_ai_endpoints_fail_clearly_without_key(client):
    r = client.post("/api/ai/analyst", json={"question": "What is happening?"})
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]["message"]
    assert client.get("/api/ai/status").json()["configured"] is False
