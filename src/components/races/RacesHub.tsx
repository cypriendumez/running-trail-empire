"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Search, MapPin, Mountain, Clock, Calendar, ExternalLink, Zap, ChevronLeft, ChevronRight, Globe, Loader2, Map, Flag, ArrowDownUp, Footprints, X, Heart } from "lucide-react";
import type { Race } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { grouperEvenements } from "@/lib/races/groupes";
import { joursAvant, correspond, domaineSource, ficheVerifiable } from "@/lib/races/temps";
import { fmtDistance, type UnitSystem } from "@/lib/units";
import { correctedRaceType } from "@/lib/raceType";
import { useT } from "@/lib/i18n/LanguageProvider";
import { RX, fillR } from "./racesI18n";
import { PpsStatusCard } from "@/components/pps/PpsStatusCard";
import { PPS_T } from "@/lib/pps/ppsI18n";
import { ppsVerdict, type PpsStatus } from "@/lib/pps/status";

// La carte (mapbox-gl + leaflet) est LOURDE : on la charge à la demande (quand l'utilisateur
// ouvre la carte), pas au chargement de la page → liste des courses bien plus rapide.
const RacesMapView = dynamic(() => import("./RacesMapView").then((m) => m.RacesMapView), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
    </div>
  ),
});

// « Toutes » = valeur sentinelle de filtre (libellé traduit au rendu) ; régions = toponymes FR.
const REGIONS = [
  "Toutes", "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne",
  "Centre-Val de Loire", "Corse", "Grand-Est", "Hauts-de-France",
  "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
  "Pays-de-la-Loire", "Provence-Alpes-Côte d'Azur",
  "Guadeloupe", "Martinique", "La Réunion",
];

const RACE_TYPE_KEYS = ["road_5k", "road_10k", "semi", "marathon", "trail_s", "trail_m", "trail_l", "trail_xl", "ultra"] as const;

const DIFF_COLORS: Record<string, string> = {
  green: "#22c55e", blue: "#3b82f6", red: "#ef4444", black: "#18181b",
};

// Cover générée par type (dégradé + icône) — image cohérente et 100 % légale.
const isTrailType = (t: string) => t.startsWith("trail") || t === "ultra";

const PAGE_SIZE = 30;

// "2099-01-01" convention = date inconnue → afficher "Date à venir"
function formatDate(dateStr: string, lang: string, tbd: string, style: "short" | "long" = "short"): string {
  if (!dateStr || dateStr.startsWith("2099")) return tbd;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return tbd;
  if (style === "long") return d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });
  return d.toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
}

// Jours restants avant la course. Voir `lib/races/temps` : le calcul en millisecondes
// donnait un « J−N » qui dépendait de l'HEURE de consultation, aux changements d'heure.
const daysTo = (dateStr: string): number | null => joursAvant(dateStr);

// Course planifiée par l'athlète (notification planned_race) — id requis pour l'annulation.
export type PlannedRace = { id: string; name: string; location: string; distanceKm: number | null; date: string };

