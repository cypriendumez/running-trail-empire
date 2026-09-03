import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { regionsAvecCourses, prochainesCourses } from "@/lib/races/catalogue";
import { nomRegion, regionCanonique, regionAvecPreposition } from "@/lib/races/libelles";
import { texteCourses } from "../../coursesI18n";
import { Liste } from "../../Liste";

export const revalidate = 3600;

const PAR_PAGE = 60;

/**
 * ⚠️ PAS DE `generateStaticParams` ICI, ET C'EST DÉLIBÉRÉ. Je l'avais ajouté en croyant
 * rendre ces pages statiques ; le build a montré qu'elles restaient dynamiques (`ƒ`).
 * La raison : `getPublicLang()` lit les cookies et l'en-tête `Accept-Language`, ce qui
 * rend dynamique TOUTE page qui l'appelle. Le pré-rendu n'aurait donc jamais eu lieu, et
 * le laisser en place aurait fait croire à une optimisation inexistante.
 *
 * On garde la détection de langue — un visiteur allemand doit lire l'allemand — et c'est
 * le CACHE DES LECTURES (`lib/races/catalogue`) qui enlève le coût : la page reste
 * rendue à chaque visite, mais sans repayer la base. C'est là qu'étaient les 2,45 s de
 * TTFB mesurées : onze allers-retours pour construire la liste des régions.
 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = regionCanonique((await params).slug);
  const lang = await getPublicLang();
  // En français la préposition fait partie du nom (« dans le Grand Est ») ; les autres
  // langues portent la leur dans le modèle, elles reçoivent donc le nom nu.
  const region = lang === "fr" ? regionAvecPreposition(slug) : nomRegion(slug);
  return {
    title: texteCourses(lang, "index.titreRegion", { region }),
    description: texteCourses(lang, "index.metaRegion", { region }),
    alternates: { canonical: `/courses/region/${slug}` },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const demande = (await params).slug;
  const slug = regionCanonique(demande);
  const [lang, regions, courses] = await Promise.all([
    getPublicLang(), regionsAvecCourses(), prochainesCourses(slug, PAR_PAGE),
  ]);
  // Une région sans aucune course n'a pas de page : mieux vaut une 404 franche qu'une
  // page vide que les moteurs garderaient en réserve.
  if (!regions.some((r) => r.slug === slug)) notFound();
  const region = lang === "fr" ? regionAvecPreposition(slug) : nomRegion(slug);
  return (
    <Liste courses={courses} regions={regions} canonique={slug} lang={lang}
      titre={texteCourses(lang, "index.titreRegion", { region })} limite={PAR_PAGE} />
  );
}
