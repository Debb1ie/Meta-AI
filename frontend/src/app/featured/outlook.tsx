"use client";

import dynamic from "next/dynamic";
import { Hazards, Icon, LEVEL_INFO, Outlook, PHRiver, TrendIcon, downloadCsv, formatFlow, timeAgo } from "./shared";

const RiverMap = dynamic(() => import("./map"), { ssr: false, loading: () => <div className="ios-map ios-skeleton" style={{ height: 300 }} /> });

const TREND_LABEL = { rising: "Rising", falling: "Falling", steady: "Steady" };

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shareOfWatch(r: PHRiver) {
  return (r.peak.discharge_m3s / r.thresholds_m3s.advisory) * 100;
}

/** Daily flow: past 30 days solid, forecast dashed with its p25–p75 band, alert lines when in range. */
function FlowChart({ river }: { river: PHRiver }) {
  const pts = river.series;
  if (pts.length < 2) return null;
  // Close to the rendered width so the 11px labels stay readable.
  const W = 340;
  const H = 170;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const dataMax = Math.max(...pts.map((p) => Math.max(p.discharge_m3s, p.p75_m3s ?? 0)));
  const lines = (["advisory", "warning", "critical"] as const)
    .map((k) => ({ k, v: river.thresholds_m3s[k] }))
    .filter((t) => t.v <= dataMax * 2.5);
  const yMax = Math.max(dataMax * 1.15, ...lines.map((t) => t.v * 1.08), 1);
  const x = (i: number) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const todayIdx = pts.findIndex((p) => p.is_forecast) - 1;
  const past = pts.map((p, i) => ({ p, i })).filter(({ i }) => todayIdx < 0 || i <= todayIdx);
  const future = pts.map((p, i) => ({ p, i })).filter(({ i }) => todayIdx >= 0 && i >= todayIdx);
  const path = (list: { p: (typeof pts)[number]; i: number }[]) => list.map(({ p, i }) => `${x(i)},${y(p.discharge_m3s)}`).join(" ");
  const band = future.filter(({ p }) => p.p25_m3s != null && p.p75_m3s != null);
  const bandPath = band.length > 1
    ? `${band.map(({ p, i }) => `${x(i)},${y(p.p75_m3s!)}`).join(" ")} ${[...band].reverse().map(({ p, i }) => `${x(i)},${y(p.p25_m3s!)}`).join(" ")}`
    : "";

  return (
    <svg className="ios-flow" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${river.name} daily river flow, past 30 days and 30-day forecast`}>
      {lines.map((t) => (
        <g key={t.k} className={`lvl-${t.k}`}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t.v)} y2={y(t.v)} className="ios-flow-threshold" />
          <text x={W - pad.r - 4} y={y(t.v) - 4} textAnchor="end" className="ios-flow-label">{LEVEL_INFO[t.k].word} · {formatFlow(t.v)}</text>
        </g>
      ))}
      {bandPath && <polygon points={bandPath} className="ios-flow-band" />}
      <polyline points={path(past)} className="ios-flow-past" />
      {future.length > 1 && <polyline points={path(future)} className="ios-flow-future" />}
      {todayIdx >= 0 && (
        <g>
          <line x1={x(todayIdx)} x2={x(todayIdx)} y1={pad.t} y2={H - pad.b} className="ios-flow-today" />
          <text x={x(todayIdx)} y={H - 6} textAnchor="middle" className="ios-flow-axis">Today</text>
        </g>
      )}
      <text x={pad.l} y={H - 6} className="ios-flow-axis">{shortDate(pts[0].date)}</text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="ios-flow-axis">{shortDate(pts[pts.length - 1].date)}</text>
    </svg>
  );
}

function RiverRows({ rivers, selectedId, onOpen }: { rivers: PHRiver[]; selectedId?: string | null; onOpen: (id: string) => void }) {
  return (
    <div className="ios-list">
      {rivers.map((r) => {
        const share = Math.min(100, shareOfWatch(r));
        return (
          <button key={r.id} className={`ios-row ios-river-row ${selectedId === r.id ? "is-selected" : ""}`} onClick={() => onOpen(r.id)} aria-pressed={selectedId === r.id}>
            <span className={`ios-row-icon lvl-${r.level}`} aria-hidden><TrendIcon trend={r.trend} /></span>
            <span className="ios-row-main">
              <strong>{r.name}</strong>
              <small>{r.region}</small>
            </span>
            <span className="ios-meter" title={`7-day peak is ${Math.round(share)}% of the Watch level`}>
              <i className={`lvl-${r.level}`} style={{ width: `${Math.max(share, 3)}%` }} />
            </span>
            <span className="ios-row-value">
              <strong>{formatFlow(r.current_m3s)} m³/s</strong>
              <small className={`ios-trend ${r.trend === "rising" ? "is-up" : ""}`}><TrendIcon trend={r.trend} />{TREND_LABEL[r.trend]}</small>
            </span>
            <span className={`ios-chip lvl-${r.level}`}>{LEVEL_INFO[r.level]?.word ?? r.label}</span>
            {Icon.chevron}
          </button>
        );
      })}
    </div>
  );
}

export function OutlookPanel({ outlook, onOpen }: { outlook: Outlook | null; onOpen: (id: string) => void }) {
  if (!outlook) return null;
  return <RiverRows rivers={outlook.rivers} onOpen={onOpen} />;
}

export function hazardPoints(hazards: Hazards | null) {
  return (hazards?.near_ph ?? []).map((h) => ({
    id: h.id,
    lat: h.latitude,
    lon: h.longitude,
    alert: h.alert,
    title: h.name,
    detail: `${h.alert.toUpperCase()} alert · ${h.distance_to_ph_km.toLocaleString()} km from PH centre${h.severity ? ` · ${h.severity}` : ""}`,
  }));
}

export function outlookPoints(outlook: Outlook) {
  return outlook.rivers.map((r) => ({
    id: r.id,
    lat: r.latitude,
    lon: r.longitude,
    level: r.level,
    title: r.name,
    detail: `${formatFlow(r.current_m3s)} m³/s · ${TREND_LABEL[r.trend].toLowerCase()} · ${LEVEL_INFO[r.level]?.word ?? r.label}`,
  }));
}

function RiverDetail({ river, onAsk }: { river: PHRiver; onAsk: (question: string) => void }) {
  const t = river.thresholds_m3s;
  const share = Math.round(shareOfWatch(river));
  return (
    <div className="ios-detail-body">
      <div className="ios-sheet-head">
        <div>
          <span className={`ios-chip lvl-${river.level}`}>{LEVEL_INFO[river.level]?.word ?? river.label}</span>
          <h2>{river.name}</h2>
          <small className="ios-muted">{river.region}</small>
        </div>
      </div>

      <div className="ios-card ios-now ios-now-flow">
        <div>
          <span className="ios-muted ios-small">River flow today (modelled)</span>
          <strong>{formatFlow(river.current_m3s)}<sup>m³/s</sup></strong>
          <small className={`ios-trend ${river.trend === "rising" ? "is-up" : "ios-muted"}`}><TrendIcon trend={river.trend} />{TREND_LABEL[river.trend]} over 3 days</small>
        </div>
        <div className="ios-peak">
          <span className="ios-muted ios-small">7-day peak</span>
          <strong>{formatFlow(river.peak.discharge_m3s)} m³/s</strong>
          <small className="ios-muted">{shortDate(river.peak.date)}</small>
        </div>
      </div>

      <div className="ios-card">
        <strong>Past 30 days &amp; next 30 days</strong>
        <p className="ios-muted ios-small">Solid line: model history. Dashed: forecast, with the likely range (p25–p75) shaded.</p>
        <FlowChart river={river} />
      </div>

      <div className="ios-card ios-explain">
        <strong>What this means</strong>
        <p>{river.explanation}</p>
        <div className="ios-meter ios-meter-lg" aria-label={`Peak is ${share}% of the Watch level`}>
          <i className={`lvl-${river.level}`} style={{ width: `${Math.min(100, Math.max(share, 2))}%` }} />
        </div>
        <p className="ios-muted ios-small">Next-7-day peak is <b>{share}%</b> of this river&apos;s Watch level. Wetter model runs reach {formatFlow(river.upper_m3s)} m³/s.</p>
      </div>

      <div className="ios-card">
        <div className="ios-panel-head ios-panel-head-tight"><strong>Alert levels for this river</strong></div>
        {(["advisory", "warning", "critical"] as const).map((k) => (
          <div className="ios-threshold" key={k}>
            <span><i className={`ios-dot lvl-${k}`} />{LEVEL_INFO[k].word}</span>
            <strong>{formatFlow(t[k])} m³/s</strong>
          </div>
        ))}
        <div className="ios-threshold">
          <span><i className="ios-dot lvl-loading" />Typical day (median)</span>
          <strong>{formatFlow(t.median)} m³/s</strong>
        </div>
        <p className="ios-muted ios-small ios-source">Top 5% / 1% / 0.2% of days in this river&apos;s last five years. Not an official PAGASA warning.</p>
      </div>

      <div className="ios-card">
        <div className="ios-panel-head ios-panel-head-tight"><strong className="ios-with-icon">{Icon.database}Model grid cell</strong></div>
        <dl className="ios-dl">
          <dt>River ID</dt><dd><code>{river.id}</code></dd>
          <dt>GloFAS cell</dt><dd>{river.latitude.toFixed(3)}, {river.longitude.toFixed(3)} (0.05° grid)</dd>
          <dt>Latest value</dt><dd>{river.current_date}</dd>
          <dt>Series</dt><dd>{river.series.length} days · {river.series.filter((p) => p.is_forecast).length} forecast</dd>
        </dl>
        <button
          className="ios-text-btn"
          onClick={() => downloadCsv(`${river.id}-glofas.csv`, river.series.map((p) => ({ date: p.date, discharge_m3s: p.discharge_m3s, p25_m3s: p.p25_m3s, p75_m3s: p.p75_m3s, is_forecast: p.is_forecast })))}
        >
          {Icon.download}DOWNLOAD SERIES (CSV)
        </button>
      </div>

      <button className="ios-primary" onClick={() => onAsk(`What is the outlook for the ${river.name} (${river.region}) over the next week?`)}>
        <span className="ios-with-icon">{Icon.spark}Ask about this river</span>
      </button>
    </div>
  );
}

export function OutlookView(props: {
  outlook: Outlook | null;
  error: string | null;
  selectedId: string | null;
  dark: boolean;
  hazards: Hazards | null;
  onSelect: (id: string) => void;
  onAsk: (question: string) => void;
}) {
  const { outlook } = props;
  if (!outlook) {
    return <div className="ios-card ios-empty">{props.error ?? "Loading the Philippine river outlook…"}</div>;
  }
  const selected = outlook.rivers.find((r) => r.id === props.selectedId) ?? outlook.rivers[0];
  const rising = outlook.rivers.filter((r) => r.trend === "rising").length;
  const onWatch = outlook.rivers.filter((r) => r.level !== "normal").length;
  const highest = outlook.rivers.reduce((a, b) => (shareOfWatch(b) > shareOfWatch(a) ? b : a), outlook.rivers[0]);
  const totalFlow = outlook.rivers.reduce((s, r) => s + r.current_m3s, 0);

  return (
    <div className="ios-split has-detail ios-outlook">
      <section className="ios-main-col">
        <div className="ios-kpis">
          <div><small>Basins</small><b>{outlook.rivers.length}</b></div>
          <div><small>Rising</small><b className={rising ? "is-up" : ""}>{rising}</b></div>
          <div><small>On watch</small><b>{onWatch}</b></div>
          <div><small>Closest to Watch</small><b>{Math.round(shareOfWatch(highest))}%</b><em>{highest.name}</em></div>
          <div><small>Combined flow</small><b>{formatFlow(totalFlow)}</b><em>m³/s today</em></div>
        </div>
        <div className="ios-card ios-map-card">
          <RiverMap points={outlookPoints(outlook)} hazards={hazardPoints(props.hazards)} selectedId={selected?.id} onSelect={props.onSelect} dark={props.dark} height={300} />
        </div>
        <div className="ios-card ios-method">
          <span className="ios-card-label ios-with-icon">{Icon.info}How this works</span>
          <p>
            Daily river flow for the country&apos;s major basins from the <b>GloFAS</b> flood model, updated every day.
            It&apos;s a model, not a gauge, so use it to see what&apos;s coming, and confirm with PAGASA and your LGU.
          </p>
          <small className="ios-muted">
            Updated {timeAgo(outlook.fetched_at)}{outlook.stale ? " · showing last good data" : ""} ·{" "}
            <a href={outlook.source_url} target="_blank" rel="noreferrer">Copernicus GloFAS via Open-Meteo</a>
          </small>
        </div>
        <RiverRows rivers={outlook.rivers} selectedId={selected?.id} onOpen={props.onSelect} />
      </section>
      {selected && (
        <aside className="ios-detail" id="ios-detail" aria-label={`${selected.name} outlook`}>
          <RiverDetail key={selected.id} river={selected} onAsk={props.onAsk} />
        </aside>
      )}
    </div>
  );
}
