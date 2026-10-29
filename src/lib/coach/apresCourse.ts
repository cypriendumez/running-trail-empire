// ─────────────────────────────────────────────────────────────────────────────
//  APRÈS LA COURSE — combien de jours sans intensité.
//
//  ⚠️ LE COACH N'AVAIT AUCUNE NOTION D'APRÈS-COURSE. Il ne posait que J+1 (repos) et
//  J+2 (footing de reprise), et seulement tant que la course tombait dans les 7 jours du
//  plan : dès le lendemain, le plan reconstruit l'avait oubliée. Cas réel (Cyprien,
//  marathon de Lille couru en 2 h 42 le 25/10/2026) : à J+5, le contexte corrigé lui
//  rendait DEUX séances de qualité pour la semaine. L'ancien n'en donnait qu'une, et par
//  accident — l'objectif périmé le gardait en « marathon », qui retire une séance.
//
//  LA RÈGLE : « un jour facile par mile couru » — la règle empirique la plus citée,
//  attribuée à Jack Foster et popularisée par Pete Pfitzinger : 26 jours après un
//  marathon, 13 après un semi, 6 après un 10 km. Des footings, pas du repos : c'est
//  l'INTENSITÉ qui attend, pas la course à pied.
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
/**
 * Plafond ASSUMÉ, 4 semaines. La règle a été pensée pour la route : appliquée telle quelle,
 * elle interdirait l'intensité deux mois après un 100 km de trail. Ce plafond est un choix,
 * pas une mesure — il ne joue qu'au-delà du marathon.
 */
export const JOURS_MAX = 28;
/** Part de la distance qu'une sortie du jour doit couvrir pour dire que la course a été courue. */
export const PART_COURUE = 0.5;

/** Jours sans intensité après une course de `distanceKm` : un par mile, au moins un. */
export function joursSansIntensite(distanceKm: number): number {
  return Math.max(1, Math.min(JOURS_MAX, Math.round(distanceKm / MILE_KM)));
}

export type ApresCourse = {
  nom: string;
  /** AAAA-MM-JJ, le jour de la course. */
  date: string;
  /** Jours écoulés depuis la course (1 = le lendemain). */
  joursDepuis: number;
  joursTotal: number;
  /** AAAA-MM-JJ, premier jour où l'intensité peut revenir. */
  reprise: string;
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
  const joursTotal = joursSansIntensite(course.distanceKm);
  if (joursDepuis > joursTotal) return null;
  const courue = Math.max(0, ...sorties
    .filter((s) => String(s.date).slice(0, 10) === date)
    .map((s) => s.distanceKm ?? 0));
  if (courue < course.distanceKm * PART_COURUE) return null;
  const reprise = new Date(`${date}T12:00:00Z`);
  reprise.setUTCDate(reprise.getUTCDate() + joursTotal + 1);
  return { nom: course.nom, date, joursDepuis, joursTotal, reprise: reprise.toISOString().slice(0, 10), distanceCourueKm: courue };
}
