"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./featured/shared";
import type { LiveData, LiveRiver } from "./landing";

const IMPACT: Record<string, string> = { green: "Low impact", orange: "Moderate impact", red: "High impact" };

// The river closest to its own watch level, the same choice the status card below makes.
function pickRiver(rivers: LiveRiver[]): LiveRiver | undefined {
  return [...rivers].sort((a, b) => b.current_m3s / b.thresholds_m3s.advisory - a.current_m3s / a.thresholds_m3s.advisory)[0];
}

// Last nine observed days, today last. Heights are relative to the largest of the nine.
function Bars({ river }: { river?: LiveRiver }) {
  const past = river ? river.series.filter((p) => !p.is_forecast).slice(-9) : [];
  const max = Math.max(1, ...past.map((p) => p.discharge_m3s));
  return (
    <div className="lp-bars" aria-hidden>
      {(past.length ? past : Array.from({ length: 9 }, () => null)).map((p, i) => (
        <i key={i} style={{ height: p ? `${Math.max(8, (p.discharge_m3s / max) * 100)}%` : "20%", animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

export function HeroScene({ live }: { live: LiveData }) {
  const sceneRef = useRef<HTMLDivElement>(null);

  // Pointer tilt and scroll drift, written to CSS variables (no React re-render per frame).
  useEffect(() => {
    const el = sceneRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    };
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
      el.style.setProperty("--mx", cur.x.toFixed(3));
      el.style.setProperty("--my", cur.y.toFixed(3));
      el.style.setProperty("--sy", Math.min(1, window.scrollY / 700).toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const river = pickRiver(live.rivers);
  const hazard = live.hazards.find((h) => h.type === "typhoon") ?? live.hazards[0];
  const brief = live.brief;
  const sms = brief?.briefing.alerts.fil;

  return (
    <div className="lp-scene" ref={sceneRef} role="img" aria-label={river ? `Live: ${river.name} at ${Math.round(river.current_m3s)} cubic metres per second, ${river.trend}` : "Live view of the HydroSentinel network"}>
      <div className="lp-sky" />
      <div className="lp-floor" />
      <div className="lp-radar" aria-hidden><i /><i /><i /></div>

      <div className="lp-stage">
        <article className="lp-card lp-card-hazard">
          <div className="lp-card-head lp-with-icon">{Icon.typhoon}GDACS hazard</div>
          <strong>{hazard ? hazard.name : live.ready ? "No active hazards nearby" : "Scanning…"}</strong>
          <small>{hazard ? `${IMPACT[hazard.alert] ?? hazard.alert} · ${hazard.affects_ph ? "affects PH" : `${hazard.distance_to_ph_km.toLocaleString()} km away`}` : "Typhoons and floods, live"}</small>
        </article>

        <article className="lp-card lp-card-agent">
          <div className="lp-card-head lp-with-icon">{Icon.spark}Muse Spark agent</div>
          <strong>{brief ? `${brief.verification.numbers_verified}/${brief.verification.numbers_checked} numbers verified` : "Tool-calling agent"}</strong>
          <small>{brief ? `${brief.tool_calls} tool calls · cited briefing` : "Investigates, cites, verifies"}</small>
        </article>

        <article className="lp-card lp-card-main">
          <div className="lp-card-head"><span className="lp-live" />PH basin · live model</div>
          <strong>{river ? river.name : "Connecting…"}</strong>
          <div className="lp-big">
            {river ? Math.round(river.current_m3s).toLocaleString() : "—"}
            <small>m³/s</small>
            {river && <b className={river.trend === "rising" ? "is-up" : ""}>{river.trend === "rising" ? Icon.up : river.trend === "falling" ? Icon.down : Icon.flat}{river.trend}</b>}
          </div>
          <Bars river={river} />
          <div className="lp-card-foot">
            <span>Forecast peak</span>
            <strong>{river ? `${Math.round(river.peak.discharge_m3s).toLocaleString()} m³/s` : "—"}</strong>
          </div>
        </article>

        <article className="lp-card lp-card-sms">
          <div className="lp-card-head lp-with-icon">{Icon.ask}SMS · Filipino</div>
          <p>{sms ? (sms.length > 120 ? `${sms.slice(0, 118)}…` : sms) : "Alerts in five Philippine languages: Filipino, Cebuano, Ilocano, Hiligaynon and English."}</p>
        </article>

        <article className="lp-card lp-card-chips">
          {["EN", "FIL", "CEB", "ILO", "HIL"].map((l) => <span key={l}>{l}</span>)}
        </article>
      </div>

      <div className="lp-scene-caption">Live data · {live.rivers.length || 17} PH basins · {live.gauges ?? 10} gauges · GDACS</div>
    </div>
  );
}
