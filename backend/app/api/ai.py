import json
import random
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
from ..security import rate_limit
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


@router.post("/analyst", dependencies=[Depends(rate_limit("analyst"))])
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


@router.post("/segment", dependencies=[Depends(rate_limit("vision"))])
async def segment_photo(file: UploadFile = File(...), prompt: str = Form("floodwater")) -> dict:
    data = await file.read()
    try:
        return await run_in_threadpool(segmentation.analyze_flood_photo, data, file.content_type or "", prompt)
    except segmentation.SegmentationInputError as exc:
        raise HTTPException(422, str(exc)) from exc
    except meta_client.MetaAPIError as exc:
        raise _meta_error(exc) from exc


# Art styles people can pick; "surprise" chooses one at random. Each call also varies the
# composition and time of day, so asking again gives a genuinely different picture.
POSTER_STYLES = {
    "flat": "flat vector illustration, bold simple shapes, clean colour blocks",
    "watercolor": "soft watercolor painting with loose ink outlines and paper texture",
    "komiks": "Filipino komiks-style illustration, bold ink lines, halftone shading, no speech bubbles",
    "papercut": "layered paper-cut craft illustration with soft drop shadows and depth",
    "isometric": "isometric 3D illustration, clean low-poly shapes, soft lighting",
    "linocut": "linocut print style, two or three bold ink colours, carved texture",
}
POSTER_COMPOSITIONS = ["wide establishing view", "eye-level view of the street", "view from slightly above", "close, friendly framing of the people"]
POSTER_TIMES = ["morning light", "midday", "late afternoon", "overcast daylight"]
POSTER_SCENES = [
    "families checking a phone alert together",
    "a barangay tanod with a megaphone calmly guiding residents",
    "neighbours helping an elderly resident carry belongings",
    "children with small go-bags walking with their parents",
    "fisherfolk pulling their bangka up the riverbank",
    "volunteers welcoming families at a school evacuation centre",
    "residents clearing a drain and stacking sandbags together",
]
STYLE_PATTERN = "^(surprise|" + "|".join(POSTER_STYLES) + ")$"


def _variety(style: str) -> tuple[str, str]:
    """(style id, prompt fragment) with a random composition and time of day."""
    sid = random.choice(list(POSTER_STYLES)) if style == "surprise" else style
    return sid, f"{POSTER_STYLES[sid]}, {random.choice(POSTER_COMPOSITIONS)}, {random.choice(POSTER_TIMES)}"


PREPAREDNESS_TOPICS = {
    "go-bag": "an emergency go-bag checklist for a family preparing for river flooding: water, medicine, documents in a waterproof pouch, flashlight, radio, phone power bank",
    "evacuation": "a calm step-by-step guide to evacuating early when river levels rise: switch off electricity, move to higher ground, follow official routes, never walk or drive through floodwater",
    "home": "protecting a home before a flood: move valuables and electrics upstairs, clear drains, secure loose items, store clean water",
}


class GraphicRequest(BaseModel):
    topic: str
    style: str = Field(default="surprise", pattern=STYLE_PATTERN)


@router.post("/preparedness-graphic", dependencies=[Depends(rate_limit("image"))])
async def preparedness_graphic(body: GraphicRequest) -> dict:
    if body.topic not in PREPAREDNESS_TOPICS:
        raise HTTPException(422, f"Unknown topic. Choose one of: {', '.join(PREPAREDNESS_TOPICS)}")
    style, look = _variety(body.style)
    prompt = (
        f"Friendly educational illustration for Filipino families, {look}, "
        f"showing {PREPAREDNESS_TOPICS[body.topic]}. No words, no letters, no logos."
    )
    try:
        image, meta = await run_in_threadpool(meta_client.generate_image, prompt)
    except meta_client.MetaAPIError as exc:
        raise _meta_error(exc) from exc
    return {"topic": body.topic, "style": style, "prompt": prompt, **image, **meta, "label": "AI-generated illustration (Muse Image)"}


# ---------------------------------------------------------------- flood-watch agent

_agent_running = threading.Lock()


@router.post("/agent/run", dependencies=[Depends(rate_limit("agent"))])
def run_agent() -> StreamingResponse:
    """Run the flood-watch agent; streams NDJSON progress events, ending with `final` or `error`."""
    if not get_settings().meta_configured:
        raise HTTPException(503, "Meta Model API is not configured. Set META_MODEL_API_KEY in the backend .env file.")
    if not _agent_running.acquire(blocking=False):
        raise HTTPException(409, "The agent is already running. Its briefing will appear when it finishes.")

    settings = get_settings()
    reason = agent.budget_reason(settings.agent_cooldown_minutes, settings.agent_max_runs_per_day)

    def stream():
        try:
            cached = agent.latest() if reason else None
            if cached:
                # Protect API credits: repeat clicks get the fresh cached briefing.
                yield json.dumps({"type": "status", "text": reason}) + "\n"
                verification = agent.verify(cached["briefing"], cached["evidence"])
                yield json.dumps({"type": "final", **cached, "cached": True, "verification": verification}, default=str) + "\n"
                return
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
    style: str = Field(default="surprise", pattern=STYLE_PATTERN)


POSTER_MOOD = {
    "normal": "calm, reassuring teal and lime palette, clear skies over a river town",
    "advisory": "attentive mood, amber accents, clouds gathering over a river town",
    "warning": "urgent but calm mood, orange accents, heavy rain over a river town with rising water",
    "critical": "serious mood, red-orange accents, flooded river town with people moving to higher ground",
}


@router.post("/alert-poster", dependencies=[Depends(rate_limit("image"))])
async def alert_poster(body: PosterRequest) -> dict:
    """Muse Image community poster for the current briefing (illustration only, no text)."""
    style, look = _variety(body.style)
    scene = random.choice(POSTER_SCENES)
    prompt = (
        f"Community flood-preparedness poster illustration for a Philippine barangay, {look}, "
        f"{POSTER_MOOD[body.level]}, nipa huts and concrete houses near a river"
        + (f" like the {body.place}" if body.place else "")
        + f", {scene}. No words, no letters, no logos."
    )
    try:
        image, meta = await run_in_threadpool(meta_client.generate_image, prompt)
    except meta_client.MetaAPIError as exc:
        raise _meta_error(exc) from exc
    return {"prompt": prompt, "style": style, "headline": body.headline, **image, **meta, "label": "AI-generated illustration (Muse Image)"}
