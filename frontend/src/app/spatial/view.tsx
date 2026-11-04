"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, LEVEL_INFO, type Outlook, type PHRiver } from "../featured/shared";
import { FACTOR, FACTORS, type FactorId, type Grid, type Result, SUSCEPTIBILITY, analyse, cellAt, cellLat, cellLon, classOf, makeGrid, scenario, susceptibilityShares } from "./analysis";
import { AREAS, type Area, GRID_N, WINDOW_HALF_DEG } from "./areas";
import type { Basemap } from "./map2d";
import { type LayerId, describe, legend, paint, rating, toDataUrl } from "./paint";
import { type RainMode } from "./scene3d";
import { type Osm, type RainForecast, loadElevation, loadImagery, loadLandcover, loadOsm, loadRain } from "./sources";

const Scene3D = dynamic(() => import("./scene3d").then((m) => m.Scene3D), { ssr: false, loading: () => <div className="sp-canvas sp-canvas-empty">Loading the 3D view…</div> });
const SpatialMap = dynamic(() => import("./map2d"), { ssr: false, loading: () => <div className="sp-map sp-map-empty" /> });

type Target = { id: string | null; name: string; place: string; lat: number; lon: number; basin: string | null };
type StepKey = "dem" | "osm" | "lc" | "rain" | "img";
type Step = { key: StepKey; label: string; state: "wait" | "ok" | "fail"; note?: string };
type Loaded = { target: Target; grid: Grid; dem: Float32Array; landcover: Uint8Array | null; osm: Osm | null; rain: RainForecast | null; result: Result };

const STEPS: Step[] = [
  { key: "dem", label: "Elevation (SRTM, 30 m)", state: "wait" },
  { key: "osm", label: "Rivers and roads (OpenStreetMap)", state: "wait" },
  { key: "lc", label: "Land cover (Sentinel-2, 10 m)", state: "wait" },
  { key: "rain", label: "Rain forecast (Open-Meteo)", state: "wait" },
  { key: "img", label: "Satellite imagery (Esri)", state: "wait" },
];
const PANELS: LayerId[] = ["elevation", "slope", "distRiver", "rain", "drainage", "landcover", "twi", "hand", "flowAcc", "distRoad", "curvature", "susceptibility"];
const PH = { south: 4.5, north: 21.2, west: 116.8, east: 126.8 };

const fromArea = (a: Area): Target => ({ id: a.id, name: a.name, place: a.place, lat: a.lat, lon: a.lon, basin: a.basin });
const km2 = (x: number) => (x < 10 ? x.toFixed(1) : Math.round(x).toLocaleString("en-US"));
const titleOf = (id: LayerId) => (id === "susceptibility" ? "Flood susceptibility" : id === "scenario" ? "River-rise scenario" : FACTOR[id].title);

function nearestRiver(rivers: PHRiver[], t: Target): PHRiver | null {
  if (t.basin) return rivers.find((r) => r.id === t.basin) ?? null;
  let best: PHRiver | null = null, bestD = 0.8; // within roughly 90 km
  for (const r of rivers) {
    const d = Math.hypot(r.latitude - t.lat, r.longitude - t.lon);
    if (d < bestD) { best = r; bestD = d; }
  }
  return best;
}

