/**
 * CRASH-TESTS DE LA BOUTIQUE.
 *
 * La boutique précédente a été retirée parce qu'elle affichait 1 167 prix INVENTÉS
 * attribués à de vraies enseignes. Ce fichier existe pour que cela ne puisse pas
 * recommencer, sous aucune forme — y compris les formes subtiles : une valeur estimée à
 * la place d'une valeur manquante, une note « pour toi » calculée sans donnée
 * personnelle, un filtre qui écarte silencieusement ce qu'il ne connaît pas.
 *
 *   npx tsx tests/boutique.crash.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { CATALOGUE, filtrer, trier, alternatives, normalise } from "../src/lib/shop/catalogue";
import { dansLesBornes, coherenceStackDrop, sourceValide, sourceCitable, sourcesCitables, domaineDe, BORNES, type Modele } from "../src/lib/shop/modele";
import { decrire, familleAmorti, familleMasse, familleDrop } from "../src/lib/shop/description";
import { usageDe } from "../src/lib/shop/usage";
import { evaluer, verdictDe, paireAremplacer, SEUIL_USURE, type ProfilAthlete } from "../src/lib/shop/pourToi";
import { partTrail, sortieLongueKm, semainesAvant, construireProfil } from "../src/lib/shop/profilAthlete";
import { meilleure, remisePourcent, estFraiche, ageEnJours, FRAICHEUR_JOURS, type Offre } from "../src/lib/shop/offres";
import { indexLeger, trouver, cotesPourGarage } from "../src/lib/shop/indexLeger";
import { SHOP, texteShop, texteFoulee } from "../src/components/shop/shopI18n";
import { choisirFiche, caracteristiques, nombreDe, normaliser } from "../scripts/collecte-irun";
import { specsDe, desaccord, choisirProduit, nomDeUrl, TOLERANCE } from "../scripts/collecte-rw";
import { prixConseilleDe, estFemme, terrainDeUrl, nomMarque, modeleDeNom, retirerPrefixe, vautLeCoup, familleDe, plaqueCarboneDe } from "../scripts/decouverte-irun";
import { fusionner, contredit } from "../scripts/collecte-specs";
import { normaliser as normaliserCatalogue, richesse } from "../scripts/normaliser-catalogue";
import { utilisables } from "../scripts/import-offres";
import { parseFeed, normalizeFeed } from "../src/lib/shop/affiliateFeed";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void): void {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  KO ${nom}`); }
}
/** Le source d'un fichier, commentaires ET imports retirés : sinon un test se contente de sa propre explication. */
function codeOf(f: string): string {
  return readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n")
    .split("\n").filter((l) => !/^\s*import\s/.test(l)).join("\n");
}

const modele = (p: Partial<Modele> = {}): Modele => ({
  slug: "x", marque: "Marque", nom: "Modèle", annee: 2025, terrain: "route", sources: ["exemple.fr"], ...p,
});
const mes = <T,>(v: T) => ({ valeur: v, vu: "2026-09-02" });

console.log("\nCATALOGUE — aucune valeur sans source ni hors du possible");

test("chaque fiche publiée porte au moins une source", () => {
  for (const m of CATALOGUE) {
    assert.ok(m.sources?.length, `${m.marque} ${m.nom} : aucune source`);
    for (const s of m.sources) assert.ok(sourceValide(s), `${m.marque} ${m.nom} : source inutilisable « ${s} »`);
  }
});

test("aucune valeur du catalogue ne sort des bornes physiques", () => {
  // ⚠️ C'est le filet qui rattrape une conversion ratée ou le prix d'un lot pris pour
  // celui d'une paire. Une valeur hors bornes doit être ABSENTE, pas rabotée.
  for (const m of CATALOGUE) {
    for (const champ of Object.keys(BORNES) as (keyof typeof BORNES)[]) {
      const v = (m[champ] as { valeur: number } | undefined)?.valeur;
      if (v == null) continue;
      assert.ok(dansLesBornes(champ, v), `${m.marque} ${m.nom} : ${champ} = ${v}, hors [${BORNES[champ].join(", ")}]`);
    }
    assert.ok(coherenceStackDrop(m.stackTalonMm?.valeur, m.dropMm?.valeur),
      `${m.marque} ${m.nom} : semelle ${m.stackTalonMm?.valeur} mm pour un drop de ${m.dropMm?.valeur} mm — l'avant-pied aurait une épaisseur négative`);
  }
});

test("les bornes rejettent, elles ne rabotent pas", () => {
  // ⚠️ LE TEST PRÉCÉDENT PORTE SUR LES DONNÉES, PAS SUR LA FONCTION. Tant que le
  // catalogue est sain, il resterait vert même si `dansLesBornes` répondait « oui » à
  // tout — vérifié par mutation. Celui-ci teste la fonction elle-même.
  assert.ok(dansLesBornes("poidsG", 250));
  assert.ok(!dansLesBornes("poidsG", 25), "25 g accepté comme poids de chaussure");
  assert.ok(!dansLesBornes("poidsG", 2500), "2,5 kg accepté comme poids de chaussure");
  assert.ok(!dansLesBornes("dropMm", 40), "40 mm accepté comme drop");
  assert.ok(!dansLesBornes("prixConseilleEur", 1290), "un prix de lot accepté comme prix d'une paire");
  assert.ok(!dansLesBornes("poidsG", Number.NaN) && !dansLesBornes("poidsG", null));
  // Et la cohérence entre deux cotes justes prises séparément.
  assert.ok(!coherenceStackDrop(6, 8), "une semelle de 6 mm avec 8 mm de drop a été acceptée");
  assert.ok(coherenceStackDrop(40, 8));
  assert.ok(coherenceStackDrop(undefined, 8), "une cote absente ne peut pas être incohérente");
});

test("les identifiants du catalogue sont uniques", () => {
  const slugs = CATALOGUE.map((m) => m.slug);
  assert.equal(slugs.length, new Set(slugs).size, "deux modèles partagent le même identifiant : l'un écraserait l'autre");
});

test("un code-barres a la forme d'un code-barres", () => {
  // Un EAN mal formé casserait silencieusement le rapprochement avec les offres : la
  // fiche dirait « aucune offre » alors que l'enseigne en a une.
  for (const m of CATALOGUE) if (m.ean) assert.match(m.ean, /^\d{8,14}$/, `${m.marque} ${m.nom} : EAN « ${m.ean} »`);
});

test("aucune image de produit n'est référencée", () => {
  // Les visuels produit appartiennent aux marques et aux marchands. Le jour où l'un
  // d'eux réapparaît dans un composant, ce test doit rougir.
  for (const f of ["src/components/shop/GearHub.tsx", "src/components/shop/SemelleProfil.tsx",
    "src/app/dashboard/shop/page.tsx", "src/app/dashboard/shop/[slug]/page.tsx"]) {
    const src = codeOf(f);
    assert.ok(!/<img\b/.test(src) && !/next\/image/.test(src), `${f} affiche une image`);
    assert.ok(!/image_url/.test(src), `${f} lit une URL d'image de marchand`);
  }
});

test("l'usage se déduit des cotes, et disparaît quand elles manquent", () => {
  // ⚠️ POURQUOI CE N'EST PLUS UN CHAMP. L'usage était saisi modèle par modèle. Dès lors
  // que les modèles sont DÉCOUVERTS automatiquement chez le marchand, il n'y a plus
  // personne pour les classer : « quotidien » par défaut serait une affirmation inventée
  // sur chaque nouvelle paire. Déduit, il est reproductible — et absent quand on ne sait
  // rien, ce qui est la seule réponse honnête.
  assert.equal(usageDe(modele()), null, "un modèle sans aucune cote s'est vu attribuer un usage");
  assert.equal(usageDe(modele({ plaqueCarbone: mes(true), poidsG: mes(210) })), "competition");
  assert.equal(usageDe(modele({ stackTalonMm: mes(42), poidsG: mes(300) })), "amorti_max");
  assert.equal(usageDe(modele({ poidsG: mes(225), stackTalonMm: mes(33) })), "tempo");
  assert.equal(usageDe(modele({ poidsG: mes(280), stackTalonMm: mes(37) })), "quotidien");
  assert.equal(usageDe(modele({ terrain: "trail", poidsG: mes(240), stackTalonMm: mes(24) })), "trail_court");
  assert.equal(usageDe(modele({ terrain: "trail", stackTalonMm: mes(33) })), "trail_long");
  assert.equal(usageDe(modele({ terrain: "trail" })), null, "un trail sans cote a été classé quand même");
});

test("un filtre d'usage n'invente pas de classement pour les modèles sans cote", () => {
  const sansCote = modele({ slug: "vide" });
  const tempo = modele({ slug: "t", poidsG: mes(220), stackTalonMm: mes(32) });
  const r = filtrer([sansCote, tempo], { usages: ["tempo"] });
  assert.deepEqual(r.map((m) => m.slug), ["t"],
    "un modèle dont l'usage est indéterminable a été rangé dans une catégorie");
});

console.log("\nPRIX — une offre, ou rien");

