import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/featured",
    name: "HydroSentinel Command Center",
    short_name: "HydroSentinel",
    description: "Live river gauges, a Philippine river outlook and an AI analyst for flood early warning.",
    start_url: "/featured",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f7f3",
    theme_color: "#10252a",
    categories: ["weather", "utilities", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/featured", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "PH Outlook", short_name: "Outlook", url: "/featured?tab=outlook", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Live gauges", short_name: "Gauges", url: "/featured?tab=stations", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Ask Muse Spark", short_name: "Ask", url: "/featured?tab=ask", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
