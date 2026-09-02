/**
 * HAUTEURS DE SEMELLE — runningwarehouse.eu, via leur index de sitemaps.
 *
 *   npx tsx scripts/collecte-rw.ts            # tous les modèles sans hauteur de semelle
 *   npx tsx scripts/collecte-rw.ts "clifton"
 *
 * ⚠️ POURQUOI CETTE SOURCE ET PAS LEUR RECHERCHE. Leur `robots.txt` interdit
 * explicitement `/search-*.html` et `/SearchResults/` — et publie un index de sitemaps
 * par marque. On passe donc par l'index : c'est la voie qu'ils ouvrent eux-mêmes. Un
 * sitemap par marque, puis une page par modèle apparié.
 *
 * ⚠️ DEUX SOURCES QUI SE CONTREDISENT NE SE MOYENNENT PAS. i-run et Running Warehouse
 * publient tous deux le poids et le drop. S'ils divergent au-delà de la tolérance, ce
 * n'est pas un désaccord d'arrondi : c'est que la fiche appariée décrit une AUTRE
 * chaussure (une variante large, une autre génération, la déclinaison femme). On rejette
 * alors tout l'appariement — la hauteur de semelle qu'on venait chercher serait fausse
 * elle aussi. C'est la leçon du catalogue de courses, où trois épreuves avaient hérité
 * des distances d'une course à 400 km de là.
 */
import fs from "node:fs";
import path from "node:path";
import { dansLesBornes, coherenceStackDrop, type Modele } from "../src/lib/shop/modele";
import { normaliser } from "./collecte-irun";
import { prendreVerrou } from "../src/lib/shop/verrou";

const BASE = "https://www.runningwarehouse.eu";
const SORTIE = path.join(process.cwd(), "src/data/gear/chaussures.json");
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36", "Accept-Language": "en;q=0.9" };

/** Tolérances du contrôle croisé, et leur raison. */
export const TOLERANCE = {
  // Le poids dépend de la pointure de référence (EU 42 chez l'un, US 9 chez l'autre) :
  // quelques grammes d'écart sont normaux, vingt ne le sont pas.
  poidsG: 20,
  // Le drop est une cote de conception : deux sources ne peuvent pas en donner deux.
  dropMm: 1,
};

/** Levée quand la source refuse explicitement de continuer à nous répondre. */
export class Refus extends Error {}

/**
 * ⚠️ UN REFUS N'EST PAS UNE PANNE, ET ON NE LE CONTOURNE PAS. Après une centaine de
 * requêtes, le site a commencé à répondre 406 sur les fiches produit alors que sa page
 * d'accueil répondait toujours 200 : c'est une limite de débit, c'est-à-dire un « non ».
 * Le premier jet traitait ce 406 comme une page injoignable et enchaînait les
 * quarante suivantes — insistance inutile côté serveur, et journal illisible côté
 * nôtre, où quarante lignes identiques masquaient la vraie cause.
 *
 * On s'arrête donc au premier refus, en le disant. La collecte est incrémentale : le
 * lendemain, elle reprend là où elle s'est arrêtée.
 */
async function texte(url: string): Promise<string | null> {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (r && (r.status === 406 || r.status === 429 || r.status === 403)) {
    throw new Refus(`la source refuse de répondre (HTTP ${r.status}) — reprise plus tard`);
  }
  return r?.ok ? r.text() : null;
}

/** Les mots qui, présents en plus, désignent une AUTRE chaussure. */
const VARIANTES = new Set(["wide", "gtx", "gore", "tex", "womens", "women", "w", "kids", "junior", "shield", "waterproof"]);

/** Le nom du produit, lu dans le segment d'URL : `/HOKA_Clifton_11/descpage-XXX.html`. */
export function nomDeUrl(url: string): string {
  const seg = url.split("/").filter(Boolean).at(-2) ?? "";
  return normaliser(seg.replace(/_/g, " "));
}

export function choisirProduit(urls: string[], marque: string, nom: string): string | null {
  const attendus = normaliser(`${marque} ${nom}`).split(" ").filter(Boolean);
  const candidats = urls.filter((u) => {
    const jetons = nomDeUrl(u).split(" ").filter(Boolean);
    if (!attendus.every((a) => jetons.includes(a))) return false;
    // ⚠️ Tout mot en trop qui désigne une variante disqualifie : « Clifton 11 Wide » a
    // un autre poids et d'autres tailles que « Clifton 11 ».
    return jetons.filter((j) => !attendus.includes(j)).every((j) => !VARIANTES.has(j));
  });
  // Le nom le plus COURT : c'est le modèle nu, sans mention supplémentaire.
  return candidats.sort((a, b) => nomDeUrl(a).length - nomDeUrl(b).length)[0] ?? null;
}

