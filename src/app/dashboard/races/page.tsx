export const dynamic = "force-dynamic";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RacesHub } from "@/components/races/RacesHub";
import { fmtDistance } from "@/lib/units";
import { Flag } from "lucide-react";
import { normLang } from "@/lib/i18n/translations";

export const metadata = { title: "Courses France" };

// ── i18n local (5 langues) — bannière serveur « mes courses à venir ». ──
const BL: Record<string, { upcoming: string; planned: string; jourJ: string; race: string }> = {
  fr: { upcoming: "Mes courses à venir", planned: "· planifiées dans ton calendrier", jourJ: "Jour J", race: "Course" },
  en: { upcoming: "My upcoming races", planned: "· planned in your calendar", jourJ: "Race day", race: "Race" },
  de: { upcoming: "Meine kommenden Rennen", planned: "· in deinem Kalender geplant", jourJ: "Renntag", race: "Rennen" },
  es: { upcoming: "Mis próximas carreras", planned: "· planificadas en tu calendario", jourJ: "Día de carrera", race: "Carrera" },
  pt: { upcoming: "As minhas próximas corridas", planned: "· planeadas no teu calendário", jourJ: "Dia da corrida", race: "Corrida" },
};

// Colonnes LÉGÈRES envoyées en masse (cartes de liste + marqueurs carte) — on exclut
// volontairement les champs lourds (description, time_limits, terrain, registration_url,
// organization) qui ne servent QUE sur la course sélectionnée : ils sont chargés à la
// demande via /api/races/detail au clic. Payload ~5 Mo → ~2 Mo pour 17k courses.
const RACE_COLS = "id,name,type,region,department,city,date,distance_km,elevation_gain_m,difficulty,latitude,longitude,is_itra_certified,itra_points";

// Le catalogue des courses est public et change rarement → cache serveur 30 min.
// C'est CE cache qui rend la navigation Dashboard → Courses instantanée (avant :
// 18 requêtes Supabase paginées à CHAQUE visite).
const loadAllRaces = unstable_cache(
  async () => {
    const supabaseAdmin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const allRaces: any[] = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data } = await supabaseAdmin
        .from("races")
        .select(RACE_COLS)
        .gte("date", today)
        .order("date", { ascending: true })
        .range(from, from + PAGE - 1);
      if (!data?.length) break;
      allRaces.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
      if (allRaces.length >= 25000) break;
    }
    return allRaces;
  },
  ["races-catalog"],
  { revalidate: 1800 },
);

export default async function RacesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const allRaces = await loadAllRaces();

  // Courses planifiées par l'athlète (depuis le calendrier) — affichées en haut.
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  let planned: { id: string; name: string; location: string; distanceKm: number | null; date: string }[] = [];
  let units: "metric" | "imperial" = "metric";
  let lang = "fr";
  if (user) {
    const [{ data }, { data: settingsRow }, { data: profileRow }] = await Promise.all([
      sb.from("notifications").select("id, title, data").eq("user_id", user.id).eq("type", "planned_race").order("created_at", { ascending: false }).limit(50),
      sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "user_settings").maybeSingle(),
      sb.from("profiles").select("preferred_language").eq("id", user.id).single(),
    ]);
    units = String(((settingsRow?.data ?? {}) as Record<string, unknown>).unitSystem ?? "metric") === "imperial" ? "imperial" : "metric";
    lang = normLang(profileRow?.preferred_language ?? "fr");
    planned = (data ?? []).map((r) => {
      const d = (r.data ?? {}) as { date?: string; name?: string; location?: string; distanceKm?: number | null };
      return { id: String(r.id), name: d.name || (r.title as string) || (BL[lang] ?? BL.fr).race, location: d.location || "", distanceKm: d.distanceKm ?? null, date: String(d.date ?? "").slice(0, 10) };
    }).filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  }
  const bl = BL[lang] ?? BL.fr;
  // Bandeau : affichage dédoublonné (un double-clic accidentel crée 2 notifications
  // identiques). La liste COMPLÈTE part au composant → « Annuler » supprime toutes les copies.
  const seenPlanned = new Set<string>();
  const plannedDisplay = planned.filter((p) => {
    const k = `${p.name.toLowerCase().trim()}|${p.date}|${p.distanceKm ?? ""}`;
    if (seenPlanned.has(k)) return false;
    seenPlanned.add(k);
    return true;
  });

  return (
    <>
      {plannedDisplay.length > 0 && (
        <div className="mx-auto max-w-5xl px-4 pt-6">
          <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 font-bold text-amber-900"><Flag className="h-5 w-5 text-amber-600" /> {bl.upcoming} <span className="text-xs font-normal text-amber-700/70">{bl.planned}</span></div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {plannedDisplay.map((p, i) => {
                const days = Math.ceil((new Date(p.date).getTime() - Date.now()) / 86400000);
                return (
                  <div key={i} className="rounded-2xl border border-amber-100 bg-white p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-zinc-900">{p.name}</span>
                      <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{days <= 0 ? bl.jourJ : `J-${days}`}</span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 first-letter:uppercase">
                      {new Date(p.date).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "long" })}
                      {p.location ? ` · ${p.location}` : ""}{p.distanceKm != null ? ` · ${fmtDistance(p.distanceKm, units)}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Payload initial réduit (~90 courses) pour un affichage INSTANTANÉ ; RacesHub
          charge ensuite le catalogue complet en arrière-plan via /api/races/list (caché
          au CDN). Avant : ~2 Mo de payload force-dynamic à chaque visite = lenteur. */}
      <RacesHub races={allRaces.slice(0, 90)} totalCount={allRaces.length} units={units} planned={planned} initialSearch={q ?? ""} />
    </>
  );
}
