"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity, Heart, Trophy, Target,
  Calendar, Footprints, Moon, ChevronRight,
  Gauge, Mountain, Timer, Flame, Rocket, Award, TrendingUp, AlertTriangle, Shield, Users,
  type LucideIcon,
} from "lucide-react";
import {
  BarChart, Bar, Cell, AreaChart, Area,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid
} from "recharts";
import Link from "next/link";
import type { UserProfile, HRVData, Workout } from "@/types";
import { racePredictions, fmtPaceSec, fmtTime } from "@/lib/running/fitness";
import { TaperingWidget } from "@/components/dashboard/TaperingWidget";
import { WeatherChip } from "@/components/dashboard/WeatherChip";
import { SessionFeedback } from "@/components/dashboard/SessionFeedback";
import { ObjectiveCard, type Objective } from "@/components/dashboard/ObjectiveCard";
import { cleanActivityName } from "@/lib/utils/activityName";
import { isRun } from "@/lib/intervals/sport";
import { useT } from "@/lib/i18n/LanguageProvider";
import { ProfileCompletionBanner } from "@/components/dashboard/ProfileCompletionBanner";

// Fonction de traduction (avec interpolation {clé}) passée aux helpers.
type TFn = (k: string, params?: Record<string, string | number>) => string;

interface Props {
  profile: UserProfile | null;
  hrv: HRVData[];
  workouts: Workout[];
  plan: Record<string, unknown> | null;
  league: Record<string, unknown> | null;
  disciplineHistory: Record<string, unknown>[];
  sleep?: { total_sleep_min: number; sleep_score: number; body_battery_end: number; deep_sleep_min: number; rem_sleep_min: number; date: string } | null;
  /** `i18n` = le même jour dans les autres langues (cf. lib/ai/planI18n.ts). Le français
   *  reste au premier niveau : c'est lui qui part sur la montre et sert aux analyses. */
  coachSession?: { title: string; subtitle: string; tags: string[]; why: string; i18n?: Record<string, { title?: string; subtitle?: string; tags?: string[]; why?: string }> } | null;
  pendingFeedback?: { date: string; title: string } | null;
  objective?: Objective | null;
  currentVma?: number | null;
  loadRisk?: { acwr: number; monotony: number; deload: boolean; level: string; reason: string };
  newMembersWeek?: number;
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
const HERO_LABELS: Record<string, { goal: string; plan: string; prep: string }> = {
  fr: { goal: "Objectif", plan: "Voir mon plan", prep: "préparation" },
  en: { goal: "Goal", plan: "View my plan", prep: "readiness" },
  de: { goal: "Ziel", plan: "Mein Plan ansehen", prep: "Bereitschaft" },
  es: { goal: "Objetivo", plan: "Ver mi plan", prep: "preparación" },
  pt: { goal: "Objetivo", plan: "Ver o meu plano", prep: "preparação" },
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
  fr: { hr: "Fréquence cardiaque" }, en: { hr: "Heart rate" }, de: { hr: "Herzfrequenz" }, es: { hr: "Frecuencia cardíaca" }, pt: { hr: "Frequência cardíaca" },
};

// Niveau du coureur (depuis profile.mode), multilingue.
const LEVELS: Record<string, { elite: string; inter: string }> = {
  fr: { elite: "Niveau Élite", inter: "Niveau Intermédiaire" },
  en: { elite: "Elite level", inter: "Intermediate level" },
  de: { elite: "Elite-Niveau", inter: "Mittleres Niveau" },
  es: { elite: "Nivel Élite", inter: "Nivel intermedio" },
  pt: { elite: "Nível Elite", inter: "Nível intermédio" },
};

// Libellés du rail de droite (multilingue).
const RAIL_LABELS: Record<string, { prep: string; goal: string; ai: string; ready: string; badges: string; community: string; communitySub: string; see: string; newWeek: string; records: string; recommend: string; progress: string }> = {
  fr: { prep: "Statut de préparation", goal: "Objectif principal", ai: "Analyse IA", ready: "Prêt à performer", badges: "Badges", community: "Communauté", communitySub: "Rejoins les coureurs Pacevo", see: "Voir", newWeek: "nouveaux cette semaine", records: "Records personnels", recommend: "Voir les recommandations", progress: "Préparation" },
  en: { prep: "Readiness status", goal: "Main goal", ai: "AI analysis", ready: "Ready to perform", badges: "Badges", community: "Community", communitySub: "Join the Pacevo runners", see: "View", newWeek: "new this week", records: "Personal records", recommend: "View recommendations", progress: "Preparation" },
  de: { prep: "Bereitschaftsstatus", goal: "Hauptziel", ai: "KI-Analyse", ready: "Bereit zu performen", badges: "Abzeichen", community: "Community", communitySub: "Triff die Pacevo-Läufer", see: "Ansehen", newWeek: "neue diese Woche", records: "Persönliche Rekorde", recommend: "Empfehlungen ansehen", progress: "Vorbereitung" },
  es: { prep: "Estado de preparación", goal: "Objetivo principal", ai: "Análisis IA", ready: "Listo para rendir", badges: "Insignias", community: "Comunidad", communitySub: "Únete a los corredores Pacevo", see: "Ver", newWeek: "nuevos esta semana", records: "Records personales", recommend: "Ver recomendaciones", progress: "Preparación" },
  pt: { prep: "Estado de preparação", goal: "Objetivo principal", ai: "Análise IA", ready: "Pronto para performar", badges: "Medalhas", community: "Comunidade", communitySub: "Junta-te aos corredores Pacevo", see: "Ver", newWeek: "novos esta semana", records: "Recordes pessoais", recommend: "Ver recomendações", progress: "Preparação" },
};

// Score de forme — 4 axes calculés du réel (endurance & vitesse dérivées des séances/VMA,
// récup & régularité reprises du modèle discipline). Couleurs par axe comme la maquette.
const FORME_LABELS: Record<string, { title: string; endurance: string; speed: string; recovery: string; regularity: string; of: string; rate: (n: number) => string }> = {
  fr: { title: "Score de forme", endurance: "Endurance", speed: "Vitesse", recovery: "Récupération", regularity: "Régularité", of: "/ 100", rate: (n) => (n >= 80 ? "Excellent" : n >= 60 ? "Bonne forme" : n >= 40 ? "Correct" : "À développer") },
  en: { title: "Fitness score", endurance: "Endurance", speed: "Speed", recovery: "Recovery", regularity: "Consistency", of: "/ 100", rate: (n) => (n >= 80 ? "Excellent" : n >= 60 ? "Good shape" : n >= 40 ? "Fair" : "Building up") },
  de: { title: "Fitness-Score", endurance: "Ausdauer", speed: "Tempo", recovery: "Erholung", regularity: "Regelmäßigkeit", of: "/ 100", rate: (n) => (n >= 80 ? "Exzellent" : n >= 60 ? "Gute Form" : n >= 40 ? "Solide" : "Im Aufbau") },
  es: { title: "Puntuación de forma", endurance: "Resistencia", speed: "Velocidad", recovery: "Recuperación", regularity: "Regularidad", of: "/ 100", rate: (n) => (n >= 80 ? "Excelente" : n >= 60 ? "Buena forma" : n >= 40 ? "Correcto" : "En progreso") },
  pt: { title: "Pontuação de forma", endurance: "Resistência", speed: "Velocidade", recovery: "Recuperação", regularity: "Regularidade", of: "/ 100", rate: (n) => (n >= 80 ? "Excelente" : n >= 60 ? "Boa forma" : n >= 40 ? "Correto" : "Em progresso") },
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

export function BentoDashboard({ profile, hrv, workouts, plan, league, disciplineHistory, sleep, coachSession, pendingFeedback, objective, currentVma, loadRisk, newMembersWeek }: Props) {
  const { t, lang } = useT();
  const state = hrv[0]?.physiological_state ?? "optimal";

  // Sommeil : on n'exploite/affiche que des données RÉCENTES (montre réellement portée).
  const freshSleep = sleep && sleep.date && Date.now() - new Date(sleep.date + "T00:00:00").getTime() <= 2 * 86400000 ? sleep : null;

  // Volume de COURSE : le vélo et la randonnée n'en font pas partie. Sans ce filtre,
  // le tableau de bord affichait 102 km là où le coach en comptait 62 — deux chiffres
  // contradictoires sous les yeux du même athlète, et une séance recommandée calculée
  // sur le mauvais volume.
  const runs = workouts.filter(w => isRun(w.sport));
  const weeklyKm = runs
    .filter(w => {
      const d = new Date(w.date);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    })
    .reduce((sum, w) => sum + (w.distance_km ?? 0), 0);

  const hrvChartData = hrv.slice(0, 14).reverse()
    .filter(h => h.hrv_ms != null)
    .map(h => ({
      date: new Date(h.date).toLocaleDateString(lang, { day: "2-digit", month: "2-digit" }),
      hrv: h.hrv_ms,
    }));

  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayWorkouts = runs.filter(w => new Date(w.date).toDateString() === d.toDateString());
    return {
      day: d.toLocaleDateString(lang, { weekday: "short" }),
      km: dayWorkouts.reduce((s, w) => s + (w.distance_km ?? 0), 0),
      elev: dayWorkouts.reduce((s, w) => s + (w.elevation_gain_m ?? 0), 0),
    };
  });

