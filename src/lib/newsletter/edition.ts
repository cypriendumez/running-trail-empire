import { RUBRIQUES_LETTRE } from "@/lib/news/rubriques";
import { UA_PACEVOBOT } from "@/lib/races/robot";

/**
 * L'ÉDITION DE @GAZETTE : le choix d'un rédacteur, appliqué par la lettre du lundi.
 *
 * ⚠️ POURQUOI (10/11/2026, Cyprien : « actionne Gazette […] pour qu'il soit surpuissant
 * mais reste dans la gratuité »). La lettre choisit ses articles par des RÈGLES : nombre de
 * médias, mots-clés, date. Elles ne jugent pas ce qui intéresse un coureur coaché, et
 * l'agent prévu pour ça (@Gazette, n°19) n'avait « aucune routine ». Le juger avec un
 * modèle payant coûterait ; une routine Claude de Cyprien est déjà comprise dans son
 * abonnement. @Gazette lit donc le dimanche soir les candidats de la semaine
 * (`/api/newsletter/candidats`), choisit, fait viser son choix par @Maestro, et ouvre une
 * PULL REQUEST qui ne change que ce fichier. Cyprien la relit et la fusionne dans `main`
 * avant l'envoi s'il est d'accord (choix du 10/11/2026 : « PR, je fusionne ») : les agents
 * s'arrêtent à la PR (correction 7 de la constitution). La lettre lit le fichier brut de
 * `main` sur GitHub : aucun déploiement n'est nécessaire.
 *
 * ⚠️ CE FICHIER N'EST PAS DIGNE DE CONFIANCE, ET IL N'A PAS À L'ÊTRE. Il ne contient que
 * des LIENS. La lettre n'en garde que ceux qui figurent déjà parmi SES candidats de la
 * semaine (qu'elle a collectés et filtrés elle-même : promotions, hors-sujet), dans
 * l'ordre choisi, puis complète avec son propre ordre. Aucun texte du fichier n'entre
 * dans l'e-mail. Un fichier absent, illisible, d'une autre semaine ou vide : la lettre
 * part comme avant, et sa réponse dit pourquoi.
 */

export const URL_EDITION =
  "https://raw.githubusercontent.com/cypriendumez/running-trail-empire/main/ops/gazette/edition.json";

export type CleRubrique = (typeof RUBRIQUES_LETTRE)[number]["cle"];
export type Edition = {
  /** Le lundi d'envoi, AAAA-MM-JJ (heure de Paris). */
  pour: string;
  rubriques: Partial<Record<CleRubrique, string[]>>;
};
export type LectureEdition = { edition: Edition | null; raison: string };

const CLES = new Set<string>(RUBRIQUES_LETTRE.map((r) => r.cle));
const JOUR = 24 * 3600 * 1000;

/**
 * Valide un fichier d'édition. `aujourdhui` est la date de Paris (AAAA-MM-JJ) du passage.
 * Une édition vaut pour son lundi, la veille (aperçu du dimanche soir) et le lendemain
 * (GitHub a déjà lancé la tâche du lundi avec sept heures et demie de retard).
 */
export function validerEdition(brut: unknown, aujourdhui: string): LectureEdition {
  if (!brut || typeof brut !== "object") return { edition: null, raison: "fichier illisible" };
  const o = brut as { pour?: unknown; rubriques?: unknown };
  if (typeof o.pour !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.pour)) return { edition: null, raison: "date « pour » absente ou mal formée" };
  const ecart = Math.abs(Date.parse(`${o.pour}T12:00:00Z`) - Date.parse(`${aujourdhui}T12:00:00Z`));
  if (!Number.isFinite(ecart) || ecart > JOUR) return { edition: null, raison: `édition pour le ${o.pour}, pas pour cette semaine (${aujourdhui})` };
  if (!o.rubriques || typeof o.rubriques !== "object") return { edition: null, raison: "aucune rubrique" };
  const rubriques: Edition["rubriques"] = {};
  for (const [cle, liens] of Object.entries(o.rubriques as Record<string, unknown>)) {
    if (!CLES.has(cle) || !Array.isArray(liens)) continue;
    const propres = liens.filter((l): l is string => typeof l === "string" && /^https?:\/\//.test(l)).slice(0, 12);
    if (propres.length) rubriques[cle as CleRubrique] = propres;
  }
  if (!Object.keys(rubriques).length) return { edition: null, raison: "aucune rubrique connue" };
  return { edition: { pour: o.pour, rubriques }, raison: "ok" };
}

/**
 * Remet une liste de candidats dans l'ordre choisi : d'abord les liens de l'édition QUI
 * SONT DÉJÀ CANDIDATS, dans son ordre, puis le reste dans l'ordre d'origine. Un lien
 * inconnu est ignoré : l'édition ne peut rien ajouter, seulement choisir.
 */
export function ordonnerSelon<T>(candidats: T[], liens: string[] | undefined, lienDe: (x: T) => string): T[] {
  if (!liens?.length) return candidats;
  const parLien = new Map(candidats.map((c) => [lienDe(c), c]));
  const choisis: T[] = [];
  for (const l of liens) {
    const c = parLien.get(l);
    if (c && !choisis.includes(c)) choisis.push(c);
  }
  return [...choisis, ...candidats.filter((c) => !choisis.includes(c))];
}

/** Lit l'édition publiée. Ne lève jamais : une panne rend `null` et sa raison. */
export async function lireEdition(aujourdhui: string, url = URL_EDITION): Promise<LectureEdition> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA_PACEVOBOT }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (r.status === 404) return { edition: null, raison: "aucune édition publiée" };
    if (!r.ok) return { edition: null, raison: `édition illisible (HTTP ${r.status})` };
    return validerEdition(await r.json(), aujourdhui);
  } catch (e) {
    return { edition: null, raison: `édition injoignable : ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Le lundi d'envoi de la lettre à venir : aujourd'hui si c'est lundi, sinon le prochain. */
export function lundiDEnvoi(aujourdhui: string): string {
  const t = Date.parse(`${aujourdhui}T12:00:00Z`);
  const jour = new Date(t).getUTCDay(); // date civile ancrée à midi UTC : aucun fuseau en jeu
  const dans = (8 - jour) % 7;
  return new Date(t + dans * JOUR).toISOString().slice(0, 10);
}
