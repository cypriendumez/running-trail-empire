import type { CSSProperties } from "react";

// Logo Pacevo — un « P » blanc dont la base se prolonge en flèche ascendante (allure + progression).
// variant "tile" : symbole blanc sur tuile émeraude (icône d'app, en-têtes).
// variant "mark" : symbole émeraude sur fond transparent (fonds clairs).
// variant "white" : symbole blanc sur fond transparent (fonds sombres).
// Composant serveur pur (aucun hook) → utilisable partout.
export function Logo({
  size = 40,
  variant = "tile",
  className = "",
  style,
}: {
  size?: number;
  variant?: "tile" | "mark" | "white";
  className?: string;
  style?: CSSProperties;
}) {
  const stroke = variant === "mark" ? "#059669" : "#ffffff";
  const radius = Math.round(size * 0.26);
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} style={style} role="img" aria-label="Pacevo">
      {variant === "tile" && (
        <>
          <defs>
            <linearGradient id="pacevoTile" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1c6e56" />
              <stop offset="1" stopColor="#0a3a2d" />
            </linearGradient>
          </defs>
          <rect width="120" height="120" rx={radius} fill="url(#pacevoTile)" />
        </>
      )}
      <g transform="translate(8,12) scale(0.9)" fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
        <rect x="30" y="22" width="16" height="66" rx="8" fill={stroke} stroke="none" />
        <path d="M44 25 C78 25 78 60 44 60" strokeWidth="16" />
        <path d="M18 104 L46 74 L60 88 L102 38" strokeWidth="13" />
        <path d="M102 38 L82 41 M102 38 L99 60" strokeWidth="13" />
      </g>
    </svg>
  );
}
