"""Open-Meteo weather forecasts (no API key required). Real data for the station
coordinates; cached in memory to respect the free tier."""

import time
from datetime import datetime, timezone

import httpx
import pandas as pd

from ..config import get_settings

_cache: dict[tuple[float, float], tuple[float, dict]] = {}


class WeatherUnavailable(RuntimeError):
    pass


def fetch_forecast(latitude: float, longitude: float) -> dict:
    settings = get_settings()
    key = (round(latitude, 3), round(longitude, 3))
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < settings.open_meteo_cache_seconds:
        return cached[1]

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "precipitation,precipitation_probability,temperature_2m,relative_humidity_2m",
        "past_days": 1,
        "forecast_days": 3,
        "timezone": "UTC",
    }
    try:
        resp = httpx.get(f"{settings.open_meteo_base_url}/forecast", params=params, timeout=15)
        resp.raise_for_status()
        raw = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        if cached:
            return {**cached[1], "stale": True, "stale_reason": str(exc)}
        raise WeatherUnavailable(f"Open-Meteo request failed: {exc}") from exc

    hourly = raw.get("hourly", {})
    times = hourly.get("time", [])
    now = datetime.now(timezone.utc)
    rows = []
    for i, t in enumerate(times):
        ts = datetime.fromisoformat(t).replace(tzinfo=timezone.utc)
        rows.append(
            {
                "time": ts.isoformat(),
                "is_forecast": ts > now,
                "precipitation_mm": hourly.get("precipitation", [None] * len(times))[i],
                "precipitation_probability": hourly.get("precipitation_probability", [None] * len(times))[i],
                "temperature_c": hourly.get("temperature_2m", [None] * len(times))[i],
                "relative_humidity": hourly.get("relative_humidity_2m", [None] * len(times))[i],
            }
        )

    def total(selector) -> float:
        return round(sum(r["precipitation_mm"] or 0 for r in rows if selector(r)), 1)

    def hours_from_now(r) -> float:
        return (datetime.fromisoformat(r["time"]) - now).total_seconds() / 3600

    result = {
        "source": "Open-Meteo Forecast API",
        "source_url": "https://open-meteo.com/",
        "model": "Open-Meteo best-match (seamless) forecast",
        "latitude": raw.get("latitude"),
        "longitude": raw.get("longitude"),
        "timezone": "UTC",
        "fetched_at": now.isoformat(),
        "stale": False,
        "hourly": rows,
        "summary": {
            "past_24h_mm": total(lambda r: -24 < hours_from_now(r) <= 0),
            "next_6h_mm": total(lambda r: 0 < hours_from_now(r) <= 6),
            "next_24h_mm": total(lambda r: 0 < hours_from_now(r) <= 24),
            "next_72h_mm": total(lambda r: 0 < hours_from_now(r) <= 72),
            "max_hourly_next_24h_mm": max(
                (r["precipitation_mm"] or 0 for r in rows if 0 < hours_from_now(r) <= 24), default=0
            ),
        },
    }
    _cache[key] = (time.time(), result)
    return result


def fetch_rain_history(latitude: float, longitude: float, past_days: int) -> pd.DataFrame:
    """Hourly precipitation (mm) for the past `past_days` days, up to now. Modelled
    (Open-Meteo best-match analysis), used as the rainfall column for live gauges."""
    settings = get_settings()
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "precipitation",
        "past_days": max(1, min(92, past_days)),
        "forecast_days": 1,
        "timezone": "UTC",
    }
    try:
        resp = httpx.get(f"{settings.open_meteo_base_url}/forecast", params=params, timeout=30)
        resp.raise_for_status()
        hourly = resp.json().get("hourly", {})
    except (httpx.HTTPError, ValueError) as exc:
        raise WeatherUnavailable(f"Open-Meteo request failed: {exc}") from exc
    frame = pd.DataFrame({"observed_at": pd.to_datetime(hourly.get("time", []), utc=True), "rainfall_mm": hourly.get("precipitation", [])})
    frame["rainfall_mm"] = pd.to_numeric(frame["rainfall_mm"], errors="coerce")
    return frame[frame["observed_at"] <= pd.Timestamp.now(tz="UTC")].dropna()
