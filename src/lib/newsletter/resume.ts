import { generateContent } from "@/lib/ai/gemini";

/**
 * RÉSUMER L'ACTUALITÉ SANS RIEN INVENTER.
 *
 * Le résumé hebdomadaire n'envoyait que titre + source + lien. C'était juste sur le plan
 * du droit d'auteur, mais peu utile : personne ne lit une liste de titres. Il faut donc
 * résumer — et résumer est précisément l'opération qui fabrique des faits.
 *
 * ── LE RISQUE, ET IL EST DOCUMENTÉ ICI MÊME ──────────────────────────────────
 * Ce blog a dû retirer « le plan qui a marché pour 2 300 coureurs », « 94 % de
 * précision », « testé avec 80 coureurs ». Aucune de ces phrases n'a été écrite de
 * mauvaise foi : elles ont l'allure du vrai. Un modèle qui résume un article dans un
 * style journalistique produira exactement ce genre de chiffres, et personne ne les
 * relira avant l'envoi — c'est une tâche planifiée du lundi matin.
 *
 * ── LE GARDE-FOU : TOUT CHIFFRE DOIT EXISTER DANS LA SOURCE ──────────────────
 * Après génération, on extrait chaque suite de chiffres du résumé et on vérifie qu'elle
 * figure dans le texte de l'article. Un seul chiffre absent → le résumé est JETÉ et
 * l'entrée retombe sur son titre seul. C'est mécanique, ça ne dépend d'aucune bonne
 * volonté du modèle, et ça attrape précisément la faute qui nous a coûté une journée.
 *
 * Ce contrôle ne prouve pas que le résumé est fidèle — un modèle peut se tromper de
 * sens sans écrire un seul chiffre. Il élimine la catégorie d'erreur la plus grave et
 * la plus vérifiable ; le reste tient au fait que le lien vers la source est toujours là.
 *
 * ── CE QU'ON N'ÉCRIT PAS ─────────────────────────────────────────────────────
 * Pas de signature humaine. Le blog a déjà dû retirer un auteur « Équipe Pacevo » qui
 * n'avait rien écrit ; on ne va pas inventer une plume pour la newsletter. L'e-mail dit
 * ce qu'il est.
 */

export type Article = { title: string; source: string; link: string };
export type ArticleResume = Article & { resume: string | null };

/**
 * Pourquoi il n'y a pas de résumé, quand il n'y en a pas.
 *
 * ⚠️ Sans ce diagnostic, la panne est MUETTE : la lettre part en titres seuls et le
 * rapport dit « resumes: 0 » sans dire si les sites bloquent, si le quota est épuisé, ou
 * si la réponse était tronquée. C'est exactement ce qui s'est produit — un budget de
 * sortie trop bas coupait le JSON, et le repli a masqué le défaut deux essais de suite.
 */
export type Diagnostic =
  | "ok"
  | "aucun-article-lisible"
  | "modele-indisponible"
  | "reponse-illisible"
  | "tous-rejetes";

/** Longueur de texte source retenue par article. Au-delà, on n'apprend plus grand-chose. */
const SOURCE_MAX = 2600;
/** Au-delà, le coût de l'appel monte sans que le résumé s'améliore. */
/**
 * Combien d'articles on résume au plus.
 *
 * ⚠️ Ce plafond a failli vider des rubriques. La lettre choisit désormais jusqu'à 16
 * articles (5 à la une + 3 trail + 3 élites + 3 matériel + 2 nutrition) ; tant qu'il
 * valait 10, les six derniers n'étaient pas seulement privés de résumé — ils étaient
 * ABSENTS du tableau rendu, et les rubriques correspondantes sortaient vides sans que
 * rien ne le signale. Le plafond est relevé ET la fonction rend maintenant TOUS les
 * articles reçus (voir plus bas) : un décalage de plafond ne peut plus faire disparaître
 * une rubrique, au pire elle s'affiche en titres seuls.
 */
