"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentCard, AgentView, useAgent } from "./agent";
import { AskView } from "./ask";
import { StationTechnical } from "./diagnostics";
import { OutlookPanel, OutlookView, hazardPoints, outlookPoints } from "./outlook";
import { ShortcutList } from "./system";
import { LayersView } from "./layers";
import { ToolsView } from "./tools";
import { AnalyticsView } from "./analytics";
import {
  API_URL, AiStatus, Hazards, Icon, LEVEL_INFO, Outlook, Overview, SourceStatus, Sparkline, Station, Thresholds,
  api, formatNumber, levelOf, postJson, timeAgo,
} from "./shared";

const RiverMap = dynamic(() => import("./map"), { ssr: false, loading: () => <div className="ios-map ios-skeleton" style={{ height: 280 }} /> });

type Tab = "today" | "agent" | "stations" | "outlook" | "layers" | "analytics" | "ask" | "tools";
type Theme = "system" | "light" | "dark";
type Trend = "rising" | "falling" | "steady";

const TABS: Tab[] = ["today", "agent", "stations", "outlook", "layers", "analytics", "ask", "tools"];
const TITLES: Record<Tab, string> = { today: "Today", agent: "Agent", stations: "Live gauges", outlook: "PH Outlook", layers: "3D layers", analytics: "Analytics", ask: "Ask", tools: "Tools" };
// Bottom tab bar on phones: sections need short labels.
const SHORT: Record<Tab, string> = { today: "Today", agent: "Agent", stations: "Gauges", outlook: "Outlook", layers: "3D", analytics: "Analytics", ask: "Ask", tools: "Tools" };
const KICKERS: Record<Tab, string> = {
  today: "Live overview",
  agent: "Muse Spark agent with verified answers",
  stations: "Measured every 15 minutes",
  outlook: "Philippines, GloFAS model",
  layers: "Terrain, rain and river flow, stacked",
  analytics: "Forecast performance and data quality",
  ask: "Analyst",
  tools: "Toolkit & system",
};
const LEVELS = ["normal", "advisory", "warning", "critical"];
const TIP_KEY = "hs-tip-dismissed";
const THEME_KEY = "hs-theme";
const DESKTOP_QUERY = "(min-width: 900px)";

function headlineForecast(item: Station) {
  return item.forecast?.["24"] ?? Object.values(item.forecast ?? {})[0];
}

function stationTrend(item: Station): Trend {
  const s = item.slope_m_per_h ?? 0;
  return s > 0.002 ? "rising" : s < -0.002 ? "falling" : "steady";
}

const TREND_ICON: Record<Trend, React.ReactNode> = { rising: Icon.up, falling: Icon.down, steady: Icon.flat };
const TREND_LABEL: Record<Trend, string> = { rising: "Rising", falling: "Falling", steady: "Steady" };

