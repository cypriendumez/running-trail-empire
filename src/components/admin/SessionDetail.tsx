"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  ArrowLeft, Loader2, Sparkles, Activity, HeartPulse, Gauge, Zap,
  Footprints, Mountain, Clock, TrendingUp, Thermometer, Send, CalendarDays,
} from "lucide-react";

type SeriesPoint = { km: number | null; min: number | null; pace: number | null; hr: number | null; power: number | null; cad: number | null; alt: number | null };
type PowerStat = { avg: number; max: number; np: number | null } | null;
type Lap = { km: number; dur: number | null; paceMps: number | null; gapMps: number | null; hr: number | null; hrMax: number | null; cad: number | null; power: number | null; zone: number | null; intensity: number | null; elev: number | null; type: string | null };
type Detail = { activity: Record<string, unknown> | null; series: SeriesPoint[] | null; power: PowerStat; laps: Lap[] | null; elevGain: number | null; elevLoss: number | null };
type NextSession = { title: string; workout: string; why: string; feel: string; tags: string[] };
type WeekDay = { label: string; type: string; desc: string };
type MacroWeek = { week: number; phase: string; volumeKm: number; quality: string[]; longRunKm: number; focus: string };
const PHASE_COLOR: Record<string, { bg: string; fg: string }> = {
  "Base": { bg: "#dbeafe", fg: "#1d4ed8" },
  "Développement": { bg: "#fee2e2", fg: "#b91c1c" },
  "Spécifique": { bg: "#fef9c3", fg: "#a16207" },
  "Affûtage": { bg: "#dcfce7", fg: "#15803d" },
};

// Rendu propre du texte de l'IA (gras **, puces, titres en MAJUSCULES) — fini les ### et ** bruts.
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-0.5">
      {text.split("\n").map((raw, i) => {
        const line = raw.replace(/^#{1,4}\s*/, "");
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        const isBullet = /^\s*[*\-]\s+/.test(raw);
        const body = line.replace(/^\s*[*\-]\s+/, "").trim();
        const isHead = !isBullet && body.length > 2 && body.length < 60 && body === body.toUpperCase() && /[A-ZÀ-Ý]/.test(body);
        const frags = body.split(/(\*\*[^*]+\*\*)/g).map((s, j) => s.startsWith("**") && s.endsWith("**")
          ? <strong key={j} className="font-semibold text-zinc-900">{s.slice(2, -2)}</strong> : <span key={j}>{s}</span>);
        if (isHead) return <div key={i} className="pt-2.5 text-[13px] font-bold uppercase tracking-wide text-violet-700">{frags}</div>;
        if (isBullet) return <div key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-700"><span className="mt-1 text-violet-400">•</span><span>{frags}</span></div>;
        return <p key={i} className="text-sm leading-relaxed text-zinc-700">{frags}</p>;
      })}
    </div>
  );
}

const n = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
const paceStr = (mps: number | null) => (mps && mps > 0.3 ? `${Math.floor(1000 / 60 / mps)}'${String(Math.round(((1000 / 60 / mps) % 1) * 60)).padStart(2, "0")}` : "—");
const fmtT = (s: number | null) => (s != null ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}${s < 3600 ? "" : ""}` : "—");
const fmtTm = (s: number | null) => (s != null ? (s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}`) : "—");

