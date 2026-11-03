"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PH_PATH, PH_VIEWBOX, projectPH } from "../ph-outline";
import { Icon, type Outlook, type PHRiver } from "./shared";

// ---------------------------------------------------------------- geometry of the map frame
// ph-outline uses a plain equirectangular frame: x = (lon - 116.6) * 0.9763 * 30, y = (21.3 - lat) * 30.
const [, , W, H] = PH_VIEWBOX.split(" ").map(Number);
const lonOf = (x: number) => x / (0.9763 * 30) + 116.6;
const latOf = (y: number) => 21.3 - y / 30;
const KM_PER_DEG = 111.32;

const TEX_SCALE = 0.8; // texture pixels per map unit for the flow layers
const RAIN_SCALE = 0.4; // rainfall is a smooth field, so half the resolution is enough
const RAIN_REF_MM = 150; // 3-day total used only to scale rain into the index, not an official threshold
const NEAR_KM = 60; // basin value is shown at full strength within this distance of the outlet
const FADE_KM = 180; // and fades out completely by this distance
const RAIN_RADIUS_KM = 150;
const RAIN_STEP = 5; // every 5th elevation cell: a 0.5° grid, about 120 land points
const RAIN_CACHE_KEY = "hs-layers-rain";
const RAIN_CACHE_MS = 60 * 60 * 1000;
const ELEV_EXAGGERATION = 0.0065; // scene units per metre (Mt Apo, 2,954 m, rises about 19 units)
const DAYS = 7;

type Elevation = { source: string; lon0: number; lat1: number; step: number; nx: number; ny: number; elevation_m: number[] };
type Rain = { points: [number, number][]; daily: number[][]; dates: string[] };
type LayerId = "index" | "peak" | "flow" | "rain" | "terrain";

// Top of the stack first, as the legend reads.
const LAYERS: { id: LayerId; title: string; unit: string; source: string; method: string }[] = [
  { id: "index", title: "Flood-watch index", unit: "× watch level", source: "Derived from the layers below", method: "The larger of river flow ÷ watch level and 3-day rain ÷ 150 mm" },
  { id: "peak", title: "Forecast peak, next 7 days", unit: "× watch level", source: "GloFAS v4 via Open-Meteo", method: "Highest forecast flow in 7 days ÷ the basin's 95th-percentile flow" },
  { id: "flow", title: "River flow on the chosen day", unit: "× watch level", source: "GloFAS v4 via Open-Meteo", method: "Flow ÷ watch level, shown around each basin outlet (nearest-outlet zones)" },
  { id: "rain", title: "Rainfall on the chosen day", unit: "mm", source: "Open-Meteo forecast", method: "Daily totals on a 0.5° land grid, inverse-distance weighted" },
  { id: "terrain", title: "Terrain", unit: "m", source: "SRTM via AWS Terrain Tiles", method: "Elevation sampled every 0.1°, height exaggerated" },
];

// ---------------------------------------------------------------- colour ramps
type Stop = [number, string];
const RATIO_STOPS: Stop[] = [[0, "#1f7a4c"], [0.5, "#8dbf5a"], [0.85, "#e0b12a"], [1, "#e5862c"], [1.4, "#c8321f"]];
const RAIN_STOPS: Stop[] = [[0, "#cfe8f3"], [5, "#8cc8e8"], [20, "#3c8fd0"], [50, "#3b4fb8"], [100, "#7a2fa8"], [200, "#c2187a"]];
const TERRAIN_STOPS: Stop[] = [[0, "#3f7f4f"], [150, "#6f9b55"], [500, "#b7b36a"], [1000, "#b98a55"], [1800, "#8c6a4f"], [2600, "#ece6dc"]];

function ramp(stops: Stop[]) {
  const cols = stops.map(([v, c]) => [v, new THREE.Color(c)] as const);
  return (v: number) => {
    if (v <= cols[0][0]) return cols[0][1].clone();
    for (let i = 1; i < cols.length; i++) {
      if (v <= cols[i][0]) return cols[i - 1][1].clone().lerp(cols[i][1], (v - cols[i - 1][0]) / (cols[i][0] - cols[i - 1][0]));
    }
    return cols[cols.length - 1][1].clone();
  };
}
const ratioColour = ramp(RATIO_STOPS);
const rainColour = ramp(RAIN_STOPS);
const terrainColour = ramp(TERRAIN_STOPS);
const gradient = (stops: Stop[]) => `linear-gradient(90deg, ${stops.map(([, c], i) => `${c} ${(i / (stops.length - 1)) * 100}%`).join(", ")})`;

