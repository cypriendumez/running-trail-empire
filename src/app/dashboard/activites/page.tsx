export const dynamic = "force-dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PerfTabs } from "@/components/segments/PerfTabs";
import { FeedCard, type LigneFil } from "@/components/activity/FeedCard";
import { planCarte, urlTuile, tailleTuileDe, attributionCarte } from "@/lib/activities/tuiles";
import { cleanActivityName } from "@/lib/utils/activityName";
import { colonnesEditionPresentes, COLONNES_EDITION } from "@/lib/activities/colonnes";
import { nomAffiche } from "@/lib/activities/renommage";
import { asSport } from "@/lib/intervals/sport";
import { SPORT_LABEL_T } from "@/lib/intervals/sportI18n";
import { estUnePanne } from "@/lib/dashboard/lectures";
import { formatDateCivile } from "@/lib/time/fuseau";
import { getAccountLang } from "@/lib/i18n/serverLang";
import { T, fill } from "@/lib/i18n/translations";
import { fmtNombre, SANS_VALEUR } from "@/lib/i18n/nombres";

export const metadata = { title: "Activités" };

/** Une page de fil. Chaque trace pesant ~40 Ko côté serveur, on n'en charge pas 50. */
const PAR_PAGE = 15;

// Carte pleine largeur. Ces dimensions sont un REPÈRE INTERNE, pas des pixels d'écran :
// le SVG les met à l'échelle du cadre réel. Le parcours peut donc occuper presque tout
// l'espace — plus besoin de le confiner dans une bande centrale pour protéger le mobile.
// Rapport 38/15, repris tel quel dans la classe `aspect-[38/15]` du cadre.
const LARGEUR = 760, HAUTEUR = 300;
const MARGE_X = 46, MARGE_Y = 30;
// ⚠️ Clé PUBLIQUE par conception (les tuiles sont demandées par le navigateur), et
// c'est la SEULE variable de carte lisible ici : sans elle on retombe sur les tuiles
// OpenStreetMap, qui font 256 px et non 512 — d'où `tailleTuileDe`, sans quoi toute
// la mosaïque serait décalée.
const CLE_CARTE = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
const TAILLE_TUILE = tailleTuileDe(CLE_CARTE);

const duree = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
};
const allure = (sec: number, km: number, lang: string) => {
  const p = sec / km, m = Math.floor(p / 60), s = Math.round(p % 60);
  const [mm, ss] = s === 60 ? [m + 1, 0] : [m, s];
  return `${mm}:${String(ss).padStart(2, "0")}${lang === "fr" ? " /km" : "/km"}`;
};
const nombre = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

type Brut = {
  id: string | number; date: string; title: string | null; type: string | null; sport: string | null;
  distance_km: number | null; duration_seconds: number | null; elevation_gain_m: number | null;
  /** Nom choisi par l'athlète. Absent tant que la colonne n'existe pas. */
  title_custom?: string | null;
};

