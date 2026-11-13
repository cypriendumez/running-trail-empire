// ─────────────────────────────────────────────────────────────────────────────
//  LA COURSE C ÉCARTÉE — une seule règle, pour le contexte du coach et pour le plan (13/11/2026).
//
//  Décisions de Cyprien du 13/11/2026 : une course C trop près de la course A est ÉCARTÉE, et le plan
//  le DIT ; après la course A, elle l'est jusqu'à la FIN de la récupération. Deux cas :
//    · « avant » : la C tombe le jour de la A, sa veille ou son avant-veille (la A dans la semaine ou à
//      J+7/J+8) — une course la veille d'un objectif en gâche la fraîcheur ;
//    · « apres » : la C tombe pendant la récupération de la A — un jour par mile couru (Foster,
//      Pfitzinger : `joursDeRecuperation`, lib/coach/apresCourse), qu'elle soit à venir dans la semaine
//      ou déjà courue (`recuperation`, présente seulement si la course a été réellement courue).
//      `apresCourse` interdit déjà toute course pendant la reprise : cette règle s'y aligne.
//  Une C écartée n'existe plus pour la semaine : elle ne retire pas de séance de qualité, ne bloque pas
//  la sortie longue du lendemain, n'est pas annoncée au coach. Seul le message reste, au jour de la C.
// ─────────────────────────────────────────────────────────────────────────────
import { joursDeRecuperation } from "@/lib/coach/apresCourse";

/** Jours protégés AVANT la course A : la veille et l'avant-veille (le protocole du plan). */
export const JOURS_AVANT_A = 2;

export type CourseCEcartee = { idx: number; nom: string; motif: "avant" | "apres"; courseA: string | null };

/** AAAA-MM-JJ décalé de `n` jours civils (midi UTC : aucun fuseau ne fait changer de jour). */
function plusJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function courseCEcarteeDe(a: {
  courseSecondaire: { idx: number; nom: string; priorite: string } | null | undefined;
  /** Jours jusqu'à la course A à venir (0 = aujourd'hui), ou `null`. */
  daysToRace: number | null | undefined;
  /** Distance et nom de cette course A, quand ils sont connus. */
  distanceA: number | null | undefined;
  nomA: string | null | undefined;
  /** La récupération d'une course A DÉJÀ courue (`fin` = premier jour d'entraînement normal). */
  recuperation: { course: string; fin?: string } | null | undefined;
  /** Le jour 0 du plan, AAAA-MM-JJ (dans le fuseau du coureur). */
  aujourdhui: string;
}): CourseCEcartee | null {
  const cs = a.courseSecondaire;
  if (!cs || cs.priorite !== "C" || !(cs.idx >= 0 && cs.idx <= 6)) return null;
  const dateC = plusJours(a.aujourdhui, cs.idx);
  // Pendant la récupération d'une course A déjà courue.
  if (a.recuperation?.fin && dateC < a.recuperation.fin) return { idx: cs.idx, nom: cs.nom, motif: "apres", courseA: a.recuperation.course || null };
  const d = a.daysToRace;
  if (d == null || d < 0 || d > 8) return null;
  // Le jour de la A, sa veille, son avant-veille.
  if (cs.idx <= d && cs.idx >= d - JOURS_AVANT_A) return { idx: cs.idx, nom: cs.nom, motif: "avant", courseA: a.nomA || null };
  // Après la A, dans la semaine : jusqu'à la fin de sa récupération. Distance inconnue : on ne suppose
  // pas une durée de récupération, on garde le seul protocole de course (repos, reprise : 2 jours).
  if (cs.idx > d) {
    const fenetre = Number(a.distanceA) > 0 ? joursDeRecuperation(Number(a.distanceA)) : JOURS_AVANT_A;
    if (cs.idx - d <= fenetre) return { idx: cs.idx, nom: cs.nom, motif: "apres", courseA: a.nomA || null };
  }
  return null;
}
