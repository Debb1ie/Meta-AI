---
type: ADR
id: "0003"
title: "A tool-calling agent whose numbers are checked by the server"
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

# ADR-0003: A tool-calling agent whose numbers are checked by the server

## Status

**Accepted**

- **Deciders:** Debb1ie
- **Date:** 2026-11-03
- **Supersedes:** None
- **Superseded by:** None

---

## Context

A flood briefing that contains one wrong number can send people the wrong way. Language models can state numbers that are not in their inputs.

### Background
HydroSentinel uses Muse Spark through the Meta Model API to turn data into a briefing a DRRM office can act on. Muse Spark supports native tool calling and JSON-schema output.

### Problem Statement
How do we let the model write a useful briefing while making sure every number in it comes from real data, and showing users when one does not?

### Requirements
- The model chooses what to investigate, so the briefing reflects the current situation.
- Every situation line and watchlist entry cites the tool result it came from.
- Every number is checked by code, not by another model, before the briefing is shown.
- Cost per run is bounded.

### Constraints
- One Meta Model API key, held on the server.
- Free hosting; runs must finish in reasonable time.

---

## Decision Drivers

- Users must be able to trust or question each number
- The check must be deterministic and explainable
- Bounded cost and steps

---

## Considered Options

### Option 1: Tool-calling agent with server-side numeric verification

**Description:** The agent calls up to 8 tools, then returns a JSON briefing whose claims cite tool-call ids. The server extracts every number from each claim and checks it against numbers in the cited results, allowing rounding.

**Pros:**
- Deterministic check, explainable per claim
- Citations let users open the exact data

**Cons:**
- Numbers derived by arithmetic (for example a difference) may be flagged even when correct

**Effort:** Medium
**Risk:** Low

### Option 2: One prompt with all data pasted in

**Description:** Send a large context and ask for a briefing.

**Pros:**
- Simple

**Cons:**
- No citations, no check; large and costly prompts

**Effort:** Low
**Risk:** High

### Option 3: Second model as a judge

**Description:** Ask another model call to check the briefing.

**Pros:**
- Can judge wording as well as numbers

**Cons:**
- Not deterministic; doubles cost; a judge can also be wrong

**Effort:** Medium
**Risk:** Medium

---

## Decision Outcome

**Chosen Option:** Option 1, tool-calling agent with server-side numeric verification

### Rationale
Only a code check gives users a result they can rely on and inspect. The tolerance is `max(0.051, 2% of the source value)`, so 463.5 written as 464 or 460 passes. Dates, month-day mentions and times of day are removed before checking, and list lengths count as supported numbers ("all 17 basins"). The most recent production run made 5 tool calls with 24 of 24 numbers verified, using about 20,000 tokens (about US$0.04).

### Expected Consequences

**Positive:**
- Each briefing shows "N of N numbers verified" and lists any that do not match
- Unknown citations are reported as bad references

**Negative:**
- Correct derived numbers can be flagged; the prompt asks the model to quote tool values directly

**Neutral:**
- The briefing is saved, so readers see the latest one without starting a run

---

## Implementation Notes

### Implementation Steps
1. Define six tools in `ai/agent.py`: `get_hazards`, `list_ph_basins`, `get_basin`, `get_rain_forecast`, `list_gauges`, `get_gauge`.
2. Run the loop with `meta_client.chat_tools`, at most `MAX_STEPS` 8, then request the final JSON briefing.
3. `verify()` checks each claim against its cited evidence and records `numbers_checked`, `numbers_verified`, `unverified`, `bad_refs` and a score.
4. Stream steps to the browser as NDJSON from `POST /api/ai/agent/run` and save the result for `GET /api/ai/agent/latest`.

### Affected Components
- `ai/agent.py`, `ai/meta_client.py`: new
- `api/ai.py`: agent routes
- `main._maybe_run_agent`: scheduled runs
- Frontend agent tab

### Migration Strategy
No migration; new feature.

### Rollback Plan
Hide the agent tab and stop `_maybe_run_agent`; the analyst Q&A continues to work.

---

## Validation

### Acceptance Criteria
- [x] Every claim carries at least one citation
- [x] Numbers within tolerance pass; others are listed as unverified
- [x] Runs stop at 8 steps

### Success Metrics
- Verification score on production runs: 100% target (24 of 24 on the last run)
- Tokens per run: about 20,000

### Validation Timeline
- Agent live with verification: 2026-11-03

---

## Abandoned Ideas

### Hiding unverified claims
**Reason:** Silently removing claims hides problems. Showing them flagged is more honest and lets users judge.

---

## Related Decisions

| ADR | Title | Relationship |
|-----|-------|--------------|
| ADR-0004 | Admin key and rate limits | Bounds who can trigger runs and how often |
| ADR-0001 | GloFAS for the Philippine outlook | Main evidence source |

---

## References

- RFC-0001: [Verifiable flood-watch agent](../../engineering/RFC-0001-verifiable-flood-watch-agent.md)
- `backend/app/ai/agent.py`

---

## Discussion Notes

The check is intentionally simple: number in claim, number in cited source, within rounding. Simple rules are easy to explain on screen.

---

**Document Maintained By:** Debb1ie
**Decision Recorded:** 2026-11-03
