"use client";

import { useEffect } from "react";

const RELOAD_KEY = "hs-chunk-reload";

function isStaleBuild(error: Error) {
  return error.name === "ChunkLoadError" || /Loading (CSS )?chunk|Failed to fetch dynamically imported module/i.test(error.message);
}

/** Route error boundary: a stale build (after a new deploy) reloads itself once; other errors get a calm retry screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!isStaleBuild(error)) return;
    try {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
    } catch {}
    window.location.reload();
  }, [error]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--paper)", color: "var(--ink)", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div className="brand-mark" style={{ margin: "0 auto 18px", width: 44, height: 44, fontSize: 22 }}>H</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.1, letterSpacing: "-.04em", fontWeight: 500, margin: "0 0 10px" }}>Something hiccuped.</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.5, margin: "0 0 22px" }}>
          The page hit an unexpected error. Reloading usually fixes it; your data is safe on the server.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="button button-primary" onClick={() => window.location.reload()} style={{ border: 0, cursor: "pointer" }}>Reload page</button>
          <button className="button" onClick={reset} style={{ border: "1px solid var(--ink)", background: "transparent", cursor: "pointer" }}>Try again</button>
        </div>
      </div>
    </main>
  );
}
