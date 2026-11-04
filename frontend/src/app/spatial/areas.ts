// Preset analysis windows: flood-prone towns on the rivers in the Philippine outlook.
// River and road data for these windows are pre-fetched from OpenStreetMap into
// /public/data/spatial/<id>.json by scripts/build_spatial_osm.py (the live Overpass API is often busy).
export type Area = { id: string; name: string; place: string; lat: number; lon: number; basin: string };

export const AREAS: Area[] = [
  { id: "marikina", name: "Marikina Valley", place: "Metro Manila", lat: 14.64, lon: 121.1, basin: "ph-pasig-marikina" },
  { id: "cdo", name: "Cagayan de Oro", place: "Misamis Oriental", lat: 8.46, lon: 124.64, basin: "ph-cagayan-de-oro" },
  { id: "tuguegarao", name: "Tuguegarao", place: "Cagayan", lat: 17.62, lon: 121.72, basin: "ph-cagayan" },
  { id: "butuan", name: "Butuan", place: "Agusan del Norte", lat: 8.93, lon: 125.54, basin: "ph-agusan" },
  { id: "candaba", name: "Candaba–Arayat", place: "Pampanga", lat: 15.12, lon: 120.85, basin: "ph-pampanga" },
  { id: "naga", name: "Naga", place: "Camarines Sur", lat: 13.62, lon: 123.19, basin: "ph-bicol" },
  { id: "dagupan", name: "Dagupan–Calasiao", place: "Pangasinan", lat: 16.04, lon: 120.36, basin: "ph-agno" },
  { id: "cotabato", name: "Cotabato City", place: "Maguindanao", lat: 7.21, lon: 124.26, basin: "ph-mindanao" },
  { id: "roxas", name: "Roxas City", place: "Capiz", lat: 11.57, lon: 122.74, basin: "ph-panay" },
  { id: "davao", name: "Davao City", place: "Davao del Sur", lat: 7.08, lon: 125.6, basin: "ph-davao" },
];

export const WINDOW_HALF_DEG = 0.11; // about 24 km across
export const GRID_N = 360; // about 68 m cells
