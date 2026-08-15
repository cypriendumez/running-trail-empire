"use client";

import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Undo2, Redo2, Trash2, Download, Save, Loader2,
  ChevronDown, X, MapPin, Mountain, Search, Layers, Bookmark, Heart,
  SlidersHorizontal, Gauge, Navigation, Share2
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/LanguageProvider";
import { TB, fillT } from "./trailI18n";

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

// ─── Tile layers ──────────────────────────────────────────────────────────────
// MapTiler "Outdoor" = the premium relief + yellow dashed paths + POI look.
// Set NEXT_PUBLIC_MAPTILER_KEY in .env.local to enable it (free tier is plenty).
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";

// Metropolitan France (incl. Corsica). The map is locked inside these bounds so
// the user can only explore France — no panning off into the rest of the world.
const FRANCE_BOUNDS: [[number, number], [number, number]] = [
  [41.0, -5.6],  // SW corner
  [51.6, 9.8],   // NE corner
];

const LAYERS = {
  outdoor: {
    label: "🌲 Plein air",
    url: `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
    attribution: "© MapTiler © OpenStreetMap",
    maxZoom: 20,
    maxNativeZoom: 20,
    subdomains: false,
  },
  paths: {
    label: "🥾 Chemins",
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    attribution: "© CyclOSM · OpenStreetMap",
    maxZoom: 20,
    maxNativeZoom: 20,
  },
  topo: {
    label: "🗺️ Topo",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap",
    maxZoom: 19,
    maxNativeZoom: 17,
  },
  street: {
    label: "🏙️ Plan",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap",
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  satellite: {
    label: "🛰️ Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri World Imagery",
    maxZoom: 20,
    maxNativeZoom: 19,
    subdomains: false,
  },
};

// ─── Hiking trails overlay (Waymarked Trails — shows GR/PR sentiers) ──────────
const HIKING_OVERLAY = {
  url: "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png",
  attribution: "© Waymarked Trails",
  maxZoom: 18,
};

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
  { name: "Tour du Mont-Blanc", region: "Chamonix · Alpes", emoji: "🏔", lat: 45.923, lng: 6.869, zoom: 11, distance: "170 km", elevation: "+10 000 m" },
  { name: "GR20 Corse", region: "Calenzana → Conca", emoji: "🌲", lat: 42.300, lng: 9.050, zoom: 9, distance: "180 km", elevation: "+12 000 m" },
  { name: "GR10 Pyrénées", region: "Hendaye → Banyuls", emoji: "⛰", lat: 42.800, lng: 0.700, zoom: 8, distance: "920 km", elevation: "+48 000 m" },
  { name: "GR34 Sentier des Douaniers", region: "Côte de Bretagne", emoji: "🌊", lat: 48.600, lng: -3.900, zoom: 9, distance: "2 000 km", elevation: "vallonné" },
  { name: "Calanques de Marseille", region: "Marseille → Cassis", emoji: "🏖", lat: 43.215, lng: 5.460, zoom: 13, distance: "20 km", elevation: "+900 m" },
  { name: "Gorges du Verdon (GR4)", region: "Verdon · Provence", emoji: "🏞", lat: 43.750, lng: 6.330, zoom: 12, distance: "15 km", elevation: "+700 m" },
  { name: "Mont Ventoux", region: "Bédoin · Vaucluse", emoji: "🚵", lat: 44.174, lng: 5.278, zoom: 12, distance: "21 km", elevation: "+1 600 m" },
  { name: "Sentier du Littoral", region: "Côte d'Azur", emoji: "🌅", lat: 43.530, lng: 7.130, zoom: 12, distance: "variable", elevation: "plat" },
];

// ─── Activity profiles (flat speed km/h + climb penalty min per +100 m) ───────
const ACTIVITIES = {
  course: { label: "Course", emoji: "🏃", flat: 11,  climb: 6,  primary: "pace"  },
  marche: { label: "Marche", emoji: "🚶", flat: 4.8, climb: 10, primary: "speed" },
  trail:  { label: "Trail",  emoji: "🥾", flat: 8.5, climb: 9,  primary: "pace"  },
  velo:   { label: "Vélo",   emoji: "🚴", flat: 19,  climb: 3,  primary: "speed" },
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

function buildGPX(name: string, pts: LatLng[], elevations: number[]): string {
  const trk = pts.map((p, i) =>
    `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">${elevations[i] != null ? `<ele>${elevations[i].toFixed(1)}</ele>` : ""}</trkpt>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pacevo"
     xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name}</name>
    <trkseg>
${trk}
    </trkseg>
  </trk>
</gpx>`;
}

// ─── OSRM routing (follows real paths) ───────────────────────────────────────
async function fetchRoute(a: LatLng, b: LatLng): Promise<LatLng[] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${a.lng},${a.lat};${b.lng},${b.lat}?geometries=geojson&overview=full`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (!coords) return null;
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return null;
  }
}