// ---------------------------------------------------------------- data

async function loadRain(elev: Elevation): Promise<Rain> {
  try {
    const cached = JSON.parse(sessionStorage.getItem(RAIN_CACHE_KEY) ?? "null") as { at: number; rain: Rain } | null;
    if (cached && Date.now() - cached.at < RAIN_CACHE_MS) return cached.rain;
  } catch {
    // storage unavailable: fetch fresh
  }
  // Land points on a 0.5° grid, taken from the elevation grid so no sea points are requested.
  const points: [number, number][] = [];
  for (let j = 0; j < elev.ny; j += RAIN_STEP) {
    for (let i = 0; i < elev.nx; i += RAIN_STEP) {
      if (elev.elevation_m[j * elev.nx + i] > 0) points.push([+(elev.lon0 + i * elev.step).toFixed(2), +(elev.lat1 - j * elev.step).toFixed(2)]);
    }
  }
  const daily: number[][] = [];
  let dates: string[] = [];
  for (let k = 0; k < points.length; k += 100) {
    const chunk = points.slice(k, k + 100);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${chunk.map((p) => p[1]).join(",")}&longitude=${chunk.map((p) => p[0]).join(",")}&daily=precipitation_sum&forecast_days=${DAYS}&timezone=Asia%2FManila`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo rainfall: HTTP ${res.status}`);
    const body = await res.json();
    const list = Array.isArray(body) ? body : [body];
    for (const loc of list) {
      dates = loc.daily.time;
      daily.push((loc.daily.precipitation_sum as (number | null)[]).map((v) => v ?? 0));
    }
  }
  const rain = { points, daily, dates };
  try {
    sessionStorage.setItem(RAIN_CACHE_KEY, JSON.stringify({ at: Date.now(), rain }));
  } catch {
    // storage full or blocked: the view still works
  }
  return rain;
}

function landMask(scale: number): Uint8ClampedArray {
  const w = Math.round(W * scale);
  const h = Math.round(H * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fill(new Path2D(PH_PATH));
  const img = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < out.length; i++) out[i] = img[i * 4 + 3];
  return out;
}

const kmBetween = (lon1: number, lat1: number, lon2: number, lat2: number) => {
  const dx = (lon2 - lon1) * KM_PER_DEG * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  const dy = (lat2 - lat1) * KM_PER_DEG;
  return Math.hypot(dx, dy);
};

// A rendered layer: its texture plus the value behind every pixel, for the hover read-out.
type Grid = { w: number; h: number; values: Float32Array; nearest?: Int16Array; distKm?: Float32Array };

