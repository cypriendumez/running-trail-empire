export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RacesHub } from "@/components/races/RacesHub";
import { normLang } from "@/lib/i18n/translations";
import { urlsSignalees, ETAT_VIDE, type EtatLiens } from "@/lib/races/liens";
import type { PpsStatus } from "@/lib/pps/status";
import { jourFrance } from "@/lib/races/jourFrance";

export const metadata = { title: "Courses France" };

// ── i18n local (5 langues) — bannière serveur « mes courses à venir ». ──
// Libellé de repli quand une course planifiée n'a pas de nom — le reste de ce tableau
// servait au bandeau « Mes courses à venir », retiré : une course planifiée appartient
// au calendrier, pas en tête du catalogue.
const NOM_PAR_DEFAUT: Record<string, string> = {
  fr: "Course", en: "Race", de: "Rennen", es: "Carrera", pt: "Corrida",
};

// Colonnes LÉGÈRES envoyées en masse (cartes de liste + marqueurs carte) — on exclut
// volontairement les champs lourds (description, time_limits, terrain, registration_url,
// organization) qui ne servent QUE sur la course sélectionnée : ils sont chargés à la
// demande via /api/races/detail au clic. Payload ~5 Mo → ~2 Mo pour 17k courses.
const RACE_COLS = "id,name,type,region,department,city,date,distance_km,elevation_gain_m,difficulty,latitude,longitude,is_itra_certified,itra_points";

export default async function RacesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  // ⚠️ LE JOUR EN FRANCE, PAS EN UTC NI CELUI DU SERVEUR. Constaté le 02/09/2026 à
  //    00 h 49 heure de Paris : il était encore le 1er septembre en UTC, et le catalogue
  //    proposait des courses déjà courues. Le serveur, lui, tourne à Washington — s'y
  //    fier reculerait de six heures de plus. Voir `lib/races/jourFrance`.
  const today = jourFrance();
  // Affichage INSTANTANÉ : on ne charge côté serveur que les ~90 premières courses
  // + le nombre total. Le catalogue complet (~16,5k) est récupéré ensuite côté client
  // via /api/races/list (caché au CDN Vercel). Avant : 17 requêtes paginées + ~5,5 Mo
  // sérialisés dans la page à CHAQUE visite = lenteur.
  const admin = createAdminClient();
  // ── LIENS D'INSCRIPTION CONFIRMÉS MORTS ────────────────────────────────────────
  //  Le catalogue est repris de deux agrégateurs : une fiche peut pointer vers une page
  //  disparue sans que rien ne le signale. Un contrôle en tâche de fond en vérifie une
  //  tranche trois fois par jour ; on ne descend ici QUE les URL confirmées (deux 404
  //  d'affilée), c'est-à-dire une poignée — pas l'état complet du balayage.
  const { data: etatLiens } = await admin.from("notifications").select("data")
    .eq("type", "races_liens").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const liensMorts = urlsSignalees({ ...ETAT_VIDE, ...((etatLiens?.data ?? {}) as Partial<EtatLiens>) });

  const [{ data: initialRaces }, { count: totalCount }] = await Promise.all([
    admin.from("races").select(RACE_COLS).gte("date", today).order("date", { ascending: true }).limit(90),
    admin.from("races").select("id", { count: "estimated", head: true }).gte("date", today),
  ]);

  // Courses planifiées par l'athlète (depuis le calendrier) — affichées en haut.
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  let planned: { id: string; name: string; location: string; distanceKm: number | null; date: string }[] = [];
  let units: "metric" | "imperial" = "metric";
  let lang = "fr";
  // État du PPS : c'est sur CETTE page qu'on s'inscrit, donc là qu'il doit se rappeler.
  let pps: PpsStatus | null = null;
  let favoris: string[] = [];
  if (user) {
    const [{ data }, { data: settingsRow }, { data: profileRow }, { data: ppsRow }, { data: favLignes }] = await Promise.all([
      sb.from("notifications").select("id, title, data").eq("user_id", user.id).eq("type", "planned_race").order("created_at", { ascending: false }).limit(50),
      sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle(),
      sb.from("profiles").select("preferred_language").eq("id", user.id).single(),
      sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "pps_status").maybeSingle(),
      // Favoris : chargés AVEC le reste, pour que le cœur soit déjà rempli au premier
      // rendu. Un cœur qui se remplit une seconde après l'affichage donne l'impression
      // d'un clic qui n'a pas pris, et on reclique — ce qui l'enlève.
      sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_favori").limit(2000),
    ]);
    pps = (ppsRow?.data ?? null) as PpsStatus | null;
    favoris = (favLignes ?? [])
      .map((r) => String((r.data as { raceId?: string } | null)?.raceId ?? ""))
      .filter(Boolean);
    units = String(((settingsRow?.data ?? {}) as Record<string, unknown>).unitSystem ?? "metric") === "imperial" ? "imperial" : "metric";
    lang = normLang(profileRow?.preferred_language ?? "fr");
    planned = (data ?? []).map((r) => {
      const d = (r.data ?? {}) as { date?: string; name?: string; location?: string; distanceKm?: number | null };
      return { id: String(r.id), name: d.name || (r.title as string) || (NOM_PAR_DEFAUT[lang] ?? NOM_PAR_DEFAUT.fr), location: d.location || "", distanceKm: d.distanceKm ?? null, date: String(d.date ?? "").slice(0, 10) };
    }).filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  }
  return (
    <>
      {/* ⚠️ LE BANDEAU « MES COURSES À VENIR » A ÉTÉ RETIRÉ D'ICI. Une course planifiée
          appartient au CALENDRIER — c'est là qu'on va voir ce qu'on a prévu, et le
          calendrier l'affiche déjà avec le plan qui l'entoure. La répéter en tête du
          catalogue poussait la recherche de courses, seule raison de venir sur cette
          page, sous la ligne de flottaison. */}
      <RacesHub favorisInitiaux={favoris} liensMorts={liensMorts} races={(initialRaces ?? []) as never[]} totalCount={totalCount ?? 0} units={units} planned={planned} initialSearch={q ?? ""} pps={pps} />
    </>
  );
}
