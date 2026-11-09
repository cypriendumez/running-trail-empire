"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity, Heart, Target,
  Calendar, Footprints, Moon, ChevronRight,
  Gauge, Mountain, Timer, Flame, TrendingUp, AlertTriangle, Shield,
  type LucideIcon,
} from "lucide-react";
// ⚠️ PLUS DE recharts ICI (22/09/2026) : ≈ 500 kB de JS pour deux petits dessins, sur
// la page que le téléphone ouvre en premier. Voir MiniGraphes.tsx.
import { MiniAire, MiniBarres } from "./MiniGraphes";
import Link from "next/link";
import type { UserProfile, HRVData, Workout } from "@/types";
import { robustWeeklyKm } from "@/lib/running/volume";
import { racePredictions, fmtPaceSec, fmtTime } from "@/lib/running/fitness";
import { TaperingWidget } from "@/components/dashboard/TaperingWidget";
import { WeatherChip } from "@/components/dashboard/WeatherChip";
import { SessionFeedback, type ChaussureGarage } from "@/components/dashboard/SessionFeedback";
import type { SeanceRessenti } from "@/lib/dashboard/ressenti";
import { ObjectiveCard, type Objective } from "@/components/dashboard/ObjectiveCard";
import { cleanActivityName } from "@/lib/utils/activityName";
import { isRun } from "@/lib/intervals/sport";
import { computeHrZones, zoneDominante } from "@/lib/dashboard/zones";
import { computeDiscipline, etatDuJour, etatPhysiologique, statsVfc, phraseDuJour, type PlanDuCoach } from "@/lib/dashboard/discipline";
import type { MetriqueVfc } from "@/lib/health/vfc";
import { computeWeeklyTrend } from "@/lib/dashboard/semaines";
import { dansFenetre, ageJours, avancementObjectif } from "@/lib/dashboard/fenetre";
import { computeForme, socleDesSeances } from "@/lib/dashboard/forme";
import { etapesSeance } from "@/lib/dashboard/etapes";
import { ZONE_NORMALE_VFC } from "@/lib/health/vfc";
import { derniereAnalyse, lienSeance, type AnalyseMemorisee } from "@/lib/dashboard/derniereAnalyse";
import { computeDistancePRs, type RecordDeclare } from "@/lib/dashboard/records";
import { AjoutRecord } from "@/components/dashboard/AjoutRecord";
import { useT } from "@/lib/i18n/LanguageProvider";
import { fill } from "@/lib/i18n/base";
import { ProfileCompletionBanner } from "@/components/dashboard/ProfileCompletionBanner";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { TrialBanner } from "@/components/dashboard/TrialBanner";
import { peut, type EtatAcces } from "@/lib/billing/access";
import { BilanSemaine } from "@/components/dashboard/BilanSemaine";
import { jourLocal, decaleJour, type StreakResult } from "@/lib/streak/compute";
import { formatDateCivile } from "@/lib/time/fuseau";
import { CLE_NIVEAU, niveauDeVma } from "@/lib/running/niveau";

// Fonction de traduction (avec interpolation {clé}) passée aux helpers.
type TFn = (k: string, params?: Record<string, string | number>) => string;

interface Props {
  profile: UserProfile | null;
  /** Série passée par `serieVfc` : une seule mesure, état relatif à la base de l'athlète. */
  hrv: HRVData[];
  /** La mesure de cette série — la SDNN (Apple Watch par défaut) est signalée sur la carte. */
  metriqueVfc?: MetriqueVfc | null;
  workouts: Workout[];
  plan: Record<string, unknown> | null;
  /** Séances candidates aux records par distance, chargées sur TOUT l'historique par une
   *  requête dédiée. La liste `workouts` est plafonnée à 40 lignes : s'en servir revenait
   *  à annoncer « record personnel » sur le meilleur temps des deux derniers mois. */
  prWorkouts: { date: string; distance_km: number | null; duration_seconds: number | null }[];
  /** Records DÉCLARÉS par l'athlète (courus avant l'historique de sa montre). */
  recordsDeclares?: RecordDeclare[];
  /** Date de la PLUS ANCIENNE séance connue — la profondeur réelle de l'historique. */
  premiereSeance?: string | null;
  /** Un an de charge (date + TSS), chargé à part. Le modèle CTL/ATL a une constante de
   *  42 jours : nourri de 40 activités il ne converge pas, et l'amorce reste visible
   *  dans le chiffre affiché. Voir `computeLoad` dans TaperingWidget. */
  chargeHistory: { date: string; tss: number | null; type: string | null; duration_seconds: number | null }[];
  sleep?: { total_sleep_min: number; sleep_score: number; body_battery_end: number; deep_sleep_min: number; rem_sleep_min: number; date: string } | null;
  /** `i18n` = le même jour dans les autres langues (cf. lib/ai/planI18n.ts). Le français
   *  reste au premier niveau : c'est lui qui part sur la montre et sert aux analyses. */
  coachSession?: { title: string; subtitle: string; tags: string[]; why: string; i18n?: Record<string, { title?: string; subtitle?: string; tags?: string[]; why?: string }>;
    /** Le jour de cette séance : « Séance du jour » seulement si c'est aujourd'hui. */
    date?: string | null } | null;
  /** Séances récentes sans ressenti, et les paires du Garage (lib/dashboard/ressenti). */
  ressenti?: { seances: SeanceRessenti[]; chaussures: ChaussureGarage[] } | null;
  objective?: Objective | null;
  /** L'objectif dont la date est passée : nommé sur la carte, plus jamais prérempli. */
  derniereCourse?: { race: string; raceDate: string } | null;
  currentVma?: number | null;
  /** D'où vient la VMA affichée, et de quand — pour qu'on voie qu'elle suit la forme. */
  sourceVma?: SourceVma | null;
  loadRisk?: { acwr: number; monotony: number; deload: boolean; level: string; reason: string; base?: boolean };
  /** Série calculée à la lecture (lib/streak) — jamais stockée, donc réparable. */
  streak?: StreakResult | null;
  /** État d'abonnement, déduit du profil (lib/billing/access). */
  acces?: EtatAcces | null;
  /**
   * ⚠️ LE JOUR CIVIL DE L'ATHLÈTE, calculé UNE FOIS côté serveur (dans son fuseau).
   * Le bandeau affichait `new Date().toLocaleDateString(lang)` : `new Date()` est évalué
   * au rendu — un instant côté serveur (iad1, USA), un autre à l'hydratation (France) —
   * et sans `timeZone` le serveur formatait en heure américaine. Entre minuit et 6 h à
   * Paris, il rendait encore la veille : le texte différait de celui du navigateur, d'où
   * l'erreur React #418 (96 % des occurrences sur cette plage). On reçoit donc un jour
   * FIXE et on le met en forme avec `formatDateCivile`, déterministe des deux côtés.
   */
  jourAujourdhui?: string;
  /** La décision du coach pour la semaine : la phrase du jour ne doit pas la contredire. */
  planCoach?: PlanDuCoach;
  /** Une montre est reliée (clé API ou OAuth intervals.icu) — calculé côté serveur, la clé ne quitte pas le serveur. */
  montreReliee?: boolean;
  /** Analyses de séance MÉMORISÉES (`seance_analyse`) — la carte « Analyse IA » n'en déclenche aucune. */
  analyses?: AnalyseMemorisee[];
  /** La cible de volume de la semaine fixée par le coach (`auto_coach_state.targetKm`). */
  cibleVolumeKm?: number | null;
  /**
   * Les lectures qui ont RÉELLEMENT échoué (identifiants stables, traduits ici).
   * Vide dans le cas normal — y compris pour un compte sans historique : une absence
   * de données n'est pas une panne.
   */
  donneesIncompletes?: string[];
}

// Libellés courts des KPI de l'en-tête (multilingues).
const KPI_LABELS: Record<string, { form: string; hrv: string; vma: string; vol: string }> = {
  fr: { form: "Forme", hrv: "VFC", vma: "VMA", vol: "Volume 7j" },
  en: { form: "Form", hrv: "HRV", vma: "vVO2max", vol: "7-day volume" },
  de: { form: "Form", hrv: "HRV", vma: "vVO2max", vol: "7-Tage-Volumen" },
  es: { form: "Forma", hrv: "VFC", vma: "VAM", vol: "Volumen 7d" },
  pt: { form: "Forma", hrv: "VFC", vma: "VAM", vol: "Volume 7d" },
};

// Libellés du panneau objectif de l'en-tête (multilingue).
const HERO_LABELS: Record<string, { goal: string; plan: string; sept: string }> = {
  fr: { goal: "Objectif", plan: "Voir mon plan", sept: "7 j" },
  en: { goal: "Goal", plan: "View my plan", sept: "7 d" },
  de: { goal: "Ziel", plan: "Mein Plan ansehen", sept: "7 T" },
  es: { goal: "Objetivo", plan: "Ver mi plan", sept: "7 d" },
  pt: { goal: "Objetivo", plan: "Ver o meu plano", sept: "7 d" },
};

// Bannière « prochaine séance » (multilingue).
const NEXT_LABELS: Record<string, { next: string; details: string }> = {
  fr: { next: "Prochaine séance", details: "Détails de la séance" },
  en: { next: "Next session", details: "Session details" },
  de: { next: "Nächste Einheit", details: "Einheit-Details" },
  es: { next: "Próxima sesión", details: "Detalles de la sesión" },
  pt: { next: "Próxima sessão", details: "Detalhes da sessão" },
};

// Libellé FC pour la carte VFC (multilingue).
const VITALS: Record<string, { hr: string }> = {
  fr: { hr: "FC de repos" }, en: { hr: "Resting HR" }, de: { hr: "Ruhepuls" }, es: { hr: "FC en reposo" }, pt: { hr: "FC em repouso" },
};

// La carte « Analyse IA » : l'analyse mémorisée de la dernière séance courue.
const ANALYSE_LABELS: Record<string, { titre: string; seance: string; lire: string; analyser: string; pasEncore: string }> = {
  fr: { titre: "Analyse IA", seance: "Ta dernière séance", lire: "Lire l'analyse complète", analyser: "Analyser cette séance", pasEncore: "Pas encore analysée : le coach relit ta séance chiffre par chiffre, à ta demande." },
  en: { titre: "AI analysis", seance: "Your last session", lire: "Read the full analysis", analyser: "Analyse this session", pasEncore: "Not analysed yet: the coach reviews your session figure by figure, when you ask." },
  de: { titre: "KI-Analyse", seance: "Deine letzte Einheit", lire: "Ganze Analyse lesen", analyser: "Diese Einheit analysieren", pasEncore: "Noch nicht analysiert: Der Coach geht deine Einheit Zahl für Zahl durch, wenn du es möchtest." },
  es: { titre: "Análisis IA", seance: "Tu última sesión", lire: "Leer el análisis completo", analyser: "Analizar esta sesión", pasEncore: "Aún sin analizar: el coach revisa tu sesión cifra a cifra, cuando lo pidas." },
  pt: { titre: "Análise IA", seance: "A tua última sessão", lire: "Ler a análise completa", analyser: "Analisar esta sessão", pasEncore: "Ainda não analisada: o coach revê a tua sessão número a número, quando pedires." },
};

// L'abréviation de « record personnel », par langue : « RP » s'affichait tel quel dans
// toutes les langues (audit du 06/11/2026).
const ABREV_RECORD: Record<string, string> = { fr: "RP", en: "PB", de: "PB", es: "MP", pt: "RP" };

// Libellés du rail de droite (multilingue).
const RAIL_LABELS: Record<string, { records: string; recommend: string }> = {
  fr: { records: "Records personnels", recommend: "Voir les recommandations" },
  en: { records: "Personal records", recommend: "View recommendations" },
  de: { records: "Persönliche Rekorde", recommend: "Empfehlungen ansehen" },
  es: { records: "Records personales", recommend: "Ver recomendaciones" },
  pt: { records: "Recordes pessoais", recommend: "Ver recomendações" },
};

// Score de forme — 4 axes calculés du réel (endurance & vitesse dérivées des séances/VMA,
// récup & régularité reprises du modèle discipline). Couleurs par axe comme la maquette.
const FORME_LABELS: Record<string, { title: string; endurance: string; speed: string; recovery: string; regularity: string; of: string; rate: (n: number) => string; fort: string; faible: string; equilibre: string }> = {
  fr: { title: "Score de forme", endurance: "Endurance", speed: "Vitesse", recovery: "Récupération", regularity: "Régularité", of: "/ 100", fort: "Point fort", faible: "À travailler", equilibre: "Profil équilibré", rate: (n) => (n >= 80 ? "Excellent" : n >= 60 ? "Bonne forme" : n >= 40 ? "Correct" : "À développer") },
  en: { title: "Fitness score", endurance: "Endurance", speed: "Speed", recovery: "Recovery", regularity: "Consistency", of: "/ 100", fort: "Strength", faible: "To work on", equilibre: "Balanced profile", rate: (n) => (n >= 80 ? "Excellent" : n >= 60 ? "Good shape" : n >= 40 ? "Fair" : "Building up") },
  de: { title: "Fitness-Score", endurance: "Ausdauer", speed: "Tempo", recovery: "Erholung", regularity: "Regelmäßigkeit", of: "/ 100", fort: "Stärke", faible: "Zu verbessern", equilibre: "Ausgewogenes Profil", rate: (n) => (n >= 80 ? "Exzellent" : n >= 60 ? "Gute Form" : n >= 40 ? "Solide" : "Im Aufbau") },
  es: { title: "Puntuación de forma", endurance: "Resistencia", speed: "Velocidad", recovery: "Recuperación", regularity: "Regularidad", of: "/ 100", fort: "Punto fuerte", faible: "A mejorar", equilibre: "Perfil equilibrado", rate: (n) => (n >= 80 ? "Excelente" : n >= 60 ? "Buena forma" : n >= 40 ? "Correcto" : "En progreso") },
  pt: { title: "Pontuação de forma", endurance: "Resistência", speed: "Velocidade", recovery: "Recuperação", regularity: "Regularidade", of: "/ 100", fort: "Ponto forte", faible: "A melhorar", equilibre: "Perfil equilibrado", rate: (n) => (n >= 80 ? "Excelente" : n >= 60 ? "Boa forma" : n >= 40 ? "Correto" : "Em progresso") },
};