export function SpatialView() {
  const [target, setTarget] = useState<Target>(fromArea(AREAS[0]));
  const [steps, setSteps] = useState<Step[]>(STEPS);
  const [data, setData] = useState<Loaded | null>(null);
  const [imagery, setImagery] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [outlook, setOutlook] = useState<Outlook | null>(null);

  const [level, setLevel] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [rainMode, setRainMode] = useState<RainMode>("forecast");
  const [mapLayer, setMapLayer] = useState<LayerId>("susceptibility");
  const [opacity, setOpacity] = useState(0.75);
  const [basemap, setBasemap] = useState<Basemap>("streets");
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  // Read ?area= or ?lat=&lon= once, so a mapped place can be shared as a link.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const a = AREAS.find((x) => x.id === q.get("area"));
    const lat = Number(q.get("lat")), lon = Number(q.get("lon"));
    if (a) setTarget(fromArea(a));
    else if (q.get("lat") && Number.isFinite(lat) && Number.isFinite(lon) && lat > PH.south && lat < PH.north && lon > PH.west && lon < PH.east) {
      setTarget({ id: null, name: "Chosen spot", place: `${lat.toFixed(3)}° N, ${lon.toFixed(3)}° E`, lat, lon, basin: null });
    }
    api<Outlook>("/api/outlook").then(setOutlook).catch(() => {});
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    const { signal } = ctl;
    const g = makeGrid(target.lat, target.lon, WINDOW_HALF_DEG, GRID_N);
    setBusy(true);
    setError(null);
    setSteps(STEPS);
    setImagery(null);
    setPicked(null);
    setHover(null);
    const url = target.id ? `?area=${target.id}` : `?lat=${target.lat.toFixed(4)}&lon=${target.lon.toFixed(4)}`;
    window.history.replaceState(null, "", `${window.location.pathname}${url}`);

    const mark = (key: StepKey, state: Step["state"], note?: string) => {
      if (!signal.aborted) setSteps((s) => s.map((x) => (x.key === key ? { ...x, state, note } : x)));
    };
    function track<T>(key: StepKey, p: Promise<T>, note?: (v: T) => string | undefined): Promise<T | null> {
      return p.then(
        (v) => { mark(key, "ok", note?.(v)); return v; },
        (e: unknown) => { mark(key, "fail", signal.aborted ? undefined : e instanceof Error ? e.message : "unavailable"); return null; },
      );
    }

    (async () => {
      const [dem, landcover, osm, rain] = await Promise.all([
        track("dem", loadElevation(g, signal)),
        track("lc", loadLandcover(g, signal)),
        track("osm", loadOsm(g, target.id, signal), (o) => (o.source === "bundled" ? "saved copy" : o.source === "live" ? (o.roads ? "live" : "live, rivers only") : "busy: rivers traced from elevation")),
        track("rain", loadRain(g, signal), (r) => `${Math.round(r.weekMm)} mm in 7 days`),
      ]);
      if (signal.aborted) return;
      if (!dem) {
        setError("The elevation tiles could not be loaded, so this area cannot be mapped right now. Check the connection and try again.");
        setBusy(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 30)); // let the progress list paint before the heavy step
      if (signal.aborted) return;
      const result = analyse({ grid: g, dem, rivers: osm?.rivers ?? null, roads: osm?.roads ?? null, landcover, rain: rain?.grid ?? null });
      setData({ target, grid: g, dem, landcover, osm, rain, result });
      setBusy(false);
    })();
    track("img", loadImagery(g, 1280, signal)).then((c) => { if (!signal.aborted && c) setImagery(c); });
    return () => ctl.abort();
  }, [target]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setLevel((v) => (v >= 8 ? 0 : Math.round((v + 0.25) * 4) / 4)), 160);
    return () => window.clearInterval(t);
  }, [playing]);

  const res = data?.result ?? null;
  const shares = useMemo(() => (res ? susceptibilityShares(res, data!.landcover) : []), [res, data]);
  const scen = useMemo(() => (res ? scenario(res, data!.landcover, level) : null), [res, data, level]);
  const overlay = useMemo(() => (res ? toDataUrl(paint(res, mapLayer, level, true)) : null), [res, mapLayer, level]);
  const river = outlook ? nearestRiver(outlook.rivers, target) : null;
  const shown = data?.target ?? target;
  const highShare = shares.length ? shares[3].share + shares[4].share : 0;
  const highBuilt = shares.length ? shares[3].builtKm2 + shares[4].builtKm2 : 0;
  const bounds: [[number, number], [number, number]] = data ? [[data.grid.south, data.grid.west], [data.grid.north, data.grid.east]] : [[target.lat - WINDOW_HALF_DEG, target.lon - WINDOW_HALF_DEG], [target.lat + WINDOW_HALF_DEG, target.lon + WINDOW_HALF_DEG]];
  const pickedCell = res && picked ? cellAt(res.grid, picked.lat, picked.lon) : -1;
  const inPH = picked && picked.lat > PH.south && picked.lat < PH.north && picked.lon > PH.west && picked.lon < PH.east;

  const chooseSpot = (lat: number, lon: number) => {
    const near = AREAS.find((a) => Math.hypot(a.lat - lat, a.lon - lon) < 0.03);
    setTarget(near ? fromArea(near) : { id: null, name: "Chosen spot", place: `${lat.toFixed(3)}° N, ${lon.toFixed(3)}° E`, lat, lon, basin: null });
  };

  return (
    <main className="lp rx sp">
      <nav className="rx-top shell">
        <Link href="/" className="rx-brand"><span className="brand-mark">H</span> HydroSentinel</Link>
        <span className="rx-top-links"><Link href="/featured">Dashboard</Link><a href="#view3d">3D view</a><a href="#flood-map">Flood map</a><a href="#factors">Factors</a><a href="#method">Method</a></span>
      </nav>

      <header className="shell rx-head">
        <p className="rx-kicker">Spatial mapping</p>
        <h1>See where floodwater would go, <em>street by street.</em></h1>
        <p className="rx-lede">
          Pick a town. We pull its terrain, rivers, roads, land cover and rain forecast, trace how water drains, and map which ground floods first.
          Everything is computed in your browser from open data in a few seconds.
        </p>
      </header>

      <section className="shell sp-areas" aria-label="Choose an area">
        <div className="sp-chips" role="group" aria-label="Preset areas">
          {AREAS.map((a) => (
            <button key={a.id} type="button" aria-pressed={target.id === a.id} onClick={() => setTarget(fromArea(a))}>
              {a.name}<small>{a.place}</small>
            </button>
          ))}
          {!target.id && <button type="button" aria-pressed>{target.name}<small>{target.place}</small></button>}
        </div>
        <p className="sp-tip">Or click anywhere on the flood map below and choose <b>Map this spot</b>.</p>
      </section>

      <section className="shell sp-status" aria-live="polite">
        <div className="sp-steps">
          {steps.map((s) => (
            <span key={s.key} className={`sp-step is-${s.state}`} title={s.note}>
              <i aria-hidden />{s.label}{s.note && <small>{s.note}</small>}
            </span>
          ))}
        </div>
        {error && <p className="rx-error">{error}</p>}
        {river && (
          <p className="sp-live">
            <b className={`sp-level is-${river.level}`}>{LEVEL_INFO[river.level]?.word ?? river.level}</b>
            Live outlook, {river.name}: {Math.round(river.current_m3s).toLocaleString("en-US")} m³/s today ({Math.round((river.current_m3s / river.thresholds_m3s.advisory) * 100)}% of its watch level), {river.trend}.
            {data?.rain && <> Rain forecast here: {Math.round(data.rain.todayMm)} mm today, {Math.round(data.rain.weekMm)} mm over 7 days.</>}
          </p>
        )}
      </section>

      {res && data && (
        <section className="shell sp-summary" aria-label="Summary">
          <div>
            <b>{Math.round(highShare * 100)}%</b>
            <span>of land in this {Math.round((data.grid.n * data.grid.dxM) / 1000)} km window is <em>high</em> or <em>very high</em> susceptibility</span>
          </div>
          <div>
            <b>{km2(highBuilt)} km²</b>
            <span>of built-up land (homes, roads, buildings) sits in those zones</span>
          </div>
          <div>
            <b>{scen ? km2(scen.floodedKm2) : "—"} km²</b>
            <span>would be under water if the rivers rose {level} m, {scen ? km2(scen.builtKm2) : "—"} km² of it built-up</span>
          </div>
        </section>
      )}

      <section className="shell rx-stage" id="view3d" aria-label="3D terrain and floodwater">
        <div className="sp-stage-head">
          <h2>{shown.name} in 3D</h2>
          <p>Satellite image over the terrain. Raise the rivers to see which land goes under first; rain falls at today&apos;s forecast rate.</p>
        </div>
        <div className="rx-viz sp-viz">
          {res && data ? (
            <Scene3D
              result={res}
              dem={data.dem}
              imagery={imagery}
              level={level}
              rainMode={rainMode}
              rainTodayMm={data.rain?.todayMm ?? 0}
              pin={{ title: shown.name, detail: scen ? `Rivers +${level} m · ${km2(scen.floodedKm2)} km² under water` : "" }}
            />
          ) : (
            <div className="sp-canvas sp-canvas-empty">{error ?? `Mapping ${target.name}…`}</div>
          )}
          {busy && res && <div className="sp-busy">Mapping {target.name}…</div>}
        </div>
        <div className="rx-controls sp-controls">
          <button type="button" onClick={() => setPlaying((v) => !v)} aria-pressed={playing}>{playing ? "Pause" : "Play rise"}</button>
          <label className="sp-slider">
            <span>Rivers rise <b>{String(level)} m</b></span>
            <input type="range" min={0} max={8} step={0.25} value={level} onChange={(e) => { setPlaying(false); setLevel(Number(e.target.value)); }} aria-label="River rise in metres" />
          </label>
          <div className="sp-seg" role="group" aria-label="Rain">
            {(["forecast", "heavy", "off"] as RainMode[]).map((m) => (
              <button key={m} type="button" aria-pressed={rainMode === m} onClick={() => setRainMode(m)}>{m === "forecast" ? `Rain: forecast${data?.rain ? ` (${Math.round(data.rain.todayMm)} mm today)` : ""}` : m === "heavy" ? "Typhoon rain" : "No rain"}</button>
            ))}
          </div>
        </div>
        <p className="sp-note">Drag to orbit, scroll or pinch to zoom. The rise is a what-if, not a forecast: water spreads to all land less than that height above the river it drains to.</p>
      </section>

      <section className="shell rx-section" id="flood-map" aria-labelledby="map-title">
        <h2 id="map-title">Flood map</h2>
        <p>Choose a layer and click any point to read every factor there. Click a yellow dot to jump to another town.</p>
        <div className="sp-map-wrap">
          <div className="sp-map-side">
            <label className="sp-field">
              <span>Layer</span>
              <select value={mapLayer} onChange={(e) => setMapLayer(e.target.value as LayerId)}>
                <option value="susceptibility">Flood susceptibility</option>
                <option value="scenario">River-rise scenario ({level} m)</option>
                {FACTORS.map((f) => <option key={f.id} value={f.id} disabled={!res?.layers[f.id]}>{f.title}</option>)}
              </select>
            </label>
            <label className="sp-field">
              <span>Opacity <b>{Math.round(opacity * 100)}</b></span>
              <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
            </label>
            <div className="sp-seg" role="group" aria-label="Base map">
              <button type="button" aria-pressed={basemap === "streets"} onClick={() => setBasemap("streets")}>Streets</button>
              <button type="button" aria-pressed={basemap === "satellite"} onClick={() => setBasemap("satellite")}>Satellite</button>
            </div>
            {res && <Legend rows={legend(res, mapLayer)} title={titleOf(mapLayer)} />}
            {picked && (
              <div className="sp-picked">
                <small>{picked.lat.toFixed(4)}° N, {picked.lon.toFixed(4)}° E</small>
                {inPH ? <button type="button" onClick={() => chooseSpot(picked.lat, picked.lon)}>Map this spot</button> : <small>Outside the Philippines</small>}
              </div>
            )}
          </div>
          <SpatialMap bounds={bounds} overlay={overlay} opacity={opacity} basemap={basemap} picked={picked} areas={AREAS} activeId={target.id} onPick={(lat, lon) => { setPicked({ lat, lon }); setHover(null); }} onArea={(id) => setTarget(fromArea(AREAS.find((a) => a.id === id)!))} />
        </div>
        {res && pickedCell >= 0 && <Readout res={res} k={pickedCell} level={level} />}
      </section>

      <section className="shell rx-section" id="factors" aria-labelledby="factors-title">
        <h2 id="factors-title">Flood susceptibility factors</h2>
        <p>
          Eleven factors, each a map of the same {data ? Math.round((data.grid.n * data.grid.dxM) / 1000) : 24} km window. Each is rated 1 to 5 for how flood-prone it makes the ground,
          and the weighted ratings give the final map (l). Hover any map to read all factors at that spot.
        </p>
        {res ? (
          <div className="sp-grid">
            {PANELS.map((id, i) => (
              <Panel key={id} res={res} id={id} letter={String.fromCharCode(97 + i)} hover={hover} onHover={setHover} />
            ))}
          </div>
        ) : (
          <div className="sp-grid">{PANELS.map((id) => <div key={id} className="sp-panel sp-skeleton" />)}</div>
        )}
        {res && hover != null && <Readout res={res} k={hover} level={level} />}
        {res && (
          <div className="sp-shares" aria-label="Share of land in each class">
            {shares.map((s) => (
              <div key={s.label} style={{ flexGrow: Math.max(0.001, s.share) }} title={`${s.label}: ${km2(s.km2)} km², ${km2(s.builtKm2)} km² built-up`}>
                <i style={{ background: s.colour }} />
                <span>{s.label}</span>
                <b>{Math.round(s.share * 100)}%</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <article className="shell rx-paper" id="method">
        <h2>How the map is made</h2>
        <ol>
          <li><b>Terrain.</b> Elevation from SRTM (about 30 m) is resampled to a {GRID_N} × {GRID_N} grid of about 68 m cells covering roughly 24 × 24 km.</li>
          <li><b>Drainage.</b> Mapped OpenStreetMap rivers are burned 5 m into the surface, pits are filled (priority-flood), and every cell drains to its steepest neighbour (D8). Counting the cells upstream gives each cell&apos;s catchment.</li>
          <li><b>Height above river (HAND).</b> Each cell follows its flow path to the first river: a mapped river, open water, or a channel draining {">"} 10 km². Its height above that river&apos;s surface is the HAND value. The 3D water and the river-rise scenario flood every cell whose HAND is below the chosen rise.</li>
          <li><b>Factors.</b> Slope, curvature, wetness index, drainage density and distances to rivers and roads are computed from the same grid. Land cover comes from Sentinel-2 at 10 m, rain from the 7-day Open-Meteo forecast.</li>
          <li><b>Overlay.</b> Each factor is split into five classes and rated 1 (least flood-prone) to 5 (most). The weighted mean of the ratings is the susceptibility score, then grouped as {SUSCEPTIBILITY.labels.join(", ").toLowerCase()} at {SUSCEPTIBILITY.breaks.join(", ")}.</li>
        </ol>
        <div className="rx-table-wrap">
          <table className="rx-table">
            <thead><tr><th>Factor</th><th>Weight</th><th>Most flood-prone when</th><th>Why it matters</th><th>Source</th></tr></thead>
            <tbody>
              {FACTORS.map((f) => (
                <tr key={f.id}>
                  <td>{f.title}{res && !res.layers[f.id] && <small> (unavailable here, weight shared out)</small>}</td>
                  <td>{Math.round(f.weight * 100)}%</td>
                  <td>{f.id === "landcover" ? "built-up, flooded vegetation or crops" : f.prone === "low" ? "low" : "high"}{f.breaks === "quantile" ? <small> (classes from this window)</small> : null}</td>
                  <td>{f.why}</td>
                  <td><small>{f.source}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 id="limits">Limitations</h2>
        <ul>
          <li>This is a terrain-based screening map, not an official hazard map. For official flood hazard maps see <a href="https://noah.up.edu.ph" target="_blank" rel="noreferrer">Project NOAH</a> and the <a href="https://hazardhunter.georisk.gov.ph" target="_blank" rel="noreferrer">GeoRisk HazardHunterPH</a> portal.</li>
          <li>SRTM elevation dates from 2000 and measures rooftops and tree tops in places, so city blocks and dense forest read a few metres too high. Embankments and drainage pipes are not represented.</li>
          <li>The river-rise scenario raises every river by the same height. Real floods depend on how much water arrives, how long it lasts, and levees; the live river outlook above shows flow, which cannot be converted to a height without a local rating curve.</li>
          <li>Rivers that enter the window from outside carry more water than the upstream area counted here. Cells whose flow leaves the window before reaching a river show &quot;no river in view&quot; for HAND.</li>
          <li>Weights follow the usual ordering in published flood-susceptibility studies (HAND and distance to river first). They are expert judgement, not fitted to past floods.</li>
          <li>Soil type and vegetation index (NDVI) are not included: no keyless open source returns them at this scale. Land cover stands in for vegetation.</li>
        </ul>
        <h2>Data sources</h2>
        <ul className="rx-refs">
          <li>Elevation: SRTM and other open DEMs via <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">AWS Terrain Tiles</a> (Mapzen).</li>
          <li>Land cover: <a href="https://livingatlas.arcgis.com/landcover/" target="_blank" rel="noreferrer">Esri | Impact Observatory Sentinel-2 10 m Land Use/Land Cover</a>, CC BY 4.0.</li>
          <li>Rivers and roads: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, ODbL. Preset areas use a saved copy; other spots are fetched live from the Overpass API.</li>
          <li>Rain: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> forecast, CC BY 4.0. River outlook: GloFAS v4 via Open-Meteo.</li>
          <li>Satellite imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics).</li>
        </ul>
      </article>
    </main>
  );
}

function Legend({ rows, title }: { rows: { colour: string; label: string }[]; title: string }) {
  return (
    <div className="sp-legend">
      <b>{title}</b>
      {rows.map((r) => (
        <span key={r.label}><i style={{ background: r.colour }} />{r.label}</span>
      ))}
    </div>
  );
}

function Panel({ res, id, letter, hover, onHover }: { res: Result; id: LayerId; letter: string; hover: number | null; onHover: (k: number | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const n = res.grid.n;
  const missing = id !== "susceptibility" && id !== "scenario" && !res.layers[id];
  useEffect(() => {
    if (missing || !ref.current) return;
    ref.current.getContext("2d")!.putImageData(paint(res, id, 0, false), 0, 0);
  }, [res, id, missing]);
  const cellFrom = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * n), j = Math.floor(((e.clientY - r.top) / r.height) * n);
    return i >= 0 && j >= 0 && i < n && j < n ? j * n + i : null;
  };
  const scaleKm = 5;
  const widthKm = (n * res.grid.dxM) / 1000;
  const f = id !== "susceptibility" && id !== "scenario" ? FACTOR[id] : null;
  return (
    <figure className={`sp-panel ${id === "susceptibility" ? "is-result" : ""}`}>
      <figcaption><b>({letter})</b> {titleOf(id)}{f && <small>weight {Math.round(f.weight * 100)}%</small>}</figcaption>
      {missing ? (
        <div className="sp-missing">Not available for this area right now. Its weight is shared among the other factors.</div>
      ) : (
        <div className="sp-plot" onPointerMove={(e) => onHover(cellFrom(e))} onPointerDown={(e) => onHover(cellFrom(e))} onPointerLeave={(e) => e.pointerType === "mouse" && onHover(null)}>
          <canvas ref={ref} width={n} height={n} aria-label={`${titleOf(id)} map`} />
          <span className="sp-north" aria-hidden>N<i /></span>
          <span className="sp-scale" aria-hidden style={{ width: `${(scaleKm / widthKm) * 100}%` }}>{scaleKm} km</span>
          {hover != null && <span className="sp-dot" style={{ left: `${(((hover % n) + 0.5) / n) * 100}%`, top: `${((Math.floor(hover / n) + 0.5) / n) * 100}%` }} />}
        </div>
      )}
      {!missing && <Legend rows={legend(res, id)} title={f?.unit && id !== "landcover" ? f.unit : id === "susceptibility" ? "Class" : ""} />}
    </figure>
  );
}

function Readout({ res, k, level }: { res: Result; k: number; level: number }) {
  const g = res.grid, n = g.n;
  const i = k % n, j = Math.floor(k / n);
  const s = res.score[k];
  const cls = Number.isFinite(s) ? classOf(s, SUSCEPTIBILITY.breaks) : -1;
  const h = res.layers.hand?.[k] ?? NaN;
  const lc = res.layers.landcover?.[k];
  return (
    <div className="sp-readout" aria-live="polite">
      <div className="sp-readout-head">
        <small>{cellLat(g, j).toFixed(4)}° N, {cellLon(g, i).toFixed(4)}° E</small>
        {!res.valid[k] ? <b>Open sea</b> : cls >= 0 ? <b><i style={{ background: SUSCEPTIBILITY.colours[cls] }} />{SUSCEPTIBILITY.labels[cls]} susceptibility <span>score {s.toFixed(2)} of 5</span></b> : <b>{lc === 1 ? "River, lake or sea" : "No score here"}</b>}
        {res.valid[k] && Number.isFinite(h) && <small>{h < level ? `Under about ${(level - h).toFixed(1)} m of water if the rivers rose ${level} m` : `Stays dry until the river rises about ${h.toFixed(1)} m`}</small>}
      </div>
      {res.valid[k] && (
        <dl>
          {FACTORS.map((f) => {
            const r = rating(res, f.id as FactorId, k);
            return (
              <div key={f.id}>
                <dt>{f.title}</dt>
                <dd>{describe(res, f.id as FactorId, k)}{r != null && <span className={`sp-rate r${r}`} title={`Rating ${r} of 5`}>{r}</span>}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

