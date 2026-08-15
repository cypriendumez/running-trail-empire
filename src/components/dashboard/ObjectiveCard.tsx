"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Target, Loader2, Check, Pencil, Search, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { AvertissementAge as Avertissement } from "@/lib/coach/ageDistance";

export type Objective = {
  race: string; distanceKm: number; raceDate: string;
  targetSeconds: number; targetTime: string; targetPace: string;
};

type RaceSug = { name: string; city: string; distanceKm: number | null; date: string; type: string };

const PRESETS: { label: string; km: number }[] = [
  { label: "1000 m", km: 1 }, { label: "1500 m", km: 1.5 }, { label: "3000 m", km: 3 },
  { label: "5 km", km: 5 }, { label: "10 km", km: 10 },
  { label: "Semi", km: 21.1 }, { label: "Marathon", km: 42.2 }, { label: "Trail 25K", km: 25 },
];

const inputCls = "w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";
const numCls = "w-14 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-sm tabular-nums outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";

// Distance fiable d'une course : déduite du NOM (plus fiable que le catalogue, parfois
// erroné — ex. « Marathon de Lille » tagué 10 km). Une distance explicite dans le nom prime.
function inferDistance(name: string, dbKm: number | null): number | null {
  const n = (name || "").toLowerCase();
  const km = n.match(/(\d{1,3}(?:[.,]\d)?)\s?k(?:m)?\b/);       // "10 km", "25k", "42.2km", "100k"
  if (km) return parseFloat(km[1].replace(",", "."));
  const m = n.match(/\b(800|1000|1500|3000|5000|10000)\s?m\b/); // distances piste (mètres)
  if (m) return Number(m[1]) / 1000;
  if (/semi|half|½/.test(n)) return 21.1;                       // semi-marathon
  if (/marathon/.test(n)) return 42.2;                          // marathon
  return dbKm;                                                  // sinon : distance du catalogue
}

