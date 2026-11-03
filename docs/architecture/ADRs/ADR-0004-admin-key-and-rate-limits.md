---
type: ADR
id: "0004"
title: "Protect data changes with an admin key and AI features with rate limits"
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

# ADR-0004: Protect data changes with an admin key and AI features with rate limits

## Status

**Accepted**

- **Deciders:** Debb1ie
- **Date:** 2026-11-03
- **Supersedes:** None
- **Superseded by:** None

---

## Context

A security review of the public deployment found that anyone could change data and that paid AI features had no limit.

### Background
`PUT /api/stations/{station_id}/thresholds` accepted unauthenticated requests. Anyone could lower a gauge's levels and make the public dashboard show a fake "critical" alert. The CSV import, demo reset and live sync routes were open in the same way. AI routes call the Meta Model API, which costs money per token. The CORS regex also matched any Vercel subdomain starting with the project name, so a site such as `hydrosentinel-evil.vercel.app` would have been allowed.

### Problem Statement
How do we stop the public from changing what the dashboard shows, and bound AI cost, without adding user accounts?

### Requirements
- Data-changing routes need a credential the public does not have.
- AI routes have per-client and global limits with a clear message.
- The browser never holds a secret.
- CORS allows only this project's own deployments.

### Constraints
- No user accounts or personal data (PRD scope).
- Single backend instance on a free plan.

---

## Decision Drivers

- Remove the fake-alert risk
- Bound model cost on a public demo
- Keep the public experience sign-in free

---

## Considered Options

### Option 1: Admin key header plus in-process rate limits

**Description:** `require_admin` checks an `X-Admin-Token` header against the `ADMIN_TOKEN` environment variable. `rate_limit(bucket)` applies per-minute, per-day and global daily limits per feature.

**Pros:**
- Small, testable, no new services
- Public reads stay open

**Cons:**
- One shared operator key; limits reset when the instance restarts

**Effort:** Low
**Risk:** Low

### Option 2: User accounts with roles

**Description:** Add sign-in and an operator role.

**Pros:**
- Per-user audit and revocation

**Cons:**
- Stores personal data; much more to build and secure

**Effort:** High
**Risk:** Medium

### Option 3: Remove the data-changing routes

**Description:** Make the deployment read-only.

**Pros:**
- No attack surface

**Cons:**
- Operators cannot tune levels or import data; demo reset impossible

**Effort:** Low
**Risk:** Low

---

## Decision Outcome

**Chosen Option:** Option 1, admin key header plus in-process rate limits

### Rationale
It closes the fake-alert hole with the least new surface and keeps the public product open. Admin actions return 401 for a missing or wrong key and 403 when the server has no key configured, so a deployment without the key is safe by default. Rate limits (per minute, per day, global per day) are:

| Bucket | Per minute | Per day | Global per day |
|--------|-----------|---------|----------------|
| `analyst` | 6 | 60 | 600 |
| `agent` | 2 | 20 | 120 |
| `vision` (SAM 3.1) | 3 | 20 | 150 |
| `image` (Muse Image) | 3 | 15 | 100 |
| `csv` (preview) | 10 | 100 | 1000 |

The agent also has its own budget: a 10-minute cooldown and at most 40 runs a day.

### Expected Consequences

**Positive:**
- Anonymous requests cannot change thresholds or data (covered by 9 security tests)
- AI cost has a hard daily ceiling

**Negative:**
- A shared key must be rotated by hand if exposed
- Counters live in memory and reset on restart

**Neutral:**
- The `429` response carries `Retry-After` and a plain message

---

## Implementation Notes

### Implementation Steps
1. Add `require_admin` to `PUT /api/stations/{station_id}/thresholds`, `POST /api/data/import`, `POST /api/demo/reset` and `POST /api/live/sync`.
2. Add `rate_limit` dependencies to every route in `api/ai.py` and to CSV preview.
3. Restrict `cors_origin_regex` to this project's own Vercel team suffix.
4. Add `SecurityHeaders` middleware and frontend CSP in `next.config.ts`.
5. Add `backend/tests/test_security.py`.

### Affected Components
- `security.py`, `config.py`: new settings `admin_token`, `rate_limits_enabled`
- `api/*.py`: dependencies added
- `render.yaml`: `ADMIN_TOKEN` and `CORS_ORIGIN_REGEX` environment keys (values set in the Render dashboard, not in the repo)

### Migration Strategy
Set `ADMIN_TOKEN` in Render before deploying; operators send it as `X-Admin-Token`.

### Rollback Plan
Not recommended. If limits block legitimate use, raise the bucket values or set `rate_limits_enabled` to false temporarily.

---

## Validation

### Acceptance Criteria
- [x] Anonymous and wrong-key requests to all four admin routes return 401
- [x] An anonymous threshold change does not alter the stored thresholds
- [x] AI routes return 429 with `Retry-After` past their limits
- [x] A look-alike Vercel origin is rejected by CORS

### Success Metrics
- Security tests passing: 9 of 9
- Unauthorised data changes in production: 0

### Validation Timeline
- Hardening deployed: 2026-11-03

---

## Abandoned Ideas

### Hiding the admin routes behind an obscure path
**Reason:** Obscurity is not access control; the routes appear in the OpenAPI schema.

---

## Related Decisions

| ADR | Title | Relationship |
|-----|-------|--------------|
| ADR-0003 | Verifiable agent | The agent budget complements the `agent` rate limit |
| ADR-0005 | Vercel and Render hosting | Where the secrets live |

---

## References

- `backend/app/security.py`
- `backend/tests/test_security.py`
- OWASP API Security Top 10: https://owasp.org/API-Security/

---

## Discussion Notes

Secret values are never written in documents, logs or the repository. Only key names appear here.

---

**Document Maintained By:** Debb1ie
**Decision Recorded:** 2026-11-03
