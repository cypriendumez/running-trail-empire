export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Actualité running/trail agrégée depuis des FLUX RSS publics (Google News = syndication prévue
// pour ça). On n'affiche que titre + source + lien (clic → site source). Aucun article copié.
const QUERIES: Record<string, string> = {
  all: "course à pied OR trail running OR marathon",
  running: "course à pied running performance",
  trail: "trail running sentier",
  ultra: "ultra trail OR UTMB OR ultramarathon",
  marathon: "marathon course à pied",
  gear: "chaussures running test OR montre GPS running",
};

type Item = { title: string; source: string; link: string; date: string; domain: string; favicon: string };
const cache = new Map<string, { at: number; items: Item[] }>();
const TTL = 30 * 60 * 1000; // 30 min — on ne sur-sollicite pas la source.

function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function parseRss(xml: string): Item[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const b = m[1];
    const pick = (re: RegExp) => (b.match(re)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    let title = pick(/<title>([\s\S]*?)<\/title>/);
    // <source url="https://www.lemonde.fr">Le Monde</source> → nom + domaine (pour le favicon = logo de l'éditeur).
    const srcM = b.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/);
    const sourceUrl = srcM?.[1]?.match(/url="([^"]*)"/)?.[1] ?? "";
    const source = (srcM?.[2] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3)).trim();
    const domain = hostOf(sourceUrl);
    return {
      title,
      source: source || "Actualité",
      link: pick(/<link>([\s\S]*?)<\/link>/),
      date: pick(/<pubDate>([\s\S]*?)<\/pubDate>/),
      domain,
      // Favicon de l'éditeur (logo public servi pour identifier le site) — usage nominatif, légal.
      favicon: domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : "",
    };
  }).filter((i) => i.title && i.link);
}

export async function GET(req: Request) {
  const cat = new URL(req.url).searchParams.get("cat") ?? "all";
  const q = QUERIES[cat] ?? QUERIES.all;
  const hit = cache.get(cat);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ items: hit.items, cat, cached: true });
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 RunningTrailEmpire/1.0" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return NextResponse.json({ items: hit?.items ?? [], cat, error: `RSS ${r.status}` });
    const items = parseRss(await r.text()).slice(0, 40);
    cache.set(cat, { at: Date.now(), items });
    return NextResponse.json({ items, cat });
  } catch {
    return NextResponse.json({ items: hit?.items ?? [], cat, error: "fetch" });
  }
}
