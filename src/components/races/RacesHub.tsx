"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, MapPin, Mountain, Clock, Calendar, ExternalLink, Zap, RefreshCw, ChevronLeft, ChevronRight, Globe, CheckCircle, AlertCircle, Loader2, Map } from "lucide-react";
import type { Race } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { RacesMapView } from "./RacesMapView";

const REGIONS = [
  "Toutes", "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne",
  "Centre-Val de Loire", "Corse", "Grand-Est", "Hauts-de-France",
  "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
  "Pays-de-la-Loire", "Provence-Alpes-Côte d'Azur",
  "Guadeloupe", "Martinique", "La Réunion",
];

const RACE_TYPES = {
  road_5k: "5 km", road_10k: "10 km", semi: "Semi-marathon",
  marathon: "Marathon", trail_s: "Trail S (<30km)", trail_m: "Trail M (30-50km)",
  trail_l: "Trail L (50-80km)", trail_xl: "Trail XL (80-100km)", ultra: "Ultra (100km+)",
};

const DIFFICULTIES: Record<string, string> = {
  green: "Verte", blue: "Bleue", red: "Rouge", black: "Noire",
};

const DIFF_COLORS: Record<string, string> = {
  green: "#22c55e", blue: "#3b82f6", red: "#ef4444", black: "#18181b",
};

const PAGE_SIZE = 30;

