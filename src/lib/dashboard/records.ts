/**
 * RECORDS PAR DISTANCE — meilleur temps réel sur 5 km / 10 km / semi / marathon.
 *
 * Sorti du composant pour être crash-testable : la carte affichait 25:48 au 5 km quand
 * le vrai record est 16:07, parce qu'elle ne voyait que les 40 dernières activités.
 */
import { fmtTime } from "@/lib/running/fitness";

export type SeanceRecord = {
  date: string;
  distance_km: number | null;
  duration_seconds: number | null;
};

// Records par distance — meilleur temps réel sur 5/10/semi/marathon (depuis les activités).
export function computeDistancePRs(
  workouts: SeanceRecord[],
  lang: string,
): { label: string; time: string; date: string }[] {
  const targets = [
    { l: "5 km", lo: 4.7, hi: 5.4 },
    { l: "10 km", lo: 9.4, hi: 10.6 },
    { l: "Semi", lo: 20, hi: 22 },
    { l: "Marathon", lo: 40.5, hi: 43.5 },
  ];
  const out: { label: string; time: string; date: string }[] = [];
  for (const tgt of targets) {
    const cands = workouts.filter((w) => (w.distance_km ?? 0) >= tgt.lo && (w.distance_km ?? 0) <= tgt.hi && (w.duration_seconds ?? 0) > 0);
    if (!cands.length) continue;
    const best = cands.reduce((a, b) => ((a.duration_seconds ?? 1e9) <= (b.duration_seconds ?? 1e9) ? a : b));
    out.push({
      label: tgt.l,
      time: fmtTime(best.duration_seconds as number),
      date: new Date(best.date).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" }),
    });
  }
  return out;
}
