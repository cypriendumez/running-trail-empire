/**
 * ÉCRIRE LES TRACÉS GARDÉS DU CATALOGUE (data/traces/<tranche>.json.gz).
 *
 *   NODE_OPTIONS=--max-old-space-size=4096 npx tsx scripts/parcours-traces-extraire.ts <dossier-cache> \
 *     [--ign <ign-france.json>] [--ouverts <traces-ouvertes.jsonl>] [--ecrire]
 *
 * 28/11/2026 (voir src/lib/parcours/tracesStockees.ts) : l'application ne relit plus chaque tracé chez
 * OpenStreetMap (API d'édition réservée à l'édition) ni à l'IGN : le catalogue en garde une copie.
 *  · OpenStreetMap : relu par Overpass (`>>;out geom`, comme l'application), par paquets, en cache
 *    reprenable ; assemblé EXACTEMENT comme à l'affichage (`segmentsOverpass` puis
 *    `chainSegmentsMesure`) ;
 *  · IGN : depuis le cache de l'import national (mêmes segments que le WFS) ;
 *  · sources ouvertes (métropoles, parcs…) : leurs tracés complets, écrits par l'import.
 * Chaque tracé est simplifié à 4 m (0,7 % d'écart de longueur, mesuré), puis CONTRÔLÉ : un tracé qui
 * ne fait pas la distance du catalogue à 15 % près n'est PAS gardé (l'application relira la source,
 * comme avant) et il est compté — jamais un tracé faux servi comme vrai.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, openSync, readSync, closeSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { chainSegmentsMesure, segmentsOverpass } from "../src/lib/parcours/geometrie";
import { longueurKm } from "../src/lib/parcours/trace";
import { simplifier, encoder, decoder, trancheDe, TRANCHES } from "../src/lib/parcours/tracesStockees";
import { reponseUtilisable } from "./parcours-importer";
import { UA_PACEVOBOT } from "../src/lib/races/robot";
import { arreterSiDepasse, seuil } from "./garde-fous";

type LL = [number, number];
type P = { osm_id: number; osm_type?: string; distance_km: number; cle_source?: string; coordinates?: LL[] };

/** Le tracé à garder, ou la raison de ne pas le garder (pur : testé). */
export function aGarder(coords: LL[], distanceKm: number): { ok: string } | { refus: string } {
  if (coords.length < 2) return { refus: "tracé vide" };
  const s = simplifier(coords, 4);
  const km = longueurKm(decoder(encoder(s)));
  if (!(distanceKm > 0)) return { refus: "distance du catalogue inconnue" };
  if (Math.abs(km - distanceKm) / distanceKm > 0.15) return { refus: "longueur différente du catalogue (> 15 %)" };
  return { ok: encoder(s) };
}

/** Des chaînages possibles d'un même tracé, celui dont la longueur est la plus proche du catalogue. */
export function choisirOrdre(chaines: LL[][], distanceKm: number): LL[] {
  return chaines.reduce((a, b) => (Math.abs(longueurKm(b) - distanceKm) < Math.abs(longueurKm(a) - distanceKm) ? b : a));
}