export function ObjectiveCard({ objective, currentVma }: { objective: Objective | null; currentVma?: number | null }) {
  const router = useRouter();
  const { t, lang } = useT();
  const [editing, setEditing] = useState(!objective);
  const [race, setRace] = useState(objective?.race ?? "");
  const [distance, setDistance] = useState(objective ? String(objective.distanceKm) : "");
  const s0 = objective?.targetSeconds ?? 0;
  const [th, setTh] = useState(s0 >= 3600 ? String(Math.floor(s0 / 3600)) : "");
  const [tm, setTm] = useState(s0 ? String(Math.floor((s0 % 3600) / 60)) : "");
  const [ts, setTs] = useState(s0 % 60 ? String(s0 % 60) : "");
  const [date, setDate] = useState(objective?.raceDate ?? "");
  const [saving, setSaving] = useState(false);
  /** Avertissements liés à l'âge, renvoyés par l'API au moment de l'enregistrement.
   *  Affichés SOUS l'objectif, et refermables : c'est une information, pas une punition. */
  const [avertissements, setAvertissements] = useState<Avertissement[]>([]);

  // Autocomplétion des courses (catalogue) → sélection auto-remplit distance + date.
  const [sug, setSug] = useState<RaceSug[]>([]);
  const [openSug, setOpenSug] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRace = (v: string) => {
    setRace(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (v.trim().length < 2) { setSug([]); setOpenSug(false); return; }
    debRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/races/search?q=${encodeURIComponent(v.trim())}`);
        const j = await r.json();
        setSug(j.races ?? []); setOpenSug((j.races ?? []).length > 0);
      } catch { /* ignore */ }
    }, 250);
  };
  const pickRace = (s: RaceSug) => {
    setRace(s.name);
    const km = inferDistance(s.name, s.distanceKm);
    if (km) setDistance(String(km));
    // Ignore les dates « placeholder » (2099 = date inconnue) → l'utilisateur la renseigne.
    if (s.date && new Date(s.date + "T00:00:00").getFullYear() < 2099) setDate(s.date);
    else setDate("");
    setOpenSug(false); setSug([]);
  };

  const targetSeconds = (Number(th) || 0) * 3600 + (Number(tm) || 0) * 60 + (Number(ts) || 0);

  const save = async () => {
    if (!race.trim()) return toast.error(t("obj.errRace"));
    if (!(Number(distance) > 0)) return toast.error(t("obj.errDistance"));
    if (targetSeconds <= 0) return toast.error(t("obj.errTime"));
    if (!date) return toast.error(t("obj.errDate"));
    setSaving(true);
    try {
      const r = await fetch("/api/objective", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ race: race.trim(), distanceKm: Number(distance), targetTime: `${Number(th) || 0}:${Number(tm) || 0}:${Number(ts) || 0}`, raceDate: date }),
      });
      const j = await r.json();
      if (j.ok) {
        toast.success(t("obj.ok"));
        // ── AVERTISSEMENT D'ÂGE ────────────────────────────────────────────────
        // L'objectif est ENREGISTRÉ quoi qu'il arrive : c'est le sien, on ne décide
        // pas à sa place. Mais un athlète de 18 ans qui vise un marathon ne pourra
        // pas s'inscrire à une épreuve officielle en France, et l'apprendre après
        // douze semaines de préparation serait cruel. On le lui dit maintenant,
        // pendant qu'il peut encore choisir une autre course.
        // Plusieurs autorités peuvent parler en même temps : à 16 ans, un marathon
        // se heurte à la règle fédérale ET à l'avis médical. On les affiche toutes.
        if (Array.isArray(j.avertissementsAge) && j.avertissementsAge.length) {
          setAvertissements(j.avertissementsAge as Avertissement[]);
        }
        setEditing(false);
        router.refresh();
      }
      else toast.error(j.error || t("obj.fail"));
    } catch { toast.error(t("obj.saveFail")); }
    finally { setSaving(false); }
  };

  const daysTo = objective
    ? Math.ceil((new Date(objective.raceDate + "T00:00:00").getTime() - Date.now()) / 86400000)
    : null;

  // ── Vue lecture — barre compacte (mini) ──
  if (objective && !editing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="mb-5 rounded-2xl border border-indigo-100 bg-white px-3.5 py-2.5 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <Target className="h-4 w-4 flex-shrink-0 text-indigo-500" />
          <span className="text-sm font-bold text-zinc-900">{objective.race}</span>
          {daysTo != null && daysTo >= 0 && (
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold leading-none text-white">J-{daysTo}</span>
          )}
          <span className="text-xs font-medium tabular-nums text-zinc-400">
            {objective.distanceKm} km · {objective.targetTime} · {objective.targetPace}
          </span>
          <button onClick={() => setEditing(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-50">
            <Pencil className="h-3 w-3" /> {t("obj.edit")}
          </button>
        </div>
        {/* Avertissement d'âge. Ambre pour un conseil de progression, rouge quand la
            distance n'est pas autorisée par le règlement fédéral — la nuance compte :
            l'un se discute, l'autre empêche de s'inscrire. */}
        {avertissements.map((a, i) => (
          <div key={i} className={`mt-2.5 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
            a.niveau === "reglement" ? "border-red-200 bg-red-50 text-red-900"
              : a.niveau === "medical" ? "border-orange-200 bg-orange-50 text-orange-900"
              : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <p>{a.texte}</p>
            {/* La SOURCE est affichée. Un avertissement de santé qu'on ne peut pas
                vérifier ne se discute pas — et finit par ne plus se croire. */}
            {a.sources?.length > 0 && (
              <p className="mt-1 text-[11px] italic opacity-75">Source : {a.sources.join(" · ")}</p>
            )}
            {i === avertissements.length - 1 && (
              <button onClick={() => setAvertissements([])}
                className="mt-1.5 text-[11px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100">
                {t("obj.warnClose")}
              </button>
            )}
          </div>
        ))}
      </motion.div>
    );
  }

  // ── Vue édition / création — formulaire compact ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="mb-5 rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(16,24,40,0.12)] sm:p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
          <Target className="h-3.5 w-3.5 text-indigo-500" />
        </span>
        <div>
          <div className="text-sm font-bold text-zinc-900">{objective ? t("obj.editTitle") : t("obj.createTitle")}</div>
          <div className="text-[11px] text-zinc-400">{t("obj.sub")}</div>
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-600">{t("obj.race")}</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-300" />
            <input value={race} onChange={(e) => onRace(e.target.value)} onFocus={() => sug.length && setOpenSug(true)}
              onBlur={() => setTimeout(() => setOpenSug(false), 150)}
              placeholder={t("obj.racePh")} className={inputCls + " pl-8"} autoComplete="off" />
            {openSug && (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                {sug.map((s, i) => (
                  <button key={i} type="button" onMouseDown={(e) => { e.preventDefault(); pickRace(s); }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-indigo-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-800">{s.name}</span>
                      <span className="flex items-center gap-1 truncate text-[11px] text-zinc-400">
                        {s.city && <><MapPin className="h-2.5 w-2.5" />{s.city} · </>}{new Date(s.date + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </span>
                    {(() => { const dk = inferDistance(s.name, s.distanceKm); return dk != null ? <span className="flex-shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-600">{dk} km</span> : null; })()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <div>
          <span className="mb-1 block text-xs font-semibold text-zinc-600">{t("obj.distance")}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => setDistance(String(p.km))}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${Number(distance) === p.km ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                {p.km === 21.1 ? t("obj.presetHalf") : p.km === 25 ? t("obj.presetTrail25") : p.label}
              </button>
            ))}
            <div className="relative ml-auto w-[88px]">
              <input type="number" inputMode="decimal" step="0.1" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="42.2" className={inputCls + " pr-7 text-right"} />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">km</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs font-semibold text-zinc-600">{t("obj.target")}</span>
            <div className="flex items-center gap-1.5">
              <input type="number" min="0" max="99" inputMode="numeric" value={th} onChange={(e) => setTh(e.target.value)} placeholder="3" className={numCls} aria-label={t("obj.hours")} />
              <span className="text-xs text-zinc-400">h</span>
              <input type="number" min="0" max="59" inputMode="numeric" value={tm} onChange={(e) => setTm(e.target.value)} placeholder="30" className={numCls} aria-label={t("obj.minutes")} />
              <span className="text-xs text-zinc-400">min</span>
              <input type="number" min="0" max="59" inputMode="numeric" value={ts} onChange={(e) => setTs(e.target.value)} placeholder="00" className={numCls} aria-label={t("obj.seconds")} />
              <span className="text-xs text-zinc-400">s</span>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">{t("obj.date")}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("obj.save")}
          </button>
          {objective && (
            <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-500 transition-colors hover:bg-zinc-100">
              {t("obj.cancel")}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
