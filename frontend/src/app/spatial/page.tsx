import type { Metadata } from "next";
import { SpatialView } from "./view";

export const metadata: Metadata = {
  title: "Spatial mapping — HydroSentinel",
  description: "Flood susceptibility mapping for Philippine towns: 3D terrain with rising floodwater, a flood map, and eleven factor maps computed from open terrain, river, land-cover and rain data.",
};

export default function Spatial() {
  return <SpatialView />;
}
