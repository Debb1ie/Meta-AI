import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .api import ai, data, stations
from .config import get_settings
from .db import SessionLocal, Station, init_db
from .services import seed_demo, station_forecast

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with SessionLocal() as session:
        if seed_demo(session):
            log.info("Seeded simulated demo scenario.")
    threading.Thread(target=_warm_forecasts, daemon=True).start()
    yield


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
