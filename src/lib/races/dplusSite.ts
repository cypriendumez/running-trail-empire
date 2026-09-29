/**
 * LE DÉNIVELÉ LU SUR LE SITE OFFICIEL (29/09/2026).
 *
 * ⚠️ POURQUOI. Audit du catalogue : 7 308 trails sans dénivelé (3 914 datés) — la fiche de
 * la source ne le donne pas. Or beaucoup de sites d'organisateurs l'écrivent en toutes
 * lettres sur leur page d'accueil : « 24 Km - 1450 d+ », « Distance : 32,72 km Dénivelé
 * positif : 792 m », « un trail de 27km et 1100m D+ ». Cette page est DÉJÀ lue chaque
 * semaine pour le lien « Résultats » (`scripts/resultats-sites.ts`) : aucune requête de plus.
 *
 * Mesuré sur 60 sites : un format sur six retrouve son dénivelé, et chaque couple relu
 * était juste. La règle privilégie la justesse : la distance doit précéder la mention
 * (dans les 90 caractères, sans autre dénivelé entre les deux), un format ne prend une
 * valeur que si elle est UNIQUE à sa distance, et jamais un « dénivelé négatif ».
 */
import { dplusPlausible } from "./majFinishers";

export type CoupleDplus = { km: number; dplus: number };

const texte = (html: string) => html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&eacute;/g, "é").replace(/&#233;/g, "é")
  .replace(/\s+/g, " ");

/** « 1 100 », « 1.100 », « 32,72 » → nombre. */
const nombre = (s: string) => Number(s.replace(/[\s.](?=\d{3}\b)/g, "").replace(",", "."));

// « 1450 d+ », « 700 m de D+ », « 792 m de dénivelé positif »… ou « D+ : 1 100 m ».
// « dénivelé » SEUL n'est retenu que s'il n'est pas suivi de « négatif ».
const MENTION = /(\d{1,2}[\s.]?\d{3}|\d{2,4})\s*(?:m|mètres|metres)?\s*(?:de\s+)?(?:d\s?\+|d[ée]nivel[ée]\s+positif|d[ée]nivel[ée](?!\s*(?:n[ée]gatif|-)))|(?:d\s?\+|d[ée]nivel[ée]\s+positif)\s*:?\s*(\d{1,2}[\s.]?\d{3}|\d{2,4})\s*m\b/gi;
const DISTANCE = /(\d{1,3}(?:[.,]\d{1,2})?)\s*km\b/gi;

/** Les couples (distance, dénivelé) écrits sur une page. */
export function couplesDistanceDplus(html: string): CoupleDplus[] {
  const t = texte(String(html ?? ""));
  const out: CoupleDplus[] = [];
  let finPrecedente = 0;
  for (const m of t.matchAll(MENTION)) {
    const debut = m.index ?? 0;
    // La distance cherchée AVANT la mention, sans remonter au-delà de la précédente :
    // « 7 km avec 100 D+ et 14 km 350 D+ » ne doit pas donner 350 m au 7 km.
    const avant = t.slice(Math.max(finPrecedente, debut - 90), debut);
    finPrecedente = debut + m[0].length;
    const kms = [...avant.matchAll(DISTANCE)];
    if (!kms.length) continue;
    const km = nombre(kms[kms.length - 1][1]);
    const dplus = nombre(m[1] ?? m[2]);
    if (km > 0 && Number.isFinite(dplus) && dplus > 0) out.push({ km, dplus });
  }
  return out;
}

/**
 * Le dénivelé d'un format de `km` kilomètres d'après les couples de la page, ou `null` :
 * aucune distance voisine (± 3 %, au moins 500 m), valeur invraisemblable, ou DEUX valeurs
 * différentes pour la même distance — dans le doute, on n'écrit rien.
 */
export function dplusPourFormat(couples: readonly CoupleDplus[], km: number): number | null {
  if (!(km > 0)) return null;
  const valeurs = new Set(couples
    .filter((c) => Math.abs(c.km - km) <= Math.max(0.5, km * 0.03) && dplusPlausible(c.dplus, km))
    .map((c) => Math.round(c.dplus)));
  return valeurs.size === 1 ? [...valeurs][0] : null;
}
