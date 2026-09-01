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

/**
 * Domaine d'où provient une fiche de course, prêt à afficher.
 *
 * ⚠️ LE CATALOGUE N'EST PAS VÉRIFIÉ COURSE PAR COURSE, ET NE PEUT PAS L'ÊTRE.
 * Les 17 027 fiches sont reprises de deux agrégateurs — finishers.com (78 %) et
 * jogging-plus (22 %). Leur exactitude est celle de ces sources, pas la nôtre :
 * un contrôle sur 40 événements tirés au hasard a trouvé 26 pages vivantes, aucune
 * morte… mais 14 requêtes bloquées, sur lesquelles on ne peut rien conclure. Et un
 * contrôle antérieur avait bien trouvé une page disparue (« Ultra Champsaur », 404).
 *
 * Puisqu'on ne peut pas garantir, on DIT d'où ça vient. L'athlète qui s'apprête à
 * payer une inscription doit savoir qu'il lit une reprise, pas une vérification.
 */
export function domaineSource(url: unknown): string | null {
  const brut = String(url ?? "").trim();
  if (!brut) return null;
  try {
    const h = new URL(brut).hostname.replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}


/**
 * UNE FICHE PEUT-ELLE ÊTRE VÉRIFIÉE AUTOMATIQUEMENT ?
 *
 * ⚠️ CE N'EST PAS UN DÉTAIL TECHNIQUE, C'EST UNE DIFFÉRENCE DE FIABILITÉ que l'athlète
 * doit connaître avant de payer une inscription. Mesuré sur le catalogue :
 *
 *   · 78 % des fiches viennent de finishers.com, qui AUTORISE l'exploration et publie
 *     des données structurées. Le contrôle nocturne y relit la date à la source et
 *     corrige la nôtre : ces fiches se soignent toutes seules.
 *   · 22 % viennent de jogging-plus.com, passé derrière un défi anti-robot JavaScript.
 *     Il répond 403 à TOUTE requête automatique, `robots.txt` compris. Ces fiches ne
 *     seront jamais revérifiées : elles sont figées à leur date d'import.
 *
 * Laisser croire que les deux se valent serait le mensonge le plus coûteux de l'app :
 * il se paie en déplacement inutile un dimanche matin.
 */
const DOMAINES_VERIFIABLES = ["finishers.com"];

export function ficheVerifiable(url: unknown): boolean {
  const d = domaineSource(url);
  return !!d && DOMAINES_VERIFIABLES.some((x) => d === x || d.endsWith(`.${x}`));
}
