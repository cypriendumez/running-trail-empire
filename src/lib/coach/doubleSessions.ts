// ─────────────────────────────────────────────────────────────────────────────
//  DOUBLES SÉANCES — deux sorties dans la même journée.
//
//  Les professionnels le font en permanence, et beaucoup d'amateurs à gros volume s'y
//  mettent. Le plan ne savait pas le faire : il posait UNE séance par jour et se
//  contentait d'un conseil dans le texte (« scinde en deux sorties »), que rien ne
//  transformait en séances réelles, ni sur le calendrier ni sur la montre.
//
//  DEUX CHOSES TRÈS DIFFÉRENTES SE CACHENT DERRIÈRE « DOUBLER ».
//
//  1. LE DOUBLE FACILE — on SCINDE un footing devenu trop long. Même volume, deux
//     sorties. Ce n'est pas une charge supplémentaire : c'est la même charge, mieux
//     absorbée. Le risque est proche de zéro, le bénéfice est réel dès que la sortie
//     dépasse ce qu'on encaisse d'un bloc.
//
//  2. LE DOUBLE SEUIL NORVÉGIEN — deux séances au seuil le MÊME jour, toutes deux
//     maintenues SOUS le second seuil lactique. C'est la méthode de Marius Bakken
//     reprise par les frères Ingebrigtsen : matin en intervalles longs (autour de
//     6 min) dans le bas de la zone, soir en intervalles courts (400 m à 1 000 m)
//     légèrement plus haut, deux fois par semaine.
//
//     ⚠️ ELLE EST PILOTÉE AU LACTATE. Tout son intérêt tient à rester juste sous le
//     seuil, contrôlé par prélèvement sanguin à chaque répétition. Sans lactatemètre,
//     un amateur ne peut que l'approcher à l'allure et à la fréquence cardiaque — et
//     l'erreur la plus fréquente est de courir TROP VITE, ce qui la transforme en deux
//     séances dures dans la journée, c'est-à-dire exactement le contraire du principe.
//     On ne la propose donc qu'à un athlète qui a le volume ET le passif pour, et on
//     lui dit franchement ce qui manque pour la piloter correctement.
//
//  AUCUN SEUIL CI-DESSOUS N'EST UNE RÈGLE FÉDÉRALE OU MÉDICALE. Ce sont nos garde-fous,
//  calibrés prudemment, et ils sont annoncés comme tels — contrairement à l'âge et aux
//  distances, où des autorités existent et sont citées.
// ─────────────────────────────────────────────────────────────────────────────

/** Volume hebdomadaire à partir duquel scinder une sortie devient utile. En dessous,
 *  une seule sortie suffit et doubler n'ajoute que de la logistique. */
export const VOLUME_MINI_DOUBLE_KM = 55;

/** Volume et passif exigés pour ENVISAGER le double seuil. Beaucoup plus haut : c'est
 *  une méthode d'athlète entraîné, pas une variante de footing. */
export const VOLUME_MINI_DOUBLE_SEUIL_KM = 90;
export const ANNEES_MINI_DOUBLE_SEUIL = 4;

import type { Lang } from "@/lib/i18n/translations";
import { DOUBLE_T } from "@/lib/coach/doubleSessionsI18n";

export type EtatDouble = {
  /** Le plan peut-il poser une deuxième séance ? */
  autorise: boolean;
  /** Ce qui manque, en français, pour l'afficher à l'athlète. Une case cochée qui ne
   *  produit rien est un mensonge silencieux : s'il a coché, il doit savoir pourquoi
   *  son plan n'a pas changé. */
  manque: string[];
  /** Le double SEUIL est-il envisageable, ou seulement le double facile ? */
  doubleSeuil: boolean;
  /** Pourquoi le double seuil n'est pas proposé, s'il ne l'est pas. */
  manqueSeuil: string[];
};

