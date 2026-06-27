"use client";

import { useEffect, useState } from "react";
import { Cloud, MapPin } from "lucide-react";

// Chips météo + lieu — géolocalisation navigateur (avec consentement) + Open-Meteo (sans clé).
// Reverse-geocoding via BigDataCloud (sans clé). Si refusé/échec → rien ne s'affiche.
const chip = "inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600";

export function WeatherChip() {
  const [data, setData] = useState<{ temp: number; city: string } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const [w, g] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`).then((r) => r.json()),
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`).then((r) => r.json()).catch(() => null),
          ]);
          const temp = Math.round(Number(w?.current?.temperature_2m));
          const city = String(g?.city || g?.locality || "");
          if (!cancelled && Number.isFinite(temp)) setData({ temp, city });
        } catch { /* silencieux */ }
      },
      () => { /* refus / indisponible : on n'affiche rien */ },
      { timeout: 8000, maximumAge: 600000 },
    );
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;
  return (
    <>
      <span className={chip}><Cloud className="h-3.5 w-3.5 text-[#0ea5e9]" /> {data.temp}°C</span>
      {data.city && <span className={chip}><MapPin className="h-3.5 w-3.5 text-[#0ea5e9]" /> {data.city}</span>}
    </>
  );
}
