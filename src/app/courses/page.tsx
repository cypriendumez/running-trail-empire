import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { texteCourses } from "./coursesI18n";
import { jourFrance } from "@/lib/races/jourFrance";
import { DATE_INCONNUE, slugCourse, dateEnClair, type CoursePublique } from "@/lib/races/publique";

export const revalidate = 3600;

const PAR_PAGE = 60;
const CHAMPS = "id,name,city,department,region,date,distance_km,elevation_gain_m,type,terrain,registration_url,latitude,longitude,organization,description,is_itra_certified,itra_points";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ region?: string }> }): Promise<Metadata> {
  const region = (await searchParams).region?.trim();
  const lang = await getPublicLang();
  const titre = region
    ? texteCourses(lang, "index.titreRegion", { region })
    : texteCourses(lang, "index.titre");
  return {
    title: titre,
    description: region
      ? texteCourses(lang, "index.metaRegion", { region })
      : texteCourses(lang, "index.meta"),
    alternates: { canonical: region ? `/courses?region=${encodeURIComponent(region)}` : "/courses" },
  };
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const region = (await searchParams).region?.trim();
  const lang = await getPublicLang();
  const t = (k: string, p?: Record<string, string | number>) => texteCourses(lang, k, p);
  const sb = createAdminClient();
  const auj = jourFrance();

  // ⚠️ MÊME FILTRE QUE LES PAGES DE DÉTAIL : date réelle (« 2099 » signifie « inconnue »),
  // à venir, et un lien d'inscription. Une liste qui promettrait des pages absentes
  // enverrait les moteurs — et les coureurs — sur des 404.
  let q = sb.from("races").select(CHAMPS)
    .gte("date", auj).lt("date", DATE_INCONNUE)
    .not("registration_url", "is", null)
    .order("date", { ascending: true }).limit(PAR_PAGE);
  if (region) q = q.eq("region", region);
  const { data } = await q;
  const courses = (data ?? []) as CoursePublique[];

  // Les régions servent de maillage interne : sans liens, une page profonde n'est
  // jamais atteinte par un moteur, même déclarée au sitemap.
  const { data: regionsBrutes } = await sb.from("races").select("region")
    .gte("date", auj).lt("date", DATE_INCONNUE).not("region", "is", null).limit(1000);
  const regions = [...new Set((regionsBrutes ?? []).map((r) => String(r.region)).filter(Boolean))].sort();

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
        {region ? t("index.titreRegion", { region }) : t("index.titre")}
      </h1>
      <p className="mt-2 text-zinc-600">
        {t("index.sous")}
      </p>

      {regions.length > 0 && (
        <nav className="mt-6 flex flex-wrap gap-2">
          <Link href="/courses"
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${!region ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
            {t("index.toutes")}
          </Link>
          {regions.map((r) => (
            <Link key={r} href={`/courses?region=${encodeURIComponent(r)}`}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium ${region === r ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
              {r}
            </Link>
          ))}
        </nav>
      )}

      {courses.length === 0 ? (
        // ⚠️ ON DIT QU'IL N'Y A RIEN. Une page vide sans un mot laisse croire à une panne.
        <p className="mt-10 text-zinc-500">{t("index.vide")}</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
          {courses.map((c) => {
            const km = Number(c.distance_km);
            const dplus = Number(c.elevation_gain_m);
            return (
              <li key={c.id}>
                <Link href={`/courses/${slugCourse(c)}`} className="flex items-baseline gap-4 px-5 py-3.5 hover:bg-zinc-50">
                  <span className="w-32 flex-shrink-0 text-sm text-zinc-500">{dateEnClair(String(c.date))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-zinc-900">{c.name}</span>
                    <span className="block truncate text-sm text-zinc-500">
                      {[c.city, Number.isFinite(km) && km > 0 ? `${Math.round(km)} km` : "",
                        Number.isFinite(dplus) && dplus > 0 ? `${Math.round(dplus)} m D+` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-sm text-zinc-400">
        {courses.length === PAR_PAGE && `${t("index.limite", { n: PAR_PAGE })} `}
        {t("cta.avertissement")}
      </p>
    </main>
  );
}
