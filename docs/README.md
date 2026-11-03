# HydroSentinel documentation

These documents follow the templates from [nmblr.agent-kit](https://github.com/talino-labs/nmblr.agent-kit): a PRD for what the product does, an AD for how it is built, ADRs for each key decision, RFCs for the larger designs and a TP for how it is tested. All were written on 2026-11-03 by Debb1ie.

## Product

- [PRD-0001: HydroSentinel, flood early warning for the Philippines](product/PRD-0001-hydrosentinel.md): users, scope, 10 features and 30 user stories, business rules and external dependencies.

## Architecture

- [AD-0001: HydroSentinel system architecture](architecture/AD-0001-system-architecture.md): components, data flow, API, hosting, security and operations.

### Architecture decision records

- [ADR-0001: Use GloFAS via Open-Meteo for the Philippine river outlook](architecture/ADRs/ADR-0001-glofas-for-philippine-outlook.md): why the 17-basin outlook uses modelled GloFAS flow.
- [ADR-0002: Use UK Environment Agency gauges to validate the forecasting engine](architecture/ADRs/ADR-0002-uk-gauges-to-validate-the-engine.md): why live UK gauges prove the engine on measured data.
- [ADR-0003: A tool-calling agent whose numbers are checked by the server](architecture/ADRs/ADR-0003-verifiable-agent-with-numeric-checks.md): how every number in a briefing is checked against its source.
- [ADR-0004: Protect data changes with an admin key and AI features with rate limits](architecture/ADRs/ADR-0004-admin-key-and-rate-limits.md): the fix for fake alerts and unbounded AI cost.
- [ADR-0005: Host the frontend on Vercel and the backend on Render](architecture/ADRs/ADR-0005-vercel-and-render-hosting.md): free hosting that keeps a background loop running.
- [ADR-0006: Service worker caching strategy: never cache RSC payloads](architecture/ADRs/ADR-0006-service-worker-caching-strategy.md): the stale RSC crash and the v3 service worker that fixed it.
- [ADR-0007: Plain-language status words and one colour system](architecture/ADRs/ADR-0007-plain-language-status-and-one-colour-system.md): Normal, Watch and Alert, each with a word, an icon and a colour.

## Engineering

- [RFC-0001: Verifiable flood-watch agent](engineering/RFC-0001-verifiable-flood-watch-agent.md): tools, briefing schema, verification, budget and streaming (Implemented).
- [RFC-0002: Research page and 3D forecast layer](engineering/RFC-0002-research-3d-forecast-layer.md): the three.js view of all basins and the live method page (Implemented).
- [TP-0001: HydroSentinel test plan](engineering/TP-0001-test-plan.md): test levels, the 56 automated backend tests, manual checks and release criteria.
