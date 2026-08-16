import type { CSSProperties } from "react";

// Wordmark Pacevo — Anton condensé en capitales, le « E » en émeraude.
//
// POURQUOI LE E, ET PAS LE V. Le nom se découpe PAC·EVO — « Pace » et « Evo(lution) »
// PARTAGENT la même lettre : « PACE » finit dessus, « EVO » commence dessus. Une seule
// lettre porte donc les deux moitiés du nom, et c'est le seul endroit du mot où la
// couleur dit quelque chose. Le « V » était accentué depuis le 24/06 (commit 7f5109b) au
// motif qu'il « rappelle la flèche du logo » — un argument de forme, qui découpait le nom
// à un endroit où il n'y a pas de jointure : PACEV·O ne veut rien dire.
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
  // #34d399 est un vert menthe pâle : posé en Anton à 20 px au milieu de capitales
  // blanches, sur la piste rouge chaude du hero, l'œil le range avec le blanc. On monte
  // donc la saturation (#10d68a) et on décolle la lettre du fond par une ombre portée sur
  // fond sombre — la couleur ne suffit pas, c'est le CONTRASTE avec les lettres voisines
  // qui manquait.
  const accent = tone === "light"
    ? "text-[#10d68a] [text-shadow:0_1px_10px_rgba(0,0,0,0.35)]"
    : "text-[#059669]";
  return (
    <span
      className={`font-sport uppercase tracking-[-0.01em] leading-none select-none ${base} ${className}`}
      style={style}
    >
      Pac<span className={accent}>e</span>vo
    </span>
  );
}
