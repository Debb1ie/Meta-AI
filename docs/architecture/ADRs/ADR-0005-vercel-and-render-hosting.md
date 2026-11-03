---
type: ADR
id: "0005"
title: "Host the frontend on Vercel and the backend on Render"
status: Accepted
version: "1.0.0"
created: "2026-11-03"
updated: "2026-11-03"
author: "Debb1ie"
deciders: ["Debb1ie"]
related_ads: ["AD-0001"]
related_rfcs: []
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

# ADR-0005: Host the frontend on Vercel and the backend on Render

## Status

**Accepted**

- **Deciders:** Debb1ie
- **Date:** 2026-11-03
- **Supersedes:** None
- **Superseded by:** None

---

## Context

HydroSentinel has a Next.js frontend and a long-running Python backend with a background loop, scikit-learn models and a SQLite file.

### Background
The backend must run continuously: it syncs gauges every 15 minutes, refreshes the outlook and starts scheduled agent runs. Serverless functions do not suit a background thread or in-memory caches. The frontend is a standard Next.js 15 app.

### Problem Statement
Where should each part run, at no cost, so that the public demo is fast and always on?

### Requirements
- Frontend with fast global delivery and Git-based deploys
- Backend that keeps a process alive with a background loop
- HTTPS everywhere; secrets in platform environment variables
- No hosting cost

### Constraints
- Free tiers only
- Repository has the frontend in `frontend/` and the backend in `backend/`

---

## Decision Drivers

- Background loop needs a persistent process
- Zero cost
- Simple, reproducible deploys from the repository

---

## Considered Options

### Option 1: Vercel for the frontend, Render web service for the backend

**Description:** Vercel builds `frontend/`. Render runs uvicorn from `render.yaml` (free plan), behind Cloudflare.

**Pros:**
- Each platform fits its runtime; both free
- `render.yaml` keeps backend config in the repository

**Cons:**
- Free Render instances sleep after 15 idle minutes
- Local disk is ephemeral, so SQLite history resets on redeploy

**Effort:** Low
**Risk:** Medium

### Option 2: Everything on Vercel

**Description:** Run the API as Vercel Python functions.

**Pros:**
- One platform

**Cons:**
- No background loop or persistent memory; model training per request

**Effort:** Medium
**Risk:** High

### Option 3: A small VPS

**Description:** Run both on one virtual server.

**Pros:**
- Full control, persistent disk

**Cons:**
- Costs money; patching and TLS are our job

**Effort:** Medium
**Risk:** Medium

---

## Decision Outcome

**Chosen Option:** Option 1, Vercel for the frontend and Render for the backend

### Rationale
It is the only free option that runs a persistent backend process. The sleep problem is solved by `.github/workflows/keepalive.yml`, which calls `/api/health` every 10 minutes. The ephemeral disk is acceptable because live data is re-synced on start-up and the outlook is re-fetched.

### Expected Consequences

**Positive:**
- No hosting cost; automatic HTTPS
- Visitors do not wait for a cold start

**Negative:**
- Readings history resets when Render redeploys
- One backend instance; no horizontal scaling (AD-0001)

**Neutral:**
- The frontend calls the backend URL set in its build environment; the CSP allows only that origin

---

## Implementation Notes

### Implementation Steps
1. Add `render.yaml` with the `hydrosentinel-ph-api` web service and its environment keys.
2. Create the Vercel project with root directory `frontend`.
3. Add the keep-alive workflow.
4. Set `CORS_ORIGINS` and `CORS_ORIGIN_REGEX` on Render to the Vercel domains.

### Affected Components
- `render.yaml`, `.github/workflows/keepalive.yml`: new
- `frontend/next.config.ts`: CSP `connect-src` names the backend URL

### Migration Strategy
Vercel Git builds first failed because the project root directory was set to `.`, where there is no Next.js app. It was changed to `frontend` through the Vercel API, after which builds succeeded.

### Rollback Plan
Both platforms keep previous deployments; promote the last good one.

---

## Validation

### Acceptance Criteria
- [x] Vercel builds from Git with root directory `frontend`
- [x] `/api/health` answers within seconds at any time of day
- [x] Secrets are set only in platform environment variables

### Success Metrics
- Keep-alive job success rate: every scheduled run green
- Hosting cost: US$0

### Validation Timeline
- Both deployments live: 2026-11-03

---

## Abandoned Ideas

### Running the backend as serverless functions
**Reason:** It cannot hold the background loop or caches, and would retrain models per request.

---

## Related Decisions

| ADR | Title | Relationship |
|-----|-------|--------------|
| ADR-0004 | Admin key and rate limits | Secrets live in Render environment variables |
| ADR-0006 | Service worker caching strategy | Frontend serves `sw.js` with no-cache headers |

---

## References

- `render.yaml`
- `.github/workflows/keepalive.yml`
- Render free instance behaviour: https://render.com/docs/free

---

## Discussion Notes

A managed database is the first change to make if history must survive redeploys (AD-0001 open question).

---

**Document Maintained By:** Debb1ie
**Decision Recorded:** 2026-11-03
