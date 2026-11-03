---
type: AD
id: "0001"
title: "HydroSentinel system architecture"
status: Approved
version: "1.0.0"
created: "2026-11-03"
updated: "2026-11-03"
author: "Debb1ie"
architect: "Debb1ie"
related_docs:
  - "PRD-0001"
  - "TP-0001"
related_adrs:
  - "ADR-0001"
  - "ADR-0002"
  - "ADR-0003"
  - "ADR-0004"
  - "ADR-0005"
  - "ADR-0006"
  - "ADR-0007"
related_rfcs:
  - "RFC-0001"
  - "RFC-0002"
components:
  - "frontend (Next.js 15 PWA)"
  - "backend/app/api"
  - "backend/app/providers"
  - "backend/app/forecasting"
  - "backend/app/risk.py"
  - "backend/app/ai"
  - "backend/app/security.py"
approvals:
  architect: { name: "Debb1ie", date: "2026-11-03", approved: true }
  tech_lead: { name: "Debb1ie", date: "2026-11-03", approved: true }
changelog:
  - version: "1.0.0"
    date: "2026-11-03"
    author: "Debb1ie"
    summary: "Initial architecture document"
---

# AD-0001: HydroSentinel system architecture

**Architect:** Debb1ie | **Status:** Approved | **Version:** 1.0.0

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document Type | Architecture Document (AD) |
| Version | 1.0.0 |
| Last Updated | 2026-11-03 |
| Architect | Debb1ie |

---

## Document Changelog

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0.0 | 2026-11-03 | Debb1ie | Initial architecture document |

---

## Overview

### Purpose
This document describes how HydroSentinel is built: the two deployable parts, the data sources they read, how readings become forecasts and risk levels, how the Muse Spark agent is made verifiable, and how the system is secured and hosted.

### Scope
In scope: the Next.js frontend in `frontend/`, the FastAPI backend in `backend/app/`, their hosting on Vercel and Render, and their external data and model providers. Out of scope: the providers' own systems, and official warning systems run by PAGASA and DRRM offices.

### Audience
- Architects
- Technical Leads
- Software Engineers
- Reviewers checking how the agent's numbers are verified

### Related Documents

| Document | Type | Relationship |
|----------|------|--------------|
| [PRD-0001](../product/PRD-0001-hydrosentinel.md) | PRD | Product requirements this architecture serves |
| [RFC-0001](../engineering/RFC-0001-verifiable-flood-watch-agent.md) | RFC | Detailed design of the agent and verifier |
| [RFC-0002](../engineering/RFC-0002-research-3d-forecast-layer.md) | RFC | Detailed design of the research page and 3D view |
| [TP-0001](../engineering/TP-0001-test-plan.md) | TP | How the architecture is tested |
| [ADR-0001 to ADR-0007](ADRs/) | ADR | Decisions recorded in the Decision Log below |

---

## Architecture Principles

| Principle | Description | Rationale |
|-----------|-------------|-----------|
| Separation of Concerns | Providers fetch, forecasting predicts, risk classifies, AI explains, API serves | Each part can be tested on its own (see TP-0001) |
| Loose Coupling | Frontend and backend talk only through the JSON API under `/api` | They deploy independently on Vercel and Render |
| Every number has a source | Readings keep their provider; agent claims cite tool results and are checked | Trust is the product (ADR-0003) |
| Measure before you claim | Forecast models are scored on unseen data against persistence | Honest uncertainty (PRD business rules) |
| Secrets stay on the server | Model keys and the admin key exist only in backend environment variables | The browser never holds a credential (ADR-0004) |
| Degrade, do not fail | Each provider failure is isolated and cached data is served with its age | Storms are when providers are slowest |
| Low cost by default | Free hosting tiers, caching and a bounded agent budget | A public demo must not run up model or hosting bills |

---

## System Context

### Context Diagram

