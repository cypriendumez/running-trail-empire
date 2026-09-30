/**
 * COURSES RANGÉES EN ÎLE-DE-FRANCE PAR DÉFAUT (30/09/2026).
 *
 * ⚠️ CONSTAT. jogging-plus (source fermée depuis juin) rangeait en « ile-de-france » toute
 * course qu'il ne savait pas situer, avec un département vide ou absurde (« 00 », « 96 »,
 * « 98 ») et des coordonnées tirées AU HASARD en France : « Marathon de Dublin » près
 * d'Avignon, « Marathon de Rome » en Bretagne, « Kimbia Kenya » (Nairobi) dans le Doubs.
 * Elles apparaissaient au filtre « Île-de-France » et dans « Autour de moi ».
 *
 * La règle, pour chaque course « ile-de-france » dont le département n'est pas francilien :
 *   1. Polynésie / Nouvelle-Calédonie d'après la position (« Tahiti Moorea Marathon ») ;
 *   2. la commune À SES COORDONNÉES porte le nom de la ville → française, on la range là ;
 *   3. sinon une commune française porte EXACTEMENT ce nom → française, coordonnées refaites ;
 *   4. sinon : étrangère → retirée (jamais un favori).
 * Communes : API Géo de l'État (geo.api.gouv.fr, données ouvertes). Une ville illisible
 * (« A : ») n'est jamais jugée étrangère : elle passe par `CORRECTIONS` ou reste signalée.
 *
 *   npx tsx --env-file=.env.local scripts/corriger-idf-mal-classees.ts [--ecrire]
 */
import { createClient } from "@supabase/supabase-js";
import { departementDe, DEPARTEMENTS } from "../src/lib/races/departements";

const ECRIRE = process.argv.includes("--ecrire");
const GEO = "https://geo.api.gouv.fr/communes";

/** Une ville illisible dont le NOM de la course dit la commune (gentilé) — vérifiée à la main. */
const CORRECTIONS: Record<string, string> = {
  // « Abraysiens » : les habitants de Saint-Jean-de-Braye (Loiret). Ville saisie « A : ».
  "foulees abraysiennes": "Saint-Jean-de-Braye",
};

export const forme = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** La commune trouvée est-elle la ville écrite ? « Ferney » ⊂ « Ferney-Voltaire », jamais « Dublin » ≈ « Sorgues ». */
export function memeCommune(ville: unknown, commune: unknown): boolean {
  const v = forme(ville), c = forme(commune);
  if (v.length < 4 || c.length < 4) return v !== "" && v === c;
  return c === v || c.startsWith(`${v} `) || v.startsWith(`${c} `);
}

/** Une ville lisible : au moins trois lettres de suite. */
export const villeLisible = (v: unknown) => /\p{L}{3,}/u.test(String(v ?? ""));