export const RESUMES_MAX = 16;

function decoder(t: string): string {
  return t
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#0?39;|&rsquo;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#8211;|&ndash;/g, "–").replace(/&#8217;/g, "'")
    .replace(/&[#a-z0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrait la PROSE d'une page, pas son balisage.
 *
 * ⚠️ PREMIÈRE VERSION FAUSSE, et elle passait tous les contrôles techniques : elle
 * retirait les balises puis gardait les 2 600 premiers caractères. Sur un site moderne,
 * ces 2 600 caractères sont le menu — sur iRunFar on récoltait « Best Trail Running
 * Shoes · Best Running Vests · Best Running Belts… » et rien de l'article. Le modèle
 * refusait alors de résumer, à juste titre : UN SEUL résumé sur six survivait, et la
 * lettre partait en titres seuls sans que rien ne signale l'anomalie. Le repli masquait
 * le défaut au lieu de le révéler.
 *
 * La prose d'un article vit dans des PARAGRAPHES longs ; la navigation, jamais. On ne
 * garde donc que les `<p>` d'au moins 90 caractères. C'est grossier, ça ne vaut pas un
 * extracteur de contenu, mais ça sépare le texte du décor sur la quasi-totalité des
 * sites de presse — et ça se vérifie en regardant ce qui sort.
 */
function texteBrut(html: string): string {
  // Si la page balise son contenu, on s'y limite : ça écarte d'emblée pieds de page,
  // encarts « à lire aussi » et blocs de commentaires.
  const zone = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1]
    ?? /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1]
    ?? html;

  const sansBruit = zone
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ");

  const paragraphes: string[] = [];
  for (const m of sansBruit.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = decoder(m[1].replace(/<[^>]+>/g, " "));
    if (t.length >= 90) paragraphes.push(t);
  }
  if (paragraphes.length) return paragraphes.join(" ");

  // Aucun paragraphe exploitable : on retombe sur la page entière décodée. Le contrôle
  // de longueur en aval décidera si ça vaut quelque chose.
  return decoder(sansBruit.replace(/<[^>]+>/g, " "));
}

/** Récupère le texte d'un article. `null` si le site refuse ou tarde — on n'insiste pas. */
export async function texteArticle(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PacevoNewsletter/1.0)" },
      signal: AbortSignal.timeout(9000),
      redirect: "follow",
    });
    if (!r.ok) return null;
    const t = texteBrut(await r.text());
    return t.length < 320 ? null : t.slice(0, SOURCE_MAX);
  } catch {
    return null;
  }
}

/**
 * Toutes les suites de chiffres d'un texte, espaces internes retirés.
 * « 2 300 coureurs » et « 2300 » donnent la même entrée : c'est le NOMBRE qu'on compare,
 * pas sa typographie. L'espace fine insécable des milliers français en dépend.
 */
function nombresDe(texte: string): string[] {
  const sansEspacesDeMilliers = texte.replace(/(\d)[\s  ](?=\d{3}\b)/g, "$1");
  return (sansEspacesDeMilliers.match(/\d+/g) ?? []).map((n) => n.replace(/^0+(?=\d)/, ""));
}

/**
 * Vrai si TOUS les nombres du résumé existent dans la source.
 * Exporté pour être testé : c'est la pièce qui empêche l'invention, elle doit être
 * vérifiable seule.
 */
export function chiffresVerifies(resume: string, source: string): boolean {
  const dansSource = new Set(nombresDe(source));
  return nombresDe(resume).every((n) => dansSource.has(n));
}

