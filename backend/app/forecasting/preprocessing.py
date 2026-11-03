"""Validation, cleaning and resampling for river-level and rainfall series."""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

# Physically plausible bounds used only to reject corrupt values.
LEVEL_BOUNDS_M = (-20.0, 200.0)
RAIN_BOUNDS_MM_PER_H = (0.0, 400.0)
MAX_INTERPOLATION_GAP_H = 3
HAMPEL_WINDOW_H = 7
HAMPEL_SIGMAS = 6.0
FUTURE_TOLERANCE_MIN = 10  # observations cannot be from the future

COLUMN_ALIASES = {
    "timestamp": ["timestamp", "time", "datetime", "date_time", "observed_at", "date"],
    "station_id": ["station_id", "station", "site", "site_id", "gauge_id"],
    "water_level_m": ["water_level_m", "water_level", "level_m", "level", "stage_m", "stage", "wl"],
    "rainfall_mm": ["rainfall_mm", "rainfall", "rain_mm", "rain", "precipitation_mm", "precipitation", "precip"],
}


@dataclass
class ValidationReport:
    rows_received: int = 0
    rows_valid: int = 0
    rows_rejected: int = 0
    duplicates_removed: int = 0
    issues: dict[str, int] = field(default_factory=dict)
    examples: list[dict] = field(default_factory=list)
    columns_detected: dict[str, str | None] = field(default_factory=dict)
    stations: list[str] = field(default_factory=list)
    period_start: str | None = None
    period_end: str | None = None
    errors: list[str] = field(default_factory=list)

    def add_issue(self, kind: str, rows: pd.Index, raw: pd.DataFrame, limit: int = 3) -> None:
        if len(rows) == 0:
            return
        self.issues[kind] = self.issues.get(kind, 0) + len(rows)
        for idx in list(rows[:limit]):
            self.examples.append(
                {"row": int(idx) + 2, "issue": kind, "values": {k: _jsonable(v) for k, v in raw.loc[idx].items()}}
            )

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def _jsonable(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return v if isinstance(v, (int, float, str, bool)) else str(v)


def detect_columns(columns: list[str]) -> dict[str, str | None]:
    lowered = {c.strip().lower(): c for c in columns}
    return {
        canonical: next((lowered[a] for a in aliases if a in lowered), None)
        for canonical, aliases in COLUMN_ALIASES.items()
    }


def validate_observations(
    raw: pd.DataFrame, source_timezone: str = "UTC", default_station_id: str | None = None
) -> tuple[pd.DataFrame, ValidationReport]:
    """Turn an arbitrary tabular upload into clean long-format observations.

    Returns columns observed_at (UTC), station_id, water_level_m, rainfall_mm.
    Every rejected row is counted by reason so the import is auditable.
    """
    report = ValidationReport(rows_received=len(raw))
    cols = detect_columns(list(raw.columns))
    report.columns_detected = cols

    if cols["timestamp"] is None:
        report.errors.append("No timestamp column found (expected one of: timestamp, time, datetime, observed_at).")
    if cols["water_level_m"] is None and cols["rainfall_mm"] is None:
        report.errors.append("Need at least one of water_level_m or rainfall_mm.")
    if cols["station_id"] is None and not default_station_id:
        report.errors.append("No station_id column found; choose a target station for this file.")
    if report.errors:
        report.rows_rejected = len(raw)
        return _empty_frame(), report

    raw = raw.reset_index(drop=True)
    df = pd.DataFrame(index=raw.index)

    ts = pd.to_datetime(raw[cols["timestamp"]].astype(str).str.strip(), errors="coerce", utc=False, format="mixed")
    try:
        if ts.dt.tz is None:
            ts = ts.dt.tz_localize(source_timezone, ambiguous="NaT", nonexistent="NaT")
        df["observed_at"] = ts.dt.tz_convert("UTC")
    except (TypeError, AttributeError):
        # Mixed offsets in one column: honour explicit offsets, read naive values as UTC.
        df["observed_at"] = pd.to_datetime(raw[cols["timestamp"]], errors="coerce", utc=True, format="mixed")
        report.issues["mixed_timezone_offsets"] = 1

    if cols["station_id"]:
        df["station_id"] = raw[cols["station_id"]].astype(str).str.strip().replace({"": None, "nan": None})
        if default_station_id:
            df["station_id"] = df["station_id"].fillna(default_station_id)
    else:
        df["station_id"] = default_station_id

    for canonical in ("water_level_m", "rainfall_mm"):
        df[canonical] = pd.to_numeric(raw[cols[canonical]], errors="coerce") if cols[canonical] else np.nan
        if cols[canonical]:
            non_numeric = raw.index[raw[cols[canonical]].notna() & df[canonical].isna()]
            report.add_issue(f"non_numeric_{canonical}", non_numeric, raw)

    future = df.index[df["observed_at"] > pd.Timestamp.now(tz="UTC") + pd.Timedelta(minutes=FUTURE_TOLERANCE_MIN)]
    report.add_issue("future_timestamp", future, raw)
    df.loc[future, "observed_at"] = pd.NaT
    bad_ts = df.index[df["observed_at"].isna()].difference(future)
    report.add_issue("invalid_timestamp", bad_ts, raw)
    missing_station = df.index[df["station_id"].isna()]
    report.add_issue("missing_station_id", missing_station, raw)

    lo, hi = LEVEL_BOUNDS_M
    out_level = df.index[df["water_level_m"].notna() & ~df["water_level_m"].between(lo, hi)]
    report.add_issue("water_level_out_of_bounds", out_level, raw)
    df.loc[out_level, "water_level_m"] = np.nan

    lo, hi = RAIN_BOUNDS_MM_PER_H
    out_rain = df.index[df["rainfall_mm"].notna() & ~df["rainfall_mm"].between(lo, hi)]
    report.add_issue("rainfall_out_of_bounds", out_rain, raw)
    df.loc[out_rain, "rainfall_mm"] = np.nan

    no_values = df.index[df["water_level_m"].isna() & df["rainfall_mm"].isna()]
    report.add_issue("no_usable_values", no_values.difference(bad_ts).difference(future), raw)

    keep = df["observed_at"].notna() & df["station_id"].notna() & (df["water_level_m"].notna() | df["rainfall_mm"].notna())
    clean = df[keep].copy()

    before = len(clean)
    clean = clean.sort_values("observed_at").drop_duplicates(["station_id", "observed_at"], keep="last")
    report.duplicates_removed = before - len(clean)
    if report.duplicates_removed:
        report.issues["duplicate_timestamp"] = report.duplicates_removed

    report.rows_valid = len(clean)
    report.rows_rejected = report.rows_received - report.rows_valid
    report.stations = sorted(clean["station_id"].unique().tolist())
    if len(clean):
        report.period_start = clean["observed_at"].min().isoformat()
        report.period_end = clean["observed_at"].max().isoformat()
    return clean.reset_index(drop=True), report


def _empty_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "observed_at": pd.Series(dtype="datetime64[ns, UTC]"),
            "station_id": pd.Series(dtype=str),
            "water_level_m": pd.Series(dtype=float),
            "rainfall_mm": pd.Series(dtype=float),
        }
    )


