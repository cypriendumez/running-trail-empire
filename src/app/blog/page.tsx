"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { btnClass } from "@/components/ui/Button";

const CATEGORIES = ["TOUT", "IA & PERFORMANCE", "ENTRAÎNEMENT", "NUTRITION", "SANTÉ DU COUREUR", "LES COURSES", "ÉQUIPEMENT"];

const POSTS = [
  { id: 1, category: "IA & PERFORMANCE", title: "Pourquoi l'IA sera ton meilleur coach (et ce qu'un humain ne peut pas faire)", excerpt: "L'IA analyse ta VFC, ton sommeil, ta charge en temps réel. Un coach humain te voit une fois par semaine. Voici pourquoi l'avenir, c'est les deux.", img: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&q=80&fit=crop", author: "Équipe Pacevo", date: "19 avr. 2026", readTime: "8 min", featured: true },
  { id: 2, category: "IA & PERFORMANCE", title: "HRV + IA : prédire ta fatigue 48 h avant que tu la ressentes", excerpt: "Le modèle de Banister CTL/ATL/TSB combiné à l'analyse HRV prédit les jours de sur-entraînement avec une précision de 94 %.", img: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80&fit=crop", author: "Équipe Pacevo", date: "16 avr. 2026", readTime: "12 min", featured: false },
  { id: 3, category: "ENTRAÎNEMENT", title: "Semi en moins d'1h45 : le plan IA qui a marché pour 2 300 coureurs", excerpt: "Allure, fractions, récupération — tout est calculé selon ta VMA et ta VFC du matin. Résultat : −8 min en moyenne sur le chrono.", img: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&q=80&fit=crop", author: "Équipe Pacevo", date: "14 avr. 2026", readTime: "10 min", featured: false },
  { id: 4, category: "SANTÉ DU COUREUR", title: "Body Battery à 20 % le matin : faut-il courir quand même ?", excerpt: "La réponse varie selon ton TSB, ta phase de prépa et le type de séance. L'IA tranche pour toi — voici comment elle décide.", img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=80&fit=crop", author: "Équipe Pacevo", date: "11 avr. 2026", readTime: "6 min", featured: false },
  { id: 5, category: "LES COURSES", title: "UTMB 2026 : les trails français à ne pas manquer cette saison", excerpt: "De l'UTMB au Grand Raid de La Réunion : notre sélection des 20 trails incontournables, profils altimétriques et barrières horaires.", img: "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=600&q=80&fit=crop", author: "Équipe Pacevo", date: "9 avr. 2026", readTime: "15 min", featured: false },
  { id: 6, category: "IA & PERFORMANCE", title: "Ghost Runner : courir avec un coach vocal IA, ça change quoi ?", excerpt: "On a testé le coaching vocal IA sur 6 semaines avec 80 coureurs. Les résultats sur l'allure, la régularité et la motivation sont sans appel.", img: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80&fit=crop", author: "Équipe Pacevo", date: "7 avr. 2026", readTime: "9 min", featured: false },
  { id: 7, category: "NUTRITION", title: "Ravitaillement marathon : quoi manger, quand et combien", excerpt: "Notre calculateur IA tient compte de ta sudation, ta corpulence et ton allure pour un plan glucidique sur mesure.", img: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80&fit=crop", author: "Équipe Pacevo", date: "4 avr. 2026", readTime: "11 min", featured: false },
  { id: 8, category: "ÉQUIPEMENT", title: "Chaussures de trail 2026 : le comparatif IA selon ta foulée", excerpt: "L'IA analyse ta cadence, ton oscillation verticale et ton temps de contact au sol pour identifier la chaussure parfaite parmi 200+ modèles.", img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80&fit=crop", author: "Équipe Pacevo", date: "1 avr. 2026", readTime: "14 min", featured: false },
];

function ReadTime({ t }: { t: string }) {
  return (
    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
      <Clock className="h-3 w-3" /> {t}
    </span>
  );
}

function CatBadge({ category }: { category: string }) {
  return <Badge tone={category === "IA & PERFORMANCE" ? "brand" : "neutral"}>{category}</Badge>;
}

export default function BlogPage() {
  const [cat, setCat] = useState("TOUT");
  const featured = POSTS.find((p) => p.featured)!;
  const showFeatured = cat === "TOUT";
  const grid = cat === "TOUT" ? POSTS.filter((p) => !p.featured) : POSTS.filter((p) => p.category === cat);

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
      <SiteHeader />

      {/* HERO */}
      <Container className="pt-16 pb-10 text-center sm:pt-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#059669]">Le blog</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Comprends, apprends, <span className="text-[#059669]">progresse</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-zinc-500">
          Ce que la science du sport et l&apos;intelligence artificielle peuvent faire pour ton running.
        </p>
      </Container>

      {/* CATEGORIES (sticky, fonctionnel) */}
      <div className="sticky top-16 z-40 border-y border-zinc-200/70 bg-white/80 backdrop-blur-xl">
        <Container className="flex items-center gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                cat === c ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              {c}
            </button>
          ))}
        </Container>
      </div>

      <Section className="!pt-14">
        <Container>
          {/* FEATURED */}
          {showFeatured && (
            <div className="mb-16 grid items-center gap-10 lg:grid-cols-2">
              <Link href="/signup" className="group relative block aspect-[4/3] overflow-hidden rounded-3xl">
                <img src={featured.img} alt={featured.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <ReadTime t={featured.readTime} />
              </Link>
              <div>
                <CatBadge category={featured.category} />
                <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">{featured.title}</h2>
                <p className="mt-4 leading-relaxed text-zinc-500">{featured.excerpt}</p>

                <Card className="mt-7 p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">IA + coach = la combinaison parfaite</p>
                  <div className="mt-4 grid grid-cols-2 gap-5">
                    {[
                      { label: "Coach humain", brand: false, items: ["Vision long terme", "Motivation", "Expérience terrain", "Ajustement tactique"] },
                      { label: "IA Pacevo", brand: true, items: ["Analyse 24h/24", "VFC + sommeil + charge", "Prédiction de fatigue", "Plan temps réel"] },
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

                <Link href="/signup" className={btnClass("primary", "md", "mt-7")}>
                  Lire l&apos;article <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          {/* GRID */}
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((post) => (
              <Link href="/signup" key={post.id} className="group">
                <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-2xl">
                  <img src={post.img} alt={post.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <ReadTime t={post.readTime} />
                </div>
                <CatBadge category={post.category} />
                <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight transition-colors group-hover:text-[#059669]">{post.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-500">{post.excerpt}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
                  <Logo size={20} />
                  <span>{post.author}</span><span>·</span><span>{post.date}</span>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
