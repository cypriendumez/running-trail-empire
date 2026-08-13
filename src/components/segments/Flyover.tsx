"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  SURVOL 3D — rejouer une sortie vue du ciel, relief compris.
//
//  MapLibre GL et non Mapbox GL : ce projet n'a AUCUN jeton Mapbox, et Mapbox GL v2+
//  en exige un même pour un style tiers. MapLibre est le fork libre, et MapTiler
//  fournit le style vectoriel comme les tuiles de relief (`terrain-rgb-v2`, vérifiées
//  accessibles sur la clé du projet).
//
//  ⚠️ GRATUIT SUR PACEVO. Chez Strava cette fonction est réservée aux abonnés — c'est
//  d'ailleurs l'écran de la vidéo de référence. Ici elle est ouverte à tous : aucun
//  test d'abonnement dans ce fichier, et il ne doit pas y en avoir.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, setWorkerUrl, type LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Play, Pause, RotateCcw, Loader2 } from "lucide-react";
import { decodePolyline } from "@/lib/segments/geo";

const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";

/**
 * ⚠️ WORKER AUTO-HÉBERGÉ — sans ça, la carte reste NOIRE, en silence.
 *
 * MapLibre délègue le chargement et le décodage des tuiles à un Web Worker. Sous
 * Turbopack, le module du worker n'est pas servi correctement : le navigateur reçoit
 * du HTML à la place du script (« non-JavaScript MIME type text/html »). Le style se
 * parse quand même — d'où l'illusion que tout va bien — mais AUCUNE source ne finit
 * de charger : `isStyleLoaded()` reste faux, l'événement `load` ne part jamais, et
 * pas une seule tuile n'est demandée. Diagnostic obtenu en créant une carte minimale
 * dans la même page : elle échouait pareil, ce qui a écarté ma configuration.
 *
 * On sert donc le worker fourni par le paquet depuis /public. Le fichier est copié
 * par `npm run sync:maplibre` — À RELANCER après toute mise à jour de maplibre-gl,
 * un worker d'une autre version que la bibliothèque ne fonctionnerait pas.
 */
if (typeof window !== "undefined") setWorkerUrl("/maplibre-gl-csp-worker.js");

export type FlyoverStats = { title: string; distanceKm: number | null; paceLabel: string | null };

/** Durée du survol, quelle que soit la longueur de la trace. */
const DUREE_MS = 26_000;

