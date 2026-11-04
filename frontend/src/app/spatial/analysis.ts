// Terrain-based flood screening for one map window. Pure functions: no DOM, no network.
//
// Inputs are rasters on a regular latitude/longitude grid (row 0 is the north edge). The steps
// follow standard GIS practice: fill depressions (priority-flood), D8 flow directions, flow
// accumulation, HAND (height above nearest drainage), TWI, distance transforms and a weighted
// overlay of rated factors, the same structure as AHP flood-susceptibility studies.

export type Grid = {
  n: number; // cells per side
  west: number;
  east: number;
  south: number;
  north: number;
  step: number; // degrees per cell
  dxM: number; // cell width in metres (east-west)
  dyM: number; // cell height in metres (north-south)
  cellKm2: number;
};

export function makeGrid(lat: number, lon: number, half = 0.11, n = 360): Grid {
  const step = (2 * half) / n;
  const dyM = step * 111_320;
  const dxM = dyM * Math.cos((lat * Math.PI) / 180);
  return { n, west: lon - half, east: lon + half, south: lat - half, north: lat + half, step, dxM, dyM, cellKm2: (dxM * dyM) / 1e6 };
}

export const cellLat = (g: Grid, j: number) => g.north - (j + 0.5) * g.step;
export const cellLon = (g: Grid, i: number) => g.west + (i + 0.5) * g.step;
export function cellAt(g: Grid, lat: number, lon: number): number {
  const i = Math.floor((lon - g.west) / g.step);
  const j = Math.floor((g.north - lat) / g.step);
  return i < 0 || j < 0 || i >= g.n || j >= g.n ? -1 : j * g.n + i;
}

// Esri / Impact Observatory Sentinel-2 10 m land cover classes.
export const LAND_CLASSES: Record<number, { name: string; colour: string; rating: number }> = {
  1: { name: "Water", colour: "#3b82c4", rating: 5 },
  2: { name: "Trees", colour: "#2f7a43", rating: 1 },
  4: { name: "Flooded vegetation", colour: "#79c2b5", rating: 5 },
  5: { name: "Crops", colour: "#e3bf55", rating: 4 },
  7: { name: "Built-up", colour: "#d0453a", rating: 5 },
  8: { name: "Bare ground", colour: "#c4ab8f", rating: 3 },
  11: { name: "Grass and shrubs", colour: "#b5d17f", rating: 2 },
  10: { name: "Cloud (no reading)", colour: "#d9dde2", rating: 3 },
};
export const WATER = 1;
export const BUILT = 7;

export type Inputs = {
  grid: Grid;
  dem: Float32Array; // metres; NaN where there is no land (open sea)
  rivers: Uint8Array | null; // 1 on OpenStreetMap rivers and canals
  roads: Uint8Array | null; // 1 on OpenStreetMap main roads
  landcover: Uint8Array | null; // class codes above, 0 = unknown
  rain: Float32Array | null; // forecast rain, next 7 days, mm
};

export type Result = {
  grid: Grid;
  valid: Uint8Array; // 1 = land cell inside the window
  stream: Uint8Array; // every channel (for drainage density)
  river: Uint8Array; // rivers and open water (for HAND, distance and the 3D water)
  layers: Record<FactorId, Float32Array | null>;
  drainZ: Float32Array; // elevation of the drainage each cell flows to (NaN if it leaves the window first)
  score: Float32Array; // weighted susceptibility, 1 (very low) to 5 (very high); NaN on water / no data
  breaks: Record<FactorId, number[]>; // four inner class breaks per numeric factor
  used: FactorId[]; // factors that had data and entered the overlay
};

export type FactorId =
  | "elevation" | "slope" | "distRiver" | "rain" | "drainage" | "landcover"
  | "twi" | "hand" | "flowAcc" | "distRoad" | "curvature";

type Spec = {
  id: FactorId;
  title: string;
  unit: string;
  weight: number;
  // Fixed class breaks (4 inner edges) or "quantile" for breaks drawn from the window itself.
  breaks: number[] | "quantile";
  // "low" means low values are the most flood-prone (rating 5 in the lowest class).
  prone: "low" | "high";
  colours: string[]; // five classes, lowest value first
  digits: number;
  why: string;
  source: string;
};

