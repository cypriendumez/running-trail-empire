"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Carte d'un segment — tracé réel, sur les tuiles MapTiler.
//
//  MapTiler et non Mapbox : ce projet n'a AUCUN jeton Mapbox (ni en local, ni en
//  production), et l'API de cartes statiques MapTiler répond 403 sur ce forfait.
//  Leaflet + tuiles MapTiler est la pile déjà en service dans Trail Builder — donc
//  éprouvée, et sans dépendance supplémentaire.
// ─────────────────────────────────────────────────────────────────────────────
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker } from "react-leaflet";
import L from "leaflet";
import { flechesLeLongDe } from "@/lib/activities/fleches";
import { decodePolyline } from "@/lib/segments/geo";

const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";

// Repli OpenStreetMap si la clé manque : mieux vaut une carte sobre qu'un rectangle
// gris. On ne prétend pas afficher la carte si elle ne peut pas se charger.
const TUILES = MAPTILER
  ? { url: `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${MAPTILER}`, attribution: "© MapTiler © OpenStreetMap" }
  : { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap" };

export function SegmentMap({ polyline, height = 180 }: { polyline: string; height?: number }) {
  const pts = decodePolyline(polyline);
  if (pts.length < 2) return null;

  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];
  const ligne = pts.map((p) => [p.lat, p.lon] as [number, number]);

  return (
    <div style={{ height }} className="overflow-hidden rounded-xl">
      {/* ⚠️ `attributionControl` était à FALSE : les tuiles MapTiler/OpenStreetMap
          s'affichaient donc SANS crédit, alors que la licence l'exige — et le
          commentaire voisin prétendait le contraire. La molette reste désactivée pour
          ne pas confisquer le défilement de la page ; le glisser et le zoom, eux, sont
          rendus à l'athlète : une carte qu'on ne peut pas bouger n'est pas une carte. */}
      <MapContainer bounds={bounds} boundsOptions={{ padding: [18, 18] }}
        scrollWheelZoom={false} dragging zoomControl
        style={{ height: "100%", width: "100%" }}>
        <TileLayer url={TUILES.url} attribution={TUILES.attribution} />
        {/* Double tracé : un liseré blanc dessous pour que la ligne reste lisible
            au-dessus d'une forêt sombre comme d'une zone urbaine claire. */}
        <Polyline positions={ligne} pathOptions={{ color: "#ffffff", weight: 6, opacity: 0.9 }} />
        <Polyline positions={ligne} pathOptions={{ color: "#059669", weight: 3.5 }} />
        {/* Chevrons de direction : sur une boucle, un trait ne dit pas dans quel sens
            on a tourné. Espacés le long de la DISTANCE, pas tous les N points — un GPS
            échantillonne au temps, et un athlète arrêté entasse des points au même
            endroit. Non cliquables : ils décorent, ils ne réagissent pas. */}
        {flechesLeLongDe(pts, 6).map((f, i) => (
          <Marker key={`f${i}`} position={[f.lat, f.lon]} interactive={false} keyboard={false}
            icon={L.divIcon({
              className: "",
              iconSize: [16, 16],
              iconAnchor: [8, 8],
              html: `<svg viewBox="0 0 16 16" width="16" height="16" style="transform:rotate(${f.cap}deg)">`
                + `<path d="M8 2.5 L12.5 11 L8 8.6 L3.5 11 Z" fill="#059669" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>`,
            })} />
        ))}
        <CircleMarker center={ligne[0]} radius={5} pathOptions={{ color: "#fff", weight: 2, fillColor: "#059669", fillOpacity: 1 }} />
        <CircleMarker center={ligne[ligne.length - 1]} radius={5} pathOptions={{ color: "#fff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 }} />
      </MapContainer>
    </div>
  );
}
