export type Forecast = { point_m: number; lo80_m: number; hi80_m: number; model: string };

export type Thresholds = { advisory_m: number; warning_m: number; critical_m: number; rise_rate_m_per_h: number; source: string };

export type Station = {
  station: { id: string; name: string; river: string; is_simulated: boolean; latitude: number; longitude: number; timezone?: string; thresholds?: Thresholds };
  status: string;
  message?: string | null;
  current_level_m: number | null;
  slope_m_per_h: number | null;
  rain_last_24h_mm?: number | null;
  forecast: Record<string, Forecast>;
  risk: { level: string; label: string; explanation: string; rank: number; trend: string } | null;
  freshness: { label?: string } | null;
  sparkline: number[];
};

export type Overview = {
  station_count: number;
  rising_count: number;
  risk_counts: Record<string, number>;
  highest_risk: { station_id: string; station_name: string; level: string; label: string; explanation: string } | null;
  observed_rain_last_24h_max_mm: number | null;
  forecast_rain_next_24h_max_mm?: number | null;
  any_simulated: boolean;
  stations: Station[];
};

export type OutlookPoint = { date: string; discharge_m3s: number; p25_m3s: number | null; p75_m3s: number | null; is_forecast: boolean };

export type PHRiver = {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  current_m3s: number;
  current_date: string;
  trend: "rising" | "falling" | "steady";
  level: string;
  label: string;
  rank: number;
  peak: { date: string; discharge_m3s: number };
  upper_m3s: number;
  explanation: string;
  thresholds_m3s: { advisory: number; warning: number; critical: number; median: number };
  series: OutlookPoint[];
};

export type Outlook = { source: string; source_url: string; fetched_at: string; stale: boolean; method: string; rivers: PHRiver[] };

export type SourceStatus = Record<string, { name: string; last_sync: string; ok: boolean; rows_imported?: number; errors: Record<string, string> }>;

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export function formatFlow(v: number | null | undefined) {
  return v == null ? "—" : v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1);
}

export type Hazard = {
  id: string;
  type: "typhoon" | "flood";
  name: string;
  alert: "green" | "orange" | "red";
  country: string;
  latitude: number;
  longitude: number;
  distance_to_ph_km: number;
  affects_ph: boolean;
  near_ph: boolean;
  severity: string | null;
  from: string;
  to: string;
  report_url: string | null;
};

export type Hazards = {
  fetched_at: string;
  stale: boolean;
  events: Hazard[];
  near_ph: Hazard[];
  uk_warnings: { id: string; area: string; severity: string; river: string }[];
};

export type AiStatus = { configured: boolean; base_url: string; models: Record<string, string> };

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Plain-language meaning for each risk level, so nobody has to learn the jargon.
export const LEVEL_INFO: Record<string, { word: string; hint: string }> = {
  normal: { word: "Normal", hint: "Nothing to do right now." },
  advisory: { word: "Watch", hint: "Keep an eye on it." },
  warning: { word: "Prepare", hint: "Get your response ready." },
  critical: { word: "Act now", hint: "Follow the local action plan." },
};

// Admin key for data-changing endpoints. Session storage only: it disappears when the tab closes.
const ADMIN_KEY = "hs-admin-key";

