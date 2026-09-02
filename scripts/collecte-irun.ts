/**
 * COLLECTE DES CARACTÉRISTIQUES — i-run.fr, données structurées.
 *
 *   npx tsx scripts/collecte-irun.ts            # tous les modèles manquants
 *   npx tsx scripts/collecte-irun.ts "clifton"  # un seul
 *
 * ⚠️ POURQUOI CETTE SOURCE. Les sites des marques et la plupart des marchands répondent
 * 403 à tout accès automatisé : on ne contourne pas une protection anti-robot. i-run.fr
 * publie un `robots.txt` VIDE — aucun chemin interdit — et expose des données
 * structurées : schema.org Product avec le code-barres (gtin13), et une liste de
 * caractéristiques balisée. Une requête par modèle, espacée : pas de balayage du site.
 *
 * ⚠️ CE QU'ON PREND, ET CE QU'ON NE PREND PAS.
 *   ON PREND les FAITS : nom exact, code-barres, poids, drop, surface, type de foulée.
 *     Ce sont les caractéristiques du produit du fabricant, pas la création du marchand.
 *   ON NE PREND PAS leur prix, leur texte de présentation, leurs notes (« Amorti :
 *     Excellent »), ni leurs photos. Le prix appartient à une relation commerciale qui
 *     n'existe pas encore ; le texte et les appréciations sont leur travail éditorial ;
 *     les photos appartiennent aux marques. Pacevo écrit sa propre description À PARTIR
 *     des chiffres (cf. `lib/shop/description.ts`).
 *
 * Le code-barres est la pièce maîtresse : c'est la seule clé qui permettra de recouper
 * la même paire chez plusieurs marchands le jour où un flux d'affiliation existera —
 * `product_offers.ean` l'attend déjà.
 */
import fs from "node:fs";
import path from "node:path";
import { MODELES_A_COLLECTER } from "./modeles-a-collecter";
import { dansLesBornes, type Modele } from "../src/lib/shop/modele";
import { prendreVerrou } from "../src/lib/shop/verrou";

const BASE = "https://www.i-run.fr";
const SORTIE = path.join(process.cwd(), "src/data/gear/chaussures.json");
const UA = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

/** ⚠️ Les pages sont en windows-1252 : décodées en UTF-8, les accents deviennent illisibles. */
async function page(url: string): Promise<string | null> {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (!r?.ok) return null;
  return new TextDecoder("windows-1252").decode(await r.arrayBuffer());
}

export function normaliser(v: unknown): string {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Choisit LA fiche du modèle exact.
 *
 * ⚠️ UNE RECHERCHE REND AUSSI LES VARIANTES. « Clifton 10 » ramène « Clifton 10 Wide »,
 * « Clifton 10 GTX », « Novablast 5 » ramène « Novablast 5 TR » — d'autres chaussures,
 * d'autres poids, d'autres usages. On n'accepte que l'égalité stricte du nom une fois
 * normalisé : une variante en plus, et la fiche décrit un autre produit.
 */
export function choisirFiche(liens: string[], marque: string, nom: string): string | null {
  // ⚠️ LES DEUX CATALOGUES N'ÉCRIVENT PAS LA MARQUE PAREIL. Le marchand dit « Hoka One
  // One » là où l'on dit « Hoka », « adidas » sans majuscule, « Inov-8 » sans tiret. En
  // comparant « marque + modèle » d'un bloc, AUCUNE fiche ne correspondait jamais : le
  // script tournait sans rien trouver, et l'aurait fait sur les 107 modèles. On compare
  // donc les deux séparément, en tolérant qu'un libellé de marque en contienne un autre.
  const marqueOk = (a: string, b: string) => {
    const x = normaliser(a).replace(/ /g, ""), y = normaliser(b).replace(/ /g, "");
    return x === y || x.includes(y) || y.includes(x);
  };
  const attendu = normaliser(nom);
  const candidats = liens
    .map((l) => {
      const fichier = l.split("/").pop() ?? "";
      // « Hoka-One-One-Clifton-10_Hoka-One-One_fiche_144265.html » : le segment après le
      // dernier « _ » avant « _fiche_ » porte la marque, et préfixe aussi le nom.
      const brut = fichier.replace(/_fiche_\d+\.html.*$/, "");
      const i = brut.lastIndexOf("_");
      const marqueFiche = i > 0 ? brut.slice(i + 1) : "";
      const nomFiche = normaliser((i > 0 ? brut.slice(0, i) : brut).replace(/-/g, " "));
      const sansMarque = nomFiche.startsWith(normaliser(marqueFiche))
        ? nomFiche.slice(normaliser(marqueFiche).length).trim() : nomFiche;
      // ⚠️ « M » ET « W » NE SONT PAS DEUX ORTHOGRAPHES, CE SONT DEUX CHAUSSURES. Le
      // marchand suffixe la déclinaison homme en « -M » et la femme en « -W » : « Inov-8
      // TrailFly Ultra G 280 M ». On retire le SEUL suffixe homme — c'est la déclinaison
      // dont les poids publiés correspondent à notre taille de référence. Le « W » n'est
      // pas retiré, donc son nom ne correspond plus et la fiche femme est écartée : c'est
      // la règle du nom exact qui s'en charge, sans garde-fou supplémentaire.
      //
      // ⚠️ NE PAS AJOUTER « w » ICI EN CROYANT BIEN FAIRE. Retirer les deux suffixes
      // ferait entrer la chaussure femme dans la fiche homme : poids, tailles et parfois
      // semelle diffèrent.
      const jetons = sansMarque.split(" ").filter(Boolean);
      if (jetons.at(-1) === "m") jetons.pop();
      return { lien: l, marque: marqueFiche, nom: jetons.join(" ") };
    })
    .filter((c) => c.nom === attendu && marqueOk(c.marque, marque));
  // La déclinaison homme d'abord : c'est la taille de référence des poids publiés.
  return candidats.find((c) => c.lien.includes("/chaussures_homme/"))?.lien ?? candidats[0]?.lien ?? null;
}

/** Les caractéristiques balisées, telles que la fiche les liste. */
export function caracteristiques(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/prdDtl__summary__item--([a-z_]+)[^>]*>\s*<span>[^<]*<\/span>\s*([^<]*)</g)) {
    const v = m[2].replace(/&nbsp;/g, " ").trim();
    if (v) out[m[1]] = v;
  }
  return out;
}

