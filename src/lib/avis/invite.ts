/**
 * QUAND REPROPOSER DE DONNER SON AVIS — décision pure, donc éprouvable.
 *
 * Le comportement demandé est celui d'un bandeau de cookies, avec TROIS issues qui ne se
 * ressemblent pas :
 *   · l'athlète a ÉCRIT son avis  → on ne lui demande plus jamais (décidé côté serveur :
 *     un compte = un avis, donc la seule présence de sa ligne suffit) ;
 *   · il a répondu NON            → on ne lui demande plus jamais ;
 *   · il a répondu PLUS TARD      → on se retire, et on repropose un mois après.
 *
 * ⚠️ « PLUS TARD » N'EST PAS « NON », ET LES CONFONDRE EST LE DÉFAUT QU'ON CORRIGE ICI.
 * La première version n'avait qu'un bouton « Plus tard » qui masquait POUR TOUJOURS : un
 * athlète qui voulait juste finir sa séance perdait définitivement l'accès à la seule
 * porte d'entrée vers les avis. Deux réponses distinctes, donc deux effets distincts.
 *
 * ⚠️ Cette décision est mémorisée PAR NAVIGATEUR (localStorage), comme un consentement
 * aux cookies : elle ne suit pas l'athlète d'un appareil à l'autre. C'est assumé — la
 * seule information qui mérite la base, « a-t-il écrit un avis ? », y est déjà.
 */

/** Trente jours. Un mois calendaire n'apporterait rien et compliquerait le test. */
export const REPORT_MS = 30 * 24 * 60 * 60 * 1000;

export type EtatInvite = {
  /** L'athlète a refusé : on ne repropose jamais. */
  refuse?: boolean;
  /** Horodatage avant lequel on ne repropose pas. */
  reporteJusqu?: number;
};

/** L'invitation doit-elle s'afficher, au vu de ce que l'athlète a déjà répondu ? */
export function doitAfficher(etat: EtatInvite, maintenant: number = Date.now()): boolean {
  if (etat.refuse) return false;
  if (typeof etat.reporteJusqu === "number" && maintenant < etat.reporteJusqu) return false;
  return true;
}

/** L'état à mémoriser quand l'athlète demande à être recontacté plus tard. */
export const reporter = (maintenant: number = Date.now()): EtatInvite => ({ reporteJusqu: maintenant + REPORT_MS });

/** L'état à mémoriser quand il refuse. */
export const refuser = (): EtatInvite => ({ refuse: true });

/**
 * Relit l'état stocké. `{}` si rien, si c'est illisible, ou si le stockage est refusé —
 * en navigation privée `localStorage` LÈVE, et une invitation ne doit jamais casser le
 * tableau de bord qui l'accueille.
 */
export const CLE_INVITE = "pacevo.avis.invite";

export function lireEtat(brut: string | null): EtatInvite {
  if (!brut) return {};
  try {
    const o = JSON.parse(brut) as unknown;
    if (!o || typeof o !== "object") return {};
    const e = o as EtatInvite;
    return {
      ...(e.refuse === true ? { refuse: true } : {}),
      ...(typeof e.reporteJusqu === "number" && Number.isFinite(e.reporteJusqu) ? { reporteJusqu: e.reporteJusqu } : {}),
    };
  } catch { return {}; }
}