function greeting(date: Date) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function useMedia(query: string, initial: boolean) {
  const [matches, setMatches] = useState(initial);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export default function Featured() {
  const isDesktop = useMedia(DESKTOP_QUERY, true);
  const prefersDark = useMedia("(prefers-color-scheme: dark)", false);
  const online = useOnline();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [theme, setTheme] = useState<Theme>("system");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [askContext, setAskContext] = useState<string | null>(null);
  const [askPrefill, setAskPrefill] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [tipVisible, setTipVisible] = useState(false);
  const [outlook, setOutlook] = useState<Outlook | null>(null);
  const [outlookError, setOutlookError] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceStatus>({});
  const [riverId, setRiverId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [hazards, setHazards] = useState<Hazards | null>(null);
  const agent = useAgent();
  const dark = theme === "dark" || (theme === "system" && prefersDark);

  const load = useCallback(() => {
    setLoading(true);
    api<Overview>("/api/overview")
      .then((data) => {
        setOverview(data);
        setOffline(false);
        setUpdatedAt(new Date());
      })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
    api<Outlook>("/api/outlook")
      .then((data) => { setOutlook(data); setOutlookError(null); })
      .catch((err: Error) => setOutlookError(err.message));
    api<SourceStatus>("/api/sources").then(setSources).catch(() => setSources({}));
    api<Hazards>("/api/hazards").then(setHazards).catch(() => {});
    api<AiStatus>("/api/ai/status").then(setAiStatus).catch(() => setAiStatus(null));
  }, []);

  useEffect(() => {
    load();
    setNow(new Date());
    setTipVisible(readStorage(TIP_KEY) !== "1");
    const saved = readStorage(THEME_KEY);
    if (saved === "light" || saved === "dark") setTheme(saved);
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && (TABS as string[]).includes(requested)) setTab(requested as Tab);
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    }
    // The backend refreshes sources every 15 min; poll a little faster so new data shows promptly.
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Theme the document too, so the page scrollbar and overscroll area match the app.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.app = "dashboard";
    root.dataset.theme = dark ? "dark" : "light";
    return () => {
      delete root.dataset.app;
      delete root.dataset.theme;
    };
  }, [dark]);

  const stations = useMemo(
    () => [...(overview?.stations ?? [])].sort((a, b) => (b.risk?.rank ?? 0) - (a.risk?.rank ?? 0)),
    [overview],
  );
  const attention = stations.filter((s) => levelOf(s) !== "normal");
  const riversOnWatch = (outlook?.rivers ?? []).filter((r) => r.level !== "normal");
  const selected = stations.find((s) => s.station.id === selectedId) ?? null;

  // On desktop the detail pane is always visible, so default it to the most urgent station.
  useEffect(() => {
    if (isDesktop && !selectedId && stations.length) setSelectedId(stations[0].station.id);
  }, [isDesktop, selectedId, stations]);

  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "today" ? window.location.pathname : `?tab=${next}`);
    window.scrollTo({ top: 0 });
  }, []);

  const chooseTheme = useCallback((next: Theme) => {
    setTheme(next);
    writeStorage(THEME_KEY, next);
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "system" ? "light" : t === "light" ? "dark" : "system";
      writeStorage(THEME_KEY, next);
      return next;
    });
  }, []);

  // Keyboard shortcuts (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key >= "1" && e.key <= "8") switchTab(TABS[Number(e.key) - 1]);
      else if (e.key === "r" || e.key === "R") load();
      else if (e.key === "t" || e.key === "T") cycleTheme();
      else if (e.key === "?") setShowShortcuts((v) => !v);
      else if (e.key === "Escape") setShowShortcuts(false);
      else if (e.key === "/") {
        e.preventDefault();
        switchTab("stations");
        window.setTimeout(() => document.querySelector<HTMLInputElement>(".ios-search input")?.focus(), 50);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [switchTab, load, cycleTheme]);

  const openStation = (id: string) => {
    setSelectedId(id);
    if (isDesktop) switchTab("stations");
    else setSheetOpen(true);
  };

  const askAbout = (id: string) => {
    setSheetOpen(false);
    setAskContext(id);
    setAskPrefill(null);
    switchTab("ask");
  };

  const askQuestion = (question: string) => {
    setAskContext(null);
    setAskPrefill(question);
    switchTab("ask");
  };

  const selectRiver = (id: string) => {
    setRiverId(id);
    // On narrow screens the detail sits below the list; bring it into view.
    if (!isDesktop) window.setTimeout(() => document.getElementById("ios-detail")?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const goTo = (next: Tab, anchor?: string) => {
    switchTab(next);
    if (anchor) window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  const openRiver = (id: string) => {
    switchTab("outlook");
    selectRiver(id);
  };

  const dismissTip = () => {
    setTipVisible(false);
    writeStorage(TIP_KEY, "1");
  };

  const gaugeSource = sources.gauges;
  const outlookSource = sources.outlook;
  const gaugeLabel = offline
    ? "Backend offline"
    : gaugeSource
      ? `Gauges synced ${timeAgo(gaugeSource.last_sync)}`
      : updatedAt ? "Gauges: first sync running" : "Connecting…";
  const outlookLabel = `PH outlook ${outlookError ? "unavailable" : outlookSource ? `updated ${timeAgo(outlookSource.last_sync)}` : outlook ? "ready" : "loading…"}`;
  const aiLabel = `Muse Spark ${aiStatus?.configured ? "connected" : "not connected"}`;

  const headings: Record<Tab, React.ReactNode> = {
    today: <>Today&apos;s flood <em>watch.</em></>,
    agent: <>Flood-watch <em>agent.</em></>,
    stations: <>Live river <em>gauges.</em></>,
    outlook: <>Philippine river <em>outlook.</em></>,
    layers: <>Flood risk in <em>layers.</em></>,
    analytics: <>Performance <em>analytics.</em></>,
    ask: <>Ask <em>Muse Spark.</em></>,
    tools: <>Field <em>tools.</em></>,
  };

  const subtitles: Record<Tab, string> = {
    today: now ? `${greeting(now)} · ${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · Here's what needs attention first.` : "",
    agent: "Investigates live data with tools, cites every claim, verifies its own numbers, and drafts alerts in five Philippine languages",
    stations: `${stations.length} gauges · UK Environment Agency real-time levels · sorted by urgency`,
    outlook: `${outlook?.rivers.length ?? 17} major basins · daily modelled river flow · 30-day forecast`,
    layers: "Five live map layers over the Philippines, from terrain up to a combined flood-watch index. Orbit, peel layers apart and hover any point to read its value",
    analytics: "Held-out forecast skill, interval coverage, model selection and gauge evaluation results",
    ask: "Plain-language answers from Muse Spark, grounded in live readings and the PH outlook",
    tools: "Pipeline status, field photos, community illustrations and your own data",
  };

  return (
    <div className="ios" data-theme={theme === "system" ? undefined : theme}>
      <aside className="ios-sidebar">
        <Link className="ios-brand" href="/" title="HydroSentinel home">
          <span className="brand-mark">H</span>
          <span>Hydro<b>Sentinel</b><small>Command center</small></span>
        </Link>
        <nav aria-label="Sections">
          {TABS.map((t, i) => (
            <button key={t} className={tab === t ? "is-active" : ""} onClick={() => switchTab(t)} aria-current={tab === t ? "page" : undefined} title={`${TITLES[t]} (${i + 1})`}>
              {Icon[t]}
              <span>{TITLES[t]}</span>
              {t === "stations" && attention.length > 0 && <i className="ios-count">{attention.length}</i>}
              {t === "outlook" && riversOnWatch.length > 0 && <i className="ios-count">{riversOnWatch.length}</i>}
            </button>
          ))}
        </nav>
        <div className="ios-sidebar-foot">
          <span className={`ios-status ${offline || (gaugeSource && !gaugeSource.ok) ? "is-off" : ""}`} title={gaugeLabel}><i /><span>{gaugeLabel}</span></span>
          <span className={`ios-status ${outlookError ? "is-off" : outlook?.stale ? "is-warn" : ""}`} title={outlookLabel}><i /><span>{outlookLabel}</span></span>
          <span className={`ios-status ${aiStatus?.configured ? "" : "is-warn"}`} title={aiLabel}><i /><span>{aiLabel}</span></span>
          <button className="ios-shortcut-hint" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)">
            {Icon.keyboard}<span>Shortcuts</span><kbd>?</kbd>
          </button>
          <ThemePicker theme={theme} onChange={chooseTheme} />
          <button className="ios-btn ios-rail-theme" onClick={cycleTheme} aria-label={`Appearance: ${theme}`} title="Appearance (T)">
            {theme === "light" ? Icon.sun : theme === "dark" ? Icon.moon : Icon.auto}
          </button>
          <Link href="/research" className="ios-shortcut-hint" title="Forecasting method, parameters and live skill scores">{Icon.map}<span>Research &amp; methodology</span></Link>
          <Link href="/" className="ios-home-btn" title="Back to home">{Icon.back}<span>Back to home</span></Link>
        </div>
      </aside>

      <div className="ios-main">
        <header className="ios-topbar">
          <div>
            <div className="ios-kicker"><span className="pulse-dot" />{KICKERS[tab]}</div>
            <h1>{headings[tab]}</h1>
            <p>{subtitles[tab]}</p>
          </div>
          <div className="ios-topbar-actions">
            <Link href="/" className="ios-btn ios-mobile-home" aria-label="Back to home">{Icon.home}</Link>
            <button className="ios-btn ios-theme-cycle" onClick={cycleTheme} aria-label={`Appearance: ${theme}`}>
              {theme === "light" ? Icon.sun : theme === "dark" ? Icon.moon : Icon.auto}
            </button>
            <button className={`ios-btn ${loading ? "is-spinning" : ""}`} onClick={load} disabled={loading} title="Refresh (R)">
              {Icon.refresh}<span>Refresh</span>
            </button>
          </div>
        </header>

        {!online && (
          <div className="ios-banner ios-with-icon">{Icon.offline}You&apos;re offline. Showing the last data saved on this device.</div>
        )}
        {overview?.any_simulated && tab !== "ask" && (
          <div className="ios-banner ios-with-icon">{Icon.info}Demo stations are loaded alongside live data. Their readings are simulated.</div>
        )}

        <main className="ios-content" key={tab}>
          {tab === "today" && (
            <TodayView
              overview={overview}
              loading={loading}
              offline={offline}
              stations={stations}
              attention={attention}
              outlook={outlook}
              riversOnWatch={riversOnWatch.length}
              sources={sources}
              dark={dark}
              hazards={hazards}
              agent={agent}
              onOpenAgent={() => switchTab("agent")}
              onGo={goTo}
              onOpenRiver={openRiver}
              tipVisible={tipVisible}
              onDismissTip={dismissTip}
              onOpenStation={openStation}
              onShowStations={() => { setFilter("attention"); switchTab("stations"); }}
              onShowTools={() => switchTab("tools")}
              onAsk={() => switchTab("ask")}
              onRetry={load}
            />
          )}
          {tab === "stations" && (
            <StationsView
              stations={stations}
              loading={loading}
              offline={offline}
              dark={dark}
              query={query}
              setQuery={setQuery}
              filter={filter}
              setFilter={setFilter}
              selectedId={isDesktop ? selectedId : null}
              selected={isDesktop ? selected : null}
              onOpenStation={openStation}
              onAsk={askAbout}
              onChanged={load}
            />
          )}
          {tab === "outlook" && (
            <OutlookView outlook={outlook} error={outlookError} selectedId={riverId} dark={dark} hazards={hazards} onSelect={selectRiver} onAsk={askQuestion} />
          )}
          {tab === "layers" && <LayersView outlook={outlook} error={outlookError} />}
          {tab === "analytics" && <AnalyticsView />}
          {tab === "agent" && <AgentView agent={agent} configured={aiStatus?.configured} />}
          {tab === "ask" && (
            <AskView stations={stations} aiStatus={aiStatus} contextId={askContext} setContextId={setAskContext} prefill={askPrefill} />
          )}
          {tab === "tools" && <ToolsView aiStatus={aiStatus} sources={sources} onDataChanged={load} />}
        </main>
      </div>

      <nav className="ios-tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "is-active" : ""} onClick={() => switchTab(t)}>
            <span className="ios-tab-icon">
              {Icon[t]}
              {t === "stations" && attention.length > 0 && <i className="ios-badge">{attention.length}</i>}
              {t === "outlook" && riversOnWatch.length > 0 && <i className="ios-badge">{riversOnWatch.length}</i>}
            </span>
            {SHORT[t]}
          </button>
        ))}
      </nav>

      {!isDesktop && <StationSheet station={sheetOpen ? selected : null} onClose={() => setSheetOpen(false)} onAsk={askAbout} onChanged={load} />}

      {showShortcuts && (
        <div className="ios-modal-layer" onClick={() => setShowShortcuts(false)}>
          <div className="ios-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
            <div className="ios-panel-head ios-panel-head-tight">
              <strong className="ios-with-icon">{Icon.keyboard}Keyboard shortcuts</strong>
              <button className="ios-close" onClick={() => setShowShortcuts(false)} aria-label="Close">{Icon.close}</button>
            </div>
            <ShortcutList />
          </div>
        </div>
      )}
    </div>
  );
}