export function nombreDe(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const m = v.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

export function jsonProduit(html: string): Record<string, unknown> | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]) as Record<string, unknown>;
      if (j["@type"] === "Product" && typeof j.name === "string") return j;
    } catch { /* bloc illisible : on passe au suivant */ }
  }
  return null;
}

async function principal(): Promise<void> {
  prendreVerrou("collecte-irun");
  const filtre = process.argv[2]?.toLowerCase();
  const deja: Record<string, Modele> = fs.existsSync(SORTIE) ? JSON.parse(fs.readFileSync(SORTIE, "utf8")) : {};
  const liste = MODELES_A_COLLECTER.filter((m) =>
    filtre ? `${m.marque} ${m.nom}`.toLowerCase().includes(filtre) : true);
  console.log(`${liste.length} modèle(s) · ${Object.keys(deja).length} déjà en fiche\n`);

  const vu = new Date().toISOString().slice(0, 10);
  let ok = 0, absents = 0;
  for (const m of liste) {
    const rech = await page(`${BASE}/recherche.html?q=${encodeURIComponent(`${m.marque} ${m.nom}`)}`);
    if (!rech) { console.log(`  · ${m.marque} ${m.nom} — recherche injoignable`); continue; }
    const liens = [...new Set([...rech.matchAll(/href="(\/chaussures_[a-z]+\/[^"]*_fiche_\d+\.html)"/g)].map((x) => x[1]))];
    const fiche = choisirFiche(liens, m.marque, m.nom);
    if (!fiche) { absents++; console.log(`  ✗ ${m.marque} ${m.nom} — aucune fiche au nom exact`); await pause(); continue; }

    const html = await page(BASE + fiche);
    if (!html) { console.log(`  · ${m.marque} ${m.nom} — fiche injoignable`); await pause(); continue; }
    const prod = jsonProduit(html);
    const c = caracteristiques(html);
    const poids = nombreDe(c.weight), drop = nombreDe(c.drop);

    const mesure = <T,>(v: T | undefined) => (v == null ? undefined : { valeur: v, vu });
    const ancien = deja[m.slug];
    deja[m.slug] = {
      ...ancien,
      slug: m.slug, marque: m.marque, nom: m.nom, annee: m.annee, terrain: m.terrain,
      poidsG: dansLesBornes("poidsG", poids) ? mesure(poids) : ancien?.poidsG,
      dropMm: dansLesBornes("dropMm", drop) ? mesure(drop) : ancien?.dropMm,
      // Le stack et la plaque carbone ne figurent pas sur ces fiches : ils restent vides
      // ici et se complètent par la collecte adossée à la recherche (collecte-specs.ts).
      stackTalonMm: ancien?.stackTalonMm, plaqueCarbone: ancien?.plaqueCarbone,
      prixConseilleEur: ancien?.prixConseilleEur, dureeVieKm: ancien?.dureeVieKm,
      ean: typeof prod?.gtin13 === "string" ? prod.gtin13 : ancien?.ean,
      nomExact: typeof prod?.name === "string" ? prod.name : ancien?.nomExact,
      foulee: c.stability || ancien?.foulee,
      sources: [...new Set([...(ancien?.sources ?? []), "i-run.fr"])],
      sourceFabricant: ancien?.sourceFabricant,
    };
    ok++;
    console.log(`  ✓ ${(m.marque + " " + m.nom).padEnd(32)} ${poids ? poids + " g" : "poids ?"} · ${drop != null ? drop + " mm" : "drop ?"} · ${c.stability ?? "—"} · EAN ${prod?.gtin13 ?? "?"}`);
    fs.writeFileSync(SORTIE, JSON.stringify(deja, null, 2));
    await pause();
  }
  console.log(`\n${ok} fiche(s) · ${absents} modèle(s) sans fiche au nom exact`);
}

const pause = () => new Promise((r) => setTimeout(r, 1500));
if (require.main === module) void principal();
