/**
 * RETIRER LES ÉPREUVES QUI NE SONT PAS DE LA COURSE À PIED (nom sans ambiguïté) — voir
 * lib/races/nonCourse. À blanc par défaut ; `--ecrire` retire. Jamais un favori.
 *
 *   npx tsx --env-file=.env.local scripts/retirer-non-course.ts [--ecrire]
 */
import { createClient } from "@supabase/supabase-js";
import { pasCourseAPiedParNom } from "../src/lib/races/nonCourse";

const ECRIRE = process.argv.includes("--ecrire");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  const rows: { id: string; name: string; city: string | null }[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id, name, city").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message); rows.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const favs = new Set<string>();
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("notifications").select("data").eq("type", "race_favori").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const f of data ?? []) { const id = (f.data as { raceId?: string } | null)?.raceId; if (id) favs.add(id); }
    if (!data || data.length < 1000) break;
  }
  const cibles = rows.filter((r) => pasCourseAPiedParNom(r.name));
  const retraits = cibles.filter((r) => !favs.has(r.id));
  console.log(JSON.stringify({ lignes: rows.length, pasCourseAPied: cibles.length, protegesFavoris: cibles.length - retraits.length }));
  console.log([...new Set(retraits.map((r) => r.name))].slice(0, 60).join(" | "));
  if (!ECRIRE) { console.log("(à blanc — rien retiré)"); return; }
  let n = 0;
  for (let i = 0; i < retraits.length; i += 200) {
    const { error } = await sb.from("races").delete().in("id", retraits.slice(i, i + 200).map((r) => r.id));
    if (error) console.error("retrait :", error.message); else n += Math.min(200, retraits.length - i);
  }
  console.log(`retirées : ${n}`);
})().catch((e) => { console.error(e); process.exit(1); });
