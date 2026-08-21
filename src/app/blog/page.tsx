"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { btnClass } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LanguageProvider";
import { BLOG, BLOG_CATS } from "./blogI18n";
import { SLUG_PAR_CLE } from "./articles";

// Données visuelles (non traduisibles). Titres/extraits/catégories viennent de BLOG[lang].
//
// ── AUDIT DES VISUELS, 20/08/2026 ────────────────────────────────────────────
// Le blog est PUBLIC. Ses huit images n'avaient jamais été passées au crible ;
// quatre l'ont été et sont remplacées :
//
//  · p3 « Entraînement » : portrait STUDIO, visage de face entièrement identifiable,
//    et sans rapport avec la course. → jambes sur piste, aucun visage.
//  · p4 « Santé » : femme en BLOUSE BLANCHE, visage identifiable. Double défaut —
//    le droit à l'image, et une autorité MÉDICALE implicite au-dessus d'un article
//    de santé, alors que l'app s'interdit partout ailleurs de dire « apte ».
//    → silhouette d'étirement, aucun trait discernable.
//  · p6 « IA » : c'était la photo aux TROIS BANDES ADIDAS, la même que la carte
//    « 10 km » de la landing. La retirer d'un seul des deux emplacements ne servait
//    à rien. → motif abstrait, ni personne ni marque.
//  · p8 « Matériel » : photo PRODUIT Nike sur fond rouge, logotype ET swoosh nets,
//    plein cadre. Le pire cas du projet : ce n'est plus un logo incident, ça se lit
//    comme une publicité Nike. → gros plan de chaussure dans l'herbe. ⚠️ Elle porte
//    un petit drapeau britannique de marque au talon (~30 px à l'affichage) : sous
//    le seuil de proéminence retenu, mais ce n'est PAS « aucune marque ». Écrit ici
//    parce qu'un commentaire qui embellit vaut moins que pas de commentaire.
//
//  · p2 « IA » : c'était une photo de SKIEUR, sur le blog d'une app de course. Défaut
//    de PERTINENCE, pas de droit — mais un visuel hors sujet sur une page publique
//    coûte au moment de vendre. → motif d'onde abstrait, dans la même famille que p6
//    sans en être le doublon.
//
//  · p5 « Les courses » : l'article s'intitule « UTMB 2026 : les trails français à ne
//    pas manquer » et était illustré par une PISTE D'ATHLÉTISME vue de haut — la photo
//    du hero, réutilisée telle quelle. Aucun rapport avec l'ultra-trail en montagne.
//    → arêtes alpines, sentier et silhouettes lointaines, aucun visage ni marque.
//
// Conservées après vérification : p1 (robot Pepper — produit de marque mais discret),
// p7 (assiette, rien à signaler).
//
// Les huit URL demandaient une largeur SANS hauteur, alors que les tuiles sont en
// `aspect-[4/3]` : Unsplash renvoyait le recadrage de son choix (400, 900 puis 316 px
// de haut pour la même tuile), que le navigateur étirait ensuite. C'est le défaut de
// flou déjà corrigé sur la landing, jamais reporté ici. Hauteur désormais IMPOSÉE.
/**
 * Où mène une carte.
 *
 * Les trois liens de cette page menaient TOUS à /signup, y compris le bouton
 * « Lire l'article » — pour huit articles dont aucun n'existait. Désormais : si le texte
 * est écrit (`articles.ts`), la carte mène à l'article ; sinon elle mène toujours à
 * l'inscription, et garde son badge « Sujet à venir ». Le badge et la destination
 * viennent donc de la MÊME source — ils ne peuvent plus se contredire.
 */
const lienDe = (cle: string) => (SLUG_PAR_CLE[cle] ? `/blog/${SLUG_PAR_CLE[cle]}` : "/signup");
const estEcrit = (cle: string) => Boolean(SLUG_PAR_CLE[cle]);

