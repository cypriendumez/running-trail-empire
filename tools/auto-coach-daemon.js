// Daemon LOCAL du coach autonome : toutes les 20 min, déclenche la synchro intervals.icu
// + le coach autonome (qui, à chaque NOUVELLE séance, publie la suivante sur le dashboard et la
// montre). « L'IA s'occupe du coach, sans rien faire. » Arrêt : pkill -f auto-coach-daemon
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^"|"$/g, "");
const SECRET = get("CRON_SECRET");
const BASE = process.env.BASE || "http://localhost:3000";
const EVERY_MS = 20 * 60 * 1000;
const LOG = path.join(ROOT, "coach.log");

// Logue chaque tick (horodaté ISO) dans coach.log ET sur stdout. Lancé en daemon avec
// stdout→/dev/null, c'est le fichier qui garde l'historique des synchros (comble l'angle mort).
function log(...a) {
  const line = `${new Date().toISOString()} ${a.join(" ")}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + "\n"); } catch { /* disque indispo → au moins stdout */ }
}

async function tick() {
  try {
    const r = await fetch(`${BASE}/api/cron/sync-all`, { headers: SECRET ? { Authorization: `Bearer ${SECRET}` } : {}, signal: AbortSignal.timeout(90000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) log("HTTP", r.status, j.error || "");
    else { const coached = (j.results || []).filter((x) => x.coached).length; log(`synchro: ${j.total_activities ?? 0} séance(s) · coach auto déclenché pour ${coached} athlète(s)`); }
  } catch (e) { log("erreur:", e.message); }
  // Classement des ligues (génération + score hebdo)
  try {
    const r = await fetch(`${BASE}/api/cron/leagues`, { headers: SECRET ? { Authorization: `Bearer ${SECRET}` } : {}, signal: AbortSignal.timeout(60000) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) log(`ligues: ${j.members ?? 0} classé(s) (sem. ${j.week ?? "?"})`);
    else log("ligues HTTP", r.status);
  } catch (e) { log("ligues erreur:", e.message); }
}

log(`🤖 Daemon coach autonome démarré (toutes les 20 min) → ${BASE}. Logs → coach.log. Arrêt : pkill -f auto-coach-daemon`);
tick();
setInterval(tick, EVERY_MS);
