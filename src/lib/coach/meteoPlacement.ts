// ─────────────────────────────────────────────────────────────────────────────
//  CHOISIR LE JOUR DE LA SÉANCE DE QUALITÉ — LA MÉTÉO A LE DROIT DE VOTER
//
//  Le plan prenait le PREMIER jour disponible, puis ralentissait l'allure cible si ce
//  jour-là il faisait 27 °C ou qu'il ventait à 45 km/h. C'est traiter le symptôme :
//  un entraîneur ne fait pas courir 12×400 m dans une tempête en disant « vas-y moins
//  vite », il décale la séance de 24 h. Le stimulus recherché (l'allure) est justement
//  celui que le vent détruit.
//
//  Constaté sur une vraie semaine (Normandie, 05/09/2026) : 25 s/km de pénalité le
//  dimanche contre 0 le mardi. Le premier jour libre pouvait donc coûter une séance.
//
//  Trois garde-fous, parce que déplacer coûte aussi quelque chose :
//   1. JAMAIS au-delà de {@link HORIZON_METEO} jours — repousser indéfiniment une séance
//      pour attendre le beau temps, c'est ne plus s'entraîner.
//   2. Seulement pour un gain d'au moins {@link GAIN_METEO_MIN} s/km, soit un barreau
//      entier de l'échelle de vent. Sous ce seuil, on casse le rythme pour rien.
//   3. Jamais si cela prive les séances SUIVANTES de leurs derniers jours possibles.
// ─────────────────────────────────────────────────────────────────────────────

/** Au-delà, on ne repousse plus : la régularité prime sur le confort. */
export const HORIZON_METEO = 2;
/** Un barreau entier de l'échelle de vent (10 / 18 / 25 s/km). */
export const GAIN_METEO_MIN = 10;

/**
 * Parmi les jours ÉLIGIBLES (déjà filtrés par disponibilité, espacement et récupération),
 * rend celui où la séance sera la plus fidèle à son intention. Rend -1 si aucun.
 *
 * @param eligibles          indices de jours, en ordre croissant
 * @param penalite           surcoût météo du jour, en s/km (chaleur + vent)
 * @param seancesRestantes   nombre de séances de qualité encore à placer APRÈS celle-ci
 */
export function choisirJourQualite(
  eligibles: readonly number[],
  penalite: (jour: number) => number,
  seancesRestantes = 0,
): number {
  if (!eligibles.length) return -1;
  const premier = eligibles[0];
  const cout = (i: number) => { const p = penalite(i); return Number.isFinite(p) ? p : 0; };
  let choisi = premier, meilleur = cout(premier);
  for (let k = 1; k < eligibles.length; k++) {
    const i = eligibles[k];
    if (i - premier > HORIZON_METEO) break;              // garde-fou 1
    if (eligibles.length - 1 - k < seancesRestantes) break; // garde-fou 3
    const p = cout(i);
    if (p < meilleur) { meilleur = p; choisi = i; }        // égalité → le plus tôt gagne
  }
  return cout(premier) - meilleur >= GAIN_METEO_MIN ? choisi : premier; // garde-fou 2
}
