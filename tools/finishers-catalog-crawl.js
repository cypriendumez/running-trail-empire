// CRAWL CATALOGUE — reconstruit le catalogue des courses officielles FRANÇAISES à venir,
// avec les BONNES dates/distances/types, depuis finishers.com (calendrier de référence).
// Une ligne par distance proposée. Idempotent (clé `location` = fin:<slug>#<m>). Résumable.
//   node tools/finishers-catalog-crawl.js --dry --limit 15   → test (aucune écriture)
//   node tools/finishers-catalog-crawl.js                    → crawl complet (écrit en base)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const { createClient } = require(path.join(ROOT, "node_modules/@supabase/supabase-js"));
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

const DRY = process.argv.includes("--dry");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > 0 ? parseInt(process.argv[i + 1], 10) : 0; })();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const TODAY = new Date().toISOString().slice(0, 10);
const SLUGS = path.join("/tmp/fin-slugs.txt");
const PROGRESS = path.join(ROOT, "data/finishers-catalog.progress");
const LOG = path.join(ROOT, "data/finishers-catalog.jsonl");

const slugify = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const round1 = (n) => Math.round(n * 10) / 10;

function classifyType(disc, km, itra) {
  const trail = /trail|nature|montagne|sky|ultra|rando|cross/.test(disc || "");
  if (trail) {
    if (km >= 115 || (itra || 0) >= 5) return "ultra";
    if (km >= 75) return "trail_xl";
    if (km >= 45) return "trail_l";
    if (km >= 25) return "trail_m";
    return "trail_s";
  }
  if (km > 46) return "ultra";
  if (km >= 38) return "marathon";
  if (km >= 15.5) return "semi";
  if (km >= 7.5) return "road_10k";
  return "road_5k";
}
function difficultyFor(type, elev) {
  if (type === "ultra" || type === "trail_xl") return "black";
  if (type === "trail_l" || (elev || 0) > 1200) return "red";
  if (type.startsWith("trail") || (elev || 0) > 400) return "blue";
  return "green";
}

async function parseSlug(slug) {
  const res = await fetch(`https://www.finishers.com/course/${slug}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { skip: `http_${res.status}` };
  const h = await res.text();
  const m = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { skip: "no_data" };
  let data; try { data = JSON.parse(m[1]); } catch { return { skip: "bad_json" }; }
  const pp = data?.props?.pageProps; const ev = pp?.event;
  if (!ev) return { skip: "no_event" };
  // Le breadcrumb donne pays → région → département → ville, proprement typés.
  const bc = Array.isArray(ev.breadcrumb) ? ev.breadcrumb : [];
  const byType = (t) => { const x = bc.find((b) => b && b.type === t); return x ? x.label : null; };
  const country = byType("country") || (typeof ev.countryName === "string" ? ev.countryName : ev.countryName?.name);
  if (country && !/france/i.test(country)) return { skip: "not_france" };
  const city = byType("city");
  const department = byType("level2AdminArea");
  const region = slugify(byType("level1AdminArea") || ev.level1AdminAreaName?.name || "") || null;
  const coord = ev.cityCoordinates || ev.coordinates || null;
  const lat = coord?.lat ?? null, lng = coord?.lng ?? null;
  const races = Array.isArray(pp.races) ? pp.races : [];
  const rows = [];
  const seen = new Set();
  for (const r of races) {
    const date = r.date || pp.nextEdition?.dateRange?.start || null;
    if (!date || date < TODAY) continue;            // courses À VENIR uniquement
    const km = r.distance ? r.distance / 1000 : null;
    if (!km || km <= 0 || km > 350) continue;
    if (seen.has(r.distance)) continue; seen.add(r.distance);
    const type = classifyType((r.discipline || "").toLowerCase(), km, r.itraPoints);
    rows.push({
      name: String(ev.name || slug).slice(0, 120),
      city, region, department,
      date, distance_km: round1(km),
      type, elevation_gain_m: r.elevationGain != null ? Math.round(r.elevationGain) : null,
      difficulty: difficultyFor(type, r.elevationGain),
      registration_url: r.registrationUrl || `https://www.finishers.com/course/${slug}`,
      latitude: lat, longitude: lng,
      is_itra_certified: (r.itraPoints || 0) > 0, itra_points: r.itraPoints || null,
      organization: "finishers.com",
    });
  }
  return { rows };
}

async function upsert(row) {
  // Idempotent : dédoublonne parmi les lignes finishers par nom + distance + ville.
  let q = sb.from("races").select("id").eq("organization", "finishers.com").eq("name", row.name).eq("distance_km", row.distance_km);
  q = row.city ? q.eq("city", row.city) : q.is("city", null);
  const { data: ex } = await q.limit(1).maybeSingle();
  if (ex) { const { error } = await sb.from("races").update(row).eq("id", ex.id); return error ? "err:" + error.message.slice(0, 80) : "upd"; }
  const { error } = await sb.from("races").insert(row);
  return error ? "err:" + error.message.slice(0, 80) : "ins";
}

(async () => {
  let slugs = fs.readFileSync(SLUGS, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  const done = fs.existsSync(PROGRESS) ? new Set(fs.readFileSync(PROGRESS, "utf8").split("\n").filter(Boolean)) : new Set();
  slugs = slugs.filter((s) => !done.has(s));
  if (LIMIT) slugs = slugs.slice(0, LIMIT);
  console.log(`${slugs.length} fiches à traiter${DRY ? " (DRY)" : ""} · déjà faites: ${done.size}`);
  let ins = 0, upd = 0, fr = 0, skip = 0, ev = 0, err = 0;
  const CONC = 4;
  for (let i = 0; i < slugs.length; i += CONC) {
    await Promise.all(slugs.slice(i, i + CONC).map(async (slug) => {
      try {
        const r = await parseSlug(slug);
        if (r.skip) { skip++; }
        else if (r.rows?.length) {
          fr++; ev += r.rows.length;
          if (DRY) { for (const row of r.rows) console.log(`  ${row.date}  ${row.type.padEnd(9)} ${String(row.distance_km).padStart(5)}km  ${row.name.slice(0, 34).padEnd(34)} ${row.city || "?"} (${row.department || "?"})`); }
          else for (const row of r.rows) { const res = await upsert(row); if (res === "ins") ins++; else if (res === "upd") upd++; else { err++; if (err <= 3) console.log("  ⚠️", res, "|", row.name); } }
        }
      } catch { skip++; }
      if (!DRY) fs.appendFileSync(PROGRESS, slug + "\n");
    }));
    if (!DRY && (i / CONC) % 25 === 0) console.log(`  ${i + CONC}/${slugs.length} · FR: ${fr} · insérées: ${ins} · maj: ${upd} · skip: ${skip}`);
    await new Promise((r) => setTimeout(r, 80));
  }
  console.log(`TERMINÉ · fiches FR: ${fr} · courses ${DRY ? "(dry) " : ""}: ${ev} · insérées: ${ins} · maj: ${upd} · erreurs: ${err} · ignorées: ${skip}`);
})().catch((e) => console.log("FATAL", e.message));
