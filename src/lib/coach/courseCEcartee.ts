// ─────────────────────────────────────────────────────────────────────────────
//  LA COURSE C ÉCARTÉE — une seule règle, calculée par le contexte du coach (13/11/2026).
//
//  Décisions de Cyprien du 13/11/2026 : une course C trop près d'une course plus importante est
//  ÉCARTÉE, et le plan le DIT. Deux cas :
//    · « avant » : la C tombe le jour de la course A, sa veille ou son avant-veille — et, avant un SEMI
//      ou un MARATHON (≥ 21 km), pendant toute la semaine d'affûtage, de J-6 à la veille : une course se
//      court rarement sous l'effort seuil, et la dernière semaine ne garde qu'un rappel court ;
//    · « apres » : la C tombe pendant une RÉCUPÉRATION, jusqu'à sa FIN (un jour par mile couru :
//      Foster, Pfitzinger, `joursDeRecuperation` de lib/coach/apresCourse) :
//        – celle de la course A à venir dans la semaine ;
//        – celle de N'IMPORTE QUELLE course déjà courue, A, B ou C (`recuperation`, présente seulement
//          si la course a été réellement courue) — `apresCourse` interdit déjà toute course pendant la
//          reprise, quelle que soit la course courue.
//  Une C écartée n'existe plus pour la semaine : elle ne retire pas de séance de qualité, ne bloque pas
//  la sortie longue du lendemain, n'est pas annoncée au coach. Seul le message reste, au jour de la C.
// ─────────────────────────────────────────────────────────────────────────────
import { joursDeRecuperation } from "@/lib/coach/apresCourse";

/** Jours protégés AVANT la course A : la veille et l'avant-veille (le protocole du plan). */
export const JOURS_AVANT_A = 2;
/** Avant un semi ou un marathon : toute la semaine d'affûtage, de J-6 à la veille. */
export const JOURS_AVANT_A_LONGUE = 6;
/** À partir de quelle distance la course A est « longue » (semi : 21,1 km). */
export const KM_COURSE_LONGUE = 21;

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
  /** La récupération d'une course DÉJÀ courue — A, B ou C (`fin` = premier jour d'entraînement normal). */
  recuperation: { course: string; fin?: string } | null | undefined;
  /** Le jour 0 du plan, AAAA-MM-JJ (dans le fuseau du coureur). */
  aujourdhui: string;
}): CourseCEcartee | null {
  const cs = a.courseSecondaire;
  if (!cs || cs.priorite !== "C" || !(cs.idx >= 0 && cs.idx <= 6)) return null;
  const dateC = plusJours(a.aujourdhui, cs.idx);
  // Pendant la récupération d'une course déjà courue (A, B ou C).
  if (a.recuperation?.fin && dateC < a.recuperation.fin) return { idx: cs.idx, nom: cs.nom, motif: "apres", courseA: a.recuperation.course || null };
  const d = a.daysToRace;
  if (d == null || d < 0) return null;
  // Le jour de la A et les jours qui la précèdent : 2, ou 6 avant un semi ou un marathon. Distance
  // inconnue : on ne suppose pas une course longue.
  const avant = Number(a.distanceA) >= KM_COURSE_LONGUE ? JOURS_AVANT_A_LONGUE : JOURS_AVANT_A;
  if (cs.idx <= d && cs.idx >= d - avant) return { idx: cs.idx, nom: cs.nom, motif: "avant", courseA: a.nomA || null };
  // Après la A, dans la semaine : jusqu'à la fin de sa récupération. Distance inconnue : on ne suppose
  // pas une durée de récupération, on garde le seul protocole de course (repos, reprise : 2 jours).
  if (cs.idx > d) {
    const fenetre = Number(a.distanceA) > 0 ? joursDeRecuperation(Number(a.distanceA)) : JOURS_AVANT_A;
    if (cs.idx - d <= fenetre) return { idx: cs.idx, nom: cs.nom, motif: "apres", courseA: a.nomA || null };
  }
  return null;
}
