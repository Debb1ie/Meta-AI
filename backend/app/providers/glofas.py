"""Philippine river outlook from the Open-Meteo Flood API (GloFAS v4, no key).

GloFAS is a *modelled* global river discharge product (m³/s, daily) driven by
weather forecasts; it is not a gauge reading. It covers the Philippines, where no
public real-time gauge API exists, so it is presented as an outlook alongside the
measured gauges, never mixed into them.

Alert levels are percentiles of each river cell's own last five years of daily
discharge, so "Watch" means "unusually high for this river", not an official
PAGASA warning. Grid cells were chosen on the main channel (highest mean flow
within ~15 km of the named place) because the 0.05° grid misplaces small rivers."""

import threading
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

import httpx
import numpy as np

from ..config import get_settings

SOURCE = "GloFAS v4 river discharge via Open-Meteo Flood API"
SOURCE_URL = "https://open-meteo.com/en/docs/flood-api"
LEVELS = ("normal", "advisory", "warning", "critical")
LABELS = {"normal": "Normal", "advisory": "Advisory", "warning": "Warning", "critical": "Critical"}
# Exceedance percentiles of daily discharge: ~18, ~4 and ~0.7 days a year.
PERCENTILES = {"advisory": 95.0, "warning": 99.0, "critical": 99.8}
OUTLOOK_DAYS = 7
HISTORY_DAYS = 30
FORECAST_DAYS = 30
CLIMATOLOGY_YEARS = 5
CLIMATOLOGY_BATCH_SIZE = 4
TREND_LOOKBACK_DAYS = 3
TREND_THRESHOLD = 0.15  # relative change that counts as rising or falling


@dataclass(frozen=True)
class PHRiver:
    id: str
    name: str
    region: str
    latitude: float
    longitude: float


RIVERS = [
    PHRiver("ph-cagayan", "Cagayan River", "Cagayan Valley · near Tuguegarao", 17.775, 121.675),
    PHRiver("ph-pampanga", "Pampanga River", "Central Luzon · near Arayat", 15.025, 120.725),
    PHRiver("ph-agno", "Agno River", "Pangasinan · near Bayambang", 15.775, 120.325),
    PHRiver("ph-abra", "Abra River", "Cordillera · near Bangued", 17.525, 120.475),
    PHRiver("ph-pasig-marikina", "Pasig–Marikina River", "Metro Manila · Manila Bay outlet", 14.575, 120.925),
    PHRiver("ph-bicol", "Bicol River", "Camarines Sur · near Naga", 13.725, 123.075),
    PHRiver("ph-agusan", "Agusan River", "Caraga · near Butuan", 9.025, 125.475),
    PHRiver("ph-mindanao", "Mindanao River", "Maguindanao · near Cotabato", 7.175, 124.125),
    PHRiver("ph-magat", "Magat River", "Isabela · lower Magat", 17.025, 121.675),
    PHRiver("ph-angat", "Angat River", "Bulacan · lower Angat", 14.925, 120.825),
    PHRiver("ph-panay", "Panay River", "Capiz · near Roxas", 11.425, 122.675),
    PHRiver("ph-jalaur", "Jalaur River", "Iloilo · lower Jalaur", 10.825, 122.575),
    PHRiver("ph-ilog-hilabangan", "Ilog-Hilabangan River", "Negros Occidental", 9.925, 122.775),
    PHRiver("ph-cagayan-de-oro", "Cagayan de Oro River", "Misamis Oriental · CDO", 8.525, 124.725),
    PHRiver("ph-pulangi", "Pulangi River", "Bukidnon · upper Mindanao basin", 7.575, 125.025),
    PHRiver("ph-tagum-libuganon", "Tagum-Libuganon River", "Davao del Norte", 7.325, 125.675),
    PHRiver("ph-davao", "Davao River", "Davao City", 7.025, 125.575),
]

_lock = threading.Lock()
_cache: dict[str, tuple[float, dict]] = {}


class OutlookUnavailable(RuntimeError):
    pass


def _fetch(params: dict, rivers: list[PHRiver] = RIVERS) -> list[dict]:
    settings = get_settings()
    params = {
        "latitude": ",".join(str(r.latitude) for r in rivers),
        "longitude": ",".join(str(r.longitude) for r in rivers),
        **params,
    }
    try:
        resp = httpx.get(f"{settings.open_meteo_flood_url}/flood", params=params, timeout=60)
        resp.raise_for_status()
        body = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise OutlookUnavailable(f"Open-Meteo Flood request failed: {exc}") from exc
    return body if isinstance(body, list) else [body]


def _climatology() -> list[dict]:
    """Per-river alert levels from the last five years of daily discharge (cached a day)."""
    cached = _cache.get("climatology")
    if cached and time.time() - cached[0] < 24 * 3600:
        return cached[1]["rivers"]
    end = date.today() - timedelta(days=1)
    params = {
        "daily": "river_discharge",
        "start_date": (end - timedelta(days=CLIMATOLOGY_YEARS * 365)).isoformat(),
        "end_date": end.isoformat(),
    }
    rows = []
    for start in range(0, len(RIVERS), CLIMATOLOGY_BATCH_SIZE):
        rows.extend(_fetch(params, RIVERS[start : start + CLIMATOLOGY_BATCH_SIZE]))
    result = []
    for item in rows:
        values = np.array([v for v in item["daily"]["river_discharge"] if v is not None], dtype=float)
        if len(values) < 365:
            raise OutlookUnavailable("Not enough GloFAS history to derive alert levels.")
        result.append({k: round(float(np.percentile(values, p)), 1) for k, p in PERCENTILES.items()} | {"median": round(float(np.median(values)), 1)})
    _cache["climatology"] = (time.time(), {"rivers": result})
    return result


