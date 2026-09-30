/**
 * LES CLASSEMENTS DES ÉDITIONS PASSÉES — 2025, 2024, 2023 (30/09/2026).
 *
 * Demandé par Cyprien : « mets les anciens résultats des courses, 2025, 2024… ». La base ne
 * gardait qu'UN lien de classement par course — et depuis qu'on ne propose plus celui d'une
 * édition pas encore courue, une course de 2026 n'en montrait plus aucun.
 *
 * Beaucoup de chronométreurs rangent chaque édition sous une adresse qui porte l'année :
 * « …wiclax-results.com/La Ronda des Coudous 2026/ ». L'édition 2025 est souvent la même
 * adresse avec 2025 — mesuré : 2025 et 2024 répondent, 2023 et 1999 sont introuvables (404).
 *
 * ⚠️ UNE ADRESSE DEVINÉE N'EST PAS UNE ADRESSE VÉRIFIÉE. Chaque candidate est OUVERTE avant
 * d'être proposée, et un site qui répond « trouvé » à n'importe quelle année (témoin : 1999)
 * est écarté en bloc — il renverrait sa page d'accueil sous l'étiquette « Classement 2024 ».
 */

export type EditionResultats = { annee: number; url: string };

/**
 * L'année d'un lien SI elle figure exactement une fois dans son chemin DÉCODÉ (sinon, on ne
 * devine pas). ⚠️ Décodé : dans « …Coudous%202026/ », l'année suit « %20 » — lue brute, le
 * « 0 » de l'espace encodé passait pour un chiffre collé à l'année.
 */
function remplaceurAnnee(url: string, annee: number): ((autre: number) => string) | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  let chemin: string;
  try { chemin = decodeURIComponent(u.pathname); } catch { return null; }
  const re = new RegExp(`(?<!\\d)${annee}(?!\\d)`, "g");
  const dansChemin = [...chemin.matchAll(re)];
  if (dansChemin.length !== 1 || re.test(decodeURIComponent(u.search))) return null;
  const i = dansChemin[0].index!;
  return (autre) => { const v = new URL(url); v.pathname = `${chemin.slice(0, i)}${autre}${chemin.slice(i + 4)}`; return v.toString(); };
}

/**
 * Les adresses candidates des `n` éditions précédant `annee`, dans l'ordre (la plus récente
 * d'abord), plus le TÉMOIN d'une année absurde qui sert à démasquer un site « attrape-tout ».
 */
export function adressesEditions(url: string, annee: number, n = 3): { candidates: EditionResultats[]; temoin: string } | null {
  if (!Number.isInteger(annee) || annee < 2000) return null;
  const vers = remplaceurAnnee(url, annee);
  if (!vers) return null;
  return {
    candidates: Array.from({ length: n }, (_, k) => ({ annee: annee - 1 - k, url: vers(annee - 1 - k) })),
    temoin: vers(1999),
  };
}

/** Une réponse prouve-t-elle qu'une page d'édition EXISTE ? 2xx, et pas renvoyée ailleurs. */
export function pageTrouvee(code: number, urlFinale: string, annee: number): boolean {
  let finale = urlFinale;
  try { finale = decodeURIComponent(urlFinale); } catch { /* adresse mal encodée : lue telle quelle */ }
  return code >= 200 && code < 300 && new RegExp(`(?<!\\d)${annee}(?!\\d)`).test(finale);
}

/**
 * Les éditions à PROPOSER pour une course : celles qui ont été vérifiées, sans le lien
 * principal (déjà affiché) ni une édition postérieure à celle qu'on sait passée, triées de
 * la plus récente à la plus ancienne, trois au plus.
 */
export function editionsAAfficher(editions: unknown, lienPrincipal: string | null | undefined): EditionResultats[] {
  if (!Array.isArray(editions)) return [];
  const vues = new Set<number>();
  return editions
    .filter((e): e is EditionResultats => !!e && typeof (e as EditionResultats).url === "string" && /^https?:\/\//.test((e as EditionResultats).url)
      && Number.isInteger((e as EditionResultats).annee))
    .filter((e) => e.url !== lienPrincipal && !vues.has(e.annee) && (vues.add(e.annee), true))
    .sort((a, b) => b.annee - a.annee)
    .slice(0, 3);
}
