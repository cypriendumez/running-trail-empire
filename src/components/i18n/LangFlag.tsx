import type { ReactNode } from "react";

/**
 * DRAPEAUX EN SVG, pas en emoji.
 *
 * Les emoji-drapeaux (🇫🇷…) faisaient « sticker générique » et surtout ne se rendent pas
 * pareil selon l'OS : Windows n'a aucun glyphe drapeau et affiche « FR ». Ces SVG plats,
 * aux couleurs officielles, rendus dans une pastille à coins arrondis et fin liseré,
 * donnent un rendu identique partout et intégré à l'interface.
 *
 * `preserveAspectRatio="none"` : chaque drapeau remplit exactement la pastille (léger
 * étirement imperceptible à cette taille), pour éviter les bandes vides autour.
 */
const FLAGS: Record<string, ReactNode> = {
  // France — tricolore vertical.
  fr: (
    <svg viewBox="0 0 3 2" preserveAspectRatio="none" className="h-full w-full">
      <rect width="1" height="2" x="0" fill="#0055A4" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#EF4135" />
    </svg>
  ),
  // Royaume-Uni — Union Jack.
  en: (
    <svg viewBox="0 0 60 30" preserveAspectRatio="none" className="h-full w-full">
      <clipPath id="langflag-uk"><path d="M0 0v30h60V0z" /></clipPath>
      <clipPath id="langflag-uk2"><path d="M30 15h30v15zv15H0zH0V0zV0h30z" /></clipPath>
      <g clipPath="url(#langflag-uk)">
        <path d="M0 0v30h60V0z" fill="#012169" />
        <path d="M0 0 60 30m0-30L0 30" stroke="#FFFFFF" strokeWidth="6" />
        <path d="M0 0 60 30m0-30L0 30" clipPath="url(#langflag-uk2)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30 0v30M0 15h60" stroke="#FFFFFF" strokeWidth="10" />
        <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  ),
  // Allemagne — noir/rouge/or horizontal.
  de: (
    <svg viewBox="0 0 5 3" preserveAspectRatio="none" className="h-full w-full">
      <rect width="5" height="1" y="0" fill="#000000" />
      <rect width="5" height="1" y="1" fill="#DD0000" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  ),
  // Espagne — rouge/jaune/rouge (bande jaune double).
  es: (
    <svg viewBox="0 0 4 3" preserveAspectRatio="none" className="h-full w-full">
      <rect width="4" height="3" fill="#AA151B" />
      <rect width="4" height="1.5" y="0.75" fill="#F1BF00" />
    </svg>
  ),
  // Portugal — vert/rouge + pastille (sphère armillaire stylisée).
  pt: (
    <svg viewBox="0 0 30 20" preserveAspectRatio="none" className="h-full w-full">
      <rect width="30" height="20" fill="#DA291C" />
      <rect width="12" height="20" fill="#046A38" />
      <circle cx="12" cy="10" r="3.4" fill="#FFE900" stroke="#DA291C" strokeWidth="0.6" />
    </svg>
  ),
};

export function LangFlag({ code, className = "" }: { code: string; className?: string }) {
  const flag = FLAGS[code];
  if (!flag) return null;
  return (
    <span className={`inline-block overflow-hidden rounded-[3px] ring-1 ring-black/10 ${className}`}>
      {flag}
    </span>
  );
}