const normName = (s: string) => (s || "").toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function RacesHub({ races: initialRaces, totalCount, units = "metric", planned: plannedProp = [], initialSearch = "", pps = null, liensMorts = [], favorisInitiaux = [] }: { favorisInitiaux?: string[]; liensMorts?: string[]; races: Race[]; totalCount?: number; units?: UnitSystem; planned?: PlannedRace[]; initialSearch?: string; pps?: PpsStatus | null }) {
  const { lang } = useT();
  const d = RX[lang] ?? RX.fr;
  const tr = (k: string, p?: Record<string, string | number>) => fillR(d[k] ?? k, p);
  const fdate = (s: string, style: "short" | "long" = "short") => formatDate(s, lang, d["dateTBD"], style);
  const [races, setRaces] = useState<Race[]>(initialRaces);
  // Le catalogue complet (~16,5k) arrive APRÈS le 1er rendu, depuis l'API cachée au CDN —
  // la page s'affiche instantanément avec les ~90 premières, puis se complète toute seule.
  const [loadingAll, setLoadingAll] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/races/list")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.races) || data.races.length <= initialRaces.length) return;
        setRaces(data.races as Race[]);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingAll(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [search, setSearch] = useState(initialSearch);
  const [region, setRegion] = useState("Toutes");
  const [raceType, setRaceType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [selected, setSelected] = useState<Race | null>(null);
  // Champs lourds (description, time_limits, terrain, organisation, URL d'inscription)
  // chargés à la demande au clic — pas embarqués dans le payload de liste.
  const [details, setDetails] = useState<Record<string, Partial<Race>>>({});
  const openRace = useCallback((r: Race) => {
    setSelected(r);
    if (details[r.id]) return;
    fetch(`/api/races/detail?id=${r.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { if (d) setDetails((m) => ({ ...m, [r.id]: d })); })
      .catch(() => {});
  }, [details]);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"date" | "distance" | "elevation">("date");
  const [planning, setPlanning] = useState(false);

  const [showMap, setShowMap] = useState(false);

  // ── FAVORIS ────────────────────────────────────────────────────────────────────
  //  Un catalogue de 17 027 courses ne se re-parcourt pas : on repère une course en
  //  septembre et on la cherche encore en mars. Le cœur la retrouve en un clic.
  const [favoris, setFavoris] = useState<Set<string>>(() => new Set(favorisInitiaux));
  const [filtreFavoris, setFiltreFavoris] = useState(false);
  const basculerFavori = useCallback(async (id: string) => {
    // ⚠️ ON BASCULE L'AFFICHAGE D'ABORD. Un cœur qui attend la réponse du serveur donne
    //    l'impression que le clic n'a pas pris, et on reclique — ce qui l'annule. En cas
    //    d'échec on REVIENT en arrière : mentir sur un enregistrement qui n'a pas eu
    //    lieu est pire que de faire attendre.
    const avant = favoris.has(id);
    setFavoris((f) => { const n = new Set(f); if (avant) n.delete(id); else n.add(id); return n; });
    try {
      const res = await fetch("/api/races/favori", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId: id, on: !avant }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFavoris((f) => { const n = new Set(f); if (avant) n.add(id); else n.delete(id); return n; });
      toast.error(d["t.saveErr"]);
    }
  }, [favoris, d]);

  const filtered = useMemo(() => {
    const q = search;
    const list = races.filter(r => {
      // ⚠️ CATALOGUE FRANÇAIS, RECHERCHE SANS ACCENTS. Comparer des minuscules brutes
      //    rendait 4 425 noms (30 %) et 3 027 villes introuvables sans taper l'accent
      //    au bon endroit : « foulees » ne trouvait pas « Foulées », « nimes » ne
      //    trouvait pas « Nîmes ».
      const matchSearch = !q ||
        correspond(r.name, q) ||
        correspond(r.organization, q) ||
        correspond(r.city, q) ||
        correspond(r.department, q);
      const matchRegion = region === "Toutes" ||
        r.region?.toLowerCase().replace(/-/g, " ").includes(region.toLowerCase().replace(/-/g, " "));
      const matchType = raceType === "all" || correctedRaceType(r.distance_km, r.type) === raceType;
      const matchDate = !dateFrom || r.date.startsWith("2099") || new Date(r.date) >= new Date(dateFrom);
      const matchFavori = !filtreFavoris || favoris.has(r.id);
      return matchSearch && matchRegion && matchType && matchDate && matchFavori;
    });
    return [...list].sort((a, b) => {
      if (sort === "distance") return (b.distance_km || 0) - (a.distance_km || 0);
      if (sort === "elevation") return (b.elevation_gain_m || 0) - (a.elevation_gain_m || 0);
      const ad = a.date?.startsWith("2099") ? "9999-99-99" : a.date;
      const bd = b.date?.startsWith("2099") ? "9999-99-99" : b.date;
      return ad.localeCompare(bd);
    });
  }, [races, search, region, raceType, dateFrom, sort, filtreFavoris, favoris]);

  // Courses déjà planifiées par l'athlète — partagé liste + carte (bouton vert ↔ rouge).
  const [plannedList, setPlannedList] = useState<PlannedRace[]>(plannedProp);
  const findPlanned = useCallback((r: Race): PlannedRace | undefined =>
    plannedList.find(p => normName(p.name) === normName(r.name) &&
      (p.distanceKm == null || Math.abs(Number(p.distanceKm) - Number(r.distance_km)) < 0.05)),
    [plannedList]);

  // « M'entraîner pour cette course » → ajoute la course au calendrier (objectif coach).
  const trainForRace = async (r: Race) => {
    if (planning || findPlanned(r)) return; // déjà planifiée → pas de doublon
    setPlanning(true);
    try {
      const date = r.date && !r.date.startsWith("2099") ? r.date : new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const res = await fetch("/api/calendar-entry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, kind: "race", name: r.name, location: r.city || r.department || "", distanceKm: r.distance_km }),
      });
      const j = await res.json();
      if (j.ok) {
        setPlannedList(ps => [...ps, { id: String(j.id), name: r.name, location: r.city || r.department || "", distanceKm: r.distance_km, date }]);
        toast.success(d["t.added"]);
      } else toast.error(j.error || d["t.fail"]);
    } catch { toast.error(d["t.saveErr"]); }
    finally { setPlanning(false); }
  };

  // « Annuler l'entraînement » → retire la course du calendrier (le coach n'en tient plus compte).
  // Supprime TOUTES les copies correspondantes (un double-clic d'avant a pu en créer plusieurs).
  const cancelTraining = async (r: Race) => {
    const matches = plannedList.filter(p => normName(p.name) === normName(r.name) &&
      (p.distanceKm == null || Math.abs(Number(p.distanceKm) - Number(r.distance_km)) < 0.05));
    if (!matches.length || planning) return;
    setPlanning(true);
    try {
      const results = await Promise.all(matches.map(p =>
        fetch(`/api/calendar-entry?id=${p.id}`, { method: "DELETE" }).then(res => res.json()).catch(() => ({ ok: false }))));
      const okIds = matches.filter((_, i) => results[i]?.ok).map(p => p.id);
      if (okIds.length) {
        setPlannedList(ps => ps.filter(x => !okIds.includes(x.id)));
        toast(d["t.cancelled"], { icon: "🗑️" });
      }
      if (okIds.length < matches.length) toast.error(d["t.someFail"]);
    } catch { toast.error(d["t.cancelErr"]); }
    finally { setPlanning(false); }
  };

  // ⚠️ ON PAGINE DES ÉVÉNEMENTS, PAS DES LIGNES. Une carte par distance faisait
  //    apparaître « Boucles de Saint-Thonan » trois fois de suite (10, 9 et 5 km) — même
  //    ville, même date, même inscription — et repoussait les vraies courses suivantes
  //    hors de l'écran. Mesuré sur le catalogue : 15 000 lignes pour 8 613 événements.
  const evenements = useMemo(() => grouperEvenements(filtered), [filtered]);
  const totalPages = Math.ceil(evenements.length / PAGE_SIZE);
  const paginated = evenements.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleFilterChange = useCallback((fn: () => void) => { fn(); setPage(0); }, []);

  // Le bandeau PPS n'apparaît QUE s'il y a quelque chose à faire : rappeler « tout va
  // bien » à chaque visite est le meilleur moyen de rendre l'alerte invisible le jour
  // où elle compte. On le confronte à la PROCHAINE course planifiée, pas à aujourd'hui.
  const prochaineCourse = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return plannedProp.map((p) => p.date).filter((x) => x && x >= today).sort()[0] ?? null;
  }, [plannedProp]);
  const ppsAlerte = useMemo(() => {
    const v = ppsVerdict(pps, prochaineCourse);
    return v.kind === "inconnu" || v.kind === "expire" || v.kind === "expireAvantCourse";
  }, [pps, prochaineCourse]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {ppsAlerte && (
        <div className="px-0">
          <PpsStatusCard status={pps} raceDate={prochaineCourse} compact />
        </div>
      )}
      {/* Map overlay — partage l'état « planifiée » avec la liste */}
      <AnimatePresence>
        {showMap && (
          <RacesMapView races={races} onClose={() => setShowMap(false)}
            findPlanned={findPlanned} onTrain={trainForRace} onCancel={cancelTraining} busy={planning} />
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
              placeholder={d["searchPh"]}
              className="bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 outline-none flex-1"
            />
          </div>
          <span className="flex-shrink-0 text-right">
            <span className="flex items-center justify-end gap-1.5 text-sm font-semibold text-zinc-600">
              {loadingAll && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />}
              {/* ⚠️ LE GRAND NOMBRE COMPTE LES COURSES, PAS LES CARTES. Une « course »
                  pour un coureur, c'est un dossard : le 10 km et le 42 km d'un même
                  week-end sont deux courses différentes, qu'on prépare différemment et
                  qu'on ne peut pas courir toutes les deux. Afficher 8 975 (le nombre
                  d'ÉVÉNEMENTS) donnait l'impression d'un catalogue deux fois plus
                  pauvre qu'il n'est — alors que rien n'avait été retiré : le
                  regroupement ne change que la mise en page des cartes.
                  La sous-ligne dit combien d'événements cela représente, ce qui explique
                  l'écart avec le nombre de cartes affichées. */}
              {(loadingAll && !search && region === "Toutes" && raceType === "all" && !dateFrom ? (totalCount ?? filtered.length) : filtered.length).toLocaleString(lang)} {filtered.length > 1 || loadingAll ? d["courses"] : d["course"]}
            </span>
            {!loadingAll && (
              <span className="block text-[11px] text-zinc-400">
                {evenements.length.toLocaleString(lang)} {d["events"]} · {races.filter(r => r.date?.startsWith("2099")).length.toLocaleString(lang)} {d["toConfirm"]}
              </span>
            )}
          </span>
          <button
            onClick={() => setShowMap(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-sm"
          >
            <Map className="w-3.5 h-3.5" />
            {d["map"]}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={region}
            onChange={e => handleFilterChange(() => setRegion(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {REGIONS.map(r => <option key={r} value={r}>{r === "Toutes" ? d["allRegions"] : r}</option>)}
          </select>

          <select
            value={raceType}
            onChange={e => handleFilterChange(() => setRaceType(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">{d["allTypes"]}</option>
            {RACE_TYPE_KEYS.map(v => <option key={v} value={v}>{d[`rt.${v}`]}</option>)}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={e => handleFilterChange(() => setDateFrom(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white pl-2.5">
            <ArrowDownUp className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={sort}
              onChange={e => handleFilterChange(() => setSort(e.target.value as "date" | "distance" | "elevation"))}
              className="cursor-pointer bg-transparent py-1.5 pr-2 text-sm text-zinc-700 focus:outline-none"
            >
              <option value="date">{d["sort.date"]}</option>
              <option value="distance">{d["sort.distance"]}</option>
              <option value="elevation">{d["sort.elevation"]}</option>
            </select>
          </div>
          {/* Filtre « mes favoris » : c'est ce qui rend le cœur utile. Sans lui, on
              marque des courses qu'on ne retrouve pas mieux qu'avant. */}
          <button type="button" onClick={() => handleFilterChange(() => setFiltreFavoris((v) => !v))}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              filtreFavoris
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-zinc-200 text-zinc-600 hover:border-rose-200 hover:text-rose-600"}`}>
            <Heart className="h-4 w-4" fill={filtreFavoris ? "currentColor" : "none"} />
            {d["fav.filter"]}
            {favoris.size > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] font-bold ${filtreFavoris ? "bg-rose-200 text-rose-800" : "bg-zinc-100 text-zinc-500"}`}>
                {favoris.size}
              </span>
            )}
          </button>

          {(search || region !== "Toutes" || raceType !== "all" || dateFrom) && (
            <button
              onClick={() => handleFilterChange(() => { setSearch(""); setRegion("Toutes"); setRaceType("all"); setDateFrom(""); })}
              className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              {d["reset"]}
            </button>
          )}
        </div>

      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* Race list */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-auto">
          {paginated.length === 0 ? (
            <div className="bento-card text-center py-16">
              <Globe className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">{d["empty.title"]}</p>
              <p className="text-zinc-400 text-sm mt-1">{d["empty.sub"]}</p>
            </div>
          ) : (
            paginated.map((evt, i) => {
              const race = evt.principale;
              return (
              <motion.div
                key={evt.cle}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.3) }}
                onClick={() => openRace(race)}
                className={`bento-card cursor-pointer transition-all hover:shadow-md ${selected?.id === race.id ? "ring-2 ring-emerald-500 bg-emerald-50/30" : ""}`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${DIFF_COLORS[race.difficulty] || "#22c55e"} 0%, ${DIFF_COLORS[race.difficulty] || "#22c55e"}cc 100%)` }}
                  >
                    {isTrailType(correctedRaceType(race.distance_km, race.type))
                      ? <Mountain className="h-5 w-5" />
                      : <Footprints className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-zinc-900 text-sm leading-snug">{race.name}</h3>
                      <span className="flex flex-shrink-0 items-center gap-1.5">
                        {/* Le cœur porte sur l'ÉVÉNEMENT, donc sur son format principal :
                            mettre en favori « le 10 km » et pas « le 5 km » du même
                            week-end n'aurait pas de sens à l'échelle d'une carte. */}
                        <button type="button" aria-label={d[favoris.has(race.id) ? "fav.remove" : "fav.add"]}
                          title={d[favoris.has(race.id) ? "fav.remove" : "fav.add"]}
                          onClick={(e) => { e.stopPropagation(); basculerFavori(race.id); }}
                          className={`rounded-lg p-1 transition-colors ${favoris.has(race.id)
                            ? "text-rose-500 hover:bg-rose-50"
                            : "text-zinc-300 hover:bg-zinc-100 hover:text-rose-400"}`}>
                          <Heart className="h-4 w-4" fill={favoris.has(race.id) ? "currentColor" : "none"} />
                        </button>
                        <span
                          className="px-2 py-0.5 rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: DIFF_COLORS[race.difficulty] || "#22c55e" }}
                        >
                          {d[`diff.${race.difficulty}`] || d["diff.green"]}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {fdate(race.date)}
                      </span>
                      {(() => {
                        const dd = daysTo(race.date);
                        if (dd == null || dd < 0 || dd > 90) return null;
                        return <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700">{dd === 0 ? d["jourJ"] : tr("dMinus", { n: dd })}</span>;
                      })()}
                      {(race.city || race.department) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {race.city ? `${race.city}${race.department ? ` (${race.department})` : ""}` : race.department}
                        </span>
                      )}
                      {/* Tous les formats de l'événement, du plus court au plus long.
                          Chacun est cliquable : c'est la distance qui intéresse, pas
                          l'événement en bloc. */}
                      <span className="flex flex-wrap items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-500" />
                        {evt.formats.map((f) => (
                          <button key={f.id} type="button"
                            onClick={(e) => { e.stopPropagation(); openRace(f); }}
                            className={`rounded px-1.5 py-0.5 font-semibold transition-colors ${
                              selected?.id === f.id
                                ? "bg-emerald-600 text-white"
                                : evt.formats.length > 1
                                  ? "bg-zinc-100 text-zinc-700 hover:bg-emerald-100 hover:text-emerald-800"
                                  : "text-zinc-700"}`}>
                            {fmtDistance(f.distance_km, units)}
                          </button>
                        ))}
                      </span>
                      {/* ⚠️ LE DÉNIVELÉ DE L'ÉVÉNEMENT, PAS CELUI DU SEUL FORMAT PRINCIPAL.
                          La carte porte la distance la plus longue, qui n'est pas
                          forcément la plus montagneuse : sur 124 événements du catalogue,
                          le format le plus long n'est pas le plus haut. Triée par
                          dénivelé, la liste plaçait donc la carte selon une valeur
                          qu'elle n'affichait pas. On montre le maximum du groupe. */}
                      {(() => {
                        const dplus = Math.max(0, ...evt.formats.map((f) => Number(f.elevation_gain_m) || 0));
                        return dplus > 0 ? (
                          <span className="flex items-center gap-1">
                            <Mountain className="w-3 h-3" />
                            +{dplus}m
                          </span>
                        ) : null;
                      })()}
                      {/* ⚠️ L'ÉTIQUETTE DE TYPE RÉPÉTAIT LA DISTANCE. « 10 Km d'Houppeville »
                          affichait « 10 km » (la distance) puis « 10 km » (la famille
                          `road_10k`) : deux fois le même mot, dont le second n'apprend
                          rien. On ne la montre que lorsqu'elle DIT autre chose — « Trail »,
                          « Marathon », « Ultra » — c'est-à-dire quand elle informe.
                          Sur un événement à plusieurs formats, les distances parlent
                          d'elles-mêmes et une famille unique serait de toute façon fausse. */}
                      {(() => {
                        const lib = d[`rt.${correctedRaceType(race.distance_km, race.type)}`] ?? race.type;
                        if (evt.formats.length > 1) return null;
                        const distances = evt.formats.map((f) => fmtDistance(f.distance_km, units));
                        if (distances.some((x) => x === lib)) return null;
                        return (
                          <span className="px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-600 font-medium">{lib}</span>
                        );
                      })()}
                      {race.is_itra_certified && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                          ITRA {race.itra_points}pts
                        </span>
                      )}
                      {findPlanned(race) && (
                        <span className="flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 font-bold text-white">
                          <Flag className="h-3 w-3" /> {d["planned"]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
              );
            })
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> {d["prev"]}
              </button>
              <span className="text-sm text-zinc-500">
                {/* ⚠️ « ÉVÉNEMENTS », PAS « COURSES ». Cette ligne comptait des cartes en
                    les appelant « courses », juste sous un en-tête qui annonce
                    17 027 courses : le même mot pour deux nombres, à deux endroits de
                    la même page. Une carte regroupe toutes les distances d'un même
                    week-end — c'est un événement, pas une course. */}
                {tr("pageInfo", { p: page + 1, t: totalPages, n: evenements.length.toLocaleString(lang) })}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                {d["next"]} <ChevronRight className="w-4 h-4" />
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
                ✕ {d["close"]}
              </button>

              <div className="mb-4">
                <div
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold text-white mb-2"
                  style={{ backgroundColor: DIFF_COLORS[selected.difficulty] || "#22c55e" }}
                >
                  {d[`rt.${correctedRaceType(selected.distance_km, selected.type)}`] ?? selected.type}
                  {selected.is_itra_certified && ` • ITRA ${selected.itra_points}pts`}
                </div>
                <h2 className="text-lg font-bold text-zinc-900 leading-snug">{selected.name}</h2>
                {details[selected.id]?.organization && (
                  <p className="text-xs text-zinc-400 mt-0.5">{details[selected.id]?.organization}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: d["l.distance"], value: fmtDistance(selected.distance_km, units) },
                  { label: d["l.elevPlus"], value: (selected.elevation_gain_m ?? 0) > 0 ? `+${selected.elevation_gain_m} m` : "—" },
                  { label: d["l.date"], value: fdate(selected.date, "long") },
                  { label: d["l.place"], value: selected.city ? `${selected.city}${selected.department ? `, ${selected.department}` : ""}` : (selected.department || "—") },
                ].map(m => (
                  <div key={m.label} className="bg-zinc-50 rounded-xl p-3">
                    <div className="text-xs text-zinc-400 font-medium">{m.label}</div>
                    <div className="font-semibold text-zinc-900 text-sm mt-0.5 leading-snug">{m.value}</div>
                  </div>
                ))}
              </div>

              {details[selected.id]?.description && (
                <p className="text-sm text-zinc-600 leading-relaxed mb-4">{details[selected.id]?.description}</p>
              )}

              {Array.isArray(details[selected.id]?.time_limits) && (details[selected.id]?.time_limits?.length ?? 0) > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">
                    {d["timeLimits"]}
                  </div>
                  <div className="space-y-1.5">
                    {(details[selected.id]?.time_limits as Array<{ checkpoint: string; km: number; time_limit_seconds: number }>).map(tl => (
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
                {findPlanned(selected) ? (
                  <button
                    onClick={() => cancelTraining(selected)}
                    disabled={planning}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-100 disabled:opacity-60"
                  >
                    {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    {d["cancelTrain"]}
                  </button>
                ) : (
                  <button
                    onClick={() => trainForRace(selected)}
                    disabled={planning}
                    className="btn-brand w-full justify-center text-sm disabled:opacity-60"
                  >
                    {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                    {d["train"]}
                  </button>
                )}
                {details[selected.id]?.registration_url && (
                  <>
                    {/* LE MOMENT DE VÉRITÉ. Un lien vers pps.athle.fr posé sur une page
                        d'aide ne sert à personne : c'est ICI, la main sur le bouton
                        d'inscription, que l'information change une décision. Et on ne
                        dit pas « il te faut un PPS » — on dit s'il tiendra JUSQU'AU JOUR
                        DE CETTE COURSE, ce que le site de la fédération ne peut pas savoir. */}
                    <div className="w-full">
                      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                        {(PPS_T[lang] ?? PPS_T.fr).avantInscription}
                      </div>
                      <PpsStatusCard status={pps} raceDate={selected.date ?? null} compact />
                    </div>
                    <a
                      href={details[selected.id]?.registration_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary w-full justify-center text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {d["register"]}
                    </a>
                    {/* ⚠️ D'OÙ VIENT CETTE FICHE. Le catalogue est repris de deux
                        agrégateurs — il n'est pas vérifié course par course, et ne peut
                        pas l'être : 17 027 fiches, et la source bloque les requêtes
                        automatiques. Un contrôle sur 40 événements a trouvé 26 pages
                        vivantes et 14 requêtes bloquées ; un contrôle antérieur avait
                        trouvé une page disparue. Laisser croire à une vérification qui
                        n'existe pas, juste avant un paiement d'inscription, serait le
                        pire endroit de l'app pour le faire. */}
                    {/* ⚠️ PAGE CONFIRMÉE DISPARUE. Signalée seulement après DEUX 404 sur
                        deux passages différents du contrôle de fond : un 403 veut dire
                        « bloqué », pas « absent », et un site en maintenance renvoie
                        parfois 404 pendant une heure. Une fausse alerte découragerait
                        une inscription pour rien — pire que pas d'alerte. */}
                    {liensMorts.includes(String(details[selected.id]?.registration_url ?? "")) && (
                      <p className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                        {d["deadLink"]}
                      </p>
                    )}
                    {/* ⚠️ CETTE SOURCE NE PEUT PAS ÊTRE REVÉRIFIÉE. jogging-plus (22 % du
                        catalogue) répond 403 à toute requête automatique : sa fiche est
                        figée à sa date d'import et le contrôle nocturne ne la corrigera
                        jamais. Le dire est le minimum avant une inscription payante —
                        laisser croire que toutes les fiches se valent se paierait en
                        déplacement inutile un dimanche matin. */}
                    {!ficheVerifiable(details[selected.id]?.registration_url) && (
                      <p className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                        {d["unverifiable"]}
                      </p>
                    )}
                    {(() => {
                      const dom = domaineSource(details[selected.id]?.registration_url);
                      return dom ? (
                        <p className="w-full text-center text-[11px] leading-relaxed text-zinc-400">
                          {(d["source"] ?? "").replace("{d}", dom)}
                        </p>
                      ) : null;
                    })()}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
