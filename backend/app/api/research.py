"""Research endpoint: the live evaluation of the forecasting engine and the exact parameters
the code runs with, read from the modules themselves so the published methodology cannot
drift from the implementation."""

import statistics

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..ai import agent
from ..db import get_session
from ..forecasting import models, pipeline, preprocessing
from ..providers import glofas, hazards
from .. import risk
from ..config import get_settings
from sqlalchemy import select

from ..db import Station
from ..services import cached_forecast, refresh_forecast_async, station_summary

router = APIRouter(prefix="/api", tags=["research"])


def _parameters() -> dict:
    return {
        "glofas": {
            "source": glofas.SOURCE,
            "grid_deg": 0.05,
            "basins": len(glofas.RIVERS),
            "history_days": glofas.HISTORY_DAYS,
            "forecast_days": glofas.FORECAST_DAYS,
            "climatology_years": glofas.CLIMATOLOGY_YEARS,
            "alert_percentiles": glofas.PERCENTILES,
            "outlook_window_days": glofas.OUTLOOK_DAYS,
            "trend_window_days": glofas.TREND_LOOKBACK_DAYS,
            "trend_threshold_pct": round(glofas.TREND_THRESHOLD * 100),
            "cache_hours": round(get_settings().glofas_cache_seconds / 3600, 2),
        },
        "preprocessing": {
            "level_bounds_m": preprocessing.LEVEL_BOUNDS_M,
            "rain_bounds_mm_per_h": preprocessing.RAIN_BOUNDS_MM_PER_H,
            "max_interpolation_gap_h": preprocessing.MAX_INTERPOLATION_GAP_H,
            "hampel_window_h": preprocessing.HAMPEL_WINDOW_H,
            "hampel_sigmas": preprocessing.HAMPEL_SIGMAS,
            "future_tolerance_min": preprocessing.FUTURE_TOLERANCE_MIN,
        },
        "forecasting": {
            "horizons_h": pipeline.HORIZONS,
            "headline_horizons_h": pipeline.HEADLINE_HORIZONS,
            "split": {"train": pipeline.TRAIN_FRACTION, "calibration": pipeline.CALIB_FRACTION, "test": round(1 - pipeline.TRAIN_FRACTION - pipeline.CALIB_FRACTION, 2)},
            "min_hours_for_evaluation": pipeline.MIN_HOURS_FOR_EVALUATION,
            "min_hours_for_ml": pipeline.MIN_HOURS_FOR_ML,
            "min_regime_samples": pipeline.MIN_REGIME_SAMPLES,
            "backtest_days": pipeline.BACKTEST_DAYS,
            "level_lags_h": models.LEVEL_LAGS,
            "rain_windows_h": models.RAIN_WINDOWS,
            "trend_window_h": models.TREND_WINDOW_H,
            "trend_damping": models.TREND_DAMPING,
            "gbm": models.GBM_PARAMS,
            "regime_rule": "active if rain over 24 h > 5 mm or |3 h level change| > 0.05 m, else calm",
        },
        "risk": {"levels": risk.LEVELS, "near_term_h": risk.NEAR_TERM_H, "stale_data_h": 3},
        "hazards": {"ph_centre": hazards.PH_CENTER, "near_km": hazards.NEAR_KM, "affects_km": hazards.AFFECTS_KM, "cache_minutes": hazards.CACHE_SECONDS // 60},
        "agent": {
            "max_steps": agent.MAX_STEPS,
            "tools": [t["function"]["name"] for t in agent.TOOLS],
            "languages": list(agent.LANGUAGES.values()),
            "number_tolerance": "max(0.051, 2% of the cited value)",
        },
    }


@router.get("/research")
def research(session: Session = Depends(get_session)) -> dict:
    # Use finished forecasts only, so this page answers instantly even right after a
    # restart; stations still training are started in the background and counted.
    reports, warming = [], 0
    for station in session.scalars(select(Station).order_by(Station.id)):
        fc = cached_forecast(station.id)
        if fc is None:
            warming += 1
            refresh_forecast_async(station.id)
            continue
        reports.append({"station": station_summary(station), "forecast": fc})
    gauges, by_horizon = [], {}
    for rep in reports:
        fc = rep["forecast"]
        if fc.get("status") != "ok":
            continue
        rows = []
        for h in fc.get("horizons", []):
            sel = h["selected_model"]
            metrics = h["test_metrics"].get(sel, {})
            row = {
                "horizon_h": h["horizon_h"],
                "model": sel,
                "skill": h["skill_vs_persistence"].get(sel),
                "rmse_m": metrics.get("rmse"),
                "mae_m": metrics.get("mae"),
                "n_test": metrics.get("n"),
                "coverage80": h["interval_coverage_test"].get("p80"),
                "coverage95": h["interval_coverage_test"].get("p95"),
            }
            rows.append(row)
            by_horizon.setdefault(h["horizon_h"], []).append(row)
        gauges.append({
            "id": rep["station"]["id"],
            "name": rep["station"]["name"],
            "river": rep["station"]["river"],
            "ml_available": fc.get("ml_available"),
            "split": fc.get("split"),
            "preprocessing": fc.get("preprocessing"),
            "horizons": rows,
        })

    def mean(values):
        values = [v for v in values if v is not None]
        return round(statistics.fmean(values), 4) if values else None

    summary = [
        {
            "horizon_h": h,
            "gauges": len(rows),
            "mean_skill": mean([r["skill"] for r in rows]),
            "share_beating_persistence": round(sum(1 for r in rows if (r["skill"] or 0) > 0) / len(rows), 3) if rows else None,
            "mean_rmse_m": mean([r["rmse_m"] for r in rows]),
            "mean_coverage80": mean([r["coverage80"] for r in rows]),
            "mean_coverage95": mean([r["coverage95"] for r in rows]),
            "models_selected": {m: sum(1 for r in rows if r["model"] == m) for m in {r["model"] for r in rows}},
        }
        for h, rows in sorted(by_horizon.items())
    ]
    return {"parameters": _parameters(), "evaluation": {"summary": summary, "gauges": gauges, "warming": warming}}
