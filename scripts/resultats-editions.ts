/**
 * CLASSEMENTS DES ÉDITIONS PASSÉES — les retrouver, les VÉRIFIER, les écrire (30/09/2026).
 *
 * Deux sources, chacune vérifiée page par page avant d'être écrite :
 *   A. CHRONOMÉTREURS : quand l'adresse d'un classement porte son année (« …Coudous 2026/ »),
 *      les éditions précédentes sont essayées jusqu'à dix ans en arrière
 *      (lib/races/editionsResultats) — arrêt après trois années introuvables de suite. On
 *      ouvre d'abord un TÉMOIN (même adresse, année 1999) : un site qui le « trouve » répond
 *      à tout, on n'en retient rien.
 *   B. SITES D'ORGANISATEURS : les liens « Résultats 2024 », « Classement 2023 » relevés par
 *      `scripts/resultats-sites.ts` (page d'accueil et page d'archives). Un site partagé par
 *      plusieurs courses, ou dont les adresses forment plusieurs familles, ne donne rien
 *      (`editionsDuSite`). Chaque lien est OUVERT (`editionSiteVerifiee`) : 2xx, pas renvoyé
 *      à l'accueil, pas une page d'erreur, l'année dans l'adresse ou dans la page. Deux
 *      années qui mènent à la même page sont écartées toutes les deux.
 *
 * Chaque course reçoit la réunion des deux (une adresse par année, le chronométreur d'abord).
 * robots.txt respecté ; jamais deux requêtes au même hôte en même temps ; résultats en cache
 * (JSONL, reprenables). `--ecrire` remplit `races.resultats_editions` (migration 033).
 *
 *   npx tsx --env-file=.env.local scripts/resultats-editions.ts <cache.jsonl> [--ecrire]
 *   (lit `resultats-sites.jsonl` dans le même dossier que le cache)
 */
import { UA_PACEVOBOT, siteExclu } from "../src/lib/races/robot";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { adressesEditions, pageTrouvee, editionSiteVerifiee, editionsDuSite, fusionEditions, memesEditions, reponseIncertaine, sansPagePartagee, type EditionResultats } from "../src/lib/races/editionsResultats";
import { nomCanonique } from "../src/lib/races/groupes";
import { robotsAutorise } from "../src/lib/races/resultatsSite";

// L'identité déclarée de PacevoBot, en un seul endroit (lib/races/robot → pacevo.fr/robot).
const UA = UA_PACEVOBOT;
const ECRIRE = process.argv.includes("--ecrire");
const [cache] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
/** Profondeur des recherches par l'année (A) ; une ligne de cache plus courte est refaite. */
const PROFONDEUR = 10;
/** Trois années introuvables de suite : on arrête (2020 et 2021 annulées ne coupent pas la série). */
const TROUS_MAX = 3;

type LigneA = { url: string; annee: number; editions: EditionResultats[]; temoinTrouve: boolean; profondeur?: number; lueLe: string };
type LigneB = { verif: string; annee: number; ok: boolean; code?: number; finale?: string; lueLe: string };

async function ouvrir(url: string, lireCorps = false): Promise<{ code: number; finale: string; type: string; html: string | null }> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    const type = r.headers.get("content-type") ?? "";
    let html: string | null = null;
    if (lireCorps && r.ok && /html|xml/i.test(type)) html = (await r.text()).slice(0, 1_500_000);
    else { try { await r.body?.cancel(); } catch { /* */ } }
    return { code: r.status, finale: r.url || url, type, html };
  } catch { return { code: 0, finale: url, type: "", html: null }; }
}

