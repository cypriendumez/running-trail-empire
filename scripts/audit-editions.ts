/**
 * AUDIT DES ÉDITIONS PASSÉES — chaque lien écrit est ROUVERT (30/09/2026).
 *
 * Cyprien : « vérifie que ça envoie dans les bons liens ». Une édition a été vérifiée le
 * jour où elle a été écrite ; une page peut depuis avoir disparu, été redirigée vers
 * l'accueil, ou remplacée par « Page introuvable » servie en 200. On rouvre donc TOUT ce qui
 * est en base, avec la même règle que l'écriture (`editionSiteVerifiee`) :
 *   - ÉCHEC PROUVÉ : 404/410 (et autres 4xx), renvoyée à l'accueil, page d'erreur, année
 *     absente de l'adresse ET du texte, type qui ne s'affiche pas ; ou deux années d'une même
 *     course qui aboutissent à la même page ;
 *   - INCERTAIN : réseau, 403, 429, 5xx, robots.txt illisible ou qui interdit — on GARDE
 *     (un site momentanément en panne ne perd pas ses éditions) ;
 *   - CONTENU IDENTIQUE : deux années dont le texte visible est le même — retirées toutes les deux.
 *
 * Rapport JSON (échecs nommés + échantillon de liens validés à rouvrir à la main).
 * `--ecrire` retire des lignes les seuls échecs prouvés (sauvegarder la table avant).
 *
 *   npx tsx --env-file=.env.local scripts/audit-editions.ts <rapport.json> [--ecrire]
 */
import { UA_PACEVOBOT, siteExclu } from "../src/lib/races/robot";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { editionSiteVerifiee, reponseIncertaine, sansPagePartagee, type EditionResultats } from "../src/lib/races/editionsResultats";
import { robotsAutorise } from "../src/lib/races/resultatsSite";
import { lienClassementPropre } from "../src/lib/races/lienPropre";

// L'identité déclarée de PacevoBot, en un seul endroit (lib/races/robot → pacevo.fr/robot).
const UA = UA_PACEVOBOT;
const ECRIRE = process.argv.includes("--ecrire");
const [rapport] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

type Verdict = "OK" | "ECHEC" | "INCERTAIN";
type Controle = { url: string; annee: number; verdict: Verdict; motif: string; code: number; finale: string; empreinte: string | null; longueur: number };

/** Ce qui NE prouve rien sur la page : le site est en panne, nous bloque ou nous limite. */
const incertain = reponseIncertaine;

