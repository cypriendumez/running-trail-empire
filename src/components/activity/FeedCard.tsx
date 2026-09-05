// ─────────────────────────────────────────────────────────────────────────────
//  UNE CARTE DU FIL D'ACTIVITÉS.
//
//  Disposition reprise de Strava, capture à l'appui : la date, le titre, la rangée de
//  chiffres, PUIS la carte en pleine largeur. La première version mettait une vignette
//  de 176 px à gauche — trop petite pour reconnaître quoi que ce soit, et ce n'était
//  pas la disposition demandée.
//
//  La carte est composée de ses quelques tuiles (voir `lib/activities/tuiles`), pas
//  d'une image statique : l'API « cartes statiques » de MapTiler répond 403 sur la clé
//  du projet, alors que les tuiles répondent 200.
//
//  Deux détails qui font la différence entre « un trait » et « une carte » :
//   • le tracé est DOUBLÉ — liseré blanc dessous, couleur au-dessus — sans quoi il
//     disparaît sur les zones claires ;
//   • le parcours est calé dans la bande CENTRALE, plus étroite que la carte. Sur un
//     téléphone, les côtés sont rognés sans jamais couper le parcours.
// ─────────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { PlanCarte } from "@/lib/activities/tuiles";

export type LigneFil = {
  href: string;
  titre: string;
  dateLisible: string;
  /** Plan de la carte + URL déjà construites : le composant ne connaît aucune clé. */
  carte: { plan: PlanCarte; urls: string[] } | null;
  chiffres: { label: string; valeur: string }[];
};

/** Classes ÉCRITES EN ENTIER : Tailwind lit le source, une classe assemblée à
 *  l'exécution (`grid-cols-${n}`) n'existerait tout simplement pas dans le CSS. */
const COLONNES: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

function Carte({ plan, urls }: { plan: PlanCarte; urls: string[] }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-inset ring-zinc-200"
      style={{ height: plan.hauteur }}>
      {/* La mosaïque est rendue à une largeur FIXE et centrée : un écran plus étroit
          rogne les bords de la carte, jamais le parcours. */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2" style={{ width: plan.largeur, height: plan.hauteur }} aria-hidden="true">
        {plan.tuiles.map((t, i) => (
          // Chargement DIFFÉRÉ : sans lui, quinze cartes réclamaient leurs tuiles avant
          // même que l'athlète ait fait défiler la page.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${t.z}/${t.x}/${t.y}`} src={urls[i]} alt="" loading="lazy" decoding="async"
            className="absolute max-w-none select-none"
            style={{ left: t.gauche, top: t.haut, width: plan.tailleTuile, height: plan.tailleTuile }} />
        ))}
        <svg viewBox={`0 0 ${plan.largeur} ${plan.hauteur}`} className="absolute inset-0 h-full w-full">
          <path d={plan.chemin} fill="none" stroke="#ffffff" strokeWidth={6} strokeOpacity={0.9}
            strokeLinecap="round" strokeLinejoin="round" />
          <path d={plan.chemin} fill="none" stroke="#059669" strokeWidth={3}
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export function FeedCard({ ligne, sansTrace }: { ligne: LigneFil; sansTrace: string }) {
  return (
    <Link
      href={ligne.href}
      className="group block rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{ligne.dateLisible}</p>
      <h2 className="mt-0.5 truncate text-lg font-bold text-zinc-900 group-hover:text-emerald-700">{ligne.titre}</h2>

      <dl className={`mt-3 grid gap-x-3 gap-y-2.5 ${COLONNES[ligne.chiffres.length] ?? COLONNES[3]}`}>
        {ligne.chiffres.map((c) => (
          <div key={c.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{c.label}</dt>
            <dd className="mt-0.5 text-lg font-bold leading-tight text-zinc-900">{c.valeur}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3">
        {ligne.carte ? <Carte plan={ligne.carte.plan} urls={ligne.carte.urls} /> : (
          <div className="flex h-20 items-center justify-center gap-1.5 rounded-xl bg-zinc-50 text-xs font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {sansTrace}
          </div>
        )}
      </div>
    </Link>
  );
}
