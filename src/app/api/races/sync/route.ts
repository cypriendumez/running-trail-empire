export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const maxDuration = 300;


// ─── Department → Region ────────────────────────────────────────────────────
const DEPT_REGION: Record<string, string> = {
  "01":"auvergne-rhone-alpes","03":"auvergne-rhone-alpes","07":"auvergne-rhone-alpes",
  "15":"auvergne-rhone-alpes","26":"auvergne-rhone-alpes","38":"auvergne-rhone-alpes",
  "42":"auvergne-rhone-alpes","43":"auvergne-rhone-alpes","63":"auvergne-rhone-alpes",
  "69":"auvergne-rhone-alpes","73":"auvergne-rhone-alpes","74":"auvergne-rhone-alpes",
  "21":"bourgogne-franche-comte","25":"bourgogne-franche-comte","39":"bourgogne-franche-comte",
  "58":"bourgogne-franche-comte","70":"bourgogne-franche-comte","71":"bourgogne-franche-comte",
  "89":"bourgogne-franche-comte","90":"bourgogne-franche-comte",
  "22":"bretagne","29":"bretagne","35":"bretagne","56":"bretagne",
  "18":"centre-val-de-loire","28":"centre-val-de-loire","36":"centre-val-de-loire",
  "37":"centre-val-de-loire","41":"centre-val-de-loire","45":"centre-val-de-loire",
  "2A":"corse","2B":"corse",
  "08":"grand-est","10":"grand-est","51":"grand-est","52":"grand-est",
  "54":"grand-est","55":"grand-est","57":"grand-est","67":"grand-est",
  "68":"grand-est","88":"grand-est",
  "02":"hauts-de-france","59":"hauts-de-france","60":"hauts-de-france",
  "62":"hauts-de-france","80":"hauts-de-france",
  "75":"ile-de-france","77":"ile-de-france","78":"ile-de-france",
  "91":"ile-de-france","92":"ile-de-france","93":"ile-de-france",
  "94":"ile-de-france","95":"ile-de-france",
  "14":"normandie","27":"normandie","50":"normandie","61":"normandie","76":"normandie",
  "16":"nouvelle-aquitaine","17":"nouvelle-aquitaine","19":"nouvelle-aquitaine",
  "23":"nouvelle-aquitaine","24":"nouvelle-aquitaine","33":"nouvelle-aquitaine",
  "40":"nouvelle-aquitaine","47":"nouvelle-aquitaine","64":"nouvelle-aquitaine",
  "79":"nouvelle-aquitaine","86":"nouvelle-aquitaine","87":"nouvelle-aquitaine",
  "09":"occitanie","11":"occitanie","12":"occitanie","30":"occitanie",
  "31":"occitanie","32":"occitanie","34":"occitanie","46":"occitanie",
  "48":"occitanie","65":"occitanie","66":"occitanie","81":"occitanie","82":"occitanie",
  "44":"pays-de-la-loire","49":"pays-de-la-loire","53":"pays-de-la-loire",
  "72":"pays-de-la-loire","85":"pays-de-la-loire",
  "04":"provence-alpes-cote-azur","05":"provence-alpes-cote-azur",
  "06":"provence-alpes-cote-azur","13":"provence-alpes-cote-azur",
  "83":"provence-alpes-cote-azur","84":"provence-alpes-cote-azur",
  "971":"guadeloupe","972":"martinique","973":"guyane","974":"la-reunion","976":"mayotte",
};

const MONTHS_FR: Record<string, number> = {
  "janvier":1,"février":2,"mars":3,"avril":4,"mai":5,"juin":6,
  "juillet":7,"août":8,"septembre":9,"octobre":10,"novembre":11,"décembre":12,
};

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Referer": "https://www.jogging-plus.com/",
};

interface RaceEntry {
  name: string;
  date: string;
  city: string;
  department: string;
  region: string;
  distancesText: string;
  type: string;
  source_url: string;
  terrain: string[];
  difficulty: string;
  latitude: number | null;
  longitude: number | null;
  description?: string;
}

