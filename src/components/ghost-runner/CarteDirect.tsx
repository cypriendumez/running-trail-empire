"use client";
import { useEffect, useRef } from "react";
// maplibre-gl v6 est ESM-only : pas d'export par défaut, on prend l'espace de noms.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ATTRIBUTION_PLAN, REPLI_PLAN, STYLE_PLAN_URL, peinturesNuit, stylePacevo, type CalqueCarte, type FondCarte,
} from "@/lib/courses/fondsCarte";
import { RELIEF, avecCle } from "@/lib/trail/couches";

/**
 * LA CARTE DE L'ÉCRAN « ENREGISTRER » — comme Strava : la position d'abord.
 *
 * Cyprien, 21/09/2026 : « fais comme Strava avec la carte, et laisse la personne aller en
 * bas avec tous les réglages qu'il y a déjà » ; puis le 22/09 : « fais comme sur Strava,
 * ça rend ». L'écran s'ouvre donc sur la carte (position en direct, puis le tracé pendant
 * la course), les commandes flottent dessus, les réglages suivent en dessous.
 *
 * 27/11/2026 : « la carte fait vieille ». Elle était en tuiles-IMAGES (Leaflet) : floue
 * sur un écran Retina. Elle est désormais VECTORIELLE (MapLibre), nette à tout zoom, aux
 * couleurs de Pacevo (`stylePacevo`) — c'est ce qui fait la différence avec Strava.
 *
 * ⚠️ LE SUIVI AUTOMATIQUE DOIT POUVOIR S'ARRÊTER. La carte se recentrait à CHAQUE point
 * GPS : dès qu'on déplaçait la carte pour regarder la suite du parcours, la position
 * suivante la ramenait. Un glissement (ou un zoom) de la MAIN coupe donc le suivi, et le
 * bouton de recentrage le reprend, exactement comme Strava.
 *
 * ⚠️ `zoomstart` EST AMBIGU : MapLibre l'émet aussi pour NOS propres `easeTo`. Seul un
 * geste porte un `originalEvent` : sans ce filtre, le premier recentrage automatique
 * couperait le suivi lui-même.
 *
 * ⚠️ MAPLIBRE PARLE EN [LONGITUDE, LATITUDE], l'écran en [latitude, longitude]. Tout
 * passage de l'un à l'autre passe par `versLngLat` : un oubli pose le coureur dans
 * l'océan Indien, sans erreur.
 *
 * Le fichier du worker est servi depuis notre domaine (CSP `worker-src 'self'`), copié par
 * `npm run sync:maplibre` — comme pour la vue relief 3D.
 */
if (typeof window !== "undefined") maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

/**
 * Le relief 3D (bouton « 3D », comme Strava). ⚠️ SANS CLÉ MAPTILER, PAS DE RELIEF : on ne
 * propose pas une carte simplement inclinée en la faisant passer pour du relief (même
 * règle que la vue relief du Trail Builder, cf. `lib/trail/couches`).
 */
const URL_RELIEF = avecCle(RELIEF.url, process.env.NEXT_PUBLIC_MAPTILER_KEY || undefined);
export const RELIEF_DISPO = URL_RELIEF !== null;

const FOND_PLAN: FondCarte = { id: "plan", cle: "f.plan", type: "vecteur", couverture: "monde" };

/** Le crédit a-t-il déjà été montré en entier AUJOURD'HUI sur cet appareil ? */
const CLE_CREDIT = "pacevo_credit_carte";
const aujourdhuiLocal = () => new Date().toLocaleDateString("sv");
function creditDejaMontre(): boolean {
  try { return localStorage.getItem(CLE_CREDIT) === aujourdhuiLocal(); } catch { return false; }
}
function noterCreditMontre() {
  try { localStorage.setItem(CLE_CREDIT, aujourdhuiLocal()); } catch { /* navigation privée : il sera montré à chaque fois */ }
}

/** Ligne vide : la forme qu'attendent les sources GeoJSON avant le premier point. */
const VIDE = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: [] as [number, number][] } };

const versLngLat = (p: [number, number]): [number, number] => [p[1], p[0]];

