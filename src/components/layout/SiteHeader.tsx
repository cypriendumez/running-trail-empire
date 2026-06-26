"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useT } from "@/lib/i18n/LanguageProvider";
import { CHROME } from "@/components/layout/chromeI18n";

// En-tête marketing partagé par les pages publiques (hors landing qui a son hero).
export function SiteHeader() {
  const { lang } = useT();
  const c = (CHROME[lang] ?? CHROME.fr).nav;
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { href: "/#programmes", label: c.programs },
    { href: "/#features", label: c.features },
    { href: "/pricing", label: c.pricing },
    { href: "/blog", label: c.blog },
    { href: "/avis", label: c.reviews },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/90 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <Logo size={30} />
          <Wordmark className="text-xl" />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-zinc-900 transition-colors">{l.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <Link href="/login" className="hidden sm:inline-flex px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
            {c.login}
          </Link>
          <Link href="/signup" className={btnClass("primary", "sm")}>
            {c.trial} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="md:hidden border-t border-zinc-200 bg-white">
          <Container className="flex flex-col py-2 text-sm font-medium text-zinc-700">
            {[...links, { href: "/login", label: c.login }].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="py-2.5 hover:text-[#059669] transition-colors">
                {l.label}
              </Link>
            ))}
          </Container>
        </div>
      )}
    </header>
  );
}
