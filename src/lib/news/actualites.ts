import { unstable_cache } from "next/cache";
import { UA_PACEVOBOT } from "@/lib/races/robot";
import { QUERIES, FILTRES, type Cat } from "@/lib/news/rubriques";
import { decodeEntites as decode, texteDuFlux } from "@/lib/news/rss";

/**
 * L'ACTUALITÉ AGRÉGÉE — une fonction, partagée par l'API et par la page.
 *
 * ⚠️ POURQUOI CE MODULE (29/09/2026, Cyprien : « quand je clique sur l'actualité, les
 * images et les textes mettent trop de temps »). Trois causes, mesurées dans le code :
 *   1. `Promise.all` attendait le flux LE PLUS LENT de la dizaine interrogée, jusqu'à 12 s :
 *      un seul média qui traîne, et la page restait vide.
 *   2. Le cache était une `Map` en mémoire : chaque nouvelle instance serverless repartait
 *      de zéro, et la réponse n'avait aucun en-tête de cache.
 *   3. La page s'affichait vide, puis le navigateur demandait les articles.
 * Désormais : une LIMITE de temps (on sert ce qui est arrivé), un cache PARTAGÉ entre les
 * instances (`unstable_cache`, 30 min), et la page rend le fil côté serveur.
 */

/** Un flux qui ne répond pas en 6 s ne répondra pas utilement. */
const DELAI_FLUX_MS = 6000;
/** Au-delà, on sert ce qui est arrivé plutôt que d'attendre les retardataires. */
export const DELAI_TOTAL_MS = 5000;

// Actualité running/trail agrégée depuis des FLUX RSS publics : Google News (syndication
// prévue pour ça) + des médias spécialisés (RSS public de chaque éditeur). On n'affiche
// que titre + source + lien (clic → site source). Aucun article copié → légal.

// Médias spécialisés (flux RSS publics vérifiés). `cats` = catégories où le flux est pertinent.
/**
 * `langue` = celle dans laquelle CE MÉDIA écrit ses titres.
 *
 * ⚠️ Sans elle, un abonné français recevait des titres en anglais. Les résumés étaient
 * bien traduits — les titres, jamais : ils sortaient du flux tels quels et personne ne
 * savait dire s'il fallait les traduire. La moitié des sources d'« Élites » et de
 * « Nutrition » écrivent en anglais.
 */
type Feed = { url: string; source: string; domain: string; cats: Cat[]; langue: "fr" | "en" };
const FEEDS: Feed[] = [
  // — Francophones —
  { url: "https://www.lepape-info.com/feed/", source: "Lepape Info", domain: "lepape-info.com", cats: ["all", "running", "marathon", "gear"], langue: "fr" },
  { url: "https://u-run.fr/feed", source: "U-Run", domain: "u-run.fr", cats: ["all", "running", "trail", "marathon"], langue: "fr" },
  { url: "https://www.jogging-international.net/feed", source: "Jogging International", domain: "jogging-international.net", cats: ["all", "running", "marathon"], langue: "fr" },
  { url: "https://running-addict.fr/feed/", source: "Running Addict", domain: "running-addict.fr", cats: ["all", "running", "gear"], langue: "fr" },
  { url: "https://esprit-trail.com/feed/", source: "Esprit Trail", domain: "esprit-trail.com", cats: ["all", "trail", "ultra"], langue: "fr" },
  { url: "https://nakan.ch/wp/feed/", source: "Nakan", domain: "nakan.ch", cats: ["all", "trail", "running", "gear"], langue: "fr" },
  // — Internationaux —
  { url: "https://www.runnersworld.com/rss/all.xml/", source: "Runner's World", domain: "runnersworld.com", cats: ["all", "running", "marathon", "gear"], langue: "en" },
  { url: "https://www.irunfar.com/feed", source: "iRunFar", domain: "irunfar.com", cats: ["all", "trail", "ultra", "elite"], langue: "en" },
  { url: "https://www.trailrunnermag.com/feed", source: "Trail Runner", domain: "trailrunnermag.com", cats: ["all", "trail", "ultra", "elite"], langue: "en" },
  { url: "https://believeintherun.com/feed/", source: "Believe in the Run", domain: "believeintherun.com", cats: ["all", "gear", "running"], langue: "en" },
  // — Ajoutés pour la lettre du lundi (nutrition + élites), vérifiés un par un le 21/08/2026 —
  // podiumrunner.com et outsideonline.com/rss/running renvoyaient 404 : ils ne sont pas ici.
  // ⚠️ Pas dans « elite » : LetsRun couvre l'athlétisme sur PISTE (Diamond League, 1500 m)
  // et publie plusieurs fois par jour. Il remplissait les trois places de la rubrique
  // Élites avec du 1500 m, alors que cette rubrique existe pour les stars du trail.
  { url: "https://www.letsrun.com/feed/", source: "LetsRun", domain: "letsrun.com", cats: ["all", "running", "marathon"], langue: "en" },
  { url: "https://runningmagazine.ca/feed/", source: "Canadian Running", domain: "runningmagazine.ca", cats: ["all", "running", "marathon", "elite", "gear"], langue: "en" },
  { url: "https://marathonhandbook.com/feed/", source: "Marathon Handbook", domain: "marathonhandbook.com", cats: ["all", "running", "marathon", "nutrition"], langue: "en" },
  // Le blog d'Asker Jeukendrup, chercheur en nutrition sportive. Il publie peu — c'est
  // voulu de le garder : c'est la source la plus solide de la rubrique.
  { url: "https://www.mysportscience.com/blog-feed.xml", source: "MySportScience", domain: "mysportscience.com", cats: ["nutrition"], langue: "en" },
];