const CONSIGNE = `Tu résumes des articles de presse running et trail pour une lettre hebdomadaire.

RÈGLE ABSOLUE — TU N'AJOUTES RIEN QUI NE SOIT DANS LE TEXTE FOURNI.
Aucun chiffre, aucun nom, aucune date, aucun résultat qui ne figure pas mot pour mot dans
l'article. Si le texte ne donne pas de chiffre, ton résumé n'en contient aucun. Inventer
un pourcentage crédible est la faute la plus grave possible ici : le lecteur ne peut pas
la détecter, et elle est envoyée à toute une liste sans relecture.

TU NE CONVERTIS AUCUNE UNITÉ. Si l'article dit 10 000 mètres de dénivelé, tu écris
10 000 mètres — jamais 32 808 pieds. Une conversion est un nombre que l'article ne
contient pas, et elle est traitée comme une invention.

TU N'AJOUTES AUCUNE ANNÉE, même si tu la connais. Si l'article ne date pas la création
d'une course, ton résumé ne la date pas non plus. Écris « à sa création », pas « en 2007 ».

FORME — deux à trois phrases par article, en français, ton direct et concret. Tu dis ce
que l'article apprend, pas ce qu'il promet. Pas de superlatif, pas d'accroche creuse, pas
de formule de transition. Tu n'écris pas le titre : il est déjà affiché au-dessus.

Si un texte est trop pauvre pour être résumé honnêtement, renvoie une chaîne vide pour
cet article. Une entrée vide vaut mieux qu'un remplissage.

Réponds UNIQUEMENT par un tableau JSON : [{"i":0,"r":"…"},{"i":1,"r":"…"}]`;

/**
 * Résume une liste d'articles EN UN SEUL APPEL.
 *
 * Un appel par article multiplierait par dix la consommation du palier gratuit de Gemini
 * (20 requêtes/jour et par modèle, pour toute l'app) : la lettre du lundi épuiserait à
 * elle seule le quota de l'assistant et du coach.
 */
/**
 * LE RENDU — le seul endroit qui construit la liste sortante.
 *
 * ⚠️ Il y avait quatre `return` (trois replis + le chemin nominal) et trois d'entre eux
 * rendaient `retenus`, c'est-à-dire l'entrée TRONQUÉE au plafond. Un appelant qui
 * demandait plus d'articles que le plafond n'en recevait pas moins de résumés : il
 * recevait moins d'ARTICLES, et la rubrique qui comptait dessus s'affichait vide sans
 * un mot. Un seul rendu, qui part toujours de `articles`, rend la faute impossible.
 */
/**
 * LIT LES RÉSUMÉS D'UNE RÉPONSE, MÊME COUPÉE.
 *
 * ⚠️ `JSON.parse` sur le tableau entier est tout ou rien : une réponse tronquée en plein
 * mot n'a pas de crochet fermant, l'analyse échoue, et les DIX résumés déjà écrits avant
 * la coupure sont jetés avec elle. Mesuré : une réponse coupée à 1 099 caractères
 * contenait deux résumés complets et parfaitement utilisables.
 *
 * On récupère donc chaque objet complet un par un. Un objet coupé est ignoré — lui seul.
 */
export function extraireResumes(texte: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of texte.matchAll(/\{\s*"i"\s*:\s*(\d+)\s*,\s*"r"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g)) {
    try {
      out.set(Number(m[1]), JSON.parse(`"${m[2]}"`) as string);
    } catch { /* échappement invalide : cette entrée seule est perdue */ }
  }
  return out;
}

export function rendreTous(articles: Article[], resumes: Map<string, string>): ArticleResume[] {
  return articles.map((a) => ({ ...a, resume: resumes.get(a.link) ?? null }));
}

