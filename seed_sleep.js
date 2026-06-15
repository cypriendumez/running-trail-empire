// Seed de sommeil réaliste (démo) — 14 nuits. RÉVERSIBLE (la vraie synchro écrase).
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const EMAIL = process.argv[2] || "cypriendumez@outlook.fr";
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));

(async () => {
  const { data: list, error } = await sb.auth.admin.listUsers();
  if (error) { console.log("Erreur:", error.message); return; }
  const user = list.users.find((u) => u.email === EMAIL) || list.users[0];
  if (!user) { console.log("Aucun utilisateur."); return; }
  const rows = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    const total = rnd(410, 485);              // 6h50 – 8h05
    const deep = rnd(60, 110), rem = rnd(75, 120);
    rows.push({ user_id: user.id, date, total_sleep_min: total, deep_sleep_min: deep, rem_sleep_min: rem, sleep_score: rnd(66, 89), body_battery_end: rnd(62, 95) });
  }
  const { error: e2 } = await sb.from("sleep_data").upsert(rows, { onConflict: "user_id,date" });
  if (e2) { console.log("Erreur upsert:", e2.message); return; }
  const last = rows[rows.length - 1];
  console.log(`✅ ${rows.length} nuits de sommeil insérées. Cette nuit : ${Math.floor(last.total_sleep_min / 60)}h${last.total_sleep_min % 60} · score ${last.sleep_score}/100 · Body Battery ${last.body_battery_end}%`);
})();
