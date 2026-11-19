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
  /**
   * Jours SANS COURIR — la même grandeur dans les deux états (17/11/2026). Tant que l'athlète
   * n'a pas repris, c'est l'arrêt qu'il aura fait s'il reprend aujourd'hui : les jours écoulés
   * depuis sa dernière sortie, moins aujourd'hui.
   */
  arretJours: number;
  /** Tant qu'il n'a pas repris : jours écoulés depuis la dernière sortie, aujourd'hui COMPRIS
   *  (`arretJours + 1`). C'est le nombre que dit le motif (« aucune course depuis N jours »). */
  depuisJours?: number;
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
  const a = dernierArret(joursCourus, aujourdhui);
  if (!a || a.arretJours > ARRET_MAX_JOURS) return null;
  if (a.enCours) return { arretJours: a.arretJours, enCours: true, joursRepris: 0, part: PARTS_REPRISE[0], depuisJours: a.depuisJours };
  if (a.joursRepris >= a.arretJours) return null;
  return { arretJours: a.arretJours, enCours: false, joursRepris: a.joursRepris, part: partApresArret(a) };
}

/** Ce qu'il faut savoir d'un arrêt pour borner l'INTENSITÉ (le volume, lui, lit `RepriseArret`). */
export type ArretVu = Pick<RepriseArret, "arretJours" | "enCours" | "joursRepris" | "depuisJours">;

/** Durée de la reprise appliquée à l'intensité après un arrêt de plus de 28 jours. */
export const REPRISE_HORS_ECHELLE_JOURS = ARRET_MAX_JOURS;

/**
 * L'ARRÊT DE PLUS DE 28 JOURS, pour l'intensité seulement — `null` de 6 à 28 jours (c'est
 * `repriseApresArret`) et une fois ses quatre semaines de reprise écoulées.
 *
 * ⚠️ UNE GARDE NE BAISSE PAS QUAND LE RISQUE MONTE (visa du directeur scientifique, 17/11/2026).
 * Au-delà de 28 jours, la règle de Daniels change d'échelle pour le VOLUME, et ce module rendait
 * `null` : la règle d'intensité s'arrêtait donc là où elle compte le plus. Rejoué : après 34
 * jours sans courir, un seuil de 4×10 min le jour même du retour, et une sortie longue de 22 km
 * dans une semaine visée à 20 km — alors qu'à 27 jours, rien de dur avant la seconde moitié.
 * Le volume au-delà de 28 jours garde son plafond ordinaire ; l'intensité, elle, reçoit AU MOINS
 * la règle de l'arrêt le plus long de l'échelle (voir `qualitePendantReprise`).
 */
export function arretHorsEchelle(joursCourus: readonly string[], aujourdhui: string): ArretVu | null {
  const a = dernierArret(joursCourus, aujourdhui);
  if (!a || a.arretJours <= ARRET_MAX_JOURS) return null;
  if (!a.enCours && a.joursRepris >= REPRISE_HORS_ECHELLE_JOURS) return null;
  return a;
}

/**
 * LES JOURS COURUS OÙ SE LIT L'ARRÊT : la RÉUNION de l'historique long et des séances récentes.
 *
 * ⚠️ NI L'UN NI L'AUTRE NE SUFFIT SEUL (réserve du directeur scientifique, 17/11/2026) :
 *  · les séances récentes sont plafonnées à 60, TOUS SPORTS CONFONDUS. Un coureur blessé qui
 *    pédale chaque jour en fait sortir toutes ses courses d'avant l'arrêt : plus d'arrêt visible,
 *    plus de garde. Rejoué : 40 jours sans courir et deux sorties à vélo par jour, un seuil posé
 *    le jour même au 4ᵉ jour de reprise, un seuil et une VMA au 8ᵉ ;
 *  · l'historique long s'arrête à 190 jours. Après une coupure plus longue, la dernière course
 *    d'avant l'arrêt n'y est plus, alors que les 60 dernières séances d'un coureur peu assidu
 *    la portent encore.
 * Les doublons ne gênent pas : la détection travaille sur des jours distincts.
 */
