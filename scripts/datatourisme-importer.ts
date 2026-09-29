/**
 * IMPORT DES COURSES LOCALES DATATOURISME (Licence Ouverte 2.0) — voir lib/races/datatourisme.
 *
 * À blanc par défaut ; `--ecrire` insère. Une course déjà au catalogue (même ville, un mot
 * distinctif du nom en commun) n'est JAMAIS réimportée. Idempotent : `source_id` porte
 * l'identifiant DATAtourisme et la distance.
 *
 *   curl -L -o fma.csv <datatourisme-fma.csv sur data.gouv.fr>
 *   npx tsx --env-file=.env.local scripts/datatourisme-importer.ts fma.csv [--ecrire]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { lireCsv, evenementCourse, lignesDT } from "../src/lib/races/datatourisme";
import { motsDistinctifs } from "../src/lib/races/resultatsSite";

const ECRIRE = process.argv.includes("--ecrire");
const [fichier] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const ville = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(\d+)(e|er|eme)? arrondissement\b/g, "").trim();

async function main() {
  const lignes = lireCsv(readFileSync(fichier, "utf8"));
  const tete = lignes[0];
  const evts = lignes.slice(1).map((l) => Object.fromEntries(tete.map((c, i) => [c, l[i] ?? ""])))
    .map((r) => evenementCourse(r, aujourdhui)).filter((e): e is NonNullable<typeof e> => !!e);

  const parVille = new Map<string, string[][]>(); const sources = new Set<string>();
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("name, city, source_id").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const k = ville(r.city); (parVille.get(k) ?? parVille.set(k, []).get(k)!).push(motsDistinctifs(String(r.name)));
      if (r.source_id) sources.add(String(r.source_id));
    }
    if (!data || data.length < 1000) break;
  }
  const deja = (nom: string, commune: string) => {
    const mots = motsDistinctifs(nom);
    return (parVille.get(ville(commune)) ?? []).some((m) => mots.length === 0 || mots.some((x) => m.includes(x)));
  };
  const nouveaux = evts.filter((e) => !deja(e.nom, e.commune));
  const maintenant = new Date().toISOString();
  const aInserer = nouveaux.flatMap((e) => lignesDT(e, maintenant)).filter((l) => !sources.has(String(l.source_id)));
  console.log(JSON.stringify({ manifestations: lignes.length - 1, coursesStrictes: evts.length, dejaAuCatalogue: evts.length - nouveaux.length, nouveauxEvenements: nouveaux.length, lignes: aInserer.length }, null, 1));
  for (const e of nouveaux) console.log(`  ${e.date} ${e.nom} (${e.commune}, ${e.departement.nom}) ${e.kms.join("/")} km — ${e.site.slice(0, 50)}`);
  if (!ECRIRE) { console.log("(à blanc — rien écrit)"); return; }
  const { error } = await sb.from("races").insert(aInserer);
  console.log(error ? `insertion : ${error.message}` : `insérées : ${aInserer.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
