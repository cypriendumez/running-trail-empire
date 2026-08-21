/**
 * DÉCODAGE DES ENTITÉS HTML DES FLUX RSS.
 *
 * ⚠️ Seules les entités NOMMÉES étaient traitées. Les flux WordPress encodent en
 * NUMÉRIQUE : LetsRun titre « Cole Hocker &#038; the Olympic final », qui arrivait tel
 * quel — « &#038; » au milieu d'une phrase — dans la lettre envoyée le lundi matin. Le
 * fil Communauté l'affichait de la même façon depuis toujours ; personne ne l'avait vu
 * parce qu'aucun flux francophone n'encodait ainsi.
 *
 * On traite donc le cas général (&#38; décimal, &#x26; hexadécimal) AVANT les noms.
 */
export function decodeEntites(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => sur(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => sur(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rsquo;/g, "’")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Un point de code hors norme ne doit pas faire tomber tout le flux. */
function sur(n: number): string {
  try { return String.fromCodePoint(n); } catch { return ""; }
}
