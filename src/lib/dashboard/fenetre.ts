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
