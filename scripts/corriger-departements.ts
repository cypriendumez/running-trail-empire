/**
 * DÉPARTEMENTS ET RÉGIONS : une écriture, la bonne région ; les courses étrangères écartées.
 *
 * Voir `lib/races/departements` pour le constat du 29/09/2026. À blanc par défaut ;
 * `--ecrire` exécute. Une course ÉTRANGÈRE (code postal à lettres) n'est retirée que si
 * aucun athlète ne l'a mise en favori ; ses coordonnées étaient fausses (« Marathon de
 * Toronto » près de Nantes) et polluaient « Autour de moi ».
 *
 *   npx tsx --env-file=.env.local scripts/corriger-departements.ts [--ecrire]
 */
import { createClient } from "@supabase/supabase-js";
import { departementDe, departementParPosition, departementEtranger } from "../src/lib/races/departements";

const ECRIRE = process.argv.includes("--ecrire");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
type L = { id: string; name: string; city: string | null; department: string | null; region: string | null; latitude: number | null; longitude: number | null };

async function main() {
  const rows: L[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id,name,city,department,region,latitude,longitude").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message); rows.push(...(data as L[])); if (data!.length < 1000) break;
  }
  const favs = new Set<string>();
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("notifications").select("data").eq("type", "race_favori").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const f of data ?? []) { const id = (f.data as { raceId?: string } | null)?.raceId; if (id) favs.add(id); }
    if (!data || data.length < 1000) break;
  }
  // Repli pour un département vide : celui des autres courses de la MÊME ville (majoritaire).
  const villeCle = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const parVille = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const d = departementDe(r.department); if (!d || !r.city) continue;
    const m = parVille.get(villeCle(r.city)) ?? new Map(); m.set(d.code, (m.get(d.code) ?? 0) + 1); parVille.set(villeCle(r.city), m);
  }
  const deLaVille = (city: unknown) => {
    const m = parVille.get(villeCle(city)); if (!m) return null;
    const [code] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return departementDe(code);
  };
  const majs = new Map<string, { department: string; region: string }>();
  const etrangeres: L[] = []; const nonResolues: L[] = [];
  for (const r of rows) {
    const brut = String(r.department ?? "").trim();
    const ambigu = /^(20|corse|97|98)$/i.test(brut) || brut === "";
    const d = (ambigu ? departementParPosition(r.latitude, r.longitude) : null) ?? departementDe(brut) ?? (brut === "" ? deLaVille(r.city) : null);
    if (d) {
      if (r.department !== d.nom || r.region !== d.region) majs.set(r.id, { department: d.nom, region: d.region });
    } else if (departementEtranger(brut)) etrangeres.push(r);
    else nonResolues.push(r);
  }
  const retraits = etrangeres.filter((r) => !favs.has(r.id));
  const changementsRegion = [...majs.entries()].filter(([id, m]) => rows.find((r) => r.id === id)!.region !== m.region);
  console.log(JSON.stringify({ lignes: rows.length, majs: majs.size, dontRegionCorrigee: changementsRegion.length, etrangeres: etrangeres.length, retraitsEtrangeres: retraits.length, nonResolues: nonResolues.length }, null, 1));
  for (const [id, m] of changementsRegion.slice(0, 15)) { const r = rows.find((x) => x.id === id)!; console.log(`  région ${r.region} → ${m.region} : ${r.name} (${r.city}, « ${r.department} »)`); }
  console.log("ÉTRANGÈRES :", etrangeres.slice(0, 40).map((r) => `${r.name} (${r.city}, ${r.department})`).join(" | "));
  const parValeur: Record<string, number> = {}; for (const r of nonResolues) parValeur[String(r.department)] = (parValeur[String(r.department)] ?? 0) + 1;
  console.log("NON RÉSOLUES par valeur :", JSON.stringify(parValeur));
  if (!ECRIRE) { console.log("(à blanc — rien écrit)"); return; }
  let ok = 0, ko = 0;
  const liste = [...majs.entries()];
  for (let i = 0; i < liste.length; i += 8) {
    const res = await Promise.all(liste.slice(i, i + 8).map(([id, m]) => sb.from("races").update(m).eq("id", id)));
    for (const x of res) { if (x.error) { ko++; if (ko < 4) console.error(x.error.message); } else ok++; }
  }
  console.log(`mises à jour : ${ok} ok, ${ko} en erreur`);
  for (let i = 0; i < retraits.length; i += 200) {
    const { error } = await sb.from("races").delete().in("id", retraits.slice(i, i + 200).map((r) => r.id));
    console.log(error ? `retrait : ${error.message}` : `étrangères retirées : ${Math.min(i + 200, retraits.length)}/${retraits.length}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
