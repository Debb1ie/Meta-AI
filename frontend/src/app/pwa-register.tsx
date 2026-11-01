"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only (dev reloads would fight the cache). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is an enhancement; the app works without it.
    });
  }, []);
  return null;
}
