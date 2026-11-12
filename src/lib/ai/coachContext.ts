import type { createClient } from "@/lib/supabase/server";
import { sansAllureInconnue } from "@/lib/coach/allureInconnue";
import { picsSaison, avecSaison } from "@/lib/coach/ciblesFcServeur";
import { referencesFc, ciblesFcAthlete, footingTropIntense, maxDeReference, airFroid, PIC_FC_JOURS, type CiblesFc } from "@/lib/coach/fcCible";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSessionCatalog, type Level, type Goal } from "@/data/workoutLibrary";
import { menuSelonDenivele, preferenceDenivele } from "@/lib/coach/denivele";
import { volumeAvecCible, volumeCible } from "@/lib/coach/volumeCible";
import { HEALTH_CONDITIONS, INJURY_ZONES, healthCoachLines } from "@/data/healthCatalog";
import { efficaciteParBloc, tendanceEfficacite, ameliorationAttendue } from "@/lib/running/progression";
import { relireExecution, corrigerAllure } from "@/lib/coach/relecture";
import { exigenceTerrain, denivelePartSemaine } from "@/lib/coach/terrain";
import { planNutritionCourse } from "@/lib/coach/nutritionCourse";
import { robustWeeklyKm, demonstratedWeeklyKm, longRunForWeek, longRunPeakKm, longRunShare, longRunGap, type RaceGoal } from "@/lib/running/volume";
import { buildWeightPlan, weightModeEligibility, type WeightPlan } from "@/lib/weight/energy";
import { weightCoachBlock, weightTrainingRules, type WeightTrainingRules } from "@/lib/weight/coaching";
import { terrainCoachBlock } from "@/data/terrainCatalog";
import { forecastWithElevation, altitudeLossPct, heatAdvice, windAdvice, archiveDailyMax, heatAcclimation, type DayWeather } from "@/lib/weather/openMeteo";
import { bestVmaFromWorkouts, vmaFromPaceCurve, effectiveVma, easyPaceFromHeartRate, predictRaceSec } from "@/lib/running/fitness";
import { isRun } from "@/lib/intervals/sport";
import { summarizeCross, fmtMinutes, type CrossSummary } from "@/lib/coach/crossTraining";
import { computeQualityBudget } from "@/lib/coach/qualityBudget";
import { avertissementsAge } from "@/lib/coach/ageDistance";
import { etatDouble, seanceDoubleSeuil, doseDoubleSeuil, type EtatDouble } from "@/lib/coach/doubleSessions";
import { DOUBLE_T } from "@/lib/coach/doubleSessionsI18n";
import { warmCoolMin } from "@/lib/watch/intervals";
import { tr, nLoc, nRaw, type I18nText } from "@/lib/i18n/multi";
import type { Lang } from "@/lib/i18n/translations";
import { MOTIF_T } from "@/lib/coach/reasonsI18n";
import { detteSommeil, chuteVfc, ecartJours, FRAICHEUR_JOURS } from "@/lib/coach/recuperation";
import { COLONNES_VFC, etatRelatif, precisionMetrique, serieVfc } from "@/lib/health/vfc";
import { plusLongueLacune } from "@/lib/coach/lacune";
import { traduireDouleur } from "@/lib/coach/painZonesI18n";

/** « 4 h 24 » — une dette se lit en heures, pas en 264 minutes. */
const dureeLoc = (min: number, l: Lang) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (l === "en") return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
  if (l === "de") return h ? `${h} Std. ${m} Min.` : `${m} Min.`;
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
};
import { QUALITE_T } from "@/lib/ai/qualityI18n";
import { aujourdhui, FUSEAU_DEFAUT, formatDateCivile } from "@/lib/time/fuseau";
import { apresCourse, facteurVolumeApresCourse, type PhaseApresCourse } from "@/lib/coach/apresCourse";
import { repriseApresArret, partApresArret } from "@/lib/coach/repriseArret";
import { programmeMarcheCourse, dureesMarcheCourse, type SeanceMarcheCourse } from "@/lib/coach/marcheCourse";
import { testEnVigueur, allureFacileMaxSec, fmtAllure, TYPE_TEST_LACTATE, type TestLactate } from "@/lib/coach/lactate";
import { coursesDeSaison, prochaineCourseA, courseSecondaireDeLaSemaine, coursesPassees, PART_VOLUME_COURSE_B, type Priorite } from "@/lib/coach/saison";
import { objectifEnCours, estOfficielle } from "@/lib/coach/prochaineCourse";
import { decaleJour } from "@/lib/streak/compute";
import { niveauDeVma } from "@/lib/running/niveau";
import { libellesActifs, PEREMPTION_JOURS, type Douleur } from "@/lib/health/douleurs";
import { douleursDeSeance } from "@/lib/health/douleursSeance";
import { pausesDeTrace, pointsStockes, vitesseEnMouvement, dureeCourte } from "@/lib/activities/pauses";
import { journaliserEchecUneFois } from "@/lib/journal/echecServeur";
import { TYPE_CONSIGNES, consignesEnVigueur, kmPourDuree, type ConsignesKine } from "@/lib/health/consignesKine";
import { TYPE_BILAN, BILAN_T, bilanDuJour, effetBilan, type BilanMatin } from "@/lib/health/bilanMatin";
import { TYPE_APTITUDE, APTITUDE_T, lireAptitude, avisAttendu } from "@/lib/health/aptitude";
import { recupAllongee, verdictExecution } from "@/lib/coach/arretsQualite";
import { arretsMemorises, memoriserArrets } from "@/lib/activities/cacheArrets";
import { estUnePanne } from "@/lib/dashboard/lectures";
import type { PausesSeance } from "@/lib/activities/pauses";
import { qualiteRecente as qualiteDesSeptJours, type QualiteRecente, type Prescription } from "@/lib/coach/qualiteRecente";
import { phaseDeSemaine, specifiqueEnTete, semainesAffutage, partAffutage, allegementDuBloc } from "@/lib/coach/phase";

type SB = Awaited<ReturnType<typeof createClient>>;

export type CoachObjective = {
  race: string; distanceKm: number; raceDate: string;
  targetSeconds: number; targetTime: string; targetPace: string;
  /** Heure de départ « HH:MM », saisie par l'athlète. Absente du catalogue : les
   *  agrégateurs qui l'alimentent ne publient pas d'heure (vérifié à la source). */
  heureDepart?: string | null;
  /** `false` pour un défi personnel (test chrono, tentative de record) : ni catalogue,
   *  ni règlement fédéral. Absent = course officielle (`lib/coach/prochaineCourse`). */
  officielle?: boolean;
  /** La course passée que cet objectif a remplacée (`lib/coach/objective`). */
  precedente?: { race: string; raceDate: string; distanceKm: number } | null;
};

/**
 * Une séance de qualité du menu de la semaine.
 *
 * `desc` est la version FRANÇAISE, et elle est canonique : c'est elle que le plan
 * insère dans le corps de séance, donc celle que `lib/watch/intervals.ts` analyse pour
 * fabriquer les étapes Garmin (« N×DISTANCE à ALLURE, récup DURÉE »). `descAll` porte
 * les 5 langues et ne sert QU'À L'AFFICHAGE — la traduire dans `desc` casserait la
 * poussée montre en silence.
 */
