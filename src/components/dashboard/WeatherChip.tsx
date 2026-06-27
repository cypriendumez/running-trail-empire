"use client";

import { useEffect, useState } from "react";
import { Cloud, MapPin, Wind } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

// Chips météo + lieu + qualité de l'air — géolocalisation navigateur (avec consentement)
// + Open-Meteo (météo & air, sans clé) + BigDataCloud (reverse-geocode, sans clé).
// Si refusé/échec → rien ne s'affiche.
const chip = "inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600";

const AQ: Record<string, { good: string; fair: string; poor: string }> = {
  fr: { good: "Bonne qualité de l'air", fair: "Air moyen", poor: "Air pollué" },
  en: { good: "Good air quality", fair: "Fair air", poor: "Poor air" },
  de: { good: "Gute Luftqualität", fair: "Mäßige Luft", poor: "Schlechte Luft" },
  es: { good: "Buena calidad del aire", fair: "Aire medio", poor: "Aire contaminado" },
  pt: { good: "Boa qualidade do ar", fair: "Ar médio", poor: "Ar poluído" },
};

export function WeatherChip() {
  const { lang } = useT();
  const aq = AQ[lang] ?? AQ.fr;
  const [data, setData] = useState<{ temp: number; city: string; aqi: number | null } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const [w, g, a] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`).then((r) => r.json()),
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`).then((r) => r.json()).catch(() => null),
            fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`).then((r) => r.json()).catch(() => null),
          ]);
          const temp = Math.round(Number(w?.current?.temperature_2m));
          const city = String(g?.city || g?.locality || "");
          const aqiNum = Number(a?.current?.european_aqi);
          if (!cancelled && Number.isFinite(temp)) setData({ temp, city, aqi: Number.isFinite(aqiNum) ? aqiNum : null });
        } catch { /* silencieux */ }
      },
      () => { /* refus / indisponible */ },
      { timeout: 8000, maximumAge: 600000 },
    );
    return () => { cancelled = true; };
  }, [lang]);

  if (!data) return null;
  const airLabel = data.aqi == null ? null : data.aqi <= 40 ? aq.good : data.aqi <= 60 ? aq.fair : aq.poor;
  return (
    <>
      <span className={chip}><Cloud className="h-3.5 w-3.5 text-[#0ea5e9]" /> {data.temp}°C</span>
      {data.city && <span className={chip}><MapPin className="h-3.5 w-3.5 text-[#0ea5e9]" /> {data.city}</span>}
      {airLabel && <span className={chip}><Wind className="h-3.5 w-3.5 text-[#059669]" /> {airLabel}</span>}
    </>
  );
}
