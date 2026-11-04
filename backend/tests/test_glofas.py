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
    monkeypatch.setitem(glofas._cache, "climatology", None)

    result = glofas._climatology()

    assert calls == [4, 4, 4, 4, 1]
    assert len(result) == len(glofas.RIVERS)