  // Score Discipline — calculé à partir des vraies données (l'anneau = moyenne
  // pondérée des 3 axes affichés → toujours cohérent, jamais de chiffres factices).
  const disc = computeDiscipline(workouts, hrv, freshSleep, state);

  // VFC : valeur du jour + base 14 j pour situer si elle est « bonne ».
  const hrvLatest = hrv[0]?.hrv_ms ?? null;
  const hrvSeries = hrv.slice(0, 14).map(h => h.hrv_ms).filter((v): v is number => v != null);
  const hrvBaseline = hrvSeries.length ? Math.round(hrvSeries.reduce((a, b) => a + b, 0) / hrvSeries.length) : null;
  const hrvDelta = hrvLatest != null && hrvBaseline != null ? hrvLatest - hrvBaseline : null;

  // État du jour = lecture honnête de la forme (VFC vs base + sommeil récent), pas un label figé.
  const readiness = computeReadiness(hrvDelta, hrvBaseline, freshSleep?.sleep_score ?? null, t);

  const raceDate = (plan as { race_date?: string } | null)?.race_date ?? null;

  // Séance-clé du jour : l'algo s'affiche INSTANTANÉMENT (repli fiable),
  // puis la version IA (Gemini) le remplace dès qu'elle répond (badge ✨).
  const keySession = recommendSession({ state, weeklyKm, workouts, sleep, raceDate, t });
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

  // Dernière séance : on n'affiche que les métriques réellement disponibles (pas de "--" vide).
  const w0 = workouts[0];
  const lastMetrics = w0 ? buildLastMetrics(w0, t) : [];

  // ── Données dérivées (toutes calculées depuis le réel — rien d'inventé) ──────────
  const predictions = currentVma && currentVma > 0 ? racePredictions(currentVma) : null;
  const volumeTrend = computeWeeklyTrend(workouts, 6);
  const trendMax = Math.max(1, ...volumeTrend.map((v) => v.km));
  const prevWeeks = volumeTrend.slice(0, -1);
  const prevAvg = prevWeeks.length ? prevWeeks.reduce((s, v) => s + v.km, 0) / prevWeeks.length : 0;
  const volumeDelta = prevAvg > 0 ? weeklyKm - prevAvg : null;
  const records = computeRecords(workouts);
  const weekSummary = computeWeekSummary(workouts);
  const acwr = loadRisk?.acwr ?? 0;
  // Historique du Score Discipline (8 sem.) — du plus ancien au plus récent.
  const discTrend = disciplineHistory
    .map((h) => Number((h as Record<string, unknown>).total ?? (h as Record<string, unknown>).score ?? 0))
    .filter((n) => n > 0)
    .reverse();
  const coachMinimal = !!coachKey && coachKey.tags.length === 0 && !coachKey.why;

