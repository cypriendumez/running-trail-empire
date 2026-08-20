"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { AUTH } from "@/components/auth/authI18n";
import { CHIFFRES_AUTH } from "@/lib/brand/stats";

/**
 * COURBES DE NIVEAU — le motif du panneau de gauche.
 *
 * Le panneau était un aplat NOIR : sur une app de course et de trail, c'était l'écran le
 * plus neutre possible, juste avant de demander un mot de passe. On aurait pu y mettre
 * une photo, mais `app/page.tsx` documente la bataille déjà perdue sur le hero — une
 * silhouette sur une piste n'a aucun contraste STABLE, il change à chaque pixel, et
 * aucun voile ne le rattrape partout. Un motif qu'on DESSINE a un contraste connu : il
 * ne peut pas manger le texte. Il n'a pas non plus de droit à l'image.
 *
 * Les lignes sont générées et non dessinées à la main, pour qu'elles ne se répètent pas
 * mécaniquement : l'amplitude et la phase suivent deux sinusoïdes de périodes
 * différentes, d'où un empilement irrégulier — l'allure d'une carte IGN plutôt que
 * d'une texture de fond.
 *
 * ⚠️ AUCUN aléa ici. Un `Math.random()` produirait un tracé différent au rendu serveur
 * et au rendu client, et React signalerait une divergence d'hydratation.
 */
const COURBES = Array.from({ length: 17 }, (_, i) => {
  const y = 40 + i * 54;
  const a = 30 + Math.sin(i * 0.9) * 18;
  const b = 20 + Math.cos(i * 0.65) * 14;
  return `M-80 ${y} C 90 ${(y - a).toFixed(1)}, 210 ${(y + b).toFixed(1)}, 350 ${(y - b).toFixed(1)} S 590 ${(y + a).toFixed(1)}, 800 ${(y - a / 2).toFixed(1)}`;
});

// Cadre commun des pages d'auth — split premium : panneau de marque à gauche,
// formulaire centré sur fond blanc à droite. Sur mobile, seul le formulaire s'affiche.
export function AuthShell({ children }: { children: ReactNode }) {
  const { lang } = useT();
  const s = (AUTH[lang] ?? AUTH.fr).shell;
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* ── Panneau de marque ────────────────────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#04120c] p-12 lg:flex">
        {/* Fond : vert profond en haut à gauche, qui s'éteint vers le bas à droite. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,#064e3b_0%,#052e20_38%,#04120c_72%,#020806_100%)]" />
        {/* Halo émeraude, calé sur le logo. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_12%_-5%,rgba(16,185,129,.30),transparent_62%)]" />
        {/* Courbes de niveau. */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full text-emerald-200/[0.14]"
          viewBox="0 0 700 960" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
        >
          <g fill="none" stroke="currentColor" strokeWidth="1.4">
            {COURBES.map((d, i) => <path key={i} d={d} />)}
          </g>
        </svg>
        {/* Voile bas : le copyright garde son contraste quel que soit le motif dessous. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#020806] to-transparent" />

        <Link href="/" className="relative flex items-center gap-2.5">
          <Logo size={32} />
          <Wordmark tone="light" className="text-xl" />
        </Link>

        <div className="relative">
          <h2 className="text-[2.6rem] font-bold leading-[1.08] tracking-tight text-white">
            {s.title1}<br />{s.title2}
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/60">
            {s.subtitle}
          </p>

          {/* ⚠️ Ce bandeau affichait « 10k+ coureurs », « 4.9★ note moyenne » et
              « 98 % satisfaction ». Les TROIS étaient inventés : la base compte un
              profil, et il n'existe ni note ni enquête de satisfaction. Ils avaient été
              retirés de la page d'accueil ; personne n'était venu les retirer ici, sur
              la page même où l'on demande une adresse et un mot de passe. Les valeurs
              viennent désormais de `lib/brand/stats`, partagé avec l'accueil, et chacune
              se recompte. */}
          <div className="mt-10 flex gap-10 border-t border-white/10 pt-7">
            {CHIFFRES_AUTH.map((valeur, i) => (
              <div key={s.stats[i]}>
                <div className="text-2xl font-bold tabular-nums text-white">{valeur}</div>
                <div className="mt-1 text-xs leading-tight text-white/45">{s.stats[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/35">© 2026 Pacevo</p>
      </div>

      {/* ── Formulaire ───────────────────────────────────────────────────── */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
