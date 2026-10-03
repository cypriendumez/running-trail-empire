import { jourLocal, ecartJours } from "@/lib/streak/compute";
import { siteExclu } from "./robot";
import { estCalendrierTiers } from "./destination";

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

/**
 * Forme de comparaison : sans accents, ponctuation → espaces, « st »/« ste » → « saint »/
 * « sainte ». ⚠️ 29/09/2026 : « saint etienne » ne trouvait pas « Saint-Étienne », ni
 * « aix en provence » « Aix-en-Provence », ni « st malo » « Saint-Malo » — le tiret et
 * l'abréviation comptaient comme des lettres. Personne ne tape de tiret sur un téléphone.
 */
const formeRecherche = (v: unknown) => sansAccents(v).replace(/[^a-z0-9]+/g, " ")
  .replace(/\bste\b/g, "sainte").replace(/\bst\b/g, "saint").trim();

/**
 * Une expression régulière POSIX (filtre `imatch` de PostgREST) qui tolère les accents
 * SANS extension `unaccent` : chaque lettre accentuable devient la classe de ses formes —
 * « foulees » → « f[oô…]l[eéè…][eéè…]s » attrape « Foulées » ; « st » attrape aussi « saint ».
 *
 * ⚠️ REMPLACE UN JOKER TROP LARGE (29/09/2026). L'ancien motif `ilike` changeait chaque
 * voyelle et le « c » en « _ » (n'importe quel caractère) : « ducs » devenait « d__s »,
 * qui attrape aussi « de s… ». « trail des ducs » ramenait ainsi des milliers de trails ;
 * les 80 premiers par date remplissaient la liste et le « Trail des Ducs » de Bar-le-Duc
 * (avril 2027) n'apparaissait jamais. `correspond` fait toujours le tri exact ensuite.
 */
const FORMES: Record<string, string> = {
  a: "aàâäAÀÂÄ", e: "eéèêëEÉÈÊË", i: "iîïIÎÏ", o: "oôöOÔÖ", u: "uùûüUÙÛÜ", y: "yÿYŸ", c: "cçCÇ",
};
export function motifRegex(mot: string): string {
  return formeRecherche(mot).split(" ").filter(Boolean).map((t) =>
    t === "saint" ? "(saint|st)" : t === "sainte" ? "(sainte|ste)"
      : [...t].map((ch) => (FORMES[ch] ? `[${FORMES[ch]}]` : ch)).join(""),
  ).join(".*");
}

/** Le texte contient-il la recherche, accents, casse, tirets et « st » ignorés ? */
export function correspond(champ: unknown, recherche: string): boolean {
  const q = formeRecherche(recherche);
  return q === "" || formeRecherche(champ).includes(q);
}

const MOTS_VIDES_RECHERCHE = new Set(["de", "du", "des", "la", "le", "les", "et", "au", "aux", "sur", "en", "d", "l", "a"]);

/**
 * Une recherche lue comme un coureur la tape : des MOTS dans n'importe quel ordre, et
 * « 10 km » comme une distance. ⚠️ 29/09/2026 : la liste cherchait la phrase d'un bloc —
 * « hivernale templiers » ne trouvait pas « Hivernale des Templiers », « 10 km bondues »
 * ne trouvait rien (« 10 km » n'est pas dans le nom, c'est un format).
 */
export function analyseRecherche(q: string): { mots: string[]; km: number | null } {
  const brut = sansAccents(q);
  const kmTape = brut.match(/(\d+(?:[.,]\d+)?)\s*(?:km|k)\b/)?.[1];
  const km = kmTape ? Number(kmTape.replace(",", ".")) : null;
  const mots = formeRecherche(brut.replace(/(\d+(?:[.,]\d+)?)\s*(?:km|k)\b/g, " "))
    .split(" ").filter((m) => m && !MOTS_VIDES_RECHERCHE.has(m));
  return { mots, km };
}

/** La course répond-elle à la recherche analysée ? Chaque mot dans l'un des champs, et la distance. */
export function correspondCourse(
  r: { name?: unknown; organization?: unknown; city?: unknown; department?: unknown; distance_km?: unknown },
  a: { mots: string[]; km: number | null },
): boolean {
  if (a.km != null) {
    const d = Number(r.distance_km);
    if (!Number.isFinite(d) || Math.abs(d - a.km) > Math.max(0.6, a.km * 0.03)) return false;
  }
  if (!a.mots.length) return true;
  const texte = formeRecherche(`${r.name ?? ""} ${r.organization ?? ""} ${r.city ?? ""} ${r.department ?? ""}`);
  return a.mots.every((m) => texte.includes(m));
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
 *   · 78 % des fiches viennent de finishers.com, dont le robots.txt autorise l'exploration [⚠️ mais PAS ses CGU — voir plus bas, 02/10/2026] et qui publie
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

/**
 * ⚠️ DEPUIS LE 02/10/2026, UNE SOURCE N'EST « RELUE » QUE SI ELLE ACCEPTE DE L'ÊTRE. Les CGU
 * de finishers interdisent l'extraction automatisée : mis sur la liste d'opposition le
 * 02/10/2026, puis RETIRÉ le 03/10/2026 sur décision de Cyprien jusqu'au lancement —
 * tant qu'il y est,
 * (lib/races/robot), plus aucun robot ne relit ses fiches — les déclarer « vérifiables »
 * aurait été le même mensonge que celui que ce module dénonce. Ce qui reste vérifiable :
 *   · un calendrier qui l'accepte (finishers, le jour où il donne son accord écrit — il
 *     suffit alors de le retirer de la liste d'opposition) ;
 *   · le SITE OFFICIEL de l'organisateur, que la veille relit deux fois par jour autour
 *     de la course et à chaque consultation (lib/races/veilleCourse).
 */
export function ficheVerifiable(url: unknown, siteOfficiel?: unknown): boolean {
  const d = domaineSource(url);
  if (d && DOMAINES_VERIFIABLES.some((x) => d === x || d.endsWith(`.${x}`)) && !siteExclu(url)) return true;
  return typeof siteOfficiel === "string" && /^https?:\/\//i.test(siteOfficiel.trim())
    && !estCalendrierTiers(siteOfficiel) && !siteExclu(siteOfficiel);
}
