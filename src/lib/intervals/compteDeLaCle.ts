/**
 * LE COMPTE SE LIT SUR LA CLÉ (12/10/2026).
 *
 * Brancher sa montre demandait DEUX codes à recopier depuis intervals.icu : l'Athlete ID et
 * la clé API. Le premier était la source d'erreur la plus fréquente du parcours — l'adresse
 * e-mail collée à sa place, le « i » oublié, l'identifiant d'un autre compte — au point que
 * le formulaire portait trois messages d'aide rien que pour lui.
 *
 * Or la clé suffit : `GET /api/v1/athlete/0` désigne « le propriétaire de cette clé ».
 * Vérifié sur l'API le 12/10/2026 : 200 avec `id` et `name` pour une bonne clé, 401 pour
 * une mauvaise. Un seul copier-coller, et l'identifiant ne peut plus être faux.
 *
 * Un identifiant FOURNI reste accepté (page Sync Montre) : c'est lui qu'on interroge alors.
 */
const BASE = "https://intervals.icu/api/v1";

export type CodeRefus = "cle_refusee" | "acces_refuse" | "athlete_introuvable" | "indisponible" | "reponse_invalide";

export type CompteLu =
  | { ok: true; athleteId: string; nom: string | null }
  | { ok: false; code: CodeRefus; status: number; message: string };

const MESSAGES: Record<CodeRefus, string> = {
  cle_refusee: "Clé API refusée par intervals.icu : recopie-la en entier depuis Paramètres › Developer Settings",
  acces_refuse: "Accès refusé (403) : cet Athlete ID ne correspond pas à cette clé",
  athlete_introuvable: "Athlete ID introuvable : il commence par « i » suivi de chiffres (ex. i564686)",
  indisponible: "intervals.icu ne répond pas : réessaie dans une minute",
  reponse_invalide: "Réponse inattendue d'intervals.icu : réessaie dans une minute",
};

const refus = (code: CodeRefus, status: number): CompteLu => ({ ok: false, code, status, message: MESSAGES[code] });

/**
 * Le compte intervals.icu auquel ouvre cette clé.
 * @param athleteId identifiant saisi, ou `null` pour le déduire de la clé
 * @param f `fetch` injectable (tests)
 */
export async function compteDeLaCle(apiKey: string, athleteId: string | null, f: typeof fetch = fetch): Promise<CompteLu> {
  // Un identifiant SAISI doit avoir la forme « i » + chiffres AVANT tout appel : « .. »
  // ou « i1/../x » enverraient la requête ailleurs dans l'API (relevé par le crash-test).
  const saisi = athleteId?.trim().toLowerCase() ?? "";
  if (saisi && !/^i\d+$/.test(saisi)) return refus("athlete_introuvable", 422);
  const cible = saisi || "0";
  let res: Response;
  try {
    res = await f(`${BASE}/athlete/${encodeURIComponent(cible)}`, {
      headers: { Authorization: "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64") },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return refus("indisponible", 503);
  }

  if (res.status === 401) return refus("cle_refusee", 422);
  if (res.status === 403) return refus("acces_refuse", 422);
  if (res.status === 404) return refus("athlete_introuvable", 422);
  if (!res.ok) {
    // Panne d'intervals.icu : avec un identifiant SAISI ET bien formé, on enregistre quand
    // même, comme avant (la synchro rattrapera). Sans lui, on ne sait pas QUEL compte
    // enregistrer ; mal formé, on enregistrerait n'importe quoi (relevé par le crash-test).
    if (res.status >= 500 && saisi) return { ok: true, athleteId: saisi, nom: null };
    // 429 (trop de requêtes) et 408 (délai) : intervals.icu est occupé, la clé n'y est pour rien.
    const occupe = res.status >= 500 || res.status === 429 || res.status === 408;
    return refus(occupe ? "indisponible" : "reponse_invalide", occupe ? 503 : 422);
  }

  const corps = await res.json().catch(() => null) as { id?: unknown; name?: unknown } | null;
  // En minuscules : les identifiants intervals.icu s'écrivent « i564686 », et c'est sous
  // cette forme qu'ils servent ensuite dans chaque adresse de l'API.
  const id = typeof corps?.id === "string" ? corps.id.trim().toLowerCase() : "";
  if (!/^i\d+$/.test(id)) return refus("reponse_invalide", 502);
  // Le nom ne sert qu'à l'affichage (« Compte relié : … ») : borné, il ne peut pas déborder.
  const nom = typeof corps?.name === "string" && corps.name.trim() ? corps.name.trim().slice(0, 80) : null;
  return { ok: true, athleteId: id, nom };
}
