import { jourLocal, ecartJours } from "@/lib/streak/compute";
// ─────────────────────────────────────────────────────────────────────────────
//  Modèle de forme : VMA, VO2max (multi-sources, façon Garmin) et prédictions de
//  chrono par distance. Calculs purs, réutilisables (profil, onboarding, IA).
//  Repères % VMA soutenable par distance (empirique, proche de Daniels/Riegel).
// ─────────────────────────────────────────────────────────────────────────────
import { heatAdvice } from "@/lib/weather/openMeteo";

export const RACE_DISTANCES: { label: string; km: number }[] = [
  { label: "5 km", km: 5 }, { label: "10 km", km: 10 }, { label: "Semi", km: 21.0975 }, { label: "Marathon", km: 42.195 },
];

// Fraction de VMA tenable selon la distance.
function pctVmaBrut(km: number): number {
  if (km <= 0.4) return 1.18;
  if (km <= 0.8) return 1.12;
  if (km <= 1.5) return 1.06;
  if (km <= 3.2) return 1.0;
  if (km <= 5.5) return 0.94;
  if (km <= 11) return 0.90;
  // ── LONGUES DISTANCES : coefficients ramenés dans la moyenne ────────────────
  // Ils étaient en HAUT de la fourchette de la littérature (semi 83-88 %, marathon
  // 75-80 % de la vitesse à VO2max chez un amateur entraîné) : 85 % et 79 % décrivaient
  // un marathonien à gros volume, pas le coureur moyen. Confronté au prédicteur Garmin
  // (Firstbeat, largement validé) sur un compte réel, l'écart était de +2,4 min sur semi
  // et +10,5 min sur marathon — toujours dans le sens optimiste, le plus coûteux pour
  // quelqu'un qui cale son allure de course dessus.
  //
  // ⚠️ CE QUI RESTE FAUX, ET QU'IL FAUDRA CORRIGER. Ce pourcentage n'est pas une
  // constante physiologique : il dépend du SOCLE D'ENDURANCE. Un coureur à 150 km/sem
  // tient 80 % sur marathon, un coureur à 80 km/sem avec 21 km de plus longue sortie n'y
  // arrive pas. Une valeur fixe est un compromis, pas une vérité — la vraie correction
  // est de la faire dépendre du volume et de la sortie longue réels.
  if (km <= 22) return 0.83;
  if (km <= 30) return 0.79;
  if (km <= 43) return 0.75;
  return 0.74;
}

/**
 * SOCLE D'ENDURANCE — ce qui manquait vraiment au modèle de pronostic.
 *
 * `pctVmaForDistance` traite le pourcentage tenable comme une constante physiologique.
 * Il n'en est pas une : sur marathon, un coureur à 150 km/semaine avec des sorties de
 * 32 km tient nettement plus que le même cardio à 80 km/semaine dont la plus longue
 * sortie fait 21 km. C'est exactement ce que modélise le prédicteur de Garmin, et
 * c'est pourquoi nos pronostics longue distance s'en écartaient toujours dans le même
 * sens — l'optimiste, le plus coûteux pour qui cale son allure de course dessus.
 *
 * DEUX ANCRES, PAS UN AJUSTEMENT LIBRE :
 *   · 32 km de sortie longue = référence classique de préparation marathon aboutie ;
 *   · 21 km (un semi) = plancher en dessous duquel on ne prépare pas un marathon.
 * Entre les deux, on interpole. Au-delà, on plafonne : une sortie de 40 km ne rend pas
 * le marathon plus facile que ce que la physiologie permet.
 *
 * N'intervient QUE au-delà du semi : en deçà, c'est la VMA qui décide, et nos
 * coefficients courte distance tombent déjà à 8 et 20 s des pronostics Garmin.
 */
export const LONG_RUN_PRET_KM = 32;
export const LONG_RUN_PLANCHER_KM = 21;

export function pctVmaForDistance(km: number, longRunKm?: number | null): number {
  const base = pctVmaBrut(km);
  // Sans sortie longue connue, on ne suppose RIEN : on garde la valeur de référence.
  if (km <= 22 || longRunKm == null || !(longRunKm > 0)) return base;
  const pret = Math.min(1, Math.max(0, (longRunKm - LONG_RUN_PLANCHER_KM) / (LONG_RUN_PRET_KM - LONG_RUN_PLANCHER_KM)));
  // Un athlète prêt retrouve le coefficient d'avant (marathon 79 %) ; un athlète au
  // plancher reste sur la valeur mesurée contre Garmin (75 %).
  const bonus = km > 30 ? 0.04 : 0.02;
  return Math.round((base + bonus * pret) * 1000) / 1000;
}

