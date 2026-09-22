"use client";
import { useEffect, useRef } from "react";
import type L from "leaflet";
import { fondsCarteDirecte, type IdFond } from "@/lib/courses/fondsCarte";

/**
 * LA CARTE DE L'ÉCRAN « ENREGISTRER » — comme Strava : la position d'abord.
 *
 * Cyprien, 21/09/2026 : « fais comme Strava avec la carte, et laisse la personne aller en
 * bas avec tous les réglages qu'il y a déjà » ; puis le 22/09 : « fais comme sur Strava,
 * ça rend ». L'écran s'ouvre donc sur la carte (position en direct, puis le tracé pendant
 * la course), les commandes flottent dessus, les réglages suivent en dessous.
 *
 * ⚠️ LE SUIVI AUTOMATIQUE DOIT POUVOIR S'ARRÊTER. La carte se recentrait à CHAQUE point
 * GPS : dès qu'on déplaçait la carte pour regarder la suite du parcours, la position
 * suivante la ramenait — on ne pouvait rien regarder d'autre que ses pieds. Un glissement
 * (ou un zoom) de la main coupe donc le suivi, et le bouton de recentrage le reprend,
 * exactement comme Strava.
 *
 * ⚠️ `zoomstart` EST AMBIGU : Leaflet l'émet aussi pour NOS propres `setView`. Sans le
 * drapeau `nous`, le premier recentrage automatique couperait le suivi lui-même.
 *
 * Leaflet touche `window` : le composant est chargé côté client seulement (`dynamic`).
 * `isolate` sur l'enveloppe : les commandes Leaflet sont à z-1000 et passeraient sinon
 * par-dessus les menus de l'entête (cf. globals.css).
 */
