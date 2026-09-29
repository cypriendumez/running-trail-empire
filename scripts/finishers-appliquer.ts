/**
 * APPLICATION DES FICHES finishers.com AU CATALOGUE — étape 2.
 *
 * À BLANC par défaut : affiche ce qui serait fait, n'écrit rien. `--ecrire` exécute.
 * Toute la décision vit dans `src/lib/races/majFinishers.ts` (pur, testé) ; ici, on lit,
 * on compte, et on écrit par lots en LISANT chaque erreur (Supabase ne lève pas).
 *
 *   npx tsx scripts/finishers-appliquer.ts <fiches.jsonl> [--ecrire]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { seuil, depassement, arreterSiDepasse } from "./garde-fous";
import { planEvenement, cleNomVille, PAYS_FRANCE, formatsRetenus, pasUneCourseAPied, dplusPlausible, estTrail, type Fiche, type LigneCourse } from "../src/lib/races/majFinishers";

const ECRIRE = process.argv.includes("--ecrire");
/**
 * GARDE-FOUS D'UNE APPLICATION SANS SURVEILLANCE (rafraîchissement hebdomadaire). Si la
 * source change la forme de ses pages, une lecture de travers peut « retirer » des
 * centaines de courses ou renvoyer des milliers de dates en « Date à venir ». Au-delà de
 * ces seuils, RIEN n'est écrit : on s'arrête et on le dit (voir `garde-fous.ts`).
 */
