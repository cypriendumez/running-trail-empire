/**
 * RETIRER LES ÉPREUVES QUI NE SONT PAS DE LA COURSE À PIED (nom sans ambiguïté) — voir
 * lib/races/nonCourse. À blanc par défaut ; `--ecrire` retire. Jamais un favori.
 *
 *   npx tsx --env-file=.env.local scripts/retirer-non-course.ts [--ecrire]
 */
import { createClient } from "@supabase/supabase-js";
import { pasCourseAPiedParNom } from "../src/lib/races/nonCourse";
import { seuil, arreterSiDepasse } from "./garde-fous";

const ECRIRE = process.argv.includes("--ecrire");
/** Le grand ménage a eu lieu le 29/09/2026 ; ensuite, chaque semaine n'apporte que quelques cas. */
const MAX_RETRAITS = seuil(process.argv, "--max-retraits", 50);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  const rows: { id: string; name: string; city: string | null; organization: string | null; registration_url: string | null }[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("races").select("id, name, city, organization, registration_url").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message); rows.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const favs = new Set<string>();
  for (let p = 0; ; p++) {
    const { data, error } = await sb.from("notifications").select("data").eq("type", "race_favori").order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const f of data ?? []) { const id = (f.data as { raceId?: string } | null)?.raceId; if (id) favs.add(id); }
    if (!data || data.length < 1000) break;
  }
  // ⚠️ PAS LES LIGNES FINISHERS : leur fiche dit la DISCIPLINE, plus fiable que le nom.
  // « Triathlon des Roses Paris, 10 km » y est déclaré « course sur route » : une vraie
  // course, organisée dans le cadre du triathlon. Le nom ne tranche que là où la source
  // ne dit rien (jogging-plus, saisies anciennes).
  // ⚠️ LE LIEN, PAS LE LIBELLÉ D'ORGANISATION (30/09/2026). « Méribel Cyclo Challenge »
  // portait « finishers.com » en organisation mais venait de jogging-plus (lien d'inscription
  // jogging-plus) : aucune fiche ne le rafraîchissait, et cette règle l'épargnait. Seule une
  // ligne RELIÉE à une fiche finishers a sa discipline dite par la source.
  const cibles = rows.filter((r) => !/finishers\.com\/course\//.test(String(r.registration_url ?? "")) && pasCourseAPiedParNom(r.name));
  const retraits = cibles.filter((r) => !favs.has(r.id));
  console.log(JSON.stringify({ lignes: rows.length, pasCourseAPied: cibles.length, protegesFavoris: cibles.length - retraits.length }));
  console.log([...new Set(retraits.map((r) => r.name))].slice(0, 60).join(" | "));
  if (!ECRIRE) { console.log("(à blanc — rien retiré)"); return; }
  arreterSiDepasse([{ quoi: "épreuves à retirer", n: retraits.length, max: MAX_RETRAITS }]);
  let n = 0, refus = 0;
  for (let i = 0; i < retraits.length; i += 200) {
    const { error } = await sb.from("races").delete().in("id", retraits.slice(i, i + 200).map((r) => r.id));
    if (error) { console.error("retrait :", error.message); refus++; } else n += Math.min(200, retraits.length - i);
  }
  console.log(`retirées : ${n}`);
  if (refus) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
