/**
 * DÉCOUVERTE DE MODÈLES — on ne devine plus les noms, on les lit chez le marchand.
 *
 *   npx tsx scripts/decouverte-irun.ts             # toutes les marques
 *   npx tsx scripts/decouverte-irun.ts Hoka        # une marque
 *
 * ⚠️ POURQUOI REMPLACER UNE LISTE ÉCRITE À LA MAIN. Le catalogue partait de 107 noms que
 * j'avais tapés de mémoire : 25 n'existaient pas sous cette forme, et rien ne garantit
 * que les 82 autres soient les modèles réellement vendus en France aujourd'hui. La
 * recherche du marchand, elle, ne rend que des produits qui existent et qu'il vend. On
 * lui demande une marque, il rend ses modèles — noms exacts, code-barres, prix du jour.
 *
 * ⚠️ ET UNE FICHE « HOMME » PEUT ÊTRE UNE FICHE FEMME. Vérifié : la fiche 144265 est
 * servie sous `/chaussures_homme/` alors que son JSON-LD annonce « Chaussures de sport
 * femme Running » — même produit, deux chemins. Se fier au chemin d'URL ferait entrer
 * dans le catalogue des poids et des cotes de la déclinaison femme sous l'étiquette
 * homme. C'est la catégorie déclarée dans les données structurées qui tranche.
 */
import fs from "node:fs";
import path from "node:path";
import { dansLesBornes, type Modele, type Terrain } from "../src/lib/shop/modele";
import { normaliser, caracteristiques, nombreDe, jsonProduit } from "./collecte-irun";

const BASE = "https://www.i-run.fr";
const SORTIE = path.join(process.cwd(), "src/data/gear/chaussures.json");
const UA = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

/** Les marques de course à pied qu'on interroge. Une recherche chacune. */
/**
 * ⚠️ UN SEUL LIBELLÉ PAR MARQUE. Le marchand écrit « Hoka One One » et « On Running » là
 * où l'on dit « Hoka » et « On » : sans normalisation, le filtre affichait deux entrées
 * pour la même marque et cocher l'une faisait rater la moitié du catalogue.
 */
export const ALIAS_MARQUE: Record<string, string> = { "Hoka One One": "Hoka", "On Running": "On", "Topo Athletic": "Topo" };
export const nomMarque = (v: string) => ALIAS_MARQUE[v] ?? v;

export const MARQUES = [
  "Adidas", "Altra", "Asics", "Brooks", "Craft", "Hoka", "Inov-8", "Kiprun", "La Sportiva",
  "Merrell", "Mizuno", "New Balance", "Nike", "NNormal", "Norda", "On", "Puma",
  "Saucony", "Salomon", "Scott", "Topo Athletic", "Under Armour",
] as const;

/** Seules ces deux catégories du marchand nous intéressent : route et sentier. */
const CATEGORIES: Record<string, Terrain> = { Running_c23: "route", Running_c24: "route", Trail_c15: "trail", Trail_c16: "trail" };

async function page(url: string): Promise<string | null> {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (!r?.ok) return null;
  return new TextDecoder("windows-1252").decode(await r.arrayBuffer());
}

