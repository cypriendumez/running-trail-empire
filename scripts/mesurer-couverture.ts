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
import { departementDe } from "../src/lib/races/departements";

const DIR = `${process.env.HOME}/Desktop/Pacevo/cache-finishers/kikourou`;
const i = process.argv.indexOf("--base");
const base = i > 0 ? process.argv[i + 1] : null;
const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const ville = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(\d+)(e|er|eme)?\b/g, " ").replace(/\bst\b/g, "saint").replace(/\bste\b/g, "sainte").replace(/[^a-z]+/g, " ").trim();
type R = { name: string; city: string | null; date: string; department?: string | null };
// ⚠️ UNE APOSTROPHE NE COUPE PAS UN NOM (30/09/2026) : « Trail des Auri'gines » était compté
// absent face à « Trail des Aurigines » — « auri » + « gines » contre « aurigines ».
// Les DEUX lectures : recoller « Saint-Bruno » en « saintbruno » perdait « St Bruno ».
const mots = (nom: string) => [...new Set([...motsDistinctifs(nom), ...motsDistinctifs(nom.replace(/(\p{L})['’](\p{L})/gu, "$1$2"))])];

async function lignes(): Promise<R[]> {
  if (base) return JSON.parse(readFileSync(base, "utf8")) as R[];
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const out: R[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("name, city, date, department").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message); out.push(...(data as R[])); if (!data || data.length < 1000) break;
  }
  return out;
}

(async () => {
  const evts = new Map<string, { nom: string; ville: string; date: string; dep: string | null }>();
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".ics"))) {
    const dep = departementDe(f.match(/dep-(\w+)\.ics/)?.[1])?.code ?? null;
    const brut = readFileSync(`${DIR}/${f}`, "utf8");
    // L'export est encodé DEUX fois (« FoulÃ©es ») : on défait la seconde couche.
    const t = /Ã[\u0080-¿]/.test(brut) ? Buffer.from(brut, "latin1").toString("utf8") : brut;
    for (const b of t.split("BEGIN:VEVENT").slice(1)) {
      const s = b.match(/SUMMARY:(.*)/)?.[1]?.trim() ?? ""; const d = b.match(/DTSTART:(\d{8})/)?.[1] ?? "";
      const m = s.match(/^(.*?)(?: - [^()]*)? \(([^()]*) - [^()]*\)$/);
      const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      if (!m || date < aujourdhui || date.startsWith("1970")) continue;
      evts.set(`${m[1]}|${m[2]}|${date}`, { nom: m[1].trim(), ville: m[2].trim(), date, dep });
    }
  }
  const parVille = new Map<string, R[]>(), parDep = new Map<string, R[]>();
  for (const r of await lignes()) {
    const k = ville(r.city); (parVille.get(k) ?? parVille.set(k, []).get(k)!).push(r);
    const d = departementDe(r.department)?.code; if (d) (parDep.get(d) ?? parDep.set(d, []).get(d)!).push(r);
  }
  let bonneDate = 0, autreDate = 0; const absentes: string[] = [];
  const jours = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
  for (const e of evts.values()) {
    const m1 = mots(e.nom);
    const commun = (r: R) => m1.length === 0 || m1.some((m) => mots(r.name).includes(m));
    let memes = (parVille.get(ville(e.ville)) ?? []).filter(commun);
    // ⚠️ UN LIEU-DIT N'EST PAS UNE AUTRE COURSE : « Font d'Urle » est à Bouvante, « Epagny » est
    // devenu « Epagny Metz-Tessy ». Sans la même ville, il faut le même DÉPARTEMENT, un mot
    // distinctif commun ET la même date (± 1 jour) — jamais un nom seul.
    if (!memes.length && e.dep && m1.length) memes = (parDep.get(e.dep) ?? []).filter((r) => commun(r) && !r.date.startsWith("2099") && jours(r.date, e.date) <= 1);
    if (memes.some((r) => !r.date.startsWith("2099") && jours(r.date, e.date) <= 1)) bonneDate++;
    else if (memes.length) { autreDate++; if (process.argv.includes("--ecarts")) console.log("ÉCART", e.date, e.nom, "(", e.ville, ") →", memes.slice(0, 3).map((r) => `${r.name} ${r.date}`).join(" ; ")); }
    else absentes.push(`${e.date} ${e.nom} (${e.ville})`);
  }
  const n = evts.size;
  console.log(JSON.stringify({ base: base ?? "production", courses: n, connues: bonneDate + autreDate, bonneDate, autreDate, absentes: absentes.length,
    tauxConnues: `${Math.round((bonneDate + autreDate) / n * 100)} %`, tauxBonneDate: `${Math.round(bonneDate / n * 100)} %` }));
  if (process.argv.includes("--absentes")) console.log(absentes.sort().join("\n"));
})();
