"use client";

import { useEffect, useState } from "react";
import { API_URL, BacktestPoint, FullReport, Icon, api, downloadCsv, formatNumber, formatUtc } from "./shared";

const MODEL_LABEL: Record<string, string> = {
  persistence: "Persistence",
  damped_trend: "Damped trend",
  gradient_boosting: "Grad. boosting",
};

function pct(v: number | null | undefined) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function RainForecast({ weather }: { weather: NonNullable<FullReport["weather"]> }) {
  const next = weather.hourly.filter((h) => h.is_forecast).slice(0, 48);
  if (!next.length) return null;
  const max = Math.max(1, ...next.map((h) => h.precipitation_mm ?? 0));
  const W = 340;
  const H = 90;
  const bw = W / next.length;
  return (
    <div className="ios-card">
      <div className="ios-panel-head ios-panel-head-tight">
        <strong className="ios-with-icon">{Icon.rain}Rain, next 48 h</strong>
        <span className="ios-muted ios-small">Open-Meteo</span>
      </div>
      <div className="ios-kv-row">
        <span><small>Next 6 h</small><b>{formatNumber(weather.summary.next_6h_mm, 1)} mm</b></span>
        <span><small>Next 24 h</small><b>{formatNumber(weather.summary.next_24h_mm, 1)} mm</b></span>
        <span><small>Next 72 h</small><b>{formatNumber(weather.summary.next_72h_mm, 1)} mm</b></span>
        <span><small>Peak hour</small><b>{formatNumber(weather.summary.max_hourly_next_24h_mm, 1)} mm</b></span>
      </div>
      <svg className="ios-bars" viewBox={`0 0 ${W} ${H + 16}`} role="img" aria-label="Hourly rain forecast for the next 48 hours">
        {next.map((h, i) => {
          const v = h.precipitation_mm ?? 0;
          const bh = (v / max) * H;
          return <rect key={h.time} x={i * bw + 0.5} y={H - bh} width={Math.max(bw - 1.5, 1)} height={Math.max(bh, v > 0 ? 1.5 : 0)} rx="1" />;
        })}
        <line x1="0" x2={W} y1={H} y2={H} className="ios-bars-axis" />
        <text x="0" y={H + 13} className="ios-flow-axis">Now</text>
        <text x={W / 2} y={H + 13} textAnchor="middle" className="ios-flow-axis">+24 h</text>
        <text x={W} y={H + 13} textAnchor="end" className="ios-flow-axis">+48 h</text>
      </svg>
    </div>
  );
}

