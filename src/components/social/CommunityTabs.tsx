"use client";
// Bascule entre le fil social (Le Club) et l'agrégateur d'actualités préexistant.
// Le fil s'ouvre par défaut : c'est désormais le cœur de l'onglet, l'actualité en
// est le complément — mais elle reste à un clic, pas supprimée.
import { useState } from "react";
import { SocialHub } from "./SocialHub";
import { CommunityFeed } from "@/components/community/CommunityFeed";

/**
 * État honnête : on DIT que la fonctionnalité attend son activation, au lieu
 * d'afficher un fil vide qui laisserait croire que personne ne publie.
 */
function SocleEnAttente() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
      <p className="text-lg font-bold text-zinc-900">Le Club arrive</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
        Le fil social attend l&apos;activation de sa base de données. En attendant,
        l&apos;onglet Actualité fonctionne normalement.
      </p>
    </div>
  );
}

type Workout = {
  id: string; title?: string | null; type?: string | null; sport?: string | null; date?: string | null;
  distance_km?: number | null; duration_seconds?: number | null; elevation_gain_m?: number | null;
};

export function CommunityTabs({ recentWorkouts, socialReady = true, clubs = [] }: { recentWorkouts: Workout[]; socialReady?: boolean; clubs?: { id: string; name: string }[] }) {
  // Si le socle social n'est pas encore activé en base, on ouvre sur l'Actualité :
  // mieux vaut montrer ce qui marche que la coquille de ce qui n'existe pas encore.
  const [vue, setVue] = useState<"club" | "actu">(socialReady ? "club" : "actu");

  return (
    <div>
      <div className="mx-auto flex w-full max-w-2xl gap-6 px-4 pt-5">
        {([["club", "Le Club"], ["actu", "Actualité"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setVue(k)}
            className={`relative pb-2 text-sm font-bold transition ${
              vue === k ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}>
            {label}
            {vue === k && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-600" />}
          </button>
        ))}
      </div>
      {vue === "club"
        ? (socialReady
            ? <SocialHub recentWorkouts={recentWorkouts} clubs={clubs} />
            : <SocleEnAttente />)
        : <CommunityFeed />}
    </div>
  );
}