test("la page boutique n'affiche aucun prix hors product_offers", () => {
  const route = codeOf("src/app/dashboard/shop/[slug]/page.tsx");
  const fiche = codeOf("src/components/shop/FicheModele.tsx");
  assert.ok(/offresPour\(/.test(route), "la route ne lit pas les offres importées");
  assert.ok(/prixConseilleEur/.test(fiche) && /shop\.spec\.prix/.test(fiche),
    "le prix fabricant doit être étiqueté « conseillé », sinon il se lit comme un prix marchand");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    assert.match(SHOP[lang]["shop.spec.prix"], /conseill|recomm?end|empfehl|preisempfehlung/i,
      `${lang} : le libellé du prix fabricant ne dit pas qu'il est conseillé`);
  // Aucun montant en dur : c'est exactement ce que faisait l'ancien catalogue.
  for (const f of ["src/components/shop/FicheModele.tsx", "src/components/shop/GearHub.tsx"])
    assert.ok(!/\b\d{2,3}[.,]\d{2}\s*€/.test(codeOf(f)), `un montant est écrit en dur dans ${f}`);
});

test("un prix affiché porte toujours son marchand, sa date et son lien", () => {
  // ⚠️ C'EST CE QUI SÉPARE UN COMPARATEUR D'UNE INVENTION. L'ancienne boutique affichait
  // 1 167 prix fabriqués attribués à de vraies enseignes ; ce qui rend un prix honnête
  // n'est pas sa source mais le fait qu'on puisse aller le VÉRIFIER : chez qui, quand, et
  // sur quelle page. Un prix nu, même exact, ne se vérifie pas.
  const src = codeOf("src/components/shop/PrixOffre.tsx");
  assert.ok(/offre\.retailer/.test(src), "le nom du marchand n'accompagne pas le prix");
  assert.ok(/dateCourte\(offre\.updated_at\)/.test(src), "la date du relevé n'accompagne pas le prix");
  assert.ok(/rel="nofollow sponsored noopener noreferrer"/.test(src),
    "le lien sortant doit être en nofollow sponsored : on renvoie chez le marchand, on ne revendique pas sa page");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    assert.ok(SHOP[lang]["shop.offre.chez"]?.includes("{marchand}"), `${lang} : le marchand n'est pas nommé`);
    assert.ok(SHOP[lang]["shop.offre.releve"]?.includes("{date}"), `${lang} : la date n'est pas affichée`);
  }
});

test("une lecture d'offres en échec ne se lit pas comme « aucune offre »", () => {
  // Les deux se soldent par une liste vide : sans distinction, une panne de base
  // afficherait « aucune offre marchande » — une affirmation fausse.
  const src = codeOf("src/lib/shop/offres.ts");
  assert.ok(/throw new Error/.test(src), "une erreur PostgREST est avalée et rendue comme liste vide");
  const fiche = codeOf("src/app/dashboard/shop/[slug]/page.tsx");
  assert.ok(/offresLisibles/.test(fiche), "la fiche ne distingue pas l'échec de lecture de l'absence d'offre");
});

test("un prix périmé n'est plus « la meilleure offre »", () => {
  // ⚠️ UN TARIF RELEVÉ NE VAUT QUE QUELQUES JOURS. Sans cette borne, la page annoncerait
  // une promotion terminée depuis un mois : le lecteur clique, découvre un autre prix, et
  // ne revient pas. Un prix périmé est une information FAUSSE, pas une information vieille.
  const jours = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const o = (price: number, d: string): Offre => ({ retailer: "x", price, currency: "EUR", url: "https://x", in_stock: true, updated_at: d });
  assert.ok(estFraiche(o(100, jours(3))));
  assert.ok(!estFraiche(o(100, jours(FRAICHEUR_JOURS + 1))));
  assert.ok(!estFraiche(o(100, "")), "une date illisible ne peut pas passer pour fraîche");
  assert.equal(meilleure([o(80, jours(60)), o(120, jours(1))])?.price, 120,
    "un prix vieux de deux mois a été présenté comme la meilleure offre");
  assert.equal(meilleure([o(80, jours(60))]), null);
  assert.equal(ageEnJours("pas une date"), null);
});

test("une remise ne s'annonce qu'avec ses deux chiffres", () => {
  // Sans prix conseillé il n'y a pas de référence : afficher « −0 % », ou prendre le prix
  // le plus haut du marché comme point de départ, fabriquerait une promotion.
  assert.equal(remisePourcent(144, 160), 10);
  assert.equal(remisePourcent(144, null), null, "une remise a été calculée sans prix de référence");
  assert.equal(remisePourcent(170, 160), null, "un prix SUPÉRIEUR au conseillé a été présenté comme une remise");
  assert.equal(remisePourcent(160, 160), null, "un prix égal au conseillé n'est pas une remise");
  assert.equal(remisePourcent(0, 160), null);
});

test("les tris qui portent sur une offre laissent les modèles sans prix en dernier", () => {
  const a = modele({ slug: "a" }), b = modele({ slug: "b" }), c = modele({ slug: "c" });
  const offres = new Map([
    ["a", { prix: 120, remise: 10 }],
    ["c", { prix: 90, remise: 40 }],
  ]);
  assert.deepEqual(trier([a, b, c], "prix_bas", undefined, offres).map((m) => m.slug), ["c", "a", "b"]);
  assert.deepEqual(trier([a, b, c], "remise", undefined, offres).map((m) => m.slug), ["c", "a", "b"],
    "un modèle sans offre s'est classé parmi les meilleures remises");
  // ⚠️ ASSERTION RETIRÉE : « une offre sans remise ne prend pas la tête » passait quelle
  // que soit l'implémentation. Une remise est soit absente, soit strictement positive —
  // le cas ne peut donc pas se produire, et le test faisait croire à une protection.
});

test("la meilleure offre ignore les indisponibles et les prix illisibles", () => {
  const frais = new Date().toISOString();
  const o = (retailer: string, price: unknown, in_stock: boolean | null): Offre =>
    ({ retailer, price: price as number, currency: "EUR", url: "https://x.fr", in_stock, updated_at: frais });
  assert.equal(meilleure([o("A", 120, true), o("B", 90, false), o("C", 100, true)])?.retailer, "C",
    "une offre en rupture a été présentée comme la meilleure");
  assert.equal(meilleure([o("A", "n/c", true)]), null, "un prix illisible a été retenu");
  assert.equal(meilleure([]), null);
});

test("un vrai flux d'affiliation produit des offres exploitables", () => {
  // ⚠️ CE QUI DÉBLOQUE LES PRIX. Le comparateur n'affiche aucun prix marchand tant que
  // `product_offers` est vide, et la table ne se remplit que par cet import. Vérifié
  // bout en bout le 02/09/2026 avec les colonnes usuelles d'un flux Awin : lecture,
  // normalisation, écriture en base, relecture, puis recoupement PAR CODE-BARRES avec
  // une fiche du catalogue — l'offre est bien retrouvée. Ce test fige la partie qui ne
  // dépend pas de la base.
  const csv = [
    "aw_product_id,product_name,brand_name,merchant_name,search_price,currency,aw_deep_link,merchant_image_url,in_stock,category_name,ean",
    '123456,"Hoka Clifton 10",Hoka,"i-Run",129.99,EUR,https://www.awin1.com/cread.php?awinmid=1&p=x,https://img/x.jpg,1,"Chaussures running",198605659287',
    '123457,"Salomon Speedcross 6",Salomon,"i-Run",109.00,EUR,https://www.awin1.com/cread.php?awinmid=1&p=y,https://img/y.jpg,0,"Chaussures trail",198720097537',
    '999999,"Ligne sans prix",Nike,"i-Run",,EUR,https://x,,1,,',
  ].join("\n");
  const offres = normalizeFeed(parseFeed(csv), "i-Run");
  assert.equal(offres.length, 2, "une ligne sans prix exploitable doit être écartée, pas importée à 0 €");
  assert.equal(offres[0].ean, "198605659287", "le code-barres n'est pas repris : le recoupement serait impossible");
  assert.equal(offres[0].price, 129.99);
  assert.equal(offres[1].inStock, false, "une rupture de stock est devenue une disponibilité");
  assert.ok(offres.every((o) => o.url.startsWith("http")), "une offre sans lien marchand n'est pas une offre");
  // Le code-barres du flux doit correspondre à ceux du catalogue, sinon rien ne se recoupe.
  assert.ok(CATALOGUE.some((m) => m.ean === offres[0].ean),
    "aucun modèle du catalogue ne porte ce code-barres : le rapprochement flux ↔ fiche ne marcherait pas");
});

console.log("\nFILTRES ET TRI — l'inconnu n'est pas une valeur");

test("un filtre n'écarte jamais une fiche pour cause de donnée manquante", () => {
  // ⚠️ « Moins de 250 g » ne veut pas dire « et tant pis pour celles dont le poids n'est
  // pas publié » : l'athlète en déduirait qu'elles pèsent plus lourd.
  const connu = modele({ slug: "a", poidsG: mes(230) });
  const inconnu = modele({ slug: "b" });
  const r = filtrer([connu, inconnu], { poidsMax: 250 });
  assert.equal(r.length, 2, "une fiche sans poids a été écartée par un filtre de poids");
  assert.equal(filtrer([modele({ slug: "c", poidsG: mes(300) }), inconnu], { poidsMax: 250 }).length, 1,
    "le filtre ne retient plus rien : il ne filtre plus");
});

