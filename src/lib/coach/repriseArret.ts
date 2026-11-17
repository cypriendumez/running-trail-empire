// ─────────────────────────────────────────────────────────────────────────────
//  REPRISE APRÈS UN ARRÊT — la règle de Jack Daniels.
//
//  ⚠️ CONSTAT (Cyprien, 05/11/2026, J+11 du marathon de Lille) : aucune course enregistrée
//  depuis le marathon. Le plafond « jamais plus de 1,4 fois la semaine écoulée » tombait
//  alors sur son plancher de 15 km : 14 km visés pour la semaine d'un coureur à 70 km, une
//  « sortie longue » de 4 km, sous un bandeau qui annonçait « 70 % de ton volume habituel ».
//  Onze jours sans courir ne coûtent pourtant presque rien : Daniels retire 1,5 % au VDOT
//  après 10 jours d'arrêt, 2,7 % après 14 (table VDOT O2).
//
//  LA RÈGLE (Daniels' Running Formula) : de 6 à 28 jours sans courir, la reprise dure
//  autant que l'arrêt — la première moitié à 50 % du volume habituel, la seconde à 75 %.
//  En deçà de 6 jours, rien n'est perdu : on reprend où l'on en était. Au-delà de 28, la
//  règle change d'échelle ; ce module ne s'en mêle pas et le plafond ordinaire s'applique.
//
//  ⚠️ LE SILENCE N'EST PAS FORCÉMENT UN ARRÊT : une montre qui ne synchronise plus produit
//  le même vide. Ce module ne tranche pas ; c'est le texte affiché qui le dit à l'athlète.
// ─────────────────────────────────────────────────────────────────────────────
import { ecartJours } from "@/lib/coach/recuperation";

/** En deçà, rien n'est perdu (Daniels : VDOT intact jusqu'à 5 jours d'arrêt). */
export const ARRET_MIN_JOURS = 6;
/** Au-delà, la reprise suit une autre échelle, que ce module n'applique pas. */
export const ARRET_MAX_JOURS = 28;
/** Part du volume habituel pendant la première, puis la seconde moitié de la reprise. */
export const PARTS_REPRISE = [0.5, 0.75] as const;
/** Au-delà de ce nombre de jours d'arrêt, la qualité attend la SECONDE moitié de la reprise. */
export const ARRET_LONG_JOURS = 14;

export type RepriseArret = {
  /** Jours sans courir. */
  arretJours: number;
  /** `true` tant qu'aucune sortie n'a suivi l'arrêt : l'athlète n'a pas encore repris. */
  enCours: boolean;
  /** Jours écoulés depuis la première sortie qui a suivi l'arrêt (0 tant qu'il n'a pas repris). */
  joursRepris: number;
  /** Part du volume habituel à viser cette semaine. */
  part: number;
};

/**
 * Part du volume habituel visée la semaine qui commence dans `dansJours` jours : 50 % puis
 * 75 % tant que dure la reprise (aussi longue que l'arrêt), 1 ensuite ou sans reprise.
 * Tant que l'athlète n'a pas repris, on suppose qu'il reprend aujourd'hui.
 */
export function partApresArret(r: Pick<RepriseArret, "arretJours" | "joursRepris"> | null, dansJours = 0): number {
  if (!r) return 1;
  const jour = r.joursRepris + dansJours;
  return jour >= r.arretJours ? 1 : jour < r.arretJours / 2 ? PARTS_REPRISE[0] : PARTS_REPRISE[1];
}

/**
 * La reprise en cours, ou `null` (pas d'arrêt de 6 à 28 jours, ou reprise terminée).
 *
 * `joursCourus` : les dates (AAAA-MM-JJ) des sorties de COURSE, dans n'importe quel ordre.
 * ⚠️ `aujourdhui` EST FOURNI, jamais lu de l'horloge (voir `lib/time`).
 */
