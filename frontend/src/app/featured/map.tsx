"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

export type MapPoint = { id: string; lat: number; lon: number; level: string; title: string; detail: string };
export type MapHazard = { id: string; lat: number; lon: number; alert: string; title: string; detail: string };

// Matches the --green / --yellow / --orange / --red level tokens in globals.css.
const LEVEL_COLOR: Record<string, string> = { normal: "#3f9d62", advisory: "#d4a01c", warning: "#e5862c", critical: "#e0573f" };
const ALERT_COLOR: Record<string, string> = { green: "#3f9d62", orange: "#e5862c", red: "#e0573f" };

function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const key = points.map((p) => p.id).join(",");
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points.map((p) => [p.lat, p.lon] as [number, number]), { padding: [28, 28], maxZoom: 9 });
    // Fit only when the set of points changes, not on every level update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function RiverMap(props: { points: MapPoint[]; hazards?: MapHazard[]; selectedId?: string | null; onSelect?: (id: string) => void; dark: boolean; height?: number }) {
  // Esri Gray Canvas basemaps: keyless, with attribution.
  const tiles = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${props.dark ? "Dark" : "Light"}_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
  const center = props.points[0] ? ([props.points[0].lat, props.points[0].lon] as [number, number]) : ([12.5, 122] as [number, number]);
  return (
    <div className="ios-map" style={{ height: props.height ?? 320 }}>
      <MapContainer center={center} zoom={6} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }} attributionControl>
        <TileLayer
          key={tiles}
          url={tiles}
          attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
          maxZoom={16}
        />
        <FitToPoints points={props.points} />
        {/* Live hazards (GDACS): hollow rings, so they read differently from river points. */}
        {(props.hazards ?? []).map((h) => (
          <CircleMarker
            key={h.id}
            center={[h.lat, h.lon]}
            radius={16}
            pathOptions={{ className: "ios-hz-ring", color: ALERT_COLOR[h.alert] ?? ALERT_COLOR.green, weight: 3, dashArray: "4 4", fillColor: ALERT_COLOR[h.alert] ?? ALERT_COLOR.green, fillOpacity: 0.12 }}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              <strong>{h.title}</strong>
              <br />
              {h.detail}
            </Tooltip>
          </CircleMarker>
        ))}
        {props.points.map((p) => {
          const selected = p.id === props.selectedId;
          const color = LEVEL_COLOR[p.level] ?? LEVEL_COLOR.normal;
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lon]}
              radius={selected ? 11 : 7}
              pathOptions={{ className: "ios-pt", color: selected ? "#10252a" : "#ffffff", weight: selected ? 3 : 2, fillColor: color, fillOpacity: 0.95 }}
              eventHandlers={{ click: () => props.onSelect?.(p.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <strong>{p.title}</strong>
                <br />
                {p.detail}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
