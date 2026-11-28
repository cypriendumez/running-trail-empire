/**
 * RETIRER DU CATALOGUE LES ITINÉRAIRES DE LA FFRANDONNÉE (GR®, GRP®, PR®).
 *
 *   npx tsx scripts/parcours-retirer-ffrandonnee.ts <dossier-cache> [--ecrire]
 *
 * Audit juridique du 28/11/2026 : la FFRandonnée a déposé ses marques et revendique un droit sur
 * ses tracés ; par prudence Pacevo n'en propose aucun (règle unique : `marqueFfrandonnee`,
 * src/lib/parcours/noms.ts). Le nom ne suffit pas : 106 relations OSM sont des GR sous un autre
 * nom (« Voie d'Ossau », `ref=GR 108`). Les étiquettes OSM ACTUELLES de chaque relation sont donc
 * relues (Overpass, `out tags`, par paquets ; une réponse tronquée est rejouée, jamais prise pour
 * une absence), puis le catalogue est relu au moment d'écrire, avec un plafond de retraits.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { marqueFfrandonnee } from "../src/lib/parcours/noms";
import { reponseUtilisable } from "./parcours-importer";
import { arreterSiDepasse, seuil } from "./garde-fous";
import { UA_PACEVOBOT } from "../src/lib/races/robot";

type P = { osm_id: number; osm_type?: string; nom: string };
const EP = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter"];
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Les parcours à retirer, et pourquoi (pur : testé). */
export function aRetirer(items: P[], etiquettes: Record<string, Record<string, string> | null>): Map<number, string> {
  const out = new Map<number, string>();
  for (const p of items) {
    const osm = (p.osm_type ?? "relation") === "relation";
    const r = marqueFfrandonnee(p.nom, osm ? etiquettes[String(p.osm_id)] : null);
    if (r) out.set(p.osm_id, r);
  }
  return out;
}

if (process.argv[1]?.endsWith("parcours-retirer-ffrandonnee.ts")) {
  const dossier = process.argv[2];
  const ecrire = process.argv.includes("--ecrire");
  const SOURCE = "data/parcours_certifies.json";
  const CACHE = path.join(dossier, "etiquettes-ffr.json");
  const items = JSON.parse(readFileSync(SOURCE, "utf8")) as P[];
  const etiquettes: Record<string, Record<string, string> | null> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  const ids = items.filter((p) => (p.osm_type ?? "relation") === "relation" && !(String(p.osm_id) in etiquettes)).map((p) => p.osm_id);
  (async () => {
    console.log(`${ids.length} relations OSM à relire`);
    for (let i = 0; i < ids.length; i += 300) {
      const lot = ids.slice(i, i + 300);
      let j: { elements?: { id: number; tags?: Record<string, string> }[] } | null = null;
      for (let essai = 0; essai < 6 && !j; essai++) {
        try {
          const r = await fetch(EP[essai % 2], { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA_PACEVOBOT }, body: "data=" + encodeURIComponent(`[out:json][timeout:120];relation(id:${lot.join(",")});out tags;`), signal: AbortSignal.timeout(150000) });
          if (r.ok) { const t = await r.json(); if (reponseUtilisable(t, lot.length)) j = t; }
        } catch { /* nouvel essai */ }
        if (!j) await dormir(10000);
      }
      if (!j) { console.log(`  paquet ${i} illisible : repris au prochain passage`); continue; }
      // Absente d'une réponse complète : pas d'étiquettes (le nom seul juge) — jamais un retrait.
      for (const e of j.elements ?? []) etiquettes[String(e.id)] = e.tags ?? {};
      writeFileSync(CACHE, JSON.stringify(etiquettes));
      if ((i / 300) % 10 === 0) console.log(`  ${Math.min(i + 300, ids.length)}/${ids.length}`);
      await dormir(1500);
    }
    const frais = JSON.parse(readFileSync(SOURCE, "utf8")) as P[];
    const retraits = aRetirer(frais, etiquettes);
    const parRaison: Record<string, number> = {};
    for (const r of retraits.values()) parRaison[r] = (parRaison[r] ?? 0) + 1;
    const exemples = frais.filter((p) => retraits.has(p.osm_id)).slice(0, 20).map((p) => `${p.nom} — ${retraits.get(p.osm_id)}`);
    console.log(JSON.stringify({ avant: frais.length, retires: retraits.size, parRaison, exemples }, null, 1));
    if (ecrire) {
      arreterSiDepasse([{ quoi: "parcours retirés", n: retraits.size, max: seuil(process.argv, "--max-retraits", 1500) }]);
      writeFileSync(SOURCE, JSON.stringify(frais.filter((p) => !retraits.has(p.osm_id))));
      console.log(`écrit : ${SOURCE} (${frais.length - retraits.size} parcours)\n⚠️ relancer « npx tsx scripts/parcours-compacter.ts » : la production lit le .min.json.gz`);
    }
  })();
}