// ─── Infer race type ────────────────────────────────────────────────────────
function inferRaceType(distancesText: string, isTrail: boolean): string {
  const text = distancesText.toLowerCase();
  const nums = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*km/g)].map(m => parseFloat(m[1].replace(",",".")));
  const maxKm = nums.length ? Math.max(...nums) : 0;

  if (isTrail || text.includes("trail")) {
    if (maxKm >= 100) return "ultra";
    if (maxKm >= 80) return "trail_xl";
    if (maxKm >= 50) return "trail_l";
    if (maxKm >= 25) return "trail_m";
    return "trail_s";
  }
  if (maxKm >= 42 || text.includes("marathon")) return "marathon";
  if (maxKm >= 20 || text.includes("semi")) return "semi";
  if (maxKm >= 10 || text.includes("10 km") || text.includes("10km")) return "road_10k";
  if (maxKm >= 5) return "road_5k";
  return "road_10k";
}

// ─── Parse jogging-plus HTML calendar page ──────────────────────────────────
function parseJoggingPlusHtml(html: string, isTrail: boolean): RaceEntry[] {
  const $ = cheerio.load(html);
  const races: RaceEntry[] = [];
  const year = new Date().getFullYear();

  // jogging-plus calendar structure:
  // Month heading → h3 or h2 with month name
  // Date heading → h4 or strong with day
  // Race row → contains: link (name), em (distances), text (city + dept)

  let curYear = year;
  let curMonth = 0;
  let curDay = 1;

  // Walk through all elements in document order
  $("body *").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase();
    if (!tag) return;

    const $el = $(el);
    const text = $el.clone().children().remove().end().text().trim();

    // Month heading (h2, h3): "Avril 2026", "Janvier 2026"
    if ((tag === "h2" || tag === "h3") && text.length < 30) {
      const lower = text.toLowerCase();
      for (const [name, num] of Object.entries(MONTHS_FR)) {
        if (lower.includes(name)) {
          curMonth = num;
          const yMatch = text.match(/20\d\d/);
          if (yMatch) curYear = parseInt(yMatch[0]);
          break;
        }
      }
    }

    // Day heading (h4, h5, strong): "19 avril", "Du 19 au 20 avril", "Samedi 5 mars"
    if (tag === "h4" || tag === "h5" || (tag === "strong" && text.length < 40)) {
      const lower = text.toLowerCase().replace(/^(du|le|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi)\s+/i, "");
      const dayMatch = lower.match(/^(\d{1,2})\s+(\w+)/);
      if (dayMatch) {
        const d = parseInt(dayMatch[1]);
        const m = MONTHS_FR[dayMatch[2]];
        if (d >= 1 && d <= 31) {
          curDay = d;
          if (m) curMonth = m;
        }
      }
    }
  });

  // Strategy: find all links that look like race names, then extract context
  $("a[href]").each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href") || "";
    const name = $a.text().trim();

    // Filter: must look like a race page link
    if (!name || name.length < 4 || name.length > 120) return;
    if (!href.includes("presentation") && !href.includes("course") && !href.includes("trail") &&
        !href.includes("marathon") && !href.includes("calendrier")) return;
    if (href.includes("mailto:") || href.includes("javascript:")) return;

    // Get surrounding context (parent and siblings)
    const $parent = $a.closest("tr, li, div, article, .event, .race, .ligne");
    const contextText = $parent.length ? $parent.text() : $a.parent().parent().text();

    // Extract department and city
    const deptMatch = contextText.match(/\(\s*(\d{1,3}[AB]?)\s*[-–]\s*([^)]+)\)/);
    const deptNum = deptMatch?.[1]?.replace(/^0/, "") || "";
    const deptName = deptMatch?.[2]?.trim() || "";

    // Extract distances
    const distMatch = contextText.match(/(\d+(?:[.,]\d+)?\s*km(?:\s*\/\s*\d+(?:[.,]\d+)?\s*km)*)/i);
    const distText = distMatch?.[1] || "";

    // Extract city (text before department pattern)
    const cityMatch = contextText.replace(name, "").match(/([A-ZÀ-Üa-zà-ü][a-zà-ü\s\-]{2,30})(?=\s*\(|\s*\d{5})/);
    const city = cityMatch?.[1]?.trim().replace(/\s+/g, " ") || "";

    // Build date from current context
    const dateMatch = contextText.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i);
    let dateStr = "";
    if (dateMatch) {
      const d = parseInt(dateMatch[1]);
      const m = MONTHS_FR[dateMatch[2].toLowerCase()];
      if (m) dateStr = `${curYear}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }

    if (!dateStr && curMonth > 0) {
      dateStr = `${curYear}-${String(curMonth).padStart(2,"0")}-${String(curDay).padStart(2,"0")}`;
    }

    if (!dateStr) return;

    const region = DEPT_REGION[deptNum] || DEPT_REGION[deptNum.padStart(2, "0")] || "ile-de-france";
    const type = inferRaceType(distText || contextText, isTrail);

    races.push({
      name: name.trim(),
      date: dateStr,
      city,
      department: deptName || deptNum,
      region,
      distancesText: distText,
      type,
      source_url: href.startsWith("http") ? href : `https://www.jogging-plus.com${href}`,
      terrain: type.includes("trail") ? ["single_track", "forest"] : ["asphalt"],
      difficulty: type.includes("trail") ? "blue" : "green",
      latitude: null,
      longitude: null,
    });
  });

  return races;
}

