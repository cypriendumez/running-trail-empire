"use client";

import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  Undo2, Trash2, Download, Save, Loader2, ChevronDown, X, MapPin, Mountain, Layers, Bookmark, Heart,
  SlidersHorizontal, Gauge, Navigation, Share2, Lock, LocateFixed, Maximize2, Route as RouteIcon,
} from "lucide-react";
import { SPORTS, SPORT_META, type ParcoursHdf, type SportHdf } from "@/data/parcoursHdf";
import { PX } from "@/components/parcours/parcoursI18n";
import Link from "next/link";
import { IconeSport } from "@/components/parcours/IconeSport";
import { chargerProfil, type Profil } from "@/lib/trail/altitude";
import { calculerTroncon, raccorder, accroche, estEchec, cleTroncon, assemblerTrace, estDoubleTap, loinDuChemin } from "@/lib/trail/itineraire";
import { profilOsrm } from "@/lib/trail/altitude";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/LanguageProvider";
import { TB, fillT } from "./trailI18n";
import { GX } from "@/components/ghost-runner/ghostI18n";
import { fmtNombre, fmtKm } from "@/lib/i18n/nombres";
import { idPartage } from "@/lib/courses/veille";
import { usePleinEcran } from "@/lib/ui/pleinEcran";
import { calquesDisponibles, fondsDisponibles, type CalqueCarte, type FondCarte, type IdCalque, type IdFond } from "@/lib/courses/fondsCarte";
import { RELIEF, avecCle } from "@/lib/trail/couches";
import { BtnCarte, ActionCarte, GrosBouton, TiroirModeles } from "@/components/carte/commandesCarte";

// La même carte qu'« Enregistrer » (vectorielle, MapLibre), chargée seulement côté navigateur.
const CarteDirect = dynamic(() => import("@/components/ghost-runner/CarteDirect").then((m) => m.CarteDirect), { ssr: false });
/** La clé MapTiler (publique) : elle décide quels modèles existent (satellite, relief). */
const CLE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY || undefined;
/** Le relief 3D n'existe qu'avec la clé (cf. lib/trail/couches). */
const RELIEF_DISPO = avecCle(RELIEF.url, CLE_MAPTILER) !== null;

// ─── Types ───────────────────────────────────────────────────────────────────
interface LatLng { lat: number; lng: number }
interface SavedRoute {
  id: string;
  name: string;
  coordinates: [number, number][];
  distance_km: number;
  elevation_gain_m: number;
  duration_min: number;
  difficulty: string;
  created_at: string;
  /** Cœur : le parcours remonte en tête de liste. Optionnel — un parcours enregistré
   *  avant la migration 024 n'a pas la colonne, et vaut alors « non favori ». */
  is_favorite?: boolean;
}

// ─── Famous French trails (fly-to presets) ───────────────────────────────────
interface FamousRoute {
  name: string;
  region: string;
  emoji: string;
  lat: number;
  lng: number;
  zoom: number;
  distance: string;
  elevation: string;
}
const FAMOUS_ROUTES: FamousRoute[] = [
  { name: "Tour du Mont-Blanc", region: "Chamonix · Alpes", emoji: "", lat: 45.923, lng: 6.869, zoom: 11, distance: "170 km", elevation: "+10 000 m" },
  { name: "GR20 Corse", region: "Calenzana → Conca", emoji: "", lat: 42.300, lng: 9.050, zoom: 9, distance: "180 km", elevation: "+12 000 m" },
  { name: "GR10 Pyrénées", region: "Hendaye → Banyuls", emoji: "", lat: 42.800, lng: 0.700, zoom: 8, distance: "920 km", elevation: "+48 000 m" },
  { name: "GR34 Sentier des Douaniers", region: "Côte de Bretagne", emoji: "", lat: 48.600, lng: -3.900, zoom: 9, distance: "2 000 km", elevation: "vallonné" },
  { name: "Calanques de Marseille", region: "Marseille → Cassis", emoji: "", lat: 43.215, lng: 5.460, zoom: 13, distance: "20 km", elevation: "+900 m" },
  { name: "Gorges du Verdon (GR4)", region: "Verdon · Provence", emoji: "", lat: 43.750, lng: 6.330, zoom: 12, distance: "15 km", elevation: "+700 m" },
  { name: "Mont Ventoux", region: "Bédoin · Vaucluse", emoji: "", lat: 44.174, lng: 5.278, zoom: 12, distance: "21 km", elevation: "+1 600 m" },
  { name: "Sentier du Littoral", region: "Côte d'Azur", emoji: "", lat: 43.530, lng: 7.130, zoom: 12, distance: "variable", elevation: "plat" },
];

// ─── Activity profiles (flat speed km/h + climb penalty min per +100 m) ───────
// ⚠️ 27/11/2026 (Cyprien : « course à pied, VTT, vélo, trail, randonnée ») : le VTT
// n'existait pas (un parcours VTT se chargeait en vélo de route, à 19 km/h), et « marche »
// est affichée « Randonnée » — c'est ce que les parcours du catalogue y rangent.
const ACTIVITIES = {
  course: { label: "Course",    emoji: "", flat: 11,  climb: 6,  primary: "pace"  },
  trail:  { label: "Trail",     emoji: "", flat: 8.5, climb: 9,  primary: "pace"  },
  marche: { label: "Randonnée", emoji: "", flat: 4.5, climb: 10, primary: "speed" },
  velo:   { label: "Vélo",      emoji: "", flat: 19,  climb: 3,  primary: "speed" },
  vtt:    { label: "VTT",       emoji: "", flat: 13,  climb: 5,  primary: "speed" },
} as const;
type ActivityKey = keyof typeof ACTIVITIES;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function totalDistance(pts: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]);
  return d;
}