// VMA depuis un test de 6 min (demi-Cooper) : distance(m) parcourue / 100.
export const vmaFrom6min = (meters: number): number | null =>
  meters > 0 ? Math.round((meters / 100) * 10) / 10 : null;

/**
 * PART DE LA PÉNALITÉ DE CHALEUR RETENUE POUR RELIRE UNE PERFORMANCE.
 *
 * Pas une constante inventée : c'est EXACTEMENT la fraction que `autoPlan` applique déjà
 * pour corriger les allures de qualité par temps chaud (`heatAdjustDesc` divise par 2),
 * avec sa justification — la chaleur pénalise surtout les efforts longs et continus,
 * beaucoup moins un effort dur et court, où l'athlète compense en partie.
 *
 * Vérifié sur le compte de production : la pénalité PLEINE donne 21,2 km/h depuis un
 * 10 km à 29,6 °C, ce qu'aucune autre source ne corrobore. La moitié donne 19,9 —
 * exactement ce que valent les efforts du même athlète par 13 °C (19,7-19,8).
 */
export const PART_PENALITE_CHALEUR = 0.5;

/**
 * Durée qu'aurait valu cet effort EN CONDITIONS NEUTRES.
 *
 * DÉFAUT RÉEL CORRIGÉ. L'application corrigeait les allures qu'elle PRESCRIT pour la
 * chaleur, mais jamais celles qu'elle LIT. Un 10 km couru à 31 °C était donc interprété
 * comme s'il avait eu lieu à 13 °C : la VMA estimée s'effondrait chaque été, et avec
 * elle toutes les allures de l'athlète — au moment précis où il avait le plus besoin
 * qu'on ne le sous-estime pas. Constaté : 16,1 km/h lus sur une sortie à 31,8 °C contre
 * 19,7 sur la même distance à 13,5 °C, chez le même coureur à trois mois d'écart.
 *
 * `acclimFactor` ≤ 1 : un athlète acclimaté souffre moins, donc on corrige moins.
 * Sans température connue, on ne corrige RIEN — on ne devine pas la météo d'un jour.
 */
export function dureeEnConditionsNeutres(
  durationSec: number, distanceKm: number, tempC: number | null | undefined, acclimFactor = 1,
): number {
  if (tempC == null || !(distanceKm > 0) || !(durationSec > 0)) return durationSec;
  const penalite = heatAdvice(tempC, null).penaltySecPerKm * acclimFactor * PART_PENALITE_CHALEUR;
  if (!(penalite > 0)) return durationSec;
  const secParKm = durationSec / distanceKm;
  // Garde-fou : une correction ne peut pas rendre un effort plus de deux fois plus rapide.
  return Math.max(durationSec / 2, (secParKm - penalite) * distanceKm);
}

// VMA estimée depuis une performance (course ou séance dure) : vitesse / %VMA.
export function vmaFromEffort(distanceKm: number, durationSec: number): number | null {
  if (!(distanceKm > 0) || !(durationSec > 0)) return null;
  const speed = distanceKm / (durationSec / 3600); // km/h
  if (speed < 5 || speed > 30) return null; // garde-fou (données aberrantes)
  return Math.round((speed / pctVmaForDistance(distanceKm)) * 10) / 10;
}

/**
 * ALLURE D'ENDURANCE MESURÉE — celle que l'athlète tient RÉELLEMENT en zone 2.
 *
 * DÉFAUT RÉEL, ET IL SE MORDAIT LA QUEUE. L'allure de footing était déduite d'un
 * pourcentage de VMA (70 %). Or une allure facile ne se définit pas par un pourcentage
 * de vitesse : elle se définit par la FRÉQUENCE CARDIAQUE. Le rapport entre les deux
 * dépend de l'économie de course, du terrain, de la fraîcheur — il varie d'un coureur
 * à l'autre bien plus que le modèle ne le suppose.
 *
 * Mesuré sur le compte de production, 99 séances en zone 2 (146-163 bpm, Karvonen) :
 * allure réelle 4'59/km. Le modèle en prescrivait 4'26 — soit 33 s/km trop vite, ce qui
 * situe le « footing » en zone 3. L'application reprochait donc à l'athlète de courir
 * ses footings trop vite (« 31 % du temps en Z3+ ») TOUT EN LUI PRESCRIVANT une allure
 * qui l'y envoyait. Elle causait le défaut qu'elle signalait.
 *
 * On lit l'allure DANS SES CONDITIONS (correction de chaleur) et on renvoie une valeur
 * NEUTRE : le plan ré-applique ensuite la pénalité météo du jour prescrit. Sans cela,
 * la chaleur serait comptée deux fois.
 *
 * `null` si l'historique ne permet pas de conclure — l'appelant retombe alors sur le
 * pourcentage de VMA, et doit le dire.
 */
