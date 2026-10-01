/**
 * LE ROBOT DE VEILLE DES COURSES — résultats, dates, inscriptions, parcours (01/10/2026).
 *
 * Cyprien : « crée des sortes de bots qui mettent instantanément les liens des parcours, les
 * dates, les résultats sur mon application quand ça sort ». Ce script relit la page
 * OFFICIELLE de chaque course et applique `lib/races/veille` (ce qui décide y est, testé).
 *
 *   --fenetre : la veille QUOTIDIENNE — les courses de J-12 à J+60 (les résultats tombent
 *               dans les jours qui suivent ; tracé et inscription, avant), plus un lot de
 *               courses « à venir » relues le moins récemment (`veille_at`, migration 034).
 *   sans      : la veille HEBDOMADAIRE — tout le catalogue qui a une page officielle.
 *
 * Politesse : robots.txt respecté, une requête à la fois par hôte, 12 s de délai ; une
 * réponse incertaine (réseau, 403, 429, 5xx) ne change rien. À blanc par défaut ;
 * `--ecrire` écrit, sous le seuil `--max` (sinon arrêt, code 2).
 *
 *   npx tsx --env-file=.env.local scripts/veille-courses.ts <rapport.json> [--fenetre] [--ecrire] [--max <n>]
 *   npx tsx --env-file=.env.local scripts/veille-courses.ts --appliquer <rapport.json> [--ecrire] [--max <n>]
 *     → écrit les modifications d'un rapport à blanc déjà relu (sans relire les pages),
 *       chaque lien revalidé par les règles du jour ; à blanc sans `--ecrire`.
 */
import { UA_PACEVOBOT, siteExclu } from "../src/lib/races/robot";
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { pageOfficielle, lirePage, deciderVeille, lienVeilleAccepte, type CourseVeillee, type PageLue } from "../src/lib/races/veille";
import { reponseIncertaine } from "../src/lib/races/editionsResultats";
import { robotsAutorise } from "../src/lib/races/resultatsSite";
import { jourFrance } from "../src/lib/races/jourFrance";
import { seuil } from "./garde-fous";

// L'identité déclarée de PacevoBot, en un seul endroit (lib/races/robot → pacevo.fr/robot).
const UA = UA_PACEVOBOT;
const ECRIRE = process.argv.includes("--ecrire");
const FENETRE = process.argv.includes("--fenetre");
const [rapport] = process.argv.slice(2).filter((a, i, t) => !a.startsWith("--") && !t[i - 1]?.startsWith("--"));
/** Courses « à venir » relues chaque jour, les moins récemment vues d'abord. */
const A_VENIR_PAR_JOUR = 400;

const decaler = (jour: string, n: number) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Les modifications d'un rapport, réécrites telles quelles : ce qu'on a relu est ce qui part. */
async function appliquerRapport(fichier: string, max: number) {
  const r = JSON.parse(readFileSync(fichier, "utf8")) as { patchs?: Record<string, Record<string, unknown>> };
  const patchs = Object.entries(r.patchs ?? {});
  if (patchs.length > max) { console.error(`ARRÊT : ${patchs.length} courses à modifier (> ${max}).`); process.exit(2); }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (u, o) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(30_000) }) },
  });
  // ⚠️ CHAQUE LIEN EST REVALIDÉ par les règles d'AUJOURD'HUI (`lienVeilleAccepte`) : un
  // rapport produit avant une règle ne peut pas écrire ce qu'elle refuse.
  const pages = new Map<string, string | null>();
  const ids = patchs.map(([id]) => id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from("races").select("id, site_officiel, registration_url").in("id", ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) pages.set(r.id as string, pageOfficielle(r));
  }
  let ecartes = 0;
  const lots = new Map<string, { patch: Record<string, unknown>; ids: string[] }>();
  for (const [id, brut] of patchs) {
    const page = pages.get(id);
    if (!page) { ecartes++; continue; }
    const patch = { ...brut };
    const refuse = (quoi: "resultats" | "inscription" | "parcours", champ: string) => {
      if (typeof patch[champ] === "string" && !lienVeilleAccepte(quoi, patch[champ] as string, page)) { delete patch[champ]; if (champ === "resultats_url") delete patch.resultats_annee; ecartes++; }
    };
    refuse("resultats", "resultats_url"); refuse("inscription", "inscription_url"); refuse("parcours", "parcours_url");
    if (!Object.keys(patch).length) continue;
    const k = JSON.stringify(patch); const g = lots.get(k) ?? { patch, ids: [] }; g.ids.push(id); lots.set(k, g);
  }
  console.log(`[veille] rapport : ${patchs.length} courses, ${ecartes} lien(s) écarté(s) par les règles actuelles`);
  if (!ECRIRE) { console.log("(à blanc — rien écrit ; ajouter --ecrire)"); return; }
  let ok = 0, ko = 0;
  for (const g of lots.values()) for (let i = 0; i < g.ids.length; i += 200) {
    const lot = g.ids.slice(i, i + 200);
    const { error } = await sb.from("races").update({ ...g.patch, updated_at: new Date().toISOString() }).in("id", lot);
    if (error) { ko++; if (ko < 4) console.error(error.message); } else ok += lot.length;
  }
  console.log(`courses mises à jour depuis le rapport : ${ok}, lots en erreur : ${ko}`);
  if (ko) process.exit(1);
}