function paint(grid: Grid, mask: Uint8ClampedArray, colour: (v: number) => THREE.Color, alphaOf: (i: number) => number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = grid.w;
  c.height = grid.h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(grid.w, grid.h);
  for (let i = 0; i < grid.values.length; i++) {
    const v = grid.values[i];
    if (!mask[i] || !Number.isFinite(v)) continue;
    const col = colour(v);
    img.data[i * 4] = col.r * 255;
    img.data[i * 4 + 1] = col.g * 255;
    img.data[i * 4 + 2] = col.b * 255;
    img.data[i * 4 + 3] = Math.round((mask[i] / 255) * alphaOf(i) * 255);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Nearest-outlet zones: every land pixel takes the value of its closest basin outlet.
function zones(rivers: PHRiver[], mask: Uint8ClampedArray, valueOf: (r: PHRiver) => number): Grid {
  const w = Math.round(W * TEX_SCALE);
  const h = Math.round(H * TEX_SCALE);
  const values = new Float32Array(w * h).fill(NaN);
  const nearest = new Int16Array(w * h).fill(-1);
  const distKm = new Float32Array(w * h).fill(NaN);
  const vals = rivers.map(valueOf);
  for (let py = 0; py < h; py++) {
    const lat = latOf((py + 0.5) / TEX_SCALE);
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      if (!mask[i]) continue;
      const lon = lonOf((px + 0.5) / TEX_SCALE);
      let best = -1;
      let bestD = Infinity;
      rivers.forEach((r, k) => {
        const d = kmBetween(lon, lat, r.longitude, r.latitude);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      });
      values[i] = vals[best];
      nearest[i] = best;
      distKm[i] = bestD;
    }
  }
  return { w, h, values, nearest, distKm };
}

const fade = (d: number) => Math.max(0.12, Math.min(1, 1 - (d - NEAR_KM) / (FADE_KM - NEAR_KM)));

function rainGrid(rain: Rain, mask: Uint8ClampedArray, sumOf: (row: number[]) => number): Grid {
  const w = Math.round(W * RAIN_SCALE);
  const h = Math.round(H * RAIN_SCALE);
  const values = new Float32Array(w * h).fill(NaN);
  const sums = rain.daily.map(sumOf);
  for (let py = 0; py < h; py++) {
    const lat = latOf((py + 0.5) / RAIN_SCALE);
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      if (!mask[i]) continue;
      const lon = lonOf((px + 0.5) / RAIN_SCALE);
      let num = 0;
      let den = 0;
      for (let k = 0; k < rain.points.length; k++) {
        const d = kmBetween(lon, lat, rain.points[k][0], rain.points[k][1]);
        if (d > RAIN_RADIUS_KM) continue;
        const wgt = 1 / Math.max(d, 5) ** 2;
        num += wgt * sums[k];
        den += wgt;
      }
      if (den > 0) values[i] = num / den;
    }
  }
  return { w, h, values };
}

// Sample a grid at map coordinates (handles the two texture resolutions).
const sample = (g: Grid, x: number, y: number) => {
  const s = g.w / W;
  const px = Math.min(g.w - 1, Math.max(0, Math.floor(x * s)));
  const py = Math.min(g.h - 1, Math.max(0, Math.floor(y * s)));
  return py * g.w + px;
};

// ---------------------------------------------------------------- component

type Readout = { layer: LayerId; lon: number; lat: number; text: string; sub?: string } | null;