function difficultyColor(d: string) {
  return { green: "#22c55e", blue: "#3b82f6", red: "#ef4444", black: "#18181b" }[d] || "#22c55e";
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

/** Un nom de parcours avec « & » ou « < » rendait le fichier GPX invalide. */
const echapperXml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildGPX(name: string, pts: LatLng[], elevations: number[]): string {
  const trk = pts.map((p, i) =>
    `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">${elevations[i] != null ? `<ele>${elevations[i].toFixed(1)}</ele>` : ""}</trkpt>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pacevo"
     xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${echapperXml(name)}</name>
    <trkseg>
${trk}
    </trkseg>
  </trk>
</gpx>`;
}

// ─── City search / geocoding (restricted to France) ──────────────────────────
// (Recherche de ville supprimée — la recherche globale de la barre du haut s'en charge.)

// ─── Altitude : voir `lib/trail/altitude` ────────────────────────────────────
// ⚠️ LE CALCUL A DÉMÉNAGÉ, ET CE N'EST PAS UN RANGEMENT. Il vivait ici en trois défauts
// silencieux : un D+ qui additionnait le bruit du modèle d'altitude, 100 mesures quelle
// que soit la longueur (une tous les 400 m sur 40 km), et un échec de lecture rendu en
// ZÉROS — « D+ 0 m », difficulté facile, durée sans pénalité, pour un parcours de
// montagne. Le module est éprouvé par `tests/trace.test.ts`.

function formatPace(minPerKm: number): string {
  if (!isFinite(minPerKm) || minPerKm <= 0) return "—";
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Target-speed slider range per activity.
//  • Running ("course"): expressed as pace, 7:00 → 2:30 /km  (= 8.57 → 24 km/h)
//  • Everything else: expressed as speed, 1 → 50 km/h
function speedRange(activity: ActivityKey): { min: number; max: number; step: number; mode: "pace" | "speed" } {
  if (activity === "course") {
    return { min: 60 / 7, max: 60 / 2.5, step: 0.05, mode: "pace" };
  }
  return { min: 1, max: 50, step: 0.5, mode: "speed" };
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Component ───────────────────────────────────────────────────────────────
/** Un point posé sur la carte. L'`id` relie chaque tronçon à SES deux points. */
type Repere = LatLng & { id: number };
const COULEUR_DEPART = "#22c55e", COULEUR_ETAPE = "#3b82f6", COULEUR_ARRIVEE = "#ef4444";

export function TrailBuilder({ centre, onTrace, exportGpx = false }: {
  centre?: { lat: number; lon: number } | null;
  /** Remonte la trace construite, pour que la vue relief l'affiche telle quelle. */
  onTrace?: (points: { lat: number; lon: number }[]) => void;
  /** Droit d'exporter en GPX (formules payantes). FAUX par défaut : un oubli de
   *  propriété ferme le bouton, il ne l'offre pas. */
  exportGpx?: boolean;
} = {}) {
  const { lang } = useT();
  const d = TB[lang] ?? TB.fr;
  const g = GX[lang] ?? GX.fr;
  const tb = (k: string, p?: Record<string, string | number>) => fillT(d[k] ?? k, p);
  // Traduit les descripteurs de relief des presets (« vallonné »/« plat »/« variable »), garde le reste (distances) intact.
  const tbDesc = (s: string) => d[`desc.${s}`] ?? s;
  const sectionCarte = useRef<HTMLElement>(null);

  /**
   * ── LA CARTE EN GRAND, COMME « ENREGISTRER » (Cyprien, 27/11/2026) ────────────
   * « Fais comme dans Enregistrer, exactement la même chose, pareil pour la carte en
   * grand. » Même carte vectorielle (`CarteDirect`), même colonne de boutons ronds, même
   * bloc de chiffres, même tiroir du bas et même tiroir des modèles. Sur téléphone, elle
   * s'ouvre en grand ; la flèche ⌄ rend la page (vue relief, parcours de France dessous).
   */
  const [plein, setPlein] = useState(false);
  usePleinEcran(plein);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches) setPlein(true);
  }, []);
  useEffect(() => {
    if (!plein) return;
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setPlein(false); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [plein]);

  // Les modèles de carte, comme dans Enregistrer (selon la clé et le pays).
  const [fondCarte, setFondCarte] = useState<IdFond>("plan");
  const [calquesActifs, setCalquesActifs] = useState<IdCalque[]>(["poi"]);
  const [relief3d, setRelief3d] = useState(false);
  const [feuille, setFeuille] = useState<null | "modeles" | "reglages" | "parcours" | "choisi">(null);
  /** Compteur + destination : chaque nouveau `n` déplace la carte (voir `CarteDirect`). */
  const [vue, setVue] = useState<{ n: number; centre?: [number, number]; zoom?: number; emprise?: [number, number][] }>({ n: 0 });
  const fermerFeuille = useCallback(() => setFeuille(null), []);
  const fermerTiroir = useCallback(() => setTiroirOuvert(false), []);

  /**
   * ── LES PARCOURS PROPOSÉS, DANS LA CARTE (Cyprien, 27/11/2026) ───────────────
   * « Pourquoi ça ne propose plus les parcours comme avant ? Trouve un moyen de les
   * proposer, et en même temps ne pas être perdu. » La liste « Parcours · France » vit SOUS
   * la carte ; depuis que la carte s'ouvre en grand sur téléphone, on ne la voyait plus.
   * Les parcours du catalogue autour de l'endroit regardé sont donc DANS la carte : leurs
   * départs en pastilles (carte vide seulement — pas pendant un tracé), et un bouton
   * « Parcours » qui ouvre la liste, triée par distance. Un parcours touché se charge par la
   * liste du dessous (même code, mêmes contrôles : `te:chargerParcours`).
   */
  const [centreVu, setCentreVu] = useState<[number, number] | null>(null);
  const [sportPropose, setSportPropose] = useState<"all" | SportHdf>("all");
  const [propositions, setPropositions] = useState<ParcoursHdf[]>([]);
  const [etatPropositions, setEtatPropositions] = useState<"attente" | "ok" | "erreur">("attente");
  const [choisi, setChoisi] = useState<ParcoursHdf | null>(null);
  const dernierePropo = useRef<{ lat: number; lng: number; sport: string; q: string } | null>(null);
  /**
   * ── LE TIROIR DU BAS S'OUVRE SUR LES PARCOURS (Cyprien, 27/11/2026, capture à l'appui) ──
   * « Enlève le bouton "Voir les 20 parcours autour d'ici" ; quand on appuie sur la petite
   * barre au-dessus de "Mes parcours", en dessous on accède à tous les parcours de France,
   * en priorité ceux autour de nous. » La poignée du tiroir s'ouvre au toucher ou au glissé
   * vers le haut : recherche, sports, les plus proches d'abord, puis la suite (« Afficher
   * plus ») jusqu'au bout du catalogue.
   */
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [rechercheDiff, setRechercheDiff] = useState("");
  useEffect(() => { const t = setTimeout(() => setRechercheDiff(recherche.trim()), 300); return () => clearTimeout(t); }, [recherche]);
  const [pagePropo, setPagePropo] = useState(1);
  const [totalPropo, setTotalPropo] = useState(0);
  const [plusEnCours, setPlusEnCours] = useState(false);
  const departGlisse = useRef<number | null>(null);
  /** Le centre regardé ne change l'état qu'au-delà de 200 m : pas un rendu par mouvement de carte. */
  const changerCentreVu = useCallback((c: [number, number]) => setCentreVu((avant) =>
    avant && distanceKm({ lat: avant[0], lng: avant[1] }, { lat: c[0], lng: c[1] }) < 0.2 ? avant : c), []);
  const allerA = useCallback((v: Omit<typeof vue, "n">) => setVue((x) => ({ ...v, n: x.n + 1 })), []);

  const [followPaths, setFollowPaths] = useState(true);
  /**
   * Le profil altimétrique, dans le tiroir du bas. ⚠️ REPLIÉ D'OFFICE SUR TÉLÉPHONE : ouvert,
   * le bloc du bas montait à mi-écran et cachait la moitié de la carte sur laquelle on trace
   * (banc d'essai à 375 × 812, 27/11/2026). Toucher le D+ l'ouvre ou le replie.
   */
  const [showElevation, setShowElevation] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches) setShowElevation(false);
  }, []);

  /**
   * ── LES POINTS ET LEURS TRONÇONS ──────────────────────────────────────────
   * ⚠️ UN TRONÇON EST RANGÉ SOUS LES DEUX POINTS QU'IL RELIE, PAS EMPILÉ. Avant, chaque
   * réponse du calcul d'itinéraire était AJOUTÉE à la liste dans l'ordre où elle
   * arrivait : en posant vite deux points, le second tronçon pouvait arriver le premier,
   * et le tracé reliait les mauvais points (Cyprien, vidéo du 27/11/2026 : « des fois ça
   * relie pas du tout ce que je voulais »). Rangé sous `cleTroncon(a, b)`, chaque tronçon
   * prend sa place quel que soit son ordre d'arrivée ; un point annulé pendant le calcul
   * laisse sa réponse sans effet.
   */
  const [reperes, setReperes] = useState<Repere[]>([]);
  const reperesRef = useRef<Repere[]>([]);
  const monte = useRef(true);
  useEffect(() => { monte.current = true; return () => { monte.current = false; }; }, []);
  useEffect(() => { reperesRef.current = reperes; }, [reperes]);
  const idSuivant = useRef(1);
  const [troncons, setTroncons] = useState<Record<string, LatLng[]>>({});
  const [redoStack, setRedoStack] = useState<{ repere: Repere; depuis: number | null; troncon?: LatLng[] }[]>([]);
  const [enCalcul, setEnCalcul] = useState(0);
  // Assemblé dans l'ORDRE DES POINTS (lib/trail/itineraire, testé avec des réponses
  // arrivées dans le désordre) ; un tronçon pas encore calculé y est une ligne droite.
  const allPoints = useMemo<LatLng[]>(() => assemblerTrace(reperes, troncons), [reperes, troncons]);
  // ⚠️ REMONTÉE DANS UN EFFET, PAS PENDANT LE RENDU. Appeler `onTrace` directement dans
  // le corps du composant déclencherait un `setState` du parent au milieu du rendu de
  // l'enfant — React le refuse, et la carte cesserait de se mettre à jour.
  useEffect(() => { onTrace?.(allPoints.map((p) => ({ lat: p.lat, lon: p.lng }))); }, [allPoints, onTrace]);
  const allPointsRef = useRef(allPoints);
  useEffect(() => { allPointsRef.current = allPoints; }, [allPoints]);
  const [profil, setProfil] = useState<Profil | null>(null);
  /** Vrai quand la lecture d'altitude a ÉCHOUÉ : l'écran le dit au lieu d'afficher 0 m. */
  const [altitudeIndispo, setAltitudeIndispo] = useState(false);
  /**
   * L'altitude du tracé ACTUEL est en cours de lecture. ⚠️ Pendant ce temps, le D+ affiché
   * était « 0 m » — une valeur par défaut présentée comme une mesure, et un parcours
   * enregistré à cet instant s'écrivait avec 0 m de dénivelé (relecture du 27/11/2026).
   * On affiche « … » et l'enregistrement attend.
   */
  const [profilEnCours, setProfilEnCours] = useState(false);
  const elevations = profil?.altitudes ?? [];
  const [distance, setDistance] = useState(0);
  const routeLoading = enCalcul > 0;
  const [activity, setActivity] = useState<ActivityKey>("course");
  // Manual target speed in km/h. null = automatic (terrain-based) estimate.
  const [manualSpeed, setManualSpeed] = useState<number | null>(null);

  // Derived metrics (declared early so map effects can use them)
  const elevGain = profil?.gain ?? 0, elevLoss = profil?.perte ?? 0;
  const elevMin = profil?.min ?? 0, elevMax = profil?.max ?? 0;
  const act = ACTIVITIES[activity];
  // Automatic terrain-based estimate (flat speed + climb penalty)
  const autoDurationMin = distance > 0
    ? (distance / act.flat) * 60 + (elevGain / 100) * act.climb
    : 0;
  const autoSpeedKmh = autoDurationMin > 0 ? distance / (autoDurationMin / 60) : act.flat;
  // Effective speed: manual override when set, otherwise the auto estimate
  const speedKmh = manualSpeed ?? autoSpeedKmh;
  const paceMinPerKm = speedKmh > 0 ? 60 / speedKmh : 0;
  const durationMin = distance > 0 && speedKmh > 0 ? (distance / speedKmh) * 60 : 0;
  const speedCfg = speedRange(activity);
  const difficulty = elevGain > 1500 ? "black"
    : elevGain > 800 ? "red"
    : elevGain > 300 ? "blue"
    : "green";

  // Save
  const [routeName, setRouteName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);

  /**
   * PREMIÈRE VUE : LA ZONE DE L'ATHLÈTE, PAS LA FRANCE ENTIÈRE.
   *
   * Sans centre donné par la page (aucune trace GPS), on se recentre sur le DERNIER
   * parcours enregistré, déjà chargé pour la liste : aucune requête de plus, et aucune
   * demande de géolocalisation.
   *
   * ⚠️ TROIS GARDES. On ne le fait qu'UNE fois (`vueAutoFaite`), jamais si un tracé est
   * déjà commencé, et jamais si les coordonnées sont hors bornes — `coordinates` est
   * stocké en [lng, lat] et une inversion ouvrirait la carte au milieu de l'océan.
   */
  const vueAutoFaite = useRef(false);
  useEffect(() => {
    if (vueAutoFaite.current || centre) return;   // la page a déjà donné un centre
    if (reperes.length > 0 || savedRoutes.length === 0) return;
    const premier = savedRoutes[0]?.coordinates?.[0];
    if (!premier) return;
    const [lng, lat] = premier;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    vueAutoFaite.current = true;
    allerA({ centre: [lat, lng], zoom: 12 });
  }, [savedRoutes, reperes.length, centre, allerA]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // ── Navigation GPS en direct (point bleu qui se déplace) ──────────────────────
  const [navMode, setNavMode] = useState(false);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [navAccuracy, setNavAccuracy] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  /** La main a pris la carte pendant le suivi : on ne la ramène plus de force. */
  const [suiviNav, setSuiviNav] = useState(true);
  const [recentrages, setRecentrages] = useState(0);
  /** « Ma position » demandée une fois (sans suivi) : le point bleu, sans recentrer en boucle. */
  const [maPosition, setMaPosition] = useState<LatLng | null>(null);

  // Partage live (Supabase Realtime broadcast)
  const [sharing, setSharing] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shareChanRef = useRef<any>(null);

  // ── Relier deux points par le vrai chemin (lib/trail/itineraire) ──────────────
  const relier = useCallback(async (depuis: Repere, vers: Repere, recalcul = false) => {
    const cle = cleTroncon(depuis, vers);
    if (!followPaths) { setTroncons((t) => ({ ...t, [cle]: [{ lat: vers.lat, lng: vers.lng }] })); return; }
    // Utile tant que le point existe ET que l'écran est encore là : en quittant l'onglet,
    // les requêtes encore en file ne partent pas.
    const utile = () => monte.current && reperesRef.current.some((r) => r.id === vers.id);
    setEnCalcul((n) => n + 1);
    // `utile` est relu quand vient le tour de la requête : annulé entre-temps, il ne part pas.
    const t = await calculerTroncon(depuis, vers, activity, fetch, utile);
    setEnCalcul((n) => n - 1);
    // Le point a pu être annulé ou effacé pendant le calcul : la réponse ne sert plus.
    if (!utile()) return;
    if (estEchec(t)) {
      // ⚠️ UNE LIGNE DROITE SE DIT, ET POURQUOI. L'ancien code la posait en silence à chaque
      // échec : le parcours traversait des immeubles et personne ne savait pourquoi.
      // Un seul message à la fois (`id`) : serveur en panne + cinq points posés = un toast, pas cinq.
      toast.error(t.echec === "panne" ? d["t.routeDown"] : d["t.routeFail"], { id: "itineraire" });
      // Un RECALCUL raté (changement d'activité) garde le tronçon déjà calculé : on ne
      // remplace pas un vrai chemin par une ligne droite (relecture du 27/11/2026).
      if (recalcul) return;
      setTroncons((x) => ({ ...x, [cle]: [{ lat: vers.lat, lng: vers.lng }] }));
      return;
    }
    if (loinDuChemin(depuis, vers, t)) {
      // Hors de tout chemin (champ, sommet, hors-piste) : le serveur accrocherait le point à
      // un chemin lointain et ferait des kilomètres de détour. Ligne droite, annoncée.
      toast(d["t.loinChemin"], { id: "itineraire" });
      setTroncons((x) => ({ ...x, [cle]: [{ lat: vers.lat, lng: vers.lng }] }));
      return;
    }
    const { points, repere } = raccorder(depuis, vers, t);
    setTroncons((x) => ({ ...x, [cle]: points }));
    // Le repère se pose SUR le chemin (s'il était tout près) ; le départ aussi, au premier tronçon.
    setReperes((rs) => rs.map((r, i) => r.id === vers.id ? { ...r, ...repere }
      : i === 0 && r.id === depuis.id ? { ...r, ...accroche(depuis, t.depart) } : r));
  }, [followPaths, activity, d]);

  // ── Tap sur la carte : un point de plus ───────────────────────────────────────
  const dernierTap = useRef<{ t: number; lat: number; lng: number } | null>(null);
  const handleMapClick = useCallback((lat: number, lng: number) => {
    // ⚠️ UN DOUBLE-TAP N'EST PAS DEUX POINTS (relecture du 27/11/2026) : MapLibre émet un
    // `click` par tap, et deux repères se posaient au même endroit (tronçon nul).
    const tap = { t: Date.now(), lat, lng };
    const double = estDoubleTap(dernierTap.current, tap);
    dernierTap.current = tap;
    if (double) return;
    const r: Repere = { id: idSuivant.current++, lat, lng };
    const prev = reperesRef.current[reperesRef.current.length - 1];
    // La liste est mise à jour TOUT DE SUITE (et pas au prochain rendu) : un second tap
    // rapide doit se relier à ce point-ci, pas à l'avant-dernier.
    reperesRef.current = [...reperesRef.current, r];
    // Fonctionnel : un tronçon qui vient d'arriver a pu déplacer un repère sur le chemin.
    setReperes((rs) => [...rs, r]);
    setRedoStack([]); // a fresh point invalidates the redo history
    if (prev) void relier(prev, r);
  }, [relier]);

  // ── Update distance + elevation ────────────────────────────────────────────
  useEffect(() => {
    const d = totalDistance(allPoints);
    setDistance(d);

    if (allPoints.length >= 2) {
      setProfilEnCours(true);
      /**
       * ⚠️ L'ALTITUDE N'EST LUE QUE SUR UN TRACÉ STABLE (crash-test du 27/11/2026). Elle était
       * relue à CHAQUE changement — ligne droite provisoire, tronçon arrivé, repère accroché —
       * soit une dizaine de lectures pour quelques points : le service répondait « trop de
       * requêtes » (13 refus sur 34) et le D+ passait à « — ». On attend la fin des calculs
       * d'itinéraire, puis 700 ms sans changement.
       */
      if (routeLoading) return;
      // Annulable : chaque clic ajoute un point, et sans cela les réponses d'une
      // ancienne requête écrasaient celles de la nouvelle (profil d'un tracé précédent).
      const ctrl = new AbortController();
      const minuterie = setTimeout(() => {
        chargerProfil(allPoints, { signal: ctrl.signal }).then((p) => {
          if (ctrl.signal.aborted) return;
          setProfil(p);
          setAltitudeIndispo(p === null);
          setProfilEnCours(false);
        });
      }, 700);
      return () => { clearTimeout(minuterie); ctrl.abort(); };
    }
    setProfil(null);
    setAltitudeIndispo(false);
    setProfilEnCours(false);
  }, [allPoints, routeLoading]);

  /**
   * ── CHANGER D'ACTIVITÉ RECALCULE LE TRACÉ DÉJÀ POSÉ (crash-test du 27/11/2026) ──
   * Passer de « Course » à « Vélo » laissait les tronçons déjà posés sur les chemins
   * piétons (même tracé, point pour point) : le vélo empruntait des escaliers. Quand le
   * PROFIL change (à pied ↔ à vélo) ou que « suivre les chemins » se rallume, chaque
   * tronçon est recalculé — sauf ceux d'un parcours chargé, dont le tracé GPS est le vrai.
   */
  const tronconsFixes = useRef<Set<string>>(new Set());
  const profilTrace = followPaths ? profilOsrm(activity) : "droit";
  const profilPrecedent = useRef(profilTrace);
  useEffect(() => {
    if (profilPrecedent.current === profilTrace) return;
    profilPrecedent.current = profilTrace;
    if (profilTrace === "droit") return; // les tronçons déjà calculés restent ; les suivants seront droits
    const rs = reperesRef.current;
    for (let i = 1; i < rs.length; i++) {
      if (!tronconsFixes.current.has(cleTroncon(rs[i - 1], rs[i]))) void relier(rs[i - 1], rs[i], true);
    }
  }, [profilTrace, relier]);

  // ── Undo last waypoint (precise — drops exactly the last leg) ───────────────
  const handleUndo = useCallback(() => {
    const rs = reperesRef.current;
    if (!rs.length) return;
    const dernier = rs[rs.length - 1], avant = rs[rs.length - 2] ?? null;
    setRedoStack((r) => [...r, { repere: dernier, depuis: avant?.id ?? null, troncon: avant ? troncons[cleTroncon(avant, dernier)] : undefined }]);
    reperesRef.current = rs.slice(0, -1);
    setReperes((x) => x.slice(0, -1));
  }, [troncons]);

  // ── Redo ("Retour") — re-add the last undone leg ────────────────────────────
  const handleRedo = useCallback(() => {
    const last = redoStack[redoStack.length - 1];
    if (!last) return;
    setRedoStack((r) => r.slice(0, -1));
    const prev = reperesRef.current[reperesRef.current.length - 1];
    reperesRef.current = [...reperesRef.current, last.repere];
    setReperes((x) => [...x, last.repere]);
    if (!prev) return;
    if (last.troncon && last.depuis === prev.id) setTroncons((t) => ({ ...t, [cleTroncon(prev, last.repere)]: last.troncon! }));
    else void relier(prev, last.repere);
  }, [redoStack, relier]);

  const handleClear = useCallback(() => {
    reperesRef.current = [];
    setReperes([]);
    setTroncons({});
    // ⚠️ Le nom d'un parcours chargé s'en va avec lui (crash-test du 27/11/2026 : après
    // « REV 6 » puis « Effacer », le nouveau tracé s'appelait encore « REV 6 », et se serait
    // sauvegardé sous ce nom).
    setRouteName("");
    tronconsFixes.current = new Set();
    setRedoStack([]);
    setProfil(null);
    setDistance(0);
  }, []);

  // ── GPX export ────────────────────────────────────────────────────────────
  const handleExportGPX = useCallback(() => {
    if (!exportGpx) return;
    if (!allPoints.length) { toast.error(d["t.drawFirst"]); return; }
    const name = routeName || d["defaultRouteName"];
    const gpx = buildGPX(name, allPoints, elevations);
    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(d["t.gpxOk"]);
  }, [allPoints, elevations, routeName, d, exportGpx]);

  // ── Save route ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!allPoints.length) { toast.error(d["t.drawFirst"]); return; }
    if (!routeName.trim()) { toast.error(d["t.nameRoute"]); return; }
    // Pas d'enregistrement pendant un calcul : la distance ou le D+ écrits seraient faux.
    if (profilEnCours || routeLoading) return;
    setSaving(true);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: routeName,
          coordinates: allPoints.map(p => [p.lng, p.lat]),
          distance_km: distance,
          // ⚠️ `null` QUAND L'ALTITUDE N'A PAS PU ÊTRE LUE, jamais 0 : un parcours
          // enregistré avec « D+ 0 m » se relit comme un parcours plat, des mois plus
          // tard, sans que rien ne rappelle que la mesure avait échoué ce jour-là.
          elevation_gain_m: altitudeIndispo ? null : elevGain,
          duration_min: durationMin,
          difficulty,
        }),
      });
      if (res.ok) {
        toast.success(d["t.savedDb"]);
        loadSavedRoutes();
      } else {
        // ── REPLI LOCAL — ET ON LE DIT ─────────────────────────────────────────
        // Ce repli a masqué pendant des mois que la table `user_routes` n'avait
        // jamais été créée : l'écriture échouait, le parcours partait dans le
        // `localStorage` du navigateur, et l'athlète lisait un message de succès.
        // Ses parcours « enregistrés » vivaient donc dans un seul navigateur —
        // perdus au vidage du cache, invisibles depuis le téléphone, absents de
        // toute sauvegarde. Un repli qui se félicite est pire qu'une erreur franche.
        const routes = JSON.parse(localStorage.getItem("trail_routes") || "[]");
        routes.unshift({
          id: Date.now().toString(),
          name: routeName,
          coordinates: allPoints.map(p => [p.lng, p.lat]),
          distance_km: Math.round(distance * 100) / 100,
          elevation_gain_m: altitudeIndispo ? null : Math.round(elevGain),
          duration_min: Math.round(durationMin),
          difficulty,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem("trail_routes", JSON.stringify(routes.slice(0, 20)));
        setSavedRoutes(routes);
        // `warning` et non `success` : rien n'a été enregistré en ligne.
        toast.warning(d["t.savedLocal"], { duration: 8000 });
      }
    } catch {
      toast.error(d["t.saveErr"]);
    } finally {
      setSaving(false);
    }
  }, [allPoints, routeName, distance, elevGain, durationMin, difficulty, d, profilEnCours, routeLoading]);

  // ── Load saved routes ──────────────────────────────────────────────────────
  const loadSavedRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const res = await fetch("/api/routes");
      if (res.ok) {
        const data = await res.json();
        if (data.routes?.length) {
          setSavedRoutes(data.routes);
          setLoadingRoutes(false);
          return;
        }
      } else {
        // ⚠️ Le repli sur ce navigateur reste, mais il se DIT (08/11/2026) : en silence,
        // l'athlète croyait avoir perdu ses parcours enregistrés en ligne.
        toast.error(d["t.loadErr"]);
      }
    } catch { toast.error(d["t.loadErr"]); }
    // Fallback to localStorage
    const local = JSON.parse(localStorage.getItem("trail_routes") || "[]");
    setSavedRoutes(local);
    setLoadingRoutes(false);
  }, [d]);

  useEffect(() => { loadSavedRoutes(); }, [loadSavedRoutes]);

  // ── Load a saved route onto map ────────────────────────────────────────────
  const handleLoadRoute = useCallback((route: SavedRoute) => {
    const pts = route.coordinates.map(([lng, lat]) => ({ lat, lng }));
    if (pts.length < 2) return;
    const a: Repere = { id: idSuivant.current++, ...pts[0] };
    const b: Repere = { id: idSuivant.current++, ...pts[pts.length - 1] };
    reperesRef.current = [a, b];
    setReperes([a, b]);
    setTroncons({ [cleTroncon(a, b)]: pts.slice(1) });
    // Le tracé GPS d'un parcours chargé est le VRAI : changer d'activité ne le recalcule pas.
    tronconsFixes.current = new Set([cleTroncon(a, b)]);
    setRedoStack([]);
    setRouteName(route.name);
    // La carte cadre le parcours entier.
    allerA({ emprise: pts.map((p) => [p.lat, p.lng] as [number, number]) });
    toast.success(tb("t.loaded", { name: route.name }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, allerA]);

  // ── Delete saved route ─────────────────────────────────────────────────────
  const handleDeleteRoute = useCallback(async (id: string) => {
    // ⚠️ LA RÉPONSE EST LUE (08/11/2026) : l'écran retirait le parcours et disait « supprimé »
    // quoi qu'ait répondu le serveur ; il revenait au rechargement. Un refus garde tout en place.
    //
    // Un parcours du REPLI LOCAL (enregistrement en ligne refusé) a pour id `Date.now()` :
    // le serveur ne l'a jamais eu, et Postgres refuse cet id dans une colonne uuid. Le
    // demander au serveur le rendait impossible à supprimer : il se retire du navigateur seul.
    const enLigne = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let supprime = !enLigne;
    if (enLigne) {
      try {
        const res = await fetch(`/api/routes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        supprime = res.ok;
      } catch { /* hors ligne : on ne sait pas, on ne retire rien */ }
    }
    if (!supprime) { toast.error(d["t.delErr"]); return; }
    const local = JSON.parse(localStorage.getItem("trail_routes") || "[]");
    const updated = local.filter((r: SavedRoute) => r.id !== id);
    localStorage.setItem("trail_routes", JSON.stringify(updated));
    setSavedRoutes(prev => prev.filter(r => r.id !== id));
    toast.success(d["t.deleted"]);
  }, [d]);

  // ── Cœur : mettre / retirer des favoris ────────────────────────────────────
  // Les favoris remontent en tête : la liste est triée par date, et le parcours qu'on
  // refait chaque semaine descendait d'un cran à chaque nouveau tracé.
  //
  // On envoie la valeur VOULUE, pas une bascule : deux clics rapides ou deux onglets
  // ouverts, et une bascule aveugle laisserait le cœur plein à l'écran alors que la
  // base dit le contraire. Et si l'écriture échoue, on REVIENT en arrière — un cœur
  // qui reste plein sur un favori non enregistré est un mensonge à l'écran.
  const handleToggleFavorite = useCallback(async (route: SavedRoute) => {
    const voulu = !route.is_favorite;
    const trier = (rs: SavedRoute[]) => [...rs].sort((a, b) =>
      Number(b.is_favorite ?? false) - Number(a.is_favorite ?? false)
      || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    setSavedRoutes(prev => trier(prev.map(r => r.id === route.id ? { ...r, is_favorite: voulu } : r)));
    try {
      const r = await fetch("/api/routes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: route.id, isFavorite: voulu }),
      });
      if (!r.ok) throw new Error(String(r.status));
      // Le miroir local sert de repli quand la base est indisponible : le laisser
      // diverger ferait réapparaître l'ancien état au rechargement.
      const local = JSON.parse(localStorage.getItem("trail_routes") || "[]") as SavedRoute[];
      localStorage.setItem("trail_routes", JSON.stringify(
        local.map((x) => x.id === route.id ? { ...x, is_favorite: voulu } : x)));
    } catch {
      setSavedRoutes(prev => trier(prev.map(r => r.id === route.id ? { ...r, is_favorite: !voulu } : r)));
      toast.error(d["t.favErr"] ?? "Favori non enregistré");
    }
  }, [d]);

  /** Allume les sentiers balisés (calque « Randonnée » du tiroir), sans éteindre le reste. */
  const montrerSentiers = useCallback(() => setCalquesActifs((a) => (a.includes("rando") ? a : [...a, "rando"])), []);

  // ── Fly to a famous French trail ───────────────────────────────────────────
  const flyToPlace = useCallback((r: FamousRoute) => {
    allerA({ centre: [r.lat, r.lng], zoom: r.zoom });
    montrerSentiers(); // reveal GR/PR markings at the destination
    setFeuille(null);
    setTiroirOuvert(false);
    toast.success(`${r.emoji} ${r.name}`, { description: d["t.flyHint"] });
  }, [d, allerA, montrerSentiers]);

  // ── Handoff depuis la page « Découvrir des parcours » (sessionStorage) ───────
  // Soit on charge le tracé d'un parcours communautaire, soit on centre la carte
  // sur un parcours du catalogue pour que l'utilisateur le retrace facilement.
  const handoffDone = useRef(false);
  useEffect(() => {
    if (handoffDone.current) return;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem("te:openRoute"); } catch { raw = null; }
    if (!raw) return;
    handoffDone.current = true;
    try { sessionStorage.removeItem("te:openRoute"); } catch { /* ignore */ }

    let payload: {
      kind?: string; name?: string; lat?: number; lng?: number;
      zoom?: number; coordinates?: [number, number][];
    } | null = null;
    try { payload = JSON.parse(raw); } catch { payload = null; }
    if (!payload) return;

    if (payload.kind === "route" && Array.isArray(payload.coordinates) && payload.coordinates.length > 1) {
      handleLoadRoute({
        id: "shared",
        name: payload.name || d["sharedRoute"],
        coordinates: payload.coordinates,
        distance_km: 0,
        elevation_gain_m: 0,
        duration_min: 0,
        difficulty: "green",
        created_at: new Date().toISOString(),
      });
    } else if (payload.kind === "focus" && typeof payload.lat === "number" && typeof payload.lng === "number") {
      allerA({ centre: [payload.lat, payload.lng], zoom: payload.zoom ?? 12 });
      montrerSentiers(); // révèle les sentiers balisés autour du point
      if (payload.name) toast.success(`${payload.name}`, { description: d["t.focusHint"] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleLoadRoute]);

  // ── Chargement d'un parcours depuis le browser « Parcours » (même page) ──────
  // Le browser sous la carte génère un vrai tracé puis émet cet événement.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        { id?: number; name?: string; activity?: string; coordinates?: [number, number][] } | undefined;
      if (!detail?.coordinates || detail.coordinates.length < 2) return;
      // Règle l'activité du Trail Builder sur celle du parcours (sinon un parcours
      // vélo s'afficherait avec une allure de course à pied). La clé arrive déjà
      // décodée dans l'event (SPORT_ACTIVITY côté source) — aucun libellé à re-mapper ici.
      if (detail.activity && detail.activity in ACTIVITIES) { setActivity(detail.activity as ActivityKey); setManualSpeed(null); }
      handleLoadRoute({
        id: `parcours-${detail.id ?? "x"}`,
        name: detail.name || d["routeFallback"],
        coordinates: detail.coordinates,
        distance_km: 0, elevation_gain_m: 0, duration_min: 0,
        difficulty: "green", created_at: new Date().toISOString(),
      });
      // Sur téléphone, le parcours choisi s'ouvre directement en grand, comme une carte.
      if (window.matchMedia?.("(max-width: 767px)").matches) setPlein(true);
      else sectionCarte.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("te:loadRoute", handler);
    return () => window.removeEventListener("te:loadRoute", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleLoadRoute]);

  /** « Ma position » : une seule lecture, la carte y va, le point bleu s'y pose. */
  const allerAMaPosition = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { toast.error(d["t.geoUnavailable"]); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMaPosition(p);
        allerA({ centre: [p.lat, p.lng], zoom: 15 });
      },
      () => toast.error(d["t.gpsDenied"]),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );
  }, [d, allerA]);

  // ── Navigation en direct ───────────────────────────────────────────────────
  // Distance restante = point du tracé le plus proche de l'utilisateur → arrivée.
  const navRemainingKm = useMemo(() => {
    if (!userPos || allPoints.length < 2) return null;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < allPoints.length; i++) {
      const d = haversine(userPos, allPoints[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    let rem = 0;
    for (let i = best + 1; i < allPoints.length; i++) rem += haversine(allPoints[i - 1], allPoints[i]);
    return rem;
  }, [userPos, allPoints]);

  // Démarre / arrête le suivi GPS du navigateur (watchPosition).
  useEffect(() => {
    if (!navMode) {
      if (watchIdRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setUserPos(null); setNavAccuracy(null);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(d["t.geoUnavailable"]); setNavMode(false); return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNavAccuracy(pos.coords.accuracy); },
      () => { toast.error(d["t.gpsDenied"]); setNavMode(false); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    watchIdRef.current = id;
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; };
  }, [navMode]);

  // ── Partage live : diffuse la position via Supabase Realtime ───────────────────
  const startShare = useCallback(() => {
    // ⚠️ CET IDENTIFIANT EST LE SEUL SECRET DU LIEN DE SUIVI GPS EN DIRECT (08/11/2026) :
    // `Math.random` n'est pas fait pour ça. Même tirage que la veille de course.
    const sid = idPartage();
    setShareId(sid);
    setSharing(true);
    setNavMode(true);
    const link = `${window.location.origin}/suivre/${sid}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(
        () => toast.success(d["t.shareCopied"]),
        () => toast.success(tb("t.shareLink", { link })),
      );
    } else {
      toast.success(tb("t.shareLink", { link }));
    }
  }, [d]);

  // Canal de diffusion (répond aux spectateurs qui demandent le tracé).
  useEffect(() => {
    if (!sharing || !shareId) {
      if (shareChanRef.current) { try { shareChanRef.current.unsubscribe(); } catch { /* ignore */ } shareChanRef.current = null; }
      return;
    }
    const supabase = createClient();
    const chan = supabase.channel(`run-${shareId}`, { config: { broadcast: { self: false } } });
    chan.on("broadcast", { event: "req" }, () => {
      // Le tracé ACTUEL (réf.), pas celui de l'ouverture du partage.
      chan.send({ type: "broadcast", event: "route", payload: { coordinates: allPointsRef.current.map((p) => [p.lng, p.lat]) } });
    });
    chan.subscribe();
    shareChanRef.current = chan;
    return () => { try { chan.unsubscribe(); } catch { /* ignore */ } if (shareChanRef.current === chan) shareChanRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, shareId]);

  // Diffuse la position à chaque mise à jour GPS.
  useEffect(() => {
    if (sharing && shareChanRef.current && userPos) {
      shareChanRef.current.send({ type: "broadcast", event: "pos", payload: { lat: userPos.lat, lng: userPos.lng, remaining: navRemainingKm } });
    }
  }, [userPos, sharing, navRemainingKm]);

  const hasRoute = allPoints.length > 1;
  const P = PX[lang] ?? PX.fr;
  /** Les pastilles ne s'affichent que sur une carte vide : pendant un tracé, elles gêneraient le doigt. */
  const montrerPropositions = !navMode && reperes.length === 0;
  const besoinPropositions = montrerPropositions || tiroirOuvert;
  useEffect(() => {
    if (!besoinPropositions || !centreVu) return;
    const [lat, lng] = centreVu;
    const avant = dernierePropo.current;
    // On ne relit pas pour un déplacement de moins de 2 km avec le même sport et la même recherche.
    if (avant && avant.sport === sportPropose && avant.q === rechercheDiff && distanceKm({ lat, lng }, avant) < 2) return;
    const ctrl = new AbortController();
    const minuterie = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ near: `${lat.toFixed(3)},${lng.toFixed(3)}`, sort: "proche", sport: sportPropose, q: rechercheDiff, pageSize: "20", page: "1" });
        const r = await fetch(`/api/parcours?${q}`, { signal: ctrl.signal });
        const j = await r.json() as { items?: ParcoursHdf[]; total?: number };
        if (ctrl.signal.aborted) return;
        // ⚠️ UNE PANNE SE DIT : sans réponse lisible, la liste dit « ne se charge pas », jamais
        // « aucun parcours ici » (ce serait faux).
        if (!r.ok || !Array.isArray(j.items)) { setEtatPropositions("erreur"); return; }
        dernierePropo.current = { lat, lng, sport: sportPropose, q: rechercheDiff };
        setPropositions(j.items);
        setPagePropo(1);
        setTotalPropo(typeof j.total === "number" ? j.total : j.items.length);
        setEtatPropositions("ok");
      } catch {
        if (!ctrl.signal.aborted) setEtatPropositions("erreur");
      }
    }, 600);
    return () => { clearTimeout(minuterie); ctrl.abort(); };
  }, [besoinPropositions, centreVu, sportPropose, rechercheDiff]);

  /** La page suivante, toujours triée par distance : on finit par parcourir toute la France. */
  const afficherPlus = async () => {
    const avant = dernierePropo.current;
    if (!avant || plusEnCours) return;
    setPlusEnCours(true);
    try {
      const q = new URLSearchParams({ near: `${avant.lat.toFixed(3)},${avant.lng.toFixed(3)}`, sort: "proche", sport: avant.sport, q: avant.q, pageSize: "20", page: String(pagePropo + 1) });
      const r = await fetch(`/api/parcours?${q}`);
      const j = await r.json() as { items?: ParcoursHdf[] };
      if (!r.ok || !Array.isArray(j.items)) { toast.error(d["parcoursErreur"]); return; }
      setPropositions((x) => [...x, ...j.items!.filter((p) => !x.some((y) => y.id === p.id))]);
      setPagePropo((n) => n + 1);
    } catch {
      toast.error(d["parcoursErreur"]);
    } finally {
      setPlusEnCours(false);
    }
  };

  /** Distance d'un parcours au centre regardé (km), pour la liste. */
  const aDistance = (p: ParcoursHdf) => (centreVu && typeof p.lat === "number" && typeof p.lng === "number"
    ? distanceKm({ lat: centreVu[0], lng: centreVu[1] }, { lat: p.lat, lng: p.lng }) : null);
  /** Les pastilles : seulement les parcours à moins de 40 km, avec un départ connu. */
  const pastilles = useMemo(() => (montrerPropositions ? propositions : [])
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number" && (!centreVu || distanceKm({ lat: centreVu[0], lng: centreVu[1] }, { lat: p.lat!, lng: p.lng! }) < 40))
    .map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, couleur: SPORT_META[p.sport]?.color ?? "#059669" })),
  [montrerPropositions, propositions, centreVu]);
  const toucherProposition = useCallback((id: number) => {
    const p = propositions.find((x) => x.id === id);
    if (p) { setChoisi(p); setFeuille("choisi"); }
  }, [propositions]);
  /** Charge un parcours proposé, par la liste du dessous (mêmes contrôles qu'un clic dans la liste). */
  const chargerPropose = (p: ParcoursHdf) => {
    window.dispatchEvent(new CustomEvent("te:chargerParcours", { detail: p }));
    setFeuille(null);
    setTiroirOuvert(false);
  };
  /** La poignée : un toucher bascule, un glissé vers le haut ouvre, vers le bas ferme. */
  const poignee = {
    onClick: () => setTiroirOuvert((o) => !o),
    onTouchStart: (e: React.TouchEvent) => { departGlisse.current = e.touches[0].clientY; },
    onTouchEnd: (e: React.TouchEvent) => {
      const dep = departGlisse.current; departGlisse.current = null;
      if (dep === null) return;
      const dy = e.changedTouches[0].clientY - dep;
      if (dy < -25) { e.preventDefault(); setTiroirOuvert(true); }
      else if (dy > 25) { e.preventDefault(); setTiroirOuvert(false); }
    },
  };

  // Annuler / rétablir au clavier (ordinateur) : Ctrl+Z, Ctrl+Maj+Z.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const cible = e.target as HTMLElement | null;
      if (cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (e.shiftKey) handleRedo(); else handleUndo();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [handleUndo, handleRedo]);

  // ── LES MODÈLES PROPOSÉS ICI : selon la clé et le PAYS regardé ──────────────
  const centreModeles: [number, number] | null = reperes[0] ? [reperes[0].lat, reperes[0].lng]
    : maPosition ? [maPosition.lat, maPosition.lng] : centre ? [centre.lat, centre.lon] : null;
  const cleCentre = centreModeles ? `${centreModeles[0].toFixed(1)},${centreModeles[1].toFixed(1)}` : "";
  const fondsDispo = useMemo(() => fondsDisponibles(CLE_MAPTILER, centreModeles), [cleCentre]); // eslint-disable-line react-hooks/exhaustive-deps
  const calquesDispo = useMemo(() => calquesDisponibles(CLE_MAPTILER, centreModeles), [cleCentre]); // eslint-disable-line react-hooks/exhaustive-deps
  // Un fond qui n'existe plus ici (on a changé de pays) retombe sur Pacevo, jamais sur du vide.
  const fondChoisi: FondCarte = fondsDispo.find((f) => f.id === fondCarte) ?? fondsDispo[0];
  const calquesAllumes: CalqueCarte[] = calquesDispo.filter((c) => calquesActifs.includes(c.id));
  /** Ce qui est allumé en plus du plan : la pastille du bouton des calques, comme Strava. */
  const nbCalques = calquesAllumes.filter((c) => c.id !== "poi").length + (relief3d ? 1 : 0);

  const reperesCarte = useMemo(() => reperes.map((r, i) => ({
    lat: r.lat, lng: r.lng,
    couleur: i === 0 ? COULEUR_DEPART : i === reperes.length - 1 ? COULEUR_ARRIVEE : COULEUR_ETAPE,
  })), [reperes]);
  const traceCarte = useMemo(() => allPoints.map((p) => [p.lat, p.lng] as [number, number]), [allPoints]);
  const positionCarte: [number, number] | null = userPos ? [userPos.lat, userPos.lng] : maPosition ? [maPosition.lat, maPosition.lng] : null;

  /** La ligne du haut du bloc de chiffres : ce qu'il faut faire maintenant. */
  const titreCarte = navMode
    ? (userPos ? d["live"] : d["searchingGps"]) + (navRemainingKm != null ? ` · ${fmtKm(navRemainingKm, lang, 1)} ${d["remaining"]}` : "") + (navAccuracy != null ? ` · ±${Math.round(navAccuracy)} m` : "")
    : routeLoading ? d["computing"]
    : reperes.length === 0 ? d["emptyHint"]
    : reperes.length === 1 ? d["hint.suivant"]
    : routeName.trim() || d["titreParcours"];

  return (
    <section
      ref={sectionCarte}
      style={plein ? { margin: 0 } : undefined}
      className={plein
        ? "fixed inset-0 z-[2000] overflow-hidden bg-white"
        : "relative isolate -mx-3 h-[calc(100dvh-12rem)] min-h-[520px] overflow-hidden md:mx-0 md:rounded-2xl md:border md:border-zinc-200"}
    >
      <CarteDirect
        position={positionCarte}
        track={traceCarte}
        centre={centre ? [centre.lat, centre.lon] : null}
        fond={fondChoisi}
        calques={calquesAllumes}
        suivre={navMode && suiviNav}
        onDeplacement={() => setSuiviNav(false)}
        recentrer={recentrages}
        etiquette={d["mapAria"]}
        relief={relief3d}
        // Une feuille ouverte : un tap sur la carte la ferme, il ne pose pas un point caché dessous.
        // Tiroir ouvert : un tap sur la carte le referme (il ne pose pas de point).
        onClic={feuille ? fermerFeuille : tiroirOuvert ? fermerTiroir : navMode ? undefined : handleMapClick}
        reperes={reperesCarte}
        couleurTrace={difficultyColor(difficulty)}
        vue={vue}
        creditPlus={d["credit"]}
        propositions={pastilles}
        onProposition={toucherProposition}
        onVue={changerCentreVu}
        className="h-full w-full"
      />

      {/* En grand écran, la flèche ⌄ en haut à gauche en sort — comme dans Enregistrer. */}
      {plein && (
        <button type="button" onClick={() => setPlein(false)} aria-label={d["reduire"]} title={d["reduire"]}
          className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[600] flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-zinc-700 shadow-[0_8px_18px_-8px_rgba(9,9,11,0.6)] ring-1 ring-black/5">
          <ChevronDown className="h-6 w-6" />
        </button>
      )}

      {/* Le calcul du chemin est en cours : on le dit, en haut, sans cacher la carte. */}
      {routeLoading && (
        <div className="pointer-events-none absolute left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[600] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-[0_8px_18px_-8px_rgba(9,9,11,0.6)] ring-1 ring-black/5">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            {d["computing"]}
          </div>
        </div>
      )}

      {/* Le bas de la carte. ⚠️ Mêmes règles qu'Enregistrer : les enveloppes ne prennent
          PAS le doigt (sinon la bande transparente des boutons avalerait les pincements),
          seuls les boutons, le bloc de chiffres et le tiroir le reprennent. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex flex-col">
        {/* Tiroir ouvert : la colonne et le bloc de chiffres s'effacent, la liste prend la place. */}
        <div className={`pointer-events-none mx-auto w-full max-w-md px-3 ${tiroirOuvert ? "hidden" : ""}`}>
          <div className="mb-2.5 flex flex-col items-end gap-2">
            <BtnCarte actif={feuille === "modeles"} titre={g["map.calques"]} onClick={() => setFeuille((f) => (f === "modeles" ? null : "modeles"))}>
              <Layers className="h-5 w-5" />
              {nbCalques > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{nbCalques}</span>
              )}
            </BtnCarte>
            {RELIEF_DISPO && (
              <BtnCarte actif={relief3d} titre={g["map.3d"]} onClick={() => setRelief3d((r) => !r)}>
                <span className="text-[15px] font-bold">3D</span>
              </BtnCarte>
            )}
            {/* Suivre le parcours en direct (point bleu, distance restante, partage). */}
            {hasRoute && !navMode && (
              <BtnCarte titre={d["followLive"]} onClick={() => { setSuiviNav(true); setNavMode(true); }}>
                <Navigation className="h-5 w-5 text-blue-600" />
              </BtnCarte>
            )}
            {navMode ? (
              <BtnCarte actif={suiviNav} titre={g["map.recentrer"]} onClick={() => { setSuiviNav(true); setRecentrages((n) => n + 1); }}>
                <LocateFixed className="h-5 w-5" />
              </BtnCarte>
            ) : (
              <BtnCarte titre={d["myPosition"]} onClick={allerAMaPosition}>
                <LocateFixed className="h-5 w-5" />
              </BtnCarte>
            )}
            {!plein && (
              <BtnCarte titre={d["plein"]} onClick={() => setPlein(true)}>
                <Maximize2 className="h-5 w-5" />
              </BtnCarte>
            )}
          </div>

          {/* Le bloc de chiffres : ce que l'on construit. Le chiffre du milieu en grand. */}
          <div className="pointer-events-auto mb-3 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_18px_40px_-18px_rgba(9,9,11,0.55)]">
            <div className={`flex h-9 items-center justify-center px-4 text-[13px] font-semibold ${navMode ? "bg-blue-50 text-blue-700" : routeLoading ? "bg-emerald-50 text-emerald-700" : "text-zinc-700"}`}>
              <span className="truncate">{titreCarte}</span>
            </div>
            <div className="grid grid-cols-3 items-end px-3 pb-3 pt-1">
              {/* Toucher le D+ ouvre (ou replie) le profil altimétrique. */}
              <button type="button" onClick={() => setShowElevation((v) => !v)} disabled={!hasRoute} aria-expanded={showElevation}
                aria-label={d["tg.elev"]} className="min-w-0 text-center">
                {/* ⚠️ « — » ET PAS « 0 m » quand l'altitude n'a pas pu être lue : un parcours
                    de montagne annoncé plat ferait partir quelqu'un sans s'attendre à 800 m. */}
                <div className={`text-[22px] font-bold leading-none tabular-nums ${altitudeIndispo ? "text-amber-600" : profilEnCours ? "text-zinc-300" : "text-zinc-900"}`}>
                  {altitudeIndispo ? "—" : profilEnCours ? "…" : elevGain}{!altitudeIndispo && !profilEnCours && <span className="ml-0.5 text-[11px] font-semibold text-zinc-400">m</span>}
                </div>
                <div className="mt-1 flex items-center justify-center gap-0.5 truncate text-[11px] font-semibold text-zinc-500">
                  D+{hasRoute && <ChevronDown className={`h-3 w-3 transition-transform ${showElevation ? "rotate-180" : ""}`} />}
                </div>
              </button>
              <div className="min-w-0 text-center">
                {/* Le chiffre en grand, l'unité en petit, sur UNE ligne : « 1,03 km » passait
                    à la ligne en 34 px dans le tiers de l'écran (banc d'essai, 27/11/2026). */}
                <div className="whitespace-nowrap text-[34px] font-bold leading-none tabular-nums text-zinc-900">
                  {distance < 1 ? Math.round(distance * 1000) : fmtNombre(distance, lang, 2)}
                  <span className="ml-0.5 text-[13px] font-semibold text-zinc-400">{distance < 1 ? "m" : "km"}</span>
                </div>
                <div className="mt-1 truncate text-[11px] font-semibold text-zinc-500 first-letter:uppercase">{d["st.distance"]}</div>
              </div>
              <div className="min-w-0 text-center">
                <div className="text-[22px] font-bold leading-none tabular-nums text-zinc-900">{formatDuration(durationMin)}</div>
                <div className="mt-1 flex items-center justify-center gap-1 truncate text-[11px] font-semibold text-zinc-500 first-letter:uppercase">
                  <IconeSport sport={activity} className="h-3 w-3" />{d["st.time"]}
                </div>
              </div>
            </div>
            {altitudeIndispo && <p className="px-3 pb-2 text-center text-[11px] leading-snug text-amber-700">{d["altIndispo"]}</p>}
          </div>
        </div>

        {/* Le tiroir du bas, blanc, avec sa poignée — comme Enregistrer. */}
        <div className={`pointer-events-auto rounded-t-[28px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-18px_rgba(9,9,11,0.45)] ${tiroirOuvert ? "max-h-[85dvh] overflow-y-auto overscroll-contain" : ""}`}>
          {/* La poignée : toute la largeur se touche (une barre de 6 px se rate au pouce). */}
          <button type="button" {...poignee} aria-expanded={tiroirOuvert} aria-label={tiroirOuvert ? d["tiroirFermer"] : d["tiroirOuvrir"]}
            className={`${tiroirOuvert ? "sticky top-0 z-10 bg-white" : ""} -mx-4 flex w-[calc(100%+2rem)] justify-center pb-3 pt-2`}>
            <span className={`h-1.5 w-10 rounded-full transition-colors ${tiroirOuvert ? "bg-zinc-400" : "bg-zinc-300"}`} aria-hidden />
          </button>
          {showElevation && hasRoute && elevations.length > 2 && !navMode && (
            <div className="mx-auto mb-3 max-w-xl">
              <ElevationProfile points={allPoints} elevations={elevations} totalKm={distance} gain={elevGain} loss={elevLoss}
                minAlt={elevMin} maxAlt={elevMax} difficulty={difficulty} />
            </div>
          )}
          {navMode ? (
            <div className="mx-auto flex max-w-md items-start justify-around">
              <ActionCarte etroit label={sharing ? d["shared"] : d["share"]} coche={sharing} onClick={() => { if (!sharing) startShare(); }}>
                <Share2 className="h-6 w-6 text-blue-600" />
              </ActionCarte>
              <GrosBouton label={d["stop"]} teinte="rouge" onClick={() => { setNavMode(false); setSharing(false); }}>
                <X className="h-8 w-8" />
              </GrosBouton>
              <ActionCarte etroit label={g["map.recentrer"]} onClick={() => { setSuiviNav(true); setRecentrages((n) => n + 1); }}>
                <LocateFixed className="h-6 w-6 text-zinc-600" />
              </ActionCarte>
            </div>
          ) : (
            // Tiroir ouvert : la poignée devient collante, le gros bouton (-mt-3) passait dessous.
            <div className={`mx-auto flex max-w-md items-start justify-around ${tiroirOuvert ? "mt-3" : ""}`}>
              <ActionCarte etroit label={d["undo"]} disabled={!reperes.length} onClick={handleUndo}>
                <Undo2 className="h-6 w-6 text-zinc-700" />
              </ActionCarte>
              <GrosBouton label={hasRoute ? d["save"] : d["mesParcours"]} teinte="emerald" onClick={() => setFeuille("parcours")}>
                {hasRoute ? <Save className="h-8 w-8" /> : <Bookmark className="h-8 w-8" />}
              </GrosBouton>
              <ActionCarte etroit label={d["clear"]} danger disabled={!reperes.length} onClick={handleClear}>
                <Trash2 className="h-6 w-6 text-red-600" />
              </ActionCarte>
              <ActionCarte etroit label={g["map.reglages"]} onClick={() => setFeuille("reglages")}>
                <SlidersHorizontal className="h-6 w-6 text-zinc-600" />
              </ActionCarte>
            </div>
          )}
          {/* ══ TIROIR OUVERT : TOUS LES PARCOURS DE FRANCE, LES PLUS PROCHES D'ABORD ══ */}
          {tiroirOuvert && (
            <div className="mx-auto mt-5 max-w-xl border-t border-zinc-100 pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[17px] font-bold text-zinc-900">{d["parcoursProches"]}</p>
                {etatPropositions === "ok" && totalPropo > 0 && <span className="text-[12px] text-zinc-500">{tb("parcoursTotal", { n: fmtNombre(totalPropo, lang, 0) })}</span>}
              </div>
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={d["parcoursRecherche"]} aria-label={d["parcoursRecherche"]}
                type="search" className="mt-3 w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
              <p className="mt-2 text-[13px] text-zinc-500">{d["parcoursAide"]}</p>
              <div className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {/* `concat` et pas `...SPORTS` : tests/bundle lit `.SPORTS` comme une variable d'environnement. */}
                {(["all"] as ("all" | SportHdf)[]).concat(SPORTS).map((s) => (
                  <button key={s} type="button" onClick={() => { if (s !== sportPropose) { setSportPropose(s); setEtatPropositions("attente"); } }} aria-pressed={sportPropose === s}
                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${sportPropose === s ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                    <IconeSport sport={s} className="h-3.5 w-3.5" />
                    {s === "all" ? d["parcoursTous"] : P[`sport.${s}`] ?? s}
                  </button>
                ))}
              </div>
              {etatPropositions === "erreur" ? (
                <p className="py-6 text-center text-sm text-amber-700">{d["parcoursErreur"]}</p>
              ) : etatPropositions === "attente" ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
              ) : propositions.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">{d["parcoursAucun"]}</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {propositions.map((p) => {
                    const km = aDistance(p);
                    return (
                      <button key={p.id} type="button" onClick={() => chargerPropose(p)}
                        className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-zinc-50">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: SPORT_META[p.sport]?.color ?? "#059669" }}>
                          <IconeSport sport={p.sport} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-zinc-900">{p.nom}</span>
                          <span className="block truncate text-[12px] text-zinc-500">
                            {fmtKm(p.distance_km, lang, 1)} · +{Math.round(p.denivele_positif_m)} m · {P[`diff.${p.difficulte}`] ?? p.difficulte}
                            {km != null && <> · {tb("parcoursA", { d: fmtKm(km, lang, km < 10 ? 1 : 0) })}</>}
                            {p.courable && p.sport !== "Running" && <> · {P["courable"]}</>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {propositions.length < totalPropo && (
                    <button type="button" onClick={afficherPlus} disabled={plusEnCours}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-2.5 text-[14px] font-semibold text-zinc-700 disabled:opacity-60">
                      {plusEnCours && <Loader2 className="h-4 w-4 animate-spin" />} {d["parcoursPlus"]}
                    </button>
                  )}
                </div>
              )}
              {/* Les grands parcours de France, au même endroit : un seul bouton pour trouver un parcours. */}
              <p className="mt-5 text-[15px] font-bold text-zinc-900">{d["famousTitle"]}</p>
              <div className="mt-1 space-y-1">
                {FAMOUS_ROUTES.map((r) => (
                  <button key={r.name} type="button" onClick={() => flyToPlace(r)}
                    className="group flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-left transition-colors hover:bg-zinc-100">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-900">{r.name}</div>
                      <div className="truncate text-[12px] text-zinc-500">{r.region} · {tbDesc(r.distance)} · {tbDesc(r.elevation)}</div>
                    </div>
                    <MapPin className="h-4 w-4 flex-shrink-0 text-zinc-300 group-hover:text-emerald-500" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ LE TIROIR DES MODÈLES : le même qu'Enregistrer (components/carte) ══ */}
      {feuille === "modeles" && (
        <TiroirModeles
          fonds={fondsDispo} calques={calquesDispo} fondChoisi={fondChoisi} onFond={setFondCarte}
          calquesActifs={calquesActifs}
          onCalque={(id) => setCalquesActifs((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))}
          relief3d={relief3d} onRelief={() => setRelief3d((r) => !r)} reliefDispo={RELIEF_DISPO}
          coin={centreModeles ?? [48.8566, 2.3522]} onFermer={() => setFeuille(null)}
        />
      )}

      {/* ══ RÉGLAGES : chemins, profil, activité, allure visée, export ══ */}
      {feuille === "reglages" && (
        <Feuille titre={d["reglages"]} fermer={d["fermer"]} onFermer={() => setFeuille(null)}>
          <div className="space-y-1">
            <LigneReglage label={d["tg.follow"]}><Toggle id="tg-follow-m" checked={followPaths} onChange={setFollowPaths} label="" /></LigneReglage>
            <LigneReglage label={d["tg.elev"]}><Toggle id="tg-elev-m" checked={showElevation} onChange={setShowElevation} label="" /></LigneReglage>
          </div>
          <p className="mt-4 text-[15px] font-bold text-zinc-900">{d["activite"]}</p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {(Object.keys(ACTIVITIES) as ActivityKey[]).map((k) => (
              <button key={k} type="button" onClick={() => { setActivity(k); setManualSpeed(null); }} aria-pressed={activity === k}
                className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-semibold ${activity === k ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                <IconeSport sport={k} className="h-4 w-4" />
                {d[`act.${k}`]}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <p className="text-[15px] font-bold text-zinc-900">{speedCfg.mode === "pace" ? d["paceTarget"] : d["speedTarget"]}</p>
            <button type="button" onClick={() => setManualSpeed(null)} disabled={manualSpeed === null}
              className="flex items-center gap-1 rounded-md px-1 text-[12px] font-semibold text-emerald-600 disabled:text-zinc-300">
              <Gauge className="h-3.5 w-3.5" /> {d["auto"]}
            </button>
          </div>
          <div className="mt-1 text-center">
            <div className="text-3xl font-semibold tabular-nums text-zinc-900">
              {speedCfg.mode === "pace"
                ? <>{formatPace(paceMinPerKm)}<span className="text-base font-semibold text-zinc-400"> /km</span></>
                : <>{fmtNombre(speedKmh, lang, 1)}<span className="text-base font-semibold text-zinc-400"> km/h</span></>}
            </div>
            <div className="text-[11px] text-zinc-400">
              {manualSpeed === null ? d["autoEstimate"]
                : speedCfg.mode === "pace" ? tb("soitKmh", { v: fmtNombre(speedKmh, lang, 1) }) : tb("soitPace", { p: formatPace(paceMinPerKm) })}
            </div>
          </div>
          <input type="range" min={speedCfg.min} max={speedCfg.max} step={speedCfg.step}
            value={clamp(speedKmh, speedCfg.min, speedCfg.max)} onChange={(e) => setManualSpeed(Number(e.target.value))}
            aria-label={speedCfg.mode === "pace" ? d["paceRangeAria"] : d["speedRangeAria"]}
            className="mt-2 w-full cursor-pointer accent-emerald-600" />
          <div className="mt-1 flex justify-between text-[11px] font-medium text-zinc-400">
            <span>{speedCfg.mode === "pace" ? "7:00 /km" : "1 km/h"}</span>
            <span>{speedCfg.mode === "pace" ? "2:30 /km" : "50 km/h"}</span>
          </div>
          {/* Export GPX : formules payantes. Sans le droit, le bouton mène aux formules
              au lieu de disparaître — l'athlète doit savoir que la fonction existe. */}
          <div className="mt-5">
            {exportGpx ? (
              <button type="button" onClick={handleExportGPX} disabled={!hasRoute}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-800 disabled:opacity-40">
                <Download className="h-4 w-4" /> {d["exportGpx"]}
              </button>
            ) : (
              <Link href="/pricing" title={d["gpxVerrou"]} aria-label={d["gpxVerrou"]}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-500">
                <Lock className="h-4 w-4" /> {d["exportGpx"]}
              </Link>
            )}
          </div>
        </Feuille>
      )}

      {/* ══ ENREGISTRER + MES PARCOURS ══ */}
      {feuille === "parcours" && (
        <Feuille titre={hasRoute ? d["save"] : d["mesParcours"]} fermer={d["fermer"]} onFermer={() => setFeuille(null)}>
          {hasRoute && (
            <>
              <input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder={d["routeNamePh"]} aria-label={d["routeNameAria"]}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
              <button type="button" onClick={handleSave} disabled={saving || !routeName.trim() || profilEnCours || routeLoading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-40">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {d["save"]}
              </button>
            </>
          )}
          <p className="mt-5 text-[15px] font-bold text-zinc-900">{tb("myRoutes", { n: savedRoutes.length })}</p>
          {loadingRoutes ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
          ) : savedRoutes.length === 0 ? (
            <p className="py-3 text-center text-sm text-zinc-400">{d["noRoutes"]}</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {savedRoutes.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-2xl bg-zinc-50 p-2.5">
                  <div className="w-1.5 flex-shrink-0 self-stretch rounded-full" style={{ backgroundColor: difficultyColor(r.difficulty) }} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { handleLoadRoute(r); setFeuille(null); }}>
                    <div className="truncate text-sm font-semibold text-zinc-900">{r.name}</div>
                    <div className="text-xs text-zinc-500">{fmtKm(r.distance_km, lang, 1)}{r.elevation_gain_m != null && ` · +${r.elevation_gain_m}m`}</div>
                  </button>
                  <button type="button" onClick={() => handleToggleFavorite(r)}
                    aria-label={tb(r.is_favorite ? "unfavRoute" : "favRoute", { name: r.name })} aria-pressed={!!r.is_favorite}
                    className={`p-2 ${r.is_favorite ? "text-rose-500" : "text-zinc-300"}`}>
                    <Heart className="h-4 w-4" fill={r.is_favorite ? "currentColor" : "none"} />
                  </button>
                  <button type="button" onClick={() => handleDeleteRoute(r.id)} aria-label={tb("delRoute", { name: r.name })} className="p-2 text-zinc-300 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Feuille>
      )}

      {/* ══ UN PARCOURS TOUCHÉ SUR LA CARTE : sa fiche, et le charger ══ */}
      {feuille === "choisi" && choisi && (
        <Feuille titre={choisi.nom} fermer={d["fermer"]} onFermer={() => setFeuille(null)}>
          <div className="flex items-center gap-2 text-[13px] text-zinc-600">
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ backgroundColor: SPORT_META[choisi.sport]?.color ?? "#059669" }}>
              <IconeSport sport={choisi.sport} className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold text-zinc-900">{P[`sport.${choisi.sport}`] ?? choisi.sport}</span>
            <span>· {P[`diff.${choisi.difficulte}`] ?? choisi.difficulte}</span>
            {choisi.localisation?.region && <span className="truncate">· {choisi.localisation.region}</span>}
          </div>
          {choisi.osm_type && choisi.osm_type !== "relation" && choisi.osm_type !== "way" && choisi.source && <p className="mt-1.5 text-[12px] text-zinc-400">{P["source"]} : {choisi.source}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-zinc-50 p-3 text-center">
              <div className="text-[20px] font-bold tabular-nums text-zinc-900">{fmtKm(choisi.distance_km, lang, 1)}</div>
              <div className="text-[11px] font-semibold text-zinc-500 first-letter:uppercase">{d["st.distance"]}</div>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3 text-center">
              <div className="text-[20px] font-bold tabular-nums text-zinc-900">+{Math.round(choisi.denivele_positif_m)} m</div>
              <div className="text-[11px] font-semibold text-zinc-500">D+</div>
            </div>
          </div>
          <button type="button" onClick={() => chargerPropose(choisi)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-[15px] font-semibold text-white">
            <RouteIcon className="h-4 w-4" /> {d["parcoursCharger"]}
          </button>
          <button type="button" onClick={() => { setFeuille(null); setTiroirOuvert(true); }}
            className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-[15px] font-semibold text-zinc-700">
            {d["parcoursListe"]}
          </button>
        </Feuille>
      )}

    </section>
  );
}

/** Une feuille du bas, du même dessin que le tiroir des modèles (poignée, titre collé, ✕). */
function Feuille({ titre, fermer, onFermer, children }: { titre: string; fermer: string; onFermer: () => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-label={titre}
      className="absolute inset-x-0 bottom-0 z-[650] mx-auto max-h-[80%] max-w-xl overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_40px_-12px_rgba(9,9,11,0.5)]">
      <div className="sticky top-0 z-10 -mx-5 mb-2 bg-white px-5 pb-2 pt-0.5">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-zinc-200" aria-hidden />
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-bold text-zinc-900">{titre}</p>
          <button type="button" onClick={onFermer} aria-label={fermer} className="rounded-full p-1.5 text-zinc-700 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Une ligne de réglage : libellé à gauche, interrupteur à droite. */
function LigneReglage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between rounded-xl px-1">
      <span className="text-sm font-medium text-zinc-800">{label}</span>{children}
    </div>
  );
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────
// iOS-style toggle switch (toolbar)
function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${checked ? "bg-emerald-500" : "bg-zinc-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </button>
      <label htmlFor={id} className="text-xs font-medium text-zinc-700 cursor-pointer select-none whitespace-nowrap">{label}</label>
    </div>
  );
}

// ─── Elevation profile (full-width footer, like a real route planner) ──────────
function ElevationProfile({
  points, elevations, totalKm, gain, loss, minAlt, maxAlt, difficulty,
}: {
  points: LatLng[]; elevations: number[]; totalKm: number;
  gain: number; loss: number; minAlt: number; maxAlt: number; difficulty: string;
}) {
  const { lang } = useT();
  const d = TB[lang] ?? TB.fr;
  const n = Math.min(points.length, elevations.length);
  if (n < 2) return null;

  const cum: number[] = [0];
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + haversine(points[i - 1], points[i]);
  const total = cum[n - 1] || totalKm || 1;

  const step = Math.max(1, Math.floor(n / 400));
  const idx: number[] = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  const es = idx.map(i => elevations[i] ?? 0);
  const lo = Math.min(...es), hi = Math.max(...es);
  const range = Math.max(hi - lo, 1);

  const W = 1200, H = 150, padL = 46, padR = 18, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const xAt = (d: number) => padL + (d / total) * plotW;
  const yAt = (e: number) => padT + plotH - ((e - lo) / range) * plotH;

  const line = idx.map((i, k) => `${xAt(cum[i]).toFixed(1)},${yAt(es[k]).toFixed(1)}`).join(" ");
  const area = `${padL},${(padT + plotH).toFixed(1)} ${line} ${xAt(total).toFixed(1)},${(padT + plotH).toFixed(1)}`;

  const fmtX = (km: number) => total < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
  const xticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map(f => f * total);
  const yticks = [lo, lo + range / 2, hi];
  const label = d[`diff.${difficulty}`] ?? d["diff.black"];

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-4 pt-3 pb-1">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-800">{d["elevProfile"]}</span>
          <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-white" style={{ backgroundColor: difficultyColor(difficulty) }}>{label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-emerald-600">D+ {Math.round(gain)} m</span>
          <span className="font-semibold text-red-500">D− {Math.round(loss)} m</span>
          <span className="text-zinc-400">min {Math.round(minAlt)} m</span>
          <span className="text-zinc-400">max {Math.round(maxAlt)} m</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={fillT(d["elevAria"], { gain: Math.round(gain), loss: Math.round(loss) })}>
        <defs>
          <linearGradient id="elev-grad-lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {yticks.map((e, i) => (
          <g key={i}>
            <line x1={padL} y1={yAt(e)} x2={W - padR} y2={yAt(e)} stroke="#f1f1f3" strokeWidth="1" />
            <text x={padL - 6} y={yAt(e) + 3} fontSize="11" fill="#a1a1aa" textAnchor="end">{Math.round(e)}</text>
          </g>
        ))}
        <polygon points={area} fill="url(#elev-grad-lg)" />
        <polyline points={line} fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {xticks.map((d, i) => (
          <text key={i} x={xAt(d)} y={H - 6} fontSize="11" fill="#a1a1aa"
            textAnchor={i === 0 ? "start" : i === xticks.length - 1 ? "end" : "middle"}>{fmtX(d)}</text>
        ))}
      </svg>
    </div>
  );
}

/** Distance à vol d'oiseau, en km. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversine(a, b);
}
