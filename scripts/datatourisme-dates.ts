/**
 * DATES RETROUVÉES DANS DATATOURISME pour les courses restées « Date à venir » (29/09/2026).
 *
 * La date publiée par l'office de tourisme de la commune, pour la MÊME course (règle :
 * `dateRetrouvee` dans lib/races/datatourisme). À blanc par défaut ; `--ecrire` met à jour.
 * `date_confirmee` reste null : c'est la date déclarée pour l'édition, pas une estimation.
 *
 *   npx tsx --env-file=.env.local scripts/datatourisme-dates.ts fma.csv [--ecrire]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { lireCsv, manifestationsDatees, dateRetrouvee } from "../src/lib/races/datatourisme";

const ECRIRE = process.argv.includes("--ecrire");
const [fichier] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const dans13Mois = new Date(Date.now() + 396 * 864e5).toISOString().slice(0, 10);

async function main() {
  const L = lireCsv(readFileSync(fichier, "utf8"));
  const tete = L[0];
  const parCommune = manifestationsDatees(L.slice(1).map((l) => Object.fromEntries(tete.map((c, i) => [c, l[i] ?? ""]))), aujourdhui, dans13Mois);
  const rows: { id: string; name: string; city: string | null }[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id, name, city").gte("date", "2099-01-01").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message); rows.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const majs = rows.map((r) => ({ r, date: dateRetrouvee(r, parCommune) })).filter((x): x is { r: typeof x.r; date: string } => !!x.date);
  console.log(JSON.stringify({ dateAVenir: rows.length, datesRetrouvees: majs.length, evenements: new Set(majs.map((x) => `${x.r.name}|${x.r.city}`)).size }));
  for (const x of majs.slice(0, 30)) console.log(`  ${x.date} ${x.r.name} (${x.r.city})`);
  if (!ECRIRE) { console.log("(à blanc — rien écrit)"); return; }
  let ok = 0, ko = 0;
  const maintenant = new Date().toISOString();
  for (let i = 0; i < majs.length; i += 8) {
    const res = await Promise.all(majs.slice(i, i + 8).map((x) => sb.from("races").update({ date: x.date, date_confirmee: null, source_maj_at: maintenant }).eq("id", x.r.id).gte("date", "2099-01-01")));
    for (const r of res) { if (r.error) { ko++; if (ko < 4) console.error(r.error.message); } else ok++; }
  }
  console.log(`dates écrites : ${ok}, erreurs : ${ko}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
