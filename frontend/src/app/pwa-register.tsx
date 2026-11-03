"use client";

import { useEffect } from "react";

const RELOAD_KEY = "hs-chunk-reload";

/** Registers the service worker in production builds only (dev reloads would fight the cache),
    checks for a newer worker on every visit, and recovers from stale-build chunk errors. */
export function PwaRegister() {
  useEffect(() => {
    // A successful load clears the one-time reload guard.
    const clear = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {}
    }, 5000);

    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String(e.reason?.message ?? e.reason ?? "");
      if (e.reason?.name !== "ChunkLoadError" && !/Loading (CSS )?chunk/i.test(msg)) return;
      try {
        if (sessionStorage.getItem(RELOAD_KEY)) return;
        sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {}
      window.location.reload();
    };
    window.addEventListener("unhandledrejection", onRejection);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => reg.update())
        .catch(() => {
          // Offline support is an enhancement; the app works without it.
        });
    }
    return () => {
      window.clearTimeout(clear);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
