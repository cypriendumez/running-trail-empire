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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Map as MapLibreMap, setWorkerUrl, type LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Play, Pause, RotateCcw, Loader2 } from "lucide-react";
import { decodePolyline } from "@/lib/segments/geo";
import { poseAt, capLisse } from "@/lib/segments/flyover";

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

/** Durée de référence du survol (vitesse ×1), quelle que soit la longueur de la trace. */
const DUREE_MS = 26_000;

/**
 * Réglages proposés à l'athlète.
 *
 * L'INCLINAISON est là pour une raison précise : à 52° au-dessus d'une côte plate
 * comme Ajaccio, le rendu ressemble à une vue du dessus et le relief ne se lit pas.
 * Plutôt que de choisir un compromis à sa place — un angle rasant est spectaculaire
 * en montagne mais illisible en ville — on lui donne la main.
 */
const VITESSES = [
  { label: "×0,5", facteur: 2 },
  { label: "×1", facteur: 1 },
  { label: "×2", facteur: 0.5 },
  { label: "×4", facteur: 0.25 },
] as const;

const ANGLES = [
  { label: "Carte", pitch: 0, zoom: 15.4 },      // vue du dessus, lecture du tracé
  { label: "Suivi", pitch: 52, zoom: 14.9 },     // caméra rapprochée, on voit la rue
  // « Panorama » reproduit le rendu de référence : caméra HAUTE et très reculée, si
  // bien que l'horizon et le ciel entrent dans le cadre. C'est ce qui donne
  // l'impression de survol — au ras du sol, on ne voit qu'un fond de carte qui défile.
  // Le zoom faible fait aussi apparaître les noms de villes, qui situent la sortie.
  { label: "Panorama", pitch: 72, zoom: 11.6 },
] as const;

/** Vue ouverte par défaut : le panorama, c'est lui qu'on vient voir. */
const ANGLE_DEFAUT = 2;