async function main() {
  if (!cache) throw new Error("usage : resultats-editions.ts <cache.jsonl> [--ecrire]");
  const cacheB = join(dirname(cache), "editions-sites-verifiees.jsonl");
  const fSites = join(dirname(cache), "resultats-sites.jsonl");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (u, o) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(30_000) }) },
  });
  const sonde = await sb.from("races").select("resultats_editions").limit(1);
  const colonne = !(sonde.error?.code === "42703");
  if (sonde.error && colonne) throw new Error(sonde.error.message);
  type Ligne = { id: string; name: string | null; resultats_url: string | null; resultats_annee: number | null; site_officiel: string | null; resultats_editions?: unknown };
  const lignes: Ligne[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select(`id, name, resultats_url, resultats_annee, site_officiel${colonne ? ", resultats_editions" : ""}`)
      .or("resultats_url.not.is.null,site_officiel.not.is.null").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    lignes.push(...((data ?? []) as unknown as Ligne[])); if (!data || data.length < 1000) break;
  }

  // ── A. Chronométreurs ─────────────────────────────────────────────────────
  const parUrl = new Map<string, number>();
  for (const l of lignes) if (l.resultats_url && l.resultats_annee) parUrl.set(l.resultats_url, l.resultats_annee);
  const A = new Map<string, LigneA>();
  if (existsSync(cache)) for (const t of readFileSync(cache, "utf8").split("\n")) { try { const x = JSON.parse(t) as LigneA; if (x?.url) A.set(x.url, x); } catch { /* */ } }
  const aLireA = [...parUrl].filter(([u, a]) => (A.get(u)?.profondeur ?? 3) < PROFONDEUR && adressesEditions(u, a, PROFONDEUR));

  // ── B. Sites d'organisateurs ──────────────────────────────────────────────
  const sitesEditions = new Map<string, { annee: number; url: string }[]>();
  if (existsSync(fSites)) for (const t of readFileSync(fSites, "utf8").split("\n")) {
    try { const x = JSON.parse(t); if (x?.ok && x.site && Array.isArray(x.editions)) sitesEditions.set(x.site, x.editions); } catch { /* */ }
  }
  const B = new Map<string, LigneB>();
  if (existsSync(cacheB)) for (const t of readFileSync(cacheB, "utf8").split("\n")) { try { const x = JSON.parse(t) as LigneB; if (x?.verif) B.set(`${x.annee}|${x.verif}`, x); } catch { /* */ } }
  // Un site partagé par PLUSIEURS courses (club qui organise une corrida et un 10 km) : ses
  // « Résultats 2024 » ne disent pas de laquelle — on n'en attribue aucun.
  const coursesDuSite = new Map<string, Set<string>>();
  for (const l of lignes) if (l.site_officiel) coursesDuSite.set(l.site_officiel, (coursesDuSite.get(l.site_officiel) ?? new Set()).add(nomCanonique(l.name)));
  const retenues = new Map<string, EditionResultats[]>();
  let sitesPartages = 0;
  for (const [site, eds] of sitesEditions) {
    if (!coursesDuSite.has(site)) continue;
    if (coursesDuSite.get(site)!.size > 1) { sitesPartages++; continue; }
    const r = editionsDuSite(eds);
    if (r.length) retenues.set(site, r);
  }
  const aLireB: { annee: number; url: string }[] = [];
  for (const eds of retenues.values()) for (const e of eds) if (!B.has(`${e.annee}|${e.url}`)) aLireB.push(e);
  console.log(`[éditions] A : ${parUrl.size} liens datés, ${aLireA.length} à explorer ; B : ${retenues.size} sites (${sitesPartages} partagés écartés), ${aLireB.length} liens à vérifier`);

  // Politesse : robots.txt par origine, une requête à la fois par hôte.
  const robots = new Map<string, Promise<string | null | "inconnu">>();
  const robotsDe = (o: string) => {
    if (!robots.has(o)) robots.set(o, fetch(`${o}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) })
      .then(async (r) => (r.status === 200 ? await r.text() : r.status === 404 || r.status === 410 ? null : "inconnu")).catch(() => "inconnu" as const));
    return robots.get(o)!;
  };
  const occupes = new Set<string>();
  const sousVerrou = async <T>(url: string, f: (u: URL, rb: string | null | "inconnu") => Promise<T>) => {
    const u = new URL(url);
    // Opposition (lib/races/robot) : traité comme un robots.txt illisible — rien n'est lu, rien n'est mémorisé.
    if (siteExclu(url)) return f(u, "inconnu");
    while (occupes.has(u.host)) await new Promise((r) => setTimeout(r, 200));
    occupes.add(u.host);
    try { return await f(u, await robotsDe(u.origin)); } finally { occupes.delete(u.host); }
  };
  const taches: (() => Promise<void>)[] = [];
  let n = 0;
  for (const [url, annee] of aLireA) taches.push(async () => {
    const c = adressesEditions(url, annee, PROFONDEUR)!;
    await sousVerrou(url, async (u, rb) => {
      const editions: EditionResultats[] = []; let temoinTrouve = false;
      // Une réponse incertaine (réseau, 403, 429, 5xx, robots.txt illisible) : ce passage
      // ne prouve rien — on s'en sert pour cette fois, on ne le MÉMORISE pas.
      let incertain = rb === "inconnu";
      if (rb !== "inconnu" && robotsAutorise(rb, u.pathname)) {
        const t = await ouvrir(c.temoin);
        if (reponseIncertaine(t.code)) incertain = true;
        temoinTrouve = pageTrouvee(t.code, t.finale, 1999);
        let trous = 0;
        if (!temoinTrouve && !incertain) for (const cand of c.candidates) {
          await new Promise((r) => setTimeout(r, 250));
          const o = await ouvrir(cand.url);
          if (reponseIncertaine(o.code)) { incertain = true; break; }
          if (pageTrouvee(o.code, o.finale, cand.annee)) { editions.push(cand); trous = 0; } else if (++trous >= TROUS_MAX) break;
        }
      }
      const ligne: LigneA = { url, annee, editions, temoinTrouve, profondeur: PROFONDEUR, lueLe: new Date().toISOString() };
      if (!incertain) appendFileSync(cache, JSON.stringify(ligne) + "\n");
      A.set(url, ligne);
    });
  });
  for (const e of aLireB) taches.push(async () => {
    await sousVerrou(e.url, async (u, rb) => {
      let ok = false, finale = e.url, code = 0, incertain = rb === "inconnu";
      if (rb !== "inconnu" && robotsAutorise(rb, u.pathname + u.search)) {
        const o = await ouvrir(e.url, true);
        ok = editionSiteVerifiee({ ...o, demandee: e.url }, e.annee); finale = o.finale; code = o.code;
        if (!ok && reponseIncertaine(o.code)) incertain = true;
      }
      const ligne: LigneB = { verif: e.url, annee: e.annee, ok, code, finale, lueLe: new Date().toISOString() };
      // Refusé pour une raison PASSAGÈRE : pas de verdict en cache, on réessaiera.
      if (!incertain) appendFileSync(cacheB, JSON.stringify(ligne) + "\n");
      B.set(`${e.annee}|${e.url}`, ligne);
      await new Promise((r) => setTimeout(r, 250));
    });
  });
  const file = [...taches];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let t; (t = file.shift());) { await t(); if (++n % 100 === 0) console.log(`[éditions] ${n}/${taches.length}`); }
  }));

  // ── Réunion par course ────────────────────────────────────────────────────
  const verifieesB = (site: string): EditionResultats[] => sansPagePartagee((retenues.get(site) ?? [])
    .map((e) => ({ ...e, v: B.get(`${e.annee}|${e.url}`) })).filter((x) => x.v?.ok).map((x) => ({ annee: x.annee, url: x.url, finale: x.v!.finale ?? x.url })))
    .map(({ annee, url }) => ({ annee, url }));
  const aEcrire = new Map<string, { editions: EditionResultats[]; ids: string[] }>();
  let inchangees = 0;
  for (const l of lignes) {
    const deA = l.resultats_url ? A.get(l.resultats_url)?.editions ?? [] : [];
    const deB = l.site_officiel ? verifieesB(l.site_officiel) : [];
    const editions = fusionEditions(deA, deB);
    if (!editions.length) continue;
    const cle = JSON.stringify(editions);
    if (memesEditions(l.resultats_editions, editions)) { inchangees++; continue; }
    const g = aEcrire.get(cle) ?? { editions, ids: [] };
    g.ids.push(l.id); aEcrire.set(cle, g);
  }
  const lignesAEcrire = [...aEcrire.values()].reduce((s, g) => s + g.ids.length, 0);
  const annees = [...aEcrire.values()].flatMap((g) => g.editions.map((e) => e.annee));
  console.log(JSON.stringify({
    A: { liens: A.size, avecEditions: [...A.values()].filter((x) => x.editions.length).length, attrapeTout: [...A.values()].filter((x) => x.temoinTrouve).length },
    B: { verifiees: [...B.values()].filter((x) => x.ok).length, refusees: [...B.values()].filter((x) => !x.ok).length },
    lignesAEcrire, inchangees, plusAncienne: annees.length ? Math.min(...annees) : null,
  }));
  if (!ECRIRE) { console.log("(à blanc — rien écrit)"); return; }
  if (!colonne) { console.error("ARRÊT : la colonne races.resultats_editions n'existe pas — exécuter supabase/migrations/033_courses_editions_resultats.sql."); process.exit(2); }
  let ok = 0, ko = 0;
  for (const g of aEcrire.values()) for (let i = 0; i < g.ids.length; i += 200) {
    const lot = g.ids.slice(i, i + 200);
    const { error } = await sb.from("races").update({ resultats_editions: g.editions }).in("id", lot);
    if (error) { ko++; if (ko < 4) console.error(error.message); } else ok += lot.length;
  }
  console.log(`lignes mises à jour : ${ok}, lots en erreur : ${ko}`);
  if (ko) process.exit(1);
}

if (process.argv[1]?.endsWith("resultats-editions.ts")) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
