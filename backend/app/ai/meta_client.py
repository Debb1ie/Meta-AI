"""Thin client for the Meta Model API (https://api.meta.ai/v1).

- Muse Spark: Chat Completions with `response_format: json_schema` (documented
  structured-output surface; JSON arrives in choices[0].message.content).
- SAM 3.1: streamed Responses API; segmentation arrives as output_text deltas in
  SAM's box/mask wire format, parsed with Meta's `meta-sam-parser`.
- Muse Image: /images/generations (base64 or signed URL).

The API key never leaves the server. Every failure raises MetaAPIError with a
user-presentable message; callers must not substitute fabricated output.
"""

import json
from collections.abc import Iterator

import httpx

from ..config import get_settings


class MetaAPIError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502, detail: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail


class MetaNotConfigured(MetaAPIError):
    def __init__(self):
        super().__init__(
            "Meta Model API is not configured. Set META_MODEL_API_KEY in the backend .env file.", status_code=503
        )


def _headers() -> dict:
    settings = get_settings()
    if not settings.meta_configured:
        raise MetaNotConfigured()
    return {"Authorization": f"Bearer {settings.meta_model_api_key}", "Content-Type": "application/json"}


def _url(path: str) -> str:
    return get_settings().meta_model_base_url.rstrip("/") + path