// ─── Scrape jogging-plus.com calendar pages ─────────────────────────────────
type CalendarType = { slug: string; isTrail: boolean; label: string };

const CALENDAR_SLUGS: Array<{ slug: string; isTrail: boolean }> = [
  { slug: "trails", isTrail: true },
  { slug: "courses/france", isTrail: false },          // all road races (3750+)
  { slug: "courses-5-10-15-km/france", isTrail: false }, // calendrier 5/10/15 km dédié (~1100 lignes)
  { slug: "semi-marathons", isTrail: false },
  { slug: "marathons", isTrail: false },
  { slug: "courses-100km-france", isTrail: true },
  { slug: "ekiden-france", isTrail: false },
  { slug: "obstacles/france", isTrail: false },
  { slug: "calendrier-raids-multisports-france", isTrail: false },
  { slug: "calendrier-courses-couleurs-france", isTrail: false },
];

// ─── Parse jogging-plus HTML calendar TABLE (the real structure) ─────────────
function parseCalendarTable(html: string, isTrail: boolean, pageUrl = ""): RaceEntry[] {
  const $ = cheerio.load(html);
  const races: RaceEntry[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

  // Le HTML de jogging-plus est mal fermé : des dizaines de courses s'entassent
  // dans une même <tr> (N × 3 cellules). On ne parcourt donc PAS les lignes mais
  // TOUS les <td> dans l'ordre du document, par triplets (date, nom+distances,
  // ville) — avec resynchronisation si un triplet est désaligné.
  const isDateCell = (txt: string): boolean => {
    const t = txt.toLowerCase().trim();
    if (!t || t.length > 45) return false;
    if (t.includes("connue")) return true;
    const m = t.replace(/^(du|le|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi)\s+/, "")
      .match(/^(\d{1,2})\s+([a-zéèêûôî]+)/);
    return !!(m && MONTHS_FR[m[2]]);
  };

  const tds = $("td").toArray();
  for (let i = 0; i < tds.length - 2; ) {
    const dateText = $(tds[i]).text().trim();
    if (!isDateCell(dateText)) { i++; continue; }
    const $nameCell = $(tds[i + 1]);
    const cityDeptRaw = $(tds[i + 2]).text().trim();
    if (isDateCell(cityDeptRaw)) { i++; continue; } // désalignement → resynchronise
    i += 3; // triplet consommé (valide ou non)

    // Nom + URL : ligne AVEC lien (fiche jogging-plus) OU ligne en texte brut
    // (la majorité des lignes du calendrier n'ont PAS de fiche — on les garde
    // désormais, avec la page calendrier comme source).
    const $link = $nameCell.find("a[href*='presentation-courses-trails']");
    let name = "";
    let href = "";
    if ($link.length) {
      name = $link.text().trim();
      href = ($link.attr("href") || "").trim();
    } else {
      const $c = $nameCell.clone();
      $c.find("em, script, style").remove();
      name = $c.text().replace(/\s+/g, " ").trim();
      href = pageUrl;
    }
    if (!name || name.length < 4 || name.length > 120) continue;
    if (/aucune épreuve|^\d+([.,]\d+)?\s*km/i.test(name)) continue;

    const distText = $nameCell.find("em").text().trim();

    // Date : "19 avril" (sans année) ou "Non connue" → marqueur 2099-01-01
    // ("Date à venir") : l'événement existe, seule sa prochaine date est inconnue.
    let dateStr = "";
    if (dateText.toLowerCase().includes("connue")) {
      dateStr = "2099-01-01";
    } else {
      const clean = dateText.toLowerCase().replace(/^(du|le|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi)\s+/, "");
      const dayMonthMatch = clean.match(/^(\d{1,2})\s+([a-zéèêûôî]+)/);
      if (!dayMonthMatch) continue;
      const day = parseInt(dayMonthMatch[1]);
      const month = MONTHS_FR[dayMonthMatch[2]];
      if (!month || day < 1 || day > 31) continue;
      // Year inference: if this date already passed this year → use next year
      const thisYearDate = `${currentYear}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const year = thisYearDate < todayStr ? currentYear + 1 : currentYear;
      dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    }

    // Parse city and dept from "(47 - Lot et Garonne)" pattern
    const cityDeptMatch = cityDeptRaw.match(/^([^(]+?)\s*\((\d{1,3}[AB]?)\s*[-–]\s*([^)]+)\)/);
    const city = cityDeptMatch?.[1]?.trim() || cityDeptRaw.split("\n")[0].trim();
    const deptNum = cityDeptMatch?.[2]?.replace(/^0/, "") || "";
    const deptName = cityDeptMatch?.[3]?.trim() || "";
    const region = DEPT_REGION[deptNum] || DEPT_REGION[deptNum.padStart(2, "0")] || "ile-de-france";

    const type = inferRaceType(distText, isTrail);

    races.push({
      name,
      date: dateStr,
      city,
      department: deptName || deptNum,
      region,
      distancesText: distText,
      type,
      source_url: href.startsWith("http") ? href : `https://www.jogging-plus.com${href}`,
      terrain: isTrail ? ["single_track", "forest"] : ["asphalt"],
      difficulty: isTrail ? "blue" : "green",
      latitude: null,
      longitude: null,
    });
  }

  return races;
}

