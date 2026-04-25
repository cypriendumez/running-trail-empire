import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OW_KEY = process.env.OPENWEATHER_API_KEY;
const OW_URL = "https://api.openweathermap.org/data/2.5/weather";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");

  if (!lat || !lon) return NextResponse.json({ error: "lat/lon required" }, { status: 400 });
  if (!OW_KEY) return NextResponse.json({ error: "OpenWeather not configured" }, { status: 503 });

  const response = await fetch(
    `${OW_URL}?lat=${lat}&lon=${lon}&appid=${OW_KEY}&units=metric&lang=fr`
  );
  if (!response.ok) return NextResponse.json({ error: "OpenWeather fetch failed" }, { status: 502 });

  const raw = await response.json();

  const temp = raw.main.temp as number;
  const humidity = raw.main.humidity as number;
  const windSpeed = (raw.wind?.speed ?? 0) as number * 3.6; // m/s → km/h
  const condition = raw.weather?.[0]?.main ?? "Clear";
  const description = raw.weather?.[0]?.description ?? "";
  const icon = raw.weather?.[0]?.icon ?? "01d";

  // Performance impact logic
  const impact = computeImpact(temp, humidity, windSpeed, condition);

  return NextResponse.json({
    temperature_c: Math.round(temp * 10) / 10,
    feels_like_c: Math.round((raw.main.feels_like as number) * 10) / 10,
    humidity_pct: humidity,
    wind_speed_kmh: Math.round(windSpeed * 10) / 10,
    wind_direction_deg: raw.wind?.deg ?? 0,
    precipitation_mm: raw.rain?.["1h"] ?? 0,
    cloud_cover_pct: raw.clouds?.all ?? 0,
    visibility_km: raw.visibility ? raw.visibility / 1000 : 10,
    weather_condition: condition,
    weather_description: description,
    weather_icon: `https://openweathermap.org/img/wn/${icon}@2x.png`,
    performance_impact: impact.level,
    impact_notes: impact.notes,
    pace_adjustment_pct: impact.paceAdjustment,
    hydration_multiplier: impact.hydrationMultiplier,
  });
}

interface WeatherImpact {
  level: "positive" | "neutral" | "negative";
  notes: string;
  paceAdjustment: number; // % increase (positive = slower)
  hydrationMultiplier: number; // multiply target hydration by this
}

function computeImpact(temp: number, humidity: number, wind: number, condition: string): WeatherImpact {
  let paceAdjustment = 0;
  let hydrationMultiplier = 1.0;
  const reasons: string[] = [];

  // Temperature impact
  if (temp >= 10 && temp <= 15) {
    reasons.push("Température idéale");
  } else if (temp > 25) {
    const penalty = Math.min(15, (temp - 25) * 1.5);
    paceAdjustment += penalty;
    hydrationMultiplier += (temp - 25) * 0.05;
    reasons.push(`Chaleur +${temp.toFixed(0)}°C : allure +${penalty.toFixed(0)}% plus lente`);
  } else if (temp < 5) {
    paceAdjustment += 3;
    reasons.push("Froid : muscles moins réactifs, +3% sur l'allure");
  }

  // Humidity impact (above 70% at high temp is bad)
  if (humidity > 70 && temp > 20) {
    paceAdjustment += 5;
    hydrationMultiplier += 0.2;
    reasons.push(`Humidité élevée (${humidity}%) : refroidissement difficile`);
  }

  // Wind impact
  if (wind > 30) {
    paceAdjustment += Math.min(8, (wind - 30) * 0.3);
    reasons.push(`Vent fort (${wind.toFixed(0)} km/h)`);
  }

  // Adverse conditions
  if (["Rain", "Drizzle", "Thunderstorm", "Snow"].includes(condition)) {
    paceAdjustment += 5;
    reasons.push(`Précipitations : terrain glissant`);
  }

  const level: WeatherImpact["level"] =
    paceAdjustment > 8 ? "negative" : paceAdjustment > 3 ? "neutral" : "positive";

  return {
    level,
    notes: reasons.join(" | ") || "Conditions optimales",
    paceAdjustment: Math.round(paceAdjustment * 10) / 10,
    hydrationMultiplier: Math.round(hydrationMultiplier * 100) / 100,
  };
}
