/**
 * CLASSEMENTS DES ÉDITIONS PASSÉES — les retrouver, les VÉRIFIER, les écrire (30/09/2026).
 *
 * Pour chaque lien de classement dont l'adresse porte son année une seule fois, on essaie les
 * trois éditions précédentes (lib/races/editionsResultats). Chaque page est OUVERTE : n'est
 * retenue qu'une réponse 2xx qui porte encore l'année demandée. Et on ouvre d'abord un
 * TÉMOIN (même adresse, année 1999) : si le site le « trouve » aussi, il répond à tout — on
 * n'en retient rien. robots.txt respecté ; jamais deux requêtes au même hôte en même temps.
 *
 * Résultats mis en cache (JSONL, reprenable) ; `--ecrire` remplit `races.resultats_editions`
 * (migration 033). Sans la colonne, rien n'est écrit et le script le dit.
 *
 *   npx tsx --env-file=.env.local scripts/resultats-editions.ts <cache.jsonl> [--ecrire]
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { adressesEditions, pageTrouvee, type EditionResultats } from "../src/lib/races/editionsResultats";
import { robotsAutorise } from "../src/lib/races/resultatsSite";

const UA = "Mozilla/5.0 (compatible; PacevoBot/1.0; +https://pacevo.fr/contact)";
const ECRIRE = process.argv.includes("--ecrire");
const [cache] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

type Ligne = { url: string; annee: number; editions: EditionResultats[]; temoinTrouve: boolean; lueLe: string };

async function ouvrir(url: string): Promise<{ code: number; finale: string }> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    try { await r.body?.cancel(); } catch { /* */ }
    return { code: r.status, finale: r.url || url };
  } catch { return { code: 0, finale: url }; }
}

async function main() {
  if (!cache) throw new Error("usage : resultats-editions.ts <cache.jsonl> [--ecrire]");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (u, o) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(30_000) }) },
  });
  const lignes: { id: string; resultats_url: string; resultats_annee: number | null }[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id, resultats_url, resultats_annee").not("resultats_url", "is", null).order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    lignes.push(...((data ?? []) as typeof lignes)); if (!data || data.length < 1000) break;
  }
  const parUrl = new Map<string, number>();
  for (const l of lignes) if (l.resultats_annee) parUrl.set(l.resultats_url, l.resultats_annee);

  const faits = new Map<string, Ligne>();
  if (existsSync(cache)) for (const t of readFileSync(cache, "utf8").split("\n")) { try { const x = JSON.parse(t) as Ligne; if (x?.url) faits.set(x.url, x); } catch { /* */ } }
  const aLire = [...parUrl].filter(([u, a]) => !faits.has(u) && adressesEditions(u, a));
  console.log(`[éditions] ${parUrl.size} liens datés, ${aLire.length} à vérifier, ${faits.size} déjà en cache`);

  const robots = new Map<string, Promise<string | null | "inconnu">>();
  const robotsDe = (o: string) => {
    if (!robots.has(o)) robots.set(o, fetch(`${o}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) })
      .then(async (r) => (r.status === 200 ? await r.text() : r.status === 404 || r.status === 410 ? null : "inconnu")).catch(() => "inconnu" as const));
    return robots.get(o)!;
  };
  const occupes = new Set<string>();
  const file = [...aLire];
  let n = 0, trouvees = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let x; (x = file.shift());) {
      const [url, annee] = x;
      const c = adressesEditions(url, annee)!;
      const u = new URL(url);
      while (occupes.has(u.host)) await new Promise((r) => setTimeout(r, 200));
      occupes.add(u.host);
      try {
        const rb = await robotsDe(u.origin);
        let editions: EditionResultats[] = [], temoinTrouve = false;
        if (rb !== "inconnu" && robotsAutorise(rb, u.pathname)) {
          const t = await ouvrir(c.temoin);
          temoinTrouve = pageTrouvee(t.code, t.finale, 1999);
          if (!temoinTrouve) for (const cand of c.candidates) {
            await new Promise((r) => setTimeout(r, 250));
            const o = await ouvrir(cand.url);
            if (pageTrouvee(o.code, o.finale, cand.annee)) editions.push(cand);
          }
        }
        trouvees += editions.length;
        appendFileSync(cache, JSON.stringify({ url, annee, editions, temoinTrouve, lueLe: new Date().toISOString() } satisfies Ligne) + "\n");
        faits.set(url, { url, annee, editions, temoinTrouve, lueLe: "" });
      } finally { occupes.delete(u.host); }
      if (++n % 50 === 0) console.log(`[éditions] ${n}/${aLire.length} — ${trouvees} éditions vérifiées`);
    }
  }));
  const avec = [...faits.values()].filter((l) => l.editions.length);
  console.log(JSON.stringify({ liensVerifies: faits.size, avecEditions: avec.length, editions: avec.reduce((s, l) => s + l.editions.length, 0), sitesAttrapeTout: [...faits.values()].filter((l) => l.temoinTrouve).length }));
  for (const l of avec.slice(0, 8)) console.log(`  ${l.url.slice(0, 80)} → ${l.editions.map((e) => e.annee).join(", ")}`);
  if (!ECRIRE) { console.log("(à blanc — rien écrit)"); return; }

  // La colonne existe-t-elle (migration 033) ?
  const sonde = await sb.from("races").select("resultats_editions").limit(1);
  if (sonde.error?.code === "42703") { console.error("ARRÊT : la colonne races.resultats_editions n'existe pas — exécuter supabase/migrations/033_courses_editions_resultats.sql."); process.exit(2); }
  if (sonde.error) throw new Error(sonde.error.message);
  let ok = 0, ko = 0;
  for (const l of avec) {
    const { error } = await sb.from("races").update({ resultats_editions: l.editions }).eq("resultats_url", l.url);
    if (error) { ko++; if (ko < 4) console.error(error.message); } else ok++;
  }
  console.log(`liens mis à jour : ${ok}, erreurs : ${ko}`);
  if (ko) process.exit(1);
}

if (process.argv[1]?.endsWith("resultats-editions.ts")) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
