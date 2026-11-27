"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useId, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, StopCircle, Volume2, VolumeX,
  TrendingUp, TrendingDown, Minus, Zap, Timer, MapPin, Watch, Loader2,
  Ghost, Heart, ClipboardList, ChevronDown, Satellite, Mic, Bluetooth,
  Activity, Gauge, Layers, LocateFixed, SlidersHorizontal, Maximize2, Minimize2,
  AlertTriangle, X, ShieldCheck, Flag, Check,
} from "lucide-react";
import { toast } from "sonner";
import type { UserProfile, PerformanceBaseline } from "@/types";
import { useT } from "@/lib/i18n/LanguageProvider";
import { referencesFc, plageFc, cibleEndurance, maxDeReference, seuilMesure } from "@/lib/coach/fcCible";
import { GX, GUIDE, GUIDE_TIP, SPEECH_LANG, fillG } from "./ghostI18n";
import { messageLecture } from "@/lib/watch/intervals";
import { jourCivil } from "@/lib/time/fuseau";
import { useFuseau } from "@/lib/time/FuseauProvider";
import dynamic from "next/dynamic";
const CarteDirect = dynamic(() => import("./CarteDirect").then((m) => m.CarteDirect), { ssr: false });
import { sauverEnCours, lireEnCours, effacerEnCours, mettreEnAttente, vautEnregistrement, INTERVALLE_SAUVEGARDE_MS, type CourseEnCours } from "@/lib/courses/horsLigne";
import { avancer, intensite, idPartage, lienSuivi, lienSms, messageAlerte, messageDepart, type EtatVeille } from "@/lib/courses/veille";
import { createClient } from "@/lib/supabase/client";
import { calquesDisponibles, fondsDisponibles, tuileDe, type CalqueCarte, type FondCarte, type IdCalque, type IdFond } from "@/lib/courses/fondsCarte";
import { sortiesDepuis, type ParcoursDate } from "@/lib/courses/mesParcours";
import { vignetteDessinee, VIGNETTE_RUES } from "./vignettes";
import { RELIEF, avecCle } from "@/lib/trail/couches";

/** La clé MapTiler (publique) : elle décide quels modèles existent (satellite, relief). */
const CLE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY || undefined;
/** Le bouton « 3D » n'existe que si le relief existe (clé MapTiler) : une carte seulement
 *  inclinée ne se fait pas passer pour du relief (cf. lib/trail/couches). */
const RELIEF_DISPO = avecCle(RELIEF.url, process.env.NEXT_PUBLIC_MAPTILER_KEY || undefined) !== null;

/**
 * ⚠️ `title`, `detail` et `tags` sont en FRANÇAIS, et doivent le rester :
 * `applyCoachSession` les analyse (« seuil », « récup », « côte », « N×DISTANCE ») pour
 * régler l'allure, la distance et la zone du défi. Les traduire changerait la séance
 * fabriquée ici, en silence. `i18n` ne sert qu'à ce que l'athlète LIT.
 */
export interface CoachSess {
  title: string; detail: string; date: string; tags: string[];
  i18n?: Record<string, { title?: string; subtitle?: string }>;
}

