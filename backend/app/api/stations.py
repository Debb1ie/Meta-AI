from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import Station, get_session
from ..risk import LEVELS, Thresholds
from ..services import full_station_report, station_summary, station_weather

router = APIRouter(prefix="/api", tags=["stations"])


def _get_station(session: Session, station_id: str) -> Station:
    station = session.get(Station, station_id)
    if station is None:
        raise HTTPException(404, f"Station '{station_id}' not found.")
    return station


def all_reports(session: Session) -> list[dict]:
    stations = session.scalars(select(Station).order_by(Station.id)).all()
    # Warm the weather cache concurrently; forecasts are cached per station.
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(station_weather, stations))
    return [full_station_report(session, s) for s in stations]


@router.get("/stations")
def list_stations(session: Session = Depends(get_session)) -> list[dict]:
    return [station_summary(s) for s in session.scalars(select(Station).order_by(Station.id))]


@router.get("/stations/{station_id}")
def get_station_report(station_id: str, session: Session = Depends(get_session)) -> dict:
    return full_station_report(session, _get_station(session, station_id))


class ThresholdUpdate(BaseModel):
    advisory_m: float
    warning_m: float
    critical_m: float
    rise_rate_m_per_h: float = Field(gt=0)
    source: str = Field(min_length=3, max_length=500)


@router.put("/stations/{station_id}/thresholds")
def update_thresholds(station_id: str, body: ThresholdUpdate, session: Session = Depends(get_session)) -> dict:
    station = _get_station(session, station_id)
    try:
        Thresholds(body.advisory_m, body.warning_m, body.critical_m, body.rise_rate_m_per_h).validate()
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    station.advisory_level_m = body.advisory_m
    station.warning_level_m = body.warning_m
    station.critical_level_m = body.critical_m
    station.rise_rate_advisory_m_per_h = body.rise_rate_m_per_h
    station.threshold_source = body.source
    session.commit()
    return station_summary(station)


@router.get("/overview")
def overview(session: Session = Depends(get_session)) -> dict:
    reports = all_reports(session)
    rows = []
    for r in reports:
        fc, risk, st = r["forecast"], r["risk"], r["station"]
        headline = {str(h["horizon_h"]): h for h in fc.get("horizons", []) if h["headline"]}
        rows.append(
            {
                "station": st,
                "status": fc.get("status"),
                "message": fc.get("message"),
                "current_level_m": fc.get("current_level_m"),
                "slope_m_per_h": fc.get("current_slope_m_per_h"),
                "rain_last_24h_mm": fc.get("rain_last_24h_mm"),
                "forecast": {
                    k: {"point_m": h["point_m"], "lo80_m": h["lo80_m"], "hi80_m": h["hi80_m"], "model": h["selected_model"]}
                    for k, h in headline.items()
                },
                "risk": risk,
                "freshness": r["freshness"],
                "weather_summary": (r["weather"] or {}).get("summary"),
                "sparkline": [p["water_level_m"] for p in fc.get("history", [])[-48:]],
            }
        )
    ranked = [row for row in rows if row["risk"]]
    highest = max(ranked, key=lambda row: (row["risk"]["rank"], row["current_level_m"] or 0), default=None)
    rising = [row for row in rows if row["risk"] and row["risk"]["trend"] == "rising"]
    counts = {lvl: sum(1 for row in ranked if row["risk"]["level"] == lvl) for lvl in LEVELS}
    weather_rows = [row["weather_summary"] for row in rows if row["weather_summary"]]
    return {
        "station_count": len(rows),
        "rising_count": len(rising),
        "risk_counts": counts,
        "highest_risk": {
            "station_id": highest["station"]["id"],
            "station_name": highest["station"]["name"],
            "level": highest["risk"]["level"],
            "label": highest["risk"]["label"],
            "explanation": highest["risk"]["explanation"],
        }
        if highest
        else None,
        "observed_rain_last_24h_max_mm": max((row["rain_last_24h_mm"] or 0 for row in rows), default=None),
        "forecast_rain_next_24h_max_mm": max((w["next_24h_mm"] for w in weather_rows), default=None),
        "weather_available": bool(weather_rows),
        "any_simulated": any(row["station"]["is_simulated"] for row in rows),
        "stations": rows,
    }
