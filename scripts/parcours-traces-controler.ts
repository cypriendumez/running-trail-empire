/**
 * CONTRÔLE DE CHAQUE TRACÉ DU CATALOGUE, CONTRE OPENSTREETMAP AUJOURD'HUI.
 *
 *   npx tsx scripts/parcours-traces-controler.ts <dossier-de-travail>
 *
 * Cyprien, 27/11/2026 : « tu es sûr qu'il n'y a aucune erreur pour mes futurs utilisateurs ? »
 * L'audit des étiquettes ne disait rien des TRACÉS : un contributeur peut avoir coupé, troué ou
 * redessiné un parcours depuis la collecte de juin. Ici, chaque relation est relue avec sa
 * géométrie (Overpass, `out geom`, par paquets de 40 — pas l'API d'édition d'OSM, qui n'est pas
 * faite pour un téléchargement en masse), recomposée comme le fait l'application
 * (`chainSegmentsMesure`) et jugée comme elle (`tracePartiel` : le parcours afficherait
 * « tracé incomplet »).
 *
 * Verdicts : « ok » ; « partiel » (l'application refuserait de l'afficher) ; « troué » (plus
 * d'un quart du tracé en morceaux isolés) ; « écart » (longueur à plus de 15 % de la distance
 * du catalogue) ; « super-relation » (sentier en étapes : relu à part, à l'affichage) ;
 * « vide ». Le résultat (un fichier par paquet, reprenable) sert au tri, pas à une correction
 * silencieuse.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { chainSegmentsMesure } from "../src/lib/parcours/geometrie";
import { tracePartiel, longueurKm } from "../src/lib/parcours/trace";
import { UA_PACEVOBOT } from "../src/lib/races/robot";
import { reponseUtilisable, erreurOverpass } from "./parcours-importer";

type Verdict = { verdict: "ok" | "partiel" | "troué" | "écart" | "super-relation" | "vide"; km?: number; perdu?: number; catalogue: number };

/**
 * Une relation absente d'un paquet, relue seule auprès de chaque miroir (`reponses[k]` : la réponse
 * valable du miroir k, ou null) : présente chez l'un → l'élément ; absente chez DEUX miroirs → `null`
 * (« vide », retirée) ; sinon `undefined` (rien de sûr : ni verdict ni retrait).
 */
export function verdictSeule<R>(reponses: ({ elements?: R[] } | null | undefined)[]): R | null | undefined {
  const valables = reponses.filter((r): r is { elements?: R[] } => !!r);
  const trouve = valables.find((r) => r.elements?.length);
  if (trouve) return trouve.elements![0];
  return valables.length >= 2 ? null : undefined;
}

export function juger(segments: [number, number][][], distanceCatalogue: number, aDesSousRelations: boolean): Verdict {
  if (aDesSousRelations && !segments.length) return { verdict: "super-relation", catalogue: distanceCatalogue };
  const { coords, totalKm, perduKm } = chainSegmentsMesure(segments);
  // ⚠️ LA LONGUEUR DU TRACÉ AFFICHÉ, pas la somme de tous les morceaux de la relation : une
  // relation porte souvent des variantes ou des voies en double, et la somme gonflait la longueur
  // (ratio médian 1,39 au premier passage du 28/11/2026, des « écarts » qui n'en étaient pas).
  const km = Math.round(longueurKm(coords) * 100) / 100;
  if (coords.length < 2) return { verdict: "vide", catalogue: distanceCatalogue };
  const perdu = totalKm > 0 ? Math.round((perduKm / totalKm) * 100) / 100 : 0;
  if (tracePartiel(coords, distanceCatalogue)) return { verdict: aDesSousRelations ? "super-relation" : "partiel", km, perdu, catalogue: distanceCatalogue };
  if (perdu > 0.25) return { verdict: "troué", km, perdu, catalogue: distanceCatalogue };
  if (distanceCatalogue > 0 && Math.abs(km - distanceCatalogue) / distanceCatalogue > 0.15) return { verdict: "écart", km, perdu, catalogue: distanceCatalogue };
  return { verdict: "ok", km, perdu, catalogue: distanceCatalogue };
}