// "2099-01-01" convention = date inconnue → afficher "Date à venir"
function formatDate(dateStr: string, style: "short" | "long" = "short"): string {
  if (!dateStr || dateStr.startsWith("2099")) return "Date à venir";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "Date à venir";
  if (style === "long") return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

interface SyncResult {
  scraped: number;
  inserted: number;
  total_in_db: number;
  sources?: { calendar_html: number; wordpress_api: number };
  error?: string;
}

export function RacesHub({ races: initialRaces }: { races: Race[] }) {
  const [races, setRaces] = useState<Race[]>(initialRaces);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("Toutes");
  const [raceType, setRaceType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [selected, setSelected] = useState<Race | null>(null);
  const [page, setPage] = useState(0);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showSync, setShowSync] = useState(false);
  const [syncPages, setSyncPages] = useState(10);
  const [showMap, setShowMap] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return races.filter(r => {
      const matchSearch = !q ||
        r.name.toLowerCase().includes(q) ||
        (r.organization?.toLowerCase() || "").includes(q) ||
        (r.city?.toLowerCase() || "").includes(q) ||
        (r.department?.toLowerCase() || "").includes(q);
      const matchRegion = region === "Toutes" ||
        r.region?.toLowerCase().replace(/-/g, " ").includes(region.toLowerCase().replace(/-/g, " "));
      const matchType = raceType === "all" || r.type === raceType;
      const matchDate = !dateFrom || r.date.startsWith("2099") || new Date(r.date) >= new Date(dateFrom);
      return matchSearch && matchRegion && matchType && matchDate;
    });
  }, [races, search, region, raceType, dateFrom]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleFilterChange = useCallback((fn: () => void) => { fn(); setPage(0); }, []);

  const triggerSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/races/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: syncPages }),
      });
      const data = await res.json();
      setSyncResult(data);
      if (!data.error) {
        // Reload races from server
        const fresh = await fetch("/api/races/list");
        if (fresh.ok) {
          const { races: newRaces } = await fresh.json();
          setRaces(newRaces);
        }
      }
    } catch {
      setSyncResult({ error: "Erreur réseau", scraped: 0, inserted: 0, total_in_db: 0 });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Map overlay */}
      <AnimatePresence>
        {showMap && (
          <RacesMapView races={races} onClose={() => setShowMap(false)} />
        )}
      </AnimatePresence>

      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div className="bento-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
            <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => handleFilterChange(() => setSearch(e.target.value))}
              placeholder="Rechercher une course, ville, département, organisateur..."
              className="bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 outline-none flex-1"
            />
          </div>
          <span className="text-sm font-semibold text-zinc-500 flex-shrink-0">
            {filtered.length.toLocaleString("fr")} course{filtered.length > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setShowMap(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-sm"
          >
            <Map className="w-3.5 h-3.5" />
            Carte
          </button>
          <button
            onClick={() => setShowSync(s => !s)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${showSync ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
          >
            <Globe className="w-3.5 h-3.5" />
            Import
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={region}
            onChange={e => handleFilterChange(() => setRegion(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {REGIONS.map(r => <option key={r}>{r}</option>)}
          </select>

          <select
            value={raceType}
            onChange={e => handleFilterChange(() => setRaceType(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">Tous types</option>
            {Object.entries(RACE_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={e => handleFilterChange(() => setDateFrom(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          {(search || region !== "Toutes" || raceType !== "all" || dateFrom) && (
            <button
              onClick={() => handleFilterChange(() => { setSearch(""); setRegion("Toutes"); setRaceType("all"); setDateFrom(""); })}
              className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* ── Sync panel ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {showSync && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-zinc-100">
                <div className="flex items-start gap-4 flex-wrap">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700 mb-1">Sources (courses futures uniquement)</p>
                    <div className="flex gap-2 flex-wrap">
                      {["jogging-plus.com", "WP API + JSON-LD", "FFA athle.fr"].map(s => (
                        <span key={s} className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium">
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">Courses passées supprimées auto · GPS enrichi automatiquement</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700 block mb-1">
                      Pages jogging-plus.com (113 pages dispo)
                    </label>
                    <input
                      type="range" min={1} max={25} value={syncPages}
                      onChange={e => setSyncPages(parseInt(e.target.value))}
                      className="w-32 accent-green-600"
                    />
                    <span className="text-xs text-zinc-500 ml-2">{syncPages} page{syncPages > 1 ? "s" : ""} (~{syncPages * 100} courses)</span>
                  </div>

                  <button
                    onClick={triggerSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-60 transition-all"
                  >
                    {syncing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Import en cours...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4" /> Importer les courses</>
                    )}
                  </button>
                </div>

                {/* Sync result */}
                {syncResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-3 p-3 rounded-xl flex items-start gap-3 ${syncResult.error ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}
                  >
                    {syncResult.error ? (
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="text-xs">
                      {syncResult.error ? (
                        <p className="text-red-700 font-medium">{syncResult.error}</p>
                      ) : (
                        <>
                          <p className="text-green-800 font-semibold">
                            ✅ {syncResult.scraped} courses scrapées → {syncResult.inserted} importées
                          </p>
                          <p className="text-green-700 mt-0.5">
                            Total en base : <strong>{syncResult.total_in_db}</strong> courses
                            {syncResult.sources && ` • HTML calendrier: ${syncResult.sources.calendar_html} • WP API: ${syncResult.sources.wordpress_api}`}
                          </p>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* Race list */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-auto">
          {paginated.length === 0 ? (
            <div className="bento-card text-center py-16">
              <Globe className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">Aucune course trouvée</p>
              <p className="text-zinc-400 text-sm mt-1">
                {races.length < 20 ? "Utilise le bouton Import pour charger les courses françaises." : "Essaie d'autres filtres."}
              </p>
              {races.length < 20 && (
                <button
                  onClick={() => setShowSync(true)}
                  className="mt-4 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700"
                >
                  Importer les courses →
                </button>
              )}
            </div>
          ) : (
            paginated.map((race, i) => (
              <motion.div
                key={race.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.3) }}
                onClick={() => setSelected(race)}
                className={`bento-card cursor-pointer transition-all hover:shadow-md ${selected?.id === race.id ? "ring-2 ring-green-500 bg-green-50/30" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-1.5 self-stretch min-h-[44px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: DIFF_COLORS[race.difficulty] || "#22c55e" }}
                  />
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-zinc-900 text-sm leading-snug">{race.name}</h3>
                      <span
                        className="px-2 py-0.5 rounded-lg text-xs font-bold flex-shrink-0 text-white"
                        style={{ backgroundColor: DIFF_COLORS[race.difficulty] || "#22c55e" }}
                      >
                        {DIFFICULTIES[race.difficulty] || "Verte"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(race.date)}
                      </span>
                      {(race.city || race.department) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {race.city ? `${race.city}${race.department ? ` (${race.department})` : ""}` : race.department}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-semibold text-zinc-700">
                        <Zap className="w-3 h-3 text-green-500" />
                        {race.distance_km} km
                      </span>
                      {race.elevation_gain_m > 0 && (
                        <span className="flex items-center gap-1">
                          <Mountain className="w-3 h-3" />
                          +{race.elevation_gain_m}m
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-600 font-medium">
                        {RACE_TYPES[race.type as keyof typeof RACE_TYPES] ?? race.type}
                      </span>
                      {race.is_itra_certified && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                          ITRA {race.itra_points}pts
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </button>
              <span className="text-sm text-zinc-500">
                Page {page + 1} / {totalPages} — {filtered.length.toLocaleString("fr")} courses
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                Suivant <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-[360px] flex-shrink-0 bento-card overflow-auto"
            >
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-zinc-400 hover:text-zinc-600 mb-3"
              >
                ✕ Fermer
              </button>

              <div className="mb-4">
                <div
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold text-white mb-2"
                  style={{ backgroundColor: DIFF_COLORS[selected.difficulty] || "#22c55e" }}
                >
                  {RACE_TYPES[selected.type as keyof typeof RACE_TYPES] ?? selected.type}
                  {selected.is_itra_certified && ` • ITRA ${selected.itra_points}pts`}
                </div>
                <h2 className="text-lg font-bold text-zinc-900 leading-snug">{selected.name}</h2>
                {selected.organization && (
                  <p className="text-xs text-zinc-400 mt-0.5">{selected.organization}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: "Distance", value: `${selected.distance_km} km` },
                  { label: "Dénivelé +", value: selected.elevation_gain_m > 0 ? `${selected.elevation_gain_m} m` : "—" },
                  { label: "Date", value: formatDate(selected.date, "long") },
                  { label: "Lieu", value: selected.city ? `${selected.city}${selected.department ? `, ${selected.department}` : ""}` : (selected.department || "—") },
                ].map(m => (
                  <div key={m.label} className="bg-zinc-50 rounded-xl p-3">
                    <div className="text-xs text-zinc-400 font-medium">{m.label}</div>
                    <div className="font-semibold text-zinc-900 text-sm mt-0.5 leading-snug">{m.value}</div>
                  </div>
                ))}
              </div>

              {selected.description && (
                <p className="text-sm text-zinc-600 leading-relaxed mb-4">{selected.description}</p>
              )}

              {Array.isArray(selected.time_limits) && selected.time_limits.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">
                    Barrières Horaires
                  </div>
                  <div className="space-y-1.5">
                    {(selected.time_limits as Array<{ checkpoint: string; km: number; time_limit_seconds: number }>).map(tl => (
                      <div key={tl.checkpoint} className="flex items-center justify-between text-sm py-1.5 border-b border-zinc-100">
                        <span className="text-zinc-600 text-xs">{tl.checkpoint}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400">{tl.km} km</span>
                          <span className="font-semibold text-zinc-900 text-sm flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {Math.floor(tl.time_limit_seconds / 3600)}h{String(Math.floor((tl.time_limit_seconds % 3600) / 60)).padStart(2, "0")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button className="btn-brand w-full justify-center text-sm">
                  <Zap className="w-4 h-4" />
                  M&apos;entraîner pour cette course
                </button>
                {selected.registration_url && (
                  <a
                    href={selected.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full justify-center text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    S&apos;inscrire
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
