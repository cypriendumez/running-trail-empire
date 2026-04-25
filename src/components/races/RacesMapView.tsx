"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Calendar, Zap, Mountain, ExternalLink, ChevronRight, RefreshCw } from "lucide-react";
import type { Race } from "@/types";

// ─── Config ──────────────────────────────────────────────────────────────────
const RACE_TYPE_LABELS: Record<string, string> = {
  road_5k: "5 km", road_10k: "10 km", semi: "Semi-marathon",
  marathon: "Marathon", trail_s: "Trail S", trail_m: "Trail M",
  trail_l: "Trail L", trail_xl: "Trail XL", ultra: "Ultra",
};

const TYPE_COLORS: Record<string, string> = {
  road_5k: "#6366f1", road_10k: "#3b82f6", semi: "#0ea5e9",
  marathon: "#8b5cf6", trail_s: "#22c55e", trail_m: "#16a34a",
  trail_l: "#f59e0b", trail_xl: "#f97316", ultra: "#ef4444",
};

const DIFF_COLORS: Record<string, string> = {
  green: "#22c55e", blue: "#3b82f6", red: "#ef4444", black: "#18181b",
};

// Date range shortcuts (-1 = "Date à venir" only)
const DATE_RANGES = [
  { label: "Cette semaine", days: 7 },
  { label: "Ce mois", days: 30 },
  { label: "3 mois", days: 90 },
  { label: "6 mois", days: 180 },
  { label: "1 an", days: 365 },
  { label: "2 ans", days: 730 },
  { label: "Date à venir", days: -1 },
];

function makeMarkerSvg(color: string, size = 26) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2-1.5}" fill="${color}" stroke="white" stroke-width="2.5" opacity="0.93"/>
  <path d="M${size/2} ${size-2} L${size/2-5} ${size+5} L${size/2+5} ${size+5} Z" fill="${color}" opacity="0.93"/>
