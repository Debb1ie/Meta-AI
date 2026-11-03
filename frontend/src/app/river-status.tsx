"use client";

import Link from "next/link";
import { useState } from "react";
import type { LiveData, LiveRiver } from "./landing";
import { PH_PATH, PH_VIEWBOX, projectPH } from "./ph-outline";

// One status system for the whole card: three states, each with a word, an icon and a colour.
// Colours are used for status only (see --rs-normal/--rs-watch/--rs-alert in globals.css).
type Status = "normal" | "watch" | "alert";

const STATUS: Record<Status, { word: string; icon: React.ReactNode }> = {
  normal: { word: "Normal", icon: <path d="m5 12.5 4.5 4.5L19 7.5" /> },
  watch: { word: "Watch", icon: <><path d="M12 4 21 20H3z" /><path d="M12 10v4M12 17v.01" /></> },
  alert: { word: "Alert", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></> },
};

function statusOf(level: string): Status {
  return level === "normal" ? "normal" : level === "advisory" ? "watch" : "alert";
}

const TREND: Record<LiveRiver["trend"], string> = { rising: "rising", falling: "falling", steady: "steady" };

const IMPACT: Record<string, string> = { green: "Low impact", orange: "Moderate impact", red: "High impact" };

const LANGUAGES: { id: string; label: string; lang: string }[] = [
  { id: "en", label: "English", lang: "en" },
  { id: "fil", label: "Filipino", lang: "fil" },
  { id: "ceb", label: "Cebuano", lang: "ceb" },
  { id: "ilo", label: "Ilocano", lang: "ilo" },
  { id: "hil", label: "Hiligaynon", lang: "hil" },
];

function StatusIcon({ status, size = 18 }: { status: Status; size?: number }) {
  return (
    <svg className="rs-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      {STATUS[status].icon}
    </svg>
  );
}

const pht = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", ...opts });

const dayLabel = (isoDate: string) => pht(`${isoDate}T12:00:00+08:00`, { weekday: "short", month: "short", day: "numeric" });

const m3 = (v: number) => `${Math.round(v).toLocaleString("en-US")} m³/s`;

/** Daily flow, 7 days back to 7 ahead. Today is coloured by status; the Watch level is drawn
    to scale when it fits and otherwise named, never faked. */
function FlowChart({ river, status }: { river: LiveRiver; status: Status }) {
  const today = river.current_date;
  const past = river.series.filter((p) => p.date <= today).slice(-8);
  const ahead = river.series.filter((p) => p.date > today).slice(0, 7);
  const days = [...past, ...ahead];
  if (days.length < 3) return null;

  const W = 320;
  const H = 120;
  const watch = river.thresholds_m3s.advisory;
  const dataMax = Math.max(...days.map((d) => d.discharge_m3s));
  const showLine = watch <= dataMax * 1.6;
  const top = Math.max(dataMax, showLine ? watch : 0) * 1.12;
  const bw = W / days.length;
  const y = (v: number) => H - (v / top) * H;
  const peak = ahead.length ? ahead.reduce((a, b) => (b.discharge_m3s > a.discharge_m3s ? b : a)) : null;

  const summary =
    `Daily river flow for ${river.name}: ${m3(past[past.length - 1].discharge_m3s)} today` +
    (peak ? `, forecast to reach ${m3(peak.discharge_m3s)} on ${dayLabel(peak.date)}` : "") +
    `. Watch level ${m3(watch)}.`;

  return (
    <figure className="rs-chart">
      <div className="rs-plot">
        {/* Bars stretch to the card width; text stays HTML so it never scales with the chart. */}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={summary}>
          {days.map((d, i) => {
            const isToday = d.date === today;
            const h = Math.max(2, H - y(d.discharge_m3s));
            const cls = isToday ? `rs-bar is-today is-${status}` : d.is_forecast ? "rs-bar is-ahead" : "rs-bar";
            return <rect key={d.date} className={cls} x={i * bw + 2} y={H - h} width={bw - 4} height={h} rx="2" vectorEffect="non-scaling-stroke" />;
          })}
          {showLine && <line className="rs-watchline" x1="0" x2={W} y1={y(watch)} y2={y(watch)} vectorEffect="non-scaling-stroke" />}
        </svg>
        {showLine && <span className="rs-watchlabel" style={{ top: `${(y(watch) / H) * 100}%` }}>Watch level {m3(watch)}</span>}
      </div>
      <div className="rs-axis-row" aria-hidden>
        <span>{dayLabel(days[0].date)}</span>
        <span className="rs-axis-today" style={{ left: `${((past.length - 0.5) / days.length) * 100}%` }}>Today</span>
        <span>{dayLabel(days[days.length - 1].date)}</span>
      </div>
      <figcaption>
        <span><i className="rs-key" /> Past 7 days</span>
        <span><i className={`rs-key is-${status}`} /> Today</span>
        <span><i className="rs-key is-ahead" /> Forecast</span>
        {!showLine && <span className="rs-offscale">Watch level {m3(watch)} is above this chart</span>}
      </figcaption>
    </figure>
  );
}

