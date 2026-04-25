"use client";

import { useState } from "react";
import {
  Users, Activity, Crown, Search, Mail, ChevronRight,
  ShieldCheck, BarChart3, Zap, TrendingUp, X, Send, Eye
} from "lucide-react";

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

export function AdminDashboard({ users }: { users: User[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [tab, setTab] = useState<"users" | "stats">("users");

  const filtered = users.filter(u =>
    (u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
     u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = {
    total: users.length,
    withWatch: users.filter(u => u.intervals_athlete_id).length,
    elite: users.filter(u => u.subscription_tier === "elite").length,
    active: users.filter(u => u.workout_count > 0).length,
    onboarded: users.filter(u => u.onboarding_completed).length,
  };

  async function sendEmail() {
    if (!selected?.email || !emailSubject || !emailBody) return;
    setSending(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selected.email,
          subject: emailSubject,
          body: emailBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur envoi");
      setEmailSent(true);
      setEmailSubject("");
      setEmailBody("");
      setTimeout(() => setEmailSent(false), 3000);
    } catch (err) {
      setEmailError(String(err).replace("Error: ", ""));
    } finally {
      setSending(false);
    }
  }

  const tierColor: Record<string, string> = {
    elite: "bg-amber-100 text-amber-700",
    pro: "bg-blue-100 text-blue-700",
    free: "bg-zinc-100 text-zinc-500",
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">Admin Panel</h1>
            <p className="text-xs text-zinc-500">Running & Trail Empire</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("users")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === "users" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"}`}>
            <Users className="w-4 h-4 inline mr-2" />Utilisateurs
          </button>
          <button onClick={() => setTab("stats")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === "stats" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"}`}>
            <BarChart3 className="w-4 h-4 inline mr-2" />Stats
          </button>
        </div>
      </div>

      {tab === "stats" && (
        <div className="p-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              { label: "Total users", value: stats.total, icon: Users, color: "violet" },
              { label: "Onboardés", value: stats.onboarded, icon: Zap, color: "green" },
              { label: "Montre connectée", value: stats.withWatch, icon: Activity, color: "blue" },
              { label: "Avec activités", value: stats.active, icon: TrendingUp, color: "emerald" },
              { label: "Elite", value: stats.elite, icon: Crown, color: "amber" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-${color}-500/10`}>
                  <Icon className={`w-5 h-5 text-${color}-400`} />
                </div>
                <div className="text-3xl font-bold text-white">{value}</div>
                <div className="text-xs text-zinc-500 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Users breakdown table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="font-semibold text-white">Tous les comptes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Utilisateur</th>
                    <th className="text-left px-6 py-3">Plan</th>
                    <th className="text-left px-6 py-3">Mode</th>
                    <th className="text-left px-6 py-3">Activités</th>
                    <th className="text-left px-6 py-3">Montre</th>
                    <th className="text-left px-6 py-3">Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                        onClick={() => { setSelected(u); setTab("users"); }}>
                      <td className="px-6 py-3">
                        <div className="font-medium text-white">{u.full_name || "—"}</div>
                        <div className="text-zinc-500 text-xs">{u.email}</div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${tierColor[u.subscription_tier ?? "free"] ?? "bg-zinc-800 text-zinc-400"}`}>
                          {u.subscription_tier ?? "free"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-zinc-400">{u.mode ?? "—"}</td>
                      <td className="px-6 py-3 text-zinc-300">{u.workout_count}</td>
                      <td className="px-6 py-3">
                        {u.intervals_athlete_id
                          ? <span className="text-green-400 text-xs">✓ {u.intervals_athlete_id}</span>
                          : <span className="text-zinc-600 text-xs">Non connectée</span>}
                      </td>
                      <td className="px-6 py-3 text-zinc-500 text-xs">
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

      {tab === "users" && (
        <div className="flex h-[calc(100vh-73px)]">
          {/* User list */}
          <div className="w-80 border-r border-zinc-800 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-zinc-800">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.map(u => (
                <button key={u.id} onClick={() => setSelected(u)}
                  className={`w-full text-left px-4 py-3.5 border-b border-zinc-800/50 hover:bg-zinc-900 transition-all flex items-center gap-3 ${selected?.id === u.id ? "bg-zinc-900" : ""}`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {(u.full_name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm truncate">{u.full_name || "Sans nom"}</div>
                    <div className="text-zinc-500 text-xs truncate">{u.email}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-zinc-600 py-12 text-sm">Aucun résultat</div>
              )}
            </div>
          </div>

          {/* User detail */}
          <div className="flex-1 overflow-y-auto">
            {!selected ? (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                Sélectionnez un utilisateur
              </div>
            ) : (
              <div className="p-8 max-w-3xl">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl">
                      {(selected.full_name || selected.email || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{selected.full_name || "Sans nom"}</h2>
                      <p className="text-zinc-400 text-sm">{selected.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${tierColor[selected.subscription_tier ?? "free"] ?? "bg-zinc-800 text-zinc-400"}`}>
                          {selected.subscription_tier ?? "free"}
                        </span>
                        {selected.onboarding_completed && (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400">Onboardé</span>
                        )}
                        {selected.intervals_athlete_id && (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400">Montre ✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {[
                    { label: "Activités", value: selected.workout_count },
                    { label: "Score discipline", value: selected.discipline_score ?? "—" },
                    { label: "Ligue", value: selected.league ?? "—" },
                    { label: "Âge", value: selected.age ?? "—" },
                    { label: "Genre", value: selected.gender ?? "—" },
                    { label: "Mode", value: selected.mode ?? "—" },
                    { label: "Athlete ID", value: selected.intervals_athlete_id ?? "Non connecté" },
                    { label: "Inscrit le", value: new Date(selected.created_at).toLocaleDateString("fr-FR") },
                    { label: "ID", value: selected.id.slice(0, 8) + "..." },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="text-xs text-zinc-500 mb-1">{label}</div>
                      <div className="text-sm font-semibold text-white truncate">{String(value)}</div>
                    </div>
                  ))}
                </div>

                {/* Email composer */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Mail className="w-5 h-5 text-violet-400" />
                    <h3 className="font-semibold text-white">Envoyer un email</h3>
                    <span className="text-zinc-500 text-sm ml-1">→ {selected.email}</span>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      placeholder="Sujet de l'email..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                    />
                    <textarea
                      value={emailBody}
                      onChange={e => setEmailBody(e.target.value)}
                      placeholder="Contenu de l'email..."
                      rows={6}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
                    />

                    {emailError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                        {emailError}
                      </div>
                    )}
                    {emailSent && (
                      <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                        Email envoyé ✓
                      </div>
                    )}

                    <button
                      onClick={sendEmail}
                      disabled={sending || !emailSubject || !emailBody}
                      className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium py-3 rounded-xl transition-all text-sm">
                      {sending ? (
                        <>Envoi en cours...</>
                      ) : (
                        <><Send className="w-4 h-4" /> Envoyer l&apos;email</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
