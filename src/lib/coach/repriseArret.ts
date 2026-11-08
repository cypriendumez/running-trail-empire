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
