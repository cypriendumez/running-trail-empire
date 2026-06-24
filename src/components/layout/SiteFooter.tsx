"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { useT } from "@/lib/i18n/LanguageProvider";
import { CHROME } from "@/components/layout/chromeI18n";

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
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={28} />
            <Wordmark className="text-lg" />
          </Link>
          <p className="text-sm text-zinc-400">{f.rights}</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-400">
            <Link href="/mentions-legales" className="hover:text-zinc-700 transition-colors">{f.legal}</Link>
            <Link href="/confidentialite" className="hover:text-zinc-700 transition-colors">{f.privacy}</Link>
            <Link href="/terms" className="hover:text-zinc-700 transition-colors">{f.cgu}</Link>
            <Link href="/contact" className="hover:text-zinc-700 transition-colors">{f.contact}</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
