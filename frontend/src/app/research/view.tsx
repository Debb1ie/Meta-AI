"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "../featured/shared";
import type { Basin } from "./flow3d";

const Flow3D = dynamic(() => import("./flow3d").then((m) => m.Flow3D), {
  ssr: false,
  loading: () => <div className="rx-canvas rx-loading">Loading the 3D layer…</div>,
});

type Params = {
  glofas: { source: string; grid_deg: number; basins: number; history_days: number; forecast_days: number; climatology_years: number; alert_percentiles: Record<string, number>; outlook_window_days: number; trend_window_days: number; trend_threshold_pct: number; cache_hours: number };
  preprocessing: { level_bounds_m: number[]; rain_bounds_mm_per_h: number[]; max_interpolation_gap_h: number; hampel_window_h: number; hampel_sigmas: number; future_tolerance_min: number };
  forecasting: {
    horizons_h: number[]; headline_horizons_h: number[]; split: { train: number; calibration: number; test: number };
    min_hours_for_evaluation: number; min_hours_for_ml: number; min_regime_samples: number; backtest_days: number;
    level_lags_h: number[]; rain_windows_h: number[]; trend_window_h: number; trend_damping: number; gbm: Record<string, number>; regime_rule: string;
  };
  risk: { levels: string[]; near_term_h: number; stale_data_h: number };
  hazards: { ph_centre: number[]; near_km: number; affects_km: number; cache_minutes: number };
  agent: { max_steps: number; tools: string[]; languages: string[]; number_tolerance: string };
};
type HorizonSummary = { horizon_h: number; gauges: number; mean_skill: number | null; share_beating_persistence: number | null; mean_rmse_m: number | null; mean_coverage80: number | null; mean_coverage95: number | null; models_selected: Record<string, number> };
type Research = { parameters: Params; evaluation: { summary: HorizonSummary[]; gauges: { id: string; name: string }[] } };

const MODEL_NAME: Record<string, string> = { persistence: "persistence", damped_trend: "damped trend", gradient_boosting: "gradient boosting" };
const pct = (v: number | null | undefined, d = 0) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const fmt = (v: number) => Math.round(v).toLocaleString("en-US");
const dayLabel = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

