"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  User, Activity, Footprints, CreditCard, Target, Bell,
  Flame, TrendingUp, Zap, Trophy, Calendar, Plus, Trash2,
  Shield, ChevronRight, Heart, Wind, Clock, BarChart2,
  CheckCircle, X, Save, AlertCircle, Star, Camera, Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  kmYear: number;
  kmMonth: number;
  sessionsMonth: number;
  longestRun: number;
  streak: number;
}

interface Goal {
  id: string;
  user_id: string;
  type: "race" | "weekly_km" | "monthly_km" | "pace" | "weight";
  label: string;
  target_value: number;
  current_value: number;
  target_date?: string;
  achieved: boolean;
  created_at: string;
}

interface Shoe {
  id: string;
  brand: string;
  model: string;
  current_km: number;
  max_km: number;
  purchase_date?: string;
  notes?: string;
}

// ── HR Zone calculator ────────────────────────────────────────────────────────
function calcZones(maxHr: number) {
  return [
    { z: "Z1", name: "Récupération", min: Math.round(maxHr * 0.50), max: Math.round(maxHr * 0.60), color: "bg-blue-400", textColor: "text-blue-700", desc: "Récupération active, ultra-endurance" },
    { z: "Z2", name: "Aérobie", min: Math.round(maxHr * 0.60), max: Math.round(maxHr * 0.70), color: "bg-green-400", textColor: "text-green-700", desc: "Base aérobie, sorties longues" },
    { z: "Z3", name: "Tempo", min: Math.round(maxHr * 0.70), max: Math.round(maxHr * 0.80), color: "bg-yellow-400", textColor: "text-yellow-700", desc: "Seuil aérobie, tempo" },
    { z: "Z4", name: "Seuil", min: Math.round(maxHr * 0.80), max: Math.round(maxHr * 0.90), color: "bg-orange-500", textColor: "text-orange-700", desc: "Seuil lactique, intervalles" },
    { z: "Z5", name: "VO2max", min: Math.round(maxHr * 0.90), max: maxHr, color: "bg-red-500", textColor: "text-red-700", desc: "Effort maximal, VMA" },
  ];
}

