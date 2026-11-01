import numpy as np
import pandas as pd
import pytest

from app.forecasting.models import DampedTrendModel, PersistenceModel, build_features
from app.forecasting.pipeline import (
    HEADLINE_HORIZONS,
    InsufficientDataError,
    _conformal_quantile,
    forecast_station,
)
from app.forecasting.preprocessing import remove_spikes, resample_hourly, validate_observations
from app.providers.simulated import generate


def hourly_frame(level, rain=None, start="2026-01-01"):
    idx = pd.date_range(start, periods=len(level), freq="h", tz="UTC")
    return pd.DataFrame({"water_level_m": level, "rainfall_mm": rain if rain is not None else np.zeros(len(level))}, index=idx)


@pytest.fixture(scope="module")
def sim_station():
    df, _ = generate(end=pd.Timestamp("2026-06-01", tz="UTC").to_pydatetime(), days=60)
    obs = df[df.station_id == "sim-urban"]
    hourly, _ = resample_hourly(obs)
    return hourly


@pytest.fixture(scope="module")
def sim_result(sim_station):
    return forecast_station(sim_station)


# ------------------------------------------------------------- preprocessing


def test_validation_rejects_and_counts_bad_rows():
    raw = pd.DataFrame(
        {
            "Timestamp": ["2026-01-01 00:00", "garbage", "2026-01-01 02:00", "2026-01-01 03:00", "2026-01-01 03:00", "2026-01-01 04:00"],
            "station": ["a", "a", "a", "a", "a", None],
            "Level": ["1.0", "1.1", "abc", "500", "1.3", "1.4"],
            "rain": ["0", "0", "", "2", "2", "1"],
        }
    )
    clean, report = validate_observations(raw, source_timezone="UTC")
    assert report.columns_detected["water_level_m"] == "Level"
    assert report.issues["invalid_timestamp"] == 1
    assert report.issues["missing_station_id"] == 1
    assert report.issues["water_level_out_of_bounds"] == 1
    assert report.issues["non_numeric_water_level_m"] == 1
    assert report.issues["no_usable_values"] == 1  # row 2: bad level and empty rain
    assert report.duplicates_removed == 1
    assert len(clean) == 2
    # Duplicate keeps the last value; the out-of-bounds level is nulled, rain kept.
    assert clean.iloc[-1]["water_level_m"] == 1.3


def test_validation_converts_local_time_to_utc():
    raw = pd.DataFrame({"timestamp": ["2026-03-01 08:00"], "station_id": ["s"], "water_level_m": ["2"]})
    clean, _ = validate_observations(raw, source_timezone="Asia/Manila")
    assert clean.iloc[0]["observed_at"] == pd.Timestamp("2026-03-01 00:00", tz="UTC")


def test_validation_rejects_future_timestamps():
    future = (pd.Timestamp.now(tz="UTC") + pd.Timedelta(days=2)).isoformat()
    raw = pd.DataFrame({"timestamp": [future, "2026-01-01T00:00:00Z"], "station_id": ["s", "s"], "water_level_m": ["1", "1"]})
    clean, report = validate_observations(raw)
    assert report.issues["future_timestamp"] == 1
    assert "invalid_timestamp" not in report.issues
    assert len(clean) == 1


def test_validation_reports_missing_columns():
    _, report = validate_observations(pd.DataFrame({"foo": [1]}))
    assert report.errors and report.rows_rejected == 1


def test_resample_interpolates_only_short_gaps():
    idx = pd.date_range("2026-01-01", periods=20, freq="h", tz="UTC")
    level = np.linspace(1, 2, 20)
    level[3:5] = np.nan  # 2-hour gap: filled
    level[10:15] = np.nan  # 5-hour gap: left missing
    obs = pd.DataFrame({"observed_at": idx, "water_level_m": level, "rainfall_mm": np.nan})
    hourly, summary = resample_hourly(obs)
    assert hourly["water_level_m"].iloc[3:5].notna().all()
    assert hourly["water_level_m"].iloc[10:15].isna().all()
    assert summary.level_interpolated == 2
    assert summary.rainfall_missing_filled_zero == 20


def test_resample_aggregates_subhourly_readings():
    idx = pd.date_range("2026-01-01", periods=8, freq="15min", tz="UTC")
    obs = pd.DataFrame({"observed_at": idx, "water_level_m": [1, 1, 1, 1, 2, 2, 2, 2.0], "rainfall_mm": [1.0] * 8})
    hourly, _ = resample_hourly(obs)
    assert list(hourly["water_level_m"]) == [1.0, 2.0]
    assert list(hourly["rainfall_mm"]) == [4.0, 4.0]  # rainfall is summed


