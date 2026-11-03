"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PH_PATH, PH_VIEWBOX, projectPH } from "../ph-outline";

export type Basin = {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  current_date: string;
  thresholds_m3s: { advisory: number; warning: number; critical: number; median: number };
  series: { date: string; discharge_m3s: number; is_forecast: boolean }[];
};

// Heat ramp on r = Q / Q95 (the basin's watch level). Below 1 the river is within its normal
// range; the ramp only turns orange and red once the watch level is reached or exceeded.
const STOPS: [number, THREE.Color][] = [
  [0, new THREE.Color("#2E8B57")],
  [0.5, new THREE.Color("#8DBF5A")],
  [0.85, new THREE.Color("#E0B12A")],
  [1.0, new THREE.Color("#E5862C")],
  [1.4, new THREE.Color("#C8321F")],
];

export function heat(r: number): THREE.Color {
  if (r <= STOPS[0][0]) return STOPS[0][1].clone();
  for (let i = 1; i < STOPS.length; i++) {
    const [r1, c1] = STOPS[i];
    const [r0, c0] = STOPS[i - 1];
    if (r <= r1) return c0.clone().lerp(c1, (r - r0) / (r1 - r0));
  }
  return STOPS[STOPS.length - 1][1].clone();
}

const MAX_RATIO = 1.6; // columns are capped here so one extreme river cannot flatten the rest
const COLUMN_SCALE = 120; // scene units of height at r = 1 (the watch level)

function outlineShapes(): THREE.Shape[] {
  const [, , w, h] = PH_VIEWBOX.split(" ").map(Number);
  return PH_PATH.split("Z")
    .filter((d) => d.trim())
    .map((d) => {
      const pts = d.replace("M", "").split("L").map((p) => p.split(",").map(Number));
      const shape = new THREE.Shape();
      pts.forEach(([x, y], i) => (i ? shape.lineTo(x - w / 2, -(y - h / 2)) : shape.moveTo(x - w / 2, -(y - h / 2))));
      return shape;
    });
}

export function Flow3D({ basins, dates, dayIndex, onHover }: { basins: Basin[]; dates: string[]; dayIndex: number; onHover: (id: string | null) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const state = useRef<{ columns: THREE.Mesh[]; discs: THREE.Mesh[]; targets: number[] } | null>(null);
  const [, , vw, vh] = PH_VIEWBOX.split(" ").map(Number);

  const values = useMemo(
    () =>
      basins.map((b) => {
        const byDate = new Map(b.series.map((p) => [p.date, p.discharge_m3s]));
        return dates.map((d) => (byDate.get(d) ?? NaN) / b.thresholds_m3s.advisory);
      }),
    [basins, dates],
  );

  // Build the scene once per data set.
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, el.clientWidth / el.clientHeight, 1, 4000);
    camera.position.set(-70, 300, 360);
    scene.fog = new THREE.Fog(0xe9f0ee, 420, 1100); // the sea fades out instead of ending at an edge
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 30, 0);
    controls.enableDamping = !reduce;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 220;
    controls.maxDistance = 1100;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa39c, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-200, 500, 300);
    scene.add(sun);

    // Sea plane with a faint grid, then the islands as a thin slab.
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0xe6eef0, roughness: 1 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.5;
    scene.add(sea);
    const grid = new THREE.GridHelper(4000, 120, 0xc9d8d6, 0xd6e2e0);
    grid.position.y = 0;
    scene.add(grid);
    const land = new THREE.Mesh(
      new THREE.ExtrudeGeometry(outlineShapes(), { depth: 4, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0xdbe6df, roughness: 0.9 }),
    );
    land.rotation.x = -Math.PI / 2;
    scene.add(land);

    const columns: THREE.Mesh[] = [];
    const discs: THREE.Mesh[] = [];
    basins.forEach((b) => {
      const [px, py] = projectPH(b.longitude, b.latitude);
      const x = px - vw / 2;
      const z = py - vh / 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 1, 24), new THREE.MeshStandardMaterial({ roughness: 0.45 }));
      col.geometry.translate(0, 0.5, 0); // grow upwards from the land surface
      col.position.set(x, 4, z);
      col.userData.id = b.id;
      scene.add(col);
      columns.push(col);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 4.3, z);
      scene.add(disc);
      discs.push(disc);
    });
    state.current = { columns, discs, targets: columns.map(() => 2) };

    // Hover read-out via raycasting.
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(columns)[0];
      onHover(hit ? (hit.object.userData.id as string) : null);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", () => onHover(null));

    let raf = 0;
    const tick = () => {
      const s = state.current;
      if (s) {
        s.columns.forEach((c, i) => {
          const k = reduce ? 1 : 0.12;
          c.scale.y += (s.targets[i] - c.scale.y) * k;
        });
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const ro = new ResizeObserver(() => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
      state.current = null;
    };
    // The scene depends only on which basins exist; day changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basins]);

  // Apply the selected day: target heights, heat colours and disc sizes.
  useEffect(() => {
    const s = state.current;
    if (!s) return;
    values.forEach((row, i) => {
      const r = row[dayIndex];
      const ratio = Number.isFinite(r) ? Math.min(r, MAX_RATIO) : 0;
      s.targets[i] = Math.max(2, ratio * COLUMN_SCALE);
      const c = heat(ratio);
      (s.columns[i].material as THREE.MeshStandardMaterial).color.copy(c);
      (s.discs[i].material as THREE.MeshBasicMaterial).color.copy(c);
      s.discs[i].scale.setScalar(6 + ratio * 26);
    });
  }, [values, dayIndex]);

  return <div ref={mount} className="rx-canvas" />;
}
