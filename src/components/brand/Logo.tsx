import type { CSSProperties } from "react";

// Logo Pacevo — rendu de l'icône officielle (P + flèche ascendante sur tuile émeraude),
// le fichier réel public/pacevo-logo.png (master nettoyé). Coins arrondis appliqués en CSS
// pour l'affichage in-app (l'icône d'app reste carrée plein cadre côté public/icon-*.png).
// Les props sont conservées pour compatibilité avec tous les appels existants.
// Composant serveur pur (aucun hook) → utilisable partout.
export function Logo({
  size = 40,
  className = "",
  style,
}: {
  size?: number;
  variant?: "tile" | "mark" | "white";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/pacevo-logo.png"
      alt="Pacevo"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: Math.round(size * 0.26), display: "block", ...style }}
    />
  );
}
