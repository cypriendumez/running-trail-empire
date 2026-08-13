"use client";
// MapLibre exige `window` et pèse lourd : chargement à la demande, sans rendu serveur.
// La page de survol doit s'afficher tout de suite ; la carte arrive juste après.
import dynamic from "next/dynamic";
import type { FlyoverStats } from "./Flyover";

const Flyover = dynamic(() => import("./Flyover").then((m) => m.Flyover), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-2xl bg-zinc-200" />,
});

export function FlyoverLazy(props: { polyline: string; altitudes?: number[] | null; stats: FlyoverStats }) {
  return <Flyover {...props} />;
}
