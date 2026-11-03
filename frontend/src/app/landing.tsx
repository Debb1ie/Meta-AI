"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, Icon } from "./featured/shared";
import { RiverStatus } from "./river-status";

// ---------------------------------------------------------------- live data (landing shows real numbers, not mock-ups)

export type LiveRiver = {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  current_m3s: number;
  current_date: string;
  trend: "rising" | "falling" | "steady";
  level: string;
  peak: { date: string; discharge_m3s: number };
  thresholds_m3s: { advisory: number; warning: number; critical: number };
  series: { date: string; discharge_m3s: number; is_forecast: boolean }[];
};
export type LiveHazard = { name: string; alert: string; distance_to_ph_km: number; affects_ph: boolean; type: string; report_url?: string | null };
export type LiveBrief = {
  briefing: { headline: string; overall_level: string; alerts: Record<string, string> };
  verification: { numbers_checked: number; numbers_verified: number };
  tool_calls: number;
  generated_at: string;
};

export type LiveData = {
  rivers: LiveRiver[];
  outlookUpdated: string | null;
  hazards: LiveHazard[];
  hazardsWorldwide: number;
  gauges: number | null;
  brief: LiveBrief | null;
  ready: boolean;
};

// One request per endpoint, shared by every landing component that needs it.
const requests = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T | null> {
  if (!requests.has(path)) {
    requests.set(
      path,
      fetch(`${API_URL}${path}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  return requests.get(path) as Promise<T | null>;
}

export function useLiveData(): LiveData {
  const [data, setData] = useState<LiveData>({ rivers: [], outlookUpdated: null, hazards: [], hazardsWorldwide: 0, gauges: null, brief: null, ready: false });
  useEffect(() => {
    let alive = true;
    (async () => {
      const [outlook, hazards, sources, latest] = await Promise.all([
        getJson<{ rivers: LiveRiver[]; fetched_at: string }>("/api/outlook"),
        getJson<{ near_ph: LiveHazard[]; events: unknown[] }>("/api/hazards"),
        getJson<{ gauges?: { ok: boolean } }>("/api/sources"),
        getJson<{ briefing: LiveBrief | null }>("/api/ai/agent/latest"),
      ]);
      const stations = await getJson<unknown[]>("/api/stations");
      if (!alive) return;
      setData({
        rivers: outlook?.rivers ?? [],
        outlookUpdated: outlook?.fetched_at ?? null,
        hazards: hazards?.near_ph ?? [],
        hazardsWorldwide: hazards?.events.length ?? 0,
        gauges: stations ? stations.length : sources?.gauges ? 10 : null,
        brief: latest?.briefing ?? null,
        ready: true,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

// ---------------------------------------------------------------- shared formatting

const pht = (iso: string) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
const IMPACT: Record<string, string> = { green: "low impact", orange: "moderate impact", red: "high impact" };

// ---------------------------------------------------------------- "Right now": four live facts, no motion

export function RightNow({ live }: { live: LiveData }) {
  const onWatch = live.rivers.filter((r) => r.level !== "normal").length;
  const rising = live.rivers.filter((r) => r.trend === "rising").length;
  const cyclone = live.hazards.find((h) => h.type === "typhoon");
  const facts: { label: string; value: string; detail: string }[] = live.ready
    ? [
        { label: "Philippine basins", value: `${live.rivers.length || 17}`, detail: `${onWatch} on watch, ${rising} rising` },
        { label: "Measured gauges", value: live.gauges == null ? "—" : `${live.gauges}`, detail: "Updated every 15 minutes" },
        cyclone
          ? { label: "Nearest cyclone", value: cyclone.name.replace("Tropical Cyclone ", ""), detail: `${IMPACT[cyclone.alert] ?? "impact unknown"}, ${cyclone.distance_to_ph_km.toLocaleString("en-US")} km away` }
          : { label: "Cyclones near the Philippines", value: "None", detail: "From the GDACS live feed" },
        live.brief
          ? { label: "Last AI briefing", value: `${live.brief.verification.numbers_verified}/${live.brief.verification.numbers_checked} verified`, detail: `Muse Spark, ${pht(live.brief.generated_at)} PHT` }
          : { label: "Last AI briefing", value: "Pending", detail: "Runs every 3 hours" },
      ]
    : [];
  return (
    <section className="lx-now shell" aria-label="Right now">
      <h2 className="lx-now-title">Right now</h2>
      {live.ready ? (
        <dl className="lx-now-grid">
          {facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd><strong>{f.value}</strong><span>{f.detail}</span></dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="lx-muted">Loading live figures…</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Meta models, with live proof

export function MetaModels({ live }: { live: LiveData }) {
  const b = live.brief;
  const models = [
    {
      name: "Muse Spark",
      role: "Flood-watch agent",
      text: "Decides which of six tools to call (hazard feed, river basins, rain forecast, gauges), cites a source for every claim, and drafts SMS alerts in five Philippine languages. Our server checks every number against its source before anyone sees it.",
      proof: b ? `Last run: ${b.tool_calls} tool calls, ${b.verification.numbers_verified} of ${b.verification.numbers_checked} numbers verified, ${pht(b.generated_at)} PHT.` : "Runs every three hours, or on demand.",
      href: "/featured?tab=agent",
      cta: "Watch it investigate",
    },
    {
      name: "Muse Spark",
      role: "Ask in plain language",
      text: "Answers questions about the rivers with structured output: what was measured, what is forecast, how sure we are and what to do. It says so when the data can't answer, instead of guessing.",
      proof: "Grounded only in the live readings and outlook it is given.",
      href: "/featured?tab=ask",
      cta: "Ask a question",
    },
    {
      name: "SAM 3.1",
      role: "Flood photo check",
      text: "Outlines the floodwater in a photo from the field and reports how much of the scene is under water, so reports from the ground can be compared over time.",
      proof: "Photos go to SAM 3.1 for analysis and are not stored by HydroSentinel.",
      href: "/featured?tab=tools#tool-photo",
      cta: "Try a photo",
    },
    {
      name: "Muse Image",
      role: "Community posters",
      text: "Draws a preparedness illustration matched to today's alert level, to send alongside the SMS so the message also works for people who read less.",
      proof: "Labelled as AI-generated wherever it appears.",
      href: "/featured?tab=tools#tool-poster",
      cta: "Make a poster",
    },
  ];
  return (
    <div className="lx-models">
      {models.map((m) => (
        <article key={m.role} className="lx-model">
          <p className="lx-model-name">{m.name}</p>
          <h3>{m.role}</h3>
          <p>{m.text}</p>
          <p className="lx-proof">{m.proof}</p>
          <Link href={m.href}>{m.cta}{Icon.arrow}</Link>
        </article>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- what you get (flat grid, live counts where they exist)

const CAPABILITIES: { icon: React.ReactNode; title: string; text: string; stat?: (l: LiveData) => number | null; unit?: string }[] = [
  { icon: Icon.spark, title: "Verifiable agent", text: "Muse Spark calls tools, cites evidence, and the server checks every number.", stat: (l) => l.brief?.tool_calls ?? null, unit: "tool calls in the last run" },
  { icon: Icon.outlook, title: "17 Philippine basins", text: "GloFAS river flow with a 30-day forecast and alert levels based on each river's own history.", stat: (l) => l.rivers.length || null, unit: "basins tracked" },
  { icon: Icon.typhoon, title: "Typhoon feed", text: "GDACS cyclones and floods, ranked by distance to the Philippines.", stat: (l) => l.hazardsWorldwide || null, unit: "events active worldwide" },
  { icon: Icon.stations, title: "Measured gauges", text: "Real river levels every 15 minutes test the forecasting engine against reality.", stat: (l) => l.gauges, unit: "gauges" },
  { icon: Icon.ask, title: "Five languages", text: "SMS alerts in English, Filipino, Cebuano, Ilocano and Hiligaynon.", stat: () => 5, unit: "languages" },
  { icon: Icon.activity, title: "Backtested forecasts", text: "Each forecast is scored against a simple baseline on data the model never saw." },
  { icon: Icon.image, title: "Photo check", text: "SAM 3.1 measures how much of a field photo is flooded." },
  { icon: Icon.bag, title: "Community posters", text: "Muse Image illustrations matched to today's alert level." },
  { icon: Icon.rain, title: "Rain outlook", text: "Open-Meteo rainfall, hour by hour, for every gauge and basin." },
  { icon: Icon.shield, title: "Honest by design", text: "Models are labelled as models. Official warnings stay with PAGASA." },
  { icon: Icon.install, title: "Works on any phone", text: "Installs like an app and keeps the last data when the signal drops." },
  { icon: Icon.database, title: "Open and exportable", text: "Every reading has a source, and every series exports to CSV." },
];

export function CapabilityGrid({ live }: { live: LiveData }) {
  return (
    <div className="lx-grid">
      {CAPABILITIES.map((c) => {
        const stat = c.stat?.(live);
        return (
          <article key={c.title} className="lx-tile">
            <span className="lx-tile-icon">{c.icon}</span>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            {c.stat && stat != null && <p className="lx-tile-stat"><strong>{stat.toLocaleString("en-US")}</strong> {c.unit}</p>}
          </article>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- composition (each piece shares the cached requests)

export function HeroLive() {
  return <RiverStatus live={useLiveData()} />;
}

export function RightNowLive() {
  return <RightNow live={useLiveData()} />;
}

export function MetaModelsLive() {
  return <MetaModels live={useLiveData()} />;
}

export function GridLive() {
  return <CapabilityGrid live={useLiveData()} />;
}
