import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";

const LINKS = [
  { href: "/#programmes", label: "Programmes" },
  { href: "/#features", label: "Fonctionnalités" },
  { href: "/pricing", label: "Tarifs" },
  { href: "/blog", label: "Blog" },
  { href: "/avis", label: "Avis" },
];

// En-tête marketing partagé par les pages publiques (hors landing qui a son hero).
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} />
          <Wordmark className="text-xl" />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-zinc-900 transition-colors">{l.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="hidden sm:inline-flex px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
            Connexion
          </Link>
          <Link href="/signup" className={btnClass("primary", "sm")}>
            Essai gratuit <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Container>
    </header>
  );
}
