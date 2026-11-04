# Submission form answers

For the Cerebral Valley submission form, Meta Global AI Developer Hackathon 2026.
Deadline: Wednesday, November 4, 9:00 PM ET (Thursday, November 5, 10:00 AM Philippine Time).

Every fact below was checked against the live system and the repository on November 4. Fields marked **(yours)** ask for the team's own opinion; the notes give the facts to draw on, not an answer.

## Team Name

HydroSentinel (solo entry: Precious Grace Deborah Manucom, GitHub Debb1ie)

## Track

The agent track, if offered. The flood-watch agent is the most distinctive and most verifiable part of the project.

## Problem statement

Build for Your World

## Most Viral (X post link)

Only if the demo is posted on X.

## Project Description

About 20 typhoons enter the Philippines each year. When a river rises, barangay disaster officers must decide quickly whether families should move, but the data is scattered across hazard feeds and hydrology models in units most people don't read.

HydroSentinel is a flood early-warning dashboard. A Muse Spark agent checks typhoon and flood alerts, a 30-day model outlook for 17 Philippine river basins, and rain forecasts. It writes a plain-language briefing where every claim cites its source, plus SMS alerts in Filipino, Cebuano, Ilocano, Hiligaynon and English. Before anyone sees the briefing, our server checks every number in it against the data it cites. People can ask questions in English, Filipino or Taglish and get an answer back in the same language. SAM 3.1 estimates how much of a field photo is flooded, and Muse Image makes community posters.

Honest limits: real-time Philippine gauge data isn't openly available, so Philippine rivers use model outlooks (GloFAS), and the forecasting engine is tested on 10 live UK gauges. Alerts are never presented as official warnings; they always point to PAGASA and local disaster offices.

Live demo: https://hydrosentinel-plum.vercel.app (no login needed)

## Public GitHub Repository

https://github.com/Debb1ie/Meta-AI

## 3-Minute Demo Video

Add the link after uploading (YouTube, unlisted is fine). Script: [demo-script.md](demo-script.md).

## Describe your use of Meta products

All models are called through the Meta Model API from our server; the key never reaches the browser.

- **Muse Spark (muse-spark-1.3) with tool calling:** the agent chooses from six read-only tools (hazard alerts, all basins, one basin, rain forecast, all gauges, one gauge) for up to 8 steps. Each result becomes numbered evidence.
- **Muse Spark with strict JSON schemas:** the cited briefing, SMS in five languages, and Ask answers with a status, key points and actions, all in plain language.
- **SAM 3.1:** segments floodwater in a photo and returns the flooded share with a mask. Photos are processed in memory and never stored.
- **Muse Image (muse-image-1.0):** preparedness and alert posters matched to the alert level.

## Why are Meta's models important to your solution?

Muse Spark lets one model do the three jobs we need: decide which live data to check (tool calling), return output in a fixed structure our server can verify number by number (strict JSON), and write naturally in four Philippine languages plus English. That combination is what makes the alerts both checkable and readable for families. SAM 3.1 and Muse Image add photo measurement and printable posters through the same API and key, which kept a solo one-week build manageable.

## Partner technologies (Fireworks, Modal, Baseten)

Leave blank: none were used. If the field is required: "We did not use partner platforms. We prepared a Baseten fallback configuration for Muse Spark Open but never switched to it."

## Rating and opinion questions (yours)

Facts from this build to draw on:

- **Meta Model API in practice:** every Muse Spark call observed during final testing succeeded; tool calling worked; strict-schema fields came back as required. One agent run used about 28,000 tokens and took about 77 seconds (5 tool calls).
- **Muse Code:** not used. Coding help came from Claude Code and GitHub Copilot (disclosed in [HACKATHON.md](../HACKATHON.md)).
- **Compared with other models:** Muse Spark was the only model in the app, so there is no same-task comparison unless the team ran one separately.

## Biggest obstacle

Making the AI both honest and readable. Early briefings were accurate but read like system logs ("429 rate-limit errors", "Magnitude 0"). We made the server, not the model, the judge of every number, then rewrote the prompts around a plain-language style guide, and the number check kept passing (7 of 7 on the first run with the new prompts). Other real obstacles: no open real-time Philippine gauge data, and a deploy setup that wasn't auto-deploying the backend, which hid finished features from the live site for a while.

## What matters most when choosing a model, what makes switching hard, what would stop production use (yours)

Points this project supports: reliable structured output, quality in Philippine languages, cost per run, uptime, and an offline or open-weight option for disasters, when connectivity fails first. Hosting issues seen during the build (free tier sleeping and resetting data) were infrastructure, not model, issues.

## Verified facts (November 4)

| Claim | Evidence |
|---|---|
| Server checks every number | 24 of 24 numbers verified on the November 3 run; 7 of 7 on the November 4 run |
| Backend tests | 72 passing |
| Live data | 17 PH basins, 10 UK gauges, GDACS typhoon and flood alerts |
| Forecast skill | Beats the no-change baseline at 1 to 12 hours ahead (12 to 31% on average); not at 24 hours (-3.7%). Shown live on the Analytics tab |
| Meta models live | muse-spark-1.3, sam-3.1, muse-image-1.0 via api.meta.ai |
