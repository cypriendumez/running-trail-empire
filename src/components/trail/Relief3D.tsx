"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl, { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  FONDS, CALQUES, TRACES, RELIEF, PALIERS_PENTE,
  avecCle, disponibles, attributionDe, type Source,
} from "@/lib/trail/couches";
import { interrogeable, prioriser, versGeoJson, type Toponyme } from "@/lib/trail/toponymes";

/**
 * LA VUE RELIEF — la montagne en trois dimensions, avec ses fonds et ses calques.
 *
 * ⚠️ ELLE NE REMPLACE PAS LE TRAIL BUILDER. Celui-ci construit des traces en 2D depuis
 * 1 500 lignes qui fonctionnent ; le réécrire pour ajouter du relief aurait cassé un
 * outil qui marche. C'est un MODE, comme le bouton 2D/3D d'une application de montagne :
 * la même trace, vue autrement.
 *
 * ⚠️ LE WORKER MAPLIBRE VIENT DE /public. Sous la politique de sécurité de contenu de
 * l'application, le worker par défaut est bloqué SANS AUCUNE ERREUR : le style se parse,
 * mais aucune tuile n'est jamais demandée et `load` ne part pas. Le fichier est copié par
 * `npm run sync:maplibre`, à relancer après toute mise à jour de maplibre-gl.
 */
if (typeof window !== "undefined") setWorkerUrl("/maplibre-gl-csp-worker.js");

const CLE = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/**
 * Inclinaison de la caméra en mode relief. 0 = vue du dessus.
 *
 * ⚠️ 60 ET NON 68. À 68 degrés, la caméra voit AU-DELÀ des tuiles d'altitude chargées et
 * l'horizon se délite en traînées verticales — vu à l'écran. 60 garde la profondeur de la
 * montagne sans montrer le bord du modèle.
 */
const PITCH_3D = 60;
/**
 * Exagération du relief.
 *
 * ⚠️ 1,4 ET PAS PLUS. À 1, une moyenne montagne paraît plate et la vue perd son intérêt ;
 * au-delà de 2, une colline devient une falaise — on montrerait un relief qui n'existe
 * pas, à quelqu'un qui prépare une sortie dessus.
 */
const EXAGERATION = 1.4;

export type Trace = { lat: number; lon: number }[];

/**
 * LE STYLE COMPLET, RECONSTRUIT À CHAQUE CHANGEMENT.
 *
 * ⚠️ CE N'EST PAS UN CHOIX D'ÉLÉGANCE, C'EST LE SEUL MONTAGE QUI TIENNE ICI. Ajouter et
 * retirer les couches une à une (`addSource` / `removeLayer`) échoue dans ce navigateur :
 * MapLibre n'y déclare JAMAIS son style chargé, donc `addSource` lève « Style is not done
 * loading » — mesuré, 16 tuiles de relief demandées et zéro tuile de fond, carte blanche.
 * `setStyle` d'un style entier, lui, fonctionne quel que soit l'état interne.
 */
