/**
 * LES DATES VÉRIFIÉES SUR LE SITE OFFICIEL — étage « vérification » (30/09/2026).
 *
 * Cyprien : « trouve un moyen automatique pour qu'il mette les bonnes dates de courses,
 * avec une vérification ». La maintenance quotidienne ESTIME l'édition suivante d'une
 * course passée (même rang de week-end l'an prochain, « ≈ ») ; ce script la VÉRIFIE :
 *   - il relit la page officielle (site de l'organisateur, sinon la page d'inscription
 *     quand ce n'est pas un calendrier tiers) de chaque course « ≈ » ou « Date à venir » ;
 *   - une date FUTURE que la page annonce sans ambiguïté la remplace, CONFIRMÉE ;
 *   - une course « à venir » dont la page raconte l'édition du week-end dernier reçoit
 *     l'édition suivante ESTIMÉE (le cas des Foulées Lambersartoises).
 * Tout ce qui décide est dans `lib/races/prochaineEdition` (pur, testé). La page doit
 * NOMMER la course (un mot distinctif de son nom) : la page d'un club qui organise trois
 * épreuves ne date pas n'importe laquelle.
 *
 * Politesse : robots.txt respecté, une requête à la fois par hôte, 12 s de délai, cache
 * (une réponse incertaine — réseau, 403, 429, 5xx — n'est jamais mise en cache).
 *
 *   npx tsx --env-file=.env.local scripts/dates-sites.ts <cache.jsonl> [--ecrire] [--relire-apres <jours>] [--max <n>]
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { datesAnnoncees, dateDepuisPage, type DateLue } from "../src/lib/races/prochaineEdition";
import { reponseIncertaine } from "../src/lib/races/editionsResultats";
import { motsDistinctifs, robotsAutorise, estChronometreur } from "../src/lib/races/resultatsSite";
import { estPlateformeInscription } from "../src/lib/races/inscriptionSite";
import { estCalendrierTiers } from "../src/lib/races/destination";
import { jourFrance } from "../src/lib/races/jourFrance";
import { seuil } from "./garde-fous";

const UA = "Mozilla/5.0 (compatible; PacevoBot/1.0; +https://pacevo.fr/contact)";
const ECRIRE = process.argv.includes("--ecrire");
const [cache] = process.argv.slice(2).filter((a, i, t) => !a.startsWith("--") && !t[i - 1]?.startsWith("--"));

type Lecture = { url: string; code: number; dates: DateLue[]; texte: string; lueLe: string };

/**
 * La page officielle d'une course : le site de l'organisateur, sinon sa page d'inscription.
 * ⚠️ JAMAIS UN CALENDRIER, UNE PLATEFORME D'INSCRIPTION NI UN CHRONOMÉTREUR (30/09/2026) :
 * relu à la main, la fiche protiming du « Semi de la Juine » (édition 2022) affichait dans
 * sa colonne « autres événements » le Cross du Val d'Essonne du 8 novembre 2026 — que la
 * course aurait reçu comme date « confirmée ». Ces pages parlent de TOUTES leurs courses.
 */
export function pageOfficielle(c: { site_officiel?: string | null; registration_url?: string | null }): string | null {
  const http = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);
  const propre = (u: string | null) => (u && !estCalendrierTiers(u) && !estPlateformeInscription(u) && !estChronometreur(u) ? u : null);
  return propre(http(c.site_officiel)) ?? propre(http(c.registration_url));
}

/**
 * Les dates qui parlent DE CETTE COURSE : toutes, si le site porte son nom (« letraildubuis.fr ») ;
 * sinon seulement celles écrites à côté de son nom (±150 caractères). Une page de club qui
 * annonce trois épreuves ne date que celle qu'elle nomme près de la date.
 */
export function datesDeLaCourse(dates: readonly DateLue[], url: string, nom: string): DateLue[] {
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const mots = motsDistinctifs(nom);
  if (!mots.length) return [];
  let hote = ""; try { hote = norm(new URL(url).hostname).replace(/[^a-z0-9]/g, ""); } catch { return []; }
  if (mots.some((m) => hote.includes(m))) return [...dates];
  return dates.filter((x) => (x.contextes ?? []).some((c) => mots.some((m) => norm(c).includes(m))));
}

/** La page NOMME-t-elle la course ? Un mot distinctif de son nom, dans le texte ou l'adresse. */
export function pageNommeLaCourse(texte: string, url: string, nom: string): boolean {
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const mots = motsDistinctifs(nom);
  if (!mots.length) return false;
  let adresse = url; try { adresse = decodeURIComponent(url); } catch { /* adresse mal encodée : lue telle quelle */ }
  const t = norm(`${texte} ${adresse}`);
  return mots.some((m) => t.includes(m));
}

