import hashlib
import io
import json

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import Dataset, Station, as_utc, get_session
from ..forecasting.preprocessing import validate_observations
from ..providers.base import StationMetadata
from ..risk import Thresholds
from ..services import clear_forecast_cache, ensure_station, seed_demo, upsert_observations

router = APIRouter(prefix="/api", tags=["data"])

MAX_CSV_BYTES = 25 * 1024 * 1024
TEMPLATE = (
    "timestamp,station_id,water_level_m,rainfall_mm\n"
    "2026-10-01T00:00:00+08:00,my-station-01,2.31,0.0\n"
    "2026-10-01T01:00:00+08:00,my-station-01,2.33,1.2\n"
)


class NewStation(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    river: str = ""
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timezone: str = "UTC"
    advisory_m: float
    warning_m: float
    critical_m: float
    rise_rate_m_per_h: float = Field(default=0.15, gt=0)
    threshold_source: str = Field(min_length=3)


async def _read_csv(file: UploadFile) -> tuple[pd.DataFrame, bytes]:
    data = await file.read()
    if len(data) > MAX_CSV_BYTES:
        raise HTTPException(413, "CSV is larger than 25 MB.")
    if not data.strip():
        raise HTTPException(422, "The uploaded file is empty.")
    try:
        frame = pd.read_csv(io.BytesIO(data), dtype=str, skipinitialspace=True, on_bad_lines="skip")
    except (pd.errors.ParserError, UnicodeDecodeError, ValueError) as exc:
        raise HTTPException(422, f"Could not parse CSV: {exc}") from exc
    return frame, data


def _validate(frame: pd.DataFrame, source_timezone: str, station_id: str | None):
    try:
        return validate_observations(frame, source_timezone=source_timezone, default_station_id=station_id or None)
    except Exception as exc:  # e.g. unknown timezone name
        raise HTTPException(422, f"Validation failed: {exc}") from exc


@router.get("/data/template", response_class=PlainTextResponse)
def csv_template() -> str:
    return TEMPLATE


@router.post("/data/preview")
async def preview_csv(
    file: UploadFile = File(...),
    source_timezone: str = Form("UTC"),
    station_id: str = Form(""),
    session: Session = Depends(get_session),
) -> dict:
    frame, _ = await _read_csv(file)
    clean, report = _validate(frame, source_timezone, station_id)
    known = set(session.scalars(select(Station.id)))
    preview = clean.head(25).assign(observed_at=lambda d: d["observed_at"].map(lambda t: t.isoformat()))
    return {
        "filename": file.filename,
        "report": report.as_dict(),
        "preview": json.loads(preview.to_json(orient="records")),
        "unknown_stations": [s for s in report.stations if s not in known],
        "per_station": {
            sid: {
                "rows": int(len(g)),
                "level_rows": int(g["water_level_m"].notna().sum()),
                "rain_rows": int(g["rainfall_mm"].notna().sum()),
            }
            for sid, g in clean.groupby("station_id")
        },
    }


@router.post("/data/import")
async def import_csv(
    file: UploadFile = File(...),
    source_timezone: str = Form("UTC"),
    station_id: str = Form(""),
    dataset_name: str = Form(""),
    new_stations: str = Form("[]"),
    is_simulated: bool = Form(False),
    session: Session = Depends(get_session),
) -> dict:
    frame, raw_bytes = await _read_csv(file)
    clean, report = _validate(frame, source_timezone, station_id)
    if report.errors:
        raise HTTPException(422, {"message": "File failed validation.", "errors": report.errors})
    if clean.empty:
        raise HTTPException(422, "No valid rows to import.")

    try:
        stations_in = [NewStation(**s) for s in json.loads(new_stations or "[]")]
        for s in stations_in:
            Thresholds(s.advisory_m, s.warning_m, s.critical_m, s.rise_rate_m_per_h).validate()
    except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
        raise HTTPException(422, f"Invalid station metadata: {exc}") from exc

    known = set(session.scalars(select(Station.id)))
    provided = {s.id: s for s in stations_in}
    missing = [sid for sid in report.stations if sid not in known and sid not in provided]
    if missing:
        raise HTTPException(422, {"message": "Station metadata required for new stations.", "stations": missing})

    for sid in report.stations:
        if sid in provided:
            s = provided[sid]
            ensure_station(
                session,
                StationMetadata(s.id, s.name, s.latitude, s.longitude, s.river, s.timezone),
                {
                    "advisory_level_m": s.advisory_m,
                    "warning_level_m": s.warning_m,
                    "critical_level_m": s.critical_m,
                    "rise_rate_advisory_m_per_h": s.rise_rate_m_per_h,
                },
                is_simulated=is_simulated,
                source=s.threshold_source,
            )

    dataset = Dataset(
        name=dataset_name.strip() or (file.filename or "CSV upload"),
        source_type="csv_upload",
        source_detail=f"file={file.filename}; sha256={hashlib.sha256(raw_bytes).hexdigest()}",
        is_simulated=is_simulated,
        rows_received=report.rows_received,
        rows_rejected=report.rows_rejected,
        period_start=clean["observed_at"].min().to_pydatetime(),
        period_end=clean["observed_at"].max().to_pydatetime(),
        source_timezone=source_timezone,
        validation=report.as_dict(),
    )
    session.add(dataset)
    session.flush()
    dataset.rows_imported = upsert_observations(session, clean, dataset)
    session.commit()
    clear_forecast_cache()
    return {"dataset": _dataset_dict(dataset), "report": report.as_dict()}


def _dataset_dict(ds: Dataset) -> dict:
    return {
        "id": ds.id,
        "name": ds.name,
        "source_type": ds.source_type,
        "source_detail": ds.source_detail,
        "is_simulated": ds.is_simulated,
        "created_at": as_utc(ds.created_at).isoformat(),
        "rows_received": ds.rows_received,
        "rows_imported": ds.rows_imported,
        "rows_rejected": ds.rows_rejected,
        "period_start": as_utc(ds.period_start).isoformat() if ds.period_start else None,
        "period_end": as_utc(ds.period_end).isoformat() if ds.period_end else None,
        "source_timezone": ds.source_timezone,
        "issues": (ds.validation or {}).get("issues", {}),
    }


@router.get("/datasets")
def list_datasets(session: Session = Depends(get_session)) -> list[dict]:
    return [_dataset_dict(d) for d in session.scalars(select(Dataset).order_by(Dataset.created_at.desc()))]


@router.post("/demo/reset")
def reset_demo(session: Session = Depends(get_session)) -> dict:
    dataset = seed_demo(session, force=True)
    return {"dataset": _dataset_dict(dataset)}
