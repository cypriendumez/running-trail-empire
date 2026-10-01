/**
 * NETTOYAGE DES LIENS DE CLASSEMENT DÉJÀ EN BASE (30/09/2026).
 *
 * La porte unique (`lib/races/lienPropre`) protège l'écriture et l'affichage ; ce script
 * aligne les données stockées, pour que la base dise la même chose que l'écran :
 *   - `resultats_url` corrigé (`&amp;` décodé, filtre de sexe retiré, fiche livetrail d'un
 *     coureur → classement) ou effacé (partage LinkedIn, blog tiers) — avec son année ;
 *   - `resultats_editions` : chaque adresse passée par la même porte, une par année.
 *
 * À blanc par défaut. `--ecrire` écrit (sauvegarder la table avant).
 *   npx tsx --env-file=.env.local scripts/nettoyer-liens-classement.ts [--ecrire]
 */
import { createClient } from "@supabase/supabase-js";
import { lienClassementPropre } from "../src/lib/races/lienPropre";
import { fusionEditions, memesEditions, type EditionResultats } from "../src/lib/races/editionsResultats";

const ECRIRE = process.argv.includes("--ecrire");

/** Les éditions passées par la porte ; `null` si plus rien, inchangé si rien ne bouge. */
export function editionsPropres(eds: unknown): EditionResultats[] | null {
  if (!Array.isArray(eds)) return null;
  const propres = eds.flatMap((e) => {
    const url = e && Number.isInteger(e.annee) ? lienClassementPropre(e.url) : null;
    return url ? [{ annee: e.annee as number, url }] : [];
  });
  const r = fusionEditions(propres);
  return r.length ? r : null;
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (u, o) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(30_000) }) },
  });
  type Ligne = { id: string; name: string | null; resultats_url: string | null; resultats_annee: number | null; resultats_editions: unknown };
  const lignes: Ligne[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id, name, resultats_url, resultats_annee, resultats_editions")
      .or("resultats_url.not.is.null,resultats_editions.not.is.null").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    lignes.push(...((data ?? []) as Ligne[])); if (!data || data.length < 1000) break;
  }
  const lots = new Map<string, { maj: Record<string, unknown>; ids: string[]; exemple: string }>();
  let corriges = 0, effaces = 0, editionsTouchees = 0;
  for (const l of lignes) {
    const maj: Record<string, unknown> = {};
    if (l.resultats_url != null) {
      const p = lienClassementPropre(l.resultats_url);
      if (p !== l.resultats_url) {
        maj.resultats_url = p;
        if (p == null) { maj.resultats_annee = null; effaces++; } else corriges++;
      }
    }
    if (l.resultats_editions != null) {
      const e = editionsPropres(l.resultats_editions);
      if (!memesEditions(e, l.resultats_editions)) { maj.resultats_editions = e; editionsTouchees++; }
    }
    if (!Object.keys(maj).length) continue;
    const cle = JSON.stringify(maj);
    const g = lots.get(cle) ?? { maj, ids: [], exemple: `${l.name} : ${String(l.resultats_url).slice(0, 90)} → ${"resultats_url" in maj ? String(maj.resultats_url ?? "(effacé)").slice(0, 90) : "(lien inchangé)"}` };
    g.ids.push(l.id); lots.set(cle, g);
  }
  const total = [...lots.values()].reduce((s, g) => s + g.ids.length, 0);
  console.log(JSON.stringify({ lignesLues: lignes.length, lignesAEcrire: total, liensCorriges: corriges, liensEffaces: effaces, editionsTouchees }));
  for (const g of [...lots.values()].slice(0, 40)) console.log(`  ${g.ids.length} × ${g.exemple}`);
  if (!ECRIRE) { console.log("(à blanc — rien écrit)"); return; }
  let ok = 0, ko = 0;
  for (const g of lots.values()) for (let i = 0; i < g.ids.length; i += 200) {
    const lot = g.ids.slice(i, i + 200);
    const { error } = await sb.from("races").update(g.maj).in("id", lot);
    if (error) { ko++; if (ko < 4) console.error(error.message); } else ok += lot.length;
  }
  console.log(`lignes mises à jour : ${ok}, lots en erreur : ${ko}`);
  if (ko) process.exit(1);
}

if (process.argv[1]?.endsWith("nettoyer-liens-classement.ts")) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
