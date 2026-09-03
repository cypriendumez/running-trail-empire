import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { regionsAvecCourses, prochainesCourses, sansDateAnnoncee } from "@/lib/races/catalogue";
import { regionCanonique } from "@/lib/races/libelles";
import { texteCourses } from "./coursesI18n";
import { Liste } from "./Liste";

export const revalidate = 3600;

const PAR_PAGE = 60;
/** Volontairement plus court : ces épreuves informent, elles ne guident pas un choix de date. */
const SANS_DATE_PAR_PAGE = 30;

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
  //
  // ⚠️ PERMANENTE (308), PAS TEMPORAIRE (307). `redirect()` répond 307, ce qui dit à un
  // moteur « l'ancienne adresse reste la bonne, repasse plus tard » : il la garde
  // indexée et ne transmet rien à la nouvelle. Vérifié en production avant correction.
  const brut = (await searchParams).region?.trim();
  if (brut) permanentRedirect(`/courses/region/${regionCanonique(brut)}`);

  const [lang, regions, courses, sansDate] = await Promise.all([
    getPublicLang(), regionsAvecCourses(), prochainesCourses("", PAR_PAGE),
    sansDateAnnoncee("", SANS_DATE_PAR_PAGE),
  ]);
  return (
    <Liste courses={courses} sansDate={sansDate} regions={regions} canonique="" lang={lang}
      titre={texteCourses(lang, "index.titre")} limite={PAR_PAGE} />
  );
}