export type SpecsRw = { poidsG?: number; stackTalonMm?: number; stackAvantMm?: number; dropMm?: number };

/** Les libellés du bloc « Shoe Specs », dans l'ordre où ils apparaissent. */
const LIBELLES = ["Weight:", "Heel Stack:", "Forefoot Stack:", "Heel-Toe Offset:"] as const;

/**
 * Lecture du bloc « Shoe Specs ».
 *
 * ⚠️ DEUX BALISAGES COEXISTENT SUR LE MÊME SITE. Les modèles récents sont en liste
 * (`<li><strong>Heel Stack: </strong>43 mm</li>`), les plus anciens en tableau
 * (`<td>Heel Stack:</td><td>43 mm</td>`), et une valeur peut contenir un `<br />`
 * (« 9.1 oz<br />258 g »). Un lecteur qui n'en connaît qu'un rend un objet vide sans
 * erreur : la Clifton 10 était « sans hauteur publiée » alors que la page l'affichait.
 *
 * ⚠️ ET LA FENÊTRE S'ARRÊTE AU LIBELLÉ SUIVANT. Sans cette borne, un champ absent ferait
 * lire la valeur du champ d'après — le poids deviendrait la hauteur de talon, en silence.
 */
export function specsDe(html: string): SpecsRw {
  const val = (label: string, unite: "g" | "mm"): number | undefined => {
    const i = html.indexOf(label);
    if (i < 0) return undefined;
    const suivants = LIBELLES.filter((l) => l !== label).map((l) => html.indexOf(l, i + label.length)).filter((x) => x > 0);
    const fin = Math.min(i + 200, ...(suivants.length ? suivants : [i + 200]));
    const brut = html.slice(i + label.length, fin).replace(/<[^>]*>/g, " ");
    const m = brut.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unite}\\b`));
    return m ? Number(m[1]) : undefined;
  };
  return {
    poidsG: val("Weight:", "g"),
    stackTalonMm: val("Heel Stack:", "mm"),
    stackAvantMm: val("Forefoot Stack:", "mm"),
    dropMm: val("Heel-Toe Offset:", "mm"),
  };
}

/** Le contrôle croisé. Rend la raison du refus, ou `null` si tout concorde. */
export function desaccord(ancien: Modele | undefined, rw: SpecsRw): string | null {
  if (!ancien) return null;
  const d = ancien.dropMm?.valeur;
  // ⚠️ LE DROP SEUL SERT D'IDENTITÉ, PAS LE POIDS. Premier jet : tout écart de plus de
  // 20 g rejetait l'appariement — sept modèles refusés, dont la Speedgoat 6 (245 g ici,
  // 283 g là-bas). Vérification faite, ce ne sont pas de mauvais appariements : aucune
  // des deux sources ne publie la pointure de référence, et trente grammes séparent une
  // 40 d'une 45. Le drop, lui, est une cote de conception : deux sources ne peuvent pas
  // en donner deux pour la même chaussure. C'est donc lui qui dit si on parle bien du
  // même modèle ; l'écart de poids, on l'AFFICHE au lieu de le trancher.
  if (d != null && rw.dropMm != null && Math.abs(d - rw.dropMm) > TOLERANCE.dropMm)
    return `drop ${d} mm ici, ${rw.dropMm} mm là-bas`;
  return null;
}

async function principal(): Promise<void> {
  prendreVerrou("collecte-rw");

  const filtre = process.argv[2]?.toLowerCase();
  const deja: Record<string, Modele> = fs.existsSync(SORTIE) ? JSON.parse(fs.readFileSync(SORTIE, "utf8")) : {};
  // ⚠️ ON PARCOURT LE CATALOGUE, PAS UNE LISTE DE DÉPART. Ce script itérait sur les 107
  //    noms écrits à la main au tout début ; depuis que les modèles sont DÉCOUVERTS chez
  //    le marchand, le catalogue en compte près du double, et les nouveaux ne pouvaient
  //    jamais recevoir leur hauteur de semelle. Le script tournait, annonçait « 0 absent »
  //    et laissait 150 fiches sans la cote qui fait tout l'intérêt du schéma de profil.
  const liste = Object.values(deja).filter((m) =>
    filtre ? `${m.marque} ${m.nom}`.toLowerCase().includes(filtre) : !m.stackTalonMm);
  console.log(`${liste.length} modèle(s) sans hauteur de semelle\n`);

  const index = await texte(`${BASE}/sitemapindex.xml`);
  if (!index) { console.log("index de sitemaps injoignable"); return; }
  const sitemaps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const cache = new Map<string, string[]>();
  const urlsDeMarque = async (marque: string): Promise<string[]> => {
    const code = normaliser(marque).replace(/ /g, "").toUpperCase();
    if (cache.has(code)) return cache.get(code)!;
    // Le code marque du marchand est tronqué (« LASPORTIV », « UNDERAR ») : on accepte
    // qu'il soit un préfixe du nôtre, ou l'inverse.
    const sm = sitemaps.find((s) => {
      const c = s.match(/ccode=RW([A-Z0-9]+)/)?.[1];
      return !!c && (c === code || code.startsWith(c) || c.startsWith(code));
    });
    const urls = sm ? [...(await texte(sm) ?? "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) : [];
    cache.set(code, urls);
    await pause();
    return urls;
  };

  const vu = new Date().toISOString().slice(0, 10);
  let remplis = 0, refuses = 0, absents = 0;
  try {
  for (const m of liste) {
    const urls = await urlsDeMarque(m.marque);
    if (!urls.length) { absents++; console.log(`  · ${m.marque} ${m.nom} — marque absente de la source`); continue; }
    const produit = choisirProduit(urls, m.marque, m.nom);
    if (!produit) { absents++; console.log(`  ✗ ${m.marque} ${m.nom} — modèle absent`); continue; }

    const html = await texte(produit);
    if (!html) { console.log(`  · ${m.marque} ${m.nom} — fiche injoignable`); await pause(); continue; }
    const rw = specsDe(html);
    const litige = desaccord(deja[m.slug], rw);
    if (litige) {
      refuses++;
      console.log(`  ⚠ ${m.marque} ${m.nom} — APPARIEMENT REJETÉ : ${litige}`);
      await pause();
      continue;
    }
    const stack = dansLesBornes("stackTalonMm", rw.stackTalonMm) ? rw.stackTalonMm : undefined;
    const drop = deja[m.slug]?.dropMm?.valeur ?? (dansLesBornes("dropMm", rw.dropMm) ? rw.dropMm : undefined);
    if (stack == null || !coherenceStackDrop(stack, drop)) {
      console.log(`  · ${m.marque} ${m.nom} — hauteur non publiée ou incohérente`);
      await pause();
      continue;
    }
    const poids = deja[m.slug].poidsG;
    const ecartPoids = poids && rw.poidsG != null && Math.abs(poids.valeur - rw.poidsG) > TOLERANCE.poidsG
      ? rw.poidsG : undefined;
    deja[m.slug] = {
      ...deja[m.slug],
      poidsG: poids ? { ...poids, autre: ecartPoids } : undefined,
      stackTalonMm: { valeur: stack, vu },
      dropMm: deja[m.slug].dropMm ?? (drop != null ? { valeur: drop, vu } : undefined),
      sources: [...new Set([...(deja[m.slug].sources ?? []), "runningwarehouse.eu"])],
    };
    remplis++;
    console.log(`  ✓ ${(m.marque + " " + m.nom).padEnd(32)} talon ${stack} mm · avant ${rw.stackAvantMm ?? "?"} mm · ${rw.poidsG ?? "?"} g${ecartPoids ? "  ⚠ écart de poids conservé" : ""}`);
    fs.writeFileSync(SORTIE, JSON.stringify(deja, null, 2));
    await pause();
  }
  } catch (e) {
    if (!(e instanceof Refus)) throw e;
    console.log(`\n⛔ ${e.message}`);
  }
  console.log(`\n${remplis} hauteur(s) ajoutée(s) · ${refuses} rejeté(s) sur désaccord de drop · ${absents} absent(s)`);
}

const pause = () => new Promise((r) => setTimeout(r, 1500));
if (require.main === module) void principal();
