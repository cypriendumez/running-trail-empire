// ─────────────────────────────────────────────────────────────────────────────
//  LES ARRÊTS PENDANT UNE SÉANCE DE QUALITÉ — ce qu'ils enlèvent au verdict.
//
//  Choix de Cyprien (10/11/2026) : « si tu t'arrêtes plus d'une minute pendant une séance
//  de qualité, la récupération a été plus longue que prévu : le coach ne compte pas cette
//  séance comme preuve que tu peux durcir, et te le dit. Les footings et sorties longues
//  ne sont pas touchés. »
//
//  Pourquoi seulement CE verdict : des répétitions tenues (ou accélérées) après des
//  récupérations rallongées par des arrêts ne prouvent pas que la charge PRÉVUE était
//  bien dosée — l'athlète a récupéré davantage. En revanche un DÉCROCHAGE malgré des
//  récupérations plus longues reste un décrochage : on ne l'efface jamais.
//
//  Les arrêts viennent de la trace GPS (lib/activities/pauses) ; sans trace, on ne sait
//  pas, et le verdict reste celui des allures.
// ─────────────────────────────────────────────────────────────────────────────
import type { PausesSeance } from "@/lib/activities/pauses";

/** Un arrêt à partir duquel la récupération est réellement rallongée (« plus d'une minute »). */
export const ARRET_QUALITE_SEC = 60;
/** Mêmes seuils que le reste du coach (coachContext) : décrochage et accélération en s/km. */
export const DECROCHAGE_SEC = 12;
export const ACCELERATION_SEC = -6;

export type RecupAllongee = { n: number; totalSec: number; plusLongueSec: number };

/** Les arrêts d'au moins une minute d'une séance de qualité ; `null` s'il n'y en a pas ou si on ne sait pas. */
export function recupAllongee(p: PausesSeance | null | undefined): RecupAllongee | null {
  const longs = (p?.liste ?? []).filter((x) => x.dureeSec >= ARRET_QUALITE_SEC);
  if (!longs.length) return null;
  return {
    n: longs.length,
    totalSec: longs.reduce((s, x) => s + x.dureeSec, 0),
    plusLongueSec: longs.reduce((m, x) => Math.max(m, x.dureeSec), 0),
  };
}

export type VerdictExecution = "decrochage" | "accelere" | "tenue" | "non_probant" | "arrets_inconnus";

/**
 * Le verdict sur l'exécution de la dernière série. `null` sans décrochage mesuré.
 * `non_probant` : allure tenue ou accélérée, mais avec des arrêts d'au moins une minute —
 * la séance ne prouve pas qu'on peut durcir.
 * `arrets_inconnus` : la trace existe mais n'a pas pu être LUE (panne) — une panne n'est pas
 * « aucun arrêt », on ne conclut pas non plus qu'on peut durcir (relecture du 10/11/2026).
 * Une séance SANS trace (tapis) garde le verdict des allures : choix assumé, voir l'en-tête.
 */
export function verdictExecution(fadeSec: number | null | undefined, recup: RecupAllongee | null, arretsIllisibles = false): VerdictExecution | null {
  if (fadeSec == null || !Number.isFinite(fadeSec)) return null;
  if (fadeSec >= DECROCHAGE_SEC) return "decrochage";
  if (recup) return "non_probant";
  if (arretsIllisibles) return "arrets_inconnus";
  return fadeSec <= ACCELERATION_SEC ? "accelere" : "tenue";
}