const FONDS = fondsCarteDirecte(process.env.NEXT_PUBLIC_MAPTILER_KEY || undefined);

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
   * 5 — un rectangle bleu qui ne dit rien de personne (Cyprien, 23/09/2026 : « ça rend
   * pas »).
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
  const carte = useRef<L.Map | null>(null);
  const point = useRef<L.CircleMarker | null>(null);
  const trace = useRef<L.Polyline | null>(null);
  const couche = useRef<L.TileLayer | null>(null);
  const fondPose = useRef<IdFond | null>(null);
  /** Vrai pendant NOS déplacements : ce qu'ils émettent ne vient pas de la main. */
  const nous = useRef(false);
  const suivreRef = useRef(suivre);
  const deplacementRef = useRef(onDeplacement);
  useEffect(() => { suivreRef.current = suivre; }, [suivre]);
  useEffect(() => { deplacementRef.current = onDeplacement; }, [onDeplacement]);

  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    let annule = false;
    (async () => {
      const Lf = (await import("leaflet")).default;
      if (annule || !conteneur.current) return;
      const depart = position ?? centre ?? null;
      const m = Lf.map(conteneur.current, {
        center: depart ?? [46.6, 2.3],
        zoom: position ? 15 : depart ? 13 : 5,
        zoomControl: false, attributionControl: false,
      });
      // L'attribution suit la couche : Leaflet la met à jour tout seul au changement de
      // fond, à condition qu'elle soit portée par la couche et non par un préfixe figé.
      // ⚠️ EN HAUT À GAUCHE, PAS EN BAS À DROITE : le bloc blanc des chiffres occupe tout
      // le bas de la carte et la recouvrait entièrement. Une attribution cachée vaut une
      // attribution absente — c'est-à-dire une carte utilisée sans droit.
      Lf.control.attribution({ position: "topleft", prefix: false }).addTo(m);
      const f = FONDS.find((x) => x.id === fond) ?? FONDS[0];
      couche.current = Lf.tileLayer(f.url, { tileSize: f.taille, zoomOffset: f.zoomOffset, maxZoom: f.zoomMax, attribution: f.attribution }).addTo(m);
      fondPose.current = f.id;
      trace.current = Lf.polyline([], { color: "#059669", weight: 4, opacity: 0.9 }).addTo(m);
      m.on("moveend zoomend", () => { nous.current = false; });
      m.on("dragstart", () => deplacementRef.current?.());
      m.on("zoomstart", () => { if (!nous.current) deplacementRef.current?.(); });
      carte.current = m;
      // Le conteneur peut avoir été mesuré à 0 avant la mise en page : on remesure.
      setTimeout(() => m.invalidateSize(), 50);
    })();
    return () => { annule = true; carte.current?.remove(); carte.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le fond change (plan ↔ satellite) : on échange la couche, pas la carte.
  useEffect(() => {
    const m = carte.current;
    if (!m || fondPose.current === null || fondPose.current === fond) return;
    const f = FONDS.find((x) => x.id === fond);
    if (!f) return;
    import("leaflet").then(({ default: Lf }) => {
      if (!carte.current) return;
      const ancienne = couche.current;
      couche.current = Lf.tileLayer(f.url, { tileSize: f.taille, zoomOffset: f.zoomOffset, maxZoom: f.zoomMax, attribution: f.attribution }).addTo(m);
      fondPose.current = f.id;
      if (ancienne) m.removeLayer(ancienne);
    });
  }, [fond]);

  // Position : un point bleu qui suit. Le recentrage n'a lieu QUE si le suivi est actif.
  useEffect(() => {
    const m = carte.current; if (!m || !position) return;
    import("leaflet").then(({ default: Lf }) => {
      if (!carte.current) return;
      if (!point.current) point.current = Lf.circleMarker(position, { radius: 7, color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(m);
      else point.current.setLatLng(position);
      if (!suivreRef.current) return;
      nous.current = true;
      m.setView(position, Math.max(m.getZoom(), 15), { animate: true });
    });
  }, [position]);

  // Recentrage demandé : on y va même si le suivi était coupé (c'est ce qui le reprend).
  useEffect(() => {
    const m = carte.current;
    if (!m || !position || recentrer === 0) return;
    nous.current = true;
    m.setView(position, Math.max(m.getZoom(), 15), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentrer]);

  // Le tracé de la course, redessiné à chaque point.
  useEffect(() => { trace.current?.setLatLngs(track); }, [track]);

  // ⚠️ LA HAUTEUR CHANGE EN COURS DE VIE : plein écran avant le départ, plus courte
  // pendant la course. Leaflet garde la taille mesurée à la création et n'affiche alors
  // les tuiles que sur l'ancienne surface — le reste de la carte reste gris.
  useEffect(() => {
    const el = conteneur.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => carte.current?.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * ⚠️ DEUX DIV, ET C'EST OBLIGATOIRE. Leaflet POSE SES PROPRES CLASSES sur l'élément
   * qu'on lui confie (`leaflet-container`, `leaflet-touch`, `leaflet-grab`…). Si React
   * réécrit l'attribut `class` de cet élément — ce qu'il fait dès que la valeur du
   * `className` change — il les efface toutes, et TOUTE la feuille de style de Leaflet
   * cesse de s'appliquer d'un coup.
   *
   * Mesuré le 23/09/2026 sur cet écran : la hauteur passe de plein écran à 40 vh au
   * départ de la course → React réécrit la classe → la règle
   * `.leaflet-container .leaflet-tile-pane img { max-width: none }` ne matche plus → le
   * `max-width: 100%` de Tailwind s'applique à des tuiles dont le conteneur fait 0 px de
   * large → largeur calculée 0 px. Carte BLANCHE, aucune erreur, aucune tuile en échec
   * (elles sont bien téléchargées, juste larges de zéro).
   *
   * L'enveloppe porte donc la mise en page (elle, peut changer), et l'élément de Leaflet
   * garde une classe CONSTANTE que React n'a aucune raison de retoucher.
   *
   * ⚠️ Pas d'`aria-hidden` : la carte se déplace et se zoome au doigt. Masquer à
   * l'assistance vocale une zone interactive est une faute d'accessibilité — on la nomme.
   */
  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      <div ref={conteneur} role="region" aria-label={etiquette ?? "Carte"} className="h-full w-full" />
    </div>
  );
}
