"use client";
// Leaflet exige `window` : la carte est donc chargée à la demande, sans rendu serveur.
// Sans ce sas, la page Segments plantait au rendu serveur — la liste et les
// classements n'ont pas à dépendre de la disponibilité d'une carte.
import dynamic from "next/dynamic";

const SegmentMap = dynamic(() => import("./SegmentMap").then((m) => m.SegmentMap), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse rounded-xl bg-zinc-100" />,
});

// L'attente occupe la hauteur de la VRAIE carte : fixée à 180 px, elle faisait sauter la
// liste des segments de 60 px par vignette (120 px) à l'arrivée de chaque carte.
export function SegmentMapLazy({ polyline, height = 180 }: { polyline: string; height?: number }) {
  return <div style={{ height }}><SegmentMap polyline={polyline} height={height} /></div>;
}