// Same ramp as the 3D layer, as CSS colours for the 2D heat map.
function heatCss(r: number) {
  const stops: [number, number[]][] = [[0, [46, 139, 87]], [0.5, [141, 191, 90]], [0.85, [224, 177, 42]], [1, [229, 134, 44]], [1.4, [200, 50, 31]]];
  if (!Number.isFinite(r)) return "#EEF2F0";
  for (let i = 1; i < stops.length; i++) {
    const [r0, c0] = stops[i - 1];
    const [r1, c1] = stops[i];
    if (r <= r1) {
      const t = Math.max(0, (r - r0) / (r1 - r0));
      return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * t)).join(",")})`;
    }
  }
  return "rgb(200,50,31)";
}

export function ResearchView() {
  const [basins, setBasins] = useState<Basin[]>([]);
  const [research, setResearch] = useState<Research | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    api<{ rivers: Basin[] }>("/api/outlook").then((d) => setBasins(d.rivers)).catch((e: Error) => setError(e.message));
    api<Research>("/api/research").then(setResearch).catch(() => {});
  }, []);

  // Dates: 7 days back to the end of the forecast, shared by every basin.
  const { dates, todayIndex } = useMemo(() => {
    if (!basins.length) return { dates: [] as string[], todayIndex: 0 };
    const today = basins[0].current_date;
    const all = Array.from(new Set(basins.flatMap((b) => b.series.map((p) => p.date)))).sort();
    const start = Math.max(0, all.indexOf(today) - 7);
    const ds = all.slice(start);
    return { dates: ds, todayIndex: ds.indexOf(today) };
  }, [basins]);

  useEffect(() => setDay(todayIndex), [todayIndex]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setDay((d) => (d + 1) % Math.max(1, dates.length)), 700);
    return () => window.clearInterval(t);
  }, [playing, dates.length]);

  const ratios = useMemo(
    () => basins.map((b) => {
      const m = new Map(b.series.map((p) => [p.date, p.discharge_m3s]));
      return dates.map((d) => (m.get(d) ?? NaN) / b.thresholds_m3s.advisory);
    }),
    [basins, dates],
  );
  const order = useMemo(() => basins.map((_, i) => i).sort((a, b) => Math.max(...ratios[b].filter(Number.isFinite)) - Math.max(...ratios[a].filter(Number.isFinite))), [basins, ratios]);
  const focus = basins.find((b) => b.id === hover);
  const focusIdx = focus ? basins.indexOf(focus) : -1;
  const p = research?.parameters;

  return (
    <main className="lp rx">
      <nav className="rx-top shell">
        <Link href="/" className="rx-brand"><span className="brand-mark">H</span> HydroSentinel</Link>
        <span className="rx-top-links"><Link href="/featured">Dashboard</Link><Link href="/spatial">Spatial mapping</Link><a href="#method">Method</a><a href="#results">Results</a><a href="#limits">Limitations</a></span>
      </nav>

      <header className="shell rx-head">
        <p className="rx-kicker">Research</p>
        <h1>Forecast river flow across the Philippines, <em>in three dimensions.</em></h1>
        <p className="rx-lede">
          Each column is a river basin. Its height and colour show the modelled flow divided by that basin&apos;s own watch level,
          so a small river and the Cagayan sit on the same scale. Move the slider through the past week and the forecast.
        </p>
      </header>

      <section className="shell rx-stage" aria-label="3D forecast layer">
        {error && <p className="rx-error">Live data is unavailable: {error}</p>}
        <div className="rx-viz">
          {basins.length > 0 && <Flow3D basins={basins} dates={dates} dayIndex={day} onHover={setHover} />}
          <div className="rx-overlay">
            <p className="rx-date">{dates[day] ? `${dayLabel(dates[day])}${day === todayIndex ? " (today)" : day > todayIndex ? " (forecast)" : " (past)"}` : "—"}</p>
            {focus && focusIdx >= 0 ? (
              <div className="rx-hover">
                <strong>{focus.name}</strong>
                <span>{focus.region.replace(" · ", ", ")}</span>
                <span>{fmt(ratios[focusIdx][day] * focus.thresholds_m3s.advisory)} m³/s, {pct(ratios[focusIdx][day])} of its watch level</span>
              </div>
            ) : (
              <p className="rx-hint">Drag to orbit, scroll to zoom, hover a column for details.</p>
            )}
          </div>
        </div>
        <div className="rx-controls">
          <button type="button" onClick={() => setPlaying((v) => !v)} aria-pressed={playing}>{playing ? "Pause" : "Play"}</button>
          <input type="range" min={0} max={Math.max(0, dates.length - 1)} value={day} onChange={(e) => { setPlaying(false); setDay(Number(e.target.value)); }} aria-label="Day" />
          <button type="button" onClick={() => { setPlaying(false); setDay(todayIndex); }}>Today</button>
        </div>
        <div className="rx-legend" aria-hidden>
          <span>Flow ÷ watch level</span>
          <i style={{ background: "linear-gradient(90deg, rgb(46,139,87), rgb(141,191,90) 35%, rgb(224,177,42) 60%, rgb(229,134,44) 72%, rgb(200,50,31))" }} />
          <span className="rx-legend-scale"><b>0%</b><b>50%</b><b>100% (watch)</b><b>140%+</b></span>
        </div>
      </section>

      <section className="shell rx-section" aria-labelledby="heat-title">
        <h2 id="heat-title">Heat map: every basin, every day</h2>
        <p>Rows are basins, ordered by their highest ratio in the window; columns are days. The outlined column is today. Hover a cell for its value.</p>
        <div className="rx-heat" role="table" aria-label="Flow as a share of watch level by basin and day">
          {order.map((i) => (
            <div className="rx-heat-row" role="row" key={basins[i].id}>
              <span className="rx-heat-name" role="rowheader">{basins[i].name}</span>
              <span className="rx-heat-cells">
                {dates.map((d, j) => (
                  <i key={d} role="cell" className={j === todayIndex ? "is-today" : j === day ? "is-day" : undefined} style={{ background: heatCss(ratios[i][j]) }}
                    title={`${basins[i].name}, ${dayLabel(d)}: ${Number.isFinite(ratios[i][j]) ? `${fmt(ratios[i][j] * basins[i].thresholds_m3s.advisory)} m³/s (${pct(ratios[i][j])} of watch)` : "no value"}`} />
                ))}
              </span>
            </div>
          ))}
          {dates.length > 0 && (
            <div className="rx-heat-row rx-heat-axis" aria-hidden>
              <span />
              <span className="rx-heat-cells rx-heat-dates">
                <b>{dayLabel(dates[0])}</b>
                <b className="rx-heat-today" style={{ left: `${((todayIndex + 0.5) / dates.length) * 100}%` }}>Today</b>
                <b>{dayLabel(dates[dates.length - 1])}</b>
              </span>
            </div>
          )}
        </div>
      </section>

      <article className="shell rx-paper" id="method">
        <h2>Abstract</h2>
        <p>
          HydroSentinel is a flood early-warning system for Philippine communities. It combines a modelled 30-day river discharge
          outlook for {p?.glofas.basins ?? 17} Philippine basins, live disaster alerts, measured river stage used to validate a short-range
          forecasting engine, and a tool-using language-model agent whose numerical claims are verified against their sources before
          publication. This page documents the data, parameters, methods and live evaluation, all read from the running system.
        </p>

        <h2>1. Data</h2>
        <div className="rx-table-wrap">
          <table className="rx-table">
            <thead><tr><th>Source</th><th>Variable</th><th>Resolution</th><th>Window</th><th>Use</th></tr></thead>
            <tbody>
              <tr><td>GloFAS v4 via Open-Meteo Flood API</td><td>River discharge Q (m³/s), ensemble median, p25, p75</td><td>Daily, {p?.glofas.grid_deg ?? 0.05}° grid</td><td>{p?.glofas.history_days ?? 30} days back, {p?.glofas.forecast_days ?? 30} days ahead; {p?.glofas.climatology_years ?? 5}-year climatology</td><td>Philippine outlook, alert levels</td></tr>
              <tr><td>UK Environment Agency flood-monitoring API</td><td>River stage (m)</td><td>15 minutes, resampled hourly</td><td>About 30 days rolling</td><td>Training and validating the forecasting engine</td></tr>
              <tr><td>Open-Meteo forecast API</td><td>Precipitation (mm)</td><td>Hourly</td><td>Past 30 days, next 72 h</td><td>Model features (observed) and context (forecast)</td></tr>
              <tr><td>GDACS</td><td>Tropical cyclones and floods: alert level, position, severity</td><td>Event</td><td>Current events</td><td>Hazard context for the agent and maps</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Grid cells for each basin were chosen on the main channel: the cell with the highest mean discharge within roughly 15 km of the
          named place, because a 0.05° grid can misplace small rivers. The Pasig–Marikina system is therefore represented at its Manila Bay outlet.
        </p>

        <h2>2. Basin alert levels and trend</h2>
        <p>
          For basin b, the watch, prepare and act levels are the {p ? Object.values(p.glofas.alert_percentiles).join("th, ") : "95th, 99th"}th percentiles
          of its daily discharge over the last {p?.glofas.climatology_years ?? 5} years, so they are exceeded on about
          {" "}{p ? Object.values(p.glofas.alert_percentiles).map((q) => (365 * (1 - q / 100)).toFixed(1)).join(", ") : "18, 3.7, 0.7"} days a year respectively.
          The status of a basin is the highest level reached by today&apos;s value or by the forecast peak within {p?.glofas.outlook_window_days ?? 7} days.
          A basin is rising or falling when the relative change over {p?.glofas.trend_window_days ?? 3} days exceeds ±{p?.glofas.trend_threshold_pct ?? 15}%.
          The visual layers above plot r = Q / Q<sub>watch</sub>.
        </p>

        <h2>3. Gauge preprocessing</h2>
        <p>
          Readings outside [{p?.preprocessing.level_bounds_m.join(", ")}] m or [{p?.preprocessing.rain_bounds_mm_per_h.join(", ")}] mm/h, duplicates, and readings
          more than {p?.preprocessing.future_tolerance_min} minutes in the future are rejected. Stage is averaged hourly and despiked with a Hampel filter
          (window {p?.preprocessing.hampel_window_h} h, threshold {p?.preprocessing.hampel_sigmas}σ with σ = 1.4826 × MAD). Gaps of up to
          {" "}{p?.preprocessing.max_interpolation_gap_h} h are interpolated in time; longer gaps stay missing.
        </p>

        <h2>4. Forecasting models</h2>
        <p>
          For horizons h ∈ {"{"}{p?.forecasting.horizons_h.join(", ")}{"}"} hours, three models compete: persistence (ŷ = y<sub>t</sub>), a damped trend
          over {p?.forecasting.trend_window_h} h with damping φ = {p?.forecasting.trend_damping}, and histogram gradient boosting predicting the change in level from level
          differences at lags {p?.forecasting.level_lags_h.join(", ")} h and rainfall totals over {p?.forecasting.rain_windows_h.join(", ")} h
          {p && <> (max iterations {p.forecasting.gbm.max_iter}, learning rate {p.forecasting.gbm.learning_rate}, {p.forecasting.gbm.max_leaf_nodes} leaves, minimum {p.forecasting.gbm.min_samples_leaf} samples per leaf, L2 {p.forecasting.gbm.l2_regularization})</>}.
          Gradient boosting is enabled only with at least {p ? p.forecasting.min_hours_for_ml / 24 : 21} days of data.
        </p>

        <h2>5. Evaluation design</h2>
        <p>
          Forecast origins are split chronologically {p ? `${pct(p.forecasting.split.train)} / ${pct(p.forecasting.split.calibration)} / ${pct(p.forecasting.split.test)}` : "70 / 10 / 20"} into
          training, calibration and test sets, purging any sample whose target time crosses a boundary. The model with the lowest calibration RMSE is
          selected per horizon. Skill is reported on the test set as S = 1 − RMSE<sub>model</sub> / RMSE<sub>persistence</sub>, so S &gt; 0 means the
          model beats &ldquo;no change&rdquo;. Prediction intervals are split-conformal residual quantiles, calibrated separately for two regimes
          ({p?.forecasting.regime_rule}; at least {p?.forecasting.min_regime_samples} samples per regime), and their empirical coverage is reported.
        </p>

        <h2>6. The verifiable agent</h2>
        <p>
          A Muse Spark agent runs up to {p?.agent.max_steps ?? 8} tool-calling steps over {p?.agent.tools.length ?? 6} tools ({p?.agent.tools.join(", ")}). Each tool result is
          stored as evidence E<sub>i</sub>. A second, schema-constrained call writes the briefing, in which every claim must cite evidence ids, plus SMS text in
          {" "}{p?.agent.languages.join(", ")}. The server then extracts every number from each claim (ignoring dates and times) and accepts it only if it
          matches a number in the cited evidence within {p?.agent.number_tolerance}. The share of matched numbers is published with the briefing.
          Tool results are treated as untrusted data in the prompt.
        </p>

        <h2 id="results">7. Results (live, out of sample)</h2>
        {research ? (
          <div className="rx-table-wrap">
            <table className="rx-table">
              <thead><tr><th>Horizon</th><th>Gauges</th><th>Mean skill S</th><th>Beat persistence</th><th>Mean RMSE</th><th>80% interval coverage</th><th>Models selected</th></tr></thead>
              <tbody>
                {research.evaluation.summary.map((s) => (
                  <tr key={s.horizon_h}>
                    <td>{s.horizon_h} h</td>
                    <td>{s.gauges}</td>
                    <td>{s.mean_skill == null ? "—" : s.mean_skill.toFixed(2)}</td>
                    <td>{pct(s.share_beating_persistence)}</td>
                    <td>{s.mean_rmse_m == null ? "—" : `${(s.mean_rmse_m * 100).toFixed(1)} cm`}</td>
                    <td>{pct(s.mean_coverage80)} <small>(target 80%)</small></td>
                    <td>{Object.entries(s.models_selected).map(([m, n]) => `${MODEL_NAME[m] ?? m} ${n}`).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rx-muted">Loading the live evaluation…</p>
        )}
        <p className="rx-muted">Computed now from {research?.evaluation.gauges.length ?? "the"} measured gauges; values change as new data arrives.</p>

        <h2 id="limits">8. Limitations and threats to validity</h2>
        <ul>
          <li>GloFAS is a hydrological model, not a gauge. Its coarse grid can misrepresent small or urban rivers, and its forecasts inherit weather-forecast error.</li>
          <li>Percentile alert levels describe how unusual a flow is for that river; they are not official PAGASA thresholds and do not map directly to flood depth.</li>
          <li>The forecasting engine is validated on UK gauges because no open real-time Philippine gauge feed exists; skill there is evidence the method works, not a measure of Philippine accuracy.</li>
          <li>Training windows are short (about 30 days), so rare high-flow events are under-represented in the test set.</li>
          <li>Forecast rainfall is shown as context but is not a model input, which limits skill at longer horizons.</li>
          <li>Verification checks numbers against their sources, not the reasoning between them; a correctly cited claim can still be poorly framed.</li>
        </ul>

        <h2>9. Reproducibility</h2>
        <p>
          Everything here is served by the public API: <code>/api/outlook</code> (basins and series), <code>/api/research</code> (parameters and
          evaluation), <code>/api/stations/&#123;id&#125;</code> (per-gauge diagnostics and backtests) and <code>/api/stations/&#123;id&#125;/export.csv</code>. The source
          code is at <a href="https://github.com/Debb1ie/Meta-AI" target="_blank" rel="noreferrer">github.com/Debb1ie/Meta-AI</a>.
        </p>

        <h2>References</h2>
        <ol className="rx-refs">
          <li>Harrigan, S. et al. (2020). GloFAS-ERA5 operational global river discharge reanalysis 1979–present. <i>Earth System Science Data</i>, 12, 2043–2060.</li>
          <li>Gardner, E. S. &amp; McKenzie, E. (1985). Forecasting trends in time series. <i>Management Science</i>, 31(10), 1237–1246.</li>
          <li>Hampel, F. R. (1974). The influence curve and its role in robust estimation. <i>Journal of the American Statistical Association</i>, 69(346), 383–393.</li>
          <li>Vovk, V., Gammerman, A. &amp; Shafer, G. (2005). <i>Algorithmic Learning in a Random World</i>. Springer.</li>
          <li>Lei, J. et al. (2018). Distribution-free predictive inference for regression. <i>Journal of the American Statistical Association</i>, 113(523), 1094–1111.</li>
          <li>Ke, G. et al. (2017). LightGBM: A highly efficient gradient boosting decision tree. <i>Advances in Neural Information Processing Systems</i> 30.</li>
          <li>Pedregosa, F. et al. (2011). Scikit-learn: Machine learning in Python. <i>Journal of Machine Learning Research</i>, 12, 2825–2830.</li>
          <li>PAGASA. Tropical cyclone information. pagasa.dost.gov.ph. GDACS, Global Disaster Alert and Coordination System. gdacs.org.</li>
        </ol>
      </article>
    </main>
  );
}
