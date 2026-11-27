"use client";
import { useEffect, useRef } from "react";
// maplibre-gl v6 est ESM-only : pas d'export par défaut, on prend l'espace de noms.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ATTRIBUTION_PLAN, REPLI_PLAN, STYLE_PLAN_URL, satelliteDisponible, stylePacevo, type IdFond,
} from "@/lib/courses/fondsCarte";

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

const SATELLITE = satelliteDisponible(process.env.NEXT_PUBLIC_MAPTILER_KEY || undefined);

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
  position, track, centre, fond = "plan", suivre = true, onDeplacement, recentrer = 0, etiquette, className = "",
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
  fond?: IdFond;
  /** Tant que c'est vrai, la carte reste collée à la position. */
  suivre?: boolean;
  /** Appelé quand la main prend la carte : au parent de couper le suivi. */
  onDeplacement?: () => void;
  /** Compteur : chaque incrément recentre sur la position. */
  recentrer?: number;
  etiquette?: string;
  className?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<maplibregl.Map | null>(null);
  const point = useRef<maplibregl.Marker | null>(null);
  /** Vrai une fois le style chargé : avant, on ne peut ni poser de couche ni de tracé. */
  const pret = useRef(false);
  const suivreRef = useRef(suivre);
  const deplacementRef = useRef(onDeplacement);
  const positionRef = useRef(position);
  const traceRef = useRef(track);
  const fondRef = useRef(fond);
  useEffect(() => { suivreRef.current = suivre; }, [suivre]);
  useEffect(() => { deplacementRef.current = onDeplacement; }, [onDeplacement]);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { traceRef.current = track; }, [track]);
  useEffect(() => { fondRef.current = fond; }, [fond]);

  /** Le point bleu, avec son halo — posé ou déplacé. */
  function poserPoint(m: maplibregl.Map, p: [number, number]) {
    if (!point.current) {
      const el = document.createElement("div");
      el.className = "pacevo-point";
      point.current = new maplibregl.Marker({ element: el }).setLngLat(versLngLat(p)).addTo(m);
    } else point.current.setLngLat(versLngLat(p));
  }

  function poserTrace(m: maplibregl.Map, t: [number, number][]) {
    const src = m.getSource("trace") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: t.map(versLngLat) } });
  }

  function appliquerFond(m: maplibregl.Map, f: IdFond) {
    if (!m.getLayer("satellite")) return;
    m.setLayoutProperty("satellite", "visibility", f === "satellite" ? "visible" : "none");
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
      // ⚠️ EN HAUT À GAUCHE, PAS EN BAS : le bloc blanc des chiffres occupe tout le bas de
      // la carte et la recouvrait. Une attribution cachée vaut une attribution absente —
      // c'est-à-dire une carte utilisée sans droit. Jamais repliée (`compact: false`).
      m.addControl(new maplibregl.AttributionControl({ compact: false }), "top-left");
      m.on("dragstart", () => deplacementRef.current?.());
      m.on("zoomstart", (e) => { if ((e as { originalEvent?: unknown }).originalEvent) deplacementRef.current?.(); });
      m.on("load", () => {
        // Le satellite (si la clé existe) : une couche SOUS les étiquettes, masquée par
        // défaut. On bascule sa visibilité au lieu de changer de style — un `setStyle`
        // effacerait le tracé de la course en cours.
        const premiereEtiquette = m.getStyle().layers.find((c) => c.type === "symbol")?.id;
        if (SATELLITE) {
          m.addSource("satellite", { type: "raster", tiles: [SATELLITE.url], tileSize: SATELLITE.taille, maxzoom: SATELLITE.zoomMax, attribution: SATELLITE.attribution });
          m.addLayer({ id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } }, premiereEtiquette);
        }
        m.addSource("trace", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
        m.addLayer({ id: "trace-bord", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 7 } });
        m.addLayer({ id: "trace", type: "line", source: "trace", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#059669", "line-width": 4 } });
        pret.current = true;
        appliquerFond(m, fondRef.current);
        poserTrace(m, traceRef.current);
        if (positionRef.current) poserPoint(m, positionRef.current);
      });
      carte.current = m;
    })();
    return () => { annule = true; pret.current = false; point.current = null; carte.current?.remove(); carte.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le fond change (plan ↔ satellite) : on montre ou cache la couche, pas la carte.
  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) appliquerFond(m, fond);
  }, [fond]);

  // Position : un point bleu qui suit. Le recentrage n'a lieu QUE si le suivi est actif.
  useEffect(() => {
    const m = carte.current; if (!m || !position) return;
    poserPoint(m, position);
    if (!suivreRef.current) return;
    m.easeTo({ center: versLngLat(position), zoom: Math.max(m.getZoom(), 15) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  // Recentrage demandé : on y va même si le suivi était coupé (c'est ce qui le reprend).
  useEffect(() => {
    const m = carte.current;
    if (!m || !position || recentrer === 0) return;
    m.easeTo({ center: versLngLat(position), zoom: Math.max(m.getZoom(), 15) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentrer]);

  // Le tracé de la course, redessiné à chaque point.
  useEffect(() => {
    const m = carte.current;
    if (m && pret.current) poserTrace(m, track);
  }, [track]);

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
