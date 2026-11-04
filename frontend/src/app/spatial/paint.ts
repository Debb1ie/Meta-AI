// Turn analysis layers into pixels and legends.
import { FACTOR, type FactorId, LAND_CLASSES, type Result, SUSCEPTIBILITY, classOf } from "./analysis";

export type LayerId = FactorId | "susceptibility" | "scenario";

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SEA = hex("#dce6ea");
const NODATA = hex("#c3c9cc");
const DEPTH = ["#b9e0ff", "#7cc0f5", "#3d8fdb", "#1f62b3", "#0d3b7a"].map(hex); // < 0.5, 0.5–1, 1–2, 2–3, > 3 m
const DEPTH_BREAKS = [0.5, 1, 2, 3];

/** RGBA pixels for one layer. `forMap` leaves sea and missing cells transparent. */
export function paint(res: Result, id: LayerId, level: number, forMap: boolean): ImageData {
  const n = res.grid.n;
  const img = new ImageData(n, n);
  const px = img.data;
  const values = id === "susceptibility" ? res.score : id === "scenario" ? res.layers.hand : res.layers[id];
  const colours = id === "susceptibility" ? SUSCEPTIBILITY.colours.map(hex) : id === "scenario" || id === "landcover" ? [] : FACTOR[id].colours.map(hex);
  const breaks = id === "susceptibility" ? SUSCEPTIBILITY.breaks : id === "scenario" || id === "landcover" ? [] : res.breaks[id];
  const lcWater = res.layers.landcover;
  for (let k = 0; k < n * n; k++) {
    let c: number[] | null = null;
    let a = 255;
    const x = values?.[k] ?? NaN;
    if (!res.valid[k]) { c = SEA; if (forMap) a = 0; }
    else if (id === "scenario") {
      if (Number.isFinite(x) && x < level) c = DEPTH[classOf(level - x, DEPTH_BREAKS)];
      else if (forMap) a = 0;
      else c = [244, 241, 232];
    } else if (id === "susceptibility" && !Number.isFinite(x) && lcWater?.[k] === 1) { c = hex(LAND_CLASSES[1].colour); }
    else if (!Number.isFinite(x)) { c = NODATA; if (forMap) a = 0; }
    else if (id === "landcover") c = hex(LAND_CLASSES[x]?.colour ?? "#c3c9cc");
    else c = colours[classOf(x, breaks)];
    const o = 4 * k;
    if (c) { px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; }
    px[o + 3] = c ? a : 0;
  }
  return img;
}

export function toDataUrl(img: ImageData): string {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d")!.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

const num = (x: number, d: number) => x.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });

export type LegendRow = { colour: string; label: string };

export function legend(res: Result, id: LayerId): LegendRow[] {
  if (id === "susceptibility") return SUSCEPTIBILITY.labels.map((label, c) => ({ colour: SUSCEPTIBILITY.colours[c], label }));
  if (id === "scenario") {
    const labels = ["under 0.5 m deep", "0.5 – 1 m", "1 – 2 m", "2 – 3 m", "over 3 m"];
    return ["#b9e0ff", "#7cc0f5", "#3d8fdb", "#1f62b3", "#0d3b7a"].map((colour, c) => ({ colour, label: labels[c] }));
  }
  if (id === "landcover") {
    const present = new Set<number>();
    const lc = res.layers.landcover;
    if (lc) for (let k = 0; k < lc.length; k += 7) if (Number.isFinite(lc[k])) present.add(lc[k]);
    return Object.entries(LAND_CLASSES).filter(([code]) => present.has(Number(code))).map(([, v]) => ({ colour: v.colour, label: v.name }));
  }
  const f = FACTOR[id];
  const b = res.breaks[id];
  const u = f.unit ? ` ${f.unit}` : "";
  const d = f.digits;
  return f.colours.map((colour, c) => ({
    colour,
    label: c === 0 ? `under ${num(b[0], d)}${u}` : c === 4 ? `${num(b[3], d)}${u} and over` : `${num(b[c - 1], d)} – ${num(b[c], d)}${u}`,
  }));
}

/** A value as people would say it, e.g. "2.4 m" or "Built-up". */
export function describe(res: Result, id: FactorId, k: number): string {
  const x = res.layers[id]?.[k];
  if (x == null || !Number.isFinite(x)) return id === "hand" ? "no river in view" : "—";
  if (id === "landcover") return LAND_CLASSES[x]?.name ?? "—";
  const f = FACTOR[id];
  return `${num(x, f.digits)}${f.unit ? ` ${f.unit}` : ""}`;
}

/** Rating 1–5 this cell got for a factor (5 = most flood-prone). */
export function rating(res: Result, id: FactorId, k: number): number | null {
  const x = res.layers[id]?.[k];
  if (x == null || !Number.isFinite(x)) return null;
  if (id === "landcover") return LAND_CLASSES[x]?.rating ?? null;
  const c = classOf(x, res.breaks[id]);
  return FACTOR[id].prone === "low" ? 5 - c : c + 1;
}
