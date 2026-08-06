"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { vmaFrom6min } from "@/lib/running/fitness";
import { ArrowRight, ArrowLeft, User, Activity, Target, CheckCircle2, Watch, Eye, EyeOff, ExternalLink, RefreshCw, AlertCircle, Wifi } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { OB } from "./onboardingI18n";
import { HEALTH_CONDITIONS, INJURY_ZONES, healthLabel } from "@/data/healthCatalog";
import { TERRAINS, terrainLabel } from "@/data/terrainCatalog";

type Step = "watch" | "profile" | "physio" | "goals" | "done";

// Le profil et la santé d'abord (questions faciles sur soi : l'athlète s'investit
// progressivement), la connexion montre EN DERNIER et FACULTATIVE — exiger un compte
// intervals.icu avant tout usage de l'app est ce qui fait le plus abandonner à l'inscription.
const STEPS: Step[] = ["profile", "physio", "goals", "watch", "done"];

export default function OnboardingPage() {
  const router = useRouter();
  const { lang } = useT();
  const tr = (k: string, v?: Record<string, string | number>) => {
    let s = (OB[lang] ?? OB.fr)[k] ?? OB.fr[k] ?? k;
    if (v) for (const key in v) s = s.replace(`{${key}}`, String(v[key]));
    return s;
  };

  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState({
    age: "",
    height_cm: "",
    weight_kg: "",
    // Pas de valeur par défaut sur le sexe : un défaut « male » silencieux fausserait tout le
    // coaching d'une athlète qui n'aurait pas touché au champ. On l'oblige à choisir.
    gender: "" as "" | "male" | "female" | "other",
    chronotype: "neutral" as "morning" | "evening" | "neutral",
    is_female_cycle_sync: false,
    warmup_min: 15,
    cooldown_min: 10,
    long_run_mode: "run" as "run" | "bike",
    // Contexte d'entraînement → individualise la prescription du coach IA.
    // Idem : aucun défaut, ces trois réponses changent radicalement la prescription.
    running_years: null as number | null,
    // Terrains MULTIPLES : beaucoup alternent route en semaine et sentier/sable le week-end.
    main_terrains: [] as string[],
    elevation_pref: "" as "" | "evite" | "modere" | "aime" | "specialiste",
    // Santé : contraint la prescription du coach IA (la santé prime sur la performance).
    health_conditions: [] as string[],
    injury_zones: [] as string[],
    health_notes: "",
  });
  // « Rien à signaler » coché explicitement — on distingue « pas de problème de santé »
  // de « l'utilisateur a survolé la question sans répondre ».
  const [healthNone, setHealthNone] = useState(false);

  // Bascule d'une puce santé (sélection multiple). Cocher une pathologie annule « rien à signaler ».
  const toggleHealth = (key: "health_conditions" | "injury_zones", slug: string) => {
    setHealthNone(false);
    setProfile(p => ({ ...p, [key]: p[key].includes(slug) ? p[key].filter(s => s !== slug) : [...p[key], slug] }));
  };
  // Une réponse santé est donnée soit en cochant au moins une entrée, soit « rien à signaler ».
  const healthAnswered = healthNone || profile.health_conditions.length > 0 || profile.injury_zones.length > 0;

  // Champs manquants de l'étape Profil — listés à l'athlète, en toutes lettres.
  const profileMissing = [
    !profile.age && tr("age"),
    !profile.height_cm && tr("height"),
    !profile.weight_kg && tr("weight"),
    !profile.gender && tr("gender"),
    profile.running_years == null && tr("expTitle"),
    profile.main_terrains.length === 0 && tr("terrTitle"),
    !profile.elevation_pref && tr("elevTitle"),
    !healthAnswered && tr("healthTitle"),
    // Retire l'emoji de tête des libellés. `\W` est à proscrire ici : sans le drapeau `u`
    // il classe « Â » comme non-caractère et « Âge » deviendrait « ge ».
  ].filter((x): x is string => typeof x === "string").map(s => s.replace(/^[^\p{L}\p{N}]+/u, ""));

  const [vma, setVma] = useState({ vma_kmh: "", max_hr: "", resting_hr: "" });
  const [test6min, setTest6min] = useState("");
  const [goals, setGoals] = useState({ target_race: "", target_weekly_km: "50" });

  // Watch step state
  const [watchSubStep, setWatchSubStep] = useState(0);
  const [watchAthleteId, setWatchAthleteId] = useState("");
  const [watchApiKey, setWatchApiKey] = useState("");
  const [showWatchKey, setShowWatchKey] = useState(false);
  const [savingWatch, setSavingWatch] = useState(false);
  const [watchSaved, setWatchSaved] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<"checking" | "ok" | "timeout">("checking");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!pollingActive) return;
    let attempts = 0;
    const MAX = 12;
    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch("/api/intervals/status");
        const d = await r.json();
        if (d.configured) {
          const sr = await fetch("/api/intervals/sync?days=7");
          const sd = await sr.json();
          if (sd?.fetched?.activities > 0 || sd?.synced?.workouts >= 0) {
            setPollingStatus("ok");
            clearInterval(pollingRef.current!);
            setPollingActive(false);
            return;
          }
        }
      } catch {}
      if (attempts >= MAX) {
        setPollingStatus("timeout");
        clearInterval(pollingRef.current!);
        setPollingActive(false);
      }
    }, 5000);
    return () => clearInterval(pollingRef.current!);
  }, [pollingActive]);

  const stepIdx = STEPS.indexOf(step);
  const stepLabels = [tr("sProfil"), tr("sPhysio"), tr("sObjectifs"), tr("sMontre")];

  // ── Validation intelligente ──
  const idTrim = watchAthleteId.trim();
  const keyTrim = watchApiKey.trim();
  const idIsEmail = idTrim.includes("@");
  const idValid = /^i\d{3,}$/i.test(idTrim);
  const idHint =
    idTrim === "" ? null :
    idIsEmail ? tr("hIdEmail") :
    !idTrim.toLowerCase().startsWith("i") ? tr("hIdStart") :
    !idValid ? tr("hIdFormat") :
    null;
  const keyLooksLikePassword = keyTrim.length > 0 && keyTrim.length < 20 && /[A-Z!?@#$%^&*]/.test(keyTrim);
  const keyValid = /^[a-z0-9]{16,}$/i.test(keyTrim);
  const keyHint =
    keyTrim === "" ? null :
    keyLooksLikePassword ? tr("hKeyPwd") :
    !keyValid ? tr("hKeyFormat") :
    null;

  function next() { if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1]); }
  function prev() { if (stepIdx > 0) setStep(STEPS[stepIdx - 1]); }

  async function handleSaveWatch(e: React.FormEvent) {
    e.preventDefault();
    setSavingWatch(true);
    setWatchError(null);
    try {
      const res = await fetch("/api/intervals/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: watchAthleteId, apiKey: watchApiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de sauvegarde");
      setWatchSaved(true);
      setPollingActive(true);
      setPollingStatus("checking");
    } catch (err) {
      setWatchError(String(err).replace("Error: ", ""));
    } finally {
      setSavingWatch(false);
    }
  }

  async function handleFinish() {
    setLoading(true);
    // La montre n'est plus bloquante : le plan d'entraînement fonctionne sans elle, la
    // synchro peut être branchée plus tard depuis l'onglet Sync Montre.
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error: profileError } = await supabase.from("profiles").update({
      age: parseInt(profile.age),
      height_cm: parseInt(profile.height_cm),
      weight_kg: parseFloat(profile.weight_kg),
      gender: profile.gender,
      chronotype: profile.chronotype,
      is_female_cycle_sync: profile.is_female_cycle_sync,
      mode: parseFloat(vma.vma_kmh) >= 17 ? "elite" : "ludique",
      onboarding_completed: true,
    }).eq("id", user.id);

    await supabase.from("profiles").update({
      warmup_min: profile.warmup_min,
      cooldown_min: profile.cooldown_min,
      long_run_mode: profile.long_run_mode,
      // `|| null` : les contraintes CHECK en base refusent la chaîne vide.
      running_years: profile.running_years,
      elevation_pref: profile.elevation_pref || null,
      health_conditions: profile.health_conditions,
      injury_zones: profile.injury_zones,
      health_notes: profile.health_notes.trim() || null,
      health_declared: healthAnswered,
    }).eq("id", user.id);

    // Terrains multiples — écriture ISOLÉE : la colonne `main_terrains` arrive avec la
    // migration 009. Si elle manque encore, seule cette ligne échoue, pas tout le profil.
    // Repli sur l'ancienne colonne mono-choix pour ne rien perdre entre-temps.
    await supabase.from("profiles").update({ main_terrains: profile.main_terrains }).eq("id", user.id);
    await supabase.from("profiles").update({ main_terrain: profile.main_terrains[0] ?? null }).eq("id", user.id);

    if (!profileError && vma.vma_kmh) {
      await supabase.from("performance_baselines").insert({
        user_id: user.id,
        vma_kmh: parseFloat(vma.vma_kmh),
        max_hr: parseInt(vma.max_hr) || 190,
        resting_hr: parseInt(vma.resting_hr) || 50,
        tested_at: new Date().toISOString().split("T")[0],
      });
    }

    if (profileError) { toast.error(tr("tSaveError")); setLoading(false); return; }
    setStep("done");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <Logo size={36} />
            <Wordmark className="text-2xl" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">{tr("welcome")}</h1>
          <p className="text-zinc-500">{tr("subtitle")}</p>
        </div>

        {/* Progress */}
        {step !== "done" && (
          <div className="flex items-center gap-2 mb-8">
            {STEPS.slice(0, -1).map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  i < stepIdx ? "bg-emerald-500 text-white" : i === stepIdx ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
                }`}>
                  {i < stepIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === stepIdx ? "text-zinc-900" : "text-zinc-400"}`}>
                  {stepLabels[i]}
                </span>
                {i < STEPS.length - 2 && <div className={`flex-1 h-px ${i < stepIdx ? "bg-emerald-300" : "bg-zinc-200"}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {step === "profile" && (
              <div className="bento-card space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
                    <User className="w-4 h-4 text-zinc-700" />
                  </div>
                  <h2 className="font-semibold text-zinc-900">{tr("pTitle")}</h2>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("age")}</label>
                    <input type="number" value={profile.age} onChange={e => setProfile(p => ({...p, age: e.target.value}))}
                      placeholder="30" min="10" max="99"
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("height")}</label>
                    <input type="number" value={profile.height_cm} onChange={e => setProfile(p => ({...p, height_cm: e.target.value}))}
                      placeholder="175" min="140" max="220"
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("weight")}</label>
                    <input type="number" value={profile.weight_kg} onChange={e => setProfile(p => ({...p, weight_kg: e.target.value}))}
                      placeholder="70" min="40" max="150"
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-2">{tr("gender")}</label>
                  <div className="flex gap-2">
                    {(["male","female","other"] as const).map(g => (
                      <button key={g} type="button" onClick={() => setProfile(p => ({...p, gender: g}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                          profile.gender === g ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                        }`}>
                        {g === "male" ? tr("male") : g === "female" ? tr("female") : tr("other")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-2">{tr("chrono")}</label>
                  <div className="flex gap-2">
                    {[{v:"morning",l:tr("morning")},{v:"neutral",l:tr("neutral")},{v:"evening",l:tr("evening")}].map(c => (
                      <button key={c.v} onClick={() => setProfile(p => ({...p, chronotype: c.v as typeof p.chronotype}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                          profile.chronotype === c.v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200"
                        }`}>
                        {c.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-2">{tr("warmup")}</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[5,10,15,20,25,30].map(m => (
                        <button key={m} type="button" onClick={() => setProfile(p => ({...p, warmup_min: m}))}
                          className={`py-2 rounded-xl text-sm font-medium border transition-all ${profile.warmup_min === m ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-2">{tr("cooldown")}</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[5,10,15,20,25,30].map(m => (
                        <button key={m} type="button" onClick={() => setProfile(p => ({...p, cooldown_min: m}))}
                          className={`py-2 rounded-xl text-sm font-medium border transition-all ${profile.cooldown_min === m ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 -mt-2">{tr("wcHint")}</p>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-2">{tr("longTitle")}</label>
                  <div className="flex gap-2">
                    {([["run", tr("longRun")], ["bike", tr("longBike")]] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setProfile(p => ({ ...p, long_run_mode: v as "run" | "bike" }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${profile.long_run_mode === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("longHint")}</p>
                </div>

                {/* Ancienneté — plafonne la charge que le coach IA se permet de prescrire. */}
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-2">{tr("expTitle")}</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([[0, tr("exp0")], [1, tr("exp1")], [2, tr("exp2")], [4, tr("exp4")], [8, tr("exp8")], [12, tr("exp12")]] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setProfile(p => ({ ...p, running_years: v }))}
                        className={`py-2 rounded-xl text-sm font-medium border transition-all ${profile.running_years === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("expHint")}</p>
                </div>

                {/* Terrains — CHOIX MULTIPLE : décide si les séances se pilotent à l'allure ou à la FC. */}
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-2">{tr("terrTitle")} <span className="font-normal text-zinc-400">· {tr("terrMulti")}</span></label>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {TERRAINS.map(t => {
                      const on = profile.main_terrains.includes(t.slug);
                      return (
                        <button key={t.slug} type="button"
                          onClick={() => setProfile(p => ({ ...p, main_terrains: on ? p.main_terrains.filter(s => s !== t.slug) : [...p.main_terrains, t.slug] }))}
                          className={`py-2 px-1.5 rounded-xl text-xs font-medium border transition-all ${on ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                          {terrainLabel(t, lang)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("terrHint")}</p>
                </div>

                {/* Dénivelé — dose les côtes et le D+ hebdomadaire. */}
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-2">{tr("elevTitle")}</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([["evite", tr("elevEvite")], ["modere", tr("elevModere")], ["aime", tr("elevAime")], ["specialiste", tr("elevSpec")]] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setProfile(p => ({ ...p, elevation_pref: v }))}
                        className={`py-2 rounded-xl text-xs font-medium border transition-all ${profile.elevation_pref === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">{tr("elevHint")}</p>
                </div>

                {/* Santé — la seule section où « rien » est une réponse parfaitement valable. */}
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{tr("healthTitle")}</div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{tr("healthSub")}</p>
                  </div>
                  {([["health_conditions", "condTitle", HEALTH_CONDITIONS], ["injury_zones", "injTitle", INJURY_ZONES]] as const).map(([key, titleKey, catalog]) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr(titleKey)}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {catalog.map(item => {
                          const on = profile[key].includes(item.slug);
                          return (
                            <button key={item.slug} type="button" onClick={() => toggleHealth(key, item.slug)}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${on ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                              {healthLabel(item, lang)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Réponse explicite « rien à signaler » — sans quoi on ne saurait pas
                      distinguer un athlète en pleine forme d'un athlète qui a zappé la question. */}
                  <button type="button"
                    onClick={() => { setHealthNone(v => !v); setProfile(p => ({ ...p, health_conditions: [], injury_zones: [] })); }}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${healthNone ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                    {healthNone ? "✓ " : ""}{tr("healthNone")}
                  </button>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">{tr("notesTitle")}</label>
                    <textarea value={profile.health_notes} onChange={e => setProfile(p => ({ ...p, health_notes: e.target.value }))}
                      placeholder={tr("notesPh")} rows={2} maxLength={500}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">⚕️ {tr("healthDisc")}</p>
                </div>

                {profile.gender === "female" && (
                  <div className="flex items-center justify-between p-4 bg-pink-50 rounded-2xl border border-pink-100">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{tr("cycle")}</div>
                      <div className="text-xs text-zinc-500">{tr("cycleSub")}</div>
                    </div>
                    <button
                      onClick={() => setProfile(p => ({...p, is_female_cycle_sync: !p.is_female_cycle_sync}))}
                      className={`w-11 h-6 rounded-full transition-colors ${profile.is_female_cycle_sync ? "bg-pink-500" : "bg-zinc-200"}`}
                    >
                      <div className={`w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${profile.is_female_cycle_sync ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                )}

                {/* Tout est requis : chacun de ces champs change la prescription du coach.
                    On dit à l'athlète CE QUI manque plutôt que de lui laisser un bouton mort. */}
                {profileMissing.length > 0 && (
                  <p className="flex items-start gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{tr("missing")} <b>{profileMissing.join(" · ")}</b></span>
                  </p>
                )}
                <button onClick={next} disabled={profileMissing.length > 0}
                  className="btn-brand w-full justify-center">
                  {tr("next")} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === "physio" && (
              <div className="bento-card space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
                    <Activity className="w-4 h-4 text-zinc-700" />
                  </div>
                  <h2 className="font-semibold text-zinc-900">{tr("phTitle")}</h2>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800 space-y-2">
                  <div className="font-bold">{tr("testTitle")}</div>
                  <p>{tr("testIntro")}</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
                    <li>{tr("step1")}</li>
                    <li>{tr("step2")}</li>
                    <li>{tr("step3")}</li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-zinc-200 p-4">
                  <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("distLabel")}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={test6min}
                      onChange={e => { setTest6min(e.target.value); const v = vmaFrom6min(parseFloat(e.target.value)); if (v != null) setVma(p => ({ ...p, vma_kmh: String(v) })); }}
                      placeholder="ex: 1650" min="800" max="3500" step="10"
                      className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {test6min && vmaFrom6min(parseFloat(test6min)) != null && (
                      <div className="px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm whitespace-nowrap">{tr("vmaResult", { v: vmaFrom6min(parseFloat(test6min))! })}</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("vmaLabel")}</label>
                  <input type="number" value={vma.vma_kmh} onChange={e => setVma(p => ({...p, vma_kmh: e.target.value}))}
                    placeholder="ex: 16.5" min="8" max="30" step="0.5"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <p className="text-[11px] text-zinc-400 mt-1">{tr("vmaHint")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("maxHr")}</label>
                    <input type="number" value={vma.max_hr} onChange={e => setVma(p => ({...p, max_hr: e.target.value}))}
                      placeholder="190" min="140" max="220"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("restHr")}</label>
                    <input type="number" value={vma.resting_hr} onChange={e => setVma(p => ({...p, resting_hr: e.target.value}))}
                      placeholder="55" min="30" max="100"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>

                {vma.vma_kmh && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <div className="text-sm font-semibold text-emerald-800 mb-3">{tr("zonesTitle")}</div>
                    <div className="grid grid-cols-5 gap-1 text-xs">
                      {computeZones(parseFloat(vma.vma_kmh)).map((z, i) => (
                        <div key={i} className={`rounded-lg p-2 text-center zone-z${i+1}`}>
                          <div className="font-semibold">Z{i+1}</div>
                          <div>{z}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!(parseFloat(vma.vma_kmh) >= 8 && parseFloat(vma.vma_kmh) <= 30) && (
                  <p className="text-xs text-amber-600">{tr("required")}</p>
                )}
                <div className="flex gap-3">
                  <button onClick={prev} className="btn-secondary flex-1 justify-center">
                    <ArrowLeft className="w-4 h-4" /> {tr("back")}
                  </button>
                  <button onClick={next} disabled={!(parseFloat(vma.vma_kmh) >= 8 && parseFloat(vma.vma_kmh) <= 30)}
                    className="btn-brand flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {tr("next")} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === "goals" && (
              <div className="bento-card space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
                    <Target className="w-4 h-4 text-zinc-700" />
                  </div>
                  <h2 className="font-semibold text-zinc-900">{tr("gTitle")}</h2>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">{tr("volumeLabel")}</label>
                  <input type="range" min="5" max="200" step="5" value={goals.target_weekly_km}
                    onChange={e => setGoals(g => ({...g, target_weekly_km: e.target.value}))}
                    className="w-full accent-emerald-500" />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>5 km</span>
                    <span className="font-semibold text-zinc-900">{tr("perWeek", { v: goals.target_weekly_km })}</span>
                    <span>200 km</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={prev} className="btn-secondary flex-1 justify-center">
                    <ArrowLeft className="w-4 h-4" /> {tr("back")}
                  </button>
                  <button onClick={next} className="btn-brand flex-1 justify-center">
                    {tr("next")} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === "watch" && (
              <div className="bento-card space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-zinc-900">{tr("wTitle")}</h2>
                    <p className="text-xs text-zinc-400 mt-0.5 font-medium">{tr("wOptional")}</p>
                  </div>
                  <div className="text-xs text-zinc-400 font-medium">{watchSubStep + 1}/4</div>
                </div>

                {/* Sortie facultative : on termine sans montre et on synchronisera plus tard.
                    C'est l'écran qui coûte le plus d'inscriptions — il ne doit jamais être un mur. */}
                <button onClick={handleFinish} disabled={loading}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                  {loading ? tr("saving") : tr("wSkip")}
                </button>

                {/* Sub-step progress dots */}
                <div className="flex gap-1.5">
                  {[tr("wsAccount"), tr("wsWatch"), tr("wsKey"), tr("wsConn")].map((label, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`h-1.5 w-full rounded-full transition-all ${
                        i < watchSubStep ? "bg-emerald-400" : i === watchSubStep ? "bg-zinc-900" : "bg-zinc-100"
                      }`} />
                      <span className={`text-[10px] font-medium ${i === watchSubStep ? "text-zinc-900" : i < watchSubStep ? "text-emerald-600" : "text-zinc-300"}`}>
                        {i < watchSubStep ? "✓" : label}
                      </span>
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={watchSubStep} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>

                    {/* STEP 0 — Compte Intervals.icu */}
                    {watchSubStep === 0 && (
                      <div className="space-y-4 py-2 text-center">
                        <div className="text-5xl">🌐</div>
                        <div>
                          <p className="font-semibold text-zinc-900 text-base">{tr("w0Title")}</p>
                          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{tr("w0Desc")}</p>
                        </div>

                        <div className="flex items-center justify-center gap-2 py-1">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-2xl">⌚</div>
                            <span className="text-[10px] text-zinc-400 font-medium">{tr("w0Watch")}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-300" />
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 bg-blue-50 border-2 border-blue-200 rounded-2xl flex items-center justify-center text-2xl">🌐</div>
                            <span className="text-[10px] text-blue-500 font-semibold">{tr("w0Intervals")}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-300" />
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-center text-2xl">🏔</div>
                            <span className="text-[10px] text-emerald-600 font-semibold">{tr("w0App")}</span>
                          </div>
                        </div>

                        <a href="https://intervals.icu/signup" target="_blank" rel="noopener noreferrer"
                          className="btn-brand justify-center w-full">
                          {tr("w0Create")} <ExternalLink className="w-4 h-4" />
                        </a>
                        <button onClick={() => setWatchSubStep(1)}
                          className="w-full flex items-center justify-center gap-1.5 text-sm text-zinc-600 font-medium hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 rounded-xl py-2.5 transition-colors">
                          {tr("w0Have")}
                        </button>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{tr("w0Tip")}</p>
                      </div>
                    )}

                    {/* STEP 1 — Connecter la montre */}
                    {watchSubStep === 1 && (
                      <div className="space-y-4 py-2">
                        <div className="text-center">
                          <div className="text-5xl mb-3">⌚</div>
                          <p className="font-semibold text-zinc-900 text-base">{tr("w1Title")}</p>
                          <p className="text-xs text-zinc-500 mt-1">{tr("w1Where")}</p>
                        </div>
                        <div className="flex justify-center gap-2 flex-wrap">
                          {["Garmin", "COROS", "Polar", "Suunto", "Wahoo"].map(b => (
                            <span key={b} className="px-2.5 py-1 bg-zinc-100 rounded-lg text-xs font-medium text-zinc-600">{b}</span>
                          ))}
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5">
                          <p className="text-xs font-semibold text-amber-700">{tr("w1PermsTitle")}</p>
                          {[tr("w1Perm1"), tr("w1Perm2"), tr("w1Perm3")].map(p => (
                            <div key={p} className="flex items-center gap-2 text-xs text-amber-700">
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />{p}
                            </div>
                          ))}
                          <p className="text-[11px] text-amber-600 mt-1">{tr("w1Garmin")}</p>
                        </div>
                        <a href="https://intervals.icu/settings/connections" target="_blank" rel="noopener noreferrer"
                          className="btn-brand justify-center w-full">
                          {tr("w1Open")} <ExternalLink className="w-4 h-4" />
                        </a>
                        <div className="flex gap-3">
                          <button onClick={() => setWatchSubStep(0)} className="flex-1 text-xs text-zinc-400 hover:text-zinc-600 py-2">← {tr("back")}</button>
                          <button onClick={() => setWatchSubStep(2)} className="flex-1 btn-brand justify-center text-sm py-2">{tr("w1Done")}</button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2 — Clé API */}
                    {watchSubStep === 2 && (
                      <div className="space-y-4 py-2">
                        <div className="text-center">
                          <div className="text-5xl">🔑</div>
                          <p className="font-semibold text-zinc-900 text-base mt-2">{tr("w2Title")}</p>
                          <p className="text-xs text-zinc-500 mt-1">{tr("w2Where")}</p>
                        </div>

                        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                          <div className="bg-zinc-50 border-b border-zinc-100 px-3 py-2 flex items-center gap-1.5">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 rounded-full bg-red-300" />
                              <span className="w-2 h-2 rounded-full bg-amber-300" />
                              <span className="w-2 h-2 rounded-full bg-emerald-300" />
                            </div>
                            <span className="text-[10px] text-zinc-400 ml-1">{tr("w2Mock")}</span>
                          </div>
                          <div className="p-3 space-y-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-blue-50 border-2 border-blue-300 rounded-lg px-3 py-2 animate-pulse">
                                <p className="text-[10px] text-blue-400 font-medium">Athlete ID</p>
                                <p className="font-mono text-sm font-bold text-blue-700">i564686</p>
                              </div>
                              <div className="flex items-center gap-1 text-blue-500 w-20">
                                <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                                <span className="text-[11px] font-semibold leading-tight">{tr("w2Code1")}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-emerald-50 border-2 border-emerald-300 rounded-lg px-3 py-2 animate-pulse">
                                <p className="text-[10px] text-emerald-500 font-medium">API Key</p>
                                <p className="font-mono text-xs font-bold text-emerald-700 truncate">a1b2c3d4e5f6…</p>
                              </div>
                              <div className="flex items-center gap-1 text-emerald-600 w-20">
                                <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                                <span className="text-[11px] font-semibold leading-tight">{tr("w2Code2")}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1">
                          <p className="text-[11px] text-amber-700 flex items-start gap-1.5"><span>❌</span> <span>{tr("w2Warn1")}</span></p>
                          <p className="text-[11px] text-amber-700 flex items-start gap-1.5"><span>👉</span> <span>{tr("w2Warn2")}</span></p>
                        </div>

                        <a href="https://intervals.icu/settings#developer" target="_blank" rel="noopener noreferrer"
                          className="btn-brand justify-center w-full">
                          {tr("w2Open")} <ExternalLink className="w-4 h-4" />
                        </a>
                        <div className="flex gap-3">
                          <button onClick={() => setWatchSubStep(1)} className="flex-1 text-xs text-zinc-400 hover:text-zinc-600 py-2">← {tr("back")}</button>
                          <button onClick={() => setWatchSubStep(3)} className="flex-1 btn-brand justify-center text-sm py-2">{tr("w2Have")}</button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3 — Connexion finale */}
                    {watchSubStep === 3 && (
                      <div className="space-y-4 py-1">
                        {!watchSaved ? (
                          <form onSubmit={handleSaveWatch} className="space-y-4">
                            <div className="text-center">
                              <div className="text-4xl mb-2">🎯</div>
                              <p className="font-semibold text-zinc-900">{tr("w3Title")}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">{tr("w3Sub")}</p>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-1.5">
                                  <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded text-[10px] font-bold flex items-center justify-center">1</span>
                                  Athlete ID <span className="text-zinc-400 font-normal">{tr("w3IdNote")}</span>
                                </label>
                                <div className="relative">
                                  <input type="text" value={watchAthleteId} onChange={e => setWatchAthleteId(e.target.value)}
                                    placeholder="i564686"
                                    className={`w-full px-3 py-2.5 pr-9 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
                                      idHint ? "border-red-300 focus:ring-red-400 bg-red-50/40" :
                                      idValid ? "border-emerald-300 focus:ring-emerald-400 bg-emerald-50/40" :
                                      "border-zinc-200 focus:ring-emerald-500"
                                    }`} />
                                  {idValid && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                  {idHint && <AlertCircle className="w-4 h-4 text-red-400 absolute right-3 top-1/2 -translate-y-1/2" />}
                                </div>
                                {idHint && <p className="text-[11px] text-red-500 mt-1 flex items-start gap-1"><span>⚠️</span>{idHint}</p>}
                              </div>
                              <div>
                                <label className="text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-1.5">
                                  <span className="w-4 h-4 bg-emerald-100 text-emerald-600 rounded text-[10px] font-bold flex items-center justify-center">2</span>
                                  {tr("w3KeyLabel")} <span className="text-zinc-400 font-normal">{tr("w3KeyNote")}</span>
                                </label>
                                <div className="relative">
                                  <input type={showWatchKey ? "text" : "password"} value={watchApiKey} onChange={e => setWatchApiKey(e.target.value)}
                                    placeholder="a1b2c3d4e5f6…"
                                    className={`w-full px-3 py-2.5 pr-16 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
                                      keyHint ? "border-red-300 focus:ring-red-400 bg-red-50/40" :
                                      keyValid ? "border-emerald-300 focus:ring-emerald-400 bg-emerald-50/40" :
                                      "border-zinc-200 focus:ring-emerald-500"
                                    }`} />
                                  {keyValid && <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute right-9 top-1/2 -translate-y-1/2" />}
                                  {keyHint && <AlertCircle className="w-4 h-4 text-red-400 absolute right-9 top-1/2 -translate-y-1/2" />}
                                  <button type="button" onClick={() => setShowWatchKey(v => !v)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                    {showWatchKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                                {keyHint && <p className="text-[11px] text-red-500 mt-1 flex items-start gap-1"><span>⚠️</span>{keyHint}</p>}
                              </div>
                            </div>
                            {watchError && (
                              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{watchError}
                              </div>
                            )}
                            <button type="submit" disabled={savingWatch || !idValid || !keyValid}
                              className="btn-brand w-full justify-center disabled:opacity-40">
                              {savingWatch ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />{tr("w3Verifying")}</> : tr("w3Connect")}
                            </button>
                            <button type="button" onClick={() => setWatchSubStep(2)}
                              className="w-full text-xs text-zinc-400 hover:text-zinc-600 text-center py-1">← {tr("back")}</button>
                          </form>
                        ) : (
                          <div className="text-center space-y-4 py-4">
                            {pollingStatus === "checking" && (
                              <>
                                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
                                  <Wifi className="w-7 h-7 text-blue-500 animate-pulse" />
                                </div>
                                <div>
                                  <p className="font-semibold text-zinc-900">{tr("w3CheckTitle")}</p>
                                  <p className="text-xs text-zinc-500 mt-1">{tr("w3CheckSub")}</p>
                                </div>
                                <div className="flex justify-center gap-1.5">
                                  {[0,1,2].map(i => (
                                    <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                  ))}
                                </div>
                              </>
                            )}
                            {pollingStatus === "ok" && (
                              <>
                                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-zinc-900">{tr("w3OkTitle")}</p>
                                  <p className="text-xs text-zinc-500 mt-1">{tr("w3OkSub")}</p>
                                </div>
                              </>
                            )}
                            {pollingStatus === "timeout" && (
                              <>
                                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
                                  <RefreshCw className="w-7 h-7 text-amber-500" />
                                </div>
                                <div>
                                  <p className="font-semibold text-zinc-900">{tr("w3ToTitle")}</p>
                                  <p className="text-xs text-zinc-500 mt-1">{tr("w3ToSub")}</p>
                                </div>
                              </>
                            )}
                            <button onClick={next}
                              className="btn-brand w-full justify-center">
                              {tr("w3Configure")} <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {step === "done" && (
              <div className="bento-card text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">{tr("doneTitle")}</h2>
                  <p className="text-zinc-500 mt-2">{tr("doneSub")}</p>
                </div>
                <button onClick={() => router.push("/dashboard")} className="btn-brand justify-center w-full py-3.5 text-base">
                  {tr("doneCta")} <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function computeZones(vma: number): string[] {
  const paces = [
    vma * 0.60, vma * 0.72,
    vma * 0.72, vma * 0.82,
    vma * 0.82, vma * 0.87,
    vma * 0.87, vma * 0.92,
    vma * 0.92, vma,
  ];
  return [0,1,2,3,4].map(i => {
    const lo = 60 / paces[i*2];
    const hi = 60 / paces[i*2+1];
    return `${lo.toFixed(0)}-${hi.toFixed(0)}'`;
  });
}
