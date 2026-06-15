// NETTOYAGE CATALOGUE — à lancer APRÈS le crawl finishers. Supprime, parmi les ANCIENNES données
// (organization != finishers.com) : (A) les incohérences type/distance objectives (ex « Ultra 6 km »),
// et (B) les doublons d'une course déjà fournie proprement par finishers (même nom+ville+distance).
// Ne touche JAMAIS les lignes finishers. DRY par défaut ; --apply pour supprimer.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const { createClient } = require(path.join(ROOT, "node_modules/@supabase/supabase-js"));
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const APPLY = process.argv.includes("--apply");
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function mismatch(r) {
  const d = r.distance_km || 0, t = r.type || "";
  if (t === "ultra" && d < 30) return true;
  if (t === "trail_xl" && d < 55) return true;
  if (t === "trail_l" && d < 32) return true;
  if (t === "marathon" && (d < 34 || d > 48)) return true;
  if (t === "semi" && (d < 14 || d > 30)) return true;
  if (t === "road_10k" && (d < 4 || d > 17)) return true;
  if (t === "road_5k" && (d < 1.5 || d > 8)) return true;
  return false;
}

async function fetchAll(filterFn) {
  let all = [], from = 0;
  for (;;) {
    let q = sb.from("races").select("id,name,city,distance_km,type,date,organization").range(from, from + 999);
    const { data, error } = await q;
    if (error) { console.error(error.message); break; }
    all = all.concat(data); if (data.length < 1000) break; from += 1000;
  }
  return all;
}

(async () => {
  const all = await fetchAll();
  const fin = all.filter((r) => r.organization === "finishers.com");
  const old = all.filter((r) => r.organization !== "finishers.com");
  console.log(`Total: ${all.length} · finishers: ${fin.length} · anciennes: ${old.length}`);

  // (A) incohérences type/distance dans les anciennes
  const garbage = old.filter(mismatch);
  // (B) doublons : ancienne course dont (nom+ville+distance) existe déjà côté finishers
  const finKeys = new Set(fin.map((r) => `${norm(r.name)}|${norm(r.city)}|${Math.round((r.distance_km || 0))}`));
  const dupes = old.filter((r) => !mismatch(r) && finKeys.has(`${norm(r.name)}|${norm(r.city)}|${Math.round((r.distance_km || 0))}`));

  const toDelete = [...new Map([...garbage, ...dupes].map((r) => [r.id, r])).values()];
  console.log(`\n(A) incohérences type/distance: ${garbage.length}`);
  for (const r of garbage.slice(0, 5)) console.log(`    ✗ ${r.name?.slice(0, 32)} · ${r.type} · ${r.distance_km} km`);
  console.log(`(B) doublons d'une course finishers: ${dupes.length}`);
  for (const r of dupes.slice(0, 5)) console.log(`    = ${r.name?.slice(0, 32)} · ${r.city} · ${r.distance_km} km`);
  console.log(`\n→ À SUPPRIMER (anciennes uniquement): ${toDelete.length}`);

  if (!APPLY) { console.log("DRY-RUN — relance avec --apply pour supprimer."); return; }
  let ok = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const ids = toDelete.slice(i, i + 100).map((r) => r.id);
    const { error } = await sb.from("races").delete().in("id", ids);
    if (!error) ok += ids.length;
  }
  console.log(`✅ ${ok}/${toDelete.length} anciennes lignes supprimées`);
  const { count } = await sb.from("races").select("id", { count: "exact", head: true }).gte("date", new Date().toISOString().slice(0, 10)).lt("date", "2099-01-01");
  console.log(`Courses à venir restantes: ${count}`);
})().catch((e) => console.log("FATAL", e.message));