async function scrapeJoggingPlusCalendar(): Promise<RaceEntry[]> {
  const all: RaceEntry[] = [];

  for (const { slug, isTrail } of CALENDAR_SLUGS) {
    // Some slugs already include sub-path (e.g. "courses/france"), others don't
    const url = slug.includes("/france") || slug.includes("-france")
      ? `https://www.jogging-plus.com/calendrier/${slug}/`
      : `https://www.jogging-plus.com/calendrier/${slug}/france/`;
    try {
      const resp = await fetch(url, {
        headers: FETCH_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(25000),
      });
      if (!resp.ok) continue;

      const html = await resp.text();
      if (html.length < 5000) continue;

      const parsed = parseCalendarTable(html, isTrail, url);
      all.push(...parsed);
      await new Promise(r => setTimeout(r, 1200));
    } catch (e) {
      console.error(`Calendar scrape error [${slug}]:`, e);
    }
  }

  return all;
}

// ─── FFA (Fédération Française d'Athlétisme) calendar ──────────────────────
async function scrapeFfaCalendar(): Promise<RaceEntry[]> {
  const races: RaceEntry[] = [];
  // DÉSACTIVÉ (légalité) : le robots.txt d'athle.fr contient « Disallow: /bases/liste.aspx?* »
  // — exactement l'URL utilisée ici. On respecte la directive : plus aucune requête FFA.
  return races;
  // eslint-disable-next-line no-unreachable
  const today = new Date();
  const dateFrom = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
  const dateTo = `31/12/${today.getFullYear() + 1}`;

  const url = `https://www.athle.fr/bases/liste.aspx?frmbase=calendrier&frmmode=1&frmespace=0&frmdatede=${dateFrom}&frmdatea=${dateTo}&frmtype=Running`;

  try {
    const resp = await fetch(url, {
      headers: { ...FETCH_HEADERS, "Referer": "https://www.athle.fr/" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) return races;

    const html = await resp.text();
    if (html.length < 500) return races;

    const $ = cheerio.load(html);

    // FFA table structure: tr with td cells for date, name, city, dept, type
    $("table tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 3) return;

      const dateText = $(cells[0]).text().trim(); // "19/04/2026"
      const name = $(cells[1]).text().trim();
      const cityDept = $(cells[2]).text().trim(); // "Paris (75)" or "Lyon (69)"

      if (!name || name.length < 3 || !dateText.match(/\d{2}\/\d{2}\/\d{4}/)) return;

      // Parse date DD/MM/YYYY → YYYY-MM-DD
      const [dd, mm, yyyy] = dateText.split("/");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      // Parse city and dept
      const cityDeptMatch = cityDept.match(/^(.+?)\s*\((\d{2,3}[AB]?)\)/);
      const city = cityDeptMatch?.[1]?.trim() || cityDept;
      const deptNum = cityDeptMatch?.[2] || "";
      const region = DEPT_REGION[deptNum] || DEPT_REGION[deptNum.padStart(2,"0")] || "ile-de-france";

      // Type from columns 3-4 if available
      const typeText = cells.length > 3 ? $(cells[3]).text().trim().toLowerCase() : "";
      const isTrail = typeText.includes("trail") || typeText.includes("nature");
      const type = inferRaceType(typeText, isTrail);

      races.push({
        name,
        date: dateStr,
        city,
        department: deptNum,
        region,
        distancesText: typeText,
        type,
        source_url: "https://www.athle.fr/bases/liste.aspx?frmbase=calendrier",
        terrain: isTrail ? ["single_track"] : ["asphalt"],
        difficulty: isTrail ? "blue" : "green",
        latitude: null,
        longitude: null,
      });
    });
  } catch (e) {
    console.error("FFA scrape error:", e);
  }

  return races;
}

// ─── WP REST API with JSON-LD ───────────────────────────────────────────────
async function fetchWordPressAPI(maxPages = 5, startPage = 1): Promise<RaceEntry[]> {
  const races: RaceEntry[] = [];
  const headers = { "User-Agent": FETCH_HEADERS["User-Agent"] };

  for (let page = startPage; page < startPage + maxPages; page++) {
    try {
      const url = `https://www.jogging-plus.com/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id,title,date,content,link,excerpt`;
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (!resp.ok) break;

      const totalPages = parseInt(resp.headers.get("X-WP-TotalPages") || "1");
      const posts: any[] = await resp.json();
      if (!posts.length) break;

      for (const post of posts) {
        const html = post.content?.rendered || "";
        const $ = cheerio.load(html);

        let jsonLd: any = null;
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const d = JSON.parse($(el).html() || "{}");
            const ev = Array.isArray(d) ? d.find((x: any) => String(x["@type"]).match(/Event/i)) : d;
            if (ev?.["@type"]) jsonLd = ev;
          } catch {}
        });

        if (!jsonLd) continue;

        const name = (jsonLd.name || post.title?.rendered || "").replace(/<[^>]+>/g, "").trim();
        if (!name) continue;

        // Date — detect jogging-plus "DATE A VENIR" pattern:
        // When startDate is empty/missing → use TBD marker "2099-01-01"
        // When startDate == post publication date → also TBD (jogging-plus placeholder)
        let dateStr = "";
        const postPubDate = post.date ? post.date.slice(0, 10) : "";
        const rawStartDate = jsonLd.startDate ? String(jsonLd.startDate).trim() : "";

        if (!rawStartDate || rawStartDate.length < 5) {
          // No startDate at all → unknown date
          dateStr = "2099-01-01";
        } else {
          try {
            const d = new Date(rawStartDate);
            if (!isNaN(d.getTime())) {
              const candidate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
              // If startDate matches post publication date exactly → placeholder
              dateStr = candidate === postPubDate ? "2099-01-01" : candidate;
            }
          } catch {}
        }
        if (!dateStr) continue;

        const loc = jsonLd.location;
        const addr = loc?.address || {};
        const city = addr.addressLocality || loc?.name || "";
        const postal = addr.postalCode || "";
        const deptNum = postal ? postal.slice(0, 2) : "";
        const region = DEPT_REGION[deptNum] || "ile-de-france";

        const geo = loc?.geo || {};
        const lat = geo.latitude ? parseFloat(geo.latitude) : null;
        const lng = geo.longitude ? parseFloat(geo.longitude) : null;

        const contentText = $.text();
        const isTrail = contentText.toLowerCase().includes("trail");
        if (contentText.match(/\bvélo\b|\bcyclisme\b|\btriathlon\b|\bnage\b/i)) continue;
        if (!contentText.match(/\bkm\b|\brun|\bcourir|\bcourse|\bmarathon|\btrail/i)) continue;

        const type = inferRaceType(contentText, isTrail);

        races.push({
          name,
          date: dateStr,
          city,
          department: addr.addressRegion || deptNum,
          region,
          distancesText: contentText.match(/\d+\s*km/gi)?.join(" / ") || "",
          type,
          source_url: jsonLd.url || post.link || "",
          terrain: isTrail ? ["single_track"] : ["asphalt"],
          difficulty: isTrail ? "blue" : "green",
          latitude: lat,
          longitude: lng,
          description: jsonLd.description?.slice(0, 400) || "",
        });
      }

      if (page >= totalPages) break;
      await new Promise(r => setTimeout(r, 600));
    } catch { break; }
  }

  return races;
}