def _raise_for_status(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    try:
        body = resp.json()
        detail = body.get("error", {}).get("message") if isinstance(body.get("error"), dict) else str(body)
    except ValueError:
        detail = resp.text[:500]
    messages = {
        401: "Meta Model API rejected the API key (401).",
        403: "Meta Model API denied access to this model (403).",
        404: "Model or endpoint not found on the Meta Model API (404). Check the model ID in .env.",
        429: "Meta Model API rate limit reached (429). Try again shortly.",
    }
    status = 502 if resp.status_code >= 500 else resp.status_code
    raise MetaAPIError(messages.get(resp.status_code, f"Meta Model API error {resp.status_code}."), status, detail)


def chat_json(messages: list[dict], schema: dict, schema_name: str, temperature: float = 0.2) -> tuple[dict, dict]:
    """Structured JSON from Muse Spark. Returns (parsed_json, metadata)."""
    settings = get_settings()
    payload = {
        "model": settings.meta_text_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": settings.meta_max_output_tokens,
        "response_format": {"type": "json_schema", "json_schema": {"name": schema_name, "schema": schema, "strict": True}},
    }
    try:
        resp = httpx.post(_url("/chat/completions"), headers=_headers(), json=payload, timeout=settings.meta_timeout_seconds)
    except httpx.TimeoutException as exc:
        raise MetaAPIError("Meta Model API timed out.", 504) from exc
    except httpx.HTTPError as exc:
        raise MetaAPIError(f"Could not reach the Meta Model API: {exc}", 502) from exc
    _raise_for_status(resp)

    body = resp.json()
    try:
        content = body["choices"][0]["message"]["content"]
        if isinstance(content, list):  # some compatible servers return content parts
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        parsed = json.loads(content)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise MetaAPIError("Muse Spark returned a response that was not valid JSON for the schema.", 502, str(body)[:500]) from exc
    meta = {"model": body.get("model", settings.meta_text_model), "usage": body.get("usage"), "id": body.get("id")}
    return parsed, meta


def chat_tools(messages: list[dict], tools: list[dict], temperature: float = 0.2) -> tuple[dict, dict]:
    """One Muse Spark turn with native function calling. Returns (assistant message, metadata);
    the message carries `tool_calls` when the model wants to use a tool."""
    settings = get_settings()
    payload = {"model": settings.meta_text_model, "messages": messages, "tools": tools, "temperature": temperature, "max_tokens": settings.meta_max_output_tokens}
    try:
        resp = httpx.post(_url("/chat/completions"), headers=_headers(), json=payload, timeout=settings.meta_timeout_seconds)
    except httpx.TimeoutException as exc:
        raise MetaAPIError("Meta Model API timed out.", 504) from exc
    except httpx.HTTPError as exc:
        raise MetaAPIError(f"Could not reach the Meta Model API: {exc}", 502) from exc
    _raise_for_status(resp)
    body = resp.json()
    try:
        message = body["choices"][0]["message"]
    except (KeyError, IndexError, TypeError) as exc:
        raise MetaAPIError("Muse Spark returned no message.", 502, str(body)[:500]) from exc
    meta = {"model": body.get("model", settings.meta_text_model), "usage": body.get("usage"), "id": body.get("id")}
    return message, meta


def _sse_events(resp: httpx.Response) -> Iterator[dict]:
    data_lines: list[str] = []
    for line in resp.iter_lines():
        if line.startswith("data:"):
            data_lines.append(line[5:].strip())
        elif line == "" and data_lines:
            data = "\n".join(data_lines)
            data_lines = []
            if data == "[DONE]":
                return
            try:
                yield json.loads(data)
            except json.JSONDecodeError:
                continue
    if data_lines and data_lines[0] != "[DONE]":
        try:
            yield json.loads("\n".join(data_lines))
        except json.JSONDecodeError:
            pass


def segment_image_raw(image_data_url: str, prompt: str) -> tuple[str, dict]:
    """Run SAM 3.1 on one image. Returns (raw SAM output text, metadata)."""
    settings = get_settings()
    payload = {
        "model": settings.meta_segmentation_model,
        "stream": True,
        "input": [
            {
                "type": "message",
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": image_data_url},
                ],
            }
        ],
        "metadata": {"include_confidence": "true"},
    }
    headers = {**_headers(), "Accept": "text/event-stream"}
    chunks: list[str] = []
    completed = False
    response_id = None
    try:
        with httpx.stream(
            "POST", _url("/responses"), headers=headers, json=payload, timeout=settings.meta_timeout_seconds
        ) as resp:
            if resp.status_code >= 400:
                resp.read()
                _raise_for_status(resp)
            for event in _sse_events(resp):
                kind = event.get("type", "")
                if kind == "response.output_text.delta":
                    chunks.append(event.get("delta", ""))
                elif kind == "response.created":
                    response_id = (event.get("response") or {}).get("id")
                elif kind == "response.completed":
                    completed = True
                elif kind in ("response.failed", "error", "response.incomplete"):
                    err = event.get("error") or (event.get("response") or {}).get("error") or {}
                    raise MetaAPIError(f"SAM 3.1 request did not complete: {err.get('message', kind)}", 502, json.dumps(event)[:500])
    except httpx.TimeoutException as exc:
        raise MetaAPIError("SAM 3.1 request timed out.", 504) from exc
    except httpx.HTTPError as exc:
        raise MetaAPIError(f"Could not reach the Meta Model API: {exc}", 502) from exc
    return "".join(chunks), {"model": settings.meta_segmentation_model, "completed": completed, "id": response_id}


def generate_image(prompt: str, size: str = "1024x1024") -> tuple[dict, dict]:
    """Muse Image generation. Returns ({b64 or url}, metadata)."""
    settings = get_settings()
    payload = {"model": settings.meta_image_model, "prompt": prompt, "size": size, "n": 1}
    try:
        resp = httpx.post(_url("/images/generations"), headers=_headers(), json=payload, timeout=settings.meta_timeout_seconds)
    except httpx.TimeoutException as exc:
        raise MetaAPIError("Muse Image request timed out.", 504) from exc
    except httpx.HTTPError as exc:
        raise MetaAPIError(f"Could not reach the Meta Model API: {exc}", 502) from exc
    _raise_for_status(resp)
    body = resp.json()
    try:
        item = body["data"][0]
    except (KeyError, IndexError, TypeError) as exc:
        raise MetaAPIError("Muse Image returned no image.", 502, str(body)[:500]) from exc
    image = {"b64": item.get("b64_json"), "url": item.get("url")}
    if not image["b64"] and not image["url"]:
        raise MetaAPIError("Muse Image returned no image data.", 502, str(body)[:500])
    return image, {"model": settings.meta_image_model, "revised_prompt": item.get("revised_prompt")}
