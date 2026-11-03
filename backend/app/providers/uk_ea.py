"""UK Environment Agency real-time flood-monitoring API (no key, Open Government
Licence). Measured river stage every 15 minutes; the API keeps about four weeks
of readings, which is enough history for the full forecasting pipeline.

Rainfall comes from Open-Meteo (modelled hourly precipitation at the gauge), so
the provider yields both columns the pipeline expects."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
import pandas as pd

from ..config import get_settings
from . import open_meteo
from .base import StationMetadata

SOURCE_URL = "https://environment.data.gov.uk/flood-monitoring/doc/reference"


@dataclass(frozen=True)
class EAGauge:
    reference: str  # EA stationReference
    id: str
    name: str
    river: str
    latitude: float
    longitude: float


# Flood-prone gauges with a published stage scale (typical range, highest recent).
GAUGES = [
    EAGauge("2077", "ea-severn-shrewsbury", "Shrewsbury (Welsh Bridge)", "River Severn", 52.7098, -2.7581),
    EAGauge("2642", "ea-severn-worcester", "Worcester (Barbourne)", "River Severn", 52.2070, -2.2353),
    EAGauge("F2405", "ea-ouse-york", "York (Skelton)", "River Ouse", 53.9915, -1.1352),
    EAGauge("4009", "ea-trent-nottingham", "Nottingham (Colwick)", "River Trent", 52.9527, -1.0778),
    EAGauge("2165", "ea-severn-gloucester", "Gloucester", "River Severn", 51.8650, -2.2522),
    EAGauge("2087", "ea-severn-tewkesbury", "Tewkesbury (Mythe Bridge)", "River Severn", 52.0017, -2.1631),
    EAGauge("L2403", "ea-ouse-cawood", "Cawood", "River Ouse", 53.8337, -1.1285),
    EAGauge("4065", "ea-trent-torksey", "Torksey", "River Trent", 53.2935, -0.7510),
    EAGauge("3400TH", "ea-thames-kingston", "Kingston upon Thames", "River Thames", 51.4150, -0.3089),
    EAGauge("2200TH", "ea-thames-reading", "Reading", "River Thames", 51.4613, -0.9679),
]


class SourceUnavailable(RuntimeError):
    pass


def _get(path: str, params: dict | None = None) -> dict:
    try:
        resp = httpx.get(f"{get_settings().ea_base_url}{path}", params=params, timeout=45)
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SourceUnavailable(f"Environment Agency request failed: {exc}") from exc


def _value(obj) -> float | None:
    if isinstance(obj, dict):
        obj = obj.get("value")
    try:
        return float(obj)
    except (TypeError, ValueError):
        return None


def gauge_thresholds(gauge: EAGauge) -> tuple[dict, str]:
    """Alert levels from the gauge's published stage scale: Watch at the top of the
    typical range, Act now at the highest recent level, Prepare halfway between."""
    item = _get(f"/id/stations/{gauge.reference}", {"_view": "full"}).get("items", {})
    if isinstance(item, list):
        item = item[0] if item else {}
    scale = item.get("stageScale") if isinstance(item.get("stageScale"), dict) else {}
    typical_high = _value(scale.get("typicalRangeHigh"))
    highest = _value(scale.get("highestRecent")) or _value(scale.get("maxOnRecord"))
    if typical_high is None or highest is None or highest <= typical_high:
        raise SourceUnavailable(f"No usable stage scale published for EA station {gauge.reference}.")
    warning = round((typical_high + highest) / 2, 2)
    thresholds = {
        "advisory_level_m": round(typical_high, 2),
        "warning_level_m": warning,
        "critical_level_m": round(highest, 2),
        "rise_rate_advisory_m_per_h": 0.15,
    }
    source = (
        f"Derived from the Environment Agency stage scale for station {gauge.reference}: Watch = top of typical "
        f"range ({typical_high:.2f} m), Act now = highest recent level ({highest:.2f} m), Prepare = midpoint. "
        "Project settings, not EA flood warnings."
    )
    return thresholds, source


def fetch_levels(gauge: EAGauge, since: datetime) -> pd.DataFrame:
    data = _get(
        f"/id/stations/{gauge.reference}/readings",
        {"_sorted": "", "since": since.strftime("%Y-%m-%dT%H:%M:%SZ"), "_limit": 10000, "parameter": "level"},
    )
    rows = [
        {"observed_at": r["dateTime"], "water_level_m": _value(r.get("value"))}
        for r in data.get("items", [])
        # Only the gauge's own stage measure (some stations also report downstream stage).
        if "-level-stage-" in str(r.get("measure", "")) and "downstage" not in str(r.get("measure", ""))
    ]
    frame = pd.DataFrame(rows, columns=["observed_at", "water_level_m"])
    frame["observed_at"] = pd.to_datetime(frame["observed_at"], utc=True)
    return frame.dropna().drop_duplicates("observed_at")


def fetch_observations(gauge: EAGauge, since: datetime) -> pd.DataFrame:
    """Long-format observations (observed_at, station_id, water_level_m, rainfall_mm)."""
    levels = fetch_levels(gauge, since)
    past_days = max(1, min(92, (datetime.now(timezone.utc) - since).days + 1))
    try:
        rain = open_meteo.fetch_rain_history(gauge.latitude, gauge.longitude, past_days)
        rain = rain[rain["observed_at"] >= since]
    except open_meteo.WeatherUnavailable:
        rain = pd.DataFrame(columns=["observed_at", "rainfall_mm"])
    frame = pd.concat([levels, rain], ignore_index=True)
    frame["station_id"] = gauge.id
    for col in ("water_level_m", "rainfall_mm"):
        if col not in frame:
            frame[col] = float("nan")
    return frame[["observed_at", "station_id", "water_level_m", "rainfall_mm"]].sort_values("observed_at")


def default_since() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=30)


def metadata(gauge: EAGauge) -> StationMetadata:
    return StationMetadata(gauge.id, gauge.name, gauge.latitude, gauge.longitude, gauge.river, "Europe/London")
