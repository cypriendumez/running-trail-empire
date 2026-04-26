"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Watch, RefreshCw, CheckCircle2, Activity,
  Zap, Heart, Moon, Battery,
  AlertCircle, ChevronRight, Upload, Info, Wifi, WifiOff,
  Key, Eye, EyeOff, Trash2, ExternalLink
} from "lucide-react";

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
      if (!res.ok) throw new Error(data.error ?? "Erreur de sauvegarde");
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
    if (!confirm("Supprimer vos identifiants Intervals.icu ?")) return;
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
        if (!res.ok) throw new Error(data.error ?? "Erreur sync");
        totals.workouts += data.synced?.workouts ?? 0;
        totals.hrv += data.synced?.hrv ?? 0;
        totals.sleep += data.synced?.sleep ?? 0;
        if (data.errors?.length) allErrors.push(...data.errors);
        setSyncProgress(Math.round(((i + 1) / chunks.length) * 100));
      }

      setSyncResult({ ...totals, errors: allErrors });
      setLastSyncTime(new Date().toLocaleString("fr-FR"));
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
        alert(`✅ Importé: ${data.name ?? file.name}`);
        loadData();
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch {
      alert("Erreur lors de l'import");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center">
                <Watch className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-900">Sync Montre</h1>
            </div>
            <p className="text-zinc-500 text-sm ml-12">
              Garmin · COROS · Polar via <strong>Intervals.icu</strong>
            </p>
          </div>

          {/* Connection status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium border ${
            configured === null ? "bg-zinc-100 border-zinc-200 text-zinc-500" :
            configured ? "bg-green-50 border-green-200 text-green-700" :
            "bg-red-50 border-red-200 text-red-700"
          }`}>
            {configured === null ? <RefreshCw className="w-4 h-4 animate-spin" /> :
             configured ? <Wifi className="w-4 h-4" /> :
             <WifiOff className="w-4 h-4" />}
            {configured === null ? "Vérification…" :
             configured ? "Intervals.icu connecté" :
             "Non configuré"}
          </div>
        </div>

        {/* ── Sync bar ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-zinc-600">Période :</label>
              {[7, 14, 30, 90, 365].map(d => (
                <button key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    days === d ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}>
                  {d >= 365 ? "1 an" : d >= 90 ? "3 mois" : `${d}j`}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-3">
              {syncing && (
                <div className="flex items-center gap-2">
                  <div className="w-28 h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 w-8 text-right">{syncProgress}%</span>
                </div>
              )}
              <button
                onClick={handleSync}
                disabled={syncing || !configured}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
              </button>
            </div>
          </div>

          {/* Results */}
          {syncResult && (
            <div className="mt-4 flex items-center gap-6 pt-4 border-t border-zinc-100">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div className="flex gap-6 text-sm flex-wrap">
                <span><strong className="text-zinc-900">{syncResult.workouts}</strong> <span className="text-zinc-500">activités sauvegardées</span></span>
                <span><strong className="text-zinc-900">{syncResult.hrv}</strong> <span className="text-zinc-500">VFC</span></span>
                <span><strong className="text-zinc-900">{syncResult.sleep}</strong> <span className="text-zinc-500">nuits</span></span>
                {syncResult.fetched && syncResult.fetched.activities > 0 && syncResult.workouts === 0 && (
                  <span className="text-amber-600 text-xs">⚠️ {syncResult.fetched.activities} reçues · {syncResult.valid_activities ?? 0} valides · 0 sauvegardées</span>
                )}
                {syncResult.fetched && syncResult.fetched.activities === 0 && (
                  <span className="text-amber-600 text-xs">⚠️ Intervals.icu a renvoyé 0 activité sur cette période</span>
                )}
              </div>
              {lastSyncTime && <span className="ml-auto text-xs text-zinc-400">Dernière sync : {lastSyncTime}</span>}
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
              <span className="font-semibold">Erreurs ({syncResult.errors.length}) : </span>{syncResult.errors[0]}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-zinc-100 p-1 rounded-2xl w-fit">
          {([
            { key: "activities", label: "Activités", icon: Activity },
            { key: "wellness", label: "Bien-être", icon: Heart },
            { key: "setup", label: "Configuration", icon: Zap },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ── Activities tab ── */}
        {activeTab === "activities" && (
          <div className="space-y-4">
            {/* Upload GPX */}
            <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-5">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="w-10 h-10 bg-zinc-100 group-hover:bg-zinc-200 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                  <Upload className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-800">Importer un fichier GPX / FIT</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Glissez ou cliquez — exportez depuis Garmin Connect ou COROS Training Hub</p>
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
              <div className="bg-white rounded-2xl border border-zinc-200 py-16 text-center">
                <Activity className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">Aucune activité — synchronisez pour importer vos données</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <h2 className="font-semibold text-zinc-900 text-sm">{activities.length} activités</h2>
                  <span className="text-xs text-zinc-400">sur {days} jours</span>
                </div>
                <div className="divide-y divide-zinc-50">
                  {activities.map((act) => (
                    <div key={act.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 transition-colors">
                      <span className="text-2xl">{activityIcon(act.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{act.name ?? act.type ?? "Activité"}</p>
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
                            <div>durée</div>
                          </div>
                        )}
                        {act.avg_hr && (
                          <div className="text-center">
                            <div className="font-semibold text-red-500">{act.avg_hr}</div>
                            <div>FC moy</div>
                          </div>
                        )}
                        {act.tss && (
                          <div className="text-center">
                            <div className="font-semibold text-violet-600">{act.tss}</div>
                            <div>TSS</div>
                          </div>
                        )}
                        {act.training_effect && (
                          <div className={`text-center font-bold ${act.training_effect >= 4 ? "text-red-500" : act.training_effect >= 3 ? "text-orange-500" : "text-green-500"}`}>
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
                    </div>
                  ))}
                </div>
              </div>
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
                <p className="text-zinc-400 text-sm">Aucune donnée bien-être — synchronisez pour importer VFC, sommeil, Body Battery</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-100">
                  <h2 className="font-semibold text-zinc-900 text-sm">{wellness.length} jours de données</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-zinc-400 border-b border-zinc-100">
                        <th className="text-left px-5 py-2.5 font-medium">Date</th>
                        <th className="text-center px-3 py-2.5 font-medium">
                          <span className="flex items-center justify-center gap-1"><Heart className="w-3 h-3" />VFC</span>
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium">
                          <span className="flex items-center justify-center gap-1"><Moon className="w-3 h-3" />Sommeil</span>
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium">Score</th>
                        <th className="text-center px-3 py-2.5 font-medium">
                          <span className="flex items-center justify-center gap-1"><Battery className="w-3 h-3" />BB</span>
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium">SpO2</th>
                        <th className="text-center px-3 py-2.5 font-medium">État</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {wellness.map((w) => {
                        const state = !w.hrv ? null
                          : w.hrv > 80 ? { label: "Optimal", color: "text-green-600 bg-green-50" }
                          : w.hrv > 55 ? { label: "Correct", color: "text-blue-600 bg-blue-50" }
                          : { label: "Récup", color: "text-orange-600 bg-orange-50" };
                        return (
                          <tr key={w.date} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-5 py-3 text-zinc-700 font-medium">
                              {new Date(w.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {w.hrv ? <span className={`font-bold ${w.hrv > 80 ? "text-green-600" : w.hrv > 55 ? "text-blue-600" : "text-orange-500"}`}>{w.hrv} ms</span> : <span className="text-zinc-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {w.sleep_h ? <span className="font-semibold text-zinc-800">{w.sleep_h.toFixed(1)}h</span> : <span className="text-zinc-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {w.sleep_score ? (
                                <span className={`font-semibold ${w.sleep_score >= 80 ? "text-green-600" : w.sleep_score >= 60 ? "text-yellow-600" : "text-red-500"}`}>
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

            {/* ── CREDENTIALS FORM ── */}
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="px-6 pt-6 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-zinc-900 text-sm">Vos identifiants Intervals.icu</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Stockés de façon sécurisée dans votre profil</p>
                  </div>
                </div>
                {configured && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl">
                    <Wifi className="w-3.5 h-3.5" /> Connecté
                  </span>
                )}
              </div>

              {existingCreds?.athleteId && (
                <div className="mx-6 mt-3 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 w-20">Athlete ID</span>
                      <span className="font-mono font-semibold text-zinc-800">{existingCreds.athleteId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 w-20">Clé API</span>
                      <span className="font-mono text-zinc-500">{existingCreds.apiKeyMasked}</span>
                    </div>
                  </div>
                  <button onClick={handleDeleteCredentials}
                    className="text-zinc-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSaveCredentials} className="px-6 pb-6 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">
                      Athlete ID <span className="text-zinc-400">(ex: i564686)</span>
                    </label>
                    <input
                      type="text"
                      value={credsAthleteId}
                      onChange={e => setCredsAthleteId(e.target.value)}
                      placeholder="i000000"
                      required
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">
                      Clé API <span className="text-zinc-400">(Accès développeur)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={credsApiKey}
                        onChange={e => setCredsApiKey(e.target.value)}
                        placeholder={existingCreds?.apiKeyMasked ? "Nouvelle clé pour remplacer" : "votre_cle_api"}
                        required={!existingCreds?.athleteId}
                        className="w-full px-3 py-2.5 pr-9 rounded-xl border border-zinc-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                      />
                      <button type="button" onClick={() => setShowApiKey(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {credsError && (
                  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {credsError}
                  </div>
                )}
                {credsSaved && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    Identifiants sauvegardés — vous pouvez maintenant synchroniser !
                  </div>
                )}

                <button type="submit" disabled={savingCreds || !credsAthleteId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all">
                  {savingCreds ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {savingCreds ? "Vérification en cours…" : existingCreds?.athleteId ? "Mettre à jour les identifiants" : "Connecter Intervals.icu"}
                </button>
              </form>
            </div>

            {/* ── Step-by-step guide ── */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-5">
              <h2 className="font-semibold text-zinc-900">Comment connecter votre montre — 4 étapes</h2>

              <div className="space-y-4">
                {[
                  {
                    step: 1,
                    done: false,
                    title: "Créer un compte Intervals.icu (gratuit)",
                    desc: "Intervals.icu agrège les données de Garmin Connect, COROS, Polar Flow, Suunto, Wahoo et Apple Health via leurs APIs officielles.",
                    link: { href: "https://intervals.icu", label: "Créer un compte Intervals.icu →" },
                  },
                  {
                    step: 2,
                    done: false,
                    title: "Connecter votre montre",
                    desc: "Dans Intervals.icu : cliquez sur votre avatar → Connexions. Choisissez Garmin, COROS ou Polar et autorisez l'accès. Vos activités s'importent automatiquement.",
                    link: { href: "https://intervals.icu/settings#connections", label: "Paramètres → Connexions →" },
                  },
                  {
                    step: 3,
                    done: false,
                    title: "Récupérer votre Athlete ID et clé API",
                    desc: "Dans Intervals.icu : avatar → Paramètres → Accès développeur. Copiez l'Athlete ID (format i000000) et créez une nouvelle clé API.",
                    link: { href: "https://intervals.icu/settings#developer", label: "Paramètres → Accès développeur →" },
                  },
                  {
                    step: 4,
                    done: !!(configured),
                    title: "Entrer vos identifiants ci-dessus",
                    desc: "Collez l'Athlete ID et la clé API dans le formulaire en haut de cette page, puis cliquez sur « Connecter Intervals.icu ».",
                  },
                ].map(({ step, done, title, desc, link }) => (
                  <div key={step} className="flex gap-4">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                      done ? "bg-green-500 text-white" : "bg-zinc-900 text-white"
                    }`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : step}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold mb-1 ${done ? "text-green-700" : "text-zinc-800"}`}>{title}</p>
                      <p className="text-sm text-zinc-500">{desc}</p>
                      {link && (
                        <a href={link.href} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1.5 font-medium">
                          {link.label} <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supported devices */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
              <h3 className="font-semibold text-zinc-900 text-sm mb-3">Montres & plateformes supportées</h3>
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
              <h3 className="font-semibold text-zinc-900 text-sm mb-3">Données synchronisées</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["🏃 Activités GPS", "Distance, dénivelé, allure"],
                  ["❤️ Fréquence cardiaque", "FC moy, max, découplage"],
                  ["⚡ Puissance", "Watts moy/max + zones 1-5"],
                  ["🦿 Biomécanique", "Cadence, oscillation verticale, GCT"],
                  ["💤 Sommeil", "Total, deep, REM, score"],
                  ["🧘 VFC (HRV)", "RMSSD, SDNN, état physiologique"],
                  ["🔋 Body Battery", "Niveau énergie Garmin"],
                  ["🌡 SpO2", "Saturation en oxygène"],
                  ["📊 TSS / ATL / CTL", "Charge d'entraînement Intervals.icu"],
                  ["🏆 Training Effect", "Effet aérobie et anaérobie"],
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
                <p className="font-semibold mb-0.5">Confidentialité</p>
                <p>Vos données sont stockées dans votre base Supabase personnelle. Running Trail Empire n&apos;accède jamais directement à vos comptes Garmin ou COROS — tout passe par Intervals.icu qui gère l&apos;authentification OAuth de chaque constructeur.</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