test("le filtre « plaque carbone » écarte l'inconnu, et le dit à l'écran", () => {
  const avec = modele({ slug: "a", plaqueCarbone: mes(true) });
  const inconnu = modele({ slug: "b" });
  assert.equal(filtrer([avec, inconnu], { plaqueCarbone: true }).length, 1);
  // L'avertissement est un texte traduit : on vérifie qu'il est RENDU (la clé est
  // appelée dans l'écran) ET qu'il existe dans les cinq langues, pas sa formulation
  // française — sinon le test tomberait à la première reformulation.
  assert.ok(/tx\("shop\.plaque_avert"\)/.test(readFileSync("src/components/shop/GearHub.tsx", "utf8")),
    "l'écran n'avertit pas que ce filtre écarte les modèles inconnus");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    assert.ok(SHOP[lang]["shop.plaque_avert"], `avertissement absent en ${lang}`);
});

test("une fiche sans la valeur de tri part EN DERNIER, jamais en tête", () => {
  const a = modele({ slug: "a", poidsG: mes(300) });
  const b = modele({ slug: "b" });
  const c = modele({ slug: "c", poidsG: mes(200) });
  assert.deepEqual(trier([a, b, c], "poids").map((m) => m.slug), ["c", "a", "b"],
    "un modèle au poids inconnu s'est classé comme le plus léger");
});

test("la recherche ignore accents et casse", () => {
  assert.equal(normalise("Hoka Cliftôn"), "hoka clifton");
  assert.equal(filtrer([modele({ marque: "Hoka", nom: "Clifton 10" })], { q: "hoka clif" }).length, 1);
  assert.equal(filtrer([modele({ marque: "Hoka", nom: "Clifton 10" })], { q: "asics" }).length, 0);
});

test("une alternative n'est proposée que si elle est comparable", () => {
  // Deux fiches vides auraient une « distance » nulle et arriveraient en tête des
  // alternatives, alors qu'on ignore tout d'elles.
  const ref = modele({ slug: "ref", poidsG: mes(250), dropMm: mes(8) });
  const vide = modele({ slug: "vide" });
  const proche = modele({ slug: "proche", poidsG: mes(255), dropMm: mes(8) });
  const r = alternatives(ref, [ref, vide, proche]);
  assert.deepEqual(r.map((m) => m.slug), ["proche"], "une fiche sans aucune cote a été proposée comme alternative");
});

console.log("\nDESCRIPTION — pas de valeur, pas de phrase");

/** Le texte rendu d'une description, dans une langue donnée. */
function texteDe(m: Parameters<typeof decrire>[0], lang = "fr"): string {
  return decrire(m).bouts.map((b) => texteShop(lang, b.cle, b.params
    ? Object.fromEntries(Object.entries(b.params).map(([k, v]) =>
      [k, typeof v === "string" && v.startsWith("shop.") ? texteShop(lang, v) : v]))
    : undefined)).join(" ");
}

test("la description n'invente aucune phrase sur une donnée absente", () => {
  const { bouts, manquantes } = decrire(modele());
  // Deux bouts seulement : l'identité et le terrain, qui ne dépendent d'aucune mesure.
  assert.equal(bouts.length, 2, "une chaussure sans aucune cote produit plus que son identité");
  assert.ok(manquantes.includes("shop.spec.poids") && manquantes.includes("shop.spec.drop"),
    "les données absentes ne sont pas listées");
  const texte = texteDe(modele());
  assert.ok(!/\d+\s?(g|mm|km)\b/.test(texte), `un nombre apparaît sans donnée pour l'étayer : ${texte}`);
});

test("chaque nombre du texte vient de la fiche", () => {
  const m = modele({ poidsG: mes(238), dropMm: mes(6), stackTalonMm: mes(39), dureeVieKm: mes(700) });
  const texte = texteDe(m);
  const permis = new Set(["238", "6", "39", "700", "8", "10", "200", "300", "40"]); // repères cités dans les phrases
  for (const n of texte.match(/\b\d+\b/g) ?? [])
    assert.ok(permis.has(n), `le texte cite « ${n} », qui ne vient pas de la fiche : ${texte}`);
  assert.ok(!texte.includes("{"), `un paramètre n'a pas été remplacé : ${texte}`);
});

test("aucune clé produite ne manque à une des cinq langues", () => {
  // ⚠️ SANS CE TEST, UNE PHRASE MANQUANTE S'AFFICHE EN FRANÇAIS SANS RIEN SIGNALER. Le
  // contrôle d'i18n général n'inspecte que les fichiers `.tsx` : les phrases produites
  // par les moteurs lui échappent entièrement.
  const cles = new Set<string>();
  const profils: ProfilAthlete[] = [
    {}, { partTrail: 0.8, volumeHebdoKm: 70, vma: 18, objectifKm: 45, semainesAvantCourse: 6, dropsEnRotation: [10],
      rotation: [{ marque: "A", modele: "B", km: 500, maxKm: 550 }, { marque: "C", modele: "D", km: 540, maxKm: 560 }] },
    { partTrail: 0.05, volumeHebdoKm: 20, vma: 12, objectifKm: 10, semainesAvantCourse: 30, dropsEnRotation: [4],
      rotation: [{ marque: "A", modele: "B", km: 500, maxKm: 550 }] },
  ];
  for (const terrain of ["route", "trail"] as const)
    for (const stack of [undefined, mes(22), mes(45)])
        for (const plaque of [undefined, mes(true), mes(false)]) {
          const m = modele({ terrain, stackTalonMm: stack, plaqueCarbone: plaque, poidsG: mes(240), dropMm: mes(6), dureeVieKm: mes(700) });
          for (const b of decrire(m).bouts) cles.add(b.cle);
          for (const x of decrire(m).manquantes) cles.add(x);
          for (const p of profils) {
            const a = evaluer(m, p);
            cles.add(a.verdict);
            // La carte affiche une variante COURTE du verdict : sans elle, le libellé
            // renverrait à des « réserves ci-dessous » qui n'existent pas sur une carte.
            cles.add(a.verdict.replace("shop.v.", "shop.vc."));
            for (const b of [...a.pour, ...a.contre, ...a.inconnu]) cles.add(b.cle);
          }
        }
  assert.ok(cles.size > 30, `couverture trop faible : ${cles.size} clés explorées`);
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const absentes = [...cles].filter((k) => !(k in SHOP[lang]));
    assert.equal(absentes.length, 0, `${lang} : ${absentes.length} clé(s) absente(s) — ${absentes.slice(0, 5).join(", ")}`);
  }
});

