"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Moon, HeartPulse, Activity, Search, Users, ChevronRight, Library, MessagesSquare } from "lucide-react";

export type CoachClient = {
  id: string; name: string; email: string; league: string; score: number;
  lastRun: { title: string; date: string; km: number } | null;
  weekKm: number; sleepScore: number | null; load14: number | null;
  hrv: number | null; state: string | null;
  flags: { icon: string; label: string; sev: number }[]; priority: number;
};

const STATE: Record<string, { l: string; c: string; dot: string }> = {
  recovery: { l: "Récup", c: "bg-sky-100 text-sky-700", dot: "#0284c7" },
  optimal: { l: "Optimal", c: "bg-emerald-100 text-emerald-700", dot: "#059669" },
  competition: { l: "Haute intensité", c: "bg-orange-100 text-orange-700", dot: "#ea580c" },
};
const ago = (d: string) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return days <= 0 ? "aujourd'hui" : days === 1 ? "hier" : `il y a ${days} j`;
};
const fmtDur = (s?: number) => (s ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : "—");
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });


type Detail = {
  profile: { full_name?: string; age?: number; weight_kg?: number; height_cm?: number; gender?: string; subscription_tier?: string } | null;
  workouts: { title?: string; type?: string; date: string; distance_km?: number; elevation_gain_m?: number; duration_seconds?: number; avg_hr?: number; avg_cadence_spm?: number; calories?: number }[];
  hrv: { date: string; hrv_ms: number; physiological_state?: string }[];
  sleep: { date: string; total_sleep_min?: number; sleep_score?: number; body_battery_end?: number }[];
  baseline: { vma_kmh?: number; ftp_watts?: number; max_hr?: number; resting_hr?: number } | null;
  plan: { race_date?: string; goal?: string } | null;
};

