/**
 * LIENS « RÉSULTATS » DES SITES OFFICIELS — étape 1 bis (lecture seule, reprenable).
 *
 * Pour chaque site officiel connu par les fiches finishers (et sans classement déjà cité),
 * lit la PAGE D'ACCUEIL — une seule requête par site — et en retient le lien de résultats
 * (`lib/races/resultatsSite`). Rien n'est écrit en base : `finishers-appliquer.ts` relit
 * ce fichier s'il est à côté des fiches (`resultats-sites.jsonl`).
 *
 * Politesse : robots.txt lu et respecté pour chaque hôte ; 6 sites en parallèle, jamais
 * deux requêtes en même temps au même hôte ; délai de 12 s ; on s'identifie.
 *
 *   npx tsx scripts/resultats-sites.ts <fiches.jsonl> <resultats-sites.jsonl> [--relire-apres <jours>]
 *
 * Reprise : un site déjà lu n'est pas relu — sauf s'il a échoué pour une raison PASSAGÈRE
 * (réseau, 403, 5xx, robots.txt illisible), ou si sa lecture date de plus de
 * `--relire-apres` jours : le lien « Résultats 2025 » devient « Résultats 2026 » après la
 * course, et le workflow hebdomadaire doit le voir.
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { lienResultats, robotsAutorise, type LienResultats } from "../src/lib/races/resultatsSite";
import { PAYS_FRANCE, type Fiche } from "../src/lib/races/majFinishers";
import { couplesDistanceDplus, type CoupleDplus } from "../src/lib/races/dplusSite";
import { seuil } from "./garde-fous";

const UA = "Mozilla/5.0 (compatible; PacevoBot/1.0; +https://pacevo.fr/contact)";
const PARALLELE = 6;
const anneeCourante = new Date().getFullYear();

export type LigneSite = { site: string; ok: boolean; http?: number; motif?: string; lien?: LienResultats | null; dplus?: CoupleDplus[]; lueLe: string };

/** Échecs qui disent quelque chose DU SITE (et le rediront) : inutile d'y retourner chaque semaine. */
const ECHECS_DURABLES = new Set(["robots-interdit", "pas-html", "adresse"]);

/** Cette ligne dispense-t-elle de relire le site ? */
export function dejaLu(l: LigneSite, maintenant: number, joursMax = Infinity): boolean {
  const age = (maintenant - Date.parse(l.lueLe)) / 864e5;
  if (!(age <= joursMax)) return false;
  return l.ok || l.http === 404 || l.http === 410 || ECHECS_DURABLES.has(String(l.motif));
}

async function lire(url: string, ms = 12000): Promise<{ code: number; texte: string | null; type: string }> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fr-FR" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
    const type = r.headers.get("content-type") ?? "";
    const texte = r.ok ? (await r.text()).slice(0, 2_000_000) : null;
    return { code: r.status, texte, type };
  } catch { return { code: 0, texte: null, type: "" }; }
}

async function main() {
  const [fFiches, sortie] = process.argv.slice(2).filter((a, i, t) => !a.startsWith("--") && !t[i - 1]?.startsWith("--"));
  const joursMax = seuil(process.argv, "--relire-apres", Infinity);
  // Site → noms des courses qui y renvoient (un organisateur peut en avoir plusieurs).
  // Un site est lu s'il manque le lien « Résultats » OU le dénivelé d'un format trail
  // (même page d'accueil, même requête — voir lib/races/dplusSite).
  const noms = new Map<string, string[]>();
  const besoinDplus = new Set<string>();
  for (const l of readFileSync(fFiches, "utf8").split("\n")) {
    try {
      const f = JSON.parse(l) as Fiche;
      if (!(f?.ok && PAYS_FRANCE.has(String(f.pays ?? "")) && f.siteOfficiel)) continue;
      const sansDplus = (f.formats ?? []).some((x) => x.discipline === "trail" && x.dplus == null);
      if (!f.resultats?.classement || sansDplus) noms.set(f.siteOfficiel, [...(noms.get(f.siteOfficiel) ?? []), String(f.nom ?? "")]);
      if (sansDplus) besoinDplus.add(f.siteOfficiel);
    } catch { /* ligne en cours d'écriture */ }
  }
  const sites = new Set(noms.keys());
  const faits = new Set<string>();
  const maintenant = Date.now();
  // Une lecture antérieure au relevé du dénivelé (sans champ `dplus`) ne dispense pas de
  // relire un site qui en a besoin.
  if (existsSync(sortie)) for (const l of readFileSync(sortie, "utf8").split("\n")) {
    try { const x = JSON.parse(l) as LigneSite; if (dejaLu(x, maintenant, joursMax) && (!x.ok || !besoinDplus.has(x.site) || Array.isArray(x.dplus))) faits.add(x.site); } catch { /* */ }
  }
  const reste = [...sites].filter((s) => !faits.has(s));
  console.log(`[sites] ${sites.size} sites, ${faits.size} déjà lus, ${reste.length} à lire`);

  const robots = new Map<string, Promise<string | null | "inconnu">>();
  const occupes = new Set<string>();
  const robotsDe = (origine: string) => {
    if (!robots.has(origine)) robots.set(origine, lire(`${origine}/robots.txt`, 8000).then((r) =>
      r.code === 200 && r.texte != null ? r.texte : r.code === 404 || r.code === 410 ? null : "inconnu"));
    return robots.get(origine)!;
  };
  let n = 0, trouves = 0;
  const traiter = async (site: string) => {
    const ecrire = (x: Omit<LigneSite, "site" | "lueLe">) => appendFileSync(sortie, JSON.stringify({ site, ...x, lueLe: new Date().toISOString() }) + "\n");
    let u: URL;
    try { u = new URL(site); } catch { return ecrire({ ok: false, motif: "adresse" }); }
    while (occupes.has(u.host)) await new Promise((r) => setTimeout(r, 300));
    occupes.add(u.host);
    try {
      const rb = await robotsDe(u.origin);
      // robots.txt illisible (5xx, délai) : dans le doute, on ne lit pas le site.
      if (rb === "inconnu") return ecrire({ ok: false, motif: "robots-illisible" });
      if (!robotsAutorise(rb, u.pathname + u.search)) return ecrire({ ok: false, motif: "robots-interdit" });
      const p = await lire(site);
      if (p.texte == null) return ecrire({ ok: false, http: p.code });
      if (!/html/i.test(p.type)) return ecrire({ ok: false, http: p.code, motif: "pas-html" });
      const lien = lienResultats(p.texte, site, anneeCourante, { noms: noms.get(site) ?? [] });
      if (lien) trouves++;
      ecrire({ ok: true, http: p.code, lien, dplus: couplesDistanceDplus(p.texte) });
    } finally { occupes.delete(u.host); }
  };
  const file = [...reste];
  await Promise.all(Array.from({ length: PARALLELE }, async () => {
    for (let s; (s = file.shift());) {
      await traiter(s);
      if (++n % 100 === 0) console.log(`[sites] ${n}/${reste.length} — ${trouves} liens (${new Date().toLocaleTimeString("fr-FR")})`);
      await new Promise((r) => setTimeout(r, 300));
    }
  }));
  console.log(`[sites] terminé — ${trouves} liens de résultats sur ${n} sites lus`);
}

if (process.argv[1]?.endsWith("resultats-sites.ts")) main().catch((e) => { console.error(e); process.exit(1); });
