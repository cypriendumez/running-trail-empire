"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Undo2, Trash2, Download, Save, Loader2, Route, ChevronRight,
  ChevronDown, Zap, Clock, TrendingUp, PenLine, Eye, X
} from "lucide-react";
import { toast } from "sonner";

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
}

// ─── Tile layers (all free, no token) ────────────────────────────────────────
const LAYERS = {
  topo: {
    label: "🗺️ Topo",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap",
    maxZoom: 17,
  },
  street: {
    label: "🏙️ Street",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap",
    maxZoom: 19,
  },
  satellite: {
    label: "🛰️ Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri World Imagery",
    maxZoom: 19,
    subdomains: false,
  },
};

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
<gpx version="1.1" creator="Running Trail Empire"
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

function calcElevGain(elevs: number[]): number {
  let gain = 0;
  for (let i = 1; i < elevs.length; i++) {
    const diff = elevs[i] - elevs[i - 1];
    if (diff > 0) gain += diff;
  }
  return gain;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function TrailBuilder() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const polylineRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const segmentsRef = useRef<unknown[]>([]);

  const [layer, setLayer] = useState<keyof typeof LAYERS>("topo");
  const [mode, setMode] = useState<"view" | "draw">("view");
  const [followPaths, setFollowPaths] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Route state
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [allPoints, setAllPoints] = useState<LatLng[]>([]); // includes routed sub-points
  const [elevations, setElevations] = useState<number[]>([]);
  const [elevGain, setElevGain] = useState(0);
  const [distance, setDistance] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);

  // Save
  const [routeName, setRouteName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // ── Init Leaflet ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainer.current || mapRef.current) return;

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
        zoomControl: false,
      });
      L.control.zoom({ position: "topright" }).addTo(map);

      // Tile layer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfgAny = cfg as any;
      L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        subdomains: cfgAny.subdomains === false ? undefined : "abc",
      }).addTo(map);

      // Scale control
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

      // Geolocation button
      const GeoBtn = L.Control.extend({
        onAdd() {
          const btn = L.DomUtil.create("button", "leaflet-bar leaflet-control bg-white hover:bg-gray-50 p-2 rounded shadow cursor-pointer border border-gray-300");
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`;
          btn.title = "Ma position";
          L.DomEvent.on(btn, "click", () => {
            map.locate({ setView: true, maxZoom: 14 });
          });
          return btn;
        },
      });
      new GeoBtn({ position: "topright" }).addTo(map);

      mapRef.current = map;
      setMounted(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Switch tile layer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as L.Map;
      map.eachLayer((l) => { if ((l as L.TileLayer).setUrl) map.removeLayer(l); });
      const cfg = LAYERS[layer];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfgAny = cfg as any;
      L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        subdomains: cfgAny.subdomains === false ? undefined : "abc",
      }).addTo(map);
    });
  }, [layer, mounted]);

  // ── Update polyline on the map ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as L.Map;
      // Remove old polyline
      if (polylineRef.current) map.removeLayer(polylineRef.current as L.Polyline);
      if (!allPoints.length) return;
      const latlngs = allPoints.map(p => [p.lat, p.lng] as [number, number]);
      const pl = L.polyline(latlngs, {
        color: "#22c55e",
        weight: 4,
        opacity: 0.9,
        lineJoin: "round",
      }).addTo(map);
      polylineRef.current = pl;
    });
  }, [allPoints, mounted]);

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
  const handleMapClick = useCallback(async (latlng: LatLng) => {
    const prev = waypoints[waypoints.length - 1];
    const newWaypoints = [...waypoints, latlng];
    setWaypoints(newWaypoints);

    if (!prev) {
      setAllPoints([latlng]);
      return;
    }

    if (followPaths) {
      setRouteLoading(true);
      const routed = await fetchRoute(prev, latlng);
      setRouteLoading(false);
      const segment = routed ?? [prev, latlng];
      setAllPoints(ap => [...ap, ...segment.slice(1)]);
    } else {
      setAllPoints(ap => [...ap, latlng]);
    }
  }, [waypoints, followPaths]);

  // Attach/detach click handler
  useEffect(() => {
    if (!mapRef.current || !mounted) return;
    const map = mapRef.current as { on: (e: string, fn: (e: { latlng: { lat: number; lng: number } }) => void) => void; off: (e: string) => void };
    if (mode === "draw") {
      const fn = (e: { latlng: { lat: number; lng: number } }) => {
        handleMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      };
      map.on("click", fn);
      return () => map.off("click");
    } else {
      map.off("click");
    }
  }, [mode, mounted, handleMapClick]);

  // ── Update distance + elevation ────────────────────────────────────────────
  useEffect(() => {
    const d = totalDistance(allPoints);
    setDistance(d);

    if (allPoints.length >= 2) {
      fetchElevations(allPoints).then(elevs => {
        setElevations(elevs);
        setElevGain(calcElevGain(elevs));
      });
    } else {
      setElevations([]);
      setElevGain(0);
    }
  }, [allPoints]);

  const durationMin = distance > 0
    ? distance * 7 + elevGain / 15
    : 0;

  const difficulty = elevGain > 1500 ? "black"
    : elevGain > 800 ? "red"
    : elevGain > 300 ? "blue"
    : "green";

  // ── Undo last waypoint ─────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (waypoints.length === 0) return;
    const newWp = waypoints.slice(0, -1);
    setWaypoints(newWp);
    // Recompute allPoints from remaining waypoints (simple: just remove last segment)
    // For simplicity, rebuild straight lines; OSRM segments can't easily be un-routed
    if (newWp.length <= 1) {
      setAllPoints(newWp);
    } else {
      // Keep all points up to the second-to-last waypoint
      // This is approximate — good enough UX
      setAllPoints(ap => {
        const trimTo = Math.max(0, ap.length - 10);
        return ap.slice(0, Math.max(1, trimTo));
      });
    }
  }, [waypoints]);

  const handleClear = useCallback(() => {
    setWaypoints([]);
    setAllPoints([]);
    setElevations([]);
    setElevGain(0);
    setDistance(0);
  }, []);

  // ── GPX export ────────────────────────────────────────────────────────────
  const handleExportGPX = useCallback(() => {
    if (!allPoints.length) { toast.error("Tracez d'abord un parcours !"); return; }
    const name = routeName || "Mon parcours";
    const gpx = buildGPX(name, allPoints, elevations);
    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("GPX exporté !");
  }, [allPoints, elevations, routeName]);

  // ── Save route ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!allPoints.length) { toast.error("Tracez d'abord un parcours !"); return; }
    if (!routeName.trim()) { toast.error("Donnez un nom au parcours"); return; }
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
        toast.success("Parcours sauvegardé !");
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
        toast.success("Parcours sauvegardé localement !");
      }
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }, [allPoints, routeName, distance, elevGain, durationMin, difficulty]);

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
    setAllPoints(pts);
    setRouteName(route.name);
    setMode("view");
    // Pan map to route
    if (mapRef.current && mounted) {
      import("leaflet").then(L => {
        const map = mapRef.current as L.Map;
        const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40] });
      });
    }
    toast.success(`Parcours "${route.name}" chargé`);
  }, [mounted]);

  // ── Delete saved route ─────────────────────────────────────────────────────
  const handleDeleteRoute = useCallback(async (id: string) => {
    try {
      await fetch(`/api/routes?id=${id}`, { method: "DELETE" });
    } catch {}
    const local = JSON.parse(localStorage.getItem("trail_routes") || "[]");
    const updated = local.filter((r: SavedRoute) => r.id !== id);
    localStorage.setItem("trail_routes", JSON.stringify(updated));
    setSavedRoutes(prev => prev.filter(r => r.id !== id));
    toast.success("Parcours supprimé");
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4 h-full min-h-[600px]">
      {/* ── MAP ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative rounded-3xl overflow-hidden border border-zinc-200 shadow-sm">
        <div ref={mapContainer} className="w-full h-full" style={{ cursor: mode === "draw" ? "crosshair" : "grab" }} />

        {!mounted && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        )}

        {/* Layer switcher */}
        <div className="absolute top-4 left-4 z-[1000]">
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-zinc-100 p-1 flex flex-col gap-0.5">
            {(Object.entries(LAYERS) as [keyof typeof LAYERS, typeof LAYERS[keyof typeof LAYERS]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setLayer(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all text-left ${
                  layer === key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Route loading indicator */}
        {routeLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-zinc-100 px-4 py-2 flex items-center gap-2 text-sm text-zinc-700">
              <Loader2 className="w-4 h-4 animate-spin text-green-500" />
              Calcul du chemin…
            </div>
          </div>
        )}

        {/* Draw mode hint */}
        {mode === "draw" && !routeLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-green-200 px-4 py-2 flex items-center gap-2 text-sm text-green-700 font-medium">
              <PenLine className="w-4 h-4" />
              {waypoints.length === 0 ? "Cliquez pour démarrer le tracé" : `${waypoints.length} point${waypoints.length > 1 ? "s" : ""} — cliquez pour continuer`}
            </div>
          </div>
        )}

        {/* Mode toggle + controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2">
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-zinc-100 p-1 flex gap-1">
            <button
              onClick={() => setMode("view")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === "view" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Eye className="w-4 h-4" /> Vue
            </button>
            <button
              onClick={() => setMode("draw")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                mode === "draw" ? "bg-green-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <PenLine className="w-4 h-4" /> Tracer
            </button>
          </div>

          {/* Draw controls */}
          <AnimatePresence>
            {mode === "draw" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-zinc-100 p-1 flex gap-1"
              >
                <button
                  onClick={() => setFollowPaths(f => !f)}
                  title={followPaths ? "Suit les chemins (OSRM)" : "Lignes droites"}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    followPaths ? "bg-blue-100 text-blue-700" : "text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  <Route className="w-3.5 h-3.5" />
                  {followPaths ? "Chemins" : "Libre"}
                </button>
                <button
                  onClick={handleUndo}
                  disabled={waypoints.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 transition-all"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Annuler
                </button>
                <button
                  onClick={handleClear}
                  disabled={waypoints.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Effacer
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 flex flex-col gap-4 overflow-auto">

        {/* Stats card */}
        <AnimatePresence>
          {distance > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bento-card"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-zinc-900 text-sm">Statistiques</h3>
                <span
                  className="px-2 py-0.5 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: difficultyColor(difficulty) }}
                >
                  {difficulty === "green" ? "Facile" : difficulty === "blue" ? "Modérée" : difficulty === "red" ? "Difficile" : "Expert"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-zinc-50 rounded-xl p-2.5">
                  <div className="flex items-center gap-1 text-zinc-400 mb-1">
                    <Zap className="w-3 h-3" />
                    <span className="text-xs">Distance</span>
                  </div>
                  <div className="font-bold text-zinc-900 text-sm">{distance.toFixed(1)} km</div>
                </div>
                <div className="bg-zinc-50 rounded-xl p-2.5">
                  <div className="flex items-center gap-1 text-zinc-400 mb-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-xs">D+</span>
                  </div>
                  <div className="font-bold text-zinc-900 text-sm">{Math.round(elevGain)} m</div>
                </div>
                <div className="bg-zinc-50 rounded-xl p-2.5">
                  <div className="flex items-center gap-1 text-zinc-400 mb-1">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">Temps</span>
                  </div>
                  <div className="font-bold text-zinc-900 text-sm">{formatDuration(durationMin)}</div>
                </div>
              </div>

              {/* Elevation mini chart */}
              {elevations.length > 2 && (
                <div className="mt-3">
                  <div className="text-xs text-zinc-400 mb-1">Profil altimétrique</div>
                  <ElevationChart elevations={elevations} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save card */}
        <div className="bento-card">
          <h3 className="font-semibold text-zinc-900 text-sm mb-3">Sauvegarder</h3>
          <input
            value={routeName}
            onChange={e => setRouteName(e.target.value)}
            placeholder="Nom du parcours…"
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !allPoints.length || !routeName.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Sauvegarder
            </button>
            <button
              onClick={handleExportGPX}
              disabled={!allPoints.length}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-zinc-200 hover:bg-zinc-50 rounded-xl text-xs font-medium text-zinc-600 disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              GPX
            </button>
          </div>
        </div>

        {/* Saved routes */}
        <div className="bento-card flex-1">
          <button
            className="w-full flex items-center justify-between mb-3"
            onClick={() => setShowSaved(s => !s)}
          >
            <h3 className="font-semibold text-zinc-900 text-sm">Mes Parcours ({savedRoutes.length})</h3>
            {showSaved ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>

          <AnimatePresence>
            {showSaved && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {loadingRoutes ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                  </div>
                ) : savedRoutes.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-4">
                    Aucun parcours.<br />Tracez votre premier itinéraire !
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-auto pr-1">
                    {savedRoutes.map(r => (
                      <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors group">
                        <div
                          className="w-1.5 self-stretch rounded-full flex-shrink-0"
                          style={{ backgroundColor: difficultyColor(r.difficulty) }}
                        />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadRoute(r)}>
                          <div className="text-sm font-medium text-zinc-900 truncate">{r.name}</div>
                          <div className="text-xs text-zinc-400">
                            {r.distance_km.toFixed(1)} km · +{r.elevation_gain_m}m
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteRoute(r.id)}
                          className="p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!showSaved && savedRoutes.length > 0 && (
            <div className="space-y-2">
              {savedRoutes.slice(0, 3).map(r => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer"
                  onClick={() => handleLoadRoute(r)}
                >
                  <div
                    className="w-1.5 self-stretch rounded-full flex-shrink-0"
                    style={{ backgroundColor: difficultyColor(r.difficulty) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">{r.name}</div>
                    <div className="text-xs text-zinc-400">{r.distance_km.toFixed(1)} km · +{r.elevation_gain_m}m</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-300" />
                </div>
              ))}
              {savedRoutes.length > 3 && (
                <button
                  onClick={() => setShowSaved(true)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 text-center w-full py-1"
                >
                  + {savedRoutes.length - 3} autres parcours
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Elevation mini chart ─────────────────────────────────────────────────────
function ElevationChart({ elevations }: { elevations: number[] }) {
  const step = Math.max(1, Math.floor(elevations.length / 80));
  const sampled = elevations.filter((_, i) => i % step === 0);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const range = Math.max(max - min, 1);
  const W = 260, H = 48;
  const pts = sampled.map((e, i) => {
    const x = (i / (sampled.length - 1)) * W;
    const y = H - ((e - min) / range) * H;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const area = `0,${H} ` + polyline + ` ${W},${H}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="rounded-lg overflow-hidden">
      <defs>
        <linearGradient id="elev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#elev-grad)" />
      <polyline points={polyline} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
      <text x="2" y="12" fontSize="9" fill="#a1a1aa">{Math.round(max)}m</text>
      <text x="2" y={H - 2} fontSize="9" fill="#a1a1aa">{Math.round(min)}m</text>
    </svg>
  );
}
