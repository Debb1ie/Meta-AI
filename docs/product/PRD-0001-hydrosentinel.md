---
type: PRD
id: "0001"
title: "HydroSentinel: flood early warning for the Philippines"
status: Approved
version: "1.0"
created: "2026-11-03"
updated: "2026-11-03"
author: "Debb1ie"
owner: "Debb1ie"
phase: "Phase 1"
priority: "P1"
product_type: "Web application (PWA) with a public API"
dependencies: []
related_docs:
  - "AD-0001"
  - "RFC-0001"
  - "RFC-0002"
  - "TP-0001"
  - "ADR-0001"
  - "ADR-0002"
  - "ADR-0003"
  - "ADR-0004"
  - "ADR-0005"
  - "ADR-0006"
  - "ADR-0007"
approvals:
  product_lead: { name: "Debb1ie", date: "2026-11-03", approved: true }
  tech_lead: { name: "Debb1ie", date: "2026-11-03", approved: true }
  architect: { name: "Debb1ie", date: "2026-11-03", approved: true }
---

# Product 1: HydroSentinel, flood early warning for the Philippines

**Product Owner:** Debb1ie | **Status:** Approved | **Phase:** Phase 1

This is the only product PRD in the set, so there is no main PRD or next product to link to. See the [documentation index](../README.md).

---

## 📋 Document Information

**Document Type:** Functional Specifications (PRD)
**Companion Documents:**
- **Architecture:** [AD-0001 System architecture](../architecture/AD-0001-system-architecture.md)
- **Engineering:** [RFC-0001 Verifiable flood-watch agent](../engineering/RFC-0001-verifiable-flood-watch-agent.md), [RFC-0002 Research 3D forecast layer](../engineering/RFC-0002-research-3d-forecast-layer.md)
- **Testing:** [TP-0001 Test plan](../engineering/TP-0001-test-plan.md)
- **UX specifications:** No separate feature UX files exist. The visual rules live in [ADR-0007](../architecture/ADRs/ADR-0007-plain-language-status-and-one-colour-system.md) and in `frontend/src/app/globals.css`.

**How to Use:**
- **Product:** Read this PRD for what each user can do and the rules the product follows.
- **Design:** Use this PRD with ADR-0007 (status words, colours and fonts).
- **Engineering:** Use this PRD with AD-0001 and the RFCs for how each feature is built.

---

## Product Changelog

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial PRD, written to match the shipped product |

---

## Product Overview

### Vision
An average of 20 tropical cyclones enter the Philippine Area of Responsibility each year (PAGASA). Flood response is a handoff problem: from a sensor to a forecast, from a forecast to a family, and from uncertainty to a decision. HydroSentinel watches Philippine rivers, typhoons and rainfall around the clock. It turns open data into a tested forecast, a briefing whose every number is checked against its source, and short alerts people can read in their own language. The goal is to give communities more time.

### Scope

**In Scope:**
- A 30-day daily river-flow outlook for 17 major Philippine basins, from the Cagayan in the north to the Mindanao River in the south.
- Live hourly gauges (10 UK Environment Agency stations) used to run and prove the forecasting engine on measured data.
- Active typhoon and flood events from GDACS, and rainfall forecasts from Open-Meteo.
- A Muse Spark agent that investigates the data with tools and writes a cited, number-checked briefing.
- Plain-language Q&A and SMS drafts in English, Filipino, Cebuano, Ilocano and Hiligaynon.
- A flood-photo check (SAM 3.1) and alert-poster and preparedness-graphic generation (Muse Image).
- A CSV data checker, CSV export, a research page with a 3D forecast view, and an installable PWA with offline fallback.

**Out of Scope:**
- Official warnings. PAGASA and local DRRM offices issue those; HydroSentinel always points to them.
- Measured gauge data for Philippine rivers. No open, machine-readable hourly feed was available; see ADR-0001 and ADR-0002.
- Sending SMS. The product drafts messages; it does not deliver them.
- User accounts and personal data. There is no sign-in for the public, and nothing personal is stored.

