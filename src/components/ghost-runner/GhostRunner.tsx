"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, StopCircle, Volume2, VolumeX,
  TrendingUp, TrendingDown, Minus, Zap, Timer, MapPin, Watch, Loader2,
  Ghost, Heart, ClipboardList, ChevronDown, Satellite, Mic, Bluetooth,
} from "lucide-react";
import { toast } from "sonner";
import type { UserProfile, PerformanceBaseline } from "@/types";
import { useT } from "@/lib/i18n/LanguageProvider";
import { GX, GUIDE, GUIDE_TIP, SPEECH_LANG, fillG } from "./ghostI18n";

export interface CoachSess { title: string; detail: string; date: string; tags: string[] }

interface GhostRunnerProps {
  profile: UserProfile | null;
  baseline: PerformanceBaseline | null;
  coachSessions?: CoachSess[];
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
  { name: "5 km", goal: "sub 20", distance: 5, targetTime: 1200 },
  { name: "10 km", goal: "sub 45", distance: 10, targetTime: 2700 },
  { name: "Semi", goal: "sub 1h45", distance: 21.1, targetTime: 6300 },
  { name: "Marathon", goal: "sub 3h30", distance: 42.2, targetTime: 12600 },
  { name: "Trail", goal: "25 km", distance: 25, targetTime: 10800 },
];

// Zones de fréquence cardiaque (% de la FC max) — noms traduits au rendu (clés hz.*).
const HR_ZONES = [
  { z: 1, lo: 0.50, hi: 0.60 },
  { z: 2, lo: 0.60, hi: 0.70 },
  { z: 3, lo: 0.70, hi: 0.80 },
  { z: 4, lo: 0.80, hi: 0.90 },
  { z: 5, lo: 0.90, hi: 1.00 },
];

