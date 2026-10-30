import { jourLocal, ecartJours } from "@/lib/streak/compute";

/**
 * FENÊTRES DU TABLEAU DE BORD — une seule définition du mot « jour ».
 *
 * ⚠️ TROIS DÉFINITIONS COEXISTAIENT SUR LE MÊME ÉCRAN :
 *   · une fenêtre GLISSANTE de 168 h (`now - 7 * 86400000`) pour le volume, les zones
 *     et le score de forme ;
 *   · le jour UTC (`toISOString().slice(0, 10)`) pour la charge CTL/ATL ;
 *   · le jour calendaire LOCAL (`jourLocal`) pour la série, seule à l'avoir fait juste.
 *
 * Conséquence mesurée sur ce compte : « Volume semaine » affichait 47,7 km à 00 h 30
 * et 37,5 km quelques heures plus tard, sans qu'aucune séance n'ait bougé — la fenêtre
 * de 168 heures ancrée sur l'heure exacte fait entrer et sortir une séance vieille de
 * sept jours selon le moment de la consultation. Même effet sur la Fatigue (ATL, de
 * constante 7 jours) : 57 avant minuit UTC, 49 après, soit un verdict de charge qui
 * bascule pendant qu'on regarde l'écran.
 *
 * Un athlète ne compte pas ses jours en tranches de 168 heures. « Les 7 derniers
 * jours » veut dire sept CASES DE CALENDRIER, dans SON fuseau — exactement ce que la
 * série calculait déjà bien. Tout le tableau de bord passe donc par ici.
 */

/**
 * Âge d'une séance en jours calendaires locaux. 0 = aujourd'hui, 1 = hier.
 * Renvoie `null` si la date est illisible : une date cassée ne doit pas se retrouver
 * silencieusement rangée dans « aujourd'hui ».
 */
export function ageJours(date: string | null | undefined, aujourdhui = jourLocal()): number | null {
  const jour = String(date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return null;
  const n = ecartJours(jour, aujourdhui);
  return Number.isFinite(n) ? n : null;
}

/**
 * La séance tombe-t-elle dans les `n` derniers jours calendaires, aujourd'hui compris ?
 * Une séance datée dans le futur est EXCLUE : elle n'a pas encore été courue.
 */
export function dansFenetre(date: string | null | undefined, n: number, aujourdhui = jourLocal()): boolean {
  const age = ageJours(date, aujourdhui);
  return age != null && age >= 0 && age < n;
}

/**
 * COMPTE À REBOURS ET PRÉPARATION D'UN OBJECTIF, EN JOURS CIVILS.
 *
 * ⚠️ DEUX DÉFAUTS, UN SEUL CALCUL (Cyprien, 30/10/2026).
 *  · « J-50 » se calculait sur l'heure exacte (`Date.now()`) et sur une date lue dans le
 *    fuseau de la machine : entre minuit et 1 h à Paris, le serveur (UTC) rendait « J-51 »
 *    et le téléphone « J-50 », sur trois cartes — erreur React #418.
 *  · « 56 % PRÉPARATION » ne mesurait rien : sans plan daté, l'anneau supposait une
 *    préparation de 16 semaines. Le sub 16 du 19/12, fixé le jour même, affichait 56 % —
 *    une préparation commencée le 29 août qui n'a jamais existé.
 *
 * La préparation part du jour où l'objectif a été fixé (`depuis`, sinon la date
 * d'enregistrement `ts`), ou d'un plan démarré plus tard. Sans aucune date, pas de
 * pourcentage : on ne l'invente pas.
 */
export function avancementObjectif(
  objectif: { raceDate: string; depuis?: string | null; ts?: string | null } | null | undefined,
  aujourdhui: string,
  debutPlan?: string | null,
): { joursRestants: number; pct: number | null } | null {
  const course = String(objectif?.raceDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(course)) return null;
  const restants = ecartJours(aujourdhui, course);
  if (restants < 0) return null;
  const debut = [objectif?.depuis ?? objectif?.ts, debutPlan]
    .map((d) => String(d ?? "").slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop();
  const total = debut ? ecartJours(debut, course) : 0;
  if (!debut || total <= 0) return { joursRestants: restants, pct: null };
  const ecoule = Math.min(total, Math.max(0, ecartJours(debut, aujourdhui)));
  return { joursRestants: restants, pct: Math.round((100 * ecoule) / total) };
}
