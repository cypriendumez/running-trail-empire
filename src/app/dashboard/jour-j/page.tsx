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
import { journaliserEchec } from "@/lib/journal/echecServeur";
import { fcMaxConnue, picFcObserve, seuilMesure } from "@/lib/coach/fcCible";
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
  // ⚠️ Les colonnes de FC du profil sont lues À PART (12/11/2026) : ajoutées à la lecture qui porte
  // la porte d'accès, une panne aurait fermé la page entière. Leur erreur est lue plus bas.
  const [objRes, seancesRes, baseRes, fcProfilRes] = await Promise.all([
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    sb.from("workouts").select(COLS).eq("user_id", user.id).gte("date", decaleJour(jour, -182)).order("date", { ascending: false }),
    sb.from("performance_baselines").select("vma_kmh,max_hr,lt_hr,tested_at").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("profiles").select("max_hr, garmin_metrics").eq("id", user.id).maybeSingle(),
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
  // ⚠️ LA MÊME FC MAX QUE LE COACH (`fcMaxConnue`, lib/coach/fcCible, 12/11/2026) : la plus haute
  // entre la déclarée (test, profil, sinon montre) et le pic réellement atteint (> 150), sinon le
  // seuil mesuré ÷ 0,92, sinon inconnue — jamais l'âge. C'était « test, sinon pic > 120 » : un
  // coureur lisait une pente ici et une autre (ou aucune) côté coach.
  // Une panne de lecture n'est pas « FC max inconnue » : elle est journalisée, et la pente n'est
  // alors pas calculée (la page dit « progression supposée », ce qui reste vrai).
  const ePanneFc = baseRes.error ?? fcProfilRes.error;
  if (ePanneFc) await journaliserEchec(null, { source: "jour-j", message: `FC max illisible : ${ePanneFc.message}`, userId: user.id });
  const base = baseRes.data as { max_hr?: number | null; lt_hr?: number | null } | null;
  const fcProfil = fcProfilRes.data as { max_hr?: number | null; garmin_metrics?: Record<string, unknown> | null } | null;
  const gm = fcProfil?.garmin_metrics ?? null;
  const fcMax = ePanneFc ? null : fcMaxConnue({
    declaree: Number(base?.max_hr) || Number(fcProfil?.max_hr) || null, montre: gm?.maxHR,
    observee: picFcObserve(seances, jour), seuil: seuilMesure(base?.lt_hr, gm?.lthr),
  }).max;
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
    ameliorationAttendue: ameliorationAttendue(Math.max(0, joursRestants) / 7, tendance),
    // Sans pente mesurée, l'amélioration est SUPPOSÉE : la page le dit (12/11/2026).
    progressionMesuree: tendance != null,
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
