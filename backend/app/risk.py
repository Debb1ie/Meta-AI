"""Flood-risk classification from station thresholds, observations and forecasts.

Rules (the highest triggered level wins; every trigger is recorded as evidence):
  1. Observed level at or above a threshold → that level.
  2. Forecast point within 6 h at or above a threshold → that level.
  3. Forecast point at 12–24 h at or above a threshold → one level lower
     (min Advisory), because longer horizons are less certain.
  4. Upper 80% bound within 6 h reaches the warning level → at least Advisory.
  5. Rate of rise at or above the station's configured rate → at least Advisory.
Horizons where the selected model shows no skill over persistence are flagged
as low confidence in the evidence. Thresholds are user-configured project
settings, never official warning levels.
"""

from dataclasses import dataclass, field

LEVELS = ("normal", "advisory", "warning", "critical")
LABELS = {"normal": "Normal", "advisory": "Advisory", "warning": "Warning", "critical": "Critical"}
NEAR_TERM_H = 6


@dataclass
class Thresholds:
    advisory_m: float
    warning_m: float
    critical_m: float
    rise_rate_m_per_h: float

    def validate(self) -> None:
        if not (self.advisory_m < self.warning_m < self.critical_m):
            raise ValueError("Thresholds must satisfy advisory < warning < critical.")
        if self.rise_rate_m_per_h <= 0:
            raise ValueError("Rise-rate threshold must be positive.")

    def tier_for(self, level_m: float) -> str:
        if level_m >= self.critical_m:
            return "critical"
        if level_m >= self.warning_m:
            return "warning"
        if level_m >= self.advisory_m:
            return "advisory"
        return "normal"

    def level_for(self, tier: str) -> float | None:
        return {"advisory": self.advisory_m, "warning": self.warning_m, "critical": self.critical_m}.get(tier)


@dataclass
class Evidence:
    kind: str  # observation | prediction | uncertainty | trend | rainfall | data_quality
    level: str
    statement: str
    value: float | None = None
    threshold: float | None = None
    horizon_h: int | None = None

    def as_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}


@dataclass
class RiskAssessment:
    level: str
    trend: str
    explanation: str
    evidence: list[Evidence] = field(default_factory=list)
    context: list[Evidence] = field(default_factory=list)
    peak_forecast_m: float | None = None
    peak_forecast_horizon_h: int | None = None

    def as_dict(self) -> dict:
        return {
            "level": self.level,
            "label": LABELS[self.level],
            "rank": LEVELS.index(self.level),
            "trend": self.trend,
            "explanation": self.explanation,
            "evidence": [e.as_dict() for e in self.evidence],
            "context": [e.as_dict() for e in self.context],
            "peak_forecast_m": self.peak_forecast_m,
            "peak_forecast_horizon_h": self.peak_forecast_horizon_h,
        }


def _demote(tier: str) -> str:
    return LEVELS[max(1, LEVELS.index(tier) - 1)]


def classify_trend(slope_m_per_h: float | None, steady_band: float = 0.02) -> str:
    if slope_m_per_h is None:
        return "unknown"
    if slope_m_per_h > steady_band:
        return "rising"
    if slope_m_per_h < -steady_band:
        return "falling"
    return "steady"


