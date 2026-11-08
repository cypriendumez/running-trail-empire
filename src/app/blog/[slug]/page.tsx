import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ARTICLES, articleParSlug } from "../articles";
import { BLOG } from "../blogI18n";
import { VueArticle } from "./VueArticle";
import { donneesStructureesArticle, serialiserJsonLd } from "@/lib/brand/entite";
import { photoPartage } from "../posts";

/**
 * LA PAGE D'ARTICLE — elle n'existait pas.
 *
 * Le blog affichait huit cartes avec un temps de lecture et un bouton « Lire l'article »
 * qui menait à /signup : il n'y avait AUCUNE page d'article dans tout le projet. Voici
 * la première. Une carte ne devient cliquable que si son texte existe dans `articles.ts` ;
 * les autres gardent leur badge « Sujet à venir », ce qui reste vrai.
 *
 * Composant SERVEUR à dessein : c'est ce qui permet `generateStaticParams` (les articles
 * sont pré-rendus, donc indexables) et `generateMetadata` (titre, description et image
 * de partage réels pour chaque article, au lieu de ceux du site). Le rendu lui-même est
 * délégué à `VueArticle`, qui est client parce qu'il a besoin de `useT()` pour l'en-tête,
 * le pied de page et le titre traduit.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = articleParSlug(slug);
  if (!a) return {};
  // Le corps des articles est en français (voir l'en-tête de `articles.ts`) : les
  // métadonnées le sont aussi. Annoncer un titre traduit pour un texte qui ne l'est pas
  // enverrait un lecteur allemand sur du français depuis un résultat de recherche.
  const t = BLOG.fr.posts[a.cle];
  const photo = photoPartage(a.cle);
  return {
    // Le layout applique déjà le gabarit « %s | Pacevo » : ajouter « — Pacevo » ici
    // donnait « … — Pacevo | Pacevo » dans l'onglet et dans les résultats de recherche.
    title: t.title,
    description: a.chapo,
    alternates: { canonical: `/blog/${a.slug}` },
    // ⚠️ CONSTATÉ LE 08/11/2026 dans le HTML servi : un article partagé partait SANS IMAGE
    // (cet `openGraph` remplace celui du site, image comprise), et sur X avec le titre et
    // la description de l'ACCUEIL (aucun `twitter` ici, donc celui du layout racine).
    openGraph: {
      type: "article",
      url: `/blog/${a.slug}`,
      title: t.title,
      description: a.chapo,
      locale: "fr_FR",
      siteName: "Pacevo",
      ...(photo ? { images: [{ url: photo.url, width: photo.width, height: photo.height, alt: t.title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: t.title,
      description: a.chapo,
      ...(photo ? { images: [photo.url] } : {}),
    },
  };
}

export default async function PageArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = articleParSlug(slug);
  if (!a) notFound();
  // Données structurées de l'article, publié par Pacevo (voir `lib/brand/entite`). Le
  // titre est le français, comme les métadonnées : c'est la langue du texte.
  const ld = donneesStructureesArticle({ slug: a.slug, titre: BLOG.fr.posts[a.cle].title, chapo: a.chapo, maj: a.maj, sources: a.sources, image: photoPartage(a.cle) });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(ld) }} />
      <VueArticle slug={slug} />
    </>
  );
}
