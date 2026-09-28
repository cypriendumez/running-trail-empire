/**
 * CONTRÔLE DES LIENS « S'INSCRIRE » ET « CLASSEMENT » DES COURSES (29/09/2026).
 *
 * Cyprien : « revérifie que les classements des courses fonctionnent bien ». Un lien écrit
 * en base ne prouve rien : on OUVRE chaque adresse. Mêmes règles que le contrôle des liens
 * d'inscription (`lib/races/liens`) : seuls 404 et 410 prouvent l'absence ; un 403 dit
 * « tu es bloqué », pas « la page n'existe pas » ; et il faut DEUX échecs, sur deux passages
 * espacés, avant de retirer un lien.
 *
 * Lecture seule par défaut ; `--ecrire` retire (NULL) les liens morts deux fois — jamais
 * `registration_url`, que la tâche quotidienne surveille déjà.
 *
 *   npx tsx --env-file=.env.local scripts/verifier-liens-courses.ts <rapport.json> [--ecrire]
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { verdictDe, type Verdict } from "../src/lib/races/liens";

const UA = "Mozilla/5.0 (compatible; PacevoBot/1.0; +https://pacevo.fr/contact)";
const ECRIRE = process.argv.includes("--ecrire");
const [sortie] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const CHAMPS = ["resultats_url", "inscription_url"] as const;
type Champ = (typeof CHAMPS)[number];

async function code(url: string): Promise<number> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    try { await r.body?.cancel(); } catch { /* corps déjà lu */ }
    return r.status;
  } catch { return 0; }
}

async function passage(urls: string[]): Promise<Map<string, number>> {
  const res = new Map<string, number>();
  const occupes = new Set<string>();
  const file = [...urls];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let u; (u = file.shift());) {
      const h = (() => { try { return new URL(u).host; } catch { return u; } })();
      while (occupes.has(h)) await new Promise((r) => setTimeout(r, 200));
      occupes.add(h);
      try { res.set(u, await code(u)); } finally { occupes.delete(h); }
      await new Promise((r) => setTimeout(r, 250));
    }
  }));
  return res;
}

async function main() {
  const lignes: { id: string; resultats_url: string | null; inscription_url: string | null }[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id, resultats_url, inscription_url")
      .or("resultats_url.not.is.null,inscription_url.not.is.null").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    lignes.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const parUrl = new Map<string, { champ: Champ; ids: string[] }[]>();
  for (const l of lignes) for (const c of CHAMPS) {
    const u = l[c]; if (!u) continue;
    const e = parUrl.get(u) ?? []; const x = e.find((y) => y.champ === c);
    if (x) x.ids.push(l.id); else e.push({ champ: c, ids: [l.id] });
    parUrl.set(u, e);
  }
  const urls = [...parUrl.keys()];
  console.log(`${lignes.length} lignes, ${urls.length} adresses distinctes à ouvrir`);
  const p1 = await passage(urls);
  const suspects = urls.filter((u) => verdictDe(p1.get(u) ?? 0) === "morte");
  console.log(`passage 1 : ${suspects.length} mortes (404/410) — second passage dans 2 min`);
  await new Promise((r) => setTimeout(r, 120_000));
  const p2 = await passage(suspects);
  const mortes = suspects.filter((u) => verdictDe(p2.get(u) ?? 0) === "morte");

  const bilan: Record<Champ, Record<Verdict, number>> = {
    resultats_url: { vivante: 0, morte: 0, indetermine: 0 }, inscription_url: { vivante: 0, morte: 0, indetermine: 0 },
  };
  for (const u of urls) for (const e of parUrl.get(u)!) {
    const v: Verdict = mortes.includes(u) ? "morte" : verdictDe(p1.get(u) ?? 0) === "morte" ? "indetermine" : verdictDe(p1.get(u) ?? 0);
    bilan[e.champ][v] += 1;
  }
  const codes: Record<string, number> = {};
  for (const c of p1.values()) codes[String(c)] = (codes[String(c)] ?? 0) + 1;
  const rapport = { le: new Date().toISOString(), adresses: urls.length, bilan, codes, mortes: mortes.map((u) => ({ u, champs: parUrl.get(u) })) };
  writeFileSync(sortie, JSON.stringify(rapport, null, 1));
  console.log(JSON.stringify({ bilan, codes }, null, 1));
  if (!ECRIRE) { console.log("(lecture seule — rien retiré)"); return; }
  let retires = 0;
  for (const u of mortes) for (const e of parUrl.get(u)!) {
    const { error } = await sb.from("races").update({ [e.champ]: null }).in("id", e.ids).eq(e.champ, u);
    if (error) console.error(`retrait ${e.champ} :`, error.message); else retires += e.ids.length;
  }
  console.log(`liens morts retirés : ${retires}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
