// ─────────────────────────────────────────────────────────────────────────────
//  APRÈS LA COURSE — quand l'intensité revient, et à quelle dose.
//
//  ⚠️ LE COACH N'AVAIT AUCUNE NOTION D'APRÈS-COURSE. Il ne posait que J+1 (repos) et
//  J+2 (footing de reprise), et seulement tant que la course tombait dans les 7 jours du
//  plan : dès le lendemain, le plan reconstruit l'avait oubliée. Cas réel (Cyprien,
//  marathon de Lille couru en 2 h 42 le 25/10/2026) : à J+5, le contexte corrigé lui
//  rendait DEUX séances de qualité pour la semaine. L'ancien n'en donnait qu'une, et par
//  accident — l'objectif périmé le gardait en « marathon », qui retire une séance.
//
//  ⚠️ PUIS LA CORRECTION EST ALLÉE TROP LOIN. « Un jour facile par mile couru » (Jack
//  Foster, popularisé par Pete Pfitzinger) a été appliqué à TOUTE intensité : aucune
//  séance de qualité pendant 26 jours, jusqu'au 21 novembre. Cyprien, 05/11/2026 : « il
//  faut pas 1 mois pour récupérer du marathon, c'est 2 semaines je pense ». Les deux
//  règles existent, et elles ne disent pas la même chose :
//    · Jack Daniels : un jour FACILE par tranche de 3 km courus — 14 jours après un
//      marathon, 7 après un semi, 3 après un 10 km. Ces jours-là, aucune intensité.
//    · Foster / Pfitzinger : un jour par mile avant de COURIR à nouveau à fond — 26 jours
//      après un marathon. C'est le délai d'un retour à l'entraînement complet.
//
//  LA RÈGLE, EN DEUX TEMPS :
//    1. AUCUNE INTENSITÉ pendant la fenêtre de Daniels : des footings, pas du repos.
//    2. REPRISE jusqu'à la fenêtre de Pfitzinger : UNE séance de qualité par semaine,
//       courte et AU SEUIL — ni VMA, ni côtes, ni course. Des fibres encore abîmées
//       supportent l'allure seuil bien avant la vitesse.
//  Le volume, lui, remonte par paliers sur TOUTE la fenêtre (voir plus bas).
//
//  ⚠️ ON NE SUPPOSE PAS QUE LA COURSE A ÉTÉ COURUE. Il faut une sortie enregistrée le
//  jour même, d'au moins la moitié de la distance. Un forfait ne mérite pas quatre
//  semaines de footing, et « J+5 après ton marathon » sur une course non courue serait
//  inventé. Une course courue sans montre passe donc inaperçue : on le sait, et on
//  préfère ce silence à une récupération imposée sur une supposition.
// ─────────────────────────────────────────────────────────────────────────────
import { ecartJours } from "@/lib/coach/recuperation";

/** Un mile, en kilomètres. */
const MILE_KM = 1.609;
/** Daniels : un jour facile par tranche de 3 km courus. */
const KM_PAR_JOUR_FACILE = 3;
/**
 * Plafond ASSUMÉ, 4 semaines. Les règles ont été pensées pour la route : appliquées telles
 * quelles, elles interdiraient l'intensité deux mois après un 100 km de trail. Ce plafond
 * est un choix, pas une mesure — il ne joue qu'au-delà du marathon.
 */
export const JOURS_MAX = 28;
/** Part de la distance qu'une sortie du jour doit couvrir pour dire que la course a été courue. */
export const PART_COURUE = 0.5;

/** Jours SANS AUCUNE intensité après une course de `distanceKm` : un par 3 km (Daniels), au moins un. */
export function joursSansIntensite(distanceKm: number): number {
  return Math.max(1, Math.min(JOURS_MAX, Math.round(distanceKm / KM_PAR_JOUR_FACILE)));
}

/** Durée totale de la récupération : un jour par mile (Foster, Pfitzinger), au moins un. */
export function joursDeRecuperation(distanceKm: number): number {
  return Math.max(1, Math.min(JOURS_MAX, Math.round(distanceKm / MILE_KM)));
}

/** « sans-intensite » : footings seulement. « reprise » : une séance courte au seuil par semaine. */
export type PhaseApresCourse = "sans-intensite" | "reprise";