export function repriseApresArret(joursCourus: readonly string[], aujourdhui: string): RepriseArret | null {
  const jours = [...new Set(joursCourus.map((d) => String(d).slice(0, 10)))]
    .filter((d) => d.length === 10 && d <= aujourdhui)
    .sort();
  if (!jours.length) return null;
  // Toujours à l'arrêt : les jours écoulés depuis la dernière sortie, aujourd'hui compris.
  const depuis = ecartJours(aujourdhui, jours[jours.length - 1]);
  if (depuis == null) return null;
  if (depuis >= ARRET_MIN_JOURS) {
    return depuis <= ARRET_MAX_JOURS ? { arretJours: depuis, enCours: true, joursRepris: 0, part: PARTS_REPRISE[0] } : null;
  }
  // Déjà repris : le DERNIER arrêt d'au moins 6 jours, et où en est la reprise qui l'a suivi.
  for (let i = jours.length - 1; i > 0; i--) {
    const ecart = ecartJours(jours[i], jours[i - 1]);
    if (ecart == null) continue;
    const arret = ecart - 1;
    if (arret < ARRET_MIN_JOURS) continue;
    if (arret > ARRET_MAX_JOURS) return null;
    const joursRepris = ecartJours(aujourdhui, jours[i]) ?? Infinity;
    if (joursRepris >= arret) return null;
    return { arretJours: arret, enCours: false, joursRepris, part: partApresArret({ arretJours: arret, joursRepris }) };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  L'INTENSITÉ PENDANT LA REPRISE.
//
//  ⚠️ CONSTAT (`@Sparring`, 16/11/2026, profil « emploi du temps chaotique », rejoué par
//  `@HeadCoach`) : la reprise ne bornait que le VOLUME. Après 6 à 25 jours sans courir, le
//  plan posait une séance au SEUIL le jour même de la reprise sur 8 départs sur 10, et une
//  « sortie longue » de 4 km pour une coureuse qui court 9 km par sortie.
//
//  LA RÈGLE (avis du directeur scientifique, 16/11/2026) :
//   · aucune qualité tant qu'aucune sortie n'a suivi l'arrêt : on reprend par du facile.
//     Le plan étant reconstruit après chaque séance, la qualité revient d'elle-même ;
//   · le jour de la première sortie de reprise, pas de qualité non plus ;
//   · après un arrêt de plus de 14 jours, la qualité attend la seconde moitié de la reprise ;
//   · jusqu'à la fin de la reprise, UNE séance de qualité PAR SEMAINE au plus, écrite courte
//     et au seuil (le volume est à 50 puis 75 %) : la même borne que la reprise d'après-course.
//     ⚠️ « Par semaine », pas « pour toute la reprise » (double relecture du 17/11/2026) : la
//     borne est un budget, que le plan applique à n'importe quels sept jours consécutifs
//     (`lib/coach/qualiteRecente`). Une reprise de trois semaines porte donc jusqu'à trois
//     séances, jamais deux dans la même semaine.
// ─────────────────────────────────────────────────────────────────────────────

export type QualiteReprise = {
  /** Nombre maximal de séances de qualité sur sept jours consécutifs (un budget de semaine). */
  max: 0 | 1;
  /** Premier jour du plan (0 = aujourd'hui) où une qualité peut être posée ; 7 = aucun. */
  des: number;
};

/** La qualité permise pendant une reprise, ou `null` hors reprise (aucune borne). */
export function qualitePendantReprise(r: RepriseArret | null): QualiteReprise | null {
  if (!r) return null;
  // Pas encore repris : aucune qualité, quel que soit le jour.
  if (r.enCours) return { max: 0, des: 7 };
  const des = r.arretJours > ARRET_LONG_JOURS
    ? Math.max(0, Math.ceil(r.arretJours / 2) - r.joursRepris)
    : r.joursRepris === 0 ? 1 : 0;
  return des > 6 ? { max: 0, des: 7 } : { max: 1, des };
}

/**
 * LA SORTIE HABITUELLE : la médiane des distances des sorties récentes, ou `null` quand
 * aucune distance n'est connue (on ne l'invente pas).
 */
export function sortieHabituelleKm(distances: readonly (number | null | undefined)[]): number | null {
  const v = distances.filter((d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Pendant une reprise, une « sortie longue » que le plafond de volume ramène SOUS la
 * sortie habituelle n'est pas une sortie longue : c'est un footing, et le plan ne la nomme
 * pas autrement. Sans sortie habituelle connue, on ne tranche pas (elle reste).
 */
export function sortieLongueTient(longueKm: number, habituelleKm: number | null): boolean {
  return habituelleKm == null || longueKm >= habituelleKm;
}
