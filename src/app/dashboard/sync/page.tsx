"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Watch, RefreshCw, CheckCircle2, Activity,
  Zap, Heart, Moon, Battery,
  AlertCircle, ChevronRight, Upload, Info, WifiOff, Clock,
  Key, Eye, EyeOff, Trash2, ExternalLink,
  ArrowDown, MousePointerClick, Settings2, Link2, Code2, Sparkles
} from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { SY, SY_NODES, fillY } from "./syncI18n";
import { cleanActivityName } from "@/lib/utils/activityName";

// ── Types ──────────────────────────────────────────────────────────────────────
interface SyncStats {
  workouts: number;
  hrv: number;
  sleep: number;
  period?: { oldest: string; newest: string };
  fetched?: { activities: number; wellness: number };
  valid_activities?: number;
  errors?: string[];
  raw_sample?: { id: string; type: string; name: string; start_date_local: string; distance: number }[];
}

interface RecentActivity {
  id: string;
  name?: string;
  type?: string;
  date?: string;
  distance_km?: number;
  duration_min?: number;
  avg_hr?: number;
  tss?: number;
  training_effect?: number;
  vertical_oscillation_cm?: number;
  ground_contact_time_ms?: number;
}

interface WellnessDay {
  date: string;
  hrv?: number;
  sleep_h?: number;
  sleep_score?: number;
  body_battery?: number;
  spo2?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

function activityIcon(type?: string) {
  if (!type) return "🏃";
  if (type.toLowerCase().includes("trail")) return "🏔";
  if (type.toLowerCase().includes("run")) return "🏃";
  if (type.toLowerCase().includes("ride")) return "🚴";
  if (type.toLowerCase().includes("swim")) return "🏊";
  if (type.toLowerCase().includes("hike")) return "🥾";
  return "⚡";
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function SyncPage() {
  const { lang } = useT();
  const d = SY[lang] ?? SY.fr;
  const ty = (k: string, p?: Record<string, string | number>) => fillY(d[k] ?? k, p);
  const nodes = SY_NODES[lang] ?? SY_NODES.fr;
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0); // 0-100
  const [syncResult, setSyncResult] = useState<SyncStats | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [wellness, setWellness] = useState<WellnessDay[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"activities" | "wellness" | "setup">("activities");

  // Credentials form state
  const [credsAthleteId, setCredsAthleteId] = useState("");
  const [credsApiKey, setCredsApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsError, setCredsError] = useState<string | null>(null);
  const [credsSaved, setCredsSaved] = useState(false);
  const [existingCreds, setExistingCreds] = useState<{ athleteId: string | null; apiKeyMasked: string | null } | null>(null);

  function checkStatus() {
    fetch("/api/intervals/status")
      .then(r => r.json())
      .then(d => setConfigured(d.configured ?? false))
      .catch(() => setConfigured(false));
  }

  // Check if Intervals.icu is configured
  useEffect(() => {
    checkStatus();
    // Load existing credentials (masked)
    fetch("/api/intervals/credentials")
      .then(r => r.json())
      .then(d => {
        setExistingCreds({ athleteId: d.athleteId, apiKeyMasked: d.apiKeyMasked });
        if (d.athleteId) setCredsAthleteId(d.athleteId);
      })
      .catch(() => {});
  }, []);

  // ── Smart validation — catches the most common mistakes ──
  const idTrim = credsAthleteId.trim();
  const keyTrim = credsApiKey.trim();
  const idValid = /^i\d{3,}$/i.test(idTrim);
  const idHint =
    idTrim === "" ? null :
    idTrim.includes("@") ? d["hint.idEmail"] :
    !idTrim.toLowerCase().startsWith("i") ? d["hint.idStart"] :
    !idValid ? d["hint.idFormat"] :
    null;
  const keyValid = /^[a-z0-9]{16,}$/i.test(keyTrim);
  const keyHint =
    keyTrim === "" ? null :
    keyTrim.length < 20 && /[A-Z!?@#$%^&*]/.test(keyTrim) ? d["hint.keyPwd"] :
    !keyValid ? d["hint.keyLen"] :
    null;
  // When updating existing creds, an empty key field is allowed (keep current)
  const keyFieldOk = keyTrim === "" ? !!existingCreds?.athleteId : keyValid;

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSavingCreds(true);
    setCredsError(null);
    setCredsSaved(false);
    try {
      const res = await fetch("/api/intervals/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: credsAthleteId, apiKey: credsApiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? d["err.save"]);
      setCredsSaved(true);
      setCredsApiKey("");
      setExistingCreds({ athleteId: credsAthleteId, apiKeyMasked: credsApiKey.slice(0, 4) + "●●●●●●●●●●●●" });
      checkStatus();
    } catch (err) {
      setCredsError(String(err).replace("Error: ", ""));
    } finally {
      setSavingCreds(false);
    }
  }

  async function handleDeleteCredentials() {
    if (!confirm(d["cf.delete"])) return;
    await fetch("/api/intervals/credentials", { method: "DELETE" });
    setCredsAthleteId("");
    setCredsApiKey("");
    setExistingCreds(null);
    setCredsSaved(false);
    checkStatus();
  }

  // Load recent data from Supabase
  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [actRes, wellRes] = await Promise.all([
        fetch(`/api/intervals/data?type=activities&days=${days}`),
        fetch(`/api/intervals/data?type=wellness&days=${days}`),
      ]);
      if (actRes.ok) { const d = await actRes.json(); setActivities(d.activities ?? []); }
      if (wellRes.ok) { const d = await wellRes.json(); setWellness(d.wellness ?? []); }
    } finally {
      setLoadingData(false);
    }
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    setSyncProgress(0);

    // Split into 90-day chunks to avoid Railway 30s timeout
    const CHUNK = 90;
    const chunks: { oldest: string; newest: string }[] = [];
    const now = new Date();
    for (let offset = 0; offset < days; offset += CHUNK) {
      const chunkDays = Math.min(CHUNK, days - offset);
      const newest = new Date(now.getTime() - offset * 86400000);
      const oldest = new Date(now.getTime() - (offset + chunkDays) * 86400000);
      chunks.unshift({
        oldest: oldest.toISOString().split("T")[0],
        newest: newest.toISOString().split("T")[0],
      });
    }

    const totals = { workouts: 0, hrv: 0, sleep: 0 };
    const allErrors: string[] = [];

    try {
      for (let i = 0; i < chunks.length; i++) {
        const { oldest, newest } = chunks[i];
        const res = await fetch(`/api/intervals/sync?oldest=${oldest}&newest=${newest}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? d["err.sync"]);
        totals.workouts += data.synced?.workouts ?? 0;
        totals.hrv += data.synced?.hrv ?? 0;
        totals.sleep += data.synced?.sleep ?? 0;
        if (data.errors?.length) allErrors.push(...data.errors);
        setSyncProgress(Math.round(((i + 1) / chunks.length) * 100));
      }

      setSyncResult({ ...totals, errors: allErrors });
      setLastSyncTime(new Date().toLocaleString(lang));
      await loadData();
    } catch (e) {
      setSyncError(String(e).replace("Error: ", ""));
    } finally {
      setSyncing(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/intervals/import-gpx", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        alert(ty("al.imported", { name: data.name ?? file.name }));
        loadData();
      } else {
        alert(ty("al.importErr", { e: data.error }));
      }
    } catch {
      alert(d["al.importFail"]);
    }
  }

  return (
    <div>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 text-white shadow-[0_10px_26px_-10px_rgba(16,24,40,0.6)]">
              <Watch className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{d["title"]}</h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Garmin · COROS · Polar via <strong className="font-semibold text-zinc-600">Intervals.icu</strong>
              </p>
            </div>
          </div>

          {/* Connection status */}
          <div className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold ${
            configured === null ? "border-zinc-200 bg-zinc-50 text-zinc-500" :
            configured ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
            "border-red-200 bg-red-50 text-red-700"
          }`}>
            {configured === null ? <RefreshCw className="h-4 w-4 animate-spin" /> :
             configured ? (
               <span className="relative flex h-2.5 w-2.5">
                 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                 <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
               </span>
             ) : <WifiOff className="h-4 w-4" />}
            {configured === null ? d["st.checking"] :
             configured ? d["st.connected"] :
             d["st.notConfigured"]}
          </div>
        </div>

        {/* ── Sync bar ── */}
        <div className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_14px_36px_-22px_rgba(16,24,40,0.18)]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-zinc-600">{d["period"]}</label>
              {[7, 14, 30, 90, 365, 730].map(n => {
                const active = days === n;
                return (
                  <button key={n} onClick={() => setDays(n)}
                    className={`relative rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
                    {active && <motion.span layoutId="sync-period-pill" transition={{ type: "spring", stiffness: 460, damping: 34 }} className="absolute inset-0 rounded-xl bg-zinc-900" />}
                    <span className="relative">{n >= 730 ? d["p.2y"] : n >= 365 ? d["p.1y"] : n >= 90 ? d["p.3m"] : ty("p.dayN", { d: n })}</span>
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex items-center gap-3">
              {syncing && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-200">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600" animate={{ width: `${syncProgress}%` }} transition={{ duration: 0.4 }} />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold tabular-nums text-zinc-600">{syncProgress}%</span>
                </div>
              )}
              <button
                onClick={handleSync}
                disabled={syncing || !configured}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(16,24,40,0.5)] transition-all hover:shadow-[0_10px_22px_-8px_rgba(16,24,40,0.6)] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? d["syncing"] : d["syncNow"]}
              </button>
            </div>
          </div>

          {/* Results */}
          {syncResult && (
            <div className="mt-4 flex items-center gap-6 pt-4 border-t border-zinc-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div className="flex gap-6 text-sm flex-wrap">
                <span><strong className="text-zinc-900">{syncResult.workouts}</strong> <span className="text-zinc-500">{d["r.saved"]}</span></span>
                <span><strong className="text-zinc-900">{syncResult.hrv}</strong> <span className="text-zinc-500">{d["r.hrv"]}</span></span>
                <span><strong className="text-zinc-900">{syncResult.sleep}</strong> <span className="text-zinc-500">{d["r.nights"]}</span></span>
                {syncResult.fetched && syncResult.fetched.activities > 0 && syncResult.workouts === 0 && (
                  <span className="text-amber-600 text-xs">{ty("r.warnReceived", { a: syncResult.fetched.activities, v: syncResult.valid_activities ?? 0 })}</span>
                )}
                {syncResult.fetched && syncResult.fetched.activities === 0 && (
                  <span className="text-amber-600 text-xs">{d["r.warnZero"]}</span>
                )}
              </div>
              {lastSyncTime && <span className="ml-auto text-xs text-zinc-400">{ty("r.lastSync", { t: lastSyncTime })}</span>}
            </div>
          )}

          {syncError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {syncError}
            </div>
          )}

          {/* Sync errors (if any) */}
          {syncResult && syncResult.errors && syncResult.errors.length > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs text-red-700">
              <span className="font-semibold">{ty("r.errors", { n: syncResult.errors.length })}</span>{syncResult.errors[0]}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex w-fit gap-1 rounded-2xl bg-zinc-100/80 p-1 ring-1 ring-zinc-200/60">
          {([
            { key: "activities", label: d["tab.activities"], icon: Activity },
            { key: "wellness", label: d["tab.wellness"], icon: Heart },
            { key: "setup", label: d["tab.setup"], icon: Zap },
          ] as const).map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`relative flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}>
                {active && <motion.span layoutId="sync-tab-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl bg-white shadow-sm" />}
                <span className="relative flex items-center gap-1.5"><Icon className="h-4 w-4" />{label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Activities tab ── */}
        {activeTab === "activities" && (
          <div className="space-y-4">
            {/* Upload GPX */}
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-5 transition-colors hover:border-zinc-400">
              <label className="group flex cursor-pointer items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-500 transition-colors group-hover:from-zinc-200 group-hover:to-zinc-300">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{d["gpx.title"]}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{d["gpx.sub"]}</p>
                </div>
                <input type="file" accept=".gpx,.fit" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            {/* Activities list */}
            {loadingData ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-300" />
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-zinc-200 bg-white py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100 ring-1 ring-zinc-100"><Activity className="h-7 w-7 text-zinc-300" /></div>
                <p className="mt-3 text-sm text-zinc-400">{d["act.empty"]}</p>
              </div>
            ) : (
              <>
              {/* Résumé de la période (distance / temps / FC moy) */}
              {(() => {
                const totalKm = activities.reduce((s, a) => s + (a.distance_km ?? 0), 0);
                const totalMin = activities.reduce((s, a) => s + (a.duration_min ?? 0), 0);
                const hrs = activities.map((a) => a.avg_hr).filter((h): h is number => !!h);
                const avgHr = hrs.length ? Math.round(hrs.reduce((s, h) => s + h, 0) / hrs.length) : null;
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-emerald-50 p-4 text-center">
                      <Activity className="mx-auto mb-1.5 h-5 w-5 text-emerald-500" />
                      <div className="text-2xl font-bold tabular-nums text-emerald-700">{Math.round(totalKm)}</div>
                      <div className="text-xs text-zinc-500">km</div>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-4 text-center">
                      <Clock className="mx-auto mb-1.5 h-5 w-5 text-blue-500" />
                      <div className="text-2xl font-bold tabular-nums text-blue-700">{fmtDuration(totalMin * 60)}</div>
                      <div className="text-xs text-zinc-500">{d["u.duration"]}</div>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-red-50 p-4 text-center">
                      <Heart className="mx-auto mb-1.5 h-5 w-5 text-rose-500" />
                      <div className="text-2xl font-bold tabular-nums text-rose-600">{avgHr ?? "—"}</div>
                      <div className="text-xs text-zinc-500">{d["u.avgHr"]}</div>
                    </div>
                  </div>
                );
              })()}
              <div className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_14px_36px_-24px_rgba(16,24,40,0.16)]">
                <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
                  <h2 className="text-sm font-semibold text-zinc-900">{ty("act.count", { n: activities.length })}</h2>
                  <span className="text-xs text-zinc-400">{ty("act.over", { d: days })}</span>
                </div>
                <div className="divide-y divide-zinc-50">
                  {activities.map((act, i) => (
                    <motion.div key={act.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.25), duration: 0.2 }}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg">{activityIcon(act.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{cleanActivityName(act.name) || act.type || d["act.fallback"]}</p>
                        <p className="text-xs text-zinc-400">{act.date}</p>
                      </div>
                      <div className="flex items-center gap-5 text-xs text-zinc-500">
                        {act.distance_km && (
                          <div className="text-center">
                            <div className="font-semibold text-zinc-800">{act.distance_km.toFixed(1)}</div>
                            <div>km</div>
                          </div>
                        )}
                        {act.duration_min && (
                          <div className="text-center">
                            <div className="font-semibold text-zinc-800">{fmtDuration(act.duration_min * 60)}</div>
                            <div>{d["u.duration"]}</div>
                          </div>
                        )}
                        {act.avg_hr && (
                          <div className="text-center">
                            <div className="font-semibold text-red-500">{act.avg_hr}</div>
                            <div>{d["u.avgHr"]}</div>
                          </div>
                        )}
                        {act.tss && (
                          <div className="text-center">
                            <div className="font-semibold text-violet-600">{act.tss}</div>
                            <div>TSS</div>
                          </div>
                        )}
                        {act.training_effect && (
                          <div className={`text-center font-bold ${act.training_effect >= 4 ? "text-red-500" : act.training_effect >= 3 ? "text-orange-500" : "text-emerald-500"}`}>
                            <div>{act.training_effect.toFixed(1)}</div>
                            <div className="font-normal">TE</div>
                          </div>
                        )}
                      </div>
                      {/* Biomechanics badge */}
                      {(act.vertical_oscillation_cm || act.ground_contact_time_ms) && (
                        <div className="flex gap-1.5">
                          {act.vertical_oscillation_cm && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                              {act.vertical_oscillation_cm.toFixed(1)}cm osc
                            </span>
                          )}
                          {act.ground_contact_time_ms && (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                              {act.ground_contact_time_ms}ms GCT
                            </span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {/* ── Wellness tab ── */}
        {activeTab === "wellness" && (
          <div className="space-y-4">
            {loadingData ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-zinc-300" />
              </div>
            ) : wellness.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200 py-16 text-center">
                <Heart className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">{d["well.empty"]}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-100">
                  <h2 className="font-semibold text-zinc-900 text-sm">{ty("well.count", { n: wellness.length })}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-zinc-400 border-b border-zinc-100">
                        <th className="text-left px-5 py-2.5 font-medium">{d["th.date"]}</th>
                        <th className="text-center px-3 py-2.5 font-medium">
                          <span className="flex items-center justify-center gap-1"><Heart className="w-3 h-3" />{d["th.hrv"]}</span>
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium">
                          <span className="flex items-center justify-center gap-1"><Moon className="w-3 h-3" />{d["th.sleep"]}</span>
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium">{d["th.score"]}</th>
                        <th className="text-center px-3 py-2.5 font-medium">
                          <span className="flex items-center justify-center gap-1"><Battery className="w-3 h-3" />BB</span>
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium">SpO2</th>
                        <th className="text-center px-3 py-2.5 font-medium">{d["th.state"]}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {wellness.map((w) => {
                        const state = !w.hrv ? null
                          : w.hrv > 80 ? { label: d["state.optimal"], color: "text-emerald-600 bg-emerald-50" }
                          : w.hrv > 55 ? { label: d["state.correct"], color: "text-blue-600 bg-blue-50" }
                          : { label: d["state.recup"], color: "text-orange-600 bg-orange-50" };
                        return (
                          <tr key={w.date} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-5 py-3 text-zinc-700 font-medium">
                              {new Date(w.date + "T12:00:00").toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" })}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {w.hrv ? <span className={`font-bold ${w.hrv > 80 ? "text-emerald-600" : w.hrv > 55 ? "text-blue-600" : "text-orange-500"}`}>{w.hrv} ms</span> : <span className="text-zinc-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {w.sleep_h ? <span className="font-semibold text-zinc-800">{w.sleep_h.toFixed(1)}h</span> : <span className="text-zinc-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {w.sleep_score ? (
                                <span className={`font-semibold ${w.sleep_score >= 80 ? "text-emerald-600" : w.sleep_score >= 60 ? "text-yellow-600" : "text-red-500"}`}>
                                  {w.sleep_score}/100
                                </span>
                              ) : <span className="text-zinc-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {w.body_battery ? <span className="font-semibold text-violet-600">{w.body_battery}</span> : <span className="text-zinc-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {w.spo2 ? <span className="font-medium text-zinc-700">{w.spo2.toFixed(1)}%</span> : <span className="text-zinc-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {state && <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${state.color}`}>{state.label}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Setup tab ── */}
        {activeTab === "setup" && (
          <div className="space-y-4">

            {/* ── Already connected banner ── */}
            {configured && existingCreds?.athleteId && (
              <div className="bg-gradient-to-r from-emerald-50 to-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-800 text-sm">{d["connected.title"]}</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {d["acc.word"]} <span className="font-mono font-semibold">{existingCreds.athleteId}</span> · {d["key.word"]} <span className="font-mono">{existingCreds.apiKeyMasked}</span>
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {nodes.connectedHint}
                  </p>
                </div>
                <button onClick={handleDeleteCredentials}
                  className="text-emerald-600 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 flex-shrink-0"
                  title={d["disconnect"]}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── Guided wizard ── */}
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
              {/* Wizard header */}
              <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 px-6 py-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Watch className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg leading-tight">{d["wiz.title"]}</h2>
                    <p className="text-zinc-300 text-sm mt-0.5">{d["wiz.sub"]}</p>
                  </div>
                </div>
                {/* Flow diagram */}
                <div className="flex items-center justify-center gap-2 mt-5 text-xs font-medium">
                  <span className="px-3 py-1.5 bg-white/10 rounded-lg flex items-center gap-1.5"><Watch className="w-3.5 h-3.5" /> {d["wiz.yourWatch"]}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                  <span className="px-3 py-1.5 bg-white/10 rounded-lg">Intervals.icu</span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                  <span className="px-3 py-1.5 bg-emerald-500/90 rounded-lg flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> {d["wiz.thisApp"]}</span>
                </div>
              </div>

              {/* Steps timeline */}
              <div className="p-6 space-y-0">
                {/* STEP 1 */}
                <div className="relative pl-14 pb-8">
                  <div className="absolute left-0 top-0 w-9 h-9 bg-zinc-900 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                  <div className="absolute left-[17px] top-9 bottom-0 w-0.5 bg-zinc-100" />
                  <h3 className="font-semibold text-zinc-900 text-sm">{d["s1.title"]}</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {d["s1.desc"]}
                  </p>
                  {/* La landing affiche désormais le logo Apple Watch. Sans cette ligne,
                      l'athlète venu pour ça arrivait sur un guide qui ne nomme que Garmin,
                      COROS, Polar et Suunto — et repartait. */}
                  <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-500">
                    {d["s1.apple"]}
                  </p>
                  <a href="https://intervals.icu" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-700 px-3 py-2 rounded-lg mt-3 transition-colors">
                    {d["s1.cta"]} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* STEP 2 */}
                <div className="relative pl-14 pb-8">
                  <div className="absolute left-0 top-0 w-9 h-9 bg-zinc-900 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                  <div className="absolute left-[17px] top-9 bottom-0 w-0.5 bg-zinc-100" />
                  <h3 className="font-semibold text-zinc-900 text-sm">{d["s2.title"]}</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {nodes.s2desc}
                  </p>
                  {/* Mini mockup: connections cards */}
                  <div className="mt-3 bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-2">
                      <Settings2 className="w-3 h-3" /> {d["s2.settings"]}
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-zinc-600 font-semibold">{d["s2.connections"]}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {["Garmin", "COROS", "Polar"].map((b, i) => (
                        <div key={b} className={`rounded-lg border p-2 text-center text-[11px] font-semibold ${i === 0 ? "border-blue-300 bg-blue-50 text-blue-700 ring-2 ring-blue-200" : "border-zinc-200 bg-white text-zinc-500"}`}>
                          {b}
                          {i === 0 && <div className="flex items-center justify-center gap-0.5 mt-1 text-[10px] text-blue-500 font-normal"><MousePointerClick className="w-3 h-3" /> {d["s2.click"]}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <a href="https://intervals.icu/settings#connections" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline mt-2.5">
                    <Link2 className="w-3.5 h-3.5" /> {d["s2.cta"]}
                  </a>
                </div>

                {/* STEP 3 */}
                <div className="relative pl-14 pb-8">
                  <div className="absolute left-0 top-0 w-9 h-9 bg-zinc-900 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                  <div className="absolute left-[17px] top-9 bottom-0 w-0.5 bg-zinc-100" />
                  <h3 className="font-semibold text-zinc-900 text-sm">{d["s3.title"]}</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {nodes.s3desc}
                  </p>
                  {/* Annotated browser-window mockup: developer settings */}
                  <div className="mt-3 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-zinc-50 border-b border-zinc-100 px-3 py-2 flex items-center gap-1.5">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-300" />
                        <span className="w-2 h-2 rounded-full bg-amber-300" />
                        <span className="w-2 h-2 rounded-full bg-emerald-300" />
                      </div>
                      <span className="text-[10px] text-zinc-400 ml-1 flex items-center gap-1"><Code2 className="w-3 h-3" /> intervals.icu — {d["s3.devAccess"]}</span>
                    </div>
                    <div className="p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-blue-50 border-2 border-blue-300 rounded-lg px-3 py-2 animate-pulse">
                          <p className="text-[10px] text-blue-400 font-medium">Athlete ID</p>
                          <p className="font-mono text-sm font-bold text-blue-700">i564686</p>
                        </div>
                        <div className="flex items-center gap-1 text-blue-500 w-20">
                          <ArrowDown className="w-4 h-4 flex-shrink-0 rotate-90" />
                          <span className="text-[11px] font-semibold leading-tight">{d["s3.code1"]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-2 animate-pulse">
                          <p className="text-[10px] text-emerald-500 font-medium">API Key</p>
                          <p className="font-mono text-xs font-bold text-emerald-700 truncate">a1b2c3d4e5f6…</p>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-600 w-20">
                          <ArrowDown className="w-4 h-4 flex-shrink-0 rotate-90" />
                          <span className="text-[11px] font-semibold leading-tight">{d["s3.code2"]}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Common-mistake warnings */}
                  <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-2.5 space-y-1">
                    <p className="text-[11px] text-amber-700 flex items-start gap-1.5"><span>❌</span> <span>{nodes.s3warn1}</span></p>
                    <p className="text-[11px] text-amber-700 flex items-start gap-1.5"><span>👉</span> <span>{nodes.s3warn2}</span></p>
                  </div>
                  <a href="https://intervals.icu/settings#developer" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline mt-2.5">
                    <Link2 className="w-3.5 h-3.5" /> {d["s3.cta"]}
                  </a>
                </div>

                {/* STEP 4 — the form */}
                <div className="relative pl-14">
                  <div className={`absolute left-0 top-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${configured ? "bg-emerald-500 text-white" : "bg-zinc-900 text-white"}`}>
                    {configured ? <CheckCircle2 className="w-5 h-5" /> : "4"}
                  </div>
                  <h3 className="font-semibold text-zinc-900 text-sm">{d["s4.title"]}</h3>
                  <p className="text-sm text-zinc-500 mt-1 mb-3">
                    {d["s4.desc"]}
                  </p>

                  <form onSubmit={handleSaveCredentials} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-600 block mb-1.5">
                          1️⃣ Athlete ID <span className="text-zinc-400">{d["f.athleteHint"]}</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={credsAthleteId}
                            onChange={e => setCredsAthleteId(e.target.value)}
                            placeholder="i000000"
                            required
                            className={`w-full px-3 py-2.5 pr-9 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
                              idHint ? "border-red-300 focus:ring-red-400 bg-red-50/40" :
                              idValid ? "border-emerald-300 focus:ring-emerald-400 bg-emerald-50/40" :
                              "border-zinc-200 focus:ring-zinc-900 bg-white"
                            }`}
                          />
                          {idValid && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                          {idHint && <AlertCircle className="w-4 h-4 text-red-400 absolute right-3 top-1/2 -translate-y-1/2" />}
                        </div>
                        {idHint && <p className="text-[11px] text-red-500 mt-1 flex items-start gap-1"><span>⚠️</span>{idHint}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-600 block mb-1.5">
                          2️⃣ {d["f.apiKey"]} <span className="text-zinc-400">{d["f.apiKeyHint"]}</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={credsApiKey}
                            onChange={e => setCredsApiKey(e.target.value)}
                            placeholder={existingCreds?.apiKeyMasked ? d["f.keyPlaceholder"] : "a1b2c3d4e5f6…"}
                            required={!existingCreds?.athleteId}
                            className={`w-full px-3 py-2.5 pr-16 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
                              keyHint ? "border-red-300 focus:ring-red-400 bg-red-50/40" :
                              keyValid ? "border-emerald-300 focus:ring-emerald-400 bg-emerald-50/40" :
                              "border-zinc-200 focus:ring-zinc-900 bg-white"
                            }`}
                          />
                          {keyValid && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-9 top-1/2 -translate-y-1/2" />}
                          {keyHint && <AlertCircle className="w-4 h-4 text-red-400 absolute right-9 top-1/2 -translate-y-1/2" />}
                          <button type="button" onClick={() => setShowApiKey(v => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {keyHint && <p className="text-[11px] text-red-500 mt-1 flex items-start gap-1"><span>⚠️</span>{keyHint}</p>}
                      </div>
                    </div>

                    {credsError && (
                      <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {credsError}
                      </div>
                    )}
                    {credsSaved && (
                      <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        {d["f.saved"]}
                      </div>
                    )}

                    <button type="submit" disabled={savingCreds || !idValid || !keyFieldOk}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all">
                      {savingCreds ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {savingCreds ? d["f.checking"] : existingCreds?.athleteId ? d["f.update"] : d["f.connect"]}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Supported devices */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
              <h3 className="font-semibold text-zinc-900 text-sm mb-3">{d["dev.title"]}</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { logo: "G", name: "Garmin", color: "bg-blue-600", models: "Forerunner, Fenix, Epix, Enduro" },
                  { logo: "C", name: "COROS", color: "bg-orange-500", models: "APEX, VERTIX, PACE, PACE Pro" },
                  { logo: "P", name: "Polar", color: "bg-red-600", models: "Vantage, Grit X, Ignite, Pacer" },
                  { logo: "S", name: "Suunto", color: "bg-teal-600", models: "Race, Vertical, 9 Peak, 5 Peak" },
                  { logo: "W", name: "Wahoo", color: "bg-emerald-600", models: "ELEMNT, ROAM" },
                  { logo: "A", name: "Apple Health", color: "bg-zinc-800", models: "Apple Watch, iPhone" },
                ].map(d => (
                  <div key={d.name} className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50">
                    <div className={`w-8 h-8 ${d.color} text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0`}>{d.logo}</div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-800">{d.name}</p>
                      <p className="text-xs text-zinc-400 leading-tight mt-0.5">{d.models}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What's synced */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
              <h3 className="font-semibold text-zinc-900 text-sm mb-3">{d["sync.title"]}</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  [d["d1t"], d["d1d"]],
                  [d["d2t"], d["d2d"]],
                  [d["d3t"], d["d3d"]],
                  [d["d4t"], d["d4d"]],
                  [d["d5t"], d["d5d"]],
                  [d["d6t"], d["d6d"]],
                  [d["d7t"], d["d7d"]],
                  [d["d8t"], d["d8d"]],
                  [d["d9t"], d["d9d"]],
                ].map(([title, desc]) => (
                  <div key={String(title)} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-300 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-zinc-700">{title}</span>
                      <span className="text-zinc-400"> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-0.5">{d["priv.title"]}</p>
                <p>{d["priv.body"]}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
