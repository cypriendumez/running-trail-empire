/**
 * LE PLAN RÉÉCRIT N'EST PAS FORCÉMENT UN PLAN MODIFIÉ.
 *
 * Le coach recalcule la semaine chaque nuit (et après chaque séance) : il EFFACE les
 * séances à venir et les réécrit. Chaque ligne réécrite naissait non lue — la cloche
 * annonçait donc « Plan mis à jour » tous les matins, plan changé ou non (constaté le
 * 06/11/2026 : une entrée par jour, à 5 h 13, pendant trois semaines).
 *
 * Deux pièges, réglés ici :
 *  · LA FENÊTRE GLISSE. Le plan d'hier couvrait J…J+6, celui d'aujourd'hui J+1…J+7 : le
 *    7ᵉ jour est TOUJOURS nouveau. On ne compare donc que les jours que l'ancien plan
 *    couvrait déjà ; le jour qui entre au bout de la fenêtre n'est pas une modification.
 *  · UNE MODIFICATION PAS ENCORE LUE NE DOIT PAS S'ÉVANOUIR. Si le plan a changé hier
 *    soir et que l'athlète ne l'a pas vu, la réécriture identique de cette nuit garde
 *    l'annonce non lue — sinon la purge effacerait la nouvelle avant qu'il la lise.
 */

export type SeanceEcrite = { date: string; moment?: string | null; title: string; body: string | null; read?: boolean };

/** Les séances partagées par les deux plans ont-elles changé (ajout, retrait, contenu) ? */
export function planModifie(avant: readonly SeanceEcrite[], apres: readonly SeanceEcrite[]): boolean {
  if (avant.length === 0) return apres.length > 0;
  const fin = avant.map((s) => s.date).sort().at(-1)!;
  const signature = (l: readonly SeanceEcrite[]) => l
    .filter((s) => s.date <= fin)
    .map((s) => `${s.date}#${s.moment ?? ""}#${s.title}#${s.body ?? ""}`)
    .sort()
    .join("\n");
  return signature(avant) !== signature(apres);
}

/**
 * L'état « lu » des séances réécrites : lues seulement si le plan n'a pas changé ET que
 * l'athlète avait déjà tout lu. Dans tous les autres cas, la cloche l'annonce.
 */
export function reecritureLue(avant: readonly SeanceEcrite[], apres: readonly SeanceEcrite[]): boolean {
  return !planModifie(avant, apres) && avant.every((s) => s.read === true);
}