def assess(
    thresholds: Thresholds,
    current_level_m: float,
    slope_m_per_h: float | None,
    horizons: list[dict],
    rain_last_24h_mm: float | None = None,
    rain_next_24h_mm: float | None = None,
    data_age_hours: float | None = None,
    is_simulated: bool = False,
) -> RiskAssessment:
    """`horizons` items need horizon_h, point_m, hi80_m and optionally skill (vs persistence)."""
    evidence: list[Evidence] = []
    context: list[Evidence] = []

    observed_tier = thresholds.tier_for(current_level_m)
    if observed_tier != "normal":
        evidence.append(
            Evidence(
                "observation",
                observed_tier,
                f"Latest reading {current_level_m:.2f} m is at or above the {LABELS[observed_tier].lower()} "
                f"level ({thresholds.level_for(observed_tier):.2f} m).",
                current_level_m,
                thresholds.level_for(observed_tier),
            )
        )

    peak = max(horizons, key=lambda h: h["point_m"], default=None)
    for h in sorted(horizons, key=lambda x: x["horizon_h"]):
        tier = thresholds.tier_for(h["point_m"])
        low_skill = h.get("skill") is not None and h["skill"] <= 0
        suffix = " (low confidence: model shows no skill over persistence at this horizon)" if low_skill else ""
        if tier != "normal":
            effective = tier if h["horizon_h"] <= NEAR_TERM_H else _demote(tier)
            evidence.append(
                Evidence(
                    "prediction",
                    effective,
                    f"{h['horizon_h']} h forecast {h['point_m']:.2f} m reaches the {LABELS[tier].lower()} level "
                    f"({thresholds.level_for(tier):.2f} m){suffix}."
                    + ("" if effective == tier else f" Counted as {LABELS[effective]} because of the longer horizon."),
                    h["point_m"],
                    thresholds.level_for(tier),
                    h["horizon_h"],
                )
            )
        elif h["horizon_h"] <= NEAR_TERM_H and h["hi80_m"] >= thresholds.warning_m:
            evidence.append(
                Evidence(
                    "uncertainty",
                    "advisory",
                    f"Upper 80% bound of the {h['horizon_h']} h forecast ({h['hi80_m']:.2f} m) reaches the warning "
                    f"level ({thresholds.warning_m:.2f} m) although the central forecast does not.",
                    h["hi80_m"],
                    thresholds.warning_m,
                    h["horizon_h"],
                )
            )

    trend = classify_trend(slope_m_per_h)
    if slope_m_per_h is not None:
        if slope_m_per_h >= thresholds.rise_rate_m_per_h:
            evidence.append(
                Evidence(
                    "trend",
                    "advisory",
                    f"Water level rising {slope_m_per_h:.2f} m/h over the last 3 h, at or above the configured "
                    f"rate of {thresholds.rise_rate_m_per_h:.2f} m/h.",
                    slope_m_per_h,
                    thresholds.rise_rate_m_per_h,
                )
            )
        else:
            context.append(
                Evidence("trend", "normal", f"Water level {trend} ({slope_m_per_h:+.2f} m/h over the last 3 h).", slope_m_per_h)
            )

    if rain_last_24h_mm is not None:
        context.append(Evidence("rainfall", "normal", f"{rain_last_24h_mm:.1f} mm of rain recorded in the last 24 h.", rain_last_24h_mm))
    if rain_next_24h_mm is not None:
        context.append(
            Evidence(
                "rainfall",
                "normal",
                f"Open-Meteo forecasts {rain_next_24h_mm:.1f} mm over the next 24 h (context only; not a model input).",
                rain_next_24h_mm,
            )
        )
    if data_age_hours is not None and data_age_hours > 3 and not is_simulated:
        context.append(
            Evidence("data_quality", "normal", f"Latest reading is {data_age_hours:.1f} h old; forecasts start from that time.", data_age_hours)
        )
    if is_simulated:
        context.append(Evidence("data_quality", "normal", "Readings for this station are SIMULATED demo data."))

    level = max((e.level for e in evidence), key=LEVELS.index, default="normal")
    drivers = [e for e in evidence if e.level == level]
    if level == "normal":
        explanation = (
            f"Normal: the latest reading ({current_level_m:.2f} m) and all forecasts to 24 h stay below the "
            f"advisory level ({thresholds.advisory_m:.2f} m), and the rate of rise is below "
            f"{thresholds.rise_rate_m_per_h:.2f} m/h."
        )
    else:
        shown = drivers[:2]
        more = len(drivers) - len(shown)
        explanation = f"{LABELS[level]}: " + " ".join(e.statement for e in shown)
        if more:
            explanation += f" (+{more} further supporting item{'s' if more > 1 else ''} in the evidence list.)"

    return RiskAssessment(
        level=level,
        trend=trend,
        explanation=explanation,
        evidence=evidence,
        context=context,
        peak_forecast_m=peak["point_m"] if peak else None,
        peak_forecast_horizon_h=peak["horizon_h"] if peak else None,
    )
