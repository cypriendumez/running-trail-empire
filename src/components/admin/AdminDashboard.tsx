"use client";

import { useState, useEffect } from "react";
import { Users, Activity, Crown, Search, Mail, BarChart3, TrendingUp, Watch, Send, CheckCircle2, AlertCircle, ChevronRight, Zap, UserCheck, RefreshCw, Calendar, Hash } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  age: number | null;
  gender: string | null;
  subscription_tier: string | null;
  league: string | null;
  discipline_score: number | null;
  onboarding_completed: boolean | null;
  created_at: string;
  intervals_athlete_id: string | null;
  avatar_url: string | null;
  mode: string | null;
  workout_count: number;
}

type DetailWk = { date: string; title: string | null; type: string | null; distance_km: number | null; duration_seconds: number | null; avg_hr: number | null };

function Avatar({ user, size = "md" }: { user: User; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-sm", md: "w-10 h-10 text-base", lg: "w-14 h-14 text-xl" };
  const letter = (user.full_name || user.email || "?")[0].toUpperCase();
  const colors = ["from-violet-500 to-indigo-500", "from-emerald-500 to-teal-500", "from-rose-500 to-pink-500", "from-amber-500 to-orange-500", "from-blue-500 to-cyan-500"];
  const color = colors[letter.charCodeAt(0) % colors.length];
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {letter}
    </div>
  );
}

