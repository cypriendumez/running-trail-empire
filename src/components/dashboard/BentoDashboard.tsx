"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity, Heart, Zap, Trophy, Target, TrendingUp,
  Calendar, MapPin, Droplets, Wind, Thermometer, Footprints,
  Moon, BatteryCharging
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid
} from "recharts";
import type { UserProfile, HRVData, Workout } from "@/types";
import { TaperingWidget } from "@/components/dashboard/TaperingWidget";

interface Props {
  profile: UserProfile | null;
  hrv: HRVData[];
  workouts: Workout[];
  plan: Record<string, unknown> | null;
  league: Record<string, unknown> | null;
  disciplineHistory: Record<string, unknown>[];
  sleep?: { total_sleep_min: number; sleep_score: number; body_battery_end: number; deep_sleep_min: number; rem_sleep_min: number } | null;
}

// Exact spec colors: Bleu Polaire / Vert Émeraude / Orange Braise
const STATE_COLORS = {
  recovery:    { bg: "#E0F2FE", accent: "#0284C7", label: "Mode Récupération", emoji: "💙" },
  optimal:     { bg: "#D1FAE5", accent: "#059669", label: "Forme Optimale",    emoji: "💚" },
  competition: { bg: "#FFEDD5", accent: "#EA580C", label: "Haute Intensité",   emoji: "🔥" },
} as const;

