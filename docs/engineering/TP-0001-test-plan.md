---
type: TP
id: "0001"
title: "HydroSentinel test plan"
status: Approved
version: "1.0.0"
created: "2026-11-03"
updated: "2026-11-03"
author: "Debb1ie"
qa_lead: "Debb1ie"
related_rfcs: ["RFC-0001", "RFC-0002"]
related_docs: ["PRD-0001", "AD-0001", "ADR-0003", "ADR-0004", "ADR-0006"]
test_cases:
  - "TC-0001"
  - "TC-0002"
  - "TC-0003"
  - "TC-0004"
  - "TC-0005"
  - "TC-0006"
  - "TC-0007"
  - "TC-0008"
  - "TC-0009"
  - "TC-0010"
approvals:
  qa_lead: { name: "Debb1ie", date: "2026-11-03", approved: true }
  tech_lead: { name: "Debb1ie", date: "2026-11-03", approved: true }
changelog:
  - version: "1.0.0"
    date: "2026-11-03"
    author: "Debb1ie"
    summary: "Initial test plan"
---

# TP-0001: HydroSentinel test plan

**QA Lead:** Debb1ie | **Status:** Approved | **Version:** 1.0.0

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document Type | Test Plan (TP) |
| Version | 1.0.0 |
| Last Updated | 2026-11-03 |
| QA Lead | Debb1ie |

---

## Document Changelog

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0.0 | 2026-11-03 | Debb1ie | Initial test plan |

---

## Overview

### Purpose
This plan describes how HydroSentinel is tested: the automated backend suite, the manual checks on the frontend and the live deployment, and the criteria for calling a release ready.

### Scope

**In Scope:**
- Data validation and preprocessing (CSV checks, resampling, spike filter)
- Forecasting engine (models, split, conformal intervals, skill, determinism)
- Risk classification
- Agent verification and budget (RFC-0001)
- AI client parsing and SAM 3.1 image handling
- API behaviour, admin key, rate limits, security headers and CORS (ADR-0004)
- Frontend flows, service worker behaviour after deploys (ADR-0006), research page (RFC-0002)

**Out of Scope:**
- The accuracy of GloFAS, GDACS or Environment Agency data (provider responsibility)
- Load testing beyond a single free instance
- Live Meta Model API quality (only parsing and error handling are tested automatically)

### Test Objectives
- Show that every forecast horizon is scored on data the model never saw, against persistence.
- Show that risk levels follow the documented rules with evidence for every trigger.
- Show that invented numbers in an agent briefing are always flagged.
- Show that anonymous users cannot change data and that AI routes are rate-limited.
- Show that a new deployment does not crash returning clients.

### Related Documents

| Document | Type | Relationship |
|----------|------|--------------|
| [PRD-0001](../product/PRD-0001-hydrosentinel.md) | PRD | Features and business rules under test |
| [AD-0001](../architecture/AD-0001-system-architecture.md) | AD | Components under test |
| [RFC-0001](RFC-0001-verifiable-flood-watch-agent.md) | RFC | Agent testing strategy |
| [RFC-0002](RFC-0002-research-3d-forecast-layer.md) | RFC | Research page testing strategy |
| [ADR-0004](../architecture/ADRs/ADR-0004-admin-key-and-rate-limits.md) | ADR | Security behaviour under test |
| [ADR-0006](../architecture/ADRs/ADR-0006-service-worker-caching-strategy.md) | ADR | Service worker behaviour under test |

---

## Test Strategy

### Test Levels

| Level | Coverage Target | Automation | Owner |
|-------|-----------------|------------|-------|
| Unit | Every module in `backend/app` with logic (no line-coverage target is enforced) | Automated (pytest) | Debb1ie |
| Integration | Every API router through FastAPI `TestClient` | Automated (pytest) | Debb1ie |
| E2E | Critical user paths in PRD-0001 | Manual in the browser | Debb1ie |
| Performance | Agent tokens per run; cached response times | Manual | Debb1ie |
| Security | Admin key, rate limits, headers, CORS | Automated (pytest) plus manual review | Debb1ie |
| UAT | Demo flows on the landing page ("Four things to try") | Manual | Debb1ie |

### Test Types

| Type | Description | When |
|------|-------------|------|
| Smoke | `/api/health`, landing page, `/featured`, `/research` load | After every deploy |
| Regression | Full pytest suite | Before every deploy |
| Functional | Feature checks per PRD story | During development |
| Performance | Agent usage, page load on a phone | Before release |
| Security | `test_security.py`, header and CORS checks | Before every deploy |

### Test Approach

**Automated Testing:**
- Framework: pytest 9 with FastAPI `TestClient` (`backend/tests`)
- CI Integration: none; the suite is run locally before each deploy
- Coverage Tool: none configured

**Manual Testing:**
- Exploratory testing of each tab in `/featured`
- The four "Try it yourself" flows on the landing page
- Service worker checks across a redeploy (DevTools, Application panel)
- Frontend lint with `npm run lint` and type-check with `npm run build`

