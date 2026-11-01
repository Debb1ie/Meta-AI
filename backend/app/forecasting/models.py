"""Forecasters. Every model predicts the level at t+h from information available at t.

All models share one interface — fit(features, level, horizon) / predict(features) —
so the evaluation harness treats baselines and ML identically.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

LEVEL_LAGS = (1, 2, 3, 6, 12, 24)
RAIN_WINDOWS = (1, 3, 6, 12, 24, 48, 72)
TREND_WINDOW_H = 3
TREND_DAMPING = 0.85


def build_features(hourly: pd.DataFrame) -> pd.DataFrame:
    """Feature matrix indexed by forecast origin t. Uses only data at or before t."""
    level = hourly["water_level_m"]
    rain = hourly["rainfall_mm"]
    f = pd.DataFrame(index=hourly.index)
    f["level"] = level
    for lag in LEVEL_LAGS:
        f[f"d_level_{lag}h"] = level - level.shift(lag)
    for w in RAIN_WINDOWS:
        f[f"rain_{w}h"] = rain.rolling(w, min_periods=1).sum()
    # Rainfall that fell 6–24 h ago is still routing through the catchment.
    f["rain_lagged_6_24h"] = f["rain_24h"] - f["rain_6h"]
    # OLS slope over the trend window (m/h).
    x = np.arange(TREND_WINDOW_H + 1, dtype=float)
    x -= x.mean()
    stacked = np.column_stack([level.shift(TREND_WINDOW_H - i) for i in range(TREND_WINDOW_H + 1)])
    f["slope"] = stacked @ x / (x @ x)
    f["level_vs_7d_min"] = level - level.rolling(24 * 7, min_periods=24).min()
    return f


class PersistenceModel:
    """Baseline: the level stays where it is."""

    name = "persistence"
    label = "Persistence baseline"

    def fit(self, features: pd.DataFrame, target_level: pd.Series, horizon: int) -> "PersistenceModel":
        return self

    def predict(self, features: pd.DataFrame) -> np.ndarray:
        return features["level"].to_numpy()


class DampedTrendModel:
    """Baseline: extrapolate the recent slope with exponential damping, so a short
    rise does not run away linearly over 24 h."""

    name = "damped_trend"
    label = "Damped trend baseline"

    def fit(self, features: pd.DataFrame, target_level: pd.Series, horizon: int) -> "DampedTrendModel":
        self.horizon = horizon
        self.multiplier = sum(TREND_DAMPING**i for i in range(1, horizon + 1))
        return self

    def predict(self, features: pd.DataFrame) -> np.ndarray:
        slope = features["slope"].fillna(0.0).to_numpy()
        return features["level"].to_numpy() + slope * self.multiplier


class GradientBoostingModel:
    """Direct multi-horizon model: one gradient-boosted tree ensemble per horizon,
    trained on the level *change* so it generalises across stage ranges."""

    name = "gradient_boosting"
    label = "Gradient boosting (lagged level + rainfall)"

    def __init__(self, random_state: int = 0):
        self.random_state = random_state

    def fit(self, features: pd.DataFrame, target_level: pd.Series, horizon: int) -> "GradientBoostingModel":
        self.columns = list(features.columns)
        delta = target_level.to_numpy() - features["level"].to_numpy()
        self.model = HistGradientBoostingRegressor(
            max_iter=300,
            learning_rate=0.05,
            max_leaf_nodes=31,
            min_samples_leaf=20,
            l2_regularization=1.0,
            random_state=self.random_state,
        )
        self.model.fit(features[self.columns], delta)
        return self

    def predict(self, features: pd.DataFrame) -> np.ndarray:
        return features["level"].to_numpy() + self.model.predict(features[self.columns])


def all_model_factories():
    return [PersistenceModel, DampedTrendModel, GradientBoostingModel]
