/**
 * APPLICATION DES FICHES finishers.com AU CATALOGUE — étape 2.
 *
 * À BLANC par défaut : affiche ce qui serait fait, n'écrit rien. `--ecrire` exécute.
 * Toute la décision vit dans `src/lib/races/majFinishers.ts` (pur, testé) ; ici, on lit,
 * on compte, et on écrit par lots en LISANT chaque erreur (Supabase ne lève pas).
 *
 *   npx tsx scripts/finishers-appliquer.ts <fiches.jsonl> [--ecrire]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { planEvenement, cleNomVille, PAYS_FRANCE, formatsRetenus, pasUneCourseAPied, dplusPlausible, estTrail, type Fiche, type LigneCourse } from "../src/lib/races/majFinishers";

const ECRIRE = process.argv.includes("--ecrire");
const [fichier] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

async function toutLire<T>(requete: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await requete(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function main() {
  // 1. Fiches (la plus récente par slug).
  const fiches = new Map<string, Fiche>();
  for (const l of readFileSync(fichier, "utf8").split("\n")) { try { const f = JSON.parse(l) as Fiche; if (f?.slug) fiches.set(f.slug, f); } catch { /* ligne en cours d'écriture */ } }

  // 1 bis. Liens « Résultats » lus sur les sites officiels (`scripts/resultats-sites.ts`) :
  // ils passent AVANT la page éditoriale de la source, jamais avant un classement déjà cité.
  const fSites = join(dirname(fichier), "resultats-sites.jsonl");
  let liensSites = 0;
  if (existsSync(fSites)) {
    const parSite = new Map<string, { url: string; annee: number | null }>();
    for (const l of readFileSync(fSites, "utf8").split("\n")) { try { const x = JSON.parse(l); if (x?.lien?.url) parSite.set(x.site, x.lien); } catch { /* */ } }
    for (const f of fiches.values()) {
      const lien = f.siteOfficiel ? parSite.get(f.siteOfficiel) : undefined;
      if (lien && !f.resultats?.classement) { f.resultats = { page: f.resultats?.page ?? null, classement: lien.url, annee: lien.annee }; liensSites++; }
    }
  }

  // 2. Les nouvelles colonnes existent-elles (migration 032) ?
  const sonde = await sb.from("races").select("site_officiel, source_id").limit(1);
  const colonnesNouvelles = !sonde.error;
  const cols = "id,name,city,date,distance_km,elevation_gain_m,type,organization,registration_url,latitude,longitude,region,department,difficulty" + (colonnesNouvelles ? ",source_id" : "");
  const lignes = await toutLire<LigneCourse>((a, b) => sb.from("races").select(cols).range(a, b) as never);

  // 3. Favoris : une ligne mise en favori n'est jamais retirée.
  const favs = await toutLire<{ data: { raceId?: string } }>((a, b) => sb.from("notifications").select("data").eq("type", "race_favori").range(a, b) as never);
  const favoris = new Set(favs.map((f) => String(f.data?.raceId ?? "")).filter(Boolean));

  // Lignes par fiche finishers, et lignes d'AUTRES sources par nom + ville : un événement
  // repris de jogging-plus se rafraîchit aussi depuis sa fiche finishers (même nom, même ville).
  const parSlug = new Map<string, LigneCourse[]>();
  const autresParNomVille = new Map<string, LigneCourse[]>();
  for (const l of lignes) {
    const s = String(l.registration_url ?? "").match(/finishers\.com\/course\/([^/?#]+)/)?.[1];
    if (s) parSlug.set(s, [...(parSlug.get(s) ?? []), l]);
    else { const k = cleNomVille(l.name, l.city); autresParNomVille.set(k, [...(autresParNomVille.get(k) ?? []), l]); }
  }

  const st = { fiches: fiches.size, lues: 0, erreurs: 0, horsFrance: 0, sansFormat: 0, pasCourseAPied: 0, connus: 0, nouveaux: 0, viaAutreSource: 0,
    majs: 0, datesRemplies: 0, datesEnAttente: 0, dplusAjoutes: 0, dplusZeroCorriges: 0, ajoutsConnus: 0, ajoutsNouveaux: 0, retraits: 0,
    motifs: {} as Record<string, number>, retraitsProteges: 0,
    liensInscription: 0, sitesOfficiels: 0, resultats: 0, heures: 0, paysNouveaux: {} as Record<string, number> };
  const majs: { id: string; patch: Record<string, unknown> }[] = [];
  const ajouts: Record<string, unknown>[] = [];
  const retraits: string[] = [];
  const exemples: string[] = [];
  const touchees = new Set<string>();
  const detailRetraits: string[] = [];

  for (const f of fiches.values()) {
    if (!f.ok) { st.erreurs++; continue; }
    st.lues++;
    if (!PAYS_FRANCE.has(String(f.pays ?? ""))) { st.horsFrance++; continue; }
    const deLaFiche = parSlug.get(f.slug) ?? [];
    // Une ligne d'ailleurs ne sert qu'UNE fiche (deux fiches homonymes dans la même ville).
    const dAilleurs = (autresParNomVille.get(cleNomVille(f.nom, f.ville)) ?? []).filter((l) => !touchees.has(l.id));
    const existantes = [...deLaFiche, ...dAilleurs];
    if (!formatsRetenus(f).length) {
      if (pasUneCourseAPied(f)) st.pasCourseAPied++; else st.sansFormat++;
      if (!deLaFiche.length) continue;
    } else if (deLaFiche.length) st.connus++;
    else if (dAilleurs.length) st.viaAutreSource++;
    else { st.nouveaux++; st.paysNouveaux[String(f.pays)] = (st.paysNouveaux[String(f.pays)] ?? 0) + 1; }
    const p = planEvenement(f, existantes, { aujourdhui, favoris, colonnesNouvelles });
    st.datesEnAttente += p.datesEnAttente;
    for (const m of Object.values(p.motifs)) st.motifs[m] = (st.motifs[m] ?? 0) + 1;
    for (const m of p.majs) {
      const avant = existantes.find((l) => l.id === m.id)!;
      if (String(avant.date).startsWith("2099") && !String(m.patch.date).startsWith("2099")) st.datesRemplies++;
      if (avant.elevation_gain_m == null && m.patch.elevation_gain_m != null) st.dplusAjoutes++;
      if (avant.elevation_gain_m === 0 && m.patch.elevation_gain_m == null) st.dplusZeroCorriges++;
    }
    const tous = [...p.majs.map((m) => m.patch), ...p.ajouts];
    st.liensInscription += tous.filter((x) => x.inscription_url).length;
    st.sitesOfficiels += tous.filter((x) => x.site_officiel).length;
    st.resultats += tous.filter((x) => x.resultats_url).length;
    st.heures += tous.filter((x) => x.heure_depart).length;
    st.majs += p.majs.length; majs.push(...p.majs);
    if (existantes.length) st.ajoutsConnus += p.ajouts.length; else st.ajoutsNouveaux += p.ajouts.length;
    for (const m of p.majs) touchees.add(m.id);
    for (const id of p.retraits) touchees.add(id);
    ajouts.push(...p.ajouts);
    st.retraits += p.retraits.length; retraits.push(...p.retraits);
    for (const id of p.retraits) {
      const l = existantes.find((x) => x.id === id)!;
      detailRetraits.push(`${p.motifs[id]} | ${l.name} (${l.city}) ${l.distance_km} km ${l.date} | fiche : ${(f.formats ?? []).map((x) => `${x.titre ?? "?"} [${x.discipline} ${x.distanceM != null ? Math.round(x.distanceM / 100) / 10 : "?"}]`).join(" ; ")}`);
    }
    st.retraitsProteges += existantes.filter((l) => favoris.has(l.id) && !p.majs.some((m) => m.id === l.id)).length;
    if (exemples.length < 6 && (p.retraits.length || p.ajouts.length) && existantes.length) {
      exemples.push(`${f.nom} : ${existantes.map((l) => l.distance_km).join("/")} km en base → ${formatsRetenus(f).map((x) => x.km).join("/")} km (retraits ${p.retraits.length}, ajouts ${p.ajouts.length})`);
    }
  }
  // PACA écrite de deux façons : 302 lignes invisibles au filtre de région.
  const paca = lignes.filter((l) => l.region === "provence-alpes-cote-azur").map((l) => l.id);
  // Balayage des lignes que les fiches n'ont PAS touchées : « 0 m » sur un trail et dénivelé
  // impossible (« 18 km, 16 660 m ») deviennent « inconnu » plutôt qu'un chiffre faux.
  const dplusFaux = lignes.filter((l) => !touchees.has(l.id) && l.elevation_gain_m != null
    && ((estTrail(l.type) && l.elevation_gain_m === 0) || !dplusPlausible(l.elevation_gain_m, l.distance_km))).map((l) => l.id);

  console.log(JSON.stringify({ ...st, liensResultatsSites: liensSites, colonnesNouvelles, pacaANormaliser: paca.length, dplusFauxBalayes: dplusFaux.length, aujourdhui }, null, 1));
  console.log(exemples.join("\n"));
  writeFileSync(fichier.replace(/\.jsonl$/, "") + `-plan-${ECRIRE ? "ecrit" : "a-blanc"}.json`, JSON.stringify({ st, majs: majs.length, ajouts: ajouts.length, retraits, detailRetraits }, null, 1));
  if (!ECRIRE) { console.log("(à blanc — rien écrit ; relancer avec --ecrire)"); return; }

  // ── ÉCRITURE ────────────────────────────────────────────────────────────────
  let ok = 0, ko = 0;
  const parLots = async <T>(items: T[], taille: number, faire: (lot: T[]) => Promise<void>) => {
    for (let i = 0; i < items.length; i += taille) await faire(items.slice(i, i + taille));
  };
  // Mises à jour : 8 en parallèle (une requête par ligne : les valeurs diffèrent).
  await parLots(majs, 8, async (lot) => {
    const r = await Promise.all(lot.map((m) => sb.from("races").update(m.patch).eq("id", m.id)));
    for (const x of r) { if (x.error) { ko++; if (ko < 5) console.error("maj :", x.error.message); } else ok++; }
  });
  console.log(`mises à jour : ${ok} ok, ${ko} en erreur`);
  let ins = 0;
  await parLots(ajouts, 400, async (lot) => {
    const { error } = await sb.from("races").insert(lot);
    if (error) console.error("insertion :", error.message); else ins += lot.length;
  });
  console.log(`ajouts : ${ins}/${ajouts.length}`);
  let sup = 0;
  await parLots(retraits, 200, async (lot) => {
    const { error } = await sb.from("races").delete().in("id", lot);
    if (error) console.error("retrait :", error.message); else sup += lot.length;
  });
  console.log(`retraits : ${sup}/${retraits.length}`);
  let bal = 0;
  await parLots(dplusFaux, 200, async (lot) => {
    const { error } = await sb.from("races").update({ elevation_gain_m: null }).in("id", lot);
    if (error) console.error("balayage D+ :", error.message); else bal += lot.length;
  });
  console.log(`dénivelés faux → inconnus : ${bal}/${dplusFaux.length}`);
  if (paca.length) {
    const { error } = await sb.from("races").update({ region: "provence-alpes-cote-d-azur" }).eq("region", "provence-alpes-cote-azur");
    console.log(error ? `PACA : ${error.message}` : `PACA normalisée : ${paca.length}`);
  }
  console.log("terminé");
}

main().catch((e) => { console.error(e); process.exit(1); });
