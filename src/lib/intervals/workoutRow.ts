// ─────────────────────────────────────────────────────────────────────────────
//  CONSTRUCTION D'UNE LIGNE `workouts` DEPUIS UNE ACTIVITÉ intervals.icu
//
//  Cette conversion existait en DEUX exemplaires divergents, et c'est là que se sont
//  logés plusieurs défauts silencieux :
//    · `average_cadence * 2` sans arrondi → 176.54 dans une colonne smallint →
//      Postgres rejetait la LIGNE ENTIÈRE (22P02) et 98 séances n'ont jamais existé ;
//    · `avg_stride_length` et `avg_vertical_oscillation` — des noms de champs qui
//      N'EXISTENT PAS chez intervals.icu (les vrais sont `average_*`) → deux colonnes
//      vides à 100 % pendant que le coach avait pour consigne de les analyser ;
//    · le SPORT confondu avec le RÔLE de la séance → la randonnée comptée en volume
//      de course.
//
//  Un seul endroit, testé contre des activités réelles.
// ─────────────────────────────────────────────────────────────────────────────
import { sportOf } from "./sport";

/** Champs d'une activité intervals.icu effectivement lus. Les noms sont EXACTS : toute
 *  faute de frappe ici produit une colonne vide sans la moindre erreur. */
// `| null` partout : l'API renvoie explicitement null pour tout capteur absent, et un
// type qui ne l'admet pas force des conversions qui masquent les vraies erreurs.
type N = number | null | undefined;
export type IcuActivity = {
  id?: string | null; name?: string | null; type?: string | null; start_date_local?: string | null;
  moving_time?: N; elapsed_time?: N; distance?: N;
  total_elevation_gain?: N; total_elevation_loss?: N;
  average_heartrate?: N; max_heartrate?: N; average_speed?: N;
  average_watts?: N; max_watts?: N; average_cadence?: N;
  icu_training_load?: N; icu_tss?: N; aerobic_te?: N;
  average_vertical_oscillation?: N; average_vertical_ratio?: N;
  average_stride?: N; icu_hrr?: { hrr?: N } | null;
  decoupling?: N; average_temp?: N; gap?: N;
  icu_hr_zone_times?: number[] | null; icu_intensity?: N;
};

/** Colonnes entières en base : y écrire un flottant fait échouer toute la ligne. */
export const INTEGER_COLUMNS = [
  "duration_seconds", "elevation_gain_m", "elevation_loss_m", "avg_hr", "max_hr",
  "avg_power_watts", "max_power_watts", "avg_cadence_spm", "ground_contact_ms",
  "intensity_pct", "hrr_bpm",
] as const;

const ri = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? Math.round(v) : null);

export function buildWorkoutRow(
  act: IcuActivity,
  opts: { userId: string; type: string; hasNewCols?: boolean },
): Record<string, unknown> {
  const title = act.name ?? opts.type;
  return {
    user_id: opts.userId,
    title,
    type: opts.type,
    date: String(act.start_date_local ?? "").split("T")[0],
    ...(opts.hasNewCols === false ? {} : {
      sport: sportOf(act.type),
      external_id: act.id != null ? String(act.id) : null,
      // Le ratio vertical est le meilleur marqueur d'économie de course : il rapporte
      // l'oscillation à la longueur de foulée, donc il ne dépend pas de la taille.
      vertical_ratio_pct: act.average_vertical_ratio != null
        ? Math.round(act.average_vertical_ratio * 100) / 100 : null,
      // `icu_hrr` est un OBJET ; seule la chute de FC nous intéresse.
      hrr_bpm: ri(act.icu_hrr?.hrr),
    }),
    duration_seconds: Math.max(1, ri(act.moving_time ?? act.elapsed_time) ?? 1),
    distance_km: act.distance ? act.distance / 1000 : null,
    elevation_gain_m: ri(act.total_elevation_gain) ?? 0,
    elevation_loss_m: ri(act.total_elevation_loss) ?? 0,
    avg_hr: ri(act.average_heartrate),
    max_hr: ri(act.max_heartrate),
    avg_pace_min_km: act.average_speed ? Math.min(999, 1000 / 60 / act.average_speed) : null,
    avg_power_watts: ri(act.average_watts),
    max_power_watts: ri(act.max_watts),
    // La cadence de l'API est en cycles (une jambe) : ×2 pour des pas par minute.
    avg_cadence_spm: act.average_cadence ? Math.round(act.average_cadence * 2) : null,
    tss: act.icu_training_load ?? act.icu_tss ?? null,
    training_effect: act.aerobic_te ?? null,
    // ⚠️ `average_vertical_oscillation` est en MILLIMÈTRES, la colonne en centimètres.
    vertical_oscillation_cm: act.average_vertical_oscillation != null
      ? Math.round(act.average_vertical_oscillation / 10 * 10) / 10 : null,
    stride_length_m: act.average_stride ?? null,
    cardiac_decoupling: act.decoupling ?? null,
    weather_temp_c: act.average_temp ?? null,
    gap_min_km: act.gap && act.gap > 0.3 ? Math.round((1000 / 60 / act.gap) * 100) / 100 : null,
    hr_zone_seconds: Array.isArray(act.icu_hr_zone_times) ? act.icu_hr_zone_times : null,
    intensity_pct: ri(act.icu_intensity),
    source: "garmin",
  };
}

/**
 * Appariement d'une activité avec une ligne existante.
 *
 * L'identifiant d'origine est exact ; (date, titre) ne l'est pas, car Garmin nomme les
 * sorties d'après la ville et deux séances le même jour partagent le même titre. On ne
 * s'en sert donc QUE pour les lignes historiques sans identifiant, et une ligne ne peut
 * être revendiquée qu'UNE fois : la seconde sortie du jour crée la sienne au lieu
 * d'écraser la première.
 */
export function makeMatcher(existing: { id: string; date: string; title: string; external_id?: string | null }[]) {
  const byExt = new Map<string, string>();
  const unclaimed = new Map<string, string[]>();
  for (const w of existing) {
    if (w.external_id) { byExt.set(w.external_id, w.id); continue; }
    const k = `${w.date}__${w.title}`;
    unclaimed.set(k, [...(unclaimed.get(k) ?? []), w.id]);
  }
  return (act: { id?: string; date: string; title: string }): string | undefined => {
    if (act.id && byExt.has(String(act.id))) return byExt.get(String(act.id));
    const pool = unclaimed.get(`${act.date}__${act.title}`);
    return pool?.length ? pool.shift() : undefined;
  };
}