export function Flyover({ polyline, altitudes, paces, stats }: {
  polyline: string;
  /** Altitudes alignées sur les points, si connues — sinon le bandeau les tait. */
  altitudes?: number[] | null;
  /** Allure instantanée (s/km) par point ; `null` aux endroits sans allure fiable. */
  paces?: (number | null)[] | null;
  stats: FlyoverStats;
}) {
  const conteneur = useRef<HTMLDivElement | null>(null);
  const carte = useRef<MapLibreMap | null>(null);
  const anim = useRef<number | null>(null);
  const depart = useRef<number>(0);
  const ecoule = useRef<number>(0);
  const capRef = useRef<number>(0);
  const enCours = useRef<boolean>(false);

  const [pret, setPret] = useState(false);
  const [joue, setJoue] = useState(false);
  const [avance, setAvance] = useState(0); // 0 → 1
  const [erreur, setErreur] = useState<string | null>(null);
  const [prechauffe, setPrechauffe] = useState(false);
  const [vitesse, setVitesse] = useState(1);   // index dans VITESSES
  const [angle, setAngle] = useState(ANGLE_DEFAUT);
  const [zoomDelta, setZoomDelta] = useState(0);

  // La boucle d'animation lit des REFS et non l'état : sans ça, une étape déjà
  // lancée continuerait avec les anciens réglages, et le changement ne prendrait
  // effet qu'au bout de plusieurs secondes.
  const vitesseRef = useRef(1);
  const angleRef = useRef(ANGLE_DEFAUT);
  const zoomRef = useRef(0);
  vitesseRef.current = vitesse; angleRef.current = angle; zoomRef.current = zoomDelta;

  const points = decodePolyline(polyline);
  // Cap de départ : sinon la première image part cap au nord et pivote brutalement.
  const capInitial = points.length > 1
    ? (Math.atan2(points[1].lon - points[0].lon, points[1].lat - points[0].lat) * 180) / Math.PI
    : 0;

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
      // Aucun fondu à l'apparition des tuiles : par défaut MapLibre les fait
      // apparaître en 300 ms, ce qui produit un scintillement permanent quand la
      // caméra avance sans arrêt — lu comme une saccade alors que c'en est l'inverse.
      fadeDuration: 0,
      // Cache élargi : le parcours repasse par les mêmes tuiles au retour, et une
      // tuile réclamée deux fois est une tuile rechargée deux fois.
      maxTileCacheSize: 800,
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
      // ⚠️ TOUT L'HABILLAGE EST ENVELOPPÉ. Une seule exception ici — source déjà
      // déclarée, style incomplet, relief indisponible — empêchait `setPret(true)`
      // de s'exécuter : la carte restait masquée par le voile de chargement alors
      // qu'elle fonctionnait dessous. Le survol doit s'afficher même amputé d'un
      // ornement ; c'est la carte qui compte, pas le ciel.
      try {
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

      // CIEL — dégradé atmosphérique, pour que le haut du cadre ne soit pas un vide
      // gris une fois la caméra relevée.
      //
      // ⚠️ AUCUN BROUILLARD. La première version passait `fog-color` et
      // `horizon-fog-blend` : le brouillard s'appliquait à TOUTE la scène et
      // délavait la carte au point de la rendre presque noire. Un ciel se peint
      // au-dessus de l'horizon, il n'a pas à teinter le sol.
      try {
        (map as unknown as { setSky?: (o: unknown) => void }).setSky?.({
          "sky-color": "#7fb2e5", "horizon-color": "#dbeafe", "sky-horizon-blend": 0.5,
        });
      } catch { /* sans ciel, le survol reste lisible */ }

      // MARQUEUR DE POSITION — le point qui avance. Sur une vue large, sans lui, on
      // ne sait plus OÙ l'on se trouve sur la trace.
      //
      // `getSource` avant `addSource` : ce bloc s'est retrouvé DUPLIQUÉ lors d'une
      // édition, et le second `addSource` levait « source already exists ». Cette
      // exception interrompait le gestionnaire `load` avant `setPret(true)` — la
      // carte restait donc masquée par le voile de chargement alors qu'elle était
      // parfaitement chargée dessous. Rien dans la console, rien dans le réseau.
      if (!map.getSource("position")) {
        map.addSource("position", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coords[0] } },
        });
        map.addLayer({
          id: "position-halo", type: "circle", source: "position",
          paint: { "circle-radius": 13, "circle-color": "#10b981", "circle-opacity": 0.28 },
        });
        map.addLayer({
          id: "position-point", type: "circle", source: "position",
          paint: { "circle-radius": 6, "circle-color": "#10b981", "circle-stroke-width": 2.5, "circle-stroke-color": "#ffffff" },
        });
      }

      } catch (e) {
        console.warn("Survol : habillage partiel", e);
      }

      // HORS du try : ces deux lignes doivent s'exécuter quoi qu'il arrive au-dessus.
      capRef.current = capInitial;
      try { map.fitBounds(bornes(coords), { padding: 60, pitch: ANGLES[ANGLE_DEFAUT].pitch, duration: 0 }); } catch { /* cadrage best-effort */ }
      setPret(true);
    });

    return () => {
      clearTimeout(minuteur);
      enCours.current = false;
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

  /**
   * ⚠️ UNE HORLOGE, PAS UNE CHAÎNE.
   *
   * Les versions précédentes enchaînaient les étapes sur `moveend`, avec un minuteur
   * de secours. Trois mécanismes qui peuvent se perdre — un `moveend` capté au mauvais
   * moment, un `easeTo` qui ne bouge pas, un double démarrage — et la lecture se
   * figeait à l'étape 0 : bouton en pause, barre à zéro, aucune erreur.
   *
   * Désormais une seule source de vérité : le TEMPS ÉCOULÉ. À chaque image, on calcule
   * l'avancement, on place la caméra et le marqueur. Rien à enchaîner, rien à perdre —
   * et la pause n'est qu'une soustraction.
   */
  function boucle(maintenant: number) {
    const map = carte.current;
    if (!map || !enCours.current) return;

    // ── UN INDEX NON FINI NE DOIT PLUS TUER LE LECTEUR ─────────────────────────
    // Relevé en production (14/08, /dashboard/survol) :
    // « Cannot read properties of undefined (reading 'lat') ». Le calcul de position
    // vit désormais dans `lib/segments/flyover` : il est PUR, donc testable, et il
    // renvoie `null` au lieu de lever. Voir l'en-tête du module pour le raisonnement.
    // Ici on se contente d'arrêter proprement — un lecteur qui s'arrête vaut infiniment
    // mieux qu'un lecteur qui explose et ne repart qu'au rechargement de la page.
    const duree = DUREE_MS * VITESSES[vitesseRef.current].facteur;
    const p = Math.min(1, (maintenant - depart.current) / duree);
    const pose = poseAt(points, p);
    if (!pose) { arreter(); return; }
    setAvance(p);
    const { lat, lon } = pose;
    capRef.current = capLisse(capRef.current, pose.capDeg);

    const src = map.getSource("position") as { setData?: (d: unknown) => void } | undefined;
    src?.setData?.({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lon, lat] } });

    const vue = ANGLES[angleRef.current];
    map.jumpTo({
      center: [lon, lat],
      zoom: vue.zoom + zoomRef.current,
      pitch: vue.pitch,
      bearing: capRef.current,
    });

    if (p < 1) {
      anim.current = requestAnimationFrame(boucle);
    } else {
      enCours.current = false;
      setJoue(false);
      ecoule.current = 0;
    }
  }

  /**
   * Préchauffage : on parcourt la trace une fois, sans la montrer, pour que les tuiles
   * soient déjà en cache au lancement. Une tuile réclamée pendant le survol arrive trop
   * tard — elle apparaît en cours de route, et c'est lu comme un à-coup.
   */
  function prechauffer(): Promise<void> {
    const map = carte.current;
    if (!map) return Promise.resolve();
    return new Promise((resolve) => {
      let k = 0;
      const pas = () => {
        if (!carte.current || k > 5) { resolve(); return; }
        const idx = Math.floor((k / 5) * (points.length - 1));
        const vue = ANGLES[angleRef.current];
        carte.current.jumpTo({
          center: [points[idx].lon, points[idx].lat],
          zoom: vue.zoom + zoomRef.current, pitch: vue.pitch,
        });
        k++;
        setTimeout(pas, 110);
      };
      pas();
    });
  }

  /** Arrêt PROPRE : la lecture s'interrompt sans laisser de valeur corrompue derrière
   *  elle. Sans la remise à zéro, un `avance` non fini repartirait dans `demarrer` au
   *  clic suivant et le lecteur replanterait aussitôt. */
  function arreter() {
    enCours.current = false;
    if (anim.current) cancelAnimationFrame(anim.current);
    anim.current = null;
    ecoule.current = 0;
    depart.current = 0;
    setAvance(0);
    setJoue(false);
  }

  function demarrer(depuis: number) {
    if (anim.current) cancelAnimationFrame(anim.current);
    // Une reprise ne peut pas partir d'une position non finie : c'est exactement par là
    // qu'un NaN s'installait durablement dans la lecture.
    const depart0 = Number.isFinite(depuis) ? Math.min(1, Math.max(0, depuis)) : 0;
    ecoule.current = depart0;
    enCours.current = true;
    setJoue(true);
    // `depart` est daté de façon à ce que l'avancement reprenne exactement où il en
    // était : une pause ne doit rien faire perdre.
    depart.current = performance.now() - depart0 * DUREE_MS * VITESSES[vitesseRef.current].facteur;
    anim.current = requestAnimationFrame(boucle);
  }

  async function basculer() {
    if (enCours.current) {
      enCours.current = false;
      if (anim.current) cancelAnimationFrame(anim.current);
      setJoue(false);
      return;
    }
    // Préchauffage au premier lancement seulement : il fait défiler la trace sans
    // l'afficher pour que les tuiles soient déjà en cache. Une tuile réclamée pendant
    // le survol arrive trop tard et apparaît en cours de route.
    if (avance === 0 || avance >= 1) {
      setPrechauffe(true);
      await prechauffer();
      setPrechauffe(false);
      capRef.current = capInitial;
    }
    demarrer(avance >= 1 ? 0 : avance);
  }

  async function rejouer() {
    enCours.current = false;
    if (anim.current) cancelAnimationFrame(anim.current);
    setAvance(0);
    capRef.current = capInitial;
    setPrechauffe(true);
    await prechauffer();
    setPrechauffe(false);
    demarrer(0);
  }

  // Altitude au point courant — affichée SEULEMENT si elle est connue.
  const iAct = Math.min(points.length - 1, Math.floor(avance * (points.length - 1)));
  const altAct = altitudes && altitudes.length === points.length ? altitudes[iAct] : null;
  // Allure du MOMENT si on la connaît, moyenne de la sortie sinon — et on le dit
  // dans le libellé, pour qu'un chiffre figé ne passe pas pour une valeur du moment.
  const paceAct = paces && paces.length === points.length ? paces[iAct] : null;
  const paceTexte = paceAct != null
    ? `${Math.floor(paceAct / 60)}'${String(Math.round(paceAct % 60)).padStart(2, "0")}"`
    : stats.paceLabel;
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

      {/* ⚠️ LE PRÉCHAUFFAGE SE CACHE. Il fait défiler la trace en six bonds pour
          mettre les tuiles en cache, puis revient au départ. Utile — sans lui, les
          tuiles arrivent en cours de survol et cela se lit comme un à-coup — mais
          spectaculairement moche à voir : la caméra se téléporte à travers tout le
          parcours dès qu'on appuie sur Lecture. On le masque donc, et on DIT ce qui
          se passe : un état de préparation annoncé n'est plus un bug. */}
      {prechauffe && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-900/95">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          <p className="text-sm font-semibold text-white">Préparation du survol…</p>
          <p className="text-xs text-white/60">Chargement du relief et des images satellite</p>
        </div>
      )}

      {/* Bandeau de chiffres — même esprit que la vidéo de référence, mais on
          n'affiche QUE ce qui est mesuré : pas d'altitude si la trace n'en porte pas. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-5 text-white">
        <div className="text-center text-sm font-semibold drop-shadow">{stats.title}</div>
        <div className="mt-3 flex justify-center gap-10">
          {paceTexte && (
            <Chiffre libelle={paceAct != null ? "Allure" : "Allure moy."} valeur={paceTexte} unite="/km" />
          )}
          {altAct != null && <Chiffre libelle="Altitude" valeur={String(Math.round(altAct))} unite="m" />}
          {kmParcourus != null && (
            <Chiffre libelle="Distance" valeur={kmParcourus.toFixed(1).replace(".", ",")} unite="km" />
          )}
        </div>
      </div>

      {/* Réglages — appliqués IMMÉDIATEMENT, même en pleine lecture. */}
      <div className="absolute inset-x-0 bottom-16 flex flex-wrap items-center justify-center gap-2 px-4">
        <Groupe titre="Vitesse">
          {VITESSES.map((v, i) => (
            <Pastille key={v.label} actif={i === vitesse} onClick={() => setVitesse(i)}>{v.label}</Pastille>
          ))}
        </Groupe>
        <Groupe titre="Vue">
          {ANGLES.map((a, i) => (
            <Pastille key={a.label} actif={i === angle} onClick={() => setAngle(i)}>{a.label}</Pastille>
          ))}
        </Groupe>
        <Groupe titre="Zoom">
          {/* Bornes serrées : au-delà de ±1,5 on ne distingue plus la trace, ou on ne
              voit plus que le sol. Laisser un zoom libre inviterait à se perdre. */}
          <Pastille actif={false} onClick={() => setZoomDelta((z) => Math.max(-1.5, z - 0.5))}>−</Pastille>
          <span className="px-1 text-[11px] tabular-nums text-white/80">
            {zoomDelta === 0 ? "0" : (zoomDelta > 0 ? "+" : "") + zoomDelta.toString().replace(".", ",")}
          </span>
          <Pastille actif={false} onClick={() => setZoomDelta((z) => Math.min(1.5, z + 0.5))}>+</Pastille>
        </Groupe>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
        <button onClick={basculer}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-400">
          {prechauffe ? <Loader2 className="h-5 w-5 animate-spin" /> : joue ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
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

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 backdrop-blur">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-white/50">{titre}</span>
      {children}
    </div>
  );
}

function Pastille({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
        actif ? "bg-emerald-500 text-white" : "text-white/70 hover:bg-white/15"}`}>
      {children}
    </button>
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