// Zones d'entraînement (FC) — temps par zone, estimé du réel (FC moyenne / FC max).
const ZONES_LABELS: Record<string, { title: string; sub: string; z: [string, string, string, string, string]; min: string }> = {
  fr: { title: "Zones d'entraînement", sub: "Répartition du temps · 6 sem.", z: ["Récupération", "Endurance", "Tempo", "Seuil", "VO₂max"], min: "min" },
  en: { title: "Training zones", sub: "Time split · last 6 wks", z: ["Recovery", "Endurance", "Tempo", "Threshold", "VO₂max"], min: "min" },
  de: { title: "Trainingszonen", sub: "Zeitverteilung · 6 Wo.", z: ["Erholung", "Ausdauer", "Tempo", "Schwelle", "VO₂max"], min: "Min" },
  es: { title: "Zonas de entreno", sub: "Reparto de tiempo · 6 sem.", z: ["Recuperación", "Resistencia", "Tempo", "Umbral", "VO₂máx"], min: "min" },
  pt: { title: "Zonas de treino", sub: "Distribuição · 6 sem.", z: ["Recuperação", "Resistência", "Tempo", "Limiar", "VO₂máx"], min: "min" },
};
const HR_ZONE_DEFS = [
  { lo: 0, hi: 0.6, color: "#38bdf8" },
  { lo: 0.6, hi: 0.7, color: "#10b981" },
  { lo: 0.7, hi: 0.8, color: "#f59e0b" },
  { lo: 0.8, hi: 0.9, color: "#f97316" },
  { lo: 0.9, hi: 9, color: "#ef4444" },
];

// La forme du jour est calculée à partir de données réelles : voir computeReadiness().

/** La source de la VMA affichée — définie avec son calcul (lib/dashboard/vmaAffichee). */
export type { SourceVma } from "@/lib/dashboard/vmaAffichee";
import type { SourceVma } from "@/lib/dashboard/vmaAffichee";
import type { CleIndicateur } from "@/lib/indicateurs/types";

/** Une distance, un dénivelé : une valeur absente, négative ou illisible compte pour 0. */
const positif = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