function motifEchec(code: number, demandee: string, finale: string, type: string, html: string | null, annee: number): string {
  if (code >= 300) return `http-${code}`;
  try {
    const d = new URL(demandee), f = new URL(finale);
    if ((f.pathname === "/" || f.pathname === "") && !f.search && !(d.pathname === "/" && !d.search)) return "renvoyee-accueil";
  } catch { return "adresse"; }
  if (/pdf/i.test(type)) return "pdf-redirige";
  if (!/html/i.test(type) && !/<\?xml-stylesheet/i.test(html ?? "")) return `type-${type.split(";")[0] || "inconnu"}`;
  const titre = `${html?.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""}`;
  if (/404|introuvable|not found|n'existe pas/i.test(titre)) return "page-erreur";
  return `annee-${annee}-absente`;
}

async function main() {
  if (!rapport) throw new Error("usage : audit-editions.ts <rapport.json> [--ecrire]");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (u, o) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(30_000) }) },
  });
  type Ligne = { id: string; name: string | null; date: string | null; resultats_editions: EditionResultats[] };
  const lignes: Ligne[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id, name, date, resultats_editions")
      .not("resultats_editions", "is", null).order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    lignes.push(...((data ?? []) as Ligne[])); if (!data || data.length < 1000) break;
  }
  const uniques = new Map<string, { url: string; annee: number }>();
  for (const l of lignes) for (const e of Array.isArray(l.resultats_editions) ? l.resultats_editions : []) uniques.set(`${e.annee}|${e.url}`, e);
  console.log(`[audit] ${lignes.length} lignes, ${uniques.size} liens d'éditions distincts à rouvrir`);

  const robots = new Map<string, Promise<string | null | "inconnu">>();
  const robotsDe = (o: string) => {
    if (!robots.has(o)) robots.set(o, fetch(`${o}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) })
      .then(async (r) => (r.status === 200 ? await r.text() : r.status === 404 || r.status === 410 ? null : "inconnu")).catch(() => "inconnu" as const));
    return robots.get(o)!;
  };
  const occupes = new Set<string>();
  const controles = new Map<string, Controle>();
  const file = [...uniques.values()];
  let n = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let e; (e = file.shift());) {
      // On rouvre ce que l'athlète OUVRE : l'adresse passée par la porte unique (lib/races/lienPropre).
      const cible = lienClassementPropre(e.url);
      let u: URL;
      try { u = new URL(cible ?? ""); } catch { controles.set(`${e.annee}|${e.url}`, { ...e, verdict: "ECHEC", motif: "refusee-par-la-porte", code: 0, finale: e.url, empreinte: null, longueur: 0 }); continue; }
      while (occupes.has(u.host)) await new Promise((r) => setTimeout(r, 200));
      occupes.add(u.host);
      try {
        const rb = siteExclu(u.toString()) ? "inconnu" : await robotsDe(u.origin);
        if (rb === "inconnu" || !robotsAutorise(rb, u.pathname + u.search)) {
          controles.set(`${e.annee}|${e.url}`, { ...e, verdict: "INCERTAIN", motif: rb === "inconnu" ? "robots-illisible" : "robots-interdit", code: 0, finale: e.url, empreinte: null, longueur: 0 });
          continue;
        }
        let code = 0, finale = u.toString(), type = "", html: string | null = null;
        try {
          const r = await fetch(u.toString(), { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
          code = r.status; finale = r.url || e.url; type = r.headers.get("content-type") ?? "";
          if (r.ok && /html|xml/i.test(type)) html = (await r.text()).slice(0, 1_500_000); else { try { await r.body?.cancel(); } catch { /* */ } }
        } catch { code = 0; }
        const texte = html?.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
        const ok = editionSiteVerifiee({ code, demandee: u.toString(), finale, type, html }, e.annee);
        const verdict: Verdict = ok ? "OK" : incertain(code) ? "INCERTAIN" : "ECHEC";
        controles.set(`${e.annee}|${e.url}`, {
          ...e, verdict, motif: ok ? "" : incertain(code) ? `http-${code}` : motifEchec(code, u.toString(), finale, type, html, e.annee),
          code, finale, empreinte: texte ? createHash("sha1").update(texte).digest("hex") : null, longueur: texte.length,
        });
        await new Promise((r) => setTimeout(r, 250));
      } finally { occupes.delete(u.host); }
      if (++n % 100 === 0) console.log(`[audit] ${n}/${uniques.size}`);
    }
  }));

  // Par course : deux années menant à la même page, ou au même TEXTE visible.
  const retirer = new Map<string, Set<string>>();
  const identiques: { course: string; annees: number[]; longueur: number; urls: string[] }[] = [];
  for (const l of lignes) {
    const eds = (Array.isArray(l.resultats_editions) ? l.resultats_editions : []).map((e) => controles.get(`${e.annee}|${e.url}`)!).filter(Boolean);
    const echecs = new Set(eds.filter((c) => c.verdict === "ECHEC").map((c) => `${c.annee}|${c.url}`));
    const valides = eds.filter((c) => c.verdict === "OK");
    const gardees = new Set(sansPagePartagee(valides).map((c) => `${c.annee}|${c.url}`));
    for (const c of valides) if (!gardees.has(`${c.annee}|${c.url}`)) { echecs.add(`${c.annee}|${c.url}`); c.motif ||= "page-partagee"; }
    const parEmpreinte = new Map<string, Controle[]>();
    for (const c of valides) if (c.empreinte && c.longueur >= 800) parEmpreinte.set(c.empreinte, [...(parEmpreinte.get(c.empreinte) ?? []), c]);
    // ⚠️ DEUX ANNÉES, LE MÊME TEXTE : aucune des deux n'est « le classement de cette
    // année-là » (30/09/2026, sportpro.re : « 2026 » et « 2024 » menaient à une randonnée
    // et à une actualité FFA, au texte identique). Retirées toutes les deux.
    for (const g of parEmpreinte.values()) if (g.length > 1) {
      identiques.push({ course: String(l.name), annees: g.map((c) => c.annee), longueur: g[0].longueur, urls: g.map((c) => c.url) });
      for (const c of g) { echecs.add(`${c.annee}|${c.url}`); c.motif ||= "contenu-identique"; }
    }
    if (echecs.size) retirer.set(l.id, echecs);
  }
  const tous = [...controles.values()];
  const compte = (v: Verdict) => tous.filter((c) => c.verdict === v).length;
  const motifs: Record<string, number> = {};
  for (const c of tous) if (c.verdict === "ECHEC") motifs[c.motif] = (motifs[c.motif] ?? 0) + 1;
  const valides = tous.filter((c) => c.verdict === "OK");
  const echantillon = Array.from({ length: Math.min(25, valides.length) }, (_, i) => valides[Math.floor((i * valides.length) / 25)]).map((c) => ({ annee: c.annee, url: c.url, finale: c.finale }));
  const res = {
    lignes: lignes.length, liens: tous.length, ok: compte("OK"), echecs: compte("ECHEC"), incertains: compte("INCERTAIN"), motifs,
    lignesTouchees: retirer.size, contenusIdentiques: identiques.length,
    detailEchecs: tous.filter((c) => c.verdict === "ECHEC").map((c) => ({ annee: c.annee, url: c.url, motif: c.motif, finale: c.finale })),
    identiques, echantillon,
  };
  writeFileSync(rapport, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ ...res, detailEchecs: res.detailEchecs.length, identiques: res.identiques.length, echantillon: res.echantillon.length }));
  if (!ECRIRE) { console.log("(à blanc — rien retiré)"); return; }
  let ok = 0, ko = 0;
  for (const l of lignes) {
    const r = retirer.get(l.id); if (!r) continue;
    const reste = l.resultats_editions.filter((e) => !r.has(`${e.annee}|${e.url}`));
    const { error } = await sb.from("races").update({ resultats_editions: reste.length ? reste : null }).eq("id", l.id);
    if (error) { ko++; if (ko < 4) console.error(error.message); } else ok++;
  }
  console.log(`lignes corrigées : ${ok}, en erreur : ${ko}`);
  if (ko) process.exit(1);
}

if (process.argv[1]?.endsWith("audit-editions.ts")) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