// ─── City search / geocoding (restricted to France) ──────────────────────────
// (Recherche de ville supprimée — la recherche globale de la barre du haut s'en charge.)

// ─── Elevation from open-meteo ────────────────────────────────────────────────
async function fetchElevations(pts: LatLng[]): Promise<number[]> {
  if (!pts.length) return [];
  // Sample at most 100 points evenly
  const step = Math.max(1, Math.floor(pts.length / 100));
  const sampled = pts.filter((_, i) => i % step === 0);
  try {
    const lats = sampled.map(p => p.lat.toFixed(5)).join(",");
    const lngs = sampled.map(p => p.lng.toFixed(5)).join(",");
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return new Array(pts.length).fill(0);
    const data = await res.json();
    const elevs: number[] = data.elevation ?? [];
    // Expand back to full length
    return pts.map((_, i) => elevs[Math.floor(i / step)] ?? 0);
  } catch {
    return new Array(pts.length).fill(0);
  }
}

function elevStats(elevs: number[]) {
  let gain = 0, loss = 0;
  for (let i = 1; i < elevs.length; i++) {
    const d = elevs[i] - elevs[i - 1];
    if (d > 0) gain += d; else loss += -d;
  }
  return {
    gain, loss,
    min: elevs.length ? Math.min(...elevs) : 0,
    max: elevs.length ? Math.max(...elevs) : 0,
  };
}

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
export function TrailBuilder() {
  const { lang } = useT();
  const d = TB[lang] ?? TB.fr;
  const tb = (k: string, p?: Record<string, string | number>) => fillT(d[k] ?? k, p);
  // Traduit les descripteurs de relief des presets (« vallonné »/« plat »/« variable »), garde le reste (distances) intact.
  const tbDesc = (s: string) => d[`desc.${s}`] ?? s;
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const polylineRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const baseLayerRef = useRef<unknown>(null);
  const overlayRef = useRef<unknown>(null);
  const initRef = useRef(false); // synchronous guard against React Strict Mode double-init

  const [layer, setLayer] = useState<keyof typeof LAYERS>(MAPTILER_KEY ? "outdoor" : "topo");
  const [showLayers, setShowLayers] = useState(false);
  const [showTrails, setShowTrails] = useState(!MAPTILER_KEY); // GR/PR overlay (off when Outdoor already shows paths)
  const [followPaths, setFollowPaths] = useState(true);
  const [showElevation, setShowElevation] = useState(true); // elevation profile panel below the map
  const [mounted, setMounted] = useState(false);
  const [showFamous, setShowFamous] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [showRoutesPanel, setShowRoutesPanel] = useState(false);
  const [activityMenuOpen, setActivityMenuOpen] = useState(false);

  // Route state — segments[] enables precise undo (each leg kept separate)
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [segments, setSegments] = useState<LatLng[][]>([]); // [ [p0], legPts, legPts… ]
  const [redoStack, setRedoStack] = useState<{ wp: LatLng; seg: LatLng[] }[]>([]); // for "Retour" (redo)
  const allPoints = useMemo(() => segments.flat(), [segments]);
  const [elevations, setElevations] = useState<number[]>([]);
  const [distance, setDistance] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityKey>("course");
  // Manual target speed in km/h. null = automatic (terrain-based) estimate.
  const [manualSpeed, setManualSpeed] = useState<number | null>(null);
  const [speedEditorOpen, setSpeedEditorOpen] = useState(false);
  const speedEditorRef = useRef<HTMLDivElement>(null);

  // Derived metrics (declared early so map effects can use them)
  const { gain: elevGain, loss: elevLoss, min: elevMin, max: elevMax } =
    useMemo(() => elevStats(elevations), [elevations]);
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
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // ── Navigation GPS en direct (point bleu qui se déplace) ──────────────────────
  const [navMode, setNavMode] = useState(false);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [navAccuracy, setNavAccuracy] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const userMarkerRef = useRef<unknown>(null);

  // Partage live (Supabase Realtime broadcast)
  const [sharing, setSharing] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shareChanRef = useRef<any>(null);

  // ── Init Leaflet ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainer.current || initRef.current) return;
    initRef.current = true; // set synchronously so Strict Mode's 2nd run bails out

    import("leaflet").then((L) => {
      // Fix default icon issue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const cfg = LAYERS[layer];
      const map = L.map(mapContainer.current!, {
        center: [46.85, 2.35],
        zoom: 6,
        minZoom: 5,
        zoomControl: false,
        maxBounds: L.latLngBounds(FRANCE_BOUNDS[0], FRANCE_BOUNDS[1]),
        maxBoundsViscosity: 1.0, // map stays solidly within France
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Tile layer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfgAny = cfg as any;
      const base = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        maxNativeZoom: cfgAny.maxNativeZoom ?? cfg.maxZoom,
        subdomains: "abc", // safe default; URLs without {s} simply ignore it
      }).addTo(map);
      baseLayerRef.current = base;

      // Scale control
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

      // Geolocation button
      const GeoBtn = L.Control.extend({
        onAdd() {
          const btn = L.DomUtil.create("button", "leaflet-bar leaflet-control bg-white hover:bg-gray-50 p-2 rounded shadow cursor-pointer border border-gray-300");
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`;
          btn.title = d["myPosition"];
          btn.setAttribute("aria-label", d["centerOnMe"]);
          btn.setAttribute("type", "button");
          L.DomEvent.on(btn, "click", () => {
            map.locate({ setView: true, maxZoom: 14 });
          });
          return btn;
        },
      });
      new GeoBtn({ position: "bottomright" }).addTo(map);

      mapRef.current = map;
      setMounted(true);

      // The container may not have its final size yet (flex/animation race) →
      // recompute once ready and shortly after, so tiles fill the viewport.
      map.whenReady(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 250);
    }).catch((err) => {
      console.error("[TrailBuilder] Leaflet init failed:", err);
      initRef.current = false; // allow a retry on next render
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep the map sized to its (flex) container ───────────────────────────────
  useEffect(() => {
    if (!mounted || !mapContainer.current) return;
    const el = mapContainer.current;
    const ro = new ResizeObserver(() => {
      (mapRef.current as { invalidateSize?: () => void } | null)?.invalidateSize?.();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);

  // ── Switch base tile layer (keeps overlay + route intact) ───────────────────
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as L.Map;
      if (baseLayerRef.current) map.removeLayer(baseLayerRef.current as L.TileLayer);
      const cfg = LAYERS[layer];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfgAny = cfg as any;
      const base = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        maxNativeZoom: cfgAny.maxNativeZoom ?? cfg.maxZoom,
        subdomains: "abc", // safe default; URLs without {s} simply ignore it
      }).addTo(map);
      base.bringToBack();
      baseLayerRef.current = base;
    });
  }, [layer, mounted]);

  // ── Hiking trails overlay (GR/PR sentiers) toggle ───────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as L.Map;
      if (showTrails && !overlayRef.current) {
        const ov = L.tileLayer(HIKING_OVERLAY.url, {
          attribution: HIKING_OVERLAY.attribution,
          maxZoom: HIKING_OVERLAY.maxZoom,
          opacity: 0.7,
        }).addTo(map);
        overlayRef.current = ov;
      } else if (!showTrails && overlayRef.current) {
        map.removeLayer(overlayRef.current as L.TileLayer);
        overlayRef.current = null;
      }
    });
  }, [showTrails, mounted]);

  // ── Update polyline on the map (white casing + colored core) ────────────────
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as L.Map;
      if (polylineRef.current) map.removeLayer(polylineRef.current as L.Layer);
      if (!allPoints.length) { polylineRef.current = null; return; }
      const latlngs = allPoints.map(p => [p.lat, p.lng] as [number, number]);
      const color = difficultyColor(difficulty);
      // Casing underneath for crisp contrast on any base map
      const casing = L.polyline(latlngs, {
        color: "#ffffff", weight: 8, opacity: 0.95, lineJoin: "round", lineCap: "round",
      });
      const core = L.polyline(latlngs, {
        color, weight: 4.5, opacity: 1, lineJoin: "round", lineCap: "round",
      });
      const group = L.layerGroup([casing, core]).addTo(map);
      polylineRef.current = group;
    });
  }, [allPoints, mounted, difficulty]);

  // ── Redraw waypoint markers ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as L.Map;
      markersRef.current.forEach(m => map.removeLayer(m as L.Marker));
      markersRef.current = [];
      waypoints.forEach((p, i) => {
        const isFirst = i === 0;
        const isLast = i === waypoints.length - 1 && waypoints.length > 1;
        const color = isFirst ? "#22c55e" : isLast ? "#ef4444" : "#3b82f6";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
          iconAnchor: [7, 7],
        });
        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
        markersRef.current.push(marker);
      });
    });
  }, [waypoints, mounted]);

  // ── Click handler for draw mode ────────────────────────────────────────────
  // segments stay aligned with waypoints: segments[i] is the leg arriving at
  // waypoints[i] (segments[0] = [start]). This makes undo perfectly precise.
  const handleMapClick = useCallback(async (latlng: LatLng) => {
    const prev = waypoints[waypoints.length - 1];
    setRedoStack([]); // a fresh point invalidates the redo history
    setWaypoints(wp => [...wp, latlng]);

    if (!prev) {
      setSegments([[latlng]]);
      return;
    }

    if (followPaths) {
      setRouteLoading(true);
      const routed = await fetchRoute(prev, latlng);
      setRouteLoading(false);
      const leg = routed ?? [prev, latlng];
      setSegments(s => [...s, leg.slice(1)]);
    } else {
      setSegments(s => [...s, [latlng]]);
    }
  }, [waypoints, followPaths]);

  // Attach click handler — drawing is always on (click adds a point, drag pans)
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    const map = mapRef.current as { on: (e: string, fn: (e: { latlng: { lat: number; lng: number } }) => void) => void; off: (e: string) => void };
    const fn = (e: { latlng: { lat: number; lng: number } }) => {
      handleMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    map.on("click", fn);
    return () => map.off("click");
  }, [mounted, handleMapClick]);

  // ── Update distance + elevation ────────────────────────────────────────────
  useEffect(() => {
    const d = totalDistance(allPoints);
    setDistance(d);

    if (allPoints.length >= 2) {
      fetchElevations(allPoints).then(elevs => setElevations(elevs));
    } else {
      setElevations([]);
    }
  }, [allPoints]);

  // ── Undo last waypoint (precise — drops exactly the last leg) ───────────────
  const handleUndo = useCallback(() => {
    if (!waypoints.length) return;
    const lastWp = waypoints[waypoints.length - 1];
    const lastSeg = segments[segments.length - 1] ?? [];
    setRedoStack(r => [...r, { wp: lastWp, seg: lastSeg }]);
    setWaypoints(wp => wp.slice(0, -1));
    setSegments(s => s.slice(0, -1));
  }, [waypoints, segments]);

  // ── Redo ("Retour") — re-add the last undone leg ────────────────────────────
  const handleRedo = useCallback(() => {
    setRedoStack(r => {
      if (!r.length) return r;
      const last = r[r.length - 1];
      setWaypoints(wp => [...wp, last.wp]);
      setSegments(s => [...s, last.seg]);
      return r.slice(0, -1);
    });
  }, []);

  const handleClear = useCallback(() => {
    setWaypoints([]);
    setSegments([]);
    setRedoStack([]);
    setElevations([]);
    setDistance(0);
    setSpeedEditorOpen(false);
  }, []);

  // Close the speed editor when clicking outside of it
  useEffect(() => {
    if (!speedEditorOpen) return;
    const onDown = (e: MouseEvent) => {
      if (speedEditorRef.current && !speedEditorRef.current.contains(e.target as Node)) {
        setSpeedEditorOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [speedEditorOpen]);

  // ── GPX export ────────────────────────────────────────────────────────────
  const handleExportGPX = useCallback(() => {
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
  }, [allPoints, elevations, routeName, d]);

  // ── Save route ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!allPoints.length) { toast.error(d["t.drawFirst"]); return; }
    if (!routeName.trim()) { toast.error(d["t.nameRoute"]); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: routeName,
          coordinates: allPoints.map(p => [p.lng, p.lat]),
          distance_km: distance,
          elevation_gain_m: elevGain,
          duration_min: durationMin,
          difficulty,
        }),
      });
      if (res.ok) {
        toast.success(d["t.savedDb"]);
        loadSavedRoutes();
      } else {
        // Save to localStorage as fallback
        const routes = JSON.parse(localStorage.getItem("trail_routes") || "[]");
        routes.unshift({
          id: Date.now().toString(),
          name: routeName,
          coordinates: allPoints.map(p => [p.lng, p.lat]),
          distance_km: Math.round(distance * 100) / 100,
          elevation_gain_m: Math.round(elevGain),
          duration_min: Math.round(durationMin),
          difficulty,
          created_at: new Date().toISOString(),
        });
        localStorage.setItem("trail_routes", JSON.stringify(routes.slice(0, 20)));
        setSavedRoutes(routes);
        toast.success(d["t.savedLocal"]);
      }
    } catch {
      toast.error(d["t.saveErr"]);
    } finally {
      setSaving(false);
    }
  }, [allPoints, routeName, distance, elevGain, durationMin, difficulty, d]);

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
      }
    } catch { /* ignore */ }
    // Fallback to localStorage
    const local = JSON.parse(localStorage.getItem("trail_routes") || "[]");
    setSavedRoutes(local);
    setLoadingRoutes(false);
  }, []);

  useEffect(() => { loadSavedRoutes(); }, [loadSavedRoutes]);

  // ── Load a saved route onto map ────────────────────────────────────────────
  const handleLoadRoute = useCallback((route: SavedRoute) => {
    const pts = route.coordinates.map(([lng, lat]) => ({ lat, lng }));
    setWaypoints([pts[0], pts[pts.length - 1]]);
    setSegments([[pts[0]], pts.slice(1)]);
    setRedoStack([]);
    setRouteName(route.name);
    // Pan map to route
    if (mapRef.current && mounted) {
      import("leaflet").then(L => {
        const map = mapRef.current as L.Map;
        const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40] });
      });
    }
    toast.success(tb("t.loaded", { name: route.name }));
  }, [mounted, d]);

  // ── Delete saved route ─────────────────────────────────────────────────────
  const handleDeleteRoute = useCallback(async (id: string) => {
    try {
      await fetch(`/api/routes?id=${id}`, { method: "DELETE" });
    } catch {}
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

  // ── Fly to a famous French trail ───────────────────────────────────────────
  const flyToPlace = useCallback((r: FamousRoute) => {
    if (!mapRef.current) return;
    const map = mapRef.current as {
      flyTo: (latlng: [number, number], zoom: number, opts?: { duration?: number }) => void;
    };
    map.flyTo([r.lat, r.lng], r.zoom, { duration: 1.4 });
    setShowTrails(true); // reveal GR/PR markings at the destination
    setShowFamous(false);
    toast.success(`${r.emoji} ${r.name}`, { description: d["t.flyHint"] });
  }, [d]);

  // ── Handoff depuis la page « Découvrir des parcours » (sessionStorage) ───────
  // Soit on charge le tracé d'un parcours communautaire, soit on centre la carte
  // sur un parcours du catalogue pour que l'utilisateur le retrace facilement.
  const handoffDone = useRef(false);
  useEffect(() => {
    if (!mounted || handoffDone.current) return;
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
      const lat = payload.lat, lng = payload.lng, zoom = payload.zoom ?? 12, name = payload.name;
      import("leaflet").then(() => {
        const map = mapRef.current as {
          flyTo: (latlng: [number, number], zoom: number, opts?: { duration?: number }) => void;
        } | null;
        map?.flyTo([lat, lng], zoom, { duration: 1.4 });
      });
      setShowTrails(true); // révèle les sentiers balisés autour du point
      if (name) toast.success(`📍 ${name}`, { description: d["t.focusHint"] });
    }
  }, [mounted, handleLoadRoute]);

  // ── Chargement d'un parcours depuis le browser « Parcours » (même page) ──────
  // Le browser sous la carte génère un vrai tracé (OSRM) puis émet cet événement.
  useEffect(() => {
    if (!mounted) return;
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
      mapContainer.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("te:loadRoute", handler);
    return () => window.removeEventListener("te:loadRoute", handler);
  }, [mounted, handleLoadRoute]);

  // ── Render ────────────────────────────────────────────────────────────────
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

  // Dessine / déplace le point bleu et recentre la carte sur l'utilisateur.
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as L.Map;
      if (!userPos) {
        if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current as L.Layer); userMarkerRef.current = null; }
        return;
      }
      if (userMarkerRef.current) {
        (userMarkerRef.current as L.Marker).setLatLng([userPos.lat, userPos.lng]);
      } else {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(37,99,235,.35),0 1px 6px rgba(0,0,0,.45)"></div>`,
          iconAnchor: [9, 9],
        });
        userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      }
      if (navMode) map.panTo([userPos.lat, userPos.lng], { animate: true, duration: 0.5 });
    });
  }, [userPos, navMode, mounted]);

  // ── Partage live : diffuse la position via Supabase Realtime ───────────────────
  const startShare = useCallback(() => {
    const sid = Math.random().toString(36).slice(2, 9);
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
      chan.send({ type: "broadcast", event: "route", payload: { coordinates: allPoints.map((p) => [p.lng, p.lat]) } });
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

  const hasRoute = allPoints.length > 0;
  return (
    <div className="flex flex-col gap-3 h-[80vh] min-h-[460px]">
      {/* ── MAP ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-zinc-200 shadow-sm min-h-0">
        <div
          ref={mapContainer}
          className="w-full h-full"
          style={{ cursor: "crosshair" }}
          role="application"
          aria-label={d["mapAria"]}
        />

        {!mounted && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        )}

        {/* ── TOP TOOLBAR (map-planner style) ──────────────────────────── */}
        <div className="absolute top-3 left-3 right-3 z-[1000] flex items-start justify-between gap-3 pointer-events-none">
          {/* Main controls */}
          <div className="pointer-events-auto bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-zinc-100 px-3 py-2 flex items-center gap-2.5 flex-wrap max-w-[calc(100%-1rem)]">
            <Toggle id="tg-follow" checked={followPaths} onChange={setFollowPaths} label={d["tg.follow"]} />
            <span className="w-px h-6 bg-zinc-200" />
            <Toggle id="tg-trails" checked={showTrails} onChange={setShowTrails} label={d["tg.trails"]} />
            <span className="w-px h-6 bg-zinc-200" />
            <Toggle id="tg-elev" checked={showElevation} onChange={setShowElevation} label={d["tg.elev"]} />
            <span className="w-px h-6 bg-zinc-200" />

            {/* Activity dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActivityMenuOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={activityMenuOpen}
                aria-label={tb("activityType", { label: tb(`act.${activity}`) })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-sm font-medium text-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <span className="text-base leading-none">{act.emoji}</span>
                {tb(`act.${activity}`)}
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${activityMenuOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {activityMenuOpen && (
                  <motion.ul
                    role="listbox"
                    aria-label={d["selectType"]}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-zinc-100 p-1.5 z-[1001]"
                  >
                    <li className="px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                      {d["selectType"]}
                    </li>
                    {(Object.entries(ACTIVITIES) as [ActivityKey, typeof ACTIVITIES[ActivityKey]][]).map(([key, cfg]) => (
                      <li key={key} role="option" aria-selected={activity === key}>
                        <button
                          type="button"
                          onClick={() => { setActivity(key); setManualSpeed(null); setActivityMenuOpen(false); }}
                          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                            activity === key ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-zinc-700 hover:bg-zinc-100"
                          }`}
                        >
                          <span className="text-lg leading-none">{cfg.emoji}</span>
                          {tb(`act.${key}`)}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            <span className="w-px h-6 bg-zinc-200" />

            <button
              type="button"
              onClick={handleExportGPX}
              disabled={!hasRoute}
              aria-label={d["exportGpx"]}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Download className="w-4 h-4" />
              {d["exportGpx"]}
            </button>
          </div>

          {/* Tools (la recherche de ville a été retirée — la recherche globale du haut s'en charge) */}
          <div className="pointer-events-auto flex flex-col items-end gap-2 w-72 max-w-[44%]">
            {/* Tool chips */}
            <div className="flex gap-2">
              <ToolChip active={showLayers} onClick={() => { setShowLayers(s => !s); setShowFamous(false); setShowRoutesPanel(false); }} label={d["tool.layers"]}>
                <Layers className="w-4 h-4" />
              </ToolChip>
              <ToolChip active={showFamous} onClick={() => { setShowFamous(s => !s); setShowLayers(false); setShowRoutesPanel(false); }} label={d["tool.famous"]}>
                <Mountain className="w-4 h-4" />
              </ToolChip>
              <ToolChip active={showRoutesPanel} onClick={() => { setShowRoutesPanel(s => !s); setShowLayers(false); setShowFamous(false); }} label={d["tool.routes"]}>
                <Bookmark className="w-4 h-4" />
              </ToolChip>
            </div>

            {/* Layers panel */}
            <AnimatePresence>
              {showLayers && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="w-full bg-white rounded-2xl shadow-xl border border-zinc-100 p-1.5"
                >
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{d["tool.layers"]}</div>
                  {(Object.entries(LAYERS) as [keyof typeof LAYERS, typeof LAYERS[keyof typeof LAYERS]][])
                    .filter(([key]) => key !== "outdoor" || MAPTILER_KEY)
                    .map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLayer(key)}
                        aria-pressed={layer === key}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          layer === key ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        {tb(`layer.${key}`)}
                      </button>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Famous routes panel */}
            <AnimatePresence>
              {showFamous && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="w-full bg-white rounded-2xl shadow-xl border border-zinc-100 p-2 max-h-[320px] overflow-auto"
                >
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{d["famousTitle"]}</div>
                  <div className="space-y-1">
                    {FAMOUS_ROUTES.map((r) => (
                      <button
                        key={r.name}
                        type="button"
                        onClick={() => flyToPlace(r)}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-zinc-100 transition-colors text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <span className="text-xl leading-none flex-shrink-0">{r.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-900 truncate">{r.name}</div>
                          <div className="text-[11px] text-zinc-400 truncate">{r.region}</div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">{tbDesc(r.distance)} · {tbDesc(r.elevation)}</div>
                        </div>
                        <MapPin className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Save + my routes panel */}
            <AnimatePresence>
              {showRoutesPanel && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="w-full bg-white rounded-2xl shadow-xl border border-zinc-100 p-3 max-h-[400px] overflow-auto"
                >
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">{d["save"]}</div>
                  <input
                    value={routeName}
                    onChange={e => setRouteName(e.target.value)}
                    placeholder={d["routeNamePh"]}
                    aria-label={d["routeNameAria"]}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 mb-2"
                  />
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !hasRoute || !routeName.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {d["save"]}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportGPX}
                      disabled={!hasRoute}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 border border-zinc-200 hover:bg-zinc-50 rounded-xl text-xs font-medium text-zinc-600 disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Download className="w-3.5 h-3.5" /> GPX
                    </button>
                  </div>
                  <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">{tb("myRoutes", { n: savedRoutes.length })}</div>
                  {loadingRoutes ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
                  ) : savedRoutes.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-3">{d["noRoutes"]}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {savedRoutes.map(r => (
                        <div key={r.id} className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors group">
                          <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: difficultyColor(r.difficulty) }} />
                          <button type="button" className="flex-1 min-w-0 text-left" onClick={() => { handleLoadRoute(r); setShowRoutesPanel(false); }}>
                            <div className="text-sm font-medium text-zinc-900 truncate">{r.name}</div>
                            <div className="text-xs text-zinc-400">{r.distance_km.toFixed(1)} km · +{r.elevation_gain_m}m</div>
                          </button>
                          {/* Le cœur reste TOUJOURS visible quand il est plein : le
                              masquer hors survol cacherait précisément l'information
                              qu'on est venu chercher — lequel de mes parcours est mon
                              favori. Vide, il n'apparaît qu'au survol pour ne pas
                              encombrer la liste. */}
                          <button type="button" onClick={() => handleToggleFavorite(r)}
                            aria-label={tb(r.is_favorite ? "unfavRoute" : "favRoute", { name: r.name })}
                            aria-pressed={!!r.is_favorite}
                            className={`p-1 transition-all focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                              r.is_favorite
                                ? "text-rose-500 opacity-100"
                                : "text-zinc-300 hover:text-rose-400 opacity-0 group-hover:opacity-100"}`}>
                            <Heart className="w-3.5 h-3.5" fill={r.is_favorite ? "currentColor" : "none"} />
                          </button>
                          <button type="button" onClick={() => handleDeleteRoute(r.id)} aria-label={tb("delRoute", { name: r.name })} className="p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Route loading indicator */}
        {routeLoading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[999]">
            <div className="bg-white/95 backdrop-blur rounded-full shadow-lg border border-zinc-100 px-4 py-1.5 flex items-center gap-2 text-sm text-zinc-700">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              {d["computing"]}
            </div>
          </div>
        )}

        {/* Empty-state hint */}
        {!hasRoute && mounted && !routeLoading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[999] pointer-events-none">
            <div className="bg-zinc-900/80 backdrop-blur text-white rounded-full px-4 py-1.5 text-sm font-medium shadow-lg">
              {d["emptyHint"]}
            </div>
          </div>
        )}

        {/* Floating stats pill (Distance · Temps · Allure · Vitesse) */}
        <AnimatePresence>
          {distance > 0 && (
            <motion.div
              ref={speedEditorRef}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000]"
            >
              {/* Target-speed editor popover */}
              <AnimatePresence>
                {speedEditorOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    role="dialog"
                    aria-label={speedCfg.mode === "pace" ? d["setPaceAria"] : d["setSpeedAria"]}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 bg-white rounded-2xl shadow-xl border border-zinc-100 p-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                        {speedCfg.mode === "pace" ? d["paceTarget"] : d["speedTarget"]}
                      </span>
                      <button
                        type="button"
                        onClick={() => setManualSpeed(null)}
                        disabled={manualSpeed === null}
                        className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-zinc-300 disabled:cursor-default transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md px-1"
                      >
                        <Gauge className="w-3 h-3" /> {d["auto"]}
                      </button>
                    </div>
                    <div className="text-center mb-2">
                      <div className="text-3xl font-bold text-zinc-900 tabular-nums">
                        {speedCfg.mode === "pace"
                          ? <>{formatPace(paceMinPerKm)}<span className="text-base font-semibold text-zinc-400"> /km</span></>
                          : <>{speedKmh.toFixed(1).replace(".", ",")}<span className="text-base font-semibold text-zinc-400"> km/h</span></>}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {manualSpeed === null
                          ? d["autoEstimate"]
                          : speedCfg.mode === "pace"
                            ? tb("soitKmh", { v: speedKmh.toFixed(1).replace(".", ",") })
                            : tb("soitPace", { p: formatPace(paceMinPerKm) })}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={speedCfg.min}
                      max={speedCfg.max}
                      step={speedCfg.step}
                      value={clamp(speedKmh, speedCfg.min, speedCfg.max)}
                      onChange={e => setManualSpeed(Number(e.target.value))}
                      aria-label={speedCfg.mode === "pace" ? d["paceRangeAria"] : d["speedRangeAria"]}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] font-medium text-zinc-400 mt-1">
                      <span>{speedCfg.mode === "pace" ? "7:00 /km" : "1 km/h"}</span>
                      <span>{speedCfg.mode === "pace" ? "2:30 /km" : "50 km/h"}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white/95 backdrop-blur rounded-full shadow-xl border border-zinc-100 px-2 py-2 flex items-center">
                <PillStat value={`${distance < 1 ? Math.round(distance * 1000) + " m" : distance.toFixed(2) + " km"}`} label={d["st.distance"]} />
                <PillDivider />
                <PillStat value={formatDuration(durationMin)} label={d["st.time"]} icon={act.emoji} />
                <PillDivider />
                <button
                  type="button"
                  onClick={() => setSpeedEditorOpen(o => !o)}
                  aria-label={d["setBothAria"]}
                  aria-expanded={speedEditorOpen}
                  className="flex items-center rounded-full transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <PillStat value={`${formatPace(paceMinPerKm)}/km`} label={d["st.pace"]} manual={manualSpeed !== null} />
                  <PillDivider />
                  <PillStat value={`${speedKmh.toFixed(2).replace(".", ",")} km/h`} label={d["st.speed"]} manual={manualSpeed !== null} />
                  <SlidersHorizontal className={`w-3.5 h-3.5 mr-1.5 ${manualSpeed !== null ? "text-emerald-600" : "text-zinc-300"}`} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation GPS en direct (point bleu qui se déplace sur le tracé) */}
        {(hasRoute || navMode) && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1000]">
            {!navMode ? (
              <button
                type="button"
                onClick={() => setNavMode(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold shadow-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Navigation className="w-4 h-4" /> {d["followLive"]}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-4 py-2 bg-white/95 backdrop-blur rounded-full shadow-xl border border-blue-100">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
                  </span>
                  {userPos ? d["live"] : d["searchingGps"]}
                </span>
                {navRemainingKm != null && (
                  <span className="text-sm text-zinc-700">
                    <span className="font-bold">{navRemainingKm < 1 ? `${Math.round(navRemainingKm * 1000)} m` : `${navRemainingKm.toFixed(1)} km`}</span> {d["remaining"]}
                  </span>
                )}
                {navAccuracy != null && <span className="text-[11px] text-zinc-400">±{Math.round(navAccuracy)} m</span>}
                {!sharing ? (
                  <button type="button" onClick={startShare} title={d["shareTitle"]}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                    <Share2 className="w-3.5 h-3.5" /> {d["share"]}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold"><Share2 className="w-3.5 h-3.5" /> {d["shared"]}</span>
                )}
                <button
                  type="button" onClick={() => { setNavMode(false); setSharing(false); }} aria-label={d["stopNavAria"]}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-full text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  <X className="w-3.5 h-3.5" /> {d["stop"]}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Left vertical edit controls (Annuler · Retour · Effacer) */}
        <div className="absolute top-1/2 -translate-y-1/2 left-3 z-[1000]">
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-zinc-100 p-1.5 flex flex-col gap-1">
            <EditBtn onClick={handleUndo} disabled={!hasRoute} icon={<Undo2 className="w-5 h-5" />} label={d["undo"]} />
            <EditBtn onClick={handleRedo} disabled={redoStack.length === 0} icon={<Redo2 className="w-5 h-5" />} label={d["redo"]} />
            <EditBtn onClick={handleClear} disabled={!hasRoute} icon={<Trash2 className="w-5 h-5" />} label={d["clear"]} danger />
          </div>
        </div>
      </div>

      {/* ── ELEVATION PROFILE (full-width, below the map) ─────────────────── */}
      <AnimatePresence>
        {showElevation && hasRoute && elevations.length > 2 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <ElevationProfile
              points={allPoints}
              elevations={elevations}
              totalKm={distance}
              gain={elevGain}
              loss={elevLoss}
              minAlt={elevMin}
              maxAlt={elevMax}
              difficulty={difficulty}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────
function PillStat({ value, label, icon, manual }: { value: string; label: string; icon?: string; manual?: boolean }) {
  return (
    <div className="px-3 text-center min-w-[58px]">
      <div className={`flex items-center justify-center gap-1 font-bold text-sm leading-tight whitespace-nowrap ${manual ? "text-emerald-600" : "text-zinc-900"}`}>
        {value}{icon && <span className="text-xs">{icon}</span>}
      </div>
      <div className="text-[10px] text-zinc-400">{label}</div>
    </div>
  );
}
function PillDivider() {
  return <div className="w-px h-7 bg-zinc-200" />;
}
// iOS-style toggle switch (toolbar)
function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
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

// Round icon button used for the top-right tool cluster
function ToolChip({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        active ? "bg-zinc-900 text-white border-zinc-900" : "bg-white/95 backdrop-blur text-zinc-700 border-zinc-100 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

// Vertical edit control (Annuler / Retour / Effacer)
function EditBtn({ onClick, disabled, icon, label, danger }: { onClick: () => void; disabled?: boolean; icon: ReactNode; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        danger ? "text-red-500 hover:bg-red-50" : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      {icon}
      {label}
    </button>
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
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm px-4 pt-3 pb-1">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-800">{d["elevProfile"]}</span>
          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold text-white" style={{ backgroundColor: difficultyColor(difficulty) }}>{label}</span>
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
