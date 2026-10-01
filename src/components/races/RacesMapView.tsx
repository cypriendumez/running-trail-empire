"use client";

import { useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Calendar, Zap, Mountain, ChevronRight, ChevronDown, Loader2, Flag, type LucideIcon } from "lucide-react";
import type { Race } from "@/types";
import { correctedRaceType } from "@/lib/raceType";
import { useT } from "@/lib/i18n/LanguageProvider";
import { RX, dateRangeKey } from "./racesI18n";
import { AutourDeMoi } from "./AutourDeMoi";
import { grouperEvenements } from "@/lib/races/groupes";
import { LiensCourse } from "./LiensCourse";
import { usePleinEcran } from "@/lib/ui/pleinEcran";
import { dansLeRayon, type Point, type Proximite } from "@/lib/races/proximite";
import { formatDateCivile } from "@/lib/time/fuseau";
import { useFuseau } from "@/lib/time/FuseauProvider";
import { aujourdhui } from "@/lib/time/fuseau";

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
// Clé MapTiler publique du projet (même variable que SegmentMap et le Trail Builder).
const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";

export function RacesMapView({ races: initialRaces, onClose, findPlanned, onTrain, onCancel, busy = false, proximite = null, onProximite, positionEntrainement = null }: {
  races: Race[];
  /** « Autour de moi » — l'état vit dans la liste (RacesHub) : la carte et la liste filtrent pareil. */
  proximite?: Proximite | null;
  onProximite?: (p: Proximite | null) => void;
  positionEntrainement?: Point | null;
  onClose: () => void;
  // État « course planifiée » partagé avec la liste (RacesHub) → bouton vert ↔ rouge cohérent.
  findPlanned?: (r: Race) => { id: string } | undefined;
  onTrain?: (r: Race) => Promise<void>;
  onCancel?: (r: Race) => Promise<void>;
  busy?: boolean;
}) {
  const { lang } = useT();
  const d = RX[lang] ?? RX.fr;
  // La bulle d'aide se retire tant que la carte est ouverte (voir lib/ui/pleinEcran).
  usePleinEcran();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const rendererRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const [races, setRaces] = useState<Race[]>(initialRaces);
  // ⚠️ LA LISTE SUIT LES PROPS. La page ne charge que ~90 courses côté serveur, le
  // catalogue complet (~17 500) arrive 4 s plus tard depuis /api/races/list. Copier la
  // liste UNE FOIS à l'ouverture figeait la carte à 90 pins pour qui l'ouvrait dans ces
  // 4 secondes — vu par Cyprien le 21/09/2026 : « 90 pins · 90 courses ». L'état local
  // reste, et se réaligne à chaque nouvelle liste.
  useEffect(() => { setRaces(initialRaces); }, [initialRaces]);
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

  // ⚠️ `toISOString()` JETTE LE FUSEAU QUE LE NAVIGATEUR CONNAÎT. Entre minuit et 2 h à
  // Paris, le jour UTC est encore celui de la veille : les courses datées d'aujourd'hui
  // basculaient dans le passé et disparaissaient de la carte. Le fuseau vient du
  // fournisseur (cookie), jamais de `resolvedOptions()` pendant le rendu — ce serait
  // rétablir l'écart d'hydratation que ce fournisseur existe pour supprimer.
  const fuseau = useFuseau();
  const today = useMemo(() => aujourdhui(fuseau), [fuseau]);
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
    const matchType = filterType === "all" || correctedRaceType(r.distance_km, r.type, r.name) === filterType;
    return matchType && matchesDateRange(r.date) && dansLeRayon(r, proximite);
  }), [withCoords, filterType, matchesDateRange, proximite]);

  // Les pastilles de type comptent ce qui est RÉELLEMENT dans le rayon : « Trail S 9079 »
  // au-dessus d'une carte qui en montre 40 autour de Lille serait un compteur faux.
  const typeCounts = useMemo(() => withCoords.reduce<Record<string, number>>((acc, r) => {
    if (matchesDateRange(r.date) && dansLeRayon(r, proximite)) { const t = correctedRaceType(r.distance_km, r.type, r.name); acc[t] = (acc[t] || 0) + 1; }
    return acc;
  }, {}), [withCoords, matchesDateRange, proximite]);

  // Le compteur parle comme la liste : des ÉVÉNEMENTS (le 10 km et le semi d'un même
  // week-end en font un), puis le nombre de courses. « 14 759 pins » d'un côté et
  // « 8 003 événements » de l'autre, c'était deux chiffres sans lien (Cyprien, 30/09/2026).
  const nbEvenements = useMemo(() => grouperEvenements(filtered).length, [filtered]);

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

      // ⚠️ PLUS DE CARTO. Ses tuiles Voyager, servies sans clé depuis le début, sont
      // désormais filigranées « API KEY REQUIRED » sur toute la carte (vu en production le
      // 21/09/2026). Même convention que SegmentMap : MapTiler avec la clé du projet, et
      // OpenStreetMap en repli si elle manque — jamais une carte illisible.
      // Les tuiles MapTiler font 512 px : `tileSize: 512, zoomOffset: -1`, sinon les
      // libellés sont deux fois trop gros (cf. lib/activities/tuiles).
      if (MAPTILER) {
        L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER}`, {
          tileSize: 512, zoomOffset: -1, maxZoom: 19,
        }).addTo(map);
      } else {
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      }

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.attribution({ position: "bottomright", prefix: MAPTILER ? "© MapTiler © OpenStreetMap" : "© OpenStreetMap" }).addTo(map);

      // Rendu canvas → des milliers de points s'affichent sans ralentir.
      // `tolerance` : la zone cliquable dépasse le point de 6 px. Un point de 5 px de rayon
      // se ratait au trackpad ou au doigt — un clic « à côté » ne faisait rien, et semblait
      // une panne (signalé par Cyprien le 28/09/2026).
      rendererRef.current = L.canvas({ padding: 0.5, tolerance: 6 });
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
        const color = TYPE_COLORS[correctedRaceType(race.distance_km, race.type, race.name)] || "#22c55e";
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

  // ── « AUTOUR DE MOI » SUR LA CARTE : le cercle, le point de départ, et le cadrage ──
  // Sans cadrage, activer le filtre depuis une vue de toute la France laissait une
  // poignée de points minuscules au milieu de l'écran : on zoome sur le cercle.
  const cercleRef = useRef<unknown[]>([]);
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      const L = (leaflet.default ?? leaflet) as typeof import("leaflet");
      const map = mapInstanceRef.current as ReturnType<typeof L.map>;
      cercleRef.current.forEach((c) => (c as ReturnType<typeof L.circle>).remove());
      cercleRef.current = [];
      if (!proximite) return;
      const centre: [number, number] = [proximite.centre.lat, proximite.centre.lon];
      const cercle = L.circle(centre, {
        radius: proximite.rayonKm * 1000, color: "#059669", weight: 1.5, fillColor: "#10b981", fillOpacity: 0.06, interactive: false,
      }).addTo(map);
      const point = L.circleMarker(centre, {
        radius: 7, fillColor: "#2563eb", color: "#ffffff", weight: 2.5, fillOpacity: 1, interactive: false,
      }).addTo(map);
      cercleRef.current = [cercle, point];
      map.fitBounds(cercle.getBounds(), { padding: [24, 24] });
    })();
    return () => { cancelled = true; };
  }, [proximite, mapReady]);

  // L'action « M'entraîner / Annuler » vient du parent (RacesHub) → un seul état partagé.

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-50"
    >
      {/* ── Barre du haut ───────────────────────────────────────────────────
          ⚠️ REFAITE LE 30/09/2026 (Cyprien : « ça fait pas pro et pas intuitif en
          filtre », « mets Autour de moi avec les autres filtres »). Deux rangées de 17
          pastilles grises (« Trail S 9627 », « 2 ans »…) et « Autour de moi » isolé à
          l'autre bout de l'écran. Désormais trois filtres de MÊME forme, côte à côte —
          Dates, Type de course, Autour de moi — un « Effacer » quand un filtre est actif,
          et un compteur qui parle comme la liste (événements, puis courses). */}
      <div className="z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 shadow-sm sm:flex-nowrap sm:px-4">
        <button
          onClick={onClose}
          className="flex h-9 flex-shrink-0 items-center gap-1 rounded-full pl-1.5 pr-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          {d["back"]}
        </button>

        {/* Compteur : à droite sur ordinateur, à côté du retour sur téléphone. */}
        <div className="ml-auto flex flex-shrink-0 items-baseline gap-1.5 sm:order-last" aria-live="polite">
          <span className="text-sm font-bold tabular-nums text-zinc-900">{nbEvenements.toLocaleString(lang)}</span>
          <span className="text-xs text-zinc-500">{nbEvenements > 1 ? d["events"] : d["f.event"]}</span>
          <span className="hidden text-xs text-zinc-400 md:inline">· {filtered.length.toLocaleString(lang)} {filtered.length > 1 ? d["courses"] : d["course"]}</span>
        </div>

        {/* ⚠️ SUR TÉLÉPHONE, UNE LIGNE QUI DÉFILE (Cyprien, 21/09/2026) : jamais un
            libellé cassé en deux, jamais un quart d'écran mangé par les filtres. */}
        <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:flex-1 sm:overflow-visible">
          <FiltreMenu icone={Calendar} libelle={d["f.dates"]} actif={dateRangeDays !== ALL_DAYS}
            texte={dateRangeDays === ALL_DAYS ? d["f.toutesDates"] : d[dateRangeKey(dateRangeDays)]}
            valeur={String(dateRangeDays)} onChange={(v) => setDateRangeDays(Number(v))}>
            {DATE_RANGES.map((r) => (
              <option key={r.days} value={r.days}>{r.days === ALL_DAYS ? d["f.toutesDates"] : d[dateRangeKey(r.days)]}</option>
            ))}
          </FiltreMenu>

          <FiltreMenu icone={Flag} libelle={d["legendTitle"]} actif={filterType !== "all"}
            pastille={filterType !== "all" ? (TYPE_COLORS[filterType] || "#22c55e") : undefined}
            texte={filterType === "all" ? d["f.tousTypes"] : (d[`rts.${filterType}`] ?? filterType)}
            valeur={filterType} onChange={setFilterType}>
            <option value="all">{d["f.tousTypes"]}</option>
            {Object.entries(typeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <option key={type} value={type}>{d[`rts.${type}`] ?? type} · {count.toLocaleString(lang)}</option>
              ))}
          </FiltreMenu>

          {/* « Autour de moi » — À LA PLACE du bouton « Géolocaliser », qui ne localisait
              PAS l'athlète : il lançait le géocodage de tout le catalogue (tâche de
              maintenance, 5 min, écritures en base) depuis n'importe quel compte. Retiré le
              28/09/2026 ; la route est désormais réservée à l'administration. */}
          {onProximite && (
            <AutourDeMoi valeur={proximite} onChange={onProximite} positionEntrainement={positionEntrainement} d={d} compact />
          )}

          {(dateRangeDays !== ALL_DAYS || filterType !== "all" || proximite) && (
            <button type="button"
              onClick={() => { setDateRangeDays(ALL_DAYS); setFilterType("all"); onProximite?.(null); }}
              className="h-9 flex-shrink-0 whitespace-nowrap rounded-full px-3 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
              {d["f.effacer"]}
            </button>
          )}
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
                    style={{ backgroundColor: TYPE_COLORS[correctedRaceType(selected.distance_km, selected.type, selected.name)] || "#22c55e" }}
                  >
                    {d[`rts.${correctedRaceType(selected.distance_km, selected.type, selected.name)}`] ?? selected.type}
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
                  { icon: <Calendar className="w-3.5 h-3.5 text-blue-500" />, label: d["l.date"], value: selected.date?.startsWith("2099") ? d["dateTBD"] : formatDateCivile(selected.date, lang, { weekday: "long", day: "numeric", month: "long" }) },
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
                {/* Inscription directe, site officiel et classement — le même bloc que la liste. */}
                <LiensCourse detail={details[selected.id]} course={selected} d={d}
                  couleur={TYPE_COLORS[correctedRaceType(selected.distance_km, selected.type, selected.name)] || "#22c55e"} />
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
      <div className="absolute bottom-6 left-4 hidden bg-white/95 rounded-2xl shadow-lg border border-zinc-200/80 p-3 z-[1000] sm:block">
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

/**
 * Un filtre en forme de pastille, qui ouvre le MENU NATIF du système (liste déroulante sur
 * ordinateur, roue de sélection sur téléphone) : accessible au clavier et au lecteur
 * d'écran sans rien réinventer. Le `<select>` transparent couvre toute la pastille.
 */
function FiltreMenu({ icone: Icone, libelle, texte, valeur, onChange, actif, pastille, children }: {
  icone: LucideIcon; libelle: string; texte: string; valeur: string;
  onChange: (v: string) => void; actif: boolean; pastille?: string; children: ReactNode;
}) {
  return (
    <label className={`relative flex h-9 flex-shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border pl-3 pr-8 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-emerald-500/40 ${
      actif ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"}`}>
      {pastille ? <span className="h-2 w-2 rounded-full ring-2 ring-white/70" style={{ background: pastille }} aria-hidden /> : <Icone className="h-4 w-4 opacity-70" aria-hidden />}
      <span aria-hidden>{texte}</span>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 opacity-60" aria-hidden />
      <select aria-label={libelle} value={valeur} onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0">
        {children}
      </select>
    </label>
  );
}
