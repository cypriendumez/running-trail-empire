// Seed de VFC (HRV) réaliste pour la démo — 14 jours.
// RÉVERSIBLE : une vraie synchro montre écrase ces valeurs (upsert sur user_id,date).
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);

const EMAIL = process.argv[2] || "cypriendumez@outlook.fr";
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const state = (h) => (h < 50 ? "recovery" : h > 80 ? "competition" : "optimal");

(async () => {
  const { data: list, error: e1 } = await sb.auth.admin.listUsers();
  if (e1) { console.log("Erreur listUsers:", e1.message); return; }
  const user = list.users.find((u) => u.email === EMAIL) || list.users[0];
  if (!user) { console.log("Aucun utilisateur trouvé."); return; }
  console.log("Utilisateur :", user.email, "·", user.id);

  const rows = [];
  let base = 68;
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    base += (Math.random() - 0.5) * 6;            // marche aléatoire douce
    const hrv = Math.round(Math.max(48, Math.min(82, base + (Math.random() - 0.5) * 8)));
    const sdnn = Math.round(hrv * 0.8 + (Math.random() - 0.5) * 10);
    rows.push({ user_id: user.id, date: d, hrv_ms: hrv, rmssd: hrv, sdnn, physiological_state: state(hrv) });
  }

  const { error } = await sb.from("hrv_data").upsert(rows, { onConflict: "user_id,date" });
  if (error) { console.log("Erreur upsert:", error.message); return; }
  const last = rows[rows.length - 1];
  console.log(`✅ ${rows.length} jours de VFC insérés. Aujourd'hui : ${last.hrv_ms} ms (${last.physiological_state})`);
  console.log("   Plage :", Math.min(...rows.map((r) => r.hrv_ms)), "→", Math.max(...rows.map((r) => r.hrv_ms)), "ms");
})();
