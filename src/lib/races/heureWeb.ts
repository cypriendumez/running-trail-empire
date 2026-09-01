import { normaliserHeure } from "./heure";

/**
 * RECHERCHE AUTOMATIQUE DE L'HEURE DE DÉPART, SUR LE WEB PUBLIC.
 *
 * ⚠️ PREMIÈRE VERSION : ELLE A MANQUÉ UNE HEURE QUI ÉTAIT PUBLIÉE.
 * Le 27/08/2026, La Voix du Nord annonçait « départ à 11h15 boulevard de la Liberté »
 * pour le marathon de Lille. Ma recherche a répondu INCONNU. Trois défauts de prompt,
 * reproduits et corrigés un par un :
 *
 *  1. « en priorité le site officiel de l'organisateur » — le règlement de Lille dit
 *     « Horaire à venir ». En pointant le modèle vers cette page, je l'empêchais de
 *     voir l'annonce faite ailleurs. Or l'heure était bien sur le site officiel, dans
 *     sa section ACTUS, que ce cadrage lui a fait manquer.
 *  2. La distance formulée en machine (« 42.2 km ») produisait des requêtes que
 *     personne n'écrirait. Reformulée en français (« 42,195 km, le marathon »), la même
 *     recherche trouve.
 *  3. « Réponds UNIQUEMENT par HH:MM » forçait un choix binaire : le modèle abandonnait
 *     au lieu de rapporter ce qu'il avait lu. Vérifié : demander une sortie JSON tue
 *     carrément la recherche (0 source consultée).
 *
 * D'où DEUX ÉTAPES. On cherche largement et on laisse répondre en clair ; puis on
 * extrait l'heure du format demandé par un second appel, court et sans recherche.
 * Vérifié sur le texte réel : « le marathon partira à 11h15, le semi à 8h30 » donne
 * 11:15 pour le marathon, 08:30 pour le semi, et INCONNU pour le 10 km.
 */

export type DemandeHeure = { race: string; raceDate: string; distanceKm: number | null };

export const MARQUEUR_INCONNU = "INCONNU";

/** La distance dite comme un coureur la dirait — c'est ce qui change les requêtes. */
export function libelleFormat(distanceKm: number | null): string {
  const d = Number(distanceKm);
  if (!(d > 0)) return "la distance principale";
  if (Math.abs(d - 42.195) < 0.4) return "42,195 km (le marathon)";
  if (Math.abs(d - 21.1) < 0.4) return "21,1 km (le semi-marathon)";
  const txt = Number.isInteger(d) ? `${d}` : String(d).replace(".", ",");
  return `${txt} km`;
}

/** Date dite en français : une requête web ne se formule pas en ISO. */
export function libelleDate(iso: string): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso ?? "");
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin",
                "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${Number(m[3])} ${mois[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/**
 * ÉTAPE 1 — la recherche. Volontairement LARGE : c'est le cadrage étroit qui avait
 * fait manquer l'annonce de La Voix du Nord.
 */
export function promptRecherche(d: DemandeHeure): string {
  return [
    `À quelle heure est donné le départ de « ${d.race} » le ${libelleDate(d.raceDate)}, pour le format ${libelleFormat(d.distanceKm)} ?`,
    "",
    "Cherche PARTOUT : le site de l'organisateur Y COMPRIS SES ACTUALITÉS, la presse locale et régionale, les sites de la ville, les calendriers de courses, les réseaux sociaux de l'épreuve.",
    "Une annonce de presse fiable vaut une source, même si le règlement officiel n'est pas encore à jour — c'est souvent le cas plusieurs semaines avant la course.",
    "",
    "Réponds en clair, en citant les horaires que tu trouves et pour quelle distance chacun vaut. N'invente jamais une heure.",
  ].join("\n");
}

/**
 * ÉTAPE 2 — l'extraction. Sans recherche, sans raisonnement, sur le texte rapporté.
 *
 * ⚠️ C'EST ICI QU'ON ÉVITE DE PRENDRE L'HEURE D'UN AUTRE FORMAT. Le texte trouvé
 * contient très souvent plusieurs départs (« le marathon à 11h15, le semi à 8h30 ») :
 * attraper la première heure venue donnerait une réponse fausse la moitié du temps.
 */
export function promptExtraction(texte: string, d: DemandeHeure): string {
  return [
    "Voici ce qu'une recherche web a trouvé sur une course :",
    "---",
    String(texte ?? "").slice(0, 4000),
    "---",
    `Quelle heure de départ correspond EXACTEMENT au format ${libelleFormat(d.distanceKm)} ?`,
    `Réponds UNIQUEMENT par HH:MM, ou ${MARQUEUR_INCONNU} si ce texte ne donne pas l'heure de CE format précis.`,
  ].join("\n");
}

export type Verdict =
  | { retenue: true; heure: string; sources: string[] }
  | { retenue: false; motif: "inconnu" | "illisible" | "sans_source" };

/**
 * Décide si le couple (recherche, extraction) est enregistrable.
 *
 * Les sources viennent de l'ÉTAPE 1 : c'est elle qui a consulté le web. Une extraction
 * sans recherche derrière serait une réponse de mémoire, donc une invention possible —
 * et le modèle sonne aussi sûr dans les deux cas.
 */
export function analyserReponse(extraction: string, sourcesRecherche: string[] | undefined): Verdict {
  const brut = String(extraction ?? "").trim();
  if (!brut || new RegExp(MARQUEUR_INCONNU, "i").test(brut)) return { retenue: false, motif: "inconnu" };
  const h = normaliserHeure(brut);
  if (!h) return { retenue: false, motif: "illisible" };
  const src = (sourcesRecherche ?? []).filter(Boolean);
  if (!src.length) return { retenue: false, motif: "sans_source" };
  return { retenue: true, heure: h, sources: src.slice(0, 5) };
}
