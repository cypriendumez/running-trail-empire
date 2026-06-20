"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { vmaFrom6min } from "@/lib/running/fitness";
import { ArrowRight, ArrowLeft, User, Activity, Target, CheckCircle2, Watch, Eye, EyeOff, ExternalLink, RefreshCw, AlertCircle, Wifi } from "lucide-react";

type Step = "watch" | "profile" | "physio" | "goals" | "done";

const STEPS: Step[] = ["watch", "profile", "physio", "goals", "done"];
const STEP_LABELS = ["Montre", "Profil", "Données physio", "Objectifs"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("watch");
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState({
    age: "",
    height_cm: "",
    weight_kg: "",
    gender: "male" as "male" | "female" | "other",
    chronotype: "neutral" as "morning" | "evening" | "neutral",
    is_female_cycle_sync: false,
    warmup_min: 15,   // temps d'échauffement habituel (min) → pilote l'échauffement FC des séances montre
    cooldown_min: 10, // temps de retour au calme habituel (min)
    long_run_mode: "run" as "run" | "bike", // sortie longue en course ou remplacée par du vélo (cross-training)
  });

  const [vma, setVma] = useState({ vma_kmh: "", max_hr: "", resting_hr: "" });
  const [test6min, setTest6min] = useState("");
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

  // ── Smart validation — catches the most common mistakes ──
  const idTrim = watchAthleteId.trim();
  const keyTrim = watchApiKey.trim();
  const idIsEmail = idTrim.includes("@");
  const idValid = /^i\d{3,}$/i.test(idTrim);
  const idHint =
    idTrim === "" ? null :
    idIsEmail ? "C'est votre email — pas l'Athlete ID. Il ressemble à i564686." :
    !idTrim.toLowerCase().startsWith("i") ? "L'Athlete ID commence par un « i » (ex: i564686)." :
    !idValid ? "Format inattendu — un « i » suivi de chiffres (ex: i564686)." :
    null;
  const keyLooksLikePassword = keyTrim.length > 0 && keyTrim.length < 20 && /[A-Z!?@#$%^&*]/.test(keyTrim);
  const keyValid = /^[a-z0-9]{16,}$/i.test(keyTrim);
  const keyHint =
    keyTrim === "" ? null :
    keyLooksLikePassword ? "On dirait un mot de passe. La clé API est une longue suite de lettres/chiffres." :
    !keyValid ? "La clé API fait ~30 caractères (lettres + chiffres uniquement)." :
    null;

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

    // Hard guard — the watch connection is mandatory. Re-verify before completing.
    try {
      const statusRes = await fetch("/api/intervals/status");
      const status = await statusRes.json();
      if (!status.configured) {
        toast.error("Connectez d'abord votre montre pour continuer.");
        setStep("watch");
        setWatchSubStep(3);
        setLoading(false);
        return;
      }
    } catch {
      toast.error("Impossible de vérifier la connexion à votre montre.");
      setLoading(false);
      return;
    }

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

    // Durées d'échauffement / retour au calme — best-effort (colonnes ajoutées via SQL). N'empêche pas l'onboarding.
    await supabase.from("profiles").update({
      warmup_min: profile.warmup_min,
      cooldown_min: profile.cooldown_min,
      long_run_mode: profile.long_run_mode,
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-2">⏱️ Échauffement habituel</label>
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
                    <label className="text-xs font-medium text-zinc-500 block mb-2">🧊 Retour au calme habituel</label>
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
                <p className="text-[11px] text-zinc-400 -mt-2">On s&apos;en sert pour caler l&apos;échauffement et le retour au calme (en fréquence cardiaque douce, Z1) des séances envoyées à ta montre. Le corps de séance garde les allures précises.</p>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-2">🚴 Sorties longues</label>
                  <div className="flex gap-2">
                    {([["run", "🏃 En course"], ["bike", "🚴 En vélo"]] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setProfile(p => ({ ...p, long_run_mode: v }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${profile.long_run_mode === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">Beaucoup de pros remplacent la sortie longue par du vélo : même volume aérobie, sans l&apos;impact. Ton coach et l&apos;IA s&apos;adaptent automatiquement.</p>
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

                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800 space-y-2">
                  <div className="font-bold">🎯 Test VMA — à faire avant ta première séance</div>
                  <p>Ta <b>VMA</b> (Vitesse Maximale Aérobie) calibre TOUTES tes allures, zones, prédictions de chrono et le coaching IA. 6 minutes qui changent tout.</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
                    <li>Échauffe-toi 15 min en footing facile.</li>
                    <li>Cours <b>6 minutes À FOND</b> (allure la plus rapide que tu tiens), terrain plat — une piste d&apos;athlétisme est idéale.</li>
                    <li>Relève la <b>distance parcourue</b> en mètres et saisis-la ci-dessous.</li>
                  </ol>
                </div>

                <div className="rounded-2xl border border-zinc-200 p-4">
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Distance parcourue en 6 min (mètres)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={test6min}
                      onChange={e => { setTest6min(e.target.value); const v = vmaFrom6min(parseFloat(e.target.value)); if (v != null) setVma(p => ({ ...p, vma_kmh: String(v) })); }}
                      placeholder="ex: 1650" min="800" max="3500" step="10"
                      className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    {test6min && vmaFrom6min(parseFloat(test6min)) != null && (
                      <div className="px-4 py-3 rounded-xl bg-green-50 text-green-700 font-bold text-sm whitespace-nowrap">→ VMA {vmaFrom6min(parseFloat(test6min))} km/h</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">VMA (km/h)</label>
                  <input type="number" value={vma.vma_kmh} onChange={e => setVma(p => ({...p, vma_kmh: e.target.value}))}
                    placeholder="ex: 16.5" min="8" max="30" step="0.5"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <p className="text-[11px] text-zinc-400 mt-1">Calculée automatiquement depuis le test ci-dessus — ou saisis-la si tu la connais. Pas encore testé ? On l&apos;estimera depuis tes séances, mais un vrai test la rend exacte.</p>
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

                {!(parseFloat(vma.vma_kmh) >= 8 && parseFloat(vma.vma_kmh) <= 30) && (
                  <p className="text-xs text-amber-600">⚠️ Le test VMA est <b>obligatoire</b> pour continuer : fais le test 6 min ci-dessus, ou saisis ta VMA si tu la connais déjà.</p>
                )}
                <div className="flex gap-3">
                  <button onClick={prev} className="btn-secondary flex-1 justify-center">
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                  <button onClick={next} disabled={!(parseFloat(vma.vma_kmh) >= 8 && parseFloat(vma.vma_kmh) <= 30)}
                    className="btn-brand flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed">
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
                  <input type="range" min="5" max="200" step="5" value={goals.target_weekly_km}
                    onChange={e => setGoals(g => ({...g, target_weekly_km: e.target.value}))}
                    className="w-full accent-green-500" />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>5 km</span>
                    <span className="font-semibold text-zinc-900">{goals.target_weekly_km} km/sem</span>
                    <span>200 km</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={prev} className="btn-secondary flex-1 justify-center">
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                  <button onClick={handleFinish} disabled={loading} className="btn-brand flex-1 justify-center">
                    {loading ? "Sauvegarde…" : <>Terminer <ArrowRight className="w-4 h-4" /></>}
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
                          <p className="font-semibold text-zinc-900 text-base">D&apos;abord, un compte Intervals.icu</p>
                          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                            C&apos;est <strong>gratuit</strong> et c&apos;est le pont entre votre montre<br />(Garmin, COROS, Polar, Suunto…) et cette app.
                          </p>
                        </div>

                        {/* Visual bridge */}
                        <div className="flex items-center justify-center gap-2 py-1">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-2xl">⌚</div>
                            <span className="text-[10px] text-zinc-400 font-medium">Montre</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-300" />
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 bg-blue-50 border-2 border-blue-200 rounded-2xl flex items-center justify-center text-2xl">🌐</div>
                            <span className="text-[10px] text-blue-500 font-semibold">Intervals</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-300" />
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 bg-green-50 border-2 border-green-200 rounded-2xl flex items-center justify-center text-2xl">🏔</div>
                            <span className="text-[10px] text-green-600 font-semibold">Cette app</span>
                          </div>
                        </div>

                        <a href="https://intervals.icu/signup" target="_blank" rel="noopener noreferrer"
                          className="btn-brand justify-center w-full">
                          Créer mon compte gratuit <ExternalLink className="w-4 h-4" />
                        </a>
                        <button onClick={() => setWatchSubStep(1)}
                          className="w-full flex items-center justify-center gap-1.5 text-sm text-zinc-600 font-medium hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 rounded-xl py-2.5 transition-colors">
                          ✅ J&apos;ai déjà un compte, continuer
                        </button>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Astuce : si en cliquant ci-dessus vous arrivez sur un calendrier, c&apos;est que vous êtes <strong>déjà inscrit</strong> — cliquez simplement « J&apos;ai déjà un compte ».
                        </p>
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
                          <p className="text-xs font-semibold text-amber-700">⚠️ Sur la carte Garmin d&apos;Intervals.icu, cochez :</p>
                          {["Télécharger les activités", "Télécharger les données de santé", "Importer les données historiques"].map(p => (
                            <div key={p} className="flex items-center gap-2 text-xs text-amber-700">
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />{p}
                            </div>
                          ))}
                          <p className="text-[11px] text-amber-600 mt-1">
                            Une fenêtre Garmin s&apos;ouvrira pour autoriser l&apos;accès — connectez-vous et acceptez.
                          </p>
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
                      <div className="space-y-4 py-2">
                        <div className="text-center">
                          <div className="text-5xl">🔑</div>
                          <p className="font-semibold text-zinc-900 text-base mt-2">Récupérez vos 2 codes secrets</p>
                          <p className="text-xs text-zinc-500 mt-1">Sur Intervals.icu : <strong>Paramètres</strong> → tout en bas, <strong>Accès développeur</strong></p>
                        </div>

                        {/* Annotated mockup of the developer settings screen */}
                        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                          <div className="bg-zinc-50 border-b border-zinc-100 px-3 py-2 flex items-center gap-1.5">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 rounded-full bg-red-300" />
                              <span className="w-2 h-2 rounded-full bg-amber-300" />
                              <span className="w-2 h-2 rounded-full bg-green-300" />
                            </div>
                            <span className="text-[10px] text-zinc-400 ml-1">intervals.icu — Accès développeur</span>
                          </div>
                          <div className="p-3 space-y-2.5">
                            {/* Athlete ID row */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-blue-50 border-2 border-blue-300 rounded-lg px-3 py-2 animate-pulse">
                                <p className="text-[10px] text-blue-400 font-medium">Athlete ID</p>
                                <p className="font-mono text-sm font-bold text-blue-700">i564686</p>
                              </div>
                              <div className="flex items-center gap-1 text-blue-500 w-20">
                                <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                                <span className="text-[11px] font-semibold leading-tight">code 1️⃣</span>
                              </div>
                            </div>
                            {/* API key row */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-green-50 border-2 border-green-300 rounded-lg px-3 py-2 animate-pulse">
                                <p className="text-[10px] text-green-500 font-medium">API Key</p>
                                <p className="font-mono text-xs font-bold text-green-700 truncate">a1b2c3d4e5f6…</p>
                              </div>
                              <div className="flex items-center gap-1 text-green-600 w-20">
                                <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                                <span className="text-[11px] font-semibold leading-tight">code 2️⃣</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Warnings about common mistakes */}
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1">
                          <p className="text-[11px] text-amber-700 flex items-start gap-1.5"><span>❌</span> <span>Ce n&apos;est <strong>pas</strong> votre email ni votre mot de passe.</span></p>
                          <p className="text-[11px] text-amber-700 flex items-start gap-1.5"><span>👉</span> <span>Pas de clé visible ? Cliquez <strong>« Produire »</strong> / <strong>« Generate »</strong>.</span></p>
                        </div>

                        <a href="https://intervals.icu/settings#developer" target="_blank" rel="noopener noreferrer"
                          className="btn-brand justify-center w-full">
                          Ouvrir l&apos;Accès développeur <ExternalLink className="w-4 h-4" />
                        </a>
                        <div className="flex gap-3">
                          <button onClick={() => setWatchSubStep(1)} className="flex-1 text-xs text-zinc-400 hover:text-zinc-600 py-2">← Retour</button>
                          <button onClick={() => setWatchSubStep(3)} className="flex-1 btn-brand justify-center text-sm py-2">J&apos;ai mes 2 codes →</button>
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
                                <label className="text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-1.5">
                                  <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded text-[10px] font-bold flex items-center justify-center">1</span>
                                  Athlete ID <span className="text-zinc-400 font-normal">(commence par i)</span>
                                </label>
                                <div className="relative">
                                  <input type="text" value={watchAthleteId} onChange={e => setWatchAthleteId(e.target.value)}
                                    placeholder="i564686"
                                    className={`w-full px-3 py-2.5 pr-9 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
                                      idHint ? "border-red-300 focus:ring-red-400 bg-red-50/40" :
                                      idValid ? "border-green-300 focus:ring-green-400 bg-green-50/40" :
                                      "border-zinc-200 focus:ring-green-500"
                                    }`} />
                                  {idValid && <CheckCircle2 className="w-4 h-4 text-green-500 absolute right-3 top-1/2 -translate-y-1/2" />}
                                  {idHint && <AlertCircle className="w-4 h-4 text-red-400 absolute right-3 top-1/2 -translate-y-1/2" />}
                                </div>
                                {idHint && <p className="text-[11px] text-red-500 mt-1 flex items-start gap-1"><span>⚠️</span>{idHint}</p>}
                              </div>
                              <div>
                                <label className="text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-1.5">
                                  <span className="w-4 h-4 bg-green-100 text-green-600 rounded text-[10px] font-bold flex items-center justify-center">2</span>
                                  Clé API <span className="text-zinc-400 font-normal">(longue suite de caractères)</span>
                                </label>
                                <div className="relative">
                                  <input type={showWatchKey ? "text" : "password"} value={watchApiKey} onChange={e => setWatchApiKey(e.target.value)}
                                    placeholder="a1b2c3d4e5f6…"
                                    className={`w-full px-3 py-2.5 pr-16 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
                                      keyHint ? "border-red-300 focus:ring-red-400 bg-red-50/40" :
                                      keyValid ? "border-green-300 focus:ring-green-400 bg-green-50/40" :
                                      "border-zinc-200 focus:ring-green-500"
                                    }`} />
                                  {keyValid && <CheckCircle2 className="w-4 h-4 text-green-500 absolute right-9 top-1/2 -translate-y-1/2" />}
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
                              {savingWatch ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />Vérification…</> : "Connecter & continuer 🚀"}
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
                            <button onClick={next}
                              className="btn-brand w-full justify-center">
                              Configurer mon profil <ArrowRight className="w-4 h-4" />
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
