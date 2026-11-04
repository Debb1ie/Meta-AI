# Fact-check

Checked: November 3, 2026
Scope: every factual claim a visitor or judge reads on the landing page, the dashboard, the Research page and the privacy page, plus the claims the model makes at runtime.

Status key:
- VERIFIED: checked against the source or the code.
- PARTLY: true in the code on `ui-redesign`, but not yet true on the live site.
- UNSUPPORTED: no source found.
- WRONG: contradicted by the source.

No claim was found UNSUPPORTED or WRONG.

## Pass 1: static claims

| Claim | Location | Status | Source | Fix |
|---|---|---|---|---|
| An average of 20 tropical cyclones enter the Philippine Area of Responsibility each year | `frontend/src/app/page.tsx:134` | VERIFIED | PAGASA, Tropical Cyclone Information page, linked inline | None |
| 17 Philippine basins, from the Cagayan in the north to the Mindanao River in the south | `page.tsx:11`, `page.tsx:34`, `landing.tsx:186` | VERIFIED | `backend/app/providers/glofas.py` basin list; agent tool `list_ph_basins` (`backend/app/ai/agent.py:104`) | None |
| Alert levels are based on each river's own five-year record | `page.tsx:34` | VERIFIED | `glofas.py:8` and `:91`: the 95th, 99th and 99.8th percentiles of the last five years of daily discharge | None |
| 30-day flow outlook | `page.tsx:34`, `page.tsx:64` | VERIFIED | GloFAS v4 via the Open-Meteo Flood API, which serves the forecast window the app shows | None |
| SMS alerts in five Philippine languages | `page.tsx:21` | VERIFIED | `agent.py:29`: English, Filipino, Cebuano, Ilocano and Hiligaynon. English is an official language of the Philippines under the 1987 Constitution. | None |
| The agent decides which of six tools to call | `landing.tsx:137` | VERIFIED | `agent.py:103-108` defines exactly six tools | None |
| Measured gauges updated every 15 minutes | `landing.tsx:101`, `landing.tsx:188` | VERIFIED | The UK Environment Agency publishes 15-minute readings; `live_refresh_minutes` defaults to 15 (`backend/app/config.py:34`) | None |
| Three models compete for each forecast horizon against a no-change baseline | `page.tsx:50` | VERIFIED | `backend/app/forecasting/models.py`: persistence, damped trend (damping 0.85) and HistGradientBoosting, scored on a held-out chronological split | None |
| The server checks every number in the briefing | `page.tsx:46`, `landing.tsx:185`, `river-status.tsx:211` | VERIFIED | `agent.py` verification step; tests `test_verify_*` in `backend/tests/test_agent.py`; live briefings verified 24 of 24 numbers on the November 3 run and 7 of 7 on the November 4 run | None |
| Built with Muse Spark, SAM 3.1 and Muse Image through the Meta Model API | `page.tsx:121` | VERIFIED | Live `GET /api/ai/status` returns `muse-spark-1.3`, `sam-3.1` and `muse-image-1.0` as configured | None |
| Photos go to SAM 3.1 and are not stored by HydroSentinel | `landing.tsx:154`, `privacy/page.tsx:26` | VERIFIED | `backend/app/ai/segmentation.py` opens and resizes the image in memory and never writes it to disk or the database. | Optional: add one line to the privacy page saying the copy sent to the Meta Model API is handled under Meta's terms |
| Posters: nothing you type is sent | `privacy/page.tsx:27` | VERIFIED | The poster buttons send only the alert level and the basin name from the briefing (`frontend/src/app/featured/agent.tsx:248`). The API's `place` field accepts free text from direct callers; see `reports/security.md`, L6. | None for the claim |
| Model keys never reach the browser | `page.tsx:58` | VERIFIED | The key is read only in `backend/app/ai/meta_client.py`; the built frontend bundle contains only the variable name inside help text | None |
| Changing alert levels needs an admin key; AI features are rate-limited; strict security headers | `page.tsx:58` | PARTLY | True in `backend/app/security.py` and `frontend/next.config.ts`. The live API still runs the older build (`reports/security.md`, H1). The sentence itself is only on the new landing page, so it goes live with the fix. | Deploy `ui-redesign` |
| Data licences: GloFAS via Open-Meteo (CC BY 4.0), UK Environment Agency (OGL v3) | `page.tsx:271` | VERIFIED | Open-Meteo licence page; Environment Agency real-time data API terms | None |
| Data Privacy Act of 2012 (Republic Act No. 10173) | `privacy/page.tsx:39` | VERIFIED | Official Gazette, RA 10173 | None |
| Official warnings come from PAGASA, NDRRMC and local DRRM offices | `privacy/page.tsx:48`, `page.tsx:39` | VERIFIED | These are the mandated warning agencies in the Philippines | None |
| Copyright and event year 2026; privacy page "Last updated November 3, 2026" | `page.tsx:269`, `privacy/page.tsx:14` | VERIFIED | Current date | None |
| No placeholder text (lorem ipsum, TODO, example.com, fake numbers) | Whole frontend | VERIFIED | Repository search found none | None |

## Pass 2: claims the model makes at runtime

| Risk | Protection in place | Status |
|---|---|---|
| The model invents or misreads a number | Every claim must cite an evidence ID from the tool log. The server extracts each number and compares it with the cited tool result, using a tolerance of the larger of 0.051 and 2%. Mismatches are shown as unverified next to the briefing. | In place |
| The model cites evidence that doesn't exist | Unknown evidence IDs are listed in `verification.unknown_evidence_ids`, and the score drops | In place |
| The model presents a forecast as an official warning | The system prompts require the text to say it is a model and to point to PAGASA and local authorities. The UI labels every briefing "Briefing by Muse Spark". | In place |
| Instructions hidden in feed data | Tool results are wrapped and described as untrusted data in both system prompts (`agent.py:44`, `analyst.py:13`) | In place |
| Links invented by the model | The model output schema has no URL fields. Source links in the UI come from fixed code, not the model. | In place |
| Medical, legal or financial advice | Not in scope. Answers are about river flow, rain and preparedness steps, and the prompts point to official agencies. | No risk found |
| Stale data presented as current | Each tool result carries its data timestamp, and the briefing shows when it was generated in Philippine Time. A repeat run within the cooldown returns the stored briefing marked `cached: true` with its original time (`backend/app/api/ai.py:112-117`). | In place |

## Proposed runtime changes, ranked by impact versus effort

1. **Show the verification score next to the SMS text, as well as the briefing (high impact, low effort).** People forward the SMS on its own, so it should carry the same "numbers checked" signal.
2. **Re-run the agent when verification falls below 100% (medium impact, low effort).** Run it once more with the list of unverified numbers before showing the briefing. This costs one extra call only when something is wrong.
3. **Add a fixed footer to every SMS (medium impact, low effort):** "Model guidance. Follow PAGASA and your LGU." This makes the warning hold even if the model drops it.

These change prompts or app logic, so they are proposals only and have not been applied.