</svg>`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function RacesMapView({ races: initialRaces, onClose }: { races: Race[]; onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const [races, setRaces] = useState<Race[]>(initialRaces);
  const [selected, setSelected] = useState<Race | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [dateRangeDays, setDateRangeDays] = useState<number>(90);
  const [mounted, setMounted] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dateRangeDays);
    return d.toISOString().slice(0, 10);
  }, [dateRangeDays]);

  const withCoords = useMemo(() => races.filter(r => r.latitude && r.longitude), [races]);

  const matchesDateRange = useCallback((date: string) => {
    if (dateRangeDays === -1) return date?.startsWith("2099"); // "Date à venir" only
    return date >= today && date <= maxDate && !date.startsWith("2099");
  }, [dateRangeDays, today, maxDate]);

  const filtered = useMemo(() => withCoords.filter(r => {
    const matchType = filterType === "all" || r.type === filterType;
    return matchType && matchesDateRange(r.date);
  }), [withCoords, filterType, matchesDateRange]);

  const typeCounts = useMemo(() => withCoords.reduce<Record<string, number>>((acc, r) => {
    if (matchesDateRange(r.date)) acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {}), [withCoords, matchesDateRange]);

  useEffect(() => { setMounted(true); }, []);

  // Init map once
  useEffect(() => {
    if (!mounted || !mapRef.current) return;
    let cancelled = false;

    async function initMap() {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      const L = (leaflet.default ?? leaflet) as typeof import("leaflet");

      if (mapInstanceRef.current) {
        (mapInstanceRef.current as ReturnType<typeof L.map>).remove();
      }

      const map = L.map(mapRef.current!, {
        center: [46.6, 2.3],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
      });
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.attribution({ position: "bottomright", prefix: "© OpenStreetMap" }).addTo(map);
    }

    initMap();
    return () => { cancelled = true; };
  }, [mounted]);

  // Update markers when filter changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    let cancelled = false;

    async function updateMarkers() {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      const L = (leaflet.default ?? leaflet) as typeof import("leaflet");
      const map = mapInstanceRef.current as ReturnType<typeof L.map>;

      // Remove old markers
      markersRef.current.forEach(m => (m as ReturnType<typeof L.marker>).remove());
      markersRef.current = [];

      filtered.forEach(race => {
        if (!race.latitude || !race.longitude) return;
        const color = TYPE_COLORS[race.type] || "#22c55e";
        const icon = L.divIcon({
          html: makeMarkerSvg(color),
          className: "",
          iconSize: [26, 34],
          iconAnchor: [13, 34],
          popupAnchor: [0, -34],
        });

        const marker = L.marker([race.latitude, race.longitude], { icon });
        marker.addTo(map);
        marker.on("click", () => setSelected(race));
        markersRef.current.push(marker);
      });
    }

    updateMarkers();
    return () => { cancelled = true; };
  }, [filtered]);

  const triggerGeocode = async () => {
    setGeocoding(true);
    setGeocodeResult(null);
    try {
      const res = await fetch("/api/races/geocode", { method: "POST" });
      const data = await res.json();
      setGeocodeResult(`✅ ${data.geocoded} pins ajoutés`);
      // Reload races to immediately show new GPS pins on map
      const fresh = await fetch("/api/races/list");
      if (fresh.ok) {
        const { races: newRaces } = await fresh.json();
        setRaces(newRaces);
      }
    } catch {
      setGeocodeResult("❌ Erreur de géocodage");
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-50"
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-zinc-200 shadow-sm z-10 flex-wrap">
        {/* Back */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors flex-shrink-0"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Retour
        </button>
        <div className="w-px h-4 bg-zinc-200 flex-shrink-0" />

        {/* Count */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <MapPin className="w-3.5 h-3.5 text-green-600" />
          <span className="text-sm font-bold text-zinc-800">{filtered.length}</span>
          <span className="text-xs text-zinc-400">pins · {races.length.toLocaleString("fr")} courses</span>
        </div>

        {/* ── Date range filter ─────────────────────────────────── */}
        <div className="flex items-center gap-1 ml-1">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <div className="flex gap-1">
            {DATE_RANGES.map(r => (
              <button
                key={r.days}
                onClick={() => setDateRangeDays(r.days)}
                className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-all ${
                  dateRangeDays === r.days
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-zinc-200 flex-shrink-0" />

        {/* ── Type filter pills ─────────────────────────────────── */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setFilterType("all")}
            className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-all ${
              filterType === "all" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Tous
          </button>
          {Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? "all" : type)}
                className="px-2 py-0.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1"
                style={{
                  background: filterType === type ? (TYPE_COLORS[type] || "#22c55e") : "#f3f4f6",
                  color: filterType === type ? "white" : "#374151",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: filterType === type ? "white" : (TYPE_COLORS[type] || "#22c55e") }}
                />
                {RACE_TYPE_LABELS[type] ?? type} {count}
              </button>
            ))}
        </div>

        {/* Geocode button */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {geocodeResult && (
            <span className="text-xs text-zinc-600 bg-zinc-100 px-2 py-1 rounded-lg">{geocodeResult}</span>
          )}
          <button
            onClick={triggerGeocode}
            disabled={geocoding}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${geocoding ? "animate-spin" : ""}`} />
            {geocoding ? "Géocodage…" : "Géolocaliser +"}
          </button>
        </div>
      </div>

      {/* ── Map + side panel ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        <div ref={mapRef} className="flex-1 h-full" />

        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="w-[340px] flex-shrink-0 bg-white border-l border-zinc-200 flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-5 border-b border-zinc-100">
                <div className="flex items-start justify-between mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: TYPE_COLORS[selected.type] || "#22c55e" }}
                  >
                    {RACE_TYPE_LABELS[selected.type] ?? selected.type}
                    {selected.is_itra_certified && ` • ITRA ${selected.itra_points}pts`}
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
                <h2 className="text-lg font-bold text-zinc-900 leading-snug">{selected.name}</h2>
                {selected.organization && (
                  <p className="text-xs text-zinc-400 mt-0.5">{selected.organization}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <div
                    className="h-1.5 flex-1 rounded-full"
                    style={{ backgroundColor: DIFF_COLORS[selected.difficulty] || "#22c55e" }}
                  />
                  <span className="text-xs font-semibold text-zinc-500 capitalize">
                    {{ green: "Facile", blue: "Modéré", red: "Difficile", black: "Extrême" }[selected.difficulty] ?? selected.difficulty}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-px bg-zinc-100">
                {[
                  { icon: <Zap className="w-3.5 h-3.5 text-green-500" />, label: "Distance", value: `${selected.distance_km} km` },
                  { icon: <Mountain className="w-3.5 h-3.5 text-amber-500" />, label: "D+", value: selected.elevation_gain_m > 0 ? `${selected.elevation_gain_m.toLocaleString("fr")} m` : "Plat" },
                  { icon: <Calendar className="w-3.5 h-3.5 text-blue-500" />, label: "Date", value: selected.date?.startsWith("2099") ? "Date à venir" : new Date(selected.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) },
                  { icon: <MapPin className="w-3.5 h-3.5 text-red-400" />, label: "Lieu", value: selected.city ? `${selected.city}${selected.department ? ` (${selected.department})` : ""}` : (selected.department || "—") },
                ].map(m => (
                  <div key={m.label} className="bg-white p-3">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium mb-0.5">
                      {m.icon} {m.label}
                    </div>
                    <div className="font-bold text-zinc-900 text-sm leading-snug">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto p-5">
                {selected.description && (
                  <p className="text-sm text-zinc-600 leading-relaxed mb-4">{selected.description}</p>
                )}
                {Array.isArray(selected.terrain) && selected.terrain.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {(selected.terrain as string[]).map(t => (
                      <span key={t} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full text-xs font-medium capitalize">
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
                {Array.isArray(selected.time_limits) && (selected.time_limits as Array<{ checkpoint: string; km: number; time_limit_seconds: number }>)[0]?.time_limit_seconds > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Barrières horaires</div>
                    {(selected.time_limits as Array<{ checkpoint: string; km: number; time_limit_seconds: number }>).map(tl => (
                      <div key={tl.checkpoint} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100">
                        <span className="text-zinc-600">{tl.checkpoint}</span>
                        <span className="font-bold text-zinc-900">
                          {Math.floor(tl.time_limit_seconds / 3600)}h{String(Math.floor((tl.time_limit_seconds % 3600) / 60)).padStart(2, "0")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer CTA */}
              <div className="p-4 border-t border-zinc-100 space-y-2">
                {selected.registration_url && (
                  <a
                    href={selected.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: TYPE_COLORS[selected.type] || "#22c55e" }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    S&apos;inscrire
                  </a>
                )}
                <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-all">
                  <Zap className="w-4 h-4" />
                  M&apos;entraîner pour cette course
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-zinc-200/80 p-3 z-[1000]">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Type de course</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-zinc-600">{RACE_TYPE_LABELS[type] ?? type}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
