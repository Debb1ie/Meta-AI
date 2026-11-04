import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const isDev = process.env.NODE_ENV !== "production";
const MAP_DATA = [
  "https://s3.amazonaws.com",
  "https://server.arcgisonline.com",
  "https://ic.imagery1.arcgis.com",
  "https://overpass-api.de",
  "https://maps.mail.ru",
];

// Content Security Policy. Next.js needs inline scripts for hydration (no nonce setup),
// and dev mode needs eval for fast refresh; everything else is locked to known origins.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://server.arcgisonline.com https:",
  "font-src 'self' data:",
  // Spatial mapping page: elevation tiles, satellite imagery, land cover and OpenStreetMap (Overpass).
  `connect-src 'self' ${API_URL} https://api.open-meteo.com ${MAP_DATA.join(" ")}${isDev ? " ws: http://localhost:8000" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be served from an HTTP cache, or browsers keep
      // running an old worker (and its caches) after a deploy.
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
