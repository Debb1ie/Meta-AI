---
type: ADR
id: "0001"
title: "Use GloFAS via Open-Meteo for the Philippine river outlook"
status: Accepted
version: "1.0.0"
created: "2026-11-03"
updated: "2026-11-03"
author: "Debb1ie"
deciders: ["Debb1ie"]
related_ads: ["AD-0001"]
related_rfcs: ["RFC-0001", "RFC-0002"]
supersedes: ""
superseded_by: ""
github_issue: ""
github_pr: ""
changelog:
  - version: "1.0.0"
    date: "2026-11-03"
    author: "Debb1ie"
    summary: "Decision recorded"
---

# ADR-0001: Use GloFAS via Open-Meteo for the Philippine river outlook

## Status

**Accepted**

- **Deciders:** Debb1ie
- **Date:** 2026-11-03
- **Supersedes:** None
- **Superseded by:** None

---

## Context

HydroSentinel is built for the Philippines, so its main view has to cover Philippine rivers, every day, from a source anyone can check.

### Background
PAGASA publishes flood bulletins and basin advisories, and DPWH and PAGASA operate river gauges. We did not find an open, documented, machine-readable API for hourly Philippine gauge readings that a public app could poll reliably. GloFAS v4 (Copernicus) models daily river discharge worldwide, and the Open-Meteo Flood API serves it as JSON without a key, under CC BY 4.0.

### Problem Statement
We need daily flow, a short-range forecast and meaningful alert levels for the major Philippine basins, from an open source with a stable API.

### Requirements
- Cover the major basins from Luzon to Mindanao (17 chosen: from the Cagayan to the Mindanao River).
- Past and forecast values on the same scale, so a chart can join them.
- Alert levels that mean "high for this river", not one national number.
- An open licence that allows public display.

### Constraints
- No budget for paid data.
- Must work from a free Render instance with modest memory.
- Must never be presented as an official warning.

---

## Decision Drivers

- Open, keyless access with a documented licence
- Coverage of all 17 basins with a forecast horizon of weeks
- Ability to derive river-specific alert levels from history

---

## Considered Options

### Option 1: GloFAS v4 via the Open-Meteo Flood API

**Description:** Fetch 30 days of history and 30 days of forecast daily discharge per basin, plus 5 years of daily history to compute percentile alert levels.

**Pros:**
- Open, keyless, CC BY 4.0
- Same model for past and future, so the series is consistent
- Five-year climatology gives each river its own levels

**Cons:**
- Modelled, not measured; values can differ from gauges
- Daily resolution only

**Effort:** Low
**Risk:** Low

### Option 2: PAGASA bulletins and basin advisories

**Description:** Parse public PAGASA bulletins for river status.

**Pros:**
- Official and locally authoritative

**Cons:**
- Text and PDF formats that change; scraping is fragile
- No consistent numeric series for charts or forecasts

**Effort:** High
**Risk:** High

### Option 3: Measured DPWH or PAGASA gauge readings

**Description:** Use telemetered water levels from Philippine stations.

**Pros:**
- Measured data, best for short-range forecasting

**Cons:**
- No open, documented API found
- Station thresholds not published in a machine-readable form

**Effort:** High
**Risk:** High

---

## Decision Outcome

**Chosen Option:** Option 1, GloFAS v4 via the Open-Meteo Flood API

### Rationale
It is the only option that gives a consistent numeric series for all 17 basins with an open licence and no key. River-specific alert levels come from the 95th, 99th and 99.8th percentiles of each basin's five-year daily record (`CLIMATOLOGY_YEARS` 5, `PERCENTILES`). The measured-data gap is covered by ADR-0002.

### Expected Consequences

**Positive:**
- A national 30-day outlook with alert levels that mean something for each river
- One cache (3 hours) keeps provider load and latency low

**Negative:**
- Values are modelled; the UI and agent must say so and point to PAGASA
- Daily data cannot show a flash flood within hours

**Neutral:**
- Status uses a 7-day window (`OUTLOOK_DAYS`) and a 3-day trend with a 15% threshold

---

## Implementation Notes

### Implementation Steps
1. `backend/app/providers/glofas.py` defines the 17 rivers and fetches history, forecast and climatology.
2. Alert levels are computed per basin from the five-year record and attached as `thresholds_m3s` (advisory, warning, critical, median).
3. `outlook()` caches the result for `glofas_cache_seconds` (3 hours); `main._refresh_outlook` keeps it warm.
4. `GET /api/outlook` serves it; the agent reads it through `list_ph_basins` and `get_basin`.

### Affected Components
- `providers/glofas.py`: new provider
- `api/research.py`: `/api/outlook`, `/api/research`
- `ai/agent.py`: basin tools
- Frontend outlook tab, river status card and research 3D view

### Migration Strategy
No migration; this was the first Philippine data source.

### Rollback Plan
Remove the outlook routes and tools; the UK gauges and hazards continue to work.

---

## Validation

### Acceptance Criteria
- [x] All 17 basins return history, forecast and three alert levels
- [x] Source and licence are shown wherever the data is shown
- [x] The outlook is served from cache when the provider is slow

### Success Metrics
- Basins with data: 17 of 17
- Outlook age: at most 3 hours

### Validation Timeline
- Outlook live in production: 2026-11-03

---

## Abandoned Ideas

### Scraping PAGASA bulletins
**Reason:** The formats are not stable and do not give a numeric series to chart or forecast.

---

## Related Decisions

| ADR | Title | Relationship |
|-----|-------|--------------|
| ADR-0002 | Use UK gauges to validate the engine | Covers the measured-data gap this decision leaves |
| ADR-0007 | Plain-language status and one colour system | Maps the three GloFAS levels to Watch and Alert |

---

## References

- Open-Meteo Flood API: https://open-meteo.com/en/docs/flood-api
- GloFAS: https://www.globalfloods.eu
- PAGASA tropical cyclone information: https://www.pagasa.dost.gov.ph/climate/tropical-cyclone-information

---

## Discussion Notes

The key concern was honesty: modelled flow must never look like a measured reading or an official warning. Every view therefore names GloFAS as the source and the agent's briefing points to PAGASA and local authorities.

---

**Document Maintained By:** Debb1ie
**Decision Recorded:** 2026-11-03