### Key Capabilities
- **Philippine outlook:** Modelled daily flow for 17 basins with alert levels taken from each river's own five-year record.
- **Live gauges and forecasts:** Hourly levels cleaned, forecast at 1 to 24 hours ahead and scored against a no-change baseline.
- **Verifiable agent:** A tool-calling briefing in which every number must cite a tool result and is checked by the server.
- **Ask in your language:** Short, calm answers and SMS drafts in five languages.
- **Vision and image tools:** Flood-photo segmentation, alert posters and preparedness graphics, each labelled as AI output.
- **Open data with a trail:** Every reading keeps its source and exports to CSV.

### Business Rules
- **Not an official warning:** Every briefing, answer and SMS points to PAGASA and local authorities for official warnings.
- **One status system:** Users see three states only: Normal, Watch and Alert, each with a word, an icon and a colour.
- **Every number is checked:** An agent briefing is shown with its verification result; numbers that do not match their cited source are flagged.
- **Honest uncertainty:** Forecasts show a likely range, and model skill is shown against a simple no-change baseline.
- **Alert levels are protected:** Only an operator with the admin key can change alert levels or reload data.

---

## Features Summary

| # | Feature | Stories | Key Capabilities |
|---|---------|---------|------------------|
| 1.1 | Philippine river outlook | 4 | 17-basin map, 30-day flow, alert levels, river status card |
| 1.2 | Live gauges and forecasts | 4 | Hourly levels, multi-horizon forecasts, skill scores, CSV export |
| 1.3 | Verifiable flood-watch agent | 4 | Tool calls, citations, number checks, scheduled runs |
| 1.4 | Ask and SMS in five languages | 3 | Plain-language Q&A, SMS drafts, official-source pointer |
| 1.5 | Hazards and rainfall | 2 | GDACS events near the Philippines, rain totals |
| 1.6 | Vision and image tools | 3 | Flood-photo check, alert poster, preparedness graphic |
| 1.7 | Data tools | 3 | CSV checker, CSV import, CSV export |
| 1.8 | Research 3D forecast view | 2 | 3D flow columns over the archipelago, day slider |
| 1.9 | Operator controls | 3 | Admin-only alert levels, data reload, demo reset |
| 1.10 | Installable app and offline use | 2 | PWA install, offline fallback of last data |

**Total:** 30 user stories across 10 features

---

## Feature 1.1: Philippine river outlook

**Narrative:** Planners and DRRM offices need to know which Philippine rivers are heading toward high flow in the coming days. The outlook shows 17 major basins on a map, each with today's modelled flow, its 3-day trend, its 7-day peak and a status. Alert levels come from each river's own five-year record, so "high" means high for that river.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 4 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.1.1** | **See every basin on a map** | As a planner, I see all 17 basins on a map of the Philippines, each coloured by status. | • Status is Normal, Watch or Alert with an icon and a word, never colour alone<br>• Map tiles are Esri Gray Canvas; the outline is Natural Earth<br>• Error: "You're offline. Showing the last data saved on this device." shown when the device is offline |
| **1.1.2** | **Open one basin's 30-day flow** | As a planner, I pick a basin and see 30 days of past flow and up to 30 days ahead, with its alert levels. | • Past and forecast days are visually distinct<br>• The likely range is shown for forecast days<br>• Alert levels are labelled as the 95th, 99th and 99.8th percentiles of the basin's five-year record |
| **1.1.3** | **Read today's river status** | As a resident or DRRM officer, I see a status card for a river: the word, how close the 7-day peak is to the Watch level, and whether the flow is rising, falling or steady. | • Trend is "rising" or "falling" only when the 3-day change is at least 15%<br>• Times are shown in Philippine time<br>• The Watch line is drawn to scale only when it fits; otherwise it is named, never faked |
| **1.1.4** | **Know where the numbers come from** | As any user, I can see that the flow is modelled by GloFAS and when it was last refreshed. | • Source and licence (CC BY 4.0) are shown<br>• Data is refreshed at least every 3 hours |

### Cross-Product References
- Feature 1.3 uses the outlook as its main evidence; Feature 1.8 shows the same data in 3D.

---

## Feature 1.2: Live gauges and forecasts

