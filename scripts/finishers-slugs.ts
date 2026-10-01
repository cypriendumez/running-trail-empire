/**
 * QUELLES FICHES RELIRE CETTE SEMAINE (rafraîchissement hebdomadaire, 29/09/2026).
 *
 * Relire les 12 000 événements du plan du site finishers prendrait cinq heures, dont la
 * moitié à l'étranger. On relit : les courses FRANÇAISES déjà au catalogue (dates,
 * dénivelés, liens, classements), plus les événements APPARUS au plan du site depuis la
 * semaine précédente (la liste des déjà-vus voyage d'une semaine à l'autre dans l'état du
 * workflow `courses-rafraichissement`, un artefact).
 * Le plan du site ne donne aucune date de modification : seule la comparaison le dit.
 * S'y ajoutent les fiches « à revoir » laissées par l'application précédente (illisibles,
 * ou françaises sans format encore publié) : déjà vues, elles n'auraient plus été relues.
 *
 * ⚠️ AMORCE. Sans liste des déjà-vus (premier passage, ou état perdu), TOUT le plan serait
 * « nouveau » : 7 000 fiches étrangères ou hors course à pied relues pour rien — trois
 * heures de requêtes chez finishers. On part alors du plan du 28/09/2026, lu en ENTIER
 * cette nuit-là (12 028 fiches) : seul ce qui est apparu depuis est relu.
 *
 *   npx tsx --env-file=.env.local scripts/finishers-slugs.ts <sortie.txt> <deja-vus.txt> [a-revoir.txt]
 */
import { UA_PACEVOBOT, siteExclu } from "../src/lib/races/robot";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

// L'identité déclarée de PacevoBot, en un seul endroit (lib/races/robot → pacevo.fr/robot).
const UA = UA_PACEVOBOT;

export const AMORCE_VUS = "scripts/amorces/finishers-vus-2026-09-28.txt.gz";

/** Les connues d'abord (ce qu'on rafraîchit), puis les nouvelles et celles à revoir — sans doublon. */
export function slugsARelire(plan: string[], connus: string[], vus: Set<string>, aRevoir: string[] = []): string[] {
  const auPlan = new Set(plan);
  const nouveaux = plan.filter((s) => !vus.has(s));
  // Une fiche à revoir qui a QUITTÉ le plan du site n'existe plus : inutile d'y retourner.
  return [...new Set([...connus, ...nouveaux, ...aRevoir.filter((s) => auPlan.has(s))])];
}

const lignes = (texte: string) => texte.split("\n").map((s) => s.trim()).filter(Boolean);

/** Les slugs d'un plan du site finishers (XML, éventuellement compressé sans en-tête). */
export function slugsDuPlan(brut: Buffer): string[] {
  const xml = brut[0] === 0x1f && brut[1] === 0x8b ? gunzipSync(brut).toString("utf8") : brut.toString("utf8");
  return [...new Set([...xml.matchAll(/<loc>https:\/\/www\.finishers\.com\/course\/([^<\/?#]+)<\/loc>/g)].map((m) => m[1]))];
}

async function main() {
  const [sortie, fichierVus, fichierARevoir] = process.argv.slice(2);
  if (siteExclu("https://www.finishers.com")) throw new Error("finishers.com a demandé à ne plus être lu (lib/races/robot) — collecte arrêtée.");
  const r = await fetch("https://api.finishers.com/public/sitemap/events.xml", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`plan du site : ${r.status}`);
  const plan = slugsDuPlan(Buffer.from(await r.arrayBuffer()));
  if (plan.length < 5000) throw new Error(`plan du site anormalement court (${plan.length}) — la source a changé ?`);

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const connus = new Set<string>();
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("registration_url").eq("organization", "finishers.com").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const x of data ?? []) { const s = String(x.registration_url ?? "").match(/finishers\.com\/course\/([^/?#]+)/)?.[1]; if (s) connus.add(s); }
    if (!data || data.length < 1000) break;
  }
  const amorce = !(fichierVus && existsSync(fichierVus));
  const vus = new Set(lignes(amorce ? gunzipSync(readFileSync(AMORCE_VUS)).toString("utf8") : readFileSync(fichierVus, "utf8")));
  const aRevoir = fichierARevoir && existsSync(fichierARevoir) ? lignes(readFileSync(fichierARevoir, "utf8")) : [];
  const liste = slugsARelire(plan, [...connus], vus, aRevoir);
  writeFileSync(sortie, liste.join("\n") + "\n");
  // Les vus s'ACCUMULENT : une fiche retirée du plan puis remise ne passe pas pour neuve.
  if (fichierVus) writeFileSync(fichierVus, [...new Set([...vus, ...plan])].join("\n") + "\n");
  console.log(JSON.stringify({ plan: plan.length, connus: connus.size, nouveaux: plan.filter((s) => !vus.has(s)).length, aRevoir: aRevoir.length, aRelire: liste.length, amorce }));
}

if (process.argv[1]?.endsWith("finishers-slugs.ts")) main().catch((e) => { console.error(e); process.exit(1); });