export function etatDouble(i: {
  /** L'athlète a coché « deux séances par jour » dans son profil. */
  optIn: boolean;
  /** Volume hebdomadaire REPRÉSENTATIF (médiane des semaines courues), pas un pic. */
  weeklyKm: number;
  runYears: number | null;
  readiness: "vert" | "jaune" | "orange" | "rouge";
  pains: string[];
  /** Semaine d'affûtage : on ne multiplie pas les séances quand on cherche la fraîcheur. */
  taper: boolean;
  /** Langue de l'athlète. Ces motifs s'affichent dans son profil à la seconde où il
   *  coche la case : les lui servir en français quand son écran est en allemand
   *  reviendrait à traduire l'étiquette et pas la réponse. */
  lang?: Lang;
}): EtatDouble {
  const T = DOUBLE_T[i.lang && DOUBLE_T[i.lang] ? i.lang : "fr"];
  const manque: string[] = [];
  if (!i.optIn) manque.push(T.optIn);
  if (i.pains.length) manque.push(T.douleur(i.pains.join(", ")));
  if (i.readiness === "rouge") manque.push(T.rouge);
  if (i.taper) manque.push(T.affutage);
  if (!(i.weeklyKm >= VOLUME_MINI_DOUBLE_KM)) {
    manque.push(T.volume(Math.round(i.weeklyKm), VOLUME_MINI_DOUBLE_KM));
  }
  const autorise = manque.length === 0;

  // ── Le double SEUIL : barre nettement plus haute ────────────────────────────
  const manqueSeuil: string[] = [];
  if (!autorise) manqueSeuil.push(T.seuilPrealable);
  if (!(i.weeklyKm >= VOLUME_MINI_DOUBLE_SEUIL_KM)) {
    manqueSeuil.push(T.seuilVolume(VOLUME_MINI_DOUBLE_SEUIL_KM, Math.round(i.weeklyKm)));
  }
  if (i.runYears == null || i.runYears < ANNEES_MINI_DOUBLE_SEUIL) {
    manqueSeuil.push(T.seuilAnnees(ANNEES_MINI_DOUBLE_SEUIL, String(i.runYears ?? "?")));
  }
  // Le lactate n'est pas une condition qu'on peut vérifier : c'est un AVERTISSEMENT
  // qu'on doit donner même à celui qui remplit tout le reste.
  return { autorise, manque, doubleSeuil: manqueSeuil.length === 0, manqueSeuil };
}

export type Moment = "matin" | "soir";

/**
 * Scinde une sortie facile en deux. Même volume total, réparti sur la journée.
 *
 * Le partage n'est pas 50/50 : la sortie du soir reste la principale, celle du matin
 * sert à réveiller la machine sans entamer la séance qui compte. Un 60/40 inversé —
 * gros le matin — laisserait des jambes lourdes pour le soir.
 */
export function scinderFacile(kmTotal: number): { matinKm: number; soirKm: number } | null {
  const total = Number.isFinite(kmTotal) ? kmTotal : 0;
  // En dessous de 12 km, scinder donne deux sorties trop courtes pour valoir le
  // déplacement, la douche et l'échauffement en double.
  if (total < 12) return null;
  const matin = Math.max(4, Math.round(total * 0.4));
  return { matinKm: matin, soirKm: Math.max(4, Math.round(total - matin)) };
}

/** Description de la séance du matin d'un double FACILE. */
export function seanceMatinFacile(km: number, allure: string | null): string {
  return `Réveil musculaire : ${km} km très faciles en FC Z1-Z2${allure ? ` (~${allure}/km, voire plus lent)` : ""}, sans montre si tu peux. Le seul objectif est de faire circuler, pas de préparer la séance du soir — si tu finis essoufflé, c'était trop vite.`;
}

/**
 * Description d'une journée de DOUBLE SEUIL, conforme à la méthode norvégienne.
 *
 * Matin : intervalles longs, bas de la zone. Soir : intervalles courts, légèrement plus
 * haut. Les DEUX restent SOUS le seuil — c'est tout le principe, et c'est aussi ce qui
 * est le plus difficile à respecter sans lactatemètre.
 */
export function seanceDoubleSeuil(moment: Moment, allureSeuil: string | null): string {
  const seuil = allureSeuil ? `${allureSeuil}/km` : "ton allure seuil";
  return moment === "matin"
    ? `Seuil du matin — intervalles LONGS : 5 × 6 min à ${seuil} MOINS 5 à 8 s/km, récupération 1 min trottinée. Tu dois finir en te disant que tu aurais pu en faire deux de plus. Si ce n'est pas le cas, c'était trop vite : la séance du soir sera gâchée.`
    : `Seuil du soir — intervalles COURTS : 10 à 12 × 1 min à ${seuil}, récupération 30 s trottinée. Légèrement plus rapide que ce matin, mais toujours SOUS le seuil : c'est le cumul de la journée qui fait le travail, pas l'intensité d'une répétition.`;
}

/** L'avertissement qui doit accompagner TOUTE prescription de double seuil. */
export const AVERTISSEMENT_LACTATE =
  "⚠️ Le double seuil se pilote normalement au lactate, prélevé à chaque répétition pour rester juste sous le seuil. Sans lactatemètre, tu ne peux que l'approcher à l'allure et à la FC — et l'erreur classique est de courir trop vite, ce qui transforme la journée en deux séances dures et te coûte la semaine. Dans le doute, ralentis : la méthode repose sur le volume au seuil, pas sur la vitesse.";
