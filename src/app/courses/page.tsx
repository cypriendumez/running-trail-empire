import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { nomAffichable, nomRegion, regionCanonique, ECRITURES_REGION } from "@/lib/races/libelles";
import { texteCourses } from "./coursesI18n";
import { jourFrance } from "@/lib/races/jourFrance";
import { DATE_INCONNUE, slugCourse, dateEnClair, type CoursePublique } from "@/lib/races/publique";

export const revalidate = 3600;

const PAR_PAGE = 60;
const CHAMPS = "id,name,city,department,region,date,distance_km,elevation_gain_m,type,terrain,registration_url,latitude,longitude,organization,description,is_itra_certified,itra_points";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ region?: string }> }): Promise<Metadata> {
  const brut = (await searchParams).region?.trim();
  const region = brut ? nomRegion(brut) : "";
  const lang = await getPublicLang();
  const titre = region
    ? texteCourses(lang, "index.titreRegion", { region })
    : texteCourses(lang, "index.titre");
  return {
    title: titre,
    description: region
      ? texteCourses(lang, "index.metaRegion", { region })
      : texteCourses(lang, "index.meta"),
    // ⚠️ L'ADRESSE CANONIQUE PORTE L'IDENTIFIANT CANONIQUE. Deux écritures de la même
    // région donneraient sinon deux pages au contenu identique, que les moteurs
    // traitent comme du contenu dupliqué — au détriment des deux.
    alternates: { canonical: brut ? `/courses?region=${encodeURIComponent(regionCanonique(brut))}` : "/courses" },
  };
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const brut = (await searchParams).region?.trim();
  const canonique = brut ? regionCanonique(brut) : "";
  const region = brut ? nomRegion(brut) : "";
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
  // ⚠️ ON FILTRE SUR TOUTES LES ÉCRITURES DE LA RÉGION. « provence-alpes-cote-azur »
  // (33 courses) et « provence-alpes-cote-d-azur » (1 088) désignaient la même région :
  // un filtre sur une seule écriture rendait 33 courses pratiquement introuvables.
  const ecritures = ECRITURES_REGION[canonique] ?? (canonique ? [canonique] : []);
  if (ecritures.length) q = q.in("region", ecritures);
  const { data } = await q;
  const courses = (data ?? []) as CoursePublique[];

  // Les régions servent de maillage interne : sans liens, une page profonde n'est
  // jamais atteinte par un moteur, même déclarée au sitemap.
  // ⚠️ ON PARCOURT TOUT, ON N'ÉCHANTILLONNE PAS. Un `limit(1000)` sans ordre rendait
  // 1 000 lignes arbitraires sur 10 700 : La Réunion, qui compte UNE course, en tombait
  // et disparaissait de la navigation — et la liste changeait d'un déploiement à
  // l'autre. C'est le même plafond PostgREST que sur le sitemap, réintroduit ici.
  // La page est revalidée toutes les heures : ces quelques requêtes d'une colonne ne
  // sont payées qu'une fois par heure.
  const brutes: string[] = [];
  for (let debut = 0; debut < 50000; debut += 1000) {
    const { data, error } = await sb.from("races").select("region")
      .gte("date", auj).lt("date", DATE_INCONNUE).not("region", "is", null)
      .order("id", { ascending: true })
      .range(debut, debut + 999);
    if (error) break;
    const lot = data ?? [];
    brutes.push(...lot.map((r) => String(r.region ?? "")));
    if (lot.length < 1000) break;
  }
  // Regroupées par identifiant canonique : sinon la même région apparaît deux fois,
  // dont une pastille quasi vide.
  const regions = [...new Set(brutes.map((r) => regionCanonique(r)).filter(Boolean))]
    .map((slug) => ({ slug, nom: nomRegion(slug) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

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
            <Link key={r.slug} href={`/courses?region=${encodeURIComponent(r.slug)}`}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium ${canonique === r.slug ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
              {r.nom}
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
                {/* ⚠️ SUR TÉLÉPHONE, LA DATE PASSE AU-DESSUS. En colonne fixe de 128 px sur
                    un écran de 375, elle amputait le nom : « Ultra Tour Du Mo… » et
                    « Dampierre-sous-Bro… ». Ces pages sont faites pour être trouvées
                    depuis un moteur, donc lues sur un téléphone. */}
                <Link href={`/courses/${slugCourse(c)}`} className="flex flex-col gap-0.5 px-5 py-3.5 hover:bg-zinc-50 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="text-sm text-zinc-500 sm:w-32 sm:flex-shrink-0">{dateEnClair(String(c.date))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-zinc-900 sm:truncate">{nomAffichable(c.name)}</span>
                    <span className="block text-sm text-zinc-500 sm:truncate">
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
