// ─────────────────────────────────────────────────────────────────────────────
//  QUAND LE PLAN NE PEUT PAS ATTEINDRE LA CIBLE, IL DOIT LE DIRE.
//
//  Constaté le 06/09/2026 en exerçant le coach sur des disponibilités réduites : avec
//  DEUX jours par semaine et une cible de 68 km, le plan prescrivait 16,5 km — un quart
//  — sans un mot. L'athlète y lit un plan complet ; il croit s'entraîner comme prévu et
//  se demande ensuite pourquoi il ne progresse pas.
//
//  Ce n'est pas un défaut de calcul : on ne fait pas 68 km en deux sorties sans courir
//  34 km à chaque fois, et les plafonds de sécurité (un footing ne dépasse pas 85 % de
//  la sortie longue) l'interdisent à juste titre. Le défaut est le SILENCE.
//
//  Ce module ne corrige rien et ne force rien : il constate l'écart, et laisse
//  l'appelant le dire. La décision — ajouter un jour ou baisser la cible — revient à
//  l'athlète, pas au code.
// ─────────────────────────────────────────────────────────────────────────────

/** En deçà de cette part de la cible, l'écart n'est plus un arrondi. */
export const PART_ACCEPTABLE = 0.75;
/** Sous cette cible, l'écart relatif n'a pas de sens (reprise, première semaine). */
export const CIBLE_MIN_KM = 15;

export type EcartVolume = { prescritKm: number; cibleKm: number; manqueKm: number; part: number };

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Rend l'écart quand le plan reste NETTEMENT sous la cible, `null` sinon.
 *
 * On ne signale jamais un plan qui DÉPASSE la cible : c'est le rôle des plafonds de
 * charge, pas de ce constat — et un athlète qui en fait un peu plus n'a pas besoin
 * d'être alerté.
 */
export function manqueDeVolume(prescritKm: unknown, cibleKm: unknown): EcartVolume | null {
  if (!fini(prescritKm) || !fini(cibleKm)) return null;
  if (prescritKm < 0 || cibleKm < CIBLE_MIN_KM) return null;
  const part = prescritKm / cibleKm;
  if (part >= PART_ACCEPTABLE) return null;
  return {
    prescritKm: Math.round(prescritKm * 10) / 10,
    cibleKm: Math.round(cibleKm * 10) / 10,
    manqueKm: Math.round((cibleKm - prescritKm) * 10) / 10,
    part: Math.round(part * 100) / 100,
  };
}