export type ApresCourse = {
  nom: string;
  /** AAAA-MM-JJ, le jour de la course. */
  date: string;
  /** Jours écoulés depuis la course (1 = le lendemain). */
  joursDepuis: number;
  /** Durée totale de la récupération (un jour par mile) : le volume réduit la couvre entière. */
  joursTotal: number;
  /** Jours sans aucune intensité (un par 3 km), au début de la récupération. */
  joursSansIntensite: number;
  phase: PhaseApresCourse;
  /** AAAA-MM-JJ, premier jour où une séance de qualité — courte, au seuil — peut revenir. */
  reprise: string;
  /** AAAA-MM-JJ, premier jour d'entraînement normal. */
  fin: string;
  /** Distance réellement enregistrée le jour de la course. */
  distanceCourueKm: number;
};

/**
 * La récupération en cours, ou `null` : pas de course passée, course non courue, ou
 * fenêtre refermée.
 *
 * ⚠️ `aujourdhui` EST FOURNI, jamais lu de l'horloge : le serveur n'est pas dans le fuseau
 * des coureurs (voir `lib/time`).
 */
export function apresCourse(args: {
  course: { nom: string; date: string; distanceKm: number } | null;
  sorties: readonly { date: string; distanceKm: number | null }[];
  aujourdhui: string;
}): ApresCourse | null {
  const { course, sorties, aujourdhui } = args;
  if (!course || !(course.distanceKm > 0)) return null;
  const date = String(course.date).slice(0, 10);
  const joursDepuis = ecartJours(aujourdhui, date);
  if (joursDepuis == null || joursDepuis < 1) return null;
  const joursTotal = joursDeRecuperation(course.distanceKm);
  if (joursDepuis > joursTotal) return null;
  const courue = Math.max(0, ...sorties
    .filter((s) => String(s.date).slice(0, 10) === date)
    .map((s) => s.distanceKm ?? 0));
  if (courue < course.distanceKm * PART_COURUE) return null;
  const sansIntensite = joursSansIntensite(course.distanceKm);
  return {
    nom: course.nom, date, joursDepuis, joursTotal, joursSansIntensite: sansIntensite,
    phase: joursDepuis <= sansIntensite ? "sans-intensite" : "reprise",
    reprise: plusJours(date, sansIntensite + 1),
    fin: plusJours(date, joursTotal + 1),
    distanceCourueKm: courue,
  };
}

/** AAAA-MM-JJ décalé de `n` jours civils (midi UTC : aucun fuseau ne fait changer de jour). */
function plusJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
//  LE VOLUME AUSSI, PAS SEULEMENT L'INTENSITÉ.
//
//  ⚠️ LA RÉCUPÉRATION NE RETIRAIT QUE LA QUALITÉ. Le volume visé restait celui d'une
//  semaine normale : cinq jours après son marathon (2 h 42), Cyprien recevait un objectif
//  de 70 km, sa médiane des huit semaines précédentes. Le plan ne pouvant pas le loger
//  dans ses footings (plafonnés par la sortie longue), il ajoutait « 💡 À ton volume,
//  scinde en DEUX sorties dans la journée » — le contraire de ce qu'il faut à J+5.
//
//  LA RÈGLE (validée par Cyprien le 30/10/2026) : le volume repart de la moitié et
//  remonte par paliers — 50 %, 70 %, puis 85 % du volume habituel, chacun sur un tiers
//  de la fenêtre de récupération (neuf jours chacun après un marathon, deux après un
//  10 km). Le plan couvrant sept jours, on applique la MOYENNE de ces sept jours : un
//  plan qui déborde sur le palier suivant, ou au-delà de la récupération, en tient compte.
// ─────────────────────────────────────────────────────────────────────────────

/** Part du volume habituel sur chaque tiers de la récupération. */
export const PALIERS_VOLUME = [0.5, 0.7, 0.85] as const;

/** Part du volume habituel le `joursDepuis`-ième jour après la course (1 au-delà de la fenêtre). */
export function partVolumeDuJour(joursDepuis: number, joursTotal: number): number {
  if (!(joursDepuis >= 1) || joursDepuis > joursTotal) return 1;
  return PALIERS_VOLUME[Math.min(2, Math.floor(((joursDepuis - 1) * 3) / joursTotal))];
}

/** Part du volume habituel à viser sur les `jours` jours du plan qui commence aujourd'hui. */
export function facteurVolumeApresCourse(r: Pick<ApresCourse, "joursDepuis" | "joursTotal">, jours = 7): number {
  let somme = 0;
  for (let k = 0; k < jours; k++) somme += partVolumeDuJour(r.joursDepuis + k, r.joursTotal);
  return somme / jours;
}