**Narrative:** To prove the forecasting engine works on real measured data, HydroSentinel runs it on 10 live UK Environment Agency river gauges (see ADR-0002). Users see each gauge's level, the forecast for the next 1 to 24 hours with a likely range, and how much better the forecast is than assuming nothing changes.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 4 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.2.1** | **See live gauge levels** | As an analyst, I see each gauge's latest level, rate of rise, data age and status. | • Gauges refresh every 15 minutes<br>• A reading older than expected is marked as stale |
| **1.2.2** | **See a forecast with a range** | As an analyst, I see forecasts at 1, 3, 6, 12 and 24 hours ahead, each with an 80% likely range. | • The range is shown wherever a point forecast is shown<br>• Error: "Not enough test data for this horizon." shown when a gauge has too little held-out history to score a horizon |
| **1.2.3** | **Check forecast skill** | As an analyst, I see each model's error on data it never saw and its skill against a no-change baseline. | • Three models compete per horizon; the best on validation data is used<br>• Skill below zero is shown honestly, not hidden |
| **1.2.4** | **Understand the risk level** | As an analyst, I see why a gauge has its status: which reading or forecast crossed which level. | • The highest triggered level wins<br>• Every trigger is listed as evidence |

### Cross-Product References
- Feature 1.3 reads gauges and forecasts through its tools; Feature 1.7 exports the series.

---

## Feature 1.3: Verifiable flood-watch agent

**Narrative:** A Muse Spark agent investigates the current situation by calling tools (hazards, basins, rain, gauges), then writes a short briefing: a situation summary, a watchlist and an SMS draft. Each claim must cite the tool result behind it. The server checks every number against that result before the briefing is shown, so users can trust or question each line.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 4 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.3.1** | **Watch the agent investigate** | As a DRRM officer, I watch each tool call happen in order, with a short preview of what it returned. | • Steps stream as they happen<br>• At most 8 steps per run |
| **1.3.2** | **Tap a citation** | As a DRRM officer, I tap any citation in the briefing and see the exact data behind it. | • Every situation line and watchlist entry has at least one citation |
| **1.3.3** | **See the verification result** | As any user, I see how many numbers were checked and how many matched, and which did not. | • Shown as "N of N numbers verified"<br>• Unmatched numbers are listed with their claim |
| **1.3.4** | **Get a recent briefing without waiting** | As any user, I see the latest briefing immediately; a new one is produced automatically every 3 hours. | • Manual runs have a 10-minute cooldown and a daily cap of 40 runs<br>• Error: "A briefing from N min ago is still fresh; showing it instead of a new run." shown when the cooldown applies<br>• Error: "Daily limit of 40 agent runs reached; showing the latest briefing." shown when the daily cap is reached<br>• Error: "The agent is already running. Its briefing will appear when it finishes." shown when a run is in progress |

### Cross-Product References
- Depends on Features 1.1, 1.2 and 1.5 for its evidence. See RFC-0001 and ADR-0003.

---

## Feature 1.4: Ask and SMS in five languages

**Narrative:** People ask questions the way they speak, for example "Ligtas ba ang Ilog Cagayan ngayong linggo?". The analyst answers in short, calm language and drafts an SMS a barangay can forward, in English, Filipino, Cebuano, Ilocano or Hiligaynon.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 3 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.4.1** | **Ask a question** | As a resident, I type a question in English or Filipino and get a short answer based on current data. | • The answer names the rivers and numbers it used<br>• Error: "Too many requests for this feature. Try again in N seconds." shown when the rate limit is reached |
| **1.4.2** | **Choose a language** | As a DRRM officer, I choose one of five languages for the answer and SMS. | • English, Filipino, Cebuano, Ilocano, Hiligaynon |
| **1.4.3** | **Always see the official source** | As a resident, every answer and SMS tells me to follow PAGASA and local authorities. | • The pointer cannot be removed by the question |

---

## Feature 1.5: Hazards and rainfall

