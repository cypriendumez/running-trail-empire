"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// TrailBuilder embarque mapbox-gl + leaflet (très lourd). On le charge à la demande côté client
// pour que la page Trail s'affiche immédiatement (la carte arrive juste après).
const TrailBuilder = dynamic(() => import("./TrailBuilder").then((m) => m.TrailBuilder), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-3xl border border-zinc-200 bg-white">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
    </div>
  ),
});

export function TrailBuilderLazy() {
  return <TrailBuilder />;
}