/** Le style de repli : les tuiles d'OpenStreetMap, si le style vectoriel ne vient pas. */
function styleRepli(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: { osm: { type: "raster", tiles: [REPLI_PLAN.url], tileSize: REPLI_PLAN.taille, maxzoom: REPLI_PLAN.zoomMax, attribution: REPLI_PLAN.attribution } },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

async function stylePlan(): Promise<maplibregl.StyleSpecification> {
  try {
    const r = await fetch(STYLE_PLAN_URL);
    if (!r.ok) return styleRepli();
    const brut = await r.json() as maplibregl.StyleSpecification & { sources: Record<string, { attribution?: string }> };
    const style = stylePacevo(brut as unknown as { layers: { id: string; type: string }[] }) as unknown as maplibregl.StyleSpecification;
    // L'attribution est portée par la source : MapLibre l'affiche d'elle-même.
    const om = (style.sources as Record<string, { attribution?: string }>).openmaptiles;
    if (om) om.attribution = ATTRIBUTION_PLAN;
    return style;
  } catch {
    return styleRepli();
  }
}

export function CarteDirect({
  position, track, centre, fond = FOND_PLAN, calques = [], suivre = true, onDeplacement, recentrer = 0, etiquette, className = "",
  parcours = [], voirParcours = false, relief = false,
  onClic, reperes = [], couleurTrace = "#059669", vue, creditPlus,
}: {
  position: [number, number] | null;
  track: [number, number][];
  /**
   * Où ouvrir la carte tant que le GPS n'a rien donné — le centre de la dernière trace
   * connue de l'athlète.
   *
   * ⚠️ CE N'EST PAS SA POSITION, et le point bleu ne s'y affiche JAMAIS : c'est un
   * cadrage, pas une mesure. Sans lui, la carte s'ouvrait sur la France entière au zoom
   * 5 — un rectangle qui ne dit rien de personne (Cyprien, 23/09/2026 : « ça rend pas »).
   */
  centre?: [number, number] | null;
  /** Le modèle de carte choisi dans le tiroir (`fondsDisponibles`). */
  fond?: FondCarte;
  /** Les calques allumés (`calquesDisponibles`), posés par-dessus le fond. */
  calques?: CalqueCarte[];
  /** Tant que c'est vrai, la carte reste collée à la position. */
  suivre?: boolean;
  /** Appelé quand la main prend la carte : au parent de couper le suivi. */
  onDeplacement?: () => void;
  /** Compteur : chaque incrément recentre sur la position. */
  recentrer?: number;
  etiquette?: string;
  className?: string;
  /** Les traces des dernières sorties [lat, lon][] — « Mes parcours », en bleu. */
  parcours?: [number, number][][];
  voirParcours?: boolean;
  /** Relief 3D : terrain MapTiler + carte inclinée. Ignoré sans clé (`RELIEF_DISPO`). */
  relief?: boolean;
  /**
   * ── POUR CONSTRUIRE UN PARCOURS (onglet Carte, 27/11/2026) ─────────────────
   * Cyprien : « fais comme dans Enregistrer, exactement la même chose ». La même carte sert
   * donc aux deux écrans ; ces propriétés n'existent que pour le constructeur.
   * `onClic` : un TAP (pas un glissé) sur la carte, en [latitude, longitude].
   */
  onClic?: (lat: number, lng: number) => void;
  /** Les points posés : vert au départ, bleu entre deux, rouge à l'arrivée. */
  reperes?: { lat: number; lng: number; couleur: string }[];
  /** La couleur du tracé (celle de la difficulté dans le constructeur). */
  couleurTrace?: string;
  /** Compteur + destination : chaque nouveau `n` déplace la carte (un lieu ou un parcours entier). */
  vue?: { n: number; centre?: [number, number]; zoom?: number; emprise?: [number, number][] };
  /** Un crédit de plus, en HTML (le calcul d'itinéraire de FOSSGIS l'exige). */
  creditPlus?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<maplibregl.Map | null>(null);
  const point = useRef<maplibregl.Marker | null>(null);
  /** Vrai une fois le style chargé : avant, on ne peut ni poser de couche ni de tracé. */
  const pret = useRef(false);
  /** Des doigts sont posés sur la carte : aucun recentrage automatique pendant ce temps. */
  const doigts = useRef(false);
  /** La carte a déjà été centrée sur une VRAIE position : le zoom 15 n'est imposé qu'une fois. */
  const dejaCentree = useRef(false);
  const suivreRef = useRef(suivre);
  const deplacementRef = useRef(onDeplacement);
  const positionRef = useRef(position);
  const traceRef = useRef(track);
  const fondRef = useRef(fond);
  const parcoursRef = useRef(parcours);
  const voirParcoursRef = useRef(voirParcours);
  const reliefRef = useRef(relief);
  useEffect(() => { parcoursRef.current = parcours; }, [parcours]);
  useEffect(() => { voirParcoursRef.current = voirParcours; }, [voirParcours]);
  useEffect(() => { reliefRef.current = relief; }, [relief]);
  useEffect(() => { suivreRef.current = suivre; }, [suivre]);
  useEffect(() => { deplacementRef.current = onDeplacement; }, [onDeplacement]);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { traceRef.current = track; }, [track]);
  useEffect(() => { fondRef.current = fond; }, [fond]);
  const vueRef = useRef(vue);
  const clicRef = useRef(onClic);
  useEffect(() => { clicRef.current = onClic; }, [onClic]);
  const reperesRef = useRef(reperes);
  useEffect(() => { reperesRef.current = reperes; }, [reperes]);
  const couleurRef = useRef(couleurTrace);
  useEffect(() => { couleurRef.current = couleurTrace; }, [couleurTrace]);
  const calquesRef = useRef(calques);
  useEffect(() => { calquesRef.current = calques; }, [calques]);
  /** Les couleurs de jour, gardées pour revenir de Pacevo Nuit. */
  const jour = useRef<Record<string, Record<string, unknown>>>({});
  const nuit = useRef<Record<string, Record<string, unknown>>>({});
  const enNuit = useRef(false);

  /** Le point bleu, avec son halo — posé ou déplacé. */
  function poserPoint(m: maplibregl.Map, p: [number, number]) {
    if (!point.current) {
      const el = document.createElement("div");
      el.className = "pacevo-point";
      // Le point ne prend pas le doigt : un pincement qui commence dessus doit zoomer la carte.
      el.style.pointerEvents = "none";
      point.current = new maplibregl.Marker({ element: el }).setLngLat(versLngLat(p)).addTo(m);
    } else point.current.setLngLat(versLngLat(p));
  }

  function poserTrace(m: maplibregl.Map, t: [number, number][]) {
    const src = m.getSource("trace") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: t.map(versLngLat) } });
  }

  function poserReperes(m: maplibregl.Map, r: { lat: number; lng: number; couleur: string }[]) {
    const src = m.getSource("reperes") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: r.map((p) => ({ type: "Feature", properties: { couleur: p.couleur }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) });
  }

  function appliquerVue(m: maplibregl.Map, v: typeof vue) {
    if (!v || v.n === 0) return;
    if (v.emprise && v.emprise.length > 1) {
      const lats = v.emprise.map((p) => p[0]), lngs = v.emprise.map((p) => p[1]);
      const h = m.getContainer().clientHeight || 600;
      // Marges : la colonne de boutons à droite et le bloc du bas couvrent la carte.
      // Bornées à la hauteur de la carte : une marge plus grande qu'elle annule le cadrage.
      m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: Math.min(70, h * 0.1), bottom: Math.min(250, h * 0.4), left: 30, right: 70 }, maxZoom: 16, duration: 900 });
    } else if (v.centre) {
      m.flyTo({ center: versLngLat(v.centre), zoom: v.zoom ?? m.getZoom(), duration: 1400 });
    }
  }

  function poserParcours(m: maplibregl.Map, p: [number, number][][]) {
    const src = m.getSource("parcours") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: p.map((t) => t.map(versLngLat)) } });
  }

  function montrerParcours(m: maplibregl.Map, oui: boolean) {
    if (m.getLayer("parcours")) m.setLayoutProperty("parcours", "visibility", oui ? "visible" : "none");
  }

  /**
   * Relief 3D. ⚠️ LA SOURCE N'EST POSÉE QU'AU PREMIER APPUI : chaque tuile de relief est
   * une requête MapTiler (quota gratuit compté), et la plupart des sorties n'en ont pas
   * besoin.
   */
  function appliquerRelief(m: maplibregl.Map, oui: boolean) {
    if (!URL_RELIEF) return;
    try {
      if (oui) {
        if (!m.getSource("relief")) m.addSource("relief", { type: "raster-dem", tiles: [URL_RELIEF], tileSize: RELIEF.taille, maxzoom: RELIEF.zoomMax, attribution: RELIEF.attribution });
        m.setTerrain({ source: "relief", exaggeration: 1.4 });
        m.easeTo({ pitch: 60, duration: 800 });
      } else {
        m.setTerrain(null);
        m.easeTo({ pitch: 0, duration: 600 });
      }
    } catch { /* style pas encore prêt : le prochain appui réessaiera */ }
  }

  /** Le premier calque d'un type ou d'un préfixe — là où l'on glisse une image. */
  const premierCalque = (m: maplibregl.Map, test: (c: { id: string; type: string }) => boolean) =>
    m.getStyle().layers.find(test)?.id;

  /**
   * LE MODÈLE DE CARTE. ⚠️ JAMAIS DE `setStyle` : il effacerait le tracé de la course en
   * cours, le point bleu et « Mes sorties ». On repeint (Nuit) ou on glisse une couche
   * d'image à la bonne hauteur, créée au premier choix et ensuite seulement montrée :
   *   · « dessus » (Topo, IGN Plan…) : la carte a ses noms, elle couvre notre style ;
   *   · « sous-noms » (Satellite, IGN Photo) : la photo, nos noms par-dessus ;
   *   · « sous-routes » (Hybride) : la photo, nos rues et nos noms par-dessus.
   */
  function appliquerFond(m: maplibregl.Map, f: FondCarte) {
    try {
      // Les couleurs : Nuit, ou retour au jour.
      const cible = f.id === "nuit" ? nuit.current : enNuit.current ? jour.current : null;
      if (cible) {
        for (const [id, peinture] of Object.entries(cible)) {
          if (!m.getLayer(id)) continue;
          for (const [prop, val] of Object.entries(peinture)) { try { m.setPaintProperty(id, prop as never, val as never); } catch { /* propriété absente de cette couche */ } }
        }
        enNuit.current = f.id === "nuit";
      }
      // Les images : une seule visible à la fois.
      for (const c of m.getStyle().layers) if (c.id.startsWith("fond-")) m.setLayoutProperty(c.id, "visibility", "none");
      if (f.type === "image" && f.urls?.length) {
        const id = `fond-${f.id}`;
        if (!m.getLayer(id)) {
          if (!m.getSource(id)) m.addSource(id, { type: "raster", tiles: f.urls, tileSize: f.taille ?? 256, maxzoom: f.zoomMax ?? 19, attribution: f.attribution });
          const avant = f.place === "dessus" ? "parcours"
            : f.place === "sous-routes" ? premierCalque(m, (c) => /^(tunnel|road|bridge)_/.test(c.id))
            : premierCalque(m, (c) => c.type === "symbol");
          m.addLayer({ id, type: "raster", source: id }, avant);
        }
        m.setLayoutProperty(id, "visibility", "visible");
      }
      // En hybride, les bâtiments gris cacheraient la photo.
      if (m.getLayer("building")) m.setLayoutProperty("building", "visibility", f.place === "sous-routes" ? "none" : "visible");
    } catch { /* style pas encore prêt : le prochain choix réessaiera */ }
  }

  /**
   * LES CALQUES. Images transparentes (itinéraires, pentes, courbes) sous nos tracés ;
   * ombrage calculé du relief MapTiler, sous les routes ; points d'intérêt = une partie
   * de notre style, montrée ou cachée.
   */
  function appliquerCalques(m: maplibregl.Map, actifs: CalqueCarte[]) {
    try {
      const ids = new Set(actifs.map((c) => c.id));
      for (const c of actifs) {
        const id = `calque-${c.id}`;
        if (m.getLayer(id)) continue;
        if (c.type === "image" && c.urls?.length) {
          m.addSource(id, { type: "raster", tiles: c.urls, tileSize: 256, maxzoom: c.zoomMax ?? 18, attribution: c.attribution });
          m.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": c.groupe === "relief" ? 0.7 : 1 } }, "parcours");
        } else if (c.type === "ombrage" && URL_RELIEF) {
          m.addSource(id, { type: "raster-dem", tiles: [URL_RELIEF], tileSize: RELIEF.taille, maxzoom: RELIEF.zoomMax, attribution: RELIEF.attribution });
          // 0,4 était trop discret en Normandie (audit du 27/11/2026) ; une lumière
          // translucide plutôt que blanche, pour ne pas éblouir Pacevo Nuit.
          m.addLayer({ id, type: "hillshade", source: id, paint: { "hillshade-exaggeration": 0.65, "hillshade-shadow-color": "rgba(24,30,22,0.85)", "hillshade-highlight-color": "rgba(255,255,255,0.35)" } },
            premierCalque(m, (x) => /^(tunnel|road|bridge)_/.test(x.id)));
        } else if (c.id === "eau" && m.getSource("openmaptiles")) {
          // Les points d'eau (anneau cyan) et les toilettes (violet, « WC ») du plan, en gros.
          const filtre = (classe: string) => ["==", ["get", "class"], classe] as unknown as maplibregl.FilterSpecification;
          m.addLayer({ id: "calque-eau", type: "circle", source: "openmaptiles", "source-layer": "poi", minzoom: 12, filter: filtre("drinking_water"),
            // ⚠️ UN ANNEAU, PAS UN POINT PLEIN : un rond bleu plein se confondait avec le
            // point GPS de l'athlète (vu sur la carte le 27/11/2026).
            paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 16, 6], "circle-color": "#ffffff", "circle-stroke-color": "#0891b2", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 12, 2, 16, 3.5] } }, "parcours");
          m.addLayer({ id: "calque-eau-wc", type: "circle", source: "openmaptiles", "source-layer": "poi", minzoom: 12, filter: filtre("toilets"),
            paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3.5, 16, 8], "circle-color": "#7c3aed", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } }, "parcours");
          m.addLayer({ id: "calque-eau-wc-texte", type: "symbol", source: "openmaptiles", "source-layer": "poi", minzoom: 15, filter: filtre("toilets"),
            layout: { "text-field": "WC", "text-font": ["Noto Sans Bold"], "text-size": 8, "text-allow-overlap": true },
            paint: { "text-color": "#ffffff" } }, "parcours");
        }
      }
      for (const c of m.getStyle().layers) {
        if (c.id.startsWith("calque-eau")) { m.setLayoutProperty(c.id, "visibility", ids.has("eau") ? "visible" : "none"); continue; }
        if (c.id.startsWith("calque-")) m.setLayoutProperty(c.id, "visibility", ids.has(c.id.slice(7) as CalqueCarte["id"]) ? "visible" : "none");
        if (/^poi/.test(c.id)) m.setLayoutProperty(c.id, "visibility", ids.has("poi") ? "visible" : "none");
      }
    } catch { /* style pas encore prêt */ }
  }

  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    let annule = false;
    (async () => {
      const style = await stylePlan();
      if (annule || !conteneur.current) return;
      const depart = positionRef.current ?? centre ?? null;
      const m = new maplibregl.Map({
        container: conteneur.current,
        style,
        center: depart ? versLngLat(depart) : [2.3, 46.6],
        zoom: positionRef.current ? 15 : depart ? 13 : 5,
        attributionControl: false,
        // Pas de rotation : sans boussole à l'écran, une carte tournée par erreur ne se
        // remet pas droite, et le nord perdu désoriente plus qu'il n'aide en courant.
        dragRotate: false, pitchWithRotate: false, touchPitch: false,
      });
      m.touchZoomRotate.disableRotation();
      // ⚠️ EN HAUT À DROITE, PAS EN BAS : le bloc de chiffres et le tiroir occupent tout le
      // bas de la carte et la recouvraient. Pas à gauche non plus depuis le 27/11/2026 : la
      // flèche ⌄ de sortie du grand écran y est posée. Une attribution cachée vaut une
      // attribution absente — c'est-à-dire une carte utilisée sans droit. Jamais repliée.
      //
      // ⚠️ 27/11/2026 (« la bande © OpenFreeMap… fait pas pro ») : REPLIÉE EN ⓘ, PAS
      // SUPPRIMÉE. Les données d'OpenStreetMap (ODbL) et d'OpenMapTiles l'exigent, quelle
      // que soit la carte qu'on en tire — fabriquer « notre » carte n'y changerait rien.
      //
      // ⚠️ CE QUE DIT LA RÈGLE (OSMF, « Attribution Guidelines », 25/06/2021, lue le
      // 27/11/2026) : le crédit peut se replier en ⓘ au premier geste ou après 5 s, mais il
      // ne doit pas EXIGER un geste pour être vu ; et « s'il est présenté au démarrage de
      // l'application, il n'a pas besoin de l'être à chaque fois ». D'où : en entier 5 s à
      // la PREMIÈRE ouverture du jour, puis la carte s'ouvre directement sur le seul ⓘ
      // (Cyprien : « il faut d'abord cliquer sur le i… comme ça ça ne dérange pas »).
      const credit = new maplibregl.AttributionControl({ compact: true, customAttribution: creditPlus });
      m.addControl(credit, "top-right");
      const replier = () => conteneur.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      if (creditDejaMontre()) { replier(); m.once("load", replier); }
      else { noterCreditMontre(); setTimeout(replier, 5000); }
      // ⚠️ 5 S EST LE MINIMUM DE LA RÈGLE pour un repli AUTOMATIQUE (« after five
      // seconds ») — on ne descend pas en dessous. Mais elle permet aussi le repli « sur
      // interaction avec la carte : glisser, toucher, zoomer » : dès le premier geste de
      // l'athlète, sans attendre (Cyprien, 27/11/2026 : « moins que 7 secondes »).
      // `originalEvent` : seuls les gestes de la MAIN, pas nos recentrages GPS.
      m.on("click", replier);
      m.on("movestart", (e) => { if ((e as { originalEvent?: unknown }).originalEvent) replier(); });
      // Un tap (MapLibre n'émet pas `click` après un glissé) : le constructeur y pose un point.
      m.on("click", (e) => clicRef.current?.(e.lngLat.lat, e.lngLat.lng));
      if (onClic) m.getCanvas().style.cursor = "crosshair";
      m.on("dragstart", () => deplacementRef.current?.());
      m.on("zoomstart", (e) => { if ((e as { originalEvent?: unknown }).originalEvent) deplacementRef.current?.(); });
      /**
       * ⚠️ LE PINCEMENT NE COUPAIT PAS TOUJOURS LE SUIVI (Cyprien, 27/11/2026, sur
       * téléphone : « le dézoom ne fonctionne pas »). `zoomstart` n'est émis qu'au DÉBUT
       * d'un zoom : si la carte glissait déjà vers la position GPS, le pincement ne
       * l'émettait pas, le suivi restait actif, et le point suivant la ramenait au zoom 15.
       * On écoute donc les DOIGTS eux-mêmes : un doigt qui bouge sur la carte coupe le
       * suivi, et tant qu'un doigt est posé, aucun recentrage ne part.
       */
      const cadre = m.getCanvasContainer();
      cadre.addEventListener("touchstart", () => { doigts.current = true; }, { passive: true });
      cadre.addEventListener("touchmove", () => { if (suivreRef.current) deplacementRef.current?.(); }, { passive: true });
      const leves = (e: TouchEvent) => { if (e.touches.length === 0) doigts.current = false; };
      cadre.addEventListener("touchend", leves, { passive: true });
      cadre.addEventListener("touchcancel", leves, { passive: true });
      cadre.addEventListener("wheel", () => { if (suivreRef.current) deplacementRef.current?.(); }, { passive: true });
      m.on("load", () => {
        // Pacevo Nuit : les couleurs de nuit, et celles de jour pour en revenir.
        const style = m.getStyle() as unknown as { layers: { id: string; type: string; paint?: Record<string, unknown> }[] };
        nuit.current = peinturesNuit(style);
        jour.current = Object.fromEntries(Object.entries(nuit.current).map(([id, p]) => {
          const c = style.layers.find((x) => x.id === id);
          return [id, Object.fromEntries(Object.keys(p).map((k) => [k, c?.paint?.[k] ?? null]))];
        }));
        // « Mes sorties » : au-dessus de tout le plan (et des fonds « dessus », glissés
        // juste avant elle), sous le tracé du jour — bleu translucide comme une carte de
        // chaleur : là où les lignes se superposent, le bleu fonce.
        m.addSource("parcours", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: [] } } });
        m.addLayer({ id: "parcours", type: "line", source: "parcours", layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
          paint: { "line-color": "#2563eb", "line-opacity": 0.45, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 3.5] } });
        m.addSource("trace", { type: "geojson", data: VIDE });
        m.addLayer({ id: "trace-bord", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 7 } });
        m.addLayer({ id: "trace", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": couleurRef.current, "line-width": 4 } });
        // Les points posés du constructeur, au-dessus du tracé.
        m.addSource("reperes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "reperes", type: "circle", source: "reperes",
          paint: { "circle-radius": 7, "circle-color": ["get", "couleur"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
        pret.current = true;
        appliquerFond(m, fondRef.current);
        appliquerCalques(m, calquesRef.current);
        poserTrace(m, traceRef.current);
        poserReperes(m, reperesRef.current);
        poserParcours(m, parcoursRef.current);
        montrerParcours(m, voirParcoursRef.current);
        if (reliefRef.current) appliquerRelief(m, true);
        if (positionRef.current) poserPoint(m, positionRef.current);
        appliquerVue(m, vueRef.current);
      });
      if (positionRef.current) dejaCentree.current = true;
      carte.current = m;
    })();
    return () => { annule = true; pret.current = false; point.current = null; carte.current?.remove(); carte.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le modèle change : on repeint ou on montre une couche, jamais un nouveau style.
  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) appliquerFond(m, fond);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fond.id]);

  const cleCalques = calques.map((c) => c.id).join(",");
  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) appliquerCalques(m, calques);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleCalques]);

  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) poserParcours(m, parcours);
  }, [parcours]);

  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) montrerParcours(m, voirParcours);
  }, [voirParcours]);

  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) appliquerRelief(m, relief);
  }, [relief]);

  // Position : un point bleu qui suit. Le recentrage n'a lieu QUE si le suivi est actif.
  useEffect(() => {
    const m = carte.current; if (!m || !position) return;
    poserPoint(m, position);
    if (!suivreRef.current || doigts.current) return;
    // ⚠️ LE ZOOM DE L'ATHLÈTE EST GARDÉ. Il était remonté de force à 15 à chaque point GPS
    // (`Math.max(zoom, 15)`) : impossible de dézoomer en suivant sa position. Seule la
    // PREMIÈRE position zoome sur lui, comme Strava ; ensuite, on ne fait que le suivre.
    const premiere = !dejaCentree.current;
    dejaCentree.current = true;
    m.easeTo({ center: versLngLat(position), zoom: premiere ? Math.max(m.getZoom(), 15) : m.getZoom(), pitch: m.getPitch() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  // Recentrage demandé : on y va même si le suivi était coupé (c'est ce qui le reprend).
  useEffect(() => {
    const m = carte.current;
    if (!m || !position || recentrer === 0) return;
    // Le recentrage garde le zoom choisi, sauf si l'on voit toute une région (< 13).
    m.easeTo({ center: versLngLat(position), zoom: m.getZoom() < 13 ? 15 : m.getZoom() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentrer]);

  // Le tracé de la course, redessiné à chaque point.
  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) poserTrace(m, track);
  }, [track]);

  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) poserReperes(m, reperes);
  }, [reperes]);

  useEffect(() => {
    const m = carte.current;
    if (m && pret.current && m.getLayer("trace")) m.setPaintProperty("trace", "line-color", couleurTrace);
  }, [couleurTrace]);

  // Aller voir un lieu, ou cadrer un parcours entier (chargé depuis la liste).
  // ⚠️ La demande peut arriver AVANT la carte (un parcours ouvert depuis une autre page, au
  // montage) : elle est gardée et rejouée au chargement, sinon le cadrage serait perdu.
  const vueN = vue?.n ?? 0;
  useEffect(() => { vueRef.current = vue; }, [vue]);
  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) appliquerVue(m, vueRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vueN]);

  // ⚠️ LA HAUTEUR CHANGE EN COURS DE VIE : plein écran avant le départ, plus courte
  // pendant la course. La carte garde la taille mesurée à la création et n'occuperait
  // sinon que l'ancienne surface — le reste resterait vide.
  useEffect(() => {
    const el = conteneur.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => carte.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * ⚠️ DEUX DIV, ET C'EST OBLIGATOIRE. La bibliothèque POSE SES PROPRES CLASSES sur
   * l'élément qu'on lui confie (`maplibregl-map`…). Si React réécrit l'attribut `class` de
   * cet élément — ce qu'il fait dès que la valeur du `className` change (la hauteur passe
   * du plein écran à 40 vh au départ de la course) — il les efface toutes, et la feuille
   * de style de la carte cesse de s'appliquer d'un coup (vécu le 23/09/2026 avec Leaflet :
   * carte BLANCHE, aucune erreur).
   *
   * L'enveloppe porte donc la mise en page (elle, peut changer), et l'élément de la carte
   * garde une classe CONSTANTE que React n'a aucune raison de retoucher.
   *
   * ⚠️ Pas d'`aria-hidden` : la carte se déplace et se zoome au doigt. Masquer à
   * l'assistance vocale une zone interactive est une faute d'accessibilité — on la nomme.
   */
  return (
    <div className={`relative isolate overflow-hidden bg-[#f2f1ed] ${className}`}>
      <div ref={conteneur} role="region" aria-label={etiquette ?? "Carte"} className="h-full w-full" />
    </div>
  );
}