export type Item = { title: string; source: string; link: string; date: string; domain: string; favicon: string; texte?: string; langue: "fr" | "en" };

function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}
// Parse un flux RSS. Si defaultSource/Domain fournis (média spécialisé), on les utilise ;
// sinon on lit la balise <source> (format Google News → vrai éditeur).
function parseRss(xml: string, defaultSource?: string, defaultDomain?: string, langue: "fr" | "en" = "fr"): Item[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const b = m[1];
    const pick = (re: RegExp) => decode(b.match(re)?.[1] ?? "");
    let title = pick(/<title>([\s\S]*?)<\/title>/);
    const srcM = b.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/);
    const sourceUrl = srcM?.[1]?.match(/url="([^"]*)"/)?.[1] ?? "";
    const gnSource = decode(srcM?.[2] ?? "");
    const source = defaultSource || gnSource || "Actualité";
    if (gnSource && title.endsWith(" - " + gnSource)) title = title.slice(0, -(gnSource.length + 3)).trim();
    // <link> standard, sinon attribut href (Atom).
    let link = pick(/<link>([\s\S]*?)<\/link>/);
    if (!link) link = b.match(/<link[^>]*href="([^"]*)"/)?.[1] ?? "";
    const domain = defaultDomain || hostOf(sourceUrl) || hostOf(link);
    return {
      title,
      source,
      link,
      date: pick(/<pubDate>([\s\S]*?)<\/pubDate>/) || pick(/<dc:date>([\s\S]*?)<\/dc:date>/) || pick(/<updated>([\s\S]*?)<\/updated>/),
      domain,
      favicon: domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : "",
      // Servi UNIQUEMENT sur demande (voir plus bas) : 2 600 caractères par article
      // alourdiraient de plus de 100 ko la réponse que lit le fil Communauté.
      texte: texteDuFlux(b).slice(0, 2600) || undefined,
      // Google News est interrogé en `hl=fr&gl=FR` : ce qu'il remonte est francophone.
      langue,
    };
  }).filter((i) => i.title && i.link);
}

async function fetchFeed(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA_PACEVOBOT }, signal: AbortSignal.timeout(DELAI_FLUX_MS) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();


/**
 * Collecte, fusionne, trie. N'attend JAMAIS plus de `DELAI_TOTAL_MS` : les flux arrivés
 * à temps sont servis, les autres le seront au prochain rafraîchissement du cache.
 */
export async function collecterActualites(cat: Cat): Promise<Item[]> {
  const merged = await fusionner([QUERIES[cat]], FEEDS.filter((f) => f.cats.includes(cat)), DELAI_TOTAL_MS);
  const filtre = FILTRES[cat];
  return (filtre ? merged.filter((it) => filtre.test(it.title)) : merged).slice(0, 48);
}

const urlGoogleNews = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;

/**
 * Les requêtes qui couvrent LA SEMAINE pour la une de la lettre.
 *
 * ⚠️ Une seule requête ne suffit pas, mesuré le 09/11/2026 : Google Actualités rend au
 * plus 100 articles par requête, et « course à pied OR trail OR marathon » n'en contenait
 * qu'UN sur la backyard de Clem qui court, l'événement de la semaine. « trail » seul en
 * contenait 12, « running » 5, « marathon » aucun. Chaque requête voit une autre partie
 * de l'actualité ; leur union approche la semaine entière.
 * `when:7d` borne la recherche à la semaine écoulée.
 */
