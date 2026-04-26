"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, User, Activity, Target, CheckCircle2, Watch, Eye, EyeOff, ExternalLink, RefreshCw, AlertCircle, Wifi } from "lucide-react";

type Step = "profile" | "physio" | "goals" | "watch" | "done";

const STEPS: Step[] = ["profile", "physio", "goals", "watch", "done"];
const STEP_LABELS = ["Profil", "Données physio", "Objectifs", "Montre"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState({
    age: "",
    height_cm: "",
    weight_kg: "",
    gender: "male" as "male" | "female" | "other",
    chronotype: "neutral" as "morning" | "evening" | "neutral",
    is_female_cycle_sync: false,
  });

  const [vma, setVma] = useState({ vma_kmh: "", max_hr: "", resting_hr: "" });
  const [goals, setGoals] = useState({ target_race: "", target_weekly_km: "50" });

  // Watch step state
  const [watchSubStep, setWatchSubStep] = useState(0); // 0=compte 1=montre 2=clé 3=connecter
  const [watchAthleteId, setWatchAthleteId] = useState("");
  const [watchApiKey, setWatchApiKey] = useState("");
  const [showWatchKey, setShowWatchKey] = useState(false);
  const [savingWatch, setSavingWatch] = useState(false);
  const [watchSaved, setWatchSaved] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<"checking" | "ok" | "timeout">("checking");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-poll Intervals.icu after credentials saved
  useEffect(() => {
    if (!pollingActive) return;
    let attempts = 0;
    const MAX = 12; // 12 × 5s = 60s timeout
    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch("/api/intervals/status");
        const d = await r.json();
        if (d.configured) {
          // Try a quick sync to confirm activities exist
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

  function next() {
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1]);
  }
  function prev() {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1]);
  }

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

    if (!profileError && vma.vma_kmh) {
      await supabase.from("performance_baselines").insert({
        user_id: user.id,
        vma_kmh: parseFloat(vma.vma_kmh),
        max_hr: parseInt(vma.max_hr) || 190,
        resting_hr: parseInt(vma.resting_hr) || 50,
        tested_at: new Date().toISOString().split("T")[0],
      });
    }

    if (profileError) { toast.error("Erreur lors de la sauvegarde"); setLoading(false); return; }
    setStep("done");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold">R</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Bienvenue dans l&apos;Empire</h1>
          <p className="text-zinc-500">Calibrons votre profil pour des plans sur mesure</p>
        </div>

        {/* Progress */}
        {step !== "done" && (
          <div className="flex items-center gap-2 mb-8">
            {STEPS.slice(0, -1).map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  i < stepIdx ? "bg-green-500 text-white" : i === stepIdx ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"
                }`}>
                  {i < stepIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === stepIdx ? "text-zinc-900" : "text-zinc-400"}`}>
                  {STEP_LABELS[i]}
                </span>
                {i < STEPS.length - 2 && <div className={`flex-1 h-px ${i < stepIdx ? "bg-green-300" : "bg-zinc-200"}`} />}
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
                  <h2 className="font-semibold text-zinc-900">Votre profil</h2>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Âge</label>
                    <input type="number" value={profile.age} onChange={e => setProfile(p => ({...p, age: e.target.value}))}
                      placeholder="30" min="10" max="99"
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Taille (cm)</label>
                    <input type="number" value={profile.height_cm} onChange={e => setProfile(p => ({...p, height_cm: e.target.value}))}
                      placeholder="175" min="140" max="220"
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Poids (kg)</label>
                    <input type="number" value={profile.weight_kg} onChange={e => setProfile(p => ({...p, weight_kg: e.target.value}))}
                      placeholder="70" min="40" max="150"
                      className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-2">Genre</label>
                  <div className="flex gap-2">
                    {(["male","female","other"] as const).map(g => (
                      <button key={g} onClick={() => setProfile(p => ({...p, gender: g}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                          profile.gender === g ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                        }`}>
                        {g === "male" ? "Homme" : g === "female" ? "Femme" : "Autre"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-2">Chronotype</label>
                  <div className="flex gap-2">
                    {[{v:"morning",l:"🌅 Matin"},{v:"neutral",l:"☀️ Neutre"},{v:"evening",l:"🌙 Soir"}].map(c => (
                      <button key={c.v} onClick={() => setProfile(p => ({...p, chronotype: c.v as typeof p.chronotype}))}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                          profile.chronotype === c.v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200"
                        }`}>
                        {c.l}
                      </button>
                    ))}
                  </div>
                </div>

                {profile.gender === "female" && (
                  <div className="flex items-center justify-between p-4 bg-pink-50 rounded-2xl border border-pink-100">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">Cycle Sync</div>
                      <div className="text-xs text-zinc-500">Ajustement hormonal de la charge</div>
                    </div>
                    <button
                      onClick={() => setProfile(p => ({...p, is_female_cycle_sync: !p.is_female_cycle_sync}))}
                      className={`w-11 h-6 rounded-full transition-colors ${profile.is_female_cycle_sync ? "bg-pink-500" : "bg-zinc-200"}`}
                    >
                      <div className={`w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${profile.is_female_cycle_sync ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                )}

                <button onClick={next} disabled={!profile.age || !profile.height_cm || !profile.weight_kg}
                  className="btn-brand w-full justify-center">
                  Suivant <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === "physio" && (
              <div className="bento-card space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
                    <Activity className="w-4 h-4 text-zinc-700" />
                  </div>
                  <h2 className="font-semibold text-zinc-900">Données physiologiques</h2>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800">
                  <strong>Test VMA recommandé :</strong> Courez 6 min à allure maximale sur terrain plat. Distance parcourue ÷ 0.1 = votre VMA en km/h.
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">VMA (km/h) — optionnel</label>
                  <input type="number" value={vma.vma_kmh} onChange={e => setVma(p => ({...p, vma_kmh: e.target.value}))}
                    placeholder="ex: 16.5" min="8" max="30" step="0.5"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">FC Max (bpm)</label>
                    <input type="number" value={vma.max_hr} onChange={e => setVma(p => ({...p, max_hr: e.target.value}))}
                      placeholder="190" min="140" max="220"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">FC Repos (bpm)</label>
                    <input type="number" value={vma.resting_hr} onChange={e => setVma(p => ({...p, resting_hr: e.target.value}))}
                      placeholder="55" min="30" max="100"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>

                {vma.vma_kmh && (
                  <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                    <div className="text-sm font-semibold text-green-800 mb-3">Vos zones calculées</div>
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

                <div className="flex gap-3">
                  <button onClick={prev} className="btn-secondary flex-1 justify-center">
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                  <button onClick={next} className="btn-brand flex-1 justify-center">
                    Suivant <ArrowRight className="w-4 h-4" />
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
                  <h2 className="font-semibold text-zinc-900">Vos objectifs</h2>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Volume cible / semaine (km)</label>
                  <input type="range" min="10" max="150" step="5" value={goals.target_weekly_km}
                    onChange={e => setGoals(g => ({...g, target_weekly_km: e.target.value}))}
                    className="w-full accent-green-500" />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>10 km</span>
                    <span className="font-semibold text-zinc-900">{goals.target_weekly_km} km/sem</span>
                    <span>150 km</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={prev} className="btn-secondary flex-1 justify-center">
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                  <button onClick={next} className="btn-brand flex-1 justify-center">
                    Suivant <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === "watch" && (
              <div className="bento-card space-y-5">

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-zinc-900">🔗 Connecter votre montre</h2>
                    <p className="text-xs text-red-400 mt-0.5 font-medium">Obligatoire · ~2 minutes</p>
                  </div>
                  <div className="text-xs text-zinc-400 font-medium">{watchSubStep + 1}/4</div>
                </div>

                {/* Sub-step progress dots */}
                <div className="flex gap-1.5">
                  {["Compte", "Montre", "Clé API", "Connexion"].map((label, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`h-1.5 w-full rounded-full transition-all ${
                        i < watchSubStep ? "bg-green-400" : i === watchSubStep ? "bg-zinc-900" : "bg-zinc-100"
                      }`} />
                      <span className={`text-[10px] font-medium ${i === watchSubStep ? "text-zinc-900" : i < watchSubStep ? "text-green-600" : "text-zinc-300"}`}>
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
                          <p className="font-semibold text-zinc-900 text-base">Créez un compte Intervals.icu</p>
                          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                            Gratuit. C&apos;est le pont entre votre montre<br />(Garmin, COROS, Polar, Suunto…) et cette app.
                          </p>
                        </div>
                        <a href="https://intervals.icu" target="_blank" rel="noopener noreferrer"
                          className="btn-brand justify-center w-full">
                          Créer mon compte gratuit <ExternalLink className="w-4 h-4" />
                        </a>
                        <button onClick={() => setWatchSubStep(1)}
                          className="w-full text-xs text-zinc-400 hover:text-zinc-700 underline underline-offset-2 transition-colors">
                          J&apos;ai déjà un compte →
                        </button>
                      </div>
                    )}

                    {/* STEP 1 — Connecter la montre */}
                    {watchSubStep === 1 && (
                      <div className="space-y-4 py-2">
                        <div className="text-center">
                          <div className="text-5xl mb-3">⌚</div>
                          <p className="font-semibold text-zinc-900 text-base">Connectez votre montre</p>
                          <p className="text-xs text-zinc-500 mt-1">Sur Intervals.icu → Avatar → Connexions</p>
                        </div>
                        {/* Brands */}
                        <div className="flex justify-center gap-2 flex-wrap">
                          {["Garmin", "COROS", "Polar", "Suunto", "Wahoo"].map(b => (
                            <span key={b} className="px-2.5 py-1 bg-zinc-100 rounded-lg text-xs font-medium text-zinc-600">{b}</span>
                          ))}
                        </div>
                        {/* Permissions reminder */}
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1.5">
                          <p className="text-xs font-semibold text-amber-700">⚠️ Sur Garmin Connect, activez :</p>
                          {["Activities", "Daily Health Stats", "Historical Data"].map(p => (
                            <div key={p} className="flex items-center gap-2 text-xs text-amber-700">
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />{p}
                            </div>
                          ))}
                          <a href="https://connect.garmin.com/modern/settings/application-list" target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold hover:underline mt-1">
                            Ouvrir Garmin Connect <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <a href="https://intervals.icu/settings/connections" target="_blank" rel="noopener noreferrer"
                          className="btn-brand justify-center w-full">
                          Ouvrir les Connexions Intervals.icu <ExternalLink className="w-4 h-4" />
                        </a>
                        <div className="flex gap-3">
                          <button onClick={() => setWatchSubStep(0)} className="flex-1 text-xs text-zinc-400 hover:text-zinc-600 py-2">← Retour</button>
                          <button onClick={() => setWatchSubStep(2)} className="flex-1 btn-brand justify-center text-sm py-2">C&apos;est fait →</button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2 — Clé API */}
                    {watchSubStep === 2 && (
                      <div className="space-y-4 py-2 text-center">
                        <div className="text-5xl">🔑</div>
                        <div>
                          <p className="font-semibold text-zinc-900 text-base">Copiez votre clé API</p>
                          <p className="text-xs text-zinc-500 mt-1">Sur Intervals.icu → Avatar → Paramètres → Accès développeur</p>
                        </div>
                        <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-left space-y-2.5">
                          <div className="flex items-start gap-2.5 text-xs text-zinc-600">
                            <span className="w-5 h-5 bg-zinc-200 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-0.5">1</span>
                            <span>Notez l&apos;<strong>Athlete ID</strong> (format&nbsp;<code className="bg-zinc-200 px-1 rounded">i564686</code>)</span>
                          </div>
                          <div className="flex items-start gap-2.5 text-xs text-zinc-600">
                            <span className="w-5 h-5 bg-zinc-200 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-0.5">2</span>
                            <span>Cliquez <strong>Afficher</strong> ou <strong>Produire</strong> pour obtenir la clé API</span>
                          </div>
                        </div>
                        <a href="https://intervals.icu/settings#developer" target="_blank" rel="noopener noreferrer"
                          className="btn-brand justify-center w-full">
                          Ouvrir les paramètres développeur <ExternalLink className="w-4 h-4" />
                        </a>
                        <div className="flex gap-3">
                          <button onClick={() => setWatchSubStep(1)} className="flex-1 text-xs text-zinc-400 hover:text-zinc-600 py-2">← Retour</button>
                          <button onClick={() => setWatchSubStep(3)} className="flex-1 btn-brand justify-center text-sm py-2">J&apos;ai la clé →</button>
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
                              <p className="font-semibold text-zinc-900">Entrez vos identifiants</p>
                              <p className="text-xs text-zinc-500 mt-0.5">Copiez-collez depuis intervals.icu</p>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs font-medium text-zinc-500 block mb-1.5">Athlete ID</label>
                                <input type="text" value={watchAthleteId} onChange={e => setWatchAthleteId(e.target.value)}
                                  placeholder="i564686"
                                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-zinc-500 block mb-1.5">Clé API</label>
                                <div className="relative">
                                  <input type={showWatchKey ? "text" : "password"} value={watchApiKey} onChange={e => setWatchApiKey(e.target.value)}
                                    placeholder="votre_cle_api"
                                    className="w-full px-3 py-2.5 pr-9 rounded-xl border border-zinc-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
                                  <button type="button" onClick={() => setShowWatchKey(v => !v)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                    {showWatchKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                            {watchError && (
                              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{watchError}
                              </div>
                            )}
                            <button type="submit" disabled={savingWatch || !watchAthleteId || !watchApiKey}
                              className="btn-brand w-full justify-center disabled:opacity-40">
                              {savingWatch ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Vérification…</> : "Connecter & terminer 🚀"}
                            </button>
                            <button type="button" onClick={() => setWatchSubStep(2)}
                              className="w-full text-xs text-zinc-400 hover:text-zinc-600 text-center py-1">← Retour</button>
                          </form>
                        ) : (
                          /* Post-save: polling status */
                          <div className="text-center space-y-4 py-4">
                            {pollingStatus === "checking" && (
                              <>
                                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
                                  <Wifi className="w-7 h-7 text-blue-500 animate-pulse" />
                                </div>
                                <div>
                                  <p className="font-semibold text-zinc-900">Connexion établie !</p>
                                  <p className="text-xs text-zinc-500 mt-1">Vérification de vos activités en cours…</p>
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
                                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-zinc-900">Activités détectées ✅</p>
                                  <p className="text-xs text-zinc-500 mt-1">Tout est prêt. Votre dashboard sera rempli.</p>
                                </div>
                              </>
                            )}
                            {pollingStatus === "timeout" && (
                              <>
                                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
                                  <RefreshCw className="w-7 h-7 text-amber-500" />
                                </div>
                                <div>
                                  <p className="font-semibold text-zinc-900">Sync en arrière-plan</p>
                                  <p className="text-xs text-zinc-500 mt-1">La connexion est enregistrée. Vos activités apparaîtront dans quelques minutes.</p>
                                </div>
                              </>
                            )}
                            <button onClick={handleFinish} disabled={loading}
                              className="btn-brand w-full justify-center">
                              {loading ? "Sauvegarde..." : <>Accéder au Dashboard <ArrowRight className="w-4 h-4" /></>}
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
                <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">Votre Empire est prêt !</h2>
                  <p className="text-zinc-500 mt-2">Tout est configuré. Commencez à vous entraîner.</p>
                </div>
                <button onClick={() => router.push("/dashboard")} className="btn-brand justify-center w-full py-3.5 text-base">
                  Accéder au Dashboard <ArrowRight className="w-5 h-5" />
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