export function joursCourusPourArret(
  historique: readonly { date: string | null | undefined }[],
  recentes: readonly { date: string | null | undefined }[],
): string[] {
  return [...historique, ...recentes].map((w) => String(w.date ?? "").slice(0, 10));
}

/**
 * Le DERNIER arrêt d'au moins 6 jours, quelle que soit sa longueur, et où en est ce qui l'a suivi.
 * `arretJours` compte les jours SANS COURIR dans les deux états.
 */
function dernierArret(joursCourus: readonly string[], aujourdhui: string): ArretVu | null {
  const jours = [...new Set(joursCourus.map((d) => String(d).slice(0, 10)))]
    .filter((d) => d.length === 10 && d <= aujourdhui)
    .sort();
  if (!jours.length) return null;
  // Toujours à l'arrêt : les jours écoulés depuis la dernière sortie, aujourd'hui compris.
  const depuis = ecartJours(aujourdhui, jours[jours.length - 1]);
  if (depuis == null) return null;
  // ⚠️ L'ARRÊT, C'EST `depuis - 1` (cinquième relecture, 17/11/2026) : en reprenant aujourd'hui,
  // l'athlète sera resté `depuis - 1` jours sans courir, et c'est ce nombre-là que la branche
  // « déjà repris » lira demain (`ecart - 1`). Borner `depuis` lui-même décalait la règle d'un
  // jour aux deux bouts : au 6ᵉ jour, une reprise annoncée puis oubliée après la sortie (5 jours
  // d'arrêt) ; au 29ᵉ, aucune reprise, puis une reprise le lendemain (28 jours d'arrêt).
  if (depuis - 1 >= ARRET_MIN_JOURS) return { arretJours: depuis - 1, enCours: true, joursRepris: 0, depuisJours: depuis };
  // Déjà repris : le DERNIER arrêt d'au moins 6 jours, et le temps écoulé depuis la sortie qui l'a suivi.
  for (let i = jours.length - 1; i > 0; i--) {
    const ecart = ecartJours(jours[i], jours[i - 1]);
    if (ecart == null || ecart - 1 < ARRET_MIN_JOURS) continue;
    return { arretJours: ecart - 1, enCours: false, joursRepris: ecartJours(aujourdhui, jours[i]) ?? Infinity };
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
//   · le jour de la première sortie de reprise, pas de qualité non plus ; après dix jours
//     d'arrêt ou plus, pas avant 48 h ;
//   · après un arrêt de plus de 14 jours, la qualité attend la seconde moitié de la reprise ;
//   · après un arrêt de plus de 28 jours, où la règle de volume ne s'applique plus, l'intensité
//     garde AU MOINS cette protection : pas avant le 14ᵉ jour d'une reprise de quatre semaines ;
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

/**
 * L'arrêt est-il LONG (plus de 14 jours sans courir) ? Une seule règle, lue par le plan et par
 * le texte. `arretJours` compte les jours sans courir dans les deux états (voir `RepriseArret`) :
 * au 15ᵉ jour depuis la dernière sortie, l'arrêt est de 14 jours, donc encore court.
 */
export function arretLong(r: Pick<RepriseArret, "arretJours">): boolean {
  return r.arretJours > ARRET_LONG_JOURS;
}

/** La qualité permise pendant une reprise, ou `null` hors reprise (aucune borne). */
export function qualitePendantReprise(r: ArretVu | null): QualiteReprise | null {
  if (!r) return null;
  // Pas encore repris : aucune qualité, quel que soit le jour.
  if (r.enCours) return { max: 0, des: 7 };
  const des = Math.max(0, premierJourDeQualite(r.arretJours) - r.joursRepris);
  return des > 6 ? { max: 0, des: 7 } : { max: 1, des };
}

/** Arrêt à partir duquel la première séance dure attend 48 h après la première sortie facile. */
export const ARRET_48H_JOURS = 10;

/**
 * Le rang du premier jour de reprise (0 = jour de la première sortie) où une séance dure est
 * permise. ⚠️ JAMAIS DÉCROISSANT quand l'arrêt s'allonge (un test le vérifie de 6 à 60 jours) :
 *  · de 6 à 9 jours d'arrêt : le lendemain de la première sortie ;
 *  · de 10 à 14 jours : 48 h après (visa du directeur scientifique, 17/11/2026 : pas de seuil
 *    le lendemain d'une seule sortie facile après dix jours d'arrêt) ;
 *  · de 15 à 28 jours : le premier jour de la seconde moitié de la reprise ;
 *  · au-delà de 28 jours : comme l'arrêt le plus long de l'échelle, le 14ᵉ jour d'une reprise
 *    de quatre semaines.
 */
export function premierJourDeQualite(arretJours: number): number {
  if (arretJours > ARRET_MAX_JOURS) return Math.ceil(REPRISE_HORS_ECHELLE_JOURS / 2);
  if (arretLong({ arretJours })) return Math.ceil(arretJours / 2);
  return arretJours >= ARRET_48H_JOURS ? 2 : 1;
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

/** Fenêtre, en jours, sur laquelle se lit la sortie habituelle : les huit semaines d'avant l'arrêt. */
export const HABITUDE_JOURS = 56;

/**
 * Les distances des sorties d'AVANT l'arrêt, sur huit semaines. ⚠️ Pas les sorties de la reprise
 * elle-même : ses footings courts tireraient la médiane vers le bas, et la « sortie longue »
 * reviendrait au fil de la reprise (relecture du 17/11/2026).
 */
export function distancesAvantArret(
  sorties: readonly { date: string | null | undefined; distance_km?: number | null }[],
  r: Pick<RepriseArret, "arretJours" | "joursRepris">, aujourdhui: string,
): (number | null | undefined)[] {
  // La dernière sortie d'avant l'arrêt remonte à `joursRepris + arretJours` jours au moins.
  const borne = r.joursRepris + r.arretJours;
  return sorties.filter((w) => {
    const n = ecartJours(aujourdhui, String(w.date ?? ""));
    return n != null && n >= borne && n <= borne + HABITUDE_JOURS;
  }).map((w) => w.distance_km);
}

/**
 * LES SORTIES OÙ SE LIT LA SORTIE HABITUELLE : la même réunion que pour l'arrêt (voir
 * `joursCourusPourArret`). Une même sortie figure dans les deux sources : la compter deux fois
 * fausserait la médiane, donc seul ce RECOUVREMENT est retiré.
 *
 * ⚠️ DE VRAIES DOUBLES SÉANCES NE SONT PAS DES DOUBLONS (sixième relecture, 19/11/2026). Fusionner
 * toutes les sorties de même jour et de même distance retirait la seconde sortie d'un coureur qui
 * court 6 km matin et soir : sa sortie habituelle passait de 8 à 10 km, et la sortie longue de
 * reprise (9 km) n'était plus posée. L'historique long est donc gardé EN ENTIER ; une sortie
 * récente n'est écartée que si l'historique en porte déjà une, non encore appariée, du même jour
 * et de même distance.
 */
export function sortiesPourArret<T extends { date: string | null | undefined; distance_km?: number | null }>(
  historique: readonly T[], recentes: readonly T[],
): T[] {
  const cle = (w: T) => `${String(w.date ?? "").slice(0, 10)}|${w.distance_km ?? ""}`;
  // Combien de sorties de l'historique long restent à apparier, par jour et par distance.
  const restant = new Map<string, number>();
  for (const w of historique) restant.set(cle(w), (restant.get(cle(w)) ?? 0) + 1);
  const enPlus = recentes.filter((w) => {
    const n = restant.get(cle(w)) ?? 0;
    if (n > 0) { restant.set(cle(w), n - 1); return false; }
    return true;
  });
  return [...historique, ...enPlus];
}

/**
 * Pendant une reprise, une « sortie longue » que le plafond de volume ramène SOUS la
 * sortie habituelle n'est pas une sortie longue : c'est un footing, et le plan ne la nomme
 * pas autrement. Sans sortie habituelle connue, on ne tranche pas (elle reste).
 */
export function sortieLongueTient(longueKm: number, habituelleKm: number | null): boolean {
  return habituelleKm == null || longueKm >= habituelleKm;
}