function ModelTable({ report }: { report: FullReport }) {
  const horizons = report.forecast.horizons ?? [];
  if (!horizons.length) return null;
  return (
    <div className="ios-card">
      <div className="ios-panel-head ios-panel-head-tight">
        <strong className="ios-with-icon">{Icon.cpu}Model diagnostics</strong>
        <span className={`ios-tag ${report.forecast.ml_available ? "is-live" : ""}`}>{report.forecast.ml_available ? "ML on" : "Baselines only"}</span>
      </div>
      <div className="ios-table-wrap">
        <table className="ios-table">
          <thead>
            <tr><th>Ahead</th><th>Model</th><th>Skill</th><th>RMSE</th><th>Cov. 80%</th></tr>
          </thead>
          <tbody>
            {horizons.map((h) => {
              const m = h.test_metrics[h.selected_model];
              const skill = h.skill_vs_persistence[h.selected_model];
              return (
                <tr key={h.horizon_h}>
                  <td>{h.horizon_h} h</td>
                  <td>{MODEL_LABEL[h.selected_model] ?? h.selected_model}</td>
                  <td className={skill > 0 ? "is-good" : "is-weak"}>{skill == null ? "—" : `${skill > 0 ? "+" : ""}${Math.round(skill * 100)}%`}</td>
                  <td>{m ? `${(m.rmse * 100).toFixed(1)} cm` : "—"}</td>
                  <td>{pct(h.interval_coverage_test.p80)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="ios-muted ios-small ios-source">
        Skill = RMSE improvement over a persistence baseline on held-out test data. Coverage = share of test readings inside the
        80% interval (target 80%). {report.forecast.split?.method}.
      </p>
    </div>
  );
}

function BacktestChart({ points, horizon }: { points: BacktestPoint[]; horizon: string }) {
  const pts = points.slice(-120);
  if (pts.length < 2) return <p className="ios-muted ios-small">Not enough test data for this horizon.</p>;
  const W = 340;
  const H = 150;
  const vals = pts.flatMap((p) => [p.actual_m, p.predicted_m, p.persistence_m, p.lo80_m, p.hi80_m]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => 6 + (1 - (v - lo) / Math.max(hi - lo, 0.01)) * (H - 12);
  const line = (key: keyof BacktestPoint) => pts.map((p, i) => `${x(i)},${y(p[key] as number)}`).join(" ");
  const band = `${pts.map((p, i) => `${x(i)},${y(p.hi80_m)}`).join(" ")} ${[...pts].reverse().map((p, i) => `${x(pts.length - 1 - i)},${y(p.lo80_m)}`).join(" ")}`;
  const mae = (k: "predicted_m" | "persistence_m") => pts.reduce((s, p) => s + Math.abs(p[k] - p.actual_m), 0) / pts.length;
  return (
    <>
      <svg className="ios-flow" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Backtest at ${horizon} hours: forecast versus actual`}>
        <polygon points={band} className="ios-flow-band" />
        <polyline points={line("persistence_m")} className="ios-bt-persist" />
        <polyline points={line("actual_m")} className="ios-bt-actual" />
        <polyline points={line("predicted_m")} className="ios-flow-past" pathLength={1} />
      </svg>
      <div className="ios-legend-row">
        <span><i className="ios-key is-actual" />Actual</span>
        <span><i className="ios-key is-model" />Forecast · MAE {(mae("predicted_m") * 100).toFixed(1)} cm</span>
        <span><i className="ios-key is-persist" />Persistence · MAE {(mae("persistence_m") * 100).toFixed(1)} cm</span>
      </div>
    </>
  );
}

function Backtests({ report }: { report: FullReport }) {
  const tests = report.forecast.backtests ?? {};
  const keys = Object.keys(tests).sort((a, b) => Number(a) - Number(b));
  const [horizon, setHorizon] = useState(keys.includes("6") ? "6" : keys[0]);
  if (!keys.length || !horizon) return null;
  return (
    <div className="ios-card">
      <div className="ios-panel-head ios-panel-head-tight">
        <strong className="ios-with-icon">{Icon.activity}Backtest, out of sample</strong>
      </div>
      <div className="ios-chips" role="tablist" aria-label="Forecast horizon">
        {keys.map((k) => (
          <button key={k} role="tab" aria-selected={k === horizon} className={k === horizon ? "is-active" : ""} onClick={() => setHorizon(k)}>
            {k} h ahead
          </button>
        ))}
      </div>
      <BacktestChart points={tests[horizon]} horizon={horizon} />
    </div>
  );
}

function Provenance({ report }: { report: FullReport }) {
  const st = report.station;
  const pre = report.forecast.preprocessing ?? {};
  const split = report.forecast.split;
  const history = (report.forecast as { history?: { time: string; water_level_m: number | null; rainfall_mm: number }[] }).history ?? [];
  return (
    <div className="ios-card">
      <div className="ios-panel-head ios-panel-head-tight">
        <strong className="ios-with-icon">{Icon.database}Data &amp; provenance</strong>
      </div>
      <dl className="ios-dl">
        <dt>Station ID</dt><dd><code>{st.id}</code></dd>
        <dt>Coordinates</dt><dd>{st.latitude.toFixed(4)}, {st.longitude.toFixed(4)}</dd>
        <dt>Timezone</dt><dd>{st.timezone ?? "UTC"}</dd>
        <dt>Data kind</dt><dd>{report.freshness.data_kind}</dd>
        <dt>Last reading</dt><dd>{formatUtc(report.freshness.last_observation_at)} ({formatNumber(report.freshness.age_hours, 1)} h old)</dd>
        <dt>Hourly series</dt><dd>{pre.hours ?? "—"} h · {pre.spikes_removed ?? 0} spikes removed · {pre.level_interpolated ?? 0} gaps filled</dd>
        {split && <><dt>Train window</dt><dd>{formatUtc(split.train_start)} to {formatUtc(split.calibration_start)}</dd></>}
        {split && <><dt>Test window</dt><dd>{formatUtc(split.test_start)} to {formatUtc(split.test_end)}</dd></>}
        {report.provenance.map((p) => (
          <div key={p.dataset_id} className="ios-dl-group">
            <dt>Dataset #{p.dataset_id}</dt>
            <dd>{p.name} · {p.readings.toLocaleString()} readings</dd>
          </div>
        ))}
      </dl>
      <div className="ios-form-row">
        <a className="ios-text-btn" href={`${API_URL}/api/stations/${encodeURIComponent(st.id)}/export.csv`} download>
          {Icon.download}ALL READINGS (CSV)
        </a>
        <button
          className="ios-text-btn"
          onClick={() => downloadCsv(`${st.id}-hourly-7d.csv`, history.map((h) => ({ time_utc: h.time, water_level_m: h.water_level_m, rainfall_mm: h.rainfall_mm })))}
          disabled={!history.length}
        >
          {Icon.download}HOURLY 7 DAYS
        </button>
      </div>
    </div>
  );
}

/** Technical panels for one gauge, loaded from the full station report. */
export function StationTechnical({ stationId }: { stationId: string }) {
  const [report, setReport] = useState<FullReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<FullReport>(`/api/stations/${encodeURIComponent(stationId)}`)
      .then((r) => alive && setReport(r))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [stationId]);

  if (error) return <p className="ios-error">{error}</p>;
  if (!report) return <div className="ios-card"><i className="ios-skeleton ios-skeleton-row" /></div>;
  return (
    <>
      {report.weather && <RainForecast weather={report.weather} />}
      <ModelTable report={report} />
      <Backtests report={report} />
      <Provenance report={report} />
    </>
  );
}