const MAX_RETRAITS = seuil(process.argv, "--max-retraits", 400);
const MAX_DATES_PERDUES = seuil(process.argv, "--max-dates-perdues", 400);
/** Part maximale de fiches illisibles, puis de fiches françaises SANS aucun format retenu (en %). */
const MAX_ERREURS_PCT = seuil(process.argv, "--max-erreurs-pct", 20);
const MAX_SANS_FORMAT_PCT = seuil(process.argv, "--max-sans-format-pct", 25);
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
    // La DERNIÈRE lecture réussie d'un site fait foi, même si elle n'a plus rien trouvé : un
    // site relu (voir `--relire-apres`) qui a retiré son lien ne le garde pas chez nous. Une
    // relecture ratée (réseau, 403) ne remplace rien.
    const parSite = new Map<string, { url: string; annee: number | null } | null>();
    for (const l of readFileSync(fSites, "utf8").split("\n")) { try { const x = JSON.parse(l); if (x?.site && x.ok) parSite.set(x.site, x.lien?.url ? x.lien : null); } catch { /* */ } }
    for (const f of fiches.values()) {
      const lien = f.siteOfficiel ? parSite.get(f.siteOfficiel) : undefined;
      if (lien && !f.resultats?.classement) { f.resultats = { page: f.resultats?.page ?? null, classement: lien.url, annee: lien.annee }; liensSites++; }
    }
  }

  // 1 ter. Liens PROUVÉS MORTS par `scripts/verifier-liens-courses.ts` (deux 404/410
  // espacés) : jamais réécrits — sinon chaque application ressuscitait ce que le contrôle
  // venait de retirer.
  const morts = new Set<string>();
  for (const f of readdirSync(dirname(fichier)).filter((x) => /^liens-controle-.*\.json$/.test(x))) {
    try { for (const m of JSON.parse(readFileSync(join(dirname(fichier), f), "utf8")).mortes ?? []) morts.add(m.u); } catch { /* rapport illisible */ }
  }
  for (const f of fiches.values()) {
    if (f.resultats?.classement && morts.has(f.resultats.classement)) f.resultats = { ...f.resultats, classement: null };
    if (f.resultats?.page && morts.has(f.resultats.page)) f.resultats = { ...f.resultats, page: null };
    if (f.inscription && morts.has(f.inscription)) f.inscription = null;
    for (const x of f.formats ?? []) if (x.inscription && morts.has(x.inscription)) x.inscription = null;
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
  let datesPerdues = 0;
  const detailRetraits: string[] = [];

  // Fiches à relire la semaine suivante même si le plan du site ne les signale plus comme
  // nouvelles : illisibles cette fois (réseau, 403, 5xx), ou françaises SANS format encore
  // publié — sinon elles restaient « déjà vues » et on n'y revenait jamais.
  const aRevoir: string[] = [];
  for (const f of fiches.values()) {
    if (!f.ok) { st.erreurs++; if (f.http !== 404 && f.http !== 410) aRevoir.push(f.slug); continue; }
    st.lues++;
    if (!PAYS_FRANCE.has(String(f.pays ?? ""))) { st.horsFrance++; continue; }
    const deLaFiche = parSlug.get(f.slug) ?? [];
    // Une ligne d'ailleurs ne sert qu'UNE fiche (deux fiches homonymes dans la même ville).
    const dAilleurs = (autresParNomVille.get(cleNomVille(f.nom, f.ville)) ?? []).filter((l) => !touchees.has(l.id));
    const existantes = [...deLaFiche, ...dAilleurs];
    if (!formatsRetenus(f).length) {
      if (pasUneCourseAPied(f)) st.pasCourseAPied++; else { st.sansFormat++; aRevoir.push(f.slug); }
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
      if (!String(avant.date).startsWith("2099") && String(avant.date) >= aujourdhui && String(m.patch.date).startsWith("2099")) datesPerdues++;
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

  console.log(JSON.stringify({ ...st, liensResultatsSites: liensSites, liensMortsEcartes: morts.size, colonnesNouvelles, pacaANormaliser: paca.length, dplusFauxBalayes: dplusFaux.length, aujourdhui }, null, 1));
  console.log(exemples.join("\n"));
  writeFileSync(fichier.replace(/\.jsonl$/, "") + `-plan-${ECRIRE ? "ecrit" : "a-blanc"}.json`, JSON.stringify({ st, majs: majs.length, ajouts: ajouts.length, retraits, detailRetraits }, null, 1));
  writeFileSync(join(dirname(fichier), "a-revoir.txt"), aRevoir.join("\n") + (aRevoir.length ? "\n" : ""));
  // Mesuré sur la collecte complète du 29/09/2026 : 28 fiches illisibles sur 7 997 (0,4 %),
  // 74 françaises sans format sur ~5 400 (1,4 %). Des parts vingt fois plus fortes disent
  // que la source a changé de forme, pas que les courses ont disparu.
  const francaises = st.lues - st.horsFrance;
  const comptes = [
    { quoi: "retraits", n: retraits.length, max: MAX_RETRAITS },
    { quoi: "dates futures renvoyées en « Date à venir »", n: datesPerdues, max: MAX_DATES_PERDUES },
    { quoi: "% de fiches illisibles", n: st.fiches ? Math.round((st.erreurs / st.fiches) * 100) : 0, max: MAX_ERREURS_PCT },
    { quoi: "% de fiches françaises sans aucun format", n: francaises ? Math.round((st.sansFormat / francaises) * 100) : 0, max: MAX_SANS_FORMAT_PCT },
  ];
  if (!ECRIRE) { console.log(`(à blanc — rien écrit ; relancer avec --ecrire) — dates perdues : ${datesPerdues}, à revoir : ${aRevoir.length}`); console.log(depassement(comptes) ?? "seuils : aucun dépassement"); return; }
  arreterSiDepasse(comptes);

  // ── ÉCRITURE ────────────────────────────────────────────────────────────────
  let ok = 0, ko = 0, refus = 0;
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
    if (error) { console.error("insertion :", error.message); refus++; } else ins += lot.length;
  });
  console.log(`ajouts : ${ins}/${ajouts.length}`);
  let sup = 0;
  await parLots(retraits, 200, async (lot) => {
    const { error } = await sb.from("races").delete().in("id", lot);
    if (error) { console.error("retrait :", error.message); refus++; } else sup += lot.length;
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
  // ⚠️ SUPABASE REND SES ERREURS, IL NE LES LÈVE PAS : sans ce code de sortie, une
  // exécution planifiée qui n'a rien écrit passait au vert. Quelques mises à jour ratées
  // sur ~10 000 (hoquet réseau) ne font pas rougir ; un lot refusé, si.
  if (refus > 0 || ko > Math.max(20, majs.length * 0.01)) { console.error(`ÉCHEC : ${refus} lot(s) refusé(s), ${ko} mise(s) à jour en erreur`); process.exit(1); }
  console.log("terminé");
}

main().catch((e) => { console.error(e); process.exit(1); });
