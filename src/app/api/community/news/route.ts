export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { QUERIES, FILTRES, estCat, type Cat } from "@/lib/news/rubriques";
import { decodeEntites as decode } from "@/lib/news/rss";

export const runtime = "nodejs";

// Actualité running/trail agrégée depuis des FLUX RSS publics : Google News (syndication
// prévue pour ça) + des médias spécialisés (RSS public de chaque éditeur). On n'affiche
// que titre + source + lien (clic → site source). Aucun article copié → légal.

// Médias spécialisés (flux RSS publics vérifiés). `cats` = catégories où le flux est pertinent.
type Feed = { url: string; source: string; domain: string; cats: Cat[] };
const FEEDS: Feed[] = [
  // — Francophones —
  { url: "https://www.lepape-info.com/feed/", source: "Lepape Info", domain: "lepape-info.com", cats: ["all", "running", "marathon", "gear"] },
  { url: "https://u-run.fr/feed", source: "U-Run", domain: "u-run.fr", cats: ["all", "running", "trail", "marathon"] },
  { url: "https://www.jogging-international.net/feed", source: "Jogging International", domain: "jogging-international.net", cats: ["all", "running", "marathon"] },
  { url: "https://running-addict.fr/feed/", source: "Running Addict", domain: "running-addict.fr", cats: ["all", "running", "gear"] },
  { url: "https://esprit-trail.com/feed/", source: "Esprit Trail", domain: "esprit-trail.com", cats: ["all", "trail", "ultra"] },
  { url: "https://nakan.ch/wp/feed/", source: "Nakan", domain: "nakan.ch", cats: ["all", "trail", "running", "gear"] },
  // — Internationaux —
  { url: "https://www.runnersworld.com/rss/all.xml/", source: "Runner's World", domain: "runnersworld.com", cats: ["all", "running", "marathon", "gear"] },
  { url: "https://www.irunfar.com/feed", source: "iRunFar", domain: "irunfar.com", cats: ["all", "trail", "ultra", "elite"] },
  { url: "https://www.trailrunnermag.com/feed", source: "Trail Runner", domain: "trailrunnermag.com", cats: ["all", "trail", "ultra", "elite"] },
  { url: "https://believeintherun.com/feed/", source: "Believe in the Run", domain: "believeintherun.com", cats: ["all", "gear", "running"] },
  // — Ajoutés pour la lettre du lundi (nutrition + élites), vérifiés un par un le 21/08/2026 —
  // podiumrunner.com et outsideonline.com/rss/running renvoyaient 404 : ils ne sont pas ici.
  // ⚠️ Pas dans « elite » : LetsRun couvre l'athlétisme sur PISTE (Diamond League, 1500 m)
  // et publie plusieurs fois par jour. Il remplissait les trois places de la rubrique
  // Élites avec du 1500 m, alors que cette rubrique existe pour les stars du trail.
  { url: "https://www.letsrun.com/feed/", source: "LetsRun", domain: "letsrun.com", cats: ["all", "running", "marathon"] },
  { url: "https://runningmagazine.ca/feed/", source: "Canadian Running", domain: "runningmagazine.ca", cats: ["all", "running", "marathon", "elite", "gear"] },
  { url: "https://marathonhandbook.com/feed/", source: "Marathon Handbook", domain: "marathonhandbook.com", cats: ["all", "running", "marathon", "nutrition"] },
  // Le blog d'Asker Jeukendrup, chercheur en nutrition sportive. Il publie peu — c'est
  // voulu de le garder : c'est la source la plus solide de la rubrique.
  { url: "https://www.mysportscience.com/blog-feed.xml", source: "MySportScience", domain: "mysportscience.com", cats: ["nutrition"] },
];

type Item = { title: string; source: string; link: string; date: string; domain: string; favicon: string };
const cache = new Map<string, { at: number; items: Item[] }>();
const TTL = 30 * 60 * 1000; // 30 min — on ne sur-sollicite pas les sources.

function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}
// Parse un flux RSS. Si defaultSource/Domain fournis (média spécialisé), on les utilise ;
// sinon on lit la balise <source> (format Google News → vrai éditeur).
function parseRss(xml: string, defaultSource?: string, defaultDomain?: string): Item[] {
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
    };
  }).filter((i) => i.title && i.link);
}

async function fetchFeed(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 RunningTrailEmpire/1.0" }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export async function GET(req: Request) {
  const demande = new URL(req.url).searchParams.get("cat") ?? "all";
  // ⚠️ Avant, une rubrique inconnue retombait sur la requête générale : l'appelant
  // recevait 200 et de l'actualité quelconque, qu'il affichait sous le titre demandé.
  // Une faute de frappe passait inaperçue. On refuse désormais.
  if (!estCat(demande)) {
    return NextResponse.json({ error: `Rubrique inconnue : ${demande}`, rubriques: Object.keys(QUERIES) }, { status: 400 });
  }
  const cat: Cat = demande;
  const hit = cache.get(cat);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ items: hit.items, cat, cached: true });

  const q = QUERIES[cat];
  const gnUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;
  const feeds = FEEDS.filter((f) => f.cats.includes(cat));

  // Google News + flux spécialisés pertinents, en parallèle (tolérant aux pannes).
  const jobs: Promise<Item[]>[] = [
    fetchFeed(gnUrl).then((x) => parseRss(x)).catch(() => []),
    ...feeds.map((f) => fetchFeed(f.url).then((x) => parseRss(x, f.source, f.domain)).catch(() => [])),
  ];
  const results = await Promise.all(jobs);

  // Fusion + dédoublonnage (par lien ET par titre normalisé) + tri par date décroissante.
  const seen = new Set<string>();
  const merged: Item[] = [];
  for (const list of results) {
    for (const it of list) {
      const key = it.link.split("?")[0];
      const tkey = norm(it.title).slice(0, 60);
      if (!key || seen.has(key) || (tkey && seen.has(tkey))) continue;
      seen.add(key); if (tkey) seen.add(tkey);
      merged.push(it);
    }
  }
  merged.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
  const filtre = FILTRES[cat];
  const items = (filtre ? merged.filter((it) => filtre.test(it.title)) : merged).slice(0, 48);

  if (items.length === 0 && hit) return NextResponse.json({ items: hit.items, cat, stale: true });
  cache.set(cat, { at: Date.now(), items });
  return NextResponse.json({ items, cat, sources: 1 + feeds.length });
}
