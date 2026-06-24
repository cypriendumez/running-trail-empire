"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Calendar, Zap, Mountain, ExternalLink, ChevronRight, RefreshCw, Loader2, Flag } from "lucide-react";
import type { Race } from "@/types";
import { correctedRaceType } from "@/lib/raceType";
import { useT } from "@/lib/i18n/LanguageProvider";
import { RX, fillR, dateRangeKey } from "./racesI18n";

const TYPE_COLORS: Record<string, string> = {
  road_5k: "#6366f1", road_10k: "#3b82f6", semi: "#0ea5e9",
  marathon: "#8b5cf6", trail_s: "#22c55e", trail_m: "#16a34a",
  trail_l: "#f59e0b", trail_xl: "#f97316", ultra: "#ef4444",
};

const DIFF_COLORS: Record<string, string> = {
  green: "#22c55e", blue: "#3b82f6", red: "#ef4444", black: "#18181b",
};

// Date range shortcuts (ALL_DAYS = toutes les dates · -1 = "Date à venir" only) — libellés traduits au rendu
const ALL_DAYS = 100000;
const DATE_RANGES = [
  { days: ALL_DAYS }, { days: 7 }, { days: 30 }, { days: 90 },
  { days: 180 }, { days: 365 }, { days: 730 }, { days: -1 },
];

