# Built during the hackathon

Event: Meta Global AI Developer Hackathon 2026 (October 27 to November 4, 2026)
Team: Precious Grace Deborah Manucom (GitHub: Debb1ie)

## What existed before

Nothing. The first commit is dated November 1, 2026. All code, data pipelines, documents and assets in this repository were created during the hackathon. Third-party open-source libraries and open datasets are listed in the README with their licences.

## What was built

### November 1: foundation

- FastAPI backend with a forecasting engine: CSV validation, resampling, feature building, and three competing models (persistence, damped trend, gradient boosting) with backtesting and calibrated uncertainty ranges.
- Next.js frontend with the first dashboard.
- First Meta AI features: the SAM 3.1 photo check, Muse Spark Ask and Muse Image preparedness graphics.
- The HydroSentinel command center: 17 Philippine basins from GloFAS v4, UK Environment Agency gauges and an installable PWA.

### November 2: deployment

- Render blueprint (`render.yaml`) for the API and a Next.js upgrade for Vercel.

### November 3: agent, security and research

- **Verifiable flood-watch agent.** Muse Spark with native tool calling over six tools, an evidence log, a schema-constrained briefing, SMS in five languages and server-side verification of every number.
- **Live hazard feeds.** GDACS typhoon and flood alerts, and Open-Meteo rain forecasts as agent tools.
- **Alert posters.** Muse Image posters matched to the briefing's alert level.
- **Credit protection.** An agent cooldown and daily cap, a cached last briefing during outages, and an 8,000-token output cap.
- **Security hardening.** An admin key for data-changing routes, per-IP and global rate limits on AI routes, untrusted-data handling in prompts, CSP and browser security headers, and a privacy page under RA 10173.
- **Keep-awake ping.** A GitHub Action that keeps the free Render instance warm.
- **Landing page.** A plain-language river status card, an outline map of the 17 basins, and sections on who it helps, Meta AI, trust and things to try.
- **Demo scenario CSV.** A synthetic Marikina typhoon with real-world gaps and nulls, for the data checker.
- **Research page and endpoint.** A three.js 3D forecast layer, a heat map, the full methodology and live evaluation with the real model parameters.
- **Hackathon review skills and reports.** Security, readiness, fact-check and anomaly reports in `reports/`, and product documents in `docs/product/`.

### November 4: plain language, analytics and fixes

- **Plain-language Muse Spark.** A shared style guide for the agent and Ask: answer first, everyday words, numbers given meaning, no tool names or error codes. Ask now replies in the user's language with a status, key points and what to do. The number check still passes (7 of 7 on the first run with the new prompts).
- **Analytics tab.** Held-out forecast skill, interval coverage and model selection per horizon, with a waiting state while the server re-syncs after a restart.
- **Fixes.** Flood outlook map and forecast peak, keyless map tiles, and the live commit shown in `/api/health`.

## Tools used

Code was written with help from AI coding assistants (Claude Code and GitHub Copilot); commits they co-authored say so in the commit message. The project's Claude Code review skills are shared in `.claude/skills`.

## Commit log

Every commit on the submission branch up to this update, oldest first.

| Date | Commit |
|---|---|
| 2026-11-01 | Initial commit: HydroSentinel backend and frontend |
| 2026-11-01 | Add HydroSentinel command center with live data, Meta AI and PWA |
| 2026-11-02 | Add Render blueprint and upgrade Next.js for deployment |
| 2026-11-03 | Add verifiable flood-watch agent, live hazard feeds and alerts |
| 2026-11-03 | Add keep-awake ping for the Render backend |
| 2026-11-03 | Animate the landing page in 3D and add motion to the dashboard |
| 2026-11-03 | HydroSentinel command center: live data, Meta AI agent, PWA |
| 2026-11-03 | Protect Meta API credits and keep the last briefing through outages |
| 2026-11-03 | Fix stale-cache crash and redesign the loop as a 3D orb |
| 2026-11-03 | Require an admin key for data-changing endpoints and rate-limit AI calls |
| 2026-11-03 | Treat tool and feed data as untrusted in model prompts |
| 2026-11-03 | Add browser security headers and an admin key field |
| 2026-11-03 | Make every feature visible without scrolling to find it |
| 2026-11-03 | Add hackathon review skills |
| 2026-11-03 | Cap model output tokens and document ADMIN_TOKEN |
| 2026-11-03 | Redesign the landing hero as a plain-language river status card |
| 2026-11-03 | Use sentence case and calm motion across the dashboard |
| 2026-11-03 | Add a downloadable demo scenario CSV |
| 2026-11-03 | Stop tracking the runtime SQLite database |
| 2026-11-03 | Give the river chart a fixed height and HTML labels |
| 2026-11-03 | Add impact, Meta AI, trust and try-it sections to the landing page |
| 2026-11-03 | Add a research endpoint with live evaluation and real parameters |
| 2026-11-03 | Add a Research page with a 3D forecast layer and full methodology |
| 2026-11-03 | Fix the landing header and footer on phones and tablets |
| 2026-11-03 | Add README, hackathon notes, PRD, architecture, ADRs, RFCs and test plan |
| 2026-11-03 | Add security, readiness, fact-check and anomaly reports with demo script and submission answers |
| 2026-11-03 | Keep local editor tooling out of the repository |
| 2026-11-03 | Bring back the 3D hero scene with live data and give the river status card its own section |
| 2026-11-03 | Add a 3D flood layers tab: terrain, rainfall, river flow, forecast peak and a flood-watch index |
| 2026-11-03 | Document the 3D flood layers and refresh the README screenshots |
| 2026-11-03 | Share the project's Claude Code skills in the repository |
| 2026-11-04 | Fix flood outlook map and forecast peak |
| 2026-11-04 | Use keyless realistic map tiles |
| 2026-11-04 | Make Muse Spark replies plain-language and add Analytics tab |
| 2026-11-04 | Escape apostrophe in briefing label to fix the Vercel build |
| 2026-11-04 | Show live commit in /api/health; align analyst rules with plain-language guide |
| 2026-11-04 | Analytics: four-column tile row and a waiting state that retries |

To check this yourself: `git log --since=2026-10-27 --reverse --format="%ad %an %s" --date=short`

## Meta models used

| Model | File | Purpose |
|---|---|---|
| Muse Spark `muse-spark-1.3` | `backend/app/ai/agent.py`, `backend/app/ai/analyst.py` via `backend/app/ai/meta_client.py` | Tool-calling agent, verified briefing, SMS and Ask |
| SAM 3.1 `sam-3.1` | `backend/app/ai/segmentation.py` | Flood share of a field photo |
| Muse Image `muse-image-1.0` | `backend/app/api/ai.py` | Preparedness and alert posters |
