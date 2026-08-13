"use client";
// Leaflet exige `window` : chargement différé, sans rendu serveur.
import dynamic from "next/dynamic";
import type { HeatCell } from "@/lib/segments/heatmap";

const Heatmap = dynamic(() => import("./Heatmap").then((m) => m.Heatmap), {
  ssr: false,
  loading: () => <div className="h-[560px] animate-pulse rounded-2xl bg-zinc-100" />,
});

export function HeatmapLazy(props: {
  cells: HeatCell[];
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  max: number;
}) {
  return <Heatmap {...props} />;
}