---

## Test Environment

### Environment Requirements

| Environment | Purpose | Configuration |
|-------------|---------|---------------|
| Development | Unit and integration tests | Local Python with `uv`, SQLite, external providers stubbed in tests |
| Staging | Not used | There is no separate staging environment; Vercel preview deployments are used for frontend checks |
| Production | Smoke tests and E2E checks | Vercel (frontend) and Render (backend) |

### Test Data Requirements

| Data Type | Source | Volume | Notes |
|-----------|--------|--------|-------|
| Simulated gauge series | `test_forecasting.py` fixtures (`sim_station`, `sim_result`) | Weeks of hourly data | Deterministic; used by forecasting tests |
| Demo scenario CSV | `frontend/public/samples/demo-scenario-marikina-typhoon-synthetic.csv` | One station | Synthetic typhoon with real-world gaps; for the data checker |
| Live gauges | UK Environment Agency | 10 stations | Production only |
| Philippine outlook | GloFAS via Open-Meteo | 17 basins | Production only |

### Test Data Management
- Seed data location: fixtures in `backend/tests/conftest.py` and `backend/tests/test_forecasting.py`, and the demo seed behind `SEED_DEMO_DATA`
- Data refresh frequency: generated fresh for each test run
- PII handling: no personal data exists in the system or the test data

### Tools & Infrastructure

| Tool | Purpose | Version |
|------|---------|---------|
| pytest | Unit and integration tests | 9.2 or later |
| FastAPI TestClient | API tests | As pinned in `uv.lock` |
| ESLint | Frontend lint | As pinned in `package-lock.json` |
| Next.js build | Frontend type-check and build | 15.5 |
| Browser DevTools | Service worker, cache and network checks | Current Chrome |
| GitHub Actions keep-alive | Ongoing health check of the backend | `keepalive.yml` |

---

## Test Schedule

| Phase | Start Date | End Date | Activities | Owner |
|-------|------------|----------|------------|-------|
| Test Planning | 2026-11-03 | 2026-11-03 | Write this plan | Debb1ie |
| Test Prep | Ongoing | Ongoing | Fixtures maintained with the code | Debb1ie |
| Execution | Before every deploy | Before every deploy | Run pytest, lint and build; smoke test after deploy | Debb1ie |
| Reporting | After each run | After each run | Results recorded in the security and quality reports in `reports/` | Debb1ie |

---

## Test Cases Summary

| Category | Total | Automated | Manual | Priority |
|----------|-------|-----------|--------|----------|
| Forecasting and preprocessing (`test_forecasting.py`) | 19 | 19 | 0 | Critical |
| Risk (`test_risk.py`) | 12 | 12 | 0 | Critical |
| AI client and segmentation (`test_ai.py`) | 10 | 10 | 0 | High |
| Security (`test_security.py`) | 6 | 6 | 0 | Critical |
| API (`test_api.py`) | 5 | 5 | 0 | High |
| Agent (`test_agent.py`) | 4 | 4 | 0 | Critical |
| Frontend and PWA flows | 6 | 0 | 6 | High |
| **Total** | **62** | **56** | **6** | |

Counts are test functions. Some are parametrized and run several cases; for example the admin-key test runs once for each of four routes, so the security file runs 9 cases.

### Critical Test Cases

| TC ID | Title | Priority | Automation |
|-------|-------|----------|------------|
| TC-0001 | Features use only past data (`test_features_use_only_past_data`) | Critical | Auto |
| TC-0002 | Split is chronological and model chosen on calibration, not test | Critical | Auto |
| TC-0003 | Interval coverage is near nominal | Critical | Auto |
| TC-0004 | Highest risk trigger wins and all evidence is kept | Critical | Auto |
| TC-0005 | Agent verification flags invented numbers and unknown evidence | Critical | Auto |
| TC-0006 | Data-changing endpoints require the admin key | Critical | Auto |
| TC-0007 | Anonymous user cannot fake an alert | Critical | Auto |
| TC-0008 | Rate limit returns 429 with `Retry-After` | Critical | Auto |
| TC-0009 | Returning client loads without error after a new deployment | Critical | Manual |
| TC-0010 | Offline: last data shown with the offline banner | High | Manual |

### Test Case Matrix

