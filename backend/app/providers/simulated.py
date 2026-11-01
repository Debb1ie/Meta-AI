"""Deterministic SIMULATED demo scenario.

Nothing produced here is an observation. Rainfall is a stochastic storm process;
river stage comes from a linear-reservoir rainfall-runoff model (gamma unit
hydrograph) passed through a power-law rating curve, plus sensor noise. Station
coordinates sit in the Marikina basin so Open-Meteo returns real weather for a
real place, but the stations and their readings are fictional.
"""

from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from .base import StationMetadata

SCENARIO_NAME = "Simulated demo scenario — Marikina basin geography (v1)"
SCENARIO_SEED = 20261104


@dataclass(frozen=True)
class SimStation:
    id: str
    name: str
    latitude: float
    longitude: float
    lag_hours: float  # time to peak of the unit hydrograph
    shape: float  # gamma shape — larger is more peaked/delayed
    catchment_gain: float
    base_stage_m: float
    rating_exponent: float
    rain_scale: float  # local rainfall relative to basin average


SIM_STATIONS: tuple[SimStation, ...] = (
    SimStation("sim-upper", "Upper Basin (Demo)", 14.7330, 121.1520, 3.0, 2.5, 0.050, 1.10, 0.55, 1.15),
    SimStation("sim-east", "Eastern Tributary (Demo)", 14.6900, 121.1780, 4.0, 3.0, 0.040, 0.90, 0.55, 1.05),
    SimStation("sim-mid", "Mid-River Reach (Demo)", 14.6610, 121.1150, 6.0, 3.5, 0.080, 2.40, 0.60, 1.00),
    SimStation("sim-urban", "Urban Confluence (Demo)", 14.6330, 121.0960, 8.0, 4.0, 0.110, 3.20, 0.62, 0.95),
    SimStation("sim-lower", "Lower Floodplain (Demo)", 14.5850, 121.0830, 11.0, 4.5, 0.140, 2.80, 0.65, 0.90),
)


def _storm_series(n_hours: int, rng: np.random.Generator) -> np.ndarray:
    """Basin-average hourly rainfall (mm) from Poisson storm arrivals."""
    rain = np.zeros(n_hours)
    t = 0
    while t < n_hours:
        t += int(rng.exponential(96))  # a storm every ~4 days on average
        if t >= n_hours:
            break
        duration = int(rng.integers(4, 30))
        peak = rng.gamma(2.0, 4.0)  # mm/h
        profile = np.sin(np.linspace(0, np.pi, duration)) ** 1.5
        seg = peak * profile * rng.lognormal(0, 0.35, duration)
        end = min(t + duration, n_hours)
        rain[t:end] += seg[: end - t]
    # Light drizzle on some hours.
    drizzle = (rng.random(n_hours) < 0.04) * rng.exponential(0.6, n_hours)
    return rain + drizzle


def _scripted_recent_storm(n_hours: int) -> np.ndarray:
    """A strong storm still in progress at the end of the record, so the demo ends
    mid-event: upstream stations near peak, downstream stations still rising."""
    rain = np.zeros(n_hours)
    duration = 14
    start = n_hours - 13
    profile = np.sin(np.linspace(0, np.pi, duration)) ** 1.2
    seg = 15.0 * profile
    rain[start:] = seg[: n_hours - start]
    return rain


def _unit_hydrograph(lag: float, shape: float, length: int = 96) -> np.ndarray:
    t = np.arange(length, dtype=float)
    scale = lag / max(shape - 1, 0.5)
    uh = np.where(t > 0, t ** (shape - 1) * np.exp(-t / scale), 0.0)
    return uh / uh.sum()


def generate(end: datetime | None = None, days: int = 120) -> tuple[pd.DataFrame, list[SimStation]]:
    """Return a long-format frame: observed_at (UTC), station_id, water_level_m, rainfall_mm."""
    rng = np.random.default_rng(SCENARIO_SEED)
    end = (end or datetime.now(timezone.utc)).astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    n = days * 24
    index = pd.date_range(end=end, periods=n, freq="h", tz="UTC")

    basin_rain = _storm_series(n, rng) + _scripted_recent_storm(n)
    frames = []
    for st in SIM_STATIONS:
        local = np.clip(basin_rain * st.rain_scale * rng.lognormal(0, 0.15, n), 0, None)
        uh = _unit_hydrograph(st.lag_hours, st.shape)
        runoff = np.convolve(local, uh)[:n]
        # Slow seasonal baseflow drift.
        baseflow = 1.0 + 0.25 * np.sin(np.linspace(0, 2 * np.pi * days / 90, n))
        discharge = baseflow + st.catchment_gain * 60 * runoff
        stage = st.base_stage_m + 0.38 * (discharge**st.rating_exponent - 1)
        stage = stage + rng.normal(0, 0.012, n)  # sensor noise ~1 cm
        frames.append(
            pd.DataFrame(
                {
                    "observed_at": index,
                    "station_id": st.id,
                    "water_level_m": np.round(stage, 3),
                    "rainfall_mm": np.round(local, 2),
                }
            )
        )
    df = pd.concat(frames, ignore_index=True)

    # Realistic data gaps: a few dropped readings so cleaning has work to do.
    drop = rng.random(len(df)) < 0.004
    df.loc[drop, "water_level_m"] = np.nan
    return df, list(SIM_STATIONS)


def demo_thresholds(levels: pd.Series) -> dict[str, float]:
    """Demo alert levels from the simulated stage distribution. Clearly labelled
    as demo settings — they are not official thresholds."""
    clean = levels.dropna()
    return {
        "advisory_level_m": round(float(clean.quantile(0.93)), 2),
        "warning_level_m": round(float(clean.quantile(0.985)), 2),
        "critical_level_m": round(float(clean.quantile(0.997)), 2),
    }



class SimulatedProvider:
    """RiverLevelProvider for the demo scenario."""

    name = SCENARIO_NAME
    is_simulated = True

    def __init__(self, end: datetime | None = None, days: int = 120):
        self._frame, self._stations = generate(end, days)

    def stations(self) -> list[StationMetadata]:
        return [
            StationMetadata(s.id, s.name, s.latitude, s.longitude, river="Demo river network", timezone="Asia/Manila")
            for s in self._stations
        ]

    def observations(self) -> pd.DataFrame:
        return self._frame.copy()
