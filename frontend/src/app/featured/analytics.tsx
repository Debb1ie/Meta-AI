"use client";

import { useEffect, useState } from "react";
import { Icon, api } from "./shared";

type Summary = {
  horizon_h: number;
  gauges: number;
  mean_skill: number | null;
  share_beating_persistence: number | null;
  mean_rmse_m: number | null;
  mean_coverage80: number | null;
  mean_coverage95: number | null;
  models_selected: Record<string, number>;
};

type Research = {
  evaluation: { summary: Summary[] };
};

function percent(value: number | null, digits = 0) {
  return value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function modelLabel(model: string) {
  return model === "gradient_boosting" ? "Gradient boosting" : model === "damped_trend" ? "Damped trend" : "Persistence";
}

function PerformanceChart({ rows }: { rows: Summary[] }) {
  if (!rows.length) return <p className="ios-muted ios-small">No evaluated gauges are available yet.</p>;
  const W = 680;
  const H = 190;
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.mean_skill ?? 0)));
  const x = (i: number) => 50 + (i / Math.max(rows.length - 1, 1)) * (W - 70);
  const y = (v: number) => 18 + (1 - (v + max) / (2 * max)) * (H - 42);
  const points = rows.map((r, i) => `${x(i)},${y(r.mean_skill ?? 0)}`).join(" ");
  const zero = y(0);
  return (
    <svg className="ios-analytics-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mean skill versus persistence by forecast horizon">
      <line x1="50" x2={W - 20} y1={zero} y2={zero} className="ios-flow-today" />
      <polyline points={points} className="ios-flow-past" />
      {rows.map((r, i) => (
        <g key={r.horizon_h}>
          <circle cx={x(i)} cy={y(r.mean_skill ?? 0)} r="5" className="ios-analytics-dot" />
          <text x={x(i)} y={H - 10} textAnchor="middle" className="ios-flow-axis">{r.horizon_h}h</text>
        </g>
      ))}
      <text x="50" y="12" className="ios-flow-axis">better</text>
      <text x="50" y={H - 25} className="ios-flow-axis">worse</text>
    </svg>
  );
}

export function AnalyticsView() {
  const [data, setData] = useState<Research | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = data?.evaluation.summary ?? [];
  const waiting = !!data && rows.length === 0;

  useEffect(() => {
    api<Research>("/api/research").then(setData).catch((err: Error) => setError(err.message));
  }, []);

  // After a server restart the gauges re-sync and models retrain for a few minutes; keep checking.
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => {
      api<Research>("/api/research").then(setData).catch(() => {});
    }, 30000);
    return () => window.clearInterval(id);
  }, [waiting]);

  const allModels = rows.flatMap((r) => Object.entries(r.models_selected));
  const bestModel = allModels.sort((a, b) => b[1] - a[1])[0];
  const meanSkill = rows.length ? rows.reduce((sum, r) => sum + (r.mean_skill ?? 0), 0) / rows.length : null;
  const meanCoverage = rows.length ? rows.reduce((sum, r) => sum + (r.mean_coverage80 ?? 0), 0) / rows.length : null;

  if (error) return <div className="ios-banner ios-with-icon">{Icon.alert}Performance analytics unavailable: {error}</div>;
  if (!data) return <div className="ios-card ios-skeleton" style={{ height: 220 }} />;

  return (
    <div className="ios-main-col ios-analytics">
      {waiting && (
        <div className="ios-note">
          Results are still being prepared. After a restart, the server reloads river data and retrains its forecasts, which
          takes a few minutes. This page checks again every 30 seconds.
        </div>
      )}
      <div className="ios-kpis is-4">
        <div><small>Evaluated gauges</small><b>{rows[0]?.gauges ?? "—"}</b><em>held-out test data</em></div>
        <div><small>Mean skill</small><b className={meanSkill != null && meanSkill > 0 ? "is-good" : ""}>{percent(meanSkill)}</b><em>vs persistence baseline</em></div>
        <div><small>80% coverage</small><b>{percent(meanCoverage)}</b><em>target: 80%</em></div>
        <div><small>Top selected model</small><b>{bestModel ? modelLabel(bestModel[0]) : "—"}</b><em>{bestModel ? `${bestModel[1]} horizon(s)` : "waiting for data"}</em></div>
      </div>

      <section className="ios-card">
        <div className="ios-panel-head">
          <strong className="ios-with-icon">{Icon.activity}Forecast skill by horizon</strong>
          <span className="ios-muted ios-small">positive = beats persistence</span>
        </div>
        <PerformanceChart rows={rows} />
      </section>

      <section className="ios-card">
        <div className="ios-panel-head">
          <strong className="ios-with-icon">{Icon.cpu}Evaluation summary</strong>
          <span className="ios-muted ios-small">live backtest results</span>
        </div>
        <div className="ios-table-wrap">
          <table className="ios-table">
            <thead><tr><th>Ahead</th><th>Gauges</th><th>Skill</th><th>Beats baseline</th><th>RMSE</th><th>80% coverage</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.horizon_h}>
                <td>{r.horizon_h} h</td>
                <td>{r.gauges}</td>
                <td className={r.mean_skill != null && r.mean_skill > 0 ? "is-good" : "is-weak"}>{percent(r.mean_skill)}</td>
                <td>{percent(r.share_beating_persistence)}</td>
                <td>{r.mean_rmse_m == null ? "—" : `${(r.mean_rmse_m * 100).toFixed(1)} cm`}</td>
                <td>{percent(r.mean_coverage80)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="ios-muted ios-small ios-source">Metrics are calculated on held-out observations from the live gauge forecasting pipeline. They describe historical test performance, not a guarantee about the next event.</p>
      </section>
    </div>
  );
}
