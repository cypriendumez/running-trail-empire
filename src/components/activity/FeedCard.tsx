// ─────────────────────────────────────────────────────────────────────────────
//  UNE LIGNE DU FIL D'ACTIVITÉS.
//
//  Modèle assumé : Strava. Le tracé à gauche parce que c'est LUI qui permet de
//  reconnaître une sortie d'un coup d'œil — bien avant le titre, que la montre
//  nomme « Course à pied » neuf fois sur dix. Puis les trois chiffres qui comptent,
//  alignés en colonnes de largeur égale pour que l'œil descende le fil sans
//  ré-apprendre la mise en page à chaque ligne.
//
//  Un chiffre ABSENT laisse sa colonne vide plutôt que d'afficher « 0 » : une
//  séance sans capteur cardio n'a pas une FC de zéro.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Vignette } from "@/lib/activities/vignette";

export type LigneFil = {
  href: string;
  titre: string;
  dateLisible: string;
  trace: Vignette | null;
  chiffres: { label: string; valeur: string }[];
};

/** Classes ÉCRITES EN ENTIER : Tailwind lit le source, une classe assemblée à
 *  l'exécution (`grid-cols-${n}`) n'existerait tout simplement pas dans le CSS. */
const COLONNES: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

export function FeedCard({ ligne, sansTrace }: { ligne: LigneFil; sansTrace: string }) {
  return (
    <Link
      href={ligne.href}
      className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-md sm:flex-row sm:items-center"
    >
      <div className="relative flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-50 ring-1 ring-inset ring-zinc-100 sm:w-44">
        {ligne.trace ? (
          <svg viewBox={`0 0 ${ligne.trace.largeur} ${ligne.trace.hauteur}`} className="h-full w-full" aria-hidden="true">
            <path d={ligne.trace.d} fill="none" stroke="currentColor"
              className="text-emerald-600" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="flex items-center gap-1.5 px-2 text-center text-[11px] font-medium text-zinc-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {sansTrace}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{ligne.dateLisible}</p>
        <h2 className="mt-0.5 truncate text-base font-bold text-zinc-900 group-hover:text-emerald-700">{ligne.titre}</h2>
        <dl className={`mt-3 grid gap-x-2 gap-y-2 border-t border-zinc-100 pt-3 sm:max-w-md ${
          COLONNES[ligne.chiffres.length] ?? COLONNES[3]}`}>
          {ligne.chiffres.map((c) => (
            <div key={c.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{c.label}</dt>
              <dd className="mt-0.5 text-lg font-bold leading-tight text-zinc-900">{c.valeur}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Link>
  );
}