  // ── Cartes de droite : on garde toujours les 2 plus pertinentes (sommeil > séance-clé
  //    > records > résumé semaine > forme) → les colonnes ne sont jamais vides. ─────
  const fillerPool: { key: string; node: React.ReactNode }[] = [];
  if (freshSleep) fillerPool.push({ key: "sleep", node: (
    <div className="bento-card h-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="metric-label">{t("dash.sleep.title")}</div>
        <Moon className="h-4 w-4 text-indigo-400" />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-2xl font-bold text-zinc-900">{Math.floor(freshSleep.total_sleep_min / 60)}h{String(freshSleep.total_sleep_min % 60).padStart(2, "0")}</div>
          <div className="text-xs text-zinc-400">{t("dash.sleep.total")}</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-zinc-900">{freshSleep.sleep_score}/100</div>
          <div className="text-xs text-zinc-400">{t("dash.sleep.score")}</div>
        </div>
      </div>
      {(freshSleep.deep_sleep_min > 0 || freshSleep.rem_sleep_min > 0) && (
        <div className="space-y-1.5">
          {[
            { label: t("dash.sleep.deep"), min: freshSleep.deep_sleep_min, color: "bg-indigo-500" },
            { label: t("dash.sleep.rem"), min: freshSleep.rem_sleep_min, color: "bg-violet-400" },
            { label: t("dash.sleep.light"), min: Math.max(0, freshSleep.total_sleep_min - freshSleep.deep_sleep_min - freshSleep.rem_sleep_min), color: "bg-blue-300" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="w-12 text-zinc-500">{s.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div className={`h-full ${s.color} rounded-full`} style={{ width: `${Math.min(100, (s.min / freshSleep.total_sleep_min) * 100)}%` }} />
              </div>
              <span className="w-10 text-right text-zinc-600">{Math.floor(s.min / 60)}h{String(s.min % 60).padStart(2, "0")}</span>
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
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">{t("dash.key.aiCoach")}</span>
          ) : !aiTried ? (
            <span className="animate-pulse text-[10px] font-semibold text-zinc-300">{t("dash.key.aiLoading")}</span>
          ) : null}
        </div>
        <Calendar className="h-4 w-4 text-zinc-400" />
      </div>
      <div className="text-base font-semibold" style={{ color: displaySession.accent }}>{displaySession.title}</div>
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
      { icon: Footprints, label: t("dash.records.longest"), value: `${records.longest.toFixed(1)} km`, color: "text-emerald-600", bg: "bg-emerald-50" },
      records.bestPace != null ? { icon: TrendingUp, label: t("dash.records.pace"), value: `${fmtPaceSec(records.bestPace)}/km`, color: "text-sky-600", bg: "bg-sky-50" } : null,
      records.maxElev > 0 ? { icon: Mountain, label: t("dash.records.climb"), value: `${Math.round(records.maxElev)} m`, color: "text-orange-600", bg: "bg-orange-50" } : null,
      records.longestSec > 0 ? { icon: Timer, label: t("dash.records.duration"), value: fmtTime(records.longestSec), color: "text-violet-600", bg: "bg-violet-50" } : null,
    ] as ({ icon: LucideIcon; label: string; value: string; color: string; bg: string } | null)[])
      .filter((r): r is { icon: LucideIcon; label: string; value: string; color: string; bg: string } => r !== null)
      .slice(0, 4);
    fillerPool.push({ key: "records", node: (
      <div className="bento-card h-full">
        <div className="mb-1 flex items-center justify-between">
          <div className="metric-label">{t("dash.records.title")}</div>
          <Award className="h-4 w-4 text-amber-400" />
        </div>
        <div className="mb-3 text-[11px] text-zinc-400">{t("dash.records.sub")}</div>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${r.bg}`}><r.icon className={`h-4 w-4 ${r.color}`} /></span>
              <span className="flex-1 text-sm text-zinc-500">{r.label}</span>
              <span className="text-sm font-bold tabular-nums text-zinc-900">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    ) });
  }
  fillerPool.push({ key: "summary", node: (
    <div className="bento-card h-full">
      <div className="mb-4 flex items-center justify-between">
        <div className="metric-label">{t("dash.summary.title")}</div>
        <Activity className="h-4 w-4 text-zinc-300" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {[
          { v: String(weekSummary.sessions), u: "", l: t("dash.summary.sessions") },
          { v: weekSummary.km.toFixed(1), u: "km", l: t("dash.metric.distance") },
          { v: String(Math.round(weekSummary.elev)), u: "m", l: t("dash.metric.elevation") },
          { v: fmtTime(weekSummary.sec), u: "", l: t("dash.metric.duration") },
        ].map((s) => (
          <div key={s.l}>
            <div className="text-2xl font-bold leading-none tabular-nums text-zinc-900">{s.v}<span className="ml-0.5 text-sm font-normal text-zinc-400">{s.u}</span></div>
            <div className="mt-1.5 text-xs text-zinc-500">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  ) });
  fillerPool.push({ key: "ready", node: (
    <div className="bento-card flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="metric-label">{t("dash.readyCard.title")}</div>
        <span className="h-3 w-3 rounded-full" style={{ background: readiness.accent }} />
      </div>
      <p className="text-sm font-medium leading-relaxed text-zinc-700">{readiness.tagline}</p>
      <div className="mt-auto space-y-1.5 pt-4 text-xs">
        {hrvDelta != null && hrvBaseline != null && (
          <div className="flex justify-between"><span className="text-zinc-400">{t("dash.hrv.title")}</span><span className={`font-semibold ${hrvDelta >= 0 ? "text-emerald-600" : "text-amber-600"}`}>{hrvDelta >= 0 ? "↑" : "↓"} {Math.abs(hrvDelta)} ms</span></div>
        )}
        {freshSleep && (
          <div className="flex justify-between"><span className="text-zinc-400">{t("dash.sleep.title")}</span><span className="font-semibold text-zinc-700">{freshSleep.sleep_score}/100</span></div>
        )}
      </div>
    </div>
  ) });
  const fillers = fillerPool.slice(0, 2);

  // Compte à rebours vers la prochaine course (objectif) pour le panneau de l'en-tête.
  const objDaysTo = objective
    ? Math.ceil((new Date(objective.raceDate + "T00:00:00").getTime() - Date.now()) / 86400000)
    : null;

  // Progression de la préparation = part du temps écoulé dans la fenêtre de prépa
  // (départ du plan si connu, sinon build standard de 16 semaines avant la course).
  const planMeta = plan as { start_date?: string; created_at?: string } | null;
  const objStartMs = objective
    ? (planMeta?.start_date ? new Date(planMeta.start_date).getTime()
      : planMeta?.created_at ? new Date(planMeta.created_at).getTime()
      : new Date(objective.raceDate + "T00:00:00").getTime() - 112 * 86400000)
    : 0;
  const objEndMs = objective ? new Date(objective.raceDate + "T00:00:00").getTime() : 0;
  const objProgress = objective && objDaysTo != null && objDaysTo >= 0 && objEndMs > objStartMs
    ? Math.max(0, Math.min(100, Math.round(((Date.now() - objStartMs) / (objEndMs - objStartMs)) * 100)))
    : null;

  // Score de forme — 4 axes réels (endurance + vitesse dérivées des séances/VMA).
  const forme = computeForme(workouts, currentVma ?? 0, disc.recovery, disc.consistency);

  // Zones d'entraînement (FC) — FCmax = test/profil → âge (220−âge) → max observé.
  const profMaxHr = Number((profile as { max_hr?: number } | null)?.max_hr) || 0;
  const profAge = Number((profile as { age?: number } | null)?.age) || 0;
  const obsMaxHr = Math.max(0, ...workouts.map(w => Number(w.max_hr ?? 0)));
  const maxHrRef = profMaxHr || (profAge > 0 ? 220 - profAge : 0) || obsMaxHr;
  const hrZones = computeHrZones(workouts, maxHrRef);

  // KPI de l'en-tête « hero » — résumé exécutif (valeurs réelles, repli « — »).
  const kpi = KPI_LABELS[lang] ?? KPI_LABELS.fr;
  const hl = HERO_LABELS[lang] ?? HERO_LABELS.fr;
  const rl = RAIL_LABELS[lang] ?? RAIL_LABELS.fr;
  const fl = FORME_LABELS[lang] ?? FORME_LABELS.fr;
  const zl = ZONES_LABELS[lang] ?? ZONES_LABELS.fr;
  const lvl = LEVELS[lang] ?? LEVELS.fr;
  const levelLabel = String((profile as { mode?: string } | null)?.mode ?? "") === "elite" ? lvl.elite : lvl.inter;
  const leagueName = String((league as { leagues?: { name?: string } } | null)?.leagues?.name ?? "");
  const nx = NEXT_LABELS[lang] ?? NEXT_LABELS.fr;
  const vit = VITALS[lang] ?? VITALS.fr;
  const restingHr = Number((profile as { resting_hr?: number } | null)?.resting_hr) || Number(workouts[0]?.avg_hr) || 0;
  const distancePRs = computeDistancePRs(workouts, lang);
  const heroStats = [
    { label: kpi.form, value: disc.hasData ? String(disc.total) : "—", unit: disc.hasData ? "/100" : "" },
    { label: kpi.hrv, value: hrvLatest != null ? hrvLatest.toFixed(0) : "—", unit: hrvLatest != null ? "ms" : "" },
    { label: kpi.vma, value: currentVma && currentVma > 0 ? currentVma.toFixed(1) : "—", unit: currentVma && currentVma > 0 ? "km/h" : "" },
    { label: kpi.vol, value: weeklyKm.toFixed(0), unit: "km" },
  ];

  const noData = workouts.length === 0 && hrv.length === 0;

  return (
    <div className="min-h-full bg-gradient-to-b from-zinc-50 to-white">
      {/* Profil incomplet : les comptes antérieurs au questionnaire complet ne repassent
          jamais par l'inscription — on leur dit ce qui manque et ce que ça leur coûte. */}
      <ProfileCompletionBanner profile={profile as unknown as Record<string, unknown> | null} />

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

      {/* Header élite — carte premium (3 zones : salutation · objectif · photo) */}
      <div
        className="relative mb-6 overflow-hidden rounded-3xl border border-[#e3eef0] shadow-[0_12px_44px_-26px_rgba(16,24,40,0.22)]"
        style={{ background: "linear-gradient(120deg,#ecfdf5 0%,#eef6ff 58%,#ffffff 100%)" }}
      >
        {/* Photo de coureur — panneau net à droite, fondu doux vers le dégradé */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[32%] overflow-hidden xl:block">
          <img src="https://images.unsplash.com/photo-1486218119243-13883505764c?w=900&q=75&fit=crop&crop=entropy" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #eef6ff 0%, rgba(238,246,255,0.45) 26%, rgba(238,246,255,0) 64%)" }} />
        </div>
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#0ea5e9]/10 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-10 gap-y-7 px-6 py-7 sm:px-9 sm:py-8 xl:pr-[34%]">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6e8a86] first-letter:uppercase">
              {new Date().toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="mt-2 text-[2rem] font-bold tracking-tight text-[#11201d] sm:text-[2.5rem]">
              {t("dash.greeting")}, {profile?.full_name?.split(" ")[0] ?? t("dash.champion")}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-[#5f7d79]">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: readiness.accent }} />
              {readiness.tagline}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600">
                <Gauge className="h-3.5 w-3.5 text-[#059669]" /> {levelLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600">
                <Activity className="h-3.5 w-3.5 text-[#059669]" /> {weeklyKm.toFixed(0)} km · 7 j
              </span>
              <WeatherChip />
            </div>
          </div>
          {objective && objDaysTo != null && objDaysTo >= 0 ? (
            <div className="flex items-center gap-5">
              <div className="relative h-[92px] w-[92px] flex-shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 92 92">
                  <circle cx="46" cy="46" r="40" fill="none" stroke="#e3eef0" strokeWidth="7" />
                  <circle cx="46" cy="46" r="40" fill="none" stroke="#059669" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={`${(2 * Math.PI * 40 * (objProgress ?? 0)) / 100} ${2 * Math.PI * 40}`}
                    className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-base font-bold tabular-nums text-[#11201d]">{objProgress ?? "—"}<span className="text-[10px] text-[#8aa6a6]">%</span></span>
                  <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-[#8aa6a6]">{hl.prep}</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[2.25rem] font-black leading-none tabular-nums text-[#11201d]">J‑{objDaysTo}</div>
                <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8aa6a6]">{hl.goal}</div>
                <div className="truncate text-sm font-bold text-[#11201d]">{objective.race}</div>
                <div className="text-xs text-[#5f7d79]">{new Date(objective.raceDate + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" })}</div>
                <Link href="/dashboard/calendrier" className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[#11201d] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0b1714]">
                  {hl.plan} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-7 gap-y-4 sm:gap-x-9">
              {heroStats.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-bold tabular-nums text-[#11201d] sm:text-[1.7rem]">
                    {s.value}{s.unit && <span className="ml-0.5 text-sm font-medium text-[#8aa6a6]">{s.unit}</span>}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8aa6a6]">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Contenu principal + rail de droite (3 colonnes avec la sidebar) ── */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
      <div className="min-w-0">

      {/* Ressenti post-séance — demandé après la dernière séance */}
      {pendingFeedback && <SessionFeedback date={pendingFeedback.date} title={pendingFeedback.title} />}

      {/* Anti-blessure proactif — déload auto si la charge devient risquée */}
      {loadRisk?.deload && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="font-bold text-red-800">{t("dash.deload.title")}</p>
            <p className="mt-0.5 text-sm text-red-600">{loadRisk.reason}. {t("dash.deload.desc")}</p>
          </div>
        </div>
      )}

      {/* Objectif de course — saisi par le client → e-mail coach + perso IA */}
      <ObjectiveCard objective={objective ?? null} currentVma={currentVma ?? null} />

      {/* Prochaine séance — bannière compacte (uniquement si pas de bandeau coach) */}
      {!coachKey && (
        <div className="mb-5 flex items-center gap-4 rounded-2xl border border-zinc-200/70 bg-white px-5 py-3.5 shadow-sm">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#ecfdf5]" style={{ color: displaySession.accent }}>
            <Calendar className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{nx.next}</div>
            <div className="truncate text-sm font-bold text-zinc-900">{displaySession.title}</div>
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
          className="relative mb-5 flex items-center gap-4 overflow-hidden rounded-3xl px-5 py-4 text-white shadow-xl shadow-emerald-900/30 ring-1 ring-white/10 sm:px-6"
          style={{ background: "linear-gradient(120deg,#064e3b 0%,#047857 48%,#0d9488 100%)" }}
        >
          <div className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <span className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md"><Moon className="h-5 w-5 text-white" /></span>
          <div className="relative z-10 min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-100/90">{t("dash.coach.badge")}</span>
            <h2 className="text-xl font-bold leading-tight tracking-tight drop-shadow-sm sm:text-[1.4rem]">{coachKey.title}</h2>
            {coachKey.subtitle && <p className="mt-0.5 truncate text-[13px] text-white/85">{coachKey.subtitle}</p>}
          </div>
          <Link href="/dashboard/calendrier" title={t("dash.viewCalendar")}
            className="relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/25">
            <Calendar className="h-4 w-4 text-white/80" />
          </Link>
        </motion.div>
      )}
      {coachKey && !coachMinimal && (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-5 overflow-hidden rounded-3xl p-5 sm:p-6 text-white shadow-2xl shadow-emerald-900/40 ring-1 ring-white/10"
          style={{ background: "linear-gradient(135deg,#064e3b 0%,#047857 44%,#0d9488 100%)" }}
        >
          {/* Halos lumineux — profondeur premium */}
          <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-teal-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -top-6 right-12 h-40 w-40 rounded-full bg-amber-200/10 blur-2xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20 backdrop-blur-md">
                <Trophy className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-50">{t("dash.coach.badge")}</span>
              </span>
              <Link href="/dashboard/calendrier" title={t("dash.viewCalendar")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/25">
                <Calendar className="h-4 w-4 text-white/80" />
              </Link>
            </div>

            <h2 className="text-[1.4rem] font-bold leading-[1.1] tracking-tight drop-shadow-sm sm:text-[1.7rem]">{coachKey.title}</h2>
            {coachKey.subtitle && <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-white/85 sm:text-[15px]">{coachKey.subtitle}</p>}

            {coachKey.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {coachKey.tags.map((t, i) => (
                  <span key={t.l} className={`rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ring-1 ${i === 0 ? "bg-amber-300/15 text-amber-50 ring-amber-200/30" : "bg-white/10 text-white/90 ring-white/15"}`}>{t.l}</span>
                ))}
              </div>
            )}

            {coachKey.why && (
              <div className="mt-4 flex items-start gap-3 border-t border-white/15 pt-3.5">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <Target className="h-3.5 w-3.5 text-emerald-100" />
                </span>
                <p className="text-[13px] leading-relaxed text-white/80">{coachKey.why}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Bento Grid — sections éditoriales, chaque rangée pavée (aucune colonne vide) */}
      <div className="grid grid-cols-12 gap-4 auto-rows-auto">

        <SectionLabel>{t("dash.sec.today")}</SectionLabel>

        {/* Discipline Score — large card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="col-span-12 md:col-span-4 bento-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="metric-label">{fl.title}</div>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500"><Target className="h-4 w-4" /></span>
          </div>
          {forme.hasData ? (
            <div className="flex items-center gap-5">
              <div className="relative h-28 w-28 flex-shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#F4F4F5" strokeWidth="9" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={readiness.accent} strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42 * forme.total / 100} ${2 * Math.PI * 42}`}
                    className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[2rem] font-bold leading-none tabular-nums text-zinc-900">{forme.total}</span>
                  <span className="mt-0.5 text-[11px] text-zinc-400">{fl.of}</span>
                  <span className="mt-1 text-[10px] font-semibold" style={{ color: readiness.accent }}>{fl.rate(forme.total)}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {[
                  { label: fl.endurance, val: forme.endurance, c: "#059669" },
                  { label: fl.speed, val: forme.speed, c: "#2563eb" },
                  { label: fl.recovery, val: forme.recovery, c: "#7c3aed" },
                  { label: fl.regularity, val: forme.regularity, c: "#ea580c" },
                ].map(m => (
                  <div key={m.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-zinc-500">{m.label}</span>
                      <span className="font-semibold tabular-nums text-zinc-900">{m.val}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${m.val}%`, backgroundColor: m.c }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-50">
                <Target className="h-6 w-6 text-zinc-300" />
              </div>
              <p className="text-sm font-medium text-zinc-600">{t("dash.discipline.emptyTitle")}</p>
              <p className="mt-1 max-w-[210px] text-xs text-zinc-400">{t("dash.discipline.emptyDesc")}</p>
            </div>
          )}
        </motion.div>

        {/* HRV Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}
          className="col-span-12 md:col-span-4 bento-card"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="metric-label">{t("dash.hrv.title")}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-zinc-900">
                  {hrvLatest != null ? hrvLatest.toFixed(0) : "--"} <span className="text-sm font-normal text-zinc-400">ms</span>
                </span>
                {hrvDelta != null && (
                  <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${hrvDelta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                    {hrvDelta >= 0 ? "↑" : "↓"} {Math.abs(hrvDelta)} ms
                  </span>
                )}
              </div>
              {hrvBaseline != null && (
                <div className="mt-1 text-[11px] text-zinc-400">
                  {t("dash.hrv.baseline")} : <span className="font-medium text-zinc-500">{hrvBaseline} ms</span>
                  {hrvDelta != null && <span> · {hrvDelta >= 0 ? t("dash.hrv.above") : t("dash.hrv.below")}</span>}
                </div>
              )}
            </div>
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-400"><Heart className="h-4 w-4 animate-heartbeat" /></span>
          </div>
          {hrvChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={hrvChartData}>
                <defs>
                  <linearGradient id="hrv-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={readiness.accent} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={readiness.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="hrv" stroke={readiness.accent} strokeWidth={2}
                  fill="url(#hrv-grad)" dot={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E4E4E7", fontSize: "12px" }}
                  formatter={(v: number) => [`${v.toFixed(0)} ms`, "HRV"]}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-20 flex items-center justify-center text-sm text-zinc-400">
              {t("dash.hrv.empty")}
            </div>
          )}
          {(restingHr > 0 || freshSleep) && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {restingHr > 0 && (
                <div className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-400"><Heart className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold tabular-nums text-zinc-900">{restingHr}<span className="ml-0.5 text-[11px] font-normal text-zinc-400">bpm</span></div>
                    <div className="truncate text-[10px] text-zinc-400">{vit.hr}</div>
                  </div>
                </div>
              )}
              {freshSleep && (
                <div className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-400"><Moon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold tabular-nums text-zinc-900">{Math.floor(freshSleep.total_sleep_min / 60)}h{String(freshSleep.total_sleep_min % 60).padStart(2, "0")}</div>
                    <div className="truncate text-[10px] text-zinc-400">{t("dash.sleep.title")}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* VMA & prédictions de course — depuis la VMA estimée (modèle % VMA) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="col-span-12 md:col-span-4 bento-card"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="metric-label">{t("dash.vma.title")}</div>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ecfdf5] text-[#059669]"><Rocket className="h-4 w-4" /></span>
          </div>
          {predictions ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tabular-nums text-zinc-900">{(currentVma ?? 0).toFixed(1)}</span>
                <span className="text-sm text-zinc-400">km/h</span>
              </div>
              <div className="text-[11px] text-zinc-400">{t("dash.vma.sub")}</div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {predictions.map((p) => (
                  <div key={p.label} className="rounded-xl bg-gradient-to-b from-zinc-50 to-white px-3 py-2.5 ring-1 ring-inset ring-zinc-100 transition-shadow hover:shadow-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{p.label}</div>
                    <div className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900">{p.time}</div>
                    <div className="text-[10px] tabular-nums text-zinc-400">{p.pace}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-50"><Rocket className="h-6 w-6 text-zinc-300" /></div>
              <p className="max-w-[210px] text-xs text-zinc-400">{t("dash.vma.empty")}</p>
            </div>
          )}
        </motion.div>

        <SectionLabel>{t("dash.sec.load")}</SectionLabel>

        {/* Charge & Affûtage — CTL/ATL/TSB réels (modèle Banister) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="col-span-12 md:col-span-6"
        >
          <TaperingWidget workouts={workouts} raceDate={raceDate} />
        </motion.div>

        {/* Charge aiguë / chronique (ACWR) — prévention blessure (modèle Gabbett) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}
          className="col-span-12 md:col-span-6 bento-card flex flex-col"
        >
          <div className="mb-1 flex items-start justify-between">
            <div>
              <div className="metric-label">{t("dash.acwr.title")}</div>
              <div className="mt-0.5 text-[11px] text-zinc-400">{t("dash.acwr.sub")}</div>
            </div>
            <Gauge className="h-5 w-5 text-zinc-300" />
          </div>
          {acwr > 0 ? (() => {
            const zone = acwr < 0.8 ? { l: t("dash.acwr.under"), c: "#0284C7" }
              : acwr <= 1.3 ? { l: t("dash.acwr.optimal"), c: "#059669" }
              : acwr <= 1.5 ? { l: t("dash.acwr.caution"), c: "#EA580C" }
              : { l: t("dash.acwr.high"), c: "#DC2626" };
            const pos = Math.max(0, Math.min(1, (acwr - 0.5) / 1.3)) * 100;
            const ticks = [{ v: "0.8", p: 23.08 }, { v: "1.3", p: 61.54 }, { v: "1.5", p: 76.92 }];
            return (
              <div className="mt-auto pt-2">
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-bold tabular-nums" style={{ color: zone.c }}>{acwr.toFixed(2)}</span>
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
                    <span key={tk.v} className="absolute top-4 -translate-x-1/2 text-[10px] tabular-nums text-zinc-400" style={{ left: `${tk.p}%` }}>{tk.v}</span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-400">{t("dash.acwr.monotony")} <strong className="tabular-nums text-zinc-700">{(loadRisk?.monotony ?? 0).toFixed(1)}</strong></span>
                  <span className="text-zinc-300">·</span>
                  <span className="text-zinc-500">{t("dash.acwr.sweet")}</span>
                </div>
              </div>
            );
          })() : (
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-50"><Gauge className="h-6 w-6 text-zinc-300" /></div>
              <p className="max-w-[230px] text-xs text-zinc-400">{t("dash.acwr.empty")}</p>
            </div>
          )}
        </motion.div>

        {/* Volume + tendance 6 semaines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="col-span-12 md:col-span-4 bento-card"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="metric-label">{t("dash.volume.title")}</div>
            <TrendingUp className="h-4 w-4 text-zinc-300" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="metric-value text-zinc-900">{weeklyKm.toFixed(1)}</span>
            <span className="text-sm text-zinc-400">km</span>
            {volumeDelta != null && Math.abs(volumeDelta) >= 0.1 && (
              <span className={`ml-auto inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${volumeDelta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                {volumeDelta >= 0 ? "↑" : "↓"} {Math.abs(volumeDelta).toFixed(0)} km
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-400">{volumeDelta != null ? t("dash.volume.vsAvg") : " "}</div>
          <div className="mt-3 flex h-14 items-end gap-1.5">
            {volumeTrend.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-md transition-all"
                style={{ height: `${Math.max(4, (v.km / trendMax) * 56)}px`, background: v.isCurrent ? "#059669" : "#D1FAE5" }}
                title={`${v.km.toFixed(1)} km`} />
            ))}
          </div>
          <div className="mt-1 text-center text-[10px] text-zinc-400">{t("dash.volume.trend")}</div>
          <div className="mt-3 h-1.5 rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min((weeklyKm / 60) * 100, 100)}%` }} />
          </div>
          <div className="mt-1 text-xs text-zinc-400">{t("dash.volume.goal")}: {plan ? t("dash.volume.perPlan") : "60 km"}</div>
        </motion.div>

        {/* Zones d'entraînement (FC) — temps par zone + verdict de polarisation 80/20 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}
          className="col-span-12 md:col-span-4 bento-card"
        >
          <div className="mb-1 flex items-center justify-between">
            <div className="metric-label">{zl.title}</div>
            <Flame className="h-4 w-4 text-orange-400" />
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
                          className="transition-all duration-700" />
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold tabular-nums text-zinc-900">{easyPct}%</span>
                      <span className="text-[9px] text-zinc-400">Z1–Z2</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5 text-[13px]">
                    {segs.map((sg, i) => sg.min > 0 && (
                      <div key={i} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: sg.color }} />
                        <span className="flex-1 truncate text-zinc-500">{zl.z[i]}</span>
                        <span className="font-semibold tabular-nums text-zinc-900">{sg.min}<span className="ml-0.5 text-[10px] font-normal text-zinc-400">{zl.min}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 border-t border-zinc-100 pt-2.5 text-xs font-semibold" style={{ color: good ? "#059669" : "#EA580C" }}>
                  {good ? t("dash.intensity.polarized") : easyPct < 75 ? t("dash.intensity.tooHard") : t("dash.intensity.tooEasy")}
                </div>
              </>
            );
          })() : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-50"><Flame className="h-6 w-6 text-zinc-300" /></div>
              <p className="max-w-[200px] text-xs text-zinc-400">{t("dash.intensity.empty")}</p>
            </div>
          )}
        </motion.div>

        {/* Ligue — badge + score + tendance 8 sem. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="col-span-12 md:col-span-4 bento-card flex flex-col"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="metric-label">{t("dash.league.title")}</div>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </div>
          <div className={`inline-flex w-fit items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold league-${profile?.league ?? "bronze"}`}>
            <Trophy className="h-3.5 w-3.5" />
            {(profile?.league ?? "bronze").charAt(0).toUpperCase()}{(profile?.league ?? "bronze").slice(1)}
          </div>
          <div className="mt-3 text-sm text-zinc-500">
            {t("dash.league.weekly")} : <strong className="tabular-nums text-zinc-900">{disc.hasData ? disc.total : "—"}</strong>
          </div>
          {discTrend.length > 1 && (
            <div className="mt-3 flex h-10 items-end gap-1">
              {discTrend.map((s, i) => (
                <div key={i} className={`flex-1 rounded-sm ${i === discTrend.length - 1 ? "bg-yellow-400" : "bg-yellow-200"}`}
                  style={{ height: `${Math.max(8, (s / 100) * 40)}px` }} title={`${s}`} />
              ))}
            </div>
          )}
          <Link href="/dashboard/leagues" className="mt-auto pt-3 text-xs font-medium text-emerald-600 hover:text-emerald-700">{t("dash.league.cta")}</Link>
        </motion.div>

        <SectionLabel>{t("dash.sec.activity")}</SectionLabel>

        {/* Activité 7 jours — barres km/jour */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="col-span-12 md:col-span-8 bento-card"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="metric-label">{t("dash.weekly.title")}</div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-zinc-400">{t("dash.weekly.total")} <strong className="tabular-nums text-zinc-900">{weekSummary.km.toFixed(1)} km</strong></span>
              <span className="text-zinc-400">{t("dash.chart.elevation")} <strong className="tabular-nums text-zinc-900">+{Math.round(weekSummary.elev)} m</strong></span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={weeklyData} barCategoryGap="24%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#A1A1AA" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#A1A1AA" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip cursor={{ fill: "rgba(16,185,129,0.06)" }}
                contentStyle={{ borderRadius: "12px", border: "1px solid #E4E4E7", fontSize: "12px" }}
                formatter={(v: number) => [`${v.toFixed(1)} km`, t("dash.chart.distance")]} />
              <Bar dataKey="km" radius={[6, 6, 0, 0]} maxBarSize={36}>
                {weeklyData.map((d, i) => (<Cell key={i} fill={d.km > 0 ? "#10b981" : "#E4E4E7"} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Carte de droite n°1 — toujours remplie (pas de colonne vide) */}
        <motion.div key={fillers[0].key}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}
          className="col-span-12 md:col-span-4"
        >
          {fillers[0].node}
        </motion.div>

        {/* Dernière séance (col-8) + carte de droite n°2 (col-4) — rangée pavée */}
        {w0 && lastMetrics.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}
              className="col-span-12 md:col-span-8 bento-card"
            >
              <div className="mb-4 flex items-center gap-2">
                <Footprints className="h-4 w-4 text-zinc-500" />
                <div className="metric-label">{t("dash.last.title")}{w0.title ? ` — ${cleanActivityName(w0.title)}` : ""}</div>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4">
                {lastMetrics.map((m) => (
                  <div key={m.label} className="text-center">
                    <div className="text-2xl font-bold leading-none text-zinc-900">
                      {m.value}<span className="ml-0.5 text-sm font-normal text-zinc-400">{m.unit}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-500">{m.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div key={fillers[1].key}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="col-span-12 md:col-span-4"
            >
              {fillers[1].node}
            </motion.div>
          </>
        )}

        {/* Recent workouts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.40 }}
          className="col-span-12 bento-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="metric-label">{t("dash.recent.title")}</div>
            <a href="/dashboard/calendrier" className="text-xs text-emerald-600 font-medium hover:text-emerald-700">
              {t("dash.recent.viewAll")}
            </a>
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
                  className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-zinc-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 text-sm truncate group-hover:text-emerald-700">{cleanActivityName(w.title)}</div>
                    <div className="text-xs text-zinc-400">
                      {new Date(w.date).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm text-zinc-600 flex-shrink-0">
                    {w.distance_km && <span>{w.distance_km.toFixed(1)} km</span>}
                    {w.elevation_gain_m ? <span>+{w.elevation_gain_m}m</span> : null}
                    {w.avg_hr && <span>{w.avg_hr} bpm</span>}
                    <span className="text-zinc-400">
                      {Math.floor(w.duration_seconds / 3600)}h{String(Math.floor((w.duration_seconds % 3600) / 60)).padStart(2, "0")}
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium zone-z${
                    w.training_effect ? Math.ceil(w.training_effect) : 2
                  }`}>
                    Z{w.training_effect ? Math.ceil(w.training_effect) : 2}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-600 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
      </div>

      {/* ── Rail de droite ── */}
      <aside className="mt-4 space-y-4 lg:mt-0">
        {/* Statut de préparation */}
        <div className="bento-card">
          <div className="metric-label">{rl.prep}</div>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-20 w-20 flex-shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#F4F4F5" strokeWidth="9" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={readiness.accent} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(2 * Math.PI * 42 * (disc.hasData ? disc.total : 0)) / 100} ${2 * Math.PI * 42}`}
                  className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums text-zinc-900">
                {disc.hasData ? disc.total : "—"}<span className="text-xs text-zinc-400">%</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-zinc-900">{rl.ready}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{readiness.tagline}</p>
            </div>
          </div>
          <Link href="/dashboard/sante" className="mt-4 flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-50">
            {rl.recommend} <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          </Link>
        </div>

        {/* Objectif principal */}
        {objective && objDaysTo != null && objDaysTo >= 0 && (
          <div className="bento-card">
            <div className="metric-label">{rl.goal}</div>
            <div className="mt-2 truncate text-sm font-bold text-zinc-900">{objective.race}</div>
            <div className="text-xs text-zinc-400">{objective.distanceKm} km · {objective.targetTime}</div>
            <div className="mt-3 text-3xl font-black leading-none tabular-nums text-zinc-900">J‑{objDaysTo}</div>
            {objProgress != null && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-[#059669] transition-all duration-1000" style={{ width: `${objProgress}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{rl.progress}</span><span className="font-semibold tabular-nums text-zinc-600">{objProgress}%</span>
                </div>
              </div>
            )}
            <Link href="/dashboard/calendrier" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#059669] transition-colors hover:text-[#047857]">
              {hl.plan} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Analyse IA */}
        <div className="bento-card">
          <div className="flex items-center justify-between">
            <div className="metric-label">{rl.ai}</div>
            <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">Beta</span>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-600">{coachKey?.why || coachKey?.subtitle || readiness.tagline}</p>
        </div>

        {/* Badges — jalons de distance réels */}
        {records && (
          <div className="bento-card">
            <div className="flex items-center justify-between">
              <div className="metric-label">{rl.badges}</div>
              <Link href="/dashboard/leagues" className="text-xs font-medium text-[#059669] hover:text-[#047857]">{t("dash.league.cta")}</Link>
            </div>
            <div className="mt-3 flex justify-around gap-2">
              {[
                { km: 10, l: "10K", rim: "#a7f3d0", grad: "linear-gradient(145deg,#10b981,#059669)" },
                { km: 21.1, l: "21K", rim: "#c7d2fe", grad: "linear-gradient(145deg,#818cf8,#6366f1)" },
                { km: 42.2, l: "42K", rim: "#fde68a", grad: "linear-gradient(145deg,#fbbf24,#d97706)" },
              ].map((b) => {
                const earned = records.longest >= b.km;
                const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
                return (
                  <div key={b.l} className="flex flex-col items-center gap-1.5">
                    <div className="flex h-[52px] w-[46px] items-center justify-center" style={{ clipPath: HEX, background: earned ? b.rim : "#e4e4e7" }}>
                      <div className="flex h-[44px] w-[39px] items-center justify-center text-[11px] font-black" style={{ clipPath: HEX, background: earned ? b.grad : "#f4f4f5", color: earned ? "#fff" : "#a1a1aa" }}>
                        {b.l}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cette semaine */}
        <div className="bento-card">
          <div className="metric-label">{t("dash.summary.title")}</div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { v: String(weekSummary.sessions), u: "", l: t("dash.summary.sessions") },
              { v: weekSummary.km.toFixed(1), u: "km", l: t("dash.metric.distance") },
              { v: String(Math.round(weekSummary.elev)), u: "m", l: t("dash.metric.elevation") },
              { v: fmtTime(weekSummary.sec), u: "", l: t("dash.metric.duration") },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-lg font-bold leading-none tabular-nums text-zinc-900">{s.v}<span className="ml-0.5 text-xs font-normal text-zinc-400">{s.u}</span></div>
                <div className="mt-1 text-[11px] text-zinc-500">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Communauté active */}
        <div className="bento-card">
          <div className="flex items-center justify-between">
            <div className="metric-label">{rl.community}</div>
            <Link href="/dashboard/communaute" className="text-xs font-medium text-[#059669] hover:text-[#047857]">{rl.see}</Link>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#ecfdf5] text-[#059669]"><Users className="h-5 w-5" /></span>
            <div className="min-w-0">
              {newMembersWeek && newMembersWeek > 0 ? (
                <>
                  <div className="text-lg font-bold tabular-nums text-zinc-900">+{newMembersWeek}</div>
                  <div className="text-xs text-zinc-400">{rl.newWeek}</div>
                </>
              ) : (
                <>
                  <div className="truncate text-sm font-semibold text-zinc-900">{leagueName || "Pacevo"}</div>
                  <div className="text-xs text-zinc-400">{rl.communitySub}</div>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Records personnels — meilleurs temps réels par distance */}
        {distancePRs.length > 0 && (
          <div className="bento-card">
            <div className="metric-label">{rl.records}</div>
            <div className="mt-3 space-y-2.5">
              {distancePRs.map((pr) => (
                <div key={pr.label} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-500">{pr.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-zinc-900">{pr.time}</span>
                    <span className="hidden text-[10px] text-zinc-400 sm:inline">{pr.date}</span>
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">RP</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
      </div>
    </div>
  );
}

// ── Séance-clé du jour : heuristique coach (VFC, sommeil, dernières séances, volume, course) ──
type KeyTag = { l: string; c: string };
type KeySession = { title: string; subtitle: string; accent: string; tags: KeyTag[]; why: string };

function recommendSession({ state, weeklyKm, workouts, sleep, raceDate, t }: {
  state: string; weeklyKm: number; workouts: Workout[];
  sleep?: { sleep_score: number } | null; raceDate: string | null; t: TFn;
}): KeySession {
  const Z1 = "bg-sky-100 text-sky-700", Z2 = "bg-green-100 text-green-700",
    Z4 = "bg-orange-100 text-orange-700", NEU = "bg-zinc-100 text-zinc-600", RED = "bg-red-100 text-red-700";
  const ss = sleep?.sleep_score ?? null;
  const last = workouts[0];
  const daysSinceLast = last ? Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000) : 99;
  const lastHard = !!last && /interval|vma|tempo|race|hill|seuil/i.test(String(last.type ?? ""));
  const lastLong = !!last && (last.distance_km ?? 0) >= 18;
  const dow = new Date().getDay();
  const daysToRace = raceDate ? Math.ceil((new Date(raceDate).getTime() - Date.now()) / 86400000) : null;
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
  if ((lastHard || lastLong) && daysSinceLast <= 1) return {
    title: t("dash.rec.assim.title"), accent: "#059669", subtitle: t("dash.rec.assim.sub"),
    tags: [{ l: "Z2", c: Z2 }, { l: "45–60 min", c: NEU }],
    why: t("dash.rec.assim.why"),
  };
  if (dow === 0 || dow === 6) {
    const target = Math.max(12, Math.round(weeklyKm * 0.4));
    return {
      title: t("dash.rec.long.title"), accent: "#059669", subtitle: t("dash.rec.long.sub", { km: target }),
      tags: [{ l: "Z2", c: Z2 }, { l: `${target} km`, c: NEU }],
      why: t("dash.rec.long.why"),
    };
  }
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
  return {
    title: t("dash.rec.base.title"), accent: "#059669", subtitle: t("dash.rec.base.sub"),
    tags: [{ l: "Z2", c: Z2 }, { l: "50 min", c: NEU }],
    why: t("dash.rec.base.why"),
  };
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
function buildLastMetrics(w: Workout, t: TFn): { label: string; value: string | number; unit: string }[] {
  const out: { label: string; value: string | number; unit: string }[] = [];
  if (w.distance_km != null) out.push({ label: t("dash.metric.distance"), value: w.distance_km.toFixed(1), unit: "km" });
  if (w.duration_seconds) out.push({ label: t("dash.metric.duration"), value: `${Math.floor(w.duration_seconds / 3600)}h${String(Math.floor((w.duration_seconds % 3600) / 60)).padStart(2, "0")}`, unit: "" });
  if (w.distance_km && w.duration_seconds) {
    const p = (w.duration_seconds / 60) / w.distance_km;
    if (isFinite(p) && p > 0 && p < 30) out.push({ label: t("dash.metric.pace"), value: `${Math.floor(p)}'${String(Math.round((p - Math.floor(p)) * 60)).padStart(2, "0")}`, unit: "/km" });
  }
  if (w.avg_hr != null) out.push({ label: t("dash.metric.avgHr"), value: w.avg_hr, unit: "bpm" });
  if (w.avg_cadence_spm != null) out.push({ label: t("dash.metric.cadence"), value: w.avg_cadence_spm, unit: "spm" });
  if (w.elevation_gain_m != null) out.push({ label: t("dash.metric.elevation"), value: w.elevation_gain_m, unit: "m" });
  if (w.vertical_oscillation_cm != null) out.push({ label: t("dash.metric.oscillation"), value: w.vertical_oscillation_cm, unit: "cm" });
  const gct = w.ground_contact_time_ms ?? w.ground_contact_ms;
  if (gct != null) out.push({ label: t("dash.metric.groundContact"), value: gct, unit: "ms" });
  if (w.avg_power_watts != null) out.push({ label: t("dash.metric.power"), value: w.avg_power_watts, unit: "W" });
  return out.slice(0, 8);
}

// ── Score de forme — 4 axes, tous dérivés de données réelles ─────────────────────
//  Endurance = base aérobie (plus longue sortie réf 30 km + volume hebdo réf 50 km/sem
//  sur 6 sem.) · Vitesse = VMA estimée placée sur une échelle 8→20 km/h · Récupération
//  & Régularité reprises du modèle discipline (sommeil/VFC, assiduité). total = moyenne
//  des 4 axes → l'anneau colle toujours aux barres affichées.
function computeForme(
  workouts: Workout[], currentVma: number, recovery: number, regularity: number,
): { total: number; endurance: number; speed: number; recovery: number; regularity: number; hasData: boolean } {
  const now = Date.now();
  // Une sortie vélo de 60 km gonflerait l'axe endurance : on ne score que la course.
  const recent = workouts.filter(w => isRun(w.sport) && now - new Date(w.date).getTime() <= 42 * 86400000);
  const hasData = workouts.length > 0;
  const longest = Math.max(0, ...recent.map(w => w.distance_km ?? 0));
  const weeklyKm = recent.reduce((s, w) => s + (w.distance_km ?? 0), 0) / 6;
  const endurance = clamp(Math.round(0.6 * (longest / 30) * 100 + 0.4 * (weeklyKm / 50) * 100));
  const speed = currentVma > 0 ? clamp(Math.round(((currentVma - 8) / 12) * 100)) : 0;
  const total = Math.round((endurance + speed + recovery + regularity) / 4);
  return { total, endurance, speed, recovery, regularity, hasData };
}

// ── Zones d'entraînement (FC) — temps par zone sur 6 sem. ────────────────────────
//  Chaque séance (avec FC moyenne) est rangée dans une zone selon FCmoy/FCmax, et sa
//  durée y est ajoutée. Estimation honnête (intra-séance non détaillée) → libellé sobre.
function computeHrZones(workouts: Workout[], maxHr: number): { secs: number[]; total: number } {
  const now = Date.now();
  const secs = [0, 0, 0, 0, 0];
  if (!(maxHr > 0)) return { secs, total: 0 };
  for (const w of workouts) {
    if (now - new Date(w.date).getTime() > 42 * 86400000) continue;
    const hr = Number(w.avg_hr ?? 0), dur = Number(w.duration_seconds ?? 0);
    if (!(hr > 0) || !(dur > 0)) continue;
    const frac = hr / maxHr;
    const zi = HR_ZONE_DEFS.findIndex(z => frac >= z.lo && frac < z.hi);
    if (zi >= 0) secs[zi] += dur;
  }
  return { secs, total: secs.reduce((a, b) => a + b, 0) };
}

// ── Score Discipline — modèle cohérent, documenté et ajustable ───────────────────
//  Principes reconnus : répartition polarisée 80/20 (Seiler / « 80/20 Running »)
//  pour la Précision · régularité hebdo pour l'Assiduité · sommeil + tendance VFC
//  (RMSSD vs base) pour la Récupération. total = somme pondérée → l'anneau colle
//  TOUJOURS aux 3 barres. Toutes les constantes sont regroupées ici pour être
//  ajustées sans toucher à la logique.
const DISCIPLINE_CONFIG = {
  weights: { precision: 0.4, consistency: 0.4, recovery: 0.2 }, // somme = 1
  windowDays: 14,            // fenêtre d'analyse (lisse le bruit d'une semaine isolée)
  weeklyTarget: 4,           // séances/semaine visées (Assiduité)
  easyShareTarget: 0.8,      // 80 % facile / 20 % qualité (modèle polarisé)
  penaltyTooHard: 220,       // trop d'intensité = pénalité forte (risque surcharge/blessure)
  penaltyTooEasy: 120,       // trop facile = pénalité plus douce (annulée en semaine de récup)
  minForPrecision: 3,        // sous ce nombre de séances, la Précision est peu fiable
  stateBaseline: { optimal: 85, competition: 80, recovery: 55 } as Record<string, number>,
};

// État du jour — lecture honnête de la forme (VFC vs base 14 j + sommeil RÉCENT).
function computeReadiness(hrvDelta: number | null, hrvBaseline: number | null, sleepScore: number | null, t: TFn) {
  const sig: number[] = [];
  if (hrvDelta != null && hrvBaseline) sig.push(hrvDelta >= 0 ? 1 : hrvDelta / hrvBaseline >= -0.06 ? 0 : -1);
  if (sleepScore != null) sig.push(sleepScore >= 75 ? 1 : sleepScore >= 55 ? 0 : -1);
  if (!sig.length) return { accent: "#0d9488", tagline: t("dash.ready.none") };
  const avg = sig.reduce((a, b) => a + b, 0) / sig.length;
  if (avg >= 0.5) return { accent: "#059669", tagline: t("dash.ready.top") };
  if (avg <= -0.5) return { accent: "#0284C7", tagline: t("dash.ready.rest") };
  return { accent: "#0d9488", tagline: t("dash.ready.ok") };
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function computeDiscipline(
  workouts: Workout[], hrv: HRVData[],
  sleep: { sleep_score: number } | null, state: string,
): { total: number; precision: number; consistency: number; recovery: number; hasData: boolean } {
  const C = DISCIPLINE_CONFIG;
  const now = Date.now();
  const recent = workouts.filter(w => now - new Date(w.date).getTime() <= C.windowDays * 86400000);
  const hasData = workouts.length > 0 || hrv.length > 0;

  // Assiduité — régularité sur la fenêtre vs cible (séances/sem × nb de semaines).
  const consistency = clamp(Math.round((recent.length / (C.weeklyTarget * (C.windowDays / 7))) * 100));

  // Précision — proximité d'une répartition polarisée ~80 % facile / 20 % qualité.
  //  Pénalité asymétrique : le « trop dur » coûte plus cher que le « trop facile ».
  let precision: number;
  if (recent.length >= C.minForPrecision) {
    const easyShare = recent.filter(w => !isQualityWorkout(w)).length / recent.length;
    const dev = easyShare - C.easyShareTarget;                          // <0 trop dur · >0 trop facile
    const tooEasy = state === "recovery" ? 0 : C.penaltyTooEasy;        // semaine de récup → le facile est normal
    precision = clamp(Math.round(100 - (dev < 0 ? -dev * C.penaltyTooHard : dev * tooEasy)));
  } else {
    precision = recent.length ? consistency : 0;                        // pas assez d'historique
  }

  // Récupération — données réelles : sommeil + tendance VFC (RMSSD du jour vs base 14 j).
  const signals: number[] = [];
  if (sleep?.sleep_score != null) signals.push(sleep.sleep_score);
  const hrvVals = hrv.slice(0, 14).map(h => h.hrv_ms).filter((v): v is number => v != null);
  if (hrvVals.length >= 3) {
    const base = hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length;
    signals.push(clamp(70 + ((hrvVals[0] - base) / base) * 300));       // à la base ≈ 70, +10 % ≈ 100
  }
  const recovery = signals.length
    ? Math.round(signals.reduce((a, b) => a + b, 0) / signals.length)
    : (C.stateBaseline[state] ?? 70);

  const total = Math.round(
    C.weights.precision * precision + C.weights.consistency * consistency + C.weights.recovery * recovery,
  );
  return { total, precision, consistency, recovery, hasData };
}

// ── Qualité (intensité) d'une séance — partagé par le Score Discipline ET la
//    répartition d'intensité (une seule source de vérité). ─────────────────────────
function isQualityWorkout(w: Workout): boolean {
  const type = String(w.type ?? "").toLowerCase();
  if (/easy|recovery|long|trail|endurance|footing|récup|fond|marche/.test(type)) return false;
  if (/interval|vma|tempo|seuil|race|hill|fractionn|côte|cote|sprint|vif|fartlek|threshold/.test(type)) return true;
  return (w.training_effect ?? 0) >= 4; // type ambigu : seul un effort très élevé compte comme qualité
}

// Tendance du volume : N blocs glissants de 7 jours (du plus ancien au plus récent).
function computeWeeklyTrend(workouts: Workout[], weeks = 6): { km: number; isCurrent: boolean }[] {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * 86400000;
    const start = end - 7 * 86400000;
    const km = workouts
      .filter(w => { const ts = new Date(w.date).getTime(); return isRun(w.sport) && ts > start && ts <= end; })
      .reduce((s, w) => s + (w.distance_km ?? 0), 0);
    return { km, isCurrent: i === weeks - 1 };
  });
}

// Meilleures sorties récentes (sur l'historique chargé — honnête, pas « all-time »).
function computeRecords(workouts: Workout[]): { longest: number; maxElev: number; longestSec: number; bestPace: number | null } | null {
  const runs = workouts.filter(w => (w.distance_km ?? 0) > 0);
  if (!runs.length) return null;
  const longest = Math.max(...runs.map(w => w.distance_km ?? 0));
  const maxElev = Math.max(0, ...runs.map(w => w.elevation_gain_m ?? 0));
  const longestSec = Math.max(0, ...runs.map(w => w.duration_seconds ?? 0));
  const paces = runs
    .filter(w => (w.distance_km ?? 0) >= 3 && (w.duration_seconds ?? 0) > 0)
    .map(w => (w.duration_seconds as number) / (w.distance_km as number)); // sec/km
  const bestPace = paces.length ? Math.min(...paces) : null;
  return { longest, maxElev, longestSec, bestPace };
}

// Records par distance — meilleur temps réel sur 5/10/semi/marathon (depuis les activités).
function computeDistancePRs(workouts: Workout[], lang: string): { label: string; time: string; date: string }[] {
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

// Résumé de la semaine en cours (7 derniers jours).
function computeWeekSummary(workouts: Workout[]): { sessions: number; km: number; elev: number; sec: number } {
  const weekAgo = Date.now() - 7 * 86400000;
  const wk = workouts.filter(w => isRun(w.sport) && new Date(w.date).getTime() >= weekAgo);
  return {
    sessions: wk.length,
    km: wk.reduce((s, w) => s + (w.distance_km ?? 0), 0),
    elev: wk.reduce((s, w) => s + (w.elevation_gain_m ?? 0), 0),
    sec: wk.reduce((s, w) => s + (w.duration_seconds ?? 0), 0),
  };
}

// Intitulé de section — repère éditorial entre les rangées du bento.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-12 flex items-center gap-2.5 pt-2 first:pt-0">
      <span className="h-1 w-1 flex-shrink-0 rounded-full bg-[#10b981]" />
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-zinc-200 to-transparent" />
    </div>
  );
}
