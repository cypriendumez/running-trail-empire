// ─────────────────────────────────────────────────────────────────────────────
//  LE PROGRAMME MARCHE-COURSE — pour qui ne court pas encore 30 minutes d'affilée.
//
//  ⚠️ CONSTAT (Cyprien, 05/11/2026). Rien ne distinguait un débutant complet d'un coureur
//  de « moins d'un an ». Les deux recevaient d'abord un test VMA — « cours 6 minutes À
//  FOND » —, puis des footings continus. Pour une personne qui n'a jamais couru, c'est un
//  effort maximal le premier jour, puis des séances qu'elle ne peut pas finir : la
//  périostite et l'abandon de la troisième semaine.
//
//  LA RÈGLE. L'inscription demande « Peux-tu courir 30 minutes sans t'arrêter ? » ; une
//  réponse « pas encore » (`profiles.peut_courir_30min = false`) ouvre ce programme :
//  onze étapes de trois séances, de 8 × (1 min de course / 2 min de marche) à 30 minutes
//  de course continue, soit une dizaine de semaines à trois séances par semaine. Ni test
//  VMA ni séance de qualité tant qu'il dure : aucune allure n'y sert.
//
//  ⚠️ SANS ÉTAT STOCKÉ. L'étape se déduit des sorties enregistrées : trois par semaine au
//  plus comptent (courir tous les jours n'accélère pas des tendons qui s'adaptent en
//  semaines), sur vingt semaines. Dix jours sans courir font redescendre d'une étape, vingt
//  de deux. Le programme se referme seul à la dernière étape franchie ; une longue coupure
//  le rouvre plus bas, ce qui est exactement ce qu'il faut.
// ─────────────────────────────────────────────────────────────────────────────
import { ecartJours } from "@/lib/coach/recuperation";

/** Une séance du programme : une alternance, ou de la course continue. */
export type SeanceMarcheCourse =
  | { reps: number; courseMin: number; marcheMin: number }
  | { continuMin: number };

/** Les étapes, dans l'ordre. Durée de course par séance : 8, 14, 18, 20, 24, 24, 30, 30, puis 20, 25, 30 min d'affilée. */
export const ETAPES_MARCHE_COURSE: readonly SeanceMarcheCourse[] = [
  { reps: 8, courseMin: 1, marcheMin: 2 },
  { reps: 7, courseMin: 2, marcheMin: 2 },
  { reps: 6, courseMin: 3, marcheMin: 2 },
  { reps: 5, courseMin: 4, marcheMin: 2 },
  { reps: 4, courseMin: 6, marcheMin: 2 },
  { reps: 3, courseMin: 8, marcheMin: 2 },
  { reps: 3, courseMin: 10, marcheMin: 2 },
  { reps: 2, courseMin: 15, marcheMin: 2 },
  { continuMin: 20 },
  { continuMin: 25 },
  { continuMin: 30 },
];
/** Séances par étape : une semaine à trois sorties. */
export const SEANCES_PAR_ETAPE = 3;
/** Sorties comptées par semaine, au plus. */
export const SORTIES_COMPTEES_PAR_SEMAINE = 3;
/** Fenêtre sur laquelle les sorties comptent : de quoi finir le programme à deux sorties par semaine. */
export const FENETRE_JOURS = 140;
/** Jours sans courir qui font redescendre d'une étape. */
export const JOURS_PAR_RECUL = 10;
/** Marche active avant et après chaque séance. */
export const MARCHE_ENCADRANTE_MIN = 5;

export type ProgrammeMarcheCourse = {
  /** Étape en cours, à partir de 1. */
  etape: number;
  total: number;
  seance: SeanceMarcheCourse;
  /** Séances comptées depuis le début du programme (après recul). */
  seancesFaites: number;
};

/**
 * Le programme en cours, ou `null` : l'athlète court déjà 30 minutes (ou n'a pas répondu),
 * ou il a franchi la dernière étape.
 *
 * `joursCourus` : les dates (AAAA-MM-JJ) des sorties de COURSE, dans n'importe quel ordre.
 * ⚠️ `aujourdhui` EST FOURNI, jamais lu de l'horloge (voir `lib/time`).
 */
export function programmeMarcheCourse(args: {
  peutCourir30: boolean | null | undefined;
  joursCourus: readonly string[];
  aujourdhui: string;
}): ProgrammeMarcheCourse | null {
  const { peutCourir30, joursCourus, aujourdhui } = args;
  if (peutCourir30 !== false) return null;
  // Jours de course distincts dans la fenêtre, regroupés par blocs de sept jours depuis
  // aujourd'hui ; trois au plus par bloc.
  const parBloc = new Map<number, number>();
  let dernier: string | null = null;
  for (const d of new Set(joursCourus.map((j) => String(j).slice(0, 10)))) {
    const ilYa = ecartJours(aujourdhui, d);
    if (ilYa == null || ilYa < 0 || ilYa >= FENETRE_JOURS) continue;
    const bloc = Math.floor(ilYa / 7);
    parBloc.set(bloc, (parBloc.get(bloc) ?? 0) + 1);
    if (dernier == null || d > dernier) dernier = d;
  }
  const comptees = [...parBloc.values()].reduce((s, n) => s + Math.min(SORTIES_COMPTEES_PAR_SEMAINE, n), 0);
  const sansCourir = dernier == null ? 0 : ecartJours(aujourdhui, dernier) ?? 0;
  const recul = Math.floor(sansCourir / JOURS_PAR_RECUL);
  const seancesFaites = Math.max(0, comptees - recul * SEANCES_PAR_ETAPE);
  const indice = Math.floor(seancesFaites / SEANCES_PAR_ETAPE);
  if (indice >= ETAPES_MARCHE_COURSE.length) return null;
  return { etape: indice + 1, total: ETAPES_MARCHE_COURSE.length, seance: ETAPES_MARCHE_COURSE[indice], seancesFaites };
}

/** Minutes de course de la séance, et sa durée totale marche d'encadrement comprise. */
export function dureesMarcheCourse(s: SeanceMarcheCourse): { courseMin: number; totalMin: number } {
  if ("continuMin" in s) return { courseMin: s.continuMin, totalMin: s.continuMin + 2 * MARCHE_ENCADRANTE_MIN };
  // Pas de marche après la dernière course : la marche de fin enchaîne.
  const courseMin = s.reps * s.courseMin;
  return { courseMin, totalMin: courseMin + (s.reps - 1) * s.marcheMin + 2 * MARCHE_ENCADRANTE_MIN };
}
