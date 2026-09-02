/**
 * LE PROFIL QUI SERT AU CONSEIL — construit à partir des données réelles du compte.
 *
 * ⚠️ AUCUNE VALEUR PAR DÉFAUT. Un champ qu'on ne sait pas calculer reste `null`, et le
 * moteur d'avis le signale à l'athlète (« il manque ton volume hebdomadaire »). Mettre
 * 40 km/semaine « en attendant » produirait un conseil qui a l'air personnel et ne l'est
 * pas — exactement le défaut qui a fait retirer l'amorce `ctl = 40` du tableau de bord.
 */
import { robustWeeklyKm, type RunLike } from "@/lib/running/volume";
import type { ProfilAthlete } from "./pourToi";

type Seance = RunLike & { sport?: string | null; type?: string | null; elevation_gain_m?: number | null };
type Paire = { brand?: string | null; model?: string | null; current_km?: number | null; max_km?: number | null; drop_mm?: number | null; terrain?: string | null };

const estCourse = (s: Seance) => !s.sport || s.sport === "run" || s.sport === "trail_run";

/**
 * Part des sorties faites en trail.
 *
 * ⚠️ LE SPORT SEUL NE SUFFIT PAS : beaucoup de montres enregistrent un trail en « run ».
 * On retient donc aussi le dénivelé — au-delà de 25 m par kilomètre, on n'est plus sur du
 * plat, quel que soit le libellé de la montre. Sans dénivelé ET sans libellé, la sortie
 * n'est comptée dans aucun des deux camps : elle sort du calcul au lieu de le biaiser.
 */
export function partTrail(seances: Seance[]): number | null {
  let trail = 0, route = 0;
  for (const s of seances) {
    if (!estCourse(s)) continue;
    const km = Number(s.distance_km) || 0;
    const d = s.elevation_gain_m == null ? null : Number(s.elevation_gain_m);
    if (s.sport === "trail_run") { trail++; continue; }
    if (d == null || km <= 0) continue;
    if (d / km >= 25) trail++; else route++;
  }
  const total = trail + route;
  return total >= 5 ? trail / total : null;
}

export function sortieLongueKm(seances: Seance[], jours = 56): number | null {
  const limite = Date.now() - jours * 86400000;
  const km = seances
    .filter((s) => estCourse(s) && new Date(String(s.date)).getTime() >= limite)
    .map((s) => Number(s.distance_km) || 0);
  const max = km.length ? Math.max(...km) : 0;
  return max > 0 ? Math.round(max * 10) / 10 : null;
}

/** Nombre de semaines avant la course, arrondi à l'entier inférieur. Négatif = passée. */
export function semainesAvant(dateCourse: unknown, aujourdhui = new Date()): number | null {
  const d = String(dateCourse ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const j = (new Date(`${d}T12:00:00Z`).getTime() - aujourdhui.getTime()) / 86400000;
  return j < 0 ? null : Math.floor(j / 7);
}

export function construireProfil(i: {
  seances: Seance[];
  paires: Paire[];
  objectif?: { distanceKm?: number | null; raceDate?: string | null } | null;
  vma?: number | null;
  maintenant?: Date;
}): ProfilAthlete {
  const now = i.maintenant ?? new Date();
  const courses = i.seances.filter(estCourse);
  const volume = robustWeeklyKm(courses, now.getTime());
  const drops = i.paires.map((p) => Number(p.drop_mm)).filter((d) => Number.isFinite(d) && d >= 0 && d <= 14);
  return {
    volumeHebdoKm: volume?.km ?? null,
    sortieLongueKm: sortieLongueKm(courses),
    partTrail: partTrail(courses),
    vma: i.vma ?? null,
    objectifKm: i.objectif?.distanceKm != null && Number(i.objectif.distanceKm) > 0 ? Number(i.objectif.distanceKm) : null,
    semainesAvantCourse: semainesAvant(i.objectif?.raceDate, now),
    dropsEnRotation: drops,
    rotation: i.paires
      .filter((p) => Number(p.current_km) >= 0 && Number(p.max_km) > 0)
      .map((p) => ({ marque: String(p.brand ?? ""), modele: String(p.model ?? ""), km: Number(p.current_km) || 0, maxKm: Number(p.max_km) || 0 })),
  };
}