function construireStyle(
  fondId: string, calques: string[], traces: string[], coords: [number, number][], cle: string,
): maplibregl.StyleSpecification {
  // ⚠️ LE RELIEF N'EST PAS DANS LE STYLE, ET C'EST MESURÉ. Déclarer la source
  // `raster-dem` dès le style initial EMPÊCHE ce style de finir de charger : `getStyle()`
  // rend `undefined`, aucune couche n'existe, le cadre reste blanc — sans une seule
  // erreur. Ajoutée APRÈS coup, la même source fonctionne et le relief s'affiche
  // réellement. L'ordre est donc : style d'abord, relief ensuite.
  const sources: Record<string, unknown> = {};
  const layers: unknown[] = [];

  const poser = (s: Source, opacite: number) => {
    const url = avecCle(s.url, cle);
    if (!url) return;
    const id = `c-${s.id}`;
    // {s} d'OpenTopoMap : MapLibre ne connaît pas ce marqueur, on déplie les sous-domaines.
    sources[id] = {
      type: "raster",
      tiles: url.includes("{s}") ? ["a", "b", "c"].map((d) => url.replace("{s}", d)) : [url],
      tileSize: s.taille, maxzoom: s.zoomMax,
    };
    layers.push({ id, type: "raster", source: id, paint: { "raster-opacity": opacite } });
  };

  const fond = FONDS.find((f) => f.id === fondId) ?? FONDS[0];
  poser(fond, 1);
  // Les calques d'analyse sont TRANSLUCIDES : à 100 %, la pente colorée masque le terrain
  // qu'elle décrit, et l'athlète ne voit plus où il marche.
  for (const id of calques) { const c = CALQUES.find((x) => x.id === id); if (c) poser(c, 0.55); }
  for (const id of traces) { const c = TRACES.find((x) => x.id === id); if (c) poser(c, 0.9); }

  if (coords.length > 1) {
    sources["ma-trace"] = { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } };
    // Double trait : un liseré sombre dessous, la ligne émeraude dessus — lisible sur une
    // forêt comme sur un névé.
    layers.push({ id: "trace-ombre", type: "line", source: "ma-trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0b3b2e", "line-width": 9, "line-opacity": 0.55, "line-blur": 2 } });
    layers.push({ id: "trace-ligne", type: "line", source: "ma-trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#10b981", "line-width": 4.5 } });
  }

  return { version: 8, glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${cle}`, sources, layers } as unknown as maplibregl.StyleSpecification;
}


type EtatCouches = { fond: string; calques: string[]; traces: string[] };

export function Relief3D({ trace, centre, textes }: {
  trace?: Trace | null;
  centre?: { lat: number; lon: number } | null;
  textes: Record<string, string>;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const carte = useRef<maplibregl.Map | null>(null);
  const [pret, setPret] = useState(false);
  /** Vrai tant que le style initial de la carte courante n'a pas encore été remplacé. */
  const premierRendu = useRef(true);
  const [echec, setEchec] = useState<string | null>(null);
  const [relief, setRelief] = useState(true);
  const [panneau, setPanneau] = useState<null | "cartes" | "calques" | "traces">(null);
  const [couches, setCouches] = useState<EtatCouches>({ fond: "satellite", calques: [], traces: [] });
  /** Étiquettes de sommets et refuges : allumées à la demande, chargées à la volée. */
  const [noms, setNoms] = useState(false);
  const [etatNoms, setEtatNoms] = useState<"repos" | "encours" | "large" | "vide" | "ok">("repos");
  const toponymes = useRef<Toponyme[]>([]);

  const fondsDispo = useMemo(() => disponibles(FONDS, CLE), []);
  const t = (k: string) => textes[k] ?? k;

  const coords = useMemo(
    () => (trace ?? []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => [p.lon, p.lat] as [number, number]),
    [trace],
  );

  const attribution = useMemo(() => {
    const actifs: (Source | undefined)[] = [
      FONDS.find((f) => f.id === couches.fond),
      ...couches.calques.map((id) => CALQUES.find((c) => c.id === id)),
      ...couches.traces.map((id) => TRACES.find((c) => c.id === id)),
    ];
    const base = attributionDe(actifs);
    const avecRelief = relief ? `${base} · ${RELIEF.attribution}` : base;
    // Les noms viennent d'OpenStreetMap sous ODbL : l'attribution est obligatoire dès
    // qu'ils sont affichés.
    return noms ? `${avecRelief} · © OpenStreetMap contributors (ODbL)` : avecRelief;
  }, [couches, relief, noms]);

  // ── Création de la carte, une seule fois ────────────────────────────────────
  useEffect(() => {
    if (!boite.current || carte.current) return;
    if (!CLE) { setEchec(t("relief.sansCle")); return; }

    const depart: [number, number] = coords.length
      ? coords[Math.floor(coords.length / 2)]
      : centre ? [centre.lon, centre.lat]
      : [6.865, 45.923];   // Chamonix : un défaut qui montre ce que la vue sait faire

    const styleInitial = construireStyle(couches.fond, couches.calques, couches.traces, coords, CLE);
    const map = new maplibregl.Map({
      container: boite.current,
      style: styleInitial,
      center: depart, zoom: 13, pitch: PITCH_3D, bearing: 0,
      maxPitch: 85, attributionControl: false, fadeDuration: 0,
    });
    carte.current = map;
    // ⚠️ LE GARDE APPARTIENT À LA CARTE, PAS AU COMPOSANT. En mode strict, React monte le
    // composant DEUX FOIS : la première carte est détruite, une seconde est créée — et un
    // garde porté par le composant était déjà consommé, si bien que la seconde carte
    // recevait un `setStyle` immédiat qui écrasait son style en cours de chargement.
    // Résultat à l'écran : cadre blanc, tuiles pourtant demandées, aucune erreur.
    premierRendu.current = true;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 130, unit: "metric" }), "top-left");

    /**
     * ⚠️ ON NE S'ACCROCHE PAS À `load`, ET C'EST UNE DÉCOUVERTE, PAS UNE PRÉFÉRENCE.
     *
     * Mesuré dans ce projet le 07/09/2026, avec une page de diagnostic minimale : la
     * carte s'affiche, les tuiles satellite arrivent, `styledata` part deux fois — et
     * l'événement `load` NE PART JAMAIS. Y compris avec l'URL de style complète que le
     * survol 3D utilise depuis des mois. Le voile de chargement restait donc à l'écran
     * par-dessus une carte parfaitement fonctionnelle, sans une seule erreur nulle part.
     *
     * On prépare donc le relief au premier `styledata` où le style est réellement chargé.
     * `prepare` garantit qu'on ne le fait qu'une fois : `styledata` repart à chaque
     * changement de couche.
     */
    /**
     * ⚠️ ON NE S'ACCROCHE À AUCUN ÉVÉNEMENT DE CHARGEMENT, ET C'EST UNE DÉCOUVERTE.
     *
     * Mesuré le 07/09/2026 sur une page de diagnostic minimale : les tuiles s'affichent,
     * `styledata` et `sourcedata` partent — et `load`, `loaded()` comme `isStyleLoaded()`
     * restent faux INDÉFINIMENT dans ce navigateur. Attendre l'un des trois, c'est
     * afficher un voile de chargement pour toujours par-dessus une carte qui fonctionne.
     *
     * Le relief est donc déclaré DANS le style, et il ne reste qu'à l'activer. `setTerrain`
     * est rejoué à chaque `styledata` tant qu'il n'a pas pris.
     */
    let terrainPose = false;
    const poserTerrain = () => {
      if (terrainPose || !relief) return;
      try {
        if (!map.getSource("relief")) {
          map.addSource("relief", { type: "raster-dem", tiles: [avecCle(RELIEF.url, CLE)!], tileSize: RELIEF.taille, maxzoom: RELIEF.zoomMax });
        }
        map.setTerrain({ source: "relief", exaggeration: EXAGERATION });
        terrainPose = true;
        // ⚠️ REDIMENSIONNEMENT ICI AUSSI. Le conteneur prend sa taille APRÈS la création
        // de la carte : sans ce rappel, le premier rendu se fige dans un canvas de
        // 400 × 300 et le reste du cadre demeure blanc. Vu à l'écran, corrigé à la main
        // avant d'être automatisé.
        try { map.resize(); } catch { /* carte déjà détruite */ }
      }
      catch { /* le style n'est pas encore exploitable : le prochain événement réessaiera */ }
      try {
        (map as unknown as { setSky?: (o: unknown) => void }).setSky?.({
          "sky-color": "#7fb2e5", "horizon-color": "#dbeafe", "sky-horizon-blend": 0.5,
        });
      } catch { /* sans ciel, la vue reste lisible */ }
    };
    map.on("styledata", poserTerrain);
    map.on("sourcedata", poserTerrain);
    map.on("idle", poserTerrain);
    setPret(true);

    /**
     * ⚠️ REDIMENSIONNEMENT SURVEILLÉ, ET CE N'EST PAS UN LUXE. Le conteneur prend sa
     * taille APRÈS la création de la carte : MapLibre mesure alors 400 × 300 par défaut
     * et n'en bouge plus. Vu à l'écran — le relief s'affichait dans le coin haut-gauche,
     * le reste du cadre restait blanc. Un `resize` unique ne suffit pas non plus : la
     * bascule entre les modes et le passage en écran étroit changent la taille plus tard.
     */
    const redim = () => { try { map.resize(); map.triggerRepaint(); } catch { /* carte détruite */ } };
    const observateur = new ResizeObserver(redim);
    observateur.observe(boite.current);
    /**
     * ⚠️ PLUSIEURS RAPPELS, ÉTALÉS. Un seul `resize` ne suffit pas : le conteneur prend sa
     * taille APRÈS la création de la carte, les polices et la mise en page continuent de
     * bouger, et le `ResizeObserver` seul laissait un cadre BLANC au chargement — alors
     * que la carte était intégralement configurée (couche visible, relief posé, contexte
     * graphique sain). Vérifié à la main : un `resize()` tardif la faisait apparaître
     * d'un coup. On rappelle donc sur les deux premières secondes, ce qui ne coûte rien.
     */
    const minuteurs = [0, 120, 350, 800, 1600].map((d) => setTimeout(redim, d));

    map.on("error", (e) => {
      // Une tuile absente ne doit pas condamner la carte : on n'affiche l'échec que si
      // rien n'a jamais chargé.
      // ⚠️ PAS DE `isStyleLoaded()` ICI : il est toujours faux dans ce navigateur, donc
      // la moindre tuile manquante aurait condamné la carte entière. On ne signale que
      // ce qui empêche VRAIMENT d'afficher : l'absence de style.
      const msg = String((e as { error?: { message?: string } })?.error?.message ?? "");
      if (/style/i.test(msg)) setEchec(msg);
    });

    return () => { for (const m of minuteurs) clearTimeout(m); observateur.disconnect(); map.remove(); carte.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fond, calques et traces : le style est REFAIT, jamais rapiécé ───────────
  useEffect(() => {
    const map = carte.current;
    if (!map || !CLE) return;
    // Le style initial porte déjà l'état de départ : le refaire au premier rendu
    // annulerait le chargement en cours pour rien.
    if (premierRendu.current) { premierRendu.current = false; return; }
    try {
      map.setStyle(construireStyle(couches.fond, couches.calques, couches.traces, coords, CLE));
      // `setStyle` remplace TOUT, terrain compris : il faut le reposer, sinon la carte
      // redevient plate au premier changement de fond.
      const reposer = () => {
        // `setStyle` remplace TOUT : la source de relief a disparu avec l'ancien style.
        try {
          if (!relief) return;
          if (!map.getSource("relief")) {
            map.addSource("relief", { type: "raster-dem", tiles: [avecCle(RELIEF.url, CLE)!], tileSize: RELIEF.taille, maxzoom: RELIEF.zoomMax });
          }
          map.setTerrain({ source: "relief", exaggeration: EXAGERATION });
        } catch { /* réessai au prochain événement */ }
      };
      map.once("styledata", reposer);
      map.on("sourcedata", reposer);
    } catch { /* un style refusé laisse le précédent en place, ce qui est le bon repli */ }
  }, [couches, coords, relief]);

  // ── LES NOMS DE LA MONTAGNE ─────────────────────────────────────────────────
  useEffect(() => {
    const map = carte.current;
    if (!map) return;

    const effacer = () => {
      for (const l of ["topo-texte", "topo-point"]) if (map.getLayer(l)) map.removeLayer(l);
      if (map.getSource("topo")) map.removeSource("topo");
    };

    if (!noms) { try { effacer(); } catch { /* style pas encore prêt */ } setEtatNoms("repos"); return; }

    let annule = false;
    const charger = async () => {
      const b = map.getBounds();
      const bbox = { sud: b.getSouth(), ouest: b.getWest(), nord: b.getNorth(), est: b.getEast() };
      if (!interrogeable(bbox, map.getZoom())) { setEtatNoms("large"); try { effacer(); } catch { /* idem */ } return; }
      setEtatNoms("encours");
      // ⚠️ ON PASSE PAR NOTRE SERVEUR, JAMAIS PAR OVERPASS EN DIRECT. Mesuré : la même
      // requête répond en une seconde depuis le serveur et EXPIRE APRÈS 45 SECONDES
      // depuis la page. Un écran figé trois quarts de minute pour des étiquettes n'est
      // pas acceptable ; la route, elle, borne le délai et met en cache.
      {
        try {
          const q = new URLSearchParams({
            sud: String(bbox.sud), ouest: String(bbox.ouest), nord: String(bbox.nord), est: String(bbox.est),
            zoom: String(map.getZoom()),
          });
          // Ceinture supplémentaire côté navigateur : même si le serveur tardait, on ne
          // laisse pas l'interface suspendue.
          const r = await fetch(`/api/trail/toponymes?${q}`, { signal: AbortSignal.timeout(12000) });
          if (!r.ok) { setEtatNoms("vide"); return; }
          const liste = prioriser(((await r.json())?.toponymes ?? []) as Toponyme[]);
          if (annule) return;
          toponymes.current = liste;
          if (!liste.length) { setEtatNoms("vide"); try { effacer(); } catch { /* idem */ } return; }
          try {
            effacer();
            map.addSource("topo", { type: "geojson", data: versGeoJson(liste) });
            map.addLayer({
              id: "topo-point", type: "circle", source: "topo",
              paint: {
                "circle-radius": 3.5,
                "circle-color": ["match", ["get", "genre"], "sommet", "#ffffff", "refuge", "#f59e0b", "vue", "#38bdf8", "col", "#e2e8f0", "#7dd3fc"],
                "circle-stroke-width": 1.5, "circle-stroke-color": "#0f172a",
              },
            });
            map.addLayer({
              id: "topo-texte", type: "symbol", source: "topo",
              layout: {
                "text-field": ["get", "etiquette"],
                "text-font": ["Open Sans Semibold"],
                "text-size": ["match", ["get", "genre"], "sommet", 12, 11],
                "text-offset": [0, -1.1], "text-anchor": "bottom",
                // Les étiquettes qui se chevauchent sont pires que pas d'étiquettes :
                // MapLibre en écarte plutôt que de les empiler.
                "text-allow-overlap": false, "text-padding": 3,
              },
              paint: { "text-color": "#ffffff", "text-halo-color": "#0f172a", "text-halo-width": 1.6 },
            });
            setEtatNoms("ok");
          } catch { /* le style n'est pas prêt : le prochain déplacement réessaiera */ }
          return;
        } catch { /* route injoignable ou délai dépassé : la carte reste utilisable */ }
      }
      setEtatNoms("vide");
    };

    charger();
    // Recharger au déplacement : les noms suivent ce qu'on regarde.
    map.on("moveend", charger);
    return () => { annule = true; map.off("moveend", charger); };
  }, [noms, pret]);

  // ── Bascule 2D / 3D ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = carte.current;
    if (!map || !pret) return;
    try {
      if (relief && !map.getSource("relief")) {
        map.addSource("relief", { type: "raster-dem", tiles: [avecCle(RELIEF.url, CLE)!], tileSize: RELIEF.taille, maxzoom: RELIEF.zoomMax });
      }
      map.setTerrain(relief ? { source: "relief", exaggeration: EXAGERATION } : null);
      map.easeTo({ pitch: relief ? PITCH_3D : 0, duration: 700 });
    } catch { /* la bascule est un confort, pas une condition */ }
  }, [relief, pret]);

  function cadrer() {
    const map = carte.current;
    if (!map) return;
    if (coords.length > 1) {
      const b = coords.reduce((acc, c) => acc.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(b, { padding: 70, pitch: relief ? PITCH_3D : 0, duration: 800 });
    } else if (centre) {
      map.easeTo({ center: [centre.lon, centre.lat], zoom: 13, duration: 800 });
    }
  }

  const bascule = (cle: "calques" | "traces", id: string) =>
    setCouches((c) => ({ ...c, [cle]: c[cle].includes(id) ? c[cle].filter((x) => x !== id) : [...c[cle], id] }));

  if (echec) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t("relief.echec")}</p>
        <p className="max-w-md text-xs text-zinc-500">{echec}</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800" style={{ height: "clamp(460px, 72vh, 820px)" }}>
      {/* ⚠️ HAUTEUR EXPLICITE, PAS `absolute inset-0`. La feuille de style de MapLibre
          déclare `.maplibregl-map { position: relative }` et, à spécificité égale, elle
          gagne sur l'utilitaire `absolute` : `inset-0` cesse alors de s'appliquer et le
          conteneur s'effondre à zéro pixel de haut. Mesuré : 1246 × 0, tuiles satellite
          pourtant demandées, carte blanche — aucune erreur nulle part. */}
      <div ref={boite} style={{ width: "100%", height: "100%" }} />

      {!pret && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">{t("relief.chargement")}</p>
        </div>
      )}

      {/* ── PILE DE BOUTONS, à droite ─────────────────────────────────────── */}
      <div className="absolute bottom-24 right-3 z-[10] flex flex-col overflow-hidden rounded-xl border border-white/60 bg-white/95 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
        <button onClick={cadrer} title={t("relief.cadrer")} aria-label={t("relief.cadrer")}
          className="border-b border-zinc-200 px-3 py-2.5 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" />
          </svg>
        </button>
        <button onClick={() => setRelief((v) => !v)} aria-pressed={!relief}
          className="border-b border-zinc-200 px-3 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          {relief ? "2D" : "3D"}
        </button>
        <button onClick={() => setPanneau((p) => (p ? null : "cartes"))} title={t("relief.couches")} aria-label={t("relief.couches")}
          className={`px-3 py-2.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${panneau ? "text-emerald-600" : "text-zinc-700 dark:text-zinc-200"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" />
          </svg>
        </button>
      </div>

      {/* ── LÉGENDE DES PENTES — seulement quand le calque est allumé ──────── */}
      {couches.calques.includes("pentes-fr") && (
        <div className="absolute bottom-24 left-3 z-[10] rounded-lg border border-white/60 bg-white/95 px-2.5 py-2 text-[11px] shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
          <p className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">{t("calque.pentesFr")}</p>
          {PALIERS_PENTE.map((p) => (
            <div key={p.min} className="flex items-center gap-1.5 leading-tight">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: p.couleur }} />
              <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{p.min}–{p.max === 90 ? "+" : p.max}°</span>
            </div>
          ))}
        </div>
      )}

      {/* ── ATTRIBUTION — obligatoire par licence, jamais masquée ──────────── */}
      <p className="absolute bottom-0 left-0 right-0 z-[10] truncate bg-white/85 px-2 py-1 text-[10px] text-zinc-600 backdrop-blur dark:bg-zinc-900/85 dark:text-zinc-400">
        {attribution}
      </p>

      {/* ── PANNEAU CARTES / CALQUES / TRACES ──────────────────────────────── */}
      {panneau && (
        <div className="absolute inset-x-0 bottom-0 z-[20] max-h-[68%] overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
              {(["cartes", "calques", "traces"] as const).map((o) => (
                <button key={o} onClick={() => setPanneau(o)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${panneau === o ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-500"}`}>
                  {t(`onglet.${o}`)}
                  {o === "calques" && couches.calques.length ? <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" /> : null}
                  {o === "traces" && couches.traces.length ? <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" /> : null}
                </button>
              ))}
            </div>
            <button onClick={() => setPanneau(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-emerald-700">
              {t("relief.fermer")}
            </button>
          </div>

          <div className="p-3">
            {panneau === "cartes" && (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {fondsDispo.map((f) => (
                  <li key={f.id}>
                    <button onClick={() => setCouches((c) => ({ ...c, fond: f.id }))}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${couches.fond === f.id ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-zinc-200 hover:border-emerald-300 dark:border-zinc-700"}`}>
                      <span className="block">{t(f.cle)}</span>
                      <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">{t(`zone.${f.couverture}`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {panneau === "calques" && (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {/* Les NOMS d'abord : c'est ce qui transforme une image en carte. */}
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("calque.toponymes")}</p>
                    <p className="text-[11px] text-zinc-500">
                      {etatNoms === "encours" ? t("topo.chargement")
                        : etatNoms === "large" ? t("topo.tropLarge")
                        : etatNoms === "vide" ? t("topo.aucun")
                        : t("topo.source")}
                    </p>
                  </div>
                  <Bascule actif={noms} onChange={() => setNoms((v) => !v)} label={t("calque.toponymes")} />
                </li>
                {CALQUES.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t(c.cle)}</p>
                      <p className="text-[11px] text-zinc-500">{c.attribution}</p>
                    </div>
                    <Bascule actif={couches.calques.includes(c.id)} onChange={() => bascule("calques", c.id)} label={t(c.cle)} />
                  </li>
                ))}
                {/* ⚠️ ON DIT CE QU'ON N'A PAS. Trois calques de Whympr manquent, et ce
                    n'est pas un oubli : le catalogue IGN a été interrogé en entier, il ne
                    contient ni orientation des pentes ni zones de plat, et l'API Météo-
                    France du bulletin d'avalanches répond 401. Le taire laisserait croire
                    à un produit incomplet par négligence. */}
                <li className="pt-3">
                  <p className="text-xs font-semibold text-zinc-500">{t("manque.titre")}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{t("manque.texte")}</p>
                </li>
              </ul>
            )}

            {panneau === "traces" && (
              <>
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {TRACES.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t(c.cle)}</p>
                        <p className="text-[11px] text-zinc-500">{t(`zone.${c.couverture}`)}</p>
                      </div>
                      <Bascule actif={couches.traces.includes(c.id)} onChange={() => bascule("traces", c.id)} label={t(c.cle)} />
                    </li>
                  ))}
                </ul>
                {/* L'ODbL EXIGE cette mention dès qu'on affiche les données. */}
                <p className="mt-3 text-[11px] text-zinc-500">{t("trace.licence")}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Bascule({ actif, onChange, label }: { actif: boolean; onChange: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={actif} aria-label={label} onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${actif ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${actif ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
