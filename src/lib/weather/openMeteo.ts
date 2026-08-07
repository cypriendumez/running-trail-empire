// ─────────────────────────────────────────────────────────────────────────────
//  MÉTÉO RÉELLE — Open-Meteo (gratuit, sans clé API, sans quota pratique)
//
//  Pourquoi ne pas se fier à la température de la montre : sur une Garmin, le
//  capteur est au CONTACT DU POIGNET. Il mesure donc un mélange d'air ambiant et
//  de chaleur corporelle. Constaté le 7 août 2026 sur des données réelles : une
//  sortie de 18h30 rapportée plus chaude qu'une randonnée de 11h33 le même jour,
//  et jusqu'à 3 °C d'écart avec la température relevée à la même heure et au même
//  endroit. Prescrire des allures là-dessus, c'est se tromper de plusieurs degrés.
//
//  On garde la valeur de la montre en dernier recours, jamais en priorité.
// ─────────────────────────────────────────────────────────────────────────────

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

/**
 * Altitude du lieu d'entraînement, renvoyée gratuitement par Open-Meteo avec les
 * prévisions. Elle change réellement la donne : au-delà de ~500 m, la performance
 * aérobie se dégrade d'environ 6 % par 1 000 m de plus. Sans elle, le coach juge des
 * allures d'altitude à l'aune du niveau de la mer et conclut à une perte de forme là
 * où l'athlète est simplement en montagne.
 */
export type DayWeather = {
  date: string;        // AAAA-MM-JJ
  tempMax: number;     // °C
  tempMin: number;
  /** Température ressentie max — c'est elle qui compte pour l'effort, pas l'air sec. */
  feelsMax: number | null;
  humidity: number | null;
  precipMm: number | null;
  /** Vent maximal du jour (km/h). Un vent de face coûte souvent plus qu'une forte chaleur. */
  windMaxKmh: number | null;
};

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);

/** Prévisions jour par jour pour les 7 prochains jours à une position donnée. */
export type WeekForecast = { days: DayWeather[]; elevationM: number | null };

/** Perte de performance aérobie liée à l'altitude, en %. Nulle jusqu'à ~500 m, puis
 *  ~6 % par 1 000 m — ordre de grandeur consensuel pour un athlète non acclimaté. */
export function altitudeLossPct(elevationM: number | null): number {
  if (elevationM == null || elevationM <= 500) return 0;
  return Math.round(((elevationM - 500) / 1000) * 6 * 10) / 10;
}

/** Prévisions à 7 jours ET altitude du lieu — Open-Meteo renvoie les deux dans la
 *  MÊME réponse (`elevation`). Une seule requête suffit donc pour les obtenir. */
export async function forecastWithElevation(lat: number, lon: number): Promise<WeekForecast> {
  const url = `${FORECAST}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`
    + `&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,wind_speed_10m_max`
    + `&hourly=relative_humidity_2m&forecast_days=7&timezone=auto`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { days: [], elevationM: null };
    const j = await r.json() as {
      elevation?: number;
      daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[];
                apparent_temperature_max?: number[]; precipitation_sum?: number[]; wind_speed_10m_max?: number[] };
      hourly?: { time?: string[]; relative_humidity_2m?: number[] };
    };
    const d = j.daily;
    if (!d?.time?.length) return { days: [], elevationM: num(j.elevation) };
    // Humidité : moyenne des heures de la journée (l'API ne la donne qu'en horaire).
    const humByDay = new Map<string, number[]>();
    (j.hourly?.time ?? []).forEach((t, i) => {
      const day = t.slice(0, 10);
      const h = num(j.hourly?.relative_humidity_2m?.[i]);
      if (h != null) humByDay.set(day, [...(humByDay.get(day) ?? []), h]);
    });
    const days = d.time.map((date, i) => {
      const hs = humByDay.get(date) ?? [];
      return {
        date,
        tempMax: num(d.temperature_2m_max?.[i]) ?? 0,
        tempMin: num(d.temperature_2m_min?.[i]) ?? 0,
        feelsMax: num(d.apparent_temperature_max?.[i]),
        humidity: hs.length ? Math.round(hs.reduce((a, b) => a + b, 0) / hs.length) : null,
        precipMm: num(d.precipitation_sum?.[i]),
        windMaxKmh: num(d.wind_speed_10m_max?.[i]),
      };
    });
    return { days, elevationM: num(j.elevation) };
  } catch { return { days: [], elevationM: null }; }
}

/** Prévisions seules — conservé pour les appelants qui n'ont pas besoin de l'altitude. */
export async function forecastWeek(lat: number, lon: number): Promise<DayWeather[]> {
  return (await forecastWithElevation(lat, lon)).days;
}

/** Température réellement relevée à une position, un jour et une heure donnés (passé). */
export async function pastTempAt(lat: number, lon: number, dateISO: string, hour: number): Promise<number | null> {
  const url = `${ARCHIVE}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`
    + `&start_date=${dateISO}&end_date=${dateISO}&hourly=temperature_2m&timezone=auto`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json() as { hourly?: { time?: string[]; temperature_2m?: number[] } };
    const times = j.hourly?.time ?? [];
    const idx = times.findIndex((t) => Number(t.slice(11, 13)) === hour);
    return idx >= 0 ? num(j.hourly?.temperature_2m?.[idx]) : null;
  } catch { return null; }
}

