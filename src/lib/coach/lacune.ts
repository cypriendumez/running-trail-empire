// ─────────────────────────────────────────────────────────────────────────────
//  LE COACH DOIT SAVOIR QU'IL NE SAIT PAS
//
//  Constaté sur un compte réel : 24 jours (03/07 → 27/07/2026) sans AUCUNE trace —
//  ni séance, ni nuit, ni mesure de VFC. Le plan traitait ce trou comme « zéro
//  entraînement » : il tirait la médiane hebdomadaire vers le bas et laissait croire
//  à une reprise après coupure.
//
//  Or trois causes produisent exactement le même vide : une vraie coupure, une
//  blessure, ou une montre non portée. Elles appellent des plans OPPOSÉS — reprendre
//  prudemment, ou continuer sur sa lancée. Rien dans les données ne permet de
//  trancher, donc on ne tranche pas : on le DIT, et le coach pose la question.
//
//  Ce module ne décide rien. Il rend un fait mesurable : « voici combien de jours
//  consécutifs sans la moindre donnée, et lesquels ».
// ─────────────────────────────────────────────────────────────────────────────

/** En dessous, un vide n'est qu'une semaine calme : inutile d'en parler. */
export const LACUNE_MIN_JOURS = 10;

export type Lacune = { debut: string; fin: string; jours: number };

const jour = (d: string) => Date.parse(d.slice(0, 10) + "T12:00:00Z");
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Plus longue période SANS AUCUNE donnée, entre `debut` et `fin` (dates civiles).
 *
 * `datesConnues` doit réunir TOUTES les sources couvrant la fenêtre (séances, nuits,
 * VFC…). Une source qui ne couvre pas toute la fenêtre créerait un faux trou : c'est
 * l'appelant qui garantit la couverture, pas cette fonction.
 *
 * Le vide de FIN (dernière donnée → aujourd'hui) est exclu : ce n'est pas le même
 * fait, c'est une synchronisation en retard, et il se raconte autrement.
 */
export function plusLongueLacune(datesConnues: readonly string[], debut: string, fin: string): Lacune | null {
  const bornes = [jour(debut), jour(fin)];
  if (!bornes.every(Number.isFinite) || bornes[0] >= bornes[1]) return null;
  const points = [...new Set(datesConnues.map((d) => jour(String(d ?? ""))).filter(Number.isFinite))]
    .filter((t) => t >= bornes[0] && t <= bornes[1])
    .sort((a, b) => a - b);
  // Aucune donnée du tout : ce n'est pas « un trou », c'est un compte vide.
  if (points.length < 2) return null;
  let pire: Lacune | null = null;
  for (let i = 1; i < points.length; i++) {
    const ecart = Math.round((points[i] - points[i - 1]) / 86400000) - 1; // jours VIDES entre les deux
    if (ecart < LACUNE_MIN_JOURS) continue;
    if (pire && pire.jours >= ecart) continue;
    pire = { debut: iso(points[i - 1] + 86400000), fin: iso(points[i] - 86400000), jours: ecart };
  }
  return pire;
}
