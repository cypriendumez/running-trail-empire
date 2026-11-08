/**
 * LA PHASE DE LA SEMAINE — une seule définition pour la feuille de route ET le plan.
 *
 * ⚠️ LES DEUX NE DISAIENT PAS LA MÊME CHOSE. Relevé sur le compte de Cyprien le
 * 28/09/2026, à quatre semaines du marathon de Lille : le calendrier annonçait « Qualité
 * prévue cette semaine : Allure mara » (feuille de route, phase Spécifique) pendant que le
 * plan de la même semaine posait une « Séance au seuil ». La feuille de route triait ses
 * séances selon la phase ; le menu hebdomadaire, lui, suivait l'ordre fixe de l'objectif
 * (`[seuil, allure marathon, VMA]`) et, avec une seule qualité au budget, prenait
 * toujours le seuil — y compris à quatre semaines du jour J, où c'est l'allure de course
 * qui doit se construire.
 */

export type Phase = "Base" | "Développement" | "Spécifique" | "Affûtage";

/**
 * SEMAINES D'AFFÛTAGE SELON LA DISTANCE, semaine de course comprise.
 *
 * ⚠️ TROIS SEMAINES POUR TOUT LE MONDE. Juste pour un marathon, beaucoup trop pour un 5 km :
 * le plan de Cyprien (sub 16 sur 5 km le 19/12/2026, Cyprien, 05/11/2026) coupait le volume
 * à 72, 55 puis 40 % pendant les trois dernières semaines, soit trois semaines sur les sept
 * qui le séparaient de la course. La méta-analyse de Bosquet et al. (2007) situe l'affûtage
 * optimal entre 8 et 14 jours ; l'usage le porte à trois semaines pour le marathon (le
 * volume y est le plus lourd à résorber), deux pour le semi, une pour le 5 et le 10 km.
 * Distance inconnue : trois, le comportement historique.
 */
export function semainesAffutage(distanceKm?: number | null): number {
  const d = Number(distanceKm);
  if (!(d > 0)) return 3;
  return d >= 30 ? 3 : d >= 15 ? 2 : 1;
}

/**
 * Part du volume habituel pendant l'affûtage (semaine de course : HORS course), ou `null`
 * hors affûtage. La pente reste la même ; seul le nombre de marches change.
 */
export function partAffutage(semainesRestantes: number, distanceKm?: number | null): number | null {
  const n = semainesAffutage(distanceKm);
  if (semainesRestantes > n - 1) return null;
  const parts = n >= 3 ? [0.40, 0.55, 0.72] : n === 2 ? [0.55, 0.75] : [0.65];
  return parts[Math.max(0, Math.floor(semainesRestantes))];
}

/** La phase d'une semaine selon le nombre de semaines restant avant la course (et sa distance). */
export function phaseDeSemaine(semainesRestantes: number, distanceKm?: number | null): Phase {
  return semainesRestantes <= semainesAffutage(distanceKm) - 1 ? "Affûtage"
    : semainesRestantes <= 6 ? "Spécifique"
    : semainesRestantes <= 11 ? "Développement"
    : "Base";
}

/**
 * En phase spécifique et en affûtage, la séance à allure de course passe en tête du menu.
 *
 * ⚠️ ELLE PASSE AUSSI DEVANT LE FACTEUR LIMITANT. Corriger une faiblesse (vitesse, seuil)
 * est le travail des semaines de base et de développement ; à un mois de la course, une
 * séance de VMA prise à la place de l'allure objectif est une séance d'allure objectif en
 * moins, et il n'en reste que trois ou quatre. Le facteur limitant garde la deuxième place.
 */
export function specifiqueEnTete<T extends { type: string }>(menu: readonly T[], phase: Phase | null): T[] {
  if (phase !== "Spécifique" && phase !== "Affûtage") return [...menu];
  const i = menu.findIndex((m) => m.type === "Spécifique");
  return i > 0 ? [menu[i], ...menu.filter((_, k) => k !== i)] : [...menu];
}