export function BentoDashboard({ profile, hrv, workouts, plan, league, disciplineHistory, sleep }: Props) {
  const mode = profile?.mode ?? "ludique";
  const state = hrv[0]?.physiological_state ?? "optimal";

  const stateConfig = STATE_COLORS[state];

  const weeklyKm = workouts
    .filter(w => {
      const d = new Date(w.date);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    })
    .reduce((sum, w) => sum + (w.distance_km ?? 0), 0);

  const hrvChartData = hrv.slice(0, 14).reverse().map(h => ({
    date: new Date(h.date).toLocaleDateString("fr", { day: "2-digit", month: "2-digit" }),
    hrv: h.hrv_ms,
  }));

  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayWorkouts = workouts.filter(w => new Date(w.date).toDateString() === d.toDateString());
    return {
      day: d.toLocaleDateString("fr", { weekday: "short" }),
      km: dayWorkouts.reduce((s, w) => s + (w.distance_km ?? 0), 0),
      elev: dayWorkouts.reduce((s, w) => s + (w.elevation_gain_m ?? 0), 0),
    };
  });

  const disciplineScore = profile?.discipline_score ?? 0;

  const raceDate = (plan as { race_date?: string } | null)?.race_date ?? null;

  return (
    <div
      className="min-h-full transition-all duration-1000"
      style={{ background: `linear-gradient(135deg, ${stateConfig.bg} 0%, #FFFFFF 60%)` }}
    >
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{stateConfig.emoji}</span>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: stateConfig.accent }}>
              {stateConfig.label}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900">
            Bonjour, {profile?.full_name?.split(" ")[0] ?? "Champion"} 👋
          </h1>
          <p className="text-zinc-500 mt-1">
            {new Date().toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {mode === "elite" && (
          <div className="flex gap-3">
            <Chip label="CTL" value="72" color="#059669" />
            <Chip label="ATL" value="68" color="#EA580C" />
            <Chip label="TSB" value="+4" color="#0284C7" />
          </div>
        )}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-4 auto-rows-auto">

        {/* Discipline Score — large card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="col-span-12 md:col-span-4 bento-card"
        >
          <div className="metric-label mb-4">Score Discipline</div>
          <div className="flex items-end gap-4">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#F4F4F5" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={stateConfig.accent} strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42 * disciplineScore / 100} ${2 * Math.PI * 42}`}
                  className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-zinc-900">{Math.round(disciplineScore)}</span>
                <span className="text-xs text-zinc-400">/100</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {[
                { label: "Précision", pct: 40, val: 82 },
                { label: "Assiduité", pct: 40, val: 75 },
                { label: "Récupération", pct: 20, val: 68 },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-zinc-500">{m.label}</span>
                    <span className="font-medium text-zinc-900">{m.val}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${m.val}%`, backgroundColor: stateConfig.accent }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* HRV Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}
          className="col-span-12 md:col-span-5 bento-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="metric-label">VFC (HRV)</div>
              <div className="text-3xl font-bold text-zinc-900 mt-1">
                {hrv[0]?.hrv_ms?.toFixed(0) ?? "--"} <span className="text-sm font-normal text-zinc-400">ms</span>
              </div>
            </div>
            <Heart className="w-5 h-5 text-red-400 animate-heartbeat" />
          </div>
          {hrvChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={hrvChartData}>
                <defs>
                  <linearGradient id="hrv-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stateConfig.accent} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={stateConfig.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="hrv" stroke={stateConfig.accent} strokeWidth={2}
                  fill="url(#hrv-grad)" dot={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E4E4E7", fontSize: "12px" }}
                  formatter={(v: number) => [`${v.toFixed(0)} ms`, "HRV"]}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-20 flex items-center justify-center text-sm text-zinc-400">
              Synchronisez votre montre pour voir votre VFC
            </div>
          )}
        </motion.div>

        {/* Weekly Volume */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="col-span-12 md:col-span-3 bento-card"
        >
          <div className="metric-label mb-2">Volume Semaine</div>
          <div className="metric-value text-zinc-900">{weeklyKm.toFixed(1)}</div>
          <div className="text-zinc-400 text-sm">km</div>
          <div className="mt-3 h-1.5 bg-zinc-100 rounded-full">
            <div className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(weeklyKm / (Number(plan ? 50 : 60)) * 100, 100)}%` }} />
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Objectif: {plan ? "selon plan" : "60 km"}
          </div>
        </motion.div>

        {/* Weekly chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}
          className="col-span-12 md:col-span-7 bento-card"
        >
          <div className="metric-label mb-4">Activité 7 jours</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#A1A1AA" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#A1A1AA" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #E4E4E7", fontSize: "12px" }}
                formatter={(v: number, name: string) => [
                  name === "km" ? `${v.toFixed(1)} km` : `${v} m D+`, name === "km" ? "Distance" : "Dénivelé"
                ]}
              />
              <Line type="monotone" dataKey="km" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3, fill: "#22c55e" }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* League */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="col-span-12 md:col-span-5 bento-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="metric-label">Ligue</div>
            <Trophy className="w-4 h-4 text-yellow-500" />
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold mb-3 league-${profile?.league ?? "bronze"}`}>
            <span>
              {profile?.league === "diamond" ? "💎" :
               profile?.league === "platinum" ? "🔷" :
               profile?.league === "gold" ? "🥇" :
               profile?.league === "silver" ? "🥈" : "🥉"}
            </span>
            {profile?.league?.charAt(0).toUpperCase()}{profile?.league?.slice(1) ?? "Bronze"}
          </div>
          <div className="text-sm text-zinc-500">
            Score hebdo: <strong className="text-zinc-900">{Math.round(disciplineScore)}</strong>
          </div>
        </motion.div>

        {/* Tapering widget — Elite mode */}
        {mode === "elite" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}
            className="col-span-12 md:col-span-5"
          >
            <TaperingWidget workouts={workouts} raceDate={raceDate} />
          </motion.div>
        )}

        {/* Sleep widget */}
        {sleep && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            className="col-span-12 md:col-span-4 bento-card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="metric-label">Sommeil & Body Battery</div>
              <Moon className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-2xl font-bold text-zinc-900">{Math.floor(sleep.total_sleep_min / 60)}h{String(sleep.total_sleep_min % 60).padStart(2, "0")}</div>
                <div className="text-xs text-zinc-400">Durée totale</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-900">{sleep.sleep_score}/100</div>
                <div className="text-xs text-zinc-400">Score sommeil</div>
              </div>
            </div>
            <div className="space-y-1.5 mb-3">
              {[
                { label: "Profond", min: sleep.deep_sleep_min, color: "bg-indigo-500" },
                { label: "REM", min: sleep.rem_sleep_min, color: "bg-violet-400" },
                { label: "Léger", min: sleep.total_sleep_min - sleep.deep_sleep_min - sleep.rem_sleep_min, color: "bg-blue-300" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500 w-12">{s.label}</span>
                  <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className={`h-full ${s.color} rounded-full`} style={{ width: `${Math.min(100, (s.min / sleep.total_sleep_min) * 100)}%` }} />
                  </div>
                  <span className="text-zinc-600 w-10 text-right">{Math.floor(s.min / 60)}h{String(s.min % 60).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <BatteryCharging className="w-4 h-4 text-green-500" />
              <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${sleep.body_battery_end}%` }} />
              </div>
              <span className="text-sm font-bold text-zinc-700">{sleep.body_battery_end}%</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1">Body Battery</div>
          </motion.div>
        )}

        {/* Next session */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}
          className="col-span-12 md:col-span-4 bento-card"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="metric-label">Prochaine Séance</div>
            <Calendar className="w-4 h-4 text-zinc-400" />
          </div>
          {plan ? (
            <div>
              <div className="font-semibold text-zinc-900 text-base">Sortie Longue</div>
              <div className="text-sm text-zinc-500 mt-1">Dimanche · Zone 2 · 25 km</div>
              <div className="mt-3 flex gap-2">
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg font-medium">Z2</span>
                <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-lg font-medium">25 km</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg font-medium">2h20</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-400">Aucun plan actif. Cherchez une course cible.</div>
          )}
        </motion.div>

        {/* Last workout biomechanics — Elite only */}
        {mode === "elite" && workouts[0] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="col-span-12 md:col-span-8 bento-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Footprints className="w-4 h-4 text-zinc-500" />
              <div className="metric-label">Biomécanique — Dernière Séance</div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Cadence", value: workouts[0].avg_cadence_spm ?? "--", unit: "SPM" },
                { label: "Oscillation", value: workouts[0].vertical_oscillation_cm ?? "--", unit: "cm" },
                { label: "Contact sol", value: workouts[0].ground_contact_time_ms ?? workouts[0].ground_contact_ms ?? "--", unit: "ms" },
                { label: "Puissance", value: workouts[0].avg_power_watts ?? "--", unit: "W" },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <div className="text-2xl font-bold text-zinc-900">{m.value}</div>
                  <div className="text-xs text-zinc-400">{m.unit}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Fun mode — Battery widget */}
        {mode === "ludique" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="col-span-12 md:col-span-8 bento-card"
          >
            <div className="metric-label mb-3">Jauge de Forme Physique</div>
            <div className="flex items-center gap-4">
              <div className="text-5xl">
                {disciplineScore >= 80 ? "🔋" : disciplineScore >= 50 ? "🪫" : "⚡"}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-700">
                    {disciplineScore >= 80 ? "Plein d'énergie !" : disciplineScore >= 50 ? "Bonne forme" : "Récupération conseillée"}
                  </span>
                  <span className="font-bold text-zinc-900">{Math.round(disciplineScore)}%</span>
                </div>
                <div className="h-4 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${disciplineScore}%`,
                      backgroundColor: disciplineScore >= 80 ? "#22c55e" : disciplineScore >= 50 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-zinc-400 mt-1.5">
                  <span>Épuisé</span><span>Super forme</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Recent workouts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.40 }}
          className="col-span-12 bento-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="metric-label">Activités Récentes</div>
            <a href="/dashboard/workouts" className="text-xs text-green-600 font-medium hover:text-green-700">
              Tout voir →
            </a>
          </div>
          {workouts.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-sm">
              Aucune activité pour l&apos;instant. Synchronisez votre montre ou ajoutez une séance.
            </div>
          ) : (
            <div className="space-y-2">
              {workouts.slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-50 transition-colors">
                  <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-zinc-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 text-sm truncate">{w.title}</div>
                    <div className="text-xs text-zinc-400">
                      {new Date(w.date).toLocaleDateString("fr", { weekday: "long", day: "numeric", month: "short" })}
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
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center px-3 py-2 bg-white border border-zinc-200 rounded-xl shadow-sm">
      <div className="text-xs text-zinc-500 font-medium">{label}</div>
      <div className="font-bold text-zinc-900 mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}
