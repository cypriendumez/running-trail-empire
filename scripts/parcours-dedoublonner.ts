/**
 * AUCUN DOUBLON DANS LE CATALOGUE (28/11/2026).
 *
 *   npx tsx scripts/parcours-dedoublonner.ts [--ecrire]
 *
 * Cyprien : « aucune erreur et aucun doublon ». L'import ne comparait que les NOUVEAUX parcours au
 * catalogue ; le catalogue d'origine gardait des doublons internes (relecture du 28/11/2026 :
 * « Circuit de la Roche des Fées » deux fois, « Canal du Puy - 3 » en Running ET en Randonnée).
 * Chaque parcours ayant désormais son tracé gardé (src/lib/parcours/tracesStockees.ts), deux
 * parcours sont un DOUBLON quand leurs tracés se recouvrent (≥ 70 % de l'un sur l'autre, ≥ 50 % dans
 * l'autre sens — la règle de l'import, `Grille`) ET que leurs longueurs sont à 15 % près : une petite
 * boucle tracée à l'intérieur d'une grande n'en est pas le doublon. Sous deux NOMS différents, il
 * faut 85 % dans les deux sens (deux circuits officiels peuvent partager des chemins). Un même chemin à
 * pied ET à vélo (randonnée et VTT) n'est pas un doublon : chacun reste dans son filtre. On garde, dans l'ordre :
 * OpenStreetMap, Métropole, sources ouvertes, IGN ; à source égale, le plus petit identifiant.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Grille, recouvrement } from "./parcours-importer";
import { traceStockee } from "../src/lib/parcours/tracesStockees";
import { arreterSiDepasse, seuil } from "./garde-fous";

type LL = [number, number];
type P = { osm_id: number; osm_type?: string; nom: string; sport: string; distance_km: number; coordinates?: LL[] };

/** Le nom comparé : sans accents, casse, ponctuation ni sens de parcours (« A vers B » = « B vers A »). */
export const nomNormalise = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean).sort().join(" ");

const famille = (sport: string) => (sport === "Vélo (Route)" || sport === "VTT" ? "vélo" : "pied");

const RANG: Record<string, number> = { relation: 0, metropole: 1, ouvert: 2, ign: 3 };
const rang = (p: P) => RANG[p.osm_type ?? "relation"] ?? 9;

/** Les doublons à retirer (identifiant → identifiant gardé). Pur, sur des tracés fournis : testé. */
export function doublons(items: P[], traceDe: (p: P) => LL[] | null): Map<number, number> {
  const ordre = [...items].sort((a, b) => rang(a) - rang(b) || a.osm_id - b.osm_id);
  const grille = new Grille();
  const parCle = new Map(items.map((p) => [String(p.osm_id), p]));
  const retirer = new Map<number, number>();
  const traces = new Map<string, LL[]>();
  for (const p of ordre) {
    const c = traceDe(p);
    if (!c || c.length < 2) continue;
    // Le premier parcours DÉJÀ GARDÉ dont le tracé recouvre celui-ci, à longueur comparable.
    let garde: string | null = null;
    for (let essai = 0, exclus = new Set<string>(); essai < 5; essai++) {
      const d = grille.doublon(c, exclus);
      if (!d) break;
      exclus.add(d);
      const q = parCle.get(d)!;
      if (Math.abs(q.distance_km - p.distance_km) / Math.max(q.distance_km, p.distance_km) > 0.15) continue;
      // À pied et à vélo : deux usages officiels du même chemin (« Jardins extraordinaires », randonnée
      // ET VTT) — chacun reste dans son filtre. Dans une même famille, un seul.
      if (famille(q.sport) !== famille(p.sport)) continue;
      // Deux NOMS différents (« Boucle de la Bibiche », « Sentiers des 3 Clériaux ») : deux circuits
      // officiels distincts peuvent partager beaucoup de chemins — doublon seulement s'ils se
      // recouvrent à 85 % au moins DANS LES DEUX SENS.
      if (nomNormalise(q.nom) !== nomNormalise(p.nom)) {
        const cq = traces.get(d)!;
        if (Math.min(recouvrement(c, cq), recouvrement(cq, c)) < 0.85) continue;
      }
      garde = d; break;
    }
    if (garde) { retirer.set(p.osm_id, Number(garde)); continue; }
    grille.ajouter(String(p.osm_id), c);
    traces.set(String(p.osm_id), c);
  }
  return retirer;
}

if (process.argv[1]?.endsWith("parcours-dedoublonner.ts")) {
  const SOURCE = "data/parcours_certifies.json";
  const items = JSON.parse(readFileSync(SOURCE, "utf8")) as P[];
  const t0 = Date.now();
  const retirer = doublons(items, (p) => p.coordinates?.length ? p.coordinates : traceStockee(p.osm_id));
  const parId = new Map(items.map((p) => [p.osm_id, p]));
  const paires: Record<string, number> = {};
  for (const [a, b] of retirer) { const k = `${parId.get(a)!.osm_type ?? "relation"} → ${parId.get(b)!.osm_type ?? "relation"}`; paires[k] = (paires[k] ?? 0) + 1; }
  console.log(JSON.stringify({ parcours: items.length, doublons: retirer.size, secondes: Math.round((Date.now() - t0) / 1000), parSources: paires,
    exemples: [...retirer].slice(0, 25).map(([a, b]) => `${parId.get(a)!.nom} (${parId.get(a)!.sport}, ${parId.get(a)!.distance_km} km, ${parId.get(a)!.osm_type ?? "relation"}) = ${parId.get(b)!.nom} (${parId.get(b)!.sport}, ${parId.get(b)!.distance_km} km)`) }, null, 1));
  if (process.argv.includes("--ecrire")) {
    arreterSiDepasse([{ quoi: "doublons retirés", n: retirer.size, max: seuil(process.argv, "--max-retraits", 3000) }]);
    const frais = JSON.parse(readFileSync(SOURCE, "utf8")) as P[];
    writeFileSync(SOURCE, JSON.stringify(frais.filter((p) => !retirer.has(p.osm_id))));
    console.log(`écrit : ${SOURCE} (${frais.length - retirer.size} parcours)\n⚠️ relancer « npx tsx scripts/parcours-compacter.ts » : la production lit le .min.json.gz`);
  }
}
