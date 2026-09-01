/**
 * LE JOUR COURANT EN FRANCE — la seule référence juste pour un catalogue français.
 *
 * ⚠️ NI UTC, NI L'HEURE DU SERVEUR. Les trois routes du catalogue calculaient
 * « aujourd'hui » avec `toISOString()`, c'est-à-dire en UTC. Constaté le 02/09/2026 à
 * 00 h 49 heure de Paris : il était encore 22 h 49 le 1er septembre en UTC, et le
 * catalogue proposait donc des courses du 1er septembre… déjà courues.
 *
 * `jourLocal()` ne conviendrait pas non plus : ce code s'exécute sur un serveur Vercel
 * situé à Washington (iad1), où il était 18 h 49 le 1er. On y perdrait six heures de
 * plus. Les courses ont lieu EN FRANCE : c'est le calendrier français qui fait foi,
 * quel que soit l'endroit d'où la page est rendue.
 */
const FUSEAU = "Europe/Paris";

export function jourFrance(d: Date = new Date()): string {
  // `en-CA` produit directement « AAAA-MM-JJ », ce qui évite de recoller des morceaux à la main.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}
