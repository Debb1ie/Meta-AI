"use client";

import { useEffect, useRef, useState } from "react";
import { AiStatus, Icon, LEVEL_INFO, Station, postJson } from "./shared";

// Mirrors RESPONSE_SCHEMA in backend/app/ai/analyst.py. status and key_points are optional
// so answers from an older backend still render.
type Analysis = {
  summary: string;
  status?: "normal" | "advisory" | "warning" | "critical" | "unknown";
  key_points?: string[];
  observations: { station: string; statement: string }[];
  predictions: { station: string; horizon_h: number; statement: string }[];
  uncertainty: string[];
  risk_explanation: string;
  recommended_actions: { action: string; rationale: string; priority: "immediate" | "soon" | "monitor" }[];
  data_limitations: string[];
  stations_referenced: string[];
};

type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; answer: Analysis; model: string }
  | { role: "error"; content: string };

const SUGGESTIONS = [
  "How are Philippine rivers looking this week?",
  "Which river should I worry about most?",
  "Summarize the live gauges for the next 24 hours",
];

const PRIORITY_LABEL = { immediate: "Do now", soon: "Do soon", monitor: "Keep watching" };

function AnswerBubble({ answer, model }: { answer: Analysis; model: string }) {
  const hasDetails =
    answer.observations.length + answer.predictions.length + answer.uncertainty.length + answer.data_limitations.length > 0 ||
    !!answer.risk_explanation;
  const level = answer.status && answer.status !== "unknown" ? LEVEL_INFO[answer.status] : undefined;
  const keyPoints = answer.key_points ?? [];
  return (
    <div className="ios-bubble assistant ios-answer">
      {level && <span className={`ios-chip lvl-${answer.status} ios-answer-status`}>{level.word}</span>}
      {answer.summary
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((para, i) => <p key={i}>{para}</p>)}
      {keyPoints.length > 0 && (
        <ul className="ios-key-points">{keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
      )}
      {answer.recommended_actions.length > 0 && <strong className="ios-answer-heading">What to do</strong>}
      {answer.recommended_actions.length > 0 && (
        <ul className="ios-actions">
          {answer.recommended_actions.map((a, i) => (
            <li key={i}>
              <span className={`ios-prio prio-${a.priority}`}>{PRIORITY_LABEL[a.priority] ?? a.priority}</span>
              <strong>{a.action}</strong>
              <small>{a.rationale}</small>
            </li>
          ))}
        </ul>
      )}
      {hasDetails && (
        <details>
          <summary>See the numbers behind this</summary>
          {answer.risk_explanation && <Section title="Why we say this"><p>{answer.risk_explanation}</p></Section>}
          {answer.observations.length > 0 && (
            <Section title="Right now">
              <ul>{answer.observations.map((o, i) => <li key={i}><b>{o.station}:</b> {o.statement}</li>)}</ul>
            </Section>
          )}
          {answer.predictions.length > 0 && (
            <Section title="What's expected">
              <ul>{answer.predictions.map((p, i) => <li key={i}><b>{p.station}, in {p.horizon_h} hours:</b> {p.statement}</li>)}</ul>
            </Section>
          )}
          {answer.uncertainty.length > 0 && (
            <Section title="How sure we are"><ul>{answer.uncertainty.map((u, i) => <li key={i}>{u}</li>)}</ul></Section>
          )}
          {answer.data_limitations.length > 0 && (
            <Section title="Good to know"><ul>{answer.data_limitations.map((u, i) => <li key={i}>{u}</li>)}</ul></Section>
          )}
        </details>
      )}
      <small className="ios-model ios-with-icon">{Icon.spark}{model}</small>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="ios-answer-section"><strong>{title}</strong>{children}</div>;
}

export function AskView(props: {
  stations: Station[];
  aiStatus: AiStatus | null;
  contextId: string | null;
  setContextId: (id: string | null) => void;
  prefill?: string | null;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState(props.prefill ?? "");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextName = props.stations.find((s) => s.station.id === props.contextId)?.station.name;
  const notConfigured = props.aiStatus && !props.aiStatus.configured;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const send = async (text: string) => {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    // The backend accepts plain-text history; summaries keep it short.
    const history = turns.flatMap((t) =>
      t.role === "user" ? [{ role: "user", content: t.content }] : t.role === "assistant" ? [{ role: "assistant", content: t.answer.summary }] : [],
    );
    setTurns((t) => [...t, { role: "user", content: question }]);
    setDraft("");
    setBusy(true);
    try {
      const data = await postJson<{ answer: Analysis; model: string }>("/api/ai/analyst", {
        question,
        station_id: props.contextId,
        history,
      });
      setTurns((t) => [...t, { role: "assistant", answer: data.answer, model: data.model }]);
    } catch (err) {
      setTurns((t) => [...t, { role: "error", content: (err as Error).message }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="ios-chat">
      <div className="ios-chat-scroll">
        {notConfigured && (
          <div className="ios-card ios-setup">
            <span className="ios-card-label">Connect Muse Spark</span>
            <p>The assistant needs a Meta Model API key. It stays on the server and is never sent to the browser.</p>
            <ol>
              <li>Create a key in the <a href="https://dev.meta.ai" target="_blank" rel="noreferrer">Meta Model API dashboard</a> (API keys tab).</li>
              <li>Copy <code>.env.example</code> to <code>.env</code> in the project root.</li>
              <li>Set <code>META_MODEL_API_KEY=</code> your key, then restart the backend.</li>
            </ol>
          </div>
        )}
        {turns.length === 0 && (
          <div className="ios-chat-empty">
            <span className="ios-avatar ios-avatar-lg">{Icon.spark}</span>
            <h2>What would you like to know?</h2>
            <p>Answers use the latest readings and forecasts from your stations.</p>
            <div className="ios-suggestions">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}><span>{s}</span>{Icon.arrow}</button>)}
            </div>
          </div>
        )}
        <div className="ios-bubbles">
          {turns.map((t, i) =>
            t.role === "assistant" ? (
              <AnswerBubble key={i} answer={t.answer} model={t.model} />
            ) : (
              <div key={i} className={`ios-bubble ${t.role === "user" ? "user" : "assistant is-error"}`}>{t.content}</div>
            ),
          )}
          {busy && <div className="ios-bubble assistant ios-typing"><i /><i /><i /></div>}
          <div ref={endRef} />
        </div>
      </div>

      <form className="ios-composer" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        {contextName && (
          <span className="ios-context">
            {contextName}
            <button type="button" onClick={() => props.setContextId(null)} aria-label="Ask about all stations">{Icon.close}</button>
          </span>
        )}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={contextName ? `Ask about ${contextName}…` : "Ask about your rivers…"}
          aria-label="Your question"
        />
        <button type="submit" disabled={draft.trim().length < 3 || busy} aria-label="Send">{Icon.send}</button>
      </form>
    </div>
  );
}