test("aucun texte des cinq langues ne laisse un paramètre non rempli", () => {
  // Un « {km} » à l'écran est le signe qu'une langue a été traduite sans son paramètre.
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    for (const [cle, valeur] of Object.entries(SHOP[lang])) {
      const attendus = [...(SHOP.fr[cle] ?? "").matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(",");
      const trouves = [...valeur.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(",");
      assert.equal(trouves, attendus, `${lang} « ${cle} » : paramètres ${trouves || "aucun"} au lieu de ${attendus || "aucun"}`);
    }
});

test("une semelle au-dessus de 40 mm n'est pas annoncée homologuée en compétition", () => {
  // ⚠️ VU À L'ÉCRAN : « la semelle atteint la limite autorisée » sur la Clifton 10, dont
  // les 42 mm DÉPASSENT le plafond de 40 mm de World Athletics. Laisser croire qu'une
  // chaussure est homologuée alors qu'elle ne l'est pas peut coûter une disqualification.
  const m = modele({ stackTalonMm: mes(42), dropMm: mes(8), poidsG: mes(260) });
  const bout = decrire(m).bouts.find((b) => b.cle === "shop.d.amorti.maximal");
  assert.ok(bout, "une semelle de 42 mm n'est pas classée en amorti maximal");
  assert.equal(bout!.params?.stack, 42, "la hauteur réelle n'accompagne pas la phrase");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const t = texteShop(lang, "shop.d.amorti.maximal", { stack: 42 });
    assert.ok(t.includes("40"), `${lang} : le plafond de 40 mm n'est pas cité`);
    assert.ok(t.includes("42"), `${lang} : la hauteur du modèle n'est pas citée`);
  }
});

test("les familles d'amorti et de masse suivent des seuils, pas des impressions", () => {
  assert.equal(familleAmorti(undefined), null);
  assert.equal(familleAmorti(22), "fin");
  assert.equal(familleAmorti(30), "modere");
  assert.equal(familleAmorti(38), "genereux");
  assert.equal(familleAmorti(44), "maximal");
  assert.equal(familleMasse(undefined), null);
  assert.equal(familleMasse(190), "plume");
  assert.equal(familleMasse(320), "lourde");
});

test("le drop est expliqué par ce qu'il change, pas par un adjectif", () => {
  assert.equal(familleDrop(4), "bas");
  assert.equal(familleDrop(6), "intermediaire");
  assert.equal(familleDrop(8), "courant");
  assert.equal(familleDrop(11), "haut");
  assert.match(texteShop("fr", "shop.d.drop.bas", { drop: 4 }), /mollet|Achille/i);
  assert.match(texteShop("fr", "shop.d.drop.haut", { drop: 11 }), /genou/i);
});

console.log("\nAVIS PERSONNEL — sans donnée, pas de conseil personnel");

test("un athlète sans historique reçoit un avis qui se dit incomplet", () => {
  const a = evaluer(modele({ plaqueCarbone: mes(true) }), {});
  assert.ok(a.inconnu.length >= 3, "aucun manque n'est signalé alors qu'on ne sait rien de l'athlète");
  assert.ok(a.verdict === "shop.v.partiel" || a.verdict === "shop.v.rien", `verdict trompeur sur un profil vide : « ${a.verdict} »`);
});

test("une plaque carbone est déconseillée quand la VMA ne la rentabilise pas", () => {
  // La plaque travaille par flexion : sous ~15 km/h de VMA elle rigidifie le pied sans
  // rendre l'économie de course qu'elle promet. Ce n'est pas un jugement, c'est mécanique.
  const p: ProfilAthlete = { vma: 12.5, partTrail: 0.1, volumeHebdoKm: 30, objectifKm: 10, semainesAvantCourse: 8, dropsEnRotation: [8] };
  const lente = evaluer(modele({ plaqueCarbone: mes(true) }), p);
  assert.ok(lente.contre.some((x) => x.cle === "shop.a.plaque_ko"), "aucune réserve sur la plaque à 12,5 km/h de VMA");
  const rapide = evaluer(modele({ plaqueCarbone: mes(true) }), { ...p, vma: 18 });
  assert.ok(rapide.pour.some((x) => x.cle === "shop.a.plaque_ok"), "aucun argument pour la plaque à 18 km/h de VMA");
  assert.ok(rapide.score > lente.score, "la VMA ne change rien au score : le conseil n'est pas personnalisé");
});

test("une chaussure de trail est déconseillée à qui court sur route", () => {
  const route: ProfilAthlete = { partTrail: 0.05, volumeHebdoKm: 40 };
  const a = evaluer(modele({ terrain: "trail", poidsG: mes(240), stackTalonMm: mes(24) }), route);
  assert.ok(a.contre.some((x) => x.cle === "shop.a.trail_ko"));
  assert.ok(evaluer(modele({ terrain: "trail" }), { partTrail: 0.8 }).score > a.score);
});

test("un écart de drop important est signalé comme une transition à gérer", () => {
  const a = evaluer(modele({ dropMm: mes(4) }), { dropsEnRotation: [10, 10] });
  assert.ok(a.contre.some((x) => x.cle === "shop.a.drop_ecart"), "aucun avertissement sur 6 mm d'écart de drop");
  assert.ok(evaluer(modele({ dropMm: mes(9) }), { dropsEnRotation: [10, 10] }).contre.every((x) => x.cle !== "shop.a.drop_ecart"));
});

test("le verdict dépend de ce qu'on sait, pas seulement du score", () => {
  assert.equal(verdictDe(90, 4, 2, 0), "shop.v.partiel", "un score élevé sur quatre inconnues se présente comme un conseil sûr");
  assert.equal(verdictDe(90, 0, 3, 0), "shop.v.bien");
  assert.equal(verdictDe(20, 0, 0, 3), "shop.v.eviter");
});

console.log("\nPROFIL ATHLÈTE — mesuré, jamais supposé");

test("aucun champ du profil n'est rempli par défaut", () => {
  // ⚠️ C'est le défaut de l'amorce `ctl = 40` du tableau de bord, transposé : une valeur
  // « en attendant » produit un conseil qui a l'air personnel et ne l'est pas.
  const p = construireProfil({ seances: [], paires: [] });
  for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) { assert.equal(v.length, 0, `${k} n'est pas vide sur un compte vierge`); continue; }
    assert.equal(v, null, `${k} vaut ${v} alors qu'aucune donnée ne le justifie`);
  }
});

test("la part de trail se déduit du dénivelé, pas du seul libellé de la montre", () => {
  // Beaucoup de montres enregistrent un trail en « run » : se fier au sport seul
  // classerait un coureur de montagne comme routier.
  const s = (d: number, km: number) => ({ date: "2026-08-01", distance_km: km, sport: "run", elevation_gain_m: d });
  assert.equal(partTrail([s(600, 12), s(500, 10), s(700, 14), s(10, 10), s(5, 8)]), 3 / 5);
  assert.equal(partTrail([s(600, 12)]), null, "un échantillon de une sortie a produit une part de trail");
  assert.equal(partTrail([{ date: "2026-08-01", distance_km: 10, sport: "run" }, { date: "2026-08-02", distance_km: 10, sport: "run" },
    { date: "2026-08-03", distance_km: 10, sport: "run" }, { date: "2026-08-04", distance_km: 10, sport: "run" },
    { date: "2026-08-05", distance_km: 10, sport: "run" }]), null,
    "sans dénivelé, des sorties ont quand même été classées");
});

test("une course passée ne produit pas un compte à rebours", () => {
  const now = new Date("2026-09-02T12:00:00Z");
  assert.equal(semainesAvant("2026-10-04", now), 4);
  assert.equal(semainesAvant("2026-08-01", now), null, "une course passée reste comptée comme à venir");
  assert.equal(semainesAvant("date bidon", now), null);
});

test("la sortie longue se lit sur la fenêtre demandée, pas sur tout l'historique", () => {
  const now = Date.now();
  const j = (n: number) => new Date(now - n * 86400000).toISOString().slice(0, 10);
  const s = [{ date: j(10), distance_km: 22, sport: "run" }, { date: j(300), distance_km: 42, sport: "run" }];
  assert.equal(sortieLongueKm(s), 22, "une sortie vieille de dix mois a été présentée comme la sortie longue actuelle");
});

test("le vélo ne compte pas comme une sortie de course à pied", () => {
  const p = construireProfil({
    seances: [{ date: new Date().toISOString().slice(0, 10), distance_km: 90, sport: "bike" }], paires: [],
  });
  assert.equal(p.sortieLongueKm, null, "90 km de vélo sont devenus une sortie longue à pied");
});

console.log("\nCOLLECTE — la fiche décrite doit être LA bonne");

test("une variante n'est jamais prise pour le modèle", () => {
  // ⚠️ « Clifton 10 » ramène « Clifton 10 Wide » et « Clifton 10 GTX » : d'autres
  // chaussures, d'autres poids. Même leçon que sur le catalogue de courses, où « Kids
  // trail d'Antibes » avait failli hériter du 40 km de l'épreuve adulte.
  const liens = [
    "/chaussures_homme/Running_c23/Hoka-One-One_m143/Hoka-One-One-Clifton-10-Wide_Hoka-One-One_fiche_1.html",
    "/chaussures_homme/Running_c23/Hoka-One-One_m143/Hoka-One-One-Clifton-10_Hoka-One-One_fiche_2.html",
  ];
  assert.match(choisirFiche(liens, "Hoka", "Clifton 10")!, /fiche_2/);
  assert.equal(choisirFiche([liens[0]], "Hoka", "Clifton 10"), null, "la variante Wide a été acceptée");
});

test("la déclinaison FEMME n'alimente pas la fiche homme", () => {
  // Le marchand suffixe « -M » et « -W ». Le poids publié n'est pas le même.
  const w = "/chaussures_femme/Trail_c15/Inov-8_m1/Inov-8-TrailFly-Ultra-G-280-W_Inov-8_fiche_1.html";
  const h = "/chaussures_homme/Trail_c15/Inov-8_m1/Inov-8-TrailFly-Ultra-G-280-M_Inov-8_fiche_2.html";
  assert.equal(choisirFiche([w], "Inov-8", "Trailfly Ultra G 280"), null, "la déclinaison femme a alimenté la fiche");
  assert.match(choisirFiche([w, h], "Inov-8", "Trailfly Ultra G 280")!, /fiche_2/);
});

test("les libellés de marque divergents ne bloquent pas l'appariement", () => {
  // Le marchand dit « Hoka One One » là où l'on dit « Hoka » : comparés d'un bloc,
  // AUCUN modèle ne correspondait — le script tournait sans rien trouver.
  const l = "/chaussures_homme/Running_c23/Hoka-One-One_m143/Hoka-One-One-Clifton-10_Hoka-One-One_fiche_1.html";
  assert.ok(choisirFiche([l], "Hoka", "Clifton 10"));
  assert.equal(choisirFiche([l], "Asics", "Clifton 10"), null, "une marque étrangère a été acceptée");
  assert.equal(normaliser("Inov-8"), "inov 8");
});

test("les caractéristiques se lisent dans le balisage, pas dans la prose", () => {
  const html = `<li class="prdDtl__summary__item prdDtl__summary__item--drop "> <span>Drop :</span> 5 mm </li>
    <li class="prdDtl__summary__item prdDtl__summary__item--weight last"> <span>Poids :</span>255g </li>`;
  const c = caracteristiques(html);
  assert.equal(nombreDe(c.drop), 5);
  assert.equal(nombreDe(c.weight), 255);
  assert.equal(nombreDe(undefined), undefined);
  assert.equal(nombreDe("non communiqué"), undefined);
});

