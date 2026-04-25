"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, StopCircle, Volume2, VolumeX, Target,
  TrendingUp, TrendingDown, Minus, Zap, Timer, MapPin
} from "lucide-react";
import type { UserProfile, PerformanceBaseline } from "@/types";

interface GhostRunnerProps {
  profile: UserProfile | null;
  baseline: PerformanceBaseline | null;
}

interface Checkpoint {
  km: number;
  targetPace: number; // min/km
  actualPace?: number;
  targetTime: number; // seconds from start
  actualTime?: number;
  split?: "ahead" | "behind" | "on_pace";
}

const PRESETS = [
  { name: "5K Sub-20", distance: 5, targetTime: 1200, icon: "🏃" },
  { name: "10K Sub-45", distance: 10, targetTime: 2700, icon: "⚡" },
  { name: "Semi Sub-1h45", distance: 21.1, targetTime: 6300, icon: "🎯" },
  { name: "Marathon Sub-3h30", distance: 42.2, targetTime: 12600, icon: "🏆" },
  { name: "Trail 25K", distance: 25, targetTime: 10800, icon: "⛰️" },
];

export function GhostRunner({ profile, baseline }: GhostRunnerProps) {
  const [phase, setPhase] = useState<"setup" | "running" | "finished">("setup");
  const [distance, setDistance] = useState(10);
  const [targetTime, setTargetTime] = useState(3600); // seconds
  const [elevation, setElevation] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [currentKm, setCurrentKm] = useState(0);
  const [currentPace, setCurrentPace] = useState(0);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [lastCue, setLastCue] = useState("");
  const [predictedFinish, setPredictedFinish] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const targetPace = distance > 0 ? targetTime / 60 / distance : 6; // min/km

  // Generate checkpoints every 1 km
  const buildCheckpoints = useCallback((): Checkpoint[] => {
    return Array.from({ length: Math.floor(distance) }, (_, i) => {
      const km = i + 1;
      // Apply terrain factor for elevation
      const elevFactor = 1 + (elevation / distance / 100) * 0.6;
      const pace = targetPace * elevFactor;
      return {
        km,
        targetPace: pace,
        targetTime: km * pace * 60,
      };
    });
  }, [distance, targetPace, elevation]);

  function speak(text: string) {
    if (!audioEnabled || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "fr-FR";
    utt.rate = 1.0;
    utt.volume = 0.9;
    synthRef.current = utt;
    window.speechSynthesis.speak(utt);
    setLastCue(text);
  }

  function startSession() {
    const cps = buildCheckpoints();
    setCheckpoints(cps);
    setElapsed(0);
    setCurrentKm(0);
    setPhase("running");
    speak(`Départ ! Objectif : ${formatTime(targetTime)}. Allure cible : ${targetPace.toFixed(2).replace(".", ":")} au kilomètre.`);

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;

        // Simulate current pace (in real use this comes from GPS/wearable)
        const simPace = targetPace + (Math.random() - 0.5) * 0.3;
        setCurrentPace(simPace);

        // Derive current km from elapsed time and simulated pace
        const simKm = next / 60 / simPace;
        setCurrentKm(simKm);

        // Predicted finish
        if (simKm > 0) {
          const pred = (next / simKm) * distance;
          setPredictedFinish(pred);
        }

        // Audio cues at each km
        cps.forEach((cp) => {
          if (simKm >= cp.km && !cp.actualTime) {
            const deviation = next - cp.targetTime;
            const devSec = Math.abs(Math.round(deviation));
            let cue = "";
            if (deviation < -15) {
              cue = `Kilomètre ${cp.km}. Vous avez ${devSec} secondes d'avance. Gérez votre effort.`;
              cp.split = "ahead";
            } else if (deviation > 15) {
              cue = `Kilomètre ${cp.km}. Vous avez ${devSec} secondes de retard. Accélérez légèrement.`;
              cp.split = "behind";
            } else {
              cue = `Kilomètre ${cp.km}. Parfait, vous êtes dans l'objectif.`;
              cp.split = "on_pace";
            }
            cp.actualTime = next;
            cp.actualPace = simPace;
            if (audioEnabled) speak(cue);
          }
        });

        // Finish
        if (simKm >= distance) {
          clearInterval(intervalRef.current!);
          speak(`Arrivée ! Temps final : ${formatTime(next)}. Objectif ${next <= targetTime ? "atteint" : "manqué de " + formatTime(next - targetTime)}.`);
          setPhase("finished");
        }

        return next;
      });
    }, 1000);
  }

  function pauseSession() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      speak("Pause.");
    } else {
      intervalRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
      speak("Reprise.");
    }
  }

  function stopSession() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    window.speechSynthesis.cancel();
    setPhase("setup");
    setElapsed(0);
    setCurrentKm(0);
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const progressPct = Math.min(100, (currentKm / distance) * 100);
  const timeDelta = predictedFinish - targetTime;
  const isAhead = timeDelta < -5;
  const isBehind = timeDelta > 5;

  const vma = baseline?.vma_kmh ?? 16;
  const estimatedPaces = [
    { label: "Z1 Récup", pace: 60 / (vma * 0.6) },
    { label: "Z2 Aérobie", pace: 60 / (vma * 0.72) },
    { label: "Z3 Tempo", pace: 60 / (vma * 0.82) },
    { label: "Z4 Seuil", pace: 60 / (vma * 0.88) },
    { label: "VMA", pace: 60 / vma },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Ghost Runner</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Pacer audio IA avec prédiction de chrono en temps réel
          </p>
        </div>
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            audioEnabled
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          Audio {audioEnabled ? "ON" : "OFF"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {phase === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Presets */}
            <div className="grid grid-cols-5 gap-3 mb-6">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => { setDistance(p.distance); setTargetTime(p.targetTime); }}
                  className={`p-3 rounded-2xl border-2 text-center transition-all ${
                    distance === p.distance && targetTime === p.targetTime
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="text-2xl mb-1">{p.icon}</div>
                  <div className="text-xs font-semibold leading-tight">{p.name}</div>
                </button>
              ))}
            </div>

            {/* Custom config */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 block">
                  Distance (km)
                </label>
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
                  min={1}
                  max={100}
                  step={0.1}
                  className="w-full text-3xl font-bold text-zinc-900 bg-transparent focus:outline-none"
                />
              </div>
              <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 block">
                  Objectif
                </label>
                <input
                  type="text"
                  value={formatTimeInput(targetTime)}
                  onChange={(e) => { const s = parseTimeInput(e.target.value); if (s) setTargetTime(s); }}
                  placeholder="HH:MM:SS"
                  className="w-full text-3xl font-bold text-zinc-900 bg-transparent focus:outline-none"
                />
              </div>
              <div className="bg-white rounded-2xl border border-zinc-200 p-5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 block">
                  Dénivelé (m)
                </label>
                <input
                  type="number"
                  value={elevation}
                  onChange={(e) => setElevation(parseInt(e.target.value) || 0)}
                  min={0}
                  max={5000}
                  step={50}
                  className="w-full text-3xl font-bold text-zinc-900 bg-transparent focus:outline-none"
                />
              </div>
            </div>

            {/* Pace zones reference */}
            <div className="bg-zinc-50 rounded-2xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3">Allures de référence (VMA {vma} km/h)</h3>
              <div className="grid grid-cols-5 gap-2">
                {estimatedPaces.map((z) => (
                  <button
                    key={z.label}
                    onClick={() => setTargetTime(Math.round(z.pace * 60 * distance))}
                    className="text-center p-2 bg-white rounded-xl border border-zinc-200 hover:border-zinc-400 transition-all"
                  >
                    <div className="text-xs text-zinc-500 mb-1">{z.label}</div>
                    <div className="text-sm font-bold text-zinc-900">{formatPace(z.pace)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-zinc-900 text-white rounded-2xl p-5 flex items-center justify-between mb-6">
              <div>
                <div className="text-zinc-400 text-sm mb-1">Allure cible</div>
                <div className="text-2xl font-bold">{formatPace(targetPace)} /km</div>
              </div>
              <div className="text-center">
                <div className="text-zinc-400 text-sm mb-1">Distance</div>
                <div className="text-2xl font-bold">{distance} km</div>
              </div>
              <div className="text-center">
                <div className="text-zinc-400 text-sm mb-1">Objectif</div>
                <div className="text-2xl font-bold">{formatTime(targetTime)}</div>
              </div>
              <button
                onClick={startSession}
                className="bg-green-500 hover:bg-green-400 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 text-lg transition-all"
              >
                <Play className="w-6 h-6" />
                Démarrer
              </button>
            </div>
          </motion.div>
        )}

        {(phase === "running" || phase === "finished") && (
          <motion.div key="running" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Main race display */}
            <div className={`rounded-3xl p-8 mb-6 ${
              phase === "finished" ? "bg-zinc-900" :
              isAhead ? "bg-[#D1FAE5]" : isBehind ? "bg-[#FFEDD5]" : "bg-[#E0F2FE]"
            }`}>
              <div className="grid grid-cols-4 gap-6 mb-6">
                <div>
                  <div className={`text-sm font-semibold mb-1 ${phase === "finished" ? "text-zinc-400" : "text-zinc-600"}`}>
                    Temps écoulé
                  </div>
                  <div className={`text-4xl font-black tabular-nums ${phase === "finished" ? "text-white" : "text-zinc-900"}`}>
                    {formatTime(elapsed)}
                  </div>
                </div>
                <div>
                  <div className={`text-sm font-semibold mb-1 ${phase === "finished" ? "text-zinc-400" : "text-zinc-600"}`}>
                    Distance
                  </div>
                  <div className={`text-4xl font-black ${phase === "finished" ? "text-white" : "text-zinc-900"}`}>
                    {currentKm.toFixed(2)} km
                  </div>
                </div>
                <div>
                  <div className={`text-sm font-semibold mb-1 ${phase === "finished" ? "text-zinc-400" : "text-zinc-600"}`}>
                    Allure actuelle
                  </div>
                  <div className={`text-4xl font-black ${phase === "finished" ? "text-white" : "text-zinc-900"}`}>
                    {formatPace(currentPace)}
                  </div>
                </div>
                <div>
                  <div className={`text-sm font-semibold mb-1 ${phase === "finished" ? "text-zinc-400" : "text-zinc-600"}`}>
                    Fin prévue
                  </div>
                  <div className={`text-4xl font-black flex items-center gap-2 ${
                    phase === "finished" ? "text-white" :
                    isAhead ? "text-green-700" : isBehind ? "text-orange-700" : "text-blue-700"
                  }`}>
                    {formatTime(predictedFinish)}
                    {isAhead && <TrendingDown className="w-5 h-5" />}
                    {isBehind && <TrendingUp className="w-5 h-5" />}
                    {!isAhead && !isBehind && <Minus className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-3 bg-white/50 rounded-full overflow-hidden mb-3">
                <motion.div
                  className="absolute left-0 top-0 h-full bg-zinc-900 rounded-full"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5 }}
                />
                {/* Ghost position (target) */}
                <div
                  className="absolute top-0 h-full w-1 bg-red-400 rounded-full"
                  style={{ left: `${Math.min(100, (elapsed / targetTime) * 100)}%` }}
                />
              </div>
              <div className={`flex justify-between text-xs font-medium ${phase === "finished" ? "text-zinc-500" : "text-zinc-600"}`}>
                <span>0 km</span>
                <span>{(distance / 2).toFixed(1)} km</span>
                <span>{distance} km</span>
              </div>
            </div>

            {/* Checkpoints */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 mb-5">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Points de passage
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {checkpoints.filter((_, i) => i < 20).map((cp) => (
                  <div key={cp.km} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500 w-12">km {cp.km}</span>
                    <span className="text-zinc-700 font-mono">{formatTime(cp.targetTime)}</span>
                    {cp.actualTime && (
                      <>
                        <span className="text-zinc-500 font-mono">{formatTime(cp.actualTime)}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          cp.split === "ahead" ? "bg-green-100 text-green-700" :
                          cp.split === "behind" ? "bg-orange-100 text-orange-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {cp.split === "ahead" ? "↑ Avance" : cp.split === "behind" ? "↓ Retard" : "= Objectif"}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Last audio cue */}
            {lastCue && (
              <div className="bg-zinc-50 rounded-xl px-4 py-3 text-sm text-zinc-600 flex items-center gap-2 mb-5">
                <Volume2 className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <span className="italic">&ldquo;{lastCue}&rdquo;</span>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3">
              {phase === "running" && (
                <>
                  <button
                    onClick={pauseSession}
                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold py-3 rounded-2xl transition-all"
                  >
                    {intervalRef.current ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    {intervalRef.current ? "Pause" : "Reprendre"}
                  </button>
                  <button
                    onClick={stopSession}
                    className="flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-6 py-3 rounded-2xl transition-all"
                  >
                    <StopCircle className="w-5 h-5" />
                    Arrêter
                  </button>
                </>
              )}
              {phase === "finished" && (
                <button
                  onClick={stopSession}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-zinc-700 font-semibold py-3 rounded-2xl border border-zinc-200 hover:border-zinc-400 transition-all"
                >
                  Nouvelle session
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatTime(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatTimeInput(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseTimeInput(value: string): number | null {
  const parts = value.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function formatPace(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}