// Weights sum to 1. Height above the river and distance to it lead, as in most published
// flood-susceptibility weightings; road distance and curvature are minor modifiers.
export const FACTORS: Spec[] = [
  { id: "elevation", title: "Elevation", unit: "m", weight: 0.10, breaks: "quantile", prone: "low", colours: ["#1d6f6a", "#7fb9a6", "#f3e8c4", "#c79a5b", "#7a4b23"], digits: 0, why: "Low ground collects water first.", source: "SRTM via AWS Terrain Tiles" },
  { id: "slope", title: "Slope", unit: "°", weight: 0.12, breaks: [1, 3, 6, 12], prone: "low", colours: ["#f5efd5", "#dcca8e", "#b9a35a", "#8b7a37", "#584b1f"], digits: 1, why: "Flat land drains slowly; steep land sheds water.", source: "Derived from elevation (Horn method)" },
  { id: "distRiver", title: "Distance from river", unit: "m", weight: 0.14, breaks: [100, 300, 600, 1200], prone: "low", colours: ["#e4572e", "#f29e4c", "#f1e2a8", "#7fb7d6", "#2b5fa8"], digits: 0, why: "Rivers overflow onto the land beside them.", source: "OpenStreetMap rivers + drainage traced from elevation" },
  { id: "rain", title: "Rain forecast, 7 days", unit: "mm", weight: 0.08, breaks: [25, 75, 150, 300], prone: "high", colours: ["#e3f0fb", "#a9cfee", "#5fa2dd", "#2c6fbb", "#123f80"], digits: 0, why: "More rain means more runoff to carry.", source: "Open-Meteo forecast, interpolated" },
  { id: "drainage", title: "Drainage density", unit: "km/km²", weight: 0.06, breaks: "quantile", prone: "high", colours: ["#1a9850", "#91cf60", "#fee08b", "#fc8d59", "#d73027"], digits: 2, why: "Many channels nearby mean water gathers quickly.", source: "Channel length within 1 km" },
  { id: "landcover", title: "Land cover", unit: "", weight: 0.08, breaks: [], prone: "high", colours: [], digits: 0, why: "Roofs and roads shed rain; forests soak it up.", source: "Esri / Impact Observatory Sentinel-2 10 m" },
  { id: "twi", title: "Wetness index (TWI)", unit: "", weight: 0.10, breaks: "quantile", prone: "high", colours: ["#eef6fb", "#bcd9ec", "#7fb4d9", "#3d84c0", "#164f94"], digits: 1, why: "Where a big area drains onto flat ground, soil stays wet.", source: "ln(upslope area ÷ tan slope)" },
  { id: "hand", title: "Height above river (HAND)", unit: "m", weight: 0.22, breaks: [1, 3, 6, 12], prone: "low", colours: ["#d7301f", "#fdae61", "#fff3b0", "#74add1", "#2c5fa8"], digits: 1, why: "Land only a metre or two above the river floods first.", source: "Elevation minus the river it drains to" },
  { id: "flowAcc", title: "Upstream area", unit: "km²", weight: 0.04, breaks: [0.05, 0.5, 5, 50], prone: "high", colours: ["#f4f8fc", "#c6dbef", "#6baed6", "#2171b5", "#08306b"], digits: 2, why: "Bigger catchments deliver bigger floods.", source: "D8 flow accumulation" },
  { id: "distRoad", title: "Distance from main road", unit: "m", weight: 0.03, breaks: [100, 300, 600, 1200], prone: "low", colours: ["#5b3a1e", "#9c6b3c", "#d8b36a", "#cfe0a8", "#4f8f6b"], digits: 0, why: "Paved corridors speed runoff and often follow low ground.", source: "OpenStreetMap main roads" },
  { id: "curvature", title: "Curvature", unit: "1/100 m", weight: 0.03, breaks: [-0.5, -0.1, 0.1, 0.5], prone: "low", colours: ["#2c7bb6", "#abd9e9", "#f7f7d0", "#fdae61", "#d7191c"], digits: 2, why: "Hollows (negative) gather water; ridges (positive) shed it.", source: "Laplacian of smoothed elevation" },
];
export const FACTOR = Object.fromEntries(FACTORS.map((f) => [f.id, f])) as Record<FactorId, Spec>;

export const SUSCEPTIBILITY = {
  breaks: [2.0, 2.6, 3.2, 3.8],
  labels: ["Very low", "Low", "Moderate", "High", "Very high"],
  colours: ["#1a9850", "#a6d96a", "#fee08b", "#fc8d59", "#d73027"],
};

