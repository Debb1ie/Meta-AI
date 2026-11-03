---
type: RFC
id: "0002"
title: "Research page and 3D forecast layer"
status: Implemented
version: "1.0.0"
created: "2026-11-03"
updated: "2026-11-03"
author: "Debb1ie"
reviewers: ["Debb1ie"]
approvers: ["Debb1ie"]
target_version: "v1.0.0"
implementation_branch: "main"
github_issue: ""
github_pr: ""
related_prds: ["PRD-0001"]
related_pds: []
related_adrs: ["ADR-0001", "ADR-0007"]
related_tds: ["AD-0001"]
related_tps: ["TP-0001"]
milestone: "Meta Global AI Developer Hackathon 2026 submission"
execution_state: "Completed"
approvals:
  tech_lead: { name: "Debb1ie", date: "2026-11-03", approved: true }
  architect: { name: "Debb1ie", date: "2026-11-03", approved: true }
  product: { name: "Debb1ie", date: "2026-11-03", approved: true }
changelog:
  - version: "1.0.0"
    date: "2026-11-03"
    author: "Debb1ie"
    summary: "RFC written to record the implemented design"
---

# RFC-0002: Research page and 3D forecast layer

**Author:** Debb1ie | **Status:** Implemented | **Target Version:** v1.0.0

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document Type | Request for Comments (RFC) |
| Version | 1.0.0 |
| Last Updated | 2026-11-03 |
| Execution State | Completed |
| GitHub Issue | None; work tracked in the repository history |

---

## Document Changelog

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0.0 | 2026-11-03 | Debb1ie | RFC written to record the implemented design |

---

## Summary

Researchers and reviewers want to see the whole Philippine outlook at once and to check how the engine works. This RFC adds a `/research` page with two parts. First, a 3D view of the archipelago in which each of the 17 basins is a column whose height and colour show flow as a share of its Watch level, with a day slider through the past week and the forecast. Second, a method section that lists every parameter the system uses and the forecast scores by horizon, read live from the backend so the page cannot drift from the code.

---

## Background

The outlook tab shows one basin at a time. Comparing basins of very different size (a small river and the Cagayan) needs a common scale, and showing how the situation moves over days needs time as a control. Reviewers also asked how numbers such as the Hampel window or the conformal split are set.

### Problem Statement
There is no single view of all basins over time on a comparable scale, and the engine's parameters are only visible in the code.

### Goals
- Show all 17 basins on a common scale: flow divided by each basin's Watch level (Q / Q95).
- Let users move through days and play the sequence.
- Publish every engine parameter and the forecast scores from the running system.
- Provide an accessible, non-3D alternative.

### Non-Goals
- New forecasting methods; the page shows existing results.
- Measured Philippine gauge data (see ADR-0001).
- Mobile-first 3D; phones get the same view but the table is the primary alternative.

### Related Documents

| Document | Type | Relationship |
|----------|------|--------------|
| [PRD-0001](../product/PRD-0001-hydrosentinel.md) | PRD | Feature 1.8 |
| [ADR-0001](../architecture/ADRs/ADR-0001-glofas-for-philippine-outlook.md) | ADR | Data source |
| [ADR-0007](../architecture/ADRs/ADR-0007-plain-language-status-and-one-colour-system.md) | ADR | Status words used with the heat ramp |
| [AD-0001](../architecture/AD-0001-system-architecture.md) | AD | Components |

---

## Proposal

### Overview
`frontend/src/app/research/page.tsx` renders `view.tsx`, which fetches the outlook and the research summary. `flow3d.tsx` draws the 3D scene with three.js 0.186.1 and is loaded with `next/dynamic` and `ssr: false`. `backend/app/api/research.py` serves `GET /api/research` with parameters and scores.

### Detailed Design

#### 3D scene (`flow3d.tsx`)

