/**
 * LES REPÈRES DE TEMPS D'UNE INVITE — calculés ici, jamais par le modèle (02/10/2026).
 *
 * ⚠️ DÉFAUT CONSTATÉ PAR CYPRIEN : à J-23 du Marathon de Lille (25/10/2026), le coach des
 * Cours a répondu « nous sommes en octobre 2026, et ton marathon est dans un an ». L'invite
 * lui donnait « le 2026-10-25 » mais JAMAIS la date du jour : il devinait l'année, puis
 * comptait de travers. Un modèle de langue ne compte pas les jours de façon fiable.
 *
 * Donc : la date du jour en toutes lettres, et l'écart DÉJÀ CALCULÉ (« dans 23 jours »),
 * avec la consigne de le reprendre tel quel. Fonctions pures, dates civiles « AAAA-MM-JJ ».
 */

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** « vendredi 2 octobre 2026 » — midi UTC : aucun fuseau ne fait glisser le jour. */
export function dateLongue(jour: string): string {
  if (!JOUR.test(jour)) return jour;
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${jour}T12:00:00Z`));
}

/** Jours civils de `de` à `a` (négatif si `a` est passé). */
export function joursEntre(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5);
}

/** « dans 23 jours (environ 3 semaines) », « demain », « aujourd'hui », « il y a 4 jours ». */
export function echeance(jour: string, aujourdhui: string): string {
  if (!JOUR.test(jour) || !JOUR.test(aujourdhui)) return "";
  const n = joursEntre(aujourdhui, jour);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  if (n < 0) return `il y a ${-n} jours`;
  if (n < 14) return `dans ${n} jours`;
  if (n < 60) return `dans ${n} jours (environ ${Math.round(n / 7)} semaines)`;
  return `dans ${n} jours (environ ${Math.round(n / 30.4)} mois)`;
}

/** Une course nommée, datée et située dans le temps — prête pour l'invite. */
export function courseDatee(nom: string, jour: string, aujourdhui: string): string {
  if (!JOUR.test(jour)) return nom;
  return `${nom} — ${dateLongue(jour)}, ${echeance(jour, aujourdhui)}`;
}

/** Le bloc d'en-tête : la date du jour, et la règle de ne jamais recompter. */
export function enteteTemps(aujourdhui: string): string {
  return `AUJOURD'HUI : ${dateLongue(aujourdhui)}. Les écarts de temps indiqués ci-dessous (« dans N jours ») sont CALCULÉS : reprends-les tels quels, ne recompte jamais une date toi-même.`;
}