export const STREAM_KM2 = 0.5; // a cell is a channel once this much land drains through it
export const MAJOR_KM2 = 10; // ...and counts as a river for HAND and distance once this much does

// ---------------------------------------------------------------- helpers

const NB_DI = [1, 1, 0, -1, -1, -1, 0, 1];
const NB_DJ = [0, 1, 1, 1, 0, -1, -1, -1];

class MinHeap {
  private keys: Float64Array;
  private vals: Int32Array;
  size = 0;
  constructor(cap: number) {
    this.keys = new Float64Array(cap);
    this.vals = new Int32Array(cap);
  }
  push(key: number, val: number) {
    let i = this.size++;
    const k = this.keys, v = this.vals;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): number {
    const k = this.keys, v = this.vals;
    const top = v[0];
    const lastK = k[--this.size];
    const lastV = v[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && k[c + 1] < k[c]) c++;
      if (k[c] >= lastK) break;
      k[i] = k[c];
      v[i] = v[c];
      i = c;
    }
    k[i] = lastK;
    v[i] = lastV;
    return top;
  }
}

/** Exact Euclidean distance (metres) to the nearest marked cell; null when nothing is marked. */
export function distanceTo(mask: Uint8Array, n: number, dxM: number, dyM: number): Float32Array | null {
  let any = false;
  for (let k = 0; k < mask.length; k++) if (mask[k]) { any = true; break; }
  if (!any) return null;
  const BIG = 1e20;
  const f = new Float64Array(n * n);
  for (let k = 0; k < f.length; k++) f[k] = mask[k] ? 0 : BIG;
  const line = new Float64Array(n), out = new Float64Array(n), z = new Float64Array(n + 1);
  const v = new Int32Array(n);
  const pass = (s: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      for (;;) {
        const p = v[k];
        const x = (line[q] + (q * s) ** 2 - (line[p] + (p * s) ** 2)) / (2 * s * (q - p));
        if (x <= z[k]) { k--; continue; }
        k++;
        v[k] = q;
        z[k] = x;
        z[k + 1] = Infinity;
        break;
      }
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q * s) k++;
      out[q] = (q * s - v[k] * s) ** 2 + line[v[k]];
    }
  };
  for (let i = 0; i < n; i++) { // columns: north-south spacing
    for (let j = 0; j < n; j++) line[j] = f[j * n + i];
    pass(dyM);
    for (let j = 0; j < n; j++) f[j * n + i] = out[j];
  }
  const d = new Float32Array(n * n);
  for (let j = 0; j < n; j++) { // rows: east-west spacing
    for (let i = 0; i < n; i++) line[i] = f[j * n + i];
    pass(dxM);
    for (let i = 0; i < n; i++) d[j * n + i] = Math.sqrt(out[i]);
  }
  return d;
}

export function quantileBreaks(values: Float32Array, valid: Uint8Array): number[] {
  const xs: number[] = [];
  const stride = Math.max(1, Math.floor(values.length / 40_000));
  for (let k = 0; k < values.length; k += stride) if (valid[k] && Number.isFinite(values[k])) xs.push(values[k]);
  if (!xs.length) return [0, 0, 0, 0];
  xs.sort((a, b) => a - b);
  const q = (p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
  const raw = [q(0.2), q(0.4), q(0.6), q(0.8)];
  // Round to two significant figures so legends read cleanly, keeping them strictly increasing.
  const nice = raw.map((x) => {
    if (x === 0) return 0;
    const m = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 1);
    return Math.round(x / m) * m;
  });
  for (let k = 1; k < 4; k++) if (nice[k] <= nice[k - 1]) nice[k] = raw[k] > nice[k - 1] ? raw[k] : nice[k - 1] + 1e-6;
  return nice;
}

export const classOf = (x: number, breaks: number[]) => {
  let k = 0;
  while (k < 4 && x >= breaks[k]) k++;
  return k;
};

// ---------------------------------------------------------------- the analysis

