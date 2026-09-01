import { normaliserHeure } from "./heure";

/**
 * RECHERCHE AUTOMATIQUE DE L'HEURE DE DÉPART, SUR LE WEB PUBLIC.
 *
 * ⚠️ POURQUOI ON NE PEUT PAS LA PRENDRE DANS LE CATALOGUE. Vérifié à la source :
 * finishers.com publie `startDate: 2026-10-25` — une date, sans heure — et son API est
 * fermée (401). jogging-plus est passé derrière un défi anti-robot. La fiche finishers
 * ne pointe même pas vers le site de l'organisateur. L'information EXISTE pourtant, sur
 * le site de l'organisateur et dans la presse locale : elle est juste hors de portée
 * d'un import de catalogue.
 *
 * On la fait donc chercher par le modèle AVEC RECHERCHE WEB, une course à la fois —
 * celle que l'athlète prépare, pas les 17 027 du catalogue. Essai réel du 01/09/2026
 * sur le Marathon de Lille : deux requêtes web, six sources, et une réponse honnête —
 * « le semi part à 8 h 30, l'heure du marathon n'est pas encore communiquée ».
 *
 * ⚠️ TROIS CONDITIONS AVANT D'ENREGISTRER QUOI QUE CE SOIT.
 *   1. Une heure lisible et plausible, sinon rien. Une heure de départ fausse est pire
 *      qu'une heure absente : elle se planifie, et on rate son départ en s'y fiant.
 *   2. DES SOURCES. Une réponse sans source consultée est une réponse de mémoire, donc
 *      une invention potentielle — on la refuse, quelle que soit son assurance.
 *   3. Le modèle doit pouvoir dire « INCONNU ». Le prompt le lui demande explicitement,
 *      et c'est la réponse la plus utile tant que l'organisateur n'a rien publié.
 */

export type DemandeHeure = { race: string; raceDate: string; distanceKm: number | null };

/** Le modèle DOIT pouvoir répondre « je ne sais pas » — c'est le cas le plus fréquent
 *  tant que l'organisateur n'a pas publié son programme. */
export const MARQUEUR_INCONNU = "INCONNU";

export function promptHeure(d: DemandeHeure): string {
  const dist = d.distanceKm && d.distanceKm > 0 ? `${d.distanceKm} km` : "la distance principale";
  return [
    `Quelle est l'heure de départ officielle de « ${d.race} » du ${d.raceDate}, pour le format ${dist} ?`,
    "Cherche sur le web, en priorité le site officiel de l'organisateur.",
    "",
    "Règles de réponse, à respecter strictement :",
    `- Si tu trouves l'heure sur une source fiable : réponds UNIQUEMENT par HH:MM (24 h), rien d'autre.`,
    `- Si l'heure n'est pas encore publiée, ou si tu n'as qu'une heure pour un AUTRE format que ${dist} : réponds UNIQUEMENT ${MARQUEUR_INCONNU}.`,
    "- N'invente jamais une heure plausible. Une heure fausse est pire qu'une heure absente.",
  ].join("\n");
}

export type Verdict =
  | { retenue: true; heure: string; sources: string[] }
  | { retenue: false; motif: "inconnu" | "illisible" | "sans_source" };

/**
 * Décide si la réponse du modèle est enregistrable.
 *
 * Volontairement STRICTE sur la forme : on n'accepte qu'une réponse dont l'essentiel
 * est l'heure. Une phrase (« le départ est probablement vers 9h ») est rejetée — le
 * « probablement » ne survit pas au stockage, et on enregistrerait une supposition
 * comme un fait.
 */
export function analyserReponse(texte: string, sources: string[] | undefined): Verdict {
  const brut = String(texte ?? "").trim();
  if (!brut || new RegExp(MARQUEUR_INCONNU, "i").test(brut)) return { retenue: false, motif: "inconnu" };
  // ⚠️ CE QUI REFUSE LES PHRASES, C'EST L'ANCRAGE DE `normaliserHeure` (^…$), pas une
  //    limite de longueur. J'avais ajouté un `brut.length > 12` par prudence : le muter
  //    n'a fait rougir AUCUN test, parce qu'il ne servait à rien. Une défense qu'aucun
  //    test ne peut exercer donne une fausse assurance — retirée.
  //    Si quelqu'un désancre un jour `normaliserHeure`, c'est le test « une PHRASE n'est
  //    jamais enregistrée comme une heure » qui rougira, au bon endroit.
  const h = normaliserHeure(brut);
  if (!h) return { retenue: false, motif: "illisible" };
  const src = (sources ?? []).filter(Boolean);
  if (!src.length) return { retenue: false, motif: "sans_source" };
  return { retenue: true, heure: h, sources: src.slice(0, 5) };
}