/** The 17 basins on an outline of the Philippines; shape and colour both carry the status. */
function BasinMap({ rivers, focusId }: { rivers: LiveRiver[]; focusId: string }) {
  const counts = { normal: 0, watch: 0, alert: 0 };
  rivers.forEach((r) => counts[statusOf(r.level)]++);
  return (
    <figure className="rs-map">
      <svg viewBox={PH_VIEWBOX} role="img" aria-label={`Map of the Philippines with ${rivers.length} river basins: ${counts.normal} normal, ${counts.watch} watch, ${counts.alert} alert.`}>
        <path className="rs-land" d={PH_PATH} />
        {rivers.map((r) => {
          const [x, yy] = projectPH(r.longitude, r.latitude);
          const s = statusOf(r.level);
          const size = r.id === focusId ? 9 : 6;
          const shape =
            s === "normal" ? <circle cx={x} cy={yy} r={size} /> :
            s === "watch" ? <path d={`M${x},${yy - size * 1.2} L${x + size * 1.1},${yy + size * 0.8} L${x - size * 1.1},${yy + size * 0.8} Z`} /> :
            <rect x={x - size} y={yy - size} width={size * 2} height={size * 2} rx="1.5" />;
          return (
            <g key={r.id} className={`rs-dot is-${s} ${r.id === focusId ? "is-focus" : ""}`}>
              <title>{`${r.name}: ${STATUS[s].word}, ${m3(r.current_m3s)}`}</title>
              {shape}
            </g>
          );
        })}
      </svg>
      <figcaption>
        {(["normal", "watch", "alert"] as Status[]).map((s) => (
          <span key={s} className={`rs-legend is-${s}`}><StatusIcon status={s} size={14} />{counts[s]} {STATUS[s].word.toLowerCase()}</span>
        ))}
      </figcaption>
    </figure>
  );
}

