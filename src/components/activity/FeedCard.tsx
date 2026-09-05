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
import {
  MapPin, Footprints, Bike, Waves, Sailboat, Snowflake, Mountain,
  Dumbbell, HeartPulse, Flower2, Dribbble, Activity,
} from "lucide-react";
import type { Sport } from "@/lib/intervals/sport";
import type { PlanCarte } from "@/lib/activities/tuiles";

/** Icône par sport. La liste des sports vient de `lib/intervals/sport` — on ne
 *  redéclare pas une seconde nomenclature à côté de celle qui fait autorité, et un
 *  sport inconnu retombe sur une icône neutre plutôt que sur une chaussure. */
const ICONE_SPORT: Record<Sport, typeof Footprints> = {
  run: Footprints, bike: Bike, swim: Waves, row: Sailboat, ski: Snowflake,
  hike: Mountain, walk: Footprints, strength: Dumbbell, cardio: HeartPulse,
  mobility: Flower2, ballsport: Dribbble, other: Activity,
};

export type LigneFil = {
  href: string;
  titre: string;
  dateLisible: string;
  sport: Sport;
  /** Nom du sport dans la langue de l'athlète — sert de libellé accessible à l'icône. */
  sportLisible: string;
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
  // TOUT est dans un SVG, tuiles comprises (`<image>`), et pas dans des <img> posés en
  // absolu. La raison n'est pas esthétique : un SVG a un `viewBox`, donc il se met À
  // L'ÉCHELLE de la place disponible. La version précédente rendait la carte à une
  // largeur fixe et centrait le parcours dans une bande étroite pour qu'un téléphone ne
  // le coupe pas — le prix étant qu'il n'occupait plus que la moitié du cadre sur un
  // écran large. Ici le parcours remplit le cadre partout, et la carte suit.
  //
  // ⚠️ CE QUE ÇA COÛTE, dit franchement : `loading="lazy"` n'existe pas sur `<image>`
  // (React le refuse, et il n'est pas standard), donc les tuiles ne sont plus chargées
  // au défilement. Mesuré sur 15 sorties réelles : 52 tuiles demandées mais seulement
  // 22 URL distinctes — l'athlète court au même endroit — soit ~1,1 Mo, mis en cache
  // ensuite. C'est le prix d'une carte qui remplit son cadre sur tous les écrans ;
  // c'est la pagination (PAR_PAGE) qui borne la facture, pas le différé.
  return (
    <svg viewBox={`0 0 ${plan.largeur} ${plan.hauteur}`}
      className="block h-auto w-full rounded-xl bg-zinc-100 ring-1 ring-inset ring-zinc-200"
      preserveAspectRatio="xMidYMid slice" role="presentation">
      {plan.tuiles.map((t, i) => (
        <image key={`${t.z}/${t.x}/${t.y}`} href={urls[i]} x={t.gauche} y={t.haut}
          width={plan.tailleTuile} height={plan.tailleTuile} preserveAspectRatio="none" />
      ))}
      {/* Le tracé est DOUBLÉ : sans le liseré blanc il disparaît sur les zones claires. */}
      <path d={plan.chemin} fill="none" stroke="#ffffff" strokeWidth={9} strokeOpacity={0.9}
        strokeLinecap="round" strokeLinejoin="round" />
      <path d={plan.chemin} fill="none" stroke="#059669" strokeWidth={4.5}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FeedCard({ ligne, sansTrace }: { ligne: LigneFil; sansTrace: string }) {
  return (
    <Link
      href={ligne.href}
      className="group block rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{ligne.dateLisible}</p>
      <div className="mt-1 flex items-center gap-2">
        {/* Toutes les sorties de la montre s'appellent « Rouen Course à pied » : sans
            l'icône, quinze cartes portent le même titre et rien ne les distingue. */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"
          title={ligne.sportLisible}>
          {(() => { const I = ICONE_SPORT[ligne.sport] ?? Activity; return <I className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />; })()}
          <span className="sr-only">{ligne.sportLisible}</span>
        </span>
        <h2 className="truncate text-lg font-bold text-zinc-900 group-hover:text-emerald-700">{ligne.titre}</h2>
      </div>

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
          <div className="flex aspect-[38/15] items-center justify-center gap-1.5 rounded-xl bg-zinc-50 text-xs font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {sansTrace}
          </div>
        )}
      </div>
    </Link>
  );
}
