import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";

// Cadre commun des pages d'auth — split premium : panneau de marque sombre à gauche,
// formulaire centré sur fond blanc à droite. Sur mobile, seul le formulaire s'affiche.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* Panneau de marque */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_60%_at_15%_0%,rgba(16,185,129,.18),transparent_60%)]" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <Logo size={32} />
          <Wordmark tone="light" className="text-xl" />
        </Link>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-white">
            Le coach qui s&apos;adapte<br />à toi, chaque jour.
          </h2>
          <p className="mt-4 max-w-sm leading-relaxed text-white/55">
            Plans IA, analyse VFC, Ghost Runner vocal, Trail Builder. Tout ce dont un coureur sérieux a besoin.
          </p>
          <div className="mt-9 flex gap-9">
            {[["10k+", "coureurs"], ["4.9★", "note moyenne"], ["98%", "satisfaction"]].map(([v, l]) => (
              <div key={l}>
                <div className="text-2xl font-bold tabular-nums text-white">{v}</div>
                <div className="text-xs text-white/45">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/35">© 2026 Pacevo</p>
      </div>

      {/* Formulaire */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
