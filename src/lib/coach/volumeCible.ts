/**
 * LE VOLUME CIBLE DÉCLARÉ À L'INSCRIPTION — un plafond de PROGRESSION, jamais une coupe.
 *
 * ⚠️ Jusqu'au 11/10/2026, le curseur « Volume cible / semaine » de l'étape Objectifs n'était
 * enregistré nulle part (la colonne n'existait pas) : on demandait, puis on jetait.
 * Désormais `profiles.target_weekly_km` (migration 035), et le plan s'en sert ainsi :
 *
 *  · sous la cible, le volume progresse normalement (≤ +10 %/semaine) JUSQU'À elle, puis
 *    s'y tient — le plan ne fait plus courir davantage que ce que la personne s'est fixé ;
 *  · au-dessus, on ne coupe RIEN : quelqu'un qui court déjà 70 km et a laissé le curseur
 *    sur 50 n'est pas renvoyé à 50 du jour au lendemain. On cesse seulement de monter.
 *
 * Curseur jamais touché à l'inscription = pas de cible (`null`) : la valeur affichée par
 * défaut n'est pas une réponse.
 */
export const VOLUME_CIBLE_MIN = 5;
export const VOLUME_CIBLE_MAX = 300;

/** Lit la cible déclarée ; hors bornes ou absente → `null` (pas de plafond). */
export function volumeCible(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= VOLUME_CIBLE_MIN && n <= VOLUME_CIBLE_MAX ? Math.round(n) : null;
}

/**
 * Le volume de la semaine, plafonné par la cible — sans descendre sous ce qui est déjà couru.
 * @param prevu    volume calculé par le plan (progression, allègement, affûtage compris)
 * @param cible    volume cible déclaré, ou `null`
 * @param dejaCouru volume représentatif actuel (médiane des semaines courues)
 */
export function volumeAvecCible(prevu: number, cible: number | null, dejaCouru: number): number {
  if (cible == null) return prevu;
  const plafond = Math.max(cible, Math.round(Math.max(0, dejaCouru)));
  return Math.min(prevu, plafond);
}