async function main() {
  if (!cache) throw new Error("usage : dates-sites.ts <cache.jsonl> [--ecrire]");
  const joursMax = seuil(process.argv, "--relire-apres", 7);
  const max = seuil(process.argv, "--max", 3000);
  const aujourdhui = jourFrance();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (u, o) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(30_000) }) },
  });
  type Ligne = { id: string; name: string; date: string | null; date_confirmee: boolean | null; site_officiel: string | null; registration_url: string | null };
  const lignes: Ligne[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id, name, date, date_confirmee, site_officiel, registration_url")
      .or(`date.eq.2099-01-01,and(date_confirmee.eq.false,date.gte.${aujourdhui})`).order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    lignes.push(...((data ?? []) as Ligne[])); if (!data || data.length < 1000) break;
  }
  const parUrl = new Map<string, Ligne[]>();
  for (const l of lignes) { const u = pageOfficielle(l); if (u) parUrl.set(u, [...(parUrl.get(u) ?? []), l]); }

  const lues = new Map<string, Lecture>();
  if (existsSync(cache)) for (const t of readFileSync(cache, "utf8").split("\n")) {
    try { const x = JSON.parse(t) as Lecture; if (x?.url && (Date.now() - Date.parse(x.lueLe)) / 864e5 <= joursMax) lues.set(x.url, x); } catch { /* */ }
  }
  const aLire = [...parUrl.keys()].filter((u) => !lues.has(u));
  console.log(`[dates] ${lignes.length} courses « ≈ » ou « à venir », ${parUrl.size} pages officielles, ${aLire.length} à lire`);

  const robots = new Map<string, Promise<string | null | "inconnu">>();
  const robotsDe = (o: string) => {
    if (!robots.has(o)) robots.set(o, fetch(`${o}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) })
      .then(async (r) => (r.status === 200 ? await r.text() : r.status === 404 || r.status === 410 ? null : "inconnu")).catch(() => "inconnu" as const));
    return robots.get(o)!;
  };
  const occupes = new Set<string>();
  const file = [...aLire];
  let n = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let url; (url = file.shift());) {
      let u: URL; try { u = new URL(url); } catch { continue; }
      while (occupes.has(u.host)) await new Promise((r) => setTimeout(r, 200));
      occupes.add(u.host);
      try {
        const rb = await robotsDe(u.origin);
        if (rb === "inconnu" || !robotsAutorise(rb, u.pathname + u.search)) continue;
        let code = 0, html = "";
        try {
          const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
          code = r.status;
          if (r.ok && /html/i.test(r.headers.get("content-type") ?? "")) html = (await r.text()).slice(0, 1_500_000); else { try { await r.body?.cancel(); } catch { /* */ } }
        } catch { code = 0; }
        if (reponseIncertaine(code)) continue;   // rien ne se mémorise d'une panne
        const texte = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200_000);
        const x: Lecture = { url, code, dates: html ? datesAnnoncees(html, aujourdhui) : [], texte: texte.slice(0, 60_000), lueLe: new Date().toISOString() };
        appendFileSync(cache, JSON.stringify(x) + "\n"); lues.set(url, x);
        await new Promise((r) => setTimeout(r, 250));
      } finally { occupes.delete(u.host); }
      if (++n % 200 === 0) console.log(`[dates] ${n}/${aLire.length}`);
    }
  }));

  // Décision course par course.
  const lots = new Map<string, { date: string; confirmee: boolean; ids: string[]; exemples: string[] }>();
  let nonNommees = 0;
  for (const [url, ls] of parUrl) {
    const x = lues.get(url);
    if (!x) continue;
    // Relu depuis le texte gardé en cache : les dates y retrouvent leur CONTEXTE.
    const toutes = datesAnnoncees(x.texte, aujourdhui);
    for (const l of ls) {
      if (!pageNommeLaCourse(x.texte, url, l.name)) { nonNommees++; continue; }
      const d = dateDepuisPage(datesDeLaCourse(toutes, url, l.name), l, aujourdhui);
      if (!d || d.date === l.date) continue;
      const cle = `${d.date}|${d.confirmee}`;
      const g = lots.get(cle) ?? { date: d.date, confirmee: d.confirmee, ids: [], exemples: [] };
      g.ids.push(l.id);
      if (g.exemples.length < 2) g.exemples.push(`${l.name} (${l.date} → ${d.date}${d.confirmee ? ", confirmée" : ", estimée"} ; preuve ${d.preuve} sur ${url.slice(0, 70)})`);
      lots.set(cle, g);
    }
  }
  const tous = [...lots.values()];
  const confirmees = tous.filter((g) => g.confirmee).reduce((s, g) => s + g.ids.length, 0);
  const estimees = tous.filter((g) => !g.confirmee).reduce((s, g) => s + g.ids.length, 0);
  console.log(JSON.stringify({ pagesLues: lues.size, confirmees, estimees, pagesQuiNeNommentPasLaCourse: nonNommees }));
  for (const g of tous.slice(0, 30)) for (const e of g.exemples) console.log(`  ${e}`);
  if (!ECRIRE) { console.log("(à blanc — rien écrit)"); return; }
  if (confirmees + estimees > max) { console.error(`ARRÊT : ${confirmees + estimees} dates à écrire (> ${max}). Relire le rapport avant d'écrire.`); process.exit(2); }
  let ok = 0, ko = 0;
  for (const g of tous) for (let i = 0; i < g.ids.length; i += 200) {
    const lot = g.ids.slice(i, i + 200);
    const { error } = await sb.from("races").update({ date: g.date, date_confirmee: g.confirmee, updated_at: new Date().toISOString() }).in("id", lot);
    if (error) { ko++; if (ko < 4) console.error(error.message); } else ok += lot.length;
  }
  console.log(`dates écrites : ${ok}, lots en erreur : ${ko}`);
  if (ko) process.exit(1);
}

if (process.argv[1]?.endsWith("dates-sites.ts")) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
