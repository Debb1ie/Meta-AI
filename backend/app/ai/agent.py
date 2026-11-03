"""Flood-watch agent: Muse Spark with native tool calling, built to be verifiable.

1. Investigate: Muse Spark decides which tools to call (hazard feeds, the
   Philippine GloFAS outlook, rain forecasts, gauge forecasts). Every tool result
   is logged as evidence E1, E2, ... and returned to the model.
2. Brief: a final structured call turns the evidence log into a briefing where
   each claim cites evidence ids, plus SMS-length community alerts in five
   Philippine languages.
3. Verify: the server checks every number in every cited claim against the
   numbers actually present in that claim's evidence, and flags the rest.

`run()` is a generator of progress events so the UI can show the agent working."""

import json
import re
import threading
import time
from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..providers import glofas, hazards, open_meteo
from . import meta_client

MAX_STEPS = 8
LEVELS = ["normal", "advisory", "warning", "critical"]
LANGUAGES = {"en": "English", "fil": "Filipino (Tagalog)", "ceb": "Cebuano (Bisaya)", "ilo": "Ilocano", "hil": "Hiligaynon (Ilonggo)"}

SYSTEM_PROMPT = """You are HydroSentinel's flood-watch agent. You monitor flood risk for communities in the \
Philippines (17 major river basins, GloFAS model outlook) and a set of live measured river gauges used to \
validate the forecasting engine, plus live disaster feeds (GDACS typhoons and floods).

Work like a duty officer:
1. Start with get_hazards and list_ph_basins.
2. Investigate anything that matters: basins at or near alert levels, rising basins, basins near an active \
typhoon or flood event. Use get_basin and get_rain_forecast on the most important ones (at most 3).
3. Check list_gauges; inspect a gauge with get_gauge only if one needs attention or is rising fast.
4. Stop when you can brief a local disaster risk reduction office. Do not call more tools than needed.

Rules: use only tool results, never invent numbers or places. GloFAS values are modelled discharge in m³/s, \
not gauge readings and not PAGASA warnings. Defer to PAGASA, NDRRMC and local DRRMOs for official warnings."""

BRIEFING_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["headline", "overall_level", "situation", "watchlist", "actions", "alerts", "limitations"],
    "properties": {
        "headline": {"type": "string", "description": "One line, at most 90 characters."},
        "overall_level": {"type": "string", "enum": LEVELS},
        "situation": {
            "type": "array",
            "description": "2-4 short factual claims. Each must cite evidence ids.",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["text", "evidence"],
                "properties": {"text": {"type": "string"}, "evidence": {"type": "array", "items": {"type": "string"}}},
            },
        },
        "watchlist": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "kind", "level", "reason", "evidence"],
                "properties": {
                    "name": {"type": "string"},
                    "kind": {"type": "string", "enum": ["ph_basin", "gauge", "hazard"]},
                    "level": {"type": "string", "enum": LEVELS},
                    "reason": {"type": "string"},
                    "evidence": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "actions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["action", "who", "priority"],
                "properties": {
                    "action": {"type": "string"},
                    "who": {"type": "string", "enum": ["residents", "barangay", "lgu_drrmo", "operators"]},
                    "priority": {"type": "string", "enum": ["immediate", "soon", "monitor"]},
                },
            },
        },
        "alerts": {
            "type": "object",
            "additionalProperties": False,
            "required": list(LANGUAGES),
            "properties": {k: {"type": "string", "description": f"SMS alert in {v}, at most 300 characters."} for k, v in LANGUAGES.items()},
        },
        "limitations": {"type": "array", "items": {"type": "string"}},
    },
}

