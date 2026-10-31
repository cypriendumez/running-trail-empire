export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { normLang } from "@/lib/i18n/translations";
import { accesDe, peut, COLONNES_ACCES } from "@/lib/billing/access";
import { aujourdhui, fuseauOuDefaut } from "@/lib/time/fuseau";
import { decaleJour, ecartJours } from "@/lib/streak/compute";
import { objectifEnCours, estOfficielle } from "@/lib/coach/prochaineCourse";
import { vmaAffichee } from "@/lib/dashboard/vmaAffichee";
import { socleDesSeances } from "@/lib/dashboard/forme";
import { efficaciteParBloc, tendanceEfficacite, ameliorationAttendue } from "@/lib/running/progression";
import { isRun } from "@/lib/intervals/sport";
import { forecastWithElevation } from "@/lib/weather/openMeteo";
import { packJourJ } from "@/lib/coach/jourJ";
import { JOURJ_T } from "@/lib/coach/jourJI18n";
import { PackJourJVue, VerrouJourJ, SansObjectifJourJ } from "@/components/jourJ/PackJourJVue";

/**
 * /dashboard/jour-j — LE PACK JOUR J (Premium), voir `lib/coach/jourJ`.
 *
 * ⚠️ LE VERROU EST ICI, CÔTÉ SERVEUR : une formule qui ne l'ouvre pas reçoit la page qui
 * dit ce qu'il contient et où l'obtenir — jamais le pack calculé.
 *
 * ⚠️ RIEN N'EST INVENTÉ. La course est cherchée dans le catalogue (nom ET date exacts) pour
 * son dénivelé et sa position ; introuvable, on n'en suppose rien. La météo n'existe qu'à
 * sept jours (fenêtre de prévision) ; avant, la page donne les allures par température.
 */
export const metadata: Metadata = { title: "Pack jour J" };

const COLS = "date,type,sport,distance_km,duration_seconds,avg_hr,max_hr,weather_temp_c";

export default async function PageJourJ() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await sb.from("profiles")
    .select(`${COLONNES_ACCES}, preferred_language, weight_kg, garmin_vo2max, pace_curve, last_lat, last_lon`)
    .eq("id", user.id).maybeSingle();
  const p = profil as Record<string, unknown> | null;
  const lang = normLang(String(p?.preferred_language ?? "fr"));
  const t = JOURJ_T[lang];
  if (!peut(accesDe(p as { created_at?: string | null; subscription_tier?: string | null } | null).etat, "jour_j")) return <VerrouJourJ t={t} />;

  const jour = aujourdhui(fuseauOuDefaut(decodeURIComponent((await cookies()).get("pacevo_tz")?.value ?? "")));
  const [objRes, seancesRes, baseRes] = await Promise.all([
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    sb.from("workouts").select(COLS).eq("user_id", user.id).gte("date", decaleJour(jour, -182)).order("date", { ascending: false }),
    sb.from("performance_baselines").select("vma_kmh,max_hr,tested_at").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  type Obj = { race: string; raceDate: string; distanceKm: number; targetSeconds: number; officielle?: boolean };
  const objectif = objectifEnCours(objRes.data?.data as Obj | null, jour);
  if (!objectif || !(Number(objectif.distanceKm) > 0) || !(Number(objectif.targetSeconds) > 0)) return <SansObjectifJourJ t={t} />;

  const seances = (seancesRes.data ?? []) as unknown as { date: string; sport?: string | null; distance_km?: number | null; duration_seconds?: number | null; avg_hr?: number | null; max_hr?: number | null }[];
  // La VMA : le MÊME calcul que la carte du tableau de bord (40 dernières séances).
  const { vma } = vmaAffichee({
    seances: seances.slice(0, 40) as Parameters<typeof vmaAffichee>[0]["seances"],
    baseline: baseRes.data as { vma_kmh?: number | null; tested_at?: string | null } | null,
    profil: p as Parameters<typeof vmaAffichee>[0]["profil"],
  });
  const joursRestants = ecartJours(jour, objectif.raceDate);
  // L'amélioration d'ici la course : la pente MESURÉE de l'athlète, comme le coach.
  const fcObservee = Math.max(0, ...seances.map((s) => Number(s.max_hr) || 0));
  const fcMax = Number((baseRes.data as { max_hr?: number | null } | null)?.max_hr) || (fcObservee > 120 ? fcObservee : null);
  const tendance = tendanceEfficacite(efficaciteParBloc(seances.filter((s) => isRun(s.sport)), fcMax, Date.parse(`${jour}T12:00:00Z`)));

  // La course dans le catalogue — nom ET date exacts, sinon rien n'est supposé.
  const { data: course } = estOfficielle(objectif)
    ? await sb.from("races").select("elevation_gain_m,terrain,type,latitude,longitude").eq("name", objectif.race).eq("date", objectif.raceDate).limit(1).maybeSingle()
    : { data: null };
  const c = course as { elevation_gain_m?: number | null; terrain?: string | null; type?: string | null; latitude?: number | null; longitude?: number | null } | null;

  // La météo du jour J, seulement dans la fenêtre de prévision (7 jours) : au lieu de la course, sinon chez l'athlète.
  const lat = Number(c?.latitude ?? p?.last_lat), lon = Number(c?.longitude ?? p?.last_lon);
  const prevision = joursRestants >= 0 && joursRestants <= 6 && Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)
    ? (await forecastWithElevation(lat, lon)).days.find((d) => d.date === objectif.raceDate) ?? null
    : null;

  const pack = packJourJ({
    objectif: { nom: objectif.race, date: objectif.raceDate, distanceKm: Number(objectif.distanceKm), viseSec: Number(objectif.targetSeconds), officielle: estOfficielle(objectif) },
    joursRestants,
    vma: vma > 0 ? vma : null,
    socle: socleDesSeances(seances as Parameters<typeof socleDesSeances>[0], jour),
    ameliorationMesuree: ameliorationAttendue(Math.max(0, joursRestants) / 7, tendance),
    dplusM: c?.elevation_gain_m != null ? Number(c.elevation_gain_m) : null,
    terrain: c?.terrain ?? c?.type ?? null,
    poidsKg: Number(p?.weight_kg) > 0 ? Number(p?.weight_kg) : null,
    meteo: prevision ? { tempC: prevision.tempMax, humidite: prevision.humidity, ventKmh: prevision.windMaxKmh } : null,
  });

  return (
    <PackJourJVue pack={pack} t={t} lang={lang} nom={objectif.race} date={objectif.raceDate} joursRestants={joursRestants}
      dplusM={c?.elevation_gain_m != null ? Number(c.elevation_gain_m) : null} />
  );
}