export function analyse(input: Inputs): Result {
  const { grid: g, dem, rivers, roads, landcover, rain } = input;
  const n = g.n, N = n * n;
  const valid = new Uint8Array(N);
  // Open sea: no elevation, or open water lying at sea level.
  for (let k = 0; k < N; k++) valid[k] = Number.isFinite(dem[k]) && !(landcover?.[k] === WATER && dem[k] <= 1) ? 1 : 0;

  // 1. Burn mapped rivers 5 m into the surface so flow follows the real channel through flat
  //    floodplains and city blocks, where the elevation model alone wanders.
  const burned = new Float64Array(N);
  for (let k = 0; k < N; k++) burned[k] = valid[k] ? dem[k] - (rivers?.[k] ? 5 : 0) : NaN;

  // 2. Priority-flood with a tiny gradient: every pit is filled so each cell has a way out.
  //    Seeds are the window edge and the coast; seeds are the outlets.
  const filled = new Float64Array(N);
  const closed = new Uint8Array(N);
  const outlet = new Uint8Array(N); // 1 = window edge, 2 = coast (drains to the sea)
  const heap = new MinHeap(N);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!valid[k]) continue;
    let seed = 0;
    if (i === 0 || j === 0 || i === n - 1 || j === n - 1) seed = 1;
    for (let d = 0; d < 8 && seed !== 2; d++) {
      const ii = i + NB_DI[d], jj = j + NB_DJ[d];
      if (ii >= 0 && jj >= 0 && ii < n && jj < n && !valid[jj * n + ii]) seed = 2;
    }
    if (seed) {
      outlet[k] = seed;
      closed[k] = 1;
      filled[k] = burned[k];
      heap.push(burned[k], k);
    }
  }
  const EPS = 1e-4;
  while (heap.size) {
    const c = heap.pop();
    const ci = c % n, cj = (c - ci) / n;
    for (let d = 0; d < 8; d++) {
      const ii = ci + NB_DI[d], jj = cj + NB_DJ[d];
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const k = jj * n + ii;
      if (!valid[k] || closed[k]) continue;
      closed[k] = 1;
      filled[k] = Math.max(burned[k], filled[c] + EPS);
      heap.push(filled[k], k);
    }
  }

  // 3. D8: each cell drains to its steepest downhill neighbour on the filled surface.
  const dir = new Int32Array(N).fill(-1);
  const dDiag = Math.hypot(g.dxM, g.dyM);
  const dist = [g.dxM, dDiag, g.dyM, dDiag, g.dxM, dDiag, g.dyM, dDiag];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!valid[k] || outlet[k]) continue;
    let best = -1, bestDrop = 0;
    for (let d = 0; d < 8; d++) {
      const ii = i + NB_DI[d], jj = j + NB_DJ[d];
      const m = jj * n + ii;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n || !valid[m]) continue;
      const drop = (filled[k] - filled[m]) / dist[d];
      if (drop > bestDrop) { bestDrop = drop; best = m; }
    }
    dir[k] = best;
  }

  // 4. Flow accumulation, processing cells from high to low.
  const order: number[] = [];
  for (let k = 0; k < N; k++) if (valid[k]) order.push(k);
  order.sort((a, b) => filled[b] - filled[a]);
  const acc = new Float64Array(N);
  for (const k of order) acc[k] += 1;
  for (const k of order) if (dir[k] >= 0) acc[dir[k]] += acc[k];

  // 5. Channels: enough upstream area, a mapped river, or open water.
  const stream = new Uint8Array(N);
  const minCells = STREAM_KM2 / g.cellKm2;
  for (let k = 0; k < N; k++) {
    if (!valid[k]) continue;
    if (acc[k] >= minCells || rivers?.[k] || landcover?.[k] === WATER) stream[k] = 1;
  }

  // 6. HAND: follow each cell's flow path to the first river (a mapped river, open water, or a
  //    channel draining at least MAJOR_KM2). Small hillside creeks are passed through, so "the
  //    river rises 2 m" means the river, not every gully. The river's water surface is taken as
  //    the lowest elevation around it, since the elevation model often catches the banks.
  const river = new Uint8Array(N);
  for (let k = 0; k < N; k++) river[k] = valid[k] && (rivers?.[k] || landcover?.[k] === WATER || acc[k] * g.cellKm2 >= MAJOR_KM2) ? 1 : 0;
  const drainZ = new Float32Array(N).fill(NaN);
  for (let o = order.length - 1; o >= 0; o--) {
    const k = order[o];
    if (river[k]) {
      const i = k % n, j = (k - i) / n;
      let z = dem[k];
      for (let d = 0; d < 8; d++) {
        const ii = i + NB_DI[d], jj = j + NB_DJ[d];
        const m = jj * n + ii;
        if (ii >= 0 && jj >= 0 && ii < n && jj < n && valid[m] && dem[m] < z) z = dem[m];
      }
      drainZ[k] = z;
    } else if (dir[k] >= 0) {
      drainZ[k] = drainZ[dir[k]];
    } else if (outlet[k] === 2) {
      drainZ[k] = 0; // coastal outlet: the sea
    } // else: leaves the window before meeting a channel; unknown
  }
  const hand = new Float32Array(N).fill(NaN);
  for (let k = 0; k < N; k++) if (valid[k] && Number.isFinite(drainZ[k])) hand[k] = Math.max(0, dem[k] - drainZ[k]);

  // 7. Slope (Horn) and curvature (Zevenbergen–Thorne on a 3×3 smoothed surface).
  const zAt = (i: number, j: number, src: ArrayLike<number>, fallback: number) => {
    if (i < 0) i = 0; else if (i >= n) i = n - 1;
    if (j < 0) j = 0; else if (j >= n) j = n - 1;
    const v = src[j * n + i];
    return Number.isFinite(v) ? v : fallback;
  };
  const slope = new Float32Array(N).fill(NaN);
  const smooth = new Float32Array(N).fill(NaN);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!valid[k]) continue;
    const e = dem[k];
    const a = zAt(i - 1, j - 1, dem, e), b = zAt(i, j - 1, dem, e), c = zAt(i + 1, j - 1, dem, e);
    const d = zAt(i - 1, j, dem, e), f = zAt(i + 1, j, dem, e);
    const gg = zAt(i - 1, j + 1, dem, e), h = zAt(i, j + 1, dem, e), ii = zAt(i + 1, j + 1, dem, e);
    const dzdx = (c + 2 * f + ii - (a + 2 * d + gg)) / (8 * g.dxM);
    const dzdy = (gg + 2 * h + ii - (a + 2 * b + c)) / (8 * g.dyM);
    slope[k] = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
    smooth[k] = (a + b + c + d + e + f + gg + h + ii) / 9;
  }
  const curvature = new Float32Array(N).fill(NaN);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!valid[k]) continue;
    const e = smooth[k];
    const D = ((zAt(i - 1, j, smooth, e) + zAt(i + 1, j, smooth, e)) / 2 - e) / g.dxM ** 2;
    const E = ((zAt(i, j - 1, smooth, e) + zAt(i, j + 1, smooth, e)) / 2 - e) / g.dyM ** 2;
    curvature[k] = -2 * (D + E) * 100;
  }

  // 8. Wetness index and upstream area.
  const cellW = Math.sqrt(g.dxM * g.dyM);
  const twi = new Float32Array(N).fill(NaN);
  const flowAcc = new Float32Array(N).fill(NaN);
  for (let k = 0; k < N; k++) {
    if (!valid[k]) continue;
    const a = (acc[k] * g.cellKm2 * 1e6) / cellW;
    const tanB = Math.max(Math.tan((slope[k] * Math.PI) / 180), 0.001);
    twi[k] = Math.log(a / tanB);
    flowAcc[k] = acc[k] * g.cellKm2;
  }

  // 9. Distances: to the nearest channel or mapped river, and to the nearest main road.
  const distRiver = distanceTo(river, n, g.dxM, g.dyM);
  const distRoad = roads ? distanceTo(roads, n, g.dxM, g.dyM) : null;
  for (let k = 0; k < N; k++) if (!valid[k]) { if (distRiver) distRiver[k] = NaN; if (distRoad) distRoad[k] = NaN; }

  // 10. Drainage density: channel length per km² inside a 2 km square around each cell.
  const sat = new Float64Array((n + 1) * (n + 1));
  for (let j = 0; j < n; j++) {
    let row = 0;
    for (let i = 0; i < n; i++) {
      row += stream[j * n + i] && landcover?.[j * n + i] !== WATER ? 1 : 0;
      sat[(j + 1) * (n + 1) + i + 1] = sat[j * (n + 1) + i + 1] + row;
    }
  }
  const r = Math.max(1, Math.round(1000 / g.dyM));
  const drainage = new Float32Array(N).fill(NaN);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!valid[k]) continue;
    const i0 = Math.max(0, i - r), i1 = Math.min(n, i + r + 1), j0 = Math.max(0, j - r), j1 = Math.min(n, j + r + 1);
    const count = sat[j1 * (n + 1) + i1] - sat[j0 * (n + 1) + i1] - sat[j1 * (n + 1) + i0] + sat[j0 * (n + 1) + i0];
    const areaKm2 = (i1 - i0) * (j1 - j0) * g.cellKm2;
    drainage[k] = (count * cellW) / 1000 / areaKm2;
  }

  const elevation = new Float32Array(N).fill(NaN);
  for (let k = 0; k < N; k++) if (valid[k]) elevation[k] = dem[k];
  let lc: Float32Array | null = null;
  if (landcover) {
    lc = new Float32Array(N).fill(NaN);
    for (let k = 0; k < N; k++) if (valid[k] && LAND_CLASSES[landcover[k]]) lc[k] = landcover[k];
  }

  const layers: Record<FactorId, Float32Array | null> = {
    elevation, slope, distRiver, rain: rain ?? null, drainage, landcover: lc,
    twi, hand, flowAcc, distRoad, curvature,
  };

  // 11. Rate each factor 1–5 and take the weighted mean of the ratings that exist at each cell.
  const breaks = {} as Record<FactorId, number[]>;
  for (const f of FACTORS) {
    if (f.id === "landcover") { breaks[f.id] = []; continue; }
    const layer = layers[f.id];
    breaks[f.id] = f.breaks === "quantile" ? (layer ? quantileBreaks(layer, valid) : [0, 0, 0, 0]) : f.breaks;
  }
  const used = FACTORS.filter((f) => layers[f.id]).map((f) => f.id);
  const score = new Float32Array(N).fill(NaN);
  for (let k = 0; k < N; k++) {
    if (!valid[k] || landcover?.[k] === WATER) continue;
    let sum = 0, wsum = 0;
    for (const id of used) {
      const f = FACTOR[id];
      const x = layers[id]![k];
      if (!Number.isFinite(x)) continue;
      let rating: number;
      if (id === "landcover") rating = LAND_CLASSES[x]?.rating ?? 3;
      else {
        const c = classOf(x, breaks[id]);
        rating = f.prone === "low" ? 5 - c : c + 1;
      }
      sum += f.weight * rating;
      wsum += f.weight;
    }
    if (wsum > 0.3) score[k] = sum / wsum;
  }

  return { grid: g, valid, stream, river, layers, drainZ, score, breaks, used };
}

