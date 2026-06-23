import type { CSSProperties } from "react";

// Wordmark Pacevo — concept retenu : Anton condensé en capitales, le « V »
// en émeraude qui rappelle la flèche ascendante du logo.
// `tone` adapte la couleur au fond (clair = lettres sombres, sombre = lettres blanches).
// Composant serveur pur — utilisable partout.
export function Wordmark({
  className = "",
  tone = "dark",
  style,
}: {
  className?: string;
  tone?: "dark" | "light";
  style?: CSSProperties;
}) {
  const base = tone === "light" ? "text-white" : "text-zinc-900";
  const accent = tone === "light" ? "text-[#34d399]" : "text-[#059669]";
  return (
    <span
      className={`font-sport uppercase tracking-[-0.01em] leading-none select-none ${base} ${className}`}
      style={style}
    >
      Pace<span className={accent}>v</span>o
    </span>
  );
}
