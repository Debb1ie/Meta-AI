"""Live hazard feeds (no keys):

- GDACS (Global Disaster Alert and Coordination System, UN/EC JRC): current
  tropical cyclones and floods worldwide, ranked by distance to the Philippines.
- UK Environment Agency flood warnings currently in force (for the live gauges).

Both are cached briefly and fall back to the last good result if a feed fails."""

import math
import threading
import time
from datetime import datetime, timezone

import httpx

from ..config import get_settings

GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP"
GDACS_SOURCE = "GDACS — Global Disaster Alert and Coordination System (UN OCHA / EC JRC)"
PH_CENTER = (12.5, 122.5)
AFFECTS_KM = 600  # within this distance an event is treated as affecting the Philippines
NEAR_KM = 2500  # a typhoon within this distance can reach PAR (the PH area of responsibility) within days
CACHE_SECONDS = 30 * 60

_lock = threading.Lock()
_cache: dict[str, tuple[float, dict]] = {}


class HazardsUnavailable(RuntimeError):
    pass


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def _gdacs() -> list[dict]:
    try:
        resp = httpx.get(GDACS_URL, timeout=30)
        resp.raise_for_status()
        features = resp.json().get("features", [])
    except (httpx.HTTPError, ValueError) as exc:
        raise HazardsUnavailable(f"GDACS request failed: {exc}") from exc
    events = []
    for f in features:
        p = f.get("properties", {})
        if p.get("eventtype") not in ("TC", "FL") or str(p.get("iscurrent")).lower() != "true":
            continue
        lon, lat = (f.get("geometry") or {}).get("coordinates", [None, None])[:2]
        if lat is None or lon is None:
            continue
        distance = _km(PH_CENTER[0], PH_CENTER[1], lat, lon)
        country = p.get("country") or ""
        sev = p.get("severitydata") or {}
        events.append(
            {
                "id": f"gdacs-{p.get('eventtype')}-{p.get('eventid')}",
                "type": "typhoon" if p.get("eventtype") == "TC" else "flood",
                # External text is trimmed before it can reach a model prompt or the UI.
                "name": str(p.get("name") or p.get("eventname") or "")[:120],
                "alert": (p.get("alertlevel") or "Green").lower(),
                "country": country[:200],
                "latitude": lat,
                "longitude": lon,
                "distance_to_ph_km": round(distance),
                "affects_ph": "Philippines" in country or distance < AFFECTS_KM,
                "near_ph": "Philippines" in country or distance < NEAR_KM,
                "severity": str(sev.get("severitytext") or "")[:160] or None,
                "from": p.get("fromdate"),
                "to": p.get("todate"),
                "updated": p.get("datemodified"),
                "source": p.get("source"),
                "report_url": (p.get("url") or {}).get("report"),
            }
        )
    order = {"red": 0, "orange": 1, "green": 2}
    events.sort(key=lambda e: (not e["near_ph"], order.get(e["alert"], 3), e["distance_to_ph_km"]))
    return events


def _ea_warnings() -> list[dict]:
    try:
        resp = httpx.get(f"{get_settings().ea_base_url}/id/floods", timeout=30)
        resp.raise_for_status()
        items = resp.json().get("items", [])
    except (httpx.HTTPError, ValueError) as exc:
        raise HazardsUnavailable(f"Environment Agency flood warnings failed: {exc}") from exc
    return [
        {
            "id": f"ea-{i.get('floodAreaID')}",
            "area": i.get("description"),
            "county": (i.get("floodArea") or {}).get("county"),
            "river": (i.get("floodArea") or {}).get("riverOrSea"),
            "severity": i.get("severity"),
            "severity_level": i.get("severityLevel"),
            "raised": i.get("timeRaised"),
            "message": (i.get("message") or "")[:400],
        }
        for i in items
    ]


def hazards() -> dict:
    with _lock:
        cached = _cache.get("hazards")
        if cached and time.time() - cached[0] < CACHE_SECONDS:
            return cached[1]
        result = {"fetched_at": datetime.now(timezone.utc).isoformat(), "stale": False, "errors": {}}
        for key, fn in (("events", _gdacs), ("uk_warnings", _ea_warnings)):
            try:
                result[key] = fn()
            except HazardsUnavailable as exc:
                result["errors"][key] = str(exc)
                result[key] = cached[1].get(key, []) if cached else []
                result["stale"] = True
        if not result["events"] and not result["uk_warnings"] and result["errors"] and not cached:
            raise HazardsUnavailable("; ".join(result["errors"].values()))
        result["near_ph"] = [e for e in result["events"] if e["near_ph"]]
        result["sources"] = {"events": GDACS_SOURCE, "uk_warnings": "UK Environment Agency flood-monitoring API"}
        _cache["hazards"] = (time.time(), result)
        return result