export const REQUETES_SEMAINE = [
  "course à pied", "trail", "marathon", "running", "coureur",
  "ultra-trail OR ultramarathon OR backyard",
].map((q) => `${q} when:7d`);

/**
 * TOUTE l'actualité des sept derniers jours, pour la une de la lettre.
 *
 * ⚠️ La lettre lisait le fil du site, coupé à 48 articles : lundi 9/11, le 48e datait de
 * dimanche 9 h 42 (Marathon Handbook avait publié sept articles dans la même minute) et
 * l'article sur la backyard, publié samedi, n'existait déjà plus pour elle. La lettre
 * couvre une semaine : elle lit la semaine, sans plafond.
 */
export async function collecterSemaine(maintenant = Date.now()): Promise<Item[]> {
  const depuis = maintenant - 7 * 24 * 3600 * 1000;
  // Une fois par semaine, on peut attendre les flux plus longtemps que pour le fil.
  const tout = await fusionner(REQUETES_SEMAINE, FEEDS.filter((f) => f.cats.includes("all")), DELAI_FLUX_MS + 2000);
  return tout.filter((it) => {
    const t = new Date(it.date).getTime();
    return Number.isFinite(t) && t >= depuis;
  });
}

/**
 * La nutrition de la semaine, pour la rubrique du même nom.
 *
 * ⚠️ La rubrique est sortie VIDE le 9/11/2026 alors que Google Actualités comptait, la
 * même semaine, 28 articles pour « nutrition course à pied » (« Régularité, nutrition,
 * confiance… les trois conseils d'un coach », Ouest-France). La lettre lisait le fil
 * « nutrition » du site : une requête SANS borne de date et deux flux anglophones qui
 * publient peu, puis gardait la semaine. Il ne restait rien.
 * « nutrition sportive » n'en fait pas partie : elle remonte surtout l'industrie
 * (« prévisions du marché des produits de nutrition sportive à l'horizon 2035 »).
 */
export const REQUETES_NUTRITION = [
  "nutrition course à pied", "nutrition running", "alimentation coureur", "hydratation course",
].map((q) => `${q} when:7d`);

export async function collecterNutritionSemaine(maintenant = Date.now()): Promise<Item[]> {
  const depuis = maintenant - 7 * 24 * 3600 * 1000;
  const tout = await fusionner(REQUETES_NUTRITION, FEEDS.filter((f) => f.cats.includes("nutrition")), DELAI_FLUX_MS + 2000);
  return tout.filter((it) => {
    const t = new Date(it.date).getTime();
    return Number.isFinite(t) && t >= depuis;
  });
}

/** Interroge Google Actualités et les flux, fusionne, dédoublonne, trie du plus récent au plus ancien. */
async function fusionner(requetes: string[], feeds: Feed[], delaiTotal: number): Promise<Item[]> {
  const arrives: Item[][] = [];
  // Google News + flux spécialisés pertinents, en parallèle (tolérant aux pannes).
  const jobs: Promise<void>[] = [
    ...requetes.map((q) => fetchFeed(urlGoogleNews(q)).then((x) => parseRss(x))),
    ...feeds.map((f) => fetchFeed(f.url).then((x) => parseRss(x, f.source, f.domain, f.langue))),
  ].map((p) => p.then((items) => { arrives.push(items); }, () => undefined));
  await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, delaiTotal))]);

  // Fusion + dédoublonnage (par lien ET par titre normalisé) + tri par date décroissante.
  const seen = new Set<string>();
  const merged: Item[] = [];
  for (const list of [...arrives]) {
    for (const it of list) {
      const key = it.link.split("?")[0];
      const tkey = norm(it.title).slice(0, 60);
      if (!key || seen.has(key) || (tkey && seen.has(tkey))) continue;
      seen.add(key); if (tkey) seen.add(tkey);
      merged.push(it);
    }
  }
  merged.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
  return merged;
}

/**
 * La même chose, en cache PARTAGÉ (30 min) : toutes les instances et tous les athlètes
 * lisent le même résultat. ⚠️ Un résultat VIDE n'est pas mis en cache (il lève) : sans
 * cela, une panne de réseau passagère aurait figé « aucune actualité » pendant 30 min.
 */
export const actualitesEnCache = unstable_cache(async (cat: Cat) => {
  const items = await collecterActualites(cat);
  if (!items.length) throw new Error("aucun flux n'a répondu");
  return items;
}, ["actualites-v1"], { revalidate: 1800 });

/** Ce que voit le fil : sans le texte intégral (2 600 caractères par article, pour la lettre seulement). */
export const sansTexte = (items: Item[]) => items.map(({ texte: _t, ...r }) => r);
