"""Security controls: admin key on data-changing endpoints, rate limits, headers, CORS."""

import io

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.providers import open_meteo
from app.security import limiter

THRESHOLDS = {"advisory_m": 1, "warning_m": 2, "critical_m": 3, "rise_rate_m_per_h": 0.15, "source": "attacker"}


@pytest.fixture(scope="module")
def anon():
    def unavailable(*_a, **_k):
        raise open_meteo.WeatherUnavailable("offline in tests")

    original = open_meteo.fetch_forecast
    open_meteo.fetch_forecast = unavailable
    with TestClient(app) as c:
        yield c
    open_meteo.fetch_forecast = original


@pytest.mark.parametrize(
    "method,path,kwargs",
    [
        ("put", "/api/stations/sim-upper/thresholds", {"json": THRESHOLDS}),
        ("post", "/api/data/import", {"files": {"file": ("x.csv", io.BytesIO(b"t,s,l\n"), "text/csv")}}),
        ("post", "/api/demo/reset", {}),
        ("post", "/api/live/sync", {}),
    ],
)
def test_data_changing_endpoints_require_admin_key(anon, method, path, kwargs):
    assert getattr(anon, method)(path, **kwargs).status_code == 401
    wrong = {"X-Admin-Token": "guess"}
    assert getattr(anon, method)(path, headers=wrong, **kwargs).status_code == 401


def test_anonymous_cannot_fake_an_alert(anon):
    before = anon.get("/api/stations/sim-upper").json()["station"]["thresholds"]
    anon.put("/api/stations/sim-upper/thresholds", json=THRESHOLDS)
    assert anon.get("/api/stations/sim-upper").json()["station"]["thresholds"] == before


def test_admin_actions_disabled_without_configured_key(anon, monkeypatch):
    monkeypatch.setattr(get_settings(), "admin_token", "")
    r = anon.put("/api/stations/sim-upper/thresholds", json=THRESHOLDS, headers={"X-Admin-Token": ""})
    assert r.status_code == 403


def test_rate_limit_returns_429_with_retry_after(anon, monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limits_enabled", True)
    limiter.reset()
    csv = b"time,station,level\n2026-09-01 00:00,a,1\n"
    codes = [
        anon.post("/api/data/preview", files={"file": ("x.csv", io.BytesIO(csv), "text/csv")}, headers={"CF-Connecting-IP": "203.0.113.7"}).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [200] * 10 and codes[10] == 429
    other = anon.post("/api/data/preview", files={"file": ("x.csv", io.BytesIO(csv), "text/csv")}, headers={"CF-Connecting-IP": "203.0.113.8"})
    assert other.status_code == 200  # limits are per client
    limiter.reset()


def test_security_headers_on_api_responses(anon):
    h = anon.get("/api/health").headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert "default-src 'none'" in h["content-security-policy"]
    assert h["referrer-policy"] == "no-referrer"


def test_cors_rejects_unknown_origins(anon):
    for origin in ("https://evil.example", "https://hydrosentinel-evil.vercel.app", "null"):
        r = anon.get("/api/health", headers={"Origin": origin})
        assert "access-control-allow-origin" not in r.headers
    ok = anon.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:3000"