export function AdminDashboard({ users }: { users: User[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(users[0] ?? null);
  const [tab, setTab] = useState<"users" | "stats">("users");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Coaching AI state
  const [coachingUser, setCoachingUser] = useState<User | null>(null);
  const [coachingSessions, setCoachingSessions] = useState(5);
  const [planType, setPlanType] = useState("semaine");
  const [coachNote, setCoachNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sendingPlan, setSendingPlan] = useState(false);
  const [planSent, setPlanSent] = useState(false);
  const [geminiResult, setGeminiResult] = useState<{
    summary?: string;
    training_load?: string;
    recovery_status?: string;
    hrv_trend?: string;
    strengths?: string[];
    areas_to_improve?: string[];
    risk_flags?: string[];
  } | null>(null);
  const [planResult, setPlanResult] = useState<string>("");
  const [rawActivities, setRawActivities] = useState<any[]>([]);
  const [dataSource, setDataSource] = useState<string>("");
  const [coachingError, setCoachingError] = useState<string | null>(null);

  // Détail client (séances récentes + charge) affiché dans la fiche Utilisateurs.
  const [detail, setDetail] = useState<{ workouts: DetailWk[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetail(null); setDetailLoading(true);
    fetch("/api/admin/client-detail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: selected.id }) })
      .then(r => r.json()).then(j => { if (!j.error) setDetail(j); }).catch(() => { /* ignore */ }).finally(() => setDetailLoading(false));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generatePlan() {
    if (!coachingUser) return;
    setGenerating(true); setCoachingError(null); setGeminiResult(null); setPlanResult(""); setPlanSent(false); setRawActivities([]); setDataSource("");
    try {
      const res = await fetch("/api/admin/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: coachingUser.id, sessions: coachingSessions, planType, coachNote }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 206) throw new Error(data.error ?? "Erreur génération");
      setGeminiResult(data.gemini ?? null);
      setPlanResult(data.plan ?? "");
      setRawActivities(data.raw_activities ?? []);
      setDataSource(data.data_source ?? "");
      if (data.icu_connected) setCoachingError(null);
    } catch (err) {
      setCoachingError(String(err).replace("Error: ", ""));
    } finally {
      setGenerating(false);
    }
  }

  async function sendPlanByEmail() {
    if (!coachingUser?.email || !planResult) return;
    setSendingPlan(true);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: coachingUser.email,
          subject: `Ton plan d'entraînement — ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`,
          body: planResult,
        }),
      });
      if (!res.ok) throw new Error("Erreur envoi");
      setPlanSent(true);
    } catch (err) {
      setCoachingError(String(err).replace("Error: ", ""));
    } finally {
      setSendingPlan(false);
    }
  }

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    onboarded: users.filter(u => u.onboarding_completed).length,
    withWatch: users.filter(u => u.intervals_athlete_id).length,
    elite: users.filter(u => u.subscription_tier === "elite").length,
    active: users.filter(u => u.workout_count > 0).length,
    totalWorkouts: users.reduce((s, u) => s + u.workout_count, 0),
  };

  async function sendEmail() {
    if (!selected?.email || !emailSubject || !emailBody) return;
    setSending(true); setEmailError(null);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selected.email, subject: emailSubject, body: emailBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur envoi");
      setEmailSent(true); setEmailSubject(""); setEmailBody("");
      setTimeout(() => setEmailSent(false), 4000);
    } catch (err) {
      setEmailError(String(err).replace("Error: ", ""));
    } finally {
      setSending(false);
    }
  }

  const tierBadge: Record<string, string> = {
    elite: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    pro: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    free: "bg-zinc-100 text-zinc-500",
  };
  const leagueBadge: Record<string, string> = {
    bronze: "text-amber-700 bg-amber-50",
    silver: "text-slate-600 bg-slate-100",
    gold: "text-yellow-700 bg-yellow-50",
    diamond: "text-cyan-700 bg-cyan-50",
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-zinc-100 px-8 h-16 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* ⚠️ LE LOGO, PAS UN BOUCLIER GÉNÉRIQUE. Cet écran ouvre sur les données
              personnelles de vrais athlètes ; il doit ressembler au produit qui les
              héberge, pas à un panneau d'administration anonyme. */}
          <Logo size={32} />
          <div>
            <span className="font-bold text-zinc-900 text-sm">Espace coach</span>
            <span className="text-zinc-400 text-xs ml-2">Pacevo</span>
          </div>
          {/* ⚠️ LE LIEN « NEWSLETTER » A ÉTÉ RETIRÉ : la lettre part toute seule chaque
              lundi (GitHub Actions → /api/newsletter/weekly). Garder un bouton d'envoi
              manuel invitait à doubler un envoi automatique — le meilleur moyen
              d'expédier deux fois la même lettre. La page existe toujours à
              /admin/newsletter pour un envoi exceptionnel. */}
          <a href="/admin/messages" className="ml-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100">💬 Messagerie</a>
          {/* Sans ce lien, l'écran de modération existe mais personne n'y va — et aucun
              avis ne sort jamais de la file d'attente. */}
          <a href="/admin/avis" className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100">★ Avis</a>
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1">
          {[
            { key: "users", label: "Utilisateurs", icon: Users },
            { key: "stats", label: "Statistiques", icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as "users" | "stats")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        <div className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5">
          {users.length} compte{users.length > 1 ? "s" : ""}
        </div>
      </header>

      {/* Stats view */}
      {tab === "stats" && (
        <div className="p-8 max-w-6xl mx-auto w-full">
          {/* KPI cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
            {[
              { label: "Utilisateurs", value: stats.total, icon: Users, color: "violet" },
              { label: "Onboardés", value: stats.onboarded, icon: UserCheck, color: "emerald" },
              { label: "Avec montre", value: stats.withWatch, icon: Watch, color: "blue" },
              { label: "Actifs", value: stats.active, icon: Activity, color: "green" },
              { label: "Elite", value: stats.elite, icon: Crown, color: "amber" },
              { label: "Activités total", value: stats.totalWorkouts, icon: TrendingUp, color: "rose" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 bg-${color}-50`}>
                  <Icon className={`w-4 h-4 text-${color}-500`} />
                </div>
                <div className="text-2xl font-bold text-zinc-900">{value}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Users table */}
          <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900">Tous les comptes</h2>
              <span className="text-xs text-zinc-400">{users.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-50 text-xs text-zinc-400 uppercase tracking-wide">
                    <th className="text-left px-6 py-3 font-medium">Utilisateur</th>
                    <th className="text-left px-6 py-3 font-medium">Plan</th>
                    <th className="text-left px-6 py-3 font-medium">Mode</th>
                    <th className="text-left px-6 py-3 font-medium">Ligue</th>
                    <th className="text-left px-6 py-3 font-medium">Activités</th>
                    <th className="text-left px-6 py-3 font-medium">Montre</th>
                    <th className="text-left px-6 py-3 font-medium">Inscrit</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id}
                      onClick={() => { setSelected(u); setTab("users"); }}
                      className={`border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-zinc-50/30"}`}>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar user={u} size="sm" />
                          <div>
                            <div className="font-medium text-zinc-900 text-sm">{u.full_name || "—"}</div>
                            <div className="text-xs text-zinc-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${tierBadge[u.subscription_tier ?? "free"] ?? "bg-zinc-100 text-zinc-500"}`}>
                          {u.subscription_tier ?? "free"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-sm text-zinc-600 capitalize">{u.mode ?? "—"}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${leagueBadge[u.league ?? ""] ?? "bg-zinc-100 text-zinc-500"}`}>
                          {u.league ?? "—"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-zinc-800 text-sm">{u.workout_count}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        {u.intervals_athlete_id
                          ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />{u.intervals_athlete_id}</span>
                          : <span className="text-xs text-zinc-300">—</span>}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-zinc-400">
                        {new Date(u.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ LE PANNEAU « COACHING IA » A ÉTÉ RETIRÉ. Il demandait de choisir un athlète,
          un type de plan et de cliquer sur « Générer » — un plan écrit à la main, à la
          demande. Le coach automatique fait désormais ce travail seul : plan déterministe
          de 7 jours, replanifié à chaque synchronisation, plus l'ajustement proposé par
          le modèle et validé contre le budget qualité. Deux chemins vers la même
          prescription, dont un manuel qui ignore le plancher de fatigue, c'était un
          risque sans contrepartie. Les analyses IA de séance restent accessibles depuis
          la fiche de l'athlète (« Analyser »). */}

      {tab === "users" && (
        <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
          {/* Sidebar list */}
          <aside className="w-72 bg-white border-r border-zinc-100 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-zinc-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="text-center text-zinc-400 py-12 text-sm">Aucun résultat</div>
              )}
              {filtered.map(u => (
                <button key={u.id} onClick={() => setSelected(u)}
                  className={`w-full text-left px-4 py-3.5 border-b border-zinc-50 flex items-center gap-3 transition-all hover:bg-zinc-50 ${
                    selected?.id === u.id ? "bg-violet-50 border-l-2 border-l-violet-500" : ""
                  }`}>
                  <Avatar user={u} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm truncate ${selected?.id === u.id ? "text-violet-700" : "text-zinc-800"}`}>
                      {u.full_name || "Sans nom"}
                    </div>
                    <div className="text-xs text-zinc-400 truncate">{u.email}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {u.intervals_athlete_id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Montre connectée" />}
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Detail panel */}
          <main className="flex-1 overflow-y-auto bg-[#F8F8F8]">
            {!selected ? (
              <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
                Sélectionnez un utilisateur
              </div>
            ) : (
              <div className="p-8 max-w-4xl">
                {/* Profile header */}
                <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm mb-6">
                  <div className="flex items-center gap-5">
                    <Avatar user={selected} size="lg" />
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-zinc-900">{selected.full_name || "Sans nom"}</h2>
                      <p className="text-zinc-500 text-sm mt-0.5">{selected.email}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${tierBadge[selected.subscription_tier ?? "free"] ?? "bg-zinc-100 text-zinc-500"}`}>
                          {selected.subscription_tier ?? "free"}
                        </span>
                        {selected.onboarding_completed && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Onboardé
                          </span>
                        )}
                        {selected.intervals_athlete_id && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200 flex items-center gap-1">
                            <Watch className="w-3 h-3" /> Montre connectée
                          </span>
                        )}
                        {selected.mode && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-600 capitalize">
                            {selected.mode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-zinc-400">
                      <div>Inscrit le</div>
                      <div className="font-semibold text-zinc-600 mt-0.5">
                        {new Date(selected.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Activités", value: selected.workout_count, icon: Activity },
                    { label: "Score discipline", value: selected.discipline_score ?? 0, icon: Zap },
                    { label: "Ligue", value: selected.league ?? "—", icon: Crown },
                    { label: "Âge", value: selected.age ? `${selected.age} ans` : "—", icon: Calendar },
                    { label: "Genre", value: selected.gender ?? "—", icon: Users },
                    { label: "Athlete ID", value: selected.intervals_athlete_id ?? "Non connecté", icon: Watch },
                    { label: "ID compte", value: selected.id.slice(0, 12) + "...", icon: Hash },
                    { label: "Onboarding", value: selected.onboarding_completed ? "Complété" : "En cours", icon: UserCheck },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-white border border-zinc-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-xs text-zinc-400 font-medium">{label}</span>
                      </div>
                      <div className="text-sm font-semibold text-zinc-800 truncate capitalize">{String(value)}</div>
                    </div>
                  ))}
                </div>

                {/* Séances récentes + graphique de charge */}
                <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-zinc-900 text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-violet-500" /> Séances & charge récentes</h3>
                    <a href="/admin/coach" className="text-xs font-semibold text-violet-600 hover:underline flex items-center gap-1">Analyse IA complète <ChevronRight className="w-3 h-3" /></a>
                  </div>
                  {detailLoading ? (
                    <div className="text-sm text-zinc-400 py-8 text-center">Chargement des séances…</div>
                  ) : !detail?.workouts?.length ? (
                    <div className="text-sm text-zinc-400 py-8 text-center">Aucune séance sur les 60 derniers jours.</div>
                  ) : (
                    <>
                      {(() => {
                        const days = Array.from({ length: 21 }, (_, i) => {
                          const ds = new Date(Date.now() - (20 - i) * 86400000).toISOString().slice(0, 10);
                          const km = detail.workouts.filter(w => String(w.date).slice(0, 10) === ds).reduce((s, w) => s + (w.distance_km ?? 0), 0);
                          return { ds, km };
                        });
                        const max = Math.max(1, ...days.map(d => d.km));
                        return (
                          <div className="mb-1 flex items-end gap-[3px]" style={{ height: 96 }}>
                            {days.map((d, i) => (
                              <div key={i} className="flex-1 rounded-t bg-violet-400/80 transition-colors hover:bg-violet-600" style={{ height: `${Math.max(3, (d.km / max) * 100)}%` }} title={`${d.ds} : ${d.km.toFixed(1)} km`} />
                            ))}
                          </div>
                        );
                      })()}
                      <div className="mb-4 text-[11px] text-zinc-400">Volume quotidien (km) — 21 derniers jours</div>
                      <div className="space-y-1.5">
                        {detail.workouts.slice(0, 8).map((w, i) => (
                          <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-zinc-50">
                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100"><Activity className="h-4 w-4 text-zinc-500" /></span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-zinc-800">{w.title || w.type || "Séance"}</div>
                              <div className="text-xs text-zinc-400">{new Date(w.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
                            </div>
                            <div className="flex flex-shrink-0 gap-3 text-xs text-zinc-500">
                              {w.distance_km != null && <span className="font-semibold text-zinc-700">{w.distance_km.toFixed(1)} km</span>}
                              {w.avg_hr ? <span>{w.avg_hr} bpm</span> : null}
                              {w.duration_seconds ? <span>{Math.floor(w.duration_seconds / 3600)}h{String(Math.floor((w.duration_seconds % 3600) / 60)).padStart(2, "0")}</span> : null}
                            </div>
                            <a href={`/admin/coach/session?user=${selected.id}&date=${String(w.date).slice(0, 10)}${w.distance_km ? `&dist=${w.distance_km}` : ""}&title=${encodeURIComponent(w.title || w.type || "Séance")}`}
                              className="flex-shrink-0 text-[11px] font-semibold text-violet-600 hover:underline">Analyser →</a>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Email composer */}
                <div className="bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
                      <Mail className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 text-sm">Envoyer un email</h3>
                      <p className="text-xs text-zinc-400">→ {selected.email}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                      placeholder="Sujet..."
                      className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                      placeholder="Écris ton message ici..."
                      rows={5}
                      className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none" />

                    {emailError && (
                      <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />{emailError}
                      </div>
                    )}
                    {emailSent && (
                      <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />Email envoyé avec succès !
                      </div>
                    )}

                    <button onClick={sendEmail}
                      disabled={sending || !emailSubject || !emailBody}
                      className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all text-sm">
                      {sending
                        ? <><RefreshCw className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                        : <><Send className="w-4 h-4" /> Envoyer l&apos;email</>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
