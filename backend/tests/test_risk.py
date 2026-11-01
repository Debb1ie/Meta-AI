import pytest

from app.risk import Thresholds, assess, classify_trend

TH = Thresholds(advisory_m=3.0, warning_m=4.0, critical_m=5.0, rise_rate_m_per_h=0.2)


def h(horizon, point, hi80=None, skill=0.5):
    return {"horizon_h": horizon, "point_m": point, "hi80_m": hi80 if hi80 is not None else point + 0.1, "skill": skill}


def test_normal_when_everything_below_advisory():
    r = assess(TH, 2.0, 0.0, [h(1, 2.0), h(6, 2.1), h(24, 2.2)])
    assert r.level == "normal" and r.evidence == []
    assert "below the advisory level" in r.explanation


def test_observed_level_sets_risk():
    r = assess(TH, 4.2, 0.0, [h(1, 3.5)])
    assert r.level == "warning"
    assert r.evidence[0].kind == "observation"


def test_near_term_forecast_sets_full_level():
    r = assess(TH, 3.5, 0.1, [h(3, 5.1)])
    assert r.level == "critical"
    assert any(e.kind == "prediction" and e.horizon_h == 3 for e in r.evidence)


def test_long_horizon_forecast_is_demoted_one_level():
    r = assess(TH, 2.0, 0.0, [h(6, 2.5), h(24, 5.2)])
    assert r.level == "warning"
    r = assess(TH, 2.0, 0.0, [h(24, 3.2)])
    assert r.level == "advisory"  # never demoted below advisory


def test_upper_bound_triggers_advisory():
    r = assess(TH, 2.0, 0.0, [h(3, 2.8, hi80=4.1)])
    assert r.level == "advisory"
    assert r.evidence[0].kind == "uncertainty"


def test_upper_bound_beyond_near_term_is_ignored():
    r = assess(TH, 2.0, 0.0, [h(24, 2.8, hi80=4.5)])
    assert r.level == "normal"


def test_rate_of_rise_triggers_advisory():
    r = assess(TH, 2.0, 0.25, [h(1, 2.2)])
    assert r.level == "advisory"
    assert r.evidence[0].kind == "trend"


def test_highest_trigger_wins_and_all_evidence_kept():
    r = assess(TH, 3.2, 0.3, [h(1, 3.5), h(6, 4.3)])
    assert r.level == "warning"
    kinds = {e.kind for e in r.evidence}
    assert {"observation", "prediction", "trend"} <= kinds


def test_low_skill_horizon_flagged():
    r = assess(TH, 2.0, 0.0, [h(24, 4.5, skill=-0.1)])
    assert "low confidence" in r.evidence[0].statement


def test_simulated_flag_and_rain_context():
    r = assess(TH, 2.0, 0.0, [h(1, 2.0)], rain_last_24h_mm=12.0, rain_next_24h_mm=30.0, is_simulated=True)
    statements = " ".join(c.statement for c in r.context)
    assert "SIMULATED" in statements and "Open-Meteo" in statements


def test_thresholds_must_be_ordered():
    with pytest.raises(ValueError):
        Thresholds(4.0, 3.0, 5.0, 0.1).validate()


@pytest.mark.parametrize("slope,expected", [(0.1, "rising"), (-0.1, "falling"), (0.0, "steady"), (None, "unknown")])
def test_trend(slope, expected):
    assert classify_trend(slope) == expected
