"""SAM 3.1 floodwater segmentation: image prep, output parsing, annotation."""

import base64
import io

import numpy as np
from meta_sam_parser import (
    CompletedOutcome,
    IncompleteOutcome,
    InvalidSegmentationMaskError,
    SegmentationBoxRecord,
    SegmentationMaskRecord,
    decode_mask_to_raster,
    image_segmentation_format,
)
from PIL import Image, ImageDraw, ImageOps

from . import meta_client

MAX_SIDE_PX = 2048
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MASK_RGBA = (34, 211, 238, 115)  # cyan, ~45% opacity
BOX_RGB = (250, 204, 21)

LIMITATIONS = [
    "Segmentation shows where SAM 3.1 detected the prompted object (e.g. 'floodwater') in this photo only. It is not a flood map.",
    "Water depth cannot be inferred from a photograph alone; no depth estimate is produced.",
    "The highlighted share of image pixels depends on camera angle, zoom and framing — it is not a ground area or flood extent.",
    "Reflective surfaces, wet roads, puddles, rivers within banks and shadows can be confused with floodwater, and murky water can be missed.",
    "Photo time and location are not verified. Treat results as visual evidence to be confirmed by observers or official sources.",
]


class SegmentationInputError(ValueError):
    pass


def prepare_image(data: bytes, content_type: str) -> Image.Image:
    if content_type not in ALLOWED_TYPES:
        raise SegmentationInputError("Upload a JPEG, PNG or WebP image.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise SegmentationInputError("Image is larger than 15 MB.")
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception as exc:  # Pillow raises many types for corrupt files
        raise SegmentationInputError("The file could not be read as an image.") from exc
    img.thumbnail((MAX_SIDE_PX, MAX_SIDE_PX))
    return img


def to_data_url(img: Image.Image, fmt: str = "JPEG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=90)
    mime = "image/jpeg" if fmt == "JPEG" else "image/png"
    return f"data:{mime};base64,{base64.b64encode(buf.getvalue()).decode()}"


def parse_sam_output(raw: str, completed: bool):
    parser = image_segmentation_format().create_parser()
    parser.push(raw, emit=False)
    outcome = CompletedOutcome() if completed else IncompleteOutcome(reason="eof")
    return parser.finish(outcome).result


def annotate(img: Image.Image, result) -> dict:
    """Overlay masks and boxes; compute per-object and union pixel coverage."""
    width, height = img.size
    union = np.zeros((height, width), dtype=bool)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    objects: dict[str, dict] = {}
    warnings: list[str] = []

    for record in result.records:
        if isinstance(record, SegmentationBoxRecord):
            obj = objects.setdefault(record.object_id, {"object_id": record.object_id})
            obj["box"] = {"left": record.left, "top": record.top, "right": record.right, "bottom": record.bottom}
            obj["box_confidence"] = record.confidence
        elif isinstance(record, SegmentationMaskRecord):
            obj = objects.setdefault(record.object_id, {"object_id": record.object_id})
            obj["mask_confidence"] = record.confidence
            try:
                raster = np.frombuffer(decode_mask_to_raster(record.mask), dtype=np.uint8)
            except InvalidSegmentationMaskError as exc:
                warnings.append(f"Mask for object {record.object_id} could not be decoded: {exc}")
                continue
            local = raster.reshape(record.mask.height, record.mask.width).astype(bool)
            b = record.bounds
            box_w, box_h = int(b.right - b.left), int(b.bottom - b.top)
            if local.shape != (box_h, box_w) and box_w > 0 and box_h > 0:
                local = np.array(Image.fromarray(local.astype(np.uint8) * 255).resize((box_w, box_h), Image.NEAREST)) > 0
            top, left = int(b.top), int(b.left)
            region = union[top : top + local.shape[0], left : left + local.shape[1]]
            local = local[: region.shape[0], : region.shape[1]]
            region |= local
            obj["mask_pixels"] = int(local.sum())
            obj["mask_share_of_image"] = round(float(local.sum()) / (width * height), 4)

    if union.any():
        mask_img = Image.fromarray(union.astype(np.uint8) * 255, mode="L")
        overlay.paste(Image.new("RGBA", img.size, MASK_RGBA), (0, 0), mask_img)
    line_w = max(2, round(max(width, height) / 400))
    for obj in objects.values():
        if "box" in obj:
            bx = obj["box"]
            draw.rectangle([bx["left"], bx["top"], bx["right"] - 1, bx["bottom"] - 1], outline=BOX_RGB + (255,), width=line_w)
            conf = obj.get("box_confidence")
            label = f"#{obj['object_id']}" + (f" {conf:.2f}" if conf is not None else "")
            draw.text((bx["left"] + line_w + 2, bx["top"] + line_w + 2), label, fill=BOX_RGB + (255,))

    annotated = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    return {
        "annotated_image": to_data_url(annotated),
        "image_width": width,
        "image_height": height,
        "objects": list(objects.values()),
        "segmented_share_of_image": round(float(union.mean()), 4),
        "warnings": warnings,
    }


def analyze_flood_photo(data: bytes, content_type: str, prompt: str = "floodwater") -> dict:
    prompt = (prompt or "floodwater").strip()[:80]
    img = prepare_image(data, content_type)
    raw, meta = meta_client.segment_image_raw(to_data_url(img), prompt)
    result = parse_sam_output(raw, meta["completed"])
    annotated = annotate(img, result)
    diagnostics = [{"code": d.code, "message": d.message, "severity": d.severity} for d in result.diagnostics]
    return {
        "prompt": prompt,
        "model": meta["model"],
        "response_id": meta.get("id"),
        "completed": meta["completed"],
        "detections": len(annotated["objects"]),
        **annotated,
        "diagnostics": diagnostics,
        "limitations": LIMITATIONS,
        "source_image": to_data_url(img),
    }
