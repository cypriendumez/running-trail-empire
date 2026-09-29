/**
 * SAUVEGARDE COMPLÈTE DE LA TABLE `races` avant toute écriture massive (29/09/2026).
 * Écrit un JSON horodaté HORS du dépôt ; relisible pour revenir en arrière.
 *
 *   npx tsx --env-file=.env.local scripts/sauvegarder-courses.ts [dossier]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const dossier = process.argv[2] ?? `${process.env.HOME}/Desktop/Pacevo/cache-finishers`;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  const rows: unknown[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("*").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  mkdirSync(dossier, { recursive: true });
  const f = `${dossier}/races-sauvegarde-${new Date().toISOString().slice(0, 16).replace(/:/g, "h")}.json`;
  writeFileSync(f, JSON.stringify(rows));
  console.log(`${rows.length} lignes → ${f}`);
})().catch((e) => { console.error(e); process.exit(1); });
