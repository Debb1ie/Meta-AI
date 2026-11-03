---
type: RFC
id: "0003"
title: "3D flood layers in the dashboard"
status: Implemented
version: "1.0.0"
created: "2026-11-03"
updated: "2026-11-03"
author: "Debb1ie"
reviewers: ["Debb1ie"]
approvers: ["Debb1ie"]
target_version: "v1.0.0"
implementation_branch: "main"
github_issue: ""
github_pr: ""
related_prds: ["PRD-0001"]
related_pds: []
related_adrs: ["ADR-0001", "ADR-0007"]
related_tds: ["AD-0001"]
related_tps: ["TP-0001"]
milestone: "Meta Global AI Developer Hackathon 2026 submission"
execution_state: "Completed"
approvals:
  tech_lead: { name: "Debb1ie", date: "2026-11-03", approved: true }
  architect: { name: "Debb1ie", date: "2026-11-03", approved: true }
  product: { name: "Debb1ie", date: "2026-11-03", approved: true }
changelog:
  - version: "1.0.0"
    date: "2026-11-03"
    author: "Debb1ie"
    changes: "Initial version, implemented as the 3D layers tab of the command center"
---

# RFC-0003: 3D flood layers in the dashboard

## Document Information

| Field | Value |
|---|---|
| Status | Implemented |
| Author | Debb1ie |
| Created | 2026-11-03 |
| Location | `frontend/src/app/featured/layers.tsx`, tab `?tab=layers` |
| Supersedes | The basin-column scene of [RFC-0002](RFC-0002-research-3d-forecast-layer.md) as the main 3D view. The Research page keeps the method and live scores. |

## Document Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2026-11-03 | Debb1ie | Initial version |

## Summary

An exploded stack of five map layers over the Philippines, rendered with three.js inside the dashboard: terrain, rainfall
forecast, river flow on a chosen day, the 7-day forecast peak, and a combined flood-watch index. It is the GIS "layer
stack" figure made live and interactive: drag to orbit, change the day, pull the layers apart, hide any layer, and
hover any point to read its value, coordinates and the basin it comes from.

## Background

### Problem Statement

The outlook map shows 17 points. A planner asking "where is the risk building?" has to combine three things in their
head: where the land is high (water runs off fast), where rain is coming, and which rivers are rising. A layer stack is
how hydrologists present exactly that combination, so the dashboard shows it the same way.

### Goals

1. Put terrain, rain and river state on one geographic frame, with a fourth derived layer that combines them.
2. Use only live or reproducible open data, and say on screen how each layer is made.
3. Work on desktop, tablet and phone, with reduced motion respected.

### Non-Goals

- Flood inundation mapping. We have no river network or hydraulic model, so no layer claims to show where water will go.
- Replacing PAGASA or local DRRM warnings.

## Proposal

### Layers (bottom to top)

| Layer | Source | Method | Unit |
|---|---|---|---|
| Terrain | SRTM via the public AWS Terrain Tiles (Terrarium, zoom 7) | Sampled every 0.1° into `public/data/ph-elevation.json` (105 × 170 cells), drawn as a displaced relief surface, height × 0.0065 units per metre, hypsometric tint, lit from the north-west | m |
| Rainfall on the chosen day | Open-Meteo forecast, `daily=precipitation_sum`, 7 days | About 120 land points on a 0.5° grid, fetched by the browser in two requests and cached for one hour; inverse-distance weighting (power 2, points within 150 km) onto a 122 × 203 texture | mm |
| River flow on the chosen day | GloFAS v4 via Open-Meteo, through `/api/outlook` | Flow ÷ the basin's watch level (5-year 95th percentile). Each land pixel takes its nearest basin outlet (nearest-outlet zones); full strength within 60 km, fading to 12% by 180 km | × watch level |
| Forecast peak, next 7 days | Same | Highest forecast flow in the 7 days ÷ watch level, same zones | × watch level |
| Flood-watch index | Derived | max(river ratio × distance fade, 3-day rain ÷ 150 mm) | × watch level |

The 150 mm reference only puts rain on the same scale as river flow. It is our choice, not a PAGASA threshold, and the
page says so.

### Why nearest-outlet zones and not interpolation

River flow is not a continuous field: two neighbouring valleys can carry very different flows. Interpolating between
outlets (as we do for rain) would invent values. Nearest-outlet zones are an honest stand-in for catchment boundaries,
and the fade makes it visible where the nearest outlet is far away. The hover read-out names the outlet and its
distance and flags "lower confidence" beyond 60 km. True catchment polygons (for example HydroBASINS level 6) are the
planned replacement.

### Rendering

- Each data layer is a canvas texture on a plane, transparent outside the Philippine outline (a land mask drawn from the
  Natural Earth outline). Every plate has a faint sheet, a frame and the coastline so empty areas still read as a layer.
- White dots mark the 17 basin outlets on the three river layers.
- HTML labels are pinned to the right edge of each plate by projecting a point on the plate every frame.
- Layer spacing animates towards its target; with reduced motion it jumps.
- On narrow screens the camera backs off in proportion to the aspect ratio, and the labels hide (the legend below names
  every layer).

### Configuration Changes

The Content Security Policy now allows `https://api.open-meteo.com` in `connect-src`, because the browser fetches the
rainfall forecast directly. No key is involved, and no user data is sent.

## Testing Strategy

- Type check and lint on every build.
- Visual checks at 1440, 768 and 390 px with live data: all five layers render, labels track the plates, the day slider
  changes the flow, rain and index layers, and hover read-outs show values and coordinates.
- Failure path: if the outlook or Open-Meteo fails, the remaining layers still render and the panel states the error.

## Security Considerations

- No new server endpoint. The elevation grid is a static file built once from public data.
- The browser sends only coordinates of a fixed grid to Open-Meteo.

## Performance Considerations

- Zone textures: 244 × 406 pixels × 17 outlets, under 50 ms.
- Rain interpolation: about 25,000 pixels × 120 points per day, computed when the day changes.
- Elevation file: 40 KB.

## Abandoned Ideas

### Elevation from the Open-Meteo elevation API

The free tier allows about 600 locations a minute and 5,000 an hour. The 17,850-point grid hit the limit within a
minute, so we switched to the public terrain tiles (35 tile downloads, once).

### Interpolated river surface

Rejected for the reason above: it would show flow where no river carries it.

## Open Questions

1. Replace nearest-outlet zones with HydroBASINS catchments.
2. Add observed rainfall (for example GPM IMERG) alongside the forecast.

## References

- AWS Terrain Tiles: https://registry.opendata.aws/terrain-tiles/
- Open-Meteo forecast API: https://open-meteo.com/en/docs
- GloFAS v4 via the Open-Meteo Flood API: https://open-meteo.com/en/docs/flood-api
- Shepard, D. (1968). A two-dimensional interpolation function for irregularly-spaced data. Proceedings of the 23rd ACM National Conference.