type Commune = { nom: string; codeDepartement: string; centre?: { coordinates: [number, number] } };
async function communes(q: string): Promise<Commune[] | null> {
  try {
    const r = await fetch(`${GEO}?${q}&fields=nom,codeDepartement,centre&limit=5`, { signal: AbortSignal.timeout(15000) });
    return r.ok ? ((await r.json()) as Commune[]) : null;
  } catch { return null; }
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (u, o) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(30_000) }) },
  });
  // ⚠️ PAGINÉ : l'Île-de-France compte plus de 1 000 courses, et la base n'en rend que
  // 1 000 par requête — le premier jet n'a vu que 16 suspectes sur 23.
  const idf: { id: string; name: string; city: string | null; department: string | null; region: string; latitude: number | null; longitude: number | null }[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id,name,city,department,region,latitude,longitude").eq("region", "ile-de-france").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    idf.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const suspectes = idf.filter((r) => departementDe(r.department)?.region !== "ile-de-france");
  const favs = new Set<string>();
  const { data: f, error: e2 } = await sb.from("notifications").select("data").eq("type", "race_favori");
  if (e2) throw new Error(e2.message);
  for (const x of f ?? []) { const id = (x.data as { raceId?: string } | null)?.raceId; if (id) favs.add(id); }

  const majs: { id: string; patch: Record<string, unknown>; motif: string }[] = [];
  const retraits: { id: string; motif: string }[] = [];
  const signalees: string[] = [];
  for (const r of suspectes) {
    const la = Number(r.latitude), lo = Number(r.longitude), geo = Number.isFinite(la) && Number.isFinite(lo) && r.latitude != null;
    if (geo && la > -28 && la < -7 && lo > -155 && lo < -134) { majs.push({ id: r.id, patch: { region: "polynesie-francaise", department: "" }, motif: `${r.name} → Polynésie française` }); continue; }
    if (geo && la > -23 && la < -19 && lo > 163 && lo < 169) { majs.push({ id: r.id, patch: { region: "nouvelle-caledonie", department: "" }, motif: `${r.name} → Nouvelle-Calédonie` }); continue; }
    const ville = CORRECTIONS[forme(r.name)] ?? r.city;
    if (!villeLisible(ville)) { signalees.push(`${r.name} (ville « ${r.city} » illisible)`); continue; }
    const auPoint = geo ? await communes(`lat=${la}&lon=${lo}`) : [];
    const parNom = await communes(`nom=${encodeURIComponent(String(ville))}`);
    if (auPoint === null || parNom === null) { signalees.push(`${r.name} (API Géo injoignable)`); continue; }
    const ici = auPoint.find((c) => memeCommune(ville, c.nom));
    const exacte = parNom.filter((c) => forme(c.nom) === forme(ville));
    const commune = ici ?? (exacte.length === 1 ? exacte[0] : null);
    if (commune) {
      const d = DEPARTEMENTS.find((x) => x.code === commune.codeDepartement);
      if (!d) { signalees.push(`${r.name} (département ${commune.codeDepartement} inconnu)`); continue; }
      const patch: Record<string, unknown> = { department: d.nom, region: d.region, city: commune.nom };
      // Coordonnées refaites seulement quand elles ne désignaient pas la commune.
      if (!ici && commune.centre) Object.assign(patch, { latitude: commune.centre.coordinates[1], longitude: commune.centre.coordinates[0] });
      majs.push({ id: r.id, patch, motif: `${r.name} (${r.city}) → ${commune.nom}, ${d.nom}${ici ? "" : " (coordonnées refaites)"}` });
    } else if (exacte.length > 1) {
      signalees.push(`${r.name} (${exacte.length} communes « ${ville} »)`);
    } else if (favs.has(r.id)) {
      signalees.push(`${r.name} (${r.city}) : étrangère mais en FAVORI — gardée`);
    } else {
      retraits.push({ id: r.id, motif: `${r.name} (${r.city}) : aucune commune française de ce nom` });
    }
    await new Promise((res) => setTimeout(res, 150));
  }
  console.log(JSON.stringify({ suspectes: suspectes.length, corrigees: majs.length, etrangeres: retraits.length, signalees: signalees.length }));
  for (const m of majs) console.log("  ✓", m.motif);
  for (const x of retraits) console.log("  ✗", x.motif);
  for (const s of signalees) console.log("  ?", s);
  if (!ECRIRE) { console.log("(à blanc — rien écrit)"); return; }
  let ok = 0, refus = 0;
  for (const m of majs) { const { error: e } = await sb.from("races").update(m.patch).eq("id", m.id); if (e) { refus++; console.error(e.message); } else ok++; }
  if (retraits.length) { const { error: e } = await sb.from("races").delete().in("id", retraits.map((x) => x.id)); if (e) { refus++; console.error(e.message); } }
  console.log(`corrigées : ${ok}, retirées : ${refus ? 0 : retraits.length}`);
  if (refus) process.exit(1);
}

if (process.argv[1]?.endsWith("corriger-idf-mal-classees.ts")) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
