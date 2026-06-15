// Reclasse le champ `type` de chaque séance (les imports intervals.icu arrivent tous en « easy »)
// en CODES CANONIQUES compris par toute l'app (Ligue, TaperingWidget, BentoDashboard, coach) :
// easy · endurance · tempo · vma · long_run · trail · recovery. Préserve le trail, ne sur-classe
// pas la zone grise. Non destructif pour les séances non-course (strength, etc.).
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const { createClient } = require(path.join(ROOT, "node_modules/@supabase/supabase-js"));
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const APPLY = process.argv.includes("--apply");

function canonicalType(w, fcMax) {
  const km = +w.distance_km || 0, sec = +w.duration_seconds || 0, orig = String(w.type || "");
  if (km <= 0 || sec <= 0) return orig;                       // pas une course mesurée → on ne touche pas
  if (/trail/i.test(orig)) return "trail";                    // préserve le trail explicite
  if ((+w.elevation_gain_m || 0) / km > 25) return "trail";   // trail détecté par le dénivelé (>25 m/km)
  if (km >= 18 || sec >= 95 * 60) return "long_run";
  const pct = (w.avg_hr && fcMax) ? w.avg_hr / fcMax : null;
  if (pct != null) {
    if (pct >= 0.90) return "vma";        // effort intense (VO2/course)
    if (pct >= 0.85) return "tempo";      // seuil/tempo (vraie qualité)
    if (pct >= 0.68) return "easy";       // footing / zone grise (volume, PAS qualité) — enum: pas de "endurance"
    return "recovery";                    // récupération
  }
  return "easy";                          // sans FC : footing par défaut
}

(async () => {
  // Baselines (FC max) par user
  const { data: bases } = await sb.from("performance_baselines").select("user_id,max_hr,tested_at").order("tested_at", { ascending: false });
  const baseMax = {};
  for (const b of bases || []) if (baseMax[b.user_id] == null && b.max_hr) baseMax[b.user_id] = b.max_hr;

  // Tous les workouts (paginés)
  let all = [], from = 0;
  for (;;) {
    const { data, error } = await sb.from("workouts").select("id,user_id,type,distance_km,duration_seconds,avg_hr,max_hr,elevation_gain_m").order("date", { ascending: false }).range(from, from + 999);
    if (error) { console.error("DB", error.message); process.exit(1); }
    all = all.concat(data); if (data.length < 1000) break; from += 1000;
  }
  // FC max de repli par user (max observé en séance) si pas de baseline
  const obsMax = {};
  for (const w of all) { const m = +w.max_hr || 0; if (m > (obsMax[w.user_id] || 0)) obsMax[w.user_id] = m; }
  const fcMaxOf = (uid) => baseMax[uid] || (obsMax[uid] > 150 ? obsMax[uid] : null);

  let changed = 0; const dist = {};
  const updates = [];
  for (const w of all) {
    const nt = canonicalType(w, fcMaxOf(w.user_id));
    dist[nt] = (dist[nt] || 0) + 1;
    if (nt && nt !== w.type) { changed++; updates.push({ id: w.id, type: nt }); }
  }
  console.log(`Workouts: ${all.length} · à reclasser: ${changed}`);
  console.log("Distribution cible:", JSON.stringify(dist));
  if (!APPLY) { console.log("DRY-RUN (relance avec --apply pour écrire)"); return; }
  let ok = 0;
  for (const u of updates) { const { error } = await sb.from("workouts").update({ type: u.type }).eq("id", u.id); if (!error) ok++; }
  console.log(`✅ ${ok}/${updates.length} séances reclassées en base`);
})().catch((e) => console.log("ERR", e.message));
