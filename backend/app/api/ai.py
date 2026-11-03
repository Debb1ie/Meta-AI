import json
import threading

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..ai import agent, analyst, meta_client, segmentation
from ..providers import glofas
from ..config import get_settings
from ..db import SessionLocal, Station, get_session
from .stations import all_reports

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _meta_error(exc: meta_client.MetaAPIError) -> HTTPException:
    return HTTPException(exc.status_code, {"message": str(exc), "detail": exc.detail})


@router.get("/status")
def ai_status() -> dict:
    s = get_settings()
    return {
        "configured": s.meta_configured,
        "base_url": s.meta_model_base_url,
        "models": {"analyst": s.meta_text_model, "segmentation": s.meta_segmentation_model, "image": s.meta_image_model},
    }


class AnalystRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    station_id: str | None = None
    history: list[dict] = Field(default_factory=list, max_length=12)


@router.post("/analyst")
async def ask_analyst(body: AnalystRequest, session: Session = Depends(get_session)) -> dict:
    if body.station_id and session.get(Station, body.station_id) is None:
        raise HTTPException(404, f"Station '{body.station_id}' not found.")
    reports = await run_in_threadpool(all_reports, session)
    try:
        outlook = await run_in_threadpool(glofas.outlook)
    except glofas.OutlookUnavailable:
        outlook = None
    context = analyst.build_context(reports, body.station_id, outlook)
    try:
        result = await run_in_threadpool(analyst.ask, body.question, context, body.history)
    except meta_client.MetaAPIError as exc:
        raise _meta_error(exc) from exc
    return {**result, "context": context}


@router.post("/segment")
async def segment_photo(file: UploadFile = File(...), prompt: str = Form("floodwater")) -> dict:
    data = await file.read()
    try:
        return await run_in_threadpool(segmentation.analyze_flood_photo, data, file.content_type or "", prompt)
    except segmentation.SegmentationInputError as exc:
        raise HTTPException(422, str(exc)) from exc
    except meta_client.MetaAPIError as exc:
        raise _meta_error(exc) from exc


PREPAREDNESS_TOPICS = {
    "go-bag": "an emergency go-bag checklist for a family preparing for river flooding: water, medicine, documents in a waterproof pouch, flashlight, radio, phone power bank",
    "evacuation": "a calm step-by-step guide to evacuating early when river levels rise: switch off electricity, move to higher ground, follow official routes, never walk or drive through floodwater",
    "home": "protecting a home before a flood: move valuables and electrics upstairs, clear drains, secure loose items, store clean water",
}


class GraphicRequest(BaseModel):
    topic: str


@router.post("/preparedness-graphic")
async def preparedness_graphic(body: GraphicRequest) -> dict:
    if body.topic not in PREPAREDNESS_TOPICS:
        raise HTTPException(422, f"Unknown topic. Choose one of: {', '.join(PREPAREDNESS_TOPICS)}")
    prompt = (
        "Clean, flat educational infographic illustration, dark navy background, cyan and white accents, "
        f"no text or minimal short labels, showing {PREPAREDNESS_TOPICS[body.topic]}."
    )
    try:
        image, meta = await run_in_threadpool(meta_client.generate_image, prompt)
    except meta_client.MetaAPIError as exc:
        raise _meta_error(exc) from exc
    return {"topic": body.topic, "prompt": prompt, **image, **meta, "label": "AI-generated illustration (Muse Image)"}


# ---------------------------------------------------------------- flood-watch agent

_agent_running = threading.Lock()


@router.post("/agent/run")
def run_agent() -> StreamingResponse:
    """Run the flood-watch agent; streams NDJSON progress events, ending with `final` or `error`."""
    if not get_settings().meta_configured:
        raise HTTPException(503, "Meta Model API is not configured. Set META_MODEL_API_KEY in the backend .env file.")
    if not _agent_running.acquire(blocking=False):
        raise HTTPException(409, "The agent is already running. Its briefing will appear when it finishes.")

    def stream():
        try:
            with SessionLocal() as session:
                for event in agent.run(session):
                    yield json.dumps(event, default=str) + "\n"
        finally:
            _agent_running.release()

    return StreamingResponse(stream(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


@router.get("/agent/latest")
def latest_briefing() -> dict:
    latest = agent.latest()
    if latest:
        # Re-check with the current verifier so the badge never reflects stale logic.
        latest = {**latest, "verification": agent.verify(latest["briefing"], latest["evidence"])}
    return {"briefing": latest, "running": _agent_running.locked()}


class PosterRequest(BaseModel):
    headline: str = Field(min_length=3, max_length=200)
    place: str = Field(default="", max_length=120)
    level: str = Field(default="normal", pattern="^(normal|advisory|warning|critical)$")


POSTER_MOOD = {
    "normal": "calm, reassuring teal and lime palette, clear skies over a river town",
    "advisory": "attentive mood, amber accents, clouds gathering over a river town",
    "warning": "urgent but calm mood, orange accents, heavy rain over a river town with rising water",
    "critical": "serious mood, red-orange accents, flooded river town with people moving to higher ground",
}


@router.post("/alert-poster")
async def alert_poster(body: PosterRequest) -> dict:
    """Muse Image community poster for the current briefing (illustration only, no text)."""
    prompt = (
        "Flat vector community flood-preparedness poster illustration for a Philippine barangay, "
        f"{POSTER_MOOD[body.level]}, nipa huts and concrete houses near a river"
        + (f" like the {body.place}" if body.place else "")
        + ", families checking a phone alert together, bold simple shapes, no words, no letters, no logos."
    )
    try:
        image, meta = await run_in_threadpool(meta_client.generate_image, prompt)
    except meta_client.MetaAPIError as exc:
        raise _meta_error(exc) from exc
    return {"prompt": prompt, "headline": body.headline, **image, **meta, "label": "AI-generated illustration (Muse Image)"}
