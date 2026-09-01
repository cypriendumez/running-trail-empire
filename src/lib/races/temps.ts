import { jourLocal, ecartJours } from "@/lib/streak/compute";

/**
 * JOURS AVANT UNE COURSE — en jours de CALENDRIER.
 *
 * ⚠️ L'ANCIEN CALCUL DIVISAIT DES MILLISECONDES : `Math.ceil((date - Date.now()) / 86400000)`.
 * Une semaine ne fait pas toujours 168 heures — au passage à l'heure d'hiver elle en
 * fait 169, à l'heure d'été 167. Le résultat dépendait donc de l'HEURE DE CONSULTATION :
 * balayé sur 40 jours, le 20/10/2026 à 00 h 30, 35 courses affichaient « J−7 » là où il
 * fallait lire « J−6 » ; le 20/03 à 23 h 30, 31 courses étaient décalées dans l'autre
 * sens. À 8 h ou 14 h du même jour, aucun écart — le défaut n'apparaît qu'aux heures
 * creuses, ce qui explique qu'il n'ait jamais été vu.
 *
 * Un compte à rebours se compte en nuits, pas en tranches de 86 400 000 ms.
 */
export function joursAvant(dateStr: string | null | undefined, aujourdhui = jourLocal()): number | null {
  const jour = String(dateStr ?? "").slice(0, 10);
  // Le marqueur 2099 signifie « date inconnue » : aucun compte à rebours n'a de sens.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || jour.startsWith("2099")) return null;
  const n = ecartJours(aujourdhui, jour);
  return Number.isFinite(n) ? n : null;
}

/**
 * Recherche insensible aux ACCENTS et à la casse.
 *
 * ⚠️ LE CATALOGUE EST FRANÇAIS ET LA RECHERCHE NE L'ÉTAIT PAS. Elle comparait des
 * minuscules brutes : chercher « foulees » ne trouvait pas « Foulées du paté aux pommes
 * de terre », « penitents » ne trouvait pas « Pénitents Endurance », « nimes » ne
 * trouvait pas une course à Nîmes. Mesuré sur les 15 000 fiches : 4 425 noms (30 %) et
 * 3 027 villes portent au moins un accent — autant de courses qu'on ne trouvait qu'en
 * tapant l'accent au bon endroit.
 */
export function sansAccents(v: unknown): string {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Le texte contient-il la recherche, accents et casse ignorés ? */
export function correspond(champ: unknown, recherche: string): boolean {
  const q = sansAccents(recherche);
  return q === "" || sansAccents(champ).includes(q);
}
