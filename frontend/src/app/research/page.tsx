import type { Metadata } from "next";
import { ResearchView } from "./view";

export const metadata: Metadata = {
  title: "Research — HydroSentinel",
  description: "A 3D forecast layer and heat map of river flow across 17 Philippine basins, with the full methodology, parameters and live evaluation.",
};

export default function Research() {
  return <ResearchView />;
}
