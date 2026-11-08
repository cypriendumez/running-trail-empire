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
import { POSTS } from "./posts";

// Les cartes et leurs photos (et l'audit de chacune) vivent dans `./posts` : la page
// d'article, rendue sur le serveur, en a besoin pour son image de partage.
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
        <p className="text-[11px] font-semibold text-[#047857] first-letter:uppercase">{B.heroEyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
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
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semiboldr transition ${
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
              <Link href={lienDe(featured.key)} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl">
                <img src={featured.img} alt={B.posts[featured.key].title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700" />
                {!estEcrit(featured.key) && <BadgeAVenir t={B.bientot} />}
              </Link>
              <div>
                <CatBadge code={featured.cat} label={B.cats[featured.cat]} />
                <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">{B.posts[featured.key].title}</h2>
                <p className="mt-4 leading-relaxed text-zinc-500">{B.posts[featured.key].excerpt}</p>

                <Card className="mt-7 p-6">
                  <p className="text-xs font-semibold text-zinc-400 first-letter:uppercase">{B.manifesto.label}</p>
                  <div className="mt-4 grid grid-cols-2 gap-5">
                    {[
                      { label: B.manifesto.humanLabel, brand: false, items: B.manifesto.human },
                      { label: B.manifesto.aiLabel, brand: true, items: B.manifesto.ai },
                    ].map((col) => (
                      <div key={col.label}>
                        <div className={`mb-3 text-xs font-semiboldr ${col.brand ? "text-[#059669]" : "text-zinc-900"}`}>{col.label}</div>
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
                  <img src={post.img} alt={B.posts[post.key].title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500" />
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