```
                 +-----------------------------------------+
                 |  Users: DRRM offices, LGU planners,     |
                 |  families, researchers (browser / PWA)  |
                 +--------------------+--------------------+
                                      |
                                      v
                 +--------------------+--------------------+
                 |  Vercel: Next.js 15 frontend + sw.js    |
                 +--------------------+--------------------+
                                      | HTTPS JSON (/api/...)
                                      v
                 +--------------------+--------------------+
                 |  Cloudflare -> Render: FastAPI backend  |
                 |  api | providers | forecasting | risk   |
                 |  ai  | security  | SQLite               |
                 +---+--------+--------+--------+-------+--+
                     |        |        |        |       |
                     v        v        v        v       v
               Open-Meteo  UK EA    GDACS  Open-Meteo  Meta Model API
               Flood API   flood    alerts rainfall    (Muse Spark,
               (GloFAS)    monitor                     SAM 3.1, Muse Image)
```

### External Systems

| System | Integration Type | Purpose | Data Exchanged |
|--------|------------------|---------|----------------|
| Open-Meteo Flood API (GloFAS v4) | REST, polled, 3 h cache | Philippine outlook | Daily river discharge for 17 basins: 30 days history, 30 days forecast, 5-year climatology |
| UK Environment Agency flood-monitoring API | REST, polled every 15 min | Live gauges and UK warnings | Hourly stage readings and stage-scale thresholds for 10 stations |
| GDACS | REST/feed, cached | Active cyclones and floods | Event type, position, alert level |
| Open-Meteo forecast API | REST | Rainfall | Hourly precipitation forecasts at basins and gauges |
| Meta Model API | REST (OpenAI-style chat and tools) | Agent, analyst, segmentation, images | Prompts with tool results; JSON briefings; masks; images |
| Esri Gray Canvas tiles | HTTPS tiles | Basemap | Map tiles (fetched by the browser) |
| GitHub Actions | Scheduled HTTP ping | Keep the free Render instance awake | GET `/api/health` every 10 minutes |

---

## Component Architecture

### Component Diagram

```
+------------------------------------------------------------------+
|                         HydroSentinel                            |
+------------------------------------------------------------------+
| Frontend (frontend/src/app)                                      |
|   page.tsx + landing.tsx + river-status.tsx   (landing)          |
|   featured/  agent | ask | outlook | map | diagnostics | tools   |
|   research/  page | view | flow3d (three.js)                     |
|   error.tsx  pwa-register.tsx  manifest.ts  public/sw.js         |
+-------------------------------+----------------------------------+
                                | fetch /api/...
+-------------------------------v----------------------------------+
| Entrypoint: app/main.py (lifespan, _live_loop, middleware)       |
|   api/stations.py  api/data.py  api/ai.py  api/research.py       |
+-------------------------------+----------------------------------+
| Components                                                        |
|   providers/  uk_ea | glofas | hazards | open_meteo              |
|   forecasting/ preprocessing | models | pipeline                 |
|   risk.py   services.py   ai/ agent | analyst | segmentation     |
|   security.py (admin key, rate limits, headers)                  |
+-------------------------------+----------------------------------+
| Infrastructure: SQLite (SQLModel), ai/meta_client.py, httpx      |
+------------------------------------------------------------------+
```

### Components

#### Entrypoint and scheduler

**Location:** `backend/app/main.py`

**Purpose:** Start the app, run background refreshes and apply middleware.

**Responsibilities:**
- On start-up, create tables, optionally seed demo data and start the background loop.
- `_live_loop` (a background thread): every `live_refresh_minutes` (15) sync the UK gauges, refresh the Philippine outlook, warm the forecasts and call `_maybe_run_agent`.
- `_maybe_run_agent`: start an agent run when the last briefing is older than `agent_autorun_hours` (3).
- Apply `SecurityHeaders` and CORS (exact origins plus `cors_origin_regex`).

**Interfaces:**
```python
async def lifespan(app: FastAPI)                 # starts and stops the background thread
def _live_loop(stop: threading.Event) -> None     # background thread
def _refresh_outlook() -> None
def _warm_forecasts() -> None
def _maybe_run_agent() -> None
@app.get("/api/health")
def health() -> dict
```

**Dependencies:**
- `services`, `providers.glofas`, `forecasting.pipeline`, `ai.agent`, `security`

#### API layer

**Location:** `backend/app/api/`

**Purpose:** The JSON contract the frontend uses.

