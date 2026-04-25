"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Zap, MessageSquare, Send, CheckCircle, AlertCircle,
  RefreshCw, Database, Sparkles, Copy, ChevronDown
} from "lucide-react";

interface Athlete {
  id: string;
  full_name: string;
  email: string;
  discipline_score: number;
  league: string;
  subscription_tier: string;
}

interface GeminiAnalysis {
  summary?: string;
  weekly_km?: number;
  weekly_tss?: number;
  avg_hrv?: number;
  avg_sleep_score?: number;
  avg_body_battery?: number;
  training_load?: string;
  recovery_status?: string;
  biomechanics_analysis?: string;
  power_analysis?: string;
  sleep_quality_analysis?: string;
  hrv_trend?: string;
  strengths?: string[];
  areas_to_improve?: string[];
  next_week_recommendation?: string;
  risk_flags?: string[];
}

export function AdminWorkflow() {
  const [adminSecret, setAdminSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [weekStart, setWeekStart] = useState(getMondayISO());
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiAnalysis | null>(null);
  const [coachAdvice, setCoachAdvice] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [claudeModel, setClaudeModel] = useState<string | null>(null);
  const [showMigration, setShowMigration] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ ok: number; failed: number } | null>(null);

  function flash(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  async function authenticate() {
    setLoading("auth");
    const res = await fetch("/api/admin/athletes", {
      headers: { "x-admin-secret": adminSecret },
    });
    if (res.ok) {
      const { athletes: data } = await res.json();
      setAthletes(data);
      setAuthenticated(true);
    } else {
      flash("error", "Secret incorrect");
    }
    setLoading(null);
  }

  async function generateGeminiReport() {
    if (!selectedAthlete) return;
    setLoading("gemini");
    setGeminiAnalysis(null);
    setCoachAdvice("");
    const res = await fetch("/api/admin/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
      body: JSON.stringify({ user_id: selectedAthlete.id, week_start: weekStart }),
    });
    if (res.ok) {
      const { gemini_analysis } = await res.json();
      setGeminiAnalysis(gemini_analysis);
      flash("success", "Rapport Gemini Flash généré ✓");
    } else {
      flash("error", "Erreur Gemini API");
    }
    setLoading(null);
  }

  async function generateClaudeAdvice() {
    if (!selectedAthlete || !geminiAnalysis) return;
    setLoading("claude");
    const res = await fetch("/api/admin/claude-advice", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
      body: JSON.stringify({
        athlete_name: selectedAthlete.full_name,
        gemini_analysis: geminiAnalysis,
        week_start: weekStart,
      }),
    });
    if (res.ok) {
      const { advice, model } = await res.json();
      setCoachAdvice(advice);
      setClaudeModel(model);
      flash("success", `Conseil Claude généré (${model}) ✓`);
    } else {
      const { error } = await res.json();
      flash("error", error ?? "Erreur Claude API");
    }
    setLoading(null);
  }

  async function publishAdvice(publish: boolean) {
    if (!selectedAthlete || !coachAdvice) return;
    setLoading("publish");
    const res = await fetch("/api/admin/advice", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
      body: JSON.stringify({ user_id: selectedAthlete.id, week_start: weekStart, coach_advice: coachAdvice, publish }),
    });
    if (res.ok) {
      flash("success", publish ? "Conseil publié à l'athlète ✓" : "Brouillon sauvegardé");
    } else {
      flash("error", "Erreur de sauvegarde");
    }
    setLoading(null);
  }

  async function runMigration() {
    setLoading("migration");
    try {
      const res = await fetch("/api/admin/migrate-full", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret },
      });
      const data = await res.json();
      setMigrationResult({ ok: data.ok, failed: data.failed });
      flash(data.failed === 0 ? "success" : "error", `Migration: ${data.ok} OK, ${data.failed} erreurs`);
    } catch {
      flash("error", "Erreur migration");
    }
    setLoading(null);
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          <h2 className="text-xl font-bold mb-6 text-center">Accès Admin</h2>
          <input
            type="password"
            placeholder="Secret admin"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && authenticate()}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 mb-4 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={authenticate}
            disabled={loading === "auth"}
            className="w-full bg-white text-zinc-900 font-semibold rounded-xl py-3 text-sm hover:bg-zinc-100 transition disabled:opacity-50"
          >
            {loading === "auth" ? "Vérification…" : "Se connecter"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Migration banner ── */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
        <button
          onClick={() => setShowMigration(s => !s)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Database className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-zinc-300">Base de données — Schéma long terme</span>
            {migrationResult && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${migrationResult.failed === 0 ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300"}`}>
                {migrationResult.ok} OK · {migrationResult.failed} erreurs
              </span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showMigration ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {showMigration && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-zinc-800 px-6 py-5"
            >
              <p className="text-xs text-zinc-500 mb-4">
                Crée/met à jour les tables: workouts, hrv_data, sleep_data, power_zone_distribution,
                performance_baselines, weather_history, weekly_summaries, ai_advice, user_routes.
                Toutes les opérations sont idempotentes (IF NOT EXISTS).
              </p>
              <button
                onClick={runMigration}
                disabled={loading === "migration"}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition disabled:opacity-50"
              >
                <Database className={`w-4 h-4 ${loading === "migration" ? "animate-pulse" : ""}`} />
                {loading === "migration" ? "Migration en cours…" : "Lancer la migration complète"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main 3-col workflow ── */}
      <div className="grid grid-cols-3 gap-6">
        {/* Column 1: Athlete selector */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-zinc-400" />
            <h2 className="font-semibold text-sm text-zinc-300">Athlètes ({athletes.length})</h2>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {athletes.map((a) => (
              <button
                key={a.id}
                onClick={() => { setSelectedAthlete(a); setGeminiAnalysis(null); setCoachAdvice(""); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                  selectedAthlete?.id === a.id
                    ? "bg-white text-zinc-900"
                    : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <div className="font-medium">{a.full_name}</div>
                <div className={`text-xs mt-0.5 ${selectedAthlete?.id === a.id ? "text-zinc-600" : "text-zinc-500"}`}>
                  Score {a.discipline_score} · {a.league} · {a.subscription_tier}
                </div>
              </button>
            ))}
          </div>

          {selectedAthlete && (
            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Semaine (lundi)</label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                />
              </div>

              <button
                onClick={generateGeminiReport}
                disabled={loading === "gemini"}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Zap className={`w-4 h-4 ${loading === "gemini" ? "animate-spin" : ""}`} />
                {loading === "gemini" ? "Analyse Gemini…" : "1. Rapport Gemini Flash"}
              </button>

              {geminiAnalysis && (
                <button
                  onClick={generateClaudeAdvice}
                  disabled={loading === "claude"}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${loading === "claude" ? "animate-spin" : ""}`} />
                  {loading === "claude" ? "Claude rédige…" : "2. Générer conseil Claude"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Gemini analysis */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-violet-400" />
            <h2 className="font-semibold text-sm text-zinc-300">Analyse Gemini Flash</h2>
          </div>

          {!geminiAnalysis ? (
            loading === "gemini" ? (
              <div className="flex flex-col items-center justify-center gap-3 mt-16">
                <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
                <p className="text-xs text-zinc-500">Gemini analyse les données…</p>
              </div>
            ) : (
              <div className="text-zinc-600 text-sm text-center mt-12">
                Sélectionnez un athlète et lancez le rapport
              </div>
            )
          ) : (
            <div className="space-y-3 text-sm overflow-y-auto max-h-[420px] pr-1">
              <div className="grid grid-cols-2 gap-2">
                <MetricBadge label="Charge" value={geminiAnalysis.training_load ?? "—"} />
                <MetricBadge label="Récupération" value={geminiAnalysis.recovery_status ?? "—"} />
                <MetricBadge label="KM semaine" value={`${geminiAnalysis.weekly_km ?? "—"} km`} />
                <MetricBadge label="TSS" value={`${geminiAnalysis.weekly_tss ?? "—"}`} />
                <MetricBadge label="VFC moy" value={`${geminiAnalysis.avg_hrv ?? "—"} ms`} />
                <MetricBadge label="Sommeil" value={`${geminiAnalysis.avg_sleep_score ?? "—"}/100`} />
                <MetricBadge label="Body Bat." value={`${geminiAnalysis.avg_body_battery ?? "—"}/100`} />
                <MetricBadge label="Tendance VFC" value={geminiAnalysis.hrv_trend ?? "—"} />
              </div>

              {geminiAnalysis.summary && (
                <div className="mt-2 p-3 bg-zinc-800 rounded-xl">
                  <div className="text-xs text-zinc-500 mb-1">Synthèse</div>
                  <p className="text-zinc-300 text-xs leading-relaxed">{geminiAnalysis.summary}</p>
                </div>
              )}

              {geminiAnalysis.biomechanics_analysis && (
                <div className="p-3 bg-zinc-800 rounded-xl">
                  <div className="text-xs text-blue-400 mb-1">Biomécanique</div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{geminiAnalysis.biomechanics_analysis}</p>
                </div>
              )}

              {geminiAnalysis.power_analysis && (
                <div className="p-3 bg-zinc-800 rounded-xl">
                  <div className="text-xs text-yellow-400 mb-1">Puissance</div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{geminiAnalysis.power_analysis}</p>
                </div>
              )}

              {geminiAnalysis.strengths && geminiAnalysis.strengths.length > 0 && (
                <div className="p-3 bg-emerald-950 rounded-xl border border-emerald-900">
                  <div className="text-xs text-emerald-400 mb-1">✓ Points forts</div>
                  {geminiAnalysis.strengths.map((s, i) => (
                    <p key={i} className="text-xs text-zinc-300">• {s}</p>
                  ))}
                </div>
              )}

              {geminiAnalysis.areas_to_improve && geminiAnalysis.areas_to_improve.length > 0 && (
                <div className="p-3 bg-amber-950 rounded-xl border border-amber-900">
                  <div className="text-xs text-amber-400 mb-1">↑ À améliorer</div>
                  {geminiAnalysis.areas_to_improve.map((a, i) => (
                    <p key={i} className="text-xs text-zinc-300">• {a}</p>
                  ))}
                </div>
              )}

              {geminiAnalysis.risk_flags && geminiAnalysis.risk_flags.length > 0 && (
                <div className="p-3 bg-red-950 rounded-xl border border-red-900">
                  <div className="text-xs text-red-400 mb-1">⚠ Risques détectés</div>
                  {geminiAnalysis.risk_flags.map((r, i) => (
                    <p key={i} className="text-xs text-zinc-300">• {r}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 3: Claude Pro advice editor */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-orange-400" />
              <h2 className="font-semibold text-sm text-zinc-300">Conseil Coach</h2>
            </div>
            {claudeModel && (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{claudeModel}</span>
            )}
          </div>

          {loading === "claude" ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Sparkles className="w-8 h-8 text-orange-400 animate-pulse" />
              <p className="text-xs text-zinc-500">Claude rédige le conseil…</p>
            </div>
          ) : (
            <>
              <div className="relative flex-1 mb-4">
                <textarea
                  value={coachAdvice}
                  onChange={(e) => setCoachAdvice(e.target.value)}
                  placeholder="Générez d'abord le rapport Gemini, puis cliquez sur « Générer conseil Claude » — ou rédigez directement votre conseil."
                  className="w-full h-full min-h-[220px] bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600"
                />
                {coachAdvice && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(coachAdvice); flash("success", "Copié !"); }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors"
                    title="Copier"
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-300" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => publishAdvice(false)}
                  disabled={!coachAdvice || loading === "publish"}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-xl py-2.5 text-sm transition disabled:opacity-40"
                >
                  Brouillon
                </button>
                <button
                  onClick={() => publishAdvice(true)}
                  disabled={!coachAdvice || loading === "publish"}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  {loading === "publish" ? "Publication…" : "Publier"}
                </button>
              </div>
            </>
          )}

          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-3 flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${
                  message.type === "success"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                    : "bg-red-950 text-red-400 border border-red-900"
                }`}
              >
                {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────────
function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-800 rounded-xl px-3 py-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-semibold text-zinc-200 mt-0.5">{value}</div>
    </div>
  );
}

function getMondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
