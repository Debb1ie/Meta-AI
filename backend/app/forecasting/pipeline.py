"""End-to-end forecasting for one station: features → chronological evaluation →
model selection → conformal intervals → live forecast.

Split (by forecast-origin time, never shuffled):
  train  first 70%   fit models
  calib  next 10%    choose the model per horizon and calibrate intervals
  test   last 20%    report MAE / RMSE / skill / interval coverage (never used to choose)
Rows whose target time crosses a split boundary are purged to prevent leakage.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .models import GradientBoostingModel, all_model_factories, build_features

HORIZONS = (1, 3, 6, 12, 24)
HEADLINE_HORIZONS = (1, 3, 6, 24)
TRAIN_FRACTION = 0.70
CALIB_FRACTION = 0.10
MIN_HOURS_FOR_EVALUATION = 24 * 5
MIN_HOURS_FOR_ML = 24 * 21
MIN_REGIME_SAMPLES = 30
BACKTEST_DAYS = 14


class InsufficientDataError(ValueError):
    pass


def _regime(features: pd.DataFrame) -> np.ndarray:
    """'active' when the catchment is wet or the river is moving. Errors are far
    larger in these periods, so intervals are calibrated separately (Mondrian
    conformal) rather than one width for all conditions."""
    active = (features["rain_24h"] > 5.0) | (features["d_level_3h"].abs() > 0.05)
    return np.where(active.to_numpy(), "active", "calm")


def _metrics(actual: np.ndarray, pred: np.ndarray) -> dict:
    err = pred - actual
    return {
        "mae": float(np.mean(np.abs(err))),
        "rmse": float(np.sqrt(np.mean(err**2))),
        "bias": float(np.mean(err)),
        "n": int(len(err)),
    }


def _conformal_quantile(residuals: np.ndarray, p: float) -> float:
    """Residual quantile with the split-conformal finite-sample correction,
    rounded outward so intervals err on the wide side."""
    n = len(residuals)
    if p >= 0.5:
        return float(np.quantile(residuals, min(1.0, np.ceil((n + 1) * p) / n), method="higher"))
    return float(np.quantile(residuals, max(0.0, 1 - np.ceil((n + 1) * (1 - p)) / n), method="lower"))


@dataclass
class IntervalCalibration:
    quantiles: dict  # regime -> {lo80, hi80, lo95, hi95} residual offsets (actual - pred)

    @classmethod
    def fit(cls, residuals: np.ndarray, regimes: np.ndarray) -> "IntervalCalibration":
        def q(r: np.ndarray) -> dict:
            return {
                "lo80": _conformal_quantile(r, 0.10),
                "hi80": _conformal_quantile(r, 0.90),
                "lo95": _conformal_quantile(r, 0.025),
                "hi95": _conformal_quantile(r, 0.975),
                "n": int(len(r)),
            }

        quantiles = {"all": q(residuals)}
        for name in ("calm", "active"):
            mask = regimes == name
            quantiles[name] = q(residuals[mask]) if mask.sum() >= MIN_REGIME_SAMPLES else quantiles["all"]
        return cls(quantiles)

    def offsets(self, regimes: np.ndarray) -> dict[str, np.ndarray]:
        return {k: np.array([self.quantiles[r][k] for r in regimes]) for k in ("lo80", "hi80", "lo95", "hi95")}


def forecast_station(hourly: pd.DataFrame, random_state: int = 0) -> dict:
    """Run the full pipeline on one station's hourly frame (water_level_m, rainfall_mm)."""
    if hourly["water_level_m"].notna().sum() < MIN_HOURS_FOR_EVALUATION:
        raise InsufficientDataError(
            f"Need at least {MIN_HOURS_FOR_EVALUATION} hourly water-level readings to evaluate forecasts; "
            f"have {int(hourly['water_level_m'].notna().sum())}."
        )

    features = build_features(hourly)
    required = ["level", "d_level_1h", "d_level_3h", "d_level_24h", "slope"]
    usable = features.dropna(subset=required)
    level = hourly["water_level_m"]
    origins = usable.index
    cut_train = origins[int(len(origins) * TRAIN_FRACTION)]
    cut_calib = origins[int(len(origins) * (TRAIN_FRACTION + CALIB_FRACTION))]
    ml_available = len(origins) >= MIN_HOURS_FOR_ML
    factories = [f for f in all_model_factories() if ml_available or f is not GradientBoostingModel]

    latest = features.dropna(subset=["level"]).iloc[[-1]]
    origin_time = latest.index[0]
    latest_regime = _regime(latest)

    horizons_out, backtests = [], {}
    for h in HORIZONS:
        target = level.shift(-h, freq="h").reindex(origins)
        data = usable.assign(_target=target.to_numpy()).dropna(subset=["_target"])
        valid_time = data.index + pd.Timedelta(hours=h)
        train = data[valid_time < cut_train]
        calib = data[(data.index >= cut_train) & (valid_time < cut_calib)]
        test = data[data.index >= cut_calib]
        if min(len(train), len(calib), len(test)) < 10:
            continue

        X = lambda d: d.drop(columns="_target")
        results = {}
        for factory in factories:
            model = factory(random_state=random_state) if factory is GradientBoostingModel else factory()
            model.fit(X(train), train["_target"], h)
            results[model.name] = {
                "model": model,
                "calib_pred": model.predict(X(calib)),
                "test_pred": model.predict(X(test)),
            }

        calib_rmse = {n: _metrics(calib["_target"].to_numpy(), r["calib_pred"])["rmse"] for n, r in results.items()}
        selected = min(calib_rmse, key=calib_rmse.get)
        chosen = results[selected]

        test_metrics = {n: _metrics(test["_target"].to_numpy(), r["test_pred"]) for n, r in results.items()}
        persistence_rmse = test_metrics["persistence"]["rmse"]
        skill = {
            n: (1 - m["rmse"] / persistence_rmse) if persistence_rmse > 0 else None for n, m in test_metrics.items()
        }

        calibration = IntervalCalibration.fit(
            calib["_target"].to_numpy() - chosen["calib_pred"], _regime(X(calib))
        )
        test_regimes = _regime(X(test))
        test_off = calibration.offsets(test_regimes)
        actual_test = test["_target"].to_numpy()
        coverage80 = float(np.mean((actual_test >= chosen["test_pred"] + test_off["lo80"]) & (actual_test <= chosen["test_pred"] + test_off["hi80"])))
        coverage95 = float(np.mean((actual_test >= chosen["test_pred"] + test_off["lo95"]) & (actual_test <= chosen["test_pred"] + test_off["hi95"])))

        point = float(chosen["model"].predict(latest)[0])
        off = calibration.offsets(latest_regime)
        horizons_out.append(
            {
                "horizon_h": h,
                "headline": h in HEADLINE_HORIZONS,
                "valid_at": (origin_time + pd.Timedelta(hours=h)).isoformat(),
                "selected_model": selected,
                "point_m": point,
                "lo80_m": point + float(off["lo80"][0]),
                "hi80_m": point + float(off["hi80"][0]),
                "lo95_m": point + float(off["lo95"][0]),
                "hi95_m": point + float(off["hi95"][0]),
                "interval_regime": str(latest_regime[0]),
                "test_metrics": test_metrics,
                "skill_vs_persistence": skill,
                "calibration_rmse": calib_rmse,
                "interval_coverage_test": {"p80": coverage80, "p95": coverage95},
                "interval_calibration": calibration.quantiles,
            }
        )

        if h in HEADLINE_HORIZONS:
            window = test.index >= test.index.max() - pd.Timedelta(days=BACKTEST_DAYS)
            vt = (test.index[window] + pd.Timedelta(hours=h))
            backtests[str(h)] = [
                {
                    "valid_at": t.isoformat(),
                    "actual_m": round(float(a), 3),
                    "predicted_m": round(float(p), 3),
                    "persistence_m": round(float(pp), 3),
                    "lo80_m": round(float(p + lo), 3),
                    "hi80_m": round(float(p + hi), 3),
                }
                for t, a, p, pp, lo, hi in zip(
                    vt,
                    actual_test[window],
                    chosen["test_pred"][window],
                    results["persistence"]["test_pred"][window],
                    test_off["lo80"][window],
                    test_off["hi80"][window],
                )
            ]

    if not horizons_out:
        raise InsufficientDataError("Not enough contiguous data to build train/calibration/test splits.")

    return {
        "origin": origin_time.isoformat(),
        "current_level_m": float(latest["level"].iloc[0]),
        "current_slope_m_per_h": float(latest["slope"].iloc[0]) if pd.notna(latest["slope"].iloc[0]) else None,
        "ml_available": ml_available,
        "models": [{"name": f.name, "label": f.label} for f in factories],
        "split": {
            "train_start": origins[0].isoformat(),
            "calibration_start": cut_train.isoformat(),
            "test_start": cut_calib.isoformat(),
            "test_end": origins[-1].isoformat(),
            "method": "Chronological 70/10/20 split by forecast origin with leakage purge",
        },
        "horizons": horizons_out,
        "backtests": backtests,
        "notes": [
            "Models are trained on the training window only; calibration data selects the model per horizon "
            "and sets prediction intervals; test metrics are out-of-sample.",
            "Prediction intervals are split-conformal residual quantiles, calibrated separately for calm and "
            "active (wet or rapidly changing) conditions. Test coverage shows how well they held up.",
            "Forecasts use observed rainfall up to the forecast origin only; future rainfall forecasts are "
            "shown as context but are not model inputs.",
        ]
        + ([] if ml_available else [f"ML model disabled: fewer than {MIN_HOURS_FOR_ML // 24} days of data."]),
    }
