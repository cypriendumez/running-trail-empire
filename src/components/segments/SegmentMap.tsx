"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Carte d'un segment — tracé réel, sur les tuiles MapTiler.
//
//  MapTiler et non Mapbox : ce projet n'a AUCUN jeton Mapbox (ni en local, ni en
//  production), et l'API de cartes statiques MapTiler répond 403 sur ce forfait.
//  Leaflet + tuiles MapTiler est la pile déjà en service dans Trail Builder — donc
//  éprouvée, et sans dépendance supplémentaire.
// ─────────────────────────────────────────────────────────────────────────────
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, AttributionControl } from "react-leaflet";
import L from "leaflet";
import { flechesLeLongDe } from "@/lib/activities/fleches";
import { decodePolyline } from "@/lib/segments/geo";

const MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";

// Repli OpenStreetMap si la clé manque : mieux vaut une carte sobre qu'un rectangle
// gris. On ne prétend pas afficher la carte si elle ne peut pas se charger.
//
// ⚠️ LES TUILES MAPTILER FONT 512 PX. Déclarées en 256 (le défaut de Leaflet), chacune était
// réduite de moitié : des noms de rue illisibles, et 2,3 fois plus de tuiles à télécharger
// pour remplir une vignette (25 contre 11 pour dix segments, mesuré le 30/10/2026). La page
// des segments montrait des carrés gris (Cyprien : « des bugs de carte ») : chaque tuile en
// trop est une occasion d'échec, et un échec n'était jamais rattrapé (`reessayerTuile`).
// `tileSize: 512` + `zoomOffset: -1` est la déclaration attendue par Leaflet pour ces tuiles ;
// le WebP pèse 29 % de moins que le PNG (8,8 contre 12,4 Ko, même tuile).
const TUILES = MAPTILER
  ? { url: `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.webp?key=${MAPTILER}`, attribution: "© MapTiler © OpenStreetMap", tileSize: 512, zoomOffset: -1 }
  : { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap", tileSize: 256, zoomOffset: 0 };

/** Sous cette hauteur, c'est une vignette : les boutons +/− en mangeaient la moitié. */
const HAUTEUR_VIGNETTE = 180;
/** Nouvelles tentatives pour une tuile refusée, espacées d'une seconde de plus à chaque fois. */
const ESSAIS_MAX = 2;

/**
 * Une tuile qui échoue reste un carré GRIS jusqu'au rechargement : Leaflet ne la redemande
 * jamais. Un refus passager (réseau, rafale de requêtes) ne doit pas défigurer la carte.
 * L'adresse est redemandée à la couche, jamais recopiée de l'image qui a échoué ; le
 * paramètre `r` la rend unique, sans quoi le navigateur pourrait resservir l'échec.
 */
function reessayerTuile(e: L.TileErrorEvent) {
  const img = e.tile as HTMLImageElement & { essais?: number };
  const n = (img.essais ?? 0) + 1;
  if (n > ESSAIS_MAX) return;
  img.essais = n;
  const url = (e.target as L.TileLayer).getTileUrl(e.coords);
  window.setTimeout(() => { img.src = `${url}${url.includes("?") ? "&" : "?"}r=${n}`; }, 1000 * n);
}

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
    // ⚠️ LE CRÉDIT EST OBLIGATOIRE, PAS SA TAILLE. La licence d'OpenStreetMap et les
    // conditions de MapTiler exigent la mention ; rien n'impose qu'elle couvre le quart
    // d'une vignette de 120 px (Cyprien : « mets-le en tout petit »). Les classes visent le
    // contrôle Leaflet depuis l'enveloppe, jamais le conteneur de la carte, dont React
    // effacerait les classes `leaflet-*` (voir la carte des courses).
    <div style={{ height }} className="overflow-hidden rounded-xl [&_.leaflet-control-attribution]:!bg-white/60 [&_.leaflet-control-attribution]:!px-1 [&_.leaflet-control-attribution]:!text-[8px] [&_.leaflet-control-attribution]:!leading-[11px] [&_.leaflet-control-attribution]:!text-zinc-500">
      {/* ⚠️ `attributionControl` était à FALSE : les tuiles MapTiler/OpenStreetMap
          s'affichaient donc SANS crédit, alors que la licence l'exige — et le
          commentaire voisin prétendait le contraire. La molette reste désactivée pour
          ne pas confisquer le défilement de la page ; le glisser et le zoom, eux, sont
          rendus à l'athlète : une carte qu'on ne peut pas bouger n'est pas une carte. */}
      <MapContainer bounds={bounds} boundsOptions={{ padding: [18, 18] }}
        scrollWheelZoom={false} dragging zoomControl={height >= HAUTEUR_VIGNETTE} attributionControl={false}
        style={{ height: "100%", width: "100%" }}>
        <TileLayer url={TUILES.url} attribution={TUILES.attribution} tileSize={TUILES.tileSize} zoomOffset={TUILES.zoomOffset}
          eventHandlers={{ tileerror: reessayerTuile }} />
        {/* ⚠️ La mention passe À GAUCHE. Par défaut Leaflet la pose en bas à DROITE avec
            un z-index de 800 — soit exactement sous le bouton « survol 3D », qu'elle
            recouvrait. Régression introduite en rétablissant l'attribution : le crédit
            est obligatoire, mais il n'a pas à manger le seul bouton de la carte. */}
        <AttributionControl position="bottomleft" prefix={false} />
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
              iconSize: [22, 22],
              iconAnchor: [11, 11],
              html: `<svg viewBox="0 0 16 16" width="22" height="22" style="transform:rotate(${f.cap}deg)">`
                + `<path d="M8 2.5 L12.5 11 L8 8.6 L3.5 11 Z" fill="#059669" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
            })} />
        ))}
        <CircleMarker center={ligne[0]} radius={5} pathOptions={{ color: "#fff", weight: 2, fillColor: "#059669", fillOpacity: 1 }} />
        <CircleMarker center={ligne[ligne.length - 1]} radius={5} pathOptions={{ color: "#fff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 }} />
      </MapContainer>
    </div>
  );
}