- The Philippine outline (`ph-outline.ts`, from Natural Earth) is extruded as a thin land slab over a sea plane with a faint grid and fog.
- Each basin is a cylinder placed with `projectPH(longitude, latitude)`, plus a translucent disc at its base.
- For the selected day, ratio r = Q / Q95 (the basin's advisory threshold). Height is `max(2, min(r, 1.6) × 120)` scene units; r is capped at `MAX_RATIO` 1.6 so one extreme river cannot flatten the rest.
- Colour comes from a heat ramp: #2E8B57 at 0, #8DBF5A at 0.5, #E0B12A at 0.85, #E5862C at 1.0 and #C8321F at 1.4. Below 1 the river is within its normal range.
- Columns ease toward their new height each frame; with `prefers-reduced-motion` they jump and damping is off.
- Orbit controls are limited (polar angle, distance 220 to 1100). Hover uses raycasting and reports the basin id to the page.
- The scene is built once per set of basins; day changes update only targets, colours and disc sizes. All geometries, materials and the renderer are disposed on unmount.

**Domain Model:**

| Entity | Field | Type | Required | Description |
|--------|-------|------|----------|-------------|
| Basin | id | string | yes | For example `ph-cagayan` |
| Basin | name, region | string | yes | Display names |
| Basin | latitude, longitude | number | yes | Position for projection |
| Basin | current_date | string | yes | Today's date in the series |
| Basin | thresholds_m3s | {advisory, warning, critical, median} | yes | Levels from the five-year record |
| Basin | series | list of {date, discharge_m3s, is_forecast} | yes | Daily flow, past and forecast |

**Key Interfaces:**

| Interface | Methods | Purpose |
|-----------|---------|---------|
| `Flow3D` | `({ basins, dates, dayIndex, onHover })` | React component that renders the scene |
| `heat` | `(r: number) => THREE.Color` | Heat ramp for a ratio |
| `GET /api/research` | none | Parameters and scores |

#### Research view (`view.tsx`)

- Play/Pause button and a range input labelled "Day" step through dates.
- A heat table with `role="table"` and the label "Flow as a share of watch level by basin and day" gives the same information without 3D.
- A method section lists parameters from `/api/research` and a per-horizon score table.

#### Research API (`research.py`)

Returns:
- `parameters`: GloFAS settings (basins, history and forecast days, climatology years, percentiles, outlook window, trend window and threshold, cache hours); preprocessing (level and rain bounds, interpolation gap, Hampel window and sigmas, future tolerance); forecasting (horizons, headline horizons, 70/10/20 split, minimum hours for evaluation and ML, minimum regime samples, backtest days, lags, rain windows, trend window and damping, GBM settings, regime rule); risk (levels, near-term hours, stale data 3 h); hazards (centre, near and affects distances, cache minutes); agent (max steps, tools, languages, number tolerance).
- `gauges`: per gauge and horizon, the selected model, skill vs persistence, RMSE, MAE, test size and 80%/95% interval coverage.
- `summary`: per horizon, mean skill, share of gauges beating persistence, mean RMSE, mean coverage and models selected.

### API Changes

#### New Endpoints

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/research` | GET | Engine parameters and forecast scores | None | `{ parameters, gauges, summary }` |

#### Modified Endpoints

| Endpoint | Change | Backward Compatible |
|----------|--------|---------------------|
| `/api/outlook` | Used by the research page as well as the outlook tab; no shape change | Yes |

### Data Model Changes

#### New Tables/Collections

No new tables. The page reads existing cached results.

#### Modified Tables

| Table | Change | Migration Strategy |
|-------|--------|-------------------|
| None | No table changes | Not applicable |

### Configuration Changes

| Config | Type | Default | Description |
|--------|------|---------|-------------|
| None | | | The page uses existing settings; `three` was added as a frontend dependency |

---

## Implementation Plan

### Phase Outline

| Phase | Description | Key Deliverables |
|-------|-------------|------------------|
| 1 | Research API | `GET /api/research` |
| 2 | 3D scene | `flow3d.tsx`, heat ramp, outline extrusion |
| 3 | Page and controls | `view.tsx`, slider, play, hover read-out |
| 4 | Accessible alternative | Heat table |
| 5 | Navigation | Links from landing and nav ("Research", "3D forecast") |

### Migration Strategy
Not applicable; a new page with no stored data.

---

## Testing Strategy

### Unit Tests

| Component | Test Coverage | Priority |
|-----------|---------------|----------|
| `/api/research` | No automated test yet; checked by hand against the code constants | Medium |
| `heat()` ramp | Not unit tested; checked visually | Low |

**Key Test Cases:**
- `/api/research` returns `parameters`, `gauges` and `summary` and the parameter values equal the code constants.
- Ratios at the stop values return the stop colours.

### Integration Tests

| Integration | Test Approach | Priority |
|-------------|---------------|----------|
| Page with live backend | Load `/research` against the deployed API | Medium |

### E2E Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Move through days | Drag the Day slider | Column heights and colours change; hover read-out updates |
| Play | Press Play | Days advance; Pause stops |
| Reduced motion | Enable reduced motion in the OS | Columns change without animation |
| No WebGL | Open in a browser without WebGL | The heat table still shows the data |

### Performance Tests

| Test | Target | Measurement |
|------|--------|-------------|
| Frame rate with 17 columns | Smooth on a mid-range laptop | Browser performance panel |
| Initial bundle | three.js loaded only on `/research` | Next.js build output (dynamic import) |

---

## Acceptance Criteria

- [x] All 17 basins appear as columns on the archipelago
- [x] Heights and colours reflect Q / Q95 for the selected day, capped at 1.6
- [x] The page renders without the 3D view (heat table) and respects reduced motion
- [x] Parameters shown are read from `/api/research`, not hard-coded
- [ ] Automated tests for the research route and heat ramp (not yet written)
- [x] API documentation updated (FastAPI OpenAPI at `/docs`)
- [x] Resources are disposed when leaving the page

### Criterion Details

| Criterion | Test Method | Expected Result |
|-----------|-------------|-----------------|
| Common scale | Compare a basin's column with its outlook chart | Column height at r = 1 matches the Watch line |
| Disposal | Navigate away and back repeatedly | No growing GPU memory in DevTools |

---

## Security Considerations

| Consideration | Mitigation | Status |
|---------------|------------|--------|
| Third-party script | three.js is bundled from npm, not loaded from a CDN; CSP `script-src 'self'` | Addressed |
| Data exposure | Only public parameters and scores are returned | Addressed |

### Security Checklist
- [x] Input validation implemented (read-only route, no input)
- [x] Authentication/authorization verified (public data)
- [x] Sensitive data encrypted (none; TLS in transit)
- [ ] Audit logging added (not needed for a read-only route)
- [x] No secrets in the research response

---

## Performance Considerations

| Consideration | Impact | Mitigation |
|---------------|--------|------------|
| three.js size | Larger bundle | Dynamic import with `ssr: false`, only on `/research` |
| High-DPI screens | GPU load | Pixel ratio capped at 2 |
| Scene rebuilds | Jank on slider moves | Scene built once; day changes update materials only |

### Benchmarks

| Operation | Current | Expected | Acceptable |
|-----------|---------|----------|------------|
| Day change | Smooth easing | Under one frame to apply | Under 100 ms |
| `/api/research` | Reads cached forecasts | Under 1 s when warm | Under 3 s |

---

## Monitoring & Observability

### Metrics

| Metric | Type | Labels | Alert Threshold |
|--------|------|--------|-----------------|
| None specific | | | The page relies on the general backend monitoring in AD-0001 |

### Logging

| Event | Level | Fields |
|-------|-------|--------|
| `/api/research` request | INFO | Uvicorn access log |

### Alerts

| Alert | Condition | Severity | Runbook |
|-------|-----------|----------|---------|
| None specific | | | A failure shows as an error state on the page |

---

## Rollout Plan

### Rollout Stages

| Stage | % Traffic | Duration | Success Criteria |
|-------|-----------|----------|------------------|
| Production | 100% | From 2026-11-03 | Page loads; 17 columns render |

Canary stages were not used: it is a new, separate page with no effect on existing ones.

### Rollback Plan

**Trigger Conditions:**
- The page crashes or degrades other pages

**Rollback Steps:**
1. Remove the navigation links to `/research`.
2. Promote the previous Vercel deployment if needed.

**Rollback Time:** About 5 minutes

---

## Abandoned Ideas

### Absolute flow heights

**Description:** Column height in m³/s.

**Reason Abandoned:** The Cagayan would dwarf every other river; Q / Q95 puts all rivers on the same scale.

### A 3D globe library

**Description:** Use a mapping library with 3D terrain.

**Reason Abandoned:** Heavier, often needs an API key, and the extruded outline is enough for 17 points.

---

## Open Questions

- [ ] Should the 3D view also show live hazards (typhoon tracks)? - Owner: Debb1ie
- [ ] Should automated tests cover the research route and heat ramp? - Owner: Debb1ie

---

## References

- `frontend/src/app/research/flow3d.tsx`, `view.tsx`, `page.tsx`
- `backend/app/api/research.py`
- three.js: https://threejs.org

---

## Approval Checklist

- [x] Technical design reviewed
- [x] Security review completed
- [x] Performance impact assessed
- [x] Test plan approved
- [x] Documentation plan approved
- [x] Rollback plan validated
- [x] Monitoring plan approved

---

## Approvals

| Role | Name | Date | Status | Notes |
|------|------|------|--------|-------|
| Tech Lead | Debb1ie | 2026-11-03 | Approved | |
| Architect | Debb1ie | 2026-11-03 | Approved | |
| Product | Debb1ie | 2026-11-03 | Approved | |

---

**RFC Owner:** Debb1ie
**Target Completion:** 2026-11-03
