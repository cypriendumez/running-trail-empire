import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { METHODE, SOURCES } from "./methodeI18n";

export async function generateMetadata(): Promise<Metadata> {
  const M = METHODE[await getPublicLang()] ?? METHODE.fr;
  return { title: M.metaTitle, description: M.metaDesc, alternates: { canonical: "/methode" } };
}

/**
 * « COMMENT PACEVO CALCULE » (Santé, lot 3, 10/11/2026) — la méthode, dite telle qu'elle est codée.
 *
 * Exigée en pratique par l'App Store (règle 1.4.1 : dire ses données et sa méthode) et due au
 * coureur qui confie son entraînement. Le texte vit dans `methodeI18n.ts` (5 langues) ; il décrit
 * ce que fait le moteur AUJOURD'HUI, et `tests/methode.test.ts` recoupe ses chiffres avec le code.
 * Page publique, indexée, sans donnée de coureur.
 */
export default async function MethodePage() {
  const M = METHODE[await getPublicLang()] ?? METHODE.fr;
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Toute surcharge de `Section` est doublée en `sm:` (voir notre-histoire). */}
      <Section className="pt-16 sm:pt-20 pb-8 sm:pb-10">
        <Container>
          <p className="text-center text-[11px] font-semibold text-zinc-400 first-letter:uppercase">{M.surtitre}</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance text-center text-4xl font-semibold leading-[1.06] tracking-tight text-zinc-900 sm:text-5xl">
            {M.titre}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-zinc-500">{M.chapo}</p>

          {/* Sommaire : des ancres, pour aller droit à la question qu'on se pose. */}
          <nav aria-label={M.surtitre} className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
            {M.rubriques.map((r) => (
              <a key={r.id} href={`#${r.id}`} className="rounded-full px-3 py-1.5 text-[13px] font-medium text-zinc-600 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 hover:text-zinc-900">
                {r.titre}
              </a>
            ))}
          </nav>
        </Container>
      </Section>

      <Section className="pt-0 sm:pt-0 pb-6 sm:pb-8">
        <Container>
          <div className="mx-auto max-w-2xl space-y-12">
            {M.rubriques.map((r) => (
              <section key={r.id} id={r.id} className="scroll-mt-24">
                <h2 className="text-balance text-xl font-semibold tracking-tight text-zinc-900">{r.titre}</h2>
                {r.paras.map((p, i) => <p key={i} className="mt-3 max-w-prose text-[15px] leading-relaxed text-zinc-600">{p}</p>)}
                {r.points && (
                  <ul className="mt-3 max-w-prose space-y-2 text-[15px] leading-relaxed text-zinc-600">
                    {r.points.map((pt, i) => (
                      <li key={i} className="relative pl-5">
                        <span aria-hidden className="absolute left-0 top-[0.6em] h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section id="sources" className="scroll-mt-24 border-t border-zinc-200 pt-10">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{M.sourcesTitre}</h2>
              <p className="mt-2 text-[14px] text-zinc-500">{M.sourcesAide}</p>
              <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-zinc-600">
                {SOURCES.map((s) => <li key={s}>{s}</li>)}
              </ul>
              <p className="mt-6 text-[13px] text-zinc-400">{M.maj}</p>
            </section>

            <p role="note" className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] leading-relaxed text-zinc-700">{M.avertissement}</p>
          </div>
        </Container>
      </Section>

      <Section className="pt-6 sm:pt-8">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Link href="/signup" className={btnClass("primary", "md", "inline-flex items-center gap-2")}>
              {M.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