**Narrative:** Floods follow storms and rain. HydroSentinel lists active tropical cyclones and floods from GDACS, nearest to the Philippines first, and shows rainfall forecasts for each basin and gauge.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 2 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.5.1** | **See storms near the Philippines** | As a planner, I see active events with distance from the Philippines and impact level. | • Events within 600 km are marked as affecting the Philippines; within 2,500 km as near<br>• Impact is shown as Low, Moderate or High |
| **1.5.2** | **See expected rain** | As a planner, I see rain totals for the next 6, 24 and 72 hours at a basin or gauge. | • Source is Open-Meteo<br>• If the rain provider fails, the place is shown as unavailable and other features keep working |

---

## Feature 1.6: Vision and image tools

**Narrative:** A photo of a flooded street can be checked with SAM 3.1, which outlines water in the image. Muse Image generates an alert poster or a preparedness graphic that a barangay can print or share. Every result is labelled as AI-generated.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 3 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.6.1** | **Check a flood photo** | As a DRRM officer, I upload a photo and see the flooded area outlined with its share of the image. | • Photos are not stored<br>• Error: "Too many requests for this feature. Try again in N seconds." shown when the limit is reached |
| **1.6.2** | **Make an alert poster** | As a DRRM officer, I generate a poster for a river and status. | • The poster is labelled as AI-generated |
| **1.6.3** | **Make a preparedness graphic** | As a barangay, I generate a graphic with preparedness steps. | • The graphic is labelled as AI-generated |

---

## Feature 1.7: Data tools

**Narrative:** Analysts bring their own gauge data. The checker previews a CSV, reports gaps, spikes and format problems, and lets an operator import it. Any series can be exported to CSV.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 3 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.7.1** | **Check a CSV** | As an analyst, I upload a CSV and see what is wrong with it before importing. | • A template and a synthetic Marikina typhoon demo file are downloadable<br>• Error: "Could not parse CSV: (reason)" shown when parsing fails<br>• Error: "CSV is larger than 25 MB." shown when the file is too large<br>• Error: "The uploaded file is empty." shown for an empty file |
| **1.7.2** | **Import a CSV** | As an operator, I import a checked CSV as a gauge series. | • Requires the admin key<br>• Error: "No valid rows to import." shown when every row fails the checks |
| **1.7.3** | **Export a series** | As any user, I download a gauge's readings and forecasts as CSV. | • The export includes the source of each reading |

---

## Feature 1.8: Research 3D forecast view

**Narrative:** A research page shows each basin as a column over a 3D outline of the Philippines. Height and colour show flow as a share of the basin's Watch level, and a slider moves through the days. It also lists every parameter the engine uses. See RFC-0002.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 2 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.8.1** | **Explore flow in 3D** | As a researcher, I rotate the 3D map, move the day slider and hover a column to see the basin. | • Columns are capped so one extreme river does not flatten the rest<br>• Motion is reduced when the user prefers reduced motion |
| **1.8.2** | **See the method** | As a researcher, I see the parameters behind the outlook and forecasts. | • Values are read from the running system, not typed by hand |

---

## Feature 1.9: Operator controls

**Narrative:** Changing an alert level changes what the public sees, so it must be protected. Only an operator with the admin key can change alert levels, import data, trigger a live sync or reset the demo.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 3 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.9.1** | **Change alert levels** | As an operator, I set a gauge's advisory, warning and critical levels. | • Levels must increase: advisory < warning < critical<br>• Error: "Admin key required for this action." shown when the key is missing or wrong<br>• Error: "Admin actions are disabled on this deployment (no ADMIN_TOKEN configured)." shown when the server has no admin key set |
| **1.9.2** | **Reload live data** | As an operator, I trigger a live sync without waiting for the 15-minute cycle. | • Requires the admin key |
| **1.9.3** | **Reset the demo** | As an operator, I remove simulated data and restore the demo state. | • Requires the admin key |

---

## Feature 1.10: Installable app and offline use

**Narrative:** Connectivity drops during storms. HydroSentinel installs as an app and shows the last data a user loaded when they go offline, with a clear offline banner.

**Feature Changelog:**

| Version | Date | Changed By | Summary of Changes |
|---------|------|------------|-------------------|
| 1.0 | 2026-11-03 | Debb1ie | Initial feature definition - 2 stories |

---

### Stories (Consolidated)

