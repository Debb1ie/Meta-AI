"use client";

import { useEffect, useRef, useState } from "react";
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

// ---------------------------------------------------------------- motion helpers

/** Adds `is-in` to every [data-reveal] element as it scrolls into view. */
export function RevealOnScroll() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))),
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

export function CountUp({ value, digits = 0, suffix = "" }: { value: number | null | undefined; digits?: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (value == null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    let raf = 0;
    let start = 0;
    const run = () => {
      const step = (t: number) => {
        start ||= t;
        const k = Math.min(1, (t - start) / 1100);
        setShown(value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      run();
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        run();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return <span ref={ref}>{value == null ? "—" : `${shown.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}${suffix}`}</span>;
}

// ---------------------------------------------------------------- live ticker

export function LiveTicker({ live }: { live: LiveData }) {
  const items: { icon: React.ReactNode; text: string }[] = [];
  live.rivers.slice(0, 6).forEach((r) =>
    items.push({ icon: r.trend === "rising" ? Icon.up : r.trend === "falling" ? Icon.down : Icon.flat, text: `${r.name} ${Math.round(r.current_m3s).toLocaleString()} m³/s` }),
  );
  live.hazards.slice(0, 3).forEach((h) => items.push({ icon: Icon.typhoon, text: `${h.name} · ${h.alert}` }));
  if (live.brief) items.push({ icon: Icon.shield, text: `Agent: ${live.brief.briefing.headline}` });
  if (!items.length) {
    ["Live gauges every 15 minutes", "17 Philippine basins", "GDACS typhoon feed", "Muse Spark agent", "Alerts in 5 languages"].forEach((t) => items.push({ icon: Icon.spark, text: t }));
  }
  const row = (
    <div className="lp-ticker-row" aria-hidden>
      {items.map((it, i) => <span key={i}>{it.icon}{it.text}</span>)}
    </div>
  );
  return (
    <div className="lp-ticker" role="marquee" aria-label="Live river and hazard updates">
      <span className="lp-ticker-tag"><i />LIVE</span>
      <div className="lp-ticker-track">{row}{row}</div>
    </div>
  );
}

// ---------------------------------------------------------------- 3D scroll grid

const CAPABILITIES: { icon: React.ReactNode; title: string; text: string; stat?: (l: LiveData) => number | null; unit?: string }[] = [
  { icon: Icon.spark, title: "Verifiable agent", text: "Muse Spark calls tools, cites evidence, and the server checks every number.", stat: (l) => l.brief?.tool_calls ?? null, unit: "tool calls" },
  { icon: Icon.outlook, title: "17 PH basins", text: "GloFAS river flow with a 30-day forecast and per-river alert levels.", stat: (l) => l.rivers.length || null, unit: "basins live" },
  { icon: Icon.typhoon, title: "Typhoon feed", text: "GDACS cyclones and floods ranked by distance to the Philippines.", stat: (l) => l.hazardsWorldwide || null, unit: "active worldwide" },
  { icon: Icon.stations, title: "Measured gauges", text: "Real river levels every 15 minutes power the forecasting engine.", stat: (l) => l.gauges, unit: "gauges" },
  { icon: Icon.ask, title: "Five languages", text: "SMS alerts in English, Filipino, Cebuano, Ilocano and Hiligaynon.", stat: () => 5, unit: "languages" },
  { icon: Icon.activity, title: "Backtested", text: "Out-of-sample skill vs persistence and interval coverage, per horizon." },
  { icon: Icon.image, title: "SAM 3.1 photos", text: "Field photos segmented to measure how much of a scene is flooded." },
  { icon: Icon.bag, title: "Muse Image", text: "Community posters matched to today's alert level." },
  { icon: Icon.rain, title: "Rain outlook", text: "Open-Meteo rainfall, hourly, for every gauge and basin." },
  { icon: Icon.shield, title: "Honest by design", text: "Models are labelled as models. Official warnings stay with PAGASA." },
  { icon: Icon.install, title: "Installable app", text: "Works on phone, tablet and desktop, and offline with the last data." },
  { icon: Icon.database, title: "Open & exportable", text: "Provenance for every reading, CSV export for every series." },
];

export function ScrollGrid3D({ live }: { live: LiveData }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--p", "1");
      return;
    }
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      // 0 when the section's top meets the bottom of the screen, 1 once it reaches 35% from the top.
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.65)));
      el.style.setProperty("--p", p.toFixed(3));
      raf = 0;
    };
    const onScroll = () => (raf ||= requestAnimationFrame(update));
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="lp-grid-section" ref={ref} id="inside">
      <div className="lp-grid-sticky">
        <div className="shell lp-grid-head">
          <div className="section-kicker">What you get</div>
          <h2>Twelve systems.<br /><em>One calm screen.</em></h2>
        </div>
        <div className="lp-grid-stage">
          <div className="lp-grid">
            {CAPABILITIES.map((c, i) => {
              const stat = c.stat?.(live);
              return (
                <article key={c.title} className="lp-tile" style={{ "--i": i, "--row": Math.floor(i / 4), "--col": i % 4 } as React.CSSProperties}>
                  <span className="lp-tile-icon">{c.icon}</span>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                  {c.stat && (
                    <div className="lp-tile-stat"><b><CountUp value={stat ?? null} /></b><small>{c.unit}</small></div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- composition (each piece shares the cached requests)

export function HeroLive() {
  return <RiverStatus live={useLiveData()} />;
}

export function TickerLive() {
  return <LiveTicker live={useLiveData()} />;
}

export function GridLive() {
  return <ScrollGrid3D live={useLiveData()} />;
}