export const MIN_SEANCES_ALLURE_Z2 = 5;

export function easyPaceFromHeartRate(
  runs: { distance_km?: number | null; duration_seconds?: number | null; avg_hr?: number | null; weather_temp_c?: number | null }[],
  maxHr: number | null | undefined,
  restHr: number | null | undefined,
  acclimFactor = 1,
): number | null {
  if (!(maxHr && maxHr > 120) || !(restHr && restHr > 20) || maxHr <= restHr) return null;
  // Zone 2 « facile » au sens de l'application elle-même : réserve cardiaque 60-70 %
  // (Karvonen), la définition déjà utilisée pour afficher les zones à l'athlète.
  const bas = restHr + (maxHr - restHr) * 0.6;
  const haut = restHr + (maxHr - restHr) * 0.7;
  const allures: number[] = [];
  for (const w of runs) {
    // 4 km minimum : sur plus court, l'échauffement pèse trop dans la moyenne.
    if (!w.distance_km || w.distance_km < 4 || !w.duration_seconds || w.avg_hr == null) continue;
    if (w.avg_hr < bas || w.avg_hr >= haut) continue;
    const sec = dureeEnConditionsNeutres(w.duration_seconds, w.distance_km, w.weather_temp_c, acclimFactor);
    allures.push(sec / w.distance_km);
  }
  if (allures.length < MIN_SEANCES_ALLURE_Z2) return null;
  // MÉDIANE et pas moyenne : une seule sortie en montagne ou un GPS qui déraille
  // déplacerait la moyenne, jamais la médiane.
  allures.sort((a, b) => a - b);
  return Math.round(allures[Math.floor(allures.length / 2)]);
}

// VO2max (ml/kg/min) à partir de plusieurs sources, comme Garmin combine les données.
//  • VMA × 3.5 (Léger)  • 15.3 × FCmax/FCrepos (Uth-Sørensen)
// VMA (km/h) déduite d'une VO2max (formule de Léger : VO2max ≈ 3,5 × VMA).
export const vmaFromVo2max = (vo2max: number): number => Math.round((vo2max / 3.5) * 10) / 10;

export function vo2maxEstimate(opts: { vma?: number | null; maxHr?: number | null; restHr?: number | null; garmin?: number | null }): { value: number; sources: string[] } | null {
  // Mesure Garmin (montre) = source de vérité → on la prend telle quelle, sans moyenner avec l'estimation.
  if (opts.garmin && opts.garmin > 0) return { value: Math.round(opts.garmin), sources: ["Garmin"] };
  const ests: { v: number; src: string }[] = [];
  if (opts.vma && opts.vma > 0) ests.push({ v: opts.vma * 3.5, src: "VMA" });
  if (opts.maxHr && opts.restHr && opts.restHr > 0 && opts.maxHr > opts.restHr) ests.push({ v: 15.3 * (opts.maxHr / opts.restHr), src: "FC max/repos" });
  if (!ests.length) return null;
  return { value: Math.round(ests.reduce((a, b) => a + b.v, 0) / ests.length), sources: ests.map(e => e.src) };
}

export const vo2maxLabel = (v: number): string =>
  v >= 65 ? "🏆 Élite" : v >= 56 ? "✅ Excellent" : v >= 46 ? "👍 Bon" : v >= 36 ? "📈 Moyen" : "🌱 En progression";

// Temps prédit (secondes) sur une distance, depuis la VMA.
export function predictRaceSec(vma: number, distanceKm: number, longRunKm?: number | null): number {
  const speed = vma * pctVmaForDistance(distanceKm, longRunKm); // km/h
  return (distanceKm / speed) * 3600;
}

