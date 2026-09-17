import { RESEAUX } from "@/lib/brand/reseaux";

/**
 * LES RÉSEAUX DE PACEVO, EN LOGOS.
 *
 * `lucide-react` ne fournit PAS de logos de marque (ils ont été retirés de la
 * bibliothèque pour raisons de licence) : les trois glyphes sont donc dessinés ici, en
 * SVG inline. Ils héritent de `currentColor`, donc ils suivent la couleur du texte
 * autour — pas de PNG à charger, pas de requête réseau, rendu net à toute taille.
 *
 * ⚠️ `rel="noopener noreferrer"` sur chaque lien : sans `noopener`, la page ouverte peut
 * manipuler la nôtre via `window.opener`. Et `target="_blank"` parce qu'un visiteur qui
 * part sur TikTok ne doit pas perdre la page où il était.
 */
const GLYPHES: Record<string, React.ReactNode> = {
  tiktok: (
    <path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  ),
  // Dessiné au trait (rectangle + objectif + témoin) plutôt qu'en un seul chemin plein :
  // à 18 px, le contour reste lisible là où le glyphe plein devient une tache.
  instagram: (
    <>
      <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="5.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.6" cy="6.4" r="1.35" />
    </>
  ),
  linkedin: (
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.59 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
  ),
};

export function SocialLinks({ className = "", tone = "clair" }: { className?: string; tone?: "clair" | "sombre" }) {
  const base = tone === "sombre"
    ? "text-white/70 ring-white/15 hover:text-white hover:bg-white/10 hover:ring-white/30"
    : "text-zinc-500 ring-zinc-200 hover:text-[#059669] hover:bg-emerald-50 hover:ring-emerald-200";
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {RESEAUX.map((r) => (
        <a
          key={r.cle}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${r.nom} — Pacevo`}
          title={r.nom}
          className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset transition-colors ${base}`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
            {GLYPHES[r.cle]}
          </svg>
        </a>
      ))}
    </div>
  );
}
