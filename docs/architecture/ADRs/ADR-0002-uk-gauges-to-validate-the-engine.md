---
type: ADR
id: "0002"
title: "Use UK Environment Agency gauges to validate the forecasting engine"
status: Accepted
version: "1.0.0"
created: "2026-11-03"
updated: "2026-11-03"
author: "Debb1ie"
deciders: ["Debb1ie"]
related_ads: ["AD-0001"]
related_rfcs: ["RFC-0001"]
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

# ADR-0002: Use UK Environment Agency gauges to validate the forecasting engine

## Status

**Accepted**

- **Deciders:** Debb1ie
- **Date:** 2026-11-03
- **Supersedes:** None
- **Superseded by:** None

---

## Context

The forecasting engine (cleaning, three competing models, conformal intervals, skill scores) needs measured, hourly river levels to be trained and honestly tested.

### Background
ADR-0001 gives a modelled daily outlook for the Philippines but no measured hourly gauges. The UK Environment Agency publishes live readings for thousands of stations through an open API under the Open Government Licence v3, with each station's typical range and highest recorded level.

### Problem Statement
How do we show that the forecasting engine works on real measured data, when no open Philippine gauge feed is available?

### Requirements
- Hourly or finer readings, live, with history of several weeks
- Published thresholds or a stage scale to set alert levels
- Open licence and no key

### Constraints
- The product is for the Philippines; the UK data must be clearly labelled as validation data, not presented as Philippine.
- The free backend must be able to sync every 15 minutes.

---

## Decision Drivers

- Real measured data to score forecasts against persistence
- Open access with thresholds
- A clear story for users about why UK rivers appear

---

## Considered Options

### Option 1: Live UK Environment Agency gauges

**Description:** Sync 10 UK gauges every 15 minutes and run the full engine on them.

**Pros:**
- Measured, frequent, open, with a stage scale for thresholds
- Includes flood warnings in force, useful for the hazards view

**Cons:**
- Not Philippine rivers; needs explanation in the UI

**Effort:** Low
**Risk:** Low

### Option 2: Synthetic Philippine gauges only

**Description:** Generate realistic series for Philippine stations.

**Pros:**
- Looks local

**Cons:**
- Scores on synthetic data prove nothing about real rivers

**Effort:** Medium
**Risk:** High

### Option 3: Run the hourly engine on GloFAS daily data

**Description:** Treat GloFAS discharge as the input series.

**Pros:**
- Philippine coverage

**Cons:**
- Forecasting a model's output measures nothing real; daily resolution does not fit 1 to 24 h horizons

**Effort:** Medium
**Risk:** High

---

## Decision Outcome

**Chosen Option:** Option 1, live UK Environment Agency gauges

### Rationale
Only measured data can show whether the engine beats a no-change baseline. The UK feed is open, live and carries a stage scale from which advisory, warning and critical levels are derived. Synthetic data stays only as a clearly labelled demo (the Marikina typhoon CSV) for the data checker.

### Expected Consequences

**Positive:**
- Forecast skill is measured on data the model never saw
- The same engine can run on Philippine gauges if a feed becomes available

**Negative:**
- Users may ask why UK rivers appear; the UI explains they validate the engine

**Neutral:**
- UK flood warnings also feed the hazards list

---

## Implementation Notes

### Implementation Steps
1. `providers/uk_ea.py` defines 10 gauges and derives thresholds from each stage scale.
2. `services.sync_live_gauges` stores new readings with their source; `main._live_loop` calls it every 15 minutes.
3. `forecasting/pipeline.py` scores each horizon on a chronological 70/10/20 split.
4. `services.remove_simulated` removes demo data when live data is present.

### Affected Components
- `providers/uk_ea.py`, `services.py`: new
- `forecasting/`: trained and scored on these series
- Frontend live gauges and diagnostics tabs

### Migration Strategy
Demo stations remain available behind `SEED_DEMO_DATA`; live stations are added alongside.

### Rollback Plan
Set `LIVE_DATA_ENABLED` to false; the app falls back to demo data.

---

## Validation

### Acceptance Criteria
- [x] 10 gauges sync every 15 minutes
- [x] Each horizon reports error and skill against persistence on held-out data
- [x] UK gauges are labelled with their source and licence

### Success Metrics
- Gauges with fresh data: 10 of 10
- Horizons scored: 1, 3, 6, 12 and 24 h where history allows

### Validation Timeline
- Live sync in production: 2026-11-03

---

## Abandoned Ideas

### Synthetic-only validation
**Reason:** A score on generated data cannot tell users whether to trust a forecast.

---

## Related Decisions

| ADR | Title | Relationship |
|-----|-------|--------------|
| ADR-0001 | GloFAS for the Philippine outlook | This decision fills its measured-data gap |
| ADR-0003 | Verifiable agent with numeric checks | The agent reads gauge forecasts through tools |

---

## References

- UK EA flood-monitoring API: https://environment.data.gov.uk/flood-monitoring/doc/reference
- Open Government Licence v3: https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/

---

## Discussion Notes

The decision accepts a presentation cost (explaining UK rivers) in exchange for honest, measurable forecast skill.

---

**Document Maintained By:** Debb1ie
**Decision Recorded:** 2026-11-03