const ZONE_COLORS = ["#9ca3af", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a21caf", "#7c3aed"];
const ZONE_LABELS = ["Z1 Récup", "Z2 Endurance", "Z3 Tempo", "Z4 Seuil", "Z5 VO2max", "Z6", "Z7"];

type Item = { label: string; val: string | number; unit?: string };
type Section = { title: string; icon: typeof Activity; color: string; items: Item[] };

function buildSections(a: Record<string, unknown>, power: PowerStat, elev: { gain: number | null; loss: number | null }): Section[] {
  const sp = n(a.average_speed);
  const mk = (raw: (Item | null)[]): Item[] => raw.filter((x): x is Item => x !== null);
  const it = (label: string, v: string | number | null, unit?: string): Item | null => (v !== null && v !== "" ? { label, val: v, unit } : null);
  return [
    { title: "Charge & intensité", icon: TrendingUp, color: "#7c3aed", items: mk([
      it("Charge (TSS)", n(a.icu_training_load) != null ? Math.round(n(a.icu_training_load)!) : null),
      it("Intensité", n(a.icu_intensity) != null ? Math.round(n(a.icu_intensity)!) : null, "%"),
      it("TRIMP", n(a.trimp) != null ? Math.round(n(a.trimp)!) : null),
      it("Charge HR", n(a.hr_load) != null ? Math.round(n(a.hr_load)!) : null),
      it("Indice polarisation", n(a.polarization_index) != null ? Math.round(n(a.polarization_index)! * 100) / 100 : null),
      it("TE aérobie", n(a.aerobic_te) != null ? Math.round(n(a.aerobic_te)! * 10) / 10 : null),
    ]) },
    { title: "Cardio", icon: HeartPulse, color: "#ef4444", items: mk([
      it("FC moyenne", n(a.average_heartrate), "bpm"),
      it("FC max", n(a.max_heartrate), "bpm"),
      it("FC repos", n(a.icu_resting_hr), "bpm"),
      it("LTHR", n(a.lthr), "bpm"),
      it("Décrochage card.", n(a.decoupling) != null ? Math.round(n(a.decoupling)! * 10) / 10 : null, "%"),
    ]) },
    { title: "Allure & vitesse", icon: Gauge, color: "#2563eb", items: mk([
      it("Allure moy", sp ? paceStr(sp) : null, "/km"),
      it("Allure GAP", n(a.gap) ? paceStr(n(a.gap)) : null, "/km"),
      it("Vitesse moy", sp ? Math.round(sp * 36) / 10 : null, "km/h"),
      it("Vitesse max", n(a.max_speed) ? Math.round(n(a.max_speed)! * 36) / 10 : null, "km/h"),
    ]) },
    { title: "Puissance", icon: Zap, color: "#8b5cf6", items: mk([
      it("Puissance moy", power?.avg ?? null, "W"),
      it("Puissance max", power?.max ?? null, "W"),
      it("Puissance NP", power?.np ?? null, "W"),
    ]) },
    { title: "Cadence & foulée", icon: Footprints, color: "#db2777", items: mk([
      it("Cadence", n(a.average_cadence) != null ? Math.round(n(a.average_cadence)! * 2) : null, "spm"),
      it("Foulée", n(a.average_stride) != null ? Math.round(n(a.average_stride)! * 100) / 100 : null, "m"),
    ]) },
    { title: "Forme & fatigue", icon: TrendingUp, color: "#059669", items: mk([
      it("Forme (CTL)", n(a.icu_ctl) != null ? Math.round(n(a.icu_ctl)!) : null),
      it("Fatigue (ATL)", n(a.icu_atl) != null ? Math.round(n(a.icu_atl)!) : null),
    ]) },
    { title: "Dénivelé & altitude", icon: Mountain, color: "#d97706", items: mk([
      it("Distance", n(a.distance) != null ? Math.round(n(a.distance)! / 100) / 10 : null, "km"),
      it("Dénivelé +", elev.gain ?? (n(a.total_elevation_gain) != null ? Math.round(n(a.total_elevation_gain)!) : null), "m"),
      it("Dénivelé −", elev.loss ?? (n(a.total_elevation_loss) != null ? Math.round(n(a.total_elevation_loss)!) : null), "m"),
      it("Altitude moy", n(a.average_altitude) != null ? Math.round(n(a.average_altitude)!) : null, "m"),
      it("Altitude max", n(a.max_altitude) != null ? Math.round(n(a.max_altitude)!) : null, "m"),
    ]) },
    { title: "Temps", icon: Clock, color: "#0d9488", items: mk([
      it("Temps en mouvement", fmtT(n(a.moving_time))),
      it("Temps total", fmtT(n(a.elapsed_time))),
      it("Nb d'intervalles", n(a.icu_lap_count) != null ? Math.round(n(a.icu_lap_count)!) : null),
    ]) },
    { title: "Conditions", icon: Thermometer, color: "#64748b", items: mk([
      it("Calories", n(a.calories), "kcal"),
      it("Température", n(a.average_temp) != null ? Math.round(n(a.average_temp)!) : null, "°C"),
      it("Poids", n(a.icu_weight), "kg"),
      it("Appareil", typeof a.device_name === "string" ? a.device_name : null),
    ]) },
  ].filter((s) => s.items.length > 0);
}

const CHART_FMT: Record<string, (v: number) => string> = { pace: (v) => `${Math.floor(v)}'${String(Math.round((v % 1) * 60)).padStart(2, "0")}` };
function Chart({ data, dataKey, label, color, unit, reversed }: { data: SeriesPoint[]; dataKey: "pace" | "hr" | "power" | "cad" | "alt"; label: string; color: string; unit: string; reversed?: boolean }) {
  const pts = data.filter((d) => d[dataKey] != null && d.km != null);
  if (pts.length < 4) return null;
  const fmt = CHART_FMT[dataKey] ?? ((v: number) => `${Math.round(v)}`);
  const gid = `sd_${dataKey}`;
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-3.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</span>
        <span className="text-[10px] text-zinc-300">{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={pts} margin={{ top: 4, right: 6, bottom: 0, left: -6 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis dataKey="km" tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} minTickGap={34} tickFormatter={(v) => `${v}`} />
          <YAxis width={34} reversed={reversed} domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} tickFormatter={fmt} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 12, padding: "6px 10px", boxShadow: "0 6px 16px rgba(0,0,0,.07)" }} labelFormatter={(v) => `${v} km`} formatter={(v: number) => [`${fmt(v)} ${unit}`, label]} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.2} fill={`url(#${gid})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TYPE_COLOR(t: string): { bg: string; fg: string } {
  const s = t.toLowerCase();
  if (/repos/.test(s)) return { bg: "#f4f4f5", fg: "#71717a" };
  if (/récup|recup/.test(s)) return { bg: "#e0f2fe", fg: "#0369a1" };
  if (/spéci|specif|allure|objectif/.test(s)) return { bg: "#fef9c3", fg: "#a16207" };
  if (/seuil|tempo/.test(s)) return { bg: "#ffedd5", fg: "#c2410c" };
  if (/vma|fractionn|interval|côte|cote/.test(s)) return { bg: "#fee2e2", fg: "#b91c1c" };
  if (/renfo|muscu|gainage|force/.test(s)) return { bg: "#ede9fe", fg: "#6d28d9" };
  if (/long/.test(s)) return { bg: "#dcfce7", fg: "#15803d" };
  return { bg: "#d1fae5", fg: "#047857" };
}

export function SessionDetail({ user, date, dist, title, clientMode = false }: { user: string; date: string; dist?: string; title?: string; clientMode?: boolean }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ nextSession: NextSession | null; week: WeekDay[] } | null>(null);
  const [objective, setObjective] = useState<{ race: string; distanceKm: number; raceDate: string; targetTime: string; targetPace: string; daysToRace: number | null } | null>(null);
  const [rest, setRest] = useState<{ daysSinceLast: number | null; restDays7: number } | null>(null);
  const [macro, setMacro] = useState<MacroWeek[]>([]);
  const [showMacro, setShowMacro] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sendingClient, setSendingClient] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(clientMode ? "/api/activity-detail" : "/api/admin/activity-detail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user, date, distance_km: dist ? Number(dist) : undefined }) });
      const j = await r.json();
      if (j.error) setErr(j.error); else setData(j);
    } catch { setErr("Impossible de charger la séance"); }
    finally { setLoading(false); }
  }, [user, date, dist, clientMode]);

  useEffect(() => { load(); }, [load]);

  const sendToAI = async () => {
    setAnalyzing(true); setAnalysis(null); setPlan(null); setObjective(null); setRest(null); setMacro([]);
    try {
      const r = await fetch("/api/admin/analyze-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user, date, distance_km: dist ? Number(dist) : undefined }) });
      const j = await r.json();
      if (j.error) { toast.error(j.error); return; }
      setAnalysis(j.analysis);
      setPlan({ nextSession: j.nextSession ?? null, week: Array.isArray(j.week) ? j.week : [] });
      setObjective(j.objective ?? null);
      setRest(j.rest ?? null);
      setMacro(Array.isArray(j.macroPlan) ? j.macroPlan : []);
      toast.success("Analyse IA prête ✅");
    } catch { toast.error("Analyse impossible"); }
    finally { setAnalyzing(false); }
  };

  // Pousse la prochaine séance recommandée au dashboard du client (message chaleureux).
  const sendToClient = async () => {
    if (!plan?.nextSession) return;
    setSendingClient(true);
    try {
      const ns = plan.nextSession;
      const r = await fetch("/api/admin/assign-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, title: ns.title, subtitle: ns.workout, tags: ns.tags, why: [ns.why, ns.feel].filter(Boolean).join(" ") }),
      });
      const j = await r.json();
      if (j.ok) toast.success(`Séance envoyée au client 🎯${j.watchSent ? " + sur sa montre ⌚ (ouvre Garmin Connect pour synchroniser)" : ""}`, { duration: 6000 });
      else toast.error(j.error || "Envoi impossible");
    } catch { toast.error("Envoi impossible"); }
    finally { setSendingClient(false); }
  };

  // Publie le plan de 7 jours dans le calendrier du client (à partir d'aujourd'hui).
  const publishWeek = async () => {
    if (!plan?.week?.length) return;
    setPublishing(true);
    try {
      const ns = plan.nextSession;
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      // Catégorie canonique d'un type libre → libellé cohérent (évite « ENDURANCE » collé sur une séance de récup).
      const catOf = (t: string) => {
        const s = (t || "").toLowerCase();
        if (/repos|rest/.test(s)) return "Repos";
        if (/récup|recup/.test(s)) return "Récup";
        if (/spéci|specif|allure|objectif/.test(s)) return "Spécifique";
        if (/seuil|tempo/.test(s)) return "Seuil";
        if (/vma|fractionn|interval|piste|côte|cote|30\/30|fartlek/.test(s)) return "VMA";
        if (/renfo|muscu|gainage|force|ppg/.test(s)) return "Renfo";
        if (/long/.test(s)) return "Sortie longue";
        if (/endurance|footing|fond|easy/.test(s)) return "Endurance";
        return "Séance";
      };
      // Aujourd'hui = la séance du jour (nextSession). Les jours SUIVANTS = le reste de la semaine
      // (on saute le 1er jour de la « week » de l'IA pour ne pas dupliquer aujourd'hui).
      const nsCat = ns ? catOf(`${ns.tags.join(" ")} ${ns.title}`) : "";
      type Sess = { date: string; type: string; title: string; detail: string; why: string; feel: string; tags: string[] };
      const sessions: Sess[] = [];
      if (ns) {
        sessions.push({ date: fmt(start), type: nsCat || "Séance", title: ns.title, detail: ns.workout, why: ns.why, feel: ns.feel, tags: ns.tags });
        plan.week.slice(1).forEach((d, i) => {
          const dt = new Date(start); dt.setDate(start.getDate() + 1 + i);
          sessions.push({ date: fmt(dt), type: catOf(d.type), title: d.type, detail: d.desc, why: "", feel: "", tags: [] });
        });
      } else {
        plan.week.forEach((d, i) => {
          const dt = new Date(start); dt.setDate(start.getDate() + i);
          sessions.push({ date: fmt(dt), type: catOf(d.type), title: d.type, detail: d.desc, why: "", feel: "", tags: [] });
        });
      }
      const r = await fetch("/api/admin/publish-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user, sessions }) });
      const j = await r.json();
      if (j.ok) toast.success(`Plan de ${j.count} jours publié 📅${j.watchSent ? ` · ${j.watchSent} séances sur sa montre ⌚ (synchro via Garmin Connect)` : ""}`, { duration: 6000 });
      else toast.error(j.error || "Publication impossible");
    } catch { toast.error("Publication impossible"); }
    finally { setPublishing(false); }
  };

  const a = data?.activity ?? null;
  const sections = a ? buildSections(a, data?.power ?? null, { gain: data?.elevGain ?? null, loss: data?.elevLoss ?? null }) : [];
  const series = data?.series ?? null;
  const laps = data?.laps ?? null;
  const hasLapPower = !!laps?.some((l) => l.power != null);
  const zones = a && Array.isArray(a.icu_hr_zone_times) ? (a.icu_hr_zone_times as number[]) : null;
  const zTot = zones?.reduce((x, y) => x + (y || 0), 0) ?? 0;

  // En-tête (chiffres clés)
  const headline: Item[] = a ? [
    { label: "Distance", val: n(a.distance) != null ? Math.round(n(a.distance)! / 100) / 10 : "—", unit: "km" },
    { label: "Durée", val: fmtT(n(a.moving_time)) },
    { label: "Allure", val: n(a.average_speed) ? paceStr(n(a.average_speed)) : "—", unit: "/km" },
    { label: "Charge", val: n(a.icu_training_load) != null ? Math.round(n(a.icu_training_load)!) : "—" },
    { label: "FC moy", val: n(a.average_heartrate) ?? "—", unit: "bpm" },
    { label: "D+", val: data?.elevGain ?? (n(a.total_elevation_gain) != null ? Math.round(n(a.total_elevation_gain)!) : "—"), unit: "m" },
  ] : [];

  const nMetrics = sections.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      {/* Hero */}
      <div className="relative overflow-hidden text-white" style={{ background: "linear-gradient(135deg,#064e3b 0%,#047857 45%,#0d9488 100%)" }}>
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-10 h-80 w-80 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-6 sm:py-8">
          <Link href={clientMode ? "/dashboard" : "/admin/coach"} className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> {clientMode ? "Retour au tableau de bord" : "Retour aux clients"}
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-sm">{title || (a?.name as string) || "Séance"}</h1>
              <p className="mt-1 text-sm text-white/75 first-letter:uppercase">{new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            {!clientMode && (
            <button onClick={sendToAI} disabled={analyzing || loading || !a}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 font-semibold ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/25 disabled:opacity-50">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-200" />}
              {analyzing ? "Analyse…" : "Envoyer à l'IA"}
            </button>
            )}
          </div>
          {/* Chiffres clés */}
          {a && (
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {headline.map((h) => (
                <div key={h.label} className="rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 backdrop-blur-md">
                  <div className="text-[10px] uppercase tracking-wide text-white/60">{h.label}</div>
                  <div className="text-lg font-bold leading-tight">{h.val}{h.unit ? <span className="text-xs font-normal text-white/60"> {h.unit}</span> : null}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 py-16 text-zinc-400 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Chargement des données intervals.icu…</div>
        ) : err ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{err}</div>
        ) : a ? (
          <>
            {/* Objectif de course + repos — ce que l'IA a pris en compte */}
            {(objective || rest) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm">
                {objective ? (
                  <span className="font-semibold text-indigo-700">
                    🎯 {objective.race} · {objective.distanceKm} km{objective.daysToRace != null ? ` · J-${objective.daysToRace}` : ""} · {objective.targetTime} · {objective.targetPace}
                  </span>
                ) : (
                  <span className="font-semibold text-zinc-500">🎯 Aucun objectif défini par le client</span>
                )}
                {rest?.daysSinceLast != null && (
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-zinc-600 ring-1 ring-zinc-200">
                    ⏸️ dernière séance il y a {rest.daysSinceLast} j · {rest.restDays7} j de repos / 7
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-400">pris en compte par l&apos;IA</span>
              </div>
            )}

            {/* Analyse du coach IA */}
            {analysis && (
              <div className="rounded-3xl border border-violet-100 bg-violet-50/50 p-5 sm:p-6">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-violet-700"><Sparkles className="h-4 w-4" /> Analyse du coach IA</div>
                <Rich text={analysis} />
              </div>
            )}

            {/* Prochaine séance + plan de la semaine — message chaleureux, prêt à envoyer au client */}
            {plan?.nextSession && (
              <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-white" style={{ background: "linear-gradient(135deg,#047857,#0d9488)" }}>
                  <span className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-amber-200" /> Prochaine séance recommandée</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={sendToClient} disabled={sendingClient}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/25 disabled:opacity-50">
                      {sendingClient ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Envoyer maintenant
                    </button>
                    {plan.week.length > 0 && (
                      <button onClick={publishWeek} disabled={publishing}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50">
                        {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />} Publier la semaine
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-zinc-900">{plan.nextSession.title}</h3>
                  {plan.nextSession.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {plan.nextSession.tags.map((t) => <span key={t} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">{t}</span>)}
                    </div>
                  )}
                  <p className="mt-3 text-sm leading-relaxed text-zinc-700">{plan.nextSession.workout}</p>
                  {plan.nextSession.why && <div className="mt-3 rounded-xl bg-emerald-50/70 p-3 text-sm leading-relaxed text-emerald-900"><b>Pourquoi&nbsp;:</b> {plan.nextSession.why}</div>}
                  {plan.nextSession.feel && <div className="mt-2 flex items-start gap-2 rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-600"><span>🫁</span><span><b className="text-zinc-700">Sensations à viser&nbsp;:</b> {plan.nextSession.feel}</span></div>}
                </div>
                {plan.week.length > 1 && (
                  <div className="border-t border-zinc-100 px-5 py-4">
                    <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-zinc-400">Le reste de la semaine</div>
                    <div className="space-y-2">
                      {plan.week.slice(1).map((d, i) => {
                        const c = TYPE_COLOR(d.type);
                        const dd = new Date(); dd.setHours(0, 0, 0, 0); dd.setDate(dd.getDate() + 1 + i);
                        const dateLabel = dd.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
                        return (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <span className="w-28 flex-shrink-0 font-semibold text-zinc-700 capitalize">{dateLabel}</span>
                            <span className="flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: c.bg, color: c.fg }}>{d.type}</span>
                            <span className="text-zinc-600">{d.desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Plan macro périodisé — bloc complet jusqu'au jour J */}
            {macro.length > 0 && (
              <div className="overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-sm">
                <button onClick={() => setShowMacro((v) => !v)} className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left transition-colors hover:bg-indigo-50/40">
                  <span className="flex flex-wrap items-center gap-2 font-bold text-indigo-700">
                    <TrendingUp className="h-4 w-4" /> Plan complet jusqu&apos;au jour J
                    <span className="text-xs font-normal text-zinc-400">· {macro.length} semaines{objective?.race ? ` · ${objective.race}` : ""} (base → dév → spécifique → affûtage)</span>
                  </span>
                  <span className="flex-shrink-0 text-xs font-semibold text-indigo-500">{showMacro ? "Masquer" : "Afficher"}</span>
                </button>
                {showMacro && (
                  <div className="border-t border-zinc-100 px-3 py-3 sm:px-5">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
                            <th className="py-2 pr-3 font-semibold">Sem.</th><th className="py-2 pr-3 font-semibold">Phase</th>
                            <th className="py-2 pr-3 font-semibold">Volume</th><th className="py-2 pr-3 font-semibold">Qualité</th>
                            <th className="py-2 pr-3 font-semibold">Sortie longue</th><th className="py-2 font-semibold">Focus</th>
                          </tr>
                        </thead>
                        <tbody>
                          {macro.map((w) => {
                            const c = PHASE_COLOR[w.phase] ?? { bg: "#f4f4f5", fg: "#71717a" };
                            return (
                              <tr key={w.week} className="border-t border-zinc-50">
                                <td className="py-2 pr-3 font-semibold text-zinc-400">S{w.week}</td>
                                <td className="py-2 pr-3"><span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: c.bg, color: c.fg }}>{w.phase}</span></td>
                                <td className="py-2 pr-3 font-semibold tabular-nums text-zinc-800">{w.volumeKm} km</td>
                                <td className="py-2 pr-3 text-zinc-600">{w.quality.join(" + ")}</td>
                                <td className="py-2 pr-3 tabular-nums text-zinc-500">{w.longRunKm} km</td>
                                <td className="py-2 text-zinc-500">{w.focus}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-400">Volumes &amp; phases indicatifs (périodisation automatique vers l&apos;objectif). La séance du jour et la semaine détaillée priment ; ce macro-plan donne le cap.</p>
                  </div>
                )}
              </div>
            )}

            {/* Sections de métriques */}
            <div className="grid gap-4 lg:grid-cols-2">
              {sections.map((sec) => (
                <div key={sec.title} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: sec.color }}><sec.icon className="h-4 w-4" /></span>
                    <h2 className="font-bold text-zinc-900">{sec.title}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {sec.items.map((m) => (
                      <div key={m.label} className="rounded-xl bg-zinc-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-zinc-400 leading-tight">{m.label}</div>
                        <div className="text-[15px] font-bold text-zinc-900 leading-tight">{m.val}{m.unit ? <span className="text-[11px] font-normal text-zinc-400"> {m.unit}</span> : null}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Zones FC */}
            {zones && zTot > 0 && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 font-bold text-zinc-900">Temps par zone de fréquence cardiaque</h2>
                <div className="mb-3 flex h-4 overflow-hidden rounded-full bg-zinc-100">
                  {zones.map((s, i) => (s > 0 ? <div key={i} style={{ width: `${(s / zTot) * 100}%`, background: ZONE_COLORS[i % ZONE_COLORS.length] }} title={`${ZONE_LABELS[i] ?? `Z${i + 1}`} : ${Math.round(s / 60)} min`} /> : null))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {zones.map((s, i) => (s > 0 ? (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                      {ZONE_LABELS[i] ?? `Z${i + 1}`} · <b>{Math.round(s / 60)} min</b> ({Math.round((s / zTot) * 100)}%)
                    </div>
                  ) : null))}
                </div>
              </div>
            )}

            {/* Graphiques */}
            {series && series.length > 4 && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 font-bold text-zinc-900">Courbes de la séance <span className="text-xs font-normal text-zinc-400">· axe = distance (km)</span></h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  <Chart data={series} dataKey="pace" label="Allure" unit="/km" color="#2563eb" reversed />
                  <Chart data={series} dataKey="hr" label="Fréquence cardiaque" unit="bpm" color="#ef4444" />
                  <Chart data={series} dataKey="power" label="Puissance" unit="W" color="#8b5cf6" />
                  <Chart data={series} dataKey="cad" label="Cadence" unit="spm" color="#db2777" />
                  <Chart data={series} dataKey="alt" label="Altitude" unit="m" color="#10b981" />
                </div>
              </div>
            )}

            {/* Tours / splits */}
            {laps && laps.length > 1 && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 font-bold text-zinc-900">Tours / intervalles <span className="text-xs font-normal text-zinc-400">({laps.length})</span></h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-400">
                        <th className="py-2 pr-3 font-semibold">#</th>
                        <th className="py-2 pr-3 font-semibold">Distance</th>
                        <th className="py-2 pr-3 font-semibold">Temps</th>
                        <th className="py-2 pr-3 font-semibold">Allure</th>
                        <th className="py-2 pr-3 font-semibold">GAP</th>
                        <th className="py-2 pr-3 font-semibold">FC moy</th>
                        <th className="py-2 pr-3 font-semibold">FC max</th>
                        <th className="py-2 pr-3 font-semibold">Cadence</th>
                        {hasLapPower && <th className="py-2 pr-3 font-semibold">Puiss.</th>}
                        <th className="py-2 pr-3 font-semibold">D+</th>
                        <th className="py-2 font-semibold">Zone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laps.map((l, i) => (
                        <tr key={i} className="border-b border-zinc-50 last:border-0">
                          <td className="py-2 pr-3 font-semibold text-zinc-400">{i + 1}</td>
                          <td className="py-2 pr-3 text-zinc-800">{l.km} km</td>
                          <td className="py-2 pr-3 text-zinc-600">{fmtTm(l.dur)}</td>
                          <td className="py-2 pr-3 font-semibold text-zinc-900">{paceStr(l.paceMps)}<span className="text-[10px] font-normal text-zinc-400">/km</span></td>
                          <td className="py-2 pr-3 text-zinc-500">{paceStr(l.gapMps)}</td>
                          <td className="py-2 pr-3 text-zinc-600">{l.hr ?? "—"}</td>
                          <td className="py-2 pr-3 text-zinc-400">{l.hrMax ?? "—"}</td>
                          <td className="py-2 pr-3 text-zinc-600">{l.cad ?? "—"}</td>
                          {hasLapPower && <td className="py-2 pr-3 text-zinc-600">{l.power != null ? `${l.power} W` : "—"}</td>}
                          <td className="py-2 pr-3 text-zinc-400">{l.elev != null ? `${l.elev}m` : "—"}</td>
                          <td className="py-2">{l.zone != null ? <span className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: ZONE_COLORS[(l.zone - 1) % ZONE_COLORS.length] }}>Z{l.zone}</span> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pb-4 text-[11px] text-zinc-400">
              <span>⚡ Données live intervals.icu · {nMetrics} métriques{series ? ` · ${series.length} points de mesure` : ""}{laps ? ` · ${laps.length} tours` : ""}</span>
              {!clientMode && (
              <button onClick={sendToAI} disabled={analyzing} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Envoyer à l'IA
              </button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