test("les deux balisages de la seconde source sont lus", () => {
  // ⚠️ DEUX BALISAGES COEXISTENT SUR LE MÊME SITE : liste pour les modèles récents,
  // tableau pour les anciens. Un lecteur qui n'en connaît qu'un rend un objet vide sans
  // erreur — la Clifton 10 était « sans hauteur publiée » alors que la page l'affichait.
  const tableau = `<td>Weight:</td><td>9.1 oz<br />258 g</td><td>Heel Stack:</td><td>43 mm</td><td>Forefoot Stack:</td><td>35 mm</td><td>Heel-Toe Offset:</td><td>8 mm</td>`;
  const liste = `<li><strong>Weight: </strong>9.2 oz | 261 g</li><li><strong>Heel Stack: </strong>43 mm</li><li><strong>Forefoot Stack: </strong>35 mm</li><li><strong>Heel-Toe Offset:</strong> 8 mm</li>`;
  for (const [nom, html] of [["tableau", tableau], ["liste", liste]] as const) {
    const r = specsDe(html);
    assert.equal(r.stackTalonMm, 43, `${nom} : hauteur de talon non lue`);
    assert.equal(r.dropMm, 8, `${nom} : drop non lu`);
    assert.ok(r.poidsG === 258 || r.poidsG === 261, `${nom} : le poids en ONCES a été pris pour des grammes (${r.poidsG})`);
  }
});

test("un champ absent ne prend pas la valeur du champ suivant", () => {
  // Sans la borne au libellé suivant, « Heel Stack » vide aurait pris les 35 mm de
  // « Forefoot Stack » : une hauteur de talon fausse, sans la moindre alerte.
  const r = specsDe(`<li><strong>Weight: </strong>261 g</li><li><strong>Heel Stack: </strong>non publié</li><li><strong>Forefoot Stack: </strong>35 mm</li>`);
  assert.equal(r.stackTalonMm, undefined, "la hauteur de talon a été prise sur le champ voisin");
  assert.equal(r.stackAvantMm, 35);
});

test("le contrôle croisé porte sur le drop, pas sur le poids", () => {
  // ⚠️ MESURÉ SUR SEPT MODÈLES : les deux sources donnent des poids écartés de 22 à 38 g
  // pour la même chaussure, parce qu'aucune ne publie la pointure de référence. Rejeter
  // là-dessus écartait des appariements JUSTES. Le drop, lui, est une cote de conception.
  const m = modele({ poidsG: mes(245), dropMm: mes(4) });
  assert.equal(desaccord(m, { poidsG: 283, dropMm: 4 }), null, "un écart de poids a rejeté un appariement juste");
  assert.ok(desaccord(m, { poidsG: 246, dropMm: 8 }), "un drop de 8 mm face à 4 mm n'a pas été rejeté");
  assert.equal(desaccord(undefined, { dropMm: 8 }), null);
  assert.ok(TOLERANCE.dropMm <= 1, "la tolérance de drop doit rester serrée : c'est le seul contrôle d'identité");
});

test("une variante n'est pas prise pour le modèle chez la seconde source non plus", () => {
  const urls = [
    "https://x/HOKA_Clifton_11_Wide/descpage-A.html",
    "https://x/HOKA_Clifton_11/descpage-B.html",
    "https://x/HOKA_Clifton_11_GTX/descpage-C.html",
  ];
  assert.match(choisirProduit(urls, "Hoka", "Clifton 11")!, /descpage-B/);
  assert.equal(choisirProduit([urls[0], urls[2]], "Hoka", "Clifton 11"), null, "une variante a été acceptée");
  assert.equal(choisirProduit(["https://x/HOKA_Clifton_11_Womens/descpage-D.html"], "Hoka", "Clifton 11"), null,
    "la déclinaison femme a été acceptée");
  assert.equal(nomDeUrl("https://x/HOKA_Clifton_11/descpage-B.html"), "hoka clifton 11");
});

test("un écart de poids entre sources est AFFICHÉ, pas tranché en silence", () => {
  const fiche = readFileSync("src/components/shop/FicheModele.tsx", "utf8");
  assert.ok(/poidsG\?\.autre/.test(fiche), "la fiche ne signale pas qu'une autre source donne un autre poids");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    assert.ok(SHOP[lang]["shop.poids_ecart"]?.includes("{autre}"), `${lang} : la note d'écart n'affiche pas l'autre valeur`);
});

test("un refus de la source arrête la collecte au lieu d'insister", () => {
  // ⚠️ APRÈS ~90 REQUÊTES, la source a répondu 406 sur les fiches produit alors que son
  // accueil répondait 200 : c'est une limite de débit, donc un « non ». Le premier jet le
  // traitait comme une panne et enchaînait les quarante suivantes.
  const src = codeOf("scripts/collecte-rw.ts");
  assert.ok(/406/.test(src) && /429/.test(src), "les codes de refus ne sont pas reconnus");
  assert.ok(/class Refus/.test(src) && /instanceof Refus/.test(src), "le refus n'interrompt pas la boucle");
});

test("deux collectes s'additionnent, elles ne s'écrasent pas", () => {
  // ⚠️ DÉGÂT CONSTATÉ SUR LA HOKA BONDI 9. La collecte adossée à la recherche
  // reconstruisait la fiche à partir de zéro et l'écrivait par-dessus l'existante : la
  // chaussure a perdu d'un coup son CODE-BARRES, son nom commercial exact et son type de
  // foulée — trois données qui ne viennent QUE du marchand. Le code-barres est la seule
  // clé qui permettra de recouper la même paire chez plusieurs enseignes.
  const ancien = modele({ poidsG: mes(284), ean: "198605552670", foulee: "Neutre", nomExact: "Hoka Bondi 9", sources: ["i-run.fr"] });
  const neuf = modele({ poidsG: mes(290), stackTalonMm: mes(43), prixConseilleEur: mes(180), sources: ["rei.com"] });
  const f = fusionner(ancien, neuf);
  assert.equal(f.ean, "198605552670", "le code-barres a été perdu");
  assert.equal(f.foulee, "Neutre", "le type de foulée a été perdu");
  assert.equal(f.nomExact, "Hoka Bondi 9");
  assert.equal(f.poidsG?.valeur, 284, "la valeur relevée dans un champ structuré doit primer sur une recherche");
  assert.equal(f.stackTalonMm?.valeur, 43, "la cote manquante n'a pas été complétée");
  assert.deepEqual(f.sources, ["i-run.fr", "rei.com"], "les sources doivent s'additionner");
  // Et une première collecte sur une fiche inexistante reste possible.
  assert.equal(fusionner(undefined, neuf).stackTalonMm?.valeur, 43);

  // ⚠️ ET LE SCRIPT DOIT L'APPELER. Tester la fonction seule laisse passer le vrai
  // défaut : c'est l'ÉCRITURE qui écrasait, pas la fusion. Vérifié par mutation —
  // remplacer l'appel par une affectation directe ne faisait rougir aucun test.
  const src = codeOf("scripts/collecte-specs.ts");
  assert.ok(/deja\[m\.slug\] = fusionner\(deja\[m\.slug\], fiche\)/.test(src),
    "la collecte écrit la fiche sans la fusionner avec l'existante");
});

test("une réponse qui se trompe sur une valeur vérifiable est rejetée en entier", () => {
  // ⚠️ MESURÉ : pour l'« Adizero Adios 9 », la recherche a rendu « 0 mm de drop » alors
  // que deux marchands s'accordent sur 7 mm. Or c'est CETTE source qui fournit la hauteur
  // de semelle, la plaque carbone et le prix conseillé — trois valeurs qu'aucune fiche
  // marchande ne publie et que personne ne peut donc recouper. Se tromper sur ce qui se
  // vérifie disqualifie ce qui ne se vérifie pas.
  const connu = modele({ dropMm: mes(7), poidsG: mes(215) });
  assert.ok(contredit(connu, modele({ dropMm: mes(0) })), "un drop de 0 mm face à 7 mm a été accepté");
  assert.ok(contredit(connu, modele({ poidsG: mes(120) })), "un poids écarté de 95 g a été accepté");
  assert.equal(contredit(connu, modele({ dropMm: mes(7), poidsG: mes(235) })), null,
    "vingt grammes d'écart suffisaient à rejeter : la pointure de référence n'est jamais publiée");
  assert.equal(contredit(undefined, modele({ dropMm: mes(0) })), null,
    "sans fiche existante il n'y a rien à contredire — la première collecte doit passer");
  // Et le script doit APPELER ce contrôle, pas seulement le déclarer.
  const src = codeOf("scripts/collecte-specs.ts");
  assert.ok(/contredit\(deja\[m\.slug\], fiche\)/.test(src), "la collecte n'applique pas le contrôle croisé");
});

