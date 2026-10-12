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
 *  l'API dit « pas de mesure ce jour-là ». */
export type IcuWellness = {
  id?: string | null;
  hrv?: N; hrvSDNN?: N;
  sleepSecs?: N; deepSleepSecs?: N; lightSleepSecs?: N; remSleepSecs?: N;
  sleepScore?: N; bb?: N; bbMax?: N; avgRespiration?: N; avgSpo2?: N;
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
  deep_sleep_min: number | null; light_sleep_min: number | null; rem_sleep_min: number | null;
  sleep_score: number | null; body_battery_start: number | null; body_battery_end: number | null;
  respiration_rate: number | null; spo2_avg: number | null; source: "intervals_icu";
};

const minutes = (secs: unknown) => { const s = mesure(secs); return s != null ? Math.round(s / 60) : null; };
/** Entier dans [0, 100] — les colonnes portent ce `check` : hors bornes, tout le lot tombe. */
const sur100 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null);

/**
 * La ligne `sleep_data` d'une nuit, ou `null` sans durée de sommeil mesurée.
 * Les phases et scores ABSENTS restent NULL : les forcer à 0 fabriquait une nuit
 * catastrophique (« 0 % de sommeil profond ») là où la mesure n'existait simplement pas.
 */
export function ligneSommeil(userId: string, jour: IcuWellness): LigneSommeilEcrite | null {
  const date = dateDuJour(jour);
  const total = minutes(jour.sleepSecs);
  if (!date || total == null || total <= 0) return null;
  return {
    user_id: userId, date, total_sleep_min: total,
    deep_sleep_min: minutes(jour.deepSleepSecs),
    light_sleep_min: minutes(jour.lightSleepSecs),
    rem_sleep_min: minutes(jour.remSleepSecs),
    sleep_score: sur100(jour.sleepScore),
    body_battery_start: sur100(jour.bbMax),
    body_battery_end: sur100(jour.bb),
    respiration_rate: mesure(jour.avgRespiration),
    spo2_avg: mesure(jour.avgSpo2),
    source: "intervals_icu",
  };
}
