"use client";
import { useEffect, useRef } from "react";
import type L from "leaflet";

/**
 * LA CARTE DE L'ÉCRAN « ENREGISTRER » — comme Strava : la position d'abord.
 *
 * Cyprien, 21/09/2026 : « fais comme Strava avec la carte, et laisse la personne aller en
 * bas avec tous les réglages qu'il y a déjà ». Sur téléphone, l'écran s'ouvre donc sur la
 * carte (position en direct, puis le tracé pendant la course) ; les réglages suivent.
 *
 * Leaflet touche `window` : le composant est chargé côté client seulement (`dynamic`).
 * `isolate` sur l'enveloppe : les commandes Leaflet sont à z-1000 et passeraient sinon
 * par-dessus les menus de l'entête (cf. globals.css).
 */
const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";

export function CarteDirect({ position, track, className = "" }: { position: [number, number] | null; track: [number, number][]; className?: string }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const point = useRef<L.CircleMarker | null>(null);
  const trace = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    let annule = false;
    (async () => {
      const Lf = (await import("leaflet")).default;
      if (annule || !conteneur.current) return;
      const m = Lf.map(conteneur.current, { center: position ?? [46.6, 2.3], zoom: position ? 15 : 5, zoomControl: false, attributionControl: false });
      if (MAPTILER) Lf.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER}`, { tileSize: 512, zoomOffset: -1, maxZoom: 19 }).addTo(m);
      else Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
      Lf.control.attribution({ position: "bottomright", prefix: MAPTILER ? "© MapTiler © OpenStreetMap" : "© OpenStreetMap" }).addTo(m);
      trace.current = Lf.polyline([], { color: "#059669", weight: 4, opacity: 0.9 }).addTo(m);
      carte.current = m;
      // Le conteneur peut avoir été mesuré à 0 avant la mise en page : on remesure.
      setTimeout(() => m.invalidateSize(), 50);
    })();
    return () => { annule = true; carte.current?.remove(); carte.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Position : un point bleu qui suit, et la carte reste centrée dessus.
  useEffect(() => {
    const m = carte.current; if (!m || !position) return;
    import("leaflet").then(({ default: Lf }) => {
      if (!carte.current) return;
      if (!point.current) point.current = Lf.circleMarker(position, { radius: 7, color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(m);
      else point.current.setLatLng(position);
      m.setView(position, Math.max(m.getZoom(), 15), { animate: true });
    });
  }, [position]);

  // Le tracé de la course, redessiné à chaque point.
  useEffect(() => { trace.current?.setLatLngs(track); }, [track]);

  return <div ref={conteneur} className={`relative isolate overflow-hidden ${className}`} aria-hidden />;
}