export async function resumerArticles(
  articles: Article[],
): Promise<{ articles: ArticleResume[]; diagnostic: Diagnostic; lisibles: number }> {
  const retenus = articles.slice(0, RESUMES_MAX);
  // Les articles au-delà du plafond ne sont pas résumés, mais ils restent dans le rendu :
  // un titre sans résumé se lit, une rubrique disparue ne se voit pas.
  const nus = (): ArticleResume[] => rendreTous(articles, new Map());
  const sources = await Promise.all(retenus.map((a) => texteArticle(a.link)));

  const lisibles = retenus
    .map((a, i) => ({ a, i, src: sources[i] }))
    .filter((x): x is { a: Article; i: number; src: string } => Boolean(x.src));

  // Aucun article accessible (sites qui bloquent, réseau) : on rend les titres seuls.
  if (!lisibles.length) return { articles: nus(), diagnostic: "aucun-article-lisible", lisibles: 0 };

  // ── LES LOTS ───────────────────────────────────────────────────────────────
  // ⚠️ Un seul appel pour tous les articles NE TIENT PAS. Mesuré le 21/08/2026 : un
  // prompt de 36 000 caractères pour 13 articles a produit une réponse coupée à 1 099
  // caractères — deux résumés sur treize — alors que le budget de sortie était de 9 000
  // jetons. Les modèles Gemini 2.5 dépensent ce budget en raisonnement AVANT d'écrire,
  // et le raisonnement grandit avec le prompt. Augmenter le budget ne fait que repousser
  // la limite : c'est déjà ce qui avait été fait en passant de 1 400 à 6 000.
  //
  // On découpe donc. Chaque lot a son propre budget, et une réponse ratée ne coûte que
  // son lot. Quatre appels hebdomadaires ne pèsent rien face au quota.
  const TAILLE_LOT = 4;
  const lots: (typeof lisibles)[] = [];
  for (let i = 0; i < lisibles.length; i += TAILLE_LOT) lots.push(lisibles.slice(i, i + TAILLE_LOT));

  // ⚠️ EN SÉRIE, LA LETTRE N'AURAIT PAS TENU. Mesuré : 102 secondes pour une seule
  // langue, quand la route coupe à 300. Avec des abonnés dans plusieurs langues (chaque
  // langue ajoute ses propres lots de traduction), la fonction dépassait le temps
  // imparti — et un dépassement ne dégrade pas la lettre, il l'annule POUR TOUT LE MONDE.
  // Les lots sont indépendants : ils partent ensemble.
  const reponses = await Promise.all(
    lots.map((lot) => {
      const bloc = lot
        .map((x, n) => `### ARTICLE ${n}\nTitre : ${x.a.title}\nSource : ${x.a.source}\nTexte : ${x.src}`)
        .join("\n\n");
      return generateContent(
        [{ role: "user", parts: [{ text: `${CONSIGNE}\n\n${bloc}` }] }],
        { temperature: 0.2, maxOutputTokens: 9000 },
      );
    }),
  );

  const parIndex = new Map<number, string>();
  let auMoinsUnLot = false;
  for (const [numLot, res] of reponses.entries()) {
    if (!res.ok) continue; // Ce lot part en titres seuls, les autres continuent.
    auMoinsUnLot = true;
    // Lecture TOLÉRANTE : une réponse coupée garde ses résumés complets.
    for (const [i, r] of extraireResumes(res.text)) {
      const absolu = numLot * TAILLE_LOT + i;
      if (absolu < lisibles.length) parIndex.set(absolu, r.trim());
    }
  }

  // Aucun lot n'a abouti : le modèle est indisponible ou le quota est épuisé.
  if (!auMoinsUnLot) return { articles: nus(), diagnostic: "modele-indisponible", lisibles: lisibles.length };
  if (!parIndex.size) return { articles: nus(), diagnostic: "reponse-illisible", lisibles: lisibles.length };

  const resumes = new Map<string, string>();
  for (const [n, x] of lisibles.entries()) {
    const r = parIndex.get(n);
    if (!r || r.length < 40) continue;
    // ⚠️ LE CONTRÔLE. Un chiffre absent de la source condamne tout le résumé, pas
    // seulement la phrase : on ne sait pas laquelle est fausse.
    if (!chiffresVerifies(r, x.src)) continue;
    resumes.set(x.a.link, r);
  }

  return {
    articles: rendreTous(articles, resumes),
    // Tout rejeté alors que le modèle a répondu : soit il a refusé de résumer, soit le
    // contrôle des chiffres a tout écarté. Dans les deux cas ça mérite d'être vu.
    diagnostic: resumes.size ? "ok" : "tous-rejetes",
    // ⚠️ Sans ce compte, « 6 résumés sur 16 » ne dit pas OÙ ils se perdent : des pages
    // qu'on n'a pas pu télécharger, ou des résumés rejetés par le contrôle des chiffres ?
    // Les deux se corrigent différemment, et le même code a rendu 9 en local contre 6
    // depuis Vercel — un écart qu'on ne pouvait qu'imaginer.
    lisibles: lisibles.length,
  };
}

