# Hackathon readiness

Event: Meta Global AI Developer Hackathon 2026
Deadline: Wednesday, November 4, 9:00 PM ET (Thursday, November 5, 10:00 AM Philippine Time)
Checked: November 3, 2026
Team: Precious Grace Deborah Manucom (GitHub: Debb1ie)

## 1. Disqualification checklist

| Check | Status | Notes |
|---|---|---|
| Repository is public | Pass | https://github.com/Debb1ie/Meta-AI |
| README works from a clean clone | Pass, once pushed | `README.md` is written on `ui-redesign`. Setup uses `uv sync` and `npm install` with no private steps. Remote `main` still has only the old `frontend/README.md` until the branch is published. |
| New work clearly identified | Pass | `HACKATHON.md` lists every commit. The first commit is dated November 1, 2026, so all of the work falls inside the October 27 to November 4 window. No earlier code was reused. |
| Meta models are actually used | Pass | Muse Spark (`muse-spark-1.3`), SAM 3.1 (`sam-3.1`) and Muse Image (`muse-image-1.0`) through the Meta Model API. The live `/api/ai/status` reports all three as configured. File-level detail is in the table below. |
| Fits a problem statement | Pass | "Build for Your World": flood early warning for communities in the Philippines. |
| Not on the anti-project list | Pass | It isn't medical, political or a simple chatbot. The photo check is one small feature inside a larger early-warning system, not a standalone image analyser. |
| Rights to code, data and assets | Pass | Data: GloFAS via Open-Meteo (CC BY 4.0), UK Environment Agency (Open Government Licence v3), GDACS (free with attribution), Open-Meteo weather (CC BY 4.0). Map outline: Natural Earth (public domain) via world-atlas (ISC). Fonts: Fraunces, Public Sans and Geist Mono (SIL Open Font License). Icons are hand-written SVG. The demo CSV is synthetic and made by the team. |
| Live demo reachable without login | Pass, with one caveat | No login on any page. The live site is one deploy behind the branch (see `reports/security.md`, H1). |

### Meta models: where they are called

| Model | Called in | What it does |
|---|---|---|
| Muse Spark `muse-spark-1.3`, native tool calling | `backend/app/ai/meta_client.py` `chat_tools`, used by `backend/app/ai/agent.py:368` | The flood-watch agent. It decides which of six read-only tools to call (hazards, basin list, one basin, rain forecast, gauge list, one gauge), for up to 8 steps, and keeps an evidence log. |
| Muse Spark `muse-spark-1.3`, structured JSON | `meta_client.chat_json`, used by `agent.py:396` and `backend/app/ai/analyst.py:191` | Writes the schema-constrained briefing with a citation on every claim and SMS text in five languages, and answers Ask questions in English, Filipino or Taglish. |
| SAM 3.1 `sam-3.1` | `meta_client.segment_image_raw`, used by `backend/app/ai/segmentation.py:127` | Segments the water in a field photo and returns the flooded share of the frame with a mask overlay. |
| Muse Image `muse-image-1.0` | `meta_client.generate_image`, used by `backend/app/api/ai.py:88` and `:161` | Makes preparedness and alert posters matched to the day's alert level. |

## 2. Rubric scores

| Category | Weight | Score | Reasoning |
|---|---|---|---|
| Impact | 30% | 8/10 | A clear user (barangay and municipal DRRM offices, LGU planners, families) and a real, recurring problem: about 20 tropical cyclones enter the Philippine Area of Responsibility each year. It covers 17 basins across the country, sends SMS-ready text in five languages and always points to PAGASA. It loses points because it has not been tested with a real DRRM office yet. |
| Use of Meta AI tooling | 25% | 8/10 | Three Meta models in four jobs, including native tool calling, structured output and SAM 3.1 segmentation, far beyond a single call. The verification layer checks the model's numbers. It does not yet use voice transcription or open-weight models. |
| Technical depth and execution | 20% | 9/10 | 68 backend tests, server-side number verification (24 of 24 numbers on the November 3 run and 7 of 7 on the November 4 run), backtested forecasting with three competing models and conformal intervals, admin key, rate limits, CSP, a privacy page and full security, fact-check and anomaly reports. |
| Demo | 25% | 7/10 | Live, no login, and visual: the agent trace, a 3D forecast layer and posters. Risks: the free Render instance can be slow on first load, and the live site needs the latest deploy. Both are fixable before recording. |
| Weighted total | | **7.9/10** | |

## 3. Top three improvements for the time left

1. **Publish and deploy `ui-redesign` (about 20 minutes, highest impact).** It closes the live security gap, puts the Research page, privacy page, README and reports online, and fixes the four links that 404 today (`/privacy`, `/research`, the demo CSV and `/tree/main/reports`). This needs your approval because it replaces the public `main` history.
2. **Record the demo with a warm backend (about 45 minutes).** Open the API five minutes before recording, run the agent once so a fresh briefing is cached, then follow `reports/demo-script.md`. Keep the cached briefing as the fallback if the live run is slow.
3. **State the date format in the CSV checker (about 10 minutes of copy, or about 30 with code).** Day-first dates such as 03/11/2026 are read month-first today (see `reports/anomalies.md`). At minimum, say "Use ISO dates, for example 2026-11-03 14:00" in the template and the import panel.

## 4. Users in the Philippines and internationally

| Item | Status |
|---|---|
| English by default | Yes |
| Filipino and Taglish input | Yes. Ask answers in the language of the question; a Taglish test with special characters returned a correct Filipino answer. |
| SMS in local languages | Filipino, Cebuano, Ilocano, Hiligaynon and English |
| Times with a time zone | Yes, shown in Philippine Time |
| Mobile | PWA with a service worker; the main pages work at phone width |
| Accessibility | The status map uses shape and colour, there is alt text on the photo tools, and the 3D view respects reduced motion |
| International path | The same pipeline already runs on 10 UK Environment Agency gauges, which shows it works on any country with open gauge data |

## 5. Bonus prizes

| Prize | Fit | Why |
|---|---|---|
| Best Agentic Use-Case | Strong | A multi-step Muse Spark agent with six tools, an evidence log, cited claims and server-side verification of every number. |
| Best Creative Build | Good | Muse Image makes community posters matched to the day's alert level. |
| Most Viral | Possible | Post the demo video on X with a short clip of the agent trace and the 3D layer, then submit the link. |
| Community Vote | Possible | Share the gallery link with Philippine developer and DRRM communities. |
| Best Build on Meta Open Weight Models | Not eligible | Every model runs through the hosted Meta Model API. |
