// ─────────────────────────────────────────────────────────────────────────────
//  Modèle de forme : VMA, VO2max (multi-sources, façon Garmin) et prédictions de
//  chrono par distance. Calculs purs, réutilisables (profil, onboarding, IA).
//  Repères % VMA soutenable par distance (empirique, proche de Daniels/Riegel).
// ─────────────────────────────────────────────────────────────────────────────

export const RACE_DISTANCES: { label: string; km: number }[] = [
  { label: "5 km", km: 5 }, { label: "10 km", km: 10 }, { label: "Semi", km: 21.0975 }, { label: "Marathon", km: 42.195 },
];

// Fraction de VMA tenable selon la distance.
export function pctVmaForDistance(km: number): number {
  if (km <= 0.4) return 1.18;
  if (km <= 0.8) return 1.12;
  if (km <= 1.5) return 1.06;
  if (km <= 3.2) return 1.0;
  if (km <= 5.5) return 0.94;
  if (km <= 11) return 0.90;
  if (km <= 22) return 0.85;
  if (km <= 30) return 0.82;
  if (km <= 43) return 0.79;
  return 0.74;
}

// VMA depuis un test de 6 min (demi-Cooper) : distance(m) parcourue / 100.
export const vmaFrom6min = (meters: number): number | null =>
  meters > 0 ? Math.round((meters / 100) * 10) / 10 : null;

// VMA estimée depuis une performance (course ou séance dure) : vitesse / %VMA.
export function vmaFromEffort(distanceKm: number, durationSec: number): number | null {
  if (!(distanceKm > 0) || !(durationSec > 0)) return null;
  const speed = distanceKm / (durationSec / 3600); // km/h
  if (speed < 5 || speed > 30) return null; // garde-fou (données aberrantes)
  return Math.round((speed / pctVmaForDistance(distanceKm)) * 10) / 10;
}

// VO2max (ml/kg/min) à partir de plusieurs sources, comme Garmin combine les données.
//  • VMA × 3.5 (Léger)  • 15.3 × FCmax/FCrepos (Uth-Sørensen)
export function vo2maxEstimate(opts: { vma?: number | null; maxHr?: number | null; restHr?: number | null }): { value: number; sources: string[] } | null {
  const ests: { v: number; src: string }[] = [];
  if (opts.vma && opts.vma > 0) ests.push({ v: opts.vma * 3.5, src: "VMA" });
  if (opts.maxHr && opts.restHr && opts.restHr > 0 && opts.maxHr > opts.restHr) ests.push({ v: 15.3 * (opts.maxHr / opts.restHr), src: "FC max/repos" });
  if (!ests.length) return null;
  return { value: Math.round(ests.reduce((a, b) => a + b.v, 0) / ests.length), sources: ests.map(e => e.src) };
}

export const vo2maxLabel = (v: number): string =>
  v >= 65 ? "🏆 Élite" : v >= 56 ? "✅ Excellent" : v >= 46 ? "👍 Bon" : v >= 36 ? "📈 Moyen" : "🌱 En progression";

// Temps prédit (secondes) sur une distance, depuis la VMA.
export function predictRaceSec(vma: number, distanceKm: number): number {
  const speed = vma * pctVmaForDistance(distanceKm); // km/h
  return (distanceKm / speed) * 3600;
}

export const fmtTime = (sec: number): string => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};
export const fmtPaceSec = (secPerKm: number): string =>
  `${Math.floor(secPerKm / 60)}'${String(Math.round(secPerKm % 60)).padStart(2, "0")}`;

// Prédictions complètes par distance depuis la VMA.
export function racePredictions(vma: number): { label: string; km: number; time: string; pace: string }[] {
  return RACE_DISTANCES.map(d => {
    const sec = predictRaceSec(vma, d.km);
    return { label: d.label, km: d.km, time: fmtTime(sec), pace: fmtPaceSec(sec / d.km) + "/km" };
  });
}