export const fmtTime = (sec: number): string => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};
export const fmtPaceSec = (secPerKm: number): string =>
  `${Math.floor(secPerKm / 60)}'${String(Math.round(secPerKm % 60)).padStart(2, "0")}`;

// Prédictions complètes par distance depuis la VMA.
export function racePredictions(vma: number, longRunKm?: number | null): { label: string; km: number; time: string; pace: string }[] {
  return RACE_DISTANCES.map(d => {
    const sec = predictRaceSec(vma, d.km, longRunKm);
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
  // ⚠️ JOURS DE CALENDRIER, comme partout ailleurs sur le tableau de bord. Les fenêtres
  //    étaient ancrées sur l'heure exacte de l'appel et le découpage quotidien se faisait
  //    en UTC : le ratio bougeait selon le moment de la consultation, et la journée
  //    d'entraînement d'un athlète parisien basculait à 02 h du matin. Le 0,58 affiché
  //    était juste, mais il n'était pas STABLE — et il est lu à côté d'un volume et d'une
  //    charge qui, eux, comptent en cases de calendrier.
  const aujourdhui = jourLocal();
  const ageDe = (w: { date: string }) => {
    const j = String(w.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(j)) return null;
    const n = ecartJours(j, aujourdhui);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const within = (d: number) => workouts.filter(w => { const a = ageDe(w); return a != null && a < d; });
  const tss7 = within(7).reduce((s, w) => s + estimateTSS(w), 0);
  const tss28 = within(28).reduce((s, w) => s + estimateTSS(w), 0);
  const acwr = tss28 > 0 ? Math.round((tss7 / (tss28 / 4)) * 100) / 100 : 0;
  const daily = Array.from({ length: 7 }, (_, i) =>
    workouts.filter(w => ageDe(w) === i).reduce((s, w) => s + estimateTSS(w), 0));
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
/**
 * VMA déduite des MEILLEURS EFFORTS mesurés (courbe d'allure intervals.icu, 42 j).
 *
 * De loin la source la plus fiable, et pour une raison simple : une moyenne d'activité
 * divise la distance totale par la durée totale, échauffement et retour au calme
 * compris — elle sous-estime l'effort réel. La courbe d'allure, elle, retient le
 * meilleur segment continu à chaque distance.
 *
 * On prend le MAXIMUM des VMA implicites : chaque effort n'est un révélateur que s'il
 * a été maximal, et un effort non maximal ne peut que sous-estimer. Le plus favorable
 * est donc le plus proche de la vérité.
 */
export function vmaFromPaceCurve(best: { m: number; sec: number }[] | null | undefined): number | null {
  if (!best?.length) return null;
  let top: number | null = null;
  for (const b of best) {
    if (!(b.m > 0) || !(b.sec > 0)) continue;
    const v = vmaFromEffort(b.m / 1000, b.sec);
    if (v != null && (top == null || v > top)) top = v;
  }
  return top;
}

/**
 * LA VMA EFFECTIVE — un seul calcul, pour toute l'application.
 *
 * DÉFAUT RÉEL CORRIGÉ. Quatre chaînes distinctes calculaient la VMA : le coach, le
 * tableau de bord, le profil et `getEffectiveVma`. Elles ne consultaient ni les mêmes
 * sources ni dans le même ordre — le tableau de bord ignorait purement et simplement la
 * courbe d'allure. Relevé sur le compte de production : coach 17,3 km/h, tableau de bord
 * 18,7 km/h, profil 17,3, pour le même athlète au même instant. Chaque commentaire de
 * chaque chaîne affirmait pourtant « garantit le MÊME chiffre côté coach et côté client ».
 *
 * CE QUI A CHANGÉ EN PLUS : LA COURBE ET LA VO2max SE CROISENT.
 * La courbe d'allure ne connaît que ce que l'athlète A COURU. Sans effort maximal récent,
 * son meilleur 5 000 m est une sortie d'entraînement, et la VMA qu'on en déduit est
 * plancher, pas plafond. Constaté : courbe → 17,3 km/h alors que la VO2max mesurée par la
 * montre (63) en donne 18,0 et que le meilleur 10 000 m de la courbe (41'08) est très
 * au-dessous de ce qu'une VO2max de 63 permet. La VO2max n'était jamais consultée : elle
 * était en dernier recours, derrière une courbe qui répond toujours.
 *
 * On retient donc la PLUS HAUTE des deux. Ce n'est pas de l'optimisme : les deux sources
 * ne peuvent que SOUS-estimer (un effort non maximal ne révèle pas le maximum), donc la
 * plus favorable est la plus proche de la vérité. Le même raisonnement que
 * `vmaFromPaceCurve` applique déjà entre ses propres points.
 *
 * Un test enregistré garde la priorité absolue : c'est la seule valeur MESURÉE.
 */
export type VmaSource = "test" | "courbe" | "vo2max" | "séances" | null;

export function effectiveVma(i: {
  /** `performance_baselines.vma_kmh` — un vrai test, s'il existe. */
  vmaStored?: number | null;
  /** `profiles.pace_curve.best` — meilleurs efforts continus. */
  paceCurveBest?: { m: number; sec: number }[] | null;
  /** VO2max mesurée par la montre (`profiles.garmin_vo2max`). */
  garminVo2?: number | null;
  /** Repli quand ni courbe ni VO2max : les efforts soutenus de l'historique. */
  fromRuns?: number | null;
}): { vma: number | null; source: VmaSource } {
  if (i.vmaStored != null && i.vmaStored > 0) return { vma: i.vmaStored, source: "test" };
  const curve = vmaFromPaceCurve(i.paceCurveBest);
  const vo2 = i.garminVo2 != null && i.garminVo2 > 0 ? vmaFromVo2max(i.garminVo2) : null;
  const runs = i.fromRuns != null && i.fromRuns > 0 ? i.fromRuns : null;
  // LES TROIS SOURCES SE COMPARENT, la plus haute gagne — et on NOMME celle qui a gagné,
  // pour que l'athlète puisse vérifier d'où sort son chiffre au lieu de le subir.
  //
  // Les efforts réels ne sont plus un simple REPLI : depuis qu'ils sont relus dans leurs
  // conditions (chaleur), ils redeviennent la mesure la plus directe qu'on ait. Les
  // reléguer derrière une courbe d'allure polluée par un été à 31 °C revenait à jeter
  // la meilleure donnée disponible.
  const candidats: { v: number; s: VmaSource }[] = [
    ...(curve != null ? [{ v: curve, s: "courbe" as const }] : []),
    ...(vo2 != null ? [{ v: vo2, s: "vo2max" as const }] : []),
    ...(runs != null ? [{ v: runs, s: "séances" as const }] : []),
  ];
  if (!candidats.length) return { vma: null, source: null };
  const gagnant = candidats.reduce((a, b) => (b.v > a.v ? b : a));
  return { vma: gagnant.v, source: gagnant.s };
}

export function bestVmaFromWorkouts(
  workouts: { date?: string; distance_km?: number | null; duration_seconds?: number | null; type?: string | null; avg_hr?: number | null;
    /** Température du jour de la séance. Sans elle, aucune correction n'est appliquée. */
    weather_temp_c?: number | null }[],
  maxHr?: number | null,
  /**
   * Fenêtre de FORME (jours). Sans elle, un record vieux de cinq mois sert encore de
   * base aux allures prescrites. Constaté en production : une VMA de 19,8 km/h issue
   * d'un 10 km de mars pilotait encore les séances d'août, produisant des fractionnés
   * plus rapides que le record de l'athlète sur la distance. On prescrit sur la forme
   * du moment, pas sur le souvenir du pic.
   */
  windowDays = 120,
  /** Acclimatation à la chaleur (≤ 1) : un athlète acclimaté souffre moins, on corrige moins. */
  heatFactor = 1,
): number | null {
  let best: number | null = null;
  const now = Date.now();
  for (const w of workouts) {
    if (w.date && (now - new Date(w.date).getTime()) > windowDays * 86400000) continue;
    if (!w.distance_km || w.distance_km < 2 || !w.duration_seconds) continue;
    if (/strength|renfo|muscu/i.test(String(w.type ?? ""))) continue;
    // Effort vraiment maximal exigé : si on a la FC, il faut ≥ 85 % de la FC max.
    if (maxHr && maxHr > 120 && w.avg_hr != null && w.avg_hr < maxHr * 0.85) continue;
    // L'effort est relu DANS SES CONDITIONS : un 10 km à 31 °C ne vaut pas le même
    // chrono qu'à 13 °C, et le lire brut faisait s'effondrer la VMA chaque été.
    const sec = dureeEnConditionsNeutres(w.duration_seconds, w.distance_km, w.weather_temp_c, heatFactor);
    const v = vmaFromEffort(w.distance_km, sec);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best;
}