export function RiverStatus({ live }: { live: LiveData }) {
  const [lang, setLang] = useState("fil");

  if (!live.ready) {
    return (
      <section className="rs-card" aria-busy="true" aria-label="Live river status">
        <p className="rs-meta">Loading live river data…</p>
        <div className="rs-skeleton" />
      </section>
    );
  }

  const river = live.rivers[0];
  if (!river) {
    return (
      <section className="rs-card" aria-label="Live river status">
        <p className="rs-headline">Live data is unavailable right now.</p>
        <p className="rs-meta">The river feeds are not responding. Try again in a minute, or open the dashboard.</p>
      </section>
    );
  }

  const status = statusOf(river.level);
  const hazard = live.hazards.find((h) => h.type === "typhoon") ?? live.hazards[0];
  const brief = live.brief;
  const sms = brief?.briefing.alerts[lang] ?? "";
  const pctOfWatch = Math.round((river.peak.discharge_m3s / river.thresholds_m3s.advisory) * 100);
  const allVerified = brief && brief.verification.numbers_verified === brief.verification.numbers_checked;

  return (
    <section className="rs-card" aria-label="Is the river safe right now?">
      <p className="rs-meta">
        <span className="rs-live" aria-hidden />
        {live.outlookUpdated ? <>Live data, updated {pht(live.outlookUpdated, { hour: "numeric", minute: "2-digit" })} PHT</> : "Live data"}
      </p>

      <div className="rs-top">
        <div className="rs-answer">
          <p className="rs-place">{river.name}, {river.region.replace(" · ", ", ")}</p>
          <h2 className={`rs-headline is-${status}`}>
            <StatusIcon status={status} size={30} />
            <span>{STATUS[status].word}, {TREND[river.trend]}</span>
          </h2>
          <p className="rs-reading"><strong>{m3(river.current_m3s)}</strong> flowing today</p>
          <dl className="rs-facts">
            <div><dt>Forecast peak</dt><dd>{m3(river.peak.discharge_m3s)} on {dayLabel(river.peak.date)}</dd></div>
            <div><dt>Watch level</dt><dd>{m3(river.thresholds_m3s.advisory)} (the peak is {pctOfWatch}% of it)</dd></div>
          </dl>
          <p className="rs-note">Closest to its watch level of all {live.rivers.length} Philippine basins we track.</p>
        </div>
        <BasinMap rivers={live.rivers} focusId={river.id} />
      </div>

      <FlowChart river={river} status={status} />

      <ul className="rs-rows">
        {hazard && (
          <li className="rs-row">
            <svg className="rs-row-icon" viewBox="0 0 24 24" aria-hidden><path d="M12 3c-4.5 0-8 2-9 5 2.5-1.6 5.5-2 8-1.2" /><path d="M12 21c4.5 0 8-2 9-5-2.5 1.6-5.5 2-8 1.2" /><circle cx="12" cy="12" r="3" /></svg>
            <div>
              <p className="rs-row-title">{hazard.name}</p>
              <p className="rs-row-text">
                {IMPACT[hazard.alert] ?? "Impact unknown"}, {hazard.affects_ph ? "affecting the Philippines" : `${hazard.distance_to_ph_km.toLocaleString("en-US")} km away`}
                {" "}<span className="rs-source">(GDACS)</span>
              </p>
            </div>
          </li>
        )}
        {brief && (
          <li className="rs-row rs-verified">
            <svg className="rs-row-icon" viewBox="0 0 24 24" aria-hidden><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></svg>
            <div>
              <p className="rs-row-title">{brief.verification.numbers_verified}/{brief.verification.numbers_checked} numbers verified</p>
              <p className="rs-row-text">
                {allVerified ? "Every number in today's AI briefing matched the live data it cites." : "Some numbers in today's AI briefing could not be matched to their data; they are flagged in the dashboard."}
                {" "}Checked by our server, not the model. Briefing by Muse Spark, {pht(brief.generated_at, { hour: "numeric", minute: "2-digit" })} PHT.
              </p>
            </div>
          </li>
        )}
      </ul>

      {brief && (
        <div className="rs-sms">
          <p className="rs-sms-label">Community alert by SMS</p>
          <div className="rs-langs" role="group" aria-label="Alert language">
            {LANGUAGES.map((l) => (
              <button key={l.id} type="button" aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
            ))}
          </div>
          <div className="rs-phone">
            <p className="rs-bubble" lang={LANGUAGES.find((l) => l.id === lang)?.lang} aria-live="polite">{sms}</p>
            <p className="rs-bubble-meta">{sms.length} characters, {Math.max(1, Math.ceil(sms.length / 153))} SMS</p>
          </div>
        </div>
      )}

      <Link className="rs-more" href="/featured?tab=outlook">See all {live.rivers.length} basins in the dashboard</Link>
    </section>
  );
}
