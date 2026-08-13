"use client";
// Leaflet exige `window` : la carte est donc chargée à la demande, sans rendu serveur.
// Sans ce sas, la page Segments plantait au rendu serveur — la liste et les
// classements n'ont pas à dépendre de la disponibilité d'une carte.
import dynamic from "next/dynamic";

const SegmentMap = dynamic(() => import("./SegmentMap").then((m) => m.SegmentMap), {
  ssr: false,
  loading: () => <div className="h-[180px] animate-pulse rounded-xl bg-zinc-100" />,
});

export function SegmentMapLazy({ polyline, height }: { polyline: string; height?: number }) {
  return <SegmentMap polyline={polyline} height={height} />;
}