**Responsibilities:**
- `stations.py`: `GET /api/stations`, `GET /api/stations/{station_id}`, `GET /api/stations/{station_id}/export.csv`, `PUT /api/stations/{station_id}/thresholds` (admin), `GET /api/overview`.
- `data.py`: `GET /api/datasets`, `GET /api/data/template`, `POST /api/data/preview`, `POST /api/data/import` (admin), `POST /api/demo/reset` (admin), `POST /api/live/sync` (admin), `GET /api/sources`.
- `ai.py` (prefix `/api/ai`): `GET /status`, `POST /analyst`, `POST /agent/run`, `GET /agent/latest`, `POST /segment`, `POST /alert-poster`, `POST /preparedness-graphic`.
- `research.py`: `GET /api/outlook`, `GET /api/hazards`, `GET /api/research`.
- `main.py`: `GET /api/health` (used by the keep-alive job).

**Interfaces:**
```python
router = APIRouter(prefix="/api", tags=[...])  # FastAPI routers mounted in main.py
```

**Dependencies:**
- `security.require_admin`, `security.rate_limit(bucket)`, `services`, `providers`, `ai`

#### Providers

**Location:** `backend/app/providers/`

**Purpose:** Fetch and normalise external data.

**Responsibilities:**
- `uk_ea.py`: 10 gauges; thresholds derived from each station's stage scale.
- `glofas.py`: 17 Philippine rivers. `HISTORY_DAYS` 30, `FORECAST_DAYS` 30, `OUTLOOK_DAYS` 7, `CLIMATOLOGY_YEARS` 5, `TREND_LOOKBACK_DAYS` 3, `TREND_THRESHOLD` 0.15; alert levels at the 95th, 99th and 99.8th percentiles of the five-year daily record.
- `hazards.py`: GDACS events plus UK EA warnings; `AFFECTS_KM` 600 and `NEAR_KM` 2500 from the Philippine centre.
- `open_meteo.py`: rainfall forecasts.

**Interfaces:**
```python
def outlook() -> dict                                              # glofas, cached 3 h
def fetch_forecast(latitude: float, longitude: float) -> dict    # open_meteo
def fetch_rain_history(latitude: float, longitude: float, past_days: int) -> pd.DataFrame
```

**Dependencies:**
- `httpx`, `config.Settings` (`glofas_cache_seconds` = 3 h)

#### Forecasting engine

**Location:** `backend/app/forecasting/`

**Purpose:** Turn noisy hourly levels into forecasts with honest uncertainty.

**Responsibilities:**
- `preprocessing.py`: Hampel filter (`HAMPEL_WINDOW_H` 7, `HAMPEL_SIGMAS` 6.0); interpolate gaps up to `MAX_INTERPOLATION_GAP_H` 3 hours.
- `models.py`: persistence, damped trend (`TREND_DAMPING` 0.85) and HistGradientBoosting on `LEVEL_LAGS` and `RAIN_WINDOWS` features.
- `pipeline.py`: `HORIZONS` 1, 3, 6, 12, 24 h; chronological 70/10/20 train/calibration/test split; split-conformal 80% intervals; skill versus persistence; `MIN_HOURS_FOR_EVALUATION` 120, `MIN_HOURS_FOR_ML` 504, `BACKTEST_DAYS` 14.

**Interfaces:**
```python
def forecast_station(hourly: pd.DataFrame, random_state: int = 0) -> dict  # forecasts, intervals, metrics per horizon
```

**Dependencies:**
- `numpy`, `pandas`, `scikit-learn`

#### Risk classification

**Location:** `backend/app/risk.py`

**Purpose:** Turn readings and forecasts into a level with evidence.

**Responsibilities:**
- Levels `normal`, `advisory`, `warning`, `critical`; thresholds must satisfy advisory < warning < critical.
- Rules: an observed level at a threshold sets that level; a forecast within 6 h sets that level; a forecast at 12 to 24 h sets one level lower; the upper 80% bound within 6 h reaching warning sets at least advisory. The highest wins and every trigger is recorded.
- The frontend maps these to three words (ADR-0007): advisory is Watch; warning and critical are Alert.

**Interfaces:**
```python
def assess(...)                                     # thresholds, current level, forecasts -> level with evidence
def classify_trend(slope_m_per_h: float | None, steady_band: float = 0.02) -> str
```

