/**
 * CONTRÔLE DES LIENS D'INSCRIPTION — en tâche de fond, sans se faire bloquer.
 *
 * Le catalogue est repris de deux agrégateurs et n'est pas vérifié course par course.
 * Un contrôle sur 40 événements a trouvé 26 pages vivantes, 14 requêtes bloquées, et un
 * contrôle antérieur une page morte (« Ultra Champsaur », 404). Vérifier les 8 600
 * événements d'un coup est impossible : la source répond 403 dès qu'on enchaîne.
 *
 * D'où ce contrôle ÉTALÉ : quelques centaines d'URL par jour, en repartant toujours des
 * plus anciennement vérifiées. Le catalogue entier est parcouru en quelques semaines,
 * puis reparcouru.
 *
 * ⚠️ DEUX RÈGLES DE PRUDENCE, PARCE QU'UNE FAUSSE ALERTE EST PIRE QUE PAS D'ALERTE.
 *
 *  1. SEULS 404 ET 410 COMPTENT. Un 403 signifie « tu es bloqué », pas « la page
 *     n'existe pas » — c'est ce qui est arrivé à 14 des 40 URL du premier contrôle.
 *     Un délai dépassé ne dit rien non plus. Tout le reste est INDÉTERMINÉ et ne
 *     marque rien : on préfère ne rien dire que d'annoncer morte une course qui a lieu.
 *
 *  2. IL FAUT DEUX ÉCHECS DE SUITE, sur deux passages différents. Un site en
 *     maintenance renvoie parfois 404 pendant une heure. Marquer sur un seul relevé
 *     découragerait une inscription pour une panne passagère.
 */

export type EtatLien = { code: number; echecs: number; at: string };
export type EtatLiens = {
  /** Position dans la liste des URL, pour reprendre où le dernier passage s'est arrêté. */
  curseur: number;
  /** URL considérées comme mortes : deux 404/410 consécutifs. */
  morts: Record<string, EtatLien>;
  /** Nombre d'URL contrôlées depuis le début — pour savoir où en est le balayage. */
  verifiees: number;
  at: string;
};

export const ETAT_VIDE: EtatLiens = { curseur: 0, morts: {}, verifiees: 0, at: "" };

/** Codes qui prouvent l'absence de la page. Tout le reste est indéterminé. */
export const CODES_MORTS = [404, 410];

export type Verdict = "morte" | "vivante" | "indetermine";

export function verdictDe(code: number): Verdict {
  if (CODES_MORTS.includes(code)) return "morte";
  if (code >= 200 && code < 400) return "vivante";
  return "indetermine";
}

/** Nombre d'échecs consécutifs requis avant d'annoncer une page morte. */
export const ECHECS_AVANT_ALERTE = 2;

/**
 * Tranche d'URL à contrôler à ce passage, en repartant du curseur et en bouclant.
 * Renvoie aussi le curseur suivant : le balayage reprend exactement où il s'arrête.
 */
export function trancheAVerifier(urls: string[], curseur: number, taille: number): { tranche: string[]; suivant: number } {
  const n = urls.length;
  if (!n || taille <= 0) return { tranche: [], suivant: 0 };
  // ⚠️ UN CURSEUR NaN EMPOISONNE L'ÉTAT DÉFINITIVEMENT. `Math.trunc(NaN) % n` vaut NaN :
  //    le curseur suivant serait NaN, réécrit tel quel en base, et TOUS les passages
  //    suivants repartiraient de NaN — le contrôle s'arrêterait sans rien signaler et
  //    sans lever la moindre erreur. Trouvé par crash-test. Une valeur illisible ramène
  //    au début plutôt que de se propager.
  const brut = Number(curseur);
  const sain = Number.isFinite(brut) ? Math.trunc(brut) : 0;
  const depart = ((sain % n) + n) % n;
  const combien = Math.min(taille, n);
  const tranche: string[] = [];
  for (let i = 0; i < combien; i++) tranche.push(urls[(depart + i) % n]);
  return { tranche, suivant: (depart + combien) % n };
}

/**
 * Applique les résultats d'un passage à l'état.
 *
 * Une page vivante EFFACE son historique d'échecs : une course remise en ligne doit
 * cesser d'être signalée immédiatement, sans attendre un second passage.
 */
export function appliquerResultats(
  etat: EtatLiens,
  resultats: { url: string; code: number }[],
  maintenant = new Date().toISOString(),
): EtatLiens {
  const morts = { ...etat.morts };
  let verifiees = etat.verifiees;
  for (const { url, code } of resultats) {
    if (!url) continue;
    verifiees++;
    const v = verdictDe(code);
    if (v === "vivante") { delete morts[url]; continue; }
    if (v === "indetermine") continue;               // bloqué, délai dépassé : on ne conclut pas
    const echecs = (morts[url]?.echecs ?? 0) + 1;
    morts[url] = { code, echecs, at: maintenant };
  }
  return { ...etat, morts, verifiees, at: maintenant };
}

/** Une URL doit-elle être signalée à l'athlète ? */
export function estSignalee(etat: EtatLiens, url: unknown): boolean {
  const e = etat.morts[String(url ?? "")];
  return !!e && e.echecs >= ECHECS_AVANT_ALERTE;
}

/** Les seules URL à faire descendre jusqu'au navigateur : celles réellement signalées. */
export function urlsSignalees(etat: EtatLiens): string[] {
  return Object.entries(etat.morts)
    .filter(([, e]) => e.echecs >= ECHECS_AVANT_ALERTE)
    .map(([u]) => u);
}