| Feature | Happy Path | Error Handling | Edge Cases | Security |
|---------|------------|----------------|------------|----------|
| Data validation (PRD 1.7) | `test_csv_preview_then_import` | `test_validation_reports_missing_columns` | `test_validation_rejects_future_timestamps` | TC-0006 (import needs admin key) |
| Forecasting (PRD 1.2) | `test_pipeline_outputs_all_headline_horizons` | `test_insufficient_data_raises` | `test_short_series_uses_baselines_only` | Not applicable |
| Risk (PRD 1.2) | `test_observed_level_sets_risk` | `test_thresholds_must_be_ordered` | `test_upper_bound_beyond_near_term_is_ignored` | TC-0007 |
| Agent (PRD 1.3) | `test_verify_accepts_rounded_numbers_counts_and_dates` | `test_verify_flags_invented_numbers_and_unknown_evidence` | `test_verify_ignores_negative_signs_and_iso_timestamps` | `test_budget_guard_serves_fresh_briefing_and_caps_runs` |
| AI tools (PRD 1.4, 1.6) | `test_chat_json_parses_structured_output` | `test_chat_json_http_errors` | `test_zero_detections_is_empty_not_error` | `test_ai_endpoints_fail_clearly_without_key` |
| API and headers | `test_overview_reports_every_station` | `test_cors_rejects_unknown_origins` | `test_admin_actions_disabled_without_configured_key` | `test_security_headers_on_api_responses` |
| PWA (PRD 1.10) | TC-0010 | TC-0009 | Development build does not register the worker | POSTs never cached (manual) |

---

## Entry Criteria

- [x] Code complete on `main`
- [x] Backend dependencies installed from `uv.lock`
- [x] Test fixtures generate data without network access
- [x] No secrets needed for automated tests (the Meta client is stubbed)
- [x] All known blockers resolved
- [x] Frontend builds locally

---

## Exit Criteria

- [x] All critical test cases executed
- [x] All critical and high defects resolved
- [x] All pytest tests pass
- [x] Agent run within the token budget (about 20,000 tokens)
- [x] Security tests pass and headers verified on the live API
- [x] Sign-off from QA Lead
- [x] Smoke test passes on the production URLs after deploy

---

## Suspension & Resumption Criteria

### Suspension Criteria
- Any security test fails
- A critical forecasting test fails (data leakage, non-chronological split)
- The production backend is unreachable for more than 4 hours

### Resumption Criteria
- Failing tests fixed and the full suite green
- Production health endpoint answering again
- Root cause noted in the quality report

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| No CI; tests depend on being run by hand | A regression could ship | Medium | Run the suite before every deploy; add CI later | Debb1ie |
| No frontend automated tests | UI regressions found late | Medium | Manual checklist; lint and build | Debb1ie |
| Provider outages during checks | E2E checks cannot run | Medium | Automated tests use stubs; retry later | Debb1ie |
| Model output varies between runs | Agent E2E differs each time | High | Verification makes errors visible; unit tests use fixed inputs | Debb1ie |
| Service worker caches hide new code | False test results after deploy | Medium | Test with DevTools "Update on reload" and a clean profile | Debb1ie |

---

## Defect Management

### Defect Severity

| Severity | Definition | SLA |
|----------|------------|-----|
| Critical | Wrong alert shown, data changed without authorisation, or app crash | Fix before next deploy |
| High | Feature broken (agent, outlook, gauges) | 1 day |
| Medium | Feature works with a workaround | 3 days |
| Low | Cosmetic issue | Next planned change |

### Defect Workflow
1. Found → Triaged → Assigned → In Progress → Fixed → Verified → Closed

Defects found and fixed so far include: an unauthenticated threshold change that could fake a critical alert (fixed with the admin key and security tests), a CORS regex that matched look-alike Vercel domains (restricted to the team suffix), the stale RSC payload crash (service worker v3), CARTO basemap tiles that began requiring a key (switched to Esri Gray Canvas) and hard-coded bars in an early hero chart (replaced with the real 15-day series).

### Defect Reporting
- Tool: GitHub issues on the repository
- Template: Steps to reproduce, expected result, actual result, environment (local or production URL)

---

## Deliverables

| Deliverable | Format | Audience | Timing |
|-------------|--------|----------|--------|
| Test Plan | Markdown (this document) | Team and reviewers | Before testing |
| Test Cases | pytest files in `backend/tests` | Engineers | With the code |
| Daily Report | Not produced | Not applicable | Single-developer project |
| Test Report | Markdown in `reports/` | Reviewers | Before submission |
| Defect Report | GitHub issues | Team | Ongoing |

---

## Resource Requirements

### Team

| Role | Name | Allocation | Responsibilities |
|------|------|------------|-----------------|
| QA Lead | Debb1ie | Part-time | Plan, sign-off |
| QA Engineer | Debb1ie | Part-time | Run tests, manual checks |
| Developer | Debb1ie | Part-time | Fix defects, maintain fixtures |

### External Dependencies
- UK Environment Agency, Open-Meteo and GDACS availability for production checks
- Meta Model API key for manual agent and AI checks
- Vercel and Render availability

---

## Communication Plan

| Event | Frequency | Channel | Participants |
|-------|-----------|---------|--------------|
| Test Status | Before each deploy | Commit notes and `reports/` | Debb1ie |
| Blocker Alert | As needed | GitHub issue | Debb1ie |
| Test Review | Before submission | Quality report | Debb1ie and reviewers |

---

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| QA Lead | Debb1ie | 2026-11-03 | Approved |
| Tech Lead | Debb1ie | 2026-11-03 | Approved |
| Product | Debb1ie | 2026-11-03 | Approved |

---

**Document Maintained By:** Debb1ie
**Last Reviewed:** 2026-11-03