// ─── Component ───────────────────────────────────────────────────────────────
export function RacesMapView({ races: initialRaces, onClose, findPlanned, onTrain, onCancel, busy = false }: {
  races: Race[];
  onClose: () => void;
  // État « course planifiée » partagé avec la liste (RacesHub) → bouton vert ↔ rouge cohérent.
  findPlanned?: (r: Race) => { id: string } | undefined;
  onTrain?: (r: Race) => Promise<void>;
  onCancel?: (r: Race) => Promise<void>;
  busy?: boolean;
}) {
  const { lang } = useT();
  const d = RX[lang] ?? RX.fr;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const rendererRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const [races, setRaces] = useState<Race[]>(initialRaces);
  const [selected, setSelected] = useState<Race | null>(null);
  // Champs lourds chargés à la demande quand une course est sélectionnée (hors payload de liste).
  const [details, setDetails] = useState<Record<string, Partial<Race>>>({});
  useEffect(() => {
    if (!selected || details[selected.id]) return;
    const id = selected.id;
    fetch(`/api/races/detail?id=${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { if (d) setDetails((m) => ({ ...m, [id]: d })); })
      .catch(() => {});
  }, [selected, details]);
  const [filterType, setFilterType] = useState<string>("all");
  const [dateRangeDays, setDateRangeDays] = useState<number>(ALL_DAYS); // tous les points dès l'arrivée
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
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
    if (dateRangeDays >= ALL_DAYS) return true;                 // « Toutes » → tout afficher
    if (dateRangeDays === -1) return date?.startsWith("2099");  // « Date à venir » uniquement
    // Les plages datées INCLUENT les courses « à confirmer » (date inconnue) :
    // elles peuvent tomber dans la fenêtre — mieux vaut les montrer que les cacher.
    if (date?.startsWith("2099")) return true;
    return date >= today && date <= maxDate;
  }, [dateRangeDays, today, maxDate]);

  const filtered = useMemo(() => withCoords.filter(r => {
    const matchType = filterType === "all" || correctedRaceType(r.distance_km, r.type) === filterType;
    return matchType && matchesDateRange(r.date);
  }), [withCoords, filterType, matchesDateRange]);

  const typeCounts = useMemo(() => withCoords.reduce<Record<string, number>>((acc, r) => {
    if (matchesDateRange(r.date)) { const t = correctedRaceType(r.distance_km, r.type); acc[t] = (acc[t] || 0) + 1; }
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

      // Rendu canvas → des milliers de points s'affichent sans ralentir.
      rendererRef.current = L.canvas({ padding: 0.5 });
      setMapReady(true);
    }

    initMap();
    return () => { cancelled = true; };
  }, [mounted]);

  // (Re)dessine les marqueurs dès que la carte est prête OU que le filtre change
  // → corrige le bug « aucun point à l'arrivée » (la carte n'était pas encore prête
  //   au 1er rendu, et rien ne relançait le tracé).
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    let cancelled = false;

    async function updateMarkers() {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      const L = (leaflet.default ?? leaflet) as typeof import("leaflet");
      const map = mapInstanceRef.current as ReturnType<typeof L.map>;
      const renderer = rendererRef.current as ReturnType<typeof L.canvas>;

      markersRef.current.forEach(m => (m as ReturnType<typeof L.circleMarker>).remove());
      markersRef.current = [];

      filtered.forEach(race => {
        if (!race.latitude || !race.longitude) return;
        const color = TYPE_COLORS[correctedRaceType(race.distance_km, race.type)] || "#22c55e";
        const marker = L.circleMarker([race.latitude, race.longitude], {
          renderer, radius: 5, fillColor: color, color: "#ffffff", weight: 1.4, fillOpacity: 0.92,
        });
        marker.addTo(map);
        marker.on("click", () => setSelected(race));
        markersRef.current.push(marker);
      });
    }

    updateMarkers();
    return () => { cancelled = true; };
  }, [filtered, mapReady]);

  // L'action « M'entraîner / Annuler » vient du parent (RacesHub) → un seul état partagé.

  const triggerGeocode = async () => {
    setGeocoding(true);
    setGeocodeResult(null);
    try {
      const res = await fetch("/api/races/geocode", { method: "POST" });
      const data = await res.json();
      setGeocodeResult(fillR(d["geo.ok"], { n: data.geocoded }));
      // Reload races to immediately show new GPS pins on map
      const fresh = await fetch("/api/races/list");
      if (fresh.ok) {
        const { races: newRaces } = await fresh.json();
        setRaces(newRaces);
      }
    } catch {
      setGeocodeResult(d["geo.err"]);
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
          {d["back"]}
        </button>
        <div className="w-px h-4 bg-zinc-200 flex-shrink-0" />

        {/* Count */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-sm font-bold text-zinc-800">{filtered.length}</span>
          <span className="text-xs text-zinc-400">{d["pins"]} · {races.length.toLocaleString(lang)} {d["courses"]}</span>
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
                {d[dateRangeKey(r.days)]}
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
            {d["allShort"]}
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
                {d[`rts.${type}`] ?? type} {count}
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
            {geocoding ? d["geocoding"] : d["geolocate"]}
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
                    style={{ backgroundColor: TYPE_COLORS[correctedRaceType(selected.distance_km, selected.type)] || "#22c55e" }}
                  >
                    {d[`rts.${correctedRaceType(selected.distance_km, selected.type)}`] ?? selected.type}
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
                {details[selected.id]?.organization && (
                  <p className="text-xs text-zinc-400 mt-0.5">{details[selected.id]?.organization}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <div
                    className="h-1.5 flex-1 rounded-full"
                    style={{ backgroundColor: DIFF_COLORS[selected.difficulty] || "#22c55e" }}
                  />
                  <span className="text-xs font-semibold text-zinc-500 capitalize">
                    {d[`dd.${selected.difficulty}`] ?? selected.difficulty}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-px bg-zinc-100">
                {[
                  { icon: <Zap className="w-3.5 h-3.5 text-emerald-500" />, label: d["l.distance"], value: `${selected.distance_km} km` },
                  { icon: <Mountain className="w-3.5 h-3.5 text-amber-500" />, label: "D+", value: (selected.elevation_gain_m ?? 0) > 0 ? `+${Number(selected.elevation_gain_m).toLocaleString(lang)} m` : "—" },
                  { icon: <Calendar className="w-3.5 h-3.5 text-blue-500" />, label: d["l.date"], value: selected.date?.startsWith("2099") ? d["dateTBD"] : new Date(selected.date + "T00:00:00").toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }) },
                  { icon: <MapPin className="w-3.5 h-3.5 text-red-400" />, label: d["l.place"], value: selected.city ? `${selected.city}${selected.department ? ` (${selected.department})` : ""}` : (selected.department || "—") },
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
                {details[selected.id]?.description && (
                  <p className="text-sm text-zinc-600 leading-relaxed mb-4">{details[selected.id]?.description}</p>
                )}
                {Array.isArray(details[selected.id]?.terrain) && (details[selected.id]?.terrain?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {(details[selected.id]?.terrain as string[]).map(t => (
                      <span key={t} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full text-xs font-medium capitalize">
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
                {Array.isArray(details[selected.id]?.time_limits) && (details[selected.id]?.time_limits as Array<{ checkpoint: string; km: number; time_limit_seconds: number }>)[0]?.time_limit_seconds > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{d["timeLimits"]}</div>
                    {(details[selected.id]?.time_limits as Array<{ checkpoint: string; km: number; time_limit_seconds: number }>).map(tl => (
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
                {details[selected.id]?.registration_url && (
                  <a
                    href={details[selected.id]?.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: TYPE_COLORS[correctedRaceType(selected.distance_km, selected.type)] || "#22c55e" }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {d["register"]}
                  </a>
                )}
                {findPlanned?.(selected) ? (
                  <button
                    onClick={() => onCancel?.(selected)}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-60 transition-all"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    {d["cancelTrain"]}
                  </button>
                ) : (
                  <button
                    onClick={() => onTrain?.(selected)}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-60 transition-all"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                    {d["train"]}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-zinc-200/80 p-3 z-[1000]">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">{d["legendTitle"]}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-zinc-600">{d[`rts.${type}`] ?? type}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
