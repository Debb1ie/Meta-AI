"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, AiStatus, Icon, SourceStatus, api, getAdminKey, setAdminKey, timeAgo } from "./shared";

export const SHORTCUTS: [string, string][] = [
  ["1 – 8", "Switch section"],
  ["/", "Search live gauges"],
  ["R", "Refresh data"],
  ["T", "Cycle light / dark / auto"],
  ["?", "Show shortcuts"],
  ["Esc", "Close dialogs"],
];

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    setPrompt(null);
  };
  return { canInstall: !!prompt && !installed, installed, install };
}

export function ShortcutList() {
  return (
    <dl className="ios-shortcuts">
      {SHORTCUTS.map(([k, label]) => (
        <div key={k}><dt><kbd>{k}</kbd></dt><dd>{label}</dd></div>
      ))}
    </dl>
  );
}

export function SystemPanel({ aiStatus, sources, onSynced }: { aiStatus: AiStatus | null; sources: SourceStatus; onSynced: () => void }) {
  const [latency, setLatency] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [adminKey, setKeyState] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [online, setOnline] = useState(true);
  const [swActive, setSwActive] = useState(false);
  const { canInstall, installed, install } = useInstallPrompt();

  const ping = useCallback(async () => {
    const t0 = performance.now();
    try {
      await api("/api/health");
      setLatency(Math.round(performance.now() - t0));
    } catch {
      setLatency(null);
    }
  }, []);

  useEffect(() => {
    ping();
    setOnline(navigator.onLine);
    setSwActive(!!navigator.serviceWorker?.controller);
    setKeyState(getAdminKey());
  }, [ping]);

  const syncNow = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const r = await api<{ rows_imported: number; errors: Record<string, string> }>("/api/live/sync", { method: "POST" });
      const failed = Object.keys(r.errors).length;
      setMessage(`Pulled ${r.rows_imported.toLocaleString()} readings${failed ? ` · ${failed} gauge(s) failed` : ""}.`);
      onSynced();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const rows = Object.entries(sources);

  return (
    <section className="ios-card ios-tool ios-tool-wide" id="tool-system">
      <span className="ios-card-label">System</span>
      <h3>Data pipeline &amp; status</h3>
      <div className="ios-sys-grid">
        <div className="ios-sys-stat"><span className="ios-with-icon">{Icon.server}API</span><b>{latency == null ? "Offline" : `${latency} ms`}</b><small>{API_URL}</small></div>
        <div className="ios-sys-stat"><span className="ios-with-icon">{Icon.spark}Muse Spark</span><b>{aiStatus?.configured ? "Connected" : "Not set up"}</b><small>{aiStatus?.models.analyst ?? "—"}</small></div>
        <div className="ios-sys-stat"><span className="ios-with-icon">{Icon.image}Vision</span><b>{aiStatus?.models.segmentation ?? "—"}</b><small>{aiStatus?.models.image ?? "—"}</small></div>
        <div className="ios-sys-stat"><span className="ios-with-icon">{online ? Icon.check : Icon.offline}Client</span><b>{online ? "Online" : "Offline"}</b><small>{swActive ? "Offline cache active" : "Offline cache off (dev)"}</small></div>
      </div>

      <div className="ios-table-wrap">
        <table className="ios-table">
          <thead><tr><th>Source</th><th>Status</th><th>Last sync</th><th>New rows</th><th>Issues</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="ios-muted">Waiting for the first background sync…</td></tr>}
            {rows.map(([key, s]) => (
              <tr key={key}>
                <td>{s.name}</td>
                <td><span className={`ios-status-pill ${s.ok ? "is-ok" : "is-bad"}`}>{s.ok ? "Healthy" : "Degraded"}</span></td>
                <td>{timeAgo(s.last_sync)}</td>
                <td>{s.rows_imported?.toLocaleString() ?? "—"}</td>
                <td className="ios-muted">{Object.keys(s.errors).length ? Object.entries(s.errors).map(([k, v]) => `${k}: ${v}`).join("; ") : "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ios-form-row">
        <button className="ios-primary ios-primary-inline" onClick={syncNow} disabled={syncing}>
          <span className="ios-with-icon">{Icon.refresh}{syncing ? "Syncing…" : "Sync gauges now"}</span>
        </button>
        <button className="ios-text-btn" onClick={ping}>{Icon.activity}Ping API</button>
        {canInstall && <button className="ios-text-btn" onClick={install}>{Icon.install}Install app</button>}
        {installed && <span className="ios-tag is-live">Installed app</span>}
      </div>
      {message && <p className="ios-muted ios-small">{message}</p>}

      <div className="ios-admin" id="admin">
        <span className="ios-with-icon">{Icon.shield}<b>Admin access</b><span className={`ios-status-pill ${adminKey ? "is-ok" : "is-bad"}`}>{adminKey ? "Unlocked" : "Locked"}</span></span>
        <p className="ios-muted ios-small">
          Editing alert levels, importing data, adding demo stations and manual syncs need the admin key (Render → Environment →
          ADMIN_TOKEN). It is kept only for this browser session. Everything else is public and read-only.
        </p>
        <form className="ios-form-row" onSubmit={(e) => { e.preventDefault(); setAdminKey(keyDraft.trim()); setKeyState(keyDraft.trim()); setKeyDraft(""); }}>
          <input className="ios-input" type="password" autoComplete="off" placeholder={adminKey ? "Key saved for this session" : "Paste admin key"} value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} aria-label="Admin key" />
          <button className="ios-primary ios-primary-inline" type="submit" disabled={!keyDraft.trim()}>Unlock</button>
          {adminKey && <button className="ios-text-btn" type="button" onClick={() => { setAdminKey(""); setKeyState(""); }}>Lock</button>}
        </form>
      </div>

      <div className="ios-sys-foot">
        <span className="ios-with-icon ios-muted">{Icon.keyboard}Keyboard shortcuts</span>
        <ShortcutList />
      </div>
    </section>
  );
}
