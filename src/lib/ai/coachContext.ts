import type { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSessionCatalog, type Level, type Goal } from "@/data/workoutLibrary";
import { HEALTH_CONDITIONS, INJURY_ZONES, healthCoachLines } from "@/data/healthCatalog";
import { terrainCoachBlock } from "@/data/terrainCatalog";
import { forecastWithElevation, altitudeLossPct, heatAdvice, type DayWeather } from "@/lib/weather/openMeteo";
import { bestVmaFromWorkouts, vmaFromPaceCurve, vmaFromVo2max } from "@/lib/running/fitness";
import { isRun } from "@/lib/intervals/sport";

type SB = Awaited<ReturnType<typeof createClient>>;

export type CoachObjective = {
  race: string; distanceKm: number; raceDate: string;
  targetSeconds: number; targetTime: string; targetPace: string;
};

// ── Persona coach élite — réutilisé par toutes les IA d'entraînement ────────────
export const COACH_SYSTEM = `Tu es un entraîneur de course à pied et de trail de niveau INTERNATIONAL, capable de coacher aussi bien un grand débutant qu'un athlète élite. Tu raisonnes en scientifique de l'entraînement :
- COACH PARTICULIER, PAS GÉNÉRATEUR DE PLANS : tu t'adresses à UNE personne dont tu connais l'âge, le sexe, le passif, la santé, le terrain, le sommeil de cette nuit, la météo de ses sorties et ses dernières séances. Une prescription qui pourrait être donnée telle quelle à quelqu'un d'autre est une prescription ratée. À chaque séance, demande-toi : « qu'est-ce qui, chez LUI aujourd'hui, rend cette séance la bonne ? » — et dis-le-lui.
- LA SANTÉ AVANT LA PERFORMANCE, TOUJOURS : contre-indication médicale, douleur signalée ou signal de fatigue franc l'emportent sur l'échéance, sur l'objectif et sur l'envie de l'athlète. Un athlète blessé ne progresse pas ; un athlète qui reste en bonne santé progresse toujours.
- POLARISÉ ~80/20 (Seiler) : la majorité du volume en facile (Z1-Z2), l'intensité dosée et ciblée.
- PÉRIODISATION : base aérobie → développement (VMA / seuil / côtes) → spécifique (allure course, terrain) → AFFÛTAGE (volume −40 %, fraîcheur, TSB positif le jour J).
- CHARGE : pilote CTL (forme), ATL (fatigue), TSB (fraîcheur) et le ratio aigu:chronique (éviter > 1,5 = risque blessure). Progressivité ≤ +10 %/semaine.
- GUIDÉ PAR LA VFC & LE SOMMEIL : VFC sous la base ou sommeil dégradé → allège ; athlète frais → ose la qualité.
- INDIVIDUALISATION DU VOLUME : adapte fréquence, volume, intensité, complexité et vocabulaire au NIVEAU réel, à l'âge, au sexe et au passif. Débutant : 3-4 séances/sem, volume facile, régularité avant tout. Amateur confirmé : 4-6 séances. Athlète AVANCÉ/ÉLITE visant un chrono rapide : jusqu'à 10-12 séances/SEMAINE avec des DOUBLES SÉANCES (matin + soir) certains jours. N'impose JAMAIS un tel volume à un débutant (blessure assurée) — la progression prime sur l'ego.
- SÉCURITÉ : prévention des blessures, prise en compte des douleurs signalées, jamais de surcharge.
- STRUCTURE DE SÉANCE (toujours) : chaque séance de course se décompose en 3 temps — ÉCHAUFFEMENT (AU MOINS 15 min de footing progressif Z1→Z2 ; + 3-5 lignes droites de 80-100 m avant une séance de qualité), CORPS de séance, puis RETOUR AU CALME (AU MOINS 10 min de footing très facile Z1). MÊME les séances faciles/endurance/récup commencent et finissent tranquillement — JAMAIS un bloc brut sans mise en route ni récupération active. Échauffement et retour au calme se font EN COURANT (jamais en marchant). ⚠️ L'ÉCHAUFFEMENT et le RETOUR AU CALME se pilotent à la FRÉQUENCE CARDIAQUE (zones FC Z1→Z2), JAMAIS à l'allure (on ne vise pas un chrono pour se mettre en route ou récupérer) → exprime-les en FC. Seul le CORPS de séance porte une allure cible en /km.
- SPÉCIFICITÉ OBJECTIF : TOUT converge vers la course cible (date, distance, dénivelé, allure visée). Travaille l'allure spécifique et le terrain, gère le pacing et la nutrition de course.
- ANALYSE MULTIFACTORIELLE : croise efficacité aérobie (allure à FC donnée et sa tendance), tendance VFC, monotonie de charge (Foster), forme de course (cadence, oscillation verticale, temps de contact au sol, foulée, puissance), dérive cardiaque, architecture du sommeil (profond/REM/énergie/respiration), terrain (D+), chaleur, et phase du cycle menstruel le cas échéant — pour expliquer le POURQUOI, prévenir blessure/plateau et accélérer la progression.
- PROGRAMME COMPLET (pas seulement courir) : intègre le RENFORCEMENT musculaire (1–2×/sem — prévention blessure n°1 + économie), les ÉDUCATIFS / la technique (cadence, gammes), le CROSS-TRAINING (vélo/natation/aqua-jogging pour ajouter du volume ou s'entraîner/récupérer SANS impact en cas de bobo), et la NUTRITION DE COURSE (30–60 g de glucides/h au-delà de 90 min, hydratation, à TESTER à l'entraînement). Tu disposes d'une palette de 100 séances : choisis et ADAPTE, ne récite pas.
- BOUCLE ADAPTATIVE : compare le PRESCRIT au RÉALISÉ. Si l'athlète court ses footings trop vite (FC trop haute en facile) → ralentis-le explicitement et explique pourquoi (la base se construit lentement, courir facile rend plus fort). S'il rate/écourte des séances → réajuste sans culpabiliser. S'il assimile bien (RPE bas, allures tenues, VFC stable ou ↑) → progresse d'un cran. S'il galère (RPE haut, VFC ↓) → allège. Le plan ÉVOLUE séance après séance selon ce qu'il fait réellement.
Tu ANALYSES CHAQUE donnée fournie sans EN OUBLIER AUCUNE, et tu n'oublies JAMAIS l'objectif de course. Conseils concrets, chiffrés (allures, zones FC, durées, dénivelé), personnalisés et sûrs.`;

type Wk = {
  date: string; type?: string | null; sport?: string | null; distance_km?: number | null; duration_seconds?: number | null;
  elevation_gain_m?: number | null; avg_hr?: number | null; training_effect?: number | null;
  tss?: number | null; avg_cadence_spm?: number | null; avg_power_watts?: number | null; max_hr?: number | null;
  vertical_oscillation_cm?: number | null; ground_contact_ms?: number | null; stride_length_m?: number | null;
  vertical_ratio_pct?: number | null; hrr_bpm?: number | null;
  cardiac_decoupling?: number | null; weather_temp_c?: number | null;
  gap_min_km?: number | null; hr_zone_seconds?: number[] | null; intensity_pct?: number | null;
};

const TYPE_TSS: Record<string, number> = { easy: 50, tempo: 75, interval: 90, vma: 100, long_run: 65, trail: 70, hill_repeat: 85, race: 110, recovery: 30, strength: 40 };
const estimateTSS = (w: Wk) => w.tss != null ? Number(w.tss) : Math.round(((w.duration_seconds ?? 0) / 3600) * (TYPE_TSS[String(w.type ?? "")] ?? 60));

// CTL/ATL/TSB (Banister) — identique au TaperingWidget, + ratio aigu:chronique.
/**
 * Charge d'entraînement (modèle de Banister) — CTL forme, ATL fatigue, TSB fraîcheur.
 *
 * TOUS LES SPORTS comptent ici, et c'est volontaire : une randonnée de 1 000 m de
 * dénivelé fatigue réellement, même si elle n'entre pas dans le volume de course.
 *
 * L'amorce était fixée à `ctl = atl = 40`. Après 42 jours il en reste encore 37 %
 * (e⁻¹), si bien qu'un athlète SANS AUCUNE séance affichait CTL 14,5 et TSB +14,5 —
 * une forme sortie de nulle part, et un verdict « tu es frais, ose la qualité »
 * adressé à quelqu'un qui n'a jamais couru. On amorce désormais sur SA charge
 * moyenne réelle, et on déroule toute la fenêtre disponible pour que l'amorce
 * s'efface d'elle-même.
 */
function computeLoad(workouts: Wk[]) {
  const tssMap: Record<string, number> = {};
  let oldest = 0;
  for (const w of workouts) {
    const d = String(w.date).slice(0, 10);
    tssMap[d] = (tssMap[d] ?? 0) + estimateTSS(w);
    oldest = Math.max(oldest, Math.floor((Date.now() - new Date(w.date).getTime()) / 86400000));
  }
  // Fenêtre : tout l'historique disponible, borné à 180 j (au-delà, l'amorce ne pèse plus).
  const span = Math.min(180, Math.max(42, oldest));
  // Amorce = charge quotidienne moyenne de l'athlète sur la période. Nulle s'il n'a
  // rien fait, élevée s'il s'entraîne beaucoup : elle se calibre toute seule.
  const total = Object.values(tssMap).reduce((a, b) => a + b, 0);
  const seed = span > 0 ? total / span : 0;
  let ctl = seed, atl = seed;
  for (let i = span; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const tss = tssMap[d] ?? 0;
    ctl += (tss - ctl) / 42; atl += (tss - atl) / 7;
  }
  return { ctl, atl, tsb: ctl - atl, acr: ctl > 0 ? atl / ctl : 0 };
}

const isHardType = (t?: string | null) => {
  const x = String(t ?? "").toLowerCase();
  if (/easy|recovery|long|trail|endurance|footing|récup|fond|marche/.test(x)) return false;
  return /interval|vma|tempo|seuil|race|hill|fractionn|côte|cote|sprint|vif|fartlek|threshold/.test(x);
};
const r1 = (n: number) => Math.round(n * 10) / 10;

// Estime une VMA quand aucun test n'est enregistré : meilleure vitesse soutenue récente
// (4–18 km, ≤ 45 j), calibrée par l'intensité FC réelle de la séance. Repli INDISPENSABLE
// — sans VMA, tout le coaching se dégrade (niveau mal classé, aucune allure, intensité non dosée).
function estimateVmaFromRuns(workouts: Wk[], fcMaxEst: number | null, now: number): number | null {
  let best = 0;
  for (const w of workouts) {
    const km = w.distance_km ?? 0, sec = w.duration_seconds ?? 0;
    if (km < 4 || km > 18 || sec <= 0) continue;
    if (now - new Date(w.date).getTime() > 45 * 86400000) continue;
    const spd = km / (sec / 3600);
    if (!(spd > 6) || spd > 25) continue; // garde-fous : données aberrantes
    // Fraction de VMA déduite de l'intensité (% FCmax) ; sinon hypothèse modérée prudente.
    let frac = 0.80;
    const hr = w.avg_hr ?? null;
    if (hr && fcMaxEst) {
      const pct = hr / fcMaxEst;
      // % de VMA soutenu selon l'intensité FC — calibration CONSERVATRICE (mieux vaut sous-estimer
      // la VMA que prescrire trop vite). Ex : un effort continu à ~90 % FCmax ≈ 90 % VMA.
      frac = pct >= 0.95 ? 0.93 : pct >= 0.90 ? 0.90 : pct >= 0.85 ? 0.86 : pct >= 0.80 ? 0.81 : pct >= 0.75 ? 0.77 : 0.72;
    }
    const vmaImplied = spd / frac;
    if (vmaImplied > best) best = vmaImplied;
  }
  return best > 0 ? Math.round(best * 10) / 10 : null;
}

// Reclasse une séance selon l'allure/FC RÉELLES (les imports intervals.icu arrivent souvent
// TOUS en « easy ») → l'IA lit une histoire d'entraînement juste, pas une suite de faux footings.
export function classifyRun(w: { distance_km?: number | null; duration_seconds?: number | null; avg_hr?: number | null; type?: string | null }, fcMax: number | null): string {
  const km = w.distance_km ?? 0, sec = w.duration_seconds ?? 0;
  if (km <= 0 || sec <= 0) return String(w.type ?? "séance");
  if (km >= 18 || sec >= 95 * 60) return "Sortie longue";
  const pct = (w.avg_hr && fcMax) ? w.avg_hr / fcMax : null;
  if (pct != null) {
    if (pct >= 0.90) return "Intense (VMA/course)";
    if (pct >= 0.85) return "Seuil/Tempo";
    if (pct >= 0.80) return "Allure soutenue";
    if (pct >= 0.70) return "Endurance";
    return "Footing facile";
  }
  return "Footing";
}

