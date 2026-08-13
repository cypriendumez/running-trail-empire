// ─────────────────────────────────────────────────────────────────────────────
//  Mémoire des quotas journaliers épuisés — logique pure, sans réseau ni état.
//
//  POURQUOI. Quand le plafond JOURNALIER d'un modèle est atteint, chaque appel
//  suivant repart quand même vers Google pour se faire refuser. Le coût n'est pas
//  le quota (une requête rejetée ne consomme rien — il n'y a plus rien à consommer)
//  mais l'ATTENTE : l'athlète patiente le temps d'un aller-retour réseau par modèle,
//  à chaque ouverture du tableau de bord, pour un échec connu d'avance.
//
//  ⚠️ LA SUBTILITÉ QUI FAIT TOUT : le quota Google se réinitialise à MINUIT HEURE
//  DU PACIFIQUE, pas à minuit UTC (« Requests per day (RPD) quotas reset at midnight
//  Pacific time », doc officielle). Mémoriser l'épuisement « pour la journée » avec
//  la clé UTC utilisée ailleurs dans l'app serait faux DEUX FOIS : on rouvrirait le
//  robinet à 00 h 00 UTC alors qu'il reste 7 à 8 heures de disette, et on garderait
//  le marqueur après la vraie réinitialisation. On raisonne donc en instants absolus.
// ─────────────────────────────────────────────────────────────────────────────

const PACIFIC = "America/Los_Angeles";

/**
 * Intervalle entre deux sondes quand un modèle est réputé épuisé.
 *
 * On ne se fie JAMAIS aveuglément au marqueur : si la détection s'est trompée (message
 * d'erreur inhabituel pris pour un plafond journalier), un blocage ferme jusqu'à la
 * prochaine réinitialisation couperait l'IA pendant des heures. Une sonde périodique
 * borne les dégâts d'un faux positif à ce quart d'heure, tout en supprimant l'essentiel
 * des allers-retours inutiles.
 */
export const PROBE_INTERVAL_MS = 15 * 60_000;

/** `until` = instant de la réinitialisation ; `probedAt` = dernière sonde sur CE modèle. */
export type QuotaMark = { until: number; probedAt: number };

/**
 * Mémoire complète : les marqueurs par modèle, et la cadence de sonde de la CHAÎNE.
 *
 * La cadence est volontairement au niveau de la chaîne et non du modèle. Avec un droit
 * de sonde par modèle, deux modèles marqués produisaient deux sondes coup sur coup —
 * autant de requêtes inutiles qu'il y a de modèles, exactement ce qu'on voulait éviter.
 * Une seule sonde par quart d'heure, qui alterne entre les modèles (le moins récemment
 * sondé passe le premier), suffit à détecter un retour de quota.
 */
export type QuotaMemory = { marks: Map<string, QuotaMark>; nextProbeAt: number };

export const emptyQuotaMemory = (): QuotaMemory => ({ marks: new Map(), nextProbeAt: 0 });

/** Décalage du fuseau (ms) à un instant donné — gère PST/PDT sans dépendance. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const p: Record<string, number> = {};
  for (const { type, value } of parts) if (type !== "literal") p[type] = Number(value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - at.getTime();
}

/**
 * Instant (UTC) de la prochaine réinitialisation des quotas, c'est-à-dire du prochain
 * minuit à Los Angeles. Deux passes : le décalage peut CHANGER entre maintenant et la
 * cible les jours de bascule heure d'été/hiver — on recalcule donc avec le décalage
 * réellement en vigueur à l'instant visé.
 */
export function nextQuotaResetUtc(now: Date = new Date()): Date {
  const offset = tzOffsetMs(now, PACIFIC);
  const local = new Date(now.getTime() + offset);
  const nextLocalMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1);
  let utc = nextLocalMidnight - offset;
  const corrected = tzOffsetMs(new Date(utc), PACIFIC);
  if (corrected !== offset) utc = nextLocalMidnight - corrected;
  return new Date(utc);
}

/** Marque un modèle épuisé jusqu'à la prochaine réinitialisation Pacifique. */
export function markExhausted(now: Date = new Date()): QuotaMark {
  return { until: nextQuotaResetUtc(now).getTime(), probedAt: now.getTime() };
}

/** Le marqueur est-il périmé (quota réinitialisé entre-temps) ? */
export const isExpired = (mark: QuotaMark, now: number): boolean => now >= mark.until;

/**
 * Choisit les modèles à essayer.
 *
 * Écarter un modèle à sec n'est pas un détail : quand `gemini-2.5-flash` est épuisé
 * mais que `flash-lite` a encore du quota, l'appeler quand même coûte un aller-retour
 * perdu AVANT CHAQUE réponse, pour toute la fin de la journée. On l'écarte donc, sans
 * jamais réduire la chaîne de façon permanente — les marqueurs expirent d'eux-mêmes.
 */
export function selectModels(
  models: string[], mem: QuotaMemory, now: number,
): { models: string[]; probing: boolean } {
  const free = models.filter((m) => {
    const mark = mem.marks.get(m);
    return !mark || isExpired(mark, now);
  });
  if (free.length) return { models: free, probing: false };

  // Tous réputés épuisés. UNE sonde par quart d'heure pour toute la chaîne : sans elle,
  // une détection erronée nous rendrait aveugles jusqu'au lendemain ; avec une par
  // modèle, on multiplierait les requêtes qu'on prétend supprimer.
  if (now < mem.nextProbeAt) return { models: [], probing: false };
  const candidate = models
    .filter((m) => mem.marks.has(m))
    .sort((a, b) => mem.marks.get(a)!.probedAt - mem.marks.get(b)!.probedAt)[0];
  return candidate ? { models: [candidate], probing: true } : { models: [], probing: false };
}

/**
 * Un 429 recouvre deux situations opposées : le plafond PAR MINUTE, qui se dissipe en
 * quelques secondes, et le plafond PAR JOUR, qui tient jusqu'à minuit au Pacifique.
 * Ne mémoriser que le second — bloquer sur un plafond par minute couperait l'IA pour
 * la journée à cause d'une bourrasque de trafic de quelques secondes.
 */
export function isDailyQuotaError(status: number, message: string): boolean {
  return status === 429 && /PerDay|per day|daily/i.test(message);
}