export type QualitySession = {
  type: string; desc: string; descAll: I18nText;
  /** Journée de DOUBLE SEUIL : la séance du matin (`desc` est celle du soir). */
  matin?: I18nText;
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
  id?: string; date: string; type?: string | null; sport?: string | null; distance_km?: number | null; duration_seconds?: number | null;
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
/**
 * FC moyenne, en part de la FC max, à partir de laquelle une séance est DURE.
 *
 * ⚠️ C'était 0,90 côté `isHardWk` alors que `classifyRun` place la barre du seuil à
 * 0,85 : deux définitions du même mot, dans le même fichier. Sur un athlète réel
 * (FC max 212), 0,90 exige une FC MOYENNE de 191 sur toute la séance — un effort de
 * course, jamais tenu à l'entraînement. Résultat : le coach croyait sa dernière séance
 * dure vieille de 65 jours alors qu'elle datait de 13, et il espaçait donc les qualités
 * à partir d'un passé imaginaire. Une seule constante désormais, pour les deux.
 */
export const PART_FC_DURE = 0.85;

export function classifyRun(w: { distance_km?: number | null; duration_seconds?: number | null; avg_hr?: number | null; type?: string | null }, fcMax: number | null): string {
  const km = w.distance_km ?? 0, sec = w.duration_seconds ?? 0;
  if (km <= 0 || sec <= 0) return String(w.type ?? "séance");
  if (km >= 18 || sec >= 95 * 60) return "Sortie longue";
  const pct = (w.avg_hr && fcMax) ? w.avg_hr / fcMax : null;
  if (pct != null) {
    if (pct >= 0.90) return "Intense (VMA/course)";
    if (pct >= PART_FC_DURE) return "Seuil/Tempo";
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
  weekPlan: {
    qBudget: number; quality: QualitySession[]; easyPace: string | null; eased: boolean;
    /** La dernière qualité n'a survécu que grâce au plancher « préparation en cours » :
     *  elle doit être prescrite RACCOURCIE, et le plan doit dire pourquoi. Sans ce
     *  drapeau, le plan afficherait une séance normale au milieu d'une semaine allégée. */
    floored: boolean;
    /** Semaine de reprise après une course (`lib/coach/apresCourse`) : la qualité est la
     *  séance courte au seuil, annoncée comme telle. Optionnel : un contexte sérialisé
     *  avant cette version ne l'a pas. */
    reprise?: boolean;
    /** Premier jour du plan (0 = aujourd'hui) où une qualité peut être posée. */
    qualiteDes?: number;
  };
  /** Doubles séances (matin + soir) : autorisées ou non, et ce qui manque le cas
   *  échéant. Une case cochée qui ne produit rien est un mensonge silencieux —
   *  l'athlète doit pouvoir lire POURQUOI son plan n'a pas changé. */
  doubles: EtatDouble;
  /** Sport pratiqué EN DEHORS de la course sur 7 jours, en minutes et en TSS.
   *  Exposé au plan déterministe (et pas seulement au prompt de l'IA) pour qu'un
   *  allègement dû à une semaine de vélo ou de randonnée puisse le DIRE. */
  cross: CrossSummary;
  /** Ce que la séance des 3 derniers jours a montré, et ce que ça change au plan.
   *  `null` s'il n'y a rien de récent — on n'affiche pas un constat sur une sortie
   *  d'il y a deux semaines en la présentant comme « ta dernière séance ». */
  lastSession: {
    date: string;
    /** « Seuil/Tempo · 15,0 km · 72 min · 4'48/km · 152 bpm » — champs présents seulement. */
    label: string;
    /** Constats mesurés, jamais déduits d'une donnée absente. */
    shows: string[];
    /** L'effet sur le plan : sans ça, le constat n'est qu'un bulletin. */
    effect: string;
  } | null;
  longRunMode: "run" | "bike"; // préférence : sortie longue en course ou remplacée par du vélo (cross-training)
  // Verdict de fraîcheur du jour (déterministe) — affiché au coach et imposé à l'IA.
  readiness: {
    level: "vert" | "jaune" | "orange" | "rouge";
    /** Motifs en FRANÇAIS — version canonique (prompt du modèle, bandeau du calendrier). */
    reasons: string[];
    /** Les mêmes motifs dans les 5 langues : le plan les recopie dans le « pourquoi »
     *  des séances, qui doit être entièrement dans la langue de l'athlète. */
    reasonsAll: I18nText[];
    advice: string;
  };
  /** Heures minimales entre deux séances dures pour CET athlète (calculé sur son âge). */
  hardGapHours: number;
  /** Allure d'endurance facile (~70 % VMA), en min/km — null si VMA inconnue. */
  easyPace: string | null;
  /** Jours écoulés depuis la dernière séance DURE réellement effectuée (0 = aujourd'hui). */
  lastHardDaysAgo: number | null;
  /** Les jours de qualité des sept derniers jours — courus, ou prescrits et MANQUÉS. Le plan
   *  les compte dans son budget glissant ; sans eux, une séance non faite revenait chaque
   *  matin. Optionnel : un contexte sérialisé avant cette version ne l'a pas. */
  qualiteRecente?: QualiteRecente;
  /** Volumes cibles de la semaine, en km. `longRunPlanned` = ce que la périodisation
   *  prévoyait AVANT réduction pour fatigue ; `longRunEased` dit si la coupe a eu lieu,
   *  pour que la séance puisse l'expliquer au lieu d'afficher un chiffre inexpliqué. */
  volume: { weekKm: number; avg4wkKm: number; targetKm: number; longRunKm: number; longRunPlanned: number; longRunEased: boolean };
  /** Où l'on se situe dans le cycle : semaine allégée, affûtage, ou montée en charge. */
  cycle: { deload: boolean; taper: boolean; label: string; /** Semaine qui précède l'affûtage : pas d'allègement du bloc (09/11/2026). */ veilleAffutage?: boolean };
  /** Jours de la semaine (0 = dimanche) systématiquement prescrits ET jamais réalisés. */
  skippedWeekdays: number[];
  /** Aucune séance de course connue : on ne prescrit rien qui suppose un passé. */
  noHistory: boolean;
  /** Médianes de foulée sur les séances récentes — chacune `null` si jamais mesurée. */
  forme: { ratioVertical: number | null; cadence: number | null } | null;
  /** Zones déclarées fragiles par l'athlète (profil santé). */
  zonesFragiles: string[];
  /** Douleurs ACTIVES (déclarées dans Santé, ou signalées après une séance) : celles qui
   *  passent le jour au rouge. Le renforcement les lit (rien d'ajouté, zone épargnée).
   *  Optionnel : un contexte sérialisé avant le 09/11/2026 ne l'a pas. */
  douleursActives?: string[];
  /** Ce que la douleur a retiré au plan, comparé au même athlète sans douleur ; `null` sans douleur. */
  effetsDouleur?: { qualiteRetiree: number; sortieLongue: { prevueKm: number; reduiteKm: number } | null; lignesDroites: boolean } | null;
  /** Les consignes du kinésithérapeute en vigueur, et la distance que tient leur durée maximale. */
  consignes?: (ConsignesKine & { kmMax: number | null }) | null;
  /** Dates (AAAA-MM-JJ) des sorties de course des 7 derniers jours, une par sortie : le nombre
   *  de sorties fixé par le kinésithérapeute se compte sur 7 jours GLISSANTS. */
  sortiesRecentes?: string[];
  /** Le bilan du matin de CE jour (lib/health/bilanMatin) et ce qu'il fait au plan ; `null` sans bilan. */
  bilanMatin?: (BilanMatin & { allege: boolean; stressHaut: boolean }) | null;
  /** Le questionnaire d'aptitude (lib/health/aptitude) : `attente` = situation cochée, avis médical pas encore donné. */
  aptitude?: { attente: boolean } | null;
  /** Disponibilités déclarées : nb de séances de course/semaine et jours praticables (0 = dim). */
  availability: { daysPerWeek: number; days: number[] };
  /** Prévisions RÉELLES à 7 jours (Open-Meteo) — vide si la position est inconnue. */
  forecast: DayWeather[];
  /** Altitude du lieu d'entraînement (m) et perte aérobie associée (%). */
  altitude: { elevationM: number | null; lossPct: number };
  /** Durées d'échauffement / retour au calme du profil — MÊMES valeurs que celles
   *  appliquées par la montre, pour que le texte et la séance envoyée coïncident. */
  warmCool: { warm: number; cool: number };
  /** Acclimatation à la chaleur : facteur multiplicatif de la pénalité (1 = non acclimaté). */
  heatAcclim: { hotDays: number; factor: number; label: string };
  /** % du temps passé en Z3+ s'il dépasse la cible (footings trop rapides), sinon null. */
  tooMuchIntensity: number | null;
  /**
   * Les cibles de FC MESURÉES de l'athlète (`ciblesFcAthlete`) : battements envoyés à la
   * montre pour l'endurance et la récupération, et plafond au-delà duquel un footing compte
   * comme une séance dure. `null` sans FC max mesurée, et pour le palier gratuit.
   */
  ciblesFc: CiblesFc | null;
  /** true si l'athlète s'entraîne réellement en terrain vallonné (D+ hebdo significatif). */
  hillyTraining: boolean;
  /** Allure seuil MESURÉE (min/km) issue de la vitesse critique, si disponible. */
  thresholdPace: string | null;
  // Plan macro périodisé semaine par semaine jusqu'au jour J.
  macroPlan: { week: number; phase: string; volumeKm: number; quality: string[]; longRunKm: number; focus: string }[];
  /** Avertissements sur l'objectif (chrono hors de portée, préparation trop courte pour
   *  la distance). Destinés à l'ÉCRAN autant qu'à l'IA — ils ne servaient à rien tant
   *  qu'ils ne quittaient pas le prompt. */
  objectiveWarnings: string[];
  /** Récupération d'après-course en cours (`lib/coach/apresCourse`), pour les écrans qui la rappellent. */
  recuperation: { course: string; reprise: string; fin?: string; phase?: PhaseApresCourse } | null;
  /** Programme marche-course en cours (`lib/coach/marcheCourse`). Optionnel : un contexte
   *  sérialisé avant cette version ne l'a pas. */
  marcheCourse?: { etape: number; total: number; seance: SeanceMarcheCourse } | null;
  /** Course B ou C dans les sept jours du plan (`lib/coach/saison`), hors objectif visé. */
  courseSecondaire?: { idx: number; nom: string; distanceKm: number | null; priorite: Priorite } | null;
  /** Construit pour le palier gratuit (`LectureContexte.objectifSeul`) : l'objectif et le
   *  déclaré, aucune mesure. Optionnel : un contexte sérialisé avant cette version ne l'a pas. */
  objectifSeul?: boolean;
  /** Construit pour Starter (`LectureContexte.essentielle`) : ni VFC, ni dérive cardiaque,
   *  ni foulée. Les écrans s'en servent pour dire ce que Premium lirait en plus. */
  essentielle?: boolean;
  /** Mode perte de poids — `null` s'il n'est pas activé OU si le profil n'y est pas
   *  éligible. Quand il est présent, il PLAFONNE la qualité et la progression du volume
   *  dans le plan déterministe, il ne se contente pas d'informer l'IA. */
  weightLoss: { plan: WeightPlan; rules: WeightTrainingRules } | null;
};

// Rassemble et ANALYSE toutes les données de l'athlète → briefing pour l'IA coach.
/**
 * Séances de l'athlète, en tolérant qu'une migration soit en retard.
 *
 * PostgREST rejette la requête ENTIÈRE si une seule colonne du `select` n'existe pas
 * encore (42703). Nommer `sport` avant l'application de la migration 015 priverait
 * donc le coach de TOUT l'historique, et pas seulement du sport. On retente sans.
 */
async function fetchWorkouts(sb: SB, userId: string, objectifSeul = false, essentielle = false) {
  // Palier gratuit : le VOLUME seul (quand, quoi, combien de kilomètres et de minutes).
  // Aucune fréquence cardiaque, puissance, foulée ni charge mesurée — voir `LectureContexte`.
  // Starter : l'ESSENTIEL, sans la foulée ni la dérive cardiaque.
  const cols = objectifSeul
    ? COLONNES_VOLUME
    : essentielle ? COLONNES_ESSENTIELLES
    : `${COLONNES_ESSENTIELLES},${COLONNES_AVANCEES}`;
  const q = async (c: string) => {
    const r = await sb.from("workouts").select(c).eq("user_id", userId).order("date", { ascending: false }).limit(60);
    return { data: r.data as unknown as Wk[] | null, error: r.error };
  };
  const withSport = await q(`${cols},sport`);
  return withSport.error ? await q(cols) : withSport;
}

/**
 * CE QUE LE CONTEXTE A LE DROIT DE LIRE.
 *
 * `objectifSeul` — LE PALIER GRATUIT (Cyprien, 22/10/2026) : « l'IA donne les séances
 * selon ses objectifs, mais en aucun cas le coach n'analyse ses séances, son sommeil,
 * ses caractéristiques physiques, physiologiques ». Le plan se bâtit alors sur :
 *  · l'OBJECTIF (course, date, chrono, distance) ;
 *  · ce que l'athlète DÉCLARE : disponibilités, terrains, VMA du test, âge (espacement
 *    des séances dures), pathologies, zones fragiles, douleurs signalées, et le ressenti
 *    d'après-séance (RPE, depuis le 30/10/2026) ;
 *  · les KILOMÈTRES courus — date, durée, distance, dénivelé, type —, seul garde-fou
 *    contre une montée de volume qui blesse.
 * Il NE lit PAS : VFC, sommeil, fréquence cardiaque (repos, max, zones), puissance,
 * foulée, charge mesurée (TSS), dérive cardiaque, courbe d'allure, VO2max Garmin,
 * relecture des répétitions, notes de séance, chaussures, poids et
 * morphologie, cycle, position (donc ni météo, ni altitude).
 *
 * ⚠️ LES LECTURES INTERDITES NE SONT PAS FAITES, ELLES NE SONT PAS « IGNORÉES ». Rendre
 * une réponse vide en amont, c'est faire voir au moteur un athlète dont la montre ne
 * mesure pas ces signaux — un cas qu'il sait déjà traiter honnêtement (« inconnu »,
 * jamais une valeur par défaut). Filtrer en aval aurait laissé la moindre lecture
 * oubliée irriguer le plan gratuit.
 *
 * ⚠️ LE PROFIL SE LIT EN ENTIER PUIS SE FILTRE PAR LISTE BLANCHE, pas par une liste de
 * colonnes dans le `select` : PostgREST rejette la requête ENTIÈRE si une seule colonne
 * manque (schéma appliqué à la main), et le plan perdrait jusqu'aux disponibilités. Et
 * une liste BLANCHE, pas noire : une colonne de mesure ajoutée demain reste hors du
 * plan gratuit sans que personne ait à y penser.
 */
export type LectureContexte = {
  objectifSeul?: boolean;
  /**
   * `essentielle` — STARTER (Cyprien, 30/10/2026 : « le Starter doit analyser un peu moins,
   * le Premium doit tout analyser »). Le plan s'adapte toujours à ce que l'athlète FAIT et
   * à la façon dont il RÉCUPÈRE : séances, fréquence cardiaque (repos, max, zones), charge,
   * sommeil, douleurs, ressenti, météo et altitude, chaussures. Il NE LIT PAS les signaux
   * fins que Premium ajoute : la VFC, la dérive cardiaque, la FC de récupération et la
   * foulée (cadence, puissance, temps de contact, oscillation et ratio verticaux, longueur
   * de foulée). Même règle que le gratuit : la lecture n'est PAS FAITE, et le moteur traite
   * l'athlète comme celui dont la montre ne mesure pas ces signaux. Ignoré si `objectifSeul`.
   */
  essentielle?: boolean;
  /**
   * La météo DÉJÀ LUE pour ce même athlète par un autre contexte, à l'instant (le rappel
   * « Premium aurait changé ton plan » bâtit le plan complet juste après le plan Starter).
   * Elle ne dépend pas de la formule : la relire coûterait deux appels à Open-Meteo, et un
   * bulletin rafraîchi entre les deux lectures ferait diverger les deux plans sur la
   * chaleur, un écart que le rappel attribuerait à tort à ce que lit Premium.
   */
  meteo?: Pick<AthleteContext, "forecast" | "altitude" | "heatAcclim">;
};

/** Les seules colonnes de séance lues pour le palier gratuit : le volume, rien du corps. */
const COLONNES_VOLUME = "date,type,distance_km,duration_seconds,elevation_gain_m";
/** Starter : le volume, la fréquence cardiaque et la charge — ce qu'il faut pour adapter. */
const COLONNES_ESSENTIELLES = "id,date,type,distance_km,duration_seconds,elevation_gain_m,avg_hr,max_hr,training_effect,tss,weather_temp_c,gap_min_km,hr_zone_seconds,intensity_pct";
/** Premium en plus : la foulée, la dérive cardiaque et la FC de récupération. */
export const COLONNES_AVANCEES = "avg_cadence_spm,avg_power_watts,vertical_oscillation_cm,ground_contact_ms,stride_length_m,vertical_ratio_pct,cardiac_decoupling,hrr_bpm";

/** Les seules colonnes du profil lues pour le palier gratuit — toutes DÉCLARÉES. */
export const PROFIL_DECLARE = [
  "id", "full_name", "preferred_language", "age", "mode",
  "health_conditions", "health_declared", "health_notes", "injury_zones",
  "elevation_pref", "main_terrain", "main_terrains", "running_years",
  "days_per_week", "available_days", "warmup_min", "cooldown_min",
  "target_weekly_km", "double_sessions", "long_run_mode",
  // « Peux-tu courir 30 min sans t'arrêter ? » : un débutant complet sur le plan gratuit
  // a autant besoin de la marche-course qu'un abonné.
  "peut_courir_30min",
] as const;

const garder = (o: Record<string, unknown> | null, cles: readonly string[]) =>
  o ? Object.fromEntries(cles.filter((k) => k in o).map((k) => [k, o[k]])) : null;

export async function buildAthleteContext(sb: SB, userId: string, lecture: LectureContexte = {}): Promise<AthleteContext> {
  const objectifSeul = !!lecture.objectifSeul;
  const essentielle = !objectifSeul && !!lecture.essentielle;
  // Une lecture qu'on ne fait pas : la forme exacte d'une réponse vide de PostgREST.
  const nonLu = () => Promise.resolve({ data: [] as never[], error: null });
  const nonLuUne = () => Promise.resolve({ data: null, error: null });
  const [profileRes, baseRes, hrvRes, sleepRes, woRes, fbRes, painRes, shoeRes, objRes, csRes, wlRes, histRes, sleepDatesRes, hrvDatesRes, formeRes, fcMaxRes, lactateRes, planifieesRes] = await Promise.all([
    sb.from("profiles").select("*").eq("id", userId).single(),
    sb.from("performance_baselines").select("*").eq("user_id", userId).order("tested_at", { ascending: false }).limit(1).single(),
    objectifSeul || essentielle ? nonLu() : sb.from("hrv_data").select(COLONNES_VFC).eq("user_id", userId).order("date", { ascending: false }).limit(30),
    objectifSeul ? nonLu() : sb.from("sleep_data").select("sleep_score,total_sleep_min,deep_sleep_min,rem_sleep_min,body_battery_end,respiration_rate,date").eq("user_id", userId).order("date", { ascending: false }).limit(30),
    fetchWorkouts(sb, userId, objectifSeul, essentielle),
    // Les ressentis des 15 DERNIERS JOURS, pas les cinq derniers : une douleur compte 14 jours
    // (lib/health/douleursSeance), et un « Aucune douleur » ou un « c'est passé » plus ancien que
    // le 5e ressenti restait invisible au coach alors que l'écran Santé le voyait (relecture du
    // 10/11/2026). Les lectures du ressenti (RPE, notes) prennent toujours les plus récents.
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "session_feedback")
      .gte("created_at", new Date(Date.now() - (PEREMPTION_JOURS + 1) * 86400000).toISOString())
      .order("created_at", { ascending: false }).limit(60),
    // Douleurs déclarées depuis l'espace Santé (schéma corporel) — elles n'atteignaient
    // pas le coach, qui ne regardait que le formulaire post-séance.
    sb.from("notifications").select("id, data").eq("user_id", userId).eq("type", "pain_report").order("created_at", { ascending: false }).limit(10),
    // Usure des chaussures : un des rares facteurs de blessure à la fois mesurable
    // et actionnable. Silencieux tant qu'aucune paire n'est enregistrée.
    objectifSeul ? nonLu() : sb.from("shoes").select("brand, model, current_km, km_at_purchase, max_km, purchase_date, terrain").eq("user_id", userId).eq("is_active", true),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "race_objective").maybeSingle(),
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "coach_session").order("created_at", { ascending: false }).limit(40),
    // Pesées du mode perte de poids. La table n'existe pas tant que la migration 018
    // n'est pas passée : supabase-js renvoie alors `{ error }` sans lever d'exception,
    // donc `Promise.all` tient et le reste du contexte coach est intact.
    objectifSeul ? nonLu() : sb.from("weight_logs").select("date, weight_kg").eq("user_id", userId).order("date", { ascending: false }).limit(60),
    // HISTORIQUE LONG, volontairement séparé et minimal (3 colonnes, 180 jours).
    // `fetchWorkouts` s'arrête à 60 séances, soit ~10 à 13 semaines : la capacité déjà
    // démontrée par l'athlète quatre à six mois plus tôt lui était donc INVISIBLE. Un
    // coureur habitué à 80 km/semaine était traité comme un débutant à 31 km après une
    // coupure. Trois colonnes sur 180 jours coûtent moins qu'un plan sous-dimensionné.
    sb.from("workouts").select("date, sport, distance_km").eq("user_id", userId)
      .gte("date", new Date(Date.now() - 190 * 86400000).toISOString().slice(0, 10))
      .order("date", { ascending: false }).limit(400),
    objectifSeul ? nonLu() : sb.from("sleep_data").select("date").eq("user_id", userId)
      .gte("date", new Date(Date.now() - 190 * 86400000).toISOString().slice(0, 10))
      .order("date", { ascending: false }).limit(200),
    objectifSeul || essentielle ? nonLu() : sb.from("hrv_data").select("date").eq("user_id", userId)
      .gte("date", new Date(Date.now() - 190 * 86400000).toISOString().slice(0, 10))
      .order("date", { ascending: false }).limit(200),
    // Fenêtre LONGUE et colonnes minimales, pour mesurer la PENTE de forme : la requête
    // principale ne lit que 60 séances, soit deux mois — trop court pour distinguer une
    // tendance du bruit (constaté : « pente non mesurable » sur un athlète qui en avait
    // pourtant une, nette, sur 32 semaines).
    objectifSeul ? nonLu() : sb.from("workouts").select("date, sport, distance_km, duration_seconds, avg_hr, gap_min_km, elevation_gain_m")
      .eq("user_id", userId).not("avg_hr", "is", null)
      .gte("date", new Date(Date.now() - 280 * 86400000).toISOString().slice(0, 10))
      .order("date", { ascending: false }).limit(500),
    // ── FC MAX DES SIX DERNIERS MOIS — UNE LIGNE (fenêtre `PIC_FC_JOURS` depuis le 07/11/2026) ──
    // `fetchWorkouts` est plafonné à 60 séances, soit environ deux mois. La FC max d'un
    // athlète qui court depuis des années tombe presque toujours HORS de cette fenêtre :
    // le coach calait alors ses zones sur le maximum des deux derniers mois, plus bas que
    // la réalité, et prescrivait des allures et des zones trop basses — sans que rien ne
    // le dise. Même leçon que les records par distance du tableau de bord : une donnée
    // « meilleur de tous les temps » se lit avec une requête DÉDIÉE, pas dans une liste
    // plafonnée. Le tri fait le travail, on ne ramène qu'une ligne.
    // ⚠️ LES SIX DERNIERS MOIS, PLUS TOUT L'HISTORIQUE (07/11/2026, `PIC_FC_JOURS`) : la FC max
    // d'aujourd'hui, pas celle d'il y a deux ans. Voir `maxDeReference` (lib/coach/fcCible).
    objectifSeul ? nonLuUne() : sb.from("workouts").select("max_hr").eq("user_id", userId)
      .not("max_hr", "is", null).gte("date", new Date(Date.now() - PIC_FC_JOURS * 86400000).toISOString().slice(0, 10))
      .order("max_hr", { ascending: false }).limit(1).maybeSingle(),
    // Test de lactate le plus récent (lib/coach/lactate) : une donnée DÉCLARÉE, lue pour
    // toutes les formules comme les autres réponses de l'athlète.
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", TYPE_TEST_LACTATE)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    // Les courses notées au calendrier (lib/coach/saison) : le coach les ignorait.
    sb.from("notifications").select("data").eq("user_id", userId).eq("type", "planned_race")
      .order("created_at", { ascending: false }).limit(40),
  ]);

  // Palier gratuit : le profil réduit à ce qui est DÉCLARÉ, et du test de VMA, la VMA seule
  // (le test enregistre aussi des FC de repos, max et au seuil : des mesures du corps).
  const p = objectifSeul
    ? garder(profileRes.data as Record<string, unknown> | null, PROFIL_DECLARE)
    : profileRes.data as Record<string, unknown> | null;
  const b = objectifSeul
    ? garder(baseRes.data as Record<string, unknown> | null, ["vma_kmh", "tested_at"])
    : baseRes.data as Record<string, unknown> | null;
  // UNE SEULE MESURE par athlète — la rMSSD, ou la SDNN d'une Apple Watch en réglages par
  // défaut. Tout ce qui suit (base, tendance 7 j, chute aiguë, état) se calcule dans
  // celle-là : mélanger les deux fabriquait de fausses chutes. Voir `lib/health/vfc`.
  const { metrique: metriqueVfc, lignes: hrv } = serieVfc((hrvRes.data ?? []) as { date: string; rmssd: number | null; sdnn: number | null }[]);
  const sleep = (sleepRes.data ?? []) as { sleep_score: number | null; total_sleep_min: number | null; deep_sleep_min: number | null; rem_sleep_min: number | null; body_battery_end: number | null; respiration_rate: number | null; date: string }[];
  const workouts = (woRes.data ?? []) as Wk[];
  // Palier gratuit : du formulaire d'après-séance, ce que l'athlète DÉCLARE et qui le protège
  // — la douleur signalée, et le RESSENTI (RPE) depuis le 30/10/2026 (Cyprien : « ressenti lu
  // par le plan gratuit »). Un « 9/10, épuisé » qui laissait le lendemain inchangé était un
  // plan qui n'écoutait pas : le ressenti n'est pas une mesure, c'est ce que l'athlète dit.
  // Les NOTES libres restent dehors : seul un modèle les lit, et aucun ne parle au gratuit.
  // ⚠️ UNE PANNE N'EST PAS « AUCUNE DOULEUR » (relecture du 10/11/2026). Ressentis et douleurs
  // déclarées décident à eux seuls si une douleur bride le plan : une lecture ratée rendait
  // `[]`, donc un plan durci sur un tibia signalé. On refuse de bâtir le contexte ; le coach
  // automatique laisse alors le plan en place et journalise la cause (autoCoach, « ctx »).
  for (const [nom, r] of [["ressentis", fbRes], ["douleurs déclarées", painRes]] as const) {
    if (estUnePanne(r)) throw new Error(`Douleurs illisibles (${nom}) : ${r.error?.code ?? "?"} ${r.error?.message ?? ""}`);
  }
  const feedback = ((fbRes.data ?? []) as { data: { rpe?: number; pain?: string[]; note?: string; date?: string; ts?: string; painPasse?: string[] } }[])
    .map((f) => objectifSeul ? { data: { pain: f.data?.pain, rpe: f.data?.rpe, date: f.data?.date, ts: f.data?.ts, painPasse: f.data?.painPasse } } : f);
  // ⚠️ UN OBJECTIF PASSÉ RESTAIT L'OBJECTIF. `race_objective` est une ligne unique que rien
  // n'efface après la course. Cas réel (Cyprien, marathon de Lille couru le 25/10/2026) :
  // cinq jours plus tard, le coach se croyait encore en AFFÛTAGE (`weeksToRace` = −1, donc
  // « ≤ 2 »), son macro-plan était vide (`daysToRace < 0`), et l'encadré « réalisme »
  // annonçait une préparation qui « plafonnera à ~0 km » pour une course déjà courue —
  // pendant que l'en-tête du même calendrier, qui lit `lib/coach/prochaineCourse`, disait
  // « Aucune course ». Même règle qu'elle (`objectifEnCours`) : une course reste
  // l'objectif jusqu'au soir de son jour, dans le fuseau des coureurs.
  const objectifDeclare = (objRes.data?.data ?? null) as CoachObjective | null;
  // Test de lactate en vigueur (lib/coach/lactate) : six mois au plus, sinon rien.
  const lactate: TestLactate | null = testEnVigueur(
    ((lactateRes as { data?: { data?: TestLactate } | null } | null)?.data?.data) ?? null, aujourdhui(FUSEAU_DEFAUT));
  // ── LA SAISON (lib/coach/saison) ────────────────────────────────────────────
  // L'objectif DÉCLARÉ reste la course que l'athlète a fixée ; l'objectif VISÉ est la
  // course A la plus proche — la sienne, ou une course A du calendrier qui vient avant.
  // Une saison à deux pics se prépare ainsi l'un après l'autre.
  const saison = coursesDeSaison(objectifDeclare,
    ((planifieesRes as { data?: { data?: Record<string, unknown> }[] | null } | null)?.data ?? []).map((r) => r.data ?? {}));
  const objectifDeclareEnCours = objectifEnCours(objectifDeclare, aujourdhui(FUSEAU_DEFAUT));
  const courseA = prochaineCourseA(saison, aujourdhui(FUSEAU_DEFAUT));
  const objective: CoachObjective | null = courseA && !courseA.declaree
    && (!objectifDeclareEnCours || courseA.date < String(objectifDeclareEnCours.raceDate).slice(0, 10))
    // Une course du calendrier n'a pas de chrono visé : aucune allure spécifique inventée.
    ? { race: courseA.nom, raceDate: courseA.date, distanceKm: courseA.distanceKm ?? 0, targetSeconds: 0, targetTime: "", targetPace: "" }
    : objectifDeclareEnCours;
  // `tags` est lu en plus de la date et du type : c'est lui qui dit qu'une séance d'un
  // autre écrivain que le plan automatique était une séance de qualité (`qualiteRecente`).
  const coachSessions = ((csRes.data ?? []) as { data: Prescription & { date?: string; sessionType?: string } }[]).map(r => r.data).filter((d): d is Prescription & { date?: string; sessionType?: string } => !!d?.date);

  const now = Date.now();
  /** Borne basse de l'historique long — la MÊME que celle des requêtes ci-dessus. */
  const iso190 = () => new Date(now - 190 * 86400000).toISOString().slice(0, 10);
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
  // Langue de l'athlète, utilisée par tous les textes calculés côté serveur (motifs de
  // refus des doubles, avertissements d'âge). Déclarée UNE fois : deux calculs séparés
  // finissaient par diverger dès qu'on ajoutait une langue.
  const LANGUES = ["fr", "en", "de", "es", "pt"] as const;
  const langAthlete: (typeof LANGUES)[number] =
    LANGUES.includes(String((p as Record<string, unknown> | null)?.preferred_language ?? "") as (typeof LANGUES)[number])
      ? (String((p as Record<string, unknown> | null)?.preferred_language) as (typeof LANGUES)[number]) : "fr";
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
  // Volume représentatif (médiane des semaines courues) + plus longue sortie récente :
  // les deux points de départ honnêtes du dimensionnement. Voir lib/running/volume.ts.
  const robustWeekly = robustWeeklyKm(runs, now, 8);
  // Capacité déjà tenue, sur 26 semaines. Relève le PLAFOND de la montée en charge —
  // jamais la cible immédiate, qui reste pilotée par le ratio aigu:chronique et la VFC.
  const histRuns = ((histRes.data ?? []) as { date: string; sport?: string | null; distance_km?: number | null }[])
    .filter(w => isRun(w.sport));
  const demonstratedKm = demonstratedWeeklyKm(histRuns.length ? histRuns : runs, now, 26);
  const longestRecentKm = Math.max(0, ...runs
    .filter(w => now - new Date(w.date).getTime() <= 42 * 86400000)
    .map(w => w.distance_km ?? 0));
  // CROSS-TRAINING — en MINUTES et en TSS, jamais en kilomètres : 40 km de vélo et 2 km
  // de bassin ne s'additionnent pas, et une heure de home-trainer ou de renfo (aucune
  // distance) valait zéro donc restait invisible. Voir lib/coach/crossTraining.
  const cross = summarizeCross(workouts, now, 7);
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
  // ⚠️ LE MAXIMUM RÉELLEMENT ENREGISTRÉ CES SIX DERNIERS MOIS — pas sur les 60 dernières
  // séances. `fcMaxRes` porte la ligne la plus haute de la fenêtre (requête dédiée) ; avant le
  // 07/11/2026, de toute la table : un pic ancien faisait des zones trop hautes.
  const obsMaxHr0 = Math.max(0, ...workouts
    .filter(w => now - new Date(String(w.date).slice(0, 10) + "T12:00:00Z").getTime() <= PIC_FC_JOURS * 86400000)
    .map(w => num(w.max_hr) ?? 0),
    num((fcMaxRes.data as { max_hr?: number } | null)?.max_hr) ?? 0);
  // FC max DE RÉFÉRENCE : celle du test (baseline) d'abord, sinon celle saisie à l'inscription,
  // sinon celle de la MONTRE (réglage intervals.icu porté par ses séances Garmin, 07/11/2026).
  const maxHrDeclare = maxDeReference(num(b?.max_hr) ?? num(p?.max_hr),
    (((p as Record<string, unknown> | null)?.garmin_metrics) as Record<string, unknown> | null)?.maxHR);
  // ⚠️ JAMAIS SOUS UNE VALEUR RÉELLEMENT ATTEINTE. Une FC max déclarée à 190 alors que la
  // montre a enregistré 205 est fausse par construction — on ne peut pas avoir un maximum
  // inférieur à un battement qu'on a réellement produit. On retient donc la plus haute des
  // deux, et on ne retombe sur l'âge que si l'athlète n'a NI déclaré NI couru.
  // ⚠️ SANS DÉCLARATION, SANS MESURE ET SANS ÂGE : `null`, PLUS 190 (12/11/2026). Le repli à 190
  // estimait la VMA depuis les séances, classait les efforts « durs » et partait à l'IA sous la
  // forme « ~190 (obs.) » — un chiffre inventé présenté comme observé. Les appelants savent
  // déjà se passer d'une FC max absente.
  const ageConnu = num(p?.age);
  const fcMaxSource: "mesures" | "age" | null = (maxHrDeclare != null || obsMaxHr0 > 150) ? "mesures" : ageConnu != null ? "age" : null;
  const fcMaxEst: number | null = fcMaxSource === "mesures"
    ? Math.max(maxHrDeclare ?? 0, obsMaxHr0 > 150 ? obsMaxHr0 : 0)
    : fcMaxSource === "age" ? 220 - (ageConnu as number) : null;
  // ── LES CIBLES DE FC MESURÉES (07/11/2026) ─────────────────────────────────
  // FC max réellement atteinte ou déclarée, FC de repos déclarée sinon celle de la montre,
  // seuil mesuré. Les footings récents (≥ 20 min, 60 jours) servent à suivre l'athlète
  // qui court PLUS facile que la théorie (`cibleEndurance`). Rien pour le palier gratuit :
  // il ne lit aucune fréquence cardiaque.
  // ── MÉTÉO RÉELLE (lue ICI, avant les cibles de FC qui en dépendent) ──────────
  // Pas la température de la montre (capteur au poignet) mais le relevé et les PRÉVISIONS à la
  // position d'entraînement. Le palier gratuit n'a pas de position (liste blanche du profil).
  const lat = num(p?.last_lat), lon = num(p?.last_lon);
  // Prévisions ET altitude en une seule requête : Open-Meteo renvoie les deux. Déjà lues
  // par un autre contexte du même athlète (`LectureContexte.meteo`) : on les reprend.
  const weather = lecture.meteo
    ? { days: lecture.meteo.forecast, elevationM: lecture.meteo.altitude.elevationM }
    : lat != null && lon != null
    ? await forecastWithElevation(lat, lon).catch(() => ({ days: [], elevationM: null }))
    : { days: [], elevationM: null };
  const forecast = weather.days;
  // La FC max de la SAISON (`fcMaxSaison`) : en hiver, des zones calées sur le pic de l'été
  // sont trop hautes. Deux pics lus à part ; une lecture ratée garde la référence. Sans hiver
  // déjà enregistré, l'air froid de la semaine (`airFroid`) retire 5 bpm.
  const picsDeSaison = objectifSeul ? null : await picsSaison(sb as never, userId, now);
  const ciblesFc: CiblesFc | null = objectifSeul ? null : ciblesFcAthlete(
    avecSaison(referencesFc({
      maxDeclaree: maxHrDeclare, maxObservee: obsMaxHr0,
      repos: num(b?.resting_hr) ?? num(p?.resting_hr) ?? num((((p as Record<string, unknown> | null)?.garmin_metrics) as Record<string, unknown> | null)?.restingHR),
      seuil: num(b?.lt_hr),
    }), picsDeSaison, airFroid(forecast)),
    workouts.filter((w) => isRun(w.sport) && !isHardType(w.type) && (num(w.duration_seconds) ?? 0) >= 20 * 60
      && now - new Date(String(w.date).slice(0, 10) + "T12:00:00Z").getTime() <= 60 * 86400000)
      .map((w) => num(w.avg_hr)).filter((v): v is number => v != null),
  );
  // Une séance est « dure » si son TYPE le dit OU si la FC révèle un effort élevé (≥ 90 % FCmax).
  // ⚠️ `isHardType` ne suffit PAS : mesuré sur 60 séances de ce compte, intervals.icu
  // n'émet que deux étiquettes, « easy » et « trail ». La FC est donc le seul juge réel.
  // ⚠️ ET LE FOOTING COURU TROP VITE (07/11/2026). Le seul seuil « dur » était 85 % de la FC
  // max : 180 bpm pour une FC max de 212. Un « Footing en endurance » couru à 170 bpm (relevé
  // le 09/10 sur le compte de Cyprien) passait pour facile, et le plan pouvait placer une VMA
  // le lendemain. Au-delà du haut de sa zone d'endurance + 5 bpm (`ciblesFcAthlete`), une
  // course de 20 min et plus compte comme une séance dure : 48 h avant la prochaine qualité,
  // et elle entre dans le budget de la semaine (`qualiteRecente`).
  const isHardWk = (w: Wk) => isHardType(w.type) || (fcMaxEst != null && w.avg_hr != null && w.avg_hr >= fcMaxEst * PART_FC_DURE)
    || (isRun(w.sport) && footingTropIntense(w.avg_hr, w.duration_seconds, ciblesFc));
  const hardShare = recent14.length ? Math.round(recent14.filter(isHardWk).length / recent14.length * 100) : null;
  // ── LE VRAI 80/20 : en TEMPS passé par zone, pas en nombre de séances ──
  // Compter les séances est trompeur : deux fractionnés courts dans une semaine de
  // plusieurs heures restent ~80 % facile. Seul le temps en zone tranche. Les secondes
  // par zone arrivent désormais d'intervals.icu (Z1-Z2 = facile, Z3+ = intensité).
  // ⚠️ UNE COURSE N'EST PAS UN FOOTING. Le marathon de Lille (2 h 42 en zone 4-5) pesait
  // à lui seul 80 % du temps des quatorze jours : le calendrier de Cyprien affichait
  // « Tes footings sont courus trop vite » sous chaque footing de sa récupération (relevé
  // le 05/11/2026). Les jours de course connus (l'objectif et celui qu'il a remplacé) sont
  // donc écartés, et il faut au moins trois sorties et une heure pour parler de répartition.
  const joursDeCourse = new Set([objectifDeclare?.raceDate, objectifDeclare?.precedente?.raceDate]
    .filter((d): d is string => typeof d === "string" && d.length >= 10).map((d) => d.slice(0, 10)));
  const zonesLues = recent14.filter((w) => Array.isArray(w.hr_zone_seconds) && !joursDeCourse.has(String(w.date).slice(0, 10)));
  const zoneTotals = zonesLues.reduce((acc, w) => {
    const z = w.hr_zone_seconds as number[];
    acc.easy += (z[0] ?? 0) + (z[1] ?? 0);
    acc.hard += z.slice(2).reduce((a, b) => a + (b ?? 0), 0);
    return acc;
  }, { easy: 0, hard: 0 });
  const zoneTotal = zoneTotals.easy + zoneTotals.hard;
  const hardTimePct = zonesLues.length >= 3 && zoneTotal >= 3600 ? Math.round((zoneTotals.hard / zoneTotal) * 100) : null;

  // Les fenêtres qui suivent sont exprimées en JOURS CIVILS, plus en nombre de lignes.
  // Mesuré le 05/09/2026 sur un compte réel : « les 14 dernières lignes » de VFC couvraient
  // 19 jours et « les 7 dernières nuits » en couvraient 12, parce que la montre n'est pas
  // portée tous les jours. La base annoncée au coach n'était donc pas celle qu'il lisait.
  const dansLesJours = (d: string | null | undefined, jours: number) => {
    const t = d ? Date.parse(String(d).slice(0, 10) + "T12:00:00Z") : NaN;
    return Number.isFinite(t) && now - t <= jours * 86400000;
  };
  const hrvVals = hrv.filter(h => dansLesJours(h.date, 14)).map(h => h.hrv_ms).filter((v): v is number => v != null);
  const hrvLatest = hrvVals[0] ?? null;
  const hrvBase = hrvVals.length >= 3 ? Math.round(hrvVals.reduce((a, c) => a + c, 0) / hrvVals.length) : null;
  // La MÊME zone normale (± 6 %) que l'état juste en dessous : « 88 ms pour une base de 92 →
  // fatigue possible » à côté de « état : optimal » donnait deux lectures contraires au coach.
  const hrvTrend = hrvLatest != null && hrvBase != null
    ? { recovery: "sous sa zone normale → fatigue possible", optimal: "dans sa zone normale (± 6 %)", competition: "au-dessus de sa zone normale → frais" }[etatRelatif(hrvLatest, hrvBase)]
    : "n/c";
  // L'état : la dernière mesure face à SA base (zone normale ± 6 %), plus un seuil absolu
  // qui classait 49 matins sur 77 « compétition » chez qui vit à 90 ms. Une mesure de
  // plus de deux jours ne décrit plus aujourd'hui, et « optimal » par défaut affirmait
  // un état sans aucune donnée : on dit ce qu'on ne sait pas.
  // ⚠️ SUR LA BASE DE 14 JOURS ci-dessus, pas sur les 14 dernières MESURES de la série :
  // mesuré le 12/10/2026 sur le compte de Cyprien, les 14 mesures remontaient au 16/09
  // (un 38 ms) et donnaient « optimal » à 83 ms, juste au-dessus d'une ligne disant « 83 ms
  // pour une base de 91 → sous sa zone normale ». Deux lectures contraires, même invite.
  const ageVfc = hrv[0] ? ecartJours(aujourdhui(FUSEAU_DEFAUT), hrv[0].date) : null;
  const state = ageVfc == null ? "inconnu (aucune VFC reçue)"
    : ageVfc > FRAICHEUR_JOURS ? `inconnu (dernière VFC il y a ${ageVfc} j)`
    : hrvLatest != null && hrvBase != null ? etatRelatif(hrvLatest, hrvBase)
    : hrv[0].physiological_state;
  // Un score ABSENT n'est pas un score de 0 : `?? 0` transformait une nuit non notée par
  // la montre en nuit catastrophique. (Aucune sur ce compte, mais toutes les montres ne
  // renseignent pas ce champ.)
  const scoresSommeil = sleep.filter(d => dansLesJours(d.date, 7)).map(d => d.sleep_score).filter((v): v is number => v != null);
  const sleepAvg = scoresSommeil.length ? Math.round(scoresSommeil.reduce((a, b) => a + b, 0) / scoresSommeil.length) : null;
  // Sommeil de cette nuit pris en compte SEULEMENT s'il est récent (montre portée).
  const freshSleep = sleep[0]?.date && now - new Date(sleep[0].date + "T00:00:00").getTime() <= 2 * 86400000 ? sleep[0] : null;
  const lastSleepMin = freshSleep?.total_sleep_min ?? null;

  // Douleurs = formulaire post-séance ET espace Santé. Une déclaration se périme au
  // bout de 14 jours : une gêne signalée il y a un mois ne doit pas brider l'athlète
  // indéfiniment s'il ne l'a pas re-signalée.
  // ⚠️ UNE DOULEUR DÉCLARÉE PASSÉE NE DOIT PLUS BRIDER LE PLAN. Jusqu'au 23/09/2026 elle
  // ne s'éteignait QUE par péremption : une déclaration faite pour essayer l'application
  // retirait de l'intensité pendant deux semaines. L'athlète peut désormais dire « c'est
  // passé », « ça va mieux » ou « ça empire » ; seul « c'est passé » l'efface, et la
  // tendance part au coach avec la douleur.
  // ── LES CONSIGNES DU KINÉSITHÉRAPEUTE, saisies par le coureur (lib/health/consignesKine) ──
  //    Une lecture en panne n'est pas « aucune consigne » : on refuse de bâtir le contexte,
  //    comme pour les douleurs (le plan en place reste, le passage suivant réessaie).
  // La plus récente : deux lignes (double clic) ne doivent pas faire échouer `maybeSingle`.
  const { data: lignesConsignes, error: eConsignes } = await sb.from("notifications").select("data")
    .eq("user_id", userId).eq("type", TYPE_CONSIGNES).order("created_at", { ascending: false }).limit(1);
  if (estUnePanne({ error: eConsignes })) throw new Error(`Consignes du kiné illisibles : ${eConsignes?.code ?? "?"} ${eConsignes?.message ?? ""}`);
  const consignes = consignesEnVigueur(((lignesConsignes ?? []) as { data?: unknown }[])[0]?.data, aujourdhui(FUSEAU_DEFAUT));
  // ── LE BILAN DU MATIN (Santé, lot 2) : celui de CE jour seulement. Une lecture en panne n'est
  //    pas « aucun bilan » : on refuse de bâtir le contexte, comme pour les consignes.
  //    Jour de PARIS ici (le fuseau de l'athlète n'est pas connu du contexte) : la route l'écrit au
  //    jour de l'athlète, identique hors des heures autour de minuit pour un fuseau lointain.
  const { data: lignesBilan, error: eBilan } = await sb.from("notifications").select("data")
    .eq("user_id", userId).eq("type", TYPE_BILAN).order("created_at", { ascending: false }).limit(3);
  if (estUnePanne({ error: eBilan })) throw new Error(`Bilan du matin illisible : ${eBilan?.code ?? "?"} ${eBilan?.message ?? ""}`);
  // Le jour de Paris, ou le LENDEMAIN : le matin d'un coureur d'Asie ou d'Océanie tombe encore la
  //    veille à Paris (relecture du 10/11/2026). Limite assumée, faute de fuseau de l'athlète ici :
  //    pendant SA nuit, le bilan de son matin précédent peut encore valoir « jour de Paris » ; il ne
  //    fait qu'alléger, et le plan est recalculé dès son nouveau bilan.
  const jourParis = aujourdhui(FUSEAU_DEFAUT);
  const lendemainParis = (() => { const d = new Date(`${jourParis}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  const lignesB = (lignesBilan ?? []) as { data?: unknown }[];
  const bilan = bilanDuJour(lignesB, lendemainParis) ?? bilanDuJour(lignesB, jourParis);
  const effetDuBilan = effetBilan(bilan);
  // ── LE QUESTIONNAIRE D'APTITUDE (lot 3) : une panne n'est pas « rien à signaler ».
  const { data: lignesApt, error: eApt } = await sb.from("notifications").select("data")
    .eq("user_id", userId).eq("type", TYPE_APTITUDE).order("created_at", { ascending: false }).limit(1);
  if (estUnePanne({ error: eApt })) throw new Error(`Questionnaire d'aptitude illisible : ${eApt?.code ?? "?"} ${eApt?.message ?? ""}`);
  const aptitudeAttente = avisAttendu(lireAptitude(((lignesApt ?? []) as { data?: unknown }[])[0]?.data));
  const declaredPains = libellesActifs(
    ((painRes.data ?? []) as { id?: string; data: Douleur | null }[]).map((n) => ({ ...(n.data ?? {}), id: n.id })),
    aujourdhui(FUSEAU_DEFAUT),
    { mieux: "en amélioration selon l'athlète", pire: "en aggravation selon l'athlète" },
  );
  // ⚠️ UNE DOULEUR COCHÉE APRÈS UNE SÉANCE NE S'ÉTEIGNAIT JAMAIS (09/11/2026) : elle pesait
  // tant que son ressenti restait parmi les cinq derniers, sans bouton « c'est passé ».
  // Désormais : 14 jours, « c'est passé » (Santé), ou un « Aucune douleur » plus récent
  // (lib/health/douleursSeance).
  const pains = [...new Set([
    ...douleursDeSeance(feedback.map((f) => f.data ?? {}), aujourdhui(FUSEAU_DEFAUT)).map((d) => d.zone),
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

  // FC déclarées : la baseline (mesurée avec le test) prime, sinon ce que l'athlète a
  // renseigné à l'inscription (facultatif — migration 029). `null` s'il n'a rien dit :
  // le coach déduit alors tout seul (max observé en séance, montre pour la FC de repos).
  const maxHr = maxHrDeclare, restHr = num(b?.resting_hr) ?? num(p?.resting_hr), ltHr = num(b?.lt_hr);
  const vmaStored = num(b?.vma_kmh);
  const garminVo2 = num((p as Record<string, unknown> | null)?.garmin_vo2max);
  // VMA, par fiabilité : test enregistré → efforts réels (reflète l'allure de course) → dérivée de la
  // VO2max Garmin (repli) → repli FC. Garantit le MÊME chiffre côté coach et côté client.
  // Meilleurs efforts mesurés : disponibles avant tout le reste car ils fondent la VMA.
  const paceCurve = (p?.pace_curve ?? null) as import("@/lib/intervals/performance").PaceCurve | null;
  // ACCLIMATATION À LA CHALEUR, calculée ICI et pas plus bas : elle sert à relire les
  // performances, et la VMA se calcule avant le bloc météo. On la déduit des séances
  // elles-mêmes, qui portent toutes leur température — aucune requête supplémentaire.
  // Un athlète acclimaté souffre moins : on corrige donc MOINS son chrono.
  const acclimVma = heatAcclimation(
    new Set(workouts.filter((w) => num(w.weather_temp_c) != null && (num(w.weather_temp_c) as number) >= 25
      && now - new Date(w.date).getTime() <= 30 * 86400000).map((w) => String(w.date).slice(0, 10))).size,
  ).factor;

  // UN SEUL calcul de VMA pour toute l'application (cf. lib/running/fitness.ts) : quatre
  // chaînes divergentes coexistaient, et le tableau de bord ignorait la courbe d'allure.
  const { vma, source: vmaSource } = effectiveVma({
    vmaStored, paceCurveBest: paceCurve?.best, garminVo2,
    // Palier gratuit : la VMA du TEST, rien d'autre. L'estimer depuis les séances, c'est
    // précisément l'analyse que ce palier ne fait pas.
    fromRuns: objectifSeul ? null : bestVmaFromWorkouts(runs, fcMaxEst, 120, acclimVma) ?? estimateVmaFromRuns(runs, fcMaxEst, now),
  });
  const vmaIsEst = vmaSource !== "test" && vma != null;

  /**
   * ALLURE D'ENDURANCE : MESURÉE en zone 2, pas déduite d'un pourcentage de VMA.
   *
   * Une allure facile se définit par la FRÉQUENCE CARDIAQUE. Le rapport FC↔allure varie
   * trop d'un coureur à l'autre pour qu'un « 70 % de VMA » convienne à tout le monde :
   * mesuré sur le compte de production, l'écart était de 33 s/km, ce qui plaçait le
   * « footing » prescrit en zone 3 — et l'application reprochait ensuite à l'athlète de
   * courir trop vite. `null` si l'historique ne permet pas de conclure : on retombe
   * alors sur le pourcentage de VMA, et le briefing le dit.
   */
  // ⚠️ LES MÊMES RÉFÉRENCES QUE PARTOUT AILLEURS. Cette chaîne recalculait la FC max dans
  // son coin (`b.max_hr ?? observé`) : elle ignorait donc la FC déclarée au profil ET la
  // règle « jamais sous le maximum réellement atteint ». `fcMaxEst` porte déjà les deux.
  const easyPaceMesure = easyPaceFromHeartRate(
    runs,
    fcMaxEst,
    restHr ?? num((((p as Record<string, unknown> | null)?.garmin_metrics) as Record<string, unknown> | null)?.restingHR),
    acclimVma,
  );

  // ── TRAJECTOIRE DE CAPACITÉ — plateau et projection au jour J ────────────────
  // La courbe d'allure disait « où il en est » ; l'historique dit « où il va ».
  // Deux usages, tous deux impossibles sans série temporelle :
  //   · PLATEAU — stagner pendant que la charge monte est le signal qu'il faut CHANGER
  //     de stimulus, pas en rajouter. C'est l'erreur la plus coûteuse d'un plan
  //     automatique : il ne sait qu'ajouter, et il ajoute jusqu'à la blessure.
  //   · PROJECTION — annoncer « il te faut 20,2 km/h, tu es à 17,6 » sans dire si
  //     l'écart se réduit, c'est répéter un constat d'échec. La pente réelle permet de
  //     proposer un objectif atteignable au lieu d'un objectif décoratif.
  const curvePts = (() => {
    const hist = Array.isArray(paceCurve?.history) ? paceCurve!.history! : [];
    const pts = hist
      .filter(h => h?.at && typeof h.vma === "number" && h.vma! > 5)
      .map(h => ({ t: new Date(h.at).getTime(), v: h.vma! }));
    // Le relevé courant complète la série s'il est plus récent que le dernier point.
    const cur = vmaFromPaceCurve(paceCurve?.best);
    const at = paceCurve?.at ? new Date(paceCurve.at).getTime() : now;
    if (cur && (!pts.length || at - pts[pts.length - 1].t > 86400000)) pts.push({ t: at, v: cur });
    return pts.sort((a, b) => a.t - b.t);
  })();

  /** Pente de la VMA en km/h par semaine (régression linéaire sur la série). */
  const vmaSlopePerWeek = (() => {
    if (curvePts.length < 3) return null;
    const span = curvePts[curvePts.length - 1].t - curvePts[0].t;
    if (span < 14 * 86400000) return null;   // moins de deux semaines : pas une tendance
    const xs = curvePts.map(p => (p.t - curvePts[0].t) / (7 * 86400000));
    const ys = curvePts.map(p => p.v);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    if (den <= 0) return null;
    const num2 = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    return Math.round((num2 / den) * 1000) / 1000;
  })();

  // PLATEAU : progression quasi nulle alors que la charge chronique monte. Le seuil de
  // 0,05 km/h/sem correspond à ~1 s/km par semaine — en dessous, c'est du bruit.
  const ctlRising = load.ctl > 0 && load.acr > 1.05;
  const plateau = vmaSlopePerWeek != null && Math.abs(vmaSlopePerWeek) < 0.05 && ctlRising
    && (curvePts[curvePts.length - 1].t - curvePts[0].t) >= 21 * 86400000;


  // L'échelle unique (lib/running/niveau), nommée pour le prompt : plus de bornes recopiées.
  const niveauMesure = niveauDeVma(vma);
  const level = niveauMesure == null ? "à évaluer (VMA inconnue)"
    : ({ debutant: "débutant", intermediaire: "intermédiaire", confirme: "confirmé", elite: "expert/élite" } as const)[niveauMesure];

  // Zones FC (Karvonen) si dispo
  // ── ZONES DE FRÉQUENCE CARDIAQUE ─────────────────────────────────────────────
  // Deux constats. D'abord, `performance_baselines` est vide pour la plupart des
  // athlètes : `maxHr` valait null et le coach n'affichait AUCUNE zone (« ? »).
  // Ensuite, la FC au seuil lactique est MESURÉE par intervals.icu sur les efforts
  // réels — bien plus fiable qu'un « 220 − âge » dont l'écart-type dépasse 10 bpm.
  //
  // On ne bascule PAS pour autant sur les fractions de seuil à la Friel : sa zone
  // « endurance » (85-89 % du seuil) tombe ici à 163-173 bpm alors que l'athlète court
  // ses footings à 159. Prescrire cette zone l'aurait fait ACCÉLÉRER ses footings —
  // l'exact contraire de la discipline 80/20 que le coach passe son temps à défendre.
  //
  // On garde donc la réserve cardiaque (Karvonen) pour les zones faciles, en
  // l'alimentant avec la MEILLEURE FC max disponible ; et on réserve le seuil mesuré
  // à la zone qu'il définit littéralement : le seuil.
  const gm = (p as Record<string, unknown> | null)?.garmin_metrics as Record<string, unknown> | null | undefined;
  const lthrMeasured = num(gm?.lthr) ?? ltHr;
  // ⚠️ MÊME RÈGLE QU'EN HAUT (fcMaxEst) : la plus haute entre ce qui est DÉCLARÉ et ce qui
  // a été RÉELLEMENT enregistré. Prendre la déclaration seule faisait calculer toutes les
  // zones sous la réalité pour qui s'est sous-estimé à l'inscription.
  const maxHrEff = (maxHr != null || obsMaxHr0 > 150)
    ? Math.max(maxHr ?? 0, obsMaxHr0 > 150 ? obsMaxHr0 : 0)
    // Le seuil vaut ~92 % de la FC max chez un athlète entraîné : bien meilleur repli
    // que l'âge (ici 209 déduit contre 209 réellement observés).
    : (lthrMeasured != null && lthrMeasured > 120 ? Math.round(lthrMeasured / 0.92) : null)
    ?? (num(p?.age) ? 220 - num(p!.age)! : null);
  const restHrEff = restHr ?? num(gm?.restingHR) ?? null;
  const hrZone = (lo: number, hi: number) => {
    // Zone de seuil : ancrée sur la mesure, pas sur un pourcentage d'un maximum.
    if (lo >= 0.8 && lthrMeasured != null && lthrMeasured > 120) {
      return `${Math.round(lthrMeasured * 0.95)}-${Math.round(lthrMeasured * 0.99)} bpm`;
    }
    return (maxHrEff != null && restHrEff != null)
      ? `${Math.round(restHrEff + (maxHrEff - restHrEff) * lo)}-${Math.round(restHrEff + (maxHrEff - restHrEff) * hi)} bpm`
      : null;
  };
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
    objLines.push(estOfficielle(objective)
      ? `• Course : ${objective.race} — ${objective.distanceKm} km, le ${objective.raceDate} (J-${daysToRace}, ~${weeksToRace} sem.)`
      // Un défi personnel le dit au modèle : sans ça, il parle de dossard, de ravitaillement
      // et de meneurs d'allure à quelqu'un qui court seul sur une piste.
      : `• Défi personnel, PAS une course officielle (ni dossard, ni ravitaillement, ni meneur d'allure : il court seul) : ${objective.race} — ${objective.distanceKm} km, le ${objective.raceDate} (J-${daysToRace}, ~${weeksToRace} sem.)`);
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
        // Confrontation à sa progression MESURÉE : c'est ce qui distingue un objectif
        // ajusté sur des faits d'un objectif décoratif répété de semaine en semaine.
        // Projection à pente constante, calculée ici car elle dépend de weeksToRace.
        const projectedVma = (vmaSlopePerWeek != null && vma)
          ? Math.round((vma + vmaSlopePerWeek * weeksToRace) * 10) / 10
          : null;
        if (vmaSlopePerWeek != null) {
          const trend = vmaSlopePerWeek > 0.02 ? `+${r1(vmaSlopePerWeek)} km/h/sem`
            : vmaSlopePerWeek < -0.02 ? `${r1(vmaSlopePerWeek)} km/h/sem (en BAISSE)` : "quasi nulle";
          objLines.push(`• PROGRESSION RÉELLE MESURÉE : ${trend}${projectedVma ? `, ce qui le projette à ~${projectedVma} km/h le jour J (il lui en faudrait ${reqVma})` : ""}.`);
          if (projectedVma != null && projectedVma < reqVma) {
            const sec = Math.round((objective.distanceKm / (projectedVma * frac / 100)) * 3600);
            const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
            const chrono = hh ? `${hh}h${String(mm).padStart(2, "0")}` : `${mm}'${String(ss).padStart(2, "0")}`;
            objLines.push(`• ⚠️ À CE RYTHME son objectif de ${objective.targetTime} n'est PAS atteignable : la projection donne plutôt ${chrono}. Propose-lui CE chrono comme cible révisée — un objectif ajusté sur des faits vaut mieux qu'un objectif décoratif qu'il ratera. Dis-le avec tact, en montrant d'abord le chemin parcouru.`);
          } else if (projectedVma != null) {
            objLines.push(`• ✅ À ce rythme son objectif est ATTEIGNABLE : dis-le-lui, c'est le meilleur carburant qui soit.`);
          }
        }
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
    // ⚠️ LA FC, PAS SEULEMENT L'ÉTIQUETTE — et c'est ce que ce filtre ne faisait pas.
    // Le fichier documente pourtant vingt lignes plus haut (`isHardWk`) qu'intervals.icu
    // n'émet que deux étiquettes : mesuré sur ce compte, 305 séances sur 334 sont dites
    // « easy », séances à 180+ de moyenne comprises. L'efficacité aérobie — censée se
    // mesurer À FAIBLE INTENSITÉ — intégrait donc des séances dures : 3 sur 59 dans la
    // fenêtre courante, +0,39 % sur le chiffre, et 0,6 point sur une comparaison de
    // fenêtres jugée à ±2 %. Le verdict ne basculait pas ce jour-là ; rien ne garantit
    // qu'il ne bascule pas un autre jour, sur un athlète qui enchaîne les séances dures.
    const easyRuns = runs.filter(w => { const age = now - new Date(w.date).getTime(); return age > from * 86400000 && age <= to * 86400000 && !isHardWk(w) && !!w.avg_hr && !!w.distance_km && !!w.duration_seconds; });
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

  // ── MODE PERTE DE POIDS ──
  // Ne s'active QUE si l'athlète l'a demandé ET que son profil y est éligible (les
  // garde-fous IMC < 20 / mineur / grossesse sont revérifiés ici : le coach ne doit pas
  // hériter d'un mode resté activé après un changement de profil). Sans ces conditions,
  // rien n'entre dans le prompt — le coach ne parle pas de poids de sa propre initiative.
  const weightLoss = (() => {
    if (!p?.weight_mode_enabled) return null;
    const body = { weightKg: num(p?.weight_kg), heightCm: num(p?.height_cm), age: num(p?.age), gender: typeof p?.gender === "string" ? p.gender : null };
    if (!weightModeEligibility(body, p?.health_conditions).ok) return null;
    const logs = (wlRes.data ?? []) as { date: string; weight_kg: number }[];
    const plan = buildWeightPlan({ body, goalKg: num(p?.weight_goal_kg), logs, workouts, now });
    if (!plan) return null;
    return { plan, rules: weightTrainingRules(plan) };
  })();

  // Palette de séances adaptée au niveau + objectif (la lib est la base de connaissances).
  // La MÊME règle que l'étiquette affichée sous le nom (lib/running/niveau). VMA inconnue :
  // le coach la traite en débutant, l'écran dit « à évaluer » — il ne l'invente pas.
  const libLevel: Level = niveauDeVma(vma) ?? "debutant";
  const libGoal: Goal = !objective ? "general"
    : (/trail|utmb|ultra|vertical|\bkv\b|montagne/i.test(objective.race) || (objective.distanceKm ?? 0) > 45) ? ((objective.distanceKm ?? 0) > 60 ? "ultra" : "trail")
    : (objective.distanceKm ?? 99) <= 5 ? "5k" : (objective.distanceKm ?? 99) <= 10 ? "10k" : (objective.distanceKm ?? 99) <= 21.5 ? "semi" : "marathon";
  const catalog = buildSessionCatalog({ level: libLevel, goal: libGoal });

  // Phase de périodisation (selon l'échéance) → oriente l'emphase des séances.
  const phase = objective?.raceDate && weeksToRace != null
    ? (weeksToRace <= semainesAffutage(objective.distanceKm) - 1 ? "AFFÛTAGE (volume réduit, fraîcheur, TSB positif le jour J ; on GARDE de courtes touches de qualité/allure course, on coupe le VOLUME pas l'intensité)"
      : weeksToRace <= 5 ? "SPÉCIFIQUE (allure course + terrain ; 2-3 qualités/sem dont l'allure objectif ; l'affûtage approche)"
      : weeksToRace <= 11 ? "DÉVELOPPEMENT (VMA, seuil, côtes, allure objectif ; 2-3 qualités/sem ; volume soutenu)"
      : "BASE AÉROBIE + VITESSE (volume facile en hausse, MAIS on pose DÉJÀ 2 qualités/sem : VMA courte pour le plafond + seuil/tempo — 'base' ne veut JAMAIS dire 'tout lent', surtout pour un objectif chrono)")
    : "PROGRESSION GLOBALE (base aérobie + 1-2 qualités/sem selon le niveau ; jamais 100 % facile pour qui veut progresser)";

  // Allures cibles calculées depuis la VMA (repli si zones non stockées).
  const paceAt = (pct: number) => { if (!vma) return "?"; const s = 3600 / (vma * pct / 100); return `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, "0")}`; };
  /**
   * L'allure de footing affichée et prescrite : la MESURE d'abord, le modèle ensuite.
   * `easyPaceSource` dit laquelle a servi — un athlète doit pouvoir savoir si son
   * allure vient de ce qu'il court ou de ce qu'un pourcentage suppose.
   */
  const easyPaceSource: "mesurée" | "modèle" | null =
    easyPaceMesure != null ? "mesurée" : vma ? "modèle" : null;
  // Le plafond d'un test de lactate (seuil 1) s'applique UNE fois, à la fin (`easyPaceCorrige`) :
  // posé ici, il faussait la relecture, qui « corrigeait » vers plus vite un écart fabriqué.
  const easyPaceLisible = easyPaceMesure != null
    ? `${Math.floor(easyPaceMesure / 60)}'${String(Math.round(easyPaceMesure % 60)).padStart(2, "0")}`
    : vma ? paceAt(70) : null;
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
  // ⚠️ PLUS DE FC DE REPOS INVENTÉE (c'était `restHr ?? 55`) : sans FC de repos déclarée ni
  // mesurée par la montre, le plafond de Karvonen n'a pas de base, et on le dit (« n/c »).
  const fcRest = restHrEff;
  const easyCeiling = fcMax != null && fcRest != null ? Math.round(fcRest + (fcMax - fcRest) * 0.78) : null;
  const easyRuns = recent14.filter(w => w.avg_hr != null && !isHardWk(w));
  const tooFastEasy = easyCeiling != null ? easyRuns.filter(w => (w.avg_hr ?? 0) > easyCeiling).length : 0;
  const easyDiscipline = easyRuns.length && easyCeiling != null
    ? `${tooFastEasy}/${easyRuns.length} footings au-dessus du plafond facile (~${easyCeiling} bpm)${tooFastEasy / easyRuns.length >= 0.34 ? " ⚠️ tendance à courir TROP VITE en facile → fais-le RALENTIR (frein n°1 à la progression)" : tooFastEasy === 0 ? " ✅ excellente discipline" : " ✅ discipline correcte"}`
    : "n/c (FC ou séances manquantes)";
  const todayStr = aujourdhui(FUSEAU_DEFAUT);
  // Jours où il a COURU. Compter toutes les activités faisait passer une journée de
  // randonnée pour une séance de course honorée : l'adhérence était surestimée et les
  // jours réellement ratés — ceux que la boucle doit justement détecter — invisibles.
  const doneDates = new Set(runs.map(w => String(w.date).slice(0, 10)));
  // ⚠️ UNE SÉANCE N'EST « RATÉE » QUE SI L'ATHLÈTE COURAIT CETTE SEMAINE-LÀ. Pendant un arrêt
  // — repos après une course, maladie, montre qui ne synchronise plus —, tous les jours
  // sont manqués, quel que soit le jour : à J+11 du marathon de Lille, le jeudi et le lundi
  // étaient déclarés « jours qui ne te conviennent pas » et retirés du plan (Cyprien,
  // 05/11/2026). Une prescription ne compte que s'il a couru à trois jours ou moins d'elle.
  const actifAutour = (d: string) => runs.some((w) => {
    const e = ecartJours(String(w.date).slice(0, 10), d);
    return e != null && Math.abs(e) <= 3;
  });
  const pastPrescribed = coachSessions.filter(c => c.date && c.date <= todayStr && now - new Date(c.date).getTime() <= 14 * 86400000 && actifAutour(c.date));
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
    if (!runnable(c.sessionType) || !actifAutour(c.date)) continue;
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
  // ── LA QUALITÉ DES SEPT DERNIERS JOURS, FAITE OU MANQUÉE ──
  // La dernière séance dure ne suffit pas : une séance PRESCRITE et non faite ne laissait
  // aucune trace, et le plan la represcrivait chaque matin (voir `lib/coach/qualiteRecente`).
  const qualiteRecente: QualiteRecente = qualiteDesSeptJours(
    coachSessions, workouts.filter(w => isHardWk(w)).map(w => String(w.date)), todayStr);

  // Taux d'adhérence exploitable par le code, et sa formulation lisible. Ils étaient
  // confondus dans une seule chaîne : impossible d'en tirer une décision.
  const adherenceDone = pastPrescribed.filter(c => doneDates.has(String(c.date).slice(0, 10))).length;
  const adherenceRate = pastPrescribed.length ? adherenceDone / pastPrescribed.length : null;
  const adherence = pastPrescribed.length
    ? `${adherenceDone}/${pastPrescribed.length} séances prescrites réalisées (14 j)`
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
  const trendOf = (key: "vertical_ratio_pct") => {
    const vals = runs.filter(w => w[key] != null)
      .map(w => ({ d: new Date(w.date).getTime(), v: Number(w[key]) }));
    if (vals.length < 4) return null;
    const recent = vals.slice(0, Math.ceil(vals.length / 2));
    const older = vals.slice(Math.ceil(vals.length / 2));
    const avg = (a: { v: number }[]) => a.reduce((s, x) => s + x.v, 0) / a.length;
    return { now: r1(avg(recent)), before: r1(avg(older)), n: vals.length };
  };
  const vr = trendOf("vertical_ratio_pct");
  // Ratio vertical : part du travail qui part vers le HAUT plutôt que vers l'avant.
  // Indépendant de la taille du coureur, contrairement à l'oscillation seule.
  const vrLine = vr ? `${vr.now} % (${vr.now < 6.5 ? "très économique" : vr.now < 8 ? "bon" : vr.now < 9 ? "correct" : "perfectible"})`
    + `${Math.abs(vr.now - vr.before) >= 0.2 ? ` — ${vr.now < vr.before ? `EN AMÉLIORATION (${vr.before} % avant) : sa foulée devient plus efficace, dis-le-lui` : `EN DÉGRADATION (${vr.before} % avant) : souvent un signe de fatigue neuromusculaire ou de foulée qui s'écrase — renfo et éducatifs`}` : " — stable"}` : null;
  // ⚠️ PLUS DE TENDANCE DE RÉCUPÉRATION CARDIAQUE (chute de FC sur 60 s). Mesurée le
  // 07/09/2026 sur 14 mois : pente 0,09 bpm/semaine pour un bruit de 8,1 bpm (signal/bruit
  // 0,62). Annoncée au modèle dès 2 bpm d'écart, elle a produit « après ton marathon, ta
  // récupération cardiaque est en baisse » dans un conseil de la relecture (05/11/2026) :
  // une tendance fabriquée sur du bruit. Voir la mémoire « colonnes sans signal ».

  // ── PERFORMANCE MESURÉE (courbe d'allure intervals.icu) ─────────────────────
  // La vitesse critique est ajustée sur les efforts RÉELS de l'athlète : c'est un
  // seuil mesuré, là où `paceAt(86)` n'est qu'un pourcentage d'une VMA elle-même
  // souvent estimée. Quand elle existe, elle prime.
  const pc = paceCurve;
  const csMs = num(pc?.criticalSpeed);
  const fmtPace = (secPerKm: number) => `${Math.floor(secPerKm / 60)}'${String(Math.round(secPerKm % 60)).padStart(2, "0")}`;
  // ⚠️ UN TEST DE LACTATE PASSE DEVANT (lib/coach/lactate) : il MESURE le seuil, la vitesse
  // critique l'ajuste sur des efforts. Six mois au plus ; sinon, la vitesse critique.
  const thresholdPace = lactate ? fmtAllure(lactate.lt2.allureSec)
    : csMs && csMs > 1 ? fmtPace(1000 / csMs) : null;
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
  // ── LES ARRÊTS D'UNE SÉANCE, relus sur sa trace (lib/activities/pauses) ─────────────────
  //    Une lecture ratée se DIT au journal (une fois par jour : ce contexte se reconstruit à
  //    chaque synchro) ; une séance sans trace se tait. Mémorisé par séance : la dernière
  //    séance et la dernière qualité sont souvent la même.
  //    « illisible » (lecture en erreur) n'est pas « aucun arrêt » : le verdict d'une qualité
  //    ne dit alors plus « tu peux durcir » (lib/coach/arretsQualite).
  const arretsLus = new Map<string, Promise<PausesSeance | null | "illisible">>();
  const lireArrets = (w: Wk | undefined): Promise<PausesSeance | null | "illisible"> => {
    if (objectifSeul || !w?.id) return Promise.resolve(null);
    const id = w.id;
    if (!arretsLus.has(id)) arretsLus.set(id, (async () => {
      // Une trace ne change plus une fois importée : ses arrêts sont mémorisés d'une
      // reconstruction à l'autre (lib/activities/cacheArrets), au lieu de relire des
      // milliers de points à chaque synchro.
      const deja = arretsMemorises(id, w.distance_km, w.duration_seconds);
      if (deja !== undefined) return deja;
      const { data, error } = await sb.from("activity_tracks").select("points, has_gps").eq("workout_id", id).maybeSingle();
      if (error) {
        console.error("[coach] trace illisible, arrêts inconnus :", error.code ?? "?", error.message);
        await journaliserEchecUneFois(null, { source: "coach-arrets", userId, message: `Trace d'une séance illisible, arrêts inconnus : ${error.code ?? "?"} ${error.message}` });
        return "illisible" as const;
      }
      // Pas de ligne, ou une séance SANS GPS (tapis) : on ne sait rien des arrêts, et c'est assumé.
      const ligne = data as { points?: unknown; has_gps?: boolean | null } | null;
      if (!ligne) return null;
      if (ligne.has_gps === false) { memoriserArrets(id, w.distance_km, w.duration_seconds, null); return null; }
      // ⚠️ UNE TRACE PRÉSENTE MAIS INEXPLOITABLE n'est pas « aucun arrêt » (relecture du
      // 10/11/2026) : trop peu de points, ou séance sans distance ni durée en mouvement.
      const arrets = pausesDeTrace(pointsStockes(ligne.points), vitesseEnMouvement(w.distance_km, w.duration_seconds));
      if (!arrets) return "illisible" as const;
      memoriserArrets(id, w.distance_km, w.duration_seconds, arrets);
      return arrets;
    })());
    return arretsLus.get(id)!;
  };
  const qeRaw = (p?.last_quality_exec ?? null) as { date?: string; repsSec?: number[]; avgHr?: number | null; fadeSec?: number | null } | null;
  const qeAgeDays = qeRaw?.date ? Math.floor((Date.now() - new Date(`${qeRaw.date}T12:00:00`).getTime()) / 86400_000) : null;
  const qe = qeAgeDays != null && qeAgeDays <= 12 ? qeRaw : null;
  // ⚠️ DES RÉPÉTITIONS TENUES APRÈS DES RÉCUPÉRATIONS RALLONGÉES NE PROUVENT RIEN (choix de
  // Cyprien, 10/11/2026) : un arrêt d'au moins une minute pendant la séance de qualité, et
  // « tu peux durcir » / « charge bien calibrée » ne sont plus dits (lib/coach/arretsQualite).
  // La séance est celle du jour de la série, la plus chargée si deux séances partagent la date.
  const seanceQualite = qe?.date
    ? runs.filter((w) => String(w.date).slice(0, 10) === qe.date).sort((a, b) => (Number(b.tss) || 0) - (Number(a.tss) || 0))[0]
    : undefined;
  // Une série relevée dont la séance est introuvable parmi les séances lues : on ne sait pas.
  const arretsQualite = !qe ? null : !seanceQualite && !objectifSeul ? ("illisible" as const) : await lireArrets(seanceQualite);
  const recupQualite = arretsQualite === "illisible" ? null : recupAllongee(arretsQualite);
  const verdictQualite = verdictExecution(qe?.fadeSec, recupQualite, arretsQualite === "illisible");
  const arretsQualiteTxt = recupQualite
    ? `${recupQualite.n} arrêt${recupQualite.n > 1 ? "s" : ""} d'au moins une minute (${dureeCourte(recupQualite.totalSec)} au total)`
    : "";
  const qeLine = qe?.repsSec?.length
    ? `${qe.repsSec.length} répétitions le ${qe.date} : ${qe.repsSec.map(fmtPace).join(" · ")}/km${qe.avgHr ? ` (FC moy ${qe.avgHr})` : ""}. ${
        verdictQualite == null ? ""
        : verdictQualite === "decrochage" ? `⚠️ DÉCROCHAGE de ${qe.fadeSec} s/km entre le début et la fin : la séance était trop ambitieuse, réduis l'allure cible ou le nombre de répétitions la prochaine fois.${recupQualite ? ` (Malgré ${arretsQualiteTxt} : le signal n'en est que plus net.)` : ""}`
        : verdictQualite === "non_probant" ? `⏸️ Allure tenue, mais avec ${arretsQualiteTxt} : ses récupérations ont été plus longues que prévu. Cette séance NE PROUVE PAS qu'il peut durcir : ne durcis pas la prochaine sur cette base, garde la même charge.`
        : verdictQualite === "arrets_inconnus" ? "⏸️ Allure tenue, mais ses arrêts n'ont pas pu être relus : on ne sait pas si ses récupérations ont été plus longues que prévu. Ne durcis pas la prochaine sur cette seule base."
        : verdictQualite === "accelere" ? `✅ Il a ACCÉLÉRÉ de ${-(qe.fadeSec ?? 0)} s/km sur la fin : il en avait sous le pied, tu peux durcir la prochaine.`
        : "✅ Allure tenue du début à la fin : la charge était bien calibrée."}`
    : null;

  // SOMMEIL : une nuit courte dégrade la tolérance à l'intensité AVANT de se voir sur la VFC.
  // On ne compte que la nuit dernière si la montre a été portée (sinon la donnée est absente,
  // pas mauvaise) — un score bas OU moins de 6 h coûtent une séance dure.
  const badNight = !!freshSleep && ((freshSleep.sleep_score != null && freshSleep.sleep_score < 60) || (lastSleepMin != null && lastSleepMin < 360));
  // DETTE : la règle ci-dessus ne regarde qu'UNE nuit. 3 h 23 puis 5 h 13 puis 6 h 51 se
  // termine sur une nuit « correcte » — rien ne s'allumait alors qu'il manque 4,4 h.
  // Un vide de plusieurs semaines dans TOUTES les sources à la fois ne dit pas ce qui
  // s'est passé : coupure, blessure ou montre non portée produisent le même silence, et
  // appellent des plans opposés. On le signale au lieu de le combler par une hypothèse.
  const datesConnues = [
    ...histRuns.map((r) => String(r.date)),
    ...((sleepDatesRes.data ?? []) as { date: string }[]).map((r) => String(r.date)),
    ...((hrvDatesRes.data ?? []) as { date: string }[]).map((r) => String(r.date)),
  ];
  const lacune = plusLongueLacune(datesConnues, iso190(), todayStr);
  const dette = detteSommeil(sleep, todayStr);
  // CHUTE AIGUË : la tendance 7 j vs 7 j ne bouge presque pas pour une seule mauvaise
  // matinée. Le 17/06, VFC à 76 pour une base à 103, et la tendance était EN HAUSSE.
  const vfcAigue = chuteVfc(hrv, todayStr);
  const noHistory = runs.length === 0;
  const fade = qe?.fadeSec ?? null;
  const faded = fade != null && fade >= 10;
  // ── PROGRAMME MARCHE-COURSE (lib/coach/marcheCourse) ────────────────────────
  // « Pas encore » à « Peux-tu courir 30 min sans t'arrêter ? » : onze étapes de trois
  // séances, ni qualité ni test VMA tant qu'elles durent. L'étape se déduit des sorties.
  const marcheCourse = programmeMarcheCourse({
    peutCourir30: (p as Record<string, unknown> | null)?.peut_courir_30min as boolean | null | undefined,
    joursCourus: runs.map((w) => String(w.date).slice(0, 10)),
    aujourdhui: todayStr,
  });
  const marcheCourseMotif = marcheCourse
    ? tr((l) => MOTIF_T[l].marcheCourse(nRaw(marcheCourse.etape, l), nRaw(marcheCourse.total, l)))
    : null;
  // ── REPRISE APRÈS UN ARRÊT (lib/coach/repriseArret) ─────────────────────────
  // De 6 à 28 jours sans courir : 50 % puis 75 % du volume habituel pendant une reprise
  // aussi longue que l'arrêt (Daniels). Sans elle, la semaine vide plafonnait tout à
  // 15 km — 14 km visés pour un coureur à 70 km par semaine (Cyprien, 05/11/2026).
  const repriseArret = repriseApresArret(runs.map((w) => String(w.date).slice(0, 10)), todayStr);
  const habitudeKm = robustWeekly?.km ?? (avg4wkKm > 0 ? avg4wkKm : weekKm);
  /** Plafond de volume de la semaine qui commence dans `dansJours` jours (Infinity hors reprise). */
  const plafondArretKm = (dansJours = 0) => {
    const part = partApresArret(repriseArret, dansJours);
    return part < 1 ? Math.round(habitudeKm * part) : Infinity;
  };
  // ── APRÈS LA COURSE ─────────────────────────────────────────────────────────
  // L'objectif passé n'est plus l'objectif, mais il n'est pas oublié : s'il a été couru
  // (une sortie enregistrée ce jour-là), l'intensité attend. Voir `lib/coach/apresCourse`.
  // ⚠️ ET UN NOUVEL OBJECTIF NE L'EFFACE PAS : fixé à J+5 du marathon, il écrasait la ligne
  // et la récupération avec elle. La course remplacée voyage donc dans `precedente`.
  // ⚠️ « PASSÉE » SE LIT SUR L'OBJECTIF DÉCLARÉ, plus sur l'objectif visé : quand une course
  // A du calendrier prend le relais, l'objectif visé existe alors que le déclaré est passé.
  const coursePassee = objectifDeclare && !objectifDeclareEnCours ? objectifDeclare : objectifDeclare?.precedente ?? null;
  // Toute course de la saison courue récemment compte aussi (une B, une C, un pic A) : la
  // récupération suit la PLUS RÉCENTE réellement courue.
  const candidatsRecup = [
    ...(coursePassee?.raceDate ? [{ nom: coursePassee.race, date: String(coursePassee.raceDate).slice(0, 10), distanceKm: Number(coursePassee.distanceKm) }] : []),
    ...coursesPassees(saison, todayStr).map((c) => ({ nom: c.nom, date: c.date, distanceKm: c.distanceKm ?? 0 })),
  ];
  const sortiesCourues = runs.map((w) => ({ date: String(w.date), distanceKm: num(w.distance_km) }));
  const recup = candidatsRecup
    .map((course) => apresCourse({ course, sorties: sortiesCourues, aujourdhui: todayStr }))
    .filter((r): r is NonNullable<ReturnType<typeof apresCourse>> => r != null)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  // ── COURSE B OU C DANS LA SEMAINE (lib/coach/saison) ─────────────────────────
  // Le coach ignorait les courses du calendrier : une VMA pouvait tomber le jour même.
  const dateObjectifVise = objective?.raceDate ? String(objective.raceDate).slice(0, 10) : null;
  const secondaire = courseSecondaireDeLaSemaine(saison, todayStr, dateObjectifVise);
  const secondaireMotif = secondaire
    ? tr((l) => MOTIF_T[l].courseSecondaire(secondaire.course.nom,
        formatDateCivile(secondaire.course.date, l, { weekday: "long", day: "numeric", month: "long" }), secondaire.course.priorite === "B"))
    : null;
  /** Course B dans la semaine `i` du plan (0 = celle qui commence aujourd'hui) : mini-affûtage. */
  const partCourseB = (i: number) => saison.some((c) => {
    if (c.priorite !== "B" || c.date === dateObjectifVise) return false;
    const e = ecartJours(c.date, todayStr);
    return e != null && e >= 7 * i && e <= 7 * i + 6;
  }) ? PART_VOLUME_COURSE_B : 1;
  /** La course B ou C de la semaine `i`, pour la feuille de route. */
  const courseDeLaSemaine = (i: number) => saison.find((c) => {
    if (c.priorite === "A" || c.date === dateObjectifVise) return false;
    const e = ecartJours(c.date, todayStr);
    return e != null && e >= 7 * i && e <= 7 * i + 6;
  }) ?? null;
  // Le volume aussi : 50, 70 puis 85 % de l'habitude, moyenne des 7 jours du plan.
  const partVolumeRecup = recup ? facteurVolumeApresCourse(recup) : 1;
  // Ce que le bandeau annonce est ce que le plan vise : la plus basse des deux réductions,
  // jamais leur produit (un arrêt pendant la récupération ne divise pas deux fois).
  const partVolumeAnnoncee = Math.min(partVolumeRecup, partApresArret(repriseArret));
  // LA REPRISE PEUT TOMBER DANS LES SEPT JOURS DU PLAN (0 = aujourd'hui). Le plan accueille
  // alors sa séance ce jour-là, pas avant : sinon, le plan étant reconstruit chaque matin,
  // la première qualité n'apparaissait au calendrier qu'une fois la reprise arrivée.
  const joursAvantReprise = recup ? Math.max(0, ecartJours(recup.reprise, todayStr) ?? 0) : 0;
  const repriseCetteSemaine = recup != null && joursAvantReprise <= 6;
  const recupMotif = recup
    ? tr((l) => recup.phase === "sans-intensite"
        ? MOTIF_T[l].apresCourse(recup.nom, nRaw(recup.joursDepuis, l), formatDateCivile(recup.reprise, l, { day: "numeric", month: "long" }),
            nRaw(Math.round(partVolumeAnnoncee * 100), l))
        : MOTIF_T[l].repriseApresCourse(recup.nom, nRaw(recup.joursDepuis, l), formatDateCivile(recup.fin, l, { day: "numeric", month: "long" }),
            nRaw(Math.round(partVolumeAnnoncee * 100), l)))
    : null;
  // L'arrêt se DIT, et sa cause possible aussi : une montre qui ne synchronise plus produit
  // le même silence qu'un vrai repos.
  const arretMotif = repriseArret
    ? tr((l) => MOTIF_T[l].repriseArret(nRaw(repriseArret.arretJours, l), nRaw(Math.round(repriseArret.part * 100), l), repriseArret.enCours))
    : null;
  // ── ARBITRAGE DU BUDGET DE QUALITÉ ───────────────────────────────────────────
  // Extrait dans `lib/coach/qualityBudget` : c'est la décision la plus lourde du coach
  // et elle était intestable au milieu des requêtes. Deux défauts y ont été corrigés —
  // la charge comptée deux fois (ratio ET TSB) et le plancher de préparation qui ne
  // s'appliquait jamais en cas de fatigue. Voir l'en-tête du module.
  const entreeQualite: Parameters<typeof computeQualityBudget>[0] = {
    level: libLevel, goal: libGoal, phase, noHistory, pains,
    // Ce qu'on a VU, pas ce qui a été déclaré : le budget de qualité ne peut pas
    // dépasser ce que l'historique observé justifie.
    seancesRecentes: runs.filter(w => now - new Date(String(w.date) + "T12:00:00Z").getTime() <= 28 * 86400000).length,
    hrvDown: !!hrvWeekTrend?.startsWith("↓"),
    hrvUp: !!hrvWeekTrend?.startsWith("↑"),
    badNight,
    badNightLabel: `${freshSleep?.sleep_score ?? "?"}/100${lastSleepMin ? `, ${Math.floor(lastSleepMin / 60)}h${String(lastSleepMin % 60).padStart(2, "0")}` : ""}`,
    acr: load.acr, tsb: load.tsb,
    rpeHigh, rpeAvg,
    hardTimePct, fadeSec: fade, plateau, noMaxEffort, runYears,
    weightLossMaxQuality: weightLoss ? weightLoss.rules.maxQualityPerWeek : null,
    hasObjective: !!objective, daysToRace, isShortGoal,
    apresCourse: recupMotif ? { motif: recupMotif.fr, reprise: repriseCetteSemaine } : null,
    marcheCourse: !!marcheCourse,
    consignesKine: consignes || aptitudeAttente ? {
      motif: [
        consignes ? `consignes de ton kinésithérapeute jusqu'au ${consignes.jusquAu.slice(8, 10)}/${consignes.jusquAu.slice(5, 7)}` : null,
        aptitudeAttente ? APTITUDE_T.fr.motif : null,
      ].filter(Boolean).join(" ; "),
      sansQualite: aptitudeAttente || !!consignes?.sansIntensite || consignes?.dureeMaxMin != null,
    } : null,
  };
  const qb = computeQualityBudget(entreeQualite);
  // Une course B ou C dans la semaine EST une séance dure : elle prend la place d'une qualité.
  const qBudget = Math.max(0, qb.qBudget - (secondaire ? 1 : 0));
  const { structuralQBudget, easeReasons, expCapped, expCap } = qb;

  // ── VERDICT DE FRAÎCHEUR DU JOUR — calculé, pas laissé à l'appréciation de l'IA ──
  // Un modèle de langage a tendance à « sentir » l'état de forme au fil du texte ; ici on
  // tranche de façon déterministe et on lui impose la conclusion. Feu rouge = pas d'intensité,
  // point final.
  // Les motifs sont MATÉRIALISÉS dans les 5 langues dès leur création : ils finissent
  // recopiés dans le « pourquoi » des séances, et un « pourquoi » allemand ne peut pas
  // basculer en français au milieu de la phrase. Le français reste la version canonique
  // (prompt du modèle, bandeau « pourquoi ce plan »).
  const redFlags: I18nText[] = [];
  const orangeFlags: I18nText[] = [];
  // Ce qui s'affiche dans le bandeau SANS compter dans le feu : un fait, pas une fatigue.
  const infoFlags: I18nText[] = [];
  // Mise en forme française : ces motifs ne partaient qu'au prompt de l'IA, où le format
  // était sans importance. Ils sont désormais AFFICHÉS à l'athlète sur son calendrier
  // (bandeau « pourquoi ce plan ») — « 2.4 » et « -44 » au milieu d'une phrase française
  // trahissent une chaîne de débogage, pas une explication.
  const frNum = (n: number, d = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");
  // D'OÙ VIENT LA FATIGUE. Un athlète qui lit « charge aiguë élevée » après une semaine
  // de randonnée en montagne croit que le coach lui reproche ses kilomètres courus.
  // Quand une part notable de la charge vient d'un autre sport, on le NOMME.
  const crossBlame = (l: Lang) => cross.sharePct >= 20 && cross.labelAll
    ? MOTIF_T[l].origineCross(cross.sharePct, cross.labelAll[l]) : "";
  // La ZONE de douleur est stockée en français (l'IA et le budget de qualité la
  // reconnaissent par mots-clés français) : on la traduit à l'affichage seulement.
  // La récupération d'après-course est un état du corps comme un autre : elle s'affiche
  // dans le bandeau, sinon « aucune séance de qualité » n'aurait aucune raison visible.
  if (recupMotif) orangeFlags.push(recupMotif);
  // L'arrêt n'est pas une fatigue : il borne déjà le volume (Daniels), il ne doit pas en
  // plus faire passer le feu à l'orange et raccourcir la sortie longue une seconde fois.
  if (arretMotif) infoFlags.push(arretMotif);
  // Le programme marche-course est un cadre, pas une fatigue : il se dit sans colorer le feu.
  if (marcheCourseMotif) infoFlags.push(marcheCourseMotif);
  if (secondaireMotif) infoFlags.push(secondaireMotif);
  // Le bilan du matin : fatigue ou jambes à 4-5/5 colorent le feu (et allègent la séance dure du
  // jour, autoPlan) ; le stress seul s'affiche sans rien retirer. Jamais de rouge sur le ressenti.
  // ⚠️ AFFICHÉ, PAS COMPTÉ DANS LE FEU (relecture du 10/11/2026) : en orange, il faisait passer un
  //    coureur déjà « jaune » à « orange », ce qui coupe la sortie longue de TOUTE la semaine.
  //    Le bilan ne parle que d'aujourd'hui : seule la séance dure du jour change (autoPlan).
  if (bilan && effetDuBilan.allege) infoFlags.push(tr((l) => BILAN_T[l].motif(bilan.fatigue, bilan.jambes)));
  if (aptitudeAttente) infoFlags.push(tr((l) => APTITUDE_T[l].motif));
  if (bilan && effetDuBilan.stressHaut) infoFlags.push(tr((l) => BILAN_T[l].stress(bilan.stress)));
  if (pains.length) redFlags.push(tr((l) => MOTIF_T[l].douleur(pains.map((x) => traduireDouleur(x, l)).join(", "))));
  // ── LA CHARGE SEULE NE SUFFIT PLUS À DÉCLARER ROUGE ─────────────────────────
  // Le feu rouge annule l'intensité du JOUR. Comme le plan est republié chaque jour et
  // que le ratio aigu:chronique met des semaines à redescendre après une coupure, CHAQUE
  // journée devenait « Récupération » : quatre footings de 25 min d'affilée relevés sur
  // le calendrier d'un athlète qui courait 73 km cette semaine-là, VFC au plus haut de
  // son historique. Un plan qu'on ignore ne protège plus personne.
  //
  // Quand la physiologie (VFC nettement au-dessus de sa base, sommeil correct, aucune
  // douleur) contredit l'arithmétique de charge, le verdict passe donc en ORANGE —
  // séance allégée, pas séance annulée — et la contradiction est ÉCRITE. Douleur, VFC en
  // baisse et double signal gardent, eux, le feu rouge.
  const loadRedOnly = qb.bodySaysFresh;
  const loadFlag = (msg: I18nText) => { if (loadRedOnly) orangeFlags.push(msg); else redFlags.push(msg); };
  if (load.acr > 1.8) loadFlag(tr((l) => MOTIF_T[l].ratioRisque(nLoc(load.acr, l, 1), crossBlame(l))));
  if (load.tsb < -30) loadFlag(tr((l) => MOTIF_T[l].tsbProfond(nLoc(load.tsb, l), crossBlame(l))));
  // La contradiction est un CONSTAT, pas un signal négatif : elle est affichée à part.
  for (const n of qb.notesAll) orangeFlags.push(n);
  if (hrvWeekTrend?.startsWith("↓") && badNight) redFlags.push(tr((l) => MOTIF_T[l].vfcEtNuit));
  if (hrvWeekTrend?.startsWith("↓")) orangeFlags.push(tr((l) => MOTIF_T[l].vfcBasse));
  if (badNight) orangeFlags.push(tr((l) => MOTIF_T[l].sommeilDegrade(String(freshSleep?.sleep_score ?? "?"))));
  if (dette) orangeFlags.push(tr((l) => MOTIF_T[l].detteSommeil(dureeLoc(dette.manqueMin, l), nRaw(dette.nuits, l))));
  // Seule, la chute aiguë vaut un avertissement ; confirmée par le sommeil, c'est le
  // double signal qui coûte la séance dure.
  if (vfcAigue) {
    const motif = tr((l) => MOTIF_T[l].vfcChute(`-${nRaw(vfcAigue.chutePct, l)} %`, nRaw(vfcAigue.valeur, l), nRaw(vfcAigue.base, l)));
    if (badNight || dette) redFlags.push(motif); else orangeFlags.push(motif);
  }
  if (load.acr > 1.5 && load.acr <= 1.8) orangeFlags.push(tr((l) => MOTIF_T[l].chargeAigue(nLoc(load.acr, l, 1))));
  if (monotony > 2) orangeFlags.push(tr((l) => MOTIF_T[l].monotonie(nRaw(monotony, l))));
  if (lastRpe != null && lastRpe >= 8) orangeFlags.push(tr((l) => MOTIF_T[l].rpeDerniere(nRaw(lastRpe, l))));
  else if (rpeHigh) orangeFlags.push(tr((l) => MOTIF_T[l].rpeDuree(nRaw(rpeAvg, l))));
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
  // Le prompt du modèle reste INTÉGRALEMENT en français : il n'est pas lu par l'athlète.
  const redFr = redFlags.map((f) => f.fr), orangeFr = orangeFlags.map((f) => f.fr), infoFr = infoFlags.map((f) => f.fr);
  const readinessBlock = `${readiness} — ${readinessRule}${redFr.length ? `\n  • Signaux rouges : ${redFr.join(" ; ")}` : ""}${orangeFr.length ? `\n  • Signaux orange : ${orangeFr.join(" ; ")}` : ""}${!redFr.length && !orangeFr.length ? "\n  • Aucun signal négatif : VFC, sommeil, charge et ressenti sont alignés." : ""}${infoFr.length ? `\n  • À savoir : ${infoFr.join(" ; ")}` : ""}`;

  // ── MÉTÉO RÉELLE ────────────────────────────────────────────────────────────
  // Pas la température de la montre (capteur au poignet, jusqu'à 3 °C d'écart mesuré)
  // mais le relevé réel à la position d'entraînement, et surtout les PRÉVISIONS :
  // anticiper une canicule vaut mieux que la constater après la séance.
  // (Position et prévisions : lues plus haut, avant les cibles de FC — voir « MÉTÉO RÉELLE ».)
  // ALTITUDE — facteur totalement absent jusqu'ici. Au-delà de ~500 m, la performance
  // aérobie se dégrade d'environ 6 % par 1 000 m chez un athlète non acclimaté. Sans
  // cette information, le coach juge des allures d'altitude à l'aune du niveau de la
  // mer et conclut à une perte de forme là où l'athlète est simplement en montagne.
  const elevationM = weather.elevationM;
  // ── ACCLIMATATION À LA CHALEUR ───────────────────────────────────────────────
  // On compte les jours où il a RÉELLEMENT COURU dans la chaleur, pas les jours
  // calendaires chauds : rester au frais pendant une canicule n'acclimate personne.
  // Un seul appel d'archive couvre les 21 jours.
  const heatAcclim = lecture.meteo ? lecture.meteo.heatAcclim : await (async () => {
    if (lat == null || lon == null) return { hotDays: 0, ...heatAcclimation(0) };
    const past = await archiveDailyMax(lat, lon, 21).catch(() => new Map<string, number>());
    if (!past.size) return { hotDays: 0, ...heatAcclimation(0) };
    const runDays = new Set(runs
      .filter(w => now - new Date(w.date).getTime() <= 21 * 86400000)
      .map(w => String(w.date).slice(0, 10)));
    let hot = 0;
    for (const d of runDays) if ((past.get(d) ?? 0) >= 25) hot++;
    return { hotDays: hot, ...heatAcclimation(hot) };
  })();
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

  // ── FACTEUR LIMITANT ─────────────────────────────────────────────────────────
  // Ce qui sépare un entraîneur d'un générateur de séances : il ne déroule pas un
  // menu, il identifie CE QUI BLOQUE et met le travail dessus. Deux coureurs de même
  // VMA, l'un qui décroche en fin de course et l'autre qui manque de vitesse pure,
  // n'ont pas besoin du même entraînement — et jusqu'ici ils recevaient le même.
  //
  // On classe les candidats par gravité. Chacun s'appuie sur une mesure, jamais sur une
  // impression, et reste silencieux si la mesure manque.
  const limiters: { key: string; severity: number; label: string; action: string }[] = [];

  // 1. RÉGULARITÉ — avant toute physiologie. Un plan non suivi ne produit rien.
  if (skippedWeekdays.length >= 2 || (adherenceRate != null && pastPrescribed.length >= 4 && adherenceRate < 0.5)) {
    limiters.push({ key: "regularite", severity: 100,
      label: "la RÉGULARITÉ, pas la physiologie",
      action: "réduis le nombre de séances jusqu'à ce qu'il les tienne TOUTES pendant trois semaines. Un plan suivi à 60 % vaut moins qu'un plan deux fois plus léger suivi à 100 %." });
  }
  // 2. ENDURANCE AÉROBIE — la dérive cardiaque dit s'il tiendra la distance.
  const driftW = runs.find(w => w.cardiac_decoupling != null);
  const drift = driftW ? Number(driftW.cardiac_decoupling) : null;
  if (drift != null && drift >= 8) {
    limiters.push({ key: "endurance", severity: 90,
      label: `l'ENDURANCE AÉROBIE (dérive cardiaque ${drift > 0 ? "+" : ""}${drift} %)`,
      action: "volume facile et sorties longues progressives AVANT toute recherche de vitesse. À ce niveau de dérive, il perdra en fin de course ce qu'il aura gagné en fractionné." });
  }
  // 3. DISCIPLINE DES FOOTINGS — courir trop vite en facile bride tout le reste.
  if (hardTimePct != null && hardTimePct > 25) {
    limiters.push({ key: "discipline", severity: 80,
      label: `la DISCIPLINE DES FOOTINGS (${hardTimePct} % du temps en Z3+)`,
      action: "fais-le RALENTIR en facile. Tant que ses footings sont des tempos, il accumule de la fatigue sans stimulus — et sa qualité en pâtit." });
  }
  // 4. EXÉCUTION — décrocher sur ses séries signe une prescription mal calibrée.
  if (fade != null && fade >= 12) {
    limiters.push({ key: "execution", severity: 70,
      label: `l'EXÉCUTION de ses séances de qualité (décrochage ${fade} s/km)`,
      action: "il part trop vite. Raccourcis les séries et impose un premier tiers volontairement lent — savoir doser est une compétence qui s'entraîne." });
  }
  // 5. SEUIL vs VMA — un seuil bas pour la VMA signale un moteur sous-exploité.
  if (csMs && vma) {
    const ratio = (csMs * 3.6) / vma;   // vitesse critique rapportée à la VMA
    if (ratio < 0.86) limiters.push({ key: "seuil", severity: 60,
      label: `le SEUIL (vitesse critique à ${Math.round(ratio * 100)} % de sa VMA, contre 88-92 % attendus)`,
      action: "il a de la cylindrée mais ne sait pas la tenir : privilégie le travail au seuil et les over-under à la VMA pure." });
    else if (ratio > 0.93) limiters.push({ key: "vitesse", severity: 55,
      label: `la VITESSE PURE (vitesse critique à ${Math.round(ratio * 100)} % de sa VMA, très proche du plafond)`,
      action: "son seuil est excellent mais son plafond aérobie le limite : il faut du VO2max — VMA courte, 30/30, côtes." });
  }
  // 6. ÉCONOMIE DE COURSE — le ratio vertical, indépendant de la taille.
  if (vr && vr.now >= 9) {
    limiters.push({ key: "economie", severity: 50,
      label: `l'ÉCONOMIE DE COURSE (ratio vertical ${vr.now} %)`,
      action: "trop d'énergie part vers le haut : renforcement excentrique, éducatifs de projection, lignes droites en fin de footing." });
  }
  // 7. VOLUME — un volume faible plafonne tout le reste.
  if (avg4wkKm > 0 && vma && avg4wkKm < vma * 2.2) {
    limiters.push({ key: "volume", severity: 45,
      label: `le VOLUME (${Math.round(avg4wkKm)} km/sem pour une VMA de ${vma})`,
      action: "sa cylindrée dépasse son kilométrage : c'est le volume facile qui débloquera ses chronos, pas plus d'intensité." });
  }
  limiters.sort((a, b) => b.severity - a.severity);
  const limiter = limiters[0] ?? null;


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
    // Référence chronique : médiane des semaines RÉELLEMENT courues plutôt que moyenne
    // sur 28 jours. Une coupure de trois semaines faisait tomber la référence à 23 km
    // chez quelqu'un qui venait d'en courir 62 — un chiffre qui ne décrivait aucune de
    // ses semaines, et qui dimensionnait pourtant tout son plan marathon.
    // Repli sur l'ancien calcul si moins de 3 semaines courues : on ne déduit pas un
    // niveau de deux points.
    const chronic = robustWeekly?.km ?? (avg4wkKm > 0 ? avg4wkKm : weekKm);
    // Part de la semaine écoulée que l'on considère acquise. Plus le ratio est haut,
    // moins on entérine le pic — sans pour autant retomber sur la seule moyenne, qu'une
    // période creuse (voyage, coupure) tire artificiellement vers le bas : prescrire
    // 23 km à quelqu'un qui vient d'en courir 62 ne serait pas prudent, juste inutile.
    const keep = load.acr > 1.5 ? 0.3 : load.acr > 1.3 ? 0.6 : 1;
    const blended = chronic + Math.max(0, weekKm - chronic) * keep;
    const growth = load.acr > 1.5 ? 1.0 : load.acr > 1.3 ? 1.05 : 1.1;
    // Et jamais un bond brutal par rapport à ce qui vient d'être réellement couru
    // (reprise après coupure : la moyenne des 4 semaines est alors trop optimiste).
    // Pendant une reprise après arrêt, la semaine vide ne plafonne plus rien : c'est la
    // part de Daniels qui borne chaque semaine (`plafondArretKm`).
    const capped = repriseArret ? blended * growth : Math.min(blended * growth, Math.max(weekKm * 1.4, floorKm));
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

  // ── MENU DE QUALITÉ — le stimulus PROGRESSE d'une semaine à l'autre ──────────
  // Prescrire « 6×1000 m » chaque semaine indéfiniment ennuie l'athlète et le fait
  // plafonner physiologiquement. On fait tourner 4 variantes par type, du plus court
  // et intense vers le plus long et spécifique, indexées sur la semaine ISO (stable
  // dans la semaine, et qui avance toute seule le lundi suivant).
  // Sélection du FORMAT et position dans le cycle de SURCHARGE sont deux choses
  // distinctes. `variant = isoWeek % 4` servait aux deux : quelle que soit la longueur
  // du menu, seuls les quatre premiers formats étaient jamais tirés — les suivants
  // n'existaient que sur le papier. On découple.
  // Le tirage porte désormais sur le GABARIT, pas sur la phrase rendue : c'est ce qui
  // garantit que les 5 langues décrivent LA MÊME séance, et pas un variant chacune.
  const pickT = <T,>(arr: T[]): T => arr[isoWeek % arr.length];
  /** Une séance de qualité + sa description dans les 5 langues (le français est canonique). */
  const quali = (type: string, gabarit: (l: Lang) => string): QualitySession => {
    // Sans VMA, une allure s'écrivait « ~?/km » : on écrit « au ressenti » (lib/coach/allureInconnue).
    const descAll = tr((l) => sansAllureInconnue(gabarit(l), l));
    return { type, desc: descAll.fr, descAll };
  };

  /**
   * SURCHARGE PROGRESSIVE — le manque le plus coûteux du plan automatique.
   *
   * Le menu TOURNAIT (isoWeek % 4) : la même séance revenait à l'identique toutes les
   * quatre semaines. Or un organisme ne progresse que si le stimulus AUGMENTE. Faire
   * 4×8 min au seuil en semaine 1 puis exactement 4×8 min en semaine 5, c'est
   * entretenir — pas entraîner.
   *
   * On ajoute donc un volume croissant sur les trois premières semaines du cycle, puis
   * la quatrième REDESCEND : c'est la semaine d'assimilation, celle où l'adaptation se
   * produit réellement. Le plafond de +2 répétitions évite qu'un cycle long ne dérive
   * vers des séances interminables.
   */
  const blockWeek = isoWeek % 4;                    // 0,1,2 = montée · 3 = assimilation
  // ⚠️ PAS DE SEMAINE ALLÉGÉE LA VEILLE DE L'AFFÛTAGE (09/11/2026, `allegementDuBloc`) : la même
  // règle pour la feuille de route, la semaine en cours, la dose des qualités et le renforcement
  // (`cycle.veilleAffutage`, lu par autoPlan). La veille, la qualité reste au niveau de la
  // semaine 3 du bloc : une semaine de travail, pas un pic juste avant l'affûtage.
  const veilleAffutage = weeksToRace != null && weeksToRace === semainesAffutage(objective?.distanceKm);
  const semaineAllegeeDuBloc = allegementDuBloc(blockWeek, weeksToRace, objective?.distanceKm);
  const blocDose = veilleAffutage ? Math.min(blockWeek, 2) : blockWeek;

  /**
   * PLAFONDS DE VOLUME INTENSE — règles de Jack Daniels (Daniels' Running Formula).
   *
   * Le volume de travail dur se rapporte au KILOMÉTRAGE HEBDOMADAIRE, jamais au niveau
   * ressenti. Une séance de 5×1000 m est un bon stimulus à 60 km/semaine et une
   * surcharge à 25. Le moteur ne connaissait aucune de ces limites : il proposait
   * 12×400 m — 4,8 km d'intervalles — à un athlète visant 35 km/semaine, soit près du
   * double du maximum admis.
   *
   *   · intervalles (VO2max) : le PLUS PETIT de 10 km ou 8 % du volume hebdomadaire ;
   *   · seuil : 10 % du volume hebdomadaire.
   *
   * C'est la règle la plus simple qui existe pour ne pas blesser un coureur : elle
   * empêche mécaniquement de prescrire un volume dur que son kilométrage ne supporte pas.
   */
  const weeklyRef = Math.min(targetFrom(15), plafondArretKm(0));
  const capIntervalKm = Math.min(10, weeklyRef * 0.08);
  const capThresholdKm = weeklyRef * 0.10;
  const thrSecPerKm = (() => {
    const m = (thresholdPace ?? "").match(/(\d+)['’](\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  })();

  // REPRISE APRÈS UNE COURSE : la séance est écrite COURTE — le dosage de la semaine
  // d'assimilation —, pas « coupe un tiers » ajouté au texte : la montre lit le texte de
  // la séance, elle recevrait sinon la version complète.
  const doseReduite = semaineAllegeeDuBloc || repriseCetteSemaine;
  /** Nombre de répétitions, plafonné par la règle des 8 % sur la distance travaillée. */
  const prog = (base: number, repMeters?: number): number => {
    const n = doseReduite ? Math.max(2, Math.round(base * 0.7)) : base + Math.min(2, blockWeek);
    if (!repMeters || !(weeklyRef > 0)) return n;
    return Math.min(n, Math.max(2, Math.floor((capIntervalKm * 1000) / repMeters)));
  };
  /** Durée d'un bloc au seuil, plafonnée par la règle des 10 % convertie en minutes. */
  const progMin = (base: number, blocks = 1): number => {
    const m = doseReduite ? Math.max(5, Math.round(base * 0.75)) : base + blocDose * 2;
    if (!thrSecPerKm || !(weeklyRef > 0)) return m;
    const maxMinTotal = (capThresholdKm * thrSecPerKm) / 60;
    return Math.max(5, Math.min(m, Math.floor(maxMinTotal / blocks)));
  };
  const progLabel = blockWeek === 3
    ? "SEMAINE D'ASSIMILATION (volume de qualité réduit — c'est ici que l'adaptation se produit, ne la saute pas)"
    : `semaine ${blockWeek + 1}/4 du bloc — le volume de qualité MONTE par rapport à la précédente`;

  // ── LES DESCRIPTIONS DE QUALITÉ SONT MATÉRIALISÉES DANS LES 5 LANGUES ────────
  // Le variant choisi doit être LE MÊME dans toutes les langues : on tire donc le
  // GABARIT (une fonction), pas la phrase déjà rendue. Le français sort du même
  // gabarit que les quatre autres — il ne peut plus diverger au fil des retouches.
  const qVMA = quali("VMA", pickT<(l: Lang) => string>([
    (l) => QUALITE_T[l].vmaCourte(prog(10, 400), repPace(104, 400)),
    (l) => QUALITE_T[l].vmaMoyenne(prog(7, 500), repPace(102, 500)),
    (l) => QUALITE_T[l].vmaLongue800(prog(5, 800), repPace(100, 800)),
    (l) => QUALITE_T[l].vmaLongue1000(prog(4, 1000), repPace(100, 1000)),
    (l) => QUALITE_T[l].pyramide(repPace(102, 500)),
    (l) => QUALITE_T[l].trenteTrente(prog(12, 150), repPace(105, 400)),
    (l) => QUALITE_T[l].vmaDeuxBlocs(prog(5, 600), repPace(105, 400)),
    (l) => QUALITE_T[l].fartlek(prog(8, 300)),
  ]));
  // Allure seuil : la vitesse critique MESURÉE prime sur le pourcentage de VMA estimée.
  const sPace = thresholdPace ?? paceAt(86);
  /**
   * ALLURE SOUS-SEUIL — le principe central de la méthode norvégienne (Bakken,
   * Ingebrigtsen), qui manquait entièrement.
   *
   * La vitesse critique EST le seuil (LT2). Y placer des blocs longs, c'est faire une
   * séance dure là où il faudrait accumuler du volume qualitatif. Bakken travaille
   * 0,4 à 0,8 mmol EN DESSOUS : une allure qu'on peut répéter le lendemain, ce qui
   * permet d'en faire beaucoup plus sur la semaine — et c'est le volume au seuil, pas
   * son intensité, qui déplace le seuil.
   *
   * Traduit en allure : environ 8 s/km plus lent que la vitesse critique. Les blocs
   * LONGS s'y tiennent ; les fractions COURTES peuvent toucher le seuil.
   */
  const subPace = (() => {
    const m = sPace.match(/(\d+)['’](\d{2})/);
    if (!m) return sPace;
    const sec = Number(m[1]) * 60 + Number(m[2]) + 8;
    return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}`;
  })();
  const qSeuil = quali("Seuil", pickT<(l: Lang) => string>([
    (l) => QUALITE_T[l].seuilFractionne(prog(3), progMin(8, 3), sPace),
    (l) => QUALITE_T[l].seuilLongSous(progMin(13, 2), subPace),
    (l) => QUALITE_T[l].seuilReference(prog(2), progMin(10, 2), sPace),
    (l) => QUALITE_T[l].seuilContinuSous(progMin(21, 1), subPace),
    (l) => QUALITE_T[l].overUnder(prog(3), progMin(6, 3), subPace, sPace),
    (l) => QUALITE_T[l].seuilProgressif(progMin(18, 1), subPace, sPace),
    (l) => QUALITE_T[l].tempoLongSous(progMin(24, 1), subPace),
  ]));
  // Le nom de la course est un NOM PROPRE : il n'est jamais traduit. Seul son
  // remplaçant quand l'athlète n'a pas d'objectif l'est (« objectif » / « goal » / …).
  const nomCourse = (l: Lang) => raceShort ?? QUALITE_T[l].objectif;
  const qSpec = quali("Spécifique", goalPace ? pickT<(l: Lang) => string>([
    (l) => QUALITE_T[l].spec1km(nomCourse(l), prog(5), goalPace),
    (l) => QUALITE_T[l].spec1500(nomCourse(l), prog(3), goalPace),
    (l) => QUALITE_T[l].spec2km(nomCourse(l), prog(2), goalPace),
    (l) => QUALITE_T[l].spec3km(nomCourse(l), goalPace),
  ]) : (l) => QUALITE_T[l].specSansAllure);
  const qCote = quali("VMA", pickT<(l: Lang) => string>([
    (l) => QUALITE_T[l].cotesCourtes(prog(8)),
    (l) => QUALITE_T[l].cotesMoyennes(prog(6)),
    (l) => QUALITE_T[l].cotesLongues(prog(4)),
    (l) => QUALITE_T[l].cotesDescente,
  ]));
  const qMara = quali("Spécifique", goalPace ? pickT<(l: Lang) => string>([
    (l) => QUALITE_T[l].maraBloc20(goalPace),
    (l) => QUALITE_T[l].maraBloc15(goalPace),
    (l) => QUALITE_T[l].maraFinish(goalPace),
    (l) => QUALITE_T[l].maraBlocLong(goalPace),
  ]) : (l) => QUALITE_T[l].maraSansAllure);
  let menu: QualitySession[];
  if (libGoal === "5k" || libGoal === "10k") menu = [qVMA, qSpec, qSeuil];
  else if (libGoal === "semi") menu = [qSeuil, qSpec, qVMA];
  else if (libGoal === "marathon") menu = [qSeuil, qMara, qVMA];
  else if (libGoal === "trail" || libGoal === "ultra") menu = [qCote, qSeuil, qVMA];
  else menu = [qVMA, qSeuil, qSpec];
  // LE DÉNIVELÉ DÉCLARÉ décide de la place des côtes (voir lib/coach/denivele) — AVANT le
  // facteur limitant et la phase : à l'approche de la course, l'objectif garde le dernier mot.
  // Jusqu'au 11/10/2026, la réponse n'atteignait que la relecture IA, qui ne change aucune séance.
  menu = menuSelonDenivele(menu, { vma: qVMA, cote: qCote }, preferenceDenivele(p?.elevation_pref), {
    objectifDenivele: libGoal === "trail" || libGoal === "ultra",
    semainePaire: isoWeek % 2 === 0,
  });
  // LE FACTEUR LIMITANT REMONTE EN TÊTE DE MENU.
  // Sans cela il n'était qu'une phrase de plus dans le briefing : le plan continuait à
  // dérouler l'ordre par défaut de l'objectif. Deux coureurs de même VMA, l'un qui
  // décroche en fin de course et l'autre qui manque de vitesse pure, recevaient la même
  // séance. C'est précisément ce qu'un entraîneur ne fait jamais.
  if (limiter) {
    const wanted = limiter.key === "seuil" ? "Seuil"
      : limiter.key === "vitesse" ? "VMA"
      : limiter.key === "endurance" || limiter.key === "volume" ? "Seuil"   // rien de plus dur qu'un seuil quand l'endurance manque
      : limiter.key === "execution" ? "Spécifique"                          // réapprendre à doser sur une allure connue
      : null;
    if (wanted) {
      const i = menu.findIndex(m => m.type === wanted);
      if (i > 0) menu = [menu[i], ...menu.filter((_, k) => k !== i)];
    }
  }
  // LA PHASE PASSE APRÈS LE FACTEUR LIMITANT, DONC DEVANT LUI. À un mois de la course,
  // l'allure objectif prend la tête du menu — la même règle que la feuille de route, qui
  // annonçait « Allure mara » au-dessus d'une semaine qui posait un seuil (lib/coach/phase).
  // Une course déjà passée (semaines négatives) ne donne pas de phase.
  const phaseSemaine = objective?.raceDate && weeksToRace != null && weeksToRace >= 0 ? phaseDeSemaine(weeksToRace, objective.distanceKm) : null;
  menu = specifiqueEnTete(menu, phaseSemaine);
  // REPRISE APRÈS UNE COURSE : la seule séance de la semaine est un SEUIL, quel que soit
  // l'objectif suivant — ni VMA ni côtes sur des fibres encore abîmées (lib/coach/apresCourse).
  if (repriseCetteSemaine) menu = [qSeuil, ...menu.filter((m) => m !== qSeuil)];
  // ── DOUBLE SEUIL (méthode norvégienne, lib/coach/doubleSessions) ─────────────
  // ⚠️ IL N'ÉTAIT JAMAIS POSÉ. L'éligibilité se calculait et s'affichait dans le profil
  // (« le double seuil reste hors de portée : … »), le texte des séances existait, et le
  // plan n'en produisait aucune — même pour l'athlète qui remplissait toutes les conditions.
  // Désormais : option cochée + éligible (volume, ancienneté, ni douleur ni feu rouge) +
  // allure seuil connue + ni récupération, ni reprise, ni affûtage, ni marche-course → deux
  // journées matin + soir, et les côtes en troisième séance si le budget le permet.
  const enAffutage = weeksToRace != null && weeksToRace >= 0 && weeksToRace <= semainesAffutage(objective?.distanceKm) - 1;
  const etatDoubles = etatDouble({
    optIn: Boolean((p as Record<string, unknown> | null)?.double_sessions),
    optInSeuil: (p as Record<string, unknown> | null)?.double_seuil === true,
    // `robustWeeklyKm` renvoie un objet ({ km, weeksRun, weeksOff }) : le confondre
    // avec un nombre donnait un volume `[object Object]` — donc jamais supérieur au
    // seuil, donc des doubles refusés en silence chez un athlète qui y avait droit.
    weeklyKm: habitudeKm,
    runYears, readiness: readyLevel, pains, taper: enAffutage, lang: langAthlete,
    recuperation: recup?.nom ?? null,
  });
  const allureSeuilConnue = /\d+['’]\d{2}/.test(sPace);
  // La récupération d'après-course n'a pas besoin d'être exclue ici : `etatDouble` refuse
  // tout double tant qu'elle dure (phase de reprise comprise) — vérifié par mutation.
  const doubleSeuilActif = !consignes && !aptitudeAttente && etatDoubles.seuilActif && allureSeuilConnue && qBudget >= 1
    && !repriseArret && !marcheCourse;
  const doseDS = doseDoubleSeuil(habitudeKm);
  const qDoubleSeuil: QualitySession = {
    ...quali("Seuil", (l) => seanceDoubleSeuil("soir", sPace, l, doseDS.soir)),
    matin: tr((l) => sansAllureInconnue(seanceDoubleSeuil("matin", sPace, l, doseDS.matin), l)),
  };
  const chosen = doubleSeuilActif
    ? [...Array.from({ length: Math.min(2, qBudget) }, () => qDoubleSeuil), ...(qBudget >= 3 ? [qCote] : [])]
    : menu.slice(0, qBudget);
  // Coché et à sa portée (volume, ancienneté), mais pas cette semaine — récupération,
  // affûtage, feu rouge, douleur ou budget de qualité épuisé : on le dit, sinon l'option
  // paraît morte. L'éligibilité DE FOND se lit sans ces empêchements passagers.
  const seuilAPortee = etatDouble({
    optIn: true, optInSeuil: true, weeklyKm: habitudeKm, runYears,
    readiness: "vert", pains: [], taper: false, recuperation: null, lang: langAthlete,
  }).seuilActif;
  const doubleSeuilSuspendu = (p as Record<string, unknown> | null)?.double_seuil === true
    && Boolean((p as Record<string, unknown> | null)?.double_sessions)
    && seuilAPortee && !doubleSeuilActif && allureSeuilConnue;
  // Préférence athlète : remplacer la sortie longue course par du VÉLO (cross-training sans impact, comme beaucoup de pros).
  const bikeLong = String((p as Record<string, unknown> | null)?.long_run_mode ?? "run") === "bike";
  const longRunNote = bikeLong
    ? `1 SORTIE LONGUE EN VÉLO (cross-training) À LA PLACE de la sortie longue en course — même durée/volume aérobie (FC Z2, allure conversationnelle), SANS impact pour limiter le risque blessure (choix de l'athlète, comme beaucoup de pros). Pas d'allure /km (pilotée à la FC). ${(libGoal === "marathon" || libGoal === "trail" || libGoal === "ultra") ? "Garde au moins 1 sortie longue EN COURSE par mois pour la spécificité (impact, terrain)." : ""}`.trim()
    : `1 sortie longue facile en Z2${(phase.startsWith("SPÉ") || phase.startsWith("AFFÛ") || libGoal === "marathon") && goalPace ? ` avec un bloc à ${goalPace}/km` : ""}`;

  const weekTarget = `${chosen.length ? chosen.map((s, i) => `• Qualité ${i + 1} : ${s.matin ? `DOUBLE SEUIL — matin : ${s.matin.fr} / soir : ` : ""}${s.desc}`).join("\n") : "• Aucune séance dure ce cycle (récupération) : que du facile + mobilité/renfo léger."}
• ${longRunNote}.
• 1 renforcement musculaire (peut se greffer après un footing facile, pas un jour à part obligatoire).
• ≥ 1 jour de repos complet.
• Tout le reste = footing FACILE Z2 (~${paceAt(70)}/km), allure conversationnelle.
RÈGLE 80/20 — À COMPRENDRE : c'est une répartition du VOLUME (temps total), PAS du nombre de séances. ${chosen.length} séance(s) de qualité COURTE(S) (20–40 min d'effort réel) dans une semaine de plusieurs heures = toujours ~80 % facile. Le piège « presque tout en EF + renfo » SOUS-ENTRAÎNE un coureur qui vise un chrono : refuse-le.${expCapped ? `
⛔ PLAFOND LIÉ AU PASSIF : ${runYears != null && runYears < 1 ? "moins d'un an" : `${runYears} ans`} de course → maximum ${expCap} séance(s) de qualité/semaine, quel que soit l'objectif. Le cardio encaisse déjà, les tendons NON. Ce plafond n'est pas négociable, même si l'athlète se sent bien.` : ""}${easeReasons.length ? `\n⚠️ ALLÈGEMENT ce cycle (${easeReasons.join(" ; ")}) → qualité réduite, priorité récupération. La santé d'abord.` : ""}${daysSinceLast != null && daysSinceLast >= 3 && daysSinceLast <= 8 && !easeReasons.length ? `\nREPRISE : ${daysSinceLast} j de repos SANS perte de forme (3–8 j d'arrêt ne déconditionnent PAS). UN footing de remise en route suffit, PUIS on enchaîne la qualité normalement — ne transforme pas ça en semaine molle entière.` : ""}`;

  // ── PLAN MACRO PÉRIODISÉ — bloc complet jusqu'au jour J (base → dév → spécifique → affûtage) ──
  const macroPlan: { week: number; phase: string; volumeKm: number; quality: string[]; longRunKm: number; focus: string }[] = (() => {
    // ⚠️ LA SEMAINE DE COURSE N'EXISTAIT PAS. `weeksToRace` arrondit vers le bas : à 27 jours
    // du marathon de Lille (Cyprien, 28/09/2026), il vaut 3, et la feuille de route
    // s'arrêtait au 18/10 — la course est le 25. Tout était décalé d'une semaine : le
    // volume de « semaine de course » (−45 %) tombait à J−13, et la vraie semaine de course,
    // sans feuille de route, retombait sur un repli à −35 % : l'affûtage REMONTAIT juste
    // avant le départ, avec des footings de 10 km la veille de l'avant-veille.
    // On compte donc les semaines EN INCLUANT celle de la course (J−6 → J = la dernière).
    // Pendant la marche-course, le programme EST la feuille de route : des semaines de VMA
    // et de seuil affichées au-dessus de « 8 × (1 min de course / 2 min de marche) »
    // promettraient un entraînement que l'athlète ne peut pas encore faire.
    if (daysToRace == null || daysToRace < 0 || !vma || marcheCourse) return [];
    const semainesAvecCourse = Math.floor(daysToRace / 7) + 1;
    const W = Math.min(semainesAvecCourse, 26);
    const baseKm = targetFrom(20);
    const menuTypes = (libGoal === "5k" || libGoal === "10k") ? ["VMA", "Allure spé", "Seuil"]
      : libGoal === "marathon" ? ["Seuil", "Allure mara", "VMA"]
      : (libGoal === "trail" || libGoal === "ultra") ? ["Côtes", "Seuil", "Spécifique"]
      : libGoal === "semi" ? ["Seuil", "Allure spé", "VMA"]
      : ["VMA", "Seuil", "Allure spé"];
    // Point de départ de la sortie longue : ce qu'il court DÉJÀ. Sans cette ancre, le plan
    // prescrivait 9 km à un athlète qui venait d'en courir 26 deux jours plus tôt.
    const lrCurrent = Math.max(longestRecentKm, Math.round(baseKm * 0.25));
    // ⚠️ POUR UN 5 OU UN 10 KM, LE PIC DE LA COURSE DEVENAIT UN PLAFOND : 12 km de sortie
    // longue chaque semaine pour un coureur à 70-80 km (Cyprien, sub 16 sur 5 km, relevé le
    // 05/11/2026). Les footings étant bornés à 85 % de la sortie longue, le volume ne
    // tenait plus dans la semaine. Le pic de la course reste le MINIMUM exigé (`longRunGap`) ;
    // la sortie longue peut aller jusqu'au quart de l'habitude (Daniels), plafond assumé
    // de 22 km, soit 1 h 30 à 1 h 40 d'endurance pour ces distances.
    const lrPeakCourse = longRunPeakKm(libGoal as RaceGoal, objective?.distanceKm ?? null);
    const lrPeak = lrPeakCourse != null && (objective?.distanceKm ?? 0) <= 15
      ? Math.max(lrPeakCourse, Math.min(22, Math.round(habitudeKm * 0.25)))
      : lrPeakCourse;
    const lrShare = longRunShare(libGoal as RaceGoal, objective?.distanceKm ?? null);
    const out: { week: number; phase: string; volumeKm: number; quality: string[]; longRunKm: number; focus: string }[] = [];
    let longueDuBloc = 0;   // plus longue sortie planifiée avant l'affûtage
    // Semaines qui commencent pendant la récupération d'après-course : la montée en charge
    // (+6 %/semaine) ne repart qu'APRÈS elles. Sinon elle les comptait comme des semaines de
    // progression, et la feuille de route sautait de 65 à 87 km à la sortie de récupération.
    // Les semaines de reprise après un arrêt non plus : elles sont bornées par Daniels.
    const semainesRecup = Array.from({ length: W }, (_, i) => i)
      .filter((i) => (recup != null && decaleJour(todayStr, 7 * i) < recup.fin) || plafondArretKm(7 * i) < Infinity).length;
    for (let i = 0; i < W; i++) {
      // Semaines PLEINES avant la semaine de course : même sens que `weeksToRace`, donc
      // mêmes seuils de phase qu'avant (0 = semaine de course, 1 = J−13 → J−7…).
      const wkUntil = semainesAvecCourse - 1 - i;
      const ph = phaseDeSemaine(wkUntil, objective?.distanceKm);
      // Semaine de récupération d'après-course ou de reprise après un arrêt : volume déjà
      // réduit, ni progression ni semaine allégée par-dessus.
      const semaineBornee = (recup != null && decaleJour(todayStr, 7 * i) < recup.fin) || plafondArretKm(7 * i) < Infinity;
      let factor: number;
      // L'affûtage DESCEND jusqu'au bout. La semaine de course est la plus légère — et son
      // volume s'entend HORS course : `autoPlan` ne compte pas la course dans la cible
      // (`usedKm`), il répartit ce chiffre entre les footings de J−6 à J−3.
      // Le NOMBRE de semaines d'affûtage dépend de la distance (lib/coach/phase) : trois
      // pour un marathon (72, 55 puis 40 %), deux pour un semi, une seule pour 5 ou 10 km.
      const partTaper = partAffutage(wkUntil, objective?.distanceKm);
      if (partTaper != null) factor = partTaper;
      else {
        // Plafond de montée en charge : +40 % au-dessus du volume de départ… SAUF si
        // l'athlète a DÉJÀ tenu davantage. Un coureur de 20 ans revenu à 40 km après une
        // coupure, mais qui tournait à 77 km/semaine quatre mois plus tôt, était plafonné
        // à 56 km — bien en dessous de ce que son propre passé démontre, et sans qu'aucun
        // écran ne le dise. Le RYTHME de progression (+6 %/semaine) ne bouge pas : seul
        // le toit se lève, et le ratio aigu:chronique continue de piloter le présent.
        const ceilFactor = demonstratedKm && baseKm > 0 ? Math.max(1.4, demonstratedKm / baseKm) : 1.4;
        factor = Math.min(ceilFactor, 1 + Math.max(0, i - semainesRecup) * 0.06);
        // UNE SEMAINE ALLÉGÉE SUR QUATRE, SUR UNE SEULE HORLOGE : la semaine 4 du bloc ISO, celle
        // où la dose des qualités baisse déjà (`blockWeek === 3`). L'ancien `(i + 1) % 4` partait
        // d'aujourd'hui : la feuille de route reportait l'allègement à dans trois semaines, chaque
        // jour, et la semaine en cours ne l'était jamais — sous un texte « volume −20 % ».
        // Et jamais la veille de l'affûtage (`allegementDuBloc`) : la semaine suivante l'est déjà.
        if (allegementDuBloc(blockWeek + i, wkUntil, objective?.distanceKm) && !semaineBornee) factor *= 0.8;
      }
      // Après une course courue, chaque semaine de la récupération porte sa part du volume
      // (lib/coach/apresCourse) : la feuille de route dit ce que le plan fera.
      const volumeKm = Math.round(Math.min(baseKm * factor
        * (recup ? facteurVolumeApresCourse({ joursDepuis: recup.joursDepuis + 7 * i, joursTotal: recup.joursTotal }) : 1)
        * partCourseB(i),
        plafondArretKm(7 * i)));
      // La sortie longue se déduit de la DISTANCE VISÉE, plus seulement d'un pourcentage
      // du volume. Le plafond de Daniels (25 %) empêche la sortie longue d'écraser la
      // semaine ; il ne dit pas ce qu'il faut courir pour préparer un marathon. Employé
      // seul, il produisait un pic de 12 km de sortie longue pour une course de 42,2 km.
      // Semaine de course : AUCUNE sortie longue — la course est l'effort long (autoPlan n'en
      // pose pas). La feuille de route annonçait « ~6 km », que le coach IA répétait.
      const longRunPrevuSemaine = wkUntil <= 0 ? 0 : longRunForWeek({
        weekIndex: i, weeksToPeak: Math.max(1, W - 3),
        current: lrCurrent, peak: lrPeak,
        weeklyKm: volumeKm, share: lrShare, taper: ph === "Affûtage",
        // L'affûtage part de la plus longue sortie du bloc (ou, s'il commence tout de suite,
        // de ce que l'athlète court déjà) : il descend EN PENTE, il ne tombe pas à 20 %.
        semainesAvantCourse: wkUntil, reference: Math.max(lrCurrent, longueDuBloc),
      });
      // Semaine de récupération ou de reprise après un arrêt : la MÊME borne que le plan de la
      // semaine, 30 % du volume réduit. Sans elle, la feuille de route annonçait 16 km de
      // sortie longue dans une semaine de 32 km — la moitié du volume (relevé le 05/11/2026).
      const longRunKm = semaineBornee ? Math.min(longRunPrevuSemaine, Math.round(volumeKm * 0.3)) : longRunPrevuSemaine;
      if (ph !== "Affûtage") longueDuBloc = Math.max(longueDuBloc, longRunKm);
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
      // APRÈS UNE COURSE COURUE, LA FEUILLE DE ROUTE DIT CE QUE LE PLAN FERA : aucune qualité
      // tant que la reprise ne tombe pas dans la semaine — sinon elle annonçait « la semaine
      // prochaine : VMA » sous un bandeau qui interdit l'intensité —, puis un seul seuil court
      // jusqu'à la fin de la récupération (lib/coach/apresCourse).
      const debutSemaine = decaleJour(todayStr, 7 * i);
      const sansQualite = recup != null && decaleJour(debutSemaine, 6) < recup.reprise;
      const enReprise = recup != null && !sansQualite && debutSemaine < recup.fin;
      const quality = sansQualite ? [] : enReprise ? ["Seuil"] : priority.slice(0, Math.max(1, qn));
      const focus = sansQualite ? `Récupération après ${recup.nom} : footings seulement`
        : enReprise ? `Reprise après ${recup.nom} : une séance courte au seuil`
        : ph === "Base" ? "Volume aérobie + pose de vitesse"
        : ph === "Développement" ? "VMA & seuil — montée en charge"
        : ph === "Spécifique" ? `Allure course${goalPace ? ` (${goalPace}/km)` : ""} + endurance spécifique`
        : wkUntil <= 1 ? "Fraîcheur — repos, rappels d'allure" : "Volume −, on garde l'intensité (fraîcheur jour J)";
      // Une course B ou C de la semaine se lit dans la feuille de route, comme dans le plan.
      const cs = courseDeLaSemaine(i);
      out.push({ week: i + 1, phase: ph, volumeKm, quality, longRunKm, focus: cs ? `${focus} · course ${cs.priorite} : ${cs.nom}` : focus });
    }
    return out;
  })();

  /**
   * AVERTISSEMENTS SUR L'OBJECTIF — destinés à l'ÉCRAN, pas seulement au prompt de l'IA.
   *
   * Défaut réel : l'app détectait parfaitement qu'un chrono visé était hors de portée
   * (« ce chrono demande une VMA ~19,8 km/h, il est à ~17,6 ») et qu'une préparation
   * marathon plafonnerait à 12 km de sortie longue — mais ces deux constats ne
   * partaient QUE dans le contexte du modèle de langage. L'athlète ne les découvrait
   * qu'en ouvrant une conversation avec le coach. Sur son calendrier, rien.
   */
  // ── LA PENTE DE L'ATHLÈTE ──────────────────────────────────────────────────
  // Le coach savait où il en est ; il ne savait pas s'il MONTE. Le verdict sur
  // l'objectif reposait sur +0,4 %/semaine supposés, identiques pour tout le monde.
  // On mesure ici l'efficacité aérobie (vitesse par battement, sorties faciles) par
  // blocs de 4 semaines, et on ne conclut que si la tendance ressort du bruit.
  const coursesForme = ((formeRes.data ?? []) as { date: string; sport?: string | null; distance_km: number | null; duration_seconds: number | null; avg_hr: number | null; gap_min_km?: number | null; elevation_gain_m?: number | null }[])
    .filter((w) => isRun(w.sport));
  const tendanceForme = tendanceEfficacite(efficaciteParBloc(coursesForme, fcMaxEst, now));
  const ameliorationPrevue = ameliorationAttendue(weeksToRace, tendanceForme);

  // ── LE TERRAIN DE LA COURSE ─────────────────────────────────────────────────
  // L'objectif ne transportait que le NOM de la course : un coureur préparant un trail
  // à 1 200 m de D+ recevait le même plan qu'un 10 km sur route. On retrouve la course
  // au catalogue par son nom ET sa date — un nom seul est ambigu, il existe plusieurs
  // « Course de Bondues ». ⚠️ Un dénivelé ABSENT (null) n'est pas un dénivelé NUL : on
  // ne prescrit alors rien, et on le dit.
  // ⚠️ NOM + DATE NE SUFFISENT PAS. Une même épreuve publie plusieurs formats le même
  // jour : « Foulées de Bondues » existe en 1,5 km, 5 km et 10 km à la même date. Sans
  // le filtre de DISTANCE, la recherche rendait 3 lignes, était jugée ambiguë, et le
  // dénivelé passait pour inconnu alors qu'il était là.
  // Un défi personnel n'est pas au catalogue : un homonyme le même jour y serait pris pour lui.
  const courseCible = objective?.race && objective?.raceDate && num(objective.distanceKm) != null && estOfficielle(objective)
    ? (await sb.from("races").select("elevation_gain_m, terrain, difficulty, distance_km")
        .ilike("name", objective.race).eq("date", objective.raceDate)
        .gte("distance_km", objective.distanceKm - 0.5).lte("distance_km", objective.distanceKm + 0.5)
        .limit(2)).data
    : null;
  const dplusCourse = Array.isArray(courseCible) && courseCible.length === 1
    ? num((courseCible[0] as { elevation_gain_m?: number | null }).elevation_gain_m)
    : null;
  const dplusConnu = Array.isArray(courseCible) && courseCible.length === 1
    && (courseCible[0] as { elevation_gain_m?: number | null }).elevation_gain_m != null;
  const terrain = objective
    ? exigenceTerrain(dplusCourse, objective.distanceKm, denivelePartSemaine(coursesForme, now))
    : null;

  // ── NUTRITION DU JOUR DE COURSE ─────────────────────────────────────────────
  // La sortie longue avait son plan ; la course n'avait rien, alors que c'est le seul
  // jour où une erreur d'alimentation coûte des mois de préparation.
  // ⚠️ La température du jour J n'est connue QUE si la course tombe dans la fenêtre de
  // prévision : `historical_weather` est vide sur les 17 211 courses du catalogue.
  const meteoCourse = objective?.raceDate
    ? (weather.days ?? []).find((d) => d.date === objective.raceDate)?.tempMax ?? null
    : null;
  const nutriCourse = objective && vma
    ? planNutritionCourse({
        // Le même socle réel que le tableau de bord (sortie longue 42 j, volume démontré) :
        // la durée de course qui dimensionne gels et boisson ne doit pas différer de
        // celle que l'athlète lit sur sa carte de prédictions.
        dureeSec: predictRaceSec(vma, objective.distanceKm, { sortieLongueKm: longestRecentKm || null, volumeHebdoKm: demonstratedKm }),
        distanceKm: objective.distanceKm,
        poidsKg: num(p?.weight_kg),
        tempC: meteoCourse,
      })
    : null;

  // ── LE COACH SE RELIT ───────────────────────────────────────────────────────
  // Il vérifiait SI l'athlète avait couru le jour prévu, jamais CE QU'IL AVAIT FAIT.
  // On compare ici l'allure facile PRESCRITE à celle réellement tenue sur 90 jours,
  // en GAP quand la montre le donne — sans quoi une semaine en côtes passerait pour
  // une baisse de forme.
  const cibleFacileSec = (() => {
    const m = String(easyPaceLisible ?? "").match(/(\d+)['’:](\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  })();
  const relecture = cibleFacileSec == null ? null : relireExecution(
    coursesForme
      .filter((w) => {
        const km = num(w.distance_km), sec = num(w.duration_seconds), fc = num(w.avg_hr);
        const age = now - new Date(String(w.date).slice(0, 10) + "T12:00:00Z").getTime();
        return km != null && km >= 4 && sec != null && sec > 0 && age <= 90 * 86400000
          && (fcMaxEst == null || (fc != null && fc / fcMaxEst < 0.80));
      })
      .map((w) => ({
        allureSecKm: num(w.gap_min_km) != null ? num(w.gap_min_km)! * 60 : num(w.duration_seconds)! / num(w.distance_km)!,
        cibleSecKm: cibleFacileSec,
      })),
  );
  // La correction ne s'applique QUE si la relecture a conclu. Sinon l'allure d'origine
  // reste : une cible ajustée sur du bruit serait pire que pas d'ajustement du tout.
  const easyPaceRelu = relecture?.correctionSec
    ? corrigerAllure(easyPaceLisible, relecture.correctionSec) ?? easyPaceLisible
    : easyPaceLisible;
  // ⚠️ LA RELECTURE NE REPASSE PAS AU-DESSUS DU SEUIL 1 MESURÉ. Elle recale la cible sur ce
  // que l'athlète court vraiment : un coureur qui fait ses footings à 4'10 la tirait vers
  // 4'20 quand son test de lactate place le seuil aérobie à 4'20 (relevé par le test).
  const easyPaceCorrige = (() => {
    if (!lactate || !easyPaceRelu) return easyPaceRelu;
    const m = easyPaceRelu.match(/(\d+)['’](\d{2})/);
    const sec = m ? Number(m[1]) * 60 + Number(m[2]) : null;
    return sec != null && sec < allureFacileMaxSec(lactate) ? fmtAllure(allureFacileMaxSec(lactate)) : easyPaceRelu;
  })();

  const objectiveWarnings: string[] = (() => {
    const out: string[] = [];
    if (!objective) return out;
    // 1. Le chrono visé est-il atteignable au potentiel actuel ?
    if (vma && objective.targetSeconds > 0) {
      const needKmh = objective.distanceKm / (objective.targetSeconds / 3600);
      const pctVma = needKmh / vma;
      // Un marathon se court ~80 % de VMA, un semi ~85 %, un 10 km ~90 %.
      const usual = objective.distanceKm > 30 ? 0.80 : objective.distanceKm > 15 ? 0.85 : objective.distanceKm > 6 ? 0.90 : 0.93;
      if (pctVma > usual + 0.06) {
        out.push(`⚠️ CHRONO TRÈS AMBITIEUX : ${objective.targetTime} sur ${frNum(objective.distanceKm, 1)} km demande de tenir ${Math.round(pctVma * 100)} % de ta VMA, alors qu'on tient environ ${Math.round(usual * 100)} % sur cette distance. Au potentiel actuel (VMA ~${frNum(vma, 1)}), la projection est plutôt ${predict(objective.distanceKm, usual * 100)}. Objectif à retravailler, ou gros bloc de VMA d'ici là.`);
      }
    }
    // 2. La préparation atteindra-t-elle une sortie longue à la hauteur de la distance ?
    // ⚠️ SANS FEUILLE DE ROUTE, PAS DE VERDICT. `Math.max(0, ...[])` vaut 0 : sans VMA, le
    // macro-plan est vide et l'encadré annonçait une préparation qui « plafonnera à ~0 km ».
    // Ce 0 n'est pas une mesure, c'est l'absence de plan.
    // ⚠️ ET LA PRÉPARATION COMPREND CE QUI EST DÉJÀ COURU. Le macro-plan ne porte que les
    // semaines à venir : à trois semaines de la course, il ne contient plus que l'affûtage
    // (75 %, 55 % de la plus longue, puis la semaine de course à 0), et un athlète qui venait
    // de courir 30 km lisait que sa préparation « plafonnera à ~22 km ».
    if (macroPlan.length) {
      const plannedPeak = Math.max(longestRecentKm, ...macroPlan.map(w => w.longRunKm));
      const gap = longRunGap(plannedPeak, longRunPeakKm(libGoal as RaceGoal, objective.distanceKm), objective.distanceKm);
      if (gap) out.push(gap);
    }
    // 3. L'ÂGE autorise-t-il cette distance ? Un athlète de 18 ans qui vise un marathon
    // ne pourra pas s'inscrire à une épreuve officielle en France (limite Junior : 25 km).
    // On ne le bloque pas — c'est son objectif, son plan est construit — mais le lui
    // taire serait le laisser préparer une course à laquelle il n'a pas accès.
    // Voir lib/coach/ageDistance : la règle vient du règlement fédéral, pas d'une opinion.
    // TOUS les avertissements, pas seulement le plus grave : à 16 ans, un objectif
    // marathon se heurte à la règle fédérale ET à l'avis médical de l'IMMDA. Ce ne
    // sont pas deux formulations du même argument, ce sont deux faits différents.
    for (const a of avertissementsAge({
      age: num(p?.age), distanceKm: objective.distanceKm, lang: langAthlete,
      // Le D+ de l'épreuve n'est pas connu ; en trail, la limite fédérale s'exprime en
      // km effort, donc l'avertissement est PRUDENT (il sous-estime plutôt que d'inventer).
      trail: libGoal === "trail" || libGoal === "ultra",
    })) {
      // Le règlement fédéral encadre l'INSCRIPTION aux épreuves : un défi couru seul n'en
      // a pas. L'avis médical, lui, vaut quelle que soit la façon de courir la distance.
      if (a.niveau === "reglement" && !estOfficielle(objective)) continue;
      out.push(`${a.texte} [source : ${a.sources.join(" ; ")}]`);
    }
    return out;
  })();

  // ── VOLUME DE LA SEMAINE & PHASE DU CYCLE ───────────────────────────────────
  // Sans ça, tout le monde recevait « 1h à 1h30 » de sortie longue, qu'il coure
  // 25 ou 100 km par semaine. Le macro-plan calculait déjà ces chiffres : on les branche.
  // Semaine allégée toutes les 4 semaines : sans objectif de course, on s'ancre sur le
  // numéro de semaine ISO (stable d'un jour à l'autre, contrairement à un compteur maison).
  const taper = weeksToRace != null && weeksToRace >= 0 && weeksToRace <= semainesAffutage(objective?.distanceKm) - 1;
  // La même horloge que la feuille de route et la dose des qualités (semaine 4 du bloc), et
  // jamais par-dessus une récupération ou une reprise, déjà réduites.
  const deload = !taper && semaineAllegeeDuBloc && !recup && !repriseArret;
  const baseKm = targetFrom(15);
  // Progression plafonnée à +10 %/semaine (+5 % si passif court ou antécédent de fracture).
  // Le mode perte de poids resserre encore ce plafond : l'impact au sol vaut 2,5 à 3 fois
  // le poids du corps à chaque appui, si bien qu'à volume ÉGAL en kilomètres la contrainte
  // osseuse et tendineuse n'a rien de comparable entre 65 et 110 kg.
  const growthBase = (runYears != null && runYears < 1) || (Array.isArray(p?.injury_zones) && (p.injury_zones as unknown[]).map(String).includes("fracture_fatigue")) ? 1.05 : 1.10;
  const growth = weightLoss ? Math.min(growthBase, 1 + weightLoss.rules.maxWeeklyProgressPct / 100) : growthBase;
  // VOLUME CIBLE déclaré à l'inscription (migration 035, voir lib/coach/volumeCible) : le
  // plan cesse de MONTER au-delà, sans jamais couper sous ce qui est déjà couru.
  // ⚠️ APRÈS UNE COURSE COURUE, LE VOLUME REPART DE LA MOITIÉ (lib/coach/apresCourse) : sans
  // cette réduction, la récupération ne retirait que l'intensité, et le plan conseillait
  // de doubler les footings pour loger 70 km à J+5 d'un marathon. Le macro-plan porte déjà
  // la réduction semaine par semaine ; sans macro-plan, on l'applique ici.
  const targetKm = volumeAvecCible(macroPlan.length ? macroPlan[0].volumeKm
    : Math.round(Math.min(baseKm * (taper ? 0.65 : deload ? 0.8 : growth) * partVolumeRecup * partCourseB(0), plafondArretKm(0))),
    volumeCible((p as Record<string, unknown> | null)?.target_weekly_km),
    habitudeKm);
  const longRunPrevu = macroPlan.length ? macroPlan[0].longRunKm : Math.round(targetKm * (taper ? 0.20 : 0.25));
  // Pendant la récupération, la sortie longue du macro-plan (28 km si l'objectif suivant est
  // un marathon) ne dépasse pas 30 % du volume réduit.
  const longRunPlanned = recup || repriseArret ? Math.min(longRunPrevu, Math.round(targetKm * 0.3)) : longRunPrevu;

  /**
   * LA SORTIE LONGUE RÉPOND AU VERDICT DE FRAÎCHEUR, comme la qualité.
   *
   * Le feu rouge ne retirait jusqu'ici que le bloc d'allure À L'INTÉRIEUR de la sortie
   * longue (autoPlan `canSpice`) : sa DISTANCE, elle, ne bougeait pas. Tant qu'elle
   * valait 25 % du volume, l'oubli restait inoffensif — 9 km. Depuis qu'elle se déduit
   * de la distance visée, il ne l'est plus : le plan proposait 26 km le dimanche à un
   * athlète en ratio aigu:chronique 2,4 et TSB −44, deux jours après une sortie de
   * 26 km, soit 72 % du volume de la semaine dans une seule séance.
   *
   * Les signaux qui déclenchent le rouge (ratio de charge, TSB, douleur) sont
   * PERSISTANTS : ils ne se dissiperont pas d'ici au week-end, la coupe est donc
   * justifiée même pour une séance placée dans 3 jours. L'orange, plus souvent dû à une
   * mauvaise nuit, n'entraîne qu'une réduction légère.
   */
  // La récupération d'après-course a DÉJÀ borné la sortie longue (30 % du volume réduit) :
  // compter son motif ici la raccourcissait une seconde fois.
  const motifsAllegement = easeReasons.filter((r) => r !== recupMotif?.fr).length;
  const longRunEase = readyLevel === "rouge" ? 0.6 : readyLevel === "orange" ? 0.8 : motifsAllegement ? 0.85 : 1;
  // Une durée maximale donnée par le kinésithérapeute plafonne la sortie longue (et donc les
  // footings, bornés à 85 % d'elle) : la distance que tient cette durée à l'allure facile.
  const kmConsigne = consignes?.dureeMaxMin != null ? kmPourDuree(consignes.dureeMaxMin, easyPaceCorrige) : null;
  const longRunKmBrut = Math.max(4, Math.round(longRunPlanned * longRunEase));
  const longRunKm = kmConsigne != null ? Math.min(longRunKmBrut, kmConsigne) : longRunKmBrut;
  const longRunEased = longRunKm < longRunPlanned;
  // CE QUE LA DOULEUR A CHANGÉ, pour l'écran Santé (« ton coach a retiré… ») : comparé au même
  // athlète SANS douleur, jamais déduit du texte du plan. Relecture du 10/11 : la sortie longue
  // était attribuée à la douleur même quand la fatigue ou la VFC la réduisaient. La douleur
  // n'ajoute qu'UN signal rouge (`MOTIF_T.douleur`) et UN motif d'allègement (« douleur
  // signalée ») : on les retire et on recalcule la même coupe.
  const effetsDouleur = pains.length ? (() => {
    const rougesSansDouleur = redFlags.length - 1;
    const niveauSansDouleur = rougesSansDouleur > 0 ? "rouge" : orangeFlags.length >= 2 ? "orange" : orangeFlags.length === 1 ? "jaune" : "vert";
    const motifsSansDouleur = easeReasons.filter((r) => r !== recupMotif?.fr && r !== "douleur signalée").length;
    const coupeSansDouleur = niveauSansDouleur === "rouge" ? 0.6 : niveauSansDouleur === "orange" ? 0.8 : motifsSansDouleur ? 0.85 : 1;
    const longueSansDouleurBrut = Math.max(4, Math.round(longRunPlanned * coupeSansDouleur));
    const longueSansDouleur = kmConsigne != null ? Math.min(longueSansDouleurBrut, kmConsigne) : longueSansDouleurBrut;
    return {
      qualiteRetiree: Math.max(0, computeQualityBudget({ ...entreeQualite, pains: [] }).qBudget - qb.qBudget),
      sortieLongue: longRunKm < longueSansDouleur ? { prevueKm: longueSansDouleur, reduiteKm: longRunKm } : null,
      // Fixé par le coach automatique sur le plan RÉEL (lib/coach/footings, `lignesRetireesParDouleur`) :
      // ici on ne sait pas encore combien de footings la semaine portera.
      lignesDroites: false,
    };
  })() : null;

  // ── NUTRITION ET HYDRATATION CHIFFRÉES ───────────────────────────────────────
  // « 30 à 60 g de glucides par heure » est un intervalle de manuel : il ne dit pas
  // à CET athlète quoi emporter samedi. On le calcule sur la durée réelle de sa sortie
  // longue, sa masse et la température prévue ce jour-là.
  const longRunMin = vma && longRunKm ? Math.round((longRunKm / (vma * 0.70)) * 60) : null;
  const weightKg = num(p?.weight_kg);
  // Météo du jour de sortie longue : le prochain samedi ou dimanche de la fenêtre.
  function ctx0Forecast(_km: number): DayWeather | undefined {
    return forecast.find(f => [0, 6].includes(new Date(`${f.date}T12:00:00`).getDay())) ?? forecast[2];
  }
  // ── USURE DES CHAUSSURES ─────────────────────────────────────────────────────
  // Au-delà de ~700-800 km, l'amorti est mort et le risque de blessure grimpe. Le
  // kilométrage n'est alimenté que si les séances sont rattachées à une paire, ce qui
  // n'arrive jamais via la synchronisation : quand UNE SEULE paire active existe pour
  // un terrain, on lui attribue les kilomètres COURUS depuis son achat — c'est ce que
  // l'athlète attend, et c'est vérifiable par lui. Avec plusieurs paires, l'attribution
  // est inconnue : on s'en tient au compteur enregistré et on le dit.
  const shoes = (shoeRes.data ?? []) as { brand: string; model: string; current_km: number | null; km_at_purchase: number | null; max_km: number | null; purchase_date: string; terrain: string | null }[];
  const shoeLines = shoes.map(sh => {
    const soleOfTerrain = shoes.filter(o => (o.terrain ?? "road") === (sh.terrain ?? "road")).length === 1;
    const sincePurchase = runs
      .filter(w => String(w.date).slice(0, 10) >= String(sh.purchase_date).slice(0, 10))
      .reduce((a, w) => a + (w.distance_km ?? 0), 0);
    const km = soleOfTerrain
      ? Math.round(Number(sh.km_at_purchase ?? 0) + sincePurchase)
      : Math.round(Number(sh.current_km ?? 0));
    const max = Number(sh.max_km ?? 600);
    const pct = max > 0 ? Math.round((km / max) * 100) : 0;
    const verdict = pct >= 100 ? "⛔ À REMPLACER — l'amorti est mort, chaque sortie supplémentaire augmente le risque"
      : pct >= 85 ? "⚠️ en fin de vie : prévois la paire suivante MAINTENANT et fais la transition progressivement"
      : pct >= 60 ? "usure normale, surveille" : "✅ fraîches";
    return `${sh.brand} ${sh.model} : ~${km} km / ${max} (${pct} %)${soleOfTerrain ? "" : " [compteur déclaré]"} → ${verdict}`;
  });

  const nutrition = (() => {
    if (!longRunMin || longRunMin < 75) return null;   // en dessous, les réserves suffisent
    const h = longRunMin / 60;
    // 60 g/h au-delà de 2 h30 (glucides multi-transportables), 45 g/h en deçà.
    const carbsPerH = longRunMin >= 150 ? 60 : 45;
    const carbsTotal = Math.round(carbsPerH * Math.max(0, h - 1));   // rien à ingérer la 1re heure
    // Le jour de la sortie longue conditionne l'hydratation.
    const day = ctx0Forecast(longRunKm);
    const t = day?.tempMax ?? null;
    const mlPerH = t == null ? 500 : t >= 30 ? 800 : t >= 25 ? 650 : t >= 20 ? 550 : 450;
    const sodium = t != null && t >= 25 ? 600 : 400;   // mg/L, pertes sudorales accrues
    const preRun = weightKg ? Math.round(weightKg * 1.2) : null;  // ~1-1,5 g glucides/kg avant
    return { longRunMin, carbsPerH, carbsTotal, mlPerH, sodium, preRun, tempC: t };
  })();

  const cycleLabel = taper ? "AFFÛTAGE — volume fortement réduit, on garde l'intensité pour arriver frais"
    : deload ? "SEMAINE ALLÉGÉE (une semaine sur quatre, en fin de bloc) — volume −20 %, c'est là que le corps assimile"
    : "montée en charge normale";

  // ── DISPONIBILITÉS DÉCLARÉES ────────────────────────────────────────────────
  // Sans elles, le plan remplissait 7 jours pour tout le monde. Un athlète qui peut
  // courir 3 fois par semaine recevait un plan inapplicable et décrochait.
  const genderLabel = p?.gender === "female" ? "femme" : p?.gender === "male" ? "homme" : p?.gender ? String(p.gender) : "?";
  // ⚠️ LE PRÉNOM SEUL PART AU MODÈLE (08/11/2026) : le nom complet n'aide en rien le coach
  // (le plan est déterministe, le texte ne fait que s'adresser à l'athlète) et c'est une
  // donnée d'identité de plus envoyée à un tiers avec des données de santé.
  const prenomSeul = String(p?.full_name ?? "").trim().split(/\s+/)[0] || "Athlète";
  const text = `PROFIL
- ${prenomSeul} · ${p?.age ?? "?"} ans · ${genderLabel} · ${num(p?.weight_kg) ?? "?"} kg · ${num(p?.height_cm) ?? "?"} cm · mode ${p?.mode ?? "?"}
- NIVEAU estimé : ${level}${vma ? ` (VMA ${vma} km/h${vmaIsEst ? " estimée" : ""})` : ""}
- ANCIENNETÉ en course à pied : ${expLabel ?? "non renseignée (reste prudent sur la charge tant que tu ne sais pas)"}
- TERRAINS habituels : ${terr.labels.length ? terr.labels.join(" + ") : "non renseignés"}${elev ? ` · dénivelé : ${elev.label}` : ""} · D+ réalisé cette semaine : ${elevWeek} m
${p?.gender === "female" ? `- SEXE : femme → besoins en FER et disponibilité énergétique à surveiller (RED-S : une charge élevée + apport insuffisant coupe la progression et fragilise l'os) ; densité osseuse à protéger (renforcement + impacts dosés) ; ${cycle ? "cycle suivi (voir plus bas)" : "si elle synchronise son cycle, adapte l'intensité selon la phase"}. Ne calque pas mécaniquement des repères masculins.` : p?.gender === "male" ? "- SEXE : homme → tendance fréquente à partir trop vite en facile et à sur-doser l'intensité ; verrouille la discipline des footings." : ""}

⚡ VERDICT DE FRAÎCHEUR DU JOUR (calculé à partir de la VFC, du sommeil, de la charge et du ressenti — CETTE CONCLUSION S'IMPOSE À TOI, ne la ré-arbitre pas)
${readinessBlock}
${nutriCourse ? `
NUTRITION DU JOUR DE COURSE (${nRaw(Math.round(nutriCourse.dureeMin), "fr")} min prévues)
- Glucides : ${nRaw(nutriCourse.glucidesParH, "fr")} g par heure à partir de la ${nRaw(nutriCourse.premierApportMin, "fr")}ᵉ minute — rien avant, les réserves y suffisent. Soit environ ${nRaw(nutriCourse.glucidesTotalG, "fr")} g au total, l'équivalent de ${nRaw(nutriCourse.gels, "fr")} gel(s) de 25 g.${nutriCourse.dureeMin >= 150 ? " Au-delà de 2 h 30, il faut des glucides MULTI-TRANSPORTABLES (glucose + fructose) : au-delà de 60 g/h, l'intestin ne suit pas avec du glucose seul." : ""}
- Boisson : ${nRaw(nutriCourse.mlParH, "fr")} ml par heure, avec ${nRaw(nutriCourse.sodiumMgParL, "fr")} mg de sodium par litre.${nutriCourse.tempConnue ? ` Température prévue le jour J : ${nRaw(Math.round(nutriCourse.tempC ?? 0), "fr")} °C.` : " ⚠️ LA TEMPÉRATURE DU JOUR J EST INCONNUE (elle n'est prévisible qu'à une semaine) : ce chiffre suppose une journée tempérée. DIS-LE-LUI, et rappelle-lui de le réviser à la hausse s'il fait chaud — un plan d'hydratation faux par 30 °C est dangereux, pas seulement inexact."}
${nutriCourse.avantCourseG != null ? `- Avant la course : environ ${nRaw(nutriCourse.avantCourseG, "fr")} g de glucides à charger la veille et au petit-déjeuner (3 h avant le départ).` : "- Poids non renseigné : impossible de chiffrer la charge glucidique d'avant course."}
- ⚠️ RIEN DE TOUT CELA NE S'ESSAIE LE JOUR J. Chaque produit doit avoir été testé en sortie longue, à l'allure de course.
` : ""}${objective ? (terrain ? `
TERRAIN DE LA COURSE (dénivelé du catalogue, pas une estimation)
- ${objective.race} : ${nRaw(terrain.dplusCourse, "fr")} m de D+ sur ${nRaw(objective.distanceKm, "fr")} km, soit ${nRaw(terrain.mParKm, "fr")} m par kilomètre — profil ${terrain.profil}.
- Objectif d'entraînement : environ ${nRaw(terrain.cibleHebdoM, "fr")} m de D+ par semaine avant la course. Le corps doit voir PLUS de dénivelé à l'entraînement que le jour J ; une semaine à l'exact D+ de la course ne prépare pas à l'encaisser d'un seul tenant.
- ${terrain.actuelHebdoM == null ? "Son D+ hebdomadaire actuel n'est pas mesurable (trop peu de sorties avec altitude)." : terrain.manqueHebdoM > 0 ? `Il en fait ${nRaw(terrain.actuelHebdoM, "fr")} m par semaine : il lui en MANQUE ${nRaw(terrain.manqueHebdoM, "fr")}. Construis cette montée progressivement, jamais d'un coup.` : `Il en fait déjà ${nRaw(terrain.actuelHebdoM, "fr")} m par semaine : le terrain est couvert, n'en rajoute pas.`}
` : dplusConnu ? `
TERRAIN DE LA COURSE : ${objective.race} est annoncée à ${nRaw(dplusCourse ?? 0, "fr")} m de D+ — plate ou presque. Aucun travail de côte spécifique n'est justifié ; ne fais pas comme si c'était un trail.
` : `
TERRAIN DE LA COURSE : le dénivelé de ${objective.race} n'est PAS renseigné au catalogue. Ne suppose ni plat ni montagne — demande-lui, ou invite-le à regarder le profil sur le site de l'organisateur.
`) : ""}${relecture ? `
RELECTURE DE L'EXÉCUTION (ce qu'il FAIT, comparé à ce qu'on lui a demandé)
- Sur ${relecture.seances} footings des 90 derniers jours, il tient ${relecture.ecartMedianSec === 0 ? "exactement" : relecture.ecartMedianSec > 0 ? `${nRaw(Math.abs(relecture.ecartMedianSec), "fr")} s/km PLUS LENTEMENT` : `${nRaw(Math.abs(relecture.ecartMedianSec), "fr")} s/km PLUS VITE`} que l'allure prescrite (${nRaw(Math.abs(relecture.ecartPct), "fr")} %), avec une dispersion de ${nRaw(relecture.dispersionSec, "fr")} s/km.
${relecture.correctionSec !== 0
  ? `- L'allure facile a été CORRIGÉE de ${nRaw(relecture.correctionSec, "fr")} s/km en conséquence : ${easyPaceLisible}/km devient ${easyPaceCorrige}/km. Prescris sur cette base.`
  : relecture.motifInaction === "execution_irreguliere"
    ? "- AUCUNE correction : la dispersion dépasse l'écart lui-même. Il est IRRÉGULIER, la cible n'est pas fausse — c'est la régularité qu'il faut lui demander, pas une allure différente."
    : relecture.motifInaction === "ecart_negligeable"
      ? "- AUCUNE correction : il tient ses allures. Dis-le-lui, c'est une information utile et rarement donnée."
      : "- AUCUNE correction : trop peu de séances comparables pour conclure."}
- ⚠️ Aucun ressenti post-séance n'est disponible : un écart ne dit pas SI la cible était trop rapide ou si la séance a été mal exécutée. Ne tranche pas à sa place, demande-lui.
` : ""}${tendanceForme ? `
PENTE RÉELLE DE L'ATHLÈTE (mesurée, pas supposée)
- Son efficacité aérobie — vitesse par battement de cœur sur ses sorties FACILES — évolue de ${tendanceForme.pctParSemaine > 0 ? "+" : ""}${nRaw(tendanceForme.pctParSemaine, "fr")} % par semaine sur ${tendanceForme.semaines} semaines (${tendanceForme.blocs} blocs de 4 semaines, rapport signal/bruit ${nRaw(tendanceForme.signalSurBruit, "fr")}).
- D'ici sa course, l'amélioration à attendre est donc d'environ ${nRaw(Math.round(ameliorationPrevue * 1000) / 10, "fr")} %, et NON les 8 % que promettrait une hypothèse générique. Fonde ton discours là-dessus.
- ⚠️ CE MARQUEUR BAISSE AVEC LA CHALEUR à forme égale : une pente mesurée sur un été est pessimiste. Ne conclus pas à une perte de forme sur ce seul chiffre, et ne le lui annonce pas comme un verdict.
` : `
PENTE RÉELLE DE L'ATHLÈTE : PAS ENCORE MESURABLE (trop peu de sorties faciles avec cardio, ou tendance noyée dans le bruit). Ne prétends donc pas savoir s'il progresse ou s'il stagne.
`}${objectiveWarnings.length ? `
RÉALISME DE L'OBJECTIF (dis-le-lui FRANCHEMENT — ne fais pas comme si le plan préparait la course)
${objectiveWarnings.map((w) => `- ${w}`).join("\n")}
` : ""}
SANTÉ & ANTÉCÉDENTS (contraintes d'entraînement — elles PRIMENT sur l'objectif de performance)
- Ces consignes règlent la CHARGE d'entraînement, rien d'autre : tu ne poses aucun diagnostic, tu ne prescris ni exercice de soin, ni traitement, ni examen. Toute question médicale → un médecin ou un masseur-kinésithérapeute.
${cond.rules.length ? cond.rules.map((r) => `- ${r}`).join("\n")
  : p?.health_declared ? "- Aucune pathologie — l'athlète l'a CONFIRMÉ explicitement, tu peux t'y fier."
  : "- ⚠️ Section santé JAMAIS renseignée (ce n'est pas « rien à signaler », c'est « on ne sait pas ») : reste un cran prudent sur l'intensité et invite-le à la remplir."}
${inj.rules.length ? inj.rules.map((r) => `- ${r}`).join("\n") : p?.health_declared ? "- Aucune zone de blessure récurrente." : ""}
${healthNotes ? `- 🗣️ Note santé écrite par l'athlète (LIS-LA et tiens-en compte) : « ${healthNotes} »` : ""}${noMaxEffort ? "\n- ⛔ EFFORT MAXIMAL INTERDIT au vu de ses antécédents : pas de VMA à 100 %+, pas de test d'effort, pas de sprint all-out. Le développement passe par le volume et le seuil bas." : ""}
${weightLoss ? weightCoachBlock(weightLoss.plan) : ""}

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
- VMA : ${vma ?? "?"} km/h${vmaIsEst ? ` ⚠️ ESTIMÉE depuis ses séances (aucun test VMA enregistré) → recommande-lui un test VMA pour affiner, et reste un cran prudent sur la 1re séance VMA` : ""} · FC max ${maxHr ?? (vmaIsEst && fcMaxEst ? `~${fcMaxEst} (${fcMaxSource === "age" ? "formule de l'âge, pas une mesure" : "obs."})` : "?")} · FC repos ${restHr ?? "?"} · FC seuil ${ltHr ?? "?"}
- Zones FC : Z2 facile ${hrZone(0.6, 0.7) ?? "?"} · Z4 seuil ${hrZone(0.8, 0.9) ?? "?"}
- Zones allure : ${paceZones ?? (computedPaces ? `(calculées depuis la VMA) ${computedPaces}` : "non renseignées")}
- Chronos théoriques au potentiel actuel (depuis la VMA) : ${predictions ?? "?"}
${bestLine ? `- 🏅 MEILLEURS EFFORTS RÉELS (42 j) : ${bestLine}\n` : ""}${limiter ? `- 🎯 SON FACTEUR LIMITANT, à ce stade, c'est ${limiter.label}. ${limiter.action} C'est LA priorité : une séance qui ne s'adresse pas à ce point précis est une séance de perdue. ${limiters.length > 1 ? `Viennent ensuite : ${limiters.slice(1, 3).map(l => l.label).join(" ; ")}.` : ""}\n` : ""}${noHistory ? "- 🆕 ATHLÈTE SANS HISTORIQUE : aucune séance enregistrée, aucune allure de référence. Cette semaine sert à OBSERVER, pas à performer : footings faciles pilotés à la sensation et à la conversation, aucune intensité, aucun chrono. Demande-lui son passé de coureur, ses éventuelles douleurs, et propose-lui un test simple (par exemple 6 min à effort maximal régulier) une fois qu'il aura couru trois ou quatre fois sans gêne. Prescrire du fractionné à quelqu'un dont on ignore tout, c'est le blesser.\n" : ""}${(() => { const d = runs.find(w => w.cardiac_decoupling != null); if (!d) return ""; const v = Number(d.cardiac_decoupling); const verdict = v < 3 ? "ENDURANCE AÉROBIE SOLIDE — il tiendra son allure jusqu'au bout, tu peux durcir le spécifique" : v < 5 ? "correcte" : v < 8 ? "PERFECTIBLE — il commence à décrocher sur la durée : plus de volume facile et des sorties longues progressives" : "ENDURANCE LIMITANTE — à ce niveau de dérive il explosera en fin de course. C'est SA priorité n°1 : volume facile et sorties longues AVANT toute recherche de vitesse"; return `- 💓 DÉRIVE CARDIAQUE (${String(d.date).slice(5, 10)}) : ${v > 0 ? "+" : ""}${v} % — ${verdict}. C'est le marqueur qui distingue un coureur qui TIENT son allure d'un qui la subit.\n`; })()}${(() => {
  const lines: string[] = [];
  // Cadence : sous 170 pas/min, l'appui est long et la foulée « aérienne » — surcoût
  // d'impact et de temps de contact. On ne juge pas dans l'absolu (elle dépend de la
  // taille et de l'allure), mais un franc déficit se corrige et se corrige vite.
  if (cadence != null && cadence < 170) lines.push(`cadence ${cadence} pas/min (basse) → prescris des GAMMES et 6-8 lignes droites en fin de footing avec consigne de cadence +5 %, 2×/sem. Gain d'économie rapide, et moins d'impact au sol`);
  else if (cadence != null && cadence >= 178) lines.push(`cadence ${cadence} pas/min (bonne) — rien à corriger de ce côté`);
  if (vr != null) {
    lines.push(vr.now >= 9 ? `ratio vertical ${vr.now} % (élevé) → trop d'énergie part vers le HAUT : renforcement excentrique mollets/ischios + éducatifs de projection vers l'avant`
      : vr.now <= 6.5 ? `ratio vertical ${vr.now} % (très économique) — sa foulée est efficace, dis-le-lui`
      : `ratio vertical ${vr.now} % (correct)`);
  }
  return lines.length ? `- 🏃‍♂️ TECHNIQUE DE COURSE (mesurée, pas supposée) : ${lines.join(" · ")}.\n` : "";
})()}${(() => {
  // Sans chrono visé (course A du calendrier : `targetSeconds` à 0), aucun découpage : il
  // s'écrivait « premier km à 0'00 », une allure inventée (@Sparring, 09/11/2026).
  if (!objective || daysToRace == null || daysToRace < 0 || daysToRace > 35 || !(objective.targetSeconds > 0) || !(objective.distanceKm > 0)) return "";
  const goalSec = objective.targetSeconds / objective.distanceKm;      // s/km visés
  const fmt = (sc: number) => `${Math.floor(sc / 60)}'${String(Math.round(sc % 60)).padStart(2, "0")}`;
  // Négative split : partir 2-3 % au-dessus de l'allure cible et finir en dessous. C'est
  // la stratégie qui produit le plus de records personnels, et la plus dure à tenir sans
  // l'avoir répétée — d'où la simulation à l'entraînement.
  const k1 = fmt(goalSec * 1.025), kMid = fmt(goalSec), kEnd = fmt(goalSec * 0.985);
  return `- 🏁 PLAN DE COURSE (J-${daysToRace}) : cible ${objective.targetTime} sur ${objective.distanceKm} km = ${kMid}/km. `
    + `Découpage à lui donner : premier km à ${k1} (JAMAIS plus vite — le km de trop payé au départ coûte le double à l'arrivée), `
    + `corps de course à ${kMid}, dernier tiers à ${kEnd} s'il en a sous le pied. `
    + `Départ en négative split : c'est ce qui produit le plus de records, et ça se RÉPÈTE à l'entraînement — `
    + `${daysToRace > 14 ? "programme une SIMULATION à J-10/J-14 : 60-70 % de la distance à l'allure cible, mêmes chaussures, même petit-déjeuner, même heure." : "la simulation est passée : plus rien de nouveau d'ici le départ, on ne teste plus, on répète."} `
    + `Échauffement le jour J : ${objective.distanceKm <= 10 ? "20 min footing + gammes + 4-5 lignes droites, fini 10 min avant le départ" : "15 min footing léger + 3 lignes droites, on garde le carburant"}.\n`;
})()}${nutrition ? `- 🍫 NUTRITION DE SA SORTIE LONGUE (${Math.round(nutrition.longRunMin / 60)} h ~${longRunKm} km${nutrition.tempC != null ? `, ${Math.round(nutrition.tempC)} °C prévus` : ""}) : ${nutrition.preRun ? `${nutrition.preRun} g de glucides 2-3 h avant, ` : ""}puis ${nutrition.carbsPerH} g/h À PARTIR DE LA 1re HEURE (soit ~${nutrition.carbsTotal} g sur la sortie, ~${Math.max(1, Math.round(nutrition.carbsTotal / 25))} gels ou équivalent), et ${nutrition.mlPerH} ml/h de boisson à ~${nutrition.sodium} mg/L de sodium. Donne-lui CES chiffres, pas une fourchette — et rappelle-lui de les TESTER à l'entraînement, jamais le jour J.\n` : ""}${shoeLines.length ? `- 👟 USURE DES CHAUSSURES : ${shoeLines.join(" · ")}\n` : ""}${plateau ? `- 🛑 PLATEAU DÉTECTÉ : sa capacité stagne (${vmaSlopePerWeek} km/h/sem sur ${Math.round((curvePts[curvePts.length - 1].t - curvePts[0].t) / 86400000)} j) ALORS QUE sa charge monte. N'AJOUTE PAS de volume ni de séances : c'est le réflexe qui blesse. CHANGE le stimulus — format de séance inédit, côtes, force, technique de foulée — ou impose une vraie semaine de décharge. Explique-lui pourquoi.\n` : vmaSlopePerWeek != null ? `- 📈 TRAJECTOIRE DE CAPACITÉ : ${vmaSlopePerWeek > 0 ? "+" : ""}${vmaSlopePerWeek} km/h de VMA par semaine sur ses efforts mesurés.\n` : ""}${vrLine ? `- 🦵 ÉCONOMIE DE COURSE (ratio vertical, ${vr!.n} séances) : ${vrLine}\n` : ""}${thresholdPace ? `- 🧊 ALLURE SOUS-SEUIL : ${subPace}/km — c'est ICI que se fait le VOLUME au seuil (méthode norvégienne, Bakken : 0,4 à 0,8 mmol sous le seuil). Une allure qu'il doit pouvoir répéter le lendemain. Les blocs LONGS s'y tiennent ; seules les fractions COURTES touchent le seuil réel. Beaucoup de volume sous-seuil DÉPLACE le seuil ; peu de volume AU seuil ne fait que fatiguer.\n` : ""}${lactate ? `- 🧪 TEST DE LACTATE du ${lactate.date} : seuil 1 (aérobie) ${fmtAllure(lactate.lt1.allureSec)}/km${lactate.lt1.fc ? ` à ${lactate.lt1.fc} bpm` : ""}, seuil 2 ${fmtAllure(lactate.lt2.allureSec)}/km${lactate.lt2.fc ? ` à ${lactate.lt2.fc} bpm` : ""}. Ce sont des seuils MESURÉS : les allures de seuil et de footing en découlent, ne les recalcule pas depuis la VMA.\n` : ""}${thresholdPace ? `- 🎯 ALLURE SEUIL **MESURÉE** : ${thresholdPace}/km (${lactate ? `seuil 2 du test de lactate du ${lactate.date}` : `vitesse critique ${(csMs! * 3.6).toFixed(2)} km/h, ajustée sur ses efforts réels`})${!lactate && pc?.dPrime ? ` · réserve anaérobie D' ${pc.dPrime} m` : ""}. UTILISE CETTE VALEUR pour les séances au seuil plutôt qu'un pourcentage de VMA estimée.\n` : ""}${qeLine ? `- 🔍 EXÉCUTION DE SA DERNIÈRE QUALITÉ : ${qeLine}${faded ? " → il a DÉCROCHÉ : la prochaine série doit être plus courte ou plus lente, pas plus dure. Ne répète pas la même erreur." : fade != null && fade <= -6 ? " → il a ACCÉLÉRÉ en fin de série : il en avait sous le pied, tu peux durcir (allure ou volume, pas les deux)." : ""}\n` : ""}- Repères physio : seuil lactique ~${thresholdPace ?? (vma ? paceAt(86) : "?")}/km · vitesse critique ~${vma ? r1(vma * 0.90) : "?"} km/h (${vma ? paceAt(90) : "?"}/km) · VO2max estimé ~${vo2 ?? "?"} ml/kg/min

FORME & RÉCUPÉRATION (aujourd'hui)
- État physiologique (dernière VFC face à SA base, zone normale ± 6 %) : ${state}
- VFC (${precisionMetrique(metriqueVfc)}) : ${hrvLatest ?? "?"} ms (base 14j ${hrvBase ?? "?"} ms → ${hrvTrend})
- Sommeil : ${freshSleep ? `${freshSleep.sleep_score ?? "?"}/100 cette nuit${lastSleepMin ? ` (${Math.floor(lastSleepMin / 60)}h${String(lastSleepMin % 60).padStart(2, "0")})` : ""}` : "montre non portée la nuit dernière (donnée ignorée)"} · moyenne 7j ${sleepAvg ?? "?"}/100

CHARGE D'ENTRAÎNEMENT
${demonstratedKm ? `- 📈 CAPACITÉ DÉJÀ DÉMONTRÉE : ${demonstratedKm} km/semaine tenus sur ses meilleures semaines des 6 derniers mois. Son système musculo-tendineux CONNAÎT ce volume — il y reviendra bien plus vite qu'il n'y est monté la première fois. Ne le traite pas comme un débutant sous prétexte que ses dernières semaines sont basses ; mais ne t'en sers pas non plus pour justifier une charge élevée AUJOURD'HUI : c'est la fraîcheur du moment qui en décide.\n` : ""}- Volume : ${Math.round(weekKm)} km COURUS cette semaine${cross.label ? ` (+ ${fmtMinutes(cross.minutes)} d'AUTRES SPORTS, ${cross.tss} TSS = ${cross.sharePct} % de sa charge : ${cross.label}${cross.impactMinutes > 0 ? ` — dont ${fmtMinutes(cross.impactMinutes)} avec impact sur les jambes, qui s'ajoutent à l'usure de la course` : " — sans impact sur les jambes : ça fatigue le cardio, pas les tendons"}. Ça compte dans la charge, mais ce N'EST PAS du volume de course : ne dimensionne AUCUNE séance dessus)` : ""} · ~${Math.round(avg4wkKm)} km/sem (moy. 4 sem.)
${lacune ? `- ⚠️ TROU DE DONNÉES : ${lacune.jours} jours SANS AUCUNE trace (ni séance, ni nuit, ni VFC) du ${lacune.debut} au ${lacune.fin}. Une coupure, une blessure et une montre non portée produisent exactement ce silence — et appellent des plans OPPOSÉS. Les moyennes qui traversent cette période sont donc peu fiables : DIS-LUI que tu l'as remarqué et DEMANDE-LUI ce qui s'est passé, ne suppose pas.\n` : ""}${secondaire ? `- 🏁 COURSE ${secondaire.course.priorite} CETTE SEMAINE : ${secondaire.course.nom} le ${secondaire.course.date}${secondaire.course.distanceKm ? ` (${secondaire.course.distanceKm} km)` : ""} — ${secondaire.course.priorite === "B" ? "course de préparation : deux jours calmes avant, semaine allégée, récupération après" : "course d'entraînement : elle remplace une séance de qualité, sans affûtage"}.\n` : ""}${marcheCourse ? `- 🚶 PROGRAMME MARCHE-COURSE, étape ${marcheCourse.etape}/${marcheCourse.total} : ${"continuMin" in marcheCourse.seance ? `${marcheCourse.seance.continuMin} min de course continue` : `${marcheCourse.seance.reps} × (${marcheCourse.seance.courseMin} min de course / ${marcheCourse.seance.marcheMin} min de marche)`}, trois fois par semaine, ${dureesMarcheCourse(marcheCourse.seance).totalMin} min marche comprise. Il ne court pas encore 30 minutes d'affilée : AUCUNE allure, AUCUN volume en kilomètres, AUCUNE séance de qualité ni test VMA. Encourage la régularité ; la marche fait partie de la séance.` : `- 🎯 VOLUME CIBLE de la semaine à venir : ~${targetKm} km, dont une sortie longue de ~${longRunKm} km. Dimensionne les séances sur CES chiffres, pas sur des durées passe-partout.`}
- 🔄 PHASE DU CYCLE : ${cycleLabel}.
- 📆 DISPONIBILITÉS : ${availDaysPerWeek} séance(s) de course par semaine${availDays.length < 7 ? `, uniquement les ${availDays.map(d => ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][d]).join(", ")}` : ""}${declaredDpw ? " (déclaré par l'athlète)" : " (déduit de son niveau et de sa pratique actuelle — demande-lui de le préciser)"}. NE DÉPASSE PAS ce nombre : un plan qu'il ne peut pas suivre ne vaut rien.
- ⏱️ Dernière séance DURE réellement effectuée : ${lastHardDaysAgo == null ? "aucune trace récente" : lastHardDaysAgo === 0 ? "AUJOURD'HUI ⚠️ → pas de deuxième séance dure aujourd'hui ni demain" : `il y a ${lastHardDaysAgo} j`}${lastHardDaysAgo != null && lastHardDaysAgo * 24 < hardGapH ? ` ⚠️ moins de ${hardGapH} h se sont écoulées : la prochaine qualité doit attendre.` : ""}${qualiteRecente.manquees.length ? `\n- ⏭️ QUALITÉ PRESCRITE ET NON FAITE (7 derniers jours) : ${qualiteRecente.manquees.join(", ")} — elle compte dans la semaine et NE SE RATTRAPE PAS : ne la re-propose pas le lendemain.` : ""}${skippedWeekdays.length ? `\n- 🚫 JOURS SYSTÉMATIQUEMENT RATÉS : ${skippedWeekdays.map(d => ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][d]).join(", ")} — prescrits plusieurs fois, jamais courus. Ne t'obstine pas : place-y du repos ou rien, et redistribue ailleurs.` : ""}
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

  // ── CE QUE LA DERNIÈRE SÉANCE A MONTRÉ ──────────────────────────────────────
  // Tout ceci était DÉJÀ calculé — allure, FC, décrochage de la dernière série, effet
  // sur la charge — et ne partait qu'au prompt de l'IA. L'athlète, lui, voyait son plan
  // changer sans jamais lire pourquoi. Quand la replanification se déclenche dans la
  // minute qui suit une séance, l'absence d'explication devient le défaut principal :
  // le calendrier bouge sous ses yeux sans un mot.
  //
  // Rien n'est fabriqué ici : chaque ligne n'apparaît que si sa donnée existe.
  // ── LES ARRÊTS DE LA DERNIÈRE SÉANCE (Cyprien, 09/11/2026 : « il doit prendre en compte
  //    les pauses »). La base ne garde que le temps en mouvement ; la trace garde l'heure de
  //    chaque point (lib/activities/pauses). Une lecture ratée ou sans trace : rien n'est dit,
  //    jamais « aucun arrêt ».
  const arretsLusDerniere = runs[0] && Math.floor((now - new Date(runs[0].date).getTime()) / 86400000) <= 3
    ? await lireArrets(runs[0]) : null;
  const arretsDerniere = arretsLusDerniere === "illisible" ? null : arretsLusDerniere;
  const lastSession = (() => {
    const w = runs[0];
    if (!w?.date) return null;
    const km = w.distance_km ?? 0, sec = w.duration_seconds ?? 0;
    const ageDays = Math.floor((now - new Date(w.date).getTime()) / 86400000);
    // Au-delà de 3 jours ce n'est plus « la séance qui vient d'être faite » : afficher
    // « ta dernière séance » à propos d'une sortie d'il y a deux semaines induit en erreur.
    if (ageDays > 3) return null;
    const paceStr = km > 0 && sec > 0 ? fmtPace(sec / (km / 1)) : null;
    const bits = [
      km > 0 ? `${r1(km)} km` : null,
      sec > 0 ? `${Math.floor(sec / 60)} min` : null,
      paceStr ? `${paceStr}/km` : null,
      w.avg_hr ? `${w.avg_hr} bpm` : null,
      w.elevation_gain_m ? `D+ ${w.elevation_gain_m} m` : null,
    ].filter(Boolean);
    const shows: string[] = [];
    // Exécution de la série : le signal le plus direct qu'on ait sur le dosage.
    if (qe?.repsSec?.length && qe.fadeSec != null) {
      shows.push(verdictQualite === "decrochage"
        ? `décrochage de ${qe.fadeSec} s/km entre le début et la fin de la série : elle était trop ambitieuse`
        : verdictQualite === "arrets_inconnus"
        ? "allure tenue sur ta série, mais tes arrêts n'ont pas pu être relus : elle ne compte pas comme preuve que tu peux durcir"
        : verdictQualite === "non_probant"
        ? `allure tenue sur ta série, mais avec ${arretsQualiteTxt} : tes récupérations ont été plus longues que prévu, cette séance ne compte pas comme preuve que tu peux durcir`
        : verdictQualite === "accelere"
        ? `tu as accéléré de ${-qe.fadeSec} s/km sur la fin : il en restait sous le pied`
        : "allure tenue du début à la fin de la série : la charge était bien calibrée");
    }
    if (w.gap_min_km != null && (w.elevation_gain_m ?? 0) > 150) {
      shows.push(`allure ajustée au dénivelé ${w.gap_min_km}/km — c'est elle qui compte sur ce terrain, pas l'allure brute`);
    }
    if (w.avg_hr != null && fcMaxEst) {
      shows.push(`effort à ${Math.round((w.avg_hr / fcMaxEst) * 100)} % de ta FC max estimée`);
    }
    if (w.tss != null) shows.push(`${Math.round(Number(w.tss))} points de charge`);
    if (arretsDerniere?.liste.length) {
      const n = arretsDerniere.liste.length;
      shows.push(`${n} arrêt${n > 1 ? "s" : ""} (${dureeCourte(arretsDerniere.totalSec)} au total, le plus long ${dureeCourte(arretsDerniere.plusLongueSec)}) : allure et charge sont calculées sur le temps en mouvement`);
    }
    return {
      date: String(w.date).slice(0, 10),
      label: `${classifyRun(w, fcMaxEst)}${bits.length ? ` · ${bits.join(" · ")}` : ""}`,
      shows,
      // Ce que ça CHANGE : sans cette phrase, le constat reste un bulletin météo.
      // Nombres à la française (« −36 », « 2,0 ») : ce texte est LU par l'athlète, un
      // « -36 » et un « 2 » au milieu d'une phrase trahissent une chaîne de débogage.
      // « 1 séance(s) » se lit comme une chaîne de débogage. Ce texte part dans un
      // e-mail et s'affiche sur le calendrier : il s'accorde.
      effect: `Fraîcheur ${readyLevel} (TSB ${frNum(Math.round(load.tsb))}, ratio ${frNum(r1(load.acr), 1)}) → ${
        qBudget === 0 ? "aucune séance de qualité cette semaine"
        : qb.floored ? `${qBudget} séance de qualité, raccourcie`
        : `${qBudget} séance${qBudget > 1 ? "s" : ""} de qualité cette semaine`}.`,
    };
  })();

  return {
    text, objective, daysToRace, weeksToRace, athleteName: String(p?.full_name ?? "Athlète"), vma,
    // ⚠️ Allure CORRIGÉE par la relecture : c'est elle qui doit partir dans le plan,
    // sinon la boucle mesure sans jamais rien changer.
    weekPlan: {
      qBudget, quality: chosen, easyPace: easyPaceCorrige, eased: easeReasons.length > 0, floored: qb.floored,
      // La reprise après une course : séance marquée comme telle, et jamais avant son jour.
      reprise: repriseCetteSemaine && qBudget > 0, qualiteDes: repriseCetteSemaine ? joursAvantReprise : 0,
    },
    // Doubles séances : on tranche ICI, avec le volume REPRÉSENTATIF (médiane des
    // semaines courues) et non le pic — une semaine à 90 km ne fait pas un athlète
    // qui double, et doubler sur un pic isolé est la meilleure façon de le payer.
    doubles: etatDoubles,
    cross,
    longRunMode: bikeLong ? "bike" : "run",
    readiness: {
      level: readyLevel,
      // Français canonique — inchangé pour tous les consommateurs existants.
      reasons: [...redFr, ...orangeFr, ...infoFr, ...(doubleSeuilSuspendu ? [DOUBLE_T.fr.seuilSuspendu] : [])],
      // Les mêmes motifs dans les 5 langues, pour le « pourquoi » des séances.
      reasonsAll: [...redFlags, ...orangeFlags, ...infoFlags, ...(doubleSeuilSuspendu ? [tr((l) => DOUBLE_T[l].seuilSuspendu)] : [])],
      advice: readinessRule,
    },
    hardGapHours: hardGapH,
    easyPace: easyPaceCorrige,
    lastHardDaysAgo,
    qualiteRecente,
    volume: { weekKm: Math.round(weekKm), avg4wkKm: Math.round(avg4wkKm), targetKm, longRunKm, longRunPlanned, longRunEased },
    cycle: { deload, taper, label: cycleLabel, veilleAffutage },
    skippedWeekdays,
    noHistory,
    // Médianes, pas moyennes : une seule séance en côtes ne doit pas décider d'un axe
    // de renforcement pour tout un bloc.
    forme: (() => {
      const med = (vals: (number | null)[]) => {
        const v = vals.filter((x): x is number => x != null && Number.isFinite(x) && x > 0).sort((a, b) => a - b);
        return v.length >= 5 ? v[Math.floor(v.length / 2)] : null;
      };
      const r = med(recent14.map((w) => num((w as { vertical_ratio_pct?: number | null }).vertical_ratio_pct)));
      const c = med(recent14.map((w) => num((w as { avg_cadence_spm?: number | null }).avg_cadence_spm)));
      return r == null && c == null ? null : { ratioVertical: r, cadence: c };
    })(),
    zonesFragiles: Array.isArray(p?.injury_zones) ? (p.injury_zones as string[]).filter((z) => typeof z === "string") : [],
    douleursActives: pains,
    effetsDouleur,
    consignes: consignes ? { ...consignes, kmMax: kmConsigne } : null,
    bilanMatin: bilan ? { ...bilan, ...effetDuBilan } : null,
    aptitude: { attente: aptitudeAttente },
    sortiesRecentes: (() => {
      const jour = aujourdhui(FUSEAU_DEFAUT);
      const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 7);
      const depuis = d.toISOString().slice(0, 10);
      return workouts.filter((w) => isRun(w.sport)).map((w) => String(w.date).slice(0, 10)).filter((x) => x >= depuis && x <= jour);
    })(),
    // Un nombre maximal de sorties fixé par le kinésithérapeute borne celles de la semaine.
    availability: { daysPerWeek: consignes?.seancesMaxSemaine != null ? Math.min(availDaysPerWeek, consignes.seancesMaxSemaine) : availDaysPerWeek, days: availDays },
    forecast,
    altitude: { elevationM, lossPct: altLoss },
    warmCool: warmCoolMin(num(p?.warmup_min), num(p?.cooldown_min)),
    heatAcclim,
    tooMuchIntensity: hardTimePct != null && hardTimePct > 25 ? hardTimePct : null,
    ciblesFc,
    hillyTraining: elevWeek >= 400 || terr.paceMeaningless || preferenceDenivele(p?.elevation_pref) === "specialiste",
    thresholdPace,
    macroPlan,
    objectiveWarnings,
    recuperation: recup ? { course: recup.nom, reprise: recup.reprise, fin: recup.fin, phase: recup.phase } : null,
    marcheCourse: marcheCourse ? { etape: marcheCourse.etape, total: marcheCourse.total, seance: marcheCourse.seance } : null,
    courseSecondaire: secondaire
      ? { idx: secondaire.idx, nom: secondaire.course.nom, distanceKm: secondaire.course.distanceKm, priorite: secondaire.course.priorite }
      : null,
    weightLoss,
    // Palier gratuit : « ce que ta dernière séance a montré » EST une analyse de séance.
    lastSession: objectifSeul ? null : lastSession,
    objectifSeul,
    essentielle,
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
  // ⚠️ UNE PANNE N'EST PAS « VMA INCONNUE » (08/11/2026). Aucune des trois erreurs n'était
  // lue : une lecture ratée rendait `null`, que les appelants lisent comme « pas de VMA »
  // (objectif de course posé sans chrono sans le dire, Ghost Runner sans allures). On
  // LÈVE : l'appelant décide (journal et `objectifPose: false`, page « réessayer »).
  const ePanne = baseRes.error ?? woRes.error ?? profRes.error;
  if (ePanne) throw new Error(`VMA illisible : ${ePanne.code ?? "?"} ${ePanne.message}`);
  const prof = profRes.data as { garmin_vo2max?: number | null; pace_curve?: { best?: { m: number; sec: number }[] } | null } | null;
  // Course à pied uniquement : une sortie vélo produirait une VMA fantaisiste.
  const wks = ((woRes.data ?? []) as Wk[]).filter(w => isRun(w.sport));
  const obsMaxHr = Math.max(0, ...wks.map((w) => Number(w.max_hr ?? 0)));
  // EXACTEMENT le calcul du coach — c'est la même fonction, pas « la même logique »
  // recopiée. Les deux ne peuvent donc plus diverger, ce qui était le cas ici.
  return effectiveVma({
    vmaStored: Number((baseRes.data as { vma_kmh?: number } | null)?.vma_kmh) || null,
    paceCurveBest: prof?.pace_curve?.best,
    garminVo2: Number(prof?.garmin_vo2max) || null,
    fromRuns: bestVmaFromWorkouts(wks, obsMaxHr > 120 ? obsMaxHr : null),
  }).vma;
}
