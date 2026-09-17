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

// Pied de page marketing partagé (landing + pages publiques).
export function SiteFooter({ newsletter = true }: { newsletter?: boolean }) {
  const { lang } = useT();
  const f = (CHROME[lang] ?? CHROME.fr).footer;
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
        {/* Les badges des boutiques. Ils ne s'affichent QUE si les adresses sont
            renseignées : l'application n'étant publiée nulle part à ce jour, un badge
            visible mènerait à une page d'erreur. Le pied de page est présent sur toutes
            les pages publiques — c'est l'endroit qui les rend visibles partout sans
            encombrer la barre de navigation. */}
        <StoreBadges className="mb-10 justify-center" />

        {/* Marque + réseaux : la ligne qu'on regarde. */}
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={28} />
            <Wordmark className="text-lg" />
          </Link>
          <SocialLinks />
          <p className="text-sm text-zinc-500">{f.rights}</p>
        </div>

        {/* Liens de pied de page, en ligne secondaire : discrets, mais bien présents.
            ⚠️ `Courses` ET `Comparateur` NE DOIVENT PAS DISPARAÎTRE. Ce sont les DEUX
            SEULES portes d'entrée internes vers les pages publiques : le sitemap les
            déclare, mais un moteur suit d'abord les liens. Sans elles, 10 539 fiches de
            courses et 309 fiches de chaussures redeviennent orphelines — tout le maillage
            interne repose sur ces deux ancres. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-zinc-100 pt-6 text-sm text-zinc-500">
          <Link href="/courses" className="hover:text-zinc-700 transition-colors">Courses</Link>
          <Link href="/chaussures" className="hover:text-zinc-700 transition-colors">Comparateur</Link>
          <Link href="/mentions-legales" className="hover:text-zinc-700 transition-colors">{f.legal}</Link>
          <Link href="/confidentialite" className="hover:text-zinc-700 transition-colors">{f.privacy}</Link>
          <Link href="/terms" className="hover:text-zinc-700 transition-colors">{f.cgu}</Link>
          <Link href="/contact" className="hover:text-zinc-700 transition-colors">{f.contact}</Link>
        </div>
      </Container>
    </footer>
  );
}
