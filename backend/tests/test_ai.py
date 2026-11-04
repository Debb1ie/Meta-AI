"""Meta client and SAM parsing tests. No network: httpx is monkeypatched, and the
SAM fixture is encoded with meta-sam-parser's own one_bit encoder."""

import io
import json
from contextlib import contextmanager

import httpx
import numpy as np
import pytest
from meta_sam_parser._mask_codec import _encode_raster
from PIL import Image

from app.ai import meta_client, segmentation
from app.config import get_settings


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(get_settings(), "meta_model_api_key", "test-key")


def sam_line(left, top, right, bottom, img_w, img_h, mask: np.ndarray, obj_id=0, conf=0.9):
    h, w = mask.shape
    payload = _encode_raster(mask.astype(int).ravel().tolist(), w, h)
    return (
        f"<0f>{obj_id}<|box;x1={left};y1={top};x2={right};y2={bottom};w={img_w};h={img_h};c={conf}|>"
        f"<|mask;x=0;y=0;c={conf};data={h},{w},{payload}|>"
    )


def test_annotate_places_box_local_mask_and_measures_share():
    img = Image.new("RGB", (100, 80), (90, 90, 90))
    mask = np.zeros((20, 40), dtype=bool)
    mask[5:15, 10:30] = True  # 200 pixels
    raw = sam_line(30, 40, 69, 59, 100, 80, mask)
    result = segmentation.parse_sam_output(raw, completed=True)
    out = segmentation.annotate(img, result)
    assert out["objects"][0]["box"] == {"left": 30, "top": 40, "right": 70, "bottom": 60}
    assert out["objects"][0]["mask_pixels"] == 200
    assert out["segmented_share_of_image"] == pytest.approx(200 / 8000, abs=1e-4)
    assert out["annotated_image"].startswith("data:image/jpeg;base64,")


def test_zero_detections_is_empty_not_error():
    result = segmentation.parse_sam_output("", completed=True)
    out = segmentation.annotate(Image.new("RGB", (10, 10)), result)
    assert out["objects"] == [] and out["segmented_share_of_image"] == 0


def test_prepare_image_rejects_bad_input():
    with pytest.raises(segmentation.SegmentationInputError):
        segmentation.prepare_image(b"not an image", "image/png")
    with pytest.raises(segmentation.SegmentationInputError):
        segmentation.prepare_image(b"x", "application/pdf")


def test_prepare_image_downscales_large_images():
    buf = io.BytesIO()
    Image.new("RGB", (4000, 1000)).save(buf, "PNG")
    img = segmentation.prepare_image(buf.getvalue(), "image/png")
    assert max(img.size) == segmentation.MAX_SIDE_PX


def test_not_configured_raises():
    with pytest.raises(meta_client.MetaNotConfigured):
        meta_client.chat_json([], {}, "x")


def test_chat_json_parses_structured_output(monkeypatch, configured):
    seen = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, body=json, auth=headers["Authorization"])
        return httpx.Response(200, json={"model": "muse-spark-1.3", "choices": [{"message": {"content": '{"summary": "ok"}'}}]})

    monkeypatch.setattr(httpx, "post", fake_post)
    parsed, meta = meta_client.chat_json([{"role": "user", "content": "hi"}], {"type": "object"}, "s")
    assert parsed == {"summary": "ok"}
    assert seen["url"].endswith("/chat/completions")
    assert seen["body"]["response_format"]["type"] == "json_schema"
    assert seen["auth"] == "Bearer test-key"


def test_chat_json_invalid_json_is_an_error(monkeypatch, configured):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(200, json={"choices": [{"message": {"content": "not json"}}]}))
    with pytest.raises(meta_client.MetaAPIError):
        meta_client.chat_json([], {}, "s")


@pytest.mark.parametrize("status,expected", [(401, 401), (429, 429), (500, 502)])
def test_chat_json_http_errors(monkeypatch, configured, status, expected):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: httpx.Response(status, json={"error": {"message": "nope"}}))
    with pytest.raises(meta_client.MetaAPIError) as exc:
        meta_client.chat_json([], {}, "s")
    assert exc.value.status_code == expected and exc.value.detail == "nope"


def fake_stream(events: list[dict], status=200):
    body = "".join(f"data: {json.dumps(e)}\n\n" for e in events)

    @contextmanager
    def _stream(method, url, headers, json, timeout):
        assert url.endswith("/responses") and json["stream"] is True
        yield httpx.Response(status, text=body, headers={"content-type": "text/event-stream"})

    return _stream


def test_segment_collects_stream_deltas(monkeypatch, configured):
    events = [
        {"type": "response.created", "response": {"id": "resp_1"}},
        {"type": "response.output_text.delta", "delta": "<0f>0<|box;"},
        {"type": "response.output_text.delta", "delta": "x1=1|>"},
        {"type": "response.completed"},
    ]
    monkeypatch.setattr(httpx, "stream", fake_stream(events))
    raw, meta = meta_client.segment_image_raw("data:image/png;base64,AAA", "floodwater")
    assert raw == "<0f>0<|box;x1=1|>"
    assert meta["completed"] and meta["id"] == "resp_1"


def test_segment_failed_event_raises(monkeypatch, configured):
    events = [{"type": "response.failed", "response": {"error": {"message": "bad image"}}}]
    monkeypatch.setattr(httpx, "stream", fake_stream(events))
    with pytest.raises(meta_client.MetaAPIError, match="bad image"):
        meta_client.segment_image_raw("data:image/png;base64,AAA", "floodwater")


def test_photo_check_falls_back_to_other_prompts(monkeypatch):
    img = Image.new("RGB", (100, 80), (90, 90, 90))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    mask = np.ones((20, 40), dtype=bool)
    calls = []

    def fake_segment(data_url, prompt):
        calls.append(prompt)
        raw = sam_line(30, 40, 69, 59, 100, 80, mask) if prompt == "water" else ""
        return raw, {"model": "sam-3.1", "completed": True}

    monkeypatch.setattr(meta_client, "segment_image_raw", fake_segment)
    out = segmentation.analyze_flood_photo(buf.getvalue(), "image/png", "flood")
    assert calls == ["flood", "water"]
    assert out["requested_prompt"] == "flood" and out["prompt"] == "water"
    assert out["detections"] == 1 and out["segmented_share_of_image"] > 0