**Dependencies:**
- None outside the standard library

#### AI layer

**Location:** `backend/app/ai/`

**Purpose:** Explain the data with Meta models, verifiably.

**Responsibilities:**
- `meta_client.py`: `chat_json` and `chat_tools` against the Meta Model API (`muse-spark-1.3`, `sam-3.1`, `muse-image-1.0`), with `meta_max_output_tokens` 8000.
- `agent.py`: tool-calling flood-watch agent (`MAX_STEPS` 8) with numeric verification; see RFC-0001.
- `analyst.py`: question answering and SMS drafts in five languages.
- `segmentation.py`: flood-photo segmentation with SAM 3.1.

**Interfaces:**
```python
def chat_json(messages, schema, schema_name, temperature=0.2) -> tuple[dict, dict]   # meta_client
def chat_tools(messages, tools, temperature=0.2) -> tuple[dict, dict]               # meta_client
def run(session: Session) -> Iterator[dict]                                        # agent steps, then the result
def verify(briefing: dict, evidence: dict[str, dict]) -> dict                       # agent
def ask(question: str, context: dict, history: list[dict] | None = None) -> dict   # analyst
def analyze_flood_photo(data: bytes, content_type: str, prompt: str = "floodwater") -> dict  # segmentation
```

**Dependencies:**
- `config.Settings` (`meta_model_api_key`, `agent_cooldown_minutes` 10, `agent_max_runs_per_day` 40)

#### Security

**Location:** `backend/app/security.py`

**Purpose:** Protect data-changing routes, limit AI cost and set headers.

**Responsibilities:**
- `require_admin`: compare `X-Admin-Token` with `ADMIN_TOKEN`; 401 when wrong, 403 when the server has no token.
- `rate_limit(bucket)`: per-client per-minute and per-day limits plus a global daily limit (`LIMITS`).
- `SecurityHeaders` middleware on every API response: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS, a restrictive `Permissions-Policy`, and `default-src 'none'` CSP outside the docs pages.

**Interfaces:**
```python
def require_admin(x_admin_token: str | None = Header(default=None)) -> None
def rate_limit(bucket: str)    # returns a FastAPI dependency
class SecurityHeaders(BaseHTTPMiddleware)
```

**Dependencies:**
- `config.Settings` (`admin_token`, `rate_limits_enabled`)

#### Frontend

**Location:** `frontend/src/app/`

**Purpose:** The landing page, the command centre, the research page and the PWA shell.

**Responsibilities:**
- `page.tsx`, `landing.tsx`, `river-status.tsx`: landing with live hero and river status card.
- `featured/`: agent, ask, outlook, map, diagnostics, system and tools tabs.
- `research/`: method parameters and the three.js 3D view (RFC-0002).
- `error.tsx`, `pwa-register.tsx`, `manifest.ts`, `public/sw.js`: resilience and offline behaviour (ADR-0006).
- `next.config.ts`: CSP and other security headers.

**Interfaces:**
```ts
fetch(`${API_URL}/api/...`)  // all data comes from the backend API
```

**Dependencies:**
- Next.js 15.5, React 19.1, three 0.186.1, Esri tiles, `ph-outline.ts` (Natural Earth)

---

## Data Architecture

### Data Model Overview

```
+-------------+ 1     * +-------------+        +-------------------+
|   Station   |---------|   Reading   |        | Agent briefing    |
| id, source, |         | time, level |        | (latest, saved)   |
| thresholds  |         | source      |        +-------------------+
+-------------+         +-------------+
      | 1                                       +-------------------+
      |  *                                      | Outlook cache     |
+-------------+                                 | (in memory, 3 h)  |
| Forecast    |  (computed per request/warm-up) +-------------------+
| horizon, p, |
| lo, hi,skill|
+-------------+
```

### Data Stores

| Store | Type | Purpose | Data Classification |
|-------|------|---------|---------------------|
| SQLite (`backend/data`) | Relational, SQLModel | Stations, readings, thresholds, saved agent briefing | Public open data; no personal data |
| In-process caches | Memory | GloFAS outlook (3 h), hazards, forecast warm-up | Public |
| Browser Cache Storage (`hs-v3-*`) | Service worker caches | Static assets, page shells, last API responses, map tiles | Public |