export function getAdminKey(): string {
  try {
    return sessionStorage.getItem(ADMIN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAdminKey(value: string) {
  try {
    if (value) sessionStorage.setItem(ADMIN_KEY, value);
    else sessionStorage.removeItem(ADMIN_KEY);
  } catch {}
}

/** Fetch JSON from the backend; throws an Error carrying the backend's own message.
    Non-GET requests carry the admin key when one is set for this session. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const method = (init?.method ?? "GET").toUpperCase();
  const key = method !== "GET" ? getAdminKey() : "";
  const headers = new Headers(init?.headers);
  if (key) headers.set("X-Admin-Token", key);
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Can't reach the server at ${API_URL}. Is the backend running?`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const d = data?.detail;
    if (response.status === 401) throw new Error("This action needs the admin key. Add it in Tools → System.");
    if (response.status === 403) throw new Error(typeof d === "string" ? d : "Admin actions are disabled on this server.");
    if (response.status === 429) throw new Error(typeof d === "string" ? d : "Too many requests. Please wait a moment.");
    const msg = typeof d === "string" ? d : d?.message ?? `Request failed (${response.status}).`;
    const extra = Array.isArray(d?.stations) ? ` ${d.stations.join(", ")}` : Array.isArray(d?.errors) ? ` ${d.errors.join(" ")}` : "";
    throw new Error(msg + extra);
  }
  return data as T;
}

export function postJson<T>(path: string, body: unknown, method = "POST") {
  return api<T>(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  return value == null ? "—" : value.toFixed(digits);
}

export function levelOf(item: Station) {
  return item.risk?.level ?? "normal";
}

export function isRising(item: Station) {
  return (item.slope_m_per_h ?? 0) > 0;
}

export function Sparkline({ values, tall = false }: { values: number[]; tall?: boolean }) {
  if (values.length < 2) return <span className="ios-muted ios-small">No recent readings</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const h = tall ? 60 : 28;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${h - 3 - ((v - min) / Math.max(max - min, 0.01)) * (h - 6)}`)
    .join(" ");
  return (
    <svg className={tall ? "ios-spark ios-spark-tall" : "ios-spark"} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" aria-label="Recent water level trend">
      {tall && <polygon points={`0,${h} ${points} 100,${h}`} className="ios-spark-fill" />}
      <polyline points={points} />
    </svg>
  );
}

export const Icon = {
  today: <svg viewBox="0 0 24 24" aria-hidden><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  stations: <svg viewBox="0 0 24 24" aria-hidden><path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M12 3v7M9 7l3 3 3-3" /></svg>,
  agent: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12 18.4 5.6" /><circle cx="12" cy="12" r="1" /></svg>,
  typhoon: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 3c-4.5 0-8 2-9 5 2.5-1.6 5.5-2 8-1.2" /><path d="M12 21c4.5 0 8-2 9-5-2.5 1.6-5.5 2-8 1.2" /><circle cx="12" cy="12" r="3" /></svg>,
  outlook: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></svg>,
  ask: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></svg>,
  tools: <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></svg>,
  refresh: <svg viewBox="0 0 24 24" aria-hidden><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>,
  chevron: <svg viewBox="0 0 24 24" aria-hidden className="ios-chev"><path d="m9 5 7 7-7 7" /></svg>,
  send: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
  search: <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>,
  back: <svg viewBox="0 0 24 24" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  home: <svg viewBox="0 0 24 24" aria-hidden><path d="M3 10.5 12 3l9 7.5M5 9v11h14V9" /></svg>,
  reset: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" /></svg>,
  sun: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  moon: <svg viewBox="0 0 24 24" aria-hidden><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>,
  auto: <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>,
  up: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 19V5M6 11l6-6 6 6" /></svg>,
  down: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 5v14M6 13l6 6 6-6" /></svg>,
  flat: <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  arrow: <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>,
  alert: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 3.5 2.5 20h19z" /><path d="M12 10v4.5M12 17.2v.1" /></svg>,
  offline: <svg viewBox="0 0 24 24" aria-hidden><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.4M15 10.6A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 5-3M11 5.1A15 15 0 0 1 22 9.5M12 20h.01" /></svg>,
  close: <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>,
  spark: <svg viewBox="0 0 24 24" aria-hidden className="ios-spark-icon"><path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5v.1c-4.6.6-6.9 2.9-7.5 7.5h-.1c-.6-4.6-2.9-6.9-7.4-7.5v-.1c4.5-.6 6.8-2.9 7.4-7.5z" /><path d="M19 15.5c.25 1.9 1.1 2.75 3 3-1.9.25-2.75 1.1-3 3-.25-1.9-1.1-2.75-3-3 1.9-.25 2.75-1.1 3-3z" /></svg>,
  download: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
  keyboard: <svg viewBox="0 0 24 24" aria-hidden><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" /></svg>,
  server: <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6" /></svg>,
  activity: <svg viewBox="0 0 24 24" aria-hidden><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>,
  database: <svg viewBox="0 0 24 24" aria-hidden><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>,
  cpu: <svg viewBox="0 0 24 24" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9.5 9.5h5v5h-5zM9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" /></svg>,
  rain: <svg viewBox="0 0 24 24" aria-hidden><path d="M7 15a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19.5 9 3.5 3.5 0 0 1 18 15.8" /><path d="M8 18.5l-1 2M12 17.5l-1 3M16 18.5l-1 2" /></svg>,
  map: <svg viewBox="0 0 24 24" aria-hidden><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></svg>,
  pin: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>,
  clock: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  install: <svg viewBox="0 0 24 24" aria-hidden><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 7v7M9 11l3 3 3-3M10.5 18.5h3" /></svg>,
  bag: <svg viewBox="0 0 24 24" aria-hidden><path d="M6 8h12a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1z" /><path d="M9 8V6a3 3 0 0 1 6 0v2M9 13h6M12 13v3" /></svg>,
  compass: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>,
  shield: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></svg>,
  image: <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>,
  upload: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 15V4M7 9l5-5 5 5M5 20h14" /></svg>,
  info: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>,
};

export function TrendIcon({ trend }: { trend: "rising" | "falling" | "steady" }) {
  return trend === "rising" ? Icon.up : trend === "falling" ? Icon.down : Icon.flat;
}

// ---------------------------------------------------------------- full station report (GET /api/stations/{id})

export type ModelMetrics = { mae: number; rmse: number; bias: number; n: number };

export type HorizonDiagnostics = {
  horizon_h: number;
  valid_at: string;
  selected_model: string;
  point_m: number;
  lo80_m: number;
  hi80_m: number;
  lo95_m: number;
  hi95_m: number;
  interval_regime: string;
  test_metrics: Record<string, ModelMetrics>;
  skill_vs_persistence: Record<string, number>;
  interval_coverage_test: { p80: number; p95: number };
};

export type BacktestPoint = { valid_at: string; actual_m: number; predicted_m: number; persistence_m: number; lo80_m: number; hi80_m: number };

export type FullReport = {
  station: Station["station"];
  forecast: {
    status: string;
    message?: string;
    origin?: string;
    ml_available?: boolean;
    models?: { name: string; label: string }[];
    split?: { train_start: string; calibration_start: string; test_start: string; test_end: string; method: string };
    horizons?: HorizonDiagnostics[];
    backtests?: Record<string, BacktestPoint[]>;
    notes?: string[];
    preprocessing?: Record<string, number>;
    last_observation_at?: string;
  };
  weather: {
    source: string;
    fetched_at: string;
    stale: boolean;
    hourly: { time: string; is_forecast: boolean; precipitation_mm: number | null; precipitation_probability: number | null; temperature_c: number | null }[];
    summary: Record<string, number>;
  } | null;
  freshness: { last_observation_at: string | null; age_hours: number | null; data_kind: string };
  provenance: { dataset_id: number; name: string; source_type: string; is_simulated: boolean; readings: number; first: string; last: string }[];
};

/** Download rows as a CSV file built in the browser. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export function formatUtc(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
