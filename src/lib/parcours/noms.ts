/**
 * RÉPARER LE NOM D'UN PARCOURS DU CATALOGUE — sans rien inventer.
 *
 * Cyprien, 27/11/2026 : « corrige les noms abîmés » (« Circuit de à » dans la liste, à
 * Rouen). Ces noms viennent TELS QUELS d'OpenStreetMap : la relation 13160012 s'y appelle
 * littéralement « Circuit de à », avec `from=fixme` et `to=fixme`. Le catalogue a déjà les
 * communes de départ et d'arrivée, géocodées par l'IGN (`depart`, `arrivee`) : c'est la
 * SEULE matière qu'on ajoute. Sans commune connue, on retire la partie vide, on ne la
 * remplit pas.
 *
 * Défauts traités (audit des 15 708 parcours, 27/11/2026) :
 *  · préposition orpheline : « Circuit de à », « Circuit de Sauqueville à » ;
 *  · marqueurs de travail OSM : « - fixme », « ?? » ;
 *  · entités HTML : « Circuit &quot;Etang de Beaumont&quot; » ;
 *  · nom entier entre parenthèses : « (Sentier marron) » ;
 *  · TOUT EN MAJUSCULES, préfixé d'un code : « 67:1 AUTOUR DU VILLAGE D'AUTRAN (VERT) » ;
 *  · code ou mot seul, illisible dans une liste : « REV 6 », « CCCE », « Bleu » → on y
 *    joint la commune de départ.
 */

export type ParcoursNomme = { nom: string; depart?: string | null; arrivee?: string | null };

const SIGLES = /^(vtt|gr|grp|pr|ev\d*|ffc|ffct|ffr|vtc|crt|cc|asp\d*|asptt|ucpa|ffa|onf|cdt|ffrs|ufolep|usep)$/i;
const PETITS = new Set(["de", "du", "des", "la", "le", "les", "à", "a", "au", "aux", "et", "en", "sur", "sous", "par", "pour", "d", "l", "un", "une"]);

// « None » : le None de Python, sérialisé tel quel par le crawl — pas une commune.
const commune = (c?: string | null) => (c && c.trim() && c.trim() !== "None" && !/fixme|\?/i.test(c) ? c.trim() : null);

function decoderEntites(s: string): string {
  return s
    .replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** « AUTOUR DU VILLAGE D'AUTRAN » → « Autour du village d'Autran » (mots courts en minuscules). */
function casserMajuscules(s: string): string {
  return s.toLowerCase().split(/(\s+|-|'|’|\()/).map((mot, i, tout) => {
    if (!mot || /^\s+$|^-$|^'$|^’$|^\($/.test(mot)) return mot;
    const avant = tout.slice(0, i).join("");
    const premier = !avant.trim();
    // Après une apostrophe (d'Autran, l'Étang) : le mot est un nom, on le capitalise.
    const apresApostrophe = /['’]$/.test(avant);
    if (!premier && !apresApostrophe && PETITS.has(mot)) return mot;
    // Les sigles restent en majuscules : « VTT 7 - TREGUEUX » → « VTT 7 - Tregueux ».
    if (SIGLES.test(mot)) return mot.toUpperCase();
    return mot.charAt(0).toUpperCase() + mot.slice(1);
  }).join("");
}

const estMajuscules = (s: string) => {
  const lettres = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return lettres.length >= 8 && lettres === lettres.toUpperCase();
};

/** Un nom qui ne dit rien seul dans une liste : un code (« REV 6 », « CCCE ») ou un mot court. */
const estCodeOuCourt = (s: string) =>
  // Les itinéraires connus par leur numéro gardent leur nom seul : GR 34, GRP, EV6, V40, PR 12.
  !/^(GR|GRP|EV|V|PR|HRP)\s?\d/i.test(s)
  && (/^[A-Z0-9][A-Z0-9 ._\-/]{0,7}$/.test(s) || s.replace(/[^A-Za-zÀ-ÿ]/g, "").length <= 5);

export function reparerNom(p: ParcoursNomme): string {
  const dep = commune(p.depart), arr = commune(p.arrivee);
  let s = decoderEntites(p.nom ?? "");

  // Marqueurs de travail d'OpenStreetMap : « fixme », « ?? », « X - ? », « ? - X ».
  s = s.replace(/\s*[-–—,]?\s*\bfixme\b\s*/gi, " ").replace(/\?{2,}|\s\?\s/g, " ");
  s = s.replace(/\s*[-–—]\s*\?\s*$/, "").replace(/^\s*\?\s*[-–—]\s*/, "").replace(/\s+\?$/, "");
  // « Claret(Bleu) » → « Claret (Bleu) ».
  s = s.replace(/([A-Za-zÀ-ÿ0-9])\(/g, "$1 (");
  s = s.replace(/\s{2,}/g, " ").trim();

  // Nom entier entre parenthèses.
  const paren = s.match(/^\((.+)\)$/);
  if (paren) s = paren[1].trim();

  // Code de réseau en tête d'un nom en majuscules (« 67:1 », « 67:11 »).
  if (estMajuscules(s)) s = casserMajuscules(s.replace(/^\d+[:.]\d+\s+/, ""));

  // Prépositions orphelines : « de à », « de X à », « de à X ».
  // ⚠️ PAS DE `\b` AUTOUR DE « à » : pour JavaScript, « à » n'est pas une lettre de mot, et
  // `\bà\b` ne s'accroche jamais — « Circuit de à » passait intact (essai du 27/11/2026).
  const m = s.match(/^(.*?(?:^|\s)de)(?:\s+(.*?))?\s+à(?:\s+(.*))?$/);
  if (m && (!(m[2] ?? "").trim() || !(m[3] ?? "").trim())) {
    const base = m[1].replace(/\s*de$/, "").trim();
    const a = (m[2] ?? "").trim() || dep, b = (m[3] ?? "").trim() || arr;
    if (a && b && a !== b) s = `${base} de ${a} à ${b}`;
    else if (a) s = `${base} de ${a}`;
    else if (b) s = `${base} jusqu'à ${b}`;
    else s = base;
  }
  // Préposition laissée seule en fin de nom, en MINUSCULES seulement : « Circuit de Toul
  // Du » (Toul Du, lieu breton) et « Circuit A » (circuits A, B, C) sont de vrais noms.
  s = s.replace(/\s+(de|du|des|à|au|aux|et)$/, "").replace(/[\s\-–—,:;]+$/, "").trim();

  if (!s) s = dep ? `Parcours de ${dep}` : "Parcours sans nom";

  // Un code ou un mot seul : la commune de départ le rend lisible (« REV 6 · Malaunay »).
  if (estCodeOuCourt(s) && dep && !s.includes(dep)) s = `${s} · ${dep}`;

  return s.charAt(0).toUpperCase() + s.slice(1);
}
