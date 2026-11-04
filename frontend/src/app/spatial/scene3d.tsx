"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Result } from "./analysis";

export type RainMode = "forecast" | "heavy" | "off";

type Props = {
  result: Result;
  dem: Float32Array;
  imagery: HTMLCanvasElement | null;
  level: number; // metres the rivers rise above their normal surface
  rainMode: RainMode;
  rainTodayMm: number;
  pin: { title: string; detail: string };
};

type SceneState = {
  setLevel: (m: number) => void;
  setImagery: (c: HTMLCanvasElement | null) => void;
  setRain: (count: number) => void;
};

const BASE_KM = -0.35; // bottom of the block diagram
const MAX_DROPS = 7000;

/** Rain streaks per frame for a daily total: none when dry, a downpour from about 60 mm. */
export const dropsFor = (mode: RainMode, mm: number) => (mode === "off" ? 0 : mode === "heavy" ? MAX_DROPS : mm < 0.5 ? 0 : Math.min(MAX_DROPS, Math.round(500 + mm * 100)));

export function Scene3D({ result, dem, imagery, level, rainMode, rainTodayMm, pin }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const api = useRef<SceneState | null>(null);
  const [failed, setFailed] = useState(false);
  const [exag, setExag] = useState(1);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const g = result.grid, n = g.n;
    const widthKm = (n * g.dxM) / 1000, depthKm = (n * g.dyM) / 1000;

    // Exaggerate height so a floodplain still reads as terrain: aim for ~2.2 km of relief.
    const sorted = Array.from(dem).filter(Number.isFinite).sort((a, b) => a - b);
    const p98 = sorted[Math.floor(sorted.length * 0.98)] ?? 100;
    const EX = Math.min(6, Math.max(1.5, 2.2 / Math.max(0.2, p98 / 1000)));
    setExag(Math.round(EX * 10) / 10);
    const yOf = (z: number) => ((Number.isFinite(z) ? z : 0) / 1000) * EX;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1a1f);
    scene.fog = new THREE.Fog(0x0d1a1f, widthKm * 1.6, widthKm * 3.4);
    const camera = new THREE.PerspectiveCamera(38, el.clientWidth / el.clientHeight, 0.05, widthKm * 10);
    camera.position.set(-widthKm * 0.12, widthKm * 0.62, depthKm * 0.95);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = 1.38;
    controls.minDistance = widthKm * 0.18;
    controls.maxDistance = widthKm * 2.6;
    controls.target.set(0, yOf(dem[(n >> 1) * n + (n >> 1)]) * 0.5, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x2b3d3a, 2.1));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    sun.position.set(-widthKm, widthKm * 1.4, widthKm * 0.6);
    scene.add(sun);

    // ---- terrain surface, one vertex per grid cell
    const N = n * n;
    const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos[3 * k] = (i / (n - 1) - 0.5) * widthKm;
      pos[3 * k + 1] = yOf(dem[k]);
      pos[3 * k + 2] = (j / (n - 1) - 0.5) * depthKm;
      uv[2 * k] = i / (n - 1);
      uv[2 * k + 1] = 1 - j / (n - 1);
    }
    const index = new Uint32Array((n - 1) * (n - 1) * 6);
    let t = 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      index.set([a, c, b, b, c, d], t);
      t += 6;
    }
    const terrainGeo = new THREE.BufferGeometry();
    terrainGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    terrainGeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    terrainGeo.setIndex(new THREE.BufferAttribute(index, 1));
    terrainGeo.computeVertexNormals();
    // Without imagery, colour by elevation so the scene still reads.
    const hyps = new Float32Array(N * 3);
    const lo = new THREE.Color("#2f6b4f"), mid = new THREE.Color("#b9b07a"), hi = new THREE.Color("#7a5a3a"), sea = new THREE.Color("#244a63");
    for (let k = 0; k < N; k++) {
      const z = dem[k];
      const c = !result.valid[k] ? sea : z / p98 < 0.5 ? lo.clone().lerp(mid, z / p98 / 0.5) : mid.clone().lerp(hi, Math.min(1, (z / p98 - 0.5) / 0.5));
      hyps.set([c.r, c.g, c.b], 3 * k);
    }
    terrainGeo.setAttribute("color", new THREE.BufferAttribute(hyps, 3));
    const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    scene.add(terrain);

    // ---- block-diagram sides
    const edge: number[] = [];
    for (let i = 0; i < n; i++) edge.push(i); // north edge, west to east
    for (let j = 1; j < n; j++) edge.push(j * n + n - 1); // east edge
    for (let i = n - 2; i >= 0; i--) edge.push((n - 1) * n + i); // south edge
    for (let j = n - 2; j >= 0; j--) edge.push(j * n); // west edge
    const side = new Float32Array(edge.length * 6);
    edge.forEach((k, e) => {
      side.set([pos[3 * k], pos[3 * k + 1], pos[3 * k + 2], pos[3 * k], BASE_KM, pos[3 * k + 2]], e * 6);
    });
    const sideIdx: number[] = [];
    for (let e = 0; e < edge.length - 1; e++) {
      const a = 2 * e, b = a + 1, c = a + 2, d = a + 3;
      sideIdx.push(a, b, c, c, b, d);
    }
    const sideGeo = new THREE.BufferGeometry();
    sideGeo.setAttribute("position", new THREE.BufferAttribute(side, 3));
    sideGeo.setIndex(sideIdx);
    const sideMat = new THREE.MeshBasicMaterial({ color: 0x24363b, side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(sideGeo, sideMat));

    // ---- floodwater surface: rivers' surface plus the chosen rise, wherever the land is lower
    const waterPos = new Float32Array(N * 3);
    waterPos.set(pos);
    const waterCol = new Float32Array(N * 4);
    const waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute("position", new THREE.BufferAttribute(waterPos, 3));
    waterGeo.setAttribute("color", new THREE.BufferAttribute(waterCol, 4));
    waterGeo.setIndex(new THREE.BufferAttribute(index, 1));
    const waterMat = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, depthWrite: false, shininess: 90, specular: 0x9fc4e8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.renderOrder = 2;
    scene.add(water);
    const shallow = new THREE.Color("#8fd0ff"), deep = new THREE.Color("#1c5aa6");
    const hand = result.layers.hand!;
    const setLevel = (m: number) => {
      for (let k = 0; k < N; k++) {
        const h = hand[k];
        const wet = result.valid[k] && Number.isFinite(h) && h < m;
        if (wet) {
          const depth = m - h;
          const c = shallow.clone().lerp(deep, Math.min(1, depth / 4));
          waterPos[3 * k + 1] = yOf(result.drainZ[k] + m) + 0.004;
          waterCol.set([c.r, c.g, c.b, 0.55 + Math.min(0.3, depth / 10)], 4 * k);
        } else {
          waterPos[3 * k + 1] = pos[3 * k + 1] - 0.01;
          waterCol[4 * k + 3] = 0;
        }
      }
      waterGeo.attributes.position.needsUpdate = true;
      waterGeo.attributes.color.needsUpdate = true;
      waterGeo.computeVertexNormals();
      waterGeo.computeBoundingSphere();
    };

    // ---- rain
    const rainPos = new Float32Array(MAX_DROPS * 6);
    const topKm = 3.2;
    const seedDrop = (d: number, anywhere: boolean) => {
      const x = (Math.random() - 0.5) * widthKm, z = (Math.random() - 0.5) * depthKm;
      const y = anywhere ? Math.random() * topKm : topKm + Math.random() * 0.4;
      rainPos.set([x, y, z, x + 0.02, y + 0.16, z + 0.01], d * 6);
    };
    for (let d = 0; d < MAX_DROPS; d++) seedDrop(d, true);
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    rainGeo.setDrawRange(0, 0);
    const rainMat = new THREE.LineBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.45, depthWrite: false });
    const rain = new THREE.LineSegments(rainGeo, rainMat);
    rain.frustumCulled = false;
    scene.add(rain);
    let drops = 0;

    let imageryTex: THREE.Texture | null = null;
    const setImagery = (c: HTMLCanvasElement | null) => {
      imageryTex?.dispose();
      imageryTex = null;
      if (c) {
        imageryTex = new THREE.CanvasTexture(c);
        imageryTex.colorSpace = THREE.SRGBColorSpace;
        imageryTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        terrainMat.map = imageryTex;
        terrainMat.vertexColors = false;
      } else {
        terrainMat.map = null;
        terrainMat.vertexColors = true;
      }
      terrainMat.needsUpdate = true;
    };

    api.current = {
      setLevel,
      setImagery,
      setRain: (count) => { drops = count; rainGeo.setDrawRange(0, count * 2); },
    };

    const centre = new THREE.Vector3(0, yOf(dem[(n >> 1) * n + (n >> 1)]) + 0.05, 0);
    const clock = new THREE.Clock();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, clock.getDelta());
      if (drops && !reduce) {
        const fall = dt * 5.5;
        for (let d = 0; d < drops; d++) {
          const o = d * 6;
          rainPos[o + 1] -= fall;
          rainPos[o + 4] -= fall;
          if (rainPos[o + 1] < 0) seedDrop(d, false);
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      controls.update();
      renderer.render(scene, camera);
      const p = pinRef.current;
      if (p) {
        const v = centre.clone().project(camera);
        const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        p.style.opacity = visible ? "1" : "0";
        p.style.transform = `translate(${((v.x + 1) / 2) * el.clientWidth}px, ${((1 - v.y) / 2) * el.clientHeight}px) translate(-50%, -100%)`;
      }
    };
    tick();

    const ro = new ResizeObserver(() => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      api.current = null;
      imageryTex?.dispose();
      [terrainGeo, sideGeo, waterGeo, rainGeo].forEach((x) => x.dispose());
      [terrainMat, sideMat, waterMat, rainMat].forEach((x) => x.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [result, dem]);

  useEffect(() => api.current?.setLevel(level), [level, result]);
  useEffect(() => api.current?.setImagery(imagery), [imagery, result]);
  useEffect(() => api.current?.setRain(dropsFor(rainMode, rainTodayMm)), [rainMode, rainTodayMm, result]);

  if (failed) return <div className="sp-canvas sp-canvas-empty">3D needs WebGL, which this browser has turned off. The maps below still work.</div>;
  return (
    <div className="sp-canvas" ref={mount}>
      <div className="sp-pin" ref={pinRef}>
        <strong>{pin.title}</strong>
        <span>{pin.detail}</span>
      </div>
      <span className="sp-exag">Height × {exag}</span>
    </div>
  );
}