// ── Projection vers l'objectif : chrono atteignable maintenant + projeté le jour J ──
export type RaceProjection = {
  nowSec: number; projectedSec: number; gapSec: number | null;
  verdict: "acquis" | "atteignable" | "ambitieux" | "irrealiste";
};
export function raceProjection(currentVma: number, distanceKm: number, targetSec: number | null, weeksToRace: number | null): RaceProjection {
  const nowSec = predictRaceSec(currentVma, distanceKm);
  // Amélioration réaliste sur le bloc : ~0,4 %/sem de gain d'allure, plafonné à 8 %.
  const improv = weeksToRace != null ? Math.min(0.08, Math.max(0, weeksToRace) * 0.004) : 0;
  const projectedSec = Math.round(nowSec * (1 - improv));
  let verdict: RaceProjection["verdict"] = "atteignable";
  let gapSec: number | null = null;
  if (targetSec != null && targetSec > 0) {
    gapSec = projectedSec - targetSec;
    verdict = targetSec >= nowSec ? "acquis"
      : targetSec >= projectedSec ? "atteignable"
      : targetSec >= projectedSec * 0.97 ? "ambitieux"
      : "irrealiste";
  }
  return { nowSec, projectedSec, gapSec, verdict };
}

// ── Risque de charge (anti-blessure proactif / déload auto) ──
const TSS_BY_TYPE: Record<string, number> = { easy: 50, tempo: 75, interval: 90, vma: 100, long_run: 65, trail: 70, hill_repeat: 85, race: 110, recovery: 30, strength: 40 };
export function estimateTSS(w: { duration_seconds?: number | null; type?: string | null; tss?: number | null }): number {
  if (w.tss != null) return Number(w.tss);
  return Math.round(((w.duration_seconds ?? 0) / 3600) * (TSS_BY_TYPE[String(w.type ?? "")] ?? 60));
}
export type LoadRisk = { acwr: number; monotony: number; deload: boolean; level: "ok" | "vigilance" | "deload"; reason: string };
export function loadRisk(workouts: { date: string; type?: string | null; duration_seconds?: number | null; tss?: number | null }[]): LoadRisk {
  const now = Date.now();
  const within = (d: number) => workouts.filter(w => now - new Date(w.date).getTime() <= d * 86400000);
  const tss7 = within(7).reduce((s, w) => s + estimateTSS(w), 0);
  const tss28 = within(28).reduce((s, w) => s + estimateTSS(w), 0);
  const acwr = tss28 > 0 ? Math.round((tss7 / (tss28 / 4)) * 100) / 100 : 0;
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    return workouts.filter(w => String(w.date).slice(0, 10) === d).reduce((s, w) => s + estimateTSS(w), 0);
  });
  const mean = daily.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(daily.reduce((a, b) => a + (b - mean) ** 2, 0) / 7) || 1;
  const monotony = mean > 0 ? Math.round((mean / sd) * 10) / 10 : 0;
  const deload = acwr > 1.5 || monotony > 2.2;
  const level: LoadRisk["level"] = deload ? "deload" : (acwr > 1.3 || monotony > 1.8 ? "vigilance" : "ok");
  const reason = acwr > 1.5 ? `charge aiguë +${Math.round((acwr - 1) * 100)} % vs ta moyenne (risque blessure)`
    : monotony > 2.2 ? "entraînement trop monotone (varie l'intensité, ajoute un vrai repos)"
    : acwr > 1.3 ? "charge en hausse — surveille la récupération" : "";
  return { acwr, monotony, deload, level, reason };
}

// Meilleure VMA estimée depuis l'historique : UNIQUEMENT des efforts réellement
// soutenus (FC élevée), sinon on surestime (un footing rapide n'est pas un max).
export function bestVmaFromWorkouts(
  workouts: { distance_km?: number | null; duration_seconds?: number | null; type?: string | null; avg_hr?: number | null }[],
  maxHr?: number | null,
): number | null {
  let best: number | null = null;
  for (const w of workouts) {
    if (!w.distance_km || w.distance_km < 2 || !w.duration_seconds) continue;
    if (/strength|renfo|muscu/i.test(String(w.type ?? ""))) continue;
    // Effort vraiment maximal exigé : si on a la FC, il faut ≥ 85 % de la FC max.
    if (maxHr && maxHr > 120 && w.avg_hr != null && w.avg_hr < maxHr * 0.85) continue;
    const v = vmaFromEffort(w.distance_km, w.duration_seconds);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best;
}