TOOLS = [
    {"type": "function", "function": {"name": "get_hazards", "description": "Active tropical cyclones and floods from GDACS, nearest to the Philippines first, plus UK flood warnings in force.", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "list_ph_basins", "description": "All 17 Philippine river basins: modelled flow today, 3-day trend, 7-day peak, peak as % of the Watch level, alert level.", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "get_basin", "description": "One Philippine basin: alert levels in m³/s, last 7 days and next 14 days of modelled daily flow with likely range.", "parameters": {"type": "object", "properties": {"basin_id": {"type": "string", "description": "e.g. ph-cagayan"}}, "required": ["basin_id"]}}},
    {"type": "function", "function": {"name": "get_rain_forecast", "description": "Rain forecast (Open-Meteo) at a basin or gauge: totals for the next 6/24/72 hours and per day.", "parameters": {"type": "object", "properties": {"place_id": {"type": "string", "description": "A basin id (ph-...) or gauge id (ea-...)"}}, "required": ["place_id"]}}},
    {"type": "function", "function": {"name": "list_gauges", "description": "All live measured gauges: level now, rate of rise, 24 h forecast, risk level, data age.", "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {"name": "get_gauge", "description": "One gauge: alert levels, forecasts per horizon with 80% range, model skill vs persistence, risk explanation.", "parameters": {"type": "object", "properties": {"gauge_id": {"type": "string"}}, "required": ["gauge_id"]}}},
]

_latest_lock = threading.Lock()
_latest: dict | None = None


def latest() -> dict | None:
    with _latest_lock:
        return _latest


class Toolbox:
    """Executes tools against live data. Reports are loaded once per run."""

    def __init__(self, session: Session):
        self.session = session
        self._reports: list[dict] | None = None
        self._outlook: dict | None = None

    def reports(self) -> list[dict]:
        if self._reports is None:
            from ..api.stations import all_reports  # local import: api.stations imports services

            self._reports = all_reports(self.session)
        return self._reports

    def outlook(self) -> dict:
        if self._outlook is None:
            self._outlook = glofas.outlook()
        return self._outlook

    def _place(self, place_id: str) -> tuple[str, float, float]:
        for r in self.outlook()["rivers"]:
            if r["id"] == place_id:
                return r["name"], r["latitude"], r["longitude"]
        for rep in self.reports():
            st = rep["station"]
            if st["id"] == place_id:
                return st["name"], st["latitude"], st["longitude"]
        raise ValueError(f"Unknown place id '{place_id}'.")

    def call(self, name: str, args: dict) -> dict:
        if name == "get_hazards":
            h = hazards.hazards()
            return {
                "near_philippines": [
                    {k: e[k] for k in ("name", "type", "alert", "country", "distance_to_ph_km", "affects_ph", "severity", "from", "to")}
                    for e in h["near_ph"][:6]
                ],
                "active_worldwide": len(h["events"]),
                "uk_flood_warnings_in_force": len(h["uk_warnings"]),
                "fetched_at": h["fetched_at"],
            }
        if name == "list_ph_basins":
            return {
                "basins": [
                    {
                        "id": r["id"],
                        "name": r["name"],
                        "region": r["region"],
                        "flow_today_m3s": r["current_m3s"],
                        "trend_3d": r["trend"],
                        "peak_7d_m3s": r["peak"]["discharge_m3s"],
                        "peak_date": r["peak"]["date"],
                        "peak_pct_of_watch": round(100 * r["peak"]["discharge_m3s"] / r["thresholds_m3s"]["advisory"]),
                        "level": r["level"],
                    }
                    for r in self.outlook()["rivers"]
                ],
                "data": "GloFAS modelled daily discharge, m³/s",
            }
        if name == "get_basin":
            r = next((r for r in self.outlook()["rivers"] if r["id"] == args.get("basin_id")), None)
            if r is None:
                raise ValueError(f"Unknown basin id '{args.get('basin_id')}'.")
            today = r["current_date"]
            past = [p for p in r["series"] if p["date"] <= today][-7:]
            future = [p for p in r["series"] if p["date"] > today][:14]
            return {
                "name": r["name"],
                "region": r["region"],
                "alert_levels_m3s": r["thresholds_m3s"],
                "level": r["level"],
                "last_7_days": {p["date"]: p["discharge_m3s"] for p in past},
                "next_14_days": {p["date"]: [p["discharge_m3s"], p["p25_m3s"], p["p75_m3s"]] for p in future},
                "next_14_days_format": "[median, p25, p75] m³/s",
                "wetter_runs_upper_m3s": r["upper_m3s"],
            }
        if name == "get_rain_forecast":
            label, lat, lon = self._place(args.get("place_id", ""))
            w = open_meteo.fetch_forecast(lat, lon)
            daily: dict[str, float] = {}
            for h in w["hourly"]:
                if h["is_forecast"]:
                    day = h["time"][:10]
                    daily[day] = round(daily.get(day, 0) + (h["precipitation_mm"] or 0), 1)
            return {"place": label, **{k: v for k, v in w["summary"].items()}, "daily_mm": daily, "source": "Open-Meteo"}
        if name == "list_gauges":
            return {
                "gauges": [
                    {
                        "id": rep["station"]["id"],
                        "name": rep["station"]["name"],
                        "river": rep["station"]["river"],
                        "level_now_m": _round(rep["forecast"].get("current_level_m"), 2),
                        "rise_m_per_h": _round(rep["forecast"].get("current_slope_m_per_h"), 3),
                        "forecast_24h_m": next((h["point_m"] for h in rep["forecast"].get("horizons", []) if h["horizon_h"] == 24), None),
                        "risk": (rep.get("risk") or {}).get("level"),
                        "data_age_h": (rep.get("freshness") or {}).get("age_hours"),
                    }
                    for rep in self.reports()
                ]
            }
        if name == "get_gauge":
            rep = next((x for x in self.reports() if x["station"]["id"] == args.get("gauge_id")), None)
            if rep is None:
                raise ValueError(f"Unknown gauge id '{args.get('gauge_id')}'.")
            fc = rep["forecast"]
            return {
                "name": rep["station"]["name"],
                "alert_levels_m": {k: v for k, v in rep["station"]["thresholds"].items() if k != "source"},
                "level_now_m": _round(fc.get("current_level_m"), 2),
                "horizons": [
                    {
                        "hours_ahead": h["horizon_h"],
                        "forecast_m": h["point_m"],
                        "range80_m": [h["lo80_m"], h["hi80_m"]],
                        "model": h["selected_model"],
                        "skill_vs_persistence": _round(h["skill_vs_persistence"].get(h["selected_model"]), 2),
                    }
                    for h in fc.get("horizons", [])
                ],
                "risk": rep.get("risk"),
            }
        raise ValueError(f"Unknown tool '{name}'.")


def _round(v, nd):
    return None if v is None else round(float(v), nd)


# ---------------------------------------------------------------- verification

_NUM = re.compile(r"(?<![A-Za-z\d])\d[\d,]*(?:\.\d+)?")
_DATE = re.compile(r"\d{4}-\d{2}-\d{2}(?:T[\d:.+Z-]*)?")
# Day/month mentions ("Nov 4", "4 Nov", "Oct 29-Nov 3") and times of day are not measurements.
_MONTH_DAY = re.compile(
    r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|\b\d{1,2}:\d{2}\b",
    re.IGNORECASE,
)


def _numbers_in(obj) -> list[float]:
    found: list[float] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            found += _numbers_in(k) + _numbers_in(v)
    elif isinstance(obj, list):
        found.append(float(len(obj)))  # counts ("all 17 basins") are supported by the list itself
        for v in obj:
            found += _numbers_in(v)
    elif isinstance(obj, bool) or obj is None:
        pass
    elif isinstance(obj, (int, float)):
        found.append(abs(float(obj)))
    elif isinstance(obj, str):
        found += [float(m.replace(",", "")) for m in _NUM.findall(_DATE.sub(" ", obj))]
    return found


def _supported(value: float, pool: list[float]) -> bool:
    # Accept rounding: 463.5 may be written as 464 or 460; percentages and dates are numbers too.
    return any(abs(value - p) <= max(0.051, abs(p) * 0.02) for p in pool)


def verify(briefing: dict, evidence: dict[str, dict]) -> dict:
    claims = [(c["text"], c["evidence"]) for c in briefing.get("situation", [])]
    claims += [(f"{w['name']}: {w['reason']}", w["evidence"]) for w in briefing.get("watchlist", [])]
    checked = verified = 0
    unverified, bad_refs = [], []
    for text, refs in claims:
        known = [r for r in refs if r in evidence]
        bad_refs += [r for r in refs if r not in evidence]
        pool = [n for r in known for n in _numbers_in(evidence[r]["result"])]
        stripped = _MONTH_DAY.sub(" ", _DATE.sub(" ", text))
        for value in {float(m.replace(",", "")) for m in _NUM.findall(stripped)}:
            checked += 1
            if _supported(value, pool):
                verified += 1
            else:
                unverified.append({"claim": text, "number": value})
    return {
        "claims": len(claims),
        "numbers_checked": checked,
        "numbers_verified": verified,
        "unverified": unverified,
        "unknown_evidence_ids": sorted(set(bad_refs)),
        "score": round(verified / checked, 3) if checked else 1.0,
    }


# ---------------------------------------------------------------- run

def run(session: Session) -> Iterator[dict]:
    """Run the agent, yielding progress events; the last event is `final` or `error`."""
    global _latest
    started = time.time()
    toolbox = Toolbox(session)
    evidence: dict[str, dict] = {}
    usage = {"prompt_tokens": 0, "completion_tokens": 0}
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Run the flood watch now. Current UTC time: {datetime.now(timezone.utc).isoformat(timespec='minutes')}."},
    ]

    def add_usage(meta: dict) -> None:
        for k in usage:
            usage[k] += (meta.get("usage") or {}).get(k, 0) or 0

    try:
        yield {"type": "status", "text": "Muse Spark is planning the investigation…"}
        for step in range(MAX_STEPS):
            message, meta = meta_client.chat_tools(messages, TOOLS)
            add_usage(meta)
            calls = message.get("tool_calls") or []
            if message.get("content"):
                yield {"type": "thought", "text": str(message["content"])[:400]}
            if not calls:
                break
            messages.append({"role": "assistant", "content": message.get("content") or "", "tool_calls": calls})
            for call in calls:
                name = call["function"]["name"]
                try:
                    args = json.loads(call["function"].get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                eid = f"E{len(evidence) + 1}"
                t0 = time.time()
                try:
                    result = toolbox.call(name, args)
                    ok = True
                except Exception as exc:  # report tool failures to the model instead of crashing
                    result, ok = {"error": str(exc)}, False
                ms = round((time.time() - t0) * 1000)
                evidence[eid] = {"tool": name, "args": args, "result": result, "ok": ok, "ms": ms}
                yield {"type": "tool", "step": step + 1, "id": eid, "tool": name, "args": args, "ok": ok, "ms": ms, "preview": _preview(name, result)}
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps({"evidence_id": eid, **result}, default=str)[:12000]})

        yield {"type": "status", "text": "Writing the cited briefing and community alerts…"}
        log = "\n".join(f"{eid} = {e['tool']}({json.dumps(e['args'])}): {json.dumps(e['result'], default=str)[:6000]}" for eid, e in evidence.items())
        briefing, meta = meta_client.chat_json(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": "EVIDENCE LOG (cite ids like E1 in every situation and watchlist item; copy numbers exactly):\n"
                    f"{log}\n\nWrite the flood-watch briefing. Alerts: plain, calm, actionable SMS text for residents in each "
                    "language, naming the place and what to do; never claim to be an official warning.",
                },
            ],
            BRIEFING_SCHEMA,
            "flood_watch_briefing",
        )
        add_usage(meta)
        verification = verify(briefing, evidence)
        result = {
            "briefing": briefing,
            "verification": verification,
            "evidence": evidence,
            "model": meta["model"],
            "usage": usage,
            "tool_calls": len(evidence),
            "seconds": round(time.time() - started, 1),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        with _latest_lock:
            _latest = result
        yield {"type": "final", **result}
    except meta_client.MetaAPIError as exc:
        yield {"type": "error", "text": str(exc), "detail": exc.detail}


def _preview(name: str, result: dict) -> str:
    if "error" in result:
        return result["error"]
    if name == "get_hazards":
        near = result["near_philippines"]
        return f"{len(near)} event(s) near the Philippines" + (f", nearest: {near[0]['name']} ({near[0]['distance_to_ph_km']} km)" if near else "")
    if name == "list_ph_basins":
        b = result["basins"]
        return f"{len(b)} basins · {sum(x['trend_3d'] == 'rising' for x in b)} rising · max {max(x['peak_pct_of_watch'] for x in b)}% of Watch"
    if name == "get_basin":
        return f"{result['name']}: level {result['level']}, Watch at {result['alert_levels_m3s']['advisory']} m³/s"
    if name == "get_rain_forecast":
        return f"{result['place']}: {result.get('next_24h_mm')} mm next 24 h, {result.get('next_72h_mm')} mm next 72 h"
    if name == "list_gauges":
        g = result["gauges"]
        return f"{len(g)} gauges · {sum((x['risk'] or 'normal') != 'normal' for x in g)} need attention"
    if name == "get_gauge":
        return f"{result['name']}: {result['level_now_m']} m now"
    return ""
