import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { regionsAvecCourses, prochainesCourses } from "@/lib/races/catalogue";
import { regionCanonique } from "@/lib/races/libelles";
import { texteCourses } from "./coursesI18n";
import { Liste } from "./Liste";

export const revalidate = 3600;

const PAR_PAGE = 60;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getPublicLang();
  return {
    title: texteCourses(lang, "index.titre"),
    description: texteCourses(lang, "index.meta"),
    alternates: { canonical: "/courses" },
  };
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  // ⚠️ L'ANCIENNE FORME `?region=` EST REDIRIGÉE, PAS SUPPRIMÉE. Ces adresses ont été
  // déclarées au sitemap et soumises aux moteurs le 03/09/2026 : les laisser répondre
  // sans destination aurait transformé des adresses déjà connues en pages orphelines.
  // Une redirection permanente transmet ce qu'elles avaient acquis à la nouvelle.
  const brut = (await searchParams).region?.trim();
  if (brut) redirect(`/courses/region/${regionCanonique(brut)}`);

  const [lang, regions, courses] = await Promise.all([
    getPublicLang(), regionsAvecCourses(), prochainesCourses("", PAR_PAGE),
  ]);
  return (
    <Liste courses={courses} regions={regions} canonique="" lang={lang}
      titre={texteCourses(lang, "index.titre")} limite={PAR_PAGE} />
  );
}