export function Flyover({ polyline, altitudes, stats }: {
  polyline: string;
  /** Altitudes alignées sur les points, si connues — sinon le bandeau les tait. */
  altitudes?: number[] | null;
  stats: FlyoverStats;
}) {
  const conteneur = useRef<HTMLDivElement | null>(null);
  const carte = useRef<MapLibreMap | null>(null);
  const anim = useRef<number | null>(null);
  const depart = useRef<number>(0);
  const ecoule = useRef<number>(0);

  const [pret, setPret] = useState(false);
  const [joue, setJoue] = useState(false);
  const [avance, setAvance] = useState(0); // 0 → 1
  const [erreur, setErreur] = useState<string | null>(null);

  const points = decodePolyline(polyline);

  useEffect(() => {
    if (!conteneur.current || points.length < 2) return;
    if (!MAPTILER) { setErreur("Carte indisponible : aucune clé MapTiler configurée."); return; }

    const coords = points.map((p) => [p.lon, p.lat] as [number, number]);
    const map = new MapLibreMap({
      container: conteneur.current,
      style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER}`,
      center: coords[0],
      zoom: 14, pitch: 60, bearing: 0,
      attributionControl: false,
      // La trace est le sujet : on empêche l'utilisateur de la perdre par un
      // déplacement accidentel pendant la lecture.
      interactive: true,
    });
    carte.current = map;

    map.on("error", (e: { error?: { message?: string } }) => setErreur(e?.error?.message ?? "La carte n'a pas pu se charger."));

    // Un spinner éternel est le pire état possible : l'athlète attend une carte qui
    // ne viendra pas, sans jamais savoir pourquoi. Au bout de 15 s sans événement
    // `load`, on l'annonce franchement.
    const minuteur = setTimeout(() => {
      if (!carte.current?.isStyleLoaded()) {
        setErreur("La carte 3D n'a pas réussi à se charger dans ce navigateur. Les cartes 2D (Segments, Carte de chaleur) fonctionnent normalement.");
      }
    }, 15000);

    map.on("load", () => {
      clearTimeout(minuteur);
      // ── RELIEF ────────────────────────────────────────────────────────────
      map.addSource("relief", {
        type: "raster-dem",
        tiles: [`https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${MAPTILER}`],
        tileSize: 256, maxzoom: 12,
      });
      // Exagération 1,5 : à l'échelle 1, une région plate comme les Flandres paraît
      // strictement plate en 3D et le survol perd tout intérêt. Au-delà de 2, une
      // colline devient une falaise — on montrerait un relief qui n'existe pas.
      try { map.setTerrain({ source: "relief", exaggeration: 1.5 }); }
      catch { /* sans relief, le survol reste utile en 2,5D */ }

      map.addSource("trace", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
      });
      // Double trait : un liseré sombre dessous, la ligne émeraude dessus — lisible
      // sur une forêt comme sur un champ clair.
      map.addLayer({
        id: "trace-ombre", type: "line", source: "trace",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0b3b2e", "line-width": 9, "line-opacity": 0.55, "line-blur": 2 },
      });
      map.addLayer({
        id: "trace-ligne", type: "line", source: "trace",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#10b981", "line-width": 4.5 },
      });

      map.fitBounds(bornes(coords), { padding: 60, pitch: 60, duration: 0 });
      setPret(true);
    });

    return () => {
      clearTimeout(minuteur);
      if (anim.current) cancelAnimationFrame(anim.current);
      map.remove();
      carte.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyline]);

  function bornes(coords: [number, number][]): LngLatBoundsLike {
    const lons = coords.map((c) => c[0]), lats = coords.map((c) => c[1]);
    return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
  }

  function boucle(t: number) {
    const map = carte.current;
    if (!map) return;
    if (!depart.current) depart.current = t - ecoule.current;
    const p = Math.min(1, (t - depart.current) / DUREE_MS);
    ecoule.current = t - depart.current;
    setAvance(p);

    const i = Math.min(points.length - 1, Math.floor(p * (points.length - 1)));
    const suivant = points[Math.min(points.length - 1, i + 3)];
    const ici = points[i];
    // Le cap suit la direction RÉELLE de course : sans lui, la caméra glisse de côté
    // et le survol ressemble à un travelling, pas à une course.
    const cap = (Math.atan2(suivant.lon - ici.lon, suivant.lat - ici.lat) * 180) / Math.PI;

    map.jumpTo({ center: [ici.lon, ici.lat], zoom: 15.4, pitch: 66, bearing: cap });

    if (p < 1) anim.current = requestAnimationFrame(boucle);
    else { setJoue(false); depart.current = 0; ecoule.current = 0; }
  }

  function basculer() {
    if (joue) {
      if (anim.current) cancelAnimationFrame(anim.current);
      depart.current = 0;
      setJoue(false);
      return;
    }
    setJoue(true);
    anim.current = requestAnimationFrame(boucle);
  }

  function rejouer() {
    if (anim.current) cancelAnimationFrame(anim.current);
    depart.current = 0; ecoule.current = 0;
    setAvance(0); setJoue(true);
    anim.current = requestAnimationFrame(boucle);
  }

  // Altitude au point courant — affichée SEULEMENT si elle est connue.
  const iAct = Math.min(points.length - 1, Math.floor(avance * (points.length - 1)));
  const altAct = altitudes && altitudes.length === points.length ? altitudes[iAct] : null;
  const kmParcourus = stats.distanceKm != null ? stats.distanceKm * avance : null;

  if (erreur) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
        <p className="font-semibold text-zinc-900">Survol indisponible</p>
        <p className="mt-1 text-sm text-zinc-500">{erreur}</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900" style={{ height: 520 }}>
      {/* ⚠️ DIMENSIONS EN STYLE EN LIGNE, PAS EN CLASSES. `maplibre-gl.css` impose
          `position: relative` sur `.maplibregl-map` ; à spécificité égale et chargée
          après Tailwind, elle écrasait le `absolute` de `absolute inset-0`. Le
          conteneur retombait alors à 0 pixel de haut — et une carte sans hauteur ne
          demande AUCUNE tuile : écran noir, `load` qui n'aboutit jamais, spinner
          éternel. Symptôme muet : aucune erreur, ni console, ni réseau. */}
      <div ref={conteneur} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {!pret && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      )}

      {/* Bandeau de chiffres — même esprit que la vidéo de référence, mais on
          n'affiche QUE ce qui est mesuré : pas d'altitude si la trace n'en porte pas. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-5 text-white">
        <div className="text-center text-sm font-semibold drop-shadow">{stats.title}</div>
        <div className="mt-3 flex justify-center gap-10">
          {stats.paceLabel && (
            <Chiffre libelle="Allure" valeur={stats.paceLabel} unite="/km" />
          )}
          {altAct != null && <Chiffre libelle="Altitude" valeur={String(Math.round(altAct))} unite="m" />}
          {kmParcourus != null && (
            <Chiffre libelle="Distance" valeur={kmParcourus.toFixed(1).replace(".", ",")} unite="km" />
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
        <button onClick={basculer}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-400">
          {joue ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <button onClick={rejouer} title="Recommencer"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25">
          <RotateCcw className="h-4 w-4" />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-100"
            style={{ width: `${avance * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function Chiffre({ libelle, valeur, unite }: { libelle: string; valeur: string; unite: string }) {
  return (
    <div className="text-center drop-shadow">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{libelle}</div>
      <div className="text-3xl font-black leading-tight">{valeur}</div>
      <div className="text-[10px] text-white/70">{unite}</div>
    </div>
  );
}