export function BentoDashboard({ profile, hrv, metriqueVfc = null, workouts, plan, prWorkouts, recordsDeclares = [], premiereSeance = null, chargeHistory, sleep, coachSession, ressenti, objective, derniereCourse = null, currentVma, sourceVma = null, loadRisk, streak, acces, donneesIncompletes, jourAujourdhui, planCoach = null, montreReliee = false, analyses = [], cibleVolumeKm = null }: Props) {
  const { t, lang } = useT();
  // ⚠️ LES NOMBRES À LA LANGUE (06/11/2026). `toFixed` écrivait « 11.4 km/h » et « 15.0 km »
  // en allemand, espagnol, portugais et français, où la décimale est une virgule. Et
  // « Base 14 j : 43 ms » gardait l'espace insécable français avant les deux-points.
  const nf = (v: number, d = 1) => (Number.isFinite(v) ? v : 0).toLocaleString(lang, { minimumFractionDigits: d, maximumFractionDigits: d });
  const deuxPoints = lang === "fr" ? "\u00a0: " : ": ";
  // Une durée en minutes → « 7h05 », arrondie : des minutes décimales donnaient
  // « 3h7.6699999999999875 » et faisaient déborder la carte (crash-test au hasard).
  const hm = (min: number) => { const m = Math.max(0, Math.round(Number.isFinite(min) ? min : 0)); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };
  // Une durée de séance : « 46 min » sous l'heure, « 1h02 » au-delà — « 0h46 » se lisait mal.
  const duree = (min: number) => { const m = Math.max(0, Math.round(Number.isFinite(min) ? min : 0)); return m < 60 ? `${m} min` : hm(m); };
  // État RELATIF à la base de l'athlète, et seulement si la mesure est fraîche — même
  // règle que la fiche détaillée (`etatPhysiologique`), qui ne peut pas dire autre chose.
  // ⚠️ LE JOUR DE L'ATHLÈTE, PAS CELUI DE LA MACHINE. Tout ce qui dépend d'« aujourd'hui »
  // part de ce jour civil, calculé UNE fois par le serveur dans le fuseau de l'athlète.
  // Avec l'horloge, entre minuit et 1 h à Paris, le serveur (UTC) vivait encore la veille :
  // « J-51 » au rendu, « J-50 » à l'hydratation, et les sept barres de la semaine décalées
  // d'un jour — erreurs React #418 (rejoué : rendu UTC contre rendu Paris, 30/10/2026).
  const jour = jourAujourdhui ?? jourLocal();
  const state = etatPhysiologique(hrv, Date.now(), jour);

  // Sommeil : on n'exploite/affiche que des données RÉCENTES (la nuit d'hier ou d'aujourd'hui).
  const ageSommeil = ageJours(sleep?.date, jour);
  const freshSleep = sleep && ageSommeil != null && ageSommeil >= 0 && ageSommeil <= 1 ? sleep : null;

  // Volume de COURSE : le vélo et la randonnée n'en font pas partie. Sans ce filtre,
  // le tableau de bord affichait 102 km là où le coach en comptait 62 — deux chiffres
  // contradictoires sous les yeux du même athlète, et une séance recommandée calculée
  // sur le mauvais volume.
  const runs = workouts.filter(w => isRun(w.sport));
  // ⚠️ SEPT CASES DE CALENDRIER, PAS 168 HEURES GLISSANTES. La fenêtre était ancrée
  //    sur l'heure exacte de la consultation : une séance vieille de sept jours entrait
  //    et sortait selon le moment de la journée. Mesuré sur ce compte : 47,7 km affichés
  //    à 00 h 30, 37,5 km le même jour quelques heures plus tard, sans qu'une seule
  //    séance ait changé. Voir `lib/dashboard/fenetre`.
  const weeklyKm = runs
    .filter(w => dansFenetre(w.date, 7, jour))
    .reduce((sum, w) => sum + positif(w.distance_km), 0);

  const hrvChartData = hrv.slice(0, 14).reverse()
    // Une mesure absente, nulle ou illisible ne devient pas un point « NaN ms » du graphe.
    .filter(h => Number.isFinite(h.hrv_ms) && h.hrv_ms > 0)
    .map(h => ({
      date: formatDateCivile(String(h.date).slice(0, 10), lang, { day: "2-digit", month: "2-digit" }),
      hrv: h.hrv_ms,
    }));

  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = decaleJour(jour, i - 6);
    const dayWorkouts = runs.filter(w => String(w.date).slice(0, 10) === d);
    return {
      day: formatDateCivile(d, lang, { weekday: "short" }),
      km: dayWorkouts.reduce((s, w) => s + positif(w.distance_km), 0),
      elev: dayWorkouts.reduce((s, w) => s + positif(w.elevation_gain_m), 0),
    };
  });

  // Score Discipline — calculé à partir des vraies données (l'anneau = moyenne
  // pondérée des 3 axes affichés → toujours cohérent, jamais de chiffres factices).
  // L'assiduité lit la SÉRIE (ce que le coach a prescrit), la fenêtre suit le jour de l'athlète.
  const disc = computeDiscipline(workouts, hrv, freshSleep, state, { aujourdhui: jour, serie: streak?.days ?? null });

  // VFC : valeur du jour + base 14 j pour situer si elle est « bonne ».
  // ⚠️ AUCUN CONTRÔLE DE FRAÎCHEUR ICI, alors que le sommeil juste au-dessus en impose
  //    un de deux jours. Constaté le 01/09/2026 : la dernière mesure de VFC datait du
  //    26 août, et la carte l'affichait sans date, comme la valeur du jour. Pire, cette
  //    valeur périmée alimentait `computeReadiness`, donc la phrase « Tu es frais — bon
  //    jour pour une séance de qualité » reposait sur une donnée vieille de six jours.
  //    On garde la valeur (elle est vraie, elle est juste datée) mais on dit QUAND elle
  //    a été prise dès qu'elle n'est plus d'hier, et elle cesse de décider de la forme
  //    du jour au-delà de ce délai.
  //    Le calcul vit dans `statsVfc`, que la page détaillée (/dashboard/indicateurs/vfc)
  //    appelle aussi : la carte et la page ne peuvent pas afficher deux bases différentes.
  const sv = statsVfc(hrv, Date.now(), jour);
  const hrvLatest = sv.dernier, hrvJours = sv.jours, hrvBaseline = sv.base, hrvDelta = sv.ecart;
  const hrvFraiche = sv.fraiche;
  // Un léger creux sous la moyenne n'est pas un signal : même seuil que l'état du jour
  // (`etatDuJour`, ZONE_NORMALE_VFC) — la pastille ne doit pas alarmer pour 2 ms.
  const hrvDansNorme = hrvDelta != null && hrvBaseline != null && hrvBaseline > 0 && hrvDelta < 0 && -hrvDelta / hrvBaseline <= ZONE_NORMALE_VFC;

  // État du jour = lecture honnête de la forme (VFC vs base + sommeil récent), pas un label figé.
  const readiness = computeReadiness(hrvFraiche ? hrvDelta : null, hrvFraiche ? hrvBaseline : null, freshSleep?.sleep_score ?? null, t, lang, planCoach, montreReliee);

  // ⚠️ LA PROCHAINE COURSE, C'EST L'OBJECTIF (06/11/2026). La date venait de l'ancienne table
  // `training_plans` : avec un plan resté sur une course passée, la fenêtre d'affûtage de la
  // course suivante ne s'ouvrait jamais. L'objectif (déjà filtré des courses passées par la
  // page) est la source unique ; l'ancien plan ne sert plus que de repli.
  const raceDate = objective?.raceDate ?? (plan as { race_date?: string } | null)?.race_date ?? null;

  // Séance-clé du jour : l'algo s'affiche INSTANTANÉMENT (repli fiable),
  // puis la version IA (Gemini) le remplace dès qu'elle répond (badge ✨).
  const keySession = recommendSession({ state, weeklyKm, workouts, sleep, raceDate, jour, t, recuperation: !!planCoach?.recuperation, mesureFraiche: hrvFraiche });
  // Séance prescrite par le coach = prioritaire, et affichée dans la langue de l'athlète.
  // La résolution se fait ici, côté client : le sélecteur de langue est instantané.
  const coachKey = coachSession
    ? aiToSession({ ...coachSession, ...(coachSession.i18n?.[lang] ?? {}) })
    : null;
  const [aiSession, setAiSession] = useState<KeySession | null>(null);
  const [aiTried, setAiTried] = useState(false);
  useEffect(() => {
    if (coachSession) return;   // le coach a déjà prescrit → inutile d'appeler l'IA
    let cancel = false;
    fetch("/api/ai/session", { method: "POST" })
      .then((r) => r.json())
      .then((j) => { if (!cancel && j.session?.title) setAiSession(aiToSession(j.session)); })
      .catch(() => { /* repli silencieux sur l'algo */ })
      .finally(() => { if (!cancel) setAiTried(true); });
    return () => { cancel = true; };
  }, [coachSession]);
  const displaySession = coachKey ?? aiSession ?? keySession;
  // ⚠️ « SÉANCE DU JOUR » SEULEMENT SI C'EST AUJOURD'HUI (06/11/2026). Quand la séance du jour
  // manque, la page présente la suivante : elle était annoncée comme celle d'aujourd'hui.
  const dateCoach = String(coachSession?.date ?? "").slice(0, 10);
  const badgeCoach = /^\d{4}-\d{2}-\d{2}$/.test(dateCoach) && dateCoach !== jour
    ? t("dash.coach.badgeLe", { date: formatDateCivile(dateCoach, lang, { day: "numeric", month: "short" }) })
    : t("dash.coach.badge");

  // La dernière séance COURUE et son analyse mémorisée (lib/dashboard/derniereAnalyse).
  const analyse = derniereAnalyse(runs, analyses);
  // Dernière séance : on n'affiche que les métriques réellement disponibles (pas de "--" vide).
  // ⚠️ LA MÊME SÉANCE QUE L'ANALYSE QUAND ELLES TOMBENT LE MÊME JOUR (audit du 09/11/2026). Le
  // 25/10, « Dernière séance » montrait le retour au calme de 2,1 km et « Analyse IA », juste à
  // côté, « ta dernière séance · 42,5 km » : deux « dernières séances » différentes sur un écran.
  // La séance principale du jour (analysée, sinon la plus longue) l'emporte sur l'ordre d'arrivée.
  const w0 = analyse && workouts[0] && String(analyse.seance.date).slice(0, 10) === String(workouts[0].date).slice(0, 10)
    ? (workouts.find((w) => w.id === analyse.seance.id) ?? workouts[0])
    : workouts[0];
  const lastMetrics = w0 ? buildLastMetrics(w0, t, lang) : [];

  // ── Données dérivées (toutes calculées depuis le réel — rien d'inventé) ──────────
  // ⚠️ LE SOCLE RÉEL (02/10/2026) : sans lui, le marathon était prédit pour un coureur
  // sans sortie longue ni volume — la prédiction prudente, servie à tout le monde.
  const predictions = currentVma && currentVma > 0 ? racePredictions(currentVma, socleDesSeances(workouts, jour)) : null;
  const volumeTrend = computeWeeklyTrend(workouts, 6, jour);
  const trendMax = Math.max(1, ...volumeTrend.map((v) => v.km));
  const prevWeeks = volumeTrend.slice(0, -1);
  const prevAvg = prevWeeks.length ? prevWeeks.reduce((s, v) => s + v.km, 0) / prevWeeks.length : 0;
  // ⚠️ L'ÉTIQUETTE DISAIT « vs moy. 4 sem. » ALORS QUE LE CODE MOYENNAIT 5 SEMAINES.
  //    Et une moyenne est écrasée par une coupure : ici une semaine à 5 km tirait la
  //    référence de 70,7 à 58 km. Sur ces données l'écart affiché tombait juste par
  //    compensation, mais rien ne le garantissait — un athlète blessé trois semaines
  //    se serait vu annoncer qu'il court « au-dessus de sa moyenne » en reprenant.
  //    `robustWeeklyKm` est le module écrit pour ça : médiane des semaines RÉELLEMENT
  //    courues, les semaines à zéro écartées. Fenêtre arrêtée il y a 7 jours pour ne
  //    pas comparer la semaine en cours à une référence qui la contient déjà.
  // Ancré sur le jour de l'athlète, pas l'horloge : même référence au rendu et dans le navigateur.
  const volRef = robustWeeklyKm(runs, Date.parse(`${jour}T12:00:00Z`) - 7 * 86400000, 8);
  // Moins de 3 semaines courues : une médiane ne veut rien dire, on garde l'ancien
  // calcul plutôt que d'afficher une référence bâtie sur deux points.
  const volumeDelta = volRef ? weeklyKm - volRef.km : prevAvg > 0 ? weeklyKm - prevAvg : null;
  const volumeRefLabel = volRef ? "dash.volume.vsMedian" : "dash.volume.vsAvg";
  const records = computeRecords(workouts);
  const al = ANALYSE_LABELS[lang] ?? ANALYSE_LABELS.fr;
  const weekSummary = computeWeekSummary(workouts, jour);
  const acwr = loadRisk?.acwr ?? 0;
  // Historique du Score Discipline (8 sem.) — du plus ancien au plus récent.
  const coachMinimal = !!coachKey && coachKey.tags.length === 0 && !coachKey.why;

  // ── Cartes de droite : on garde toujours les 2 plus pertinentes (sommeil > séance-clé
  //    > records > résumé semaine > forme) → les colonnes ne sont jamais vides. ─────
  const fillerPool: { key: string; node: React.ReactNode }[] = [];
  if (freshSleep) fillerPool.push({ key: "sleep", node: (
    <div className="bento-card h-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="metric-label">{t("dash.sleep.title")}</div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{hm(freshSleep.total_sleep_min)}</div>
          <div className="text-xs text-zinc-400">{t("dash.sleep.total")}</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{freshSleep.sleep_score}<span className="text-sm font-normal text-zinc-400">/100</span></div>
          <div className="text-xs text-zinc-400">{t("dash.sleep.score")}</div>
        </div>
      </div>
      {(freshSleep.deep_sleep_min > 0 || freshSleep.rem_sleep_min > 0) && (
        <div className="space-y-1.5">
          {[
            { label: t("dash.sleep.deep"), min: freshSleep.deep_sleep_min, color: "bg-zinc-800" },
            { label: t("dash.sleep.rem"), min: freshSleep.rem_sleep_min, color: "bg-zinc-500" },
            { label: t("dash.sleep.light"), min: Math.max(0, freshSleep.total_sleep_min - freshSleep.deep_sleep_min - freshSleep.rem_sleep_min), color: "bg-zinc-300" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="w-12 text-zinc-500">{s.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div className={`h-full ${s.color} rounded-full`} style={{ width: `${Math.min(100, (s.min / freshSleep.total_sleep_min) * 100)}%` }} />
              </div>
              <span className="w-10 text-right tabular-nums text-zinc-600">{hm(s.min)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  ) });
  if (!coachKey) fillerPool.push({ key: "keysession", node: (
    <div className="bento-card h-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="metric-label">{t("dash.key.title")}</div>
          {aiSession ? (
            <span className="text-[11px] text-zinc-400">{t("dash.key.aiCoach")}</span>
          ) : !aiTried ? (
            <span className="animate-pulse text-[11px] text-zinc-300">{t("dash.key.aiLoading")}</span>
          ) : null}
        </div>
        <Calendar className="h-4 w-4 text-zinc-400" strokeWidth={1.5} />
      </div>
      <div className="text-base font-semibold text-zinc-900">{displaySession.title}</div>
      <div className="mt-1 text-sm text-zinc-500">{displaySession.subtitle}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {displaySession.tags.map((tg) => (
          <span key={tg.l} className={`rounded-lg px-2 py-1 text-xs font-medium ${tg.c}`}>{tg.l}</span>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-1.5 text-xs text-zinc-500">
        <Target className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
        <span>{displaySession.why}</span>
      </div>
    </div>
  ) });
  if (records) {
    const rows = ([
      { icon: Footprints, label: t("dash.records.longest"), value: `${nf(records.longest)} km`, color: "", bg: "" },
      records.bestPace != null ? { icon: TrendingUp, label: t("dash.records.pace"), value: `${fmtPaceSec(records.bestPace)}/km`, color: "", bg: "" } : null,
      records.maxElev > 0 ? { icon: Mountain, label: t("dash.records.climb"), value: `${Math.round(records.maxElev)} m`, color: "", bg: "" } : null,
      records.longestSec > 0 ? { icon: Timer, label: t("dash.records.duration"), value: fmtTime(records.longestSec), color: "", bg: "" } : null,
    ] as ({ icon: LucideIcon; label: string; value: string; color: string; bg: string } | null)[])
      .filter((r): r is { icon: LucideIcon; label: string; value: string; color: string; bg: string } => r !== null)
      .slice(0, 4);
    fillerPool.push({ key: "records", node: (
      <div className="bento-card h-full">
        <div className="mb-1 flex items-center justify-between">
          <div className="metric-label">{t("dash.records.title")}</div>
        </div>
        {/* « Récentes » ne disait pas jusqu'où : ce sont les séances CHARGÉES (les 40
            dernières), pas tout l'historique — d'où la date de la plus ancienne. Les records
            sur toute la carrière sont dans le rail (« Records personnels »). */}
        <div className="mb-3 text-[11px] text-zinc-400">{t("dash.records.sub", { date: formatDateCivile(records.depuis, lang, { day: "numeric", month: "long" }) })}</div>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <r.icon className="h-4 w-4 flex-shrink-0 text-zinc-400" strokeWidth={1.5} />
              <span className="flex-1 text-sm text-zinc-500">{r.label}</span>
              <span className="text-sm font-medium tabular-nums text-zinc-900">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    ) });
  }
  // ⚠️ NE PAS REMETTRE ICI UNE CARTE « Cette semaine ». Le rail de droite l'affiche
  //    déjà en permanence : les quatre mêmes chiffres (séances, distance, dénivelé,
  //    durée) apparaissaient DEUX FOIS sur la même page, dans deux mises en forme
  //    différentes — de quoi faire douter le lecteur de laquelle est la bonne.
  //    Le vivier de bouche-trous garde assez d'entrées sans elle.
  fillerPool.push({ key: "ready", node: (
    <div className="bento-card flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="metric-label">{t("dash.readyCard.title")}</div>
        <span className="h-3 w-3 rounded-full" style={{ background: readiness.pastille }} />
      </div>
      <p className="text-sm font-medium leading-relaxed text-zinc-700">{readiness.tagline}</p>
      <div className="mt-auto space-y-1.5 pt-4 text-xs">
        {/* ⚠️ L'ÉCART DE VFC SEULEMENT S'IL EST FRAIS (09/11/2026, capture de Cyprien). La carte
            disait « Rien de récent reçu de ta montre (VFC…) » et affichait juste dessous
            « VFC ↑ 1 ms » : l'écart de la mesure du 30/10, dix jours plus tôt, présenté comme
            celui du jour. Même règle que la phrase : une mesure périmée ne décide plus de la
            forme, elle ne s'affiche donc plus ici (la carte VFC la montre, datée). */}
        {hrvFraiche && hrvDelta != null && hrvBaseline != null && (
          <div className="flex justify-between"><span className="text-zinc-400">{t("dash.hrv.title")}</span><span className={`font-semibold ${hrvDelta >= 0 ? "text-emerald-600" : "text-amber-600"}`}>{hrvDelta >= 0 ? "↑" : "↓"} {Math.round(Math.abs(hrvDelta))} ms</span></div>
        )}
        {freshSleep && (
          <div className="flex justify-between"><span className="text-zinc-400">{t("dash.sleep.title")}</span><span className="font-semibold text-zinc-700">{freshSleep.sleep_score}/100</span></div>
        )}
      </div>
    </div>
  ) });
  const fillers = fillerPool.slice(0, 2);

  // Compte à rebours vers l'objectif et part de sa préparation déjà écoulée, en jours
  // CIVILS (lib/dashboard/fenetre). L'anneau part du jour où l'objectif a été fixé, ou d'un
  // plan démarré plus tard : il supposait 16 semaines de préparation quand rien ne le disait.
  const planMeta = plan as { start_date?: string; created_at?: string } | null;
  const avancement = avancementObjectif(objective, jour, planMeta?.start_date ?? planMeta?.created_at ?? null);
  const objDaysTo = avancement?.joursRestants ?? null;
  const objProgress = avancement?.pct ?? null;

  // Score de forme — 4 axes réels (endurance + vitesse dérivées des séances/VMA).
  const forme = computeForme(workouts, currentVma ?? 0, disc.recovery, disc.consistency,
    objective ? { distanceKm: objective.distanceKm ?? null, targetSeconds: objective.targetSeconds ?? null } : null, jour);
  // La référence de la barre de volume (voir la carte) : cible du coach, sinon capacité démontrée.
  const refVolume: number | null = cibleVolumeKm != null && cibleVolumeKm > 0 ? cibleVolumeKm : forme.cibleVolumeKm;
  /**
   * LE PLUS HAUT ET LE PLUS BAS DES QUATRE COMPOSANTES.
   *
   * Quatre barres presque égales ne se lisent pas d'un coup d'œil : nommer les deux
   * extrêmes dit en une ligne ce que le graphique met dix secondes à révéler.
   *
   * ⚠️ `plat` EXISTE POUR NE PAS DÉSIGNER UN FAUX POINT FAIBLE. À 97/98/100/100, écrire
   * « à travailler : Endurance » serait absurde : trois points d'écart ne sont pas une
   * faiblesse. En dessous de 5 points, on dit que le profil est équilibré — ce qui est la
   * vérité, et reste une information.
   */
  const formeExtremes = (() => {
    // `fl` n'est déclaré que plus bas ; on relit la table ici plutôt que de déplacer
    // un calcul au milieu d'un bloc qui n'a rien à voir.
    const fl0 = FORME_LABELS[lang] ?? FORME_LABELS.fr;
    const cs = [
      { label: fl0.endurance, val: forme.endurance, c: "#18181b" },
      { label: fl0.speed, val: forme.speed, c: "#18181b" },
      { label: fl0.recovery, val: forme.recovery, c: "#18181b" },
      { label: fl0.regularity, val: forme.regularity, c: "#18181b" },
    ].filter((c): c is { label: string; val: number; c: string } => c.val != null).sort((a, b) => b.val - a.val);
    const fort = cs[0], faible = cs[cs.length - 1];
    return { fort, faible, plat: fort.val - faible.val < 5 };
  })();

  // Zones d'entraînement : plus aucune FCmax de référence n'intervient. L'ancien calcul
  // dérivait les zones de `profiles.max_hr` — COLONNE QUI N'EXISTE PAS EN BASE, donc
  // toujours vide — puis retombait sur 220−âge, une estimation qui décale toutes les
  // bornes. On lit maintenant le temps en zone mesuré par la montre elle-même.
  const hrZones = computeHrZones(workouts, jour);

  // KPI de l'en-tête « hero » — résumé exécutif (valeurs réelles, repli « — »).
  const kpi = KPI_LABELS[lang] ?? KPI_LABELS.fr;
  const hl = HERO_LABELS[lang] ?? HERO_LABELS.fr;
  const rl = RAIL_LABELS[lang] ?? RAIL_LABELS.fr;
  const fl = FORME_LABELS[lang] ?? FORME_LABELS.fr;
  const zl = ZONES_LABELS[lang] ?? ZONES_LABELS.fr;
  // Le niveau d'après la VMA affichée juste à côté (lib/running/niveau), plus `profiles.mode`.
  const levelLabel = t(CLE_NIVEAU[niveauDeVma(currentVma) ?? "inconnu"]);
  const nx = NEXT_LABELS[lang] ?? NEXT_LABELS.fr;
  const vit = VITALS[lang] ?? VITALS.fr;
  // ⚠️ LA FC DE REPOS, OU RIEN. Le repli prenait la FC MOYENNE de la dernière séance, sous
  // l'intitulé « Fréquence cardiaque », à côté de la VFC du matin. Constaté le 05/11/2026 :
  // « 189 bpm », la FC moyenne du marathon couru onze jours plus tôt, lue comme une donnée
  // du jour. Sans FC de repos connue, la vignette ne s'affiche pas.
  const restingHr = Number((profile as { resting_hr?: number } | null)?.resting_hr) || 0;
  const distancePRs = computeDistancePRs(prWorkouts, lang, recordsDeclares);
  const router = useRouter();
  const [retrait, setRetrait] = useState<string | null>(null);
  const retirerRecord = async (cle: string) => {
    setRetrait(cle);
    try {
      const r = await fetch(`/api/records?distance=${encodeURIComponent(cle)}`, { method: "DELETE" });
      if (r.ok) router.refresh();
    } finally { setRetrait(null); }
  };
  const heroStats = [
    // ⚠️ « FORME » = le Score de FORME (06/11/2026). Ce chiffre était le Score discipline :
    // l'en-tête annonçait « Forme 76 » pendant que la carte Score de forme disait 66.
    { label: kpi.form, value: forme.hasData ? String(forme.total) : "—", unit: forme.hasData ? "/100" : "" },
    { label: kpi.hrv, value: hrvLatest != null ? hrvLatest.toFixed(0) : "—", unit: hrvLatest != null ? "ms" : "" },
    { label: kpi.vma, value: currentVma && currentVma > 0 ? nf(currentVma) : "—", unit: currentVma && currentVma > 0 ? "km/h" : "" },
    { label: kpi.vol, value: weeklyKm.toFixed(0), unit: "km" },
  ];

  /**
   * ⚠️ « TU N'AS RIEN » ET « ÇA N'A PAS CHARGÉ » NE SE DISENT PAS EN MÊME TEMPS.
   *
   * `noData` se déduisait de listes vides — or une lecture EN PANNE produit exactement
   * les mêmes listes vides. L'athlète voyait alors « connecte ta montre » alors que ses
   * séances existent et qu'il l'a déjà connectée. Quand une lecture a réellement
   * échoué, c'est ce message-là qu'on affiche, et pas l'autre.
   */
  const enPanne = (donneesIncompletes ?? []).length > 0;
  const noData = !enPanne && workouts.length === 0 && hrv.length === 0;

  return (
    <div className="min-h-full">

      {/* ⚠️ Une lecture a échoué : on le DIT, plutôt que d'afficher des zéros qui
          donneraient à croire que les données ont disparu. */}
      {enPanne && (
        <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-sm">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-500" />
          <p className="text-rose-800">
            {fill(t("dash.incomplet"), {
              // Un identifiant sans libellé n'affiche pas sa clé brute (« dash.inc.xxx ») :
              // on nomme ce qu'on sait nommer, sinon « tes données » en général.
              quoi: (donneesIncompletes ?? []).map((k) => t(`dash.inc.${k}`)).filter((l) => !l.startsWith("dash.inc.")).join(", ") || t("dash.inc.donnees"),
            })}
          </p>
        </div>
      )}

      {/* No data banner */}
      {noData && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">{t("dash.noData.title")}</p>
            <p className="text-amber-600 text-xs mt-0.5">{t("dash.noData.desc")}</p>
          </div>
          <Link href="/dashboard/sync" className="flex-shrink-0 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-xl hover:bg-amber-600 transition-colors">
            {t("dash.noData.cta")}
          </Link>
        </div>
      )}

      {/* Header élite — carte premium (3 zones : salutation · objectif · photo)
          ⚠️ COMPACTE SUR TÉLÉPHONE (Cyprien, 21/09/2026) : empilée, elle prenait plus de la
          moitié de l'écran — titre à 2 rem, cinq pastilles sur quatre lignes, anneau de
          92 px, J-34 en 2,25 rem. Sous `sm`, tout est resserré : pastilles sur UNE ligne
          qui défile, anneau à 64 px, pastille de série retirée (la carte Série est juste
          dessous). À partir de `sm`, rien ne change. */}
      <div
        className="relative mb-4 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:mb-6"
      >
        {/* Photo de coureur — panneau net à droite, fondu doux vers le dégradé */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[32%] overflow-hidden xl:block">
          <img src="https://images.unsplash.com/photo-1486218119243-13883505764c?w=900&q=75&fit=crop&crop=entropy" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #ffffff 0%, rgba(255,255,255,0.55) 24%, rgba(255,255,255,0) 60%)" }} />
        </div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-10 gap-y-3 px-5 py-4 sm:gap-y-7 sm:px-9 sm:py-8 xl:pr-[34%]">
          <div className="min-w-0 flex-1">
            {/* ⚠️ LE TITRE NOMME LE JOUR, PAS L'ATHLÈTE (passe « unslop », 06/11/2026). « Bonjour,
                Cyprien » ne disait rien que la barre du haut ne dise déjà (nom et niveau) ; le jour
                est le contexte de tout ce qui suit : la séance, la forme, la semaine. */}
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 first-letter:uppercase sm:text-[2.25rem] sm:leading-[1.15]">
              {jourAujourdhui
                ? formatDateCivile(jourAujourdhui, lang, { weekday: "long", day: "numeric", month: "long" })
                : new Date().toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}
            </h1>
            <p className="mt-1.5 flex items-center gap-2 text-[13px] text-zinc-500 sm:mt-2 sm:text-sm">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: readiness.pastille }} />
              {readiness.tagline}
            </p>
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-4 sm:flex-wrap sm:overflow-visible">
              <span className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-600">
                <Gauge className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} /> {levelLabel}
              </span>
              <span className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-600">
                <Activity className="h-3.5 w-3.5 text-zinc-400" strokeWidth={1.5} /> {weeklyKm.toFixed(0)} km · {hl.sept}
              </span>
              {/* Plus de pastille « série » ici (audit du 09/11/2026) : la carte Série, juste sous la
                  séance, dit la même chose avec ses quatorze jours. */}
              <WeatherChip />
            </div>
          </div>
          {objective && objDaysTo != null && objDaysTo >= 0 ? (
            /* ⚠️ SUR TÉLÉPHONE, UNE SEULE LIGNE CLIQUABLE. Empilé, ce bloc faisait 124 px
               (anneau, J‑32, libellé, nom de course, date, bouton) et poussait la séance du
               jour hors de l'écran. Il devient une rangée : anneau 56 px, deux lignes de
               texte, un chevron — et la rangée ENTIÈRE mène au plan, ce que seul le bouton
               faisait avant. À partir de `sm`, rien ne change. */
            <Link href="/dashboard/calendrier" className="group/obj -mx-1 flex w-full items-center gap-3 rounded-2xl px-1 py-1 transition-colors active:bg-white/40 sm:mx-0 sm:w-auto sm:gap-5 sm:px-0 sm:py-0">
              {/* L'anneau ne porte que son chiffre (09/11/2026) : le mot « préparation », dedans,
                  touchait le trait ; dessous, il faisait bizarre (Cyprien). Le J‑40 et le nom de
                  la course disent déjà de quoi il s'agit. */}
              <div className="flex-shrink-0">
                <div className="relative h-14 w-14 sm:h-[92px] sm:w-[92px]">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 92 92">
                    <circle cx="46" cy="46" r="40" fill="none" stroke="#f4f4f5" strokeWidth="7" />
                    <circle cx="46" cy="46" r="40" fill="none" stroke="#059669" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${(2 * Math.PI * 40 * (objProgress ?? 0)) / 100} ${2 * Math.PI * 40}`}
                      className="transition-[stroke-dasharray] duration-700" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center leading-none">
                    <span className="text-sm font-semibold tabular-nums text-zinc-900 sm:text-xl">{objProgress ?? "—"}<span className="text-[11px] text-zinc-400 sm:text-xs">%</span></span>
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                {/* Le libellé « Objectif » ne tient pas sur téléphone : le J‑32 et le nom de
                    la course le disent déjà. */}
                <div className="hidden text-[13px] text-zinc-500 sm:mt-1.5 sm:block">{hl.goal}</div>
                <div className="flex items-baseline gap-2 sm:block">
                  <span className="text-[1.5rem] font-semibold leading-none tracking-tight tabular-nums text-zinc-900 sm:text-[2.25rem]">J‑{objDaysTo}</span>
                  <span className="min-w-0 truncate text-sm font-medium text-zinc-900 sm:mt-1 sm:block">{objective.race}</span>
                </div>
                {/* La distance : un objectif nommé « sub 16 min » ne dit pas sur quelle course. */}
                <div className="text-xs tabular-nums text-zinc-500">
                  {objective.distanceKm > 0 && <>{objective.distanceKm.toLocaleString(lang)} km · </>}
                  {formatDateCivile(objective.raceDate, lang, { day: "numeric", month: "long", year: "numeric" })}
                </div>
                {/* Un habillage, plus un lien : la rangée entière mène déjà au plan, et un
                    lien dans un lien est du HTML invalide. */}
                <span className="mt-2.5 hidden items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors group-hover/obj:bg-zinc-800 sm:inline-flex sm:px-3.5 sm:py-2">
                  {hl.plan} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <ChevronRight className="h-5 w-5 flex-shrink-0 text-zinc-400 sm:hidden" aria-hidden />
            </Link>
          ) : (
            /* ⚠️ `w-full` SUR TÉLÉPHONE (06/11/2026) : sans lui, les quatre chiffres restaient
               sur la ligne du « Bonjour » et l'écrasaient sur une colonne d'un mot de large
               (« SEXTA- / FEIRA, / 6 / DE… ») — tout nouvel inscrit sans objectif, en mobile. */
            <div className="flex w-full flex-wrap gap-x-7 gap-y-4 sm:w-auto sm:gap-x-9">
              {heroStats.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-semibold tabular-nums text-zinc-900 sm:text-[1.7rem]">
                    {s.value}{s.unit && <span className="ml-0.5 text-sm font-normal text-zinc-400">{s.unit}</span>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-zinc-500">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Contenu principal + rail de droite (3 colonnes avec la sidebar) ── */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
      {/* ⚠️ LA SÉANCE VIENT EN DEUXIÈME, juste sous « Bonjour », SUR TÉLÉPHONE (21/09/2026 :
          « c'est ce qui est très important sur mon application ») ET DÉSORMAIS SUR ORDINATEUR
          (07/11/2026 : « avoir la séance juste en dessous de l'onglet Bonjour Cyprien »). La
          colonne est une pile flex à toutes les tailles : `order-first` sur les trois variantes
          de la séance (bannière sans coach, carte compacte, carte complète) les fait passer
          devant le ressenti, les alertes, la série et les sections. */}
      <div className="flex min-w-0 flex-col">

      {/* Ressenti post-séance — demandé après la dernière séance */}
      {ressenti && <SessionFeedback seances={ressenti.seances} chaussures={ressenti.chaussures} />}

      {/* Anti-blessure proactif — déload auto si la charge devient risquée */}
      {loadRisk?.deload && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">{t("dash.deload.title")}</p>
            <p className="mt-0.5 text-sm text-red-600">{loadRisk.reason}. {t("dash.deload.desc")}</p>
          </div>
        </div>
      )}

      {/* L'état de l'abonnement, AVANT le reste : le pire moment pour apprendre qu'un
          essai existait, c'est le jour où il se termine. Le composant se tait de
          lui-même tant qu'il reste plus d'une semaine. */}
      <TrialBanner acces={acces ?? null} />

      {/* ⚠️ SOUS LA SÉANCE, PLUS AU-DESSUS DE « BONJOUR » (07/11/2026). En tête de page, ce
          bandeau repoussait la séance du jour de 230 px sur téléphone : c'est une invitation,
          elle passe après ce qu'on vient faire en ouvrant l'application. */}
      {/* Profil incomplet : les comptes antérieurs au questionnaire complet ne repassent
          jamais par l'inscription — on leur dit ce qui manque et ce que ça leur coûte. */}
      <ProfileCompletionBanner profile={profile as unknown as Record<string, unknown> | null} />

      {/* La série — la boucle quotidienne, alignée sur le plan et non contre lui. */}
      <StreakCard streak={streak ?? null} />


      {/* Prochaine séance — bannière compacte (uniquement si pas de bandeau coach) */}
      {!coachKey && (
        <div className="order-first mb-5 flex items-center gap-4 rounded-2xl border border-zinc-200/70 bg-white px-5 py-3.5 shadow-sm">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#ecfdf5]" style={{ color: displaySession.accent }}>
            <Calendar className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-zinc-500">{nx.next}</div>
            <div className="truncate text-sm font-semibold text-zinc-900">{displaySession.title}</div>
            {displaySession.subtitle && <div className="truncate text-xs text-zinc-500">{displaySession.subtitle}</div>}
          </div>
          <Link href="/dashboard/calendrier" className="flex-shrink-0 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800">
            {nx.details}
          </Link>
        </div>
      )}

      {/* Séance prescrite par le coach — bannière mise en avant (prioritaire) */}
      {coachKey && coachMinimal && (
        // Variante compacte : séance « légère » (repos, footing court) → barre horizontale,
        // pas de grand aplat vide.
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="order-first relative mb-5 flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4 text-white shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-6"
          style={{ background: "linear-gradient(170deg,#065f46 0%,#064e3b 100%)" }}
        >
          <span className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10"><Moon className="h-[18px] w-[18px] text-white/90" strokeWidth={1.5} /></span>
          <div className="relative z-10 min-w-0 flex-1">
            <span className="block truncate text-[13px] text-emerald-100/75">{badgeCoach}</span>
            <h2 className="text-xl font-semibold leading-tight tracking-tight sm:text-[1.4rem]">{coachKey.title}</h2>
            {coachKey.subtitle && <p className="mt-0.5 truncate text-[13px] text-white/85">{coachKey.subtitle}</p>}
          </div>
          <Link href="/dashboard/calendrier" title={t("dash.viewCalendar")}
            className="relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20">
            <Calendar className="h-4 w-4 text-white/80" strokeWidth={1.5} />
          </Link>
        </motion.div>
      )}
      {coachKey && !coachMinimal && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="order-first relative mb-5 overflow-hidden rounded-2xl p-5 sm:p-6 text-white shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.08)]"
          style={{ background: "linear-gradient(170deg,#065f46 0%,#064e3b 100%)" }}
        >
          {/* Le moment fort de l'écran (passe « unslop », 06/11/2026) : un vert profond, une seule
              teinte. Plus de halos flous, d'ombre colorée ni de liseré brillant. */}

          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center">
                <span className="whitespace-nowrap text-[13px] text-emerald-100/75 truncate">{badgeCoach}</span>
              </span>
              <Link href="/dashboard/calendrier" title={t("dash.viewCalendar")}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20">
                <Calendar className="h-4 w-4 text-white/80" strokeWidth={1.5} />
              </Link>
            </div>

            <h2 className="text-[1.4rem] font-semibold leading-[1.15] tracking-tight sm:text-[1.75rem]">{coachKey.title}</h2>
            {/* La prescription en ÉTAPES quand le coach l'a chaînée par des flèches
                (lib/dashboard/etapes) ; sinon, la phrase telle quelle. */}
            {coachKey.subtitle && (() => {
              const etapes = etapesSeance(coachKey.subtitle);
              if (!etapes) return <p className="mt-2 max-w-2xl text-[14px] leading-relaxed tabular-nums text-white/85 sm:text-[15px]">{coachKey.subtitle}</p>;
              return (
                <ol className="mt-3.5 max-w-2xl space-y-2" aria-label={coachKey.subtitle}>
                  {etapes.map((e, i) => (
                    <li key={i} className="relative flex gap-3 pl-0.5">
                      {i < etapes.length - 1 && <span aria-hidden className="absolute left-[9px] top-5 h-[calc(100%-4px)] w-px bg-white/20" />}
                      <span aria-hidden className={`relative mt-1 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums ${e.coeur ? "bg-white text-emerald-900" : "bg-white/10 text-white/70"}`}>{i + 1}</span>
                      <p className={`min-w-0 leading-relaxed tabular-nums ${e.coeur ? "text-[14px] font-medium text-white sm:text-[15px]" : "text-[13px] text-white/70 sm:text-[14px]"}`}>
                        {e.libelle && <span className="mr-1.5 text-white/60">{e.libelle}</span>}
                        {e.texte}
                      </p>
                    </li>
                  ))}
                </ol>
              );
            })()}

            {coachKey.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {coachKey.tags.map((t, i) => (
                  <span key={`${i}-${t.l}`} className="rounded-md bg-white/10 px-2 py-1 text-xs font-medium tabular-nums text-white/90">{t.l}</span>
                ))}
              </div>
            )}

            {/* ⚠️ L'EXPLICATION SE REPLIE. Déployée, elle ajoutait ~110 px à une carte qui
                en faisait déjà 478 sur un écran de 390 px : la séance du jour — la seule
                chose sur laquelle on agit en ouvrant l'application — était coupée en deux.
                La PRESCRIPTION reste entière et visible ; c'est le POURQUOI qui se déplie,
                nommé par son intitulé pour qu'on sache ce qu'on ouvre.
                `<details>` plutôt qu'un état React : pas de JavaScript, pas de différence
                entre le rendu serveur et le navigateur. */}
            {coachKey.why && (
              <details className="group mt-4 border-t border-white/15 pt-3.5">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-white/85 transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
                  {t("dash.coach.pourquoi")}
                  <ChevronRight className="h-4 w-4 text-white/60 transition-transform group-open:rotate-90" aria-hidden />
                </summary>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/75">{coachKey.why}</p>
              </details>
            )}
          </div>
        </motion.div>
      )}

      {/* Bento Grid — sections éditoriales, chaque rangée pavée (aucune colonne vide).
          ⚠️ PLUS D'ENTRÉE ANIMÉE CARTE PAR CARTE (passe « unslop », audit du 09/11/2026) : douze
          cartes qui montaient l'une après l'autre au chargement, c'est la signature d'une page
          générée. Une seule entrée reste, celle de la séance du jour — la chose qu'on vient voir. */}
      <div className="grid grid-cols-12 gap-4 auto-rows-auto">

        <SectionLabel>{t("dash.sec.today")}</SectionLabel>

        {/* Discipline Score — large card */}
        <motion.div
          className="group relative col-span-12 md:col-span-4 bento-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="metric-label">{fl.title}</div>
            <VersFiche cle="forme" titre={fl.title} lang={lang} />
          </div>
          {forme.hasData ? (
            <>
            <div className="flex items-center gap-5">
              {/* Le verdict (« Bonne forme ») vit SOUS l'anneau (09/11/2026) : en troisième
                  ligne dedans, il tombait là où le cercle se resserre et touchait le trait
                  (capture de Cyprien). Dedans : le chiffre et « / 100 », rien d'autre. */}
              <div className="flex flex-shrink-0 flex-col items-center gap-2">
                <div className="relative h-28 w-28">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F4F4F5" strokeWidth="9" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={readiness.accent} strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42 * forme.total / 100} ${2 * Math.PI * 42}`}
                      className="transition-[stroke-dasharray] duration-700" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[2rem] font-semibold leading-none tracking-tight tabular-nums text-zinc-900">{forme.total}</span>
                    <span className="mt-1 text-[11px] leading-none text-zinc-400">{fl.of}</span>
                  </div>
                </div>
                <span className="text-[11px] font-medium leading-none text-zinc-500">{fl.rate(forme.total)}</span>
              </div>
              <div className="flex-1 space-y-2.5">
                {[
                  { label: fl.endurance, val: forme.endurance, c: "#3f3f46" },
                  { label: fl.speed, val: forme.speed, c: "#3f3f46" },
                  { label: fl.recovery, val: forme.recovery, c: "#3f3f46" },
                  { label: fl.regularity, val: forme.regularity, c: "#3f3f46" },
                ].map(m => (
                  <div key={m.label}>
                    {/* `gap-2` + `truncate` : « Récupération72% » collé sur une carte étroite. */}
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-zinc-500">{m.label}</span>
                      <span className="flex-shrink-0 font-medium tabular-nums text-zinc-900">{m.val == null ? "—" : `${m.val}%`}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full"
                        style={{ width: `${m.val ?? 0}%`, backgroundColor: m.c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* ⚠️ UN SCORE SUR 100 DONT ON IGNORE LE DÉNOMINATEUR N'EST PAS UNE MESURE.
                Les repères étaient universels et invisibles : 30 km de sortie longue et
                50 km/semaine valaient 100 % pour tout le monde, si bien qu'un coureur de
                10 km parfaitement préparé lisait 40 % d'endurance. La carte dit désormais
                sur quoi elle compte — et quand elle n'a pas d'objectif, elle le dit aussi
                au lieu de faire passer un repère générique pour la mesure de l'athlète. */}
            <div className="mt-3 border-t border-zinc-100 pt-2.5 text-[11px] leading-relaxed text-zinc-400">
              {forme.reference === "objectif" && forme.cibleLongueKm != null
                ? (forme.cibleVolumeKm != null
                  ? t("dash.forme.ref", { l: forme.cibleLongueKm, v: forme.cibleVolumeKm })
                  // Sans cible de volume, on ne l'écrit pas : « volume — km/sem » se lisait comme une panne.
                  : t("dash.forme.refLongue", { l: forme.cibleLongueKm }))
                : t("dash.forme.refGen")}
            </div>
            {/* ⚠️ CE BLOC COMBLE 106 px DE VIDE MESURÉ, avec de la DONNÉE, pas du
                rembourrage. La carte affichait un score et quatre barres, puis s'arrêtait
                — la rangée étant tirée par les deux cartes voisines (337 px contre 231 de
                contenu), le tiers inférieur restait blanc.
                Ce qu'on y met est dérivé des QUATRE VALEURS DÉJÀ CALCULÉES : rien de neuf
                n'est inventé, on nomme seulement ce que l'athlète ne peut pas lire d'un
                coup d'œil sur quatre barres presque égales.
                ⚠️ HAUTEUR STABLE : le bloc s'affiche TOUJOURS. Le masquer quand le profil
                est homogène ferait sauter la carte d'une visite à l'autre. Quand l'écart
                est négligeable, on le DIT (« profil équilibré ») au lieu de désigner un
                point faible qui n'en est pas un. */}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3.5">
              <div>
                <div className="text-[11px] font-medium text-zinc-400">{fl.fort}</div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-zinc-900">{formeExtremes.fort.label}</span>
                  <span className="text-xs tabular-nums text-zinc-500">{formeExtremes.fort.val}%</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-zinc-400">{formeExtremes.plat ? "\u00a0" : fl.faible}</div>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  {formeExtremes.plat ? (
                    <span className="text-sm font-semibold text-zinc-500">{fl.equilibre}</span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-zinc-900">{formeExtremes.faible.label}</span>
                      <span className="text-xs tabular-nums text-zinc-500">{formeExtremes.faible.val}%</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50">
                <Target className="h-[18px] w-[18px] text-zinc-400" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-zinc-600">{t("dash.discipline.emptyTitle")}</p>
              <p className="mt-1 max-w-[210px] text-xs text-zinc-400">{t("dash.discipline.emptyDesc")}</p>
            </div>
          )}
        </motion.div>

        {/* HRV Chart.
            ⚠️ COLONNE FLEXIBLE, et ce n'est pas cosmétique. La grille étire toutes les
            cartes d'une rangée à la hauteur de la plus grande : ici 337 px, imposés par la
            carte voisine. Le graphique était figé à 80 px, laissant 51 px de blanc mesuré
            sous le pied de carte. Une courbe de VFC sur quatorze jours haute de 80 px
            n'est pas lisible — c'est pourtant le seul contenu de cette carte. En
            `flex-col`, le graphique prend la place que la rangée lui donne. */}
        <motion.div
          className="group relative col-span-12 md:col-span-4 bento-card flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="metric-label">{t("dash.hrv.title")}</div>
            <VersFiche cle="vfc" titre={t("dash.hrv.title")} lang={lang} />
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight tabular-nums text-zinc-900">
                  {hrvLatest != null ? hrvLatest.toFixed(0) : "—"} <span className="text-sm font-normal text-zinc-400">ms</span>
                </span>
                {hrvDelta != null && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${hrvDansNorme ? "text-zinc-500" : hrvDelta >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                    {hrvDansNorme ? "≈" : hrvDelta >= 0 ? "↑" : "↓"} {Math.round(Math.abs(hrvDelta))} ms
                  </span>
                )}
              </div>
              {hrvBaseline != null && (
                <div className="mt-1 text-[11px] text-zinc-400">
                  {t("dash.hrv.baseline")}{deuxPoints}<span className="font-medium text-zinc-500">{hrvBaseline} ms</span>
                  {hrvDelta != null && <span> · {hrvDansNorme ? t("dash.hrv.norme") : hrvDelta >= 0 ? t("dash.hrv.above") : t("dash.hrv.below")}</span>}
                </div>
              )}
              {/* Une VFC affichée sans date se lit comme la mesure du matin. Quand elle
                  ne l'est pas, on le dit — c'est ce qui distingue une donnée d'un chiffre. */}
              {!hrvFraiche && hrvJours != null && hrvJours > 0 && (
                <div className="mt-1 text-[11px] font-medium text-amber-600">
                  {t(hrvJours > 1 ? "dash.hrv.stale" : "dash.hrv.stale1", { n: hrvJours })}
                </div>
              )}
              {/* La SDNN d'une Apple Watch n'est pas une rMSSD : pas la même échelle, elle ne
                  se compare qu'à elle-même. On nomme la mesure, et le réglage qui donne la
                  VFC de nuit. */}
              {metriqueVfc === "sdnn" && hrvLatest != null && (
                <div className="mt-1 max-w-[16rem] text-[11px] leading-snug text-zinc-400">{t("dash.hrv.sdnn")}</div>
              )}
            </div>
          </div>
          {/* `min-h` garde une courbe lisible quand la rangée est courte (mobile, cartes
              voisines vides) ; `flex-1` absorbe le reste de la hauteur imposée. */}
          {hrvChartData.length > 0 ? (
            <div className="min-h-[80px] flex-1">
              <MiniAire points={hrvChartData.map((h) => ({ date: h.date, valeur: Number(h.hrv) }))} couleur={readiness.accent} unite="ms" libelle="HRV" />
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-sm text-zinc-400">
              {t("dash.hrv.empty")}
            </div>
          )}
          {(restingHr > 0 || freshSleep) && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {restingHr > 0 && (
                <div className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5">
                  <Heart className="h-4 w-4 flex-shrink-0 text-zinc-400" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold tabular-nums text-zinc-900">{Math.round(restingHr)}<span className="ml-0.5 text-[11px] font-normal text-zinc-400">bpm</span></div>
                    <div className="truncate text-[11px] text-zinc-500">{vit.hr}</div>
                  </div>
                </div>
              )}
              {freshSleep && (
                <div className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5">
                  <Moon className="h-4 w-4 flex-shrink-0 text-zinc-400" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold tabular-nums text-zinc-900">{hm(freshSleep.total_sleep_min)}</div>
                    <div className="truncate text-[11px] text-zinc-500">{t("dash.sleep.title")}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* VMA & prédictions de course — depuis la VMA estimée (modèle % VMA) */}
        <motion.div
          className="group relative col-span-12 md:col-span-4 bento-card"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="metric-label">{t("dash.vma.title")}</div>
            <VersFiche cle="vitesse" titre={t("dash.vma.title")} lang={lang} />
          </div>
          {predictions ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums text-zinc-900">{nf(currentVma ?? 0)}</span>
                <span className="text-sm text-zinc-400">km/h</span>
              </div>
              <div className="text-[11px] text-zinc-400">{t("dash.vma.sub")}</div>
              {sourceVma && (
                <div className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                  {/* Une séance sans distance mesurée ne se cite pas « (0 km) ». */}
                  {sourceVma.type === "seances" && sourceVma.date && (sourceVma.km ?? 0) > 0
                    ? t("dash.vma.src.seances", {
                        d: formatDateCivile(sourceVma.date, lang, { day: "numeric", month: "long" }),
                        km: (Math.round((sourceVma.km ?? 0) * 10) / 10).toLocaleString(lang),
                      })
                    : sourceVma.type === "test" && sourceVma.date
                      ? t("dash.vma.src.test", { d: formatDateCivile(sourceVma.date, lang, { day: "numeric", month: "long", year: "numeric" }) })
                      : sourceVma.type === "courbe" ? t("dash.vma.src.courbe")
                      : sourceVma.type === "vo2max" ? t("dash.vma.src.vo2max") : null}
                  {" · "}{t("dash.vma.maj")}
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {predictions.map((p) => (
                  <div key={p.label} className="rounded-xl bg-zinc-50 px-3 py-2.5">
                    <div className="text-[12px] text-zinc-500">{p.label}</div>
                    <div className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">{p.time}</div>
                    <div className="text-[11px] tabular-nums text-zinc-400">{p.pace}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50"><Gauge className="h-[18px] w-[18px] text-zinc-400" strokeWidth={1.5} /></div>
              <p className="max-w-[210px] text-xs text-zinc-400">{t("dash.vma.empty")}</p>
            </div>
          )}
        </motion.div>

        {/* L'OBJECTIF APRÈS « AUJOURD'HUI » (07/11/2026). Le bandeau du haut dit déjà J‑N et la
            préparation : cette carte sert à fixer ou modifier l'objectif et à ouvrir « Où j'en
            suis » — utile, mais moins que la séance et l'état du jour. Pleine largeur dans la
            grille ; sa marge propre est neutralisée, la grille espace déjà ses cartes. */}
        <div className="col-span-12 [&>div]:mb-0">
          <ObjectiveCard objective={objective ?? null} derniereCourse={derniereCourse} currentVma={currentVma ?? null} aujourdhui={jour} />
        </div>

        <SectionLabel>{t("dash.sec.activity")}</SectionLabel>

        {/* Activité 7 jours — barres km/jour */}
        <motion.div
          className={`col-span-12 bento-card flex flex-col ${fillers[0] ? "md:col-span-8" : ""}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="metric-label">{t("dash.weekly.title")}</div>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs">
              <span className="text-zinc-400">{t("dash.summary.sessions")} <strong className="tabular-nums text-zinc-900">{weekSummary.sessions}</strong></span>
              <span className="text-zinc-400">{t("dash.weekly.total")} <strong className="tabular-nums text-zinc-900">{nf(weekSummary.km)} km</strong></span>
              <span className="text-zinc-400">{t("dash.chart.elevation")} <strong className="tabular-nums text-zinc-900">+{Math.round(weekSummary.elev)} m</strong></span>
              {/* Même format que la liste des séances (« 46 min », « 1h02 ») : « 0:00 » ne s'écrit nulle part ailleurs. */}
              <span className="text-zinc-400">{t("dash.metric.duration")} <strong className="tabular-nums text-zinc-900">{duree(weekSummary.sec / 60)}</strong></span>
            </div>
          </div>
          {/* Même raison que la carte VFC : la rangée impose sa hauteur, le graphique
              était figé à 140 px et laissait 36 px de blanc mesuré sous lui. */}
          <div className="min-h-[140px] flex-1">
            {/* Sept barres à zéro ne disent rien : on dit qu'il n'y a pas eu de course, et depuis quand. */}
            {weekSummary.sessions === 0 ? (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-zinc-600">{t("dash.weekly.vide")}</p>
                {runs[0] && <p className="mt-1 text-xs text-zinc-400">{t("dash.weekly.derniere", { d: formatDateCivile(String(runs[0].date).slice(0, 10), lang, { day: "numeric", month: "long" }) })}</p>}
              </div>
            ) : (
              <MiniBarres barres={weeklyData.map((d) => ({ jour: d.day, valeur: d.km }))} libelle={t("dash.chart.distance")} unite="km" lang={lang} />
            )}
          </div>
        </motion.div>

        {/* Carte de droite n°1. Garde-fou (audit du 09/11/2026) : si le vivier venait à être vide,
            `fillers[0].node` ferait tomber tout le tableau de bord — vu au crash-test de rendu le
            temps d'un essai sans « Forme du jour ». « Activité 7 jours » prend alors la pleine largeur. */}
        {fillers[0] && <motion.div key={fillers[0].key}
          className="col-span-12 md:col-span-4"
        >
          {fillers[0].node}
        </motion.div>}

        {/* Dernière séance (col-8) + carte de droite n°2 (col-4) — rangée pavée */}
        {/* ⚠️ LA SECONDE CARTE PEUT MANQUER (06/11/2026, crash-test au hasard). Le vivier n'a
            parfois qu'UNE carte : séance du coach publiée (pas de « séance-clé »), pas de nuit
            récente, aucune COURSE avec une distance (cycliste, randonneur). `fillers[1].node`
            levait alors une exception et tout le tableau de bord tombait en erreur 500. */}
        {w0 && lastMetrics.length > 0 && (
          <>
            <motion.div
              className={`col-span-12 bento-card ${fillers[1] ? "md:col-span-8" : ""}`}
            >
              <div className="mb-4 flex items-center gap-2">
                <Footprints className="h-4 w-4 text-zinc-500" />
                <div className="metric-label">{t("dash.last.title")}{w0.title ? ` — ${cleanActivityName(w0.title)}` : ""}</div>
                {/* ⚠️ LA DATE (09/11/2026). Sans elle, « Dernière séance » se lisait comme celle
                    d'hier : la carte montrait un footing du 25/10, quinze jours plus tôt, sous
                    un graphique de la semaine entièrement vide. */}
                <span className="ml-auto flex-shrink-0 text-xs text-zinc-400">{formatDateCivile(String(w0.date).slice(0, 10), lang, { weekday: "short", day: "numeric", month: "short" })}</span>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4">
                {lastMetrics.map((m) => (
                  <div key={m.label} className="text-center">
                    <div className="text-2xl font-semibold leading-none text-zinc-900">
                      {m.value}<span className="ml-0.5 text-sm font-normal text-zinc-400">{m.unit}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-500">{m.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
            {fillers[1] && <motion.div key={fillers[1].key}
              className="col-span-12 md:col-span-4"
            >
              {fillers[1].node}
            </motion.div>}
          </>
        )}

        {/* Recent workouts */}
        <motion.div
          className="col-span-12 bento-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="metric-label">{t("dash.recent.title")}</div>
            {/* La LISTE des séances, pas le calendrier (qui montre le plan à venir). */}
            <Link href="/dashboard/activites" className="text-xs text-emerald-600 font-medium hover:text-emerald-700">
              {t("dash.recent.viewAll")}
            </Link>
          </div>
          {workouts.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-sm">
              {t("dash.recent.empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {workouts.slice(0, 5).map((w) => (
                <Link
                  key={w.id}
                  href={`/dashboard/activite?date=${String(w.date).slice(0, 10)}&dist=${w.distance_km ?? ""}&title=${encodeURIComponent(w.title ?? "")}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-1 p-3 rounded-2xl hover:bg-zinc-50 transition-colors cursor-pointer sm:flex-nowrap"
                >
                  <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-zinc-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 text-sm truncate group-hover:text-emerald-700">{cleanActivityName(w.title)}</div>
                    <div className="text-xs text-zinc-400">
                      {formatDateCivile(String(w.date).slice(0, 10), lang, { weekday: "long", day: "numeric", month: "short" })}
                    </div>
                  </div>
                  {/* ⚠️ DÉBORDEMENT HORIZONTAL SUR TÉLÉPHONE, mesuré à 375 px : la page
                      partait à 412 px de large et se faisait glisser latéralement. Cinq
                      valeurs plus une pastille et un chevron ne tiennent pas sur une ligne
                      de 375 px, et `flex-shrink-0` interdisait au bloc de céder.
                      On garde donc les mesures qui décrivent l'EFFORT (distance, cardio,
                      durée) et on masque le dénivelé sous 640 px — c'est la seule des
                      quatre dont l'absence ne change pas la lecture d'une sortie, et elle
                      reste disponible au clic sur la séance. */}
                  {/* ⚠️ SUR TÉLÉPHONE, LES MESURES PASSENT SOUS LE TITRE (Cyprien, 21/09/2026,
                      capture) : à 375 px elles prenaient ~250 px et ne laissaient que 40 px
                      au titre et à la date — la date se pliait sur trois lignes SOUS les
                      chiffres, et le titre de la séance disparaissait. `order-last` +
                      `w-full` les font passer sur une deuxième ligne, alignée sur le titre ;
                      à partir de sm, une seule ligne comme avant. */}
                  <div className="order-last flex w-full gap-3 pl-[52px] text-sm text-zinc-600 sm:order-none sm:w-auto sm:flex-shrink-0 sm:gap-4 sm:pl-0">
                    {/* `> 0 ?` et pas `&&` : avec `&&`, une distance ou une FC à 0 affichait « 0 ». */}
                    {/* Colonnes de largeur fixe, chiffres alignés à droite : d'une ligne à
                        l'autre, les distances, FC et durées se lisent en colonne (07/11/2026). */}
                    <span className="tabular-nums sm:w-16 sm:text-right">{Number(w.distance_km) > 0 ? `${nf(Number(w.distance_km))} km` : ""}</span>
                    <span className="hidden tabular-nums text-zinc-400 sm:inline sm:w-14 sm:text-right">{Number(w.elevation_gain_m) >= 1 ? `+${Math.round(Number(w.elevation_gain_m))} m` : ""}</span>
                    <span className="tabular-nums sm:w-16 sm:text-right">{Number(w.avg_hr) > 0 ? `${Math.round(Number(w.avg_hr))} bpm` : ""}</span>
                    <span className="tabular-nums text-zinc-400 sm:w-14 sm:text-right">{Number(w.duration_seconds) > 0 ? duree(Number(w.duration_seconds) / 60) : ""}</span>
                  </div>
                  {(() => {
                    // La zone où la séance a le plus duré, MESURÉE (lib/dashboard/zones) — sinon rien.
                    const z = zoneDominante(w.hr_zone_seconds);
                    return z ? <span className={`px-2 py-1 rounded-lg text-xs font-medium zone-z${z}`}>Z{z}</span> : null;
                  })()}
                  <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-600 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        <SectionLabel>{t("dash.sec.load")}</SectionLabel>

        {/* Charge & Affûtage — CTL/ATL/TSB réels (modèle Banister) */}
        <motion.div
          className="group relative col-span-12 md:col-span-6"
        >
          <TaperingWidget workouts={chargeHistory} raceDate={raceDate} aujourdhui={jour} />
          <VersFiche cle="charge" titre={t("tap.title")} lang={lang} />
        </motion.div>

        {/* Charge aiguë / chronique (ACWR) — prévention blessure (modèle Gabbett) */}
        <motion.div
          className="group relative col-span-12 md:col-span-6 bento-card flex flex-col"
        >
          <div className="mb-1 flex items-start justify-between">
            <div>
              <div className="metric-label">{t("dash.acwr.title")}</div>
            <VersFiche cle="acwr" titre={t("dash.acwr.title")} lang={lang} />
              <div className="mt-0.5 text-[11px] text-zinc-400">{t("dash.acwr.sub")}</div>
            </div>
          </div>
          {/* ⚠️ RATIO NUL ≠ PAS DE DONNÉES (audit du 09/11/2026). Sans course depuis sept jours, la
              charge aiguë vaut 0 et le ratio aussi : la carte disait « Plus de séances nécessaires »
              à un coureur qui en avait 21 sur six semaines. Quand la base chronique existe, 0,00 est
              une vraie mesure — une sous-charge — et on l'affiche comme telle. */}
          {acwr > 0 || loadRisk?.base ? (() => {
            const zone = acwr < 0.8 ? { l: t("dash.acwr.under"), c: "#0284C7" }
              : acwr <= 1.3 ? { l: t("dash.acwr.optimal"), c: "#059669" }
              : acwr <= 1.5 ? { l: t("dash.acwr.caution"), c: "#EA580C" }
              : { l: t("dash.acwr.high"), c: "#DC2626" };
            const pos = Math.max(0, Math.min(1, (acwr - 0.5) / 1.3)) * 100;
            const ticks = [{ v: nf(0.8), p: 23.08 }, { v: nf(1.3), p: 61.54 }, { v: nf(1.5), p: 76.92 }];
            return (
              <div className="mt-auto pt-2">
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-semibold tabular-nums" style={{ color: zone.c }}>{nf(acwr, 2)}</span>
                  <span className="mb-1 text-sm font-semibold" style={{ color: zone.c }}>{zone.l}</span>
                </div>
                <div className="relative mt-4 mb-6">
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full">
                    <div style={{ width: "23.08%", background: "#BAE6FD" }} />
                    <div style={{ width: "38.46%", background: "#A7F3D0" }} />
                    <div style={{ width: "15.38%", background: "#FED7AA" }} />
                    <div style={{ width: "23.08%", background: "#FECACA" }} />
                  </div>
                  <div className="absolute h-4 w-1.5 rounded-full bg-zinc-900 ring-2 ring-white" style={{ top: -3, left: `calc(${pos}% - 3px)` }} />
                  {ticks.map((tk) => (
                    <span key={tk.v} className="absolute top-4 -translate-x-1/2 text-[11px] tabular-nums text-zinc-400" style={{ left: `${tk.p}%` }}>{tk.v}</span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-400">{t("dash.acwr.monotony")} <strong className="tabular-nums text-zinc-700">{nf(loadRisk?.monotony ?? 0)}</strong></span>
                  <span className="text-zinc-300">·</span>
                  <span className="text-zinc-500">{t("dash.acwr.sweet")}</span>
                </div>
              </div>
            );
          })() : (
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50"><Gauge className="h-[18px] w-[18px] text-zinc-400" strokeWidth={1.5} /></div>
              <p className="max-w-[230px] text-xs text-zinc-400">{t("dash.acwr.empty")}</p>
            </div>
          )}
        </motion.div>

        {/* Volume + tendance 6 semaines */}
        <motion.div
          className="group relative col-span-12 md:col-span-6 bento-card"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="metric-label">{t("dash.volume.title")}</div>
            <VersFiche cle="volume" titre={t("dash.volume.title")} lang={lang} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="metric-value text-zinc-900">{nf(weeklyKm)}</span>
            <span className="text-sm text-zinc-400">km</span>
            {volumeDelta != null && Math.abs(volumeDelta) >= 0.5 && (
              <span className={`ml-auto inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${volumeDelta >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {volumeDelta >= 0 ? "↑" : "↓"} {Math.abs(volumeDelta).toFixed(0)} km
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-400">{volumeDelta != null ? t(volumeRefLabel) : " "}</div>
          <div className="mt-3 flex h-14 items-end gap-1.5">
            {volumeTrend.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-md"
                style={{ height: `${Math.max(4, (v.km / trendMax) * 56)}px`, background: v.isCurrent ? "#059669" : "#D1FAE5" }}
                title={`${nf(v.km)} km`} />
            ))}
          </div>
          <div className="mt-1 text-center text-[11px] text-zinc-400">{t("dash.volume.trend")}</div>
          {/* ⚠️ PLUS DE 60 KM ÉCRITS EN DUR (06/11/2026). La barre se remplissait par rapport à
              60 km pour TOUT LE MONDE, sous « Objectif : selon plan ». Elle se mesure à la cible
              de la semaine fixée par le coach ; sinon à la capacité démontrée ; sinon, pas de
              barre — on ne dessine pas de progression vers un objectif qui n'existe pas. */}
          {refVolume != null && refVolume > 0 && (
            <div className="mt-3 h-1.5 rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-[#059669]" style={{ width: `${Math.min((weeklyKm / refVolume) * 100, 100)}%` }} />
            </div>
          )}
          <div className="mt-1 text-xs text-zinc-400">{t("dash.volume.goal")}{deuxPoints}{refVolume != null && refVolume > 0 ? `${nf(refVolume, 0)} km${cibleVolumeKm != null && cibleVolumeKm > 0 ? ` · ${t("dash.volume.perPlan")}` : ""}` : t("dash.volume.goalNone")}</div>
        </motion.div>

        {/* Zones d'entraînement (FC) — temps par zone + verdict de polarisation 80/20 */}
        <motion.div
          className="group relative col-span-12 md:col-span-6 bento-card"
        >
          <div className="mb-1 flex items-center justify-between">
            <div className="metric-label">{zl.title}</div>
            <VersFiche cle="zones" titre={zl.title} lang={lang} />
          </div>
          <div className="mb-3 text-[11px] text-zinc-400">{zl.sub}</div>
          {hrZones.total > 0 ? (() => {
            const r = 34, C = 2 * Math.PI * r;
            let acc = 0;
            const segs = hrZones.secs.map((s, i) => {
              const pct = s / hrZones.total;
              const seg = { off: acc, len: C * pct, color: HR_ZONE_DEFS[i].color, pct, min: Math.round(s / 60) };
              acc += C * pct;
              return seg;
            });
            const easyPct = Math.round(((hrZones.secs[0] + hrZones.secs[1]) / hrZones.total) * 100);
            const good = easyPct >= 75 && easyPct <= 90;
            return (
              <>
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 flex-shrink-0">
                    <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                      <circle cx="40" cy="40" r={r} fill="none" stroke="#F4F4F5" strokeWidth="10" />
                      {segs.map((sg, i) => sg.len > 0 && (
                        <circle key={i} cx="40" cy="40" r={r} fill="none" stroke={sg.color} strokeWidth="10"
                          strokeDasharray={`${Math.max(sg.len - 1.5, 0)} ${C}`} strokeDashoffset={-sg.off}
                          className="transition-[stroke-dasharray] duration-700" />
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-semibold tabular-nums text-zinc-900">{easyPct}%</span>
                      <span className="text-[11px] text-zinc-400">Z1–Z2</span>
                    </div>
                  </div>
                  {/* ⚠️ `min-w-0` — SANS LUI, LES MINUTES SORTENT DE LA CARTE. Un élément
                      flex a `min-width: auto` par défaut : il refuse de descendre sous la
                      largeur de son contenu, donc `truncate` sur le libellé ne sert à rien
                      et c'est la colonne entière qui déborde. Mesuré : 45 px hors de la
                      carte dès qu'elle descend à 276 px de large — la valeur « 1014 min »
                      s'affichait « 1014 m », coupée net par le bord.
                      La valeur porte `flex-shrink-0` : c'est le LIBELLÉ qui doit céder,
                      jamais le chiffre. « Récupé… 1014 min » se lit ; « Récupération 10 »
                      ne veut rien dire. */}
                  <div className="min-w-0 flex-1 space-y-1.5 text-[13px]">
                    {segs.map((sg, i) => sg.min > 0 && (
                      <div key={i} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: sg.color }} />
                        <span className="min-w-0 flex-1 truncate text-zinc-500">{zl.z[i]}</span>
                        <span className="flex-shrink-0 font-semibold tabular-nums text-zinc-900">{sg.min}<span className="ml-0.5 text-[11px] font-normal text-zinc-400">{zl.min}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Sur quoi ce graphe est calculé, écrit noir sur blanc. Un verdict
                    « Trop d'intensité » qui n'annonce pas son échantillon n'est pas
                    vérifiable — et celui-ci s'appuyait jusqu'ici sur des randonnées. */}
                <div className="mt-2.5 text-[11px] text-zinc-400">
                  {t(hrZones.seances > 1 ? "dash.zones.basis" : "dash.zones.basis1", { n: hrZones.seances })}
                </div>
                <div className="mt-2 border-t border-zinc-100 pt-2.5 text-xs font-semibold" style={{ color: good ? "#059669" : "#EA580C" }}>
                  {good ? t("dash.intensity.polarized") : easyPct < 75 ? t("dash.intensity.tooHard") : t("dash.intensity.tooEasy")}
                </div>
              </>
            );
          })() : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50"><Flame className="h-[18px] w-[18px] text-zinc-400" strokeWidth={1.5} /></div>
              <p className="max-w-[200px] text-xs text-zinc-400">{t("dash.intensity.empty")}</p>
            </div>
          )}
        </motion.div>

        {/* ⚠️ LA CARTE LIGUE A ÉTÉ RETIRÉE (07/11/2026, Cyprien : « Retire-la »). Elle répétait
            les trois composantes et le total de la carte Score discipline du rail, sous un
            niveau « Bronze » identique pour tous : en base, une seule ligue (juin 2026) et tous
            les profils en bronze — rien ne fait monter de palier. Volume et Zones se partagent
            désormais la rangée, moitié-moitié, sans trou. Le classement reste dans le
            menu de gauche (Ligues) ; la carte Badges qui y menait a été retirée le 09/11/2026. */}
      </div>
      </div>

      {/* ── Rail de droite ── */}
      {/* ⚠️ `lg:sticky` — SANS LUI, LE RAIL LAISSAIT UN TROU BLANC. Il mesure 1371 px
          quand la colonne principale en fait 2619 : une fois ses cartes passées, la
          moitié droite de l'écran restait vide sur 1248 px de défilement. Rendu
          collant, il accompagne la lecture au lieu de s'arrêter. La hauteur est
          bornée à la fenêtre et il défile alors sur lui-même : c'est la seule forme
          qui ne peut PAS recréer de vide, quel que soit le nombre de cartes — or
          plusieurs d'entre elles sont conditionnelles.
          PAS de `overscroll-contain` : le défilement doit se propager à la page une
          fois le bas du rail atteint, sinon la molette se bloque dans le rail. */}
      <aside className="mt-4 space-y-4 lg:sticky lg:top-6 lg:mt-0 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
        {/* ORDRE DU RAIL, du plus utile au moins utile (07/11/2026, Cyprien : « du plus important
            au moins ») : ce que le coach dit de la dernière séance, le bilan chiffré de la
            semaine, la discipline, les records, puis le bilan Premium, les badges et la
            communauté, qui motivent sans rien dire de l'entraînement du jour. */}
        {/* ⚠️ « ANALYSE IA » N'EST PLUS LE POURQUOI DE LA SÉANCE DU JOUR (06/11/2026). L'ancienne
            carte le recopiait mot pour mot (« Pourquoi cette séance ? », carte verte voisine),
            sous un badge « Beta » écrit en dur. Elle montre l'ANALYSE de la dernière séance
            courue — mémorisée, jamais déclenchée d'ici : chaque analyse se paie. */}
        {analyse && (
          <div className="group relative bento-card">
            <div className="metric-label">{al.titre}</div>
            <VersPage href={lienSeance(analyse.seance)} titre={al.titre} lang={lang} />
            <div className="mt-1 text-[11px] text-zinc-400">
              {al.seance} · {formatDateCivile(String(analyse.seance.date).slice(0, 10), lang, { day: "numeric", month: "long" })}
              {Number(analyse.seance.distance_km) > 0 && <> · {(Math.round(Number(analyse.seance.distance_km) * 10) / 10).toLocaleString(lang)} km</>}
            </div>
            {analyse.texte ? (
              <p className="mt-2.5 line-clamp-6 text-sm leading-relaxed text-zinc-600">{analyse.texte}</p>
            ) : (
              <p className="mt-2.5 text-sm leading-relaxed text-zinc-500">{al.pasEncore}</p>
            )}
            <Link href={lienSeance(analyse.seance)} className="relative z-[3] mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#059669] transition-colors hover:text-[#047857]">
              {analyse.texte ? al.lire : al.analyser} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* ⚠️ PLUS DE CARTE « Cette semaine » (audit du 09/11/2026). Même fenêtre de sept jours que
            « Activité 7 jours » (`computeWeekSummary`) : le même total s'affichait QUATRE fois (en-tête,
            Activité 7 jours, Cette semaine, Volume). Séances et durée sont passées dans « Activité 7 jours ». */}

        {/* ⚠️ CETTE CARTE S'APPELAIT « Statut de préparation » ET AFFICHAIT « 90 % ».
            Or `computeReadiness` ne produit AUCUN pourcentage — seulement une couleur et
            une phrase. Le nombre dans l'anneau est `disc.total`, le Score Discipline :
            le même 90 que la carte Ligue annonce sous le nom « Score hebdo ». Deux noms
            différents pour un seul chiffre, sur un seul écran, dont un qui n'existe pas.
            La carte porte désormais le nom de ce qu'elle montre. */}
        <div className="group relative bento-card">
          <div className="metric-label">{t("dash.discipline.title")}</div>
            <VersFiche cle="discipline" titre={t("dash.discipline.title")} lang={lang} />
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-20 w-20 flex-shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#F4F4F5" strokeWidth="9" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={readiness.accent} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(2 * Math.PI * 42 * (disc.hasData ? disc.total : 0)) / 100} ${2 * Math.PI * 42}`}
                  className="transition-[stroke-dasharray] duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums text-zinc-900">
                {disc.hasData ? disc.total : "—"}<span className="text-xs text-zinc-400">%</span>
              </div>
            </div>
            {/* ⚠️ LES TROIS COMPOSANTES, PLUS LA PHRASE DE L'EN-TÊTE (06/11/2026). La carte
                répétait mot pour mot « Récupération après Marathon… » du haut de page, et rien
                n'y expliquait le pourcentage. Elle dit maintenant d'où il vient ; « — » =
                aucune mesure récente, composante écartée du total (pas un zéro). */}
            <div className="min-w-0 flex-1 space-y-1.5">
              {([
                ["dash.discipline.precision", disc.precision],
                ["dash.discipline.consistency", disc.consistency],
                ["dash.discipline.recovery", disc.recovery],
              ] as const).map(([cle, valeur]) => (
                <div key={cle} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-zinc-500">{t(cle)}</span>
                  <span className="flex-shrink-0 font-semibold tabular-nums text-zinc-900">{valeur == null ? "—" : `${valeur} %`}</span>
                </div>
              ))}
            </div>
          </div>
          {disc.hasData && (disc.precision == null || disc.consistency == null || disc.recovery == null) && (
            <p className="mt-2 text-[11px] leading-snug text-zinc-400">{t("dash.discipline.absent")}</p>
          )}
          {/* Les conseils de CE score, dans sa page détaillée — le bouton ouvrait le Kiné IA
              (Santé), sans rapport avec lui, alors que le reste de la carte mène déjà ici. */}
          <Link href="/dashboard/indicateurs/discipline#conseils" className="relative z-[3] mt-4 flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50">
            {rl.recommend} <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          </Link>
        </div>

        {/* ⚠️ PLUS DE CARTE « Objectif principal » ICI (06/11/2026). Elle répétait, mot pour
            mot, ce que l'en-tête (J-43, course, date, préparation) et la carte Objectif
            (chrono, allure, Modifier) affichent déjà : le même objectif trois fois sur la
            page. Son seul apport — la page détaillée — est dans la carte Objectif. */}

        {/* Records personnels — meilleurs temps réels par distance */}
        {/* Toujours affichée : même sans record mesuré, on peut y DÉCLARER celui d'avant Pacevo. */}
        {(
          <div className="bento-card">
            <div className="metric-label">{rl.records}</div>
            <div className="mt-3 space-y-2.5">
              {distancePRs.map((pr) => (
                <div key={pr.label} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-500">{pr.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums text-zinc-900">{pr.time}</span>
                    <span className="hidden text-[11px] tabular-nums text-zinc-400 sm:inline" title={pr.course ?? undefined}>{pr.date}</span>
                    {/* « Déclaré » : saisi par l'athlète, pas mesuré — on ne le fait jamais
                        passer pour une donnée de montre. */}
                    {pr.source === "declare" ? (
                      <button type="button" onClick={() => retirerRecord(pr.cle)} disabled={retrait === pr.cle}
                        title={t("dash.rec.retirer")}
                        className="rounded px-1 text-[11px] text-zinc-500 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-900 disabled:opacity-50">
                        {t("dash.rec.declare")}
                      </button>
                    ) : (
                      <span className="w-6 text-right text-[11px] text-zinc-400">{ABREV_RECORD[lang] ?? "RP"}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {/* ⚠️ « RECORD PERSONNEL » SOUS-ENTEND « DE TOUJOURS ». Cyprien, 23/09/2026 :
                « mon record au semi est de 1h15 » — l'app affichait 1h19. Elle ne se
                trompait pas de calcul : la séance la plus ancienne de sa base date du
                03/07/2025, et son semi de 2024 n'y est pas. Un record calculé sur un
                historique partiel n'est pas faux, il est INCOMPLET — et le dire est la
                seule façon de ne pas contredire l'athlète sur sa propre histoire. */}
            {premiereSeance && (
              <p className="mt-3 border-t border-zinc-100 pt-2.5 text-[11px] leading-snug text-zinc-400">
                {t("dash.rec.depuis", { d: formatDateCivile(String(premiereSeance).slice(0, 10), lang, { month: "long", year: "numeric" }) })}
              </p>
            )}
            {jourAujourdhui && <AjoutRecord aujourdhui={jourAujourdhui} />}
          </div>
        )}
        {/* Bilan de la semaine (Premium) : plusieurs séances lues ensemble. Starter voit la carte verrouillée. */}
        <BilanSemaine ouvert={!!acces && peut(acces.etat, "bilan")} />

        {/* ⚠️ LES CARTES « BADGES » ET « COMMUNAUTÉ » ONT ÉTÉ RETIRÉES (09/11/2026, Cyprien :
            « enlève les 2 modules »). Les dossards 10K/21K/42K ne disaient rien de
            l'entraînement, et « Communauté » n'affichait que « Pacevo — Rejoins les coureurs
            Pacevo ». Ligues et Communauté restent dans le menu de gauche. */}
      </aside>
      </div>
    </div>
  );
}

// ── Séance-clé du jour : heuristique coach (VFC, sommeil, dernières séances, volume, course) ──
type KeyTag = { l: string; c: string };
type KeySession = { title: string; subtitle: string; accent: string; tags: KeyTag[]; why: string };

function recommendSession({ state, weeklyKm, workouts, sleep, raceDate, jour, t, recuperation = false, mesureFraiche = false }: {
  state: string; weeklyKm: number; workouts: Workout[];
  sleep?: { sleep_score: number } | null; raceDate: string | null;
  /** Jour civil de l'athlète : le week-end et le compte à rebours ne dépendent pas de la machine. */
  jour: string; t: TFn;
  /** Récupération d'après-course en cours (le coach) : aucune intensité, aucune sortie longue. */
  recuperation?: boolean;
  /** La VFC du jour est-elle FRAÎCHE ? Sans elle, `state` vaut « optimal » PAR DÉFAUT. */
  mesureFraiche?: boolean;
}): KeySession {
  const Z1 = "bg-sky-100 text-sky-700", Z2 = "bg-green-100 text-green-700",
    Z4 = "bg-orange-100 text-orange-700", NEU = "bg-zinc-100 text-zinc-600", RED = "bg-red-100 text-red-700";
  const ss = sleep?.sleep_score ?? null;
  const last = workouts[0];
  const daysSinceLast = last ? ageJours(last.date, jour) ?? 99 : 99;
  const lastHard = !!last && /interval|vma|tempo|race|hill|seuil/i.test(String(last.type ?? ""));
  const lastLong = !!last && (last.distance_km ?? 0) >= 18;
  const dow = new Date(`${jour}T12:00:00Z`).getUTCDay();
  const daysToRace = raceDate ? avancementObjectif({ raceDate }, jour)?.joursRestants ?? null : null;
  const tired = state === "recovery" || (ss != null && ss < 55);

  if (tired) return {
    title: t("dash.rec.tired.title"), accent: "#0284C7", subtitle: t("dash.rec.tired.sub"),
    tags: [{ l: "Z1", c: Z1 }, { l: "30–40 min", c: NEU }],
    why: ss != null && ss < 55 ? t("dash.rec.tired.whySleep", { score: ss })
      : t("dash.rec.tired.whyHrv"),
  };
  if (daysToRace != null && daysToRace >= 0 && daysToRace <= 10) return {
    title: t("dash.rec.taper.title"), accent: "#0284C7", subtitle: t("dash.rec.taper.sub", { days: daysToRace }),
    tags: [{ l: "Z2", c: Z2 }, { l: t("dash.tag.short"), c: NEU }, { l: `J-${daysToRace}`, c: Z1 }],
    why: t("dash.rec.taper.why"),
  };
  // ⚠️ LE REPLI NE PROPOSE PLUS D'INTENSITÉ À L'AVEUGLE (06/11/2026). Quand le coach n'a
  // rien publié, cette séance s'affiche. Or `state` vaut « optimal » PAR DÉFAUT sans VFC
  // fraîche : un nouvel inscrit sans aucune donnée recevait « Séries courtes 10 × 400 m »,
  // un coureur en récupération d'après-marathon aussi. Sans mesure fraîche, sans séance
  // connue ou en récupération : le footing de base.
  const base: KeySession = {
    title: t("dash.rec.base.title"), accent: "#059669", subtitle: t("dash.rec.base.sub"),
    tags: [{ l: "Z2", c: Z2 }, { l: "50 min", c: NEU }],
    why: t("dash.rec.base.why"),
  };
  if (recuperation || !last) return base;
  if ((lastHard || lastLong) && daysSinceLast <= 1) return {
    title: t("dash.rec.assim.title"), accent: "#059669", subtitle: t("dash.rec.assim.sub"),
    tags: [{ l: "Z2", c: Z2 }, { l: "45–60 min", c: NEU }],
    why: t("dash.rec.assim.why"),
  };
  // Sortie longue du week-end : proportionnée au volume RÉEL (12 km d'office pour un
  // coureur à 10 km par semaine, c'était plus que sa semaine entière).
  if ((dow === 0 || dow === 6) && weeklyKm >= 15) {
    const target = Math.max(8, Math.round(weeklyKm * 0.4));
    return {
      title: t("dash.rec.long.title"), accent: "#059669", subtitle: t("dash.rec.long.sub", { km: target }),
      tags: [{ l: "Z2", c: Z2 }, { l: `${target} km`, c: NEU }],
      why: t("dash.rec.long.why"),
    };
  }
  if (!mesureFraiche) return base;
  if (state === "competition") return {
    title: t("dash.rec.thr.title"), accent: "#EA580C", subtitle: t("dash.rec.thr.sub"),
    tags: [{ l: "Z4", c: Z4 }, { l: "~10 km", c: NEU }, { l: t("dash.tag.quality"), c: RED }],
    why: t("dash.rec.thr.why"),
  };
  if (state === "optimal") return {
    title: t("dash.rec.vma.title"), accent: "#EA580C", subtitle: t("dash.rec.vma.sub"),
    tags: [{ l: "Z4-Z5", c: Z4 }, { l: "VMA", c: RED }, { l: "~8 km", c: NEU }],
    why: t("dash.rec.vma.why"),
  };
  return base;
}

// ── Conversion de la séance IA (tags texte) en séance affichable (tags colorés) ──
function colorizeTag(label: string): string {
  const t = label.toLowerCase();
  if (/z1|récup|recup|repos|marche/.test(t)) return "bg-sky-100 text-sky-700";
  if (/z4|z5|vma|seuil|fractionn|interval|tempo|vif|sprint|côte|cote|fartlek/.test(t)) return "bg-orange-100 text-orange-700";
  if (/z2|z3|endurance|footing|longue|facile|fond/.test(t)) return "bg-green-100 text-green-700";
  return "bg-zinc-100 text-zinc-600";
}
function aiToSession(s: { title: string; subtitle: string; tags: string[]; why: string }): KeySession {
  const tags = (s.tags ?? []).filter(Boolean).map((l) => ({ l, c: colorizeTag(l) }));
  const accent = tags.some((t) => t.c.includes("orange")) ? "#EA580C"
    : tags.some((t) => t.c.includes("sky")) ? "#0284C7" : "#059669";
  return { title: s.title, subtitle: s.subtitle, accent, tags, why: s.why };
}

// ── Métriques réellement disponibles de la dernière séance (jamais de "--" vide) ──
function buildLastMetrics(w: Workout, t: TFn, lang: string): { label: string; value: string | number; unit: string }[] {
  const out: { label: string; value: string | number; unit: string }[] = [];
  // ⚠️ UNE MESURE, C'EST UN NOMBRE POSITIF (crash-test du rendu, 07/11/2026). Une durée
  // négative s'affichait « -278h-47 », une FC à 0 « 0 bpm » : un capteur muet n'est pas
  // une mesure. Ce qui n'est pas mesuré n'est pas affiché.
  const mesure = (v: unknown): number | null => { const n = Number(v); return v != null && Number.isFinite(n) && n > 0 ? n : null; };
  const ent = (v: number) => Math.round(v);
  const km = mesure(w.distance_km), sec = mesure(w.duration_seconds);
  if (km != null) out.push({ label: t("dash.metric.distance"), value: km.toLocaleString(lang, { minimumFractionDigits: km >= 100 ? 0 : 1, maximumFractionDigits: km >= 100 ? 0 : 1 }), unit: "km" });
  // Moins d'une heure : « 45 min », pas « 0h45 ».
  if (sec != null) {
    const min = Math.round(sec / 60);
    out.push(min < 60
      ? { label: t("dash.metric.duration"), value: min, unit: "min" }
      : { label: t("dash.metric.duration"), value: `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`, unit: "" });
  }
  // L'ALLURE N'A DE SENS QU'À PIED (06/11/2026) : à vélo, 30 km/h s'affichaient « 2'00/km ».
  // Arrondie en SECONDES entières d'abord : 4,9999 min/km donnait « 4'60 ».
  if (km != null && sec != null && isRun(w.sport)) {
    const s = Math.round(sec / km);
    if (s > 0 && s < 30 * 60) out.push({ label: t("dash.metric.pace"), value: `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}`, unit: "/km" });
  }
  // Arrondis : la base peut porter des décimales (« 172.4 spm », « 35.6 m »).
  const fc = mesure(w.avg_hr), cad = mesure(w.avg_cadence_spm), d = Number(w.elevation_gain_m);
  if (fc != null && fc < 260) out.push({ label: t("dash.metric.avgHr"), value: ent(fc), unit: "bpm" });
  if (cad != null && cad < 260) out.push({ label: t("dash.metric.cadence"), value: ent(cad), unit: "spm" });
  // Le dénivelé peut valoir 0 (piste, route plate) : c'est une mesure ; négatif, non.
  if (w.elevation_gain_m != null && Number.isFinite(d) && d >= 0) out.push({ label: t("dash.metric.elevation"), value: ent(d).toLocaleString(lang), unit: "m" });
  const osc = mesure(w.vertical_oscillation_cm);
  if (osc != null) out.push({ label: t("dash.metric.oscillation"), value: osc.toLocaleString(lang, { maximumFractionDigits: 1 }), unit: "cm" });
  const gct = mesure(w.ground_contact_time_ms ?? w.ground_contact_ms);
  if (gct != null) out.push({ label: t("dash.metric.groundContact"), value: ent(gct), unit: "ms" });
  const pw = mesure(w.avg_power_watts);
  if (pw != null) out.push({ label: t("dash.metric.power"), value: ent(pw), unit: "W" });
  return out.slice(0, 8);
}

// ── Score de forme — 4 axes, tous dérivés de données réelles ─────────────────────
//  Endurance = base aérobie (plus longue sortie réf 30 km + volume hebdo réf 50 km/sem
//  sur 6 sem.) · Vitesse = VMA estimée placée sur une échelle 8→20 km/h · Récupération
//  & Régularité reprises du modèle discipline (sommeil/VFC, assiduité). total = moyenne
//  des 4 axes → l'anneau colle toujours aux barres affichées.

// ── Zones d'entraînement (FC) — temps par zone sur 6 sem. ────────────────────────
//  Chaque séance (avec FC moyenne) est rangée dans une zone selon FCmoy/FCmax, et sa
//  durée y est ajoutée. Estimation honnête (intra-séance non détaillée) → libellé sobre.

// ── Score Discipline — modèle cohérent, documenté et ajustable ───────────────────
//  Principes reconnus : répartition polarisée 80/20 (Seiler / « 80/20 Running »)
//  pour la Précision · régularité hebdo pour l'Assiduité · sommeil + tendance VFC
//  (RMSSD vs base) pour la Récupération. total = somme pondérée → l'anneau colle
//  TOUJOURS aux 3 barres. Toutes les constantes sont regroupées ici pour être
//  ajustées sans toucher à la logique.

// État du jour — lecture honnête de la forme (VFC vs base 14 j + sommeil RÉCENT), dite
// SANS contredire le plan : la phrase vient de `phraseDuJour` (lib/dashboard/discipline).
function computeReadiness(hrvDelta: number | null, hrvBaseline: number | null, sleepScore: number | null, t: TFn, lang: string, plan: PlanDuCoach, montreReliee = false) {
  const e = etatDuJour(hrvDelta, hrvBaseline, sleepScore);
  const { cle, recuperation } = phraseDuJour(e, plan);
  // ⚠️ « Connecte ta montre » à un athlète dont la montre EST reliée : elle n'a simplement
  // rien envoyé de récent (VFC, sommeil). On dit ce qui se passe, pas une consigne fausse.
  const phrase = recuperation
    ? t(cle, { course: recuperation.course, date: formatDateCivile(recuperation.reprise, lang, { day: "numeric", month: "long" }) })
    : t(cle === "dash.ready.none" && montreReliee ? "dash.ready.muette" : cle);
  // ⚠️ LA PASTILLE EST GRISE QUAND RIEN N'EST MESURÉ (09/11/2026). Elle restait colorée
  // (vert-bleu, la teinte de « correct ») à côté de « pas de lecture de ta forme du jour » :
  // un voyant allumé pour un état qui n'existe pas. `accent` ne change pas (anneaux, courbes).
  const pastille = e === "aucun" ? "#d4d4d8" : null;
  if (e === "top") return { accent: "#059669", pastille: pastille ?? "#059669", tagline: phrase, cle };
  if (e === "repos") return { accent: "#0284C7", pastille: pastille ?? "#0284C7", tagline: phrase, cle };
  return { accent: "#0d9488", pastille: pastille ?? "#0d9488", tagline: phrase, cle };
}




// Tendance du volume : N blocs glissants de 7 jours (du plus ancien au plus récent).
// ⚠️ CE GRAPHE CONTREDISAIT LE GROS CHIFFRE DE SA PROPRE CARTE.
//    En alignant « Volume semaine » sur les jours de calendrier, j'avais laissé ces
//    barres en fenêtres glissantes de 168 heures : la carte annonçait 37,5 km en grand
//    et sa dernière barre en valait 47,7 — 10,2 km d'écart, côte à côte, pour la même
//    semaine. Une seule définition du jour, ici comme ailleurs : `lib/dashboard/fenetre`.

// Meilleures sorties récentes (sur l'historique chargé — honnête, pas « all-time »).
function computeRecords(workouts: Workout[]): { longest: number; maxElev: number; longestSec: number; bestPace: number | null; depuis: string } | null {
  // ⚠️ CETTE VARIABLE S'APPELAIT DÉJÀ `runs` MAIS NE FILTRAIT AUCUN SPORT — seulement
  //    la distance. Sur ce compte (69 sorties vélo et 23 randonnées sur 330), le
  //    « dénivelé max » affiché était 1267 m, mesuré lors d'une RANDONNÉE, sur une carte
  //    qui parle de tes meilleures SORTIES DE COURSE. La meilleure allure était tout
  //    aussi exposée : un tour de vélo bat n'importe quelle foulée, toujours.
  const runs = workouts.filter(w => isRun(w.sport) && (w.distance_km ?? 0) > 0);
  if (!runs.length) return null;
  const longest = Math.max(...runs.map(w => w.distance_km ?? 0));
  const maxElev = Math.max(0, ...runs.map(w => w.elevation_gain_m ?? 0));
  const longestSec = Math.max(0, ...runs.map(w => w.duration_seconds ?? 0));
  const paces = runs
    .filter(w => (w.distance_km ?? 0) >= 3 && (w.duration_seconds ?? 0) > 0)
    .map(w => (w.duration_seconds as number) / (w.distance_km as number)); // sec/km
  const bestPace = paces.length ? Math.min(...paces) : null;
  // La plus ancienne séance prise en compte : le début RÉEL de la fenêtre affichée.
  const depuis = runs.map(w => String(w.date).slice(0, 10)).sort()[0];
  return { longest, maxElev, longestSec, bestPace, depuis };
}


// Résumé de la semaine en cours (7 derniers jours).
function computeWeekSummary(workouts: Workout[], jour: string): { sessions: number; km: number; elev: number; sec: number } {
  const wk = workouts.filter(w => isRun(w.sport) && dansFenetre(w.date, 7, jour));
  // ⚠️ `?? 0` NE RATTRAPE PAS `NaN`. Il ne voit que `null` et `undefined` : une seule
  // valeur non numérique dans la colonne, et la somme entière devient NaN — le total
  // hebdomadaire s'affiche alors « NaN km » et la durée « NaN:NaN », sur la première
  // carte que voit l'athlète. La base est saine aujourd'hui (vérifié), mais le coût
  // d'une garde est nul et celui de l'affichage ne l'est pas.
  const nombre = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
  return {
    sessions: wk.length,
    km: wk.reduce((s, w) => s + nombre(w.distance_km), 0),
    elev: wk.reduce((s, w) => s + nombre(w.elevation_gain_m), 0),
    sec: wk.reduce((s, w) => s + nombre(w.duration_seconds), 0),
  };
}

// Intitulé de section — repère éditorial entre les rangées du bento.
/**
 * CHAQUE CARTE OUVRE SA PAGE DÉTAILLÉE (04/10/2026) — Cyprien : « quand on clique sur ces
 * modules, une page qui donne les valeurs précises et qui explique pourquoi ».
 * Un lien couvre toute la carte (le doigt n'a pas à viser un bouton) ; les liens déjà
 * présents dans une carte passent au-dessus (`z-[3]`).
 *
 * ⚠️ PLUS DE PASTILLE « Détails » FLOTTANTE (05/11/2026). Posée en bas à droite au survol,
 * elle recouvrait ce que la carte affiche à cet endroit — mesuré pastille forcée visible :
 * « Voir les recommandations », l'allure du marathon (Vitesse & prédictions), « Objectif :
 * 113 km » (Volume), le titre de la carte Assiduité, le texte d'Analyse IA. Aucun coin n'est
 * libre sur toutes les cartes. Le survol se signale donc par un liseré sur le BORD de la
 * carte (qui ne couvre rien) et par l'infobulle « Détails ».
 */
const DETAIL_LIBELLE: Record<string, string> = { fr: "Détails", en: "Details", de: "Details", es: "Detalles", pt: "Detalhes" };
function VersPage({ href, titre, lang }: { href: string; titre: string; lang: string }) {
  const l = DETAIL_LIBELLE[lang] ?? DETAIL_LIBELLE.fr;
  return (
    <Link href={href} aria-label={`${titre} — ${l}`} title={l}
      className="absolute inset-0 z-[1] rounded-2xl ring-zinc-300 transition-shadow duration-150 group-hover:ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2" />
  );
}
function VersFiche({ cle, titre, lang }: { cle: CleIndicateur; titre: string; lang: string }) {
  return <VersPage href={`/dashboard/indicateurs/${cle}`} titre={titre} lang={lang} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-12 flex items-center gap-3 pt-4 first:pt-0">
      <span className="text-[15px] font-semibold text-zinc-900">{children}</span>
      <span className="h-px flex-1 bg-zinc-200/80" />
    </div>
  );
}