test("le prix conseillé s'ancre sur son libellé, pas sur sa position", () => {
  // ⚠️ « LE SECOND MONTANT DE LA ZONE » MARCHERAIT AUJOURD'HUI ET CASSERAIT DEMAIN, EN
  // SILENCE : la zone contient aussi la mensualité « 3× sans frais ». On exige les mots
  // « prix conseillé », que la page écrit noir sur blanc à côté du prix pratiqué.
  assert.equal(prixConseilleDe(`<div class="prdDtl__priceZone"><span>78&euro;</span><span>Vous économisez 40%</span><span>130&euro;</span>&nbsp;Prix conseillé</div>`), 130);
  assert.equal(prixConseilleDe(`<div class="prdDtl__priceZone"><span>190&euro;</span><span>2X sans frais : 95&euro;</span></div>`), null,
    "une mensualité a été prise pour un prix conseillé");
  assert.equal(prixConseilleDe("<p>130&euro; Prix conseillé</p>"), null, "un montant hors de la zone de prix a été retenu");
  assert.equal(prixConseilleDe(`<div class="prdDtl__priceZone">78&euro; 1300&euro; Prix conseillé</div>`), null,
    "un prix aberrant n'a pas été écarté");
});

test("la déclinaison femme n'entre pas au catalogue par le chemin d'URL", () => {
  // ⚠️ VÉRIFIÉ : la fiche 144265 est servie sous `/chaussures_homme/` alors que son
  // JSON-LD annonce « Chaussures de sport femme Running ». Se fier au chemin ferait
  // entrer des poids et des cotes de la version femme sous l'étiquette homme.
  const femme = { offers: { category: "Chaussures de sport femme Running" } } as Record<string, unknown>;
  const homme = { offers: { category: "Chaussures de sport homme Running" } } as Record<string, unknown>;
  assert.equal(estFemme(femme, "/chaussures_homme/Running_c23/x_fiche_1.html"), true,
    "la catégorie déclarée doit primer sur le chemin");
  assert.equal(estFemme(homme, "/chaussures_femme/Running_c24/x_fiche_1.html"), false);
  // Sans catégorie déclarée, le chemin sert de repli — faute de mieux.
  assert.equal(estFemme({}, "/chaussures_femme/Running_c24/x_fiche_1.html"), true);
});

test("le terrain vient de la catégorie du marchand, pas d'un jugement", () => {
  assert.equal(terrainDeUrl("/chaussures_homme/Trail_c15/x_fiche_1.html"), "trail");
  assert.equal(terrainDeUrl("/chaussures_homme/Running_c23/x_fiche_1.html"), "route");
  assert.equal(terrainDeUrl("/chaussures_homme/Randonnee_c1136/x_fiche_1.html"), null,
    "une chaussure de randonnée est entrée dans un catalogue de course à pied");
  assert.equal(terrainDeUrl("/chaussures_homme/Athletisme_c48/x_fiche_1.html"), null);
});

test("retirer la marque d'un nom respecte la ponctuation du marchand", () => {
  // ⚠️ HUIT MODÈLES EN DOUBLE EN BASE. Le marchand écrit « On-Running Cloudmonster
  // Hyper » : un seul mot pour un découpage sur les espaces, DEUX une fois normalisé.
  // Retirer « deux mots » du libellé d'origine emportait « On-Running » ET
  // « Cloudmonster », et le modèle entrait sous le nom « Hyper » — en plus de l'entrée
  // correcte, avec le même code-barres.
  assert.equal(modeleDeNom("On-Running Cloudmonster Hyper", "On"), "Cloudmonster Hyper");
  assert.equal(modeleDeNom("On-Running Cloudflow 5", "On"), "Cloudflow 5");
  // La forme longue de la marque passe avant la courte, sinon il reste « One One ».
  assert.equal(modeleDeNom("Hoka One One Mach X 3", "Hoka"), "Mach X 3");
  assert.equal(modeleDeNom("Topo Athletic Ultraventure 4", "Topo"), "Ultraventure 4");
  // Et les traits d'union INTERNES au nom du modèle sont préservés.
  assert.equal(modeleDeNom("Asics Gel-Nimbus 28", "Asics"), "Gel-Nimbus 28");
  // Un nom qui ne commence pas par la marque est rendu tel quel plutôt que tronqué.
  assert.equal(modeleDeNom("Speedcross 6", "Salomon"), "Speedcross 6");
  assert.equal(retirerPrefixe("Speedcross 6", "Salomon"), null);
});

test("aucun modèle du catalogue ne partage son code-barres", () => {
  // Deux entrées pour un code-barres, c'est le même produit compté deux fois : le
  // compteur d'offres mentait (133 modèles pour 128 offres) et l'athlète voyait la même
  // chaussure deux fois, dont une sous un nom tronqué.
  const par = new Map<string, string[]>();
  for (const m of CATALOGUE) if (m.ean) par.set(m.ean, [...(par.get(m.ean) ?? []), `${m.marque} ${m.nom}`]);
  const doublons = [...par.entries()].filter(([, l]) => l.length > 1);
  assert.equal(doublons.length, 0, `code(s)-barres partagé(s) : ${doublons.map(([e, l]) => `${e} → ${l.join(" / ")}`).join(" ; ")}`);
});

test("aucun nom de modèle ne commence par un résidu de marque", () => {
  for (const m of CATALOGUE)
    assert.ok(!/^(One One|Running|Athletic)\b/.test(m.nom),
      `« ${m.marque} ${m.nom} » garde un morceau de la forme longue de sa marque`);
});

test("une fiche sans intérêt n'est pas téléchargée pour rien", () => {
  // ⚠️ 144 FICHES SUR 300 ÉTAIENT ÉCARTÉES APRÈS TÉLÉCHARGEMENT — variantes larges,
  // Gore-Tex, déclinaisons femme. Le nom du produit figure déjà dans l'URL. Avec la
  // recherche élargie, qui multiplie les candidates, ce gaspillage n'est tenable ni pour
  // nous ni pour le serveur d'en face.
  const h = "/chaussures_homme/Running_c23/Hoka-One-One_m143/";
  assert.ok(vautLeCoup(h + "Hoka-One-One-Clifton-10_Hoka-One-One_fiche_1.html"));
  assert.ok(!vautLeCoup(h + "Hoka-One-One-Clifton-10-Wide_Hoka-One-One_fiche_2.html"), "une variante large a été téléchargée");
  assert.ok(!vautLeCoup("/chaussures_femme/Running_c24/x/y_fiche_3.html"), "une fiche femme a été téléchargée");
  assert.ok(!vautLeCoup("/chaussures_homme/Randonnee_c1136/x/y_fiche_4.html"), "une chaussure de randonnée a été téléchargée");
  assert.ok(!vautLeCoup("/chaussures_homme/Trail_c15/s/Salomon-Speedcross-6-Gore-Tex_Salomon_fiche_5.html"));
});

test("la famille d'un modèle est ce qui débloque le catalogue", () => {
  // ⚠️ MESURÉ : interroger « Hoka » rend 16 fiches quelle que soit la taille de son
  // catalogue — le marchand plafonne ses résultats. « Hoka Bondi », « Hoka Mach »,
  // « Hoka Clifton »… cumulent 55. Les familles ne s'inventent pas : elles se lisent sur
  // les modèles déjà trouvés, et chacune en révèle d'autres.
  assert.equal(familleDe("Speedgoat 6"), "Speedgoat");
  // On ne coupe PAS sur le trait d'union : « Gel » ne désigne rien et ramènerait tout
  // le catalogue Asics sans distinction.
  assert.equal(familleDe("Gel-Nimbus 28"), "Gel-Nimbus");
  // « 1080v14 » est un modèle précis ; sa famille « 1080 » révèle les versions d'avant.
  assert.equal(familleDe("Fresh Foam X 1080v14"), "Fresh");
  assert.equal(familleDe("1080v14"), "1080");
  // Trop court = du bruit, pas une famille.
  assert.equal(familleDe("X 3"), null);
  assert.equal(familleDe("SL 2"), null);
});

