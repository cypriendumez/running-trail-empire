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
  // Le « v » ÉTAIT déjà en émeraude, mais il ne se LISAIT pas comme tel : #34d399 est un
  // vert menthe pâle, et posé en Anton à 20 px au milieu de capitales blanches, sur la
  // piste rouge chaude du hero, l'œil le range avec le blanc. On monte donc la saturation
  // (#10d68a) et on décolle la lettre du fond par une ombre portée sur fond sombre — la
  // couleur ne suffit pas, c'est le CONTRASTE avec les lettres voisines qui manquait.
  const accent = tone === "light"
    ? "text-[#10d68a] [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]"
    : "text-[#059669]";
  return (
    <span
      className={`font-sport uppercase tracking-[-0.01em] leading-none select-none ${base} ${className}`}
      style={style}
    >
      Pace<span className={accent}>v</span>o
    </span>
  );
}
