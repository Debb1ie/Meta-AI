---
type: ADR
id: "0006"
title: "Service worker caching strategy: never cache RSC payloads"
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
    summary: "Decision recorded after the stale RSC crash"
---

# ADR-0006: Service worker caching strategy: never cache RSC payloads

## Status

**Accepted**

- **Deciders:** Debb1ie
- **Date:** 2026-11-03
- **Supersedes:** None
- **Superseded by:** None

---

## Context

HydroSentinel is a PWA so that DRRM officers still see the last data they loaded when connectivity drops during a storm.

### Background
The first service worker used stale-while-revalidate for almost every GET, including Next.js React Server Component (RSC) payloads (requests with `?_rsc=` or an `RSC` header). After a new deployment, returning visitors received a cached RSC payload from the old build. It referenced JavaScript chunks that no longer existed, and the page failed with "Application error: a client-side exception has occurred".

### Problem Statement
How do we keep offline support without ever serving content from an older build that breaks the current one?

### Requirements
- A new deployment must never crash an open or returning client.
- Offline users still see the last data they loaded, with a banner.
- AI questions, uploads and syncs are never served from cache.
- The service worker itself must update promptly.

### Constraints
- Next.js 15 App Router, which fetches RSC payloads on navigation
- Static assets under `/_next/static` are content-hashed

---

## Decision Drivers

- No crash after deploys
- Offline fallback for data
- Simple rules that are easy to audit

---

## Considered Options

### Option 1: Per-request-type strategies, RSC never cached (service worker v3)

**Description:** Cache-first only for immutable `/_next/static/*`; network-first for pages and API GETs with cache as offline fallback; never cache RSC payloads or POSTs; cache-first for map tiles with a 400-tile cap; delete caches from older versions on activate.

**Pros:**
- Removes the crash at its cause
- Keeps offline data

**Cons:**
- Navigation needs the network for fresh RSC data

**Effort:** Low
**Risk:** Low

### Option 2: Keep stale-while-revalidate and bump the cache version on each deploy

**Description:** Rely on version changes to clear caches.

**Pros:**
- Faster repeat visits

**Cons:**
- A client with the old worker still serves stale payloads until it updates; easy to forget the bump

**Effort:** Low
**Risk:** High

### Option 3: Remove the service worker

**Description:** No offline support.

**Pros:**
- No cache bugs possible

**Cons:**
- Loses the offline fallback that matters most during storms

**Effort:** Low
**Risk:** Medium

---

## Decision Outcome

**Chosen Option:** Option 1, per-request-type strategies with RSC never cached

### Rationale
The crash came from caching one kind of response that is tied to a specific build. Not caching it removes the failure while keeping every offline benefit. Three further safeguards make updates reliable:
- `sw.js` is served with `Cache-Control: no-cache, no-store, must-revalidate` (in `next.config.ts`), so browsers always check for a new worker.
- The worker calls `skipWaiting` and `clients.claim`, and deletes every cache whose name does not start with `hs-v3`.
- `frontend/src/app/error.tsx` detects a chunk-load error (`ChunkLoadError`, "Loading chunk", "Failed to fetch dynamically imported module") and reloads the page once, using a `sessionStorage` flag so it cannot loop.

### Expected Consequences

**Positive:**
- Deployments no longer crash returning visitors
- Offline users see the last data with the banner "You're offline. Showing the last data saved on this device."

**Negative:**
- Offline navigation to a page never visited before is not available

**Neutral:**
- Development builds do not register the worker ("Offline cache off (dev)")

---

## Implementation Notes

### Implementation Steps
1. Rewrite `frontend/public/sw.js` as version `hs-v3` with caches `shell`, `static`, `data` and `tiles`.
2. Skip RSC requests (`?_rsc=` or `RSC` header) and all non-GET requests.
3. Serve `/sw.js` with no-cache headers.
4. Add chunk-error auto-reload to `error.tsx`.

### Affected Components
- `frontend/public/sw.js`: rewritten
- `frontend/next.config.ts`: headers for `/sw.js`
- `frontend/src/app/error.tsx`: reload once on chunk errors
- `frontend/src/app/pwa-register.tsx`: registration

### Migration Strategy
On activate, v3 deletes all caches from older versions, so affected clients recover on their next visit.

### Rollback Plan
Deploy a worker that unregisters itself and clears caches; the app works without it.

---

## Validation

### Acceptance Criteria
- [x] After a new deployment, a returning client loads without "Application error"
- [x] RSC and POST requests never appear in Cache Storage
- [x] Offline, the dashboard shows the last loaded data and the banner
- [x] Caches from earlier service worker versions are removed on activate

### Success Metrics
- Client-side exceptions after deploys: 0
- Tile cache size: at most 400 entries

### Validation Timeline
- v3 deployed: 2026-11-03

---

## Abandoned Ideas

### Stale-while-revalidate for pages
**Reason:** It is the pattern that produced the crash; pages now use network-first.

---

## Related Decisions

| ADR | Title | Relationship |
|-----|-------|--------------|
| ADR-0005 | Vercel and Render hosting | Vercel serves `sw.js` with the no-cache header |

---

## References

- `frontend/public/sw.js`
- `frontend/src/app/error.tsx`
- Next.js App Router data fetching and RSC payloads: https://nextjs.org/docs/app

---

## Discussion Notes

The lesson: cache only what is immutable or what you can safely serve stale. Build-specific payloads are neither.

---

**Document Maintained By:** Debb1ie
**Decision Recorded:** 2026-11-03
