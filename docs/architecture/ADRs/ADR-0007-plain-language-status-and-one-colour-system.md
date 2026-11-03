---
type: ADR
id: "0007"
title: "Plain-language status words and one colour system"
status: Accepted
version: "1.0.0"
created: "2026-11-03"
updated: "2026-11-03"
author: "Debb1ie"
deciders: ["Debb1ie"]
related_ads: ["AD-0001"]
related_rfcs: ["RFC-0002"]
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

# ADR-0007: Plain-language status words and one colour system

## Status

**Accepted**

- **Deciders:** Debb1ie
- **Date:** 2026-11-03
- **Supersedes:** None
- **Superseded by:** None

---

## Context

HydroSentinel is read by DRRM officers, planners and families, many on phones, some in bright light, some with colour-vision deficiency.

### Background
The backend classifies risk into four levels: normal, advisory, warning and critical (`risk.py`, and the three GloFAS percentile levels). Earlier screens showed these four words in several colour schemes, and colour was used for decoration as well as status, so red did not always mean danger.

### Problem Statement
How do we show river status so that anyone understands it at a glance, without relying on colour alone?

### Requirements
- Few states, each with a plain word, an icon and a colour
- Colour used only for status
- Text contrast that meets WCAG AA on the card backgrounds
- The same states everywhere: landing card, map, outlook, agent

### Constraints
- Backend levels stay as they are; mapping happens in the frontend
- Must not suggest an official PAGASA warning level

---

## Decision Drivers

- Understandable by non-experts in seconds
- Accessible: never colour alone
- Consistency across every screen

---

## Considered Options

### Option 1: Three words with icon and colour

**Description:** Normal (check icon, #1E7A4C), Watch (triangle, #8A5300), Alert (circle with exclamation, #B42318). Advisory maps to Watch; warning and critical map to Alert.

**Pros:**
- Simple; each state has three cues
- Avoids PAGASA terms, so it is not mistaken for an official level

**Cons:**
- Warning and critical look the same to users; detail is in the numbers

**Effort:** Low
**Risk:** Low

### Option 2: Show all four backend levels

**Description:** Normal, Advisory, Warning, Critical.

**Pros:**
- More detail

**Cons:**
- "Advisory" and "Warning" overlap with official vocabulary and are hard to rank

**Effort:** Low
**Risk:** Medium

### Option 3: Colour scale only

**Description:** A continuous heat colour without words.

**Pros:**
- Shows gradation

**Cons:**
- Fails for colour-blind users and in print

**Effort:** Low
**Risk:** High

---

## Decision Outcome

**Chosen Option:** Option 1, three words with icon and colour

### Rationale
Three states are enough to decide whether to pay attention, and the exact numbers (flow, percentage of the Watch level, trend) are always next to the word. The colours are dark enough for white or light text contrast and are reserved for status (`--rs-normal`, `--rs-watch`, `--rs-alert` in `globals.css`). Type is Public Sans for text and Fraunces for display headings. The research 3D view uses a continuous heat ramp for gradation, but always alongside the words in its read-out (RFC-0002).

### Expected Consequences

**Positive:**
- One vocabulary across the product and in agent briefings
- Usable in greyscale and by colour-blind users

**Negative:**
- Users who need the four-level detail must read the numbers or the diagnostics tab

**Neutral:**
- Internal code and the API keep the four-level names

---

## Implementation Notes

### Implementation Steps
1. Define `statusOf(level)` in `frontend/src/app/river-status.tsx`: `normal` to Normal, `advisory` to Watch, anything higher to Alert.
2. Add status tokens to `globals.css` and remove status colours from decorative elements.
3. Pair every status colour with its word and icon.
4. Draw the Watch line on charts only when it fits to scale; otherwise name it.

### Affected Components
- `river-status.tsx`, `landing.tsx`, `featured/*`: status rendering
- `globals.css`: tokens and fonts

### Migration Strategy
Frontend-only change; the API is unchanged.

### Rollback Plan
Restore the previous labels in `statusOf`; no data changes.

---

## Validation

### Acceptance Criteria
- [x] Every status shows a word, an icon and a colour
- [x] Status colours appear nowhere else
- [x] The same mapping is used on every screen

### Success Metrics
- Text contrast on status chips: WCAG AA or better
- Screens using a different status vocabulary: 0

### Validation Timeline
- Rolled out across the app: 2026-11-03

---

## Abandoned Ideas

### Using PAGASA's colour-coded rainfall warning names
**Reason:** They are official warnings for rainfall; reusing them would imply HydroSentinel issues official warnings.

---

## Related Decisions

| ADR | Title | Relationship |
|-----|-------|--------------|
| ADR-0001 | GloFAS for the Philippine outlook | Supplies the levels being mapped |

---

## References

- `frontend/src/app/river-status.tsx`
- WCAG 2.2 contrast minimum: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum

---

## Discussion Notes

"Watch" was chosen over "Advisory" because it tells people what to do (keep watching) rather than naming a bulletin type.

---

**Document Maintained By:** Debb1ie
**Decision Recorded:** 2026-11-03