### Data Flow

1. `_live_loop` fetches UK gauges every 15 minutes and stores new readings with their source.
2. The GloFAS outlook is fetched at most every 3 hours and cached in memory.
3. The forecasting pipeline cleans each gauge series, trains and scores models per horizon and caches the result.
4. `risk.py` classifies each gauge from readings, forecasts and intervals.
5. The agent calls tools over these results, writes a briefing and the verifier checks it; the briefing is saved.
6. The frontend fetches JSON from `/api`, and the service worker keeps the last good copy for offline use.

---

## Integration Architecture

### API Contracts

- OpenAPI specification: generated by FastAPI at `/docs` and `/openapi.json` on the backend.
- Versioning: unversioned paths under `/api`; the frontend and backend ship together, so there is one live contract.
- Authentication: none for reads; `X-Admin-Token` header for data-changing routes (ADR-0004).

### Integration Patterns

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| Request-Response | Frontend reads | REST/HTTP JSON |
| Polling with cache | External providers | `_live_loop` every 15 min; GloFAS cached 3 h |
| Streaming | Agent run progress | `POST /api/ai/agent/run` streams NDJSON steps, then the briefing |
| Tool calling | Agent investigation | `meta_client.chat_tools` with the six tools in RFC-0001 |
| Scheduled ping | Avoid cold starts | `.github/workflows/keepalive.yml` every 10 minutes |

---

## Infrastructure Architecture

### Deployment Diagram

```
+---------------------------+          +-------------------------------+
| Vercel                    |  HTTPS   | Cloudflare (edge)             |
|  project root: frontend   +--------->+  -> Render web service        |
|  Next.js 15 (SSR + static)|          |     hydrosentinel-ph-api      |
|  sw.js served no-cache    |          |     plan: free, Python        |
+---------------------------+          |     uvicorn + FastAPI         |
                                       |     SQLite on local disk      |
+---------------------------+          +---------------+---------------+
| GitHub Actions            |  GET /api/health         ^
|  keepalive.yml */10 min   +--------------------------+
+---------------------------+
```

### Infrastructure Components

| Component | Technology | Purpose | Scaling |
|-----------|------------|---------|---------|
| Frontend | Vercel (root directory `frontend`) | Serve the Next.js app and static assets | Managed, global edge |
| Backend | Render web service (`render.yaml`, free plan) | Run the FastAPI API and background loop | Single instance |
| Edge | Cloudflare | TLS and proxy in front of Render | Managed |
| Database | SQLite file | Readings and settings | Single file; not shared between instances |
| Keep-alive | GitHub Actions | Stop the free instance sleeping after 15 idle minutes | Not applicable |

---

## Security Architecture

### Authentication & Authorization

| Flow | Mechanism | Implementation |
|------|-----------|----------------|
| Public reads | None | All `GET` routes are open; data is public |
| Data changes | Admin key | `X-Admin-Token` checked against `ADMIN_TOKEN` by `require_admin` |
| AI features | Rate limit | `rate_limit` buckets `analyst`, `agent`, `vision`, `image`, `csv` |
| Model access | Server-side key | `META_MODEL_API_KEY` in Render environment only |

### Data Protection

| Data Type | At Rest | In Transit |
|-----------|---------|------------|
| River readings and forecasts | Plain SQLite (public data) | TLS (Vercel, Cloudflare) |
| Credentials (`ADMIN_TOKEN`, `META_MODEL_API_KEY`) | Render environment variables, never in the repo | Never sent to the browser |
| Uploaded photos and CSVs | Processed in memory; not kept | TLS |

### Security Controls
- Input validation at the API boundary with Pydantic models; thresholds must increase.
- Admin key on every data-changing route; nine automated tests cover it (TP-0001).
- Per-client and global rate limits on every AI route, with `Retry-After`.
- CORS: exact origins plus a regex restricted to this project's own Vercel team suffix.
- CSP and security headers from `next.config.ts` on the frontend and `SecurityHeaders` on the backend.
- CSV uploads capped at 25 MB.

---

## Performance Considerations

### Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cached API reads | Well under 1 s once warm | Browser network panel and Render logs |
| Data freshness | Gauges at most 15 min old; outlook at most 3 h old | Data age shown in the UI |
| Agent run | Under 8 tool steps, about 20,000 tokens | Usage recorded with each briefing |
| Availability | No cold start for visitors | Keep-alive ping every 10 min |

### Scalability Approach

**Horizontal Scaling:**
- Not used. One Render instance holds the SQLite file, the in-memory caches and the rate-limit counters. Scaling out would need a shared database and a shared limiter first.

**Caching Strategy:**
- GloFAS outlook cached for 3 hours; hazards cached.
- Forecasts warmed by the background loop so requests do not train models.
- Service worker caches static assets and the last API responses (ADR-0006).

---

## Operational Considerations

### Monitoring

| Aspect | Tool | Metrics |
|--------|------|---------|
| Application | Render logs and dashboard | Errors, restarts, request logs |
| Health | GitHub Actions keep-alive | `/api/health` success every 10 min |
| Data sources | `GET /api/sources` and `GET /api/ai/status` | Provider status, data age, model configured |
| Agent | Saved briefing | Steps, tokens, numbers checked and verified |

### Logging

| Log Type | Retention | Format |
|----------|-----------|--------|
| Application | Render default retention for the free plan | Python logging, plain text |
| Access | Render default retention | Uvicorn access log |
| Audit | No separate audit log | Admin actions appear in access logs only |

### Alerting

| Alert | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| Keep-alive job fails | Any failed run | Warning | GitHub emails the repository owner; check Render |
| Provider unavailable | `/api/sources` reports not ok | Info | Shown in the UI; data served from cache |
| Agent verification below 100% | Any unverified number | Info | Shown on the briefing; review the claim |

---

## Decision Log

| Decision | Rationale | Alternatives Considered | ADR Link |
|----------|-----------|-------------------------|----------|
| Use GloFAS via Open-Meteo for the Philippine outlook | Open, daily, covers all 17 basins | PAGASA bulletins, DPWH gauges, scraping | [ADR-0001](ADRs/ADR-0001-glofas-for-philippine-outlook.md) |
| Validate the engine on UK EA gauges | Open, hourly, measured, with thresholds | Synthetic data only, GloFAS only | [ADR-0002](ADRs/ADR-0002-uk-gauges-to-validate-the-engine.md) |
| Tool-calling agent with server-side numeric checks | Users must trust each number | Single prompt, RAG without checks | [ADR-0003](ADRs/ADR-0003-verifiable-agent-with-numeric-checks.md) |
| Admin key plus rate limits | Stop fake alerts and runaway costs | User accounts, no protection | [ADR-0004](ADRs/ADR-0004-admin-key-and-rate-limits.md) |
| Vercel for the frontend, Render for the backend | Free tiers that fit each runtime | One platform for both, a VPS | [ADR-0005](ADRs/ADR-0005-vercel-and-render-hosting.md) |
| Never cache RSC payloads in the service worker | Stale payloads crashed the app | Stale-while-revalidate for everything | [ADR-0006](ADRs/ADR-0006-service-worker-caching-strategy.md) |
| Three plain status words and one colour system | Clear to non-experts, accessible | Four internal levels, many colours | [ADR-0007](ADRs/ADR-0007-plain-language-status-and-one-colour-system.md) |

---

## Open Questions
- [ ] Should SQLite move to a managed database so history survives Render restarts and redeploys?
- [ ] Should rate-limit counters move to a shared store before the backend runs more than one instance?
- [ ] Is there an open, machine-readable feed of Philippine measured gauges the engine could use (ADR-0001)?

---

## References
- GloFAS v4 via Open-Meteo Flood API: https://open-meteo.com/en/docs/flood-api
- UK Environment Agency flood-monitoring API: https://environment.data.gov.uk/flood-monitoring/doc/reference
- GDACS: https://www.gdacs.org
- Natural Earth: https://www.naturalearthdata.com
- nmblr.agent-kit templates: https://github.com/talino-labs/nmblr.agent-kit

---

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Architect | Debb1ie | 2026-11-03 | Approved |
| Tech Lead | Debb1ie | 2026-11-03 | Approved |

---

**Document Maintained By:** Debb1ie
**Last Reviewed:** 2026-11-03