// ─── Enrich GPS from jogging-plus detail page JSON-LD ──────────────────────
async function enrichGPS(race: RaceEntry): Promise<void> {
  if (race.latitude || !race.source_url?.includes("jogging-plus.com")) return;
  try {
    const resp = await fetch(race.source_url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return;
    const html = await resp.text();
    const $ = cheerio.load(html);
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const d = JSON.parse($(el).html() || "{}");
        const ev = Array.isArray(d) ? d.find((x: any) => x["@type"]?.match(/Event/i)) : d;
        const geo = ev?.location?.geo;
        if (geo?.latitude) {
          race.latitude = parseFloat(geo.latitude);
          race.longitude = parseFloat(geo.longitude);
        }
      } catch {}
    });
  } catch {}
}

// ─── Dedup ──────────────────────────────────────────────────────────────────
function dedup(races: RaceEntry[]): RaceEntry[] {
  const seen = new Set<string>();
  return races.filter(r => {
    const k = `${r.name.toLowerCase().trim()}::${r.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Map to Supabase schema ──────────────────────────────────────────────────
function getDefaultDistance(type: string): number {
  const m: Record<string, number> = {
    road_5k:5, road_10k:10, semi:21.097, marathon:42.195,
    trail_s:15, trail_m:35, trail_l:65, trail_xl:90, ultra:120,
  };
  return m[type] || 10;
}

function toSupabaseRace(r: RaceEntry) {
  const kmMatch = r.distancesText?.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  const distKm = kmMatch ? parseFloat(kmMatch[1].replace(",",".")) : getDefaultDistance(r.type);
  return {
    name: r.name,
    type: r.type,
    region: r.region,
    department: r.department || "",
    city: r.city || "",
    date: r.date,
    distance_km: distKm,
    // RÈGLE D'OR : on n'invente JAMAIS une donnée. D+ inconnu → null (affiché « — »),
    // barrières horaires inconnues → [] (rien d'affiché). Avant : 500 m forfaitaire
    // sur les trails + barrières calculées allure×km → données fausses montrées aux clients.
    elevation_gain_m: null,
    difficulty: r.difficulty,
    terrain: r.terrain,
    time_limits: [],
    registration_url: r.source_url || "",
    organization: "",
    description: r.description || `${r.name} — ${r.city}${r.department ? `, ${r.department}` : ""}`,
    latitude: r.latitude,
    longitude: r.longitude,
    is_itra_certified: false,
    itra_points: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ─── GET: status ────────────────────────────────────────────────────────────
export async function GET() {
  const { count } = await createAdminClient().from("races").select("*", { count:"exact", head:true });
  return NextResponse.json({ races_in_db: count || 0 });
}

// ─── DELETE: courses passées → « Date à venir » (2099-01-01) ─────────────────
// Les courses françaises sont annuelles : une édition passée ≠ course disparue.
// On bascule la date sur le marqueur 2099 (affiché « Date à venir ») au lieu de
// supprimer. On ne supprime que les éditions périmées DÉJÀ remplacées par une
// édition future de la même course (même nom + ville + distance).
export async function DELETE() {
  const sb = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const all: { id: string; name: string; city: string | null; date: string; distance_km: number | null }[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb.from("races").select("id,name,city,date,distance_km").range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const key = (r: { name: string; city: string | null; distance_km: number | null }) =>
    `${r.name.toLowerCase().trim()}::${(r.city || "").toLowerCase().trim()}::${r.distance_km ?? ""}`;
  const futureKeys = new Set(all.filter(r => r.date >= today).map(key));
  const past = all.filter(r => r.date < today);
  const toDelete = past.filter(r => futureKeys.has(key(r))).map(r => r.id);
  const toRoll = past.filter(r => !futureKeys.has(key(r))).map(r => r.id);

  const CHUNK = 200;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const { error } = await sb.from("races").delete().in("id", toDelete.slice(i, i + CHUNK));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  for (let i = 0; i < toRoll.length; i += CHUNK) {
    const { error } = await sb.from("races")
      .update({ date: "2099-01-01", updated_at: new Date().toISOString() })
      .in("id", toRoll.slice(i, i + CHUNK));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rolled_to_tbd: toRoll.length,
    deleted_superseded: toDelete.length,
    message: `${toRoll.length} courses passées basculées en « Date à venir » · ${toDelete.length} éditions périmées supprimées (déjà remplacées)`,
  });
}

// ─── POST: trigger sync ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const wpPages = Math.min(body.pages || 25, 113);
  const wpStartPage = Math.max(body.startPage || 1, 1);

  // 2. Scrape all sources in parallel (NO date filter — store everything, display filters)
  const [calRaces, wpRaces, ffaRaces] = await Promise.allSettled([
    scrapeJoggingPlusCalendar(),
    fetchWordPressAPI(wpPages, wpStartPage),
    scrapeFfaCalendar(),
  ]);

  let races: RaceEntry[] = [
    ...(calRaces.status === "fulfilled" ? calRaces.value : []),
    ...(wpRaces.status === "fulfilled" ? wpRaces.value : []),
    ...(ffaRaces.status === "fulfilled" ? ffaRaces.value : []),
  ];

  // 3. Dedup + validate only (keep all dates — list endpoint handles future filtering)
  races = dedup(races);
  races = races.filter(r => r.name && r.name.length > 2 && r.date.match(/^\d{4}-\d{2}-\d{2}$/));

  if (races.length === 0) {
    return NextResponse.json({
      error: "Aucune course trouvée.",
      sources: {
        calendar: calRaces.status === "fulfilled" ? calRaces.value.length : "error",
        wordpress: wpRaces.status === "fulfilled" ? wpRaces.value.length : "error",
        ffa: ffaRaces.status === "fulfilled" ? ffaRaces.value.length : "error",
      }
    }, { status: 422 });
  }

  // 5. No GPS enrichment during sync (use /api/races/geocode separately)

  // 6. Check existing to avoid duplicates (paginate to bypass 1000-row PostgREST cap)
  const existingKeys = new Set<string>();
  let exPage = 0;
  const EX_PAGE = 1000;
  while (true) {
    const { data: exData } = await createAdminClient()
      .from("races")
      .select("name,date")
      .range(exPage, exPage + EX_PAGE - 1);
    if (!exData?.length) break;
    for (const r of exData) existingKeys.add(`${r.name.toLowerCase().trim()}::${r.date}`);
    if (exData.length < EX_PAGE) break;
    exPage += EX_PAGE;
  }
  const toInsert = races
    .filter(r => !existingKeys.has(`${r.name.toLowerCase().trim()}::${r.date}`))
    .map(toSupabaseRace);

  // 7. Batch insert
  const BATCH = 50;
  let inserted = 0, errors = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await createAdminClient().from("races").insert(toInsert.slice(i, i + BATCH));
    if (error) { console.error(error.message); errors++; }
    else inserted += Math.min(BATCH, toInsert.length - i);
  }

  const { count } = await createAdminClient().from("races").select("*", { count:"exact", head:true });

  return NextResponse.json({
    scraped: races.length,
    inserted,
    errors,
    total_in_db: count || 0,
    with_gps: races.filter(r => r.latitude).length,
    sources: {
      calendar_html: calRaces.status === "fulfilled" ? calRaces.value.length : 0,
      wordpress_api: wpRaces.status === "fulfilled" ? wpRaces.value.length : 0,
      ffa: ffaRaces.status === "fulfilled" ? ffaRaces.value.length : 0,
    },
  });
}
