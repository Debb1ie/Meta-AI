# Anomaly sweep

Run: November 3, 2026, against the `ui-redesign` branch and the live API at https://hydrosentinel-ph-api.onrender.com
Covers: consistency across pages, edge-case inputs, runtime health and data anomalies.

## Summary

| Group | Items |
|---|---|
| Fixed | 6 |
| Needs decision | 4 |
| Known limitation | 6 |

## What was tested

### Edge-case inputs to Ask (`POST /api/ai/analyst`)

| Input | Result | Verdict |
|---|---|---|
| Empty question | 422 | Correct |
| One character | 422 (minimum is 3) | Correct |
| 10,000 characters | 422 (maximum is 2,000). The response repeats the whole input. | Correct status; see "Needs decision" 2 |
| Missing body | 422 | Correct |
| Malformed JSON | 422 | Correct |
| Unknown station ID | 404 | Correct |
| Taglish with "ñ" and an emoji: a question about a Philippine river | 200. A correct answer in Filipino, grounded in the basin data and labelled as a model, not an official warning | Correct |
| Seven requests in one minute, including invalid ones | The seventh returns 429 with `Retry-After` | Correct; see "Needs decision" 3 |

### CSV checker (`POST /api/data/preview`)

| Input | Result | Verdict |
|---|---|---|
| Demo file `demo-scenario-marikina-typhoon-synthetic.csv` | 264 valid rows, 1 duplicate flagged, gaps and nulls reported | Correct |
| Empty file | Clear message saying the file is empty | Correct |
| Malformed file (ragged rows) | Rejected. The message shows the raw parser text. | Works; wording is rough (see `reports/security.md`, L2) |
| A file of odd values (impossible readings, out-of-range dates, text in number columns) | Each bad row rejected with its own issue code | Correct |
| Day-first dates: `03/11/2026 10:00` and `13/11/2026 10:00` | The first was read as March 11; the second was flagged `future_timestamp` instead of being read as November 13 | Wrong; see "Needs decision" 1 |

### Consistency

| Check | Result |
|---|---|
| Basin count | 17 everywhere: landing page, dashboard, Research page, agent tool description |
| Languages | The same five everywhere: English, Filipino, Cebuano, Ilocano, Hiligaynon |
| Alert level names and colours | Same order and colours on the map, the outlook, the 3D layer and the heat map |
| Years and dates | 2026 throughout; privacy page dated November 3, 2026; all times shown in Philippine Time |
| Placeholder text | None found |

### Runtime health

| Check | Result |
|---|---|
| Backend tests | 68 passed (re-run November 4) |
| `GET /api/ai/status` | All three Meta models configured |
| Live agent briefings | November 3: 7 claims, 24 of 24 numbers verified. November 4: 6 claims, 7 of 7 verified. No unknown evidence IDs |
| Links on the landing page | All return 200, except four that exist only on the unpublished branch: `/privacy`, `/research`, the demo CSV, and `/tree/main/reports` on GitHub. They will resolve after the deploy. The map tile URL is a template, not a page, so it isn't expected to return 200 on its own. |
| Keep-awake | A GitHub Action pings the API every 10 minutes to reduce cold starts |

## Fixed

These were found and fixed during the hackathon. Each item is its own commit on `ui-redesign`; the commit title is quoted.

1. **A crash from stale cached data**: "Fix stale-cache crash and redesign the loop as a 3D orb".
2. **The briefing disappearing during a Meta API outage**: "Protect Meta API credits and keep the last briefing through outages".
3. **The runtime SQLite database tracked in git**: "Stop tracking the runtime SQLite database".
4. **The river chart's layout**: "Give the river chart a fixed height and HTML labels".
5. **Inconsistent capitalisation and busy motion**: "Use sentence case and calm motion across the dashboard".
6. **Features hidden below the fold**: "Make every feature visible without scrolling to find it".

No new code fixes were made during this sweep. The items below change behaviour in the demo flow, so they need your decision first.

## Needs decision

### 1. Day-first dates are read month-first

- **Where:** `backend/app/forecasting/preprocessing.py:90` and `:97` call `pd.to_datetime(..., format="mixed")` without `dayfirst`.
- **What happens:** Most people in the Philippines write 03/11/2026 for November 3. The checker reads it as March 11. Any day above 12 is then rejected as a future timestamp.
- **Suggested fix (pick one):**
  - **Smallest:** accept ISO 8601 only (`2026-11-03 10:00`) and reject anything else with "Use dates like 2026-11-03 10:00". State the format in the template (`GET /api/data/template`) and in the import panel (`frontend/src/app/featured/tools.tsx`).
  - **Friendlier:** add a "Day first / Month first" choice to the import panel, pass it as a form field and call `pd.to_datetime(..., dayfirst=True)` when day first is chosen. Default to day first for Philippine users.
- **Demo impact:** none if you use the demo CSV, which already uses ISO dates.

### 2. Validation errors repeat the input

- **Where:** FastAPI's default handler, `backend/app/main.py`.
- **What happens:** A 10,000-character question returns a 422 containing all 10,000 characters.
- **Suggested fix:** register a `RequestValidationError` handler that returns only `loc`, `msg` and `type` for each error.

### 3. Invalid requests use up the rate limit

- **Where:** `backend/app/security.py`, `rate_limit` runs before body validation.
- **What happens:** Six bad requests in a minute block the seventh request, even a valid one.
- **Suggested decision:** keep it. It slows down anyone probing the API. The UI validates input before sending, so normal users won't hit it.

### 4. Next.js 16 upgrade for the postcss and sharp advisories

- **Where:** `frontend/package.json`.
- **What happens:** `npm audit` reports runtime advisories that are only fixed in Next 16 (details in `reports/security.md`, M1 and M2).
- **Suggested decision:** upgrade after the deadline. The risk is low because all CSS is first-party and `next/image` isn't used, while a major upgrade the night before judging could break the demo.

## Known limitation

1. **Free hosting sleeps.** The Render free plan stops idle services. The keep-awake ping reduces this, but the first request after a long idle period can still take 30 to 60 seconds. Open the API before a demo.
2. **Philippine river flow is modelled, not measured.** GloFAS provides modelled daily discharge on a global grid. Open real-time Philippine gauge data isn't available, so measured gauges come from the UK Environment Agency to test the forecasting engine against reality. Every page says which is which.
3. **Alert levels are statistical, not official.** Watch, warning and critical levels are percentiles of each river's last five years. They aren't PAGASA warning levels, and the app says so.
4. **The demo CSV is synthetic.** The Marikina typhoon scenario is generated by the team, and its file name says so. It contains deliberate gaps, nulls and one duplicate to show the checker working.
5. **Rate limits reset on restart.** Counters are kept in memory on a single instance.
6. **The agent's language quality varies.** SMS text in Ilocano and Hiligaynon has not been reviewed by native speakers yet.
