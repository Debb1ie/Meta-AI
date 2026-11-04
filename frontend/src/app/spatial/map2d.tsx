"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, ImageOverlay, MapContainer, Rectangle, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Area } from "./areas";

export type Basemap = "streets" | "satellite";
type Bounds = [[number, number], [number, number]];

const BASEMAPS: Record<Basemap, { url: string; attribution: string; maxZoom: number }> = {
  streets: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 18 },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics", maxZoom: 18 },
};

function Fit({ bounds }: { bounds: Bounds }) {
  const map = useMap();
  const key = bounds.flat().join(",");
  useEffect(() => {
    map.fitBounds(bounds, { padding: [8, 8] });
    // Refit only when the analysis window moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

function Clicks({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function SpatialMap(props: {
  bounds: Bounds;
  overlay: string | null;
  opacity: number;
  basemap: Basemap;
  picked: { lat: number; lon: number } | null;
  areas: Area[];
  activeId: string | null;
  onPick: (lat: number, lon: number) => void;
  onArea: (id: string) => void;
}) {
  const b = BASEMAPS[props.basemap];
  return (
    <div className="sp-map">
      <MapContainer bounds={props.bounds} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }} attributionControl>
        <TileLayer key={props.basemap} url={b.url} attribution={b.attribution} maxZoom={b.maxZoom} />
        {props.overlay && <ImageOverlay url={props.overlay} bounds={props.bounds} opacity={props.opacity} />}
        <Rectangle bounds={props.bounds} interactive={false} pathOptions={{ color: "#10252a", weight: 2, fill: false, dashArray: "6 6" }} />
        {props.areas.filter((a) => a.id !== props.activeId).map((a) => (
          <CircleMarker key={a.id} center={[a.lat, a.lon]} radius={6} bubblingMouseEvents={false} pathOptions={{ color: "#10252a", weight: 2, fillColor: "#d8f36a", fillOpacity: 1 }} eventHandlers={{ click: () => props.onArea(a.id) }} />
        ))}
        {props.picked && <CircleMarker center={[props.picked.lat, props.picked.lon]} radius={7} interactive={false} pathOptions={{ color: "#fff", weight: 3, fillColor: "#10252a", fillOpacity: 1 }} />}
        <Fit bounds={props.bounds} />
        <Clicks onPick={props.onPick} />
      </MapContainer>
    </div>
  );
}
