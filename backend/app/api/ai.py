from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..ai import analyst, meta_client, segmentation
from ..config import get_settings
from ..db import Station, get_session
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
    context = analyst.build_context(reports, body.station_id)
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