async function main() {
  const iApp = process.argv.indexOf("--appliquer");
  if (iApp >= 0) return appliquerRapport(process.argv[iApp + 1], seuil(process.argv, "--max", 4000));
  if (!rapport) throw new Error("usage : veille-courses.ts <rapport.json> [--fenetre] [--ecrire] [--max <n>]");
  const max = seuil(process.argv, "--max", FENETRE ? 800 : 4000);
  const aujourdhui = jourFrance();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (u, o) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(30_000) }) },
  });
  // Ce que la base sait stocker (migrations 032 et 034) : une colonne absente n'est ni lue ni écrite.
  const existe = async (col: string) => { const r = await sb.from("races").select(col).limit(1); if (r.error && r.error.code !== "42703") throw new Error(r.error.message); return !r.error; };
  const colonnes = { confirmee: await existe("date_confirmee"), parcours: await existe("parcours_url"), veille: await existe("veille_at") };
  const champs = ["id", "name", "city", "date", "distance_km", "site_officiel", "registration_url", "inscription_url", "resultats_url", "resultats_annee",
    ...(colonnes.confirmee ? ["date_confirmee"] : []), ...(colonnes.parcours ? ["parcours_url"] : []), ...(colonnes.veille ? ["veille_at"] : [])].join(", ");
  type Ligne = CourseVeillee & { site_officiel: string | null; registration_url: string | null; veille_at?: string | null };
  const lignes: Ligne[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select(champs).order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    lignes.push(...((data ?? []) as unknown as Ligne[])); if (!data || data.length < 1000) break;
  }
  let cibles = lignes.filter((l) => pageOfficielle(l));
  if (FENETRE) {
    const de = decaler(aujourdhui, -12), a = decaler(aujourdhui, 60);
    const fenetre = cibles.filter((l) => l.date && l.date >= de && l.date <= a);
    const aVenir = colonnes.veille
      ? cibles.filter((l) => String(l.date ?? "").startsWith("2099"))
        .sort((x, y) => String(x.veille_at ?? "").localeCompare(String(y.veille_at ?? ""))).slice(0, A_VENIR_PAR_JOUR)
      : [];
    cibles = [...new Map([...fenetre, ...aVenir].map((l) => [l.id, l])).values()];
  }
  const parPage = new Map<string, Ligne[]>();
  for (const l of cibles) { const u = pageOfficielle(l)!; parPage.set(u, [...(parPage.get(u) ?? []), l]); }
  console.log(`[veille] ${FENETRE ? "quotidienne" : "hebdomadaire"} : ${cibles.length} courses, ${parPage.size} pages officielles · colonnes ${JSON.stringify(colonnes)}`);

  const robots = new Map<string, Promise<string | null | "inconnu">>();
  const robotsDe = (o: string) => {
    if (!robots.has(o)) robots.set(o, fetch(`${o}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) })
      .then(async (r) => (r.status === 200 ? await r.text() : r.status === 404 || r.status === 410 ? null : "inconnu")).catch(() => "inconnu" as const));
    return robots.get(o)!;
  };
  const occupes = new Set<string>();
  const patchs = new Map<string, Record<string, unknown>>();
  const vues: string[] = [];
  const exemples: string[] = [];
  const file = [...parPage.keys()];
  let n = 0, lues = 0, incertaines = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let url; (url = file.shift());) {
      let u: URL; try { u = new URL(url); } catch { continue; }
      while (occupes.has(u.host)) await new Promise((r) => setTimeout(r, 200));
      occupes.add(u.host);
      try {
        const rb = await robotsDe(u.origin);
        if (rb === "inconnu" || !robotsAutorise(rb, u.pathname + u.search)) { incertaines++; continue; }
        let code = 0, html = "";
        try {
          const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
          code = r.status;
          if (r.ok && /html/i.test(r.headers.get("content-type") ?? "")) html = (await r.text()).slice(0, 1_500_000); else { try { await r.body?.cancel(); } catch { /* */ } }
        } catch { code = 0; }
        if (reponseIncertaine(code)) { incertaines++; continue; }   // une panne ne décide rien
        lues++;
        const page: PageLue | null = html ? lirePage(html, url, aujourdhui) : null;
        for (const l of parPage.get(url) ?? []) {
          vues.push(l.id);
          if (!page) continue;
          const patch = deciderVeille(l, page, aujourdhui, colonnes);
          if (Object.keys(patch).length) {
            patchs.set(l.id, patch);
            if (exemples.length < 40) exemples.push(`${l.name} (${l.distance_km ?? "?"} km) : ${Object.entries(patch).map(([k, v]) => `${k}=${String(v).slice(0, 80)}`).join(" · ")}`);
          }
        }
        await new Promise((r) => setTimeout(r, 250));
      } finally { occupes.delete(u.host); }
      if (++n % 200 === 0) console.log(`[veille] ${n}/${parPage.size}`);
    }
  }));

  const compte = (k: string) => [...patchs.values()].filter((p) => k in p).length;
  const bilan = { courses: cibles.length, pages: parPage.size, lues, incertaines, aEcrire: patchs.size,
    resultats: compte("resultats_url"), inscriptions: compte("inscription_url"), parcours: compte("parcours_url"), dates: compte("date") };
  writeFileSync(rapport, JSON.stringify({ ...bilan, exemples, patchs: Object.fromEntries(patchs) }, null, 1));
  console.log(JSON.stringify(bilan));
  for (const e of exemples.slice(0, 25)) console.log(`  ${e}`);
  if (!ECRIRE) { console.log("(à blanc — rien écrit)"); return; }
  if (patchs.size > max) { console.error(`ARRÊT : ${patchs.size} courses à modifier (> ${max}). Relire le rapport avant d'écrire.`); process.exit(2); }
  // Les patchs identiques partent ensemble ; chaque course vue reçoit sa date de veille.
  const lots = new Map<string, { patch: Record<string, unknown>; ids: string[] }>();
  for (const [id, patch] of patchs) { const k = JSON.stringify(patch); const g = lots.get(k) ?? { patch, ids: [] }; g.ids.push(id); lots.set(k, g); }
  let ok = 0, ko = 0;
  for (const g of lots.values()) for (let i = 0; i < g.ids.length; i += 200) {
    const lot = g.ids.slice(i, i + 200);
    const { error } = await sb.from("races").update({ ...g.patch, updated_at: new Date().toISOString() }).in("id", lot);
    if (error) { ko++; if (ko < 4) console.error(error.message); } else ok += lot.length;
  }
  if (colonnes.veille) {
    const quand = new Date().toISOString();
    for (let i = 0; i < vues.length; i += 300) {
      const { error } = await sb.from("races").update({ veille_at: quand }).in("id", vues.slice(i, i + 300));
      if (error) { ko++; if (ko < 4) console.error(error.message); }
    }
  }
  console.log(`courses mises à jour : ${ok}, lots en erreur : ${ko}`);
  if (ko) process.exit(1);
}

if (process.argv[1]?.endsWith("veille-courses.ts")) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