export default async function ActivitesPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const lang = await getAccountLang(sb, user.id);
  const d = T[lang];

  const page = Math.max(0, Math.min(200, Number((await searchParams).p ?? 0) || 0));
  // Le TOTAL est compté à part. La page annonçait « 15 sorties enregistrées » à un
  // athlète qui en a 332 : la phrase décrivait la page, pas l'historique, et laissait
  // croire que la synchro avait perdu des séances.
  const { count: total } = await sb.from("workouts")
    .select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const edition = await colonnesEditionPresentes(sb);
  const champs = "id, date, title, type, sport, distance_km, duration_seconds, elevation_gain_m"
    + (edition ? `, ${COLONNES_EDITION.titre}` : "");
  const lecture = await sb.from("workouts")
    .select(champs)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .range(0, (page + 1) * PAR_PAGE);   // une ligne de plus : elle dit s'il en reste

  // Une lecture EN PANNE ne doit jamais se lire « tu n'as aucune sortie » : le premier
  // message ferait chercher un bug d'import là où c'est le serveur qui n'a pas répondu.
  if (estUnePanne(lecture)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <PerfTabs />
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-sm text-amber-900">{d["feed.panne"]}</p>
        </div>
      </div>
    );
  }

  const toutes = (lecture.data ?? []) as unknown as Brut[];
  const reste = toutes.length > (page + 1) * PAR_PAGE;
  const seances = toutes.slice(0, (page + 1) * PAR_PAGE);

  // Les traces en UNE requête. Sans le `.in(...)`, c'était un aller-retour par carte —
  // le défaut exact qui avait mis la carte de chaleur à 12 s.
  const traces = new Map<string, { lat: number; lon: number }[]>();
  if (seances.length) {
    const { data: tr } = await sb.from("activity_tracks")
      .select("workout_id, points")
      .in("workout_id", seances.map((s) => String(s.id)));
    for (const t of (tr ?? []) as { workout_id: string; points: number[][] | null }[]) {
      const pts = (t.points ?? []).map(([lat, lon]) => ({ lat, lon }));
      if (pts.length) traces.set(String(t.workout_id), pts);
    }
  }

  const lignes: LigneFil[] = seances.map((s) => {
    const km = nombre(s.distance_km), sec = nombre(s.duration_seconds);
    const dplus = nombre(s.elevation_gain_m);
    const pts = traces.get(String(s.id)) ?? [];
    // Un point sur N : à 176 px de large, la précision au mètre ne se voit pas, et
    // chaque point retiré est autant de HTML en moins sur une page qui en compte 15.
    const allege = pts.length > 500 ? pts.filter((_, i) => i % Math.ceil(pts.length / 500) === 0) : pts;
    const plan = planCarte(allege, { largeur: LARGEUR, hauteur: HAUTEUR, tailleTuile: TAILLE_TUILE,
      margeX: MARGE_X, margeY: MARGE_Y });
    const chiffres = [
      { label: d["feed.distance"], valeur: km != null ? `${fmtNombre(km, lang, 1)} km` : SANS_VALEUR },
      { label: d["feed.pace"], valeur: km != null && sec != null ? allure(sec, km, lang) : SANS_VALEUR },
      { label: d["feed.time"], valeur: sec != null ? duree(sec) : SANS_VALEUR },
    ];
    // Le dénivelé n'a sa colonne que s'il a été mesuré. La FC reste sur la page de
    // détail : quatre chiffres se lisent d'un coup d'œil, cinq deviennent un tableau.
    if (dplus != null) chiffres.push({ label: d["feed.elev"], valeur: `${Math.round(dplus)} m` });
    return {
      href: `/dashboard/activite?date=${String(s.date).slice(0, 10)}&dist=${s.distance_km ?? ""}&title=${encodeURIComponent(s.title ?? "")}`,
      sport: asSport(s.sport ?? s.type),
      sportLisible: SPORT_LABEL_T[lang][asSport(s.sport ?? s.type)],
      // Le nom choisi par l'athlète l'emporte sur celui de la montre.
      titre: nomAffiche(s.title_custom, cleanActivityName(s.title), s.type || s.sport || d["feed.title"]),
      dateLisible: formatDateCivile(s.date, lang, { weekday: "long", day: "numeric", month: "long" }),
      carte: plan ? { plan, urls: plan.tuiles.map((t) => urlTuile(t, CLE_CARTE)) } : null,
      chiffres,
    };
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <PerfTabs />
      <header className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">{d["feed.title"]}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {lignes.length
            ? (total != null && total > lignes.length
                ? fill(d["feed.subTotal"], { n: lignes.length, t: total })
                : fill(d["feed.sub"], { n: lignes.length }))
            : d["feed.emptySub"]}
        </p>
      </header>

      {lignes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="font-semibold text-zinc-900">{d["feed.empty"]}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">{d["feed.emptySub"]}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {lignes.map((l) => <FeedCard key={l.href + l.dateLisible} ligne={l} sansTrace={d["feed.noTrace"]} />)}
          </div>
          {/* MENTION OBLIGATOIRE. Les vignettes ne sont pas des cartes Leaflet : elles
              n'ont pas le bandeau d'attribution intégré, et l'oublier reviendrait à
              afficher des tuiles OpenStreetMap sans les créditer. Une seule mention
              pour toute la page, comme le veut l'usage pour un lot de vignettes. */}
          <p className="mt-4 text-right text-[11px] text-zinc-500">{attributionCarte(CLE_CARTE)}</p>
          {reste && (
            <div className="mt-6 text-center">
              <Link href={`/dashboard/activites?p=${page + 1}`}
                className="inline-block rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50">
                {/* Combien il en reste : sans ce nombre, l'athlète ne sait pas s'il
                    lui faut un clic ou vingt, et croit que l'historique s'arrête là. */}
                {total != null && total > lignes.length
                  ? fill(d["feed.moreN"], { n: total - lignes.length })
                  : d["feed.more"]}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
