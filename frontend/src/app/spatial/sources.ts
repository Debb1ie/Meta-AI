// Browser loaders for the spatial page. Every source is free, keyless and CORS-enabled.
import { type Grid, cellLat, cellLon } from "./analysis";

const TERRARIUM = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const IMAGERY = (z: number, x: number, y: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const LANDCOVER = "https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/exportImage";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];

export const lonToTile = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
export const latToTile = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

async function bitmap(url: string, signal?: AbortSignal): Promise<ImageBitmap> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // No colour management: elevation and class codes are stored in the exact pixel values.
  return createImageBitmap(await res.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Stitch the web-map tiles covering the window at zoom z. */
async function mosaic(url: (z: number, x: number, y: number) => string, g: Grid, z: number, signal?: AbortSignal) {
  const x0 = Math.floor(lonToTile(g.west, z)), x1 = Math.floor(lonToTile(g.east, z));
  const y0 = Math.floor(latToTile(g.north, z)), y1 = Math.floor(latToTile(g.south, z));
  const c = canvas((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const jobs: Promise<void>[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    jobs.push(bitmap(url(z, x, y), signal).then((b) => { ctx.drawImage(b, (x - x0) * 256, (y - y0) * 256); b.close(); }));
  }
  await Promise.all(jobs);
  return { c, ctx, x0, y0, z };
}

/** Elevation in metres on the analysis grid (bilinear from 30 m SRTM-based tiles). Sea is NaN. */
export async function loadElevation(g: Grid, signal?: AbortSignal): Promise<Float32Array> {
  const { c, ctx, x0, y0, z } = await mosaic(TERRARIUM, g, 12, signal);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height;
  const elev = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) elev[k] = px[4 * k] * 256 + px[4 * k + 1] + px[4 * k + 2] / 256 - 32768;
  const out = new Float32Array(g.n * g.n);
  for (let j = 0; j < g.n; j++) {
    const fy = (latToTile(cellLat(g, j), z) - y0) * 256 - 0.5;
    const yA = Math.max(0, Math.min(H - 2, Math.floor(fy))), ty = Math.min(1, Math.max(0, fy - yA));
    for (let i = 0; i < g.n; i++) {
      const fx = (lonToTile(cellLon(g, i), z) - x0) * 256 - 0.5;
      const xA = Math.max(0, Math.min(W - 2, Math.floor(fx))), tx = Math.min(1, Math.max(0, fx - xA));
      const a = elev[yA * W + xA], b = elev[yA * W + xA + 1], cc = elev[(yA + 1) * W + xA], d = elev[(yA + 1) * W + xA + 1];
      const v = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
      out[j * g.n + i] = v < -1 ? NaN : Math.max(v, 0); // below sea level in this data set means open water
    }
  }
  return out;
}

/** Satellite image of the window as a square texture (north up). */
export async function loadImagery(g: Grid, size = 1280, signal?: AbortSignal): Promise<HTMLCanvasElement> {
  const z = 13;
  const { c, x0, y0 } = await mosaic(IMAGERY, g, z, signal);
  const out = canvas(size, size);
  const ctx = out.getContext("2d")!;
  // Rows are placed one band at a time so the Mercator stretch is undone exactly.
  const bands = 64;
  for (let b = 0; b < bands; b++) {
    const latA = g.north - ((g.north - g.south) * b) / bands;
    const latB = g.north - ((g.north - g.south) * (b + 1)) / bands;
    const sx = (lonToTile(g.west, z) - x0) * 256, ex = (lonToTile(g.east, z) - x0) * 256;
    const sy = (latToTile(latA, z) - y0) * 256, ey = (latToTile(latB, z) - y0) * 256;
    ctx.drawImage(c, sx, sy, ex - sx, ey - sy, 0, (size * b) / bands, size, size / bands + 0.5);
  }
  return out;
}

/** Land cover class per cell (Esri / Impact Observatory, Sentinel-2 10 m, latest year). */
export async function loadLandcover(g: Grid, signal?: AbortSignal): Promise<Uint8Array> {
  const q = new URLSearchParams({
    bbox: `${g.west},${g.south},${g.east},${g.north}`, bboxSR: "4326", imageSR: "4326",
    size: `${g.n},${g.n}`, format: "png", interpolation: "RSP_NearestNeighbor",
    renderingRule: JSON.stringify({ rasterFunction: "None" }), f: "image",
  });
  const b = await bitmap(`${LANDCOVER}?${q}`, signal);
  const c = canvas(g.n, g.n);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(b, 0, 0, g.n, g.n);
  b.close();
  const px = ctx.getImageData(0, 0, g.n, g.n).data;
  const out = new Uint8Array(g.n * g.n);
  for (let k = 0; k < out.length; k++) out[k] = px[4 * k];
  return out;
}

export type Line = { lat: number; lon: number }[];

/** Mark every cell a polyline passes through. */
export function rasterise(lines: Line[], g: Grid): Uint8Array {
  const out = new Uint8Array(g.n * g.n);
  const mark = (lat: number, lon: number) => {
    const i = Math.floor((lon - g.west) / g.step), j = Math.floor((g.north - lat) / g.step);
    if (i >= 0 && j >= 0 && i < g.n && j < g.n) out[j * g.n + i] = 1;
  };
  for (const line of lines) {
    for (let s = 1; s < line.length; s++) {
      const a = line[s - 1], b = line[s];
      const steps = Math.max(1, Math.ceil((Math.max(Math.abs(b.lat - a.lat), Math.abs(b.lon - a.lon)) / g.step) * 2.5));
      for (let t = 0; t <= steps; t++) mark(a.lat + ((b.lat - a.lat) * t) / steps, a.lon + ((b.lon - a.lon) * t) / steps);
    }
  }
  return out;
}

export type Osm = { rivers: Uint8Array | null; roads: Uint8Array | null; riverNames: string[]; source: "bundled" | "live" | "none" };

const decodeCells = (s: string, size: number) => {
  const out = new Uint8Array(size);
  let k = 0;
  for (const d of s ? s.split(",") : []) { k += Number(d); if (k < size) out[k] = 1; }
  return out;
};

function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(new DOMException("timed out", "TimeoutError")), ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); c.abort(signal.reason); }, { once: true });
  return c.signal;
}