/**
 * Consigne d'entraînement pour une température donnée.
 * Seuils issus de la littérature sur la performance en chaleur : la dégradation
 * devient nette au-delà de 20 °C et s'accélère au-delà de 25 °C.
 */
export function heatAdvice(tempC: number, humidity: number | null): { penaltySecPerKm: number; note: string } {
  const humid = humidity != null && humidity >= 70;
  if (tempC >= 30) return {
    penaltySecPerKm: humid ? 60 : 45,
    note: `🥵 ${Math.round(tempC)} °C${humid ? " et humide" : ""} : renonce au fractionné, déplace la séance tôt le matin ou tard le soir. Compte ${humid ? "1 min" : "45 s"}/km de plus à effort égal — juge à la FC, jamais au chrono. Électrolytes obligatoires au-delà de 45 min.`,
  };
  if (tempC >= 25) return {
    penaltySecPerKm: humid ? 40 : 25,
    note: `🌡️ ${Math.round(tempC)} °C${humid ? " et humide" : ""} : compte ~${humid ? 40 : 25} s/km de plus à effort égal. Ne cherche pas tes allures habituelles, tu te grillerais pour rien.`,
  };
  if (tempC >= 20) return {
    penaltySecPerKm: 10,
    note: `${Math.round(tempC)} °C : légère dégradation, compte ~10 s/km. Hydrate-toi avant de partir.`,
  };
  if (tempC >= 5) return { penaltySecPerKm: 0, note: `${Math.round(tempC)} °C : conditions idéales, c'est le moment des séances chronométrées.` };
  if (tempC >= 0) return { penaltySecPerKm: 0, note: `🧥 ${Math.round(tempC)} °C : échauffement rallongé et couvert.` };
  return {
    penaltySecPerKm: 0,
    note: `🥶 ${Math.round(tempC)} °C : échauffement de 20 min minimum, pas de fractionné court à froid (risque musculaire). Attention aux voies respiratoires par temps sec et glacial.`,
  };
}

/**
 * Consigne d'entraînement pour le VENT.
 *
 * Facteur systématiquement sous-estimé : à 25 km/h de face, le surcoût énergétique
 * dépasse celui d'une journée à 27 °C. Sur un aller-retour, le retour vent dans le dos
 * ne rend JAMAIS ce que l'aller a coûté — la pénalité est donc nette, pas nulle.
 * On raisonne sur environ la moitié du parcours face au vent, d'où le coefficient.
 */
export function windAdvice(windKmh: number | null): { penaltySecPerKm: number; note: string } {
  if (windKmh == null || windKmh < 20) return { penaltySecPerKm: 0, note: "" };
  if (windKmh >= 45) return {
    penaltySecPerKm: 25,
    note: `💨 Vent de ${Math.round(windKmh)} km/h : renonce à toute séance chronométrée, tu ne tiendras aucune allure de référence. Si tu sors, fais l'aller face au vent et le retour dans le dos, et juge-toi à la FC. En terrain découvert, prudence sur les rafales.`,
  };
  if (windKmh >= 35) return {
    penaltySecPerKm: 18,
    note: `💨 Vent de ${Math.round(windKmh)} km/h : compte ~18 s/km de plus face au vent. Une séance de qualité devient très difficile à piloter à l'allure — bascule sur la FC, ou déplace-la.`,
  };
  return {
    penaltySecPerKm: 10,
    note: `💨 Vent de ${Math.round(windKmh)} km/h : ~10 s/km de plus dans les portions face au vent. Le retour dans le dos ne compense pas l'aller, n'en attends rien.`,
  };
}

/** Températures maximales quotidiennes passées à une position — UN seul appel pour
 *  toute la période. Sert à mesurer l'exposition réelle à la chaleur. */
export async function archiveDailyMax(lat: number, lon: number, days: number): Promise<Map<string, number>> {
  const end = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const start = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const url = `${ARCHIVE}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`
    + `&start_date=${start}&end_date=${end}&daily=temperature_2m_max&timezone=auto`;
  const out = new Map<string, number>();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return out;
    const j = await r.json() as { daily?: { time?: string[]; temperature_2m_max?: number[] } };
    (j.daily?.time ?? []).forEach((d, i) => {
      const t = num(j.daily?.temperature_2m_max?.[i]);
      if (t != null) out.set(d, t);
    });
    return out;
  } catch { return out; }
}

/**
 * ACCLIMATATION À LA CHALEUR.
 *
 * L'adaptation (expansion du volume plasmatique, sudation plus précoce et plus diluée)
 * s'installe en 10 à 14 jours d'exposition répétée et récupère l'essentiel — mais pas
 * la totalité — de la performance perdue. Appliquer la même pénalité au premier et au
 * quinzième jour de canicule fait donc courir trop lentement un athlète déjà adapté.
 *
 * On compte les JOURS D'ENTRAÎNEMENT réellement passés dans la chaleur, pas les jours
 * calendaires : rester au frais deux semaines pendant une canicule n'acclimate personne.
 */
export function heatAcclimation(hotTrainingDays: number): { factor: number; label: string } {
  if (hotTrainingDays >= 12) return { factor: 0.55, label: "bien acclimaté" };
  if (hotTrainingDays >= 8) return { factor: 0.7, label: "acclimatation avancée" };
  if (hotTrainingDays >= 4) return { factor: 0.85, label: "acclimatation en cours" };
  return { factor: 1, label: "non acclimaté" };
}
