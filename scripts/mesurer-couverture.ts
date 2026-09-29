/**
 * COUVERTURE DU CATALOGUE — mesurée sur un échantillon INDÉPENDANT (29/09/2026).
 *
 * Les courses à venir de 12 départements selon le calendrier kikourou (export iCal public,
 * mis en cache le 28/09/2026 dans ~/Desktop/Pacevo/cache-finishers/kikourou) : combien le
 * catalogue en connaît, et avec la bonne date. Un ÉCHANTILLON pour mesurer, pas une copie.
 * `--base <sauvegarde.json>` mesure une sauvegarde (l'état d'avant) avec la même règle.
 *
 *   npx tsx --env-file=.env.local scripts/mesurer-couverture.ts [--base f.json] [--absentes]
 */
import { readFileSync, readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { motsDistinctifs } from "../src/lib/races/resultatsSite";

const DIR = `${process.env.HOME}/Desktop/Pacevo/cache-finishers/kikourou`;
const i = process.argv.indexOf("--base");
const base = i > 0 ? process.argv[i + 1] : null;
const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const ville = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(\d+)(e|er|eme)?\b/g, " ").replace(/\bst\b/g, "saint").replace(/\bste\b/g, "sainte").replace(/[^a-z]+/g, " ").trim();
type R = { name: string; city: string | null; date: string };

async function lignes(): Promise<R[]> {
  if (base) return JSON.parse(readFileSync(base, "utf8")) as R[];
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const out: R[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("name, city, date").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message); out.push(...(data as R[])); if (!data || data.length < 1000) break;
  }
  return out;
}

(async () => {
  const evts = new Map<string, { nom: string; ville: string; date: string }>();
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".ics"))) {
    const brut = readFileSync(`${DIR}/${f}`, "utf8");
    // L'export est encodé DEUX fois (« FoulÃ©es ») : on défait la seconde couche.
    const t = /Ã[\u0080-¿]/.test(brut) ? Buffer.from(brut, "latin1").toString("utf8") : brut;
    for (const b of t.split("BEGIN:VEVENT").slice(1)) {
      const s = b.match(/SUMMARY:(.*)/)?.[1]?.trim() ?? ""; const d = b.match(/DTSTART:(\d{8})/)?.[1] ?? "";
      const m = s.match(/^(.*?)(?: - [^()]*)? \(([^()]*) - [^()]*\)$/);
      const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      if (!m || date < aujourdhui || date.startsWith("1970")) continue;
      evts.set(`${m[1]}|${m[2]}|${date}`, { nom: m[1].trim(), ville: m[2].trim(), date });
    }
  }
  const parVille = new Map<string, R[]>();
  for (const r of await lignes()) { const k = ville(r.city); (parVille.get(k) ?? parVille.set(k, []).get(k)!).push(r); }
  let bonneDate = 0, autreDate = 0; const absentes: string[] = [];
  const jours = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
  for (const e of evts.values()) {
    const mots = motsDistinctifs(e.nom);
    const memes = (parVille.get(ville(e.ville)) ?? []).filter((r) => mots.length === 0 || mots.some((m) => motsDistinctifs(r.name).includes(m)));
    if (memes.some((r) => !r.date.startsWith("2099") && jours(r.date, e.date) <= 1)) bonneDate++;
    else if (memes.length) { autreDate++; if (process.argv.includes("--ecarts")) console.log("ÉCART", e.date, e.nom, "(", e.ville, ") →", memes.slice(0, 3).map((r) => `${r.name} ${r.date}`).join(" ; ")); }
    else absentes.push(`${e.date} ${e.nom} (${e.ville})`);
  }
  const n = evts.size;
  console.log(JSON.stringify({ base: base ?? "production", courses: n, connues: bonneDate + autreDate, bonneDate, autreDate, absentes: absentes.length,
    tauxConnues: `${Math.round((bonneDate + autreDate) / n * 100)} %`, tauxBonneDate: `${Math.round(bonneDate / n * 100)} %` }));
  if (process.argv.includes("--absentes")) console.log(absentes.sort().join("\n"));
})();
