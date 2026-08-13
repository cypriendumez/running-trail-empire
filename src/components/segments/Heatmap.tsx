"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Rendu de la carte de chaleur — canvas, pas 12 000 éléments DOM.
//
//  Leaflet dessinerait chaque maille comme un objet SVG : à 12 000 mailles, la page
//  se fige. On peint donc une seule couche canvas, redessinée aux déplacements.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { intensity, type HeatCell } from "@/lib/segments/heatmap";

const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";
const TUILES = MAPTILER
  ? { url: `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${MAPTILER}`, attribution: "© MapTiler © OpenStreetMap" }
  : { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap" };

function Couche({ cells, max }: { cells: HeatCell[]; max: number }) {
  const map = useMap();
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "400";
    ref.current = canvas;
    map.getPanes().overlayPane.appendChild(canvas);

    const dessiner = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size.x * dpr; canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`; canvas.style.height = `${size.y}px`;
      // La couche suit la translation du volet : sans ça, la chaleur « glisse »
      // par rapport au fond de carte à chaque déplacement.
      const origin = map.containerPointToLayerPoint([0, 0]);
      canvas.style.transform = `translate(${origin.x}px, ${origin.y}px)`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);

      // Le rayon suit le zoom : à taille fixe, la chaleur devient un confetti de
      // points isolés en zoom fort, et une tache informe en zoom faible.
      const z = map.getZoom();
      const rayon = Math.max(2, Math.min(14, (z - 9) * 2.2));
      const bornes = map.getBounds().pad(0.15);

      ctx.globalCompositeOperation = "lighter";
      for (const c of cells) {
        if (!bornes.contains([c.lat, c.lon])) continue;
        const pt = map.latLngToContainerPoint([c.lat, c.lon]);
        const i = intensity(c.n, max);
        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rayon);
        // Vert émeraude (peu parcouru) → ambre → rouge (trajet quotidien).
        const couleur = i < 0.45 ? "16,185,129" : i < 0.75 ? "245,158,11" : "239,68,68";
        grad.addColorStop(0, `rgba(${couleur},${0.16 + i * 0.5})`);
        grad.addColorStop(1, `rgba(${couleur},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, rayon, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    dessiner();
    map.on("move zoom resize viewreset", dessiner);
    return () => {
      map.off("move zoom resize viewreset", dessiner);
      canvas.remove();
    };
  }, [map, cells, max]);

  return null;
}

export function Heatmap({ cells, bounds, max }: {
  cells: HeatCell[];
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  max: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200">
      <MapContainer
        bounds={[[bounds.minLat, bounds.minLon], [bounds.maxLat, bounds.maxLon]]}
        boundsOptions={{ padding: [24, 24] }}
        scrollWheelZoom style={{ height: 560, width: "100%", background: "#111" }}>
        <TileLayer url={TUILES.url} attribution={TUILES.attribution} />
        <Couche cells={cells} max={max} />
      </MapContainer>
      <div className="flex items-center gap-3 border-t border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-500">
        <span>Peu parcouru</span>
        <span className="h-2 flex-1 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" />
        <span>Trajet quotidien</span>
      </div>
    </div>
  );
}
