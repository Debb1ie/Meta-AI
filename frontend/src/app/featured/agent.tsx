"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, Icon, LEVEL_INFO, api, formatUtc, postJson, timeAgo } from "./shared";

// ---------------------------------------------------------------- types (mirror backend/app/ai/agent.py)

type Claim = { text: string; evidence: string[] };
type WatchItem = { name: string; kind: "ph_basin" | "gauge" | "hazard"; level: string; reason: string; evidence: string[] };
type Action = { action: string; who: "residents" | "barangay" | "lgu_drrmo" | "operators"; priority: "immediate" | "soon" | "monitor" };

export type Briefing = {
  headline: string;
  overall_level: string;
  situation: Claim[];
  watchlist: WatchItem[];
  actions: Action[];
  alerts: Record<"en" | "fil" | "ceb" | "ilo" | "hil", string>;
  limitations: string[];
};

type Evidence = { tool: string; args: Record<string, unknown>; result: unknown; ok: boolean; ms: number };

export type AgentResult = {
  briefing: Briefing;
  verification: { claims: number; numbers_checked: number; numbers_verified: number; unverified: { claim: string; number: number }[]; unknown_evidence_ids: string[]; score: number };
  evidence: Record<string, Evidence>;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
  tool_calls: number;
  seconds: number;
  generated_at: string;
};

type AgentEvent =
  | { type: "status"; text: string }
  | { type: "thought"; text: string }
  | { type: "tool"; step: number; id: string; tool: string; args: Record<string, unknown>; ok: boolean; ms: number; preview: string }
  | ({ type: "final" } & AgentResult)
  | { type: "error"; text: string };

const LANGS: { id: keyof Briefing["alerts"]; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fil", label: "Filipino" },
  { id: "ceb", label: "Cebuano" },
  { id: "ilo", label: "Ilocano" },
  { id: "hil", label: "Hiligaynon" },
];

const TOOL_LABEL: Record<string, string> = {
  get_hazards: "Checked live hazards (GDACS)",
  list_ph_basins: "Scanned all Philippine basins",
  get_basin: "Inspected a basin forecast",
  get_rain_forecast: "Pulled the rain forecast",
  list_gauges: "Scanned the live gauges",
  get_gauge: "Inspected a gauge forecast",
};

const WHO_LABEL: Record<Action["who"], string> = { residents: "Residents", barangay: "Barangay", lgu_drrmo: "Local disaster office", operators: "App team" };
const PRIORITY_LABEL: Record<Action["priority"], string> = { immediate: "Do now", soon: "Do soon", monitor: "Keep watching" };

// ---------------------------------------------------------------- state

export type AgentState = ReturnType<typeof useAgent>;

/** Latest briefing plus a streaming run; shared by the Today card and the Agent tab. */
export function useAgent() {
  const [result, setResult] = useState<AgentResult | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refreshLatest = useCallback(() => {
    api<{ briefing: AgentResult | null; running: boolean }>("/api/ai/agent/latest")
      .then((d) => {
        if (d.briefing) setResult(d.briefing);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refreshLatest();
  }, [refreshLatest]);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setEvents([]);
    try {
      const res = await fetch(`${API_URL}/api/ai/agent/run`, { method: "POST" });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.detail === "string" ? body.detail : body.detail?.message ?? `Agent failed (${res.status}).`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as AgentEvent;
          setEvents((list) => [...list, event]);
          if (event.type === "final") setResult(event);
          if (event.type === "error") setError(event.text);
        }
      }
    } catch (err) {
      setError(err instanceof TypeError ? `Can't reach the server at ${API_URL}.` : (err as Error).message);
    } finally {
      setRunning(false);
    }
  }, []);

  return { result, events, running, error, loaded, run, refreshLatest };
}

// ---------------------------------------------------------------- pieces

function VerifiedBadge({ v }: { v: AgentResult["verification"] }) {
  const all = v.numbers_verified === v.numbers_checked && !v.unknown_evidence_ids.length;
  return (
    <span className={`ios-verify ${all ? "is-ok" : "is-warn"}`} title="Every number in the cited claims was checked against the tool output it cites.">
      {all ? Icon.shield : Icon.alert}
      {v.numbers_verified}/{v.numbers_checked} numbers verified
    </span>
  );
}