async function overpass(query: string, signal?: AbortSignal) {
  let lastError: unknown = null;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: query }), signal: withTimeout(20_000, signal) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { elements: { tags?: Record<string, string>; geometry?: Line }[] };
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("OpenStreetMap is unavailable");
}

/** Rivers, canals and main roads from OpenStreetMap: bundled for preset areas, live otherwise. */
export async function loadOsm(g: Grid, presetId: string | null, signal?: AbortSignal): Promise<Osm> {
  const size = g.n * g.n;
  if (presetId) {
    const res = await fetch(`/data/spatial/${presetId}.json`, { signal });
    if (res.ok) {
      const d = (await res.json()) as { n: number; rivers: string; roads: string; river_names: string[] };
      if (d.n === g.n) return { rivers: decodeCells(d.rivers, size), roads: decodeCells(d.roads, size), riverNames: d.river_names, source: "bundled" };
    }
  }
  const box = `${g.south},${g.west},${g.north},${g.east}`;
  const [rv, rd] = await Promise.allSettled([
    overpass(`[out:json][timeout:25];(way["waterway"="river"](${box});way["waterway"="canal"](${box}););out tags geom;`, signal),
    overpass(`[out:json][timeout:25];(${["motorway", "trunk", "primary", "secondary"].map((h) => `way["highway"="${h}"](${box});`).join("")});out skel geom;`, signal),
  ]);
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  const names = new Map<string, number>();
  if (rv.status === "fulfilled") for (const el of rv.value.elements) {
    if (el.tags?.waterway === "river" && el.tags.name && el.geometry) names.set(el.tags.name, (names.get(el.tags.name) ?? 0) + el.geometry.length);
  }
  const lines = (r: typeof rv) => (r.status === "fulfilled" ? r.value.elements.flatMap((e) => (e.geometry ? [e.geometry] : [])) : null);
  const rivers = lines(rv), roads = lines(rd);
  return {
    rivers: rivers ? rasterise(rivers, g) : null,
    roads: roads ? rasterise(roads, g) : null,
    riverNames: [...names.entries()].sort((a, b) => b[1] - a[1]).map(([nm]) => nm),
    source: rivers || roads ? "live" : "none",
  };
}

export type RainForecast = { grid: Float32Array; todayMm: number; weekMm: number; days: { date: string; mm: number }[] };

/** Open-Meteo daily rain on a 5×5 lattice, inverse-distance weighted onto the grid. */
export async function loadRain(g: Grid, signal?: AbortSignal): Promise<RainForecast> {
  const S = 5;
  const pts: [number, number][] = [];
  for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) pts.push([g.north - ((a + 0.5) * (g.north - g.south)) / S, g.west + ((b + 0.5) * (g.east - g.west)) / S]);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${pts.map((p) => p[0].toFixed(3)).join(",")}&longitude=${pts.map((p) => p[1].toFixed(3)).join(",")}&daily=precipitation_sum&forecast_days=7&timezone=Asia%2FManila`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  const body = (await res.json()) as { daily: { time: string[]; precipitation_sum: (number | null)[] } }[];
  const week = body.map((r) => r.daily.precipitation_sum.reduce<number>((s, v) => s + (v ?? 0), 0));
  const days = body[0].daily.time.map((date, d) => ({ date, mm: body.reduce((s, r) => s + (r.daily.precipitation_sum[d] ?? 0), 0) / body.length }));
  const out = new Float32Array(g.n * g.n);
  for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
    const lat = cellLat(g, j), lon = cellLon(g, i);
    let num = 0, den = 0;
    for (let p = 0; p < pts.length; p++) {
      const d2 = (pts[p][0] - lat) ** 2 + (pts[p][1] - lon) ** 2 + 1e-6;
      num += week[p] / d2;
      den += 1 / d2;
    }
    out[j * g.n + i] = num / den;
  }
  return { grid: out, todayMm: days[0]?.mm ?? 0, weekMm: week.reduce((s, v) => s + v, 0) / week.length, days };
}