if (process.argv[1]?.endsWith("parcours-traces-extraire.ts")) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const CACHE = process.argv[2];
  mkdirSync(CACHE, { recursive: true });
  const ecrire = process.argv.includes("--ecrire");
  const items = JSON.parse(readFileSync("data/parcours_certifies.json", "utf8")) as P[];
  const FO = path.join(CACHE, "osm-geom.jsonl");
  // ⚠️ Le cache OSM pèse plus de 500 Mo : il est relu LIGNE À LIGNE et chaque tracé est jugé tout de
  // suite (jamais tout en mémoire — l'extraction du 28/11/2026 est tombée à court de mémoire).
  const dejaLues = new Set<number>();
  const lireLignes = (f: string, fn: (o: { id: number; s: LL[][]; m?: LL[][] }) => void) => {
    if (!existsSync(f)) return;
    const fd = openSync(f, "r"), tampon = Buffer.alloc(16 << 20);
    let reste = "", n: number;
    while ((n = readSync(fd, tampon, 0, tampon.length, null)) > 0) {
      const lignes = (reste + tampon.toString("utf8", 0, n)).split("\n");
      reste = lignes.pop() ?? "";
      for (const l of lignes) if (l.trim()) { try { fn(JSON.parse(l)); } catch { /* ligne coupée */ } }
    }
    if (reste.trim()) { try { fn(JSON.parse(reste)); } catch { /* ligne coupée */ } }
    closeSync(fd);
  };
  lireLignes(FO, (o) => dejaLues.add(o.id));
  const EP = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter"];
  const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** Les chemins de chaque relation d'un paquet, dans les deux ordres, mis en cache. */
  const traiter = (lot: number[], j: { elements?: { type: string; id: number; members?: { type: string; ref: number }[] }[] }) => {
      // Les chemins de CHAQUE relation (et de ses sous-relations), assemblés comme l'application.
    const parId = new Map((j.elements ?? []).map((e) => [`${e.type}/${e.id}`, e]));
    for (const id of lot) {
      const racine = parId.get(`relation/${id}`);
      if (!racine) continue;
      const vus = new Set<string>(), chemins: unknown[] = [];
      const pile = [racine];
      while (pile.length) {
        const r = pile.pop()!;
        for (const m of r.members ?? []) {
          const k = `${m.type}/${m.ref}`;
          if (vus.has(k)) continue; vus.add(k);
          const e = parId.get(k);
          if (!e) continue;
          if (m.type === "way") chemins.push(e); else if (m.type === "relation") pile.push(e);
        }
      }
      // Deux ordres possibles (le chaînage en dépend) : celui de l'application (par identifiant,
      // `segmentsOverpass`) et celui des membres de la relation, qu'a mesuré le contrôle du
      // 28/11/2026 (« 10 - Teliere » : 5,49 km dans l'un, 6,64 km dans l'autre). Les deux sont
      // gardés ; le choix se fait contre la distance du catalogue.
      // Dans l'ordre des membres, AVEC les doublons : un chemin listé deux fois est un aller-retour.
      const parMembres: LL[][] = [];
      const relationsVues = new Set<number>();
      const parcourir = (r: { id: number; members?: { type: string; ref: number }[] }) => {
        if (relationsVues.has(r.id)) return; relationsVues.add(r.id);
        for (const m of r.members ?? []) {
          const e = parId.get(`${m.type}/${m.ref}`) as { id: number; geometry?: { lat: number; lon: number }[]; members?: { type: string; ref: number }[] } | undefined;
          if (!e) continue;
          if (m.type === "way" && (e.geometry?.length ?? 0) >= 2) parMembres.push(e.geometry!.map((g) => [g.lon, g.lat] as LL));
          else if (m.type === "relation") parcourir(e);
        }
      };
      parcourir(racine);
      const segs = segmentsOverpass(chemins as never);
      const arrondi = (l: LL[][]) => l.map((s) => s.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]));
      appendFileSync(FO, JSON.stringify({ id, s: arrondi(segs), m: arrondi(parMembres) }) + "\n");
    }
  };
  (async () => {
    // 1. OpenStreetMap, par paquets de 100 (`>>` ramène aussi les sous-relations), les DEUX miroirs
    //    en même temps (un paquet chacun : Overpass accepte deux requêtes simultanées par adresse).
    const osm = items.filter((p) => (p.osm_type ?? "relation") === "relation" && !dejaLues.has(p.osm_id)).map((p) => p.osm_id);
    console.log(`OSM : ${osm.length} relations à relire`);
    const PAQUET = 100;
    const lots: number[][] = [];
    for (let i = 0; i < osm.length; i += PAQUET) lots.push(osm.slice(i, i + PAQUET));
    let faits = 0;
    const ouvrier = async (miroir: number) => {
      for (let lot = lots.shift(); lot; lot = lots.shift()) {
        let j: { elements?: { type: string; id: number; members?: { type: string; ref: number }[] }[] } | null = null;
        for (let essai = 0; essai < 6 && !j; essai++) {
          try {
            // Les chemins (avec leur géométrie) et les relations (avec leurs membres) — pas les nœuds.
            const q = `[out:json][timeout:280];relation(id:${lot.join(",")})->.r;.r >>->.d;way.d;out geom;(relation.r;relation.d;);out body;`;
            const r = await fetch(EP[(miroir + essai) % 2], { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA_PACEVOBOT }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(300000) });
            if (r.ok) { const t = await r.json(); const rel = { ...t, elements: (t.elements ?? []).filter((e: { type: string }) => e.type === "relation") }; if (reponseUtilisable(rel, lot.length)) j = t; }
          } catch { /* nouvel essai */ }
          if (!j) await dormir(15000);
        }
        if (!j) { console.log(`  un paquet illisible : repris au prochain passage`); continue; }
        traiter(lot, j);
        faits += lot.length;
        if (Math.floor((faits - lot.length) / 2000) !== Math.floor(faits / 2000)) console.log(`  ${faits}/${osm.length}`);
        await dormir(1000);
      }
    };
    await Promise.all([ouvrier(0), ouvrier(1)]);

    // 2. IGN : les segments du cache de l'import national.
    const ign = new Map<string, LL[][]>();
    if (arg("--ign")) for (const c of JSON.parse(readFileSync(arg("--ign")!, "utf8")) as { cle: string; segments: LL[][] }[]) ign.set(c.cle, c.segments);
    // 3. Sources ouvertes : tracés complets écrits par l'import (`{ id, c }`).
    const ouverts = new Map<number, LL[]>();
    if (arg("--ouverts") && existsSync(arg("--ouverts")!)) for (const l of readFileSync(arg("--ouverts")!, "utf8").split("\n")) if (l.trim()) { try { const o = JSON.parse(l); ouverts.set(o.id, o.c); } catch { /* ligne coupée */ } }

    const tranches: Record<string, string>[] = Array.from({ length: TRANCHES }, () => ({}));
    const bilan: Record<string, number> = {};
    const n = (k: string) => { bilan[k] = (bilan[k] ?? 0) + 1; };
    // OSM, ligne à ligne : le chaînage qui fait la distance du catalogue, contrôlé, encodé.
    const parId = new Map(items.map((p) => [p.osm_id, p]));
    const osmJuges = new Map<number, string>();
    lireLignes(FO, (o) => {
      const p = parId.get(o.id);
      if (!p || (p.osm_type ?? "relation") !== "relation" || osmJuges.has(o.id)) return;
      const r = aGarder(choisirOrdre([o.s, o.m ?? o.s].map((x) => chainSegmentsMesure(x).coords), p.distance_km), p.distance_km);
      if ("ok" in r) { tranches[trancheDe(o.id)][String(o.id)] = r.ok; osmJuges.set(o.id, "gardé"); }
      else osmJuges.set(o.id, r.refus);
    });
    for (const p of items) {
      const type = p.osm_type ?? "relation";
      let coords: LL[] | null = null;
      if (type === "relation") { n(osmJuges.has(p.osm_id) ? `relation : ${osmJuges.get(p.osm_id)}` : "relation : tracé non relu"); continue; }
      else if (type === "ign") { const s = p.cle_source ? ign.get(p.cle_source) : undefined; coords = s ? chainSegmentsMesure(s).coords : null; }
      else if (ouverts.has(p.osm_id)) coords = ouverts.get(p.osm_id)!;
      else if (p.coordinates?.length) { n(`${type} : tracé déjà dans le catalogue`); continue; }
      if (!coords) { n(`${type} : tracé non relu`); continue; }
      const r = aGarder(coords, p.distance_km);
      if ("refus" in r) { n(`${type} : ${r.refus}`); continue; }
      tranches[trancheDe(p.osm_id)][String(p.osm_id)] = r.ok;
      n(`${type} : gardé`);
    }
    const taille = tranches.reduce((t, o) => t + gzipSync(JSON.stringify(o)).length, 0);
    console.log(JSON.stringify({ parcours: items.length, bilan, tailleGzMo: Math.round(taille / 1e4) / 100 }, null, 1));
    if (ecrire) {
      // Un parcours OSM dont le tracé d'aujourd'hui ne fait plus la distance affichée (> 15 %) :
      // RETIRÉ du catalogue (relu au moment d'écrire), plutôt que montré avec une distance fausse.
      const faux = new Set([...osmJuges].filter(([, v]) => v !== "gardé").map(([k]) => k));
      if (faux.size) {
        arreterSiDepasse([{ quoi: "parcours retirés (tracé différent du catalogue)", n: faux.size, max: seuil(process.argv, "--max-retraits", 300) }]);
        const frais = JSON.parse(readFileSync("data/parcours_certifies.json", "utf8")) as P[];
        writeFileSync("data/parcours_certifies.json", JSON.stringify(frais.filter((p) => !faux.has(p.osm_id))));
        console.log(`retirés du catalogue : ${faux.size} (tracé différent de la distance affichée)`);
      }
      mkdirSync("data/traces", { recursive: true });
      tranches.forEach((o, t) => writeFileSync(path.join("data/traces", `${t}.json.gz`), gzipSync(JSON.stringify(o), { level: 9 })));
      console.log(`écrit : data/traces/ (${TRANCHES} tranches)\n⚠️ relancer « npx tsx scripts/parcours-compacter.ts » : la production lit le .min.json.gz`);
    }
  })();
}
