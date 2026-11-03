# Submission form answers

For the Cerebral Valley submission form, Meta Global AI Developer Hackathon 2026.
Deadline: Wednesday, November 4, 9:00 PM ET (Thursday, November 5, 10:00 AM Philippine Time).

Copy each answer into the matching field. Two fields still need input from you: the demo video link and, if you enter it, the X post link.

## Project name

HydroSentinel

## Tagline (one line)

A verifiable Muse Spark agent that turns live river, rain and typhoon data into flood briefings and SMS alerts in five Philippine languages.

## Team

Precious Grace Deborah Manucom (GitHub: Debb1ie). Solo entry.

## Problem statement

Build for Your World

## Links

- Live demo: https://hydrosentinel-plum.vercel.app
- Repository: https://github.com/Debb1ie/Meta-AI
- What was built during the hackathon: https://github.com/Debb1ie/Meta-AI/blob/main/HACKATHON.md
- Demo video: add the link after uploading (YouTube, unlisted is fine)

## Description (short)

About 20 tropical cyclones enter the Philippine Area of Responsibility each year. When a river rises, barangay disaster officers have to decide quickly whether families should move, but the data they need is spread across several feeds in technical units.

HydroSentinel watches 17 Philippine river basins, live gauges, rainfall and typhoon alerts around the clock. A Muse Spark agent investigates the data with six tools, writes a briefing in which every claim cites its source, and drafts SMS alerts in Filipino, Cebuano, Ilocano, Hiligaynon and English. Our server then checks every number in the briefing against the tool result it cites before anyone sees it. SAM 3.1 measures flooding in field photos, and Muse Image makes community posters matched to the day's alert level.

## How it uses Meta AI

- **Muse Spark (`muse-spark-1.3`) as an agent.** Native tool calling over six read-only tools (GDACS hazards, 17 GloFAS basins, a single basin, Open-Meteo rain, live gauges, a single gauge), for up to 8 steps, with an evidence log. It then produces a schema-constrained JSON briefing: a headline, an overall level, a watchlist, claims with evidence IDs, and SMS text in five languages.
- **Muse Spark for Ask.** Questions in English, Filipino or Taglish, answered with structured JSON grounded in live basin and gauge data.
- **SAM 3.1 (`sam-3.1`).** Segments the water in a field photo and returns the flooded share of the frame with a mask overlay. Photos are processed in memory and never stored.
- **Muse Image (`muse-image-1.0`).** Preparedness and alert posters matched to the current alert level.

All three are called through the Meta Model API from the server only. The key never reaches the browser.

## What makes it technically interesting

- **Verification layer.** The model must cite an evidence ID for every claim. The server extracts every number and compares it with the cited tool output, within a tolerance of the larger of 0.051 and 2%. Unverified numbers and unknown evidence IDs are shown to the user. The latest live briefing verified 24 of 24 numbers.
- **Backtested forecasting.** Persistence, damped trend and gradient boosting compete for each horizon. They are scored on a chronological 70/10/20 split against a no-change baseline, with split-conformal uncertainty ranges.
- **Statistically grounded alert levels.** Watch, warning and critical levels are the 95th, 99th and 99.8th percentiles of each river's own last five years.
- **Research page.** A three.js 3D layer and heat map of 30 days of flow across the country, with the full methodology, parameters and live evaluation.
- **Security.** Admin key on all data-changing routes, per-IP and global rate limits on every AI route, an 8,000-token output cap, untrusted-data handling in prompts, CSP and security headers, and a privacy page under the Data Privacy Act of 2012 (RA 10173). The backend has 64 passing tests.

## Who it is for

- Barangay and municipal disaster risk reduction and management offices
- Provincial and LGU planners
- Families in flood-prone areas

The same pipeline already runs on UK Environment Agency gauges, so it can reach any country with open river data.

## Tech stack

Next.js 15 (PWA) on Vercel; FastAPI with Python 3.12 on Render; scikit-learn and pandas; three.js; SQLite. Data: GloFAS v4 via the Open-Meteo Flood API, UK Environment Agency real-time gauges, GDACS, Open-Meteo weather and Natural Earth.

## Challenges

- Keeping a language model honest about numbers. The answer was to make the server, not the model, the judge of every figure.
- Philippine gauge data isn't openly available in real time, so we used modelled GloFAS discharge for the Philippines and real UK gauges to test the forecasting engine against measurements.
- Protecting API credit on a public demo: rate limits, an agent cooldown with a cached briefing, and an output token cap.

## What's next

- Pilot with a barangay or municipal DRRM office and review the SMS text with native speakers of each language.
- Add measured Philippine gauges as they become available.
- Deliver alerts by SMS gateway and Messenger.
- Run the agent on Meta open-weight models for offline use during outages.

## Bonus prizes to enter

- Best Agentic Use-Case
- Best Creative Build (Muse Image)
- Most Viral (post the demo on X and add the link here)
- Community Vote
