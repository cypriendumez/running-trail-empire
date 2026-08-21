"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LanguageProvider";
import { BLOG } from "../blogI18n";
import { articleParSlug } from "../articles";

/**
 * Avertissement affiché à un lecteur NON FRANCOPHONE.
 *
 * Le corps des articles est en français uniquement (la raison est écrite en tête de
 * `articles.ts` : traduire à la chaîne du fond sur l'entraînement et la nutrition sans
 * relecture produirait le genre de texte approximatif que ce projet retire). Le taire
 * ferait buter le lecteur sur une langue qu'il n'a pas choisie, sans explication —
 * autant le dire, dans SA langue.
 */
const SEULEMENT_FR: Record<string, string> = {
  en: "This article is only available in French for now. The rest of Pacevo speaks your language.",
  de: "Dieser Artikel ist vorerst nur auf Französisch verfügbar. Der Rest von Pacevo spricht deine Sprache.",
  es: "Este artículo solo está disponible en francés por ahora. El resto de Pacevo habla tu idioma.",
  pt: "Este artigo só está disponível em francês por agora. O resto do Pacevo fala a tua língua.",
};

const RETOUR: Record<string, string> = {
  fr: "Tous les sujets",
  en: "All topics",
  de: "Alle Themen",
  es: "Todos los temas",
  pt: "Todos os temas",
};

const MAJ: Record<string, string> = {
  fr: "Mis à jour le",
  en: "Updated",
  de: "Aktualisiert am",
  es: "Actualizado el",
  pt: "Atualizado a",
};

const SOURCES: Record<string, string> = {
  fr: "Sources",
  en: "Sources",
  de: "Quellen",
  es: "Fuentes",
  pt: "Fontes",
};

export function VueArticle({ slug }: { slug: string }) {
  const { lang } = useT();
  const a = articleParSlug(slug);
  if (!a) return null;

  // Le TITRE et l'extrait restent traduits — ils existent déjà dans les cinq langues et
  // servent aussi la carte de l'index. Seul le corps est français.
  const t = (BLOG[lang] ?? BLOG.fr).posts[a.cle];
  const avertLangue = SEULEMENT_FR[lang];

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <Section className="pt-28">
        <Container className="max-w-3xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-[#059669]"
          >
            <ArrowLeft className="h-4 w-4" /> {RETOUR[lang] ?? RETOUR.fr}
          </Link>

          <h1 className="mt-6 text-3xl font-bold leading-[1.15] tracking-tight text-zinc-900 sm:text-4xl">
            {t.title}
          </h1>

          <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
            {MAJ[lang] ?? MAJ.fr} {a.maj}
          </p>

          {avertLangue && (
            <p className="mt-6 flex items-start gap-2 rounded-xl bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-500 ring-1 ring-inset ring-zinc-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              {avertLangue}
            </p>
          )}

          <p className="mt-8 border-l-2 border-[#059669] pl-5 text-lg leading-relaxed text-zinc-700">
            {a.chapo}
          </p>

          {a.avertissement && (
            <p className="mt-8 rounded-xl bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200">
              {a.avertissement}
            </p>
          )}

          <article className="mt-12">
            {a.blocs.map((b, i) => (
              <section key={i} className="mb-11">
                {b.h && (
                  <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900">
                    {b.h}
                  </h2>
                )}
                {b.p.map((par, j) => (
                  <p key={j} className="mb-4 text-[17px] leading-[1.75] text-zinc-600">
                    {par}
                  </p>
                ))}
              </section>
            ))}
          </article>

          {/* Les sources sont en BAS et cliquables, pas en note de bas de page décorative :
              chaque chiffre du texte doit pouvoir être remonté à sa publication. */}
          <div className="mt-4 border-t border-zinc-200 pt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              {SOURCES[lang] ?? SOURCES.fr}
            </h2>
            <ul className="mt-4 space-y-3">
              {a.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1.5 text-sm leading-relaxed text-zinc-500 transition-colors hover:text-[#059669]"
                  >
                    {s.label}
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-14 surface-brand rounded-3xl px-8 py-12 text-center">
            <p className="mx-auto max-w-md text-xl font-semibold leading-snug tracking-tight">
              {t.excerpt}
            </p>
            <Link href="/signup" className={btnClass("brand", "lg", "mt-7")}>
              {(BLOG[lang] ?? BLOG.fr).readArticle}
            </Link>
          </div>
        </Container>
      </Section>
      <SiteFooter />
    </div>
  );
}
