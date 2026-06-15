"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Page publique : reçoit en temps réel la position d'un coureur qui partage sa
// sortie (Supabase Realtime broadcast) et l'affiche bouger sur la carte.
export function LiveViewer({ id }: { id: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const dotRef = useRef<unknown>(null);
  const lineRef = useRef<unknown>(null);
  const [connected, setConnected] = useState(false);
  const [hasPos, setHasPos] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;

    import("leaflet").then((L) => {
      if (cancelled || !mapContainer.current || mapRef.current) return;
      const map = L.map(mapContainer.current, { center: [46.7, 2.4], zoom: 6 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
      mapRef.current = map;

      const supabase = createClient();
      channel = supabase.channel(`run-${id}`, { config: { broadcast: { self: false } } });

      channel.on("broadcast", { event: "route" }, (msg: { payload?: { coordinates?: [number, number][] } }) => {
        const coords = msg.payload?.coordinates;
        if (!coords || coords.length < 2) return;
        const latlngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
        if (lineRef.current) map.removeLayer(lineRef.current as L.Layer);
        const casing = L.polyline(latlngs, { color: "#ffffff", weight: 7, opacity: 0.9 });
        const core = L.polyline(latlngs, { color: "#2563eb", weight: 4 });
        lineRef.current = L.layerGroup([casing, core]).addTo(map);
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
      });

      channel.on("broadcast", { event: "pos" }, (msg: { payload?: { lat?: number; lng?: number; remaining?: number } }) => {
        const lat = msg.payload?.lat, lng = msg.payload?.lng;
        if (typeof lat !== "number" || typeof lng !== "number") return;
        setHasPos(true);
        if (typeof msg.payload?.remaining === "number") setRemaining(msg.payload.remaining);
        if (dotRef.current) {
          (dotRef.current as L.Marker).setLatLng([lat, lng]);
        } else {
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 3px rgba(37,99,235,.35),0 1px 6px rgba(0,0,0,.45)"></div>`,
            iconAnchor: [9, 9],
          });
          dotRef.current = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
        }
        map.panTo([lat, lng], { animate: true, duration: 0.5 });
      });

      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") { setConnected(true); channel.send({ type: "broadcast", event: "req", payload: {} }); }
      });
    });

    return () => {
      cancelled = true;
      try { channel?.unsubscribe(); } catch { /* ignore */ }
      (mapRef.current as { remove?: () => void } | null)?.remove?.();
      mapRef.current = null;
    };
  }, [id]);

  return (
    <div className="relative h-[100dvh] w-full bg-zinc-100">
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur rounded-full shadow-lg border border-zinc-100">
        {!hasPos ? (
          <span className="flex items-center gap-2 text-sm font-medium text-zinc-600">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> {connected ? "En attente de la position…" : "Connexion…"}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
            </span>
            Suivi en direct{remaining != null && <span className="font-normal text-zinc-600"> · {remaining < 1 ? `${Math.round(remaining * 1000)} m` : `${remaining.toFixed(1)} km`} restants</span>}
          </span>
        )}
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] text-[11px] text-zinc-500 bg-white/90 px-3 py-1 rounded-full">
        Running &amp; Trail Empire · données © OpenStreetMap
      </div>
    </div>
  );
}