export function LayersView({ outlook, error }: { outlook: Outlook | null; error: string | null }) {
  const mount = useRef<HTMLDivElement>(null);
  const [elev, setElev] = useState<Elevation | null>(null);
  const [rain, setRain] = useState<Rain | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [day, setDay] = useState(0);
  const [spread, setSpread] = useState(1);
  const [visible, setVisible] = useState<Record<LayerId, boolean>>({ index: true, peak: true, flow: true, rain: true, terrain: true });
  const [focus, setFocus] = useState<LayerId | null>(null);
  const [readout, setReadout] = useState<Readout>(null);
  const scene = useRef<{
    plates: Record<LayerId, THREE.Object3D>;
    meshes: Partial<Record<LayerId, THREE.Mesh>>;
    gapTarget: number;
    setTexture: (id: LayerId, tex: THREE.Texture) => void;
    setFocus: (id: LayerId | null) => void;
    setBasins: (rivers: PHRiver[]) => void;
  } | null>(null);
  const grids = useRef<Partial<Record<LayerId, Grid>>>({});
  const describeRef = useRef<(id: LayerId, x: number, y: number) => Readout>(() => null);
  const labelRefs = useRef<Partial<Record<LayerId, HTMLSpanElement | null>>>({});

  useEffect(() => {
    let alive = true;
    fetch("/data/ph-elevation.json")
      .then((r) => r.json())
      .then((e: Elevation) => {
        if (!alive) return;
        setElev(e);
        return loadRain(e).then((r) => alive && setRain(r));
      })
      .catch((e) => alive && setProblem(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const rivers = useMemo(() => outlook?.rivers ?? [], [outlook]);
  const today = rivers[0]?.current_date ?? null;
  const dates = useMemo(() => {
    if (!today) return [] as string[];
    const t = new Date(`${today}T00:00:00Z`);
    return Array.from({ length: DAYS }, (_, k) => new Date(t.getTime() + k * 86400000).toISOString().slice(0, 10));
  }, [today]);
  const masks = useMemo(() => (typeof document === "undefined" ? null : { flow: landMask(TEX_SCALE), rain: landMask(RAIN_SCALE) }), []);

  // ---- build the scene once the terrain is available
  useEffect(() => {
    const el = mount.current;
    if (!el || !elev) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sc = new THREE.Scene();
    sc.fog = new THREE.Fog(0x0b1a1d, 1300, 2600);
    const camera = new THREE.PerspectiveCamera(34, el.clientWidth / el.clientHeight, 1, 4000);
    // Narrow screens see less width, so the camera backs off until the whole stack fits.
    const home = new THREE.Vector3(-520, 560, 820);
    const fit = () => camera.position.copy(home).multiplyScalar(Math.min(2, Math.max(1, 0.95 / camera.aspect)));
    fit();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 120, 30);
    controls.enableDamping = !reduce;
    controls.minDistance = 300;
    controls.maxDistance = 1800;
    controls.maxPolarAngle = Math.PI / 2.05;

    sc.add(new THREE.HemisphereLight(0xffffff, 0x1b3337, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-300, 400, -200); // from the north-west, the cartographic convention for hillshade
    sc.add(sun);

    // Outline and frame shared by every plate.
    const outline = PH_PATH.split("Z")
      .filter((d) => d.trim())
      .map((d) => d.replace("M", "").split("L").map((p) => p.split(",").map(Number)));
    const frameGeom = new THREE.EdgesGeometry(new THREE.PlaneGeometry(W + 24, H + 24));
    const outlineGeom = outline.map((ring) => new THREE.BufferGeometry().setFromPoints(ring.map(([x, y]) => new THREE.Vector3(x - W / 2, -(y - H / 2), 0.4))));

    const plates = {} as Record<LayerId, THREE.Object3D>;
    const meshes: Partial<Record<LayerId, THREE.Mesh>> = {};
    const makePlate = (id: LayerId, body: THREE.Mesh) => {
      const g = new THREE.Group();
      g.rotation.x = -Math.PI / 2;
      g.add(body);
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W + 24, H + 24), new THREE.MeshBasicMaterial({ color: 0x9fd4c8, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }));
      sheet.position.z = -0.6;
      g.add(sheet);
      g.add(new THREE.LineSegments(frameGeom, new THREE.LineBasicMaterial({ color: 0x9fd4c8, transparent: true, opacity: 0.45 })));
      if (id !== "terrain") outlineGeom.forEach((og) => g.add(new THREE.Line(og, new THREE.LineBasicMaterial({ color: 0xd8f0ea, transparent: true, opacity: 0.35 }))));
      sc.add(g);
      plates[id] = g;
      meshes[id] = body;
    };

    // Terrain: a real relief surface from the elevation grid.
    const tg = new THREE.PlaneGeometry(W, H, elev.nx - 1, elev.ny - 1);
    const pos = tg.attributes.position as THREE.BufferAttribute;
    const colours = new Float32Array(pos.count * 3);
    const sea = new THREE.Color("#123c4a");
    for (let i = 0; i < pos.count; i++) {
      const e = elev.elevation_m[i] ?? 0;
      pos.setZ(i, e > 0 ? 1 + e * ELEV_EXAGGERATION : 0);
      const c = e > 0 ? terrainColour(e) : sea;
      colours.set([c.r, c.g, c.b], i * 3);
    }
    tg.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    tg.computeVertexNormals();
    makePlate("terrain", new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })));

    // Data plates start empty; textures arrive as soon as their data does.
    (["rain", "flow", "peak", "index"] as LayerId[]).forEach((id) => {
      const body = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
      body.visible = false; // shown once its texture exists, so an empty plate never flashes white
      makePlate(id, body);
    });

    const order: LayerId[] = ["terrain", "rain", "flow", "peak", "index"];
    let gap = 0;
    const state = {
      plates,
      meshes,
      gapTarget: 70,
      setTexture: (id: LayerId, tex: THREE.Texture) => {
        const m = meshes[id]!.material as THREE.MeshBasicMaterial;
        m.map?.dispose();
        m.map = tex;
        m.needsUpdate = true;
        meshes[id]!.visible = true;
      },
      setBasins: (list: PHRiver[]) => {
        // White dots at each basin outlet on the three river layers: where every value comes from.
        const pts = list.map((r) => {
          const [x, y] = projectPH(r.longitude, r.latitude);
          return new THREE.Vector3(x - W / 2, -(y - H / 2), 0.8);
        });
        (["flow", "peak", "index"] as LayerId[]).forEach((id) => {
          const old = plates[id].getObjectByName("outlets");
          if (old) {
            plates[id].remove(old);
            (old as THREE.Points).geometry.dispose();
          }
          const dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ color: 0xffffff, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.95 }));
          dots.name = "outlets";
          plates[id].add(dots);
        });
      },
      setFocus: (id: LayerId | null) => {
        order.forEach((o) => {
          const dim = id !== null && o !== id;
          plates[o].traverse((obj) => {
            const mat = (obj as THREE.Mesh).material as THREE.Material & { opacity: number; userData: { base?: number } };
            if (!mat || Array.isArray(mat)) return;
            mat.userData.base ??= mat.opacity;
            mat.transparent = true;
            mat.opacity = (mat.userData.base ?? 1) * (dim ? 0.15 : 1);
          });
        });
      },
    };
    scene.current = state;

    // Hover read-out.
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const targets = order.filter((o) => plates[o].visible).map((o) => meshes[o]!).reverse();
      const hit = ray.intersectObjects(targets)[0];
      if (!hit || !hit.uv) return setReadout(null);
      const id = order.find((o) => meshes[o] === hit.object)!;
      const x = hit.uv.x * W;
      const y = (1 - hit.uv.y) * H;
      setReadout(describeRef.current(id, x, y));
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", () => setReadout(null));

    let raf = 0;
    const edge = new THREE.Vector3();
    const tick = () => {
      gap += (state.gapTarget - gap) * (reduce ? 1 : 0.08);
      order.forEach((o, k) => (plates[o].position.y = k * gap));
      controls.update();
      renderer.render(sc, camera);
      // Pin each layer's name to the right-hand edge of its plate, as on a printed layer-stack figure.
      order.forEach((o) => {
        const label = labelRefs.current[o];
        if (!label) return;
        plates[o].updateMatrixWorld();
        edge.set(W / 2 + 14, -H / 4, 0).applyMatrix4(plates[o].matrixWorld).project(camera);
        const onScreen = plates[o].visible && edge.z < 1;
        label.style.opacity = onScreen ? "1" : "0";
        label.style.transform = `translate(${((edge.x + 1) / 2) * el.clientWidth + 8}px, ${((1 - edge.y) / 2) * el.clientHeight - 10}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    let lastAspect = camera.aspect;
    const ro = new ResizeObserver(() => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      if (Math.abs(camera.aspect - lastAspect) > 0.15) {
        lastAspect = camera.aspect;
        fit();
      }
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      sc.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        });
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
      scene.current = null;
    };
  }, [elev]);

  // ---- value read-out for a point on a layer (kept in a ref so the scene always reads current data)
  describeRef.current = describe;
  function describe(id: LayerId, x: number, y: number): Readout {
    const lon = lonOf(x);
    const lat = latOf(y);
    if (id === "terrain") {
      if (!elev) return null;
      const i = Math.round((elev.lat1 - lat) / elev.step) * elev.nx + Math.round((lon - elev.lon0) / elev.step);
      const e = elev.elevation_m[i];
      return { layer: id, lon, lat, text: e > 0 ? `${e.toLocaleString()} m above sea level` : "Sea" };
    }
    const g = grids.current[id];
    if (!g) return null;
    const i = sample(g, x, y);
    const v = g.values[i];
    if (!Number.isFinite(v)) return { layer: id, lon, lat, text: "Sea or no data" };
    if (id === "rain") return { layer: id, lon, lat, text: `${v.toFixed(1)} mm` };
    const near = g.nearest && g.nearest[i] >= 0 ? rivers[g.nearest[i]] : null;
    const d = g.distKm?.[i];
    return {
      layer: id,
      lon,
      lat,
      text: `${v.toFixed(2)} × watch level`,
      sub: near ? `Nearest basin: ${near.name}, ${Math.round(d ?? 0)} km away${d && d > NEAR_KM ? " (lower confidence)" : ""}` : undefined,
    };
  }

  // ---- flow layers: rebuild when the day or the data changes
  useEffect(() => {
    const s = scene.current;
    if (!s || !masks || !rivers.length || !dates.length) return;
    const date = dates[day];
    const ratioOn = (r: PHRiver, d: string) => (r.series.find((p) => p.date === d)?.discharge_m3s ?? NaN) / r.thresholds_m3s.advisory;
    s.setBasins(rivers);
    const flow = zones(rivers, masks.flow, (r) => ratioOn(r, date));
    grids.current.flow = flow;
    s.setTexture("flow", paint(flow, masks.flow, ratioColour, (i) => fade(flow.distKm![i])));
  }, [rivers, dates, day, masks, elev]);

  useEffect(() => {
    const s = scene.current;
    if (!s || !masks || !rivers.length || !dates.length) return;
    const ratioOn = (r: PHRiver, d: string) => (r.series.find((p) => p.date === d)?.discharge_m3s ?? NaN) / r.thresholds_m3s.advisory;
    const peak = zones(rivers, masks.flow, (r) => Math.max(...dates.map((d) => ratioOn(r, d)).filter(Number.isFinite)));
    grids.current.peak = peak;
    s.setTexture("peak", paint(peak, masks.flow, ratioColour, (i) => fade(peak.distKm![i])));
  }, [rivers, dates, masks, elev]);

  // ---- rainfall and the combined index
  useEffect(() => {
    const s = scene.current;
    if (!s || !masks || !rain) return;
    const r = rainGrid(rain, masks.rain, (row) => row[day] ?? 0);
    grids.current.rain = r;
    s.setTexture("rain", paint(r, masks.rain, rainColour, () => 0.92));
    const flow = grids.current.flow;
    if (!flow) return;
    const r3 = rainGrid(rain, masks.rain, (row) => row.slice(day, day + 3).reduce((a, b) => a + b, 0));
    const values = new Float32Array(flow.values.length).fill(NaN);
    for (let i = 0; i < values.length; i++) {
      if (!masks.flow[i]) continue;
      const x = ((i % flow.w) + 0.5) / TEX_SCALE;
      const y = (Math.floor(i / flow.w) + 0.5) / TEX_SCALE;
      const rainRatio = r3.values[sample(r3, x, y)] / RAIN_REF_MM;
      const flowRatio = flow.values[i] * fade(flow.distKm![i]); // distant zones contribute less
      values[i] = Math.max(Number.isFinite(flowRatio) ? flowRatio : 0, Number.isFinite(rainRatio) ? rainRatio : 0);
    }
    const index: Grid = { w: flow.w, h: flow.h, values, nearest: flow.nearest, distKm: flow.distKm };
    grids.current.index = index;
    s.setTexture("index", paint(index, masks.flow, ratioColour, () => 0.95));
  }, [rain, day, masks, rivers, dates, elev]);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    (Object.keys(visible) as LayerId[]).forEach((id) => (s.plates[id].visible = visible[id]));
  }, [visible, elev]);
  useEffect(() => scene.current?.setFocus(focus), [focus, elev]);
  useEffect(() => {
    if (scene.current) scene.current.gapTarget = 70 * spread;
  }, [spread, elev]);

  const dayLabel = (d?: string) =>
    d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) : "—";
  const loading = !elev ? "Loading terrain…" : !outlook && !error ? "Loading river outlook…" : !rain && !problem ? "Fetching rainfall forecast…" : null;

  return (
    <div className="ly">
      <div className="ly-stage">
        <div className="ly-viz">
          <div ref={mount} className="ly-canvas" aria-label="3D stack of map layers over the Philippines. Drag to orbit, scroll to zoom." role="img" />
          <div className="ly-labels" aria-hidden>
            {LAYERS.map((l) => (
              <span key={l.id} ref={(n) => { labelRefs.current[l.id] = n; }} className={focus === l.id ? "is-focus" : ""}>{l.title}</span>
            ))}
          </div>
          <div className="ly-overlay">
            <span className="ly-date">{dayLabel(dates[day])}{day === 0 ? " (today)" : ` (+${day} day${day > 1 ? "s" : ""})`}</span>
            {loading && <span className="ly-loading">{loading}</span>}
            {readout && (
              <div className="ly-readout">
                <b>{LAYERS.find((l) => l.id === readout.layer)?.title}</b>
                <span>{readout.text}</span>
                {readout.sub && <small>{readout.sub}</small>}
                <small>{readout.lat.toFixed(2)}° N, {readout.lon.toFixed(2)}° E</small>
              </div>
            )}
          </div>
          <p className="ly-hint">Drag to orbit · scroll to zoom · hover a layer to read its value</p>
        </div>

        <aside className="ly-panel" aria-label="Layers">
          <h3>Layers</h3>
          <ol className="ly-legend">
            {LAYERS.map((l) => (
              <li
                key={l.id}
                className={`${focus === l.id ? "is-focus" : ""} ${visible[l.id] ? "" : "is-off"}`}
                onMouseEnter={() => setFocus(l.id)}
                onMouseLeave={() => setFocus(null)}
              >
                <label>
                  <input type="checkbox" checked={visible[l.id]} onChange={(e) => setVisible((v) => ({ ...v, [l.id]: e.target.checked }))} />
                  <span>
                    <b>{l.title}</b>
                    <small>{l.source}</small>
                  </span>
                </label>
                <i className="ly-ramp" style={{ background: gradient(l.id === "rain" ? RAIN_STOPS : l.id === "terrain" ? TERRAIN_STOPS : RATIO_STOPS) }} />
                <span className="ly-ramp-scale">
                  {l.id === "rain" ? <><span>0</span><span>50</span><span>200 mm</span></> : l.id === "terrain" ? <><span>0</span><span>1,000</span><span>2,600 m</span></> : <><span>0</span><span>watch level</span><span>1.4×</span></>}
                </span>
              </li>
            ))}
          </ol>

          <div className="ly-control">
            <label htmlFor="ly-day">Day: <b>{dayLabel(dates[day])}</b></label>
            <input id="ly-day" type="range" min={0} max={DAYS - 1} value={day} onChange={(e) => setDay(Number(e.target.value))} />
          </div>
          <div className="ly-control">
            <label htmlFor="ly-spread">Layer spacing</label>
            <input id="ly-spread" type="range" min={0} max={2} step={0.05} value={spread} onChange={(e) => setSpread(Number(e.target.value))} />
          </div>
          {(problem || error) && <p className="ly-error">{problem ?? error}</p>}
        </aside>
      </div>

      <section className="ios-card ly-method">
        <h3>How each layer is made</h3>
        <div className="ly-table-wrap">
          <table className="ly-table">
            <thead>
              <tr><th>Layer</th><th>Source</th><th>Method</th><th>Unit</th></tr>
            </thead>
            <tbody>
              {LAYERS.map((l) => (
                <tr key={l.id}><td>{l.title}</td><td>{l.source}</td><td>{l.method}</td><td>{l.unit}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>What this view can and cannot tell you</h4>
        <ul>
          <li>
            <b>River layers are zones, not flood extents.</b> We know flow at 17 basin outlets, not along every river, so each
            land pixel shows its nearest outlet. Colour is full strength within {NEAR_KM} km of an outlet and fades out by{" "}
            {FADE_KM} km. Real catchment boundaries would be better; they are on our roadmap.
          </li>
          <li>
            <b>The watch level is each river&apos;s own 95th-percentile flow</b> over five years of GloFAS reanalysis, so a
            small river and the Cagayan sit on the same scale. A value of 1.0 means the river is as high as it gets on about
            one day in twenty.
          </li>
          <li>
            <b>Rainfall is a forecast</b> from Open-Meteo at land points every 0.5° (about 55 km), interpolated by
            inverse-distance weighting (power 2, points within {RAIN_RADIUS_KM} km). It smooths local downpours.
          </li>
          <li>
            <b>The flood-watch index is a screening aid, not a hazard map.</b> It takes the larger of the river ratio and the
            3-day rain total divided by {RAIN_REF_MM} mm. {RAIN_REF_MM} mm is a scaling reference we chose, not a PAGASA
            threshold. For official warnings, follow PAGASA and your local DRRM office.
          </li>
          <li>
            <b>Terrain</b> is SRTM-based elevation from the public AWS Terrain Tiles, sampled every 0.1° (about 11 km),
            with height exaggerated so that relief is visible at country scale.
          </li>
        </ul>
        <p className="ly-more">
          Full forecasting method, parameters and live skill scores: <Link href="/research">Research and methodology {Icon.arrow}</Link>
        </p>
      </section>
    </div>
  );
}