def _tier(value: float, thresholds: dict) -> str:
    tier = "normal"
    for level in ("advisory", "warning", "critical"):
        if value >= thresholds[level]:
            tier = level
    return tier


def _assess(river: PHRiver, item: dict, thresholds: dict, today: str) -> dict:
    daily = item["daily"]
    series = []
    for i, d in enumerate(daily["time"]):
        q = daily["river_discharge"][i]
        if q is None:
            continue
        series.append(
            {
                "date": d,
                "discharge_m3s": round(q, 1),
                "p25_m3s": _round(daily.get("river_discharge_p25", [None] * len(daily["time"]))[i]),
                "p75_m3s": _round(daily.get("river_discharge_p75", [None] * len(daily["time"]))[i]),
                "is_forecast": d > today,
            }
        )
    current = next((p for p in reversed(series) if p["date"] <= today), series[0] if series else None)
    if current is None:
        raise OutlookUnavailable(f"No GloFAS values for {river.name}.")
    window = [
        p
        for p in series
        if today <= p["date"] <= (date.fromisoformat(today) + timedelta(days=OUTLOOK_DAYS)).isoformat()
    ]
    peak = max(window or [current], key=lambda p: p["discharge_m3s"])
    upper = max((p["p75_m3s"] or p["discharge_m3s"] for p in window), default=peak["discharge_m3s"])
    three_days_ago = next((p for p in series if p["date"] == (date.fromisoformat(today) - timedelta(days=TREND_LOOKBACK_DAYS)).isoformat()), None)

    level = max(_tier(current["discharge_m3s"], thresholds), _tier(peak["discharge_m3s"], thresholds), key=LEVELS.index)
    if three_days_ago and three_days_ago["discharge_m3s"] > 0:
        change = (current["discharge_m3s"] - three_days_ago["discharge_m3s"]) / three_days_ago["discharge_m3s"]
        trend = "rising" if change > TREND_THRESHOLD else "falling" if change < -TREND_THRESHOLD else "steady"
    else:
        trend = "steady"

    peak_day = datetime.fromisoformat(peak["date"]).strftime("%a %d %b")
    if level == "normal":
        explanation = (
            f"Flow is about {current['discharge_m3s']:.0f} m³/s and expected to peak near {peak['discharge_m3s']:.0f} m³/s "
            f"({peak_day}), below this river's usual high-water mark of {thresholds['advisory']:.0f} m³/s."
        )
    else:
        explanation = (
            f"Flow expected to reach {peak['discharge_m3s']:.0f} m³/s ({peak_day}), at or above the "
            f"{LABELS[level].lower()} level for this river ({thresholds[level]:.0f} m³/s, the top "
            f"{100 - PERCENTILES[level]:.1f}% of days in the last five years)."
        )
    if upper > peak["discharge_m3s"] and _tier(upper, thresholds) != _tier(peak["discharge_m3s"], thresholds):
        explanation += f" Wetter forecast runs reach {upper:.0f} m³/s ({LABELS[_tier(upper, thresholds)].lower()})."

    return {
        "id": river.id,
        "name": river.name,
        "region": river.region,
        "latitude": item.get("latitude", river.latitude),
        "longitude": item.get("longitude", river.longitude),
        "current_m3s": current["discharge_m3s"],
        "current_date": current["date"],
        "trend": trend,
        "level": level,
        "label": LABELS[level],
        "rank": LEVELS.index(level),
        "peak": {"date": peak["date"], "discharge_m3s": peak["discharge_m3s"]},
        "upper_m3s": round(upper, 1),
        "explanation": explanation,
        "thresholds_m3s": thresholds,
        "series": series,
    }


def _round(v):
    return None if v is None else round(v, 1)


def outlook() -> dict:
    """All rivers' outlooks; cached, and the last good result is served if the API fails."""
    settings = get_settings()
    with _lock:
        cached = _cache.get("outlook")
        if cached and time.time() - cached[0] < settings.glofas_cache_seconds:
            return cached[1]
        try:
            climatology = _climatology()
            rows = _fetch(
                {
                    "daily": "river_discharge,river_discharge_p25,river_discharge_p75",
                    "past_days": HISTORY_DAYS,
                    "forecast_days": FORECAST_DAYS,
                }
            )
            today = date.today().isoformat()
            rivers = [_assess(r, item, climatology[i], today) for i, (r, item) in enumerate(zip(RIVERS, rows))]
        except OutlookUnavailable as exc:
            if cached:
                return {**cached[1], "stale": True, "stale_reason": str(exc)}
            raise
        result = {
            "source": SOURCE,
            "source_url": SOURCE_URL,
            "data_kind": "modelled",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "stale": False,
            "method": (
                "Daily river discharge from the GloFAS hydrological model (ensemble median; p25–p75 band). "
                "Alert levels are the 95th / 99th / 99.8th percentiles of each river cell's last five years. "
                "Modelled, not measured; not an official PAGASA warning."
            ),
            "rivers": sorted(rivers, key=lambda r: (-r["rank"], -r["peak"]["discharge_m3s"] / max(r["thresholds_m3s"]["advisory"], 1))),
        }
        _cache["outlook"] = (time.time(), result)
        return result
