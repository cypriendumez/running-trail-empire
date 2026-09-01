/**
 * TEXTE DES SÉANCES — ce que le calendrier montre, et ce qu'il replie.
 *
 * Sorti du composant pour être crash-testable : ces deux fonctions décident de ce que
 * l'athlète LIT dans une case de calendrier ou sous un avertissement. Une erreur ici ne
 * plante rien — elle affiche une phrase coupée, ou la mauvaise moitié d'une séance.
 */

// Extrait le CORPS d'une séance : retire un éventuel échauffement en tête et un retour au calme en queue
// (séparés par →), en recollant les fragments de simple progression de zone (« … FC Z1 → Z2 »).
export function stripBodyLabel(s: string): string {
  return (s || "").replace(/^(?:corps(?:\s+de\s+s[ée]ance)?|main\s*set|hauptteil|parte\s+principal)\s*[:：]?\s*/i, "").trim();
}
export function extractBody(raw: string): string {
  let segs = raw.split("→").map((x) => x.trim()).filter(Boolean);
  // Recolle « Z1 → Z2 » (progression interne d'une phase) au segment précédent — ce n'est pas une étape à part.
  const merged: string[] = [];
  for (const seg of segs) {
    if (merged.length && /^z\d(?:\s*[-–]\s*z?\d)?$/i.test(seg)) merged[merged.length - 1] += ` → ${seg}`;
    else merged.push(seg);
  }
  segs = merged;
  if (segs.length <= 1) return stripBodyLabel(segs[0] ?? raw);
  const isWarm = (x: string) => /échauff|warm[- ]?up|aufwärm|calent|aquec/i.test(x);
  const isCool = (x: string) => /retour au calme|cool[- ]?down|auslauf|vuelta a la calma|retorno|à la calma|\bcalma\b/i.test(x);
  let lo = 0, hi = segs.length - 1;
  if (isWarm(segs[lo])) {
    lo++;
    while (lo < hi && /^z\d/i.test(segs[lo])) lo++; // absorbe la suite de l'échauffement (« Z2 + lignes droites »)
  }
  if (hi > lo && isCool(segs[hi])) hi--;
  const mid = segs.slice(lo, hi + 1);
  return stripBodyLabel((mid.length ? mid : segs).join(" → "));
}

/** Première phrase d'un avertissement — ce qui doit rester lisible sans déplier.
 *  On coupe au premier point SUIVI D'UNE MAJUSCULE : couper au premier point tout court
 *  casserait sur « catégorie Espoir / U23. » ou sur une abréviation. Si aucune coupure
 *  propre n'existe, on rend un extrait borné plutôt que rien — un avertissement muet
 *  serait pire qu'un avertissement tronqué. */
export function premierePhrase(texte: string): string {
  const brut = String(texte ?? "").trim();
  if (!brut) return "";
  // ⚠️ LA FENÊTRE ÉTAIT TROP COURTE. Bornée à 200 caractères, elle ne trouvait aucune
  //    fin de phrase dans l'avertissement réel (la première tombe au 270ᵉ) et retombait
  //    sur la troncature : l'athlète lisait « … mais c'est l'effort le p… ». Un
  //    avertissement coupé en plein élan avertit mal. On cherche donc jusqu'à 320
  //    caractères une VRAIE fin de phrase, et la troncature ne sert que de dernier
  //    recours — un avertissement tronqué reste préférable à pas d'avertissement.
  const m = brut.match(/^([\s\S]{20,320}?[.!?])\s+[A-ZÀ-Þ«]/);
  if (m) return m[1];
  return brut.length <= 320 ? brut : brut.slice(0, 317).replace(/\s+\S*$/, "") + "…";
}
