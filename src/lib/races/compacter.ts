/**
 * UNE LIGNE ALLÉGÉE POUR LA LISTE (29/09/2026, fluidité). 15 500 courses × 15 champs, dont
 * beaucoup presque toujours vides (`itra_points: null`, `is_itra_certified: false`,
 * `date_confirmee: null`) : ~1,2 Mo de JSON sur 5,9 que le téléphone devait décoder à
 * chaque ouverture de l'onglet. Un champ vide est OMIS (le client lit `undefined` comme
 * `null` : aucune comparaison stricte à `null` côté liste) ; coordonnées au mètre près.
 * ⚠️ `date_confirmee: false` est GARDÉ : il signifie « date estimée » (le « ≈ »).
 */
export function compacterCourse(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (v === null || v === undefined || v === "") continue;
    if (v === false && k !== "date_confirmee") continue;
    out[k] = (k === "latitude" || k === "longitude") && typeof v === "number" ? Math.round(v * 1e5) / 1e5 : v;
  }
  return out;
}

