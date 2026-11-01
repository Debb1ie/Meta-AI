import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .api import ai, data, stations
from .config import get_settings
from .db import SessionLocal, Station, init_db, utcnow
from .providers import glofas
from .services import _set_status, remove_simulated, seed_demo, station_forecast, sync_live_gauges

log = logging.getLogger("hydrosentinel")


def _warm_forecasts() -> None:
    """Train and evaluate every station's models in the background so the first
    dashboard load is fast."""
    with SessionLocal() as session:
        for station in session.scalars(select(Station)):
            try:
                station_forecast(session, station)
            except Exception:  # never let warm-up kill the server
                log.exception("Forecast warm-up failed for %s", station.id)


def _refresh_outlook() -> None:
    try:
        data = glofas.outlook()
        _set_status("outlook", name="GloFAS via Open-Meteo (modelled)", last_sync=data["fetched_at"], ok=not data["stale"], errors={})
    except glofas.OutlookUnavailable as exc:
        _set_status("outlook", name="GloFAS via Open-Meteo (modelled)", last_sync=utcnow().isoformat(), ok=False, errors={"all": str(exc)})


def _live_loop(stop: threading.Event) -> None:
    """Pull new live readings every few minutes, then pre-compute forecasts so the
    dashboard never waits on model training."""
    minutes = max(5, get_settings().live_refresh_minutes)
    while not stop.is_set():
        try:
            with SessionLocal() as session:
                result = sync_live_gauges(session)
            log.info("Live gauges synced: %s new rows, errors=%s", result["rows_imported"], result["errors"])
        except Exception:
            log.exception("Live gauge sync failed")
        _refresh_outlook()
        _warm_forecasts()
        stop.wait(minutes * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_db()
    with SessionLocal() as session:
        if settings.seed_demo_data and seed_demo(session):
            log.info("Seeded simulated demo scenario.")
        elif settings.live_data_enabled and not settings.seed_demo_data and remove_simulated(session):
            log.info("Live mode: removed simulated demo stations.")
    stop = threading.Event()
    if settings.live_data_enabled:
        threading.Thread(target=_live_loop, args=(stop,), daemon=True).start()
    else:
        threading.Thread(target=_warm_forecasts, daemon=True).start()
    yield
    stop.set()


app = FastAPI(title="HydroSentinel AI", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(stations.router)
app.include_router(data.router)
app.include_router(ai.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "meta_configured": get_settings().meta_configured}
