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

/** La phase d'une semaine selon le nombre de semaines restant avant la course. */
export function phaseDeSemaine(semainesRestantes: number): Phase {
  return semainesRestantes <= 2 ? "Affûtage"
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