| # | Story | Description | Key Requirements |
|---|-------|-------------|------------------|
| **1.10.1** | **Install the app** | As a DRRM officer, I add HydroSentinel to my home screen. | • Manifest with 192 and 512 px icons |
| **1.10.2** | **Use it offline** | As a DRRM officer, I still see the last data I loaded when offline. | • Banner: "You're offline. Showing the last data saved on this device."<br>• AI questions and uploads are never served from cache<br>• A new deployment never breaks an open app (see ADR-0006) |

> **Scope note:** Stories describe user-facing behaviour only. API details live in RFC-0001, RFC-0002 and AD-0001.

### Cross-Product References
- HydroSentinel is a single product; there are no other products to reference.

---

## Dependencies

### Product Dependencies

**This product depends on:**

| Product | Reason | Specific Features |
|---------|--------|------------------|
| None | HydroSentinel is a single, self-contained product | Not applicable |

**This product enables:**

| Product | How | Notes |
|---------|-----|-------|
| Local DRRM workflows | Forwardable SMS drafts, posters and CSV exports | Outside the product; HydroSentinel does not send messages |

### External Dependencies

| Service | Purpose | Fallback Strategy |
|---------|---------|-------------------|
| Open-Meteo Flood API (GloFAS v4) | Philippine daily river discharge | 3-hour cache; last good data shown with its age |
| UK Environment Agency flood-monitoring API | Live measured gauge levels and UK warnings | Last synced readings kept in the database; marked stale |
| GDACS | Active tropical cyclones and floods | Cached; the hazards list says the feed is unavailable |
| Open-Meteo forecast API | Rainfall forecasts | Feature 1.5.2 error message; forecasts still run without rain features |
| Meta Model API (Muse Spark, SAM 3.1, Muse Image) | Agent, Q&A, segmentation, image generation | The last saved briefing is still shown; AI features return "Meta Model API is not configured." when no key is set |
| Esri Gray Canvas tiles, Natural Earth | Basemap and Philippine outline | Outline is bundled with the app; tiles are cached by the service worker |

---

## Business Rules

### Safety rules
- **Official source first:** Every AI output points to PAGASA and local authorities and never claims to be an official warning.
- **Alert levels are settings, not official levels:** Gauge thresholds come from the Environment Agency stage scale; basin levels come from each river's five-year record.

### Trust rules
- **Cite or flag:** Each briefing claim cites a tool result; numbers that do not match within rounding are flagged.
- **Show skill honestly:** Forecast scores are computed on data the model never saw and compared with a no-change baseline.

### Access and cost rules
- **Admin key for changes:** Any action that changes data needs the admin key.
- **Rate limits on AI features:** Each AI feature has per-minute, per-day and global daily limits.
- **Agent budget:** Automatic runs every 3 hours, a 10-minute cooldown and at most 40 runs a day.

### Display rules
- **Three states only:** Normal, Watch and Alert. Internal advisory maps to Watch; warning and critical map to Alert.
- **Colour means status:** Green, amber and red are used only for status.

---

## Design System References

For the visual rules, refer to:
- **[ADR-0007](../architecture/ADRs/ADR-0007-plain-language-status-and-one-colour-system.md):** status words, icons, colours (#1E7A4C, #8A5300, #B42318) and fonts (Public Sans, Fraunces).
- **frontend/src/app/globals.css:** the design tokens, including `--rs-normal`, `--rs-watch` and `--rs-alert`.

---

## Future Enhancements

**Note:** Features that have been discussed but are not currently planned for development.

### Data
- **Philippine measured gauges:** Run the forecasting engine on PAGASA or DPWH gauges if an open, machine-readable feed becomes available.
- **Durable storage:** Move from SQLite on an ephemeral disk to a managed database so history survives restarts.

### Delivery
- **SMS delivery:** Send drafted alerts through an SMS gateway with opt-in subscriber lists.
- **Push notifications:** Notify installed apps when a basin moves to Watch or Alert.

---

**Document Maintained By:** Debb1ie
**Product:** HydroSentinel (Product 1)
**Last Reviewed:** 2026-11-03
**Next Review:** 2027-02-03
