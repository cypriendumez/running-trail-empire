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
  { label: "Carte", pitch: 0, zoom: 15.4 },   // vue du dessus, lecture du tracé
  { label: "3D", pitch: 52, zoom: 14.9 },     // compromis par défaut
  { label: "Rasant", pitch: 74, zoom: 15.2 }, // relief marqué, horizon visible
] as const;

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
  const etapeRef = useRef<number>(0);
  const enCours = useRef<boolean>(false);
  /** Filet de sécurité de l'enchaînement — voir `allerA`. */
  const filet = useRef<number | null>(null);

  const [pret, setPret] = useState(false);
  const [joue, setJoue] = useState(false);
  const [avance, setAvance] = useState(0); // 0 → 1
  const [erreur, setErreur] = useState<string | null>(null);
  const [prechauffe, setPrechauffe] = useState(false);
  const [vitesse, setVitesse] = useState(1);   // index dans VITESSES
  const [angle, setAngle] = useState(1);       // index dans ANGLES
  const [zoomDelta, setZoomDelta] = useState(0);

  // La boucle d'animation lit des REFS et non l'état : sans ça, une étape déjà
  // lancée continuerait avec les anciens réglages, et le changement ne prendrait
  // effet qu'au bout de plusieurs secondes.
  const vitesseRef = useRef(1);
  const angleRef = useRef(1);
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

      capRef.current = capInitial;
      map.fitBounds(bornes(coords), { padding: 60, pitch: ANGLES[1].pitch, duration: 0 });
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
   * ⚠️ ON N'APPELLE PLUS `jumpTo` À CHAQUE IMAGE.
   *
   * C'était la cause des saccades restantes : à 60 images par seconde, chaque appel
   * force un recalcul complet de la vue et une nouvelle salve de tuiles. MapLibre ne
   * suit pas ce rythme avec le relief activé — il rend une image sur trois, et le
   * mouvement paraît haché alors que le calcul de position, lui, est juste.
   *
   * On découpe donc le parcours en ÉTAPES et on enchaîne des `easeTo` linéaires :
   * MapLibre interpole lui-même entre deux étapes, à son rythme, et précharge les
   * tuiles de la suite. C'est le motif prévu pour ça.
   */
  const ETAPES = 44;

  /**
   * ⚠️ ON N'ENCHAÎNE PLUS AU MINUTEUR, MAIS SUR LA FIN DU MOUVEMENT.
   *
   * C'était la saccade restante, et elle venait de mon propre chaînage : un
   * `setTimeout` réglé sur la MÊME durée que l'`easeTo` déclenche l'étape suivante
   * pile au moment où la précédente s'achève — ou juste avant. MapLibre interrompt
   * alors une animation en cours pour en démarrer une autre, et chaque interruption
   * se voit : un heurt toutes les 400 ms, régulier comme un métronome.
   *
   * En écoutant `moveend`, l'étape suivante ne part QUE lorsque la précédente est
   * réellement terminée. Aucune interruption, donc aucun heurt.
   */
  function allerA(etape: number) {
    const map = carte.current;
    if (!map || !enCours.current || etape >= ETAPES) {
      if (etape >= ETAPES) { setJoue(false); etapeRef.current = 0; setAvance(1); enCours.current = false; }
      return;
    }
    etapeRef.current = etape;

    const p = etape / (ETAPES - 1);
    setAvance(p);

    const brut = p * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(brut));
    const f = brut - i;
    const a = points[i], b = points[i + 1];
    const lat = a.lat + (b.lat - a.lat) * f;
    const lon = a.lon + (b.lon - a.lon) * f;

    const loin = points[Math.min(points.length - 1, i + 4)];
    const capBrut = (Math.atan2(loin.lon - a.lon, loin.lat - a.lat) * 180) / Math.PI;
    const ecart = ((capBrut - capRef.current + 540) % 360) - 180;
    const cap = capRef.current + ecart * 0.4;
    capRef.current = cap;

    const vue = ANGLES[angleRef.current];
    // ⚠️ ENTRÉE EN DOUCEUR. Au lancement, la caméra vient du cadrage d'ensemble
    // (toute la trace visible, très dézoomée) et devait rejoindre le point de départ
    // en une durée d'étape — 433 ms pour traverser plusieurs kilomètres et zoomer de
    // six niveaux. D'où le bond brutal au début, pris pour un bug. La première étape
    // reçoit donc une transition longue et amortie ; les suivantes restent linéaires.
    const entree = etape === 0;
    map.easeTo({
      center: [lon, lat],
      // Le zoom de base dépend de l'inclinaison choisie : un angle rasant demande de
      // reculer, sinon on ne voit plus que le bitume devant soi.
      zoom: vue.zoom + zoomRef.current,
      pitch: vue.pitch, bearing: cap,
      duration: entree ? 1600 : (DUREE_MS * VITESSES[vitesseRef.current].facteur) / ETAPES,
      // Croisière LINÉAIRE (le défaut freine à chaque étape, soit soixante à-coups) ;
      // l'ENTRÉE garde l'amorti par défaut — c'est le seul moment où un mouvement
      // doit se sentir, puisqu'il fait franchir des kilomètres et six niveaux de zoom.
      easing: entree ? undefined : (x: number) => x,
      essential: true,            // ne pas être désactivé par « réduire les animations »
    });

    // ── ENCHAÎNEMENT ────────────────────────────────────────────────────────────
    // ⚠️ L'écouteur se pose APRÈS `easeTo`, et une seule avance est autorisée.
    //
    // Posé AVANT, il captait n'importe quel `moveend` qui traînait — celui du cadrage
    // initial, ou celui d'un déplacement de la carte par l'athlète — et faisait sauter
    // une étape à chaque fois. Et si deux points de la trace sont identiques, `easeTo`
    // ne bouge pas : `moveend` ne vient JAMAIS et le survol se fige définitivement.
    // D'où le filet de sécurité, réglé un peu au-delà de la durée du mouvement.
    const duree = entree ? 1600 : (DUREE_MS * VITESSES[vitesseRef.current].facteur) / ETAPES;
    let avancee = false;
    const suite = () => {
      if (avancee || !enCours.current) return;
      avancee = true;
      if (filet.current) { clearTimeout(filet.current); filet.current = null; }
      allerA(etape + 1);
    };
    map.once("moveend", suite);
    filet.current = window.setTimeout(suite, duree + 400);
  }

  /**
   * Préchauffage : on parcourt la trace une fois, sans afficher, pour que les tuiles
   * soient déjà en cache au lancement. Une tuile demandée pendant le survol arrive
   * trop tard — elle apparaît en cours de route, et c'est vu comme un à-coup.
   */
  function prechauffer(): Promise<void> {
    const map = carte.current;
    if (!map) return Promise.resolve();
    return new Promise((resolve) => {
      let k = 0;
      const pas = () => {
        if (!map || k >= 6) { resolve(); return; }
        const idx = Math.floor((k / 5) * (points.length - 1));
        map.jumpTo({ center: [points[idx].lon, points[idx].lat], zoom: ANGLES[angleRef.current].zoom + zoomRef.current, pitch: ANGLES[angleRef.current].pitch });
        k++;
        setTimeout(pas, 120);
      };
      pas();
    });
  }

  async function basculer() {
    if (enCours.current) {
      enCours.current = false;
      if (filet.current) { clearTimeout(filet.current); filet.current = null; }
      carte.current?.stop();
      setJoue(false);
      return;
    }
    setJoue(true);
    if (etapeRef.current === 0) {
      setPrechauffe(true);
      await prechauffer();
      setPrechauffe(false);
      capRef.current = capInitial;
    }
    enCours.current = true;
    allerA(etapeRef.current >= ETAPES - 1 ? 0 : etapeRef.current);
  }

  async function rejouer() {
    enCours.current = false;
    carte.current?.stop();
    etapeRef.current = 0;
    capRef.current = capInitial;
    setAvance(0);
    setJoue(true);
    setPrechauffe(true);
    await prechauffer();
    setPrechauffe(false);
    enCours.current = true;
    allerA(0);
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
