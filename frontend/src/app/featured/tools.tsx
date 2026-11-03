"use client";

import { useState } from "react";
import { API_URL, AiStatus, Icon, SourceStatus, api, postJson } from "./shared";
import { SystemPanel } from "./system";

type Segmentation = {
  annotated_image: string;
  detections: number;
  segmented_share_of_image: number;
  model: string;
  warnings: string[];
  diagnostics: { code: string; message: string; severity: string }[];
  limitations: string[] | string;
};

type Graphic = { topic: string; b64?: string | null; url?: string | null; label: string; model: string };

type ValidationReport = {
  rows_received: number;
  rows_valid: number;
  rows_rejected: number;
  duplicates_removed: number;
  issues: Record<string, number>;
  stations: string[];
  period_start: string | null;
  period_end: string | null;
  errors: string[];
};

type Preview = { filename: string; report: ValidationReport; unknown_stations: string[] };

type NewStationForm = {
  id: string; name: string; river: string; latitude: string; longitude: string;
  advisory_m: string; warning_m: string; critical_m: string; threshold_source: string;
};

const TOPICS = [
  { id: "go-bag", title: "Go-bag checklist", icon: Icon.bag },
  { id: "evacuation", title: "Evacuating early", icon: Icon.compass },
  { id: "home", title: "Protecting your home", icon: Icon.shield },
];

const TIMEZONES = ["Asia/Manila", "UTC", "Asia/Jakarta", "Asia/Tokyo", "Europe/London", "America/New_York"];

function AiNote({ aiStatus }: { aiStatus: AiStatus | null }) {
  if (!aiStatus || aiStatus.configured) return null;
  return <p className="ios-note">Needs a Meta Model API key. See the Ask tab for setup.</p>;
}