@dataclass
class ResampleSummary:
    hours: int
    level_missing_before: int
    level_interpolated: int
    level_missing_after: int
    spikes_removed: int
    rainfall_missing_filled_zero: int

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def remove_spikes(level: pd.Series, window: int = HAMPEL_WINDOW_H, n_sigmas: float = HAMPEL_SIGMAS) -> tuple[pd.Series, int]:
    """Hampel filter: drop isolated readings far from the rolling median. The high
    threshold is deliberate — genuine flood rises must survive."""
    med = level.rolling(window, center=True, min_periods=3).median()
    mad = (level - med).abs().rolling(window, center=True, min_periods=3).median()
    scale = 1.4826 * mad.clip(lower=0.02)
    spikes = (level - med).abs() > n_sigmas * scale
    cleaned = level.mask(spikes)
    return cleaned, int(spikes.sum())


def resample_hourly(obs: pd.DataFrame) -> tuple[pd.DataFrame, ResampleSummary]:
    """One station's observations → regular hourly grid indexed by UTC time.

    Water level: hourly mean, despiked, short gaps (≤3 h) linearly interpolated.
    Rainfall: hourly total; hours with no rainfall record are treated as 0 mm
    for model features, and that count is reported.
    """
    s = obs.set_index("observed_at").sort_index()
    level = s["water_level_m"].resample("h").mean()
    rain = s["rainfall_mm"].resample("h").sum(min_count=1)
    level, spikes = remove_spikes(level)
    missing_before = int(level.isna().sum())
    # pandas' `limit` would partially fill long gaps; only fill gaps that are short in total.
    is_gap = level.isna()
    gap_id = (~is_gap).cumsum()
    gap_len = is_gap.groupby(gap_id).transform("sum")
    level_filled = level.interpolate(method="time", limit_area="inside").where(~is_gap | (gap_len <= MAX_INTERPOLATION_GAP_H))
    missing_after = int(level_filled.isna().sum())
    rain_missing = int(rain.isna().sum())
    out = pd.DataFrame({"water_level_m": level_filled, "rainfall_mm": rain.fillna(0.0)})
    return out, ResampleSummary(
        hours=len(out),
        level_missing_before=missing_before,
        level_interpolated=missing_before - missing_after,
        level_missing_after=missing_after,
        spikes_removed=spikes,
        rainfall_missing_filled_zero=rain_missing,
    )
