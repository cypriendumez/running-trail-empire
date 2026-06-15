// CRAWL DATES — trouve la PROCHAINE date confirmée de chaque course sans date (placeholder 2099)
// sur finishers.com (calendrier prospectif, dates 2026-2027). Matching strict (nom + lieu) pour
// ne JAMAIS écrire une mauvaise date. Applique uniquement les dates FUTURES validées.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const { createClient } = require(path.join(ROOT, "node_modules/@supabase/supabase-js"));
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

const OUT = path.join(ROOT, "data/finishers-dates.jsonl");
const TODAY = new Date().toISOString().slice(0, 10);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const APPLY = process.argv.includes("--apply"); // sécurité : n'écrit en base qu'avec --apply

const STOP = new Set(["de", "du", "des", "la", "le", "les", "et", "au", "aux", "sur", "en", "d", "l", "a", "the", "of", "les"]);
const WEAK = new Set(["trail", "course", "courses", "run", "urban", "nature", "rando", "marathon", "semi", "km", "ekiden", "foulees", "foulee"]);
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (s) => norm(s).replace(/\s+/g, "-");
const toks = (s) => norm(s).split(" ").filter((w) => w.length >= 3 && !STOP.has(w));

const slugArr = fs.readFileSync("/tmp/fin-slugs.txt", "utf8").split("\n").map((s) => s.trim()).filter(Boolean);

function candidates(name, city) {
  const c = new Set();
  const nt = toks(name);
  c.add(slugify(name));
  c.add(nt.join("-"));
  if (city) { c.add(slugify(name + " " + city)); c.add(nt.concat(toks(city)).join("-")); }
  // slugs du sitemap dont l'ENSEMBLE de tokens contient tous les tokens distinctifs du nom
  // (membre exact, pas sous-chaîne → évite « dour » ⊂ « amadour »).
  const distinct = nt.filter((t) => !WEAK.has(t));
  const need = distinct.length ? distinct : nt;
  let n = 0;
  if (need.length) for (const sl of slugArr) {
    const st = sl.split("-");
    if (need.every((t) => st.includes(t))) { c.add(sl); if (++n >= 2) break; }
  }
  return [...c].filter(Boolean).slice(0, 5);
}

// Nom + année d'édition depuis le <title> finishers (« 🏃 Asparun 2027 - … | Finishers »).
async function fetchFin(slug, race) {
  try {
    const r = await fetch(`https://www.finishers.com/course/${slug}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const h = await r.text();
    const titleRaw = ((h.match(/<title>([^<]+)<\/title>/i) || [])[1] || "").replace(/&amp;/g, "&");
    const titleYear = (titleRaw.match(/\b(20\d\d)\b/) || [])[1] ? +(titleRaw.match(/\b(20\d\d)\b/)[1]) : null;
    const name = titleRaw.replace(/\|.*$/, "").replace(/\b20\d\d\b.*$/, "").replace(/[^\p{L}\p{N} '’\-]/gu, "").trim();
    const dates = [...h.matchAll(/"(?:start[Dd]ate|date)":"(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
    const cityHit = race.city ? norm(h).includes(" " + norm(race.city) + " ") || norm(h).includes(norm(race.city)) : false;
    return { slug, name, titleYear, dates, cityHit };
  } catch { return null; }
}

// Tokens : égalité OU préfixe long (≥5) — pas de sous-chaîne courte trompeuse.
const tokMatch = (t, f) => f === t || (t.length >= 5 && f.startsWith(t)) || (f.length >= 5 && t.startsWith(f));
const nameScore = (raceName, finName) => {
  const rt = toks(raceName), ft = toks(finName);
  if (!rt.length || !ft.length) return 0;
  const ov = rt.filter((t) => ft.some((f) => tokMatch(t, f))).length;
  return ov / rt.length;
};

async function resolve(race) {
  const cands = candidates(race.name, race.city);
  let best = null;
  for (const slug of cands) {
    const fin = await fetchFin(slug, race);
    if (!fin || !fin.name) continue;
    const ns = nameScore(race.name, fin.name);
    const exactSlug = slug === slugify(race.name);
    // Date : on privilégie l'édition de l'année du titre (la prochaine), sinon la 1re future.
    const fut = fin.dates.filter((d) => d >= TODAY).sort();
    const futur = (fin.titleYear ? fut.find((d) => +d.slice(0, 4) === fin.titleYear) : null) || fut[0] || null;
    const strong = (ns >= 0.6 && fin.cityHit) || (ns >= 0.8 && exactSlug);
    const cand = { slug, finName: fin.name, year: fin.titleYear, ns: Math.round(ns * 100) / 100, geo: fin.cityHit, futur, lastKnown: fin.dates.sort().slice(-1)[0] || null, strong };
    if (strong && futur) return cand;          // match fort + date future → on prend direct
    if (!best || (cand.strong && !best.strong) || (cand.ns > (best.ns ?? 0))) best = cand;
  }
  return best;
}

(async () => {
  const { data, error } = await sb.from("races").select("id,name,city,department").gte("date", "2099-01-01").limit(2000);
  if (error) { console.error("DB", error.message); process.exit(1); }
  console.log(`${data.length} courses à dater · mode ${APPLY ? "APPLY (écriture base)" : "DRY-RUN (aucune écriture)"}`);
  fs.writeFileSync(OUT, "");
  let done = 0, applied = 0, futureFound = 0;
  const CONC = 5;
  for (let i = 0; i < data.length; i += CONC) {
    await Promise.all(data.slice(i, i + CONC).map(async (race) => {
      const m = await resolve(race).catch(() => null);
      const rec = { id: race.id, name: race.name, city: race.city, ...(m || { miss: true }) };
      const willApply = !!(m && m.strong && m.futur);
      if (willApply) {
        futureFound++;
        if (APPLY) { const { error: e } = await sb.from("races").update({ date: m.futur }).eq("id", race.id); if (!e) { applied++; rec.applied = true; } else rec.err = e.message; }
      }
      fs.appendFileSync(OUT, JSON.stringify(rec) + "\n");
    }));
    done += Math.min(CONC, data.length - i);
    if (done % 25 === 0 || done >= data.length) console.log(`  ${done}/${data.length} · dates futures validées: ${futureFound}${APPLY ? ` · appliquées: ${applied}` : ""}`);
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log(`TERMINÉ · ${futureFound} dates futures confirmées${APPLY ? ` · ${applied} appliquées en base` : " (DRY-RUN — relance avec --apply pour écrire)"} → ${OUT}`);
})();
