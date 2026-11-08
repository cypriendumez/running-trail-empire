// ─────────────────────────────────────────────────────────────────────────────
//  CONSTRUCTION DES LIGNES `hrv_data` ET `sleep_data` DEPUIS UN JOUR « WELLNESS »
//  intervals.icu — partagée par les deux chemins de synchronisation, comme
//  `workoutRow` pour les séances (12/10/2026).
//
//  Deux défauts silencieux vivaient dans les deux copies de cette conversion :
//
//  1. UN JOUR SANS MESURE N'A PAS UN CHAMP ABSENT, IL A UN CHAMP À `null`.
//     Relevé sur l'API le 12/10/2026 : 13 jours sur 28 du compte de Cyprien arrivent
//     avec `"hrv": null` et `"sleepSecs": null`. Le filtre `!== undefined` les laissait
//     passer :
//       · VFC : `hrv_ms: null` dans une colonne NOT NULL → refus 23502 ;
//       · sommeil : `Math.round(null / 60)` = 0 → refus de `check (total_sleep_min > 0)`.
//     Côté navigateur, les lignes partent en UN lot : un seul jour sans montre faisait
//     refuser TOUTE la période, et le refus n'était pas lu (« 3 VFC synchronisées »).
//
//  2. UN JOUR QUI N'A QUE `hrvSDNN` ÉTAIT JETÉ. C'est le cas de tous les porteurs
//     d'Apple Watch en réglages par défaut : Intervals.icu Companion envoie la SDNN,
//     moyenne des relevés ponctuels de la journée (forum intervals.icu, sujet 124208,
//     #118 et #153). Aucune VFC dans Pacevo, et aucun mot pour le dire.
//
//  ⚠️ SDNN ET rMSSD NE SONT PAS LA MÊME MESURE : chacune garde SA colonne. `hrv_ms`
//  reçoit `rmssd ?? sdnn` UNIQUEMENT parce que la colonne est NOT NULL en base — elle
//  mélange donc les deux par construction et ne se lit plus nulle part. Les lectures
//  passent par `serieVfc` (lib/health/vfc), qui choisit UNE mesure par athlète.
// ─────────────────────────────────────────────────────────────────────────────

type N = number | null | undefined;

/** Champs d'un jour wellness effectivement lus. `| null` partout : c'est ainsi que
 *  l'API dit « pas de mesure ce jour-là ». Noms du modèle `Wellness` de l'API
 *  (spécification /api/v1/docs), retrouvés tels quels dans une réponse réelle le 12/10/2026. */
export type IcuWellness = {
  id?: string | null;
  hrv?: N; hrvSDNN?: N;
  sleepSecs?: N; sleepScore?: N; spO2?: N; respiration?: N;
};

/** Au-delà, ce n'est pas une variabilité cardiaque mais une erreur de saisie ou de capteur.
 *  (La colonne est en numeric(6,2) : une valeur aberrante y ferait échouer tout le lot.) */
export const VFC_MAX_MS = 1000;

/**
 * L'état écrit dans `physiological_state`. La colonne est NOT NULL, mais l'état se calcule
 * à la LECTURE, face à la base de l'athlète dans SA mesure (`serieVfc`). Il était tranché
 * ici sur des seuils absolus (< 50 ms → récupération, > 80 → compétition) qui ne valent
 * ni d'un athlète à l'autre ni de la SDNN à la rMSSD — et côté navigateur, une SDNN
 * `null` passait pour « < 40 » : 14 des 16 jours « recovery » de Cyprien étaient au-dessus
 * de 50 ms, jusqu'à 106. Plus aucune lecture ne s'en sert.
 */
export const ETAT_ECRIT = "optimal" as const;

