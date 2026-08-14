// ─────────────────────────────────────────────────────────────────────────────
//  DÉFIS — progression calculée à la lecture, sur les séances réelles.
//
//  Aucune colonne de progression en base, et c'est délibéré : la stocker, ce serait
//  risquer qu'elle survive à la correction ou à la suppression de la séance qui l'a
//  produite — un classement affichant une performance effacée. Même principe que la
//  Vitrine des trophées.
// ─────────────────────────────────────────────────────────────────────────────

export type Metric = "distance" | "elevation" | "sessions" | "longest_run";

export type Challenge = {
  id: string;
  name: string;
  metric: Metric;
  /** Cible : km, mètres de D+, ou nombre de séances selon la métrique. */
  target: number;
  starts_on: string;
  ends_on: string;
};

export type ChallengeWorkout = {
  date: string;
  sport?: string | null;
  type?: string | null;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
};

/** Seules les séances de course comptent : une sortie vélo ne remplit pas un défi de course. */
const isRun = (w: ChallengeWorkout) => {
  const s = `${w.sport ?? ""} ${w.type ?? ""}`.toLowerCase();
  return !/ride|bike|velo|vélo|swim|natation|row|elliptical|hike|rando/.test(s);
};

/**
 * Une séance compte-t-elle pour ce défi ?
 *
 * Bornes INCLUSES des deux côtés. Une séance courue le jour de clôture doit compter :
 * l'exclure priverait l'athlète de son dernier effort, précisément celui qui décide
 * souvent du résultat.
 */
export function inWindow(dateIso: string, challenge: Challenge): boolean {
  const d = dateIso.slice(0, 10);
  return d >= challenge.starts_on.slice(0, 10) && d <= challenge.ends_on.slice(0, 10);
}

/**
 * Avancement d'un athlète sur un défi.
 *
 * `value` est exprimé dans l'unité de la métrique ; `ratio` est borné à 1 pour
 * l'affichage, mais `value` garde la valeur RÉELLE — un athlète qui a fait 150 km
 * sur un défi de 100 doit voir ses 150 km, pas un plafond.
 */
export function challengeProgress(
  challenge: Challenge, workouts: ChallengeWorkout[],
): { value: number; ratio: number; done: boolean } {
  const retenues = workouts.filter((w) => w.date && isRun(w) && inWindow(w.date, challenge));

  let value = 0;
  switch (challenge.metric) {
    case "distance":
      value = retenues.reduce((s, w) => s + (w.distance_km ?? 0), 0);
      break;
    case "elevation":
      value = retenues.reduce((s, w) => s + (w.elevation_gain_m ?? 0), 0);
      break;
    case "sessions":
      // Une séance sans distance ne compte pas : un enregistrement lancé puis
      // arrêté aussitôt gonflerait un défi de régularité sans le moindre effort.
      value = retenues.filter((w) => (w.distance_km ?? 0) > 0).length;
      break;
    case "longest_run":
      value = retenues.reduce((m, w) => Math.max(m, w.distance_km ?? 0), 0);
      break;
  }

  const ratio = challenge.target > 0 ? Math.min(1, value / challenge.target) : 0;
  return { value, ratio, done: value >= challenge.target };
}

/** Libellé d'unité, pour ne jamais afficher un nombre nu. */
export const metricUnit = (m: Metric): string =>
  m === "distance" ? "km" : m === "elevation" ? "m D+" : m === "sessions" ? "séances" : "km";

export const metricLabel = (m: Metric): string =>
  m === "distance" ? "Distance cumulée"
  : m === "elevation" ? "Dénivelé cumulé"
  : m === "sessions" ? "Nombre de séances"
  : "Plus longue sortie";

/**
 * Jours restants — `null` si le défi est terminé, 0 le dernier jour.
 * On distingue « terminé » de « dernier jour » : dire « 0 jour restant » sur un défi
 * clos pousserait l'athlète à sortir courir pour rien.
 */
export function daysLeft(challenge: Challenge, now: Date = new Date()): number | null {
  const fin = Date.parse(`${challenge.ends_on.slice(0, 10)}T23:59:59Z`);
  if (!Number.isFinite(fin)) return null;
  const reste = fin - now.getTime();
  return reste < 0 ? null : Math.floor(reste / 86_400_000);
}

/** Le défi a-t-il commencé ? Un défi à venir ne doit pas afficher 0 % comme un échec. */
export const notStarted = (challenge: Challenge, now: Date = new Date()): boolean =>
  now.toISOString().slice(0, 10) < challenge.starts_on.slice(0, 10);

/**
 * Classement d'un défi : les participants triés par avancement décroissant.
 * À égalité on ne départage PAS — inventer un critère (le plus rapide, le premier
 * inscrit) désignerait un vainqueur que les données ne désignent pas.
 */
export function challengeLeaderboard(
  challenge: Challenge,
  parAthlete: { userId: string; workouts: ChallengeWorkout[] }[],
): { userId: string; value: number; ratio: number; done: boolean; rank: number }[] {
  const lignes = parAthlete
    .map((p) => ({ userId: p.userId, ...challengeProgress(challenge, p.workouts) }))
    .sort((a, b) => b.value - a.value);

  let rang = 0, precedent = Number.NaN;
  return lignes.map((l, i) => {
    if (l.value !== precedent) { rang = i + 1; precedent = l.value; }
    return { ...l, rank: rang }; // les ex æquo partagent le même rang
  });
}