export type AthleteContext = {
  text: string;
  objective: CoachObjective | null;
  daysToRace: number | null;
  weeksToRace: number | null;
  athleteName: string;
  vma: number | null; // VMA km/h (test enregistré ou estimée) — pour les cibles d'allure montre.
  // Squelette de semaine déterministe → permet de VALIDER/corriger le plan de l'IA.
  weekPlan: { qBudget: number; quality: { type: string; desc: string }[]; easyPace: string | null; eased: boolean };
  longRunMode: "run" | "bike"; // préférence : sortie longue en course ou remplacée par du vélo (cross-training)
  // Verdict de fraîcheur du jour (déterministe) — affiché au coach et imposé à l'IA.
  readiness: { level: "vert" | "jaune" | "orange" | "rouge"; reasons: string[]; advice: string };
  /** Heures minimales entre deux séances dures pour CET athlète (calculé sur son âge). */
  hardGapHours: number;
  /** Allure d'endurance facile (~70 % VMA), en min/km — null si VMA inconnue. */
  easyPace: string | null;
  /** Jours écoulés depuis la dernière séance DURE réellement effectuée (0 = aujourd'hui). */
  lastHardDaysAgo: number | null;
  /** Volumes cibles de la semaine, en km. */
  volume: { weekKm: number; avg4wkKm: number; targetKm: number; longRunKm: number };
  /** Où l'on se situe dans le cycle : semaine allégée, affûtage, ou montée en charge. */
  cycle: { deload: boolean; taper: boolean; label: string };
  /** Jours de la semaine (0 = dimanche) systématiquement prescrits ET jamais réalisés. */
  skippedWeekdays: number[];
  /** Disponibilités déclarées : nb de séances de course/semaine et jours praticables (0 = dim). */
  availability: { daysPerWeek: number; days: number[] };
  /** Prévisions RÉELLES à 7 jours (Open-Meteo) — vide si la position est inconnue. */
  forecast: DayWeather[];
  /** Altitude du lieu d'entraînement (m) et perte aérobie associée (%). */
  altitude: { elevationM: number | null; lossPct: number };
  /** % du temps passé en Z3+ s'il dépasse la cible (footings trop rapides), sinon null. */
  tooMuchIntensity: number | null;
  /** true si l'athlète s'entraîne réellement en terrain vallonné (D+ hebdo significatif). */
  hillyTraining: boolean;
  /** Allure seuil MESURÉE (min/km) issue de la vitesse critique, si disponible. */
  thresholdPace: string | null;
  // Plan macro périodisé semaine par semaine jusqu'au jour J.
  macroPlan: { week: number; phase: string; volumeKm: number; quality: string[]; longRunKm: number; focus: string }[];
};

// Rassemble et ANALYSE toutes les données de l'athlète → briefing pour l'IA coach.
/**
 * Séances de l'athlète, en tolérant qu'une migration soit en retard.
 *
 * PostgREST rejette la requête ENTIÈRE si une seule colonne du `select` n'existe pas
 * encore (42703). Nommer `sport` avant l'application de la migration 015 priverait
 * donc le coach de TOUT l'historique, et pas seulement du sport. On retente sans.
 */
async function fetchWorkouts(sb: SB, userId: string) {
  const cols = "vertical_ratio_pct,hrr_bpm,date,type,distance_km,duration_seconds,elevation_gain_m,avg_hr,max_hr,training_effect,tss,avg_cadence_spm,avg_power_watts,vertical_oscillation_cm,ground_contact_ms,stride_length_m,cardiac_decoupling,weather_temp_c,gap_min_km,hr_zone_seconds,intensity_pct";
  const q = async (c: string) => {
    const r = await sb.from("workouts").select(c).eq("user_id", userId).order("date", { ascending: false }).limit(60);
    return { data: r.data as unknown as Wk[] | null, error: r.error };
  };
  const withSport = await q(`${cols},sport`);
  return withSport.error ? await q(cols) : withSport;
}