export function CoachPanel({ clients, unread = 0 }: { clients: CoachClient[]; unread?: number }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<CoachClient | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const filtered = clients.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  const attention = clients.filter((c) => c.priority > 0).sort((a, b) => b.priority - a.priority);

  const select = async (c: CoachClient) => {
    setSel(c);
    setDetail(null); setLoadingDetail(true);
    try {
      const r = await fetch("/api/admin/client-detail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: c.id }) });
      setDetail(await r.json());
    } catch { /* ignore */ }
    finally { setLoadingDetail(false); }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><Users className="w-6 h-6 text-emerald-600" /> Espace Coach</h1>
          <p className="text-sm text-zinc-500 mt-1">Tes <b>{clients.length}</b> clients · données en temps réel · analyse IA + envoi de la séance du jour.</p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <Link href="/admin/messages" className="relative inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50">
            <MessagesSquare className="h-4 w-4 text-emerald-600" /> Messages
            {unread > 0 && <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white shadow-sm">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <Link href="/admin/entrainements" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
            <Library className="h-4 w-4" /> Bibliothèque
          </Link>
        </div>
      </header>

      {/* Aujourd'hui — triage : qui a besoin d'attention */}
      {attention.length > 0 && (
        <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-base">🎯</span>
            <h2 className="font-bold text-zinc-900">Aujourd&apos;hui — <span className="text-amber-600">{attention.length}</span> à suivre</h2>
          </div>
          <div className="space-y-1.5">
            {attention.slice(0, 8).map((c) => {
              const dot = c.priority >= 5 ? "#ef4444" : c.priority >= 3 ? "#f59e0b" : "#fbbf24";
              return (
                <button key={c.id} onClick={() => select(c)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-transparent px-3 py-2 text-left transition-colors hover:border-zinc-200 hover:bg-zinc-50">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: dot }} />
                  <span className="text-sm font-semibold text-zinc-900">{c.name}</span>
                  <span className="flex flex-wrap gap-1">
                    {c.flags.map((f, i) => (
                      <span key={i} className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${f.sev >= 3 ? "bg-red-50 text-red-600" : f.sev >= 2 ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{f.icon} {f.label}</span>
                    ))}
                  </span>
                  <span className="ml-auto text-xs font-semibold text-emerald-600">Voir →</span>
                </button>
              );
            })}
          </div>
          {clients.length - attention.length > 0 && (
            <p className="mt-2.5 text-xs text-zinc-400">🟢 {clients.length - attention.length} autre(s) client(s) — rien à signaler.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Liste clients */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white rounded-2xl border border-zinc-200 p-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200 mb-3">
              <Search className="w-4 h-4 text-zinc-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" className="bg-transparent text-sm outline-none flex-1" />
            </div>
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
              {filtered.length === 0 && <p className="text-sm text-zinc-400 text-center py-6">Aucun client.</p>}
              {filtered.map((c) => {
                const st = c.state ? STATE[c.state] : null;
                return (
                  <button key={c.id} onClick={() => select(c)}
                    className={`w-full text-left p-3 rounded-xl transition-colors ${sel?.id === c.id ? "bg-emerald-50 border border-emerald-200" : "hover:bg-zinc-50 border border-transparent"}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: st?.dot ?? "#d4d4d8" }} />
                      <span className="font-semibold text-zinc-900 text-sm truncate flex-1">{c.name}</span>
                      <span className="text-xs text-zinc-400">{c.weekKm} km/sem</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 pl-4.5">
                      {c.lastRun ? `${c.lastRun.title} · ${ago(c.lastRun.date)}` : "aucune séance"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Détail client */}
        <div className="col-span-12 lg:col-span-8">
          {!sel ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-zinc-400">
              <Users className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
              Sélectionne un client pour voir ses données et lui envoyer sa séance.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Données client */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">{sel.name}</h2>
                    <p className="text-xs text-zinc-400">{sel.email}</p>
                  </div>
                  {sel.state && STATE[sel.state] && <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATE[sel.state].c}`}>{STATE[sel.state].l}</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat icon={<HeartPulse className="w-4 h-4 text-red-400" />} label="VFC" value={sel.hrv != null ? `${sel.hrv} ms` : "—"} />
                  <Stat icon={<Moon className="w-4 h-4 text-indigo-400" />} label="Sommeil" value={sel.sleepScore != null ? `${sel.sleepScore}/100` : "—"} />
                  <Stat icon={<Activity className="w-4 h-4 text-emerald-500" />} label="Volume 7j" value={`${sel.weekKm} km`} />
                  <Stat icon={<span className="text-sm">📊</span>} label="Charge 14j" value={sel.load14 != null ? `${sel.load14} TSS` : "—"} />
                </div>
                {sel.lastRun && (
                  <div className="mt-3 text-sm text-zinc-500">
                    Dernière séance : <b className="text-zinc-800">{sel.lastRun.title}</b> · {sel.lastRun.km} km · {ago(sel.lastRun.date)}
                  </div>
                )}
              </div>

              {/* Toutes les données du client */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                <h3 className="font-semibold text-zinc-900 mb-3">Toutes les données</h3>
                {loadingDetail ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
                ) : (
                  <>
                    {detail?.baseline && (detail.baseline.vma_kmh != null || detail.baseline.max_hr != null) && (
                      <div className="flex flex-wrap gap-2 mb-3 text-xs">
                        {detail.baseline.vma_kmh != null && <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700">VMA <b>{detail.baseline.vma_kmh}</b> km/h</span>}
                        {detail.baseline.max_hr != null && <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700">FC max <b>{detail.baseline.max_hr}</b></span>}
                        {detail.baseline.resting_hr != null && <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700">FC repos <b>{detail.baseline.resting_hr}</b></span>}
                        {detail.baseline.ftp_watts != null && <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700">FTP <b>{detail.baseline.ftp_watts}</b> W</span>}
                        {detail.profile?.age != null && <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700">{detail.profile.age} ans · {detail.profile.weight_kg ?? "?"} kg</span>}
                      </div>
                    )}
                    {detail?.plan?.goal && <div className="text-xs text-zinc-500 mb-3">🎯 Objectif : {detail.plan.goal}{detail.plan.race_date ? ` · course le ${fmtDate(detail.plan.race_date)}` : ""}</div>}

                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Séances · 60 derniers jours ({detail?.workouts?.length ?? 0})</div>
                      <div className="text-[10px] text-zinc-300">clique une séance → page complète</div>
                    </div>
                    {detail && detail.workouts.length > 0 ? (
                      <div className="space-y-0.5 max-h-[34rem] overflow-y-auto">
                        {detail.workouts.map((w, i) => (
                          <Link key={i}
                            href={`/admin/coach/session?user=${sel.id}&date=${encodeURIComponent(w.date)}${w.distance_km != null ? `&dist=${w.distance_km}` : ""}&title=${encodeURIComponent(w.title || w.type || "Séance")}`}
                            className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-emerald-50">
                            <span className="text-xs text-zinc-400 w-12 flex-shrink-0">{fmtDate(w.date)}</span>
                            <span className="flex-1 min-w-0 truncate text-zinc-800 group-hover:text-emerald-800">{w.title || w.type || "Séance"}</span>
                            <span className="text-zinc-600 flex-shrink-0 w-16 text-right">{w.distance_km != null ? `${w.distance_km.toFixed(1)} km` : "—"}</span>
                            {w.elevation_gain_m ? <span className="text-zinc-400 text-xs flex-shrink-0 w-12 text-right hidden sm:inline">+{w.elevation_gain_m}m</span> : <span className="w-12 flex-shrink-0 hidden sm:inline" />}
                            {w.avg_hr ? <span className="text-zinc-400 text-xs flex-shrink-0 w-14 text-right">{w.avg_hr} bpm</span> : <span className="w-14 flex-shrink-0" />}
                            <span className="text-zinc-400 text-xs flex-shrink-0 w-12 text-right">{fmtDur(w.duration_seconds)}</span>
                            <ChevronRight className="w-4 h-4 flex-shrink-0 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                          </Link>
                        ))}
                      </div>
                    ) : <p className="text-sm text-zinc-400">Aucune séance synchronisée.</p>}

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-1">VFC — 7 derniers j</div>
                        {detail && detail.hrv.length ? <div className="text-sm text-zinc-600">{detail.hrv.slice(0, 7).map((h) => h.hrv_ms).join(" · ")} ms</div> : <p className="text-sm text-zinc-400">non synchronisée</p>}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 mb-1">Sommeil — 7 dernières nuits</div>
                        {detail && detail.sleep.length ? <div className="text-sm text-zinc-600">{detail.sleep.slice(0, 7).map((s) => s.sleep_score ?? "?").join(" · ")}/100</div> : <p className="text-sm text-zinc-400">non synchronisé</p>}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* L'analyse + l'envoi se font depuis la page d'une séance */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-500">
                💡 Pour analyser une séance et envoyer un plan à <b className="text-zinc-700">{sel.name.split(" ")[0]}</b> : clique une séance ci-dessus → <b className="text-violet-600">Envoyer à l&apos;IA</b> → <b className="text-emerald-600">Envoyer au client</b>. Le plan s&apos;affiche dans son calendrier.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-zinc-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">{icon}{label}</div>
      <div className="text-lg font-bold text-zinc-900 mt-0.5">{value}</div>
    </div>
  );
}
