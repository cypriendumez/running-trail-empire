/**
 * RETIRER LES DOUBLONS PARFAITS (même nom, même ville, même date, même distance) — voir
 * lib/races/doublons. À blanc par défaut ; `--ecrire` retire. Jamais un favori, jamais une
 * ligne finishers.
 *
 *   npx tsx --env-file=.env.local scripts/dedoublonner-courses.ts [--ecrire] [--max-retraits N]
 */
import { createClient } from "@supabase/supabase-js";
import { doublonsParfaits, type LigneDoublon } from "../src/lib/races/doublons";
import { seuil, arreterSiDepasse } from "./garde-fous";

const ECRIRE = process.argv.includes("--ecrire");
/** Le grand ménage a eu lieu le 30/09/2026 ; ensuite, chaque semaine n'en apporte que quelques-uns. */
const MAX_RETRAITS = seuil(process.argv, "--max-retraits", 50);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (u, o) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(30_000) }) },
});

(async () => {
  const lignes: LigneDoublon[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races")
      .select("id,name,city,date,distance_km,organization,elevation_gain_m,resultats_url,inscription_url,site_officiel,latitude")
      .order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    lignes.push(...((data ?? []) as LigneDoublon[])); if (!data || data.length < 1000) break;
  }
  const favoris = new Set<string>();
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("notifications").select("data").eq("type", "race_favori").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const f of data ?? []) { const id = (f.data as { raceId?: string } | null)?.raceId; if (id) favoris.add(id); }
    if (!data || data.length < 1000) break;
  }
  const retraits = doublonsParfaits(lignes, favoris);
  const parId = new Map(lignes.map((l) => [l.id, l]));
  console.log(JSON.stringify({ lignes: lignes.length, doublonsParfaits: retraits.length }));
  for (const id of retraits.slice(0, 40)) { const l = parId.get(id)!; console.log(`  ${l.name} (${l.city}) ${l.distance_km} km ${l.date} [${l.organization || "∅"}]`); }
  if (!ECRIRE) { console.log("(à blanc — rien retiré)"); return; }
  arreterSiDepasse([{ quoi: "doublons à retirer", n: retraits.length, max: MAX_RETRAITS }]);
  let n = 0, refus = 0;
  for (let i = 0; i < retraits.length; i += 200) {
    const lot = retraits.slice(i, i + 200);
    const { error } = await sb.from("races").delete().in("id", lot);
    if (error) { console.error("retrait :", error.message); refus++; } else n += lot.length;
  }
  console.log(`retirés : ${n}`);
  if (refus) process.exit(1);
})().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