function ThemePicker({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const options: { id: Theme; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "system", label: "Auto" },
    { id: "dark", label: "Dark" },
  ];
  const index = options.findIndex((o) => o.id === theme);
  return (
    <div className="ios-segmented ios-theme-picker" role="radiogroup" aria-label="Appearance">
      <span className="ios-seg-thumb" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden />
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={theme === o.id} onClick={() => onChange(o.id)} title={o.label}>
          {o.id === "light" ? Icon.sun : o.id === "dark" ? Icon.moon : Icon.auto}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Stacked bar of how many gauges and basins sit at each level. */
function LevelMix({ stations, outlook }: { stations: Station[]; outlook: Outlook | null }) {
  const counts = LEVELS.map((lvl) => ({
    lvl,
    gauges: stations.filter((s) => levelOf(s) === lvl).length,
    rivers: (outlook?.rivers ?? []).filter((r) => r.level === lvl).length,
  }));
  const total = counts.reduce((s, c) => s + c.gauges + c.rivers, 0);
  return (
    <div className="ios-card">
      <span className="ios-card-label">Risk mix across {total} rivers</span>
      <div className="ios-stack" aria-hidden>
        {counts.map((c) => (c.gauges + c.rivers > 0 ? <i key={c.lvl} className={`lvl-${c.lvl}`} style={{ flex: c.gauges + c.rivers }} /> : null))}
      </div>
      {counts.map((c) => (
        <div className="ios-threshold" key={c.lvl}>
          <span><i className={`ios-dot lvl-${c.lvl}`} />{LEVEL_INFO[c.lvl].word}</span>
          <small className="ios-muted">{c.gauges} gauges · {c.rivers} PH basins</small>
          <strong>{c.gauges + c.rivers}</strong>
        </div>
      ))}
    </div>
  );
}

const FEATURES: { tab: Tab; anchor?: string; icon: React.ReactNode; title: string; text: string; tag: string }[] = [
  { tab: "agent", icon: Icon.agent, title: "Flood-watch agent", text: "Watch Muse Spark investigate, cite evidence and verify its numbers.", tag: "Muse Spark" },
  { tab: "outlook", icon: Icon.outlook, title: "Philippine outlook", text: "17 basins on a map with 30-day flow forecasts and alert levels.", tag: "GloFAS" },
  { tab: "layers", icon: Icon.layers, title: "3D flood layers", text: "Terrain, rainfall and river flow stacked over the Philippines.", tag: "3D" },
  { tab: "stations", icon: Icon.stations, title: "Live gauges", text: "Measured levels, forecasts, backtests and model diagnostics.", tag: "Every 15 min" },
  { tab: "ask", icon: Icon.ask, title: "Ask Muse Spark", text: "Plain-language answers grounded in the live data.", tag: "Chat" },
  { tab: "tools", anchor: "tool-photo", icon: Icon.image, title: "Flood photo check", text: "Upload a field photo; SAM 3.1 outlines the floodwater.", tag: "SAM 3.1" },
  { tab: "tools", anchor: "tool-poster", icon: Icon.bag, title: "Community posters", text: "Generate preparedness illustrations to share.", tag: "Muse Image" },
  { tab: "tools", anchor: "tool-import", icon: Icon.upload, title: "Import your data", text: "Bring CSV gauge readings; every row is validated.", tag: "Admin" },
  { tab: "tools", anchor: "tool-system", icon: Icon.server, title: "System & security", text: "Pipeline health, sync, API latency and admin access.", tag: "Ops" },
];

const RESEARCH_CARD = { href: "/research", icon: Icon.map, title: "Research & method", text: "How the forecasts are built and scored, with live skill scores.", tag: "Research" };

/** One card per feature, so nothing has to be discovered by scrolling. */
function FeatureHub({ onGo }: { onGo: (tab: Tab, anchor?: string) => void }) {
  return (
    <section className="ios-hub" aria-label="Everything in HydroSentinel">
      <div className="ios-panel-head">
        <strong>Everything in HydroSentinel</strong>
        <small className="ios-muted">Tap any card to open it · keys 1–7 switch sections</small>
      </div>
      <div className="ios-hub-grid">
        {FEATURES.map((f) => (
          <button key={f.title} className="ios-hub-card" onClick={() => onGo(f.tab, f.anchor)}>
            <span className="ios-hub-icon">{f.icon}</span>
            <span className="ios-hub-text">
              <b>{f.title}</b>
              <small>{f.text}</small>
            </span>
            <span className="ios-hub-tag">{f.tag}</span>
          </button>
        ))}
        <Link className="ios-hub-card" href={RESEARCH_CARD.href}>
          <span className="ios-hub-icon">{RESEARCH_CARD.icon}</span>
          <span className="ios-hub-text">
            <b>{RESEARCH_CARD.title}</b>
            <small>{RESEARCH_CARD.text}</small>
          </span>
          <span className="ios-hub-tag">{RESEARCH_CARD.tag}</span>
        </Link>
      </div>
    </section>
  );
}

/** Live typhoons and floods near the Philippines (GDACS). */
function HazardsCard({ hazards }: { hazards: Hazards | null }) {
  const near = hazards?.near_ph ?? [];
  return (
    <div className="ios-card ios-hazards">
      <span className="ios-card-label ios-with-icon">{Icon.typhoon}Live hazards from GDACS</span>
      {!hazards && <p className="ios-muted ios-small">Loading disaster feeds…</p>}
      {hazards && near.length === 0 && <p className="ios-muted ios-small">No active typhoons or floods near the Philippines.</p>}
      {near.slice(0, 4).map((h) => (
        <a key={h.id} className="ios-hazard" href={h.report_url ?? "https://www.gdacs.org"} target="_blank" rel="noreferrer">
          <i className={`is-${h.alert}`}>{h.type === "typhoon" ? Icon.typhoon : Icon.rain}</i>
          <span>
            <b>{h.name}</b>
            <small>{h.alert.toUpperCase()} · {h.affects_ph ? "affects PH" : `${h.distance_to_ph_km.toLocaleString()} km away`}{h.severity ? ` · ${h.severity}` : ""}</small>
          </span>
        </a>
      ))}
      {hazards && <small className="ios-muted">{hazards.events.length} active worldwide · updated {timeAgo(hazards.fetched_at)}</small>}
    </div>
  );
}

function PipelineCard({ sources, onOpen }: { sources: SourceStatus; onOpen: () => void }) {
  const rows = Object.entries(sources);
  return (
    <button className="ios-card ios-pipeline" onClick={onOpen}>
      <span className="ios-card-label ios-with-icon">{Icon.server}Data pipeline</span>
      {rows.length === 0 && <p className="ios-muted ios-small">First sync in progress…</p>}
      {rows.map(([k, s]) => (
        <span key={k} className="ios-pipe-row">
          <i className={s.ok ? "is-ok" : "is-bad"} />
          <span><b>{s.name}</b><small>Synced {timeAgo(s.last_sync)}{s.rows_imported != null ? ` · ${s.rows_imported.toLocaleString()} new rows` : ""}</small></span>
        </span>
      ))}
      <span className="ios-link">System status {Icon.chevron}</span>
    </button>
  );
}

function TodayView(props: {
  overview: Overview | null;
  loading: boolean;
  offline: boolean;
  stations: Station[];
  attention: Station[];
  outlook: Outlook | null;
  riversOnWatch: number;
  sources: SourceStatus;
  dark: boolean;
  hazards: Hazards | null;
  agent: ReturnType<typeof useAgent>;
  onOpenAgent: () => void;
  onGo: (tab: Tab, anchor?: string) => void;
  onOpenRiver: (id: string) => void;
  tipVisible: boolean;
  onDismissTip: () => void;
  onOpenStation: (id: string) => void;
  onShowStations: () => void;
  onShowTools: () => void;
  onAsk: () => void;
  onRetry: () => void;
}) {
  const { overview, loading, offline, attention, outlook, riversOnWatch } = props;
  const highest = overview?.highest_risk;
  const topRiver = outlook?.rivers[0];
  const levelRank = (l: string | undefined) => LEVELS.indexOf(l ?? "normal");
  const topLevel = levelRank(topRiver?.level) > levelRank(highest?.level) ? topRiver!.level : highest?.level ?? "normal";
  const total = attention.length + riversOnWatch;
  const waiting = loading && !overview;
  const risingRivers = (outlook?.rivers ?? []).filter((r) => r.trend === "rising").length;

  let heroTitle = "Checking your rivers…";
  let heroText = "This only takes a moment.";
  if (offline) {
    heroTitle = "Can't reach the server";
    heroText = `Start the FastAPI backend at ${API_URL}, then try again.`;
  } else if (overview) {
    heroTitle = total === 0 ? "All rivers are calm" : `${total} ${total === 1 ? "river needs" : "rivers need"} attention`;
    heroText = total === 0
      ? `${overview.station_count} live gauges and ${outlook?.rivers.length ?? 0} Philippine basins are within normal range.`
      : LEVEL_INFO[topLevel]?.hint ?? "";
  }

  return (
    <div className="ios-today">
      <section className={`ios-hero lvl-${offline ? "offline" : overview ? topLevel : "loading"}`}>
        <svg className="ios-hero-waves is-back" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden><path d="M0 30 C 100 10, 200 50, 300 30 S 500 10, 600 30 S 800 50, 900 30 S 1100 10, 1200 30 V 80 H 0 Z" /></svg>
        <svg className="ios-hero-waves" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden><path d="M0 30 C 100 10, 200 50, 300 30 S 500 10, 600 30 S 800 50, 900 30 S 1100 10, 1200 30 V 80 H 0 Z" /></svg>
        <div className="ios-hero-icon" aria-hidden>{offline ? Icon.offline : total ? Icon.alert : Icon.check}</div>
        <div className="ios-hero-text">
          <h2>{heroTitle}</h2>
          <p>{heroText}</p>
        </div>
        {offline ? (
          <button className="ios-pill-btn" onClick={props.onRetry}>Try again {Icon.refresh}</button>
        ) : attention.length > 0 ? (
          <button className="ios-pill-btn" onClick={props.onShowStations}>Review gauges {Icon.arrow}</button>
        ) : riversOnWatch > 0 && topRiver ? (
          <button className="ios-pill-btn" onClick={() => props.onOpenRiver(topRiver.id)}>See PH outlook {Icon.arrow}</button>
        ) : null}
      </section>

      <AgentCard agent={props.agent} onOpen={props.onOpenAgent} />

      <FeatureHub onGo={props.onGo} />

      <section className="ios-tiles">
        <Tile icon={Icon.stations} label="Live gauges" value={overview?.station_count} unit="" note="measured every 15 min" loading={waiting} />
        <Tile icon={Icon.up} label="Gauges rising" value={overview?.rising_count} unit="" note="water going up now" loading={waiting} emphasis={!!overview?.rising_count} />
        <Tile icon={Icon.outlook} label="PH basins" value={outlook?.rivers.length} unit="" note={`${risingRivers} rising this week`} loading={!outlook && !offline} />
        <Tile icon={Icon.alert} label="PH on watch" value={outlook ? riversOnWatch : null} unit={outlook ? `/${outlook.rivers.length}` : ""} note="GloFAS 7-day outlook" loading={!outlook && !offline} emphasis={riversOnWatch > 0} />
        <Tile icon={Icon.rain} label="Rain, past 24h" value={overview?.observed_rain_last_24h_max_mm} digits={1} unit="mm" note="wettest gauge" loading={waiting} />
        <Tile icon={Icon.rain} label="Rain, next 24h" value={overview?.forecast_rain_next_24h_max_mm} digits={1} unit="mm" note="wettest gauge forecast" loading={waiting} />
      </section>

      <div className="ios-today-grid">
        <div className="ios-main-col">
          <section className="ios-panel">
            <div className="ios-panel-head">
              <strong>Philippine river outlook <small className="ios-tag">Model</small></strong>
              <button className="ios-link" onClick={() => topRiver && props.onOpenRiver(topRiver.id)}>Open {Icon.chevron}</button>
            </div>
            {outlook ? (
              <>
                <div className="ios-card ios-map-card">
                  <RiverMap points={outlookPoints(outlook)} hazards={hazardPoints(props.hazards)} onSelect={props.onOpenRiver} dark={props.dark} height={280} />
                </div>
                <OutlookPanel outlook={{ ...outlook, rivers: outlook.rivers.slice(0, 6) }} onOpen={props.onOpenRiver} />
              </>
            ) : (
              <div className="ios-list"><div className="ios-empty">{offline ? "Unavailable while the backend is offline." : "Loading outlook…"}</div></div>
            )}
          </section>
          <section className="ios-panel">
            <div className="ios-panel-head">
              <strong>Live gauges <small className="ios-tag is-live">Measured</small></strong>
              <button className="ios-link" onClick={props.onShowStations}>See all {Icon.chevron}</button>
            </div>
            <StationRows stations={props.stations.slice(0, 6)} loading={waiting} offline={offline} onOpen={props.onOpenStation} />
          </section>
          <p className="ios-credits">
            Data: river levels &copy; Environment Agency (Open Government Licence v3) · Philippine river flow: Copernicus GloFAS via{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0) · Rainfall: Open-Meteo · Basemap &copy;
            Esri, OpenStreetMap contributors. Alert levels are project settings, not official warnings.
          </p>
        </div>

        <div className="ios-side-col">
          <HazardsCard hazards={props.hazards} />
          {highest && (
            <button className="ios-card ios-priority" onClick={() => props.onOpenStation(highest.station_id)}>
              <span className="ios-card-label">Top gauge</span>
              <span className={`ios-chip lvl-${highest.level}`}>{LEVEL_INFO[highest.level]?.word ?? highest.label}</span>
              <strong>{highest.station_name}</strong>
              <p>{highest.explanation}</p>
              <span className="ios-link">View details {Icon.chevron}</span>
            </button>
          )}

          {topRiver && (
            <button className="ios-card ios-priority" onClick={() => props.onOpenRiver(topRiver.id)}>
              <span className="ios-card-label">Top PH basin</span>
              <span className={`ios-chip lvl-${topRiver.level}`}>{LEVEL_INFO[topRiver.level]?.word ?? topRiver.label}</span>
              <strong>{topRiver.name}</strong>
              <p>{topRiver.explanation}</p>
              <span className="ios-link">Open outlook {Icon.chevron}</span>
            </button>
          )}

          <LevelMix stations={props.stations} outlook={outlook} />

          <button className="ios-card ios-assistant" onClick={props.onAsk}>
            <span className="ios-avatar">{Icon.spark}</span>
            <span>
              <strong>Ask Muse Spark</strong>
              <small>Plain-language answers grounded in the live data.</small>
            </span>
            {Icon.chevron}
          </button>

          <PipelineCard sources={props.sources} onOpen={props.onShowTools} />

          {props.tipVisible && (
            <div className="ios-card ios-tip" role="note">
              <span className="ios-card-label">How to read this</span>
              <div className="ios-legend">
                {Object.entries(LEVEL_INFO).map(([lvl, info]) => (
                  <span key={lvl}><i className={`ios-dot lvl-${lvl}`} /><b>{info.word}</b> — {info.hint}</span>
                ))}
              </div>
              <button onClick={props.onDismissTip}>Got it</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile(props: { icon?: React.ReactNode; label: string; value: number | null | undefined; unit: string; note: string; loading: boolean; digits?: number; emphasis?: boolean }) {
  const shown = props.value == null ? "—" : props.digits ? props.value.toFixed(props.digits) : String(props.value);
  return (
    <div className={`ios-tile ${props.emphasis ? "is-emphasis" : ""}`}>
      <span className="ios-with-icon">{props.icon}{props.label}</span>
      {props.loading ? <i className="ios-skeleton" /> : <strong>{shown}{props.unit && shown !== "—" && <sup>{props.unit}</sup>}</strong>}
      <small>{props.note}</small>
    </div>
  );
}

function StationRows(props: { stations: Station[]; loading: boolean; offline: boolean; selectedId?: string | null; onOpen: (id: string) => void; empty?: string }) {
  return (
    <div className="ios-list">
      {props.loading && [0, 1, 2].map((i) => <div className="ios-row" key={i}><i className="ios-skeleton ios-skeleton-row" /></div>)}
      {props.stations.map((item) => {
        const lvl = levelOf(item);
        const trend = stationTrend(item);
        const fc = headlineForecast(item);
        return (
          <button
            className={`ios-row ${props.selectedId === item.station.id ? "is-selected" : ""}`}
            key={item.station.id}
            onClick={() => props.onOpen(item.station.id)}
            aria-pressed={props.selectedId === item.station.id}
          >
            <span className={`ios-row-icon lvl-${lvl}`} aria-hidden>{TREND_ICON[trend]}</span>
            <span className="ios-row-main">
              <strong>{item.station.name}</strong>
              <small>{item.station.river || item.station.id}</small>
            </span>
            <span className="ios-row-spark"><Sparkline values={item.sparkline} /></span>
            <span className="ios-row-value">
              <strong>{formatNumber(item.current_level_m)} m</strong>
              <small className={`ios-trend ${trend === "rising" ? "is-up" : ""}`}>
                {TREND_ICON[trend]}{trend === "steady" ? "Steady" : `${formatNumber(item.slope_m_per_h)} m/h`}
              </small>
            </span>
            <span className="ios-row-fc">
              <small>24h</small>
              <strong>{formatNumber(fc?.point_m)} m</strong>
            </span>
            <span className={`ios-chip lvl-${lvl}`}>{LEVEL_INFO[lvl]?.word ?? item.risk?.label ?? "No data"}</span>
            {Icon.chevron}
          </button>
        );
      })}
      {!props.loading && props.stations.length === 0 && (
        <div className="ios-empty">{props.offline ? "Can't load stations. Check that the backend is running." : props.empty ?? "No stations yet."}</div>
      )}
    </div>
  );
}

function StationsView(props: {
  stations: Station[];
  loading: boolean;
  offline: boolean;
  dark: boolean;
  query: string;
  setQuery: (q: string) => void;
  filter: "all" | "attention";
  setFilter: (f: "all" | "attention") => void;
  selectedId: string | null;
  selected: Station | null;
  onOpenStation: (id: string) => void;
  onAsk: (id: string) => void;
  onChanged: () => void;
}) {
  const q = props.query.trim().toLowerCase();
  const rows = props.stations
    .filter((s) => props.filter === "all" || levelOf(s) !== "normal")
    .filter((s) => !q || `${s.station.name} ${s.station.river}`.toLowerCase().includes(q));
  const rising = props.stations.filter((s) => stationTrend(s) === "rising").length;
  const ages = props.stations.map((s) => (s.freshness as { age_hours?: number } | null)?.age_hours).filter((a): a is number => a != null);
  const freshest = ages.length ? Math.min(...ages) : null;
  const rivers = new Set(props.stations.map((s) => s.station.river)).size;
  const points = props.stations.map((s) => ({
    id: s.station.id,
    lat: s.station.latitude,
    lon: s.station.longitude,
    level: levelOf(s),
    title: s.station.name,
    detail: `${formatNumber(s.current_level_m)} m · ${TREND_LABEL[stationTrend(s)].toLowerCase()} · ${s.station.river}`,
  }));

  return (
    <div className={`ios-split ${props.selected ? "has-detail" : ""}`}>
      <section className="ios-main-col">
        <div className="ios-kpis">
          <div><small>Gauges</small><b>{props.stations.length}</b></div>
          <div><small>Rivers</small><b>{rivers}</b></div>
          <div><small>Rising</small><b className={rising ? "is-up" : ""}>{rising}</b></div>
          <div><small>Need attention</small><b>{props.stations.filter((s) => levelOf(s) !== "normal").length}</b></div>
          <div><small>Freshest reading</small><b>{freshest == null ? "—" : `${Math.round(freshest * 60)}`}</b><em>minutes old</em></div>
        </div>
        {points.length > 0 && (
          <div className="ios-card ios-map-card">
            <RiverMap points={points} selectedId={props.selectedId} onSelect={props.onOpenStation} dark={props.dark} height={260} />
          </div>
        )}
        <div className="ios-toolbar">
          <label className="ios-search">
            {Icon.search}
            <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Search gauges or rivers  ( / )" aria-label="Search stations" />
            {props.query && <button onClick={() => props.setQuery("")} aria-label="Clear search">{Icon.close}</button>}
          </label>
          <div className="ios-segmented ios-filter" role="tablist">
            <span className="ios-seg-thumb" style={{ transform: props.filter === "attention" ? "translateX(100%)" : undefined }} aria-hidden />
            <button role="tab" aria-selected={props.filter === "all"} onClick={() => props.setFilter("all")}>All</button>
            <button role="tab" aria-selected={props.filter === "attention"} onClick={() => props.setFilter("attention")}>Needs attention</button>
          </div>
        </div>
        <StationRows
          stations={rows}
          loading={props.loading && !props.stations.length}
          offline={props.offline}
          selectedId={props.selectedId}
          onOpen={props.onOpenStation}
          empty={props.filter === "attention" ? "Nothing needs attention right now." : "No gauges match your search."}
        />
      </section>
      {props.selected && (
        <aside className="ios-detail" aria-label={`${props.selected.station.name} details`}>
          <StationDetail key={props.selected.station.id} station={props.selected} onAsk={props.onAsk} onChanged={props.onChanged} />
        </aside>
      )}
    </div>
  );
}

function ThresholdCard({ station, onChanged }: { station: Station; onChanged: () => void }) {
  const t = station.station.thresholds;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Thresholds | null>(t ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!t || !draft) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await postJson(`/api/stations/${encodeURIComponent(station.station.id)}/thresholds`, draft, "PUT");
      setEditing(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof Thresholds; label: string; lvl: string }[] = [
    { key: "advisory_m", label: "Watch at", lvl: "advisory" },
    { key: "warning_m", label: "Prepare at", lvl: "warning" },
    { key: "critical_m", label: "Act now at", lvl: "critical" },
  ];

  return (
    <div className="ios-card">
      <div className="ios-panel-head ios-panel-head-tight">
        <strong>Alert levels</strong>
        {!editing && <button className="ios-link" onClick={() => { setDraft(t); setEditing(true); }}>Edit</button>}
      </div>
      {fields.map((f) => (
        <div className="ios-threshold" key={f.key}>
          <span><i className={`ios-dot lvl-${f.lvl}`} />{f.label}</span>
          {editing ? (
            <input className="ios-input ios-input-sm" type="number" step="0.01" value={draft[f.key] as number}
              onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })} aria-label={f.label} />
          ) : (
            <strong>{formatNumber(t[f.key] as number)} m</strong>
          )}
        </div>
      ))}
      <div className="ios-threshold">
        <span><i className="ios-dot lvl-loading" />Fast rise at</span>
        {editing ? (
          <input className="ios-input ios-input-sm" type="number" step="0.01" min="0.01" value={draft.rise_rate_m_per_h}
            onChange={(e) => setDraft({ ...draft, rise_rate_m_per_h: Number(e.target.value) })} aria-label="Fast rise rate" />
        ) : (
          <strong>{formatNumber(t.rise_rate_m_per_h)} m/h</strong>
        )}
      </div>
      {editing ? (
        <>
          <textarea className="ios-input ios-textarea" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            placeholder="Where do these levels come from?" aria-label="Threshold source" />
          {error && <p className="ios-error">{error}</p>}
          <div className="ios-form-row ios-form-end">
            <button className="ios-text-btn" onClick={() => { setEditing(false); setError(null); }}>Cancel</button>
            <button className="ios-primary ios-primary-inline" onClick={save} disabled={saving || draft.source.trim().length < 3}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </>
      ) : (
        <p className="ios-muted ios-small ios-source">{t.source}</p>
      )}
    </div>
  );
}

function StationDetail({ station: s, onAsk, onClose, onChanged }: { station: Station; onAsk: (id: string) => void; onClose?: () => void; onChanged: () => void }) {
  const lvl = levelOf(s);
  const trend = stationTrend(s);
  const horizons = Object.entries(s.forecast ?? {}).sort(([a], [b]) => Number(a) - Number(b));
  const allValues = horizons.flatMap(([, f]) => [f.lo80_m, f.hi80_m]);
  const lo = Math.min(...allValues, s.current_level_m ?? Infinity);
  const hi = Math.max(...allValues, s.current_level_m ?? -Infinity);
  const pct = (v: number) => ((v - lo) / Math.max(hi - lo, 0.01)) * 100;

  return (
    <div className="ios-detail-body">
      <div className="ios-sheet-head">
        <div>
          <span className={`ios-chip lvl-${lvl}`}>{LEVEL_INFO[lvl]?.word ?? s.risk?.label}</span>
          <h2>{s.station.name}</h2>
          <small className="ios-muted">{s.station.river || s.station.id}{s.freshness?.label ? ` · ${s.freshness.label}` : ""}</small>
        </div>
        {onClose && <button className="ios-close" onClick={onClose} aria-label="Close">{Icon.close}</button>}
      </div>

      <div className="ios-card ios-now">
        <div>
          <span className="ios-muted ios-small">Water level now</span>
          <strong>{formatNumber(s.current_level_m)}<sup>m</sup></strong>
          <small className={`ios-trend ${trend === "rising" ? "is-up" : "ios-muted"}`}>
            {TREND_ICON[trend]}{TREND_LABEL[trend]} {formatNumber(s.slope_m_per_h)} m/h
          </small>
        </div>
        <Sparkline values={s.sparkline} tall />
      </div>

      {s.risk?.explanation && (
        <div className="ios-card ios-explain">
          <strong>What this means</strong>
          <p>{s.risk.explanation}</p>
          <p className="ios-muted ios-small">{LEVEL_INFO[lvl]?.hint}</p>
        </div>
      )}

      {horizons.length > 0 && (
        <div className="ios-card">
          <strong>Forecast</strong>
          <p className="ios-muted ios-small">The bar shows the 80% interval; the dot is the best guess.</p>
          {horizons.map(([h, f]) => (
            <div className="ios-fc-row" key={h}>
              <span>{h}h</span>
              <span className="ios-fc-track">
                <i className="ios-fc-range" style={{ left: `${pct(f.lo80_m)}%`, width: `${Math.max(pct(f.hi80_m) - pct(f.lo80_m), 2)}%` }} />
                <i className={`ios-fc-dot lvl-${lvl}`} style={{ left: `${pct(f.point_m)}%` }} />
              </span>
              <strong>{formatNumber(f.point_m)} m</strong>
            </div>
          ))}
        </div>
      )}

      <ThresholdCard station={s} onChanged={onChanged} />
      <StationTechnical stationId={s.station.id} />

      {s.message && <p className="ios-muted ios-small">{s.message}</p>}

      <button className="ios-primary" onClick={() => onAsk(s.station.id)}>
        <span className="ios-with-icon">{Icon.spark}Ask about this gauge</span>
      </button>
    </div>
  );
}

// Mobile only: the detail view slides up as a bottom sheet.
function StationSheet({ station, onClose, onAsk, onChanged }: { station: Station | null; onClose: () => void; onAsk: (id: string) => void; onChanged: () => void }) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const [shown, setShown] = useState<Station | null>(null);

  // Keep the last station rendered while the sheet animates closed.
  useEffect(() => {
    if (station) setShown(station);
  }, [station]);

  useEffect(() => {
    if (!station) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [station, onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current != null) setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onPointerUp = () => {
    if (dragY > 110) onClose();
    startY.current = null;
    setDragY(0);
  };

  const s = station ?? shown;
  const open = !!station;

  return (
    <div className={`ios-sheet-layer ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <div className="ios-scrim" onClick={onClose} />
      <section
        className="ios-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={s?.station.name}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        <div className="ios-grabber-zone" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span className="ios-grabber" />
        </div>
        {s && <div className="ios-sheet-body"><StationDetail key={s.station.id} station={s} onAsk={onAsk} onClose={onClose} onChanged={onChanged} /></div>}
      </section>
    </div>
  );
}
