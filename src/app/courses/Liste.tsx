import Link from "next/link";
import { slugCourse, dateEnClair, type CoursePublique } from "@/lib/races/publique";
import { nomAffichable } from "@/lib/races/libelles";
import { texteCourses } from "./coursesI18n";

/** Rendu partagé par la page « toutes régions » et par chaque page de région. */
export function Liste({
  courses, regions, canonique, titre, lang, limite,
}: {
  courses: CoursePublique[];
  regions: { slug: string; nom: string }[];
  canonique: string;
  titre: string;
  lang: string;
  limite: number;
}) {
  const t = (k: string, p?: Record<string, string | number>) => texteCourses(lang, k, p);
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{titre}</h1>
      <p className="mt-2 text-zinc-600">{t("index.sous")}</p>

      {regions.length > 0 && (
        <nav className="mt-6 flex flex-wrap gap-2">
          <Link href="/courses"
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${!canonique ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
            {t("index.toutes")}
          </Link>
          {regions.map((r) => (
            <Link key={r.slug} href={`/courses/region/${r.slug}`}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium ${canonique === r.slug ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
              {r.nom}
            </Link>
          ))}
        </nav>
      )}

      {courses.length === 0 ? (
        // On dit qu'il n'y a rien : une page vide sans un mot laisse croire à une panne.
        <p className="mt-10 text-zinc-500">{t("index.vide")}</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
          {courses.map((c) => {
            const km = Number(c.distance_km);
            const dplus = Number(c.elevation_gain_m);
            return (
              <li key={c.id}>
                {/* ⚠️ SUR TÉLÉPHONE, LA DATE PASSE AU-DESSUS. En colonne fixe de 128 px
                    sur un écran de 375, elle amputait le nom : « Ultra Tour Du Mo… ».
                    Ces pages sont faites pour être trouvées depuis un moteur, donc lues
                    sur un téléphone. */}
                <Link href={`/courses/${slugCourse(c)}`}
                  className="flex flex-col gap-0.5 px-5 py-3.5 hover:bg-zinc-50 sm:flex-row sm:items-baseline sm:gap-4">
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
        {courses.length === limite && `${t("index.limite", { n: limite })} `}
        {t("cta.avertissement")}
      </p>
    </main>
  );
}