function PhotoCheck({ aiStatus }: { aiStatus: AiStatus | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("floodwater");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Segmentation | null>(null);

  const pick = (f: File | null) => {
    setFile(f);
    setResult(null);
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("prompt", prompt || "floodwater");
    try {
      setResult(await api<Segmentation>("/api/ai/segment", { method: "POST", body: form }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const limitations = result ? ([] as string[]).concat(result.limitations ?? []) : [];

  return (
    <section className="ios-card ios-tool" id="tool-photo">
      <span className="ios-card-label">Flood photo check with SAM 3.1</span>
      <h3>Find floodwater in a photo</h3>
      <p className="ios-muted">Upload a photo from the field. The model outlines the water so you can see how much of the scene is flooded.</p>
      <AiNote aiStatus={aiStatus} />
      <label className={`ios-drop ${preview ? "has-file" : ""}`}>
        <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        {result ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.annotated_image} alt="Photo with detected floodwater highlighted" />
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected photo" />
        ) : (
          <span className="ios-drop-empty">{Icon.upload}Click to choose a photo<small>JPG or PNG</small></span>
        )}
      </label>
      <div className="ios-form-row">
        <input className="ios-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What to look for" aria-label="What to look for" />
        <button className="ios-primary ios-primary-inline" onClick={analyze} disabled={!file || busy}>{busy ? "Analyzing…" : "Analyze photo"}</button>
      </div>
      {error && <p className="ios-error">{error}</p>}
      {result && (
        <div className="ios-result">
          <div className="ios-stats">
            <span><strong>{result.detections}</strong><small>areas found</small></span>
            <span><strong>{Math.round(result.segmented_share_of_image * 100)}%</strong><small>of the photo</small></span>
          </div>
          {[...result.warnings, ...result.diagnostics.map((d) => d.message)].map((w, i) => <p key={i} className="ios-note">{w}</p>)}
          {limitations.length > 0 && <p className="ios-muted ios-small">{limitations.join(" ")}</p>}
        </div>
      )}
    </section>
  );
}

function Preparedness({ aiStatus }: { aiStatus: AiStatus | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [graphic, setGraphic] = useState<Graphic | null>(null);

  const generate = async (topic: string) => {
    setBusy(topic);
    setError(null);
    try {
      setGraphic(await postJson<Graphic>("/api/ai/preparedness-graphic", { topic }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Muse Image may return WebP, JPEG or PNG; detect from the base64 magic bytes.
  const ext = graphic?.b64?.startsWith("UklGR") ? "webp" : graphic?.b64?.startsWith("/9j/") ? "jpeg" : "png";
  const src = graphic?.b64 ? `data:image/${ext};base64,${graphic.b64}` : graphic?.url ?? null;

  return (
    <section className="ios-card ios-tool" id="tool-poster">
      <span className="ios-card-label">Preparedness posters with Muse Image</span>
      <h3>Make a community illustration</h3>
      <p className="ios-muted">Generate a simple picture to share with residents before the water rises.</p>
      <AiNote aiStatus={aiStatus} />
      <div className="ios-topic-grid">
        {TOPICS.map((t) => (
          <button key={t.id} className={`ios-topic ${graphic?.topic === t.id ? "is-active" : ""}`} onClick={() => generate(t.id)} disabled={!!busy}>
            <span aria-hidden>{t.icon}</span>
            {busy === t.id ? "Creating…" : t.title}
          </button>
        ))}
      </div>
      {error && <p className="ios-error">{error}</p>}
      {src && (
        <figure className="ios-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Illustration: ${TOPICS.find((t) => t.id === graphic?.topic)?.title}`} />
          <figcaption>
            {graphic?.label}
            <a href={src} download={`hydrosentinel-${graphic?.topic}.${ext === "jpeg" ? "jpg" : ext}`}>Download</a>
          </figcaption>
        </figure>
      )}
    </section>
  );
}

function emptyStation(id: string): NewStationForm {
  return { id, name: id, river: "", latitude: "", longitude: "", advisory_m: "", warning_m: "", critical_m: "", threshold_source: "" };
}

function ImportData({ onImported }: { onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [timezone, setTimezone] = useState("Asia/Manila");
  const [simulated, setSimulated] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [stations, setStations] = useState<NewStationForm[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const form = () => {
    const f = new FormData();
    f.append("file", file as File);
    f.append("source_timezone", timezone);
    return f;
  };

  const runPreview = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const p = await api<Preview>("/api/data/preview", { method: "POST", body: form() });
      setPreview(p);
      setStations(p.unknown_stations.map(emptyStation));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    setError(null);
    const f = form();
    f.append("is_simulated", String(simulated));
    f.append(
      "new_stations",
      JSON.stringify(
        stations.map((s) => ({
          ...s,
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
          timezone,
          advisory_m: Number(s.advisory_m),
          warning_m: Number(s.warning_m),
          critical_m: Number(s.critical_m),
        })),
      ),
    );
    try {
      const res = await api<{ dataset: { rows_imported?: number; name: string } }>("/api/data/import", { method: "POST", body: f });
      setDone(`Imported ${res.dataset.rows_imported ?? "all"} readings from ${res.dataset.name}.`);
      setPreview(null);
      setFile(null);
      onImported();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetDemo = async () => {
    if (!window.confirm("Add the simulated demo stations? They appear next to the live gauges, labelled as demo data.")) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/demo/reset", { method: "POST" });
      setDone("Demo stations added. Restart the backend to return to live data only.");
      onImported();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, key: keyof NewStationForm, value: string) =>
    setStations((list) => list.map((s, j) => (j === i ? { ...s, [key]: value } : s)));

  const stationsComplete = stations.every(
    (s) => s.name && s.latitude && s.longitude && s.advisory_m && s.warning_m && s.critical_m && s.threshold_source.length >= 3,
  );
  const r = preview?.report;

  return (
    <section className="ios-card ios-tool ios-tool-wide" id="tool-import">
      <span className="ios-card-label">Your data</span>
      <h3>Import river readings</h3>
      <p className="ios-muted">
        Upload a CSV with <code>timestamp, station_id, water_level_m, rainfall_mm</code>. We check every row before anything is saved.{" "}
        <a className="ios-inline-link" href={`${API_URL}/api/data/template`} download="hydrosentinel-template.csv">Download template</a>
        {" "}or{" "}
        <a className="ios-inline-link" href="/samples/demo-scenario-marikina-typhoon-synthetic.csv" download>try the demo scenario</a>{" "}
        (a synthetic typhoon at a Marikina gauge, with real-world gaps and one duplicate row). Checking a file is open to everyone; importing it needs the admin key.
      </p>
      <div className="ios-form-row">
        <label className="ios-file">
          <input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setDone(null); }} />
          <span>{file ? file.name : "Choose CSV file…"}</span>
        </label>
        <select className="ios-input ios-select" value={timezone} onChange={(e) => setTimezone(e.target.value)} aria-label="Timezone of the timestamps">
          {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
        </select>
        <button className="ios-primary ios-primary-inline" onClick={runPreview} disabled={!file || busy}>{busy && !preview ? "Checking…" : "Check file"}</button>
      </div>

      {r && (
        <div className="ios-result">
          <div className="ios-stats">
            <span><strong>{r.rows_valid.toLocaleString()}</strong><small>good rows</small></span>
            <span><strong className={r.rows_rejected ? "is-up" : ""}>{r.rows_rejected}</strong><small>rejected</small></span>
            <span><strong>{r.duplicates_removed}</strong><small>duplicates</small></span>
            <span><strong>{r.stations.length}</strong><small>{r.stations.length === 1 ? "station" : "stations"}</small></span>
          </div>
          {r.period_start && <p className="ios-muted ios-small">Covers {new Date(r.period_start).toLocaleString()} to {r.period_end && new Date(r.period_end).toLocaleString()}</p>}
          {Object.keys(r.issues).length > 0 && (
            <ul className="ios-issues">
              {Object.entries(r.issues).map(([k, n]) => <li key={k}>{k.replaceAll("_", " ")}: <b>{n}</b></li>)}
            </ul>
          )}
          {r.errors.map((e, i) => <p key={i} className="ios-error">{e}</p>)}

          {stations.length > 0 && (
            <div className="ios-new-stations">
              <strong>New stations — tell us where they are</strong>
              <p className="ios-muted ios-small">Thresholds are your project&apos;s levels, not official warnings. Note where they came from.</p>
              {stations.map((s, i) => (
                <fieldset key={s.id}>
                  <legend>{s.id}</legend>
                  <input className="ios-input" placeholder="Name" value={s.name} onChange={(e) => update(i, "name", e.target.value)} />
                  <input className="ios-input" placeholder="River" value={s.river} onChange={(e) => update(i, "river", e.target.value)} />
                  <input className="ios-input" type="number" step="any" placeholder="Latitude" value={s.latitude} onChange={(e) => update(i, "latitude", e.target.value)} />
                  <input className="ios-input" type="number" step="any" placeholder="Longitude" value={s.longitude} onChange={(e) => update(i, "longitude", e.target.value)} />
                  <input className="ios-input" type="number" step="any" placeholder="Watch level (m)" value={s.advisory_m} onChange={(e) => update(i, "advisory_m", e.target.value)} />
                  <input className="ios-input" type="number" step="any" placeholder="Prepare level (m)" value={s.warning_m} onChange={(e) => update(i, "warning_m", e.target.value)} />
                  <input className="ios-input" type="number" step="any" placeholder="Act-now level (m)" value={s.critical_m} onChange={(e) => update(i, "critical_m", e.target.value)} />
                  <input className="ios-input" placeholder="Threshold source" value={s.threshold_source} onChange={(e) => update(i, "threshold_source", e.target.value)} />
                </fieldset>
              ))}
            </div>
          )}

          <div className="ios-form-row">
            <label className="ios-check">
              <input type="checkbox" checked={simulated} onChange={(e) => setSimulated(e.target.checked)} /> This is test / simulated data
            </label>
            <button className="ios-primary ios-primary-inline" onClick={runImport} disabled={busy || r.errors.length > 0 || r.rows_valid === 0 || !stationsComplete}>
              {busy ? "Importing…" : `Import ${r.rows_valid.toLocaleString()} rows`}
            </button>
          </div>
        </div>
      )}
      {error && <p className="ios-error">{error}</p>}
      {done && <p className="ios-success ios-with-icon">{Icon.check}{done}</p>}
      <div className="ios-tool-foot">
        <button className="ios-text-btn is-danger" onClick={resetDemo} disabled={busy}>{Icon.reset}Add demo scenario</button>
      </div>
    </section>
  );
}

const JUMPS = [
  { id: "tool-system", label: "System & admin", icon: Icon.server },
  { id: "tool-photo", label: "Flood photo check", icon: Icon.image },
  { id: "tool-poster", label: "Community posters", icon: Icon.bag },
  { id: "tool-import", label: "Import data", icon: Icon.upload },
];

export function ToolsView({ aiStatus, sources, onDataChanged }: { aiStatus: AiStatus | null; sources: SourceStatus; onDataChanged: () => void }) {
  return (
    <div className="ios-tools">
      <nav className="ios-jump" aria-label="Jump to a tool">
        {JUMPS.map((j) => (
          <a key={j.id} href={`#${j.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(j.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            {j.icon}{j.label}
          </a>
        ))}
      </nav>
      <SystemPanel aiStatus={aiStatus} sources={sources} onSynced={onDataChanged} />
      <PhotoCheck aiStatus={aiStatus} />
      <Preparedness aiStatus={aiStatus} />
      <ImportData onImported={onDataChanged} />
    </div>
  );
}
