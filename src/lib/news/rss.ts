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

/**
 * LE TEXTE QUE L'ÉDITEUR PUBLIE LUI-MÊME DANS SON FLUX.
 *
 * ⚠️ Mesuré le 21/08/2026 : sur 16 articles, 13 pages étaient téléchargeables depuis un
 * poste de travail et seulement 9 depuis Vercel. Plusieurs éditeurs refusent une requête
 * venant d'un hébergeur là où ils acceptent un navigateur. On NE se fait PAS passer pour
 * un navigateur : c'est leur choix, et le contourner reviendrait à le nier.
 *
 * On utilise à la place `content:encoded`, le champ que le format RSS réserve au texte
 * intégral et que ces mêmes éditeurs remplissent EXPRÈS pour les agrégateurs — iRunFar y
 * met 16 700 caractères, Trail Runner 18 200. C'est offert, pas pris.
 *
 * `description` n'est PAS un repli acceptable : elle fait 150 à 500 caractères, soit un
 * chapeau. « Résumer » un chapeau revient à le recopier, ce que cette lettre s'interdit.
 * Le seuil de longueur écarte ce cas de lui-même.
 */
export function texteDuFlux(bloc: string): string {
  const m = bloc.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
  if (!m) return "";
  const html = m[1].replace(/<!\[CDATA\[|\]\]>/g, "");
  const sansBruit = html.replace(/<(script|style|figure|figcaption)[\s\S]*?<\/\1>/gi, "");

  // Les paragraphes seulement : un flux WordPress embarque des blocs de partage, des
  // encarts d'abonnement et des légendes qui ne disent rien de l'article.
  const paras: string[] = [];
  for (const p of sansBruit.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = decodeEntites(p[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
    if (t.length >= 90) paras.push(t);
  }
  return paras.join("\n\n").trim();
}