export function GhostRunner({ baseline, coachSessions = [] }: GhostRunnerProps) {
  const { lang } = useT();
  const d = GX[lang] ?? GX.fr;
  const tg = (k: string, p?: Record<string, string | number>) => fillG(d[k] ?? k, p);
  const zn = (z: number) => d[`hz.${z}`];
  const [phase, setPhase] = useState<"setup" | "running" | "finished">("setup");
  const [distance, setDistance] = useState(10);
  const [targetTime, setTargetTime] = useState(3600); // seconds
  const [elevation, setElevation] = useState(0);
  const [targetMode, setTargetMode] = useState<"pace" | "hr">("pace");
  const [durationMin, setDurationMin] = useState(45);
  const [hrZone, setHrZone] = useState(2);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [currentKm, setCurrentKm] = useState(0);
  const [currentPace, setCurrentPace] = useState(0);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [lastCue, setLastCue] = useState("");
  const [predictedFinish, setPredictedFinish] = useState(0);
  const [sendingWatch, setSendingWatch] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"off" | "searching" | "live" | "sim">("off");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [watchStatus, setWatchStatus] = useState<{ connected: boolean; pushReady: boolean; device: string | null } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // ── Mode FC guidé en direct : capteur Bluetooth (ceinture / montre) + annonces ──
  const [sessionKind, setSessionKind] = useState<"pace" | "hr">("pace"); // type de la session EN COURS
  const [liveHr, setLiveHr] = useState<number | null>(null);
  const [hrSensor, setHrSensor] = useState<"none" | "connecting" | "on">("none");
  const sessionKindRef = useRef<"pace" | "hr">("pace");
  const hrDeviceRef = useRef<{ gatt?: { connected: boolean; disconnect: () => void } } | null>(null);
  const hrLoRef = useRef(0);          // plage cible (bpm) figée au départ de la séance
  const hrHiRef = useRef(999);
  const hrOutRef = useRef(0);         // nb de lectures consécutives hors zone
  const lastHrCueRef = useRef(0);     // anti-spam vocal (1 alerte / 25 s max)
  const hrSumRef = useRef(0);         // FC moyenne de la séance
  const hrNRef = useRef(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const cpsRef = useRef<Checkpoint[]>([]);
  const elapsedRef = useRef(0);
  const kmRef = useRef(0);
  const pausedRef = useRef(false);
  const modeRef = useRef<"pending" | "live" | "sim">("sim");
  const trackRef = useRef<[number, number][]>([]);                       // tracé GPS (façon Strava)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null); // écran allumé
  const wantLockRef = useRef(false);

  const targetPace = distance > 0 ? targetTime / 60 / distance : 6; // min/km

  // ── Contrôles « faciles » : on garde distance / allure / temps cohérents ──
  const setPaceMinKm = (p: number) => {
    const clamped = Math.min(10, Math.max(2.5, p)); // 2:30 → 10:00 /km
    setTargetTime(Math.round(clamped * 60 * (distance || 1)));
  };
  const setDistanceKeepPace = (dRaw: number) => {
    const dNew = Math.min(100, Math.max(1, Math.round(dRaw * 10) / 10));
    const p = targetPace;
    setDistance(dNew);
    setTargetTime(Math.round(p * 60 * dNew));
  };
  const bumpTime = (deltaSec: number) => setTargetTime((t) => Math.max(60, t + deltaSec));

  // Charge une séance prescrite par le coach dans le pacer (allure OU fréquence cardiaque),
  // pour pouvoir la faire SANS montre, guidé à la voix.
  const applyCoachSession = (s: CoachSess) => {
    const text = `${s.title} ${s.detail} ${(s.tags || []).join(" ")}`.toLowerCase();
    const vmaLoc = baseline?.vma_kmh ?? 16;
    const pm = text.match(/(\d)\s*['h:]\s*(\d{2})\s*\/?\s*km/) || text.match(/[àa]\s*(\d)\s*['h:]\s*(\d{2})/);
    const pace = pm ? (+pm[1]) + (+pm[2]) / 60 : null; // min/km
    const dm = text.match(/(\d{1,3}(?:[.,]\d)?)\s*km/);
    let distKm = dm ? parseFloat(dm[1].replace(",", ".")) : null;
    const repM = text.match(/(\d{1,2})\s*[x×]\s*(\d{3,4})\s*m\b/);      // 6×1000 m
    const repKm = text.match(/(\d{1,2})\s*[x×]\s*(\d(?:[.,]\d)?)\s*km/); // 3×2 km
    if (!distKm && repM) distKm = (+repM[1]) * (+repM[2]) / 1000;
    if (!distKm && repKm) distKm = (+repKm[1]) * parseFloat(repKm[2].replace(",", "."));
    const hm = text.match(/(\d+)\s*h(?:\s*(\d{1,2}))?/);
    const mm = text.match(/(\d{1,3})\s*(?:min|')/);
    const durMin = hm ? (+hm[1]) * 60 + (hm[2] ? +hm[2] : 0) : (mm ? +mm[1] : null);
    const zm = text.match(/z\s*([1-5])/);
    const zone = zm ? +zm[1]
      : /vma|fractionn|interval|c[ôo]te|30\/30|piste/.test(text) ? 5
      : /seuil|sp[ée]ci|specif|allure|tempo/.test(text) ? 4
      : /r[ée]cup/.test(text) ? 1
      : /endurance|footing|sortie longue|fond|easy|long/.test(text) ? 2 : null;
    const zonePace = (z: number) => 60 / (vmaLoc * [0, 0.6, 0.7, 0.8, 0.86, 1.0][z]);

    if (pace && (distKm || durMin)) {
      setTargetMode("pace");
      const d = distKm ?? Math.max(1, Math.round((durMin! / pace) * 10) / 10);
      setDistance(d); setTargetTime(Math.round(pace * 60 * d)); setElevation(0);
    } else if (durMin && zone) {
      setTargetMode("hr"); setDurationMin(durMin); setHrZone(Math.min(5, Math.max(1, zone)));
    } else if (distKm && zone) {
      setTargetMode("pace"); setDistance(distKm); setTargetTime(Math.round(zonePace(zone) * 60 * distKm)); setElevation(0);
    } else {
      setTargetMode("hr"); setDurationMin(durMin ?? 45); setHrZone(zone ?? 2);
    }
    toast.success(tg("t.loaded", { t: s.title }), { duration: 4000 });
  };

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
    utt.lang = SPEECH_LANG[lang] ?? "fr-FR";
    utt.rate = 1.0;
    utt.volume = 0.9;
    synthRef.current = utt;
    window.speechSynthesis.speak(utt);
    setLastCue(text);
  }

  // Distance réelle entre deux points GPS (mètres) — formule de Haversine.
  function haversineM(aLat: number, aLng: number, bLat: number, bLng: number) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR;
    const la1 = aLat * toR, la2 = bLat * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // Garde l'écran allumé pendant la course (sinon le navigateur gèle le GPS au verrouillage).
  async function requestWakeLock() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch { /* non supporté → l'utilisateur garde l'écran allumé manuellement */ }
  }
  function releaseWakeLock() {
    wantLockRef.current = false;
    try { wakeLockRef.current?.release(); } catch { /* ignore */ }
    wakeLockRef.current = null;
  }

  // Enregistre la course dans l'historique (façon Strava : distance/temps/allure/D+ + tracé GPS).
  async function saveRun(finalSec: number) {
    if (kmRef.current < 0.1 || finalSec < 30) return;
    try {
      const r = await fetch("/api/workouts/log", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tg("runTitle", { km: Math.round(kmRef.current * 10) / 10 }),
          distanceKm: kmRef.current, durationSeconds: finalSec,
          elevationGain: elevation > 0 ? elevation : undefined,
          track: trackRef.current.length > 1 ? trackRef.current : undefined,
          type: "easy",
        }),
      });
      const j = await r.json();
      if (j.ok) toast.success(d["t.saved"], { duration: 5000 });
      else toast.error(j.error || d["t.saveErr"]);
    } catch { toast.error(d["t.saveErr"]); }
  }

  function finishSession() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
    intervalRef.current = null; watchIdRef.current = null;
    releaseWakeLock();
    const fin = elapsedRef.current;
    speak(fin <= targetTime ? tg("sp.finishHit", { t: formatTime(fin) }) : tg("sp.finishMiss", { t: formatTime(fin), d: formatTime(fin - targetTime) }));
    setPhase("finished");
    if (modeRef.current === "live") saveRun(fin); // on n'enregistre QUE les vraies courses GPS (pas la démo)
  }

  // Met à jour distance / allure / prédiction / cues à partir d'une avancée (réelle ou démo).
  function processProgress(km: number, paceMinKm: number) {
    kmRef.current = km;
    setCurrentKm(km);
    if (paceMinKm > 0 && isFinite(paceMinKm)) setCurrentPace(paceMinKm);
    const el = elapsedRef.current;
    if (km > 0) setPredictedFinish((el / km) * distance);
    let changed = false;
    cpsRef.current.forEach((cp) => {
      if (km >= cp.km && !cp.actualTime) {
        const deviation = el - cp.targetTime;
        const devSec = Math.abs(Math.round(deviation));
        if (deviation < -15) { cp.split = "ahead"; if (audioEnabled) speak(tg("sp.kmAhead", { km: cp.km, s: devSec })); }
        else if (deviation > 15) { cp.split = "behind"; if (audioEnabled) speak(tg("sp.kmBehind", { km: cp.km, s: devSec })); }
        else { cp.split = "on_pace"; if (audioEnabled) speak(tg("sp.kmOn", { km: cp.km })); }
        cp.actualTime = el; cp.actualPace = paceMinKm; changed = true;
      }
    });
    if (changed) setCheckpoints([...cpsRef.current]);
    // En mode FC, la distance est un bonus (GPS) : la fin est pilotée par la DURÉE.
    if (sessionKindRef.current === "pace" && km >= distance) finishSession();
  }

  // Position GPS réelle (téléphone/montre) → distance + vitesse réelles.
  function onGpsPosition(pos: GeolocationPosition) {
    if (modeRef.current !== "live") { modeRef.current = "live"; setGpsStatus("live"); }
    const { latitude, longitude, accuracy, speed } = pos.coords;
    setGpsAccuracy(accuracy ?? null);
    if (pausedRef.current) { lastPosRef.current = null; return; }
    if (accuracy != null && accuracy > 40) return; // point trop imprécis → ignoré (anti-bruit)
    const t = pos.timestamp;
    const last = lastPosRef.current;
    if (last) {
      const d = haversineM(last.lat, last.lng, latitude, longitude);
      const dt = (t - last.t) / 1000;
      if (d >= 2 && d < 80 && dt > 0) { // filtre la dérive à l'arrêt + sauts aberrants
        const mps = speed != null && speed > 0.5 ? speed : d / dt;
        const pace = mps > 0.5 ? 1000 / mps / 60 : currentPace;
        trackRef.current.push([latitude, longitude]); // trace le parcours réel (carte + historique)
        processProgress(kmRef.current + d / 1000, pace);
      }
    }
    lastPosRef.current = { lat: latitude, lng: longitude, t };
  }

  // Toujours la dernière version de speak (les listeners Bluetooth vivent longtemps).
  const speakRef = useRef(speak);
  speakRef.current = speak;
  const liveHrRef = useRef<number | null>(null);

  // ── Capteur cardio Bluetooth (Web Bluetooth, service standard « heart_rate ») ──
  function onHrNotify(e: Event) {
    const dv = (e.target as unknown as { value?: DataView }).value;
    if (!dv) return;
    const flags = dv.getUint8(0);
    const hr = (flags & 1) ? dv.getUint16(1, true) : dv.getUint8(1);
    if (hr < 30 || hr > 240) return;
    liveHrRef.current = hr;
    setLiveHr(hr);
    // Stats + coaching vocal : uniquement pendant une séance FC active, hors pause.
    if (sessionKindRef.current !== "hr" || intervalRef.current == null || pausedRef.current) return;
    hrSumRef.current += hr; hrNRef.current += 1;
    if (elapsedRef.current < 120) return; // 2 min d'échauffement sans alerte
    const out = hr > hrHiRef.current ? 1 : hr < hrLoRef.current ? -1 : 0;
    if (out === 0) { hrOutRef.current = 0; return; }
    hrOutRef.current += 1;
    const now = Date.now();
    if (hrOutRef.current >= 8 && now - lastHrCueRef.current > 25000) { // ~8 s soutenues hors zone
      lastHrCueRef.current = now; hrOutRef.current = 0;
      speakRef.current(out > 0 ? tg("sp.hrHigh", { hr }) : tg("sp.hrLow", { hr }));
    }
  }

  async function connectHrSensor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as Navigator & { bluetooth?: { requestDevice: (o: unknown) => Promise<any> } };
    if (!nav.bluetooth) { toast.error(d["t.noBt"]); return; }
    setHrSensor("connecting");
    try {
      const device = await nav.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService("heart_rate");
      const char = await service.getCharacteristic("heart_rate_measurement");
      await char.startNotifications();
      char.addEventListener("characteristicvaluechanged", onHrNotify);
      device.addEventListener("gattserverdisconnected", () => { setHrSensor("none"); setLiveHr(null); liveHrRef.current = null; });
      hrDeviceRef.current = device;
      setHrSensor("on");
      toast.success(tg("t.hrOn", { n: device.name ? ` (${device.name})` : "" }));
    } catch {
      setHrSensor("none"); // refus utilisateur ou appareil indisponible
    }
  }

  function disconnectHrSensor() {
    try { if (hrDeviceRef.current?.gatt?.connected) hrDeviceRef.current.gatt.disconnect(); } catch { /* ignore */ }
    hrDeviceRef.current = null;
    setHrSensor("none"); setLiveHr(null); liveHrRef.current = null;
  }

  // ── Séance FC guidée EN DIRECT (durée + zone cible) — annonces vocales, capteur optionnel ──
  function startHrSession() {
    sessionKindRef.current = "hr"; setSessionKind("hr");
    cpsRef.current = []; setCheckpoints([]);
    elapsedRef.current = 0; kmRef.current = 0; pausedRef.current = false; lastPosRef.current = null;
    trackRef.current = []; hrSumRef.current = 0; hrNRef.current = 0; hrOutRef.current = 0; lastHrCueRef.current = 0;
    setElapsed(0); setCurrentKm(0); setCurrentPace(0); setPredictedFinish(0); setPaused(false);
    const z = HR_ZONES[hrZone - 1];
    hrLoRef.current = Math.round(maxHr * z.lo);
    hrHiRef.current = Math.round(maxHr * z.hi);
    setPhase("running");
    wantLockRef.current = true; requestWakeLock();
    speak(tg("sp.hrStart", { m: durationMin, z: zn(hrZone), lo: hrLoRef.current, hi: hrHiRef.current }));

    // GPS en bonus (distance réelle + tracé) — la fin de séance reste pilotée par la durée.
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      modeRef.current = "pending"; setGpsStatus("searching"); setGpsAccuracy(null);
      watchIdRef.current = navigator.geolocation.watchPosition(
        onGpsPosition,
        () => { if (modeRef.current !== "live") { modeRef.current = "sim"; setGpsStatus("off"); } },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
      );
      window.setTimeout(() => { if (modeRef.current === "pending") { modeRef.current = "sim"; setGpsStatus("off"); } }, 8000);
    } else { modeRef.current = "sim"; setGpsStatus("off"); }

    const total = durationMin * 60;
    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      const el = elapsedRef.current;
      // Annonces de structure : quarts, mi-séance, dernière minute.
      if (el === Math.round(total / 4)) speakRef.current(d["sp.q1"]);
      else if (el === Math.round(total / 2)) speakRef.current(tg("sp.half", { hr: liveHrRef.current ? tg("sp.halfHr", { hr: liveHrRef.current }) : "" }));
      else if (el === Math.round((3 * total) / 4)) speakRef.current(d["sp.q3"]);
      else if (total - el === 60) speakRef.current(d["sp.lastMin"]);
      if (el >= total) finishHrSession();
    }, 1000);
  }

  function finishHrSession() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
    intervalRef.current = null; watchIdRef.current = null;
    releaseWakeLock();
    const avg = hrNRef.current > 0 ? Math.round(hrSumRef.current / hrNRef.current) : null;
    speak(tg("sp.hrFinish", { m: durationMin, z: zn(hrZone), avg: avg ? tg("sp.hrFinishAvg", { a: avg }) : "" }));
    setPhase("finished");
    if (modeRef.current === "live") saveRun(elapsedRef.current); // vraie sortie GPS → historique
  }

  function startSession() {
    sessionKindRef.current = "pace"; setSessionKind("pace");
    const cps = buildCheckpoints();
    cpsRef.current = cps;
    setCheckpoints(cps);
    elapsedRef.current = 0; kmRef.current = 0; pausedRef.current = false; lastPosRef.current = null;
    trackRef.current = [];
    setElapsed(0); setCurrentKm(0); setCurrentPace(0); setPredictedFinish(0); setPaused(false);
    setPhase("running");
    wantLockRef.current = true; requestWakeLock(); // garde l'écran allumé pendant la course
    speak(tg("sp.start", { t: formatTime(targetTime), p: formatPace(targetPace) }));

    // GPS réel si disponible (téléphone/montre), sinon mode démo.
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      modeRef.current = "pending"; setGpsStatus("searching"); setGpsAccuracy(null);
      watchIdRef.current = navigator.geolocation.watchPosition(
        onGpsPosition,
        () => { if (modeRef.current !== "live") { modeRef.current = "sim"; setGpsStatus("sim"); } },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
      );
      // Pas de fix GPS en 8 s → bascule en mode démo (ne reste pas bloqué).
      window.setTimeout(() => { if (modeRef.current === "pending") { modeRef.current = "sim"; setGpsStatus("sim"); } }, 8000);
    } else {
      modeRef.current = "sim"; setGpsStatus("sim");
    }

    // Horloge : avance le chrono ; en mode démo, fait aussi avancer la distance.
    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (modeRef.current === "sim") {
        const noisy = targetPace * (1 + (Math.random() - 0.5) * 0.04);
        processProgress(elapsedRef.current / 60 / noisy, noisy);
      }
    }, 1000);
  }

  function pauseSession() {
    pausedRef.current = !pausedRef.current;
    lastPosRef.current = null;
    setPaused(pausedRef.current);
    speak(pausedRef.current ? d["sp.pause"] : d["sp.resume"]);
  }

  function stopSession() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
    intervalRef.current = null; watchIdRef.current = null;
    releaseWakeLock();
    disconnectHrSensor();
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    pausedRef.current = false; modeRef.current = "sim";
    setPaused(false); setGpsStatus("off"); setGpsAccuracy(null);
    setPhase("setup"); setElapsed(0); setCurrentKm(0); setCurrentPace(0);
  }

  async function sendToWatch() {
    if (sendingWatch) return;
    setSendingWatch(true);
    try {
      const today = new Date().toISOString().slice(0, 10); // défi perso = pour aujourd'hui (ex. course cet après-midi)
      const payload = targetMode === "hr"
        ? { targetType: "hr", durationMin, hrZone, date: today, name: tg("name.hr", { z: zn(hrZone), m: durationMin }) }
        : { targetType: "pace", distanceKm: distance, targetSeconds: targetTime, elevationM: elevation, date: today, name: tg("name.pace", { d: distance, t: formatTime(targetTime) }) };
      const res = await fetch("/api/watch/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.ok) toast.success(j.message ?? d["t.watchSent"], { duration: 7000 });
      else if (j.needsSetup) toast.error(j.message ?? d["t.watchSetup"], { duration: 5000 });
      else toast.error(j.error ?? d["t.watchErr"]);
    } catch {
      toast.error(d["t.connErr"]);
    } finally {
      setSendingWatch(false);
    }
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
    try { wakeLockRef.current?.release(); } catch { /* ignore */ }
  }, []);

  // Le Wake Lock est relâché quand l'onglet passe en arrière-plan → on le ré-acquiert au retour.
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === "visible" && wantLockRef.current) {
        try {
          const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
          if (nav.wakeLock) wakeLockRef.current = await nav.wakeLock.request("screen");
        } catch { /* ignore */ }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // État de la connexion montre (intervals.icu → Garmin/Coros/Wahoo) pour le voyant vert.
  useEffect(() => {
    fetch("/api/watch/status").then((r) => r.json()).then(setWatchStatus).catch(() => setWatchStatus({ connected: false, pushReady: false, device: null }));
  }, []);

  const progressPct = Math.min(100, (currentKm / distance) * 100);
  const timeDelta = predictedFinish - targetTime;
  const isAhead = timeDelta < -5;
  const isBehind = timeDelta > 5;
  // Écart d'allure instantané vs cible : +s/km = trop lent, −s/km = plus rapide.
  const paceDeltaSec = currentPace > 0 ? Math.round((currentPace - targetPace) * 60) : 0;
  const onPace = currentPace > 0 && Math.abs(paceDeltaSec) <= 3;

  const vma = baseline?.vma_kmh ?? 16;
  const maxHr = baseline?.max_hr ?? 190;
  const estimatedPaces = [
    { label: d["hz.1"], pace: 60 / (vma * 0.6) },
    { label: d["ep.2"], pace: 60 / (vma * 0.72) },
    { label: d["hz.3"], pace: 60 / (vma * 0.82) },
    { label: d["hz.4"], pace: 60 / (vma * 0.88) },
    { label: "VMA", pace: 60 / vma },
  ];

  return (
    <div className="space-y-6">
      {/* Header — clair & luxueux */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-200/70 bg-white px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 shadow-md ring-1 ring-zinc-700/50">
            <Ghost className="h-6 w-6 text-emerald-400" />
          </span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Ghost Runner</h2>
            <p className="mt-0.5 text-sm text-zinc-500">{d["hd.sub"]}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[
                { icon: Satellite, l: d["ch.gps"] },
                { icon: Mic, l: d["ch.voice"] },
                { icon: Watch, l: d["ch.watch"] },
              ].map((b) => (
                <span key={b.l} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                  <b.icon className="h-3 w-3" /> {b.l}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
            audioEnabled ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          }`}
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          Audio {audioEnabled ? "ON" : "OFF"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {phase === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Séances du coach — faisables ici sans montre (allure/FC ciblée + voix) */}
            {coachSessions.length > 0 && (
              <div className="mb-5 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/10"><ClipboardList className="h-4 w-4 text-emerald-700" /></span>
                  <h3 className="font-bold text-zinc-900">{d["co.title"]}</h3>
                </div>
                <p className="mb-3 mt-0.5 text-sm text-zinc-500">{d["co.sub"]}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {coachSessions.map((s, i) => {
                    const dt = new Date(s.date + "T00:00:00");
                    const isToday = s.date === new Date().toISOString().slice(0, 10);
                    return (
                      <button key={i} onClick={() => applyCoachSession(s)}
                        className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 text-left transition-all hover:border-emerald-400 hover:shadow-sm">
                        <div className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                          <span className="text-[9px] font-bold uppercase leading-none">{dt.toLocaleDateString(lang, { month: "short" })}</span>
                          <span className="text-base font-black leading-none">{dt.getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-semibold text-zinc-900">{s.title}</span>
                            {isToday && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{d["co.today"]}</span>}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{s.detail || d["co.fallback"]}</p>
                        </div>
                        <span className="self-center whitespace-nowrap text-xs font-semibold text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">{d["co.load"]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Choix de la cible : allure ou fréquence cardiaque */}
            <div className="mb-4 flex gap-1 p-1 bg-zinc-100 rounded-2xl w-fit">
              {([["pace", Zap, d["md.pace"]], ["hr", Heart, d["md.hr"]]] as const).map(([m, Icon, l]) => (
                <button key={m} onClick={() => setTargetMode(m)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${targetMode === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                  <Icon className={`h-4 w-4 ${targetMode === m ? (m === "hr" ? "text-rose-500" : "text-emerald-600") : ""}`} /> {l}
                </button>
              ))}
            </div>

            {targetMode === "pace" ? (
            <>
            {/* Presets — objectifs classiques, avec allure requise et faisabilité vs ta VMA */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              {PRESETS.map((p) => {
                const pace = p.targetTime / 60 / p.distance;            // min/km requis
                const reqPctVma = (60 / pace) / vma;                    // % de VMA requis
                // % de VMA soutenable selon la distance (repères physiologiques classiques)
                const sustainable = p.distance <= 6 ? 0.94 : p.distance <= 12 ? 0.9 : p.distance <= 22 ? 0.85 : 0.8;
                const feas = reqPctVma <= sustainable ? { c: "#10b981", l: d["feas.ok"] }
                  : reqPctVma <= sustainable + 0.05 ? { c: "#f59e0b", l: d["feas.amb"] }
                  : { c: "#f43f5e", l: d["feas.hard"] };
                const active = distance === p.distance && targetTime === p.targetTime;
                return (
                  <button
                    key={p.name}
                    onClick={() => { setDistance(p.distance); setTargetTime(p.targetTime); }}
                    title={tg("feas.title", { l: feas.l, v: vma })}
                    className={`group rounded-2xl border p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                      active
                        ? "border-transparent bg-zinc-900 text-white shadow-lg"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${active ? "text-zinc-400" : "text-zinc-400"}`}>{p.goal}</span>
                      <span className="h-2 w-2 rounded-full" style={{ background: feas.c }} />
                    </div>
                    <div className={`mt-1 text-lg font-bold leading-tight ${active ? "text-white" : "text-zinc-900"}`}>{p.name === "Semi" ? d["pr.semi"] : p.name}</div>
                    <div className={`mt-0.5 text-xs font-semibold tabular-nums ${active ? "text-emerald-300" : "text-zinc-500"}`}>{formatPace(pace)} /km</div>
                  </button>
                );
              })}
            </div>

            {/* Réglages faciles : choisis distance + allure, le temps se calcule tout seul */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {/* Distance */}
              <div className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400"><MapPin className="h-3.5 w-3.5" /> {d["lb.dist"]}</label>
                  <div className="flex gap-1">
                    <button onClick={() => setDistanceKeepPace(distance - 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-white">−</button>
                    <button onClick={() => setDistanceKeepPace(distance + 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-white">+</button>
                  </div>
                </div>
                <div className="mb-3 text-4xl font-black tabular-nums text-zinc-900">{distance}<span className="ml-1 text-base font-semibold text-zinc-400">km</span></div>
                <input type="range" min={1} max={50} step={0.5} value={Math.min(distance, 50)} onChange={(e) => setDistanceKeepPace(parseFloat(e.target.value))} className="w-full accent-zinc-900" />
                <div className="mt-3 flex flex-wrap gap-1">
                  {[5, 10, 21.1, 42.2].map((dd) => (
                    <button key={dd} onClick={() => setDistanceKeepPace(dd)} className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors ${distance === dd ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>{dd === 21.1 ? d["pr.semi"] : dd === 42.2 ? "Marathon" : dd + "K"}</button>
                  ))}
                </div>
              </div>

              {/* Allure cible — commande principale (héros) */}
              <div className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_46px_-26px_rgba(5,150,105,0.4)] ring-1 ring-emerald-100">
                <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600"><Zap className="h-3.5 w-3.5" /> {d["lb.pace"]}</label>
                    <div className="flex gap-1">
                      <button onClick={() => setPaceMinKm(targetPace - 5 / 60)} title={d["faster"]} className="flex h-7 items-center justify-center rounded-full bg-emerald-50 px-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white">−5s</button>
                      <button onClick={() => setPaceMinKm(targetPace + 5 / 60)} title={d["slower"]} className="flex h-7 items-center justify-center rounded-full bg-emerald-50 px-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white">+5s</button>
                    </div>
                  </div>
                  <div className="mb-3 text-4xl font-black tabular-nums text-zinc-900">{formatPace(targetPace)}<span className="ml-1 text-base font-semibold text-zinc-400">/km</span></div>
                  <input type="range" min={150} max={540} step={5} value={Math.round(Math.min(9, Math.max(2.5, targetPace)) * 60)} onChange={(e) => setPaceMinKm(parseInt(e.target.value) / 60)} className="w-full accent-emerald-600" />
                  <div className="mt-1 flex justify-between text-[10px] font-medium text-zinc-400"><span>{d["fast"]}</span><span>{d["slow"]}</span></div>
                </div>
              </div>

              {/* Temps visé — calculé automatiquement */}
              <div className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400"><Timer className="h-3.5 w-3.5" /> {d["lb.time"]}</label>
                  <div className="flex gap-1">
                    <button onClick={() => bumpTime(-60)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-white">−</button>
                    <button onClick={() => bumpTime(60)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-white">+</button>
                  </div>
                </div>
                <div className="mb-3 text-4xl font-black tabular-nums text-zinc-900">{formatTime(targetTime)}</div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">{d["calc"]}</div>
              </div>
            </div>

            {/* Dénivelé (optionnel) */}
            <div className="mb-6 flex items-center gap-4 rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
              <label className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400"><TrendingUp className="h-3.5 w-3.5 text-orange-500" /> {d["lb.elev"]}</label>
              <input type="range" min={0} max={3000} step={50} value={Math.min(elevation, 3000)} onChange={(e) => setElevation(parseInt(e.target.value))} className="flex-1 accent-orange-500" />
              <span className="w-20 text-right text-lg font-black tabular-nums text-zinc-900">{elevation}<span className="ml-0.5 text-xs font-semibold text-zinc-400">m</span></span>
            </div>

            {/* Pace zones reference */}
            <div className="mb-6 rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900">{d["ref.title"]}</h3>
                <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white">VMA {vma} km/h</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {estimatedPaces.map((z, i) => {
                  const tint = ["#0ea5e9", "#10b981", "#f59e0b", "#f97316", "#ef4444"][i];
                  return (
                    <button
                      key={z.label}
                      onClick={() => setTargetTime(Math.round(z.pace * 60 * distance))}
                      className="group rounded-2xl border border-zinc-200/80 bg-white p-2.5 text-center transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                    >
                      <span className="mx-auto mb-1.5 block h-1 w-6 rounded-full transition-all group-hover:w-8" style={{ background: tint }} />
                      <div className="mb-0.5 text-[11px] font-medium text-zinc-500">{z.label}</div>
                      <div className="text-sm font-bold tabular-nums text-zinc-900">{formatPace(z.pace)}<span className="text-[10px] font-medium text-zinc-300"> /km</span></div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-zinc-400">{d["ref.hint"]}</p>
            </div>
            </>
            ) : (
            /* ── Mode FRÉQUENCE CARDIAQUE : durée + zone cardiaque ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Durée */}
              <div className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400"><Timer className="h-3.5 w-3.5" /> {d["lb.dur"]}</label>
                  <div className="flex gap-1">
                    <button onClick={() => setDurationMin((d) => Math.max(5, d - 5))} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-white">−</button>
                    <button onClick={() => setDurationMin((d) => Math.min(240, d + 5))} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-white">+</button>
                  </div>
                </div>
                <div className="mb-3 text-4xl font-black tabular-nums text-zinc-900">{durationMin}<span className="ml-1 text-base font-semibold text-zinc-400">min</span></div>
                <input type="range" min={10} max={180} step={5} value={Math.min(durationMin, 180)} onChange={(e) => setDurationMin(parseInt(e.target.value))} className="w-full accent-zinc-900" />
                <div className="mt-3 flex flex-wrap gap-1">
                  {[30, 45, 60, 90].map((d) => (
                    <button key={d} onClick={() => setDurationMin(d)} className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors ${durationMin === d ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>{d} min</button>
                  ))}
                </div>
              </div>
              {/* Zone FC cible (héros) */}
              <div className="relative overflow-hidden rounded-3xl border border-rose-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_46px_-26px_rgba(244,63,94,0.4)] ring-1 ring-rose-100">
                <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-rose-400/10 blur-2xl" />
                <div className="relative">
                  <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">❤️ {d["hr.zone"]}</label>
                  <div className="space-y-1.5">
                    {HR_ZONES.map((z) => (
                      <button key={z.z} onClick={() => setHrZone(z.z)}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-all ${hrZone === z.z ? "bg-rose-500 text-white shadow-sm" : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100"}`}>
                        <span className="font-semibold">{zn(z.z)}</span>
                        <span className={`text-xs tabular-nums ${hrZone === z.z ? "text-rose-100" : "text-zinc-400"}`}>{Math.round(maxHr * z.lo)}–{Math.round(maxHr * z.hi)} bpm</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-zinc-400">{tg("hr.max", { n: Math.round(maxHr) })}</p>
                    {hrSensor === "on" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 ring-1 ring-rose-200">
                        <Bluetooth className="h-3 w-3" /> {d["hr.on"]}{liveHr != null ? ` · ${liveHr} bpm` : ""}
                      </span>
                    ) : (
                      <button onClick={connectHrSensor} disabled={hrSensor === "connecting"}
                        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60">
                        {hrSensor === "connecting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bluetooth className="h-3 w-3" />}
                        {d["hr.connect"]}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Summary */}
            <div className="bg-zinc-900 text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 mb-6">
              {targetMode === "pace" ? (
                <div className="flex items-center gap-6 sm:gap-8">
                  <div><div className="text-zinc-400 text-sm mb-1">{d["lb.pace"]}</div><div className="text-2xl font-bold">{formatPace(targetPace)} /km</div></div>
                  <div><div className="text-zinc-400 text-sm mb-1">{d["lb.dist"]}</div><div className="text-2xl font-bold">{distance} km</div></div>
                  <div><div className="text-zinc-400 text-sm mb-1">{d["sm.goal"]}</div><div className="text-2xl font-bold">{formatTime(targetTime)}</div></div>
                </div>
              ) : (
                <div className="flex items-center gap-6 sm:gap-8">
                  <div><div className="text-zinc-400 text-sm mb-1">{d["lb.dur"]}</div><div className="text-2xl font-bold">{durationMin} min</div></div>
                  <div><div className="text-zinc-400 text-sm mb-1">{d["sm.hrZone"]}</div><div className="text-2xl font-bold">{zn(hrZone)}</div></div>
                  <div><div className="text-zinc-400 text-sm mb-1">{d["sm.target"]}</div><div className="text-2xl font-bold tabular-nums">{Math.round(maxHr * HR_ZONES[hrZone - 1].lo)}–{Math.round(maxHr * HR_ZONES[hrZone - 1].hi)}</div></div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={sendToWatch}
                  disabled={sendingWatch}
                  title={d["watch.tooltip"]}
                  className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-4 text-sm font-semibold text-white ring-1 ring-white/20 transition-all hover:bg-white/20 disabled:opacity-50"
                >
                  {sendingWatch ? <Loader2 className="w-5 h-5 animate-spin" /> : <Watch className="w-5 h-5" />}
                  {sendingWatch ? d["watch.sending"] : d["watch.send"]}
                  {!sendingWatch && watchStatus && (
                    <span title={watchStatus.pushReady ? tg("watch.okTitle", { d: watchStatus.device ?? "" }) : d["watch.setupTitle"]}
                      className={`h-2 w-2 rounded-full ${watchStatus.pushReady ? "bg-emerald-400" : watchStatus.connected ? "bg-amber-400" : "bg-zinc-400"}`} />
                  )}
                </button>
                <button
                  onClick={() => (targetMode === "hr" ? startHrSession() : startSession())}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 text-lg transition-all"
                >
                  <Play className="w-6 h-6" />
                  {d["start"]}
                </button>
              </div>
            </div>

            {/* Montre : voyant d'état toujours visible, mode d'emploi replié (accordéon) */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <button
                onClick={() => setShowGuide((v) => !v)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-50"
              >
                <Watch className="h-5 w-5 flex-shrink-0 text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-zinc-900">{d["acc.title"]}</span>
                  {watchStatus && (
                    <span className={`mt-0.5 flex items-center gap-1.5 text-xs font-semibold ${watchStatus.pushReady ? "text-emerald-700" : watchStatus.connected ? "text-amber-700" : "text-zinc-500"}`}>
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${watchStatus.pushReady ? "bg-emerald-500" : watchStatus.connected ? "bg-amber-500" : "bg-zinc-400"}`} />
                      {watchStatus.pushReady
                        ? tg("acc.ok", { d: watchStatus.device ?? "" })
                        : watchStatus.connected
                        ? d["acc.almost"]
                        : d["acc.no"]}
                    </span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform ${showGuide ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence initial={false}>
                {showGuide && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-zinc-100 px-5 py-4">
                      <ol className="space-y-2.5 text-sm text-zinc-700">
                        {(GUIDE[lang] ?? GUIDE.fr).map((txt, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">{i + 1}</span>
                            <span>{txt}</span>
                          </li>
                        ))}
                      </ol>
                      <a href="/dashboard/sync" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800">
                        {d["acc.cta"]}
                      </a>
                      <p className="mt-2 text-[11px] text-zinc-400">{GUIDE_TIP[lang] ?? GUIDE_TIP.fr}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {(phase === "running" || phase === "finished") && (
          <motion.div key="running" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Statut GPS en course */}
            {phase === "running" && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                {gpsStatus === "live" && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> {d["st.gps"]}{gpsAccuracy != null ? ` · ±${Math.round(gpsAccuracy)} m` : ""}</span>}
                {gpsStatus === "searching" && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-amber-700"><Loader2 className="h-3 w-3 animate-spin" /> {d["st.search"]}</span>}
                {gpsStatus === "sim" && sessionKind === "pace" && <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600">{d["st.demo"]}</span>}
                {sessionKind === "hr" && (
                  hrSensor === "on" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-rose-700"><Bluetooth className="h-3 w-3" /> {d["st.hrOn"]}</span>
                  ) : hrSensor === "connecting" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-600"><Loader2 className="h-3 w-3 animate-spin" /> {d["st.hrConn"]}</span>
                  ) : (
                    <button onClick={connectHrSensor}
                      className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-white transition-colors hover:bg-zinc-700">
                      <Bluetooth className="h-3 w-3" /> {d["st.hrBtn"]}
                    </button>
                  )
                )}
              </div>
            )}
            {/* Affichage principal — mode FC : BPM géant coloré par zone, progression à la durée */}
            {sessionKind === "hr" ? (() => {
              const total = durationMin * 60;
              const lo = hrLoRef.current, hi = hrHiRef.current;
              const inZone = liveHr != null && liveHr >= lo && liveHr <= hi;
              const accent = phase === "finished" ? "#047857" : liveHr == null ? "#0369a1" : inZone ? "#047857" : liveHr > hi ? "#e11d48" : "#0369a1";
              const pct = Math.min(100, (elapsed / total) * 100);
              const remaining = Math.max(0, total - elapsed);
              const avg = hrNRef.current > 0 ? Math.round(hrSumRef.current / hrNRef.current) : null;
              return (
            <div className="relative overflow-hidden rounded-[28px] border border-zinc-200/70 bg-white p-7 sm:p-10 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_30px_70px_-34px_rgba(16,24,40,0.22)]">
              <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[34rem] -translate-x-1/2 rounded-full blur-3xl opacity-[0.15] transition-colors duration-500" style={{ background: accent }} />
              <div className="relative z-10">
                <div className="text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">{liveHr != null ? d["md.hr"] : d["lv.elapsed"]}</div>
                  {liveHr != null ? (
                    <div className="mt-2 text-7xl sm:text-[8rem] font-extrabold tabular-nums leading-[0.95] tracking-tight transition-colors duration-300" style={{ color: phase === "finished" ? "#18181b" : accent }}>
                      {liveHr}<span className="align-top text-2xl font-bold text-zinc-300"> bpm</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-7xl sm:text-[8rem] font-extrabold tabular-nums leading-[0.95] tracking-tight text-zinc-900">{formatTime(elapsed)}</div>
                  )}
                  {phase === "running" && (
                    <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: "#f8fafc", color: accent }}>
                      <span className="opacity-70">{tg("lv.target", { z: zn(hrZone), lo, hi })}</span>
                      {liveHr != null && (
                        <>
                          <span className="opacity-30">·</span>
                          {inZone ? <span>{d["lv.inZone"]}</span> : liveHr > hi ? <span>{d["lv.tooHigh"]}</span> : <span>{d["lv.tooLow"]}</span>}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{d["lv.time"]}</div>
                    <div className="mt-0.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-zinc-900">{formatTime(elapsed)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{d["lv.left"]}</div>
                    <div className="mt-0.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-zinc-900">{formatTime(remaining)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{gpsStatus === "live" ? d["lb.dist"] : d["lv.avgHr"]}</div>
                    <div className="mt-0.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-zinc-900">
                      {gpsStatus === "live"
                        ? <>{currentKm.toFixed(2)}<span className="text-sm text-zinc-300"> km</span></>
                        : avg != null ? <>{avg}<span className="text-sm text-zinc-300"> bpm</span></> : "—"}
                    </div>
                  </div>
                </div>

                <div className="relative mt-8 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <motion.div className="absolute left-0 top-0 h-full rounded-full" style={{ background: accent }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                </div>
                <div className="mt-2 flex justify-between text-xs font-medium text-zinc-400">
                  <span>0 min</span>
                  <span>{Math.round(durationMin / 2)} min</span>
                  <span>{durationMin} min</span>
                </div>
              </div>
            </div>
              );
            })() : (() => {
              const ahead = paceDeltaSec < 0;
              const accent = phase === "finished" ? "#047857" : onPace ? "#0369a1" : ahead ? "#047857" : "#c2410c";
              const soft = onPace ? "#eff6ff" : ahead ? "#ecfdf5" : "#fff7ed";
              return (
            <div className="relative overflow-hidden rounded-[28px] border border-zinc-200/70 bg-white p-7 sm:p-10 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_30px_70px_-34px_rgba(16,24,40,0.22)]">
              <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[34rem] -translate-x-1/2 rounded-full blur-3xl opacity-[0.15] transition-colors duration-500" style={{ background: accent }} />
              <div className="relative z-10">
                {/* Allure GÉANTE, teinte raffinée */}
                <div className="text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">{d["lv.curPace"]}</div>
                  <div className="mt-2 text-7xl sm:text-[8rem] font-extrabold tabular-nums leading-[0.95] tracking-tight transition-colors duration-300" style={{ color: phase === "finished" ? "#18181b" : accent }}>
                    {formatPace(currentPace)}<span className="align-top text-2xl font-bold text-zinc-300"> /km</span>
                  </div>
                  {phase === "running" && (
                    <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: soft, color: accent }}>
                      <span className="opacity-70">{tg("lv.targetPace", { p: formatPace(targetPace) })}</span>
                      <span className="opacity-30">·</span>
                      {onPace ? <span>{d["lv.onPace"]}</span>
                        : ahead ? <span>{tg("lv.faster", { s: Math.abs(paceDeltaSec) })}</span>
                        : <span>{tg("lv.slower", { s: paceDeltaSec })}</span>}
                    </div>
                  )}
                </div>

                {/* Avance / retard cumulé */}
                {phase === "running" && Math.abs(timeDelta) > 3 && (
                  <div className="mt-4 text-center text-base font-bold" style={{ color: isAhead ? "#047857" : "#c2410c" }}>
                    {isAhead ? tg("lv.aheadGoal", { t: formatTime(Math.abs(timeDelta)) }) : tg("lv.behindGoal", { t: formatTime(Math.abs(timeDelta)) })}
                  </div>
                )}

                {/* Stats secondaires */}
                <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{d["lv.time"]}</div>
                    <div className="mt-0.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-zinc-900">{formatTime(elapsed)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{d["lb.dist"]}</div>
                    <div className="mt-0.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-zinc-900">{currentKm.toFixed(2)}<span className="text-sm text-zinc-300"> km</span></div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{d["lv.eta"]}</div>
                    <div className="mt-0.5 text-2xl sm:text-3xl font-extrabold tabular-nums flex items-center justify-center gap-1" style={{ color: isAhead ? "#047857" : isBehind ? "#c2410c" : "#0369a1" }}>
                      {formatTime(predictedFinish)}
                      {isAhead ? <TrendingDown className="w-4 h-4" /> : isBehind ? <TrendingUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Progress bar fine & élégante */}
                <div className="relative mt-8 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <motion.div className="absolute left-0 top-0 h-full rounded-full" style={{ background: accent }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.5 }} />
                  <div className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full" style={{ left: `calc(${Math.min(100, (elapsed / targetTime) * 100)}% - 2px)`, background: accent, boxShadow: `0 0 8px ${accent}66` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs font-medium text-zinc-400">
                  <span>0 km</span>
                  <span>{(distance / 2).toFixed(1)} km</span>
                  <span>{distance} km</span>
                </div>
              </div>
            </div>
              );
            })()}

            {/* Checkpoints — mode allure uniquement (la séance FC est pilotée par la durée) */}
            {sessionKind === "pace" && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 mb-5">
              <h3 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {d["cp.title"]}
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
                          cp.split === "ahead" ? "bg-emerald-100 text-emerald-700" :
                          cp.split === "behind" ? "bg-orange-100 text-orange-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {cp.split === "ahead" ? d["cp.ahead"] : cp.split === "behind" ? d["cp.behind"] : d["cp.on"]}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}

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
                    {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    {paused ? d["ct.resume"] : d["ct.pause"]}
                  </button>
                  <button
                    onClick={stopSession}
                    className="flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-6 py-3 rounded-2xl transition-all"
                  >
                    <StopCircle className="w-5 h-5" />
                    {d["ct.stop"]}
                  </button>
                </>
              )}
              {phase === "finished" && (
                <button
                  onClick={stopSession}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-zinc-700 font-semibold py-3 rounded-2xl border border-zinc-200 hover:border-zinc-400 transition-all"
                >
                  {d["ct.new"]}
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

function formatPace(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}
