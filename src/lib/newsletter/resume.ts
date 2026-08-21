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
const RESUMES_MAX = 10;

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
export async function resumerArticles(
  articles: Article[],
): Promise<{ articles: ArticleResume[]; diagnostic: Diagnostic }> {
  const retenus = articles.slice(0, RESUMES_MAX);
  const sources = await Promise.all(retenus.map((a) => texteArticle(a.link)));

  const lisibles = retenus
    .map((a, i) => ({ a, i, src: sources[i] }))
    .filter((x): x is { a: Article; i: number; src: string } => Boolean(x.src));

  // Aucun article accessible (sites qui bloquent, réseau) : on rend les titres seuls.
  if (!lisibles.length) return { articles: retenus.map((a) => ({ ...a, resume: null })), diagnostic: "aucun-article-lisible" };

  const bloc = lisibles
    .map((x, n) => `### ARTICLE ${n}\nTitre : ${x.a.title}\nSource : ${x.a.source}\nTexte : ${x.src}`)
    .join("\n\n");

  // ⚠️ 1 400 JETONS DE SORTIE NE SUFFISENT PAS, et l'échec était INVISIBLE : la réponse
  // se coupait en plein mot, le JSON ne s'analysait plus, et la fonction rendait
  // silencieusement des titres seuls. Les modèles Gemini 2.5 dépensent une part de ce
  // budget en raisonnement interne AVANT d'écrire : il faut compter large.
  const res = await generateContent(
    [{ role: "user", parts: [{ text: `${CONSIGNE}\n\n${bloc}` }] }],
    { temperature: 0.2, maxOutputTokens: 6000 },
  );

  // Gemini indisponible ou quota épuisé : la lettre part quand même, en titres seuls.
  if (!res.ok) return { articles: retenus.map((a) => ({ ...a, resume: null })), diagnostic: "modele-indisponible" };

  let brut: { i: number; r: string }[] = [];
  try {
    const j = res.text.match(/\[[\s\S]*\]/);
    brut = j ? (JSON.parse(j[0]) as { i: number; r: string }[]) : [];
  } catch {
    return { articles: retenus.map((a) => ({ ...a, resume: null })), diagnostic: "reponse-illisible" };
  }

  const parIndex = new Map<number, string>();
  for (const e of brut) if (typeof e?.i === "number" && typeof e?.r === "string") parIndex.set(e.i, e.r.trim());

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
    articles: retenus.map((a) => ({ ...a, resume: resumes.get(a.link) ?? null })),
    // Tout rejeté alors que le modèle a répondu : soit il a refusé de résumer, soit le
    // contrôle des chiffres a tout écarté. Dans les deux cas ça mérite d'être vu.
    diagnostic: resumes.size ? "ok" : "tous-rejetes",
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
): Promise<string[] | null> {
  const cible = LANGUES[lang];
  if (!cible || !resumes.length) return null;

  const res = await generateContent(
    [{
      role: "user",
      parts: [{
        text: `Traduis en ${cible} chacun des textes suivants. Conserve EXACTEMENT les nombres, les noms propres et les unités — ne les convertis pas, ne les arrondis pas. Garde le ton direct et la longueur.
Réponds UNIQUEMENT par un tableau JSON de chaînes, dans le même ordre.

${JSON.stringify(resumes)}`,
      }],
    }],
    // Même raison que ci-dessus : le raisonnement interne mange le budget de sortie.
    { temperature: 0.1, maxOutputTokens: 6000 },
  );
  if (!res.ok) return null;

  try {
    const j = res.text.match(/\[[\s\S]*\]/);
    const arr = j ? (JSON.parse(j[0]) as unknown[]) : [];
    if (arr.length !== resumes.length) return null;
    const out = arr.map((x) => String(x ?? "").trim());
    // Même contrôle, appliqué à la traduction contre son original français : c'est le
    // seul moyen d'attraper un modèle qui « adapte » un nombre en changeant de langue.
    for (const [i, t] of out.entries()) if (!t || !chiffresVerifies(t, resumes[i])) return null;
    return out;
  } catch {
    return null;
  }
}