const LANGUES: Record<string, string> = {
  en: "anglais", de: "allemand", es: "espagnol", pt: "portugais (du Portugal)",
};

/**
 * Traduit les résumés déjà VÉRIFIÉS, en un appel par langue.
 *
 * On traduit après le contrôle, jamais avant : traduire d'abord obligerait à revérifier
 * les chiffres dans quatre langues contre une source française, ce qui n'a pas de sens.
 * Et la consigne interdit explicitement de toucher aux nombres — une traduction qui
 * « arrondit » un chiffre sourcé le transforme en chiffre inventé.
 */
export async function traduireResumes(
  resumes: string[],
  lang: string,
): Promise<(string | null)[] | null> {
  const cible = LANGUES[lang];
  if (!cible || !resumes.length) return null;

  // ⚠️ CETTE FONCTION ÉTAIT DU TOUT OU RIEN, deux fois : un tableau de longueur
  // inattendue, ou UN SEUL résumé dont un chiffre ne concordait pas, et elle rendait
  // `null` — c'est-à-dire que TOUTE la langue retombait en titres seuls. Avec quatre
  // résumés c'était improbable ; avec seize, c'est le cas courant. Un abonné allemand
  // aurait perdu la lettre entière parce qu'une phrase sur seize posait problème.
  //
  // Désormais : des lots (même raison qu'au résumé — le raisonnement interne mange le
  // budget de sortie et coupe la réponse), et un rejet ne condamne que SA phrase.
  const TAILLE_LOT = 4;
  const out: (string | null)[] = new Array(resumes.length).fill(null);
  let auMoinsUnLot = false;

  const decoupe: string[][] = [];
  for (let d = 0; d < resumes.length; d += TAILLE_LOT) decoupe.push(resumes.slice(d, d + TAILLE_LOT));

  // En parallèle, pour la même raison qu'au résumé : chaque langue ajoute ses lots, et
  // la route entière coupe à 300 secondes.
  const reponses = await Promise.all(
    decoupe.map((lot) =>
      generateContent(
        [{
          role: "user",
          parts: [{
            text: `Traduis en ${cible} chacun des textes suivants. Conserve EXACTEMENT les nombres, les noms propres et les unités — ne les convertis pas, ne les arrondis pas. Garde le ton direct et la longueur.
Réponds UNIQUEMENT par un tableau JSON de chaînes, dans le même ordre.

${JSON.stringify(lot)}`,
          }],
        }],
        { temperature: 0.1, maxOutputTokens: 6000 },
      ),
    ),
  );

  for (const [k, res] of reponses.entries()) {
    if (!res.ok) continue;
    let arr: unknown[] = [];
    try {
      const j = res.text.match(/\[[\s\S]*\]/);
      arr = j ? (JSON.parse(j[0]) as unknown[]) : [];
    } catch { continue; }
    if (!Array.isArray(arr)) continue;
    auMoinsUnLot = true;

    decoupe[k].forEach((original, n) => {
      const t = String(arr[n] ?? "").trim();
      // Le contrôle reste ENTIER : une traduction qui « adapte » un nombre est rejetée.
      // Ce qui change, c'est le périmètre du rejet — cette phrase, pas la langue.
      if (t && chiffresVerifies(t, original)) out[k * TAILLE_LOT + n] = t;
    });
  }

  return auMoinsUnLot ? out : null;
}