def test_spike_filter_removes_isolated_spike_but_keeps_flood_rise():
    level = pd.Series(np.r_[np.full(30, 1.0), np.linspace(1.0, 4.0, 12), np.full(30, 4.0)])
    level.iloc[10] = 6.0
    cleaned, n = remove_spikes(level)
    assert n == 1 and np.isnan(cleaned.iloc[10])
    assert cleaned.iloc[30:42].notna().all()


# ------------------------------------------------------------- models


def test_features_use_only_past_data():
    level = np.arange(100, dtype=float)
    f = build_features(hourly_frame(level))
    # Changing a future value must not change features at earlier origins.
    level2 = level.copy()
    level2[80:] += 50
    f2 = build_features(hourly_frame(level2))
    pd.testing.assert_frame_equal(f.iloc[:80], f2.iloc[:80])


def test_persistence_and_damped_trend():
    level = np.linspace(0, 10, 50)  # slope 10/49 m/h
    f = build_features(hourly_frame(level))
    assert np.allclose(PersistenceModel().fit(f, None, 3).predict(f), level)
    trend = DampedTrendModel().fit(f, None, 3)
    slope = 10 / 49
    expected = level[-1] + slope * (0.85 + 0.85**2 + 0.85**3)
    assert trend.predict(f)[-1] == pytest.approx(expected, rel=1e-6)


def test_conformal_quantile_is_conservative():
    r = np.arange(1, 101, dtype=float)
    assert _conformal_quantile(r, 0.9) >= np.quantile(r, 0.9)
    assert _conformal_quantile(r, 0.1) <= np.quantile(r, 0.1)


# ------------------------------------------------------------- pipeline


def test_pipeline_outputs_all_headline_horizons(sim_result):
    hs = {h["horizon_h"] for h in sim_result["horizons"]}
    assert set(HEADLINE_HORIZONS) <= hs
    for h in sim_result["horizons"]:
        assert h["lo95_m"] <= h["lo80_m"] <= h["point_m"] <= h["hi80_m"] <= h["hi95_m"]
        for m in h["test_metrics"].values():
            assert m["rmse"] >= m["mae"] >= 0 and m["n"] > 0


def test_split_is_chronological(sim_result):
    s = sim_result["split"]
    assert s["train_start"] < s["calibration_start"] < s["test_start"] < s["test_end"]


def test_model_selected_on_calibration_not_test(sim_result):
    for h in sim_result["horizons"]:
        cal = h["calibration_rmse"]
        assert h["selected_model"] == min(cal, key=cal.get)


def test_ml_beats_persistence_on_short_horizons(sim_result):
    """On a rainfall-driven catchment the ML model should have real skill at 1–3 h."""
    for h in sim_result["horizons"]:
        if h["horizon_h"] <= 3:
            m = h["test_metrics"]
            assert m["gradient_boosting"]["rmse"] < m["persistence"]["rmse"]


def test_interval_coverage_is_near_nominal(sim_result):
    for h in sim_result["horizons"]:
        assert 0.6 <= h["interval_coverage_test"]["p80"] <= 0.97
        assert 0.8 <= h["interval_coverage_test"]["p95"] <= 1.0


def test_backtest_series_align_with_actuals(sim_station, sim_result):
    bt = sim_result["backtests"]["1"]
    point = bt[len(bt) // 2]
    actual = sim_station["water_level_m"].loc[pd.Timestamp(point["valid_at"])]
    assert point["actual_m"] == pytest.approx(actual, abs=1e-3)


def test_pipeline_is_deterministic(sim_station, sim_result):
    again = forecast_station(sim_station)
    assert [h["point_m"] for h in again["horizons"]] == [h["point_m"] for h in sim_result["horizons"]]


def test_insufficient_data_raises():
    with pytest.raises(InsufficientDataError):
        forecast_station(hourly_frame(np.ones(48)))


def test_short_series_uses_baselines_only():
    rng = np.random.default_rng(0)
    level = 2 + np.cumsum(rng.normal(0, 0.01, 24 * 10))
    result = forecast_station(hourly_frame(level))
    assert result["ml_available"] is False
    assert all(h["selected_model"] != "gradient_boosting" for h in result["horizons"])