interface GhostRunnerProps {
  profile: UserProfile | null;
  /** FC max réellement ENREGISTRÉE sur ses séances. Une mesure passe avant toute
   *  formule — et avant la baseline, qui n'existe que si l'athlète a fait un test. */
  fcMaxObservee?: number | null;
  /** FC moyennes de ses footings réels : la cible d'endurance s'y ajuste vers le bas. */
  fcFootings?: number[];
  baseline: PerformanceBaseline | null;
  /** VMA effective, calculée comme celle du coach (courbe d'allure → efforts réels).
   *  Prime sur la baseline, qui n'est renseignée que si l'athlète a fait un test. */
  effectiveVma?: number | null;
  coachSessions?: CoachSess[];
  /** Le contact d'urgence enregistré (Santé › Sécurité) : destinataire du lien de suivi
   *  au départ, et du message si un choc reste sans réponse. */
  contact?: { nom: string; tel: string };
  /** Centre de la dernière trace connue — CADRAGE de la carte, jamais une position. */
  centreInitial?: [number, number] | null;
  /** Ses dernières traces GPS, allégées et datées (`lib/courses/mesParcours`) — « Mes sorties ». */
  mesParcours?: ParcoursDate[];
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

/**
 * Bornes des réglages LIBRES.
 * ⚠️ L'allure d'objectif est bornée à 10:00/km, ce qui exclut la marche rapide et le
 * trail en montée — deux allures parfaitement réelles. En libre on va jusqu'à 15:00.
 * La fourchette cardiaque, elle, doit pouvoir descendre au repos et monter au-delà de
 * la FC max théorique : c'est une mesure de l'athlète, pas une théorie.
 */
const PACE_LIBRE_MIN = 2.5;   // 2:30 /km
const PACE_LIBRE_MAX = 15;    // 15:00 /km
const FC_MIN = 80;
const FC_MAX = 220;

// Zones de fréquence cardiaque (% de la FC max) — noms traduits au rendu (clés hz.*).
const HR_ZONES = [
  { z: 1, lo: 0.50, hi: 0.60 },
  { z: 2, lo: 0.60, hi: 0.70 },
  { z: 3, lo: 0.70, hi: 0.80 },
  { z: 4, lo: 0.80, hi: 0.90 },
  { z: 5, lo: 0.90, hi: 1.00 },
];

// Profil de dénivelé — courbe procédurale stable qui reflète le D+ choisi (plat si 0).
// Pas de données de parcours réelles ici (écran de configuration) : l'amplitude suit le
// D+/km demandé, ce qui donne un aperçu honnête de la difficulté du terrain.
function ElevationProfile({ elevation, distance }: { elevation: number; distance: number }) {
  const W = 800, H = 110, n = 72;
  const amp = Math.max(0, Math.min(1, elevation / Math.max(distance, 1) / 55));
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const noise = Math.sin(t * 9.3) * 0.5 + Math.sin(t * 23.7 + 1.5) * 0.3 + Math.sin(t * 41.2 + 0.7) * 0.2;
    const h = amp * (0.5 + 0.5 * noise);
    const x = t * W, y = H - 7 - h * (H - 22);
    pts.push(`${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const line = pts.join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ghost-elev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((tk) => (
          <line key={tk} x1="0" x2={W} y1={H * tk} y2={H * tk} stroke="#f1f5f4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill="url(#ghost-elev)" />
        <path d={line} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
        <span>0 km</span><span>{(distance / 2).toFixed(0)} km</span><span>{distance.toFixed(0)} km</span>
      </div>
    </div>
  );
}

/**
 * Comment NOMMER la source quand aucune montre ne peut recevoir.
 *
 * `device_name` est le modèle déclaré par la montre (« Apple Watch », « Polar Vantage »),
 * `source` le canal d'entrée rendu lisible (« Garmin Connect »). On préfère le modèle :
 * c'est le mot que la personne reconnaît. Jamais de chaîne vide — le message dirait
 * « On lit bien tes données () », ce qui inquiète au lieu de rassurer.
 */
export function nomLecture(l: { appareil: string | null; source: string | null } | null | undefined): string {
  return l?.appareil?.trim() || l?.source?.trim() || "intervals.icu";
}

export function GhostRunner({ profile, baseline, effectiveVma, fcMaxObservee = null, fcFootings = [], coachSessions = [], contact = { nom: "", tel: "" }, centreInitial = null, mesParcours = [] }: GhostRunnerProps) {
  // Les curseurs sont reliés à leur intitulé : sans cela un lecteur d'écran annonce
  // « curseur, 12 » sans dire de QUOI, et le libellé n'est pas cliquable.
  const cid = useId();
  const fuseau = useFuseau();
  // Une seule VMA dans toute l'application : test enregistré, sinon VMA effective,
  // et seulement en tout dernier recours une valeur par défaut.
  const vmaEff = baseline?.vma_kmh ?? effectiveVma ?? 16;
  const { lang } = useT();
  const d = GX[lang] ?? GX.fr;
  const tg = (k: string, p?: Record<string, string | number>) => fillG(d[k] ?? k, p);
  const zn = (z: number) => d[`hz.${z}`];
  const [phase, setPhase] = useState<"setup" | "running" | "finished">("setup");
  /** Une course commencée puis perdue (appli tuée, batterie) : retrouvée sur le téléphone à
   *  l'ouverture, proposée à l'enregistrement — jamais jetée en silence. */
  const [courseRetrouvee, setCourseRetrouvee] = useState<CourseEnCours | null>(null);
  /** Ce que la carte affiche : la position (point bleu) et le tracé de la course en cours. */
  const [positionCarte, setPositionCarte] = useState<[number, number] | null>(null);

  // ── VEILLE DE SÉCURITÉ (22/09/2026) ────────────────────────────────────────
  // Deux choses qui EXISTENT vraiment, à la différence des quatre promesses retirées de
  // l'onglet Sécurité : la position diffusée en direct à un proche dès le départ, et un
  // choc suivi d'une immobilité qui demande « tu vas bien ? ». Le reste (appel, SMS
  // automatique, détection hors premier plan) n'est pas à la portée d'une page web, et
  // l'écran le dit au lieu de le laisser croire.
  /** L'identifiant du partage en cours (`/suivre/<id>`), ou null si on ne partage pas. */
  const [partageId, setPartageId] = useState<string | null>(null);
  const partageCanalRef = useRef<{ send: (m: unknown) => void; unsubscribe: () => void } | null>(null);
  /** L'état de la veille : calme → choc → alerte. */
  const veilleRef = useRef<EtatVeille>({ phase: "calme" });
  const [chocDetecte, setChocDetecte] = useState(false);
  const [rebours, setRebours] = useState(60);
  const [veilleActive, setVeilleActive] = useState(false);
  const [capteursIndispo, setCapteursIndispo] = useState(false);
  /** Le lien de suivi proposé au départ, tant que l'athlète ne l'a pas envoyé ni fermé. */
  const [departPret, setDepartPret] = useState<string | null>(null);
  const reboursRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const motionRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const [traceCarte, setTraceCarte] = useState<[number, number][]>([]);

  // ── LA CARTE, COMME STRAVA (Cyprien, 22/09/2026 : « fais comme sur Strava ») ──
  // Le fond affiché, le suivi automatique — coupé dès que la main déplace la carte,
  // sinon la position suivante la ramène et on ne peut rien regarder d'autre — et un
  // compteur qui sert de signal de recentrage à la carte.
  const [fondCarte, setFondCarte] = useState<IdFond>("plan");
  const [suiviCarte, setSuiviCarte] = useState(true);
  const [recentrages, setRecentrages] = useState(0);
  /** Vrai quand le navigateur n'a pas donné la position : on le DIT sur la carte. */
  const [geoRefusee, setGeoRefusee] = useState(false);
  /** Carte en grand, comme le bouton plein écran d'une vidéo (Cyprien, 23/09/2026). */
  const [plein, setPlein] = useState(false);
  const sectionCarte = useRef<HTMLElement | null>(null);
  /**
   * ── LA VUE, COMME STRAVA (Cyprien, 27/11/2026, vidéo de Strava à l'appui) ──
   * « carte » : la carte, le bloc de chiffres et le tiroir du bas. « chiffres » : l'écran
   * blanc aux chiffres géants, celui qu'on regarde en courant. Le départ ouvre les
   * chiffres ; le bouton ⤡ passe de l'un à l'autre. La carte reste MONTÉE dessous : elle
   * continue de suivre et de tracer pendant qu'on regarde les chiffres.
   */
  const [vue, setVue] = useState<"carte" | "chiffres">("carte");
  const [calquesOuverts, setCalquesOuverts] = useState(false);
  /** « Mes sorties » : toutes, les 30 derniers jours, ou masquées. */
  const [modeSorties, setModeSorties] = useState<"toutes" | "recents" | "semaine" | "aucune">(mesParcours.length ? "toutes" : "aucune");
  /** Les calques allumés. Les points d'intérêt le sont d'office, comme sur le plan d'origine. */
  const [calquesActifs, setCalquesActifs] = useState<IdCalque[]>(["poi"]);
  const [relief3d, setRelief3d] = useState(false);
  /** Vrai quelques secondes après la première position : « Signal GPS trouvé », en vert. */
  const [gpsTrouve, setGpsTrouve] = useState(false);
  const avaitPosition = useRef(false);
  /** Le nom de la séance chargée depuis le coach — titre du bloc de chiffres. */
  const [seanceChargee, setSeanceChargee] = useState<string | null>(null);
  /** Le bas de l'écran : réglages avant le départ, chiffres géants pendant. */
  const detailsRef = useRef<HTMLDivElement | null>(null);
  /** Vrai quand c'est NOUS qui avons ouvert le grand écran (téléphone), pas la main. */
  const pleinAuto = useRef(false);
  // Les réglages et détails vivent SOUS la carte : en grand écran, on en sort d'abord,
  // sinon le défilement se fait derrière la couverture et rien ne bouge à l'écran.
  const versDetails = () => {
    const aller = () => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!plein) { aller(); return; }
    pleinAuto.current = false;
    setPlein(false);
    if (typeof document !== "undefined" && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    setTimeout(aller, 60);
  };
  const derniereSauvegardeRef = useRef(0);
  const demarreeARef = useRef(0);
  const [distance, setDistance] = useState(10);
  const [targetTime, setTargetTime] = useState(3600); // seconds
  const [elevation, setElevation] = useState(0);
  const [targetMode, setTargetMode] = useState<"pace" | "hr">("pace");
  /**
   * ── COURSE LIBRE (Cyprien, 23/09/2026) ────────────────────────────────────
   * « Il faut aussi permettre au client de courir à l'allure qu'il veut ou la fréquence
   * cardiaque qu'il veut. » Jusqu'ici l'écran imposait un OBJECTIF : en allure, il fallait
   * une distance ET un temps (l'allure n'existait que comme leur quotient) ; en cardio,
   * il fallait choisir parmi cinq zones. Impossible de dire « je pars à 5:30 » sans
   * s'engager sur une distance, ni « je reste entre 145 et 155 ».
   *
   * En mode libre : aucune distance, aucune durée, aucune fin automatique. Le coach tient
   * la cible à la voix, et on arrête quand on veut — ce qui n'était jouable que depuis que
   * le bouton « Arrêter » enregistre vraiment la course.
   */
  const [libre, setLibre] = useState(false);
  const [paceLibre, setPaceLibre] = useState(6);      // min/km
  const [fcLo, setFcLo] = useState(130);
  const [fcHi, setFcHi] = useState(145);
  /** Figé au départ : changer d'avis en courant ne doit pas changer la séance en cours. */
  const libreRef = useRef(false);
  /** Dernier kilomètre annoncé à la voix en mode libre (il n'y a pas de points de passage). */
  const dernierKmDitRef = useRef(0);
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
  // `lecture` : ce qui ARRIVE quand aucune montre ne peut recevoir. Sans lui, un porteur
  // d'Apple Watch ayant tout branché lisait « configure ta montre » — un réglage qui
  // n'existe pas, Apple n'ayant aucun champ d'envoi chez intervals.icu.
  type EtatMontre = {
    connected: boolean; pushReady: boolean; device: string | null;
    lecture?: { appareil: string | null; source: string | null; date: string | null } | null;
  };
  const [watchStatus, setWatchStatus] = useState<EtatMontre | null>(null);
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

  // ⚠️ EN LIBRE, L'ALLURE EST LA DONNÉE, PAS LE QUOTIENT. Ailleurs elle se déduit de la
  // distance et du temps visés ; en libre il n'y a ni l'une ni l'autre.
  const targetPace = libre && targetMode === "pace"
    ? paceLibre
    : distance > 0 ? targetTime / 60 / distance : 6; // min/km

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
    const vmaLoc = vmaEff;
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
    setSeanceChargee(s.i18n?.[lang]?.title ?? s.title);
    toast.success(tg("t.loaded", { t: s.title }), { duration: 4000 });
  };

  // Generate checkpoints every 1 km
  const buildCheckpoints = useCallback((): Checkpoint[] => {
    if (libre) return []; // aucune distance visée : rien à jalonner
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
  }, [distance, targetPace, elevation, libre]);

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
  /** Envoie une course terminée ; sans réseau, la met en file d'attente sur le téléphone. */
  async function envoyerCourse(corps: { title: string; distanceKm: number; durationSeconds: number; elevationGain?: number; track?: [number, number][]; type: string }) {
    const st = typeof localStorage !== "undefined" ? localStorage : null;
    // ⚠️ HORS LIGNE, ON N'ESSAIE MÊME PAS : la course va directement dans la file, et
    // `FileAttenteCourses` (layout) l'enverra dès que le réseau revient.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      mettreEnAttente(st, corps); effacerEnCours(st);
      toast.info(d["t.queued"], { duration: 8000 });
      return;
    }
    try {
      const r = await fetch("/api/workouts/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { effacerEnCours(st); toast.success(d["t.saved"], { duration: 5000 }); return; }
      // Refusée par le serveur (course invalide) : on le dit, on ne met pas en file — une
      // course refusée trois fois de suite y resterait pour rien.
      if (r.status >= 400 && r.status < 500) { toast.error(j.error || d["t.saveErr"]); return; }
      mettreEnAttente(st, corps); effacerEnCours(st); toast.info(d["t.queued"], { duration: 8000 });
    } catch {
      // Le réseau a lâché en cours de route : même file, même promesse.
      mettreEnAttente(st, corps); effacerEnCours(st); toast.info(d["t.queued"], { duration: 8000 });
    }
  }

  /** Le prénom affiché dans les messages : celui du profil, jamais le nom complet. */
  const prenom = (profile?.full_name ?? "").trim().split(/\s+/)[0] || null;
  const contactNom = (contact.nom || "").trim().split(/\s+/)[0] || null;

  /**
   * Diffuse la position en direct sur le canal `run-<id>` — EXACTEMENT le protocole que
   * la page publique `/suivre/<id>` écoute déjà (événement `pos`). Rien de nouveau à
   * apprendre côté spectateur, et aucun compte à créer de son côté.
   */
  function demarrerPartage(): string {
    const id = idPartage();
    setPartageId(id);
    try {
      const canal = createClient().channel(`run-${id}`, { config: { broadcast: { self: false } } });
      canal.subscribe();
      partageCanalRef.current = canal as unknown as { send: (m: unknown) => void; unsubscribe: () => void };
    } catch { /* sans réseau, le lien existe quand même : il s'animera dès le retour */ }
    return id;
  }

  function arreterPartage() {
    try { partageCanalRef.current?.unsubscribe(); } catch { /* déjà fermé */ }
    partageCanalRef.current = null;
    setPartageId(null);
  }

  /** Prépare le SMS au contact d'urgence (départ ou alerte) et l'ouvre d'un geste. */
  function prevenirContact(corps: string) {
    if (!contact.tel.trim()) { toast.error(d["veille.sansContact"]); return; }
    window.location.href = lienSms(contact.tel, corps);
  }

  /** Le lien de suivi complet, quand un partage est en cours. */
  const lienPartage = partageId && typeof window !== "undefined" ? lienSuivi(window.location.origin, partageId) : null;

  /**
   * Démarre l'écoute de l'accéléromètre.
   *
   * ⚠️ SUR IPHONE, LA PERMISSION SE DEMANDE DEPUIS UN GESTE DE L'UTILISATEUR :
   * `DeviceMotionEvent.requestPermission()` n'existe que là, et refuse hors d'un clic.
   * C'est pourquoi la veille s'arme au démarrage de la séance — un bouton pressé — et
   * pas au montage de la page.
   */
  async function armerVeille() {
    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") { setCapteursIndispo(true); return; }
    const DM = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> };
    try {
      if (typeof DM.requestPermission === "function") {
        const r = await DM.requestPermission();
        if (r !== "granted") { setCapteursIndispo(true); return; }
      }
    } catch { setCapteursIndispo(true); return; }
    veilleRef.current = { phase: "calme" };
    const onMotion = (e: DeviceMotionEvent) => {
      const g = intensite(e.accelerationIncludingGravity);
      const avant = veilleRef.current.phase;
      veilleRef.current = avancer(veilleRef.current, { g, t: Date.now() });
      if (veilleRef.current.phase === "alerte" && avant !== "alerte") declencherAlerte();
    };
    motionRef.current = onMotion;
    window.addEventListener("devicemotion", onMotion);
    setVeilleActive(true);
  }

  function desarmerVeille() {
    if (motionRef.current) window.removeEventListener("devicemotion", motionRef.current);
    motionRef.current = null;
    if (reboursRef.current) clearInterval(reboursRef.current);
    reboursRef.current = null;
    veilleRef.current = { phase: "calme" };
    setVeilleActive(false); setChocDetecte(false);
  }

  /**
   * Un choc suivi d'une immobilité : on demande, on ne décide pas. Soixante secondes,
   * une voix et un écran — puis le message au contact, qu'il reste à envoyer d'un geste.
   * ⚠️ Pacevo n'envoie RIEN tout seul : le dire est la seule façon que personne ne compte
   * sur une alerte qui ne partirait pas.
   */
  function declencherAlerte() {
    setChocDetecte(true);
    setRebours(60);
    speakRef.current(d["veille.choc"]);
    if (reboursRef.current) clearInterval(reboursRef.current);
    reboursRef.current = setInterval(() => {
      setRebours((n) => {
        if (n <= 1) {
          if (reboursRef.current) clearInterval(reboursRef.current);
          reboursRef.current = null;
          const pos = lastPosRef.current ? { lat: lastPosRef.current.lat, lng: lastPosRef.current.lng } : null;
          prevenirContact(messageAlerte(prenom, lienPartage, pos, {
            alerte: tg("veille.alerte", { nom: prenom ?? "" }), position: d["veille.position"],
            suivi: d["veille.suivi"], secours: d["veille.secours"],
          }));
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  }

  /** « Je vais bien » : la veille repart à zéro, rien n'est envoyé. */
  function jeVaisBien() {
    if (reboursRef.current) clearInterval(reboursRef.current);
    reboursRef.current = null;
    veilleRef.current = { phase: "calme" };
    setChocDetecte(false);
  }

  async function saveRun(finalSec: number) {
    if (kmRef.current < 0.1 || finalSec < 30) { effacerEnCours(typeof localStorage !== "undefined" ? localStorage : null); return; }
    await envoyerCourse({
      title: tg("runTitle", { km: Math.round(kmRef.current * 10) / 10 }),
      distanceKm: kmRef.current, durationSeconds: finalSec,
      elevationGain: elevation > 0 ? elevation : undefined,
      track: trackRef.current.length > 1 ? trackRef.current : undefined,
      type: "easy",
    });
  }

  function finishSession() {
    desarmerVeille(); arreterPartage();
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
    if (!libreRef.current && km > 0) setPredictedFinish((el / km) * distance);
    // ⚠️ EN LIBRE, PERSONNE NE JALONNE LA COURSE : sans points de passage, la voix se
    // tairait tout le long. On annonce donc chaque kilomètre entier avec l'allure tenue.
    if (libreRef.current) {
      const entier = Math.floor(km);
      if (entier > dernierKmDitRef.current) {
        dernierKmDitRef.current = entier;
        if (audioEnabled) speak(tg("sp.kmLibre", { km: entier, p: formatPace(paceMinKm) }));
      }
    }
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
    if (sessionKindRef.current === "pace" && !libreRef.current && km >= distance) finishSession();
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
        setTraceCarte([...trackRef.current]);
        processProgress(kmRef.current + d / 1000, pace);
        // ⚠️ ÉCRITE SUR LE TÉLÉPHONE PENDANT L'EFFORT (au plus toutes les 5 s) : sans
        // réseau, ou si le système tue l'appli, la course n'est plus perdue.
        if (t - derniereSauvegardeRef.current >= INTERVALLE_SAUVEGARDE_MS) {
          derniereSauvegardeRef.current = t;
          sauverEnCours(typeof localStorage !== "undefined" ? localStorage : null, {
            demarreeA: demarreeARef.current, elapsedSec: elapsedRef.current, km: kmRef.current,
            elevation, track: trackRef.current, misAJourA: t,
          });
        }
      }
    }
    lastPosRef.current = { lat: latitude, lng: longitude, t };
    setPositionCarte([latitude, longitude]);
    // Le proche qui suit reçoit la position en direct — même événement que la page
    // /suivre/<id> écoute déjà. Sans réseau, l'envoi échoue sans rien casser.
    try { partageCanalRef.current?.send({ type: "broadcast", event: "pos", payload: { lat: latitude, lng: longitude } }); } catch { /* hors ligne */ }
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
    // Sans FC max, une zone n'a pas de battements : on bascule en libre au lieu d'inventer.
    if (!libre && refsFc.max == null) { setLibre(true); return; }
    sessionKindRef.current = "hr"; setSessionKind("hr");
    libreRef.current = libre; dernierKmDitRef.current = 0;
    cpsRef.current = []; setCheckpoints([]);
    elapsedRef.current = 0; kmRef.current = 0; pausedRef.current = false; lastPosRef.current = null;
    trackRef.current = []; hrSumRef.current = 0; hrNRef.current = 0; hrOutRef.current = 0; lastHrCueRef.current = 0;
    setElapsed(0); setCurrentKm(0); setCurrentPace(0); setPredictedFinish(0); setPaused(false);
    // Une zone de 10 points de % FC max fait ~21 bpm de large : « reste entre 114 et
    // 133 » ne cible rien. On donne une fenêtre de 10 bpm, ancrée sur ses mesures.
    const intensite = (["recup", "endurance", "tempo", "seuil", "vma"] as const)[Math.min(4, Math.max(0, hrZone - 1))];
    // L'endurance suit ce que l'athlète fait VRAIMENT quand il court plus facile que
    // la théorie — jamais l'inverse, sinon on validerait des footings trop rapides.
    const cible = intensite === "endurance" ? cibleEndurance(refsFc, fcFootings) : plageFc(intensite, refsFc);
    const z = HR_ZONES[hrZone - 1];
    // ⚠️ EN LIBRE, C'EST L'ATHLÈTE QUI DONNE LA FOURCHETTE : ni zone, ni théorie.
    const fcMax = refsFc.max ?? 0; // non nul ici : sans FC max, on est passé en libre plus haut
    hrLoRef.current = libre ? Math.min(fcLo, fcHi) : cible ? cible.lo : Math.round(fcMax * z.lo);
    hrHiRef.current = libre ? Math.max(fcLo, fcHi) : cible ? cible.hi : Math.round(fcMax * z.hi);
    setPhase("running");
    wantLockRef.current = true; requestWakeLock();
    speak(libre
      ? tg("sp.hrStartLibre", { lo: hrLoRef.current, hi: hrHiRef.current })
      : tg("sp.hrStart", { m: durationMin, z: zn(hrZone), lo: hrLoRef.current, hi: hrHiRef.current }));

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
      if (!libreRef.current && el >= total) finishHrSession(); // en libre, aucune fin automatique
    }, 1000);
  }

  function finishHrSession() {
    desarmerVeille(); arreterPartage();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
    intervalRef.current = null; watchIdRef.current = null;
    releaseWakeLock();
    const avg = hrNRef.current > 0 ? Math.round(hrSumRef.current / hrNRef.current) : null;
    speak(libreRef.current
      ? tg("sp.arret", { t: formatTime(elapsedRef.current) })
      : tg("sp.hrFinish", { m: durationMin, z: zn(hrZone), avg: avg ? tg("sp.hrFinishAvg", { a: avg }) : "" }));
    setPhase("finished");
    if (modeRef.current === "live") saveRun(elapsedRef.current); // vraie sortie GPS → historique
  }

  function startSession() {
    sessionKindRef.current = "pace"; setSessionKind("pace");
    libreRef.current = libre; dernierKmDitRef.current = 0;
    const cps = buildCheckpoints();
    cpsRef.current = cps;
    setCheckpoints(cps);
    elapsedRef.current = 0; kmRef.current = 0; pausedRef.current = false; lastPosRef.current = null;
    trackRef.current = [];
    demarreeARef.current = Date.now(); derniereSauvegardeRef.current = 0; setTraceCarte([]);
    effacerEnCours(typeof localStorage !== "undefined" ? localStorage : null);
    setElapsed(0); setCurrentKm(0); setCurrentPace(0); setPredictedFinish(0); setPaused(false);
    setPhase("running");
    wantLockRef.current = true; requestWakeLock(); // garde l'écran allumé pendant la course
    // ⚠️ ARMÉE ICI, DEPUIS LE CLIC : sur iPhone, la permission des capteurs de mouvement
    // ne peut être demandée que dans un geste de l'utilisateur. Au montage de la page,
    // l'appel est refusé sans explication.
    void armerVeille();
    const idp = demarrerPartage();
    // ⚠️ PROPOSÉ MÊME SANS CONTACT ENREGISTRÉ : le lien se copie et s'envoie par le moyen
    // qu'on veut (message, WhatsApp…). Le réserver aux comptes ayant rempli le contact
    // d'urgence, c'était priver du partage ceux qui en ont le plus besoin — ceux qui
    // n'ont rien configuré.
    if (typeof window !== "undefined") setDepartPret(lienSuivi(window.location.origin, idp));
    speak(libre ? tg("sp.startLibre", { p: formatPace(paceLibre) }) : tg("sp.start", { t: formatTime(targetTime), p: formatPace(targetPace) }));

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

  /**
   * LE BOUTON ROUGE « ARRÊTER ».
   *
   * ⚠️ IL N'ENREGISTRAIT RIEN. `finishSession` (distance visée atteinte) appelait bien
   * `saveRun` ; `stopSession`, lui, coupait le GPS et remettait l'écran à zéro. Arrêter
   * après 8 km vidait donc l'écran sans un mot. La copie de secours restait dans le
   * téléphone, si bien que la course réapparaissait en « course non terminée retrouvée »
   * — mais seulement au PROCHAIN chargement de la page.
   *
   * Arrêter termine désormais la séance comme l'arrivée : on enregistre ce qui a été
   * couru. `saveRun` écarte de lui-même les faux départs (moins de 100 m ou de 30 s).
   */
  function arreterSession() {
    desarmerVeille(); arreterPartage();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
    intervalRef.current = null; watchIdRef.current = null;
    releaseWakeLock();
    disconnectHrSensor();
    const fin = elapsedRef.current;
    speak(tg("sp.arret", { t: formatTime(fin) }));
    setPhase("finished");
    if (modeRef.current === "live") saveRun(fin);
  }

  /** Repartir de zéro depuis l'écran d'arrivée — n'enregistre rien, tout l'est déjà. */
  function nouvelleSession() {
    desarmerVeille(); arreterPartage();
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
      // ⚠️ LE JOUR DE L'ATHLÈTE, PAS LE JOUR UTC : un défi créé à 00 h 30 était daté
      // de la veille, donc affiché comme déjà passé.
      const today = jourCivil(new Date(), fuseau); // défi perso = pour aujourd'hui
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
    // La carte s'ouvre sur la position de l'athlète, avant même de démarrer (comme Strava).
    demanderPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ⚠️ UN REFUS DE LOCALISATION NE DOIT PAS ÊTRE SILENCIEUX. Il l'était : la carte
   * restait sur son cadrage et l'athlète n'avait aucun moyen de comprendre pourquoi il
   * ne se voyait pas dessus, ni de revenir en arrière. On le dit, et on propose de
   * redemander — le navigateur reposera la question tant que le refus n'est pas définitif.
   */
  /**
   * LE PLEIN ÉCRAN DE LA CARTE.
   *
   * ⚠️ L'API `requestFullscreen` N'EXISTE PAS SUR IPHONE pour autre chose qu'une vidéo :
   * Safari iOS ne la propose que sur `<video>`. Un bouton qui ne reposerait que sur elle
   * ne ferait donc RIEN sur la moitié des téléphones, sans erreur — exactement le genre de
   * promesse creuse qu'on retire de cette application depuis deux jours.
   *
   * Le mécanisme est donc une couverture CSS (`fixed inset-0`), qui marche partout et à
   * l'identique ; l'API n'est appelée qu'EN PLUS, quand elle existe, pour masquer aussi la
   * barre du navigateur. Si elle échoue ou n'existe pas, la couverture suffit.
   */
  function basculerPlein() {
    const suivant = !plein;
    pleinAuto.current = false;
    setPlein(suivant);
    if (typeof document === "undefined") return;
    if (suivant) void sectionCarte.current?.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
  }

  /**
   * ── SUR TÉLÉPHONE, L'ÉCRAN S'OUVRE EN GRAND (Cyprien, 27/11/2026) ──────────
   * « Mets-le en grand écran directement, comme sur Strava. » Sous 768 px, la carte
   * couvre tout l'écran dès l'arrivée (couverture CSS seulement : l'API plein écran
   * exige un geste et n'existe pas sur iPhone). Le bouton « réduire » ou « Réglages »
   * rend la page, avec les séances du coach dessous.
   *
   * ⚠️ AU DÉPART DE LA COURSE, LA PAGE REVIENT. Le lien de suivi à envoyer au contact
   * et la limite de la veille de choc s'affichent HORS de la carte : sous une couverture
   * plein écran, l'athlète partirait sans les voir. Seul le grand écran que NOUS avons
   * ouvert se referme ; celui qu'il a demandé lui-même reste.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia?.("(max-width: 767px)").matches) return;
    pleinAuto.current = true;
    setPlein(true);
  }, []);
  // ⚠️ LE DÉPART N'OUVRE PLUS LA PAGE (27/11/2026) : il ouvre la vue CHIFFRES, dans la
  // couverture, comme Strava. Le lien de suivi et la limite de la veille de choc, qui
  // obligeaient à sortir du grand écran, sont désormais DANS la couverture (`alertesSecurite`).
  useEffect(() => {
    setVue(phase === "setup" ? "carte" : "chiffres");
    setCalquesOuverts(false);
  }, [phase]);

  // « Signal GPS trouvé » : dit une fois, à la PREMIÈRE position, puis le titre revient.
  useEffect(() => {
    if (!positionCarte || avaitPosition.current) return;
    avaitPosition.current = true;
    setGpsTrouve(true);
    const t = setTimeout(() => setGpsTrouve(false), 4000);
    return () => clearTimeout(t);
  }, [positionCarte]);

  // Échap sort du grand écran, et sortir du plein écran natif (Échap du navigateur)
  // referme la couverture : les deux doivent rester d'accord.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape" && plein) { setPlein(false); if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {}); } };
    const surPlein = () => { if (!document.fullscreenElement && plein) setPlein(false); };
    window.addEventListener("keydown", surTouche);
    document.addEventListener("fullscreenchange", surPlein);
    return () => { window.removeEventListener("keydown", surTouche); document.removeEventListener("fullscreenchange", surPlein); };
  }, [plein]);

  function demanderPosition() {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoRefusee(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPositionCarte([pos.coords.latitude, pos.coords.longitude]); setGeoRefusee(false); },
      () => setGeoRefusee(true),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  useEffect(() => {
    const c = lireEnCours(typeof localStorage !== "undefined" ? localStorage : null);
    if (c && vautEnregistrement(c)) setCourseRetrouvee(c);
    else if (c) effacerEnCours(localStorage);
  }, []);

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

  const vma = vmaEff;
  // ⚠️ C'ÉTAIT `baseline?.max_hr ?? 190`. La table `performance_baselines` n'est
  // renseignée que si l'athlète a passé un test : chez la plupart, elle est VIDE, et
  // toutes les zones se calculaient donc sur un 190 générique. Sur un compte réel
  // (FC max mesurée 212, repos 63, seuil 192), les cibles étaient décalées de ~20 bpm
  // vers le bas — l'athlète courait trop facile en croyant suivre la consigne.
  const gm = (profile as unknown as { garmin_metrics?: { lthr?: number; restingHR?: number; maxHR?: number } } | null)?.garmin_metrics;
  const refsFc = referencesFc({
    // LA MÊME FC MAX que le coach, Jour J et le bilan (`maxDeReference`, 12/11/2026) : le test,
    // sinon celle déclarée à l'inscription, sinon celle de la montre — et plus jamais l'âge.
    maxDeclaree: maxDeReference(baseline?.max_hr ?? (profile as unknown as { max_hr?: number } | null)?.max_hr, gm?.maxHR),
    maxObservee: fcMaxObservee,
    repos: (profile as unknown as { resting_hr?: number } | null)?.resting_hr ?? gm?.restingHR,
    // 12/11/2026 : la MÊME source de seuil que le coach (test, puis montre).
    seuil: seuilMesure((baseline as unknown as { lt_hr?: number } | null)?.lt_hr, gm?.lthr),
  });
  // ⚠️ PLUS DE 190 INVENTÉ (07/11/2026). `refsFc.max ?? 190` affichait des zones en bpm
  // calculées sur une FC max que personne n'a mesurée — exactement la valeur par défaut
  // présentée comme une mesure que la règle du projet interdit. Sans FC max (ni mesurée, ni
  // déclarée, ni seuil, ni âge), les zones n'ont PAS de chiffre, et la séance cardiaque
  // passe en mode libre : c'est l'athlète qui donne sa fourchette.
  const maxHr: number | null = refsFc.max;
  const bpmZone = (z: { lo: number; hi: number }) => (maxHr != null ? `${Math.round(maxHr * z.lo)}–${Math.round(maxHr * z.hi)}` : "—");
  // Zones d'allure = bandes de %VMA → fourchette d'allure (rapide → lent) + icône/teinte.
  const zoneBands = [
    { label: d["hz.1"], lo: 0.50, hi: 0.60, tint: "#0ea5e9", Icon: Heart },
    { label: d["ep.2"], lo: 0.60, hi: 0.75, tint: "#10b981", Icon: Activity },
    { label: d["hz.3"], lo: 0.75, hi: 0.85, tint: "#f59e0b", Icon: Gauge },
    { label: d["hz.4"], lo: 0.85, hi: 0.92, tint: "#f97316", Icon: TrendingUp },
    { label: "VMA", lo: 0.92, hi: 1.00, tint: "#ef4444", Icon: Zap },
  ].map((z) => ({ ...z, paceSlow: 60 / (vma * z.lo), paceFast: 60 / (vma * z.hi) }));

  /** La zone où tombe une allure, d'après SA VMA. Un fait, pas un conseil. */
  const zoneDeLAllure = (p: number) => {
    const b = zoneBands.find((z) => p <= z.paceSlow && p >= z.paceFast);
    if (b) return b.label;
    return p > zoneBands[0].paceSlow ? zoneBands[0].label : zoneBands[zoneBands.length - 1].label;
  };

  // ── LE BLOC DE CHIFFRES POSÉ SUR LA CARTE (façon Strava) ────────────────────
  // Avant le départ il montre ce qu'on s'apprête à faire ; pendant la course, ce qu'on
  // fait. TROIS COLONNES, jamais plus : au-delà, plus rien ne se lit en courant.
  const dureeTotale = durationMin * 60;
  const chiffresCarte: { l: string; v: string; u?: string }[] =
    phase === "setup" && libre
      ? targetMode === "hr"
        ? [
            { l: d["sm.target"], v: `${Math.min(fcLo, fcHi)}–${Math.max(fcLo, fcHi)}`, u: "bpm" },
            { l: d["lb.dur"], v: d["libre.valeur"] },
          ]
        : [
            { l: d["lb.pace"], v: formatPace(paceLibre), u: "/km" },
            { l: d["lb.dist"], v: d["libre.valeur"] },
          ]
      : phase === "setup"
      ? targetMode === "hr"
        ? [
            { l: d["lb.dur"], v: String(durationMin), u: "min" },
            { l: d["sm.hrZone"], v: zn(hrZone) },
            { l: d["sm.target"], v: bpmZone(HR_ZONES[hrZone - 1]), u: maxHr != null ? "bpm" : "" },
          ]
        : [
            { l: d["lb.time"], v: formatTime(targetTime) },
            { l: d["lb.dist"], v: String(distance), u: "km" },
            { l: d["lb.pace"], v: formatPace(targetPace), u: "/km" },
          ]
      : sessionKind === "hr"
        ? [
            { l: d["lv.time"], v: formatTime(elapsed) },
            { l: d["lv.left"], v: formatTime(Math.max(0, dureeTotale - elapsed)) },
            { l: d["map.fc"], v: liveHr != null ? String(liveHr) : "—", u: "bpm" },
          ]
        : [
            { l: d["lv.time"], v: formatTime(elapsed) },
            { l: d["lb.dist"], v: currentKm.toFixed(2), u: "km" },
            { l: d["lv.curPace"], v: currentPace > 0 ? formatPace(currentPace) : "—", u: "/km" },
          ];
  const titreCarte = seanceChargee
    ?? (phase === "setup"
      ? `${targetMode === "hr" ? d["md.hr"] : d["md.pace"]}${libre ? ` · ${d["md.libre"]}` : ""}`
      : d["hero"]);

  // ⚠️ DÉFINIES UNE FOIS, RENDUES À DEUX ENDROITS. Leur place change avec l'écran (en
  // ligne au-dessus du bloc sur téléphone, en colonne sur la carte sur ordinateur) mais
  // leur comportement, non : dupliquer le JSX, c'est dupliquer l'état qu'il commande.
  // ── LES BOUTONS RONDS DE LA CARTE, EN COLONNE À DROITE (comme Strava) ────────
  // Au-dessus du bloc de chiffres, au pouce. ⚠️ DÉFINIS UNE FOIS : la colonne est la même
  // sur téléphone et sur ordinateur (Cyprien, 27/11/2026 : « pareil sur ordinateur »).
  // ── LES MODÈLES PROPOSÉS ICI : selon la clé et le PAYS où l'on se trouve ──────────
  // Arrondi au dixième de degré : on ne recalcule pas la liste à chaque point GPS.
  const centreModeles = positionCarte ?? centreInitial;
  const cleCentre = centreModeles ? `${centreModeles[0].toFixed(1)},${centreModeles[1].toFixed(1)}` : "";
  const fondsDispo = useMemo(() => fondsDisponibles(CLE_MAPTILER, centreModeles), [cleCentre]); // eslint-disable-line react-hooks/exhaustive-deps
  const calquesDispo = useMemo(() => calquesDisponibles(CLE_MAPTILER, centreModeles), [cleCentre]); // eslint-disable-line react-hooks/exhaustive-deps
  // Un fond qui n'existe plus ici (on a changé de pays) retombe sur Pacevo, jamais sur du vide.
  const fondChoisi: FondCarte = fondsDispo.find((f) => f.id === fondCarte) ?? fondsDispo[0];
  const calquesAllumes: CalqueCarte[] = calquesDispo.filter((c) => calquesActifs.includes(c.id));
  const sortiesRecentes = useMemo(() => sortiesDepuis(mesParcours, jourCivil(new Date(Date.now() - 30 * 86400000), fuseau)), [mesParcours, fuseau]);
  const sortiesSemaine = useMemo(() => sortiesDepuis(mesParcours, jourCivil(new Date(Date.now() - 7 * 86400000), fuseau)), [mesParcours, fuseau]);
  const tracesAffichees = useMemo(() => (modeSorties === "recents" ? sortiesRecentes : modeSorties === "semaine" ? sortiesSemaine : mesParcours).map((p) => p.trace), [modeSorties, sortiesRecentes, sortiesSemaine, mesParcours]);
  /** Ce qui est allumé en plus du plan : la pastille du bouton des calques, comme Strava. */
  const nbCalques = calquesAllumes.filter((c) => c.id !== "poi").length + (modeSorties !== "aucune" && mesParcours.length ? 1 : 0) + (relief3d ? 1 : 0);
  const coinVignette = centreModeles ?? [48.8566, 2.3522];
  // Fonds : la VRAIE tuile du quartier (le dégradé dessous si elle ne répond pas).
  // Calques : une petite carte DESSINÉE — la tuile d'un calque est vide là où il n'y a
  // rien (VTT, vélo à Rouen), et la vignette n'aurait rien montré (27/11/2026).
  const vignetteFond = (f: FondCarte) => {
    if (f.type === "vecteur") return vignetteDessinee(f.id);
    const img = `url("${tuileDe(f.urls![0], coinVignette[0], coinVignette[1], 14)}") center/cover`;
    return f.place === "sous-routes" ? `${VIGNETTE_RUES}, ${img}, ${VIGNETTE_PLAN}` : `${img}, ${VIGNETTE_PLAN}`;
  };
  const vignetteCalque = (c: CalqueCarte) => vignetteDessinee(c.id === "pentes-fr" ? "pentes" : c.id === "courbes-fr" ? "courbes" : c.id);

  const commandesCarte = (
    <>
      <BtnCarte actif={calquesOuverts} titre={d["map.calques"]} onClick={() => setCalquesOuverts((o) => !o)}>
        <Layers className="h-5 w-5" />
        {nbCalques > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{nbCalques}</span>
        )}
      </BtnCarte>
      {RELIEF_DISPO && (
        <BtnCarte actif={relief3d} titre={d["map.3d"]} onClick={() => setRelief3d((r) => !r)}>
          <span className="text-[15px] font-bold">3D</span>
        </BtnCarte>
      )}
      {/* Allumé = la carte reste collée à la position. Éteint = la main a pris la carte,
          et c'est ce bouton qui rend le suivi. */}
      <BtnCarte
        actif={suiviCarte}
        titre={d["map.recentrer"]}
        onClick={() => { setSuiviCarte(true); setRecentrages((n) => n + 1); }}
      >
        <LocateFixed className="h-5 w-5" />
      </BtnCarte>
      <BtnCarte actif={audioEnabled} titre={d["ch.voice"]} onClick={() => setAudioEnabled(!audioEnabled)}>
        {audioEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </BtnCarte>
      {/* Hors grand écran seulement : dedans, c'est la flèche ⌄ en haut à gauche qui en sort. */}
      {!plein && (
        <BtnCarte titre={d["map.plein"]} onClick={basculerPlein}>
          <Maximize2 className="h-5 w-5" />
        </BtnCarte>
      )}
    </>
  );

  // Le statut GPS, dans l'entête du bloc de chiffres avant le départ (comme Strava).
  const statutGps: "ok" | "cherche" | null = phase !== "setup" ? null
    : gpsTrouve ? "ok"
    : !positionCarte && !geoRefusee ? "cherche"
    : null;

  /**
   * ⚠️ LA SÉCURITÉ RESTE À L'ÉCRAN, DANS LA COUVERTURE. Le lien de suivi à envoyer au
   * contact et la limite de la veille de choc vivaient sous la carte : en grand écran,
   * l'athlète partait sans les voir. Ils sont posés ici, dans les DEUX vues.
   *
   * ⚠️ SUR LA CARTE, LE LIEN DE SUIVI SEULEMENT (Cyprien, 27/11/2026 : « enlève l'encadré
   * blanc »). Le texte de la veille couvrait le haut de la carte pendant toute la course.
   * Il reste en entier — promesse ET limite, jamais repliées — dans la vue chiffres, celle
   * qui s'ouvre au départ : l'athlète le lit en partant.
   */
  const alertesSecurite = (avecVeille: boolean) => (departPret || (avecVeille && (veilleActive || capteursIndispo) && phase === "running")) ? (
    <div className="space-y-2">
      {/* Le lien de suivi, proposé au départ — un geste, puis il disparaît. */}
      {departPret && (
        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-snug text-blue-900">{d["veille.partage"]}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button type="button"
                onClick={() => { prevenirContact(messageDepart(prenom, departPret, { depart: tg("veille.depart", { nom: prenom ?? "" }), suivi: d["veille.suivi"] })); setDepartPret(null); }}
                className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
                {contactNom ? tg("veille.prevenir", { nom: contactNom }) : d["veille.partage"]}
              </button>
              <button type="button"
                onClick={() => { navigator.clipboard?.writeText(departPret).then(() => toast.success(d["veille.partageCopie"]), () => toast.error(d["veille.partageCopie"])); setDepartPret(null); }}
                className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {d["veille.copier"]}
              </button>
            </div>
          </div>
          <button type="button" onClick={() => setDepartPret(null)} aria-label={d["t.recoverDrop"]} className="rounded-full p-1 text-blue-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* L'état de la veille, dit sans emphase — et sa LIMITE, dans le même regard.
          ⚠️ « Veille active » est une promesse ; la phrase qui la borne ne doit pas être
          repliée dessous : quelqu'un qui part en montagne en se croyant surveillé. */}
      {avecVeille && (veilleActive || capteursIndispo) && phase === "running" && (
        <div className="rounded-2xl border border-zinc-100 bg-white/95 px-4 py-2 shadow-sm">
          <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-500">
            <ShieldCheck className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${veilleActive ? "text-emerald-600" : "text-zinc-300"}`} aria-hidden />
            <p>
              <b className="font-semibold text-zinc-700">{veilleActive ? d["veille.active"] : d["veille.titre"]} — </b>
              {capteursIndispo ? d["veille.indispo"] : d["veille.limite"]}
            </p>
          </div>
        </div>
      )}
    </div>
  ) : null;

  /** Le statut du GPS et du capteur cardiaque pendant la course — et le bouton qui le relie. */
  const pastillesCourse = phase === "running" ? (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
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
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-white transition-colors hover:bg-emerald-500">
            <Bluetooth className="h-3 w-3" /> {d["st.hrBtn"]}
          </button>
        )
      )}
    </div>
  ) : null;

  /**
   * LES BOUTONS DE COURSE, COMME STRAVA : en course, une seule grande « Pause » ; en
   * pause, « Reprendre » et « Terminer ». ⚠️ ARRÊTER DEMANDE DEUX GESTES (pause, puis
   * terminer) : un appui malheureux sur un bouton rouge en courant ne coupe plus la séance.
   */
  const boutonsCourse = phase === "running" ? (
    paused ? (
      <div className="mx-auto flex w-full max-w-md gap-3">
        <button type="button" onClick={pauseSession} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 text-[16px] font-semibold text-white active:scale-[0.98]">
          <Play className="h-5 w-5" fill="currentColor" /> {d["ct.resume"]}
        </button>
        <button type="button" onClick={arreterSession} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-zinc-900 text-[16px] font-semibold text-white active:scale-[0.98]">
          <Flag className="h-5 w-5" /> {d["ct.terminer"]}
        </button>
      </div>
    ) : (
      <button type="button" onClick={pauseSession} className="mx-auto flex h-14 w-full max-w-md items-center justify-center gap-2 rounded-full bg-emerald-600 text-[16px] font-semibold text-white active:scale-[0.98]">
        <Pause className="h-5 w-5" fill="currentColor" /> {d["ct.pause"]}
      </button>
    )
  ) : (
    <button type="button" onClick={nouvelleSession} className="mx-auto flex h-14 w-full max-w-md items-center justify-center rounded-full bg-zinc-900 text-[16px] font-semibold text-white">
      {d["ct.new"]}
    </button>
  );

  // ── LA VUE CHIFFRES : ce qu'on lit en courant ───────────────────────────────
  const libreCourse = libreRef.current;
  const ahead = paceDeltaSec < 0;
  const accentAllure = phase === "finished" ? "#18181b" : currentPace <= 0 || libreCourse ? "#18181b" : onPace ? "#0369a1" : ahead ? "#047857" : "#c2410c";
  const hrLo = hrLoRef.current, hrHi = hrHiRef.current;
  const dansLaZone = liveHr != null && liveHr >= hrLo && liveHr <= hrHi;
  const accentFc = phase === "finished" ? "#18181b" : liveHr == null ? "#0369a1" : dansLaZone ? "#047857" : liveHr > hrHi ? "#e11d48" : "#0369a1";
  const dureeHr = durationMin * 60;
  const fcMoy = hrNRef.current > 0 ? Math.round(hrSumRef.current / hrNRef.current) : null;
  const chiffreGeant = "text-[84px] font-extrabold leading-none tracking-tight tabular-nums md:text-[112px]";
  const chiffreMoyen = "text-[40px] font-bold leading-none tabular-nums md:text-[48px]";
  const legende = "mt-1.5 text-[13px] font-semibold text-zinc-500";

  const contenuChiffres = sessionKind === "hr" ? (
    <>
      <div>
        <div className={chiffreGeant} style={{ color: accentFc }}>{liveHr != null ? liveHr : "—"}</div>
        <div className={legende}>{d["md.hr"]} (bpm)</div>
        {phase === "running" && (
          <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-zinc-50 px-4 py-1.5 text-[13px] font-semibold" style={{ color: accentFc }}>
            <span className="opacity-70">{tg("lv.target", { z: zn(hrZone), lo: hrLo, hi: hrHi })}</span>
            {liveHr != null && (<><span className="opacity-30">·</span>{dansLaZone ? <span>{d["lv.inZone"]}</span> : liveHr > hrHi ? <span>{d["lv.tooHigh"]}</span> : <span>{d["lv.tooLow"]}</span>}</>)}
          </div>
        )}
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-6">
        <div>
          <div className={chiffreMoyen}>{formatTime(Math.max(0, dureeHr - elapsed))}</div>
          <div className={legende}>{d["lv.left"]}</div>
        </div>
        <div>
          <div className={chiffreMoyen}>{gpsStatus === "live" ? currentKm.toFixed(2) : fcMoy ?? "—"}</div>
          <div className={legende}>{gpsStatus === "live" ? `${d["lb.dist"]} (km)` : `${d["lv.avgHr"]} (bpm)`}</div>
        </div>
      </div>
      <div className="w-full max-w-md">
        <div className="relative h-2 overflow-hidden rounded-full bg-zinc-100">
          <div className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, (elapsed / dureeHr) * 100)}%`, background: accentFc }} />
        </div>
      </div>
    </>
  ) : (
    <>
      <div>
        <div className={`${chiffreGeant} text-zinc-900`}>{currentKm.toFixed(2)}</div>
        <div className={legende}>{d["lb.dist"]} (km)</div>
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-6">
        <div>
          <div className={chiffreMoyen} style={{ color: accentAllure }}>{currentPace > 0 ? formatPace(currentPace) : "—"}</div>
          <div className={legende}>{d["lv.curPace"]} (/km)</div>
        </div>
        {/* En libre, rien n'est visé : l'allure moyenne, qui se mesure, au lieu d'une cible. */}
        {libreCourse ? (
          <div>
            <div className={chiffreMoyen}>{currentKm > 0.05 ? formatPace(elapsed / 60 / currentKm) : "—"}</div>
            <div className={legende}>{d["lv.avgPace"]} (/km)</div>
          </div>
        ) : (
          <div>
            <div className={chiffreMoyen}>{formatPace(targetPace)}</div>
            <div className={legende}>{d["lb.pace"]} (/km)</div>
          </div>
        )}
      </div>
      {phase === "running" && !libreCourse && currentPace > 0 && (
        <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-zinc-50 px-4 py-1.5 text-[13px] font-semibold" style={{ color: accentAllure }}>
          {onPace ? <span>{d["lv.onPace"]}</span> : ahead ? <span>{tg("lv.faster", { s: Math.abs(paceDeltaSec) })}</span> : <span>{tg("lv.slower", { s: paceDeltaSec })}</span>}
          {Math.abs(timeDelta) > 3 && (<><span className="opacity-30">·</span><span>{isAhead ? tg("lv.aheadGoal", { t: formatTime(Math.abs(timeDelta)) }) : tg("lv.behindGoal", { t: formatTime(Math.abs(timeDelta)) })}</span></>)}
        </div>
      )}
      {/* ⚠️ PAS DE « FIN PRÉVUE » SANS DISTANCE VISÉE : ce serait un chiffre inventé. */}
      {!libreCourse && (
        <div className="w-full max-w-md">
          <div className="flex items-baseline justify-between text-[13px] font-semibold text-zinc-500">
            <span>{d["lv.eta"]}</span>
            <span className="text-[18px] font-bold tabular-nums" style={{ color: isAhead ? "#047857" : isBehind ? "#c2410c" : "#0369a1" }}>{formatTime(predictedFinish)}</span>
          </div>
          <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="absolute left-0 top-0 h-full rounded-full bg-emerald-600 transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-medium text-zinc-400"><span>0 km</span><span>{distance} km</span></div>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {/* ⚠️ SUR TÉLÉPHONE, LA CARTE D'ABORD — comme Strava (Cyprien, 21/09/2026) : la
          position en direct, puis le tracé pendant la course ; les réglages existants
          suivent en dessous. Le bouton audio passe sur la carte. */}
      {/* ══ LE CHOC DÉTECTÉ — la seule chose qui passe devant tout le reste ══════════
          Plein écran, gros boutons, compte à rebours : si quelqu'un est au sol, il ne
          cherche pas un bouton de 28 px. Et si personne ne répond, Pacevo n'appelle
          PAS à sa place : il ouvre le message au contact, prêt à partir. */}
      {chocDetecte && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-6 bg-red-600 px-6 text-center text-white" role="alertdialog" aria-live="assertive">
          <AlertTriangle className="h-16 w-16" aria-hidden />
          <p className="text-2xl font-semibold leading-tight">{d["veille.choc"]}</p>
          <p className="text-lg font-semibold tabular-nums">{tg("veille.rebours", { n: rebours })}</p>
          <button type="button" onClick={jeVaisBien}
            className="w-full max-w-xs rounded-2xl bg-white px-6 py-5 text-lg font-semibold text-red-700 shadow-lg">
            {d["veille.jeVaisBien"]}
          </button>
          {contact.tel.trim() && (
            <button type="button"
              onClick={() => prevenirContact(messageAlerte(prenom, lienPartage, lastPosRef.current ? { lat: lastPosRef.current.lat, lng: lastPosRef.current.lng } : null, {
                alerte: tg("veille.alerte", { nom: prenom ?? "" }), position: d["veille.position"], suivi: d["veille.suivi"], secours: d["veille.secours"],
              }))}
              className="w-full max-w-xs rounded-2xl border-2 border-white/70 px-6 py-4 text-base font-semibold">
              {tg("veille.prevenir", { nom: contactNom ?? "" })}
            </button>
          )}
        </div>
      )}

      {/* ══ L'ÉCRAN S'OUVRE SUR LA CARTE — COMME STRAVA ═══════════════════════════
          Cyprien, 22/09/2026 puis 23/09 : « fais comme sur Strava ça rend », et devant son
          ordinateur, capture à l'appui : « ça rend pas ». Les deux sont vrais, parce que
          Strava n'a pas d'écran d'enregistrement sur ordinateur — il fallait l'adapter,
          pas l'étirer.

            · TÉLÉPHONE : la carte prend l'écran, les commandes et le bloc blanc flottent
              en bas, pleine largeur. C'est la composition de Strava.
            · ORDINATEUR : la carte est plus courte, le bloc blanc s'ancre EN BAS À GAUCHE
              à largeur fixe, et les commandes remontent en colonne en haut à droite. Un
              bloc de 512 px centré au milieu de 1 200 px de carte flottait dans le vide.

          ⚠️ ET SURTOUT, LE CONTENU DE LA CARTE. Elle s'ouvrait sur la France entière au
          zoom 5 tant que la localisation n'était pas accordée : un rectangle bleu qui ne
          dit rien de personne. `centreInitial` la cadre sur la dernière trace connue de
          l'athlète, et un refus de localisation se DIT au lieu de laisser deviner. */}
      <section
        ref={sectionCarte}
        // ⚠️ `margin: 0` EN STYLE, PAS EN CLASSE. La pile parente est en `space-y-6`, dont
        // la règle `> * + *` l'emporte en spécificité sur un `mt-0` : la couverture
        // `fixed inset-0` héritait d'une marge haute de 24 px et s'arrêtait 24 px avant le
        // bas de l'écran. Mesuré : carte de 788 px dans une fenêtre de 812.
        style={plein ? { margin: 0 } : undefined}
        // ⚠️ MÊME COMPOSITION SUR TÉLÉPHONE ET SUR ORDINATEUR (Cyprien, 27/11/2026 :
        // « pareil sur ordinateur ») : carte, bloc de chiffres, tiroir du bas. Seule la
        // hauteur change — l'écran entier en grand, la fenêtre moins l'entête sinon.
        className={plein
          ? "fixed inset-0 z-[2000] overflow-hidden bg-white"
          : "relative -mx-3 -mt-3 h-[calc(100dvh-8.5rem)] min-h-[560px] overflow-hidden md:mx-0 md:mt-0 md:rounded-2xl md:border md:border-zinc-200"}
      >
        <CarteDirect
          position={positionCarte}
          track={traceCarte}
          centre={centreInitial}
          fond={fondChoisi}
          calques={calquesAllumes}
          suivre={suiviCarte}
          onDeplacement={() => setSuiviCarte(false)}
          recentrer={recentrages}
          etiquette={d["hero"]}
          parcours={tracesAffichees}
          voirParcours={modeSorties !== "aucune"}
          relief={relief3d}
          className="h-full w-full"
        />

        {/* En grand écran, la flèche ⌄ en haut à gauche en sort — comme Strava. */}
        {plein && vue === "carte" && (
          <button type="button" onClick={basculerPlein} aria-label={d["map.fermer"]} title={d["map.fermer"]}
            className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[600] flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-zinc-700 shadow-[0_8px_18px_-8px_rgba(9,9,11,0.6)] ring-1 ring-black/5">
            <ChevronDown className="h-6 w-6" />
          </button>
        )}

        {/* Le lien de suivi à envoyer, en haut de la carte — un geste, puis il disparaît. */}
        {vue === "carte" && departPret && (
          <div className={`absolute inset-x-3 z-[600] mx-auto max-w-md ${plein ? "top-[4.25rem]" : "top-3"}`}>{alertesSecurite(false)}</div>
        )}

        {/* Le bas de la carte. ⚠️ IL EST HORS DE LA CARTE dans le DOM, posé dessus : à
            l'intérieur, la carte capterait le doigt et un appui sur « Démarrer » la
            déplacerait.
            ⚠️ ET SEULS LES ÉLÉMENTS VISIBLES PRENNENT LE DOIGT (27/11/2026, « le dézoom ne
            fonctionne toujours pas »). Ce bloc était `pointer-events-auto` sur toute la
            largeur : la bande TRANSPARENTE qui porte la colonne de boutons ronds — 200 px
            de haut, d'un bord à l'autre — avalait les doigts. Un pincement dont un doigt y
            tombait n'atteignait jamais la carte. Les enveloppes sont donc
            `pointer-events-none`, et seuls les boutons, l'avertissement GPS, le bloc de
            chiffres et le tiroir reprennent le doigt. */}
        {vue === "carte" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex flex-col">
            <div className="pointer-events-none mx-auto w-full max-w-md px-3">
              <div className="mb-2.5 flex flex-col items-end gap-2">{commandesCarte}</div>
              {/* ⚠️ UN REFUS DE LOCALISATION SE DIT. Sans cette ligne, la carte reste sur son
                  cadrage et l'athlète ne comprend ni pourquoi il ne se voit pas dessus, ni
                  comment revenir en arrière. */}
              {geoRefusee && (
                <div className="pointer-events-auto mb-2.5 flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5 text-[12px] font-semibold text-white">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                  <span className="truncate">{d["map.geoOff"]}</span>
                  <button type="button" onClick={demanderPosition} className="ml-1 flex-shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-900">
                    {d["map.geoBtn"]}
                  </button>
                </div>
              )}
              {/* Le bloc de chiffres : ce qu'on va faire, ou ce qu'on fait. Le chiffre du
                  milieu en plus grand, comme Strava. */}
              <div className="pointer-events-auto mb-3 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_18px_40px_-18px_rgba(9,9,11,0.55)]">
                <div className={`relative flex h-9 items-center justify-center px-11 text-[13px] font-semibold transition-colors ${statutGps === "ok" ? "bg-emerald-50 text-emerald-700" : statutGps === "cherche" ? "bg-amber-50 text-amber-700" : "text-zinc-700"}`}>
                  <span className="truncate">{statutGps === "ok" ? d["map.gpsOk"] : statutGps === "cherche" ? d["map.gpsCherche"] : titreCarte}</span>
                  {phase !== "setup" && (
                    <button type="button" onClick={() => setVue("chiffres")} aria-label={d["map.vueChiffres"]} title={d["map.vueChiffres"]}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100">
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {/* 2 colonnes en libre (rien d'imposé), 3 sinon. Classe dynamique impossible
                    avec Tailwind : la grille se donne en style. */}
                <div className="grid items-end px-3 pb-3 pt-1" style={{ gridTemplateColumns: `repeat(${chiffresCarte.length}, minmax(0, 1fr))` }}>
                  {chiffresCarte.map((c, i) => {
                    const central = chiffresCarte.length === 3 && i === 1;
                    return (
                      <div key={c.l} className="min-w-0 text-center">
                        <div className={`font-bold leading-none tabular-nums text-zinc-900 ${central ? "text-[34px]" : "text-[22px]"}`}>
                          {c.v}{c.u && <span className="ml-0.5 text-[11px] font-semibold text-zinc-400">{c.u}</span>}
                        </div>
                        <div className="mt-1 truncate text-[11px] font-semibold text-zinc-500 first-letter:uppercase">{c.l}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Le tiroir du bas, blanc, avec sa poignée — comme Strava. */}
            <div className="pointer-events-auto rounded-t-[28px] bg-white px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_-18px_rgba(9,9,11,0.45)]">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200" aria-hidden />
              {phase === "setup" ? (
                <div className="mx-auto flex max-w-md items-start justify-around">
                  <ActionCarte label={targetMode === "hr" ? d["md.hr"] : d["md.pace"]} coche onClick={() => setTargetMode(targetMode === "hr" ? "pace" : "hr")}>
                    {targetMode === "hr" ? <Heart className="h-6 w-6 text-rose-500" /> : <Zap className="h-6 w-6 text-emerald-600" />}
                  </ActionCarte>
                  <GrosBouton label={d["start"]} teinte="emerald" onClick={() => (targetMode === "hr" ? startHrSession() : startSession())}>
                    <Play className="h-8 w-8 translate-x-0.5" fill="currentColor" />
                  </GrosBouton>
                  <ActionCarte label={d["map.reglages"]} onClick={versDetails}>
                    <SlidersHorizontal className="h-6 w-6 text-zinc-600" />
                  </ActionCarte>
                </div>
              ) : boutonsCourse}
            </div>
          </div>
        )}

        {/* ══ LE TIROIR DES MODÈLES DE CARTE (27/11/2026) ════════════════════════════
            Cyprien, vidéo de Strava à l'appui : « autant de modèles, en mieux, sans copier-
            coller ». Les vignettes sont de VRAIES images du quartier de l'athlète (la tuile
            de chaque fond à sa position), pas des illustrations. */}
        {vue === "carte" && calquesOuverts && (
          <div className="absolute inset-x-0 bottom-0 z-[650] mx-auto max-h-[80%] max-w-xl overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_40px_-12px_rgba(9,9,11,0.5)]">
            {/* ⚠️ `z-10` : sans lui, les vignettes (positionnées) défilaient PAR-DESSUS le
                titre collé en haut — vu sur iPhone le 27/11/2026. */}
            <div className="sticky top-0 z-10 -mx-5 bg-white px-5 pb-2 pt-0.5">
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-zinc-200" aria-hidden />
              <div className="flex items-center justify-between">
                <p className="text-[18px] font-bold text-zinc-900">{d["map.panneau"]}</p>
                <button type="button" onClick={() => setCalquesOuverts(false)} aria-label={d["map.fermer"]} className="rounded-full p-1.5 text-zinc-700 hover:bg-zinc-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <p className="mt-2 text-[15px] font-bold text-zinc-900">{d["map.fond"]}</p>
            <div className="mt-2.5 grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
              {fondsDispo.map((f) => (
                <Vignette key={f.id} nom={d[f.cle] ?? f.id} actif={fondChoisi.id === f.id} onClick={() => setFondCarte(f.id)}
                  etiquette={f.couverture !== "monde" ? f.couverture.toUpperCase() : undefined}
                  fond={vignetteFond(f)} />
              ))}
            </div>

            <p className="mt-5 text-[15px] font-bold text-zinc-900">{d["map.secSorties"]}</p>
            <p className="mt-0.5 text-[12px] text-zinc-500">{mesParcours.length ? tg("map.mesParcoursAide", { n: mesParcours.length }) : d["map.mesParcoursVide"]}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([["toutes", d["s.toutes"], mesParcours.length], ["recents", d["s.recentes"], sortiesRecentes.length], ["semaine", d["s.semaine"], sortiesSemaine.length], ["aucune", d["s.aucune"], null]] as const).map(([id, nom, n]) => (
                <button key={id} type="button" onClick={() => setModeSorties(id)} aria-pressed={modeSorties === id} disabled={id !== "aucune" && !mesParcours.length}
                  className={`rounded-2xl border px-2 py-2.5 text-center text-[12.5px] font-semibold leading-tight transition disabled:opacity-50 ${modeSorties === id ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-zinc-200 text-zinc-700 hover:border-zinc-300"}`}>
                  {nom}
                  {n != null && <span className="mt-0.5 block text-[11px] font-medium text-zinc-500">{n}</span>}
                </button>
              ))}
            </div>

            {([["itineraires", d["map.secItineraires"]], ["relief", d["map.secRelief"]], ["affichage", d["map.secAffichage"]]] as const).map(([groupe, titre]) => {
              const liste = calquesDispo.filter((c) => c.groupe === groupe);
              const avec3d = groupe === "relief" && RELIEF_DISPO;
              if (!liste.length && !avec3d) return null;
              return (
                <div key={groupe}>
                  <p className="mt-5 text-[15px] font-bold text-zinc-900">{titre}</p>
                  {/* Les pentes de l'IGN ne sont dessinées qu'EN MONTAGNE : à Rouen la couche
                      est vide, et sans cette phrase on la croirait en panne. */}
                  {groupe === "relief" && liste.some((c) => c.id === "pentes-fr") && <p className="mt-0.5 text-[12px] text-zinc-500">{d["c.pentesAide"]}</p>}
                  <div className="mt-2.5 grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
                    {avec3d && (
                      <Vignette nom={d["map.3d"]} actif={relief3d} onClick={() => setRelief3d((r) => !r)} fond={vignetteDessinee("relief")}>
                        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-white/90 px-1 text-[11px] font-bold text-zinc-900">3D</span>
                      </Vignette>
                    )}
                    {liste.map((c) => (
                      <Vignette key={c.id} nom={d[c.cle] ?? c.id} actif={calquesActifs.includes(c.id)}
                        onClick={() => setCalquesActifs((a) => (a.includes(c.id) ? a.filter((x) => x !== c.id) : [...a, c.id]))}
                        etiquette={c.couverture !== "monde" ? c.couverture.toUpperCase() : undefined}
                        fond={vignetteCalque(c)}>
                        {c.id === "poi" && <MapPin className="h-6 w-6 text-rose-500" fill="#fecdd3" />}
                      </Vignette>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ LA VUE CHIFFRES — l'écran qu'on lit en courant (Strava) ══════════════
            Chrono en haut, distance géante, puis l'allure (ou la FC) et la cible. En
            pause, l'entête passe au JAUNE : on le voit de loin, la montre au poignet. */}
        {vue === "chiffres" && (
          <div className="absolute inset-0 z-[600] flex flex-col bg-white">
            <div className={`relative px-14 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] text-center transition-colors ${paused && phase === "running" ? "bg-amber-400" : "bg-white"}`}>
              {paused && phase === "running" && <div className="text-[13px] font-semibold text-zinc-900">{d["lv.enPause"]}</div>}
              <div className="text-[32px] font-bold leading-tight tabular-nums text-zinc-900">{formatTime(elapsed)}</div>
              <button type="button" onClick={() => setVue("carte")} aria-label={d["map.vueCarte"]} title={d["map.vueCarte"]}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-zinc-800 hover:bg-black/5">
                <Minimize2 className="h-5 w-5" />
              </button>
            </div>
            {(alertesSecurite(true) || pastillesCourse) && (
              <div className="mx-auto w-full max-w-md space-y-2 px-3 pt-1">{alertesSecurite(true)}{pastillesCourse}</div>
            )}
            <div className="flex flex-1 flex-col items-center justify-center gap-7 overflow-y-auto px-6 py-4 text-center">
              {contenuChiffres}
              {lastCue && (
                <p className="flex max-w-md items-center gap-2 text-[13px] italic text-zinc-500">
                  <Volume2 className="h-4 w-4 flex-shrink-0 text-zinc-400" />&ldquo;{lastCue}&rdquo;
                </p>
              )}
            </div>
            <div className="rounded-t-[28px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_-18px_rgba(9,9,11,0.35)]">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200" aria-hidden />
              {boutonsCourse}
            </div>
          </div>
        )}
      </section>

      {/* ⚠️ L'ENTÊTE VERT « GHOST RUNNER » A ÉTÉ RETIRÉ (23/09/2026). Il était passé SOUS
          la carte quand celle-ci a pris la tête de l'écran, et n'y disait plus rien que la
          carte ne dise déjà : un titre, un sous-titre et trois pastilles décoratives, 200 px
          de haut, entre l'action et les réglages. Le nom « Ghost Runner » reste sur la
          vitrine, où il désigne la fonctionnalité. */}

      <div ref={detailsRef}>
      <AnimatePresence mode="wait">
        {phase === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Une course commencée puis perdue (appli tuée, batterie, réseau) a été retrouvée
                sur le téléphone : on la propose, on ne la jette pas en silence. */}
            {courseRetrouvee && (
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="min-w-0 flex-1 text-sm font-medium text-amber-900">
                  {tg("t.recovered", { km: Math.round(courseRetrouvee.km * 10) / 10, t: formatTime(courseRetrouvee.elapsedSec) })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const c = courseRetrouvee; setCourseRetrouvee(null);
                      await envoyerCourse({
                        title: tg("runTitle", { km: Math.round(c.km * 10) / 10 }), distanceKm: c.km, durationSeconds: c.elapsedSec,
                        elevationGain: c.elevation > 0 ? c.elevation : undefined, track: c.track.length > 1 ? c.track : undefined, type: "easy",
                      });
                    }}
                    className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >{d["t.recoverSave"]}</button>
                  <button
                    onClick={() => { effacerEnCours(localStorage); setCourseRetrouvee(null); }}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                  >{d["t.recoverDrop"]}</button>
                </div>
              </div>
            )}
            {/* Séances du coach — faisables ici sans montre (allure/FC ciblée + voix) */}
            {coachSessions.length > 0 && (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/10"><ClipboardList className="h-4 w-4 text-emerald-700" /></span>
                  <h3 className="font-semibold text-zinc-900">{d["co.title"]}</h3>
                </div>
                <p className="mb-3 mt-0.5 text-sm text-zinc-500">{d["co.sub"]}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {coachSessions.map((s, i) => {
                    const dt = new Date(s.date + "T00:00:00");
                    const isToday = s.date === jourCivil(new Date(), fuseau);
                    return (
                      <button key={i} onClick={() => applyCoachSession(s)}
                        className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 text-left transition hover:border-emerald-400 hover:shadow-sm">
                        <div className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                          <span className="text-[11px] font-semibold leading-none">{dt.toLocaleDateString(lang, { month: "short" })}</span>
                          <span className="text-base font-semibold leading-none">{dt.getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-semibold text-zinc-900">{s.i18n?.[lang]?.title ?? s.title}</span>
                            {isToday && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">{d["co.today"]}</span>}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{s.i18n?.[lang]?.subtitle || s.detail || d["co.fallback"]}</p>
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${targetMode === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                  <Icon className={`h-4 w-4 ${targetMode === m ? (m === "hr" ? "text-rose-500" : "text-emerald-600") : ""}`} /> {l}
                </button>
              ))}
            </div>

            {/* ══ OBJECTIF OU LIBRE ═════════════════════════════════════════════════
                L'écran n'offrait que des objectifs : une distance ET un temps en allure,
                une des cinq zones en cardio. On ne pouvait pas simplement partir courir à
                l'allure de son choix, ni tenir une fourchette de battements à soi. */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex gap-1 rounded-2xl bg-zinc-100 p-1">
                {([[false, d["md.objectif"]], [true, d["md.libre"]]] as const).map(([v, l]) => (
                  <button key={String(v)} onClick={() => setLibre(v)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${libre === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                    {l}
                  </button>
                ))}
              </div>
              {libre && (
                <p className="min-w-0 flex-1 text-[12px] leading-snug text-zinc-500">
                  {targetMode === "pace" ? d["libre.explPace"] : d["libre.explHr"]}
                </p>
              )}
            </div>

            {targetMode === "pace" && libre ? (
            /* ── ALLURE LIBRE : une seule chose à régler, l'allure ── */
            <div className="mb-6 rounded-2xl border border-emerald-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 first-letter:uppercase"><Zap className="h-3.5 w-3.5" /> {d["lb.paceLibre"]}</label>
                <div className="flex gap-1">
                  <button onClick={() => setPaceLibre((v) => Math.min(PACE_LIBRE_MAX, Math.round((v + 1 / 12) * 120) / 120))} aria-label="−" className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600 transition-colors hover:bg-emerald-600 hover:text-white">−</button>
                  <button onClick={() => setPaceLibre((v) => Math.max(PACE_LIBRE_MIN, Math.round((v - 1 / 12) * 120) / 120))} aria-label="+" className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600 transition-colors hover:bg-emerald-600 hover:text-white">+</button>
                </div>
              </div>
              <div className="mb-3 mt-1 text-5xl font-semibold tabular-nums text-zinc-900">{formatPace(paceLibre)}<span className="ml-1 text-base font-semibold text-zinc-400">/km</span></div>
              {/* ⚠️ JUSQU'À 15:00/km : le curseur d'objectif s'arrête à 10:00, ce qui exclut
                  la marche rapide et le trail en montée — deux allures parfaitement réelles. */}
              <input aria-label={d["lb.paceLibre"]} type="range" min={PACE_LIBRE_MIN} max={PACE_LIBRE_MAX} step={1 / 60}
                value={paceLibre} onChange={(e) => setPaceLibre(parseFloat(e.target.value))} className="w-full accent-emerald-600" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[4, 4.5, 5, 5.5, 6, 6.5, 7, 8].map((v) => (
                  <button key={v} onClick={() => setPaceLibre(v)}
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors ${Math.abs(paceLibre - v) < 0.005 ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
                    {formatPace(v)}
                  </button>
                ))}
              </div>
              {/* La zone correspondante est un FAIT calculé sur sa VMA, pas un conseil. */}
              <p className="mt-3 text-[11px] text-zinc-400">{tg("libre.zone", { z: zoneDeLAllure(paceLibre) })} · {tg("libre.vma", { v: vma })}</p>
            </div>
            ) : targetMode === "pace" ? (
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
                    className={`group rounded-2xl border p-3.5 text-left transition duration-200 ${
                      active
                        ? "border-emerald-500 bg-emerald-50/70"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-lg font-semibold leading-tight ${active ? "text-emerald-700" : "text-zinc-900"}`}>{p.name === "Semi" ? d["pr.semi"] : p.name}</span>
                      <span className="h-2 w-2 rounded-full" style={{ background: feas.c }} />
                    </div>
                    <div className={`mt-0.5 text-xs font-semibold tabular-nums ${active ? "text-emerald-600" : "text-zinc-500"}`}>{formatPace(pace)} /km</div>
                    <div className={`mt-1.5 text-[11px] font-semibold ${active ? "text-emerald-600/70" : "text-zinc-400"}`}>{p.goal}</div>
                  </button>
                );
              })}
            </div>

            {/* Réglages faciles : choisis distance + allure, le temps se calcule tout seul */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {/* Distance */}
              <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 first-letter:uppercase"><MapPin className="h-3.5 w-3.5" /> {d["lb.dist"]}</label>
                  <div className="flex gap-1">
                    <button onClick={() => setDistanceKeepPace(distance - 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600 transition-colors hover:bg-emerald-600 hover:text-white">−</button>
                    <button onClick={() => setDistanceKeepPace(distance + 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600 transition-colors hover:bg-emerald-600 hover:text-white">+</button>
                  </div>
                </div>
                <div className="mb-3 text-4xl font-semibold tabular-nums text-zinc-900">{distance}<span className="ml-1 text-base font-semibold text-zinc-400">km</span></div>
                <input aria-label={d["lb.dist"]} type="range" min={1} max={50} step={0.5} value={Math.min(distance, 50)} onChange={(e) => setDistanceKeepPace(parseFloat(e.target.value))} className="w-full accent-emerald-600" />
                <div className="mt-3 flex flex-wrap gap-1">
                  {[5, 10, 21.1, 42.2].map((dd) => (
                    <button key={dd} onClick={() => setDistanceKeepPace(dd)} className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors ${distance === dd ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>{dd === 21.1 ? d["pr.semi"] : dd === 42.2 ? "Marathon" : dd + "K"}</button>
                  ))}
                </div>
              </div>

              {/* Allure cible — commande principale (accents émeraude) */}
              <div className="relative overflow-hidden rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 first-letter:uppercase"><Zap className="h-3.5 w-3.5" /> {d["lb.pace"]}</label>
                    <div className="flex gap-1">
                      <button onClick={() => setPaceMinKm(targetPace - 5 / 60)} title={d["faster"]} className="flex h-7 items-center justify-center rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white">−5s</button>
                      <button onClick={() => setPaceMinKm(targetPace + 5 / 60)} title={d["slower"]} className="flex h-7 items-center justify-center rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white">+5s</button>
                    </div>
                  </div>
                  <div className="mb-3 text-4xl font-semibold tabular-nums text-zinc-900">{formatPace(targetPace)}<span className="ml-1 text-base font-semibold text-zinc-400">/km</span></div>
                  <input aria-label={d["lb.pace"]} type="range" min={150} max={540} step={5} value={Math.round(Math.min(9, Math.max(2.5, targetPace)) * 60)} onChange={(e) => setPaceMinKm(parseInt(e.target.value) / 60)} className="w-full accent-emerald-600" />
                  <div className="mt-1 flex justify-between text-[11px] font-medium text-zinc-400"><span>{d["fast"]}</span><span>{d["slow"]}</span></div>
                </div>
              </div>

              {/* Temps visé — calculé automatiquement */}
              <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 first-letter:uppercase"><Timer className="h-3.5 w-3.5" /> {d["lb.time"]}</label>
                  <div className="flex gap-1">
                    <button onClick={() => bumpTime(-60)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600 transition-colors hover:bg-emerald-600 hover:text-white">−</button>
                    <button onClick={() => bumpTime(60)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600 transition-colors hover:bg-emerald-600 hover:text-white">+</button>
                  </div>
                </div>
                <div className="mb-3 text-4xl font-semibold tabular-nums text-zinc-900">{formatTime(targetTime)}</div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-400">{d["calc"]}</div>
              </div>
            </div>

            {/* Dénivelé — profil de parcours (reflète le D+ choisi) + réglage du total */}
            <div className="mb-6 rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
              <div className="mb-3 flex items-center justify-between">
                <label htmlFor={`${cid}-r0`} className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 first-letter:uppercase"><TrendingUp className="h-3.5 w-3.5 text-orange-500" /> {d["lb.elev"]}</label>
                <span className="text-lg font-semibold tabular-nums text-zinc-900">{elevation}<span className="ml-0.5 text-xs font-semibold text-zinc-400">m D+</span></span>
              </div>
              <ElevationProfile elevation={elevation} distance={distance} />
              <input id={`${cid}-r0`} type="range" min={0} max={3000} step={50} value={Math.min(elevation, 3000)} onChange={(e) => setElevation(parseInt(e.target.value))} className="mt-3 w-full accent-orange-500" />
            </div>

            {/* Pace zones reference */}
            <div className="mb-6 rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">{d["ref.title"]}</h3>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white shadow-sm" style={{ background: "linear-gradient(170deg,#065f46 0%,#064e3b 100%)" }}>VMA {vma} km/h</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {zoneBands.map((z) => (
                  <button
                    key={z.label}
                    onClick={() => setTargetTime(Math.round(((z.paceSlow + z.paceFast) / 2) * 60 * distance))}
                    className="group rounded-2xl border border-zinc-200/80 bg-white p-3 text-left transition hover:border-zinc-300 hover:shadow-md"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${z.tint}1a`, color: z.tint }}><z.Icon className="h-3.5 w-3.5" /></span>
                      <span className="truncate text-[11px] font-semibold" style={{ color: z.tint }}>{z.label}</span>
                    </div>
                    <div className="text-[13px] font-semibold tabular-nums text-zinc-900">{formatPace(z.paceFast)} – {formatPace(z.paceSlow)}<span className="text-[11px] font-medium text-zinc-300"> /km</span></div>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-zinc-400">{d["ref.hint"]}</p>
            </div>
            </>
            ) : libre ? (
            /* ── FRÉQUENCE CARDIAQUE LIBRE : la fourchette qu'on veut, en battements ── */
            <div className="mb-6 rounded-2xl border border-rose-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 first-letter:uppercase"><Heart className="h-3.5 w-3.5" /> {d["lb.fcLibre"]}</label>
              <div className="mb-3 mt-1 text-5xl font-semibold tabular-nums text-zinc-900">{Math.min(fcLo, fcHi)}<span className="mx-1 text-2xl text-zinc-300">–</span>{Math.max(fcLo, fcHi)}<span className="ml-1 text-base font-semibold text-zinc-400">bpm</span></div>
              <div className="grid grid-cols-2 gap-4">
                {([["lo", fcLo, setFcLo], ["hi", fcHi, setFcHi]] as const).map(([cle, val, set]) => (
                  <div key={cle}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-400 first-letter:uppercase">{cle === "lo" ? d["libre.bas"] : d["libre.haut"]}</span>
                      <div className="flex gap-1">
                        <button onClick={() => set((v) => Math.max(FC_MIN, v - 1))} aria-label={`− ${cle}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 hover:bg-rose-500 hover:text-white">−</button>
                        <button onClick={() => set((v) => Math.min(FC_MAX, v + 1))} aria-label={`+ ${cle}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 hover:bg-rose-500 hover:text-white">+</button>
                      </div>
                    </div>
                    <input aria-label={cle === "lo" ? d["libre.bas"] : d["libre.haut"]} type="range" min={FC_MIN} max={FC_MAX} step={1}
                      value={val} onChange={(e) => set(parseInt(e.target.value, 10))} className="w-full accent-rose-500" />
                  </div>
                ))}
              </div>
              {/* Les zones restent là comme RACCOURCIS : on ne les impose plus, on les propose. */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {maxHr != null && HR_ZONES.map((z) => (
                  <button key={z.z} onClick={() => { setFcLo(Math.round(maxHr * z.lo)); setFcHi(Math.round(maxHr * z.hi)); }}
                    className="rounded-lg bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-200">
                    {zn(z.z)}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-zinc-400">{maxHr != null ? tg("hr.max", { n: Math.round(maxHr) }) : d["hr.maxInconnue"]}</p>
                {hrSensor === "on" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                    <Bluetooth className="h-3 w-3" /> {d["hr.on"]}{liveHr != null ? ` · ${liveHr} bpm` : ""}
                  </span>
                ) : (
                  <button onClick={connectHrSensor} disabled={hrSensor === "connecting"}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
                    {hrSensor === "connecting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bluetooth className="h-3 w-3" />}
                    {d["hr.connect"]}
                  </button>
                )}
              </div>
            </div>
            ) : (
            /* ── Mode FRÉQUENCE CARDIAQUE : durée + zone cardiaque ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Durée */}
              <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-26px_rgba(16,24,40,0.2)]">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 first-letter:uppercase"><Timer className="h-3.5 w-3.5" /> {d["lb.dur"]}</label>
                  <div className="flex gap-1">
                    <button onClick={() => setDurationMin((d) => Math.max(5, d - 5))} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600 transition-colors hover:bg-emerald-600 hover:text-white">−</button>
                    <button onClick={() => setDurationMin((d) => Math.min(240, d + 5))} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600 transition-colors hover:bg-emerald-600 hover:text-white">+</button>
                  </div>
                </div>
                <div className="mb-3 text-4xl font-semibold tabular-nums text-zinc-900">{durationMin}<span className="ml-1 text-base font-semibold text-zinc-400">min</span></div>
                <input aria-label={d["lb.dur"]} type="range" min={10} max={180} step={5} value={Math.min(durationMin, 180)} onChange={(e) => setDurationMin(parseInt(e.target.value))} className="w-full accent-emerald-600" />
                <div className="mt-3 flex flex-wrap gap-1">
                  {[30, 45, 60, 90].map((d) => (
                    <button key={d} onClick={() => setDurationMin(d)} className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors ${durationMin === d ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>{d} min</button>
                  ))}
                </div>
              </div>
              {/* Zone FC cible (héros) */}
              <div className="relative overflow-hidden rounded-2xl border border-rose-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_46px_-26px_rgba(244,63,94,0.4)] ring-1 ring-rose-100">
                <div className="relative">
                  <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 first-letter:uppercase"><Heart className="h-3.5 w-3.5" /> {d["hr.zone"]}</label>
                  <div className="space-y-1.5">
                    {HR_ZONES.map((z) => (
                      <button key={z.z} onClick={() => setHrZone(z.z)}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${hrZone === z.z ? "bg-rose-500 text-white shadow-sm" : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100"}`}>
                        <span className="font-semibold">{zn(z.z)}</span>
                        <span className={`text-xs tabular-nums ${hrZone === z.z ? "text-rose-100" : "text-zinc-400"}`}>{bpmZone(z)}{maxHr != null ? " bpm" : ""}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-zinc-400">{maxHr != null ? tg("hr.max", { n: Math.round(maxHr) }) : d["hr.maxInconnue"]}</p>
                    {hrSensor === "on" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-200">
                        <Bluetooth className="h-3 w-3" /> {d["hr.on"]}{liveHr != null ? ` · ${liveHr} bpm` : ""}
                      </span>
                    ) : (
                      <button onClick={connectHrSensor} disabled={hrSensor === "connecting"}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60">
                        {hrSensor === "connecting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bluetooth className="h-3 w-3" />}
                        {d["hr.connect"]}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* Summary — bandeau émeraude (langage du dashboard) */}
            <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] flex flex-wrap items-center justify-between gap-4 mb-6" style={{ background: "linear-gradient(170deg,#065f46 0%,#064e3b 100%)" }}>
              {libre ? (
                <div className="flex items-center gap-6 sm:gap-8">
                  {targetMode === "pace"
                    ? <div><div className="text-emerald-100/80 text-sm mb-1">{d["lb.pace"]}</div><div className="text-2xl font-semibold">{formatPace(paceLibre)} /km</div></div>
                    : <div><div className="text-emerald-100/80 text-sm mb-1">{d["sm.target"]}</div><div className="text-2xl font-semibold tabular-nums">{Math.min(fcLo, fcHi)}–{Math.max(fcLo, fcHi)} bpm</div></div>}
                  <div><div className="text-emerald-100/80 text-sm mb-1">{targetMode === "pace" ? d["lb.dist"] : d["lb.dur"]}</div><div className="text-2xl font-semibold">{d["libre.valeur"]}</div></div>
                </div>
              ) : targetMode === "pace" ? (
                <div className="flex items-center gap-6 sm:gap-8">
                  <div><div className="text-emerald-100/80 text-sm mb-1">{d["lb.pace"]}</div><div className="text-2xl font-semibold">{formatPace(targetPace)} /km</div></div>
                  <div><div className="text-emerald-100/80 text-sm mb-1">{d["lb.dist"]}</div><div className="text-2xl font-semibold">{distance} km</div></div>
                  <div><div className="text-emerald-100/80 text-sm mb-1">{d["sm.goal"]}</div><div className="text-2xl font-semibold">{formatTime(targetTime)}</div></div>
                </div>
              ) : (
                <div className="flex items-center gap-6 sm:gap-8">
                  <div><div className="text-emerald-100/80 text-sm mb-1">{d["lb.dur"]}</div><div className="text-2xl font-semibold">{durationMin} min</div></div>
                  <div><div className="text-emerald-100/80 text-sm mb-1">{d["sm.hrZone"]}</div><div className="text-2xl font-semibold">{zn(hrZone)}</div></div>
                  <div><div className="text-emerald-100/80 text-sm mb-1">{d["sm.target"]}</div><div className="text-2xl font-semibold tabular-nums">{bpmZone(HR_ZONES[hrZone - 1])}</div></div>
                </div>
              )}
              <div className="flex items-center gap-3">
                {/* ⚠️ RIEN À ENVOYER À LA MONTRE EN LIBRE : une séance planifiée chez
                    intervals.icu a besoin d'une distance ou d'une durée. Plutôt que de
                    fabriquer un objectif que l'athlète n'a pas donné, on le dit. */}
                {libre ? (
                  <p className="max-w-[16rem] text-[11px] leading-snug text-emerald-100/80">{d["libre.montre"]}</p>
                ) : (
                <button
                  onClick={sendToWatch}
                  disabled={sendingWatch}
                  title={d["watch.tooltip"]}
                  className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-4 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 disabled:opacity-50"
                >
                  {sendingWatch ? <Loader2 className="w-5 h-5 animate-spin" /> : <Watch className="w-5 h-5" />}
                  {sendingWatch ? d["watch.sending"] : d["watch.send"]}
                  {!sendingWatch && watchStatus && (
                    <span title={watchStatus.pushReady ? tg("watch.okTitle", { d: watchStatus.device ?? "" }) : watchStatus.lecture ? tg(messageLecture(watchStatus.lecture), { d: nomLecture(watchStatus.lecture) }) : d["watch.setupTitle"]}
                      className={`h-2 w-2 rounded-full ${watchStatus.pushReady ? "bg-emerald-400" : watchStatus.lecture ? "bg-sky-400" : watchStatus.connected ? "bg-amber-400" : "bg-zinc-400"}`} />
                  )}
                </button>
                )}
                <button
                  onClick={() => (targetMode === "hr" ? startHrSession() : startSession())}
                  className="bg-white hover:bg-emerald-50 text-emerald-700 font-semibold px-8 py-4 rounded-2xl flex items-center gap-3 text-lg shadow-md transition"
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
                  <span className="block text-sm font-semibold text-zinc-900">{d["acc.title"]}</span>
                  {watchStatus && (
                    <span className={`mt-0.5 flex items-center gap-1.5 text-xs font-semibold ${watchStatus.pushReady ? "text-emerald-700" : watchStatus.lecture ? "text-sky-700" : watchStatus.connected ? "text-amber-700" : "text-zinc-500"}`}>
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${watchStatus.pushReady ? "bg-emerald-500" : watchStatus.lecture ? "bg-sky-500" : watchStatus.connected ? "bg-amber-500" : "bg-zinc-400"}`} />
                      {/* ⚠️ L'ORDRE COMPTE : `lecture` avant `connected`. Les deux sont vrais
                          en même temps, et l'ancien enchaînement affichait « configure ta
                          montre » à quelqu'un dont les séances arrivaient déjà. */}
                      {watchStatus.pushReady
                        ? tg("acc.ok", { d: watchStatus.device ?? "" })
                        : watchStatus.lecture
                        // Apple est le seul cas « lecture seule » qui ait une issue :
                        // on indique l'app qui convertit le plan, au lieu de laisser
                        // croire à une impasse — et si les données arrivent DÉJÀ par
                        // cette app (« Intervals Companion »), on dit le réglage à activer.
                        ? tg(messageLecture(watchStatus.lecture), { d: nomLecture(watchStatus.lecture) })
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
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">{i + 1}</span>
                            <span>{txt}</span>
                          </li>
                        ))}
                      </ol>
                      <a href="/dashboard/sync" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
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
            {/* Les chiffres de la course vivent dans la vue « chiffres », au-dessus (27/11/2026).
                Ici ne restent que les passages au kilomètre, à relire après coup. */}
            {/* Checkpoints — mode allure uniquement (la séance FC est pilotée par la durée) */}
            {sessionKind === "pace" && checkpoints.length > 0 && (
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

          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Une commande posée sur la carte : ronde, blanche, 44 px — la taille minimale d'une
 * cible tactile. « Actif » l'inverse en noir plein, pour qu'on sache d'un regard si la
 * voix parle et si la carte suit encore la position.
 */
function BtnCarte({ actif, titre, onClick, children }: { actif?: boolean; titre: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} title={titre} aria-label={titre} aria-pressed={!!actif}
      className={`pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full shadow-[0_8px_18px_-8px_rgba(9,9,11,0.6)] ring-1 transition-colors ${actif ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white/95 text-zinc-600 ring-black/5 hover:bg-white"}`}
    >
      {children}
    </button>
  );
}

const VIGNETTE_PLAN = "linear-gradient(135deg,#f2f1ed 0 36%,#bfe3a3 36% 58%,#f2f1ed 58% 66%,#9ccdf2 66%)";

/**
 * Une vignette du tiroir des modèles : l'image, le nom, et la coche de ce qui est choisi.
 * L'image passe en FOND CSS (pas d'<img>) : une tuile qui ne répond pas laisse le dégradé
 * dessous, jamais une icône d'image cassée.
 */
function Vignette({ nom, actif, onClick, fond, etiquette, children }: { nom: string; actif: boolean; onClick: () => void; fond: string; etiquette?: string; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={actif} className="flex flex-col items-center gap-1.5">
      <span className={`relative h-[68px] w-[68px] overflow-hidden rounded-2xl ring-2 ring-offset-2 transition ${actif ? "ring-emerald-600" : "ring-transparent hover:ring-zinc-200"}`} style={{ background: fond }}>
        {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
        {etiquette && <span className="absolute left-1 top-1 rounded bg-white/90 px-1 text-[9px] font-bold text-zinc-700">{etiquette}</span>}
        {actif && <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
      </span>
      <span className={`w-full text-center text-[11.5px] font-semibold leading-tight ${actif ? "text-emerald-700" : "text-zinc-700"}`}>{nom}</span>
    </button>
  );
}

/** Une action secondaire du bloc du bas : icône ronde + son mot, comme sur Strava. */
function ActionCarte({ label, onClick, coche, children }: { label: string; onClick: () => void; coche?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-24 flex-col items-center gap-1.5">
      <span className={`relative flex h-14 w-14 items-center justify-center rounded-full transition-colors ${coche ? "bg-emerald-50 hover:bg-emerald-100" : "bg-zinc-100 hover:bg-zinc-200"}`}>
        {children}
        {/* La coche dit « c'est ce qui est choisi », comme le sport chez Strava. */}
        {coche && <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
      </span>
      <span className="w-full truncate text-center text-[12px] font-semibold text-zinc-700">{label}</span>
    </button>
  );
}

/** LE bouton : celui qu'on cherche du pouce sans regarder, au départ comme à l'arrivée. */
function GrosBouton({ label, teinte, onClick, children }: { label: string; teinte: "emerald" | "rouge"; onClick: () => void; children: ReactNode }) {
  const vert = teinte === "emerald";
  return (
    <button type="button" onClick={onClick} className="-mt-3 flex w-24 flex-col items-center gap-1.5">
      <span className={`flex h-[76px] w-[76px] items-center justify-center rounded-full text-white transition-transform active:scale-95 ${vert ? "bg-emerald-600 shadow-[0_10px_24px_-10px_rgba(5,150,105,0.9)]" : "bg-red-600 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"}`}>
        {children}
      </span>
      <span className={`w-full truncate text-center text-[14px] font-bold ${vert ? "text-emerald-700" : "text-red-700"}`}>{label}</span>
    </button>
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
