import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The service worker must never be served from an HTTP cache, or browsers keep
  // running an old worker (and its caches) after a deploy.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