function Cites({ ids, onOpen }: { ids: string[]; onOpen: (id: string) => void }) {
  return (
    <>
      {ids.map((id) => (
        <button key={id} className="ios-cite" onClick={() => onOpen(id)} title={`Show evidence ${id}`}>{id}</button>
      ))}
    </>
  );
}

export function AlertComposer({ alerts, compact = false }: { alerts: Briefing["alerts"]; compact?: boolean }) {
  const [lang, setLang] = useState<keyof Briefing["alerts"]>("fil");
  const [copied, setCopied] = useState(false);
  const text = alerts[lang] ?? "";
  const segments = Math.max(1, Math.ceil(text.length / 153));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {}
    }
    copy();
  };

  return (
    <div className={`ios-alerts ${compact ? "is-compact" : ""}`}>
      <div className="ios-chips" role="tablist" aria-label="Alert language">
        {LANGS.map((l) => (
          <button key={l.id} role="tab" aria-selected={lang === l.id} className={lang === l.id ? "is-active" : ""} onClick={() => setLang(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <p className="ios-sms" lang={lang === "en" ? "en" : lang === "fil" ? "tl" : lang}>{text}</p>
      <div className="ios-form-row">
        <small className="ios-muted">{text.length} chars · {segments} SMS</small>
        <span className="ios-spacer" />
        <button className="ios-text-btn" onClick={copy}>{copied ? Icon.check : Icon.download}{copied ? "Copied" : "Copy"}</button>
        <button className="ios-text-btn" onClick={share}>{Icon.arrow}Share</button>
        <a className="ios-text-btn" href={`sms:?&body=${encodeURIComponent(text)}`}>{Icon.ask}SMS</a>
      </div>
    </div>
  );
}

function RunTimeline({ events, running }: { events: AgentEvent[]; running: boolean }) {
  const shown = events.filter((e) => e.type !== "final");
  if (!shown.length && !running) return null;
  return (
    <ol className="ios-timeline">
      {shown.map((e, i) => (
        <li key={i} className={`is-${e.type}`}>
          <i aria-hidden>{e.type === "tool" ? (e.ok ? Icon.check : Icon.alert) : e.type === "error" ? Icon.alert : Icon.spark}</i>
          {e.type === "tool" ? (
            <div>
              <strong>{TOOL_LABEL[e.tool] ?? e.tool} <span className="ios-cite is-static">{e.id}</span></strong>
              <small><code>{e.tool}({Object.values(e.args).map(String).join(", ")})</code> · {e.ms < 1000 ? `${e.ms} ms` : `${(e.ms / 1000).toFixed(1)} s`}</small>
              <small>{e.preview}</small>
            </div>
          ) : (
            <div><small className={e.type === "thought" ? "ios-thought" : ""}>{e.text}</small></div>
          )}
        </li>
      ))}
      {running && (
        <li className="is-status is-live">
          <i aria-hidden className="ios-pulse" />
          <div><small>Working…</small></div>
        </li>
      )}
    </ol>
  );
}

function EvidencePanel({ id, evidence, onClose }: { id: string; evidence?: Evidence; onClose: () => void }) {
  return (
    <div className="ios-card ios-evidence">
      <div className="ios-panel-head ios-panel-head-tight">
        <strong className="ios-with-icon">{Icon.database}Evidence {id}</strong>
        <button className="ios-close" onClick={onClose} aria-label="Close evidence">{Icon.close}</button>
      </div>
      {evidence ? (
        <>
          <p className="ios-muted ios-small"><code>{evidence.tool}({JSON.stringify(evidence.args)})</code> · {evidence.ms} ms · {evidence.ok ? "ok" : "failed"}</p>
          <pre>{JSON.stringify(evidence.result, null, 2)}</pre>
        </>
      ) : (
        <p className="ios-error">The agent cited {id}, but no tool call produced it.</p>
      )}
    </div>
  );
}

function Poster({ briefing }: { briefing: Briefing }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const top = briefing.watchlist[0];
      const r = await postJson<{ b64?: string | null; url?: string | null }>("/api/ai/alert-poster", {
        headline: briefing.headline,
        place: top?.kind === "ph_basin" ? top.name : "",
        level: briefing.overall_level,
      });
      const ext = r.b64?.startsWith("UklGR") ? "webp" : r.b64?.startsWith("/9j/") ? "jpeg" : "png";
      setSrc(r.b64 ? `data:image/${ext};base64,${r.b64}` : r.url ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ios-card">
      <div className="ios-panel-head ios-panel-head-tight">
        <strong className="ios-with-icon">{Icon.image}Community poster</strong>
        <span className="ios-tag">Muse Image</span>
      </div>
      <p className="ios-muted ios-small">An illustration matched to today&apos;s alert level, to pair with the SMS text above.</p>
      {src && (
        <figure className="ios-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Community poster for: ${briefing.headline}`} />
          <figcaption>AI-generated illustration (Muse Image)<a href={src} download="hydrosentinel-poster">Download</a></figcaption>
        </figure>
      )}
      {error && <p className="ios-error">{error}</p>}
      <button className="ios-text-btn" onClick={make} disabled={busy}>{Icon.image}{busy ? "Creating…" : src ? "Make another" : "Create poster"}</button>
    </div>
  );
}

// ---------------------------------------------------------------- Today card

export function AgentCard({ agent, onOpen }: { agent: AgentState; onOpen: () => void }) {
  const r = agent.result;
  return (
    <section className="ios-card ios-agent-card">
      <div className="ios-panel-head ios-panel-head-tight">
        <span className="ios-card-label ios-with-icon">{Icon.spark}Flood-watch agent</span>
        {r && <VerifiedBadge v={r.verification} />}
      </div>
      {r ? (
        <>
          <div className="ios-agent-head">
            <span className={`ios-chip lvl-${r.briefing.overall_level}`}>{LEVEL_INFO[r.briefing.overall_level]?.word ?? r.briefing.overall_level}</span>
            <h3>{r.briefing.headline}</h3>
          </div>
          <ul className="ios-claims">
            {r.briefing.situation.slice(0, 3).map((c, i) => <li key={i}>{c.text}</li>)}
          </ul>
          <AlertComposer alerts={r.briefing.alerts} compact />
          <div className="ios-form-row">
            <small className="ios-muted">{r.tool_calls} tool calls · {r.seconds}s · {timeAgo(r.generated_at)}</small>
            <span className="ios-spacer" />
            <button className="ios-link" onClick={onOpen}>Open agent {Icon.chevron}</button>
          </div>
        </>
      ) : (
        <div className="ios-agent-empty">
          <p>{agent.running ? "The agent is investigating now…" : "No briefing yet. The agent checks typhoons, basins, rain and gauges, then writes a cited briefing with alerts in five languages."}</p>
          <button className="ios-primary ios-primary-inline" onClick={() => { onOpen(); if (!agent.running) agent.run(); }}>
            <span className="ios-with-icon">{Icon.spark}{agent.running ? "Watch it work" : "Run the agent"}</span>
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Agent tab

export function AgentView({ agent, configured }: { agent: AgentState; configured: boolean | undefined }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  const r = agent.result;

  const openEvidence = (id: string) => {
    setOpenId(id);
    window.setTimeout(() => evidenceRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 30);
  };

  return (
    <div className="ios-split has-detail ios-agent">
      <section className="ios-main-col">
        <div className="ios-card ios-agent-run">
          <div className="ios-panel-head ios-panel-head-tight">
            <strong className="ios-with-icon">{Icon.activity}Investigation</strong>
            <button className="ios-primary ios-primary-inline" onClick={agent.run} disabled={agent.running || configured === false}>
              <span className="ios-with-icon">{agent.running ? Icon.refresh : Icon.spark}{agent.running ? "Running…" : "Run agent now"}</span>
            </button>
          </div>
          <p className="ios-muted ios-small">
            Muse Spark decides which tools to call: live hazards, the 17-basin outlook, rain forecasts and gauge forecasts. Every result
            becomes numbered evidence; the briefing must cite it, and the server checks each number against what it cites.
          </p>
          {configured === false && <p className="ios-note">Needs a Meta Model API key on the backend.</p>}
          {agent.error && <p className="ios-error">{agent.error}</p>}
          <RunTimeline events={agent.events} running={agent.running} />
          {!agent.events.length && !agent.running && r && (
            <ol className="ios-timeline">
              {Object.entries(r.evidence).map(([id, e]) => (
                <li key={id} className="is-tool">
                  <i aria-hidden>{e.ok ? Icon.check : Icon.alert}</i>
                  <div>
                    <strong>{TOOL_LABEL[e.tool] ?? e.tool} <button className="ios-cite" onClick={() => openEvidence(id)}>{id}</button></strong>
                    <small><code>{e.tool}({Object.values(e.args).map(String).join(", ")})</code> · {e.ms < 1000 ? `${e.ms} ms` : `${(e.ms / 1000).toFixed(1)} s`}</small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {r && (
          <div className="ios-card">
            <div className="ios-panel-head ios-panel-head-tight">
              <strong className="ios-with-icon">{Icon.shield}Verification</strong>
              <VerifiedBadge v={r.verification} />
            </div>
            <div className="ios-kv-row">
              <span><small>Claims</small><b>{r.verification.claims}</b></span>
              <span><small>Numbers checked</small><b>{r.verification.numbers_checked}</b></span>
              <span><small>Tool calls</small><b>{r.tool_calls}</b></span>
              <span><small>Tokens</small><b>{(r.usage.prompt_tokens + r.usage.completion_tokens).toLocaleString()}</b></span>
            </div>
            {r.verification.unverified.length > 0 ? (
              <ul className="ios-issues-list">
                {r.verification.unverified.map((u, i) => <li key={i}><b>{u.number}</b> not found in its cited evidence: “{u.claim}”</li>)}
              </ul>
            ) : (
              <p className="ios-muted ios-small">Every number in every cited claim appears in the tool output it cites (allowing for rounding).</p>
            )}
            <p className="ios-muted ios-small">Model {r.model} · generated {formatUtc(r.generated_at)} · {r.seconds}s</p>
          </div>
        )}

        <div ref={evidenceRef}>
          {openId && r && <EvidencePanel id={openId} evidence={r.evidence[openId]} onClose={() => setOpenId(null)} />}
        </div>
      </section>

      <aside className="ios-detail" aria-label="Agent briefing">
        {r ? (
          <div className="ios-detail-body">
            <div className="ios-sheet-head">
              <div>
                <span className={`ios-chip lvl-${r.briefing.overall_level}`}>{LEVEL_INFO[r.briefing.overall_level]?.word ?? r.briefing.overall_level}</span>
                <h2>{r.briefing.headline}</h2>
                <small className="ios-muted">Flood-watch briefing · {timeAgo(r.generated_at)}</small>
              </div>
            </div>

            <div className="ios-card">
              <strong>What&apos;s happening</strong>
              <ul className="ios-claims">
                {r.briefing.situation.map((c, i) => <li key={i}>{c.text} <Cites ids={c.evidence} onOpen={openEvidence} /></li>)}
              </ul>
            </div>

            {r.briefing.watchlist.length > 0 && (
              <div className="ios-card">
                <strong>Places to watch</strong>
                {r.briefing.watchlist.map((w, i) => (
                  <div className="ios-watch" key={i}>
                    <span className={`ios-dot lvl-${w.level}`} />
                    <div>
                      <b>{w.name}</b> <small className="ios-muted">{w.kind === "ph_basin" ? "River" : w.kind === "gauge" ? "River sensor" : "Weather event"}</small>
                      <p>{w.reason} <Cites ids={w.evidence} onOpen={openEvidence} /></p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {r.briefing.actions.length > 0 && (
              <div className="ios-card">
                <strong>What to do</strong>
                <ul className="ios-actions">
                  {r.briefing.actions.map((a, i) => (
                    <li key={i}>
                      <span className={`ios-prio prio-${a.priority}`}>{PRIORITY_LABEL[a.priority]} · {WHO_LABEL[a.who]}</span>
                      <strong>{a.action}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ios-card">
              <strong>Community alert</strong>
              <p className="ios-muted ios-small">Plain SMS text in five Philippine languages. Share it through any messaging app at no cost.</p>
              <AlertComposer alerts={r.briefing.alerts} />
            </div>

            <Poster briefing={r.briefing} />

            {r.briefing.limitations.length > 0 && (
              <div className="ios-card">
                <strong>Good to know</strong>
                <ul className="ios-claims ios-muted">{r.briefing.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
            )}
          </div>
        ) : (
          <div className="ios-card ios-empty">{agent.loaded ? "Run the agent to get the first briefing." : "Loading the latest briefing…"}</div>
        )}
      </aside>
    </div>
  );
}