/** Une mesure réelle : un nombre fini strictement positif. `null` = jour sans mesure. */
export function mesure(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** La date du jour wellness (`id` = « AAAA-MM-JJ »), ou `null` si elle n'en est pas une. */
export function dateDuJour(jour: IcuWellness): string | null {
  const id = typeof jour?.id === "string" ? jour.id.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(id) ? id : null;
}

const vfcPlausible = (v: unknown) => { const m = mesure(v); return m != null && m < VFC_MAX_MS ? m : null; };

export type LigneVfcEcrite = {
  user_id: string; date: string;
  hrv_ms: number; rmssd: number | null; sdnn: number | null;
  physiological_state: typeof ETAT_ECRIT;
};

/** La ligne `hrv_data` d'un jour, ou `null` si ce jour n'a AUCUNE des deux mesures. */
export function ligneVfc(userId: string, jour: IcuWellness): LigneVfcEcrite | null {
  const date = dateDuJour(jour);
  if (!date) return null;
  const rmssd = vfcPlausible(jour.hrv), sdnn = vfcPlausible(jour.hrvSDNN);
  const valeur = rmssd ?? sdnn;
  if (valeur == null) return null;
  return { user_id: userId, date, hrv_ms: valeur, rmssd, sdnn, physiological_state: ETAT_ECRIT };
}

export type LigneSommeilEcrite = {
  user_id: string; date: string; total_sleep_min: number;
  deep_sleep_min: null; light_sleep_min: null; rem_sleep_min: null;
  sleep_score: number | null; body_battery_start: null; body_battery_end: null;
  respiration_rate: number | null; spo2_avg: number | null; source: "intervals_icu";
};

/** SpO2 en % : intervals.icu la définit sur 0-100 % (forum, sujet 5776 #12). Sous 70 %, la
 *  valeur sort de la plage où un oxymètre doit garantir sa précision (ISO 80601-2-61 :
 *  70-100 %) ; une fraction (0,97 pour 97 %) y tombe aussi, au lieu de s'afficher « 1 % ». */
export const SPO2_MIN = 70;
/** Respirations par minute PENDANT LE SOMMEIL (forum, sujet 63373 #11). À l'effort maximal,
 *  un adulte en est à 36 ± 9 (Blackie 1991, 231 adultes) : au-delà de 60 en dormant, c'est une
 *  erreur de saisie ou de capteur — et 1 000 ferait déborder la colonne numeric(4,1), lot entier. */
export const RESPIRATION_MAX = 60;

const minutes = (secs: unknown) => { const s = mesure(secs); return s != null ? Math.round(s / 60) : null; };
/** Entier dans ]0, 100] — la colonne porte ce `check` : hors bornes, tout le lot tombe.
 *  Un score de 0 n'est pas une nuit notée : NULL, comme une mesure absente. */
const sur100 = (v: unknown) => { const m = mesure(v), r = m == null ? null : Math.round(m); return r != null && r > 0 && r <= 100 ? r : null; };
/** Au dixième, comme la colonne numeric(4,1) ; hors [min, max] → NULL, jamais 0. */
const auDixieme = (v: unknown, min: number, max: number) => {
  const m = mesure(v), r = m == null ? null : Math.round(m * 10) / 10;
  return r != null && r > 0 && r >= min && r <= max ? r : null;
};

/**
 * La ligne `sleep_data` d'une nuit, ou `null` sans durée de sommeil mesurée.
 * Une mesure ABSENTE reste NULL, jamais 0 : un 0 fabriquait une nuit catastrophique
 * (« 0 % de sommeil profond ») là où la mesure n'existait simplement pas.
 *
 * Les noms lus jusqu'au 12/10/2026 (`avgSpo2`, `avgRespiration`, `bb`, `bbMax`,
 * `deep/light/remSleepSecs`) n'existent PAS dans l'API : ni dans sa spécification, ni dans
 * 401 jours de réponse réelle. SpO2 et respiration restaient vides pour TOUT LE MONDE, même
 * quand la source les fournit (Whoop ; Oura et Polar pour la respiration ; Health Snapshot
 * Garmin pour la SpO2 ; saisie manuelle). Les vrais noms : `spO2`, `respiration`.
 */
export function ligneSommeil(userId: string, jour: IcuWellness): LigneSommeilEcrite | null {
  const date = dateDuJour(jour);
  const total = minutes(jour.sleepSecs);
  if (!date || total == null || total <= 0) return null;
  return {
    user_id: userId, date, total_sleep_min: total,
    sleep_score: sur100(jour.sleepScore),
    respiration_rate: auDixieme(jour.respiration, 0, RESPIRATION_MAX),
    spo2_avg: auDixieme(jour.spO2, SPO2_MIN, 100),
    // Ni phases ni Body Battery dans l'API : NULL EXPLICITE. Omises, les phases prendraient le
    // `default 0` de la colonne (« 0 % de sommeil profond » inventé) et une ancienne valeur ne
    // serait jamais effacée. (intervals.icu propose un champ PERSONNALISÉ de Body Battery, que
    // l'athlète doit ajouter lui-même — forum, sujet 119477 #16 : absent chez Cyprien, non lu.)
    deep_sleep_min: null, light_sleep_min: null, rem_sleep_min: null,
    body_battery_start: null, body_battery_end: null,
    source: "intervals_icu",
  };
}
