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
//  règle change d'échelle : voir plus bas « LE VOLUME AU-DELÀ DE 28 JOURS D'ARRÊT ».
//
//  ⚠️ LE SILENCE N'EST PAS FORCÉMENT UN ARRÊT : une montre qui ne synchronise plus produit
//  le même vide. Ce module ne tranche pas ; c'est le texte affiché qui le dit à l'athlète.
// ─────────────────────────────────────────────────────────────────────────────
import { ecartJours } from "@/lib/coach/recuperation";

/** En deçà, rien n'est perdu (Daniels : VDOT intact jusqu'à 5 jours d'arrêt). */
export const ARRET_MIN_JOURS = 6;
/** Au-delà, le volume suit une autre échelle (`partApresLongArret`) et l'intensité celle de `arretHorsEchelle`. */
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

/** Durée MINIMALE de la règle d'intensité après un arrêt de plus de 28 jours (voir `finRegleIntensite`). */
export const REPRISE_HORS_ECHELLE_JOURS = ARRET_MAX_JOURS;
/** Durée de la MARCHE DE SORTIE qui suit la règle d'intensité (voir `sortieDeRegle`). */
export const MARCHE_SORTIE_JOURS = 7;

/**
 * LA FIN DE LA RÈGLE D'INTENSITÉ après un arrêt de plus de 28 jours : le rang du premier jour de reprise
 * (0 = jour de la première sortie) où elle ne s'applique plus. UNE seule fonction, lue par le plan, la
 * feuille de route et le motif.
 *
 * ⚠️ ELLE S'ÉTEIGNAIT AU 28ᵉ JOUR QUEL QUE SOIT L'ARRÊT (visa et avis du directeur scientifique, 20 et
 * 23/11/2026). Après 90 jours d'arrêt, le coureur passait de zéro à deux séances dures en deux jours
 * (27ᵉ au 29ᵉ jour, volume encore plafonné à 50 %), recevait de la VMA au 42ᵉ jour dans 28 à 30 km, et sa
 * sortie longue revenait plus courte que sa sortie habituelle le lendemain d'un motif qui disait « la
 * séance dure attend son retour ». La règle dure désormais jusqu'au DÉBUT du dernier palier de volume :
 *  · arrêt de plus de 56 jours : le 63ᵉ jour (fin du palier de 70 %) ;
 *  · arrêt de 29 à 56 jours : les deux tiers de la reprise, jamais moins de 28 jours.
 * ⚠️ JAMAIS DÉCROISSANTE quand l'arrêt s'allonge (un test le vérifie de 29 à 200 jours).
 */
export function finRegleIntensite(arretJours: number): number {
  if (arretJours > ARRET_TRES_LONG_JOURS) return (PARTS_REPRISE_TRES_LONGUE.length - 1) * PALIER_REPRISE_TRES_LONGUE_JOURS;
  return Math.max(REPRISE_HORS_ECHELLE_JOURS, Math.ceil((2 * arretJours) / 3));
}

/**
 * L'ARRÊT DE PLUS DE 28 JOURS, pour l'intensité seulement — `null` de 6 à 28 jours (c'est
 * `repriseApresArret`) et une fois la règle d'intensité finie (`finRegleIntensite`).
 *
 * ⚠️ UNE GARDE NE BAISSE PAS QUAND LE RISQUE MONTE (visa du directeur scientifique, 17/11/2026).
 * Au-delà de 28 jours, la règle de Daniels change d'échelle pour le VOLUME, et ce module rendait
 * `null` : la règle d'intensité s'arrêtait donc là où elle compte le plus. Rejoué : après 34
 * jours sans courir, un seuil de 4×10 min le jour même du retour, et une sortie longue de 22 km
 * dans une semaine visée à 20 km — alors qu'à 27 jours, rien de dur avant la seconde moitié.
 * Le volume au-delà de 28 jours a son propre plafond (`partApresLongArret`, 19/11/2026) ; l'intensité
 * reçoit AU MOINS la règle de l'arrêt le plus long de l'échelle (voir `qualitePendantReprise`).
 */
export function arretHorsEchelle(joursCourus: readonly string[], aujourdhui: string): ArretVu | null {
  const a = dernierArret(joursCourus, aujourdhui);
  if (!a || a.arretJours <= ARRET_MAX_JOURS) return null;
  if (!a.enCours && a.joursRepris >= finRegleIntensite(a.arretJours)) return null;
  return a;
}