// ── Goal types config ─────────────────────────────────────────────────────────
const GOAL_TYPES = [
  { value: "race", label: "Course cible", icon: "🏁", unit: "km" },
  { value: "weekly_km", label: "Km hebdo", icon: "📅", unit: "km" },
  { value: "monthly_km", label: "Km mensuel", icon: "📆", unit: "km" },
  { value: "pace", label: "Allure cible", icon: "⚡", unit: "min/km" },
  { value: "weight", label: "Poids cible", icon: "⚖️", unit: "kg" },
];

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, icon, color }: {
  label: string; value: string | number; unit?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${color} flex flex-col gap-1`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70">{icon}{label}</div>
      <div className="text-2xl font-black text-zinc-900">
        {value}<span className="text-sm font-medium text-zinc-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}

function ProgressRing({ pct, size = 80, stroke = 8, color = "#16a34a" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e4e7" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-700">{label}</span>
      <button onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-green-500" : "bg-zinc-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function ProfileSettings({ profile, baseline, shoes, goals: initialGoals, stats, userId }: {
  profile: Record<string, unknown> | null;
  baseline: Record<string, unknown> | null;
  shoes: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  stats: Stats;
  userId: string;
}) {
  const [tab, setTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<Goal[]>(initialGoals as unknown as Goal[]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingShoe, setAddingShoe] = useState(false);
  const [shoeList, setShoeList] = useState<Shoe[]>(shoes as unknown as Shoe[]);
  const [avatarUrl, setAvatarUrl] = useState<string>(String(profile?.avatar_url ?? ""));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: String(profile?.full_name ?? ""),
    age: String(profile?.age ?? ""),
    height_cm: String(profile?.height_cm ?? ""),
    weight_kg: String(profile?.weight_kg ?? ""),
    preferred_language: String(profile?.preferred_language ?? "fr"),
    bio: String(profile?.bio ?? ""),
    guardian_mode_enabled: Boolean(profile?.guardian_mode_enabled),
    notif_workout: Boolean(profile?.notif_workout ?? true),
    notif_goal: Boolean(profile?.notif_goal ?? true),
    notif_league: Boolean(profile?.notif_league ?? true),
    notif_coach: Boolean(profile?.notif_coach ?? false),
  });

  const [newGoal, setNewGoal] = useState({ type: "race", label: "", target_value: "", target_date: "" });
  const [newShoe, setNewShoe] = useState({ brand: "", model: "", max_km: "800", purchase_date: "" });

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name,
      age: parseInt(form.age) || null,
      height_cm: parseInt(form.height_cm) || null,
      weight_kg: parseFloat(form.weight_kg) || null,
      preferred_language: form.preferred_language,
      bio: form.bio,
      guardian_mode_enabled: form.guardian_mode_enabled,
      notif_workout: form.notif_workout,
      notif_goal: form.notif_goal,
      notif_league: form.notif_league,
      notif_coach: form.notif_coach,
    }).eq("id", userId);
    setSaving(false);
    if (error) toast.error("Erreur lors de la sauvegarde");
    else toast.success("Profil mis à jour !");
  }

  async function uploadAvatar(file: File) {
    if (!file) return;
    setUploadingAvatar(true);

    const fd = new FormData();
    fd.append("avatar", file);

    try {
      const res = await fetch("/api/profile/upload-avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Erreur lors de l'upload");
        return;
      }
      setAvatarUrl(json.url);
      toast.success("Photo de profil mise à jour !");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function addGoal() {
    if (!newGoal.label || !newGoal.target_value) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("user_goals").insert({
      user_id: userId,
      type: newGoal.type,
      label: newGoal.label,
      target_value: parseFloat(newGoal.target_value),
      current_value: 0,
      target_date: newGoal.target_date || null,
      achieved: false,
    }).select().single();
    if (error) { toast.error("Erreur lors de la création"); return; }
    setGoals(g => [data as unknown as Goal, ...g]);
    setNewGoal({ type: "race", label: "", target_value: "", target_date: "" });
    setAddingGoal(false);
    toast.success("Objectif ajouté !");
  }

  async function deleteGoal(id: string) {
    const supabase = createClient();
    await supabase.from("user_goals").delete().eq("id", id);
    setGoals(g => g.filter(x => x.id !== id));
    toast.success("Objectif supprimé");
  }

  async function toggleGoalAchieved(goal: Goal) {
    const supabase = createClient();
    await supabase.from("user_goals").update({ achieved: !goal.achieved }).eq("id", goal.id);
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, achieved: !x.achieved } : x));
  }

  async function addShoe() {
    if (!newShoe.brand || !newShoe.model) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("shoes").insert({
      user_id: userId,
      brand: newShoe.brand,
      model: newShoe.model,
      max_km: parseFloat(newShoe.max_km) || 800,
      current_km: 0,
      purchase_date: newShoe.purchase_date || null,
      is_active: true,
    }).select().single();
    if (error) { toast.error("Erreur lors de l'ajout"); return; }
    setShoeList(s => [...s, data as unknown as Shoe]);
    setNewShoe({ brand: "", model: "", max_km: "800", purchase_date: "" });
    setAddingShoe(false);
    toast.success("Chaussure ajoutée !");
  }

  async function deleteShoe(id: string) {
    const supabase = createClient();
    await supabase.from("shoes").update({ is_active: false }).eq("id", id);
    setShoeList(s => s.filter(x => x.id !== id));
    toast.success("Chaussure retirée du garage");
  }

  const maxHr = Number(baseline?.max_hr ?? 0);
  const zones = maxHr > 0 ? calcZones(maxHr) : null;

  // VO2max estimate (Cooper formula via VMA)
  const vma = Number(baseline?.vma_kmh ?? 0);
  const vo2max = vma > 0 ? Math.round(vma * 3.5) : null;

  const tabs = [
    { v: "profile", l: "Profil", icon: User },
    { v: "goals", l: "Objectifs", icon: Target },
    { v: "performance", l: "Performance", icon: Activity },
    { v: "shoes", l: "Chaussures", icon: Footprints },
    { v: "subscription", l: "Abonnement", icon: CreditCard },
  ];

  const leagueColors: Record<string, string> = {
    bronze: "bg-orange-100 text-orange-700",
    silver: "bg-slate-100 text-slate-700",
    gold: "bg-yellow-100 text-yellow-700",
    platinum: "bg-cyan-100 text-cyan-700",
    diamond: "bg-violet-100 text-violet-700",
  };
  const league = String(profile?.league ?? "bronze");
  const leagueStyle = leagueColors[league] ?? "bg-zinc-100 text-zinc-600";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">

      {/* ── Hero card ── */}
      <div className="bento-card flex items-center gap-5">
        {/* Avatar with upload */}
        <div className="relative shrink-0 group">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="w-20 h-20 rounded-3xl overflow-hidden shadow-lg relative focus:outline-none"
            title="Modifier la photo de profil"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-3xl font-black">
                {String(form.full_name)[0]?.toUpperCase() ?? "U"}
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
              {uploadingAvatar
                ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                : <Camera className="w-6 h-6 text-white" />
              }
            </div>
          </button>
          {/* Online dot */}
          <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-white" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-zinc-900">{form.full_name || "Mon profil"}</h1>
          {form.bio && <p className="text-sm text-zinc-500 mt-0.5 line-clamp-1">{form.bio}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold capitalize ${leagueStyle}`}>
              {league.charAt(0).toUpperCase()}{league.slice(1)}
            </span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              Score {Math.round(Number(profile?.discipline_score ?? 0))}/100
            </span>
            {stats.streak > 0 && (
              <span className="text-xs text-orange-500 font-semibold flex items-center gap-1">
                <Flame className="w-3 h-3" />
                {stats.streak} jour{stats.streak > 1 ? "s" : ""} de suite
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats banner ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Km cette année" value={Math.round(stats.kmYear)} unit="km" icon={<TrendingUp className="w-3.5 h-3.5" />} color="bg-green-50" />
        <StatCard label="Km ce mois" value={Math.round(stats.kmMonth)} unit="km" icon={<Calendar className="w-3.5 h-3.5" />} color="bg-blue-50" />
        <StatCard label="Sessions mois" value={stats.sessionsMonth} icon={<Zap className="w-3.5 h-3.5" />} color="bg-violet-50" />
        <StatCard label="Plus longue" value={Math.round(stats.longestRun)} unit="km" icon={<Trophy className="w-3.5 h-3.5" />} color="bg-orange-50" />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.l}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── PROFIL tab ── */}
        {tab === "profile" && (
          <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bento-card space-y-4">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><User className="w-4 h-4" /> Informations personnelles</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Avatar quick-change inside form */}
                <div className="col-span-2 flex items-center gap-4 p-3 bg-zinc-50 rounded-2xl">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-xl font-black">
                        {String(form.full_name)[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-700 mb-1">Photo de profil</div>
                    <div className="text-xs text-zinc-400 mb-2">JPG, PNG, WebP · max 5 Mo</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 hover:border-green-400 hover:text-green-600 transition-all disabled:opacity-50"
                    >
                      {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      {uploadingAvatar ? "Upload…" : "Changer la photo"}
                    </button>
                  </div>
                </div>
              <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Nom complet</label>
                  <input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                {[{k:"age",l:"Âge"},{k:"height_cm",l:"Taille (cm)"},{k:"weight_kg",l:"Poids (kg)"}].map(({k,l}) => (
                  <div key={k}>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">{l}</label>
                    <input type="number" value={(form as unknown as Record<string,string>)[k]}
                      onChange={e => setForm(f => ({...f, [k]: e.target.value}))}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Langue</label>
                  <select value={form.preferred_language} onChange={e => setForm(f => ({...f, preferred_language: e.target.value}))}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                    {[["fr","🇫🇷 Français"],["en","🇬🇧 English"],["de","🇩🇪 Deutsch"],["es","🇪🇸 Español"],["it","🇮🇹 Italiano"],["pt","🇵🇹 Português"]].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Bio courte</label>
                  <textarea value={form.bio} onChange={e => setForm(f => ({...f, bio: e.target.value}))}
                    placeholder="Coureur trail passionné, objectif UTMB 2027…"
                    rows={3} maxLength={200}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                  <div className="text-right text-xs text-zinc-400 mt-1">{form.bio.length}/200</div>
                </div>
              </div>
              <button onClick={save} disabled={saving} className="btn-brand">
                <Save className="w-4 h-4" />
                {saving ? "Sauvegarde…" : "Enregistrer"}
              </button>
            </div>

            {/* Notifications */}
            <div className="bento-card space-y-1">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4" /> Notifications
              </h3>
              <Toggle enabled={form.notif_workout} onToggle={() => setForm(f => ({...f, notif_workout: !f.notif_workout}))} label="Rappels de séance" />
              <Toggle enabled={form.notif_goal} onToggle={() => setForm(f => ({...f, notif_goal: !f.notif_goal}))} label="Objectifs atteints" />
              <Toggle enabled={form.notif_league} onToggle={() => setForm(f => ({...f, notif_league: !f.notif_league}))} label="Classement ligue" />
              <Toggle enabled={form.notif_coach} onToggle={() => setForm(f => ({...f, notif_coach: !f.notif_coach}))} label="Conseils du coach IA" />
              <div className="pt-3">
                <button onClick={save} disabled={saving} className="text-sm text-green-600 font-semibold hover:underline">
                  Sauvegarder les préférences
                </button>
              </div>
            </div>

            {/* Guardian mode */}
            <div className={`bento-card border-2 transition-colors ${form.guardian_mode_enabled ? "border-violet-300 bg-violet-50" : "border-zinc-200"}`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl ${form.guardian_mode_enabled ? "bg-violet-100" : "bg-zinc-100"}`}>
                  <Shield className={`w-6 h-6 ${form.guardian_mode_enabled ? "text-violet-600" : "text-zinc-400"}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-zinc-900">Mode Guardian</h3>
                    <button
                      onClick={() => { setForm(f => ({...f, guardian_mode_enabled: !f.guardian_mode_enabled})); }}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.guardian_mode_enabled ? "bg-violet-500" : "bg-zinc-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.guardian_mode_enabled ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">
                    Bloque automatiquement les séances à haute intensité en cas de surentraînement détecté par l&apos;IA (HRV, fatigue mentale).
                  </p>
                  {form.guardian_mode_enabled && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-violet-700 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> Actif — votre santé est protégée
                    </div>
                  )}
                </div>
              </div>
              {form.guardian_mode_enabled && (
                <div className="mt-3 pt-3 border-t border-violet-200">
                  <button onClick={save} disabled={saving} className="text-sm text-violet-600 font-semibold hover:underline">
                    Enregistrer
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── OBJECTIFS tab ── */}
        {tab === "goals" && (
          <motion.div key="goals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900">Mes objectifs</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{goals.filter(g => !g.achieved).length} en cours · {goals.filter(g => g.achieved).length} atteints</p>
              </div>
              <button onClick={() => setAddingGoal(true)}
                className="flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-zinc-700 transition-all">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>

            {/* Add goal form */}
            <AnimatePresence>
              {addingGoal && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="bento-card border-2 border-green-200 bg-green-50 overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-zinc-900">Nouvel objectif</h4>
                    <button onClick={() => setAddingGoal(false)}><X className="w-4 h-4 text-zinc-400" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Type</label>
                      <div className="flex gap-2 flex-wrap">
                        {GOAL_TYPES.map(gt => (
                          <button key={gt.value} onClick={() => setNewGoal(g => ({...g, type: gt.value}))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                              newGoal.type === gt.value ? "bg-green-500 text-white border-green-500" : "bg-white text-zinc-600 border-zinc-200 hover:border-green-300"
                            }`}>
                            {gt.icon} {gt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Nom</label>
                      <input value={newGoal.label} onChange={e => setNewGoal(g => ({...g, label: e.target.value}))}
                        placeholder={newGoal.type === "race" ? "Marathon de Paris 2027" : "Objectif hebdo"}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1">
                        Valeur cible ({GOAL_TYPES.find(g => g.value === newGoal.type)?.unit})
                      </label>
                      <input type="number" value={newGoal.target_value} onChange={e => setNewGoal(g => ({...g, target_value: e.target.value}))}
                        placeholder="42.2"
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                    </div>
                    {newGoal.type === "race" && (
                      <div>
                        <label className="text-xs font-medium text-zinc-500 block mb-1">Date cible</label>
                        <input type="date" value={newGoal.target_date} onChange={e => setNewGoal(g => ({...g, target_date: e.target.value}))}
                          className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={addGoal} className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600 transition-all">
                      Créer l&apos;objectif
                    </button>
                    <button onClick={() => setAddingGoal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-zinc-600 border border-zinc-200">
                      Annuler
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Goals list */}
            {goals.length === 0 && !addingGoal ? (
              <div className="bento-card text-center py-12">
                <Target className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">Aucun objectif défini</p>
                <p className="text-zinc-300 text-xs mt-1">Fixez-vous une course cible, un volume hebdo…</p>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map(goal => {
                  const pct = goal.target_value > 0 ? goal.current_value / goal.target_value : 0;
                  const daysLeft = goal.target_date
                    ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86400000)
                    : null;
                  const gt = GOAL_TYPES.find(g => g.value === goal.type);
                  return (
                    <motion.div key={goal.id} layout
                      className={`bento-card flex gap-4 transition-all ${goal.achieved ? "opacity-60" : ""}`}>
                      <div className="shrink-0">
                        <ProgressRing pct={pct} size={64} stroke={6} color={goal.achieved ? "#16a34a" : "#3b82f6"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base">{gt?.icon}</span>
                              <span className="font-semibold text-zinc-900 text-sm">{goal.label}</span>
                              {goal.achieved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Atteint ✓</span>}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {goal.current_value} / {goal.target_value} {gt?.unit}
                              {daysLeft !== null && (
                                <span className={`ml-2 font-medium ${daysLeft < 30 ? "text-orange-500" : "text-zinc-400"}`}>
                                  · {daysLeft > 0 ? `J-${daysLeft}` : "Passé"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => toggleGoalAchieved(goal)}
                              className={`p-1.5 rounded-lg transition-all ${goal.achieved ? "bg-green-100 text-green-600" : "bg-zinc-100 text-zinc-400 hover:text-green-500"}`}>
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteGoal(goal.id)}
                              className="p-1.5 rounded-lg bg-zinc-100 text-zinc-400 hover:text-red-500 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <motion.div className={`h-full rounded-full ${goal.achieved ? "bg-green-500" : "bg-blue-500"}`}
                            initial={{ width: 0 }} animate={{ width: `${Math.min(pct * 100, 100)}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }} />
                        </div>
                        <div className="text-right text-xs text-zinc-400 mt-1">{Math.round(pct * 100)}%</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Quick stats for goals context */}
            <div className="bento-card bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
              <div className="text-sm font-semibold mb-3 text-zinc-300">Contexte actuel</div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-black">{Math.round(stats.kmMonth)}</div>
                  <div className="text-xs text-zinc-400 mt-1">km ce mois</div>
                </div>
                <div>
                  <div className="text-2xl font-black">{Math.round(stats.kmYear)}</div>
                  <div className="text-xs text-zinc-400 mt-1">km cette année</div>
                </div>
                <div>
                  <div className="text-2xl font-black">{stats.streak}</div>
                  <div className="text-xs text-zinc-400 mt-1">jours de suite</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── PERFORMANCE tab ── */}
        {tab === "performance" && (
          <motion.div key="performance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

            {/* Key metrics */}
            <div className="bento-card space-y-4">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><BarChart2 className="w-4 h-4" /> Données de performance</h3>
              {baseline ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "VMA", value: `${baseline.vma_kmh}`, unit: "km/h", icon: <Wind className="w-4 h-4 text-blue-500" />, bg: "bg-blue-50" },
                      { label: "FC Max", value: `${baseline.max_hr}`, unit: "bpm", icon: <Heart className="w-4 h-4 text-red-500" />, bg: "bg-red-50" },
                      { label: "FC Repos", value: `${baseline.resting_hr}`, unit: "bpm", icon: <Heart className="w-4 h-4 text-green-500" />, bg: "bg-green-50" },
                      { label: "Seuil lactique", value: baseline.lt_hr ? `${baseline.lt_hr}` : "—", unit: baseline.lt_hr ? "bpm" : "", icon: <Zap className="w-4 h-4 text-orange-500" />, bg: "bg-orange-50" },
                    ].map(m => (
                      <div key={m.label} className={`${m.bg} rounded-2xl p-4`}>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">{m.icon}{m.label}</div>
                        <div className="text-xl font-black text-zinc-900">{String(m.value)}<span className="text-xs font-medium text-zinc-400 ml-1">{m.unit}</span></div>
                      </div>
                    ))}
                  </div>

                  {/* VO2max estimate */}
                  {vo2max && (
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-violet-50 to-blue-50 rounded-2xl border border-violet-100">
                      <div className="text-4xl font-black text-violet-700">{vo2max}</div>
                      <div>
                        <div className="font-semibold text-zinc-900 text-sm">VO2max estimé</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Basé sur votre VMA (VMA × 3.5)</div>
                        <div className={`text-xs font-semibold mt-1 ${vo2max >= 60 ? "text-green-600" : vo2max >= 50 ? "text-blue-600" : vo2max >= 40 ? "text-orange-500" : "text-zinc-500"}`}>
                          {vo2max >= 65 ? "🏆 Elite" : vo2max >= 55 ? "✅ Excellent" : vo2max >= 45 ? "👍 Bon" : vo2max >= 35 ? "📈 Moyen" : "🌱 En progression"}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10">
                  <AlertCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-zinc-400 text-sm">Aucune baseline enregistrée</p>
                  <p className="text-zinc-300 text-xs mt-1">Faites le test VMA depuis l&apos;onboarding</p>
                </div>
              )}
            </div>

            {/* HR Zones */}
            {zones && (
              <div className="bento-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><Heart className="w-4 h-4 text-red-500" /> Zones de fréquence cardiaque</h3>
                  <span className="text-xs text-zinc-400">FC max: {maxHr} bpm</span>
                </div>
                <div className="space-y-3">
                  {zones.map(zone => (
                    <div key={zone.z} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl ${zone.color} flex items-center justify-center text-white text-xs font-black shrink-0`}>
                        {zone.z}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-zinc-700">{zone.name}</span>
                          <span className={`text-xs font-mono font-semibold ${zone.textColor}`}>{zone.min}–{zone.max} bpm</span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${zone.color}`}
                            style={{ width: `${((zone.max - zone.min) / maxHr) * 100 + zone.min / maxHr * 80}%` }}
                            initial={{ width: 0 }} animate={{ width: `${((zone.max - zone.min) / maxHr) * 100 + zone.min / maxHr * 80}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: zones.indexOf(zone) * 0.1 }} />
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">{zone.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Allures de référence */}
            {vma > 0 && (
              <div className="bento-card space-y-3">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2"><Clock className="w-4 h-4" /> Allures de référence</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Z2 (endurance)", pct: 0.65, color: "text-green-600" },
                    { label: "Tempo (Z3-Z4)", pct: 0.80, color: "text-yellow-600" },
                    { label: "Seuil (Z4)", pct: 0.88, color: "text-orange-600" },
                    { label: "VMA (Z5)", pct: 1.00, color: "text-red-600" },
                  ].map(({ label, pct, color }) => {
                    const speedKmh = vma * pct;
                    const secsPerKm = 3600 / speedKmh;
                    const mins = Math.floor(secsPerKm / 60);
                    const secs = Math.round(secsPerKm % 60);
                    return (
                      <div key={label} className="bg-zinc-50 rounded-2xl p-3">
                        <div className="text-xs text-zinc-500 mb-1">{label}</div>
                        <div className={`text-lg font-black ${color}`}>{mins}:{String(secs).padStart(2,"0")}<span className="text-xs font-normal text-zinc-400 ml-1">min/km</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── CHAUSSURES tab ── */}
        {tab === "shoes" && (
          <motion.div key="shoes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-900">Mon Garage</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{shoeList.length} paire{shoeList.length > 1 ? "s" : ""} active{shoeList.length > 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setAddingShoe(true)}
                className="flex items-center gap-1.5 bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-zinc-700 transition-all">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>

            {/* Add shoe form */}
            <AnimatePresence>
              {addingShoe && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="bento-card border-2 border-blue-200 bg-blue-50 overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-zinc-900">Nouvelle paire</h4>
                    <button onClick={() => setAddingShoe(false)}><X className="w-4 h-4 text-zinc-400" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Marque</label>
                      <input value={newShoe.brand} onChange={e => setNewShoe(s => ({...s, brand: e.target.value}))}
                        placeholder="Nike, Hoka, Salomon…"
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Modèle</label>
                      <input value={newShoe.model} onChange={e => setNewShoe(s => ({...s, model: e.target.value}))}
                        placeholder="Vaporfly 3, Speedgoat…"
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Durée de vie (km)</label>
                      <input type="number" value={newShoe.max_km} onChange={e => setNewShoe(s => ({...s, max_km: e.target.value}))}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Date d&apos;achat</label>
                      <input type="date" value={newShoe.purchase_date} onChange={e => setNewShoe(s => ({...s, purchase_date: e.target.value}))}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={addShoe} className="flex-1 bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-600 transition-all">
                      Ajouter au garage
                    </button>
                    <button onClick={() => setAddingShoe(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-zinc-600 border border-zinc-200">
                      Annuler
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {shoeList.length === 0 && !addingShoe ? (
              <div className="bento-card text-center py-12">
                <Footprints className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">Aucune chaussure dans le garage</p>
                <p className="text-zinc-300 text-xs mt-1">Ajoutez vos paires pour suivre leur kilométrage</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shoeList.map(shoe => {
                  const pct = Number(shoe.current_km) / Number(shoe.max_km) * 100;
                  const status = pct >= 90 ? { color: "bg-red-500", text: "À remplacer", badge: "bg-red-100 text-red-700" }
                    : pct >= 70 ? { color: "bg-orange-500", text: "Surveiller", badge: "bg-orange-100 text-orange-700" }
                    : { color: "bg-green-500", text: "Bon état", badge: "bg-green-100 text-green-700" };
                  const remaining = Number(shoe.max_km) - Number(shoe.current_km);
                  return (
                    <motion.div key={shoe.id} layout className="bento-card">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-zinc-900">{shoe.brand} {shoe.model}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">
                            {Number(shoe.current_km).toFixed(0)} km parcourus · {remaining.toFixed(0)} km restants
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${status.badge}`}>{status.text}</span>
                          <button onClick={() => deleteShoe(shoe.id)} className="p-1.5 rounded-lg bg-zinc-100 text-zinc-400 hover:text-red-500 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${status.color}`}
                          initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-xs text-zinc-400">
                        <span>0 km</span>
                        <span className="font-semibold text-zinc-600">{Math.round(pct)}%</span>
                        <span>{Number(shoe.max_km)} km</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── ABONNEMENT tab ── */}
        {tab === "subscription" && (
          <motion.div key="subscription" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bento-card">
              <h3 className="font-semibold text-zinc-900 mb-4">Abonnement actuel</h3>
              <div className="p-4 bg-zinc-50 rounded-2xl flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-zinc-900 text-lg">
                    Plan {String(profile?.subscription_tier ?? "free").charAt(0).toUpperCase()}{String(profile?.subscription_tier ?? "free").slice(1)}
                  </div>
                  <div className="text-sm text-zinc-400 mt-0.5">
                    {profile?.subscription_tier === "free" ? "Accès limité aux fonctionnalités de base" : "Accès complet à toutes les fonctionnalités"}
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${
                  profile?.subscription_tier !== "free" ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-600"
                }`}>
                  {profile?.subscription_tier !== "free" ? "✓ Actif" : "Gratuit"}
                </span>
              </div>

              {/* Feature comparison */}
              <div className="space-y-2">
                {[
                  { label: "Dashboard & statistiques", free: true, pro: true },
                  { label: "Journal intelligent (NLP)", free: true, pro: true },
                  { label: "Plans d'entraînement (3 max)", free: true, pro: true },
                  { label: "Plans d'entraînement illimités", free: false, pro: true },
                  { label: "Coach IA personnalisé (Claude)", free: false, pro: true },
                  { label: "Ghost Runner IA", free: false, pro: true },
                  { label: "Analyses VMA & zones cardiaques", free: false, pro: true },
                  { label: "Sync montres GPS (Garmin, Polar…)", free: false, pro: true },
                  { label: "Shopping Hub & recommandations", free: false, pro: true },
                  { label: "Ligues & classements", free: false, pro: true },
                ].map(feat => (
                  <div key={feat.label} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                    <span className="text-sm text-zinc-700">{feat.label}</span>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs w-12 text-center ${feat.free ? "text-green-600" : "text-zinc-300"}`}>
                        {feat.free ? "✓" : "✗"}
                      </span>
                      <span className={`text-xs w-12 text-center font-semibold ${feat.pro ? "text-green-600" : "text-zinc-300"}`}>
                        {feat.pro ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-8 mt-2 text-xs font-semibold text-zinc-400">
                <span>Gratuit</span><span className="text-green-600">Pro</span>
              </div>
            </div>

            {profile?.subscription_tier === "free" && (
              <div className="bento-card bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/10 rounded-xl"><Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /></div>
                  <div>
                    <div className="font-bold text-lg">Passer à Pro</div>
                    <div className="text-zinc-400 text-sm">Débloquez toutes les fonctionnalités</div>
                  </div>
                </div>
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-4xl font-black">10€</span>
                  <span className="text-zinc-400 mb-1">/mois</span>
                  <span className="ml-3 text-sm text-green-400 font-semibold">ou 84€/an (-30%)</span>
                </div>
                <a href="/pricing" className="block w-full text-center bg-green-500 hover:bg-green-400 text-white py-3 rounded-xl font-semibold transition-all">
                  Commencer l&apos;essai gratuit 14 jours <ChevronRight className="w-4 h-4 inline" />
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