/** Le terrain vient de la catégorie du marchand, pas d'un jugement de notre part. */
export function terrainDeUrl(url: string): Terrain | null {
  const m = url.match(/\/chaussures_[a-z]+\/([A-Za-z]+_c\d+)\//);
  return m ? (CATEGORIES[m[1]] ?? null) : null;
}

/**
 * ⚠️ LA DÉCLINAISON FEMME EST UN AUTRE PRODUIT : autres poids, autres pointures, parfois
 * une autre semelle. La catégorie annoncée dans les données structurées est la seule
 * source fiable — le chemin d'URL, non.
 */
export function estFemme(produit: Record<string, unknown> | null, url: string): boolean {
  const cat = String((produit?.offers as { category?: string } | undefined)?.category ?? "");
  if (/femme/i.test(cat)) return true;
  if (/\bhomme\b/i.test(cat)) return false;
  // Aucune catégorie déclarée : on retombe sur le chemin, faute de mieux.
  return /\/chaussures_femme\//.test(url);
}

/** Les formes longues sous lesquelles le marchand écrit une marque. */
export const FORMES_LONGUES: Record<string, string[]> = {
  Hoka: ["Hoka One One"], On: ["On Running"], Topo: ["Topo Athletic"],
};

/**
 * Retire un préfixe de marque en respectant la ponctuation du marchand.
 *
 * ⚠️ COMPTER LES MOTS SUR LA VERSION NORMALISÉE ÉTAIT FAUX. Le marchand écrit
 * « On-Running Cloudmonster Hyper » : un seul mot pour un découpage sur les espaces,
 * DEUX une fois normalisé. Retirer « deux mots » du libellé d'origine emportait donc
 * « On-Running » ET « Cloudmonster », et le modèle entrait au catalogue sous le nom
 * « Hyper ». Résultat visible : huit modèles en double, chacun présent sous son vrai nom
 * et sous un nom tronqué, partageant le même code-barres.
 *
 * On consomme donc les mots un par un sur le libellé D'ORIGINE, en acceptant l'espace
 * comme le trait d'union comme séparateur — et le reste est rendu tel quel, ce qui
 * préserve les traits d'union internes (« Gel-Nimbus » reste « Gel-Nimbus »).
 */
export function retirerPrefixe(nom: string, prefixe: string): string | null {
  const attendus = normaliser(prefixe).split(" ").filter(Boolean);
  let reste = nom.trim();
  for (const t of attendus) {
    const m = reste.match(/^([\p{L}\p{N}]+)[\s-]*/u);
    if (!m || normaliser(m[1]) !== t) return null;
    reste = reste.slice(m[0].length);
  }
  return reste.trim() || null;
}

/** Nom du modèle, marque retirée, tel que le marchand l'écrit. */
export function modeleDeNom(nomComplet: string, marque: string): string {
  // La forme la plus longue d'abord : « Hoka One One » avant « Hoka », sans quoi il
  // resterait « One One Mach X 3 ».
  const prefixes = [...(FORMES_LONGUES[marque] ?? []), marque].sort((a, b) => b.length - a.length);
  for (const p of prefixes) {
    const reste = retirerPrefixe(nomComplet, p);
    if (reste) return reste;
  }
  return nomComplet;
}

/** Les variantes qui ne sont pas le modèle nu. */
const VARIANTES = /\b(wide|gtx|gore.?tex|w|femme|junior|kid|kids|large)\b/i;

/**
 * LE PRIX PUBLIC CONSEILLÉ, tel que le marchand l'affiche à côté de son propre prix.
 *
 * ⚠️ CETTE SOURCE VAUT MIEUX QUE LA RECHERCHE. La collecte adossée à un modèle de langage
 * rendait le prix conseillé une fois sur dix, et s'est trompée sur des valeurs
 * vérifiables (« 0 mm de drop » pour l'Adizero Adios 9). Ici, la page écrit noir sur
 * blanc « 130 € — Prix de vente conseillé par la marque », juste à côté des 78 € qu'elle
 * pratique. Même page, même instant, aucune interprétation.
 *
 * ⚠️ ET ON EXIGE LE LIBELLÉ. Prendre « le second montant de la zone » marcherait
 * aujourd'hui et casserait au premier remaniement de leur page, en silence : le
 * mensualité « 3× sans frais » y figure aussi. On ancre sur les mots « prix conseillé ».
 */
export function prixConseilleDe(html: string): number | null {
  const i = html.indexOf("prdDtl__priceZone");
  if (i < 0) return null;
  const texte = html.slice(i, i + 2000).replace(/<[^>]+>/g, " ")
    .replace(/&euro;/g, " €").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const m = texte.match(/([\d]+(?:[.,]\d+)?)\s*€\s*Prix conseill/i);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return Number.isFinite(v) && v >= 40 && v <= 400 ? v : null;
}

export type Trouvaille = { fiche: Modele; prix: number | null; dispo: boolean; url: string };

export function lireFiche(html: string, url: string, marque: string): Trouvaille | null {
  const prod = jsonProduit(html);
  if (!prod || typeof prod.name !== "string") return null;
  if (estFemme(prod, url)) return null;
  const terrain = terrainDeUrl(url);
  if (!terrain) return null;

  const nomComplet = prod.name.trim();
  const nom = modeleDeNom(nomComplet, marque);
  if (!nom || VARIANTES.test(nom)) return null;

  const c = caracteristiques(html);
  const poids = nombreDe(c.weight), drop = nombreDe(c.drop);
  const vu = new Date().toISOString().slice(0, 10);
  const mesure = <T,>(v: T | undefined) => (v == null ? undefined : { valeur: v, vu });

  const offre = prod.offers as { price?: string; availability?: string } | undefined;
  const prix = offre?.price != null && Number.isFinite(Number(offre.price)) ? Number(offre.price) : null;
  const conseille = prixConseilleDe(html);

  const slug = `${marque}-${nom}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return {
    fiche: {
      slug, marque, nom, terrain,
      poidsG: dansLesBornes("poidsG", poids) ? mesure(poids) : undefined,
      dropMm: dansLesBornes("dropMm", drop) ? mesure(drop) : undefined,
      prixConseilleEur: conseille != null ? mesure(conseille) : undefined,
      ean: typeof prod.gtin13 === "string" ? prod.gtin13 : undefined,
      nomExact: nomComplet,
      foulee: c.stability || undefined,
      sources: ["i-run.fr"],
    },
    prix,
    dispo: !/OutOfStock/i.test(String(offre?.availability ?? "")),
    url,
  };
}

async function principal(): Promise<void> {
  const filtre = process.argv[2]?.toLowerCase();
  const marques = MARQUES.filter((m) => !filtre || m.toLowerCase().includes(filtre));
  const deja: Record<string, Modele> = fs.existsSync(SORTIE) ? JSON.parse(fs.readFileSync(SORTIE, "utf8")) : {};
  const offres: Record<string, { slug: string; ean?: string; prix: number; dispo: boolean; url: string }> = {};

  let nouveaux = 0, revus = 0, ecartes = 0;
  for (const brut of marques) {
    const marque = nomMarque(brut);
    const rech = await page(`${BASE}/recherche.html?q=${encodeURIComponent(brut)}`);
    if (!rech) { console.log(`· ${marque} — recherche injoignable`); continue; }
    const fiches = [...new Set([...rech.matchAll(/href="(\/chaussures_[a-z]+\/[^"]*_fiche_\d+\.html)"/g)].map((m) => m[1].split("?")[0]))]
      .filter((u) => terrainDeUrl(u));
    console.log(`\n■ ${marque} — ${fiches.length} fiche(s) candidates`);
    await pause();

    for (const f of fiches) {
      const html = await page(BASE + f);
      if (!html) { await pause(); continue; }
      const t = lireFiche(html, f, marque);
      if (!t) { ecartes++; await pause(); continue; }
      const ancien = deja[t.fiche.slug];
      deja[t.fiche.slug] = ancien ? {
        ...ancien,
        poidsG: ancien.poidsG ?? t.fiche.poidsG, dropMm: ancien.dropMm ?? t.fiche.dropMm,
        // Le prix conseillé du marchand REMPLACE celui de la recherche : il est lu sur la
        // même page que le prix du jour, à la même seconde, sans interprétation.
        prixConseilleEur: t.fiche.prixConseilleEur ?? ancien.prixConseilleEur,
        ean: ancien.ean ?? t.fiche.ean, nomExact: ancien.nomExact ?? t.fiche.nomExact,
        foulee: ancien.foulee ?? t.fiche.foulee, terrain: t.fiche.terrain,
        sources: [...new Set([...(ancien.sources ?? []), "i-run.fr"])],
      } : t.fiche;
      if (ancien) revus++; else nouveaux++;
      if (t.prix != null && t.fiche.ean) {
        offres[t.fiche.slug] = { slug: t.fiche.slug, ean: t.fiche.ean, prix: t.prix, dispo: t.dispo, url: BASE + f };
      }
      console.log(`   ${ancien ? "·" : "+"} ${(marque + " " + t.fiche.nom).padEnd(38).slice(0, 38)} ${t.fiche.poidsG?.valeur ?? "?"} g · ${t.fiche.dropMm?.valeur ?? "?"} mm · ${t.prix ?? "?"} €${conseilleTexte(t)} ${t.dispo ? "" : "(rupture)"}`);
      fs.writeFileSync(SORTIE, JSON.stringify(deja, null, 2));
      await pause();
    }
  }
  fs.writeFileSync(path.join(process.cwd(), ".scratch/offres-irun.json"), JSON.stringify(Object.values(offres), null, 2));
  console.log(`\n${nouveaux} modèle(s) découvert(s) · ${revus} complété(s) · ${ecartes} écarté(s) (variante, femme ou hors catégorie)`);
  console.log(`${Object.keys(offres).length} prix relevés → .scratch/offres-irun.json`);
}

const conseilleTexte = (t: Trouvaille) =>
  t.fiche.prixConseilleEur ? ` (conseillé ${t.fiche.prixConseilleEur.valeur} €)` : "";

const pause = () => new Promise((r) => setTimeout(r, 1100));
if (require.main === module) void principal();