/**
 * LA MARCHE DE SORTIE : les sept jours qui suivent la fin de la règle d'intensité d'un arrêt de plus de
 * 28 jours, ou `null`. Le plan normal ne revient pas d'un coup (avis du directeur scientifique,
 * 23/11/2026) : pendant cette semaine, deux séances de qualité au plus, sans VMA ni côtes ni test VMA
 * (seuil ou allure de course seulement). Comme la règle elle-même, elle se lit sur le DERNIER arrêt :
 * une pause courte survenue depuis l'emporte.
 */
export function sortieDeRegle(joursCourus: readonly string[], aujourdhui: string): Pick<RepriseArret, "arretJours" | "joursRepris"> | null {
  const a = dernierArret(joursCourus, aujourdhui);
  // Pas encore repris : `joursRepris` vaut 0, jamais dans la fenêtre (la règle dure 28 jours au moins).
  if (!a || a.arretJours <= ARRET_MAX_JOURS) return null;
  const fin = finRegleIntensite(a.arretJours);
  return a.joursRepris >= fin && a.joursRepris < fin + MARCHE_SORTIE_JOURS ? { arretJours: a.arretJours, joursRepris: a.joursRepris } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  LE VOLUME AU-DELÀ DE 28 JOURS D'ARRÊT — un PLAFOND, jamais une cible.
//
//  ⚠️ CONSTAT (relectures du 19/11/2026, puis rejoué) : au-delà de 28 jours, ce module ne bornait
//  que l'intensité. Un coureur à 60 km par semaine qui reprend d'emblée à son rythme après 90
//  jours sans courir recevait 48 km visés au 15ᵉ jour de reprise (80 % de son volume d'avant), et
//  48 km encore au 30ᵉ, avec une VMA et un seuil : le plan suivait ce qu'il venait de courir.
//
//  LA RÈGLE (Daniels' Running Formula, table de reprise après une interruption ; relevée le
//  19/11/2026 dans des sources secondaires concordantes, le livre n'étant pas lisible en ligne) :
//   · de 4 à 8 semaines d'arrêt (29 à 56 jours) : la reprise dure autant que l'arrêt, un tiers à
//     33 % du volume d'avant, un tiers à 50 %, un tiers à 75 % ;
//   · au-delà de 8 semaines : trois semaines à 33 %, trois à 50 %, trois à 70 %, trois à 80 %,
//     puis le volume d'avant. ⚠️ Trois sources donnent 85 % pour le dernier palier, une donne
//     80 % : 80 % est retenu (avis du directeur scientifique, 23/11/2026 : c'est un plafond, la
//     valeur la plus basse est la prudente tant que le livre n'est pas relu) ; 85 % a été en
//     ligne du 20 au 23/11/2026. Le troisième palier, 70 %, est concordant.
//  Les plafonds en miles que le livre joint à ces paliers n'ont pas pu être relus : ils ne sont
//  pas appliqués (on ne code pas un chiffre non vérifié).
//
//  ⚠️ UN PLAFOND, PAS UNE CIBLE : ces parts sont des maximums. Le plan garde sa progression
//  ordinaire (jamais un bond par rapport à ce qui vient d'être couru) et ne retient le plafond
//  que s'il est plus bas. Cette règle ne peut donc que BAISSER un volume.
// ─────────────────────────────────────────────────────────────────────────────

/** Jusqu'à cette durée d'arrêt (8 semaines), la reprise de volume dure autant que l'arrêt, par tiers. */
export const ARRET_TRES_LONG_JOURS = 56;
/** Parts du volume d'avant l'arrêt, par tiers de la reprise, après 29 à 56 jours d'arrêt. */
export const PARTS_REPRISE_LONGUE = [0.33, 0.5, 0.75] as const;
/** Parts du volume d'avant l'arrêt, par paliers de trois semaines, après plus de 56 jours d'arrêt. */
export const PARTS_REPRISE_TRES_LONGUE = [0.33, 0.5, 0.7, 0.8] as const;
/** Durée d'un palier après plus de 56 jours d'arrêt : trois semaines. */
export const PALIER_REPRISE_TRES_LONGUE_JOURS = 21;

/** Durée, en jours, de la reprise de VOLUME après un arrêt de plus de 28 jours. */
export function dureeRepriseLongue(arretJours: number): number {
  return arretJours > ARRET_TRES_LONG_JOURS
    ? PARTS_REPRISE_TRES_LONGUE.length * PALIER_REPRISE_TRES_LONGUE_JOURS
    : arretJours;
}

/**
 * La part du volume d'AVANT l'arrêt à ne pas dépasser la semaine qui commence dans `dansJours`
 * jours, après un arrêt de PLUS de 28 jours ; 1 hors de cette règle (pas d'arrêt, arrêt de 28
 * jours au plus : c'est `partApresArret`, ou reprise terminée).
 * ⚠️ JAMAIS CROISSANTE quand l'arrêt s'allonge, `partApresArret` comprise (un test le vérifie
 * de 6 à 200 jours d'arrêt, pour chaque jour de reprise).
 */
export function partApresLongArret(r: Pick<RepriseArret, "arretJours" | "joursRepris"> | null, dansJours = 0): number {
  if (!r || r.arretJours <= ARRET_MAX_JOURS) return 1;
  const jour = r.joursRepris + dansJours;
  if (r.arretJours > ARRET_TRES_LONG_JOURS) {
    const palier = Math.floor(jour / PALIER_REPRISE_TRES_LONGUE_JOURS);
    return palier < PARTS_REPRISE_TRES_LONGUE.length ? PARTS_REPRISE_TRES_LONGUE[palier] : 1;
  }
  if (jour >= r.arretJours) return 1;
  return jour < r.arretJours / 3 ? PARTS_REPRISE_LONGUE[0] : jour < (2 * r.arretJours) / 3 ? PARTS_REPRISE_LONGUE[1] : PARTS_REPRISE_LONGUE[2];
}

/**
 * Sous ce plafond, une semaine ne porte plus deux footings : un footing dure au moins 25 minutes,
 * soit 4 à 6 km selon l'allure facile (`kmMinFooting`, autoPlan : 6 km jusqu'à 4'10 au km), et le
 * plan ne pose pas de sortie plus courte.
 */
export const PLAFOND_MIN_REPRISE_LONGUE_KM = 12;

/**
 * La part du volume d'avant l'arrêt (`volumeAvantKm`, en km par semaine) qui PLAFONNE la semaine :
 * la part de Daniels (`partApresLongArret`), sauf pour un petit volume.
 * ⚠️ UN POURCENTAGE D'UN PETIT VOLUME VIDE LA SEMAINE (tirage du 20/11/2026) : 33 % de 15 km font
 * 5 km, moins qu'un footing, et le plan ne posait plus AUCUNE sortie pendant le premier tiers de
 * la reprise (11 coureurs sur 3 200 tirés au hasard, tous à moins de 20 km par semaine avant
 * l'arrêt), sous un motif qui disait « on reprend par des footings » ; à 10 km, il n'en posait
 * qu'une, plus longue que la sortie habituelle du coureur. Le plafond passe alors au premier
 * palier SUIVANT de la même échelle qui laisse au moins `PLAFOND_MIN_REPRISE_LONGUE_KM` : le
 * pourcentage annoncé reste un palier de la règle, et il ne fait que monter avec les semaines.
 * Exemples : 30 km par semaine donnent 50 % d'emblée ; 20 km donnent 75 % après 40 jours d'arrêt,
 * 70 % puis 80 % après 90 jours.
 * ⚠️ AUCUN PALIER N'Y SUFFIT : LE PLAFOND SE REPLIE SUR LE PLANCHER, IL NE DISPARAÎT PAS (avis du
 * directeur scientifique, 23/11/2026). La fonction rendait 1, « pas de plafond » : en abaissant le dernier
 * palier de 85 à 80 %, un coureur à 14 km par semaine perdait son plafond de 12 km et recevait la cible
 * ordinaire du plan, 17 à 20 km, au 2ᵉ jour de reprise après 70 jours d'arrêt (51 coureurs sur 1 000 à
 * petit volume tirés au hasard). Tant que la reprise de volume dure et que le volume d'avant dépasse le
 * plancher, la part rendue est celle qui donne exactement le plancher (12 km : `plafondReplieSurPlancher`).
 * Il n'y a plus de plafond que dans deux cas : volume d'avant inconnu (0), et volume d'avant de 12 km ou
 * moins (suite à part : le plafonner à lui-même).
 * C'est un choix de Pacevo, pas un chiffre de Daniels.
 * Cette fonction ne rend JAMAIS une part plus basse que `partApresLongArret`, ni un plafond sous le plancher.
 */
export function partPlafondLongArret(r: Pick<RepriseArret, "arretJours" | "joursRepris"> | null, volumeAvantKm: number, dansJours = 0): number {
  const part = partApresLongArret(r, dansJours);
  if (!r || part >= 1) return 1;
  const echelle: readonly number[] = r.arretJours > ARRET_TRES_LONG_JOURS ? PARTS_REPRISE_TRES_LONGUE : PARTS_REPRISE_LONGUE;
  const palier = echelle.find((p) => p >= part && Math.round(volumeAvantKm * p) >= PLAFOND_MIN_REPRISE_LONGUE_KM);
  if (palier != null) return palier;
  return volumeAvantKm > PLAFOND_MIN_REPRISE_LONGUE_KM ? PLAFOND_MIN_REPRISE_LONGUE_KM / volumeAvantKm : 1;
}

/**
 * Le plafond du long arrêt est-il REPLIÉ SUR LE PLANCHER (aucun palier de l'échelle ne laisse deux footings) ?
 * Le motif le dit alors en kilomètres, et la semaine est « au plancher » : footings seulement tant que la règle
 * d'intensité dure (`coachContext`). Lu sur la même fonction que le plafond, jamais recalculé ailleurs.
 */
export function plafondReplieSurPlancher(r: Pick<RepriseArret, "arretJours" | "joursRepris"> | null, volumeAvantKm: number, dansJours = 0): boolean {
  if (!r) return false;
  const part = partPlafondLongArret(r, volumeAvantKm, dansJours);
  const echelle: readonly number[] = r.arretJours > ARRET_TRES_LONG_JOURS ? PARTS_REPRISE_TRES_LONGUE : PARTS_REPRISE_LONGUE;
  return part < 1 && !echelle.includes(part);
}

/**
 * L'ARRÊT DE PLUS DE 28 JOURS dont la reprise de VOLUME est en cours, ou `null`. Elle dure plus
 * longtemps que la règle d'intensité (`arretHorsEchelle`, `finRegleIntensite`) : autant que
 * l'arrêt, ou douze semaines au-delà de 56 jours.
 *
 * ⚠️ UN ARRÊT COURT SURVENU DEPUIS NE L'EFFACE PAS : on ne lit pas « le dernier arrêt » mais le
 * plus récent arrêt LONG dont la reprise court encore. Dix jours de pause au milieu d'une
 * reprise de douze semaines ne rendent pas son volume d'avant à un coureur. Le décompte de la
 * reprise part de la première sortie qui a suivi l'arrêt long, pause comprise.
 */
export function repriseVolumeLongArret(joursCourus: readonly string[], aujourdhui: string): ArretVu | null {
  const jours = joursDistincts(joursCourus, aujourdhui);
  if (!jours.length) return null;
  const depuis = ecartJours(aujourdhui, jours[jours.length - 1]);
  if (depuis == null) return null;
  // Toujours à l'arrêt, depuis plus de 28 jours.
  if (depuis - 1 > ARRET_MAX_JOURS) return { arretJours: depuis - 1, enCours: true, joursRepris: 0, depuisJours: depuis };
  for (let i = jours.length - 1; i > 0; i--) {
    const ecart = ecartJours(jours[i], jours[i - 1]);
    if (ecart == null || ecart - 1 <= ARRET_MAX_JOURS) continue;
    const joursRepris = ecartJours(aujourdhui, jours[i]) ?? Infinity;
    if (joursRepris < dureeRepriseLongue(ecart - 1)) return { arretJours: ecart - 1, enCours: false, joursRepris };
  }
  return null;
}

/** Les jours courus, distincts, triés, jusqu'à aujourd'hui compris. */
function joursDistincts(joursCourus: readonly string[], aujourdhui: string): string[] {
  return [...new Set(joursCourus.map((d) => String(d).slice(0, 10)))]
    .filter((d) => d.length === 10 && d <= aujourdhui)
    .sort();
}

/**
 * Depuis combien de jours l'athlète a couru pour la dernière fois AVANT l'arrêt : c'est sur ce
 * jour-là que s'ancre son volume d'avant l'arrêt. `arretJours` jours sans courir le séparent de
 * la première sortie de reprise (ou d'aujourd'hui, tant qu'il n'a pas repris).
 */
export function joursDepuisLAvantArret(r: Pick<RepriseArret, "arretJours" | "joursRepris">): number {
  return r.joursRepris + r.arretJours + 1;
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
  const jours = joursDistincts(joursCourus, aujourdhui);
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
//   · après un arrêt de plus de 28 jours (le volume y a son propre plafond, plus bas), l'intensité
//     garde AU MOINS cette protection : pas avant le 14ᵉ jour, et la règle dure jusqu'au début du
//     dernier palier de volume (`finRegleIntensite`), puis une semaine de marche de sortie ;
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
 *    de quatre semaines (la règle, elle, dure jusqu'à `finRegleIntensite`).
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
