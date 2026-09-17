"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { useT } from "@/lib/i18n/LanguageProvider";
import { CHROME } from "@/components/layout/chromeI18n";
import { StoreBadges } from "@/components/layout/StoreBadges";
import { SocialLinks } from "@/components/brand/SocialLinks";

/**
 * PIED DE PAGE — quatre colonnes, pas une rangée de liens en vrac.
 *
 * La version précédente alignait logo / réseaux / copyright sur une ligne, puis TOUS les
 * liens sur une autre, mélangeant des pages produit et des mentions légales. Rien
 * n'indiquait ce qui était quoi, et six liens à plat font « page perso », pas produit.
 *
 * ⚠️ `Courses` et `Comparateur` NE DOIVENT JAMAIS DISPARAÎTRE D'ICI. Ce sont les deux
 * seules portes d'entrée INTERNES vers les pages publiques : le sitemap déclare bien les
 * 10 539 fiches de courses et les 309 fiches de chaussures, mais un moteur suit d'abord
 * les liens. Les retirer rendrait ces pages orphelines sans casser quoi que ce soit de
 * visible — donc sans que personne ne s'en aperçoive. `tests/liens.test.ts` le garde.
 *
 * ⚠️ Les trois liens légaux restent aussi : mentions légales, confidentialité et CGU sont
 * OBLIGATOIRES pour un éditeur français. Ce n'est pas une question de goût.
 *
 * Les libellés viennent de `CHROME.nav` (déjà traduit pour la barre du haut) : une seule
 * copie de « Programmes », « Tarifs », « Blog »… pour les deux endroits.
 */
export function SiteFooter({ newsletter = true }: { newsletter?: boolean }) {
  const { lang } = useT();
  const c = CHROME[lang] ?? CHROME.fr;
  const f = c.footer;

  const colonnes: { titre: string; liens: { href: string; label: string }[] }[] = [
    {
      titre: f.colProduit,
      liens: [
        // Ancres de la page d'accueil : préfixées par « / » pour fonctionner AUSSI depuis
        // /blog ou /courses, où un « #programmes » nu ne mènerait nulle part.
        { href: "/#programmes", label: c.nav.programs },
        { href: "/#features", label: c.nav.features },
        { href: "/pricing", label: c.nav.pricing },
        { href: "/avis", label: c.nav.reviews },
      ],
    },
    {
      titre: f.colRessources,
      liens: [
        { href: "/blog", label: c.nav.blog },
        { href: "/courses", label: f.races },
        { href: "/chaussures", label: f.shoes },
      ],
    },
    {
      titre: f.colEntreprise,
      liens: [
        { href: "/notre-histoire", label: c.nav.story },
        { href: "/contact", label: f.contact },
      ],
    },
    {
      titre: f.colLegal,
      liens: [
        { href: "/mentions-legales", label: f.legal },
        { href: "/confidentialite", label: f.privacy },
        { href: "/terms", label: f.cgu },
      ],
    },
  ];

  return (
    <footer className="border-t border-zinc-200 bg-white">
      <Container className="py-16">
        {newsletter && (
          <div className="mx-auto mb-14 flex max-w-xl flex-col items-center gap-4 border-b border-zinc-200 pb-14 text-center">
            <Badge tone="brand">{f.badge}</Badge>
            <h3 className="text-xl font-bold sm:text-2xl">{f.title}</h3>
            <p className="max-w-md text-sm text-zinc-500">{f.desc}</p>
            <div className="w-full max-w-md"><NewsletterSignup /></div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
          {/* Colonne de marque — deux fois plus large : elle porte le logo, la promesse
              et les réseaux, et doit respirer à côté des listes de liens. */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size={28} />
              <Wordmark className="text-lg" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">{f.tagline}</p>
            <SocialLinks className="mt-5" />
            {/* Les badges des boutiques ne s'affichent QUE si les adresses sont
                renseignées : l'application n'étant publiée nulle part à ce jour, un badge
                visible mènerait à une page d'erreur. */}
            <StoreBadges className="mt-6" />
          </div>

          {colonnes.map((col) => (
            <div key={col.titre}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">{col.titre}</h3>
              <ul className="mt-4 space-y-3">
                {col.liens.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-zinc-500 transition-colors hover:text-[#059669]">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-zinc-100 pt-6">
          <p className="text-sm text-zinc-500">{f.rights}</p>
        </div>
      </Container>
    </footer>
  );
}
