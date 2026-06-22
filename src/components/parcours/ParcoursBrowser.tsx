"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, MapPin, Mountain, Loader2, ChevronLeft, ChevronRight,
  SlidersHorizontal, Flame, Download, Route as RouteIcon, LocateFixed, Timer,
} from "lucide-react";
import { toast } from "sonner";
import {
  SPORTS, DIFFICULTES, TYPES, SPORT_META, DIFF_META, SPORT_ACTIVITY, coordFor,
  type ParcoursHdf, type SortKey, type Facets,
} from "@/data/parcoursHdf";
import { tileUrl, thumbZoomFor } from "@/data/famousRoutes";
import { generateTrace } from "@/lib/parcoursTrace";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PX, fillP } from "./parcoursI18n";

// Onglets sport : clé canonique + emoji (libellé traduit au rendu).
const SPORT_TABS: { key: string; emoji: string }[] = [
  { key: "all", emoji: "🌍" },
  ...SPORTS.map((s) => ({ key: s, emoji: SPORT_META[s].emoji })),
];

const SORT_KEYS: SortKey[] = ["recommande", "proche", "distance-asc", "distance-desc", "denivele-desc", "denivele-asc", "alpha"];

interface ApiResponse {
  items: ParcoursHdf[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: Facets;
}

// ─── Composant ───────────────────────────────────────────────────────────────────
export function ParcoursBrowser({ initialSearch = "" }: { initialSearch?: string } = {}) {
  const { lang } = useT();
  const L = PX[lang] ?? PX.fr;
  const pr = (k: string, p?: Record<string, string | number>) => fillP(L[k] ?? k, p);
  const [search, setSearch] = useState(initialSearch);
  const [debounced, setDebounced] = useState(initialSearch);
  const [sport, setSport] = useState("all");
  const [difficulte, setDifficulte] = useState("all");
  const [type, setType] = useState("all");
  const [region, setRegion] = useState("all");
  const [departement, setDepartement] = useState("all");
  const [distMax, setDistMax] = useState(100);
  const [sort, setSort] = useState<SortKey>("recommande");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [facets, setFacets] = useState<Facets>({ regions: [], deptsByRegion: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debounced, sport, difficulte, type, region, departement, distMax, sort]);

  // La région pilote la liste des départements.
  const deptsForRegion = region === "all" ? [] : (facets.deptsByRegion[region] ?? []);
  useEffect(() => { setDepartement("all"); }, [region]);

  // « Près de moi » : géolocalise (position jamais stockée) puis trie par proximité.
  const locateMe = useCallback(() => {
    if (sort === "proche") { setSort("recommande"); setNear(null); return; } // re-clic → désactive
    if (!navigator.geolocation) { toast.error(L["t.geoNo"]); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort("proche");
        setLocating(false);
        toast.success(L["t.sorted"]);
      },
      () => { setLocating(false); toast.error(L["t.posErr"]); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [sort, L]);

  const reqId = useRef(0);
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({
      q: debounced, sport, difficulte, type, region, departement,
      distMax: String(distMax), sort, page: String(page), pageSize: "12",
    });
    if (sort === "proche" && near) params.set("near", `${near.lat.toFixed(4)},${near.lng.toFixed(4)}`);
    fetch(`/api/parcours?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (id !== reqId.current) return;
        if (json.error && !json.items?.length) { setError(json.error); setData(null); }
        else { setError(null); setData(json); }
        if (json.facets?.regions?.length) setFacets(json.facets);
      })
      .catch(() => { if (id === reqId.current) setError(L["errLoad"]); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [debounced, sport, difficulte, type, region, departement, distMax, sort, page, near]);

  const resetFilters = useCallback(() => {
    setSearch(""); setSport("all"); setDifficulte("all"); setType("all");
    setRegion("all"); setDepartement("all"); setDistMax(100); setSort("recommande"); setNear(null);
  }, []);

  // Clic → charge la VRAIE géométrie GPS (OSM, à la demande) sur la carte au-dessus.
  const loadOnMap = useCallback(async (p: ParcoursHdf) => {
    if (loadingId) return;
    setLoadingId(p.id);
    const tid = toast.loading(pr("t.loadingNamed", { name: p.nom }));
    try {
      let coordinates: [number, number][] | undefined = p.coordinates;
      if (!coordinates || coordinates.length < 2) {
        const oid = p.osm_id ?? p.id;
        const res = await fetch(`/api/parcours/geometry?id=${oid}&type=${p.osm_type || "relation"}`);
        const json = await res.json();
        if (Array.isArray(json.coordinates) && json.coordinates.length > 1) coordinates = json.coordinates;
      }
      if (!coordinates || coordinates.length < 2) coordinates = await generateTrace(p);
      // Garde-fou : géométrie OSM incomplète (relation « coquille ») → on prévient au lieu d'afficher un tracé bancal.
      if (coordinates.length < 4 || traceLengthKm(coordinates) < 0.4) {
        toast.error(L["t.traceIncomplete"], { id: tid });
        return;
      }
      window.dispatchEvent(new CustomEvent("te:loadRoute", { detail: { id: p.id, name: p.nom, activity: SPORT_ACTIVITY[p.sport], coordinates } }));
      toast.success(L["t.traceLoaded"], { id: tid });
    } catch {
      toast.error(L["t.traceErr"], { id: tid });
    } finally {
      setLoadingId(null);
    }
  }, [loadingId, L, pr]);

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <section className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5 sm:p-6">
      {/* ── En-tête ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900">
            <RouteIcon className="w-5 h-5 text-green-600" />
            {L["title"]}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {L["subtitle"]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-2xl text-sm font-semibold shadow-sm transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" /> {showFilters ? L["hide"] : L["filters"]}
        </button>
      </div>

      {/* ── Recherche + tri ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" aria-hidden="true" />
          <label htmlFor="pb-search" className="sr-only">{L["searchSr"]}</label>
          <input
            id="pb-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L["searchPh"]}
            className="w-full pl-10 pr-10 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          />
          {search && (
            <button
              type="button" onClick={() => setSearch("")} aria-label={L["clearSearch"]}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-zinc-400 hover:bg-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          aria-pressed={sort === "proche"}
          title={L["nearTitle"]}
          className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-60 ${
            sort === "proche"
              ? "bg-green-600 text-white shadow-sm"
              : "bg-zinc-50 text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
          }`}
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          {L["nearMe"]}
        </button>
        <select
          value={sort === "proche" ? "recommande" : sort}
          onChange={(e) => { setSort(e.target.value as SortKey); setNear(null); }}
          aria-label={L["sortAria"]}
          className="px-3 py-3 rounded-2xl bg-zinc-50 border border-zinc-200 text-sm font-medium text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 cursor-pointer"
        >
          {SORT_KEYS.filter((k) => k !== "proche").map((k) => (
            <option key={k} value={k}>{pr(`sort.${k}`)}</option>
          ))}
        </select>
      </div>

      {/* ── Onglets sport ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {SPORT_TABS.map((t) => {
          const active = sport === t.key;
          return (
            <button
              key={t.key} type="button" onClick={() => setSport(t.key)} aria-pressed={active}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                active ? "bg-zinc-900 text-white shadow-sm" : "bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              <span className="text-base leading-none">{t.emoji}</span>
              {t.key === "all" ? L["allTab"] : pr(`sport.${t.key}`)}
            </button>
          );
        })}
      </div>

      {/* ── Filtres détaillés ─────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-x-5 gap-y-4">
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">{L["f.diff"]}</span>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", ...DIFFICULTES] as const).map((d) => {
                    const active = difficulte === d;
                    return (
                      <button
                        key={d} type="button" onClick={() => setDifficulte(d)} aria-pressed={active}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          active ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 border border-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        {d !== "all" && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DIFF_META[d].color }} />}
                        {d === "all" ? L["allF"] : pr(`diff.${d}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">{L["f.type"]}</span>
                <div className="flex gap-1.5">
                  {(["all", ...TYPES] as const).map((t) => {
                    const active = type === t;
                    return (
                      <button
                        key={t} type="button" onClick={() => setType(t)} aria-pressed={active}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          active ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 border border-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        {t === "all" ? L["allM"] : pr(`type.${t}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="pb-region" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">{L["f.region"]}</label>
                <select
                  id="pb-region" value={region} onChange={(e) => setRegion(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-zinc-200 text-sm font-medium text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 cursor-pointer max-w-[220px]"
                >
                  <option value="all">{L["allF"]}</option>
                  {facets.regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="pb-dept" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">{L["f.dept"]}</label>
                <select
                  id="pb-dept" value={departement} onChange={(e) => setDepartement(e.target.value)} disabled={region === "all"}
                  className="px-3 py-2 rounded-xl bg-white border border-zinc-200 text-sm font-medium text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed max-w-[200px]"
                >
                  <option value="all">{region === "all" ? L["chooseRegion"] : L["allM"]}</option>
                  {deptsForRegion.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="min-w-[170px]">
                <label htmlFor="pb-dist" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  {L["f.dist"]} <span className="text-zinc-700">{distMax >= 100 ? L["distAll"] : pr("distMax", { n: distMax })}</span>
                </label>
                <input
                  id="pb-dist" type="range" min={5} max={100} step={5} value={distMax}
                  onChange={(e) => setDistMax(Number(e.target.value))}
                  className="w-full accent-green-600 cursor-pointer"
                />
              </div>

              <button type="button" onClick={resetFilters} className="ml-auto text-xs font-semibold text-zinc-400 hover:text-green-600 transition-colors">
                {L["reset"]}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Compteur ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-zinc-500">
          {loading ? L["loading"] : <><span className="font-semibold text-zinc-800">{total.toLocaleString(lang)}</span> {L["realRoutes"]}</>}
        </span>
        {totalPages > 1 && !loading && <span className="text-xs text-zinc-400">{pr("pageOf", { p: data?.page ?? 1, t: totalPages })}</span>}
      </div>

      {/* ── Grille ────────────────────────────────────────────── */}
      {error ? (
        <div className="text-center py-16">
          <Mountain className="w-9 h-9 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500">{error}</p>
        </div>
      ) : loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="rounded-3xl border border-zinc-200 overflow-hidden bg-white">
              <div className="h-36 bg-zinc-100 animate-pulse" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 w-3/4 rounded bg-zinc-100 animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-zinc-100 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-zinc-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16">
          <Mountain className="w-9 h-9 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500">{L["empty"]}</p>
          <button onClick={resetFilters} className="mt-3 text-sm font-semibold text-green-600 hover:text-green-700">{L["resetFilters"]}</button>
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {data?.items.map((p) => (
            <ParcoursCard key={p.id} p={p} near={sort === "proche" ? near : null} loading={loadingId === p.id} disabled={loadingId !== null && loadingId !== p.id} onLoad={() => loadOnMap(p)} />
          ))}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────── */}
      {totalPages > 1 && !error && (
        <Pagination page={data?.page ?? 1} totalPages={totalPages} onChange={(n) => setPage(n)} prevLabel={L["pagePrev"]} nextLabel={L["pageNext"]} />
      )}

      {/* ── Attribution (obligatoire ODbL) ────────────────────── */}
      <p className="mt-6 text-center text-[11px] text-zinc-400">
        {L["attrPre"]}{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">
          {L["attrLink"]}
        </a>{" "}
        {L["attrPost"]}
      </p>
    </section>
  );
}

// ─── GPX : tracé téléchargeable (montre / téléphone / appli GPS) ───────────────────
function traceLengthKm(coords: [number, number][]): number {
  const R = 6371; let d = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const dLat = ((b[1] - a[1]) * Math.PI) / 180, dLng = ((b[0] - a[0]) * Math.PI) / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    d += R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  return d;
}
function escapeXml(s: string): string {
  const map: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };
  return s.replace(/[<>&'"]/g, (c) => map[c] ?? c);
}
function buildGpx(name: string, coords: [number, number][]): string {
  const seg = coords.map(([lng, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pacevo" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(name)}</name><desc>Tracé © les contributeurs OpenStreetMap (ODbL)</desc></metadata>
  <trk><name>${escapeXml(name)}</name><trkseg>
${seg}
  </trkseg></trk>
</gpx>`;
}

// ─── Carte parcours ──────────────────────────────────────────────────────────────
function ParcoursCard({ p, near, loading, disabled, onLoad }: { p: ParcoursHdf; near?: { lat: number; lng: number } | null; loading: boolean; disabled: boolean; onLoad: () => void }) {
  const { lang } = useT();
  const L = PX[lang] ?? PX.fr;
  const pr = (k: string, pp?: Record<string, string | number>) => fillP(L[k] ?? k, pp);
  const meta = SPORT_META[p.sport];
  const diff = DIFF_META[p.difficulte];
  const c = coordFor(p); // centre réel du parcours
  const [dl, setDl] = useState(false);
  // Distance à vol d'oiseau depuis la position de l'utilisateur (mode « Près de moi »).
  const kmAway = near && p.lat != null && p.lng != null
    ? (() => {
        const dLat = ((p.lat - near.lat) * Math.PI) / 180, dLng = ((p.lng! - near.lng) * Math.PI) / 180;
        const s = Math.sin(dLat / 2) ** 2 + Math.cos((near.lat * Math.PI) / 180) * Math.cos((p.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return Math.round(6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
      })()
    : null;

  const downloadGpx = useCallback(async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (dl) return;
    setDl(true);
    const tid = toast.loading(L["t.gpxPrep"]);
    try {
      let coords: [number, number][] | undefined = p.coordinates;
      if (!coords || coords.length < 2) {
        const res = await fetch(`/api/parcours/geometry?id=${p.osm_id ?? p.id}&type=${p.osm_type || "relation"}`);
        const json = await res.json();
        if (Array.isArray(json.coordinates)) coords = json.coordinates;
      }
      if (!coords || coords.length < 2) { toast.error(L["t.gpxNa"], { id: tid }); return; }
      const blob = new Blob([buildGpx(p.nom, coords)], { type: "application/gpx+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${p.nom.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "parcours"}.gpx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(L["t.gpxOk"], { id: tid });
    } catch {
      toast.error(L["t.gpxFail"], { id: tid });
    } finally {
      setDl(false);
    }
  }, [dl, p, L]);

  return (
    <div className="relative group">
    <button
      type="button" onClick={onLoad} disabled={disabled}
      className="block w-full text-left bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="relative h-36 overflow-hidden bg-zinc-100">
        <img
          src={tileUrl(c.lat, c.lng, thumbZoomFor(p.distance_km || 10))}
          alt="" loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
        {/* (pastille centrale supprimée : elle masquait le cœur de la mini-carte) */}
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.chip}`}>{meta.emoji} {pr(`sport.${p.sport}`)}</span>
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow" style={{ backgroundColor: diff.color }}>{pr(`diff.${p.difficulte}`)}</span>
        {kmAway != null && (
          <span className="absolute bottom-2.5 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-600/90 backdrop-blur text-[10px] font-bold text-white shadow">
            <LocateFixed className="w-3 h-3" /> {pr("kmAway", { n: kmAway })}
          </span>
        )}
        <span className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur text-[10px] font-medium text-white">{pr(`type.${p.type_parcours}`)}</span>
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
            <span className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <Loader2 className="w-4 h-4 animate-spin text-green-600" /> {L["loadingTrace"]}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-zinc-900 leading-snug line-clamp-2 min-h-[2.6em]">{p.nom}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[13px] text-zinc-700 font-semibold">
          {p.distance_km > 0 ? (
            <>
              <span className="flex items-center gap-1"><RouteIcon className="w-3.5 h-3.5 text-green-600" />{p.distance_km.toFixed(1)} km</span>
              {p.temps_estime !== "—" && <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5 text-zinc-400" />{p.temps_estime}</span>}
            </>
          ) : (
            <span className="text-zinc-400 font-medium">{L["distToTrace"]}</span>
          )}
          {p.denivele_positif_m > 0 && <span className="flex items-center gap-1"><Mountain className="w-3.5 h-3.5 text-amber-500" />+{p.denivele_positif_m} m</span>}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{p.localisation.departement} · {p.localisation.region}</span>
          </div>
          {p.calories_kcal > 0 && (
            <span className="text-[11px] text-zinc-300 flex-shrink-0 flex items-center gap-1">
              <Flame className="w-3 h-3" /> {p.calories_kcal}
            </span>
          )}
        </div>
      </div>
    </button>

      {/* Bouton GPX — télécharge le vrai tracé (montre / téléphone / appli GPS) */}
      <button
        type="button" onClick={downloadGpx} disabled={dl}
        aria-label={pr("gpxAria", { name: p.nom })}
        title={L["gpxTitle"]}
        className="absolute bottom-3.5 right-3.5 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-white bg-zinc-900/90 backdrop-blur hover:bg-green-600 shadow-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      >
        {dl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} GPX
      </button>
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onChange, prevLabel, nextLabel }: { page: number; totalPages: number; onChange: (n: number) => void; prevLabel: string; nextLabel: string }) {
  const around = 1;
  const pages: (number | "…")[] = [];
  const push = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  push(1);
  if (page - around > 2) pages.push("…");
  for (let n = Math.max(2, page - around); n <= Math.min(totalPages - 1, page + around); n++) push(n);
  if (page + around < totalPages - 1) pages.push("…");
  if (totalPages > 1) push(totalPages);

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8">
      <button
        type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={prevLabel}
        className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-1.5 text-zinc-400 select-none">…</span>
        ) : (
          <button
            key={n} type="button" onClick={() => onChange(n)} aria-current={n === page}
            className={`min-w-[2.25rem] h-9 px-2 rounded-xl text-sm font-semibold transition-colors ${
              n === page ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label={nextLabel}
        className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