if (process.argv[1]?.endsWith("parcours-traces-controler.ts")) {
  const DOSSIER = process.argv[2] ?? "/tmp/pacevo-traces";
  mkdirSync(DOSSIER, { recursive: true });
  const RESULTATS = path.join(DOSSIER, "verdicts.json");
  // Un tracé allégé de chaque parcours (60 points) : sert à reconnaître un DOUBLON quand on ajoute
  // des parcours d'autres sources (scripts/parcours-importer.ts), sans relire OSM une seconde fois.
  const TRACES = path.join(DOSSIER, "traces.jsonl");
  const items = JSON.parse(readFileSync("data/parcours_certifies.json", "utf8")) as { osm_id: number; osm_type?: string; distance_km: number }[];
  const osm = items.filter((p) => (p.osm_type ?? "relation") === "relation");
  const verdicts: Record<string, Verdict> = existsSync(RESULTATS) ? JSON.parse(readFileSync(RESULTATS, "utf8")) : {};
  // Un « vide » d'un passage précédent est revérifié : il a pu naître d'une réponse tronquée.
  for (const [k, v] of Object.entries(verdicts)) if (v.verdict === "vide") delete verdicts[k];
  const reste = osm.filter((p) => !(String(p.osm_id) in verdicts));
  const EP = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter"];
  const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const PAQUET = 40;
  type Rel = { id: number; members?: { type: string; geometry?: { lat: number; lon: number }[] }[] };
  /**
   * Une relation seule : l'élément ; `null` (vide) seulement si DEUX miroirs différents répondent
   * sans erreur et sans elle ; `undefined` sinon (relecture du 28/11/2026 : une seule réponse vide
   * d'un miroir surchargé retirait le parcours).
   */
  const lireSeule = async (id: number): Promise<Rel | null | undefined> => {
    const reponses: ({ elements?: Rel[] } | null)[] = [];
    for (let essai = 0; essai < 4; essai++) {
      let t: ({ elements?: Rel[]; remark?: string }) | null = null;
      try {
        const r = await fetch(EP[essai % 2], { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA_PACEVOBOT }, body: "data=" + encodeURIComponent(`[out:json][timeout:60];relation(${id});out geom;`), signal: AbortSignal.timeout(90000) });
        if (r.ok) { const j = await r.json() as { elements?: Rel[]; remark?: string }; if (!erreurOverpass(j)) t = j; }
      } catch { /* nouvel essai */ }
      reponses[essai % 2] = reponses[essai % 2] ?? t;
      const d = verdictSeule(reponses);
      if (d !== undefined) return d;
      await dormir(10000);
    }
    return undefined;
  };
  console.log(`${osm.length} tracés OSM, ${reste.length} à contrôler`);
  (async () => {
    for (let i = 0; i < reste.length; i += PAQUET) {
      const lot = reste.slice(i, i + PAQUET);
      type Reponse = { elements?: { id: number; members?: { type: string; geometry?: { lat: number; lon: number }[] }[] }[] };
      const lire = async (ids: number[]): Promise<Reponse | null> => {
        const q = `[out:json][timeout:240];relation(id:${ids.join(",")});out geom;`;
        for (let essai = 0; essai < 6; essai++) {
          try {
            const r = await fetch(EP[essai % 2], { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA_PACEVOBOT }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(260000) });
            if (r.ok) {
              const t = await r.json() as Reponse & { remark?: string };
              // ⚠️ Relecture du 28/11/2026 : un miroir surchargé peut répondre 200 SANS éléments (ou
              // avec une partie seulement). Le prendre au mot retirait 40 parcours d'un coup.
              if (reponseUtilisable(t, ids.length)) return t;
            }
          } catch { /* nouvel essai */ }
          await dormir(15000);
        }
        return null;
      };
      const j = await lire(lot.map((p) => p.osm_id));
      if (!j) { console.log(`  paquet ${i} : Overpass injoignable ou réponse tronquée, repris au prochain passage`); continue; }
      // Une relation absente du paquet : confirmée SEULE avant de conclure « vide ».
      const recus = new Set((j.elements ?? []).map((e) => e.id));
      for (const p of lot) {
        if (recus.has(p.osm_id)) continue;
        const seule = await lireSeule(p.osm_id);
        if (seule === undefined) continue;          // injoignable : ni verdict ni retrait
        if (seule) { j.elements!.push(seule); recus.add(p.osm_id); }
        else verdicts[p.osm_id] = { verdict: "vide", catalogue: p.distance_km };
      }
      const parId = new Map((j.elements ?? []).map((e) => [e.id, e]));
      for (const p of lot) {
        const e = parId.get(p.osm_id);
        if (!e) continue;                           // « vide » confirmé, ou injoignable (repris au prochain passage)
        const membres = e.members ?? [];
        const segments = membres.filter((m) => m.type === "way" && m.geometry?.length).map((m) => m.geometry!.map((g) => [g.lon, g.lat] as [number, number]));
        verdicts[p.osm_id] = juger(segments, p.distance_km, membres.some((m) => m.type === "relation"));
        const { coords } = chainSegmentsMesure(segments);
        // Un ÉCART : on garde le tracé (400 points) pour remesurer distance et dénivelé dessus.
        if (verdicts[p.osm_id].verdict === "écart" && coords.length > 1) {
          const n = Math.min(400, coords.length);
          const ech = Array.from({ length: n }, (_, k) => coords[Math.round((k * (coords.length - 1)) / (n - 1))]);
          appendFileSync(path.join(DOSSIER, "a-remesurer.jsonl"), JSON.stringify({ id: p.osm_id, km: verdicts[p.osm_id].km, c: ech }) + "\n");
        }
        if (coords.length > 1) {
          const n = Math.min(60, coords.length);
          const ech = Array.from({ length: n }, (_, k) => coords[Math.round((k * (coords.length - 1)) / (n - 1))].map((x) => Math.round(x * 1e5) / 1e5));
          appendFileSync(TRACES, JSON.stringify({ id: p.osm_id, c: ech }) + "\n");
        }
      }
      writeFileSync(RESULTATS, JSON.stringify(verdicts));
      if ((i / PAQUET) % 10 === 0) {
        const c = Object.values(verdicts).reduce<Record<string, number>>((a, v) => { a[v.verdict] = (a[v.verdict] ?? 0) + 1; return a; }, {});
        console.log(`  ${Math.min(i + PAQUET, reste.length)}/${reste.length}  ${JSON.stringify(c)}`);
      }
      await dormir(2000);
    }
    const c = Object.values(verdicts).reduce<Record<string, number>>((a, v) => { a[v.verdict] = (a[v.verdict] ?? 0) + 1; return a; }, {});
    console.log("fini", JSON.stringify(c));
  })();
}
