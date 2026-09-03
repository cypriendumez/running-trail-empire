import { jourCivil } from "@/lib/time/fuseau";

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

/**
 * ⚠️ DÉLÈGUE À `jourCivil` — ce module ne recalcule plus rien. Il gardait sa propre
 * copie du calcul « quel jour est-il dans ce fuseau », identique à celle de
 * `lib/time/fuseau`. Deux copies, c'est une seule des deux corrigée le jour où l'une se
 * trompe. Ce qui reste ici, et qui n'appartient qu'à ce module, c'est le CHOIX du
 * fuseau : les courses ont lieu en France, quel que soit l'endroit d'où la page est
 * rendue et où que soit l'athlète qui les consulte.
 */
export function jourFrance(d: Date = new Date()): string {
  return jourCivil(d, FUSEAU);
}
