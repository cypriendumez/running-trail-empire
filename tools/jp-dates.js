// Récupère la vraie date de course sur chaque page jogging-plus.com des 554 courses
// sans date (placeholder 2099). N'écrit RIEN dans la base : produit data/jp-dates.jsonl
// pour décider ensuite quelles dates sont fiables (jour de semaine cohérent + futures).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const { createClient } = require(path.join(ROOT, "node_modules/@supabase/supabase-js"));
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

const OUT = path.join(ROOT, "data/jp-dates.jsonl");
const WD = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"]; // getDay(): 0=dimanche
const MOIS = { janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, "août": 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12, decembre: 12 };
const TODAY = new Date().toISOString().slice(0, 10);

function parseDate(h) {
  const txt = h.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
  // 1) Date avec jour de semaine : « dimanche 08 mars 2026 » → vérifiable
  let m = txt.match(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+([0-3]?\d)\s*(?:er)?\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(20\d\d)/i);
  if (m) {
    const mo = MOIS[m[3].toLowerCase()], d = +m[2], y = +m[4];
    const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const wd = WD[new Date(iso + "T12:00:00").getDay()];
    return { date: iso, weekday: m[1].toLowerCase(), weekdayOk: wd === m[1].toLowerCase(), src: "weekday" };
  }
  // 2) JSON-LD startDate
  m = h.match(/"startDate":\s*"(\d{4}-\d{2}-\d{2})/);
  if (m) return { date: m[1], weekdayOk: null, src: "jsonld" };
  // 3) jj/mm/aaaa nu
  m = txt.match(/\b([0-3]?\d)\/([01]?\d)\/(20\d\d)\b/);
  if (m) return { date: `${m[3]}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`, weekdayOk: null, src: "dmy" };
  return null;
}

async function fetchOne(r) {
  try {
    const res = await fetch(r.registration_url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { id: r.id, name: r.name, error: `HTTP ${res.status}` };
    const h = await res.text();
    const p = parseDate(h);
    if (!p) return { id: r.id, name: r.name, date: null };
    return { id: r.id, name: r.name, ...p, future: p.date >= TODAY };
  } catch (e) {
    return { id: r.id, name: r.name, error: e.name || "err" };
  }
}

(async () => {
  const { data, error } = await sb.from("races").select("id,name,registration_url").gte("date", "2099-01-01").limit(2000);
  if (error) { console.error("DB", error.message); process.exit(1); }
  console.log(`À traiter: ${data.length} courses`);
  fs.writeFileSync(OUT, "");
  let done = 0, ok = 0;
  const CONC = 6;
  for (let i = 0; i < data.length; i += CONC) {
    const batch = data.slice(i, i + CONC);
    const results = await Promise.all(batch.map(fetchOne));
    for (const r of results) {
      fs.appendFileSync(OUT, JSON.stringify(r) + "\n");
      if (r.date) ok++;
    }
    done += batch.length;
    if (done % 30 === 0 || done === data.length) console.log(`  ${done}/${data.length} (dates trouvées: ${ok})`);
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`TERMINÉ: ${ok}/${data.length} dates extraites → ${OUT}`);
})();
