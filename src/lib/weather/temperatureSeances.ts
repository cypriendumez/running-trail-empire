// ─────────────────────────────────────────────────────────────────────────────
//  LA VRAIE TEMPÉRATURE DE L'AIR D'UNE SÉANCE — jamais celle de la montre.
//
//  ⚠️ LE CAPTEUR DE LA MONTRE MENT (Cyprien, 07/11/2026 : « ne prends surtout pas la
//  température Garmin ou Coros, elle est au moins 12 degrés au-dessus ; prends la vraie
//  météo de la personne à l'endroit où elle court »). Il est au contact du poignet : il
//  mesure un mélange d'air et de chaleur du corps. Relevé sur son compte, à Lille et Rouen :
//  15-16 °C de moyenne en décembre et janvier, 11 à 21 °C le matin de séances d'hiver.
//  intervals.icu n'ajoute aucune météo (`has_weather: false`). Cette valeur alimentait la
//  correction de chaleur de la VMA et de l'allure facile, l'acclimatation, l'analyse et le
//  bilan de séance : elle n'est plus enregistrée.
//
//  On demande à Open-Meteo la température à 2 m, à l'heure du MILIEU de la séance, là où
//  l'athlète court. Récent (≤ 6 jours) : l'API de prévision, qui rend aussi les jours passés ;
//  plus ancien : l'archive (réanalyse ERA5, quelques jours de retard). Une réponse ratée ne
//  remplit rien : une température absente vaut mieux qu'une température fausse.
// ─────────────────────────────────────────────────────────────────────────────

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

export type SeanceAMesurer = {
  /** Identifiant libre, rendu tel quel dans la réponse. */
  cle: string;
  lat: number;
  lon: number;
  /** Heure de départ LOCALE, « AAAA-MM-JJTHH:MM(:SS) » (champ `start_date_local` d'intervals.icu). */
  debutLocal: string;
  dureeSec?: number | null;
};

/** L'heure locale du milieu de la séance, « AAAA-MM-JJTHH:00 » — le format horaire d'Open-Meteo. */
export function heureMilieu(debutLocal: string, dureeSec?: number | null): string | null {
  const m = String(debutLocal ?? "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  // Arithmétique « naïve » sur l'heure locale : on ajoute la demi-durée sans changer de fuseau.
  const t = Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`);
  if (Number.isNaN(t)) return null;
  const demi = Number.isFinite(Number(dureeSec)) && Number(dureeSec) > 0 ? Math.min(Number(dureeSec), 12 * 3600) / 2 : 0;
  return new Date(t + demi * 1000).toISOString().slice(0, 13) + ":00";
}

const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > -60 && v < 60;

async function serieHoraire(url: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return out;
    const j = await r.json() as { hourly?: { time?: string[]; temperature_2m?: (number | null)[] } };
    (j.hourly?.time ?? []).forEach((h, i) => { const v = j.hourly?.temperature_2m?.[i]; if (ok(v)) out.set(h, v); });
  } catch { /* réseau : rien, plutôt qu'une valeur fausse */ }
  return out;
}

/**
 * La température de l'air au milieu de chaque séance (°C, au dixième). Les séances sont
 * regroupées par lieu (0,1° ≈ 10 km) : une requête par lieu et par source, pas une par séance.
 */
export async function temperaturesAir(seances: readonly SeanceAMesurer[], maintenant = Date.now()): Promise<Map<string, number>> {
  const res = new Map<string, number>();
  const recentDepuis = new Date(maintenant - 6 * 86400000).toISOString().slice(0, 10);
  const groupes = new Map<string, { lat: number; lon: number; items: { cle: string; heure: string }[] }>();
  for (const s of seances) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon) || Math.abs(s.lat) > 90 || Math.abs(s.lon) > 180) continue;
    const heure = heureMilieu(s.debutLocal, s.dureeSec);
    if (!heure) continue;
    const k = `${s.lat.toFixed(1)},${s.lon.toFixed(1)}`;
    const g = groupes.get(k) ?? { lat: Number(s.lat.toFixed(1)), lon: Number(s.lon.toFixed(1)), items: [] };
    g.items.push({ cle: s.cle, heure });
    groupes.set(k, g);
  }
  for (const g of groupes.values()) {
    const recents = g.items.filter((x) => x.heure.slice(0, 10) >= recentDepuis);
    const anciens = g.items.filter((x) => x.heure.slice(0, 10) < recentDepuis);
    const lieu = `latitude=${g.lat}&longitude=${g.lon}&hourly=temperature_2m&timezone=auto`;
    const series: Map<string, number>[] = [];
    if (recents.length) series.push(await serieHoraire(`${FORECAST}?${lieu}&past_days=7&forecast_days=1`));
    if (anciens.length) {
      const jours = anciens.map((x) => x.heure.slice(0, 10)).sort();
      series.push(await serieHoraire(`${ARCHIVE}?${lieu}&start_date=${jours[0]}&end_date=${jours[jours.length - 1]}`));
    }
    for (const x of g.items) {
      const v = series.map((s) => s.get(x.heure)).find(ok);
      if (v != null) res.set(x.cle, Math.round(v * 10) / 10);
    }
  }
  return res;
}

type Lecteur = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Là où l'athlète court : le centre de sa dernière trace GPS, sinon la dernière position
 * connue de son profil. `null` si on ne sait pas — et alors aucune température.
 */
export async function positionHabituelle(sb: Lecteur, userId: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const { data, error } = await sb.from("activity_tracks").select("min_lat,max_lat,min_lon,max_lon")
      .eq("user_id", userId).eq("has_gps", true).order("fetched_at", { ascending: false }).limit(1).maybeSingle();
    const t = (error ? null : data) as { min_lat?: unknown; max_lat?: unknown; min_lon?: unknown; max_lon?: unknown } | null;
    const lat = (Number(t?.min_lat) + Number(t?.max_lat)) / 2, lon = (Number(t?.min_lon) + Number(t?.max_lon)) / 2;
    if (t && Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    const { data: p, error: e2 } = await sb.from("profiles").select("last_lat,last_lon").eq("id", userId).maybeSingle();
    const plat = Number((p as { last_lat?: unknown } | null)?.last_lat), plon = Number((p as { last_lon?: unknown } | null)?.last_lon);
    return !e2 && p && Number.isFinite(plat) && Number.isFinite(plon) && (plat !== 0 || plon !== 0) ? { lat: plat, lon: plon } : null;
  } catch {
    return null;
  }
}

/** Une séance en intérieur (tapis, home-trainer, virtuel) n'a pas de température d'air qui compte. */
export const enInterieur = (type: unknown): boolean => /virtual|treadmill|indoor|trainer/i.test(String(type ?? ""));