// ---------------------------------------------------------------- summaries

export type Scenario = { floodedKm2: number; builtKm2: number; maxDepth: number; landKm2: number };

/** Land under water if rivers rose `level` metres above their normal surface (HAND below level). */
export function scenario(res: Result, landcover: Uint8Array | null, level: number): Scenario {
  const { grid: g, valid } = res;
  const hand = res.layers.hand!;
  let flooded = 0, built = 0, land = 0, maxDepth = 0;
  for (let k = 0; k < valid.length; k++) {
    if (!valid[k] || landcover?.[k] === WATER) continue;
    land++;
    const h = hand[k];
    if (Number.isFinite(h) && h < level) {
      flooded++;
      if (landcover?.[k] === BUILT) built++;
      if (level - h > maxDepth) maxDepth = level - h;
    }
  }
  return { floodedKm2: flooded * g.cellKm2, builtKm2: built * g.cellKm2, maxDepth, landKm2: land * g.cellKm2 };
}

export type ClassShare = { label: string; colour: string; km2: number; share: number; builtKm2: number };

export function susceptibilityShares(res: Result, landcover: Uint8Array | null): ClassShare[] {
  const km2 = [0, 0, 0, 0, 0], built = [0, 0, 0, 0, 0];
  let total = 0;
  for (let k = 0; k < res.score.length; k++) {
    const s = res.score[k];
    if (!Number.isFinite(s)) continue;
    const c = classOf(s, SUSCEPTIBILITY.breaks);
    km2[c] += res.grid.cellKm2;
    total += res.grid.cellKm2;
    if (landcover?.[k] === BUILT) built[c] += res.grid.cellKm2;
  }
  return SUSCEPTIBILITY.labels.map((label, c) => ({ label, colour: SUSCEPTIBILITY.colours[c], km2: km2[c], share: total ? km2[c] / total : 0, builtKm2: built[c] }));
}