export async function buildAthleteContext(sb: SB, userId: string): Promise<AthleteContext> {
  const [profileRes, baseRes, hrvRes, sleepRes, woRes, fbRes, painRes, objRes, csRes] = await Promise.all([
    sb.from("profiles").select("*").eq("id", userId).single(),
    sb.from("performance_baselines").select("*").eq("user_id", userId).order("tested_at", { ascending: false }).limit(1).single(),
    sb.from("hrv_data").select("hrv_ms,physiological_state,date").eq("user_id", userId).order("date", { ascending: false }).limit(14),
    sb.from("sleep_data").select("sleep_score,total_sleep_min,deep_sleep_min,rem_sleep_min,body_battery_end,respiration_rate,date").eq("user_id", userId).order("date", { ascending: false }).limit(7),
    fetchWorkouts(sb, userId),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "session_feedback").order("created_at", { ascending: false }).limit(5),
    // Douleurs déclarées depuis l'espace Santé (schéma corporel) — elles n'atteignaient
    // pas le coach, qui ne regardait que le formulaire post-séance.
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "pain_report").order("created_at", { ascending: false }).limit(10),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "race_objective").maybeSingle(),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "coach_session").order("created_at", { ascending: false }).limit(40),
  ]);

  const p = profileRes.data as Record<string, unknown> | null;
  const b = baseRes.data as Record<string, unknown> | null;
  const hrv = (hrvRes.data ?? []) as { hrv_ms: number | null; physiological_state: string | null; date: string }[];
  const sleep = (sleepRes.data ?? []) as { sleep_score: number | null; total_sleep_min: number | null; deep_sleep_min: number | null; rem_sleep_min: number | null; body_battery_end: number | null; respiration_rate: number | null; date: string }[];
  const workouts = (woRes.data ?? []) as Wk[];
  const feedback = (fbRes.data ?? []) as { data: { rpe?: number; pain?: string[]; note?: string } }[];
  const objective = (objRes.data?.data ?? null) as CoachObjective | null;
  const coachSessions = ((csRes.data ?? []) as { data: { date?: string; sessionType?: string } }[]).map(r => r.data).filter((d): d is { date?: string; sessionType?: string } => !!d?.date);

  const now = Date.now();
  // Semaine ISO : ancre STABLE d'un jour à l'autre. Sert à faire varier le stimulus des
  // séances de qualité d'une semaine sur l'autre ET à placer la semaine allégée (1 sur 4).
  const isoWeek = (() => {
    const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  })();
  const num = (v: unknown) => (v == null ? null : Number(v));
  // COURSE À PIED UNIQUEMENT — référence de TOUTE l'analyse spécifique : volume,
  // allures, forme de course, estimation de VMA, dénivelé couru, répartition 80/20.
  // Le vélo, la randonnée et la marche en sont exclus (une sortie vélo à 30 km/h passe
  // même le garde-fou de vitesse et produirait une VMA de 40 km/h). Seule la CHARGE
  // continue de tout compter : une randonnée de 1 000 m de D+ fatigue réellement.
  // Les compter revenait à dimensionner les séances sur des kilomètres jamais courus
  // (relevé : 101,8 km comptés pour 35,8 km réellement courus pendant un séjour en
  // montagne, d'où une sortie longue de 33 km proposée pour un objectif 10 km).
  // La CHARGE, elle, continue de tout prendre en compte : une randonnée fatigue.
  const runs = workouts.filter(w => isRun(w.sport));
  const kmIn = (days: number) => runs.filter(w => now - new Date(w.date).getTime() <= days * 86400000).reduce((s, w) => s + (w.distance_km ?? 0), 0);
  const weekKm = kmIn(7), avg4wkKm = kmIn(28) / 4;
  const crossKm7 = workouts.filter(w => !isRun(w.sport) && now - new Date(w.date).getTime() <= 7 * 86400000)
    .reduce((s, w) => s + (w.distance_km ?? 0), 0);
  const load = computeLoad(workouts);
  // Jours sans COURIR : randonner tous les jours ne maintient pas la spécificité.
  // Compter la rando ici masquait une coupure de course sous une fausse régularité.
  const daysSinceLast = (() => { const r = workouts.find(w => isRun(w.sport)); return r?.date ? Math.floor((now - new Date(r.date).getTime()) / 86400000) : null; })();
  const restDays7 = Math.max(0, 7 - new Set(workouts.filter(w => now - new Date(w.date).getTime() <= 7 * 86400000).map(w => String(w.date).slice(0, 10))).size);
  // Répartition 80/20 : une randonnée soutenue passe du temps en Z3 sans être une
  // séance intense. La compter retirerait à tort une qualité au budget de la semaine.
  const recent14 = workouts.filter(w => isRun(w.sport) && now - new Date(w.date).getTime() <= 14 * 86400000);
  // FC max de repli (baseline → max observé en séance → formule d'âge) — sert à CLASSER l'effort
  // ET à estimer la VMA. Les imports intervals.icu étiquettent souvent TOUT en « easy » : on lit la FC.
  const obsMaxHr0 = Math.max(0, ...workouts.map(w => num(w.max_hr) ?? 0));
  const fcMaxEst = num(b?.max_hr) ?? (obsMaxHr0 > 150 ? obsMaxHr0 : null) ?? (num(p?.age) != null ? 220 - (num(p?.age) as number) : 190);
  // Une séance est « dure » si son TYPE le dit OU si la FC révèle un effort élevé (≥ 90 % FCmax).
  const isHardWk = (w: Wk) => isHardType(w.type) || (fcMaxEst != null && w.avg_hr != null && w.avg_hr >= fcMaxEst * 0.90);
  const hardShare = recent14.length ? Math.round(recent14.filter(isHardWk).length / recent14.length * 100) : null;
  // ── LE VRAI 80/20 : en TEMPS passé par zone, pas en nombre de séances ──
  // Compter les séances est trompeur : deux fractionnés courts dans une semaine de
  // plusieurs heures restent ~80 % facile. Seul le temps en zone tranche. Les secondes
  // par zone arrivent désormais d'intervals.icu (Z1-Z2 = facile, Z3+ = intensité).
  const zoneTotals = recent14.reduce((acc, w) => {
    const z = Array.isArray(w.hr_zone_seconds) ? w.hr_zone_seconds : null;
    if (!z) return acc;
    acc.easy += (z[0] ?? 0) + (z[1] ?? 0);
    acc.hard += z.slice(2).reduce((a, b) => a + (b ?? 0), 0);
    return acc;
  }, { easy: 0, hard: 0 });
  const zoneTotal = zoneTotals.easy + zoneTotals.hard;
  const hardTimePct = zoneTotal > 600 ? Math.round((zoneTotals.hard / zoneTotal) * 100) : null;

  const hrvVals = hrv.map(h => h.hrv_ms).filter((v): v is number => v != null);
  const hrvLatest = hrvVals[0] ?? null;
  const hrvBase = hrvVals.length >= 3 ? Math.round(hrvVals.reduce((a, c) => a + c, 0) / hrvVals.length) : null;
  const hrvTrend = hrvLatest != null && hrvBase != null ? (hrvLatest >= hrvBase ? "au-dessus de sa base → frais" : "sous sa base → fatigue possible") : "n/c";
  const state = hrv[0]?.physiological_state ?? "optimal";
  const sleepAvg = sleep.length ? Math.round(sleep.reduce((s, d) => s + (d.sleep_score ?? 0), 0) / sleep.length) : null;
  // Sommeil de cette nuit pris en compte SEULEMENT s'il est récent (montre portée).
  const freshSleep = sleep[0]?.date && now - new Date(sleep[0].date + "T00:00:00").getTime() <= 2 * 86400000 ? sleep[0] : null;
  const lastSleepMin = freshSleep?.total_sleep_min ?? null;

  // Douleurs = formulaire post-séance ET espace Santé. Une déclaration se périme au
  // bout de 14 jours : une gêne signalée il y a un mois ne doit pas brider l'athlète
  // indéfiniment s'il ne l'a pas re-signalée.
  const declaredPains = ((painRes.data ?? []) as { data: { zone?: string; level?: number; date?: string } }[])
    .filter(n => n.data?.zone && n.data?.date && now - new Date(`${n.data.date}T12:00:00`).getTime() <= 14 * 86400000)
    .map(n => `${n.data.zone}${n.data.level ? ` (${n.data.level}/10)` : ""}`);
  const pains = [...new Set([
    ...feedback.flatMap(f => f.data?.pain ?? []).filter((p) => p && p !== "Aucune douleur"),
    ...declaredPains,
  ])];
  const lastRpe = feedback[0]?.data?.rpe ?? null;
  // TENDANCE du ressenti, pas seulement la dernière valeur. Un athlète qui trouve ses
  // 3 dernières séances difficiles est en train de sur-solliciter, même si sa VFC et son
  // sommeil paraissent bons — le ressenti précède souvent les marqueurs physiologiques.
  const recentRpe = feedback.map(f => f.data?.rpe).filter((r): r is number => typeof r === "number").slice(0, 3);
  const rpeAvg = recentRpe.length >= 2 ? Math.round((recentRpe.reduce((a, b) => a + b, 0) / recentRpe.length) * 10) / 10 : null;
  const rpeHigh = rpeAvg != null && rpeAvg >= 7;
  // Notes libres récentes de l'athlète (sensations, douleur précise…) → vues par le coach.
  const fbNotes = feedback.map(f => f.data?.note?.trim()).filter((n): n is string => !!n).slice(0, 3);

  const maxHr = num(b?.max_hr), restHr = num(b?.resting_hr), ltHr = num(b?.lt_hr);
  const vmaStored = num(b?.vma_kmh);
  const garminVo2 = num((p as Record<string, unknown> | null)?.garmin_vo2max);
  // VMA, par fiabilité : test enregistré → efforts réels (reflète l'allure de course) → dérivée de la
  // VO2max Garmin (repli) → repli FC. Garantit le MÊME chiffre côté coach et côté client.
  // Meilleurs efforts mesurés : disponibles avant tout le reste car ils fondent la VMA.
  const paceCurve = (p?.pace_curve ?? null) as { best?: { m: number; sec: number }[]; criticalSpeed?: number | null; dPrime?: number | null } | null;
  const vma = (vmaStored != null && vmaStored > 0) ? vmaStored
    : (vmaFromPaceCurve(paceCurve?.best) ?? bestVmaFromWorkouts(runs, fcMaxEst) ?? estimateVmaFromRuns(runs, fcMaxEst, now)
       ?? (garminVo2 != null && garminVo2 > 0 ? vmaFromVo2max(garminVo2) : null));
  const vmaIsEst = !(vmaStored != null && vmaStored > 0) && vma != null;
  const level = vma == null ? "à évaluer (VMA inconnue)" : vma < 13 ? "débutant" : vma < 16 ? "intermédiaire" : vma < 19 ? "confirmé" : "expert/élite";

  // Zones FC (Karvonen) si dispo
  const hrZone = (lo: number, hi: number) => (maxHr != null && restHr != null) ? `${Math.round(restHr + (maxHr - restHr) * lo)}-${Math.round(restHr + (maxHr - restHr) * hi)} bpm` : null;
  // Zones d'allure stockées (min/km)
  const paceZones = b && b.z2_min != null
    ? `Z1 ${num(b.z1_min)}-${num(b.z1_max)} · Z2 ${num(b.z2_min)}-${num(b.z2_max)} · Z3 ${num(b.z3_min)}-${num(b.z3_max)} · Z4 ${num(b.z4_min)}-${num(b.z4_max)} · Z5 ${num(b.z5_min)}-${num(b.z5_max)} (min/km)`
    : null;

  // Objectif + faisabilité
  let daysToRace: number | null = null, weeksToRace: number | null = null;
  const objLines: string[] = [];
  if (objective?.raceDate) {
    daysToRace = Math.ceil((new Date(objective.raceDate + "T00:00:00").getTime() - now) / 86400000);
    weeksToRace = Math.floor(daysToRace / 7);
    objLines.push(`• Course : ${objective.race} — ${objective.distanceKm} km, le ${objective.raceDate} (J-${daysToRace}, ~${weeksToRace} sem.)`);
    objLines.push(`• Temps visé : ${objective.targetTime} → allure cible ${objective.targetPace}`);
    if (vma && objective.distanceKm && objective.targetSeconds) {
      const targetSpeed = objective.distanceKm / (objective.targetSeconds / 3600);
      const pctVma = Math.round((targetSpeed / vma) * 100);
      // Fraction de VMA réellement soutenable sur la distance → VMA requise pour le chrono visé.
      const frac = objective.distanceKm <= 5 ? 93 : objective.distanceKm <= 10 ? 90 : objective.distanceKm <= 21.5 ? 85 : 80;
      const reqVma = r1(targetSpeed / (frac / 100));
      const verdict = pctVma > frac + 4
        ? `⚠️ TRÈS ambitieux : ce chrono demande une VMA ~${reqVma} km/h (il est à ~${vma}${vmaIsEst ? " estimée" : ""}). Il faut un GROS travail de VMA d'ici la course, ou réviser l'objectif — sois honnête avec lui.`
        : pctVma < frac - 6
        ? "objectif confortable au vu de son niveau : il peut viser plus ambitieux."
        : "objectif cohérent avec son niveau actuel : la spécificité fera la différence.";
      objLines.push(`• Allure cible = ${pctVma} % VMA (un ${objective.distanceKm} km se court ~${frac} % VMA). ${verdict}`);
      // Feuille de route concrète : combien de VMA gagner, à quel rythme, est-ce réaliste.
      if (reqVma > vma && weeksToRace && weeksToRace > 0) {
        const gain = r1(reqVma - vma);
        const perWk = Math.round((gain / weeksToRace) * 100) / 100;
        const realism = perWk <= 0.08 ? "réaliste avec un bon bloc VMA" : perWk <= 0.15 ? "ambitieux mais jouable avec 2 séances VMA/sem et de la régularité" : "très difficile dans le délai — propose-lui un objectif intermédiaire (ex. viser ~5-8 s/km de plus) puis le vrai chrono plus tard";
        objLines.push(`• Feuille de route : gagner +${gain} km/h de VMA en ${weeksToRace} sem (~+${perWk} km/h/sem) → ${realism}.`);
      } else if (reqVma <= vma) {
        objLines.push(`• Sa VMA actuelle suffit DÉJÀ pour le chrono : le travail = spécificité (tenir l'allure), endurance et pacing, pas plus de VMA brute.`);
      }
    }
  }

  // Historique présenté au coach : COURSE uniquement. Une randonnée de 2 h en montagne
  // arrivait ici étiquetée « Sortie longue 10,2 km @13'31/km » — le coach y lisait un
  // effondrement de forme là où l'athlète avait simplement marché en altitude.
  const last5 = runs.slice(0, 5).map(w => {
    const pace = w.distance_km && w.duration_seconds ? `${Math.floor((w.duration_seconds / 60) / w.distance_km)}'${String(Math.round(((w.duration_seconds / 60) / w.distance_km % 1) * 60)).padStart(2, "0")}/km` : "?";
    return `${String(w.date).slice(5, 10)} ${classifyRun(w, fcMaxEst)} ${r1(w.distance_km ?? 0)}km @${pace}${w.avg_hr ? ` ${w.avg_hr}bpm` : ""}${w.elevation_gain_m ? ` D+${w.elevation_gain_m}` : ""}`;
  });

  // ── ANALYSE APPROFONDIE — facteurs avancés (efficacité, forme, charge, sommeil, cycle) ──
  const vo2 = (garminVo2 != null && garminVo2 > 0) ? Math.round(garminVo2) : (vma ? Math.round(vma * 3.5) : null);
  // Efficacité aérobie : distance/min par battement sur séances faciles → tendance 21j vs 21j.
  const easyEF = (from: number, to: number) => {
    // Variable locale volontairement nommée `easyRuns` : un `runs` ici masquerait la
    // référence globale et laisserait croire que le sport est déjà filtré. Il ne l'était
    // pas — les randonnées entraient dans l'efficacité aérobie, dont elles ne disent rien.
    const easyRuns = runs.filter(w => { const age = now - new Date(w.date).getTime(); return age > from * 86400000 && age <= to * 86400000 && !isHardType(w.type) && !!w.avg_hr && !!w.distance_km && !!w.duration_seconds; });
    if (!easyRuns.length) return null;
    // Vitesse AJUSTÉE AU DÉNIVELÉ quand elle est disponible : comparer l'allure brute
    // d'une semaine en montagne à celle d'une semaine sur route ferait passer un athlète
    // en progression pour un athlète en train de s'effondrer.
    const speed = (w: Wk) => (w.gap_min_km && w.gap_min_km > 0)
      ? 1000 / w.gap_min_km
      : w.distance_km! * 1000 / (w.duration_seconds! / 60);
    return easyRuns.reduce((s, w) => s + speed(w) / w.avg_hr!, 0) / easyRuns.length;
  };
  const efR = easyEF(0, 21), efP = easyEF(21, 42);
  const efGap = runs.slice(0, 20).some(w => w.gap_min_km != null);
  const efTrend = efR != null && efP != null ? `${efR > efP * 1.02 ? "↑ en hausse (plus efficace à FC égale → tu progresses)" : efR < efP * 0.98 ? "↓ en baisse (fatigue/forme à surveiller)" : "→ stable"}${efGap ? " [calculé sur l\u2019allure AJUSTÉE AU DÉNIVELÉ, donc comparable entre plat et montagne]" : ""}` : null;
  // VFC : moyenne 7 j vs 7 j précédents.
  const hrvAvg = (from: number, to: number) => { const v = hrv.filter(h => { const age = now - new Date(h.date).getTime(); return age > from * 86400000 && age <= to * 86400000 && h.hrv_ms != null; }).map(h => h.hrv_ms!); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const hrv7 = hrvAvg(0, 7), hrv7p = hrvAvg(7, 14);
  const hrvWeekTrend = hrv7 != null && hrv7p != null ? (hrv7 > hrv7p * 1.03 ? "↑ en hausse (bonne adaptation)" : hrv7 < hrv7p * 0.97 ? "↓ en baisse (fatigue accumulée)" : "→ stable") : null;
  // Monotonie (Foster) — uniformité de la charge sur 7 j (>2 = risque surcharge/maladie).
  const dailyTss = Array.from({ length: 7 }, (_, i) => { const d = new Date(now - i * 86400000).toISOString().slice(0, 10); return workouts.filter(w => String(w.date).slice(0, 10) === d).reduce((s, w) => s + estimateTSS(w), 0); });
  const tMean = dailyTss.reduce((a, b) => a + b, 0) / 7;
  const tSd = Math.sqrt(dailyTss.reduce((a, b) => a + (b - tMean) ** 2, 0) / 7) || 1;
  const monotony = tMean > 0 ? Math.round((tMean / tSd) * 10) / 10 : 0;
  // Forme de course : mesurée sur des COURSES, évidemment. Mélanger randonnée et
  // course donnait « cadence 142,7 spm » et « foulée 0,9 m » pour un athlète qui court
  // à 176 spm et 1,16 m — le coach aurait corrigé un défaut technique inexistant.
  const recForm = runs.slice(0, 10);
  const avgOf = (key: keyof Wk) => { const v = recForm.map(w => num(w[key])).filter((x): x is number => x != null && Number.isFinite(x)); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
  const cadence = avgOf("avg_cadence_spm"), power = avgOf("avg_power_watts"), vosc = avgOf("vertical_oscillation_cm"), gct = avgOf("ground_contact_ms"), stride = avgOf("stride_length_m"), decoupling = avgOf("cardiac_decoupling");
  // Sommeil détaillé + terrain + chaleur + cycle.
  const sl = sleep[0];
  const pctOf = (part?: number | null, tot?: number | null) => part && tot ? Math.round(part / tot * 100) : null;
  // Une phase à 0 min sur une nuit de plusieurs heures n'existe pas : c'est une mesure
  // manquante, pas un sommeil dégradé. On préfère ne rien dire que dire faux.
  const phaseMin = (v: number | null | undefined) => (v != null && v > 0 ? v : null);
  const deepPct = pctOf(phaseMin(sl?.deep_sleep_min), sl?.total_sleep_min), remPct = pctOf(phaseMin(sl?.rem_sleep_min), sl?.total_sleep_min);
  // Dénivelé COURU : c'est lui qui rend l'allure incomparable. Le D+ d'une randonnée
  // ne dit rien de la difficulté des footings.
  const elevWeek = Math.round(runs.filter(w => now - new Date(w.date).getTime() <= 7 * 86400000).reduce((s, w) => s + (w.elevation_gain_m ?? 0), 0));
  const temps = recForm.map(w => num(w.weather_temp_c)).filter((x): x is number => x != null && Number.isFinite(x));
  const avgTemp = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
  const cycle = p?.is_female_cycle_sync && p?.current_phase ? String(p.current_phase) : null;

  // ── PASSIF, TERRAIN & DÉNIVELÉ (déclarés par l'athlète) ──────────────────────
  // Trois leviers d'individualisation que la physiologie seule ne donne pas :
  // depuis combien de temps il court (tolérance à la charge), sur quoi il court
  // (surface = allures pertinentes + charge mécanique), et son rapport au D+.
  const runYears = num(p?.running_years);
  const expLabel = runYears == null ? null
    : runYears < 1 ? "moins d'un an de pratique (GRAND DÉBUTANT)"
    : runYears < 2 ? "1 an de pratique (débutant)"
    : runYears < 4 ? `${runYears} ans de pratique (encore jeune coureur)`
    : runYears < 8 ? `${runYears} ans de pratique (coureur installé)`
    : `${runYears} ans de pratique (long passif d'endurance)`;
  // Le passif compte AUTANT que la VMA : un tendon met des années à se renforcer.
  const expRule = runYears == null ? null
    : runYears < 1 ? "⚠️ MOINS D'UN AN DE COURSE : le système musculo-tendineux n'est PAS encore adapté, même si le cardio suit. Priorité absolue à la RÉGULARITÉ et au volume facile. Maximum 1 séance de qualité/semaine, courte. Pas de pliométrie, pas de sortie longue > 1 h 15, progression du volume ≤ +5 %/semaine (pas +10 %). La blessure n°1 du débutant vient d'un cardio qui va plus vite que les tendons."
    : runYears < 3 ? "Passif court (1-3 ans) : le cardio progresse plus vite que les tendons. Reste à 2 séances de qualité maximum, augmente le volume avant l'intensité, et garde une semaine allégée toutes les 4 semaines."
    : runYears >= 8 ? "Long passif (8 ans et +) : structure tendineuse solide, tolérance à la charge élevée. Tu peux oser des blocs denses, des doubles séances et des sorties longues ambitieuses si la fraîcheur suit."
    : "Passif solide (4-7 ans) : bonne tolérance à la charge, la périodisation classique s'applique pleinement.";

  // Terrains MULTIPLES (tableau `main_terrains`, repli sur l'ancienne colonne `main_terrain`).
  const terr = terrainCoachBlock(p?.main_terrains, p?.main_terrain);

  const ELEV: Record<string, { label: string; rule: string }> = {
    evite: { label: "évite le dénivelé", rule: "Il ÉVITE le dénivelé : ne lui impose pas de séance de côtes s'il n'en a pas besoin pour son objectif. Développe la force autrement (renforcement, lignes droites, éducatifs). SI l'objectif comporte du D+, introduis-le très progressivement et explique-lui pourquoi c'est indispensable." },
    modere: { label: "dénivelé modéré", rule: "Dénivelé modéré : 1 séance de côtes toutes les 1-2 semaines suffit, en complément de la qualité sur le plat." },
    aime: { label: "aime le dénivelé", rule: "Il AIME le dénivelé : sers-t'en. Les côtes remplacent avantageusement une séance de VMA (même sollicitation cardiaque, moins d'impact), et le D+ hebdomadaire peut monter franchement." },
    specialiste: { label: "spécialiste du dénivelé (trail/montagne)", rule: "SPÉCIALISTE du dénivelé : programme du D+ structuré chaque semaine (montées longues en Z2-Z3, côtes courtes explosives, DESCENTES travaillées à part pour l'excentrique). Raisonne en mètres de D+ hebdomadaires autant qu'en kilomètres." },
  };
  const elevKey = typeof p?.elevation_pref === "string" ? String(p.elevation_pref) : null;
  const elev = elevKey ? ELEV[elevKey] ?? null : null;

  // ── ÂGE — la récupération, pas la performance, est ce qui change avec les années ──
  const age = num(p?.age);
  const ageRule = age == null ? null
    : age < 18 ? "⚠️ MOINS DE 18 ANS : cartilages de croissance encore ouverts. Pas de charge lourde, pas de pliométrie intensive, pas de volume d'adulte. Priorité absolue au plaisir, à la variété et à la technique. Le volume et l'intensité se construiront après la fin de la croissance — brûler les étapes ici coûte une carrière."
    : age < 35 ? "Fenêtre physiologique optimale : récupération rapide (48 h entre deux séances dures suffisent), tolérance à la charge élevée. C'est le moment d'oser le volume et la densité si le passif suit."
    : age < 50 ? "MASTER (35-49 ans) : la VMA baisse lentement mais la RÉCUPÉRATION baisse vite — c'est le vrai facteur limitant. Espace les séances dures de 72 h plutôt que 48 h, et rends le renforcement musculaire NON NÉGOCIABLE (2×/semaine) : c'est ce qui préserve la puissance et prévient les tendinopathies après 35 ans. Mieux vaut 2 séances de qualité bien récupérées que 3 subies."
    : age < 65 ? "MASTER+ (50-64 ans) : récupération nettement rallongée (72-96 h entre deux séances dures), masse musculaire à défendre activement (renforcement 2-3×/semaine, c'est prioritaire sur le volume de course). La formule 220−âge est particulièrement fausse à cet âge : fie-toi à la FC max OBSERVÉE, pas à la formule. Privilégie le seuil et les côtes au fractionné très court (moins traumatisant, bénéfice équivalent)."
    : "VÉTÉRAN (65 ans et +) : la régularité et le renforcement priment sur tout le reste. Séances dures espacées de 96 h, échauffements rallongés, surfaces souples privilégiées, et alternance course/marche assumée sans complexe si nécessaire. L'objectif est de courir encore dans 10 ans.";
  // Après 35 ans, l'espacement minimal entre deux séances dures s'allonge.
  const hardGapH = age == null ? 48 : age < 35 ? 48 : age < 50 ? 72 : age < 65 ? 84 : 96;

  // ── SANTÉ — pathologies déclarées et zones de blessure récurrentes ──
  const cond = healthCoachLines(p?.health_conditions, HEALTH_CONDITIONS);
  const inj = healthCoachLines(p?.injury_zones, INJURY_ZONES);
  const healthNotes = typeof p?.health_notes === "string" ? p.health_notes.trim().slice(0, 500) : "";
  // Certaines pathologies interdisent purement et simplement l'effort maximal.
  const noMaxEffort = ["cardiaque", "covid_long", "grossesse"].some((s) => (Array.isArray(p?.health_conditions) ? (p.health_conditions as unknown[]).map(String) : []).includes(s));

  // Palette de séances adaptée au niveau + objectif (la lib est la base de connaissances).
  const libLevel: Level = vma == null || vma < 13 ? "debutant" : vma < 16 ? "intermediaire" : vma < 19 ? "confirme" : "elite";
  const libGoal: Goal = !objective ? "general"
    : (/trail|utmb|ultra|vertical|\bkv\b|montagne/i.test(objective.race) || (objective.distanceKm ?? 0) > 45) ? ((objective.distanceKm ?? 0) > 60 ? "ultra" : "trail")
    : (objective.distanceKm ?? 99) <= 5 ? "5k" : (objective.distanceKm ?? 99) <= 10 ? "10k" : (objective.distanceKm ?? 99) <= 21.5 ? "semi" : "marathon";
  const catalog = buildSessionCatalog({ level: libLevel, goal: libGoal });

  // Phase de périodisation (selon l'échéance) → oriente l'emphase des séances.
  const phase = objective?.raceDate && weeksToRace != null
    ? (weeksToRace <= 2 ? "AFFÛTAGE (volume −40 %, fraîcheur, TSB positif le jour J ; on GARDE de courtes touches de qualité/allure course, on coupe le VOLUME pas l'intensité)"
      : weeksToRace <= 5 ? "SPÉCIFIQUE (allure course + terrain ; 2-3 qualités/sem dont l'allure objectif ; l'affûtage approche)"
      : weeksToRace <= 11 ? "DÉVELOPPEMENT (VMA, seuil, côtes, allure objectif ; 2-3 qualités/sem ; volume soutenu)"
      : "BASE AÉROBIE + VITESSE (volume facile en hausse, MAIS on pose DÉJÀ 2 qualités/sem : VMA courte pour le plafond + seuil/tempo — 'base' ne veut JAMAIS dire 'tout lent', surtout pour un objectif chrono)")
    : "PROGRESSION GLOBALE (base aérobie + 1-2 qualités/sem selon le niveau ; jamais 100 % facile pour qui veut progresser)";

  // Allures cibles calculées depuis la VMA (repli si zones non stockées).
  const paceAt = (pct: number) => { if (!vma) return "?"; const s = 3600 / (vma * pct / 100); return `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, "0")}`; };
  /**
   * Allure d'une RÉPÉTITION, plafonnée par ce que l'athlète a réellement produit.
   *
   * Garde-fou d'impossibilité, pas de réglage fin : on ne prescrit jamais une SÉRIE de
   * répétitions plus rapide que le MEILLEUR effort UNIQUE mesuré sur cette distance en
   * six semaines. Vu en production — 12×400 m à 2'55/km demandés à un athlète dont le
   * meilleur 400 m était à 3'20/km. Douze fois plus vite que son record : la séance ne
   * pouvait qu'échouer, et l'échec aurait été mis sur le compte de l'athlète.
   */
  const repPace = (pct: number, meters: number) => {
    const target = vma ? 3600 / (vma * pct / 100) : null;
    if (target == null) return "?";
    const anchor = paceCurve?.best?.find((b) => Math.abs(b.m - meters) / meters <= 0.25);
    const floorSec = anchor ? anchor.sec / (anchor.m / 1000) : null;
    const sec = floorSec != null ? Math.max(target, floorSec) : target;
    return `${Math.floor(sec / 60)}'${String(Math.round(sec % 60)).padStart(2, "0")}`;
  };
  const computedPaces = vma ? `Z1 récup ~${paceAt(60)} · Z2 endurance ~${paceAt(70)} · seuil ~${paceAt(85)} · VMA ~${paceAt(100)} (min/km)` : null;
  // Chronos théoriques au potentiel actuel (% VMA soutenable par distance) → réalisme + allures.
  const predict = (km: number, pct: number) => { if (!vma) return "?"; const sec = km / (vma * pct / 100) * 3600; const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60); return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}'${String(s).padStart(2, "0")}`; };
  const predictions = vma ? `5K ~${predict(5, 93)} · 10K ~${predict(10, 90)} · semi ~${predict(21.1, 85)} · marathon ~${predict(42.2, 80)}` : null;

  // ── BOUCLE ADAPTATIVE — prescrit (séances coach) vs réalisé (workouts) ──
  // FC de repli si pas de baseline : FC max observée en séance, sinon estimée par l'âge.
  const obsMaxHr = Math.max(0, ...workouts.map(w => num(w.max_hr) ?? 0));
  const ageNum = num(p?.age);
  const fcMax = maxHr ?? (obsMaxHr > 120 ? obsMaxHr : null) ?? (ageNum ? 220 - ageNum : null);
  const fcRest = restHr ?? 55;
  const easyCeiling = fcMax != null ? Math.round(fcRest + (fcMax - fcRest) * 0.78) : null;
  const easyRuns = recent14.filter(w => w.avg_hr != null && !isHardWk(w));
  const tooFastEasy = easyCeiling != null ? easyRuns.filter(w => (w.avg_hr ?? 0) > easyCeiling).length : 0;
  const easyDiscipline = easyRuns.length && easyCeiling != null
    ? `${tooFastEasy}/${easyRuns.length} footings au-dessus du plafond facile (~${easyCeiling} bpm)${tooFastEasy / easyRuns.length >= 0.34 ? " ⚠️ tendance à courir TROP VITE en facile → fais-le RALENTIR (frein n°1 à la progression)" : tooFastEasy === 0 ? " ✅ excellente discipline" : " ✅ discipline correcte"}`
    : "n/c (FC ou séances manquantes)";
  const todayStr = new Date().toISOString().slice(0, 10);
  // Jours où il a COURU. Compter toutes les activités faisait passer une journée de
  // randonnée pour une séance de course honorée : l'adhérence était surestimée et les
  // jours réellement ratés — ceux que la boucle doit justement détecter — invisibles.
  const doneDates = new Set(runs.map(w => String(w.date).slice(0, 10)));
  const pastPrescribed = coachSessions.filter(c => c.date && c.date <= todayStr && now - new Date(c.date).getTime() <= 14 * 86400000);
  // ── JOURS SYSTÉMATIQUEMENT RATÉS (boucle d'adhérence) ──
  // Un plan qu'on ne suit pas ne sert à rien. Si un jour de la semaine est prescrit
  // encore et encore sans jamais être couru, ce n'est pas de la paresse : c'est que
  // ce jour-là ne marche pas dans sa vie. On arrête de s'obstiner.
  // Repos et Renfo sont exclus : ils n'apparaissent pas dans les activités enregistrées,
  // ils sembleraient donc « ratés » à chaque fois.
  const runnable = (t?: string) => !/repos|rest|renfo|muscu|gainage|ppg/i.test(t || "");
  const wdStat = new Map<number, { p: number; d: number }>();
  for (const c of coachSessions) {
    if (!c.date || c.date > todayStr || now - new Date(c.date).getTime() > 28 * 86400000) continue;
    if (!runnable(c.sessionType)) continue;
    const wd = new Date(c.date + "T00:00:00").getDay();
    const s = wdStat.get(wd) ?? { p: 0, d: 0 };
    s.p++; if (doneDates.has(String(c.date).slice(0, 10))) s.d++;
    wdStat.set(wd, s);
  }
  const skippedWeekdays = [...wdStat.entries()].filter(([, s]) => s.p >= 3 && s.d === 0).map(([wd]) => wd).slice(0, 2);

  // ── DERNIÈRE SÉANCE DURE RÉELLEMENT EFFECTUÉE ──
  // `workouts` est trié du plus récent au plus ancien : le premier match est le bon.
  // Sert à espacer la prochaine qualité par rapport au PASSÉ, pas seulement aux jours à venir.
  const lastHardWk = workouts.find(w => isHardWk(w));
  const lastHardDaysAgo = lastHardWk
    ? Math.max(0, Math.floor((now - new Date(String(lastHardWk.date) + "T00:00:00").getTime()) / 86400000))
    : null;

  const adherence = pastPrescribed.length
    ? `${pastPrescribed.filter(c => doneDates.has(String(c.date).slice(0, 10))).length}/${pastPrescribed.length} séances prescrites réalisées (14 j)`
    : "pas de plan prescrit récent";

  // ── STRUCTURE CIBLE DE LA SEMAINE — squelette DÉTERMINISTE (l'IA l'habille) ──────
  // Anti « tout en EF » : un objectif chrono impose une dose de qualité spécifique
  // CHAQUE semaine, dosée selon le niveau, la phase ET la fraîcheur RÉELLE du jour.
  // targetPace contient déjà « /km » → on le retire avant de réafficher « .../km » (sinon « 3'18/km/km »).
  const goalPace = objective?.targetPace ? objective.targetPace.replace(/\s*\/?\s*km\s*$/i, "").trim() || null : null;
  const raceShort = objective?.race ? objective.race.replace(/\s*\d{4}.*$/, "").trim() : null;
  const isShortGoal = libGoal === "5k" || libGoal === "10k" || libGoal === "semi";
  // Budget de qualité de base selon le niveau.
  // ── ÉCONOMIE DE COURSE & RÉCUPÉRATION CARDIAQUE ─────────────────────────────
  // Deux signaux qui bougent AVANT le chrono. On ne regarde pas la valeur absolue mais
  // la TENDANCE : c'est elle qui distingue une forme qui monte d'une fatigue qui
  // s'installe, et elle parle plus tôt que la VFC.
  const trendOf = (key: "vertical_ratio_pct" | "hrr_bpm") => {
    const vals = runs.filter(w => w[key] != null)
      .map(w => ({ d: new Date(w.date).getTime(), v: Number(w[key]) }));
    if (vals.length < 4) return null;
    const recent = vals.slice(0, Math.ceil(vals.length / 2));
    const older = vals.slice(Math.ceil(vals.length / 2));
    const avg = (a: { v: number }[]) => a.reduce((s, x) => s + x.v, 0) / a.length;
    return { now: r1(avg(recent)), before: r1(avg(older)), n: vals.length };
  };
  const vr = trendOf("vertical_ratio_pct");
  const hrr = trendOf("hrr_bpm");
  // Ratio vertical : part du travail qui part vers le HAUT plutôt que vers l'avant.
  // Indépendant de la taille du coureur, contrairement à l'oscillation seule.
  const vrLine = vr ? `${vr.now} % (${vr.now < 6.5 ? "très économique" : vr.now < 8 ? "bon" : vr.now < 9 ? "correct" : "perfectible"})`
    + `${Math.abs(vr.now - vr.before) >= 0.2 ? ` — ${vr.now < vr.before ? `EN AMÉLIORATION (${vr.before} % avant) : sa foulée devient plus efficace, dis-le-lui` : `EN DÉGRADATION (${vr.before} % avant) : souvent un signe de fatigue neuromusculaire ou de foulée qui s'écrase — renfo et éducatifs`}` : " — stable"}` : null;
  // Chute de FC sur 60 s après un effort dur : marqueur parasympathique.
  const hrrLine = hrr ? `${hrr.now} bpm de chute en 60 s après effort`
    + `${Math.abs(hrr.now - hrr.before) >= 2 ? ` — ${hrr.now > hrr.before ? `EN HAUSSE (${hrr.before} avant) : il récupère mieux, tu peux oser la charge` : `EN BAISSE (${hrr.before} avant) : sa récupération se dégrade AVANT que le chrono ne bouge — allège maintenant, pas dans trois semaines`}` : " — stable"}` : null;

  // ── PERFORMANCE MESURÉE (courbe d'allure intervals.icu) ─────────────────────
  // La vitesse critique est ajustée sur les efforts RÉELS de l'athlète : c'est un
  // seuil mesuré, là où `paceAt(86)` n'est qu'un pourcentage d'une VMA elle-même
  // souvent estimée. Quand elle existe, elle prime.
  const pc = paceCurve;
  const csMs = num(pc?.criticalSpeed);
  const fmtPace = (secPerKm: number) => `${Math.floor(secPerKm / 60)}'${String(Math.round(secPerKm % 60)).padStart(2, "0")}`;
  const thresholdPace = csMs && csMs > 1 ? fmtPace(1000 / csMs) : null;
  const bestLine = pc?.best?.length
    ? pc.best.map(b => {
        const t = b.sec, mm = Math.floor(t / 60), ss = Math.round(t % 60);
        const per = t / (b.m / 1000);
        return `${b.m >= 1000 ? `${b.m / 1000} km` : `${b.m} m`} en ${mm}:${String(ss).padStart(2, "0")} (${fmtPace(per)}/km)`;
      }).join(" · ")
    : null;
  // Exécution de la dernière séance de qualité : a-t-il tenu, ou décroché ?
  // Périmée au-delà de 12 jours : une série ratée il y a trois semaines ne doit pas
  // continuer à brider l'entraînement d'aujourd'hui. L'analyse n'est rafraîchie que
  // lorsqu'une nouvelle séance dure est détectée, elle peut donc traîner.
  const qeRaw = (p?.last_quality_exec ?? null) as { date?: string; repsSec?: number[]; avgHr?: number | null; fadeSec?: number | null } | null;
  const qeAgeDays = qeRaw?.date ? Math.floor((Date.now() - new Date(`${qeRaw.date}T12:00:00`).getTime()) / 86400_000) : null;
  const qe = qeAgeDays != null && qeAgeDays <= 12 ? qeRaw : null;
  const qeLine = qe?.repsSec?.length
    ? `${qe.repsSec.length} répétitions le ${qe.date} : ${qe.repsSec.map(fmtPace).join(" · ")}/km${qe.avgHr ? ` (FC moy ${qe.avgHr})` : ""}. ${
        qe.fadeSec == null ? ""
        : qe.fadeSec >= 12 ? `⚠️ DÉCROCHAGE de ${qe.fadeSec} s/km entre le début et la fin : la séance était trop ambitieuse, réduis l'allure cible ou le nombre de répétitions la prochaine fois.`
        : qe.fadeSec <= -6 ? `✅ Il a ACCÉLÉRÉ de ${-qe.fadeSec} s/km sur la fin : il en avait sous le pied, tu peux durcir la prochaine.`
        : "✅ Allure tenue du début à la fin : la charge était bien calibrée."}`
    : null;

  let qBudget = libLevel === "debutant" ? 1 : libLevel === "intermediaire" ? 2 : 3;
  if (libGoal === "marathon" || libGoal === "ultra") qBudget -= 1; // le volume prime → un cran de moins
  if (phase.startsWith("BASE")) qBudget = Math.min(qBudget, libLevel === "debutant" ? 1 : 2);
  else if (phase.startsWith("AFFÛTAGE")) qBudget = Math.min(qBudget, 2); // garde l'intensité, coupe le volume
  // Atténuations SÉCURITÉ selon l'état réel (chaque signal fort = −1 séance dure).
  // Budget de qualité STRUCTUREL — celui que justifient le niveau, l'objectif et la
  // phase, avant tout allègement lié à l'état du jour. La feuille de route des semaines
  // à venir doit s'appuyer dessus : une fatigue passagère ne dicte pas deux mois de plan.
  const structuralQBudget = Math.max(1, Math.min(3, qBudget));
  const easeReasons: string[] = [];
  if (pains.length) { qBudget -= 1; easeReasons.push("douleur signalée"); }
  if (hrvWeekTrend?.startsWith("↓")) { qBudget -= 1; easeReasons.push("VFC en baisse"); }
  if (load.acr > 1.5) { qBudget -= 1; easeReasons.push(`charge aiguë élevée (ratio ${r1(load.acr)})`); }
  if (load.tsb < -25) { qBudget -= 1; easeReasons.push(`TSB très négatif (${Math.round(load.tsb)})`); }
  // SOMMEIL : une nuit courte dégrade la tolérance à l'intensité AVANT de se voir sur la VFC.
  // On ne compte que la nuit dernière si la montre a été portée (sinon la donnée est absente,
  // pas mauvaise) — un score bas OU moins de 6 h coûtent une séance dure.
  const badNight = freshSleep && ((freshSleep.sleep_score != null && freshSleep.sleep_score < 60) || (lastSleepMin != null && lastSleepMin < 360));
  // Trop d'intensité SUBIE : quand plus de 25 % du temps se passe en Z3+, l'athlète
  // court ses footings trop vite. Ajouter de la qualité par-dessus l'enfoncerait ;
  // on en retire une et on lui dit franchement quoi corriger.
  if (rpeHigh) { qBudget -= 1; easeReasons.push(`ressenti élevé sur ses dernières séances (RPE moyen ${rpeAvg}/10)`); }
  if (hardTimePct != null && hardTimePct > 25) { qBudget -= 1; easeReasons.push(`${hardTimePct} % du temps en Z3+ (footings courus trop vite)`); }
  // Prescrit vs réalisé : le décrochage sur la dernière série est le signal le plus
  // direct qu'on ait. S'il a perdu du temps au fil des répétitions, la séance était
  // au-dessus de ses moyens du moment — on n'en rajoute pas une couche la semaine
  // suivante. Seuil à 10 s/km : en deçà, c'est du bruit de mesure et de terrain.
  const fade = qe?.fadeSec ?? null;
  const faded = fade != null && fade >= 10;
  if (faded) { qBudget -= 1; easeReasons.push(`décrochage de ${fade} s/km sur sa dernière série (séance trop ambitieuse)`); }
  if (badNight) { qBudget -= 1; easeReasons.push(`nuit dégradée (${freshSleep?.sleep_score ?? "?"}/100${lastSleepMin ? `, ${Math.floor(lastSleepMin / 60)}h${String(lastSleepMin % 60).padStart(2, "0")}` : ""})`); }
  // Pathologies interdisant l'effort maximal : on retire d'office la marche la plus haute.
  if (noMaxEffort) { qBudget = Math.min(qBudget, 1); }
  // Le PASSIF plafonne la qualité : un cardio de confirmé sur des tendons de 8 mois = blessure.
  // (Volontairement hors `easeReasons` : ce n'est pas un allègement passager mais une limite
  // structurelle — le message affiché diffère, et le plancher « objectif chrono » ne doit pas
  // pouvoir le contourner.)
  const expCap = runYears == null ? null : runYears < 1 ? 1 : runYears < 3 ? 2 : null;
  const expCapped = expCap != null && qBudget > expCap;
  if (expCapped) qBudget = expCap!;
  qBudget = Math.max(0, Math.min(3, qBudget));
  // Plancher : sans signal de fatigue, un objectif chrono garde ≥ 2 qualités (sauf débutant).
  // Le plafond « passif » reste prioritaire : il n'est jamais franchi par un plancher.
  const floor = (v: number) => { qBudget = Math.max(qBudget, expCap != null ? Math.min(v, expCap) : v); };
  if (!easeReasons.length && objective && isShortGoal && libLevel !== "debutant") floor(2);
  if (!easeReasons.length && qBudget === 0 && libLevel !== "debutant") floor(1);

  // ── VERDICT DE FRAÎCHEUR DU JOUR — calculé, pas laissé à l'appréciation de l'IA ──
  // Un modèle de langage a tendance à « sentir » l'état de forme au fil du texte ; ici on
  // tranche de façon déterministe et on lui impose la conclusion. Feu rouge = pas d'intensité,
  // point final.
  const redFlags: string[] = [];
  const orangeFlags: string[] = [];
  if (pains.length) redFlags.push(`douleur en cours (${pains.join(", ")})`);
  if (load.acr > 1.8) redFlags.push(`ratio aigu:chronique ${r1(load.acr)} (zone de risque de blessure)`);
  if (load.tsb < -30) redFlags.push(`TSB ${Math.round(load.tsb)} (fatigue profonde)`);
  if (hrvWeekTrend?.startsWith("↓") && badNight) redFlags.push("VFC en baisse ET nuit dégradée (double signal)");
  if (hrvWeekTrend?.startsWith("↓")) orangeFlags.push("VFC sous sa base");
  if (badNight) orangeFlags.push(`sommeil dégradé (${freshSleep?.sleep_score ?? "?"}/100)`);
  if (load.acr > 1.5 && load.acr <= 1.8) orangeFlags.push(`charge aiguë élevée (${r1(load.acr)})`);
  if (monotony > 2) orangeFlags.push(`monotonie ${monotony} (charge trop uniforme)`);
  if (lastRpe != null && lastRpe >= 8) orangeFlags.push(`dernière séance vécue très dure (RPE ${lastRpe}/10)`);
  else if (rpeHigh) orangeFlags.push(`ressenti élevé sur la durée (RPE moyen ${rpeAvg}/10 sur ses 3 derniers retours)`);
  // Niveau calculé UNE seule fois : il alimente à la fois le prompt de l'IA et le bandeau
  // affiché au coach — les deux ne peuvent donc pas diverger.
  const readyLevel: "vert" | "jaune" | "orange" | "rouge" =
    redFlags.length ? "rouge" : orangeFlags.length >= 2 ? "orange" : orangeFlags.length === 1 ? "jaune" : "vert";
  const READY = {
    rouge: { badge: "🔴 ROUGE", rule: "AUCUNE intensité aujourd'hui. Footing très facile, croisé sans impact ou repos complet — et dis-lui POURQUOI sans dramatiser. Reporter une séance dure de 24-48 h ne coûte rien ; la faire dans cet état coûte des semaines." },
    orange: { badge: "🟠 ORANGE", rule: "Séance allégée : garde la qualité SI elle était prévue mais coupe le volume du corps de séance d'environ un tiers, ou bascule sur du footing. Réévalue demain." },
    jaune: { badge: "🟡 JAUNE", rule: "Feu orange léger : la séance prévue peut se faire, mais reste attentif aux sensations sur l'échauffement — si ça ne vient pas dans les 15 premières minutes, transforme-la en footing." },
    vert: { badge: "🟢 VERT", rule: "Il est frais : c'est le jour pour placer la séance exigeante prévue. Ne sous-dose pas par excès de prudence, ce serait du potentiel perdu." },
  }[readyLevel];
  const readiness = READY.badge, readinessRule = READY.rule;
  const readinessBlock = `${readiness} — ${readinessRule}${redFlags.length ? `\n  • Signaux rouges : ${redFlags.join(" ; ")}` : ""}${orangeFlags.length ? `\n  • Signaux orange : ${orangeFlags.join(" ; ")}` : ""}${!redFlags.length && !orangeFlags.length ? "\n  • Aucun signal négatif : VFC, sommeil, charge et ressenti sont alignés." : ""}`;

  // ── MÉTÉO RÉELLE ────────────────────────────────────────────────────────────
  // Pas la température de la montre (capteur au poignet, jusqu'à 3 °C d'écart mesuré)
  // mais le relevé réel à la position d'entraînement, et surtout les PRÉVISIONS :
  // anticiper une canicule vaut mieux que la constater après la séance.
  const lat = num(p?.last_lat), lon = num(p?.last_lon);
  // Prévisions ET altitude en une seule requête : Open-Meteo renvoie les deux.
  const weather = lat != null && lon != null
    ? await forecastWithElevation(lat, lon).catch(() => ({ days: [], elevationM: null }))
    : { days: [], elevationM: null };
  const forecast = weather.days;
  // ALTITUDE — facteur totalement absent jusqu'ici. Au-delà de ~500 m, la performance
  // aérobie se dégrade d'environ 6 % par 1 000 m chez un athlète non acclimaté. Sans
  // cette information, le coach juge des allures d'altitude à l'aune du niveau de la
  // mer et conclut à une perte de forme là où l'athlète est simplement en montagne.
  const elevationM = weather.elevationM;
  const altLoss = altitudeLossPct(elevationM);
  const todayFc = forecast[0] ?? null;
  const hotDays = forecast.filter(f => f.tempMax >= 28);

  // ── MÉTÉO — désormais RÉELLE, plus celle de la montre ───────────────────────
  // `avgTemp` (capteur au poignet) n'est gardé qu'en dernier recours, quand la
  // position de l'athlète est inconnue et qu'aucune prévision n'est disponible.
  const tempRule = todayFc
    ? `${heatAdvice(todayFc.tempMax, todayFc.humidity).note}  [relevé réel à sa position, pas la montre]`
    : avgTemp != null
      ? `${heatAdvice(avgTemp, null).note}  ⚠️ valeur issue du capteur de la montre (au poignet) : peu fiable, à prendre avec prudence.`
      : null;

  // ── MENU DE QUALITÉ — le stimulus PROGRESSE d'une semaine à l'autre ──────────
  // Prescrire « 6×1000 m » chaque semaine indéfiniment ennuie l'athlète et le fait
  // plafonner physiologiquement. On fait tourner 4 variantes par type, du plus court
  // et intense vers le plus long et spécifique, indexées sur la semaine ISO (stable
  // dans la semaine, et qui avance toute seule le lundi suivant).
  const variant = isoWeek % 4;
  const pick = (arr: string[]) => arr[variant % arr.length];

  const qVMA = { type: "VMA", desc: pick([
    `VMA courte : 12×400 m à ~${repPace(104, 400)}/km, récup 45 s trottinés → aiguise la vitesse et la foulée`,
    `VMA moyenne : 8×500 m à ~${repPace(102, 500)}/km, récup 1 min trottinée → tenue de la vitesse`,
    `VMA longue : 6×800 m à ~${repPace(100, 800)}/km, récup 1 min 30 trottinée → soutien du VO2max`,
    `VMA longue : 5×1000 m à ~${repPace(100, 1000)}/km, récup 2 min trottinée → le format le plus proche de la course`,
  ]) };
  // Allure seuil : la vitesse critique MESURÉE prime sur le pourcentage de VMA estimée.
  const sPace = thresholdPace ?? paceAt(86);
  const qSeuil = { type: "Seuil", desc: pick([
    `Seuil fractionné : 4×8 min à ~${sPace}/km, récup 2 min → accumule du temps au seuil sans casser`,
    `Seuil long : 2×15 min à ~${sPace}/km, récup 3 min → apprend à tenir l'effort`,
    `Seuil : 3×10 min à ~${sPace}/km, récup 2 min → le format de référence`,
    `Seuil continu : 25 min d'un bloc à ~${sPace}/km → le plus exigeant mentalement, le plus payant`,
  ]) };
  const qSpec = { type: "Spécifique", desc: goalPace ? pick([
    `Allure spécifique ${raceShort ?? "objectif"} : 6×1 km à ${goalPace}/km, récup 1 min 30 → ancre l'allure`,
    `Allure spécifique ${raceShort ?? "objectif"} : 4×1500 m à ${goalPace}/km, récup 2 min → allonge les portions`,
    `Allure spécifique ${raceShort ?? "objectif"} : 3×2 km à ${goalPace}/km, récup 2 min 30 → se rapproche des conditions de course`,
    `Allure spécifique ${raceShort ?? "objectif"} : 2×3 km à ${goalPace}/km, récup 3 min → simulation de course`,
  ]) : `Allure spécifique objectif (répétitions à l'allure visée)` };
  const qCote = { type: "VMA", desc: pick([
    `Côtes courtes : 10×30 s en montée vive, récup descente trottinée → force et explosivité`,
    `Côtes moyennes : 8×45 s en montée soutenue, récup descente → puissance en montée`,
    `Côtes longues : 6×2 min en montée régulière (FC Z4), récup descente → endurance de force`,
    `Côtes + descente : 5×3 min en montée, DESCENTE travaillée en souplesse → prépare l'excentrique du trail`,
  ]) };
  const qMara = { type: "Spécifique", desc: goalPace ? pick([
    `Bloc allure marathon : 2×20 min à ${goalPace}/km, intégré à la sortie longue`,
    `Bloc allure marathon : 3×15 min à ${goalPace}/km, récup 3 min`,
    `Finish rapide : sortie longue dont les 30 dernières minutes à ${goalPace}/km`,
    `Bloc long : 1×40 min à ${goalPace}/km au cœur de la sortie longue`,
  ]) : `Allure marathon en sortie longue` };
  let menu: { type: string; desc: string }[];
  if (libGoal === "5k" || libGoal === "10k") menu = [qVMA, qSpec, qSeuil];
  else if (libGoal === "semi") menu = [qSeuil, qSpec, qVMA];
  else if (libGoal === "marathon") menu = [qSeuil, qMara, qVMA];
  else if (libGoal === "trail" || libGoal === "ultra") menu = [qCote, qSeuil, qVMA];
  else menu = [qVMA, qSeuil, qSpec];
  const chosen = menu.slice(0, qBudget);
  // Préférence athlète : remplacer la sortie longue course par du VÉLO (cross-training sans impact, comme beaucoup de pros).
  const bikeLong = String((p as Record<string, unknown> | null)?.long_run_mode ?? "run") === "bike";
  const longRunNote = bikeLong
    ? `1 SORTIE LONGUE EN VÉLO (cross-training) À LA PLACE de la sortie longue en course — même durée/volume aérobie (FC Z2, allure conversationnelle), SANS impact pour limiter le risque blessure (choix de l'athlète, comme beaucoup de pros). Pas d'allure /km (pilotée à la FC). ${(libGoal === "marathon" || libGoal === "trail" || libGoal === "ultra") ? "Garde au moins 1 sortie longue EN COURSE par mois pour la spécificité (impact, terrain)." : ""}`.trim()
    : `1 sortie longue facile en Z2${(phase.startsWith("SPÉ") || phase.startsWith("AFFÛ") || libGoal === "marathon") && goalPace ? ` avec un bloc à ${goalPace}/km` : ""}`;

  const weekTarget = `${chosen.length ? chosen.map((s, i) => `• Qualité ${i + 1} : ${s.desc}`).join("\n") : "• Aucune séance dure ce cycle (récupération) : que du facile + mobilité/renfo léger."}
• ${longRunNote}.
• 1 renforcement musculaire (peut se greffer après un footing facile, pas un jour à part obligatoire).
• ≥ 1 jour de repos complet.
• Tout le reste = footing FACILE Z2 (~${paceAt(70)}/km), allure conversationnelle.
RÈGLE 80/20 — À COMPRENDRE : c'est une répartition du VOLUME (temps total), PAS du nombre de séances. ${chosen.length} séance(s) de qualité COURTE(S) (20–40 min d'effort réel) dans une semaine de plusieurs heures = toujours ~80 % facile. Le piège « presque tout en EF + renfo » SOUS-ENTRAÎNE un coureur qui vise un chrono : refuse-le.${expCapped ? `
⛔ PLAFOND LIÉ AU PASSIF : ${runYears != null && runYears < 1 ? "moins d'un an" : `${runYears} ans`} de course → maximum ${expCap} séance(s) de qualité/semaine, quel que soit l'objectif. Le cardio encaisse déjà, les tendons NON. Ce plafond n'est pas négociable, même si l'athlète se sent bien.` : ""}${easeReasons.length ? `\n⚠️ ALLÈGEMENT ce cycle (${easeReasons.join(" ; ")}) → qualité réduite, priorité récupération. La santé d'abord.` : ""}${daysSinceLast != null && daysSinceLast >= 3 && daysSinceLast <= 8 && !easeReasons.length ? `\nREPRISE : ${daysSinceLast} j de repos SANS perte de forme (3–8 j d'arrêt ne déconditionnent PAS). UN footing de remise en route suffit, PUIS on enchaîne la qualité normalement — ne transforme pas ça en semaine molle entière.` : ""}`;

  // ── PLAN MACRO PÉRIODISÉ — bloc complet jusqu'au jour J (base → dév → spécifique → affûtage) ──
  /**
   * Volume de référence pour la semaine à venir.
   *
   * Il se déduit de la charge CHRONIQUE (moyenne 4 semaines), jamais du pic d'une
   * seule semaine. `Math.max(weekKm, avg4wkKm)` gravait le pic dans le marbre :
   * après 62 km sur une base de 23, le plan reproposait 62 km alors que le ratio
   * aigu:chronique était déjà à 1,9, en pleine zone de blessure. Une semaine forte
   * n'est pas un nouveau niveau — c'est une semaine forte.
   *
   * Progression ≤ 10 %, nulle si le ratio est déjà trop haut, et jamais un bond
   * brutal par rapport à ce qui vient d'être couru.
   */
  const targetFrom = (floorKm: number) => {
    const chronic = avg4wkKm > 0 ? avg4wkKm : weekKm;
    // Part de la semaine écoulée que l'on considère acquise. Plus le ratio est haut,
    // moins on entérine le pic — sans pour autant retomber sur la seule moyenne, qu'une
    // période creuse (voyage, coupure) tire artificiellement vers le bas : prescrire
    // 23 km à quelqu'un qui vient d'en courir 62 ne serait pas prudent, juste inutile.
    const keep = load.acr > 1.5 ? 0.3 : load.acr > 1.3 ? 0.6 : 1;
    const blended = chronic + Math.max(0, weekKm - chronic) * keep;
    const growth = load.acr > 1.5 ? 1.0 : load.acr > 1.3 ? 1.05 : 1.1;
    // Et jamais un bond brutal par rapport à ce qui vient d'être réellement couru
    // (reprise après coupure : la moyenne des 4 semaines est alors trop optimiste).
    const capped = Math.min(blended * growth, Math.max(weekKm * 1.4, floorKm));
    return Math.max(floorKm, Math.round(capped));
  };

  // Repli quand rien n'est renseigné : on déduit du niveau, sans jamais dépasser
  // ce qu'il fait DÉJÀ + 1 séance (on ne double pas sa fréquence du jour au lendemain).
  const runsPerWeekNow = new Set(
    // Jours où il a COURU : une journée de randonnée n'est pas une séance de course,
    // et la compter gonflait la fréquence hebdomadaire déduite.
    runs.filter(w => now - new Date(w.date).getTime() <= 7 * 86400000).map(w => String(w.date).slice(0, 10)),
  ).size;
  const declaredDpw = num(p?.days_per_week);
  const availDaysPerWeek = declaredDpw && declaredDpw > 0
    ? Math.min(7, Math.round(declaredDpw))
    : Math.max(3, Math.min(libLevel === "debutant" ? 3 : libLevel === "intermediaire" ? 4 : 5, runsPerWeekNow + 1));
  const availDays = Array.isArray(p?.available_days) && (p.available_days as unknown[]).length
    ? (p.available_days as unknown[]).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
    : [0, 1, 2, 3, 4, 5, 6];

  const macroPlan: { week: number; phase: string; volumeKm: number; quality: string[]; longRunKm: number; focus: string }[] = (() => {
    if (!weeksToRace || weeksToRace < 1 || !vma) return [];
    const W = Math.min(weeksToRace, 26);
    const baseKm = targetFrom(20);
    const menuTypes = (libGoal === "5k" || libGoal === "10k") ? ["VMA", "Allure spé", "Seuil"]
      : libGoal === "marathon" ? ["Seuil", "Allure mara", "VMA"]
      : (libGoal === "trail" || libGoal === "ultra") ? ["Côtes", "Seuil", "Spécifique"]
      : libGoal === "semi" ? ["Seuil", "Allure spé", "VMA"]
      : ["VMA", "Seuil", "Allure spé"];
    const out: { week: number; phase: string; volumeKm: number; quality: string[]; longRunKm: number; focus: string }[] = [];
    for (let i = 0; i < W; i++) {
      const wkUntil = weeksToRace - i;                 // semaines restantes au début de cette semaine
      const ph = wkUntil <= 2 ? "Affûtage" : wkUntil <= 6 ? "Spécifique" : wkUntil <= 11 ? "Développement" : "Base";
      let factor: number;
      if (wkUntil <= 1) factor = 0.55;                  // semaine de course
      else if (wkUntil === 2) factor = 0.72;            // affûtage
      else { factor = Math.min(1.4, 1 + i * 0.06); if ((i + 1) % 4 === 0) factor *= 0.8; } // +6 %/sem, plafond +40 %, semaine allégée /4
      const volumeKm = Math.round(baseKm * factor);
      const longRunKm = Math.round(volumeKm * (ph === "Affûtage" ? 0.22 : 0.32));
      // Semaine en cours : l'état de forme du jour compte. Semaines suivantes : on planifie
      // sur le budget structurel, sinon un ratio aigu:chronique élevé aujourd'hui viderait
      // toute la feuille de route de sa qualité jusqu'au jour J.
      const qBase = i === 0 ? (qBudget || 1) : structuralQBudget;
      // MÊME PLAFOND QUE LE PLAN HEBDOMADAIRE — sinon la feuille de route promet trois
      // qualités que le planificateur, lui, ramène à deux faute de volume : deux
      // documents contradictoires sous les yeux du même athlète.
      // (~11 km par séance de qualité, échauffement et retour au calme compris.)
      const roomForQuality = Math.max(1, Math.floor((volumeKm - longRunKm) / 11));
      const byFrequency = availDaysPerWeek <= 3 ? 1 : availDaysPerWeek <= 5 ? 2 : 3;
      const qn = Math.min(
        ph === "Affûtage" ? (wkUntil <= 1 ? 1 : 2) : ph === "Base" ? Math.min(qBase, 2) : qBase,
        roomForQuality, byFrequency,
      );
      // La priorité dépend de la PHASE. Prendre systématiquement le premier du menu
      // donnait « VMA » à chaque semaine — y compris en phase spécifique, où c'est
      // l'ALLURE DE COURSE qui doit primer.
      const priority = ph === "Base" ? ["VMA", "Seuil"]
        : ph === "Spécifique" || ph === "Affûtage"
          ? [...menuTypes].sort((a, b) => Number(/allure|spécifique|spé/i.test(b)) - Number(/allure|spécifique|spé/i.test(a)))
          : menuTypes;
      const quality = priority.slice(0, Math.max(1, qn));
      const focus = ph === "Base" ? "Volume aérobie + pose de vitesse"
        : ph === "Développement" ? "VMA & seuil — montée en charge"
        : ph === "Spécifique" ? `Allure course${goalPace ? ` (${goalPace}/km)` : ""} + endurance spécifique`
        : wkUntil <= 1 ? "Fraîcheur — repos, rappels d'allure" : "Volume −, on garde l'intensité (fraîcheur jour J)";
      out.push({ week: i + 1, phase: ph, volumeKm, quality, longRunKm, focus });
    }
    return out;
  })();

  // ── VOLUME DE LA SEMAINE & PHASE DU CYCLE ───────────────────────────────────
  // Sans ça, tout le monde recevait « 1h à 1h30 » de sortie longue, qu'il coure
  // 25 ou 100 km par semaine. Le macro-plan calculait déjà ces chiffres : on les branche.
  // Semaine allégée toutes les 4 semaines : sans objectif de course, on s'ancre sur le
  // numéro de semaine ISO (stable d'un jour à l'autre, contrairement à un compteur maison).
  const taper = weeksToRace != null && weeksToRace <= 2 && weeksToRace >= 0;
  const deload = !taper && (macroPlan.length ? macroPlan[0].phase !== "Affûtage" && isoWeek % 4 === 0 : isoWeek % 4 === 0);
  const baseKm = targetFrom(15);
  // Progression plafonnée à +10 %/semaine (+5 % si passif court ou antécédent de fracture).
  const growth = (runYears != null && runYears < 1) || (Array.isArray(p?.injury_zones) && (p.injury_zones as unknown[]).map(String).includes("fracture_fatigue")) ? 1.05 : 1.10;
  const targetKm = macroPlan.length ? macroPlan[0].volumeKm
    : Math.round(baseKm * (taper ? 0.65 : deload ? 0.8 : growth));
  const longRunKm = macroPlan.length ? macroPlan[0].longRunKm : Math.round(targetKm * (taper ? 0.22 : 0.32));
  const cycleLabel = taper ? "AFFÛTAGE — volume fortement réduit, on garde l'intensité pour arriver frais"
    : deload ? "SEMAINE ALLÉGÉE (1 sur 4) — volume −20 %, c'est là que le corps assimile"
    : "montée en charge normale";

  // ── DISPONIBILITÉS DÉCLARÉES ────────────────────────────────────────────────
  // Sans elles, le plan remplissait 7 jours pour tout le monde. Un athlète qui peut
  // courir 3 fois par semaine recevait un plan inapplicable et décrochait.
  const genderLabel = p?.gender === "female" ? "femme" : p?.gender === "male" ? "homme" : p?.gender ? String(p.gender) : "?";
  const text = `PROFIL
- ${p?.full_name ?? "Athlète"} · ${p?.age ?? "?"} ans · ${genderLabel} · ${num(p?.weight_kg) ?? "?"} kg · ${num(p?.height_cm) ?? "?"} cm · chronotype ${p?.chronotype ?? "?"} · mode ${p?.mode ?? "?"}
- NIVEAU estimé : ${level}${vma ? ` (VMA ${vma} km/h${vmaIsEst ? " estimée" : ""})` : ""}
- ANCIENNETÉ en course à pied : ${expLabel ?? "non renseignée (reste prudent sur la charge tant que tu ne sais pas)"}
- TERRAINS habituels : ${terr.labels.length ? terr.labels.join(" + ") : "non renseignés"}${elev ? ` · dénivelé : ${elev.label}` : ""} · D+ réalisé cette semaine : ${elevWeek} m
${p?.gender === "female" ? `- SEXE : femme → besoins en FER et disponibilité énergétique à surveiller (RED-S : une charge élevée + apport insuffisant coupe la progression et fragilise l'os) ; densité osseuse à protéger (renforcement + impacts dosés) ; ${cycle ? "cycle suivi (voir plus bas)" : "si elle synchronise son cycle, adapte l'intensité selon la phase"}. Ne calque pas mécaniquement des repères masculins.` : p?.gender === "male" ? "- SEXE : homme → tendance fréquente à partir trop vite en facile et à sur-doser l'intensité ; verrouille la discipline des footings." : ""}

⚡ VERDICT DE FRAÎCHEUR DU JOUR (calculé à partir de la VFC, du sommeil, de la charge et du ressenti — CETTE CONCLUSION S'IMPOSE À TOI, ne la ré-arbitre pas)
${readinessBlock}

SANTÉ & ANTÉCÉDENTS (contraintes médicales — elles PRIMENT sur l'objectif de performance)
${cond.rules.length ? cond.rules.map((r) => `- ${r}`).join("\n")
  : p?.health_declared ? "- Aucune pathologie — l'athlète l'a CONFIRMÉ explicitement, tu peux t'y fier."
  : "- ⚠️ Section santé JAMAIS renseignée (ce n'est pas « rien à signaler », c'est « on ne sait pas ») : reste un cran prudent sur l'intensité et invite-le à la remplir."}
${inj.rules.length ? inj.rules.map((r) => `- ${r}`).join("\n") : p?.health_declared ? "- Aucune zone de blessure récurrente." : ""}
${healthNotes ? `- 🗣️ Note santé écrite par l'athlète (LIS-LA et tiens-en compte) : « ${healthNotes} »` : ""}${noMaxEffort ? "\n- ⛔ EFFORT MAXIMAL INTERDIT au vu de ses antécédents : pas de VMA à 100 %+, pas de test d'effort, pas de sprint all-out. Le développement passe par le volume et le seuil bas." : ""}

ÂGE & RÉCUPÉRATION
- ${ageRule ?? "Âge non renseigné : applique un espacement prudent de 72 h entre deux séances dures."}
- Espacement MINIMUM entre deux séances dures pour CET athlète : ${hardGapH} h.

PASSIF, TERRAIN & DÉNIVELÉ (leviers d'individualisation — à respecter dans la prescription)
- ${expRule ?? "Ancienneté inconnue : demande-la, et en attendant reste sur une progression prudente (+10 %/sem max)."}
${terr.rules.length ? terr.rules.map((r) => `- ${r}`).join("\n") : "- Terrain habituel inconnu : privilégie des consignes en durée + FC tant que tu ne sais pas sur quelle surface il court."}
${terr.rules.length > 1 ? `- ⚖️ Il alterne PLUSIEURS terrains (${terr.labels.join(", ")}) : c'est un atout anti-blessure, exploite-le. Attribue chaque séance à la surface qui lui convient — les séances CHIFFRÉES à l'allure sur surface dure (route/piste), l'endurance et le long sur terrain souple.` : ""}${terr.paceMeaningless ? `- ⚠️ Au moins un de ses terrains rend l'allure /km NON PERTINENTE (sable, montagne ou neige). Sur ces surfaces : consignes en DURÉE + FRÉQUENCE CARDIAQUE uniquement, jamais d'allure cible. Précise explicitement dans chaque séance sur quelle surface elle doit se faire.` : ""}
${elev ? `- ${elev.rule}` : ""}
${tempRule ? `- MÉTÉO AUJOURD'HUI : ${tempRule}` : ""}${hotDays.length ? `\n- 🔥 CHALEUR ANNONCÉE : ${hotDays.slice(0, 4).map(f => `${f.date.slice(8)}/${f.date.slice(5, 7)} ${Math.round(f.tempMax)}°C`).join(" · ")} → déplace les séances de qualité de ces jours-là tôt le matin, ou échange-les avec un jour plus frais de la semaine. Prévois-le MAINTENANT, pas la veille.` : ""}

CAPACITÉS (tests)
- VMA : ${vma ?? "?"} km/h${vmaIsEst ? ` ⚠️ ESTIMÉE depuis ses séances (aucun test VMA enregistré) → recommande-lui un test VMA pour affiner, et reste un cran prudent sur la 1re séance VMA` : ""} · FC max ${maxHr ?? (vmaIsEst && fcMaxEst ? `~${fcMaxEst} (obs.)` : "?")} · FC repos ${restHr ?? "?"} · FC seuil ${ltHr ?? "?"}
- Zones FC : Z2 facile ${hrZone(0.6, 0.7) ?? "?"} · Z4 seuil ${hrZone(0.8, 0.9) ?? "?"}
- Zones allure : ${paceZones ?? (computedPaces ? `(calculées depuis la VMA) ${computedPaces}` : "non renseignées")}
- Chronos théoriques au potentiel actuel (depuis la VMA) : ${predictions ?? "?"}
${bestLine ? `- 🏅 MEILLEURS EFFORTS RÉELS (42 j) : ${bestLine}\n` : ""}${vrLine ? `- 🦵 ÉCONOMIE DE COURSE (ratio vertical, ${vr!.n} séances) : ${vrLine}\n` : ""}${hrrLine ? `- ❤️‍🩹 RÉCUPÉRATION CARDIAQUE : ${hrrLine}\n` : ""}${thresholdPace ? `- 🎯 ALLURE SEUIL **MESURÉE** : ${thresholdPace}/km (vitesse critique ${(csMs! * 3.6).toFixed(2)} km/h, ajustée sur ses efforts réels)${pc?.dPrime ? ` · réserve anaérobie D' ${pc.dPrime} m` : ""}. UTILISE CETTE VALEUR pour les séances au seuil plutôt qu'un pourcentage de VMA estimée.\n` : ""}${qeLine ? `- 🔍 EXÉCUTION DE SA DERNIÈRE QUALITÉ : ${qeLine}${faded ? " → il a DÉCROCHÉ : la prochaine série doit être plus courte ou plus lente, pas plus dure. Ne répète pas la même erreur." : fade != null && fade <= -6 ? " → il a ACCÉLÉRÉ en fin de série : il en avait sous le pied, tu peux durcir (allure ou volume, pas les deux)." : ""}\n` : ""}- Repères physio : seuil lactique ~${thresholdPace ?? (vma ? paceAt(86) : "?")}/km · vitesse critique ~${vma ? r1(vma * 0.90) : "?"} km/h (${vma ? paceAt(90) : "?"}/km) · VO2max estimé ~${vo2 ?? "?"} ml/kg/min

FORME & RÉCUPÉRATION (aujourd'hui)
- État physiologique : ${state}
- VFC : ${hrvLatest ?? "?"} ms (base 14j ${hrvBase ?? "?"} ms → ${hrvTrend})
- Sommeil : ${freshSleep ? `${freshSleep.sleep_score ?? "?"}/100 cette nuit${lastSleepMin ? ` (${Math.floor(lastSleepMin / 60)}h${String(lastSleepMin % 60).padStart(2, "0")})` : ""}` : "montre non portée la nuit dernière (donnée ignorée)"} · moyenne 7j ${sleepAvg ?? "?"}/100

CHARGE D'ENTRAÎNEMENT
- Volume : ${Math.round(weekKm)} km COURUS cette semaine${crossKm7 > 3 ? ` (+ ${Math.round(crossKm7)} km d'autres sports — vélo/rando/marche : ça fatigue et ça compte dans la charge, mais ce N'EST PAS du volume de course, ne dimensionne rien dessus)` : ""} · ~${Math.round(avg4wkKm)} km/sem (moy. 4 sem.)
- 🎯 VOLUME CIBLE de la semaine à venir : ~${targetKm} km, dont une sortie longue de ~${longRunKm} km. Dimensionne les séances sur CES chiffres, pas sur des durées passe-partout.
- 🔄 PHASE DU CYCLE : ${cycleLabel}.
- 📆 DISPONIBILITÉS : ${availDaysPerWeek} séance(s) de course par semaine${availDays.length < 7 ? `, uniquement les ${availDays.map(d => ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][d]).join(", ")}` : ""}${declaredDpw ? " (déclaré par l'athlète)" : " (déduit de son niveau et de sa pratique actuelle — demande-lui de le préciser)"}. NE DÉPASSE PAS ce nombre : un plan qu'il ne peut pas suivre ne vaut rien.
- ⏱️ Dernière séance DURE réellement effectuée : ${lastHardDaysAgo == null ? "aucune trace récente" : lastHardDaysAgo === 0 ? "AUJOURD'HUI ⚠️ → pas de deuxième séance dure aujourd'hui ni demain" : `il y a ${lastHardDaysAgo} j`}${lastHardDaysAgo != null && lastHardDaysAgo * 24 < hardGapH ? ` ⚠️ moins de ${hardGapH} h se sont écoulées : la prochaine qualité doit attendre.` : ""}${skippedWeekdays.length ? `\n- 🚫 JOURS SYSTÉMATIQUEMENT RATÉS : ${skippedWeekdays.map(d => ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][d]).join(", ")} — prescrits plusieurs fois, jamais courus. Ne t'obstine pas : place-y du repos ou rien, et redistribue ailleurs.` : ""}
- Repos : dernière séance il y a ${daysSinceLast ?? "?"} j · ${restDays7} j sans courir sur les 7 derniers${daysSinceLast != null && daysSinceLast >= 3 ? " ⚠️ reprise après coupure : redémarre en douceur, pas de grosse séance d'emblée" : ""}
- CTL ${Math.round(load.ctl)} (forme) · ATL ${Math.round(load.atl)} (fatigue) · TSB ${Math.round(load.tsb)} (fraîcheur) · ratio aigu:chronique ${r1(load.acr)}${load.acr > 1.5 ? " ⚠️ élevé (risque)" : ""}
- Répartition d'intensité 14j : ${hardTimePct != null ? `**${hardTimePct} % du TEMPS passé en Z3+** (mesure réelle par zone FC — c'est CE chiffre qui compte, cible ≤ 20 %)${hardTimePct > 25 ? " ⚠️ trop d'intensité : il court ses footings trop vite ou empile les séances dures" : hardTimePct < 8 ? " ⚠️ presque aucune intensité : il ne progressera pas sans qualité" : " ✅ polarisation correcte"}` : `${hardShare ?? "?"} % de SÉANCES qualité (approximation : le temps par zone n'est pas encore remonté par sa montre)`}
- 5 dernières séances : ${last5.join(" | ") || "aucune"}${(() => { const g = workouts.slice(0, 10).filter(w => w.gap_min_km != null && (w.elevation_gain_m ?? 0) > 150); return g.length ? `\n- ⛰️ ALLURE AJUSTÉE AU DÉNIVELÉ (GAP) sur ses sorties vallonnées : ${g.slice(0, 3).map(w => `${String(w.date).slice(5, 10)} ${w.gap_min_km}/km (D+${w.elevation_gain_m})`).join(" · ")} — juge sa performance là-dessus, PAS sur l'allure brute qui ne veut rien dire en montée.` : ""; })()}
${pains.length ? `- ⚠️ DOULEUR(S) SIGNALÉE(S) par l'athlète (zone précise) : ${pains.join(", ")} → ADAPTE les prochaines séances à CETTE zone (voir consigne sécurité).` : ""}${fbNotes.length ? `\n- 🗣️ Notes récentes de l'athlète (ressenti/douleur — LIS-LES et tiens-en compte) : ${fbNotes.map(n => `« ${n} »`).join(" ; ")}` : ""}${lastRpe != null ? `\n- Dernier ressenti d'effort (RPE) : ${lastRpe}/10${rpeAvg != null ? ` · moyenne des 3 derniers : ${rpeAvg}/10${rpeHigh ? " ⚠️ il trouve ses séances dures de façon RÉPÉTÉE — le ressenti précède souvent la VFC, allège avant que ça ne casse" : ""}` : ""}` : ""}

ANALYSE APPROFONDIE (croise tous ces facteurs)
- VO2max estimé : ${vo2 ?? "?"} ml/kg/min${efTrend ? ` · efficacité aérobie ${efTrend}` : ""}
- Tendance VFC (7j vs 7j) : ${hrvWeekTrend ?? "n/c"}
- Monotonie de charge : ${monotony}${monotony > 2 ? " ⚠️ trop uniforme → varie l'intensité (risque surcharge/maladie)" : " (ok)"}
- Forme de course : ${[cadence ? `cadence ${cadence} spm` : null, stride ? `foulée ${stride} m` : null, vosc ? `oscillation ${vosc} cm` : null, gct ? `contact sol ${gct} ms` : null, power ? `puissance ${power} W` : null, decoupling != null ? `dérive cardiaque ${decoupling}%${decoupling > 5 ? " (>5 % → endurance à renforcer)" : ""}` : null].filter(Boolean).join(" · ") || "n/c"}
- Sommeil détaillé : ${[deepPct != null ? `profond ${deepPct}%` : null, remPct != null ? `REM ${remPct}%` : null, sl?.body_battery_end != null ? `énergie ${sl.body_battery_end}/100` : null, sl?.respiration_rate != null ? `respiration ${sl.respiration_rate}/min` : null].filter(Boolean).join(" · ") || "n/c"}
${altLoss > 0 ? `- ⛰️ ALTITUDE : il s'entraîne à ~${Math.round(elevationM!)} m. À cette altitude, la performance aérobie d'un athlète non acclimaté baisse d'environ ${altLoss} % — soit ~${Math.round(altLoss * 2.8)} s/km sur ses allures habituelles. NE CONCLUS PAS à une perte de forme : ses chronos SONT censés être plus lents ici. Juge-le à la FC et au ressenti, et sache que le retour au niveau de la mer lui donnera un gain mécanique de quelques jours.\n` : ""}- Terrain & environnement : ${elevWeek} m D+ cette semaine${avgTemp != null ? ` · ~${avgTemp}°C récemment${avgTemp >= 25 ? " (chaleur → ralentir l'allure, hydrater)" : ""}` : ""}${cycle ? `\n- Cycle menstruel : phase ${cycle} → adapte l'intensité (pousser en folliculaire, prudence en lutéale/prémenstruel)` : ""}

EXÉCUTION & ADHÉRENCE (boucle adaptative — fais ÉVOLUER la suite selon ce qu'il fait VRAIMENT)
- Discipline des footings : ${easyDiscipline}
- Adhérence au plan prescrit : ${adherence}

OBJECTIF DE COURSE
${objLines.length ? objLines.join("\n") : "• Aucun objectif de course → vise une PROGRESSION GLOBALE selon son profil/niveau, ses dernières séances et sa récupération (sommeil/VFC) : base aérobie, développement progressif de la VMA et du seuil, régularité, polarisé 80/20. Ne réclame pas d'objectif."}
• Phase d'entraînement recommandée : ${phase}

STRUCTURE CIBLE DE LA SEMAINE (squelette à RESPECTER — calculé pour CE coureur ; tu ajustes l'ordre des jours et les allures à sa fraîcheur, mais tu tiens le nombre de séances de qualité indiqué, ni moins par excès de prudence, ni plus)
${weekTarget}

GARDE-FOUS ANTI-BLESSURE (à respecter ABSOLUMENT — la santé prime sur la performance)
- Progressivité : +10 % de charge/volume maximum par semaine.${load.acr > 1.4 ? " ⚠️ Ratio aigu:chronique élevé → prévoir une semaine ALLÉGÉE." : ""}${monotony > 2 ? " ⚠️ Monotonie élevée → varier l'intensité, garantir un vrai jour facile/repos." : ""}
- Jamais 2 séances de qualité d'affilée ; **≥ ${hardGapH} h entre deux séances dures pour CET athlète** (valeur calculée sur son âge) ; ≥ 1 jour de repos/semaine.
- ${pains.length ? `⚠️ DOULEUR SIGNALÉE (${pains.join(", ")}) → ADAPTE la/les prochaine(s) séance(s) à CETTE zone, ne JAMAIS forcer sur une douleur : tendon d'Achille/mollet → supprime vitesse, côtes et pliométrie, footing plat très court ; genou/ITB → évite descentes, longues sorties et fractionné, réduis le volume ; tibia/périoste → coupe le volume et les surfaces dures, privilégie le croisé ; ischio/cuisse → pas de sprint ni d'allure spécifique, allure douce ; hanche/psoas → pas de fractionné court ; pied/cheville → repos ou croisé SANS impact (vélo/natation/aqua-jogging). Si la douleur est vive/persistante (≥ plusieurs jours) → REPOS de course + conseille une consultation (kiné/médecin). La santé prime sur le plan.` : "Au moindre signal de douleur → adapter immédiatement, pas de stoïcisme."}
- ${daysSinceLast != null && daysSinceLast >= 4 ? "Reprise après coupure → repartir un cran en dessous, remonter progressivement." : "Si VFC sous la base ou sommeil dégradé → alléger la séance du jour."}
- ~80 % du volume en facile (Z1-Z2). But ultime : faire RÉUSSIR l'objectif SANS blessure.

PALETTE DE SÉANCES (niveau ${libLevel} · objectif ${libGoal}) — pioche les plus pertinentes et ADAPTE allures/durées/volume à CE coureur ; combine-les avec logique (périodisation, 80/20), ne les empile pas :
${catalog}`;

  return {
    text, objective, daysToRace, weeksToRace, athleteName: String(p?.full_name ?? "Athlète"), vma,
    weekPlan: { qBudget, quality: chosen, easyPace: vma ? paceAt(70) : null, eased: easeReasons.length > 0 },
    longRunMode: bikeLong ? "bike" : "run",
    readiness: { level: readyLevel, reasons: [...redFlags, ...orangeFlags], advice: readinessRule },
    hardGapHours: hardGapH,
    easyPace: vma ? paceAt(70) : null,
    lastHardDaysAgo,
    volume: { weekKm: Math.round(weekKm), avg4wkKm: Math.round(avg4wkKm), targetKm, longRunKm },
    cycle: { deload, taper, label: cycleLabel },
    skippedWeekdays,
    availability: { daysPerWeek: availDaysPerWeek, days: availDays },
    forecast,
    altitude: { elevationM, lossPct: altLoss },
    tooMuchIntensity: hardTimePct != null && hardTimePct > 25 ? hardTimePct : null,
    hillyTraining: elevWeek >= 400 || terr.paceMeaningless,
    thresholdPace,
    macroPlan,
  };
}

// VMA « effective » d'un athlète : test enregistré sinon estimation depuis ses séances (même
// logique que le dashboard). Sert aux routes admin pour pousser des cibles d'allure vers la montre.
export async function getEffectiveVma(sb: SupabaseClient, userId: string): Promise<number | null> {
  const [baseRes, woRes, profRes] = await Promise.all([
    sb.from("performance_baselines").select("vma_kmh").eq("user_id", userId).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    fetchWorkouts(sb, userId),
    sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);
  const stored = Number((baseRes.data as { vma_kmh?: number } | null)?.vma_kmh) || 0;
  if (stored > 0) return stored;
  // MÊME ORDRE DE FIABILITÉ QUE LE COACH — sans quoi la montre recevrait des allures
  // calculées autrement que celles affichées dans l'application.
  const prof = profRes.data as { garmin_vo2max?: number | null; pace_curve?: { best?: { m: number; sec: number }[] } | null } | null;
  const fromCurve = vmaFromPaceCurve(prof?.pace_curve?.best);
  if (fromCurve && fromCurve > 0) return fromCurve;
  // Course à pied uniquement : une sortie vélo produirait une VMA fantaisiste.
  const wks = ((woRes.data ?? []) as Wk[]).filter(w => isRun(w.sport));
  const obsMaxHr = Math.max(0, ...wks.map((w) => Number(w.max_hr ?? 0)));
  const fromRuns = bestVmaFromWorkouts(wks, obsMaxHr > 120 ? obsMaxHr : null);
  if (fromRuns && fromRuns > 0) return fromRuns;
  const garminVo2 = Number(prof?.garmin_vo2max) || 0;
  return garminVo2 > 0 ? vmaFromVo2max(garminVo2) : null;
}