test("le relevé de prix ne peut pas se vider tout seul", () => {
  // ⚠️ PERTE SILENCIEUSE CONSTATÉE. Le cache évite de retélécharger une fiche déjà lue —
  // parfait pour élargir le catalogue, désastreux pour les prix : au second passage
  // aucune fiche n'était rouverte, donc aucun prix relevé, et le fichier de sortie
  // écrasait 248 prix par une liste vide. Un fichier qui rétrécit sans qu'on le remarque
  // est une perte de données, pas un passage sans résultat.
  const src = codeOf("scripts/decouverte-irun.ts");
  assert.ok(/rafraichirPrix/.test(src), "aucun mode ne rouvre les fiches pour rafraîchir les prix");
  assert.ok(/if \(vues\[f\] && !rafraichirPrix\)/.test(src), "le cache court-circuite encore le rafraîchissement");
  assert.ok(/const offres: Record<string, OffreRelevee> = Object\.fromEntries\(/.test(src),
    "le fichier d'offres est reconstruit de zéro au lieu d'être complété");
});

test("deux collectes ne peuvent pas écrire le catalogue en même temps", () => {
  // ⚠️ ARRIVÉ DEUX FOIS. Chaque collecteur charge `chaussures.json` au démarrage, le
  // garde en mémoire et le réécrit ENTIER à chaque modèle : le dernier à écrire efface
  // ce que l'autre a trouvé, sans erreur et sans trace. Une fois des codes-barres
  // effacés, une fois une déduplication de onze doublons annulée.
  for (const f of ["scripts/decouverte-irun.ts", "scripts/collecte-irun.ts",
    "scripts/collecte-rw.ts", "scripts/collecte-specs.ts"]) {
    const src = codeOf(f);
    assert.ok(/prendreVerrou\("/.test(src), `${f} peut tourner en parallèle d'un autre collecteur`);
  }
  // Et le verrou doit se rendre, y compris sur interruption : un verrou orphelin bloque
  // tout, ce qui est un défaut aussi gênant que celui qu'il corrige.
  const v = codeOf("src/lib/shop/verrou.ts");
  assert.ok(/process\.on\("exit"/.test(v) && /SIGINT/.test(v), "le verrou ne se rend pas en sortie");
  assert.ok(/process\.kill\(pid, 0\)/.test(v), "un verrou dont le propriétaire est mort doit pouvoir être repris");
});

test("la remise à plat garde la fiche la plus renseignée, pas la plus longue", () => {
  // ⚠️ « LE NOM LE PLUS LONG » AVAIT PARU MALIN et gardait « One One Mach X 3 » — qui est
  // justement le résidu à supprimer. Le bon critère est ce que la fiche CONTIENT.
  const pauvre = modele({ slug: "a", marque: "Hoka", nom: "Mach X 3", nomExact: "Hoka One One Mach X 3" });
  const riche = modele({ slug: "b", marque: "Hoka", nom: "One One Mach X 3", nomExact: "Hoka One One Mach X 3",
    poidsG: mes(230), dropMm: mes(5), ean: "1", prixConseilleEur: mes(190) });
  assert.ok(richesse(riche) > richesse(pauvre));
  const { catalogue, renommes } = normaliserCatalogue([pauvre, riche]);
  // Les deux se ramènent au même nom depuis `nomExact`, donc au même identifiant.
  assert.equal(Object.keys(catalogue).length, 1, "les deux entrées n'ont pas fusionné");
  assert.equal(Object.values(catalogue)[0].nom, "Mach X 3", "le résidu de la forme longue a été conservé");
  assert.equal(Object.values(catalogue)[0].ean, "1", "la fiche la plus renseignée n'a pas été gardée");
  assert.ok(renommes >= 1);
});

test("une marque n'a qu'un seul libellé", () => {
  // Sans alias, le filtre affichait « On » ET « On Running » : cocher l'un faisait rater
  // la moitié du catalogue.
  assert.equal(nomMarque("On Running"), "On");
  assert.equal(nomMarque("Hoka One One"), "Hoka");
  assert.equal(nomMarque("Asics"), "Asics");
  const marquesCat = new Set(CATALOGUE.map((m) => m.marque));
  for (const m of marquesCat)
    assert.equal(nomMarque(m), m, `le catalogue contient encore le libellé « ${m} », qui a un alias`);
});

test("la collecte ne recopie ni prix, ni texte, ni note du marchand", () => {
  // On prend les FAITS du produit (poids, drop, code-barres) ; le prix relève d'une
  // relation commerciale qui n'existe pas, le texte et les appréciations sont le
  // travail éditorial du marchand.
  const src = codeOf("scripts/collecte-irun.ts");
  for (const interdit of ["offers", "\"price\"", "aggregateRating", "prod?.description", "j.description"])
    assert.ok(!src.includes(interdit), `la collecte lit « ${interdit} » chez le marchand`);
});

console.log("\nSOURCES");

test("un domaine seul reste une source, une phrase n'en est pas une", () => {
  // ⚠️ Exiger « https:// » a fait rejeter CHAQUE fiche collectée : la recherche rend
  // souvent le domaine seul. Le script tournait, ne se plaignait de rien, n'écrivait rien.
  assert.ok(sourceValide("hoka.com") && sourceValide("https://www.i-run.fr/x"));
  assert.ok(!sourceValide("de mémoire") && !sourceValide("") && !sourceValide("source interne"));
  assert.equal(domaineDe("https://www.i-run.fr/x"), "i-run.fr");
  assert.equal(domaineDe("hoka.com"), "hoka.com");
  assert.equal(domaineDe("pas une source"), "");
});

test("le pluriel n'est pas écrit « modèle(s) »", () => {
  // Un « (s) » sur une page premium se remarque ; et dans plusieurs langues il n'existe pas.
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    assert.ok(SHOP[lang]["shop.n_modeles_un"] && SHOP[lang]["shop.n_modeles_plusieurs"], `pluriel absent en ${lang}`);
    assert.ok(!/\(s\)/.test(SHOP[lang]["shop.n_modeles_un"]) && !/\(s\)/.test(SHOP[lang]["shop.n_modeles_plusieurs"]));
  }
  assert.ok(/n_modeles_plusieurs/.test(readFileSync("src/components/shop/GearHub.tsx", "utf8")),
    "l'écran n'utilise pas la forme plurielle");
});

test("une vidéo n'est pas une source de fiche technique", () => {
  // ⚠️ CONSTATÉ À L'ÉCRAN sur la Clifton 10 : « Relevé sur youtube.com, rei.com… ».
  // Une source non consultable abîme la seule chose qui donne du prix au reste : le fait
  // que le lecteur puisse aller vérifier lui-même.
  assert.ok(!sourceCitable("youtube.com") && !sourceCitable("m.youtube.com") && !sourceCitable("reddit.com"));
  assert.ok(sourceCitable("hoka.com") && sourceCitable("i-run.fr") && sourceCitable("rei.com"),
    "un revendeur étranger publie bien la fiche produit : il ne doit pas être écarté");
  assert.deepEqual(sourcesCitables(["youtube.com", "hoka.com", "reddit.com"]), ["hoka.com"]);
  assert.deepEqual(sourcesCitables(undefined), []);
  // Et l'écran doit passer par ce filtre, pas afficher `m.sources` brut.
  const fiche = readFileSync("src/components/shop/FicheModele.tsx", "utf8");
  assert.ok(/sourcesCitables\(m\.sources\)/.test(fiche), "la fiche affiche les sources sans les filtrer");
  assert.ok(!/m\.sources\.join/.test(fiche), "la fiche affiche encore la liste brute des sources");
});

test("une date affichée n'est pas au format machine", () => {
  const fiche = readFileSync("src/components/shop/FicheModele.tsx", "utf8");
  assert.ok(/dateLisible\(/.test(fiche), "la date de relevé s'affiche au format ISO");
});

test("une étiquette venue des DONNÉES se traduit aussi", () => {
  // ⚠️ « Neutre » s'affichait tel quel sur la fiche d'un athlète allemand. Le contrôle
  // d'i18n ne pouvait rien voir : la chaîne ne vient pas du code, elle vient de la
  // source. Les seules valeurs présentes au catalogue sont vérifiées ci-dessous.
  const vues = [...new Set(CATALOGUE.map((m) => m.foulee).filter(Boolean))] as string[];
  for (const v of vues)
    for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
      const t = texteFoulee(lang, v);
      assert.ok(t, `« ${v} » ne produit rien en ${lang}`);
      if (lang !== "fr") assert.notEqual(t, v, `« ${v} » reste en français en ${lang}`);
    }
  assert.equal(texteFoulee("fr", undefined), null, "une valeur absente produit un badge vide");
  // Une valeur inconnue est rendue telle quelle : mieux vaut un mot en français qu'une
  // caractéristique qui disparaît sans explication.
  assert.equal(texteFoulee("de", "Supination"), "Supination");
});

console.log("\nGARAGE — les cotes viennent du catalogue, pas d'une saisie");

test("une cote décimale ne fait pas échouer l'ajout d'une paire", () => {
  // ⚠️ VÉRIFIÉ EN BASE le 02/09/2026 : `drop_mm`, `stack_mm` et `weight_g` sont des
  // `smallint`. Insérer 38,5 ne tronque pas, ça ÉCHOUE (« invalid input syntax for type
  // smallint »). Comme les cotes partent dans la MÊME insertion que la paire, deux
  // modèles du catalogue auraient fait échouer tout l'ajout : l'athlète voyait
  // « erreur » et perdait sa saisie.
  const c = cotesPourGarage({ marque: "x", nom: "y", terrain: "route", stackMm: 38.5, dropMm: 6.5, poidsG: 224.4 });
  for (const [k, v] of Object.entries(c))
    assert.ok(v == null || Number.isInteger(v), `${k} = ${v} n'est pas un entier`);
  assert.equal(c.stack_mm, 39);
  assert.deepEqual(cotesPourGarage(undefined), { drop_mm: null, stack_mm: null, weight_g: null },
    "un modèle inconnu doit laisser les colonnes vides, pas y mettre zéro");
});

test("le garage écrit bien les cotes, sinon l'avertissement de drop ne sert à rien", () => {
  // La boucle complète : catalogue → garage → `shoes.drop_mm` → avertissement de
  // transition dans le comparateur. Si le garage cesse d'écrire ces colonnes, la boucle
  // se rouvre en silence — c'est l'état dans lequel l'app a vécu jusqu'ici.
  const src = codeOf("src/components/profile/ProfileSettings.tsx");
  assert.ok(/cotesPourGarage\(fiche\)/.test(src), "le garage n'enregistre plus les cotes du catalogue");
  assert.ok(/trouver\(catalogue/.test(src), "le garage ne cherche plus le modèle dans le catalogue");
});

test("le catalogue réduit garde ce qu'il faut et rien de plus", () => {
  const l = indexLeger();
  assert.equal(l.length, CATALOGUE.length);
  const m = l.find((x) => x.dropMm != null)!;
  assert.ok(m && m.marque && m.nom && m.terrain, "une entrée réduite est incomplète");
  assert.equal((m as unknown as { sources?: unknown }).sources, undefined,
    "les sources partent dans le paquet JavaScript de la page Profil pour rien");
  // La recherche doit tolérer casse et accents : c'est ce que l'athlète tape.
  const ref = CATALOGUE.find((x) => x.dropMm)!;
  assert.ok(trouver(l, ref.marque.toUpperCase(), ref.nom.toLowerCase()), "le modèle n'est pas retrouvé");
  assert.equal(trouver(l, "Marque inexistante", "Modèle inexistant"), undefined);
});

test("aucun verdict d'usure tant que le kilométrage n'est pas renseigné", () => {
  // ⚠️ DÉFAUT MESURÉ EN BASE le 02/09/2026 : AUCUN code n'écrit `shoes.current_km` —
  // ni route, ni synchro, ni cron ; seul l'ajout d'une paire y met 0. La jauge d'usure
  // restait donc à 0 % à vie et le badge affichait « Bon état » sur une paire qui
  // pouvait avoir 900 km. Une jauge qui ne bouge pas n'est pas neutre : elle rassure à
  // tort, exactement là où l'amorti lâche.
  const src = codeOf("src/components/profile/ProfileSettings.tsx");
  assert.ok(/const suivi = km > 0/.test(src), "le garage ne distingue plus le kilométrage renseigné du zéro par défaut");
  assert.ok(/!suivi \? \{ color: "bg-zinc-300"/.test(src),
    "un verdict d'état s'affiche de nouveau sur un kilométrage jamais renseigné");
  assert.ok(/majKm\(/.test(src), "le kilométrage n'est plus modifiable : il resterait à zéro pour toujours");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    assert.ok(new RegExp(`"shoes.unknown": "[^"]+"`).test(readFileSync("src/components/profile/ProfileSettings.tsx", "utf8")),
      `libellé d'état inconnu absent en ${lang}`);
});

test("seule une paire réellement en fin de vie déclenche le bandeau", () => {
  assert.equal(paireAremplacer([{ marque: "A", modele: "B", km: 0, maxKm: 600 }]), null);
  assert.equal(paireAremplacer([{ marque: "A", modele: "B", km: 300, maxKm: 600 }]), null,
    "une paire à mi-vie a été signalée comme à remplacer");
  assert.equal(paireAremplacer([{ marque: "A", modele: "B", km: 900, maxKm: 0 }]), null,
    "une durée de vie nulle a produit une division par zéro déguisée en usure");
  assert.equal(paireAremplacer([]), null);
  assert.equal(paireAremplacer(undefined), null);
  const usee = paireAremplacer([{ marque: "A", modele: "B", km: 520, maxKm: 600 }]);
  assert.equal(usee?.modele, "B");
  // La plus avancée passe devant : c'est celle qui presse.
  const deux = paireAremplacer([
    { marque: "A", modele: "B", km: 520, maxKm: 600 },
    { marque: "C", modele: "D", km: 590, maxKm: 600 },
  ]);
  assert.equal(deux?.modele, "D");
  assert.ok(SEUIL_USURE >= 0.8 && SEUIL_USURE < 1,
    "le seuil doit précéder la panne d'amorti, pas la constater");
});

test("le bandeau de remplacement filtre sur le bon terrain", () => {
  const src = codeOf("src/components/shop/GearHub.tsx");
  assert.ok(/paireAremplacer\(profil\.rotation\)/.test(src), "le comparateur ne repère plus la paire usée");
  assert.ok(/usee\.terrain === "trail"/.test(src),
    "le bouton ne filtre pas sur le terrain de la paire remplacée : il proposerait de la route à un traileur");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    for (const k of ["shop.usure.titre", "shop.usure.corps", "shop.usure.action"])
      assert.ok(SHOP[lang][k], `${k} absent en ${lang}`);
});

test("aucun caractère invisible ne s'est glissé dans le code", () => {
  // ⚠️ DÉFAUT RÉEL, ET INVISIBLE À LA RELECTURE. En générant du code par script, un « \b »
  // destiné à une expression régulière est devenu un caractère BACKSPACE (U+0008) dans le
  // fichier. La regex exigeait alors un caractère de contrôle avant le mot : elle ne
  // pouvait plus jamais correspondre, tout en s'affichant normalement dans l'éditeur et
  // en compilant sans un mot. La détection de plaque carbone a rendu de mauvaises
  // réponses pendant plusieurs essais, et j'ai cherché la cause ailleurs.
  //
  // Les fichiers de test sont exclus : certains envoient VOLONTAIREMENT des caractères de
  // contrôle comme entrée hostile.
  const dossiers = ["src", "scripts"];
  const fautifs: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules") parcourir(p); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const t = readFileSync(p, "utf8");
      for (let i = 0; i < t.length; i++) {
        const o = t.charCodeAt(i);
        // On tolère \t (9), \n (10) et \r (13) ; tout le reste est un accident.
        if (o < 9 || (o > 10 && o < 13) || (o > 13 && o < 32)) {
          fautifs.push(`${p} ligne ${t.slice(0, i).split("\n").length} → U+${o.toString(16).padStart(4, "0").toUpperCase()}`);
          break;
        }
      }
    }
  };
  for (const d of dossiers) parcourir(d);
  assert.deepEqual(fautifs, [], `caractère(s) de contrôle dans le code : ${fautifs.join(" ; ")}`);
});

test("la présence d'une plaque carbone se constate, jamais son absence", () => {
  // ⚠️ L'ASYMÉTRIE EST LE CŒUR DE LA RÈGLE. Vérifié sur quatre fiches : celle de la
  // Vaporfly 4 annonce sa plaque, celle de l'Adizero Adios Pro 4 — qui en a une,
  // indiscutablement — n'en dit pas un mot. Le silence d'une fiche signifie « non
  // mentionné », pas « absente ». Conclure `false` sur un silence rangerait des
  // chaussures de compétition parmi les chaussures d'entraînement, et fausserait l'avis.
  assert.equal(plaqueCarboneDe("Une propulsion maximale grâce à la plaque en fibre de carbone."), true);
  assert.equal(plaqueCarboneDe("Amorti généreux et semelle accrocheuse."), undefined,
    "le silence d'une fiche a été pris pour une absence de plaque");
  assert.equal(plaqueCarboneDe("Chaussure souple sans plaque carbone."), false);
  assert.equal(plaqueCarboneDe("Elle est dépourvue de plaque carbone."), false);
  // Une plaque qui n'est pas en carbone n'est pas une plaque carbone.
  assert.equal(plaqueCarboneDe("La plaque en TPU rigidifie l'avant-pied."), undefined);
});

test("un lot d'offres ne contient jamais deux fois le même code-barres", () => {
  // ⚠️ L'IMPORT ENTIER ÉCHOUAIT. Une offre s'identifie par (marchand, code-barres) ;
  // PostgREST refuse TOUT le lot dès qu'une clé s'y répète — « ON CONFLICT DO UPDATE
  // command cannot affect row a second time » — pas seulement la ligne fautive. Or le
  // relevé est rangé par MODÈLE, et deux modèles peuvent porter le même code-barres tant
  // que le catalogue n'a pas été remis à plat. Un doublon faisait donc perdre 267 prix.
  const o = (slug: string, ean: string, prix: number) => ({ slug, ean, prix, dispo: true, url: "https://x.fr/a" });
  const r = utilisables([o("a", "111", 120), o("b", "111", 99), o("c", "222", 80)]);
  assert.equal(r.length, 2, "le doublon de code-barres n'a pas été fusionné");
  // On garde le prix le plus bas : c'est celui que la page annoncera.
  assert.equal(r.find((x) => x.ean === "111")?.prix, 99);
  // Et les lignes inexploitables restent écartées.
  assert.equal(utilisables([o("d", "", 50)]).length, 0, "une offre sans code-barres est orpheline, elle ne s'affichera jamais");
  assert.equal(utilisables([{ slug: "e", ean: "333", prix: 0, dispo: true, url: "https://x.fr" }]).length, 0);
  assert.equal(utilisables([{ slug: "f", ean: "444", prix: 50, dispo: true, url: "pas-une-url" }]).length, 0);
});

test("le catalogue existe et n'est pas vide", () => {
  assert.ok(existsSync("src/data/gear/chaussures.json"));
  assert.ok(CATALOGUE.length >= 50, `catalogue trop maigre : ${CATALOGUE.length} modèles`);
});

console.log(`\n${passed} crash-test(s) de la boutique passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