const POSTS = [
  { id: 1, key: "p1", cat: "AI", img: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&h=450&fit=crop&q=80", featured: true },
  { id: 2, key: "p2", cat: "AI", img: "https://images.unsplash.com/photo-1762281429414-5ee5f2dbb243?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 3, key: "p3", cat: "TRAINING", img: "https://images.unsplash.com/photo-1526676537331-7747bf8278fc?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 4, key: "p4", cat: "HEALTH", img: "https://images.unsplash.com/photo-1560233026-ad254fa8da38?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 5, key: "p5", cat: "RACES", img: "https://images.unsplash.com/photo-1761027436967-63584b301a77?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 6, key: "p6", cat: "AI", img: "https://images.unsplash.com/photo-1761078739194-75cccb8e3195?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 7, key: "p7", cat: "NUTRITION", img: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&h=450&fit=crop&q=80", featured: false },
  { id: 8, key: "p8", cat: "GEAR", img: "https://images.unsplash.com/photo-1555972635-8a10402b49b2?w=600&h=450&fit=crop&q=80", featured: false },
];

/**
 * ⚠️ CE BADGE ANNONÇAIT UN TEMPS DE LECTURE — de 6 à 15 minutes selon la carte.
 *
 * Aucun de ces articles n'existe : `src/app/blog/` ne contient que cet index et son
 * dictionnaire, il n'y a pas de page d'article, et les trois liens de la page mènent à
 * /signup — y compris le bouton libellé « Lire l'article ». On promettait donc douze
 * minutes de lecture d'un texte jamais écrit, puis on encaissait le clic sur un
 * formulaire d'inscription. La date de publication et l'auteur « Équipe Pacevo »
 * disaient la même chose : personne n'a écrit ces textes.
 *
 * Tant qu'ils ne sont pas écrits, la carte annonce ce qu'elle est : un SUJET à venir.
 */
function BadgeAVenir({ t }: { t: string }) {
  return (
    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
      <Clock className="h-3 w-3" /> {t}
    </span>
  );
}

function CatBadge({ code, label }: { code: string; label: string }) {
  return <Badge tone={code === "AI" ? "brand" : "neutral"}>{label}</Badge>;
}

export default function BlogPage() {
  const { lang } = useT();
  const B = BLOG[lang] ?? BLOG.fr;
  const [cat, setCat] = useState("ALL");
  const featured = POSTS.find((p) => p.featured)!;
  const showFeatured = cat === "ALL";
  const grid = cat === "ALL" ? POSTS.filter((p) => !p.featured) : POSTS.filter((p) => p.cat === cat);

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
      <SiteHeader />

      {/* HERO */}
      <Container className="pt-16 pb-10 text-center sm:pt-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#059669]">{B.heroEyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          {B.heroTitleA}<span className="text-[#059669]">{B.heroAccent}</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-zinc-500">{B.heroSubtitle}</p>
      </Container>

      {/* CATEGORIES (sticky, fonctionnel) */}
      <div className="sticky top-16 z-40 border-y border-zinc-200/70 bg-white/80 backdrop-blur-xl">
        <Container className="flex items-center gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {BLOG_CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                cat === c ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              {B.cats[c]}
            </button>
          ))}
        </Container>
      </div>

      <Section className="!pt-14">
        <Container>
          {/* FEATURED */}
          {showFeatured && (
            <div className="mb-16 grid items-center gap-10 lg:grid-cols-2">
              <Link href={lienDe(featured.key)} className="group relative block aspect-[4/3] overflow-hidden rounded-3xl">
                <img src={featured.img} alt={B.posts[featured.key].title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                {!estEcrit(featured.key) && <BadgeAVenir t={B.bientot} />}
              </Link>
              <div>
                <CatBadge code={featured.cat} label={B.cats[featured.cat]} />
                <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">{B.posts[featured.key].title}</h2>
                <p className="mt-4 leading-relaxed text-zinc-500">{B.posts[featured.key].excerpt}</p>

                <Card className="mt-7 p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">{B.manifesto.label}</p>
                  <div className="mt-4 grid grid-cols-2 gap-5">
                    {[
                      { label: B.manifesto.humanLabel, brand: false, items: B.manifesto.human },
                      { label: B.manifesto.aiLabel, brand: true, items: B.manifesto.ai },
                    ].map((col) => (
                      <div key={col.label}>
                        <div className={`mb-3 text-xs font-bold uppercase tracking-wider ${col.brand ? "text-[#059669]" : "text-zinc-900"}`}>{col.label}</div>
                        <ul className="space-y-1.5">
                          {col.items.map((item) => (
                            <li key={item} className="flex items-center gap-2 text-xs text-zinc-500">
                              <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${col.brand ? "bg-[#10b981]" : "bg-zinc-300"}`} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Card>

                <Link href={lienDe(featured.key)} className={btnClass("primary", "md", "mt-7")}>
                  {estEcrit(featured.key) ? B.lireArticle : B.readArticle} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          {/* GRID */}
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((post) => (
              <Link href={lienDe(post.key)} key={post.id} className="group">
                <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-2xl">
                  <img src={post.img} alt={B.posts[post.key].title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  {!estEcrit(post.key) && <BadgeAVenir t={B.bientot} />}
                </div>
                <CatBadge code={post.cat} label={B.cats[post.cat]} />
                <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight transition-colors group-hover:text-[#059669]">{B.posts[post.key].title}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-500">{B.posts[post.key].excerpt}</p>

              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
