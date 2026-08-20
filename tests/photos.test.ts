/**
 * AUCUNE PHOTO BANNIE NE PEUT REVENIR, ET AUCUNE PHOTO PUBLIQUE N'EST INAUDITÉE.
 *
 * Un test ne peut pas REGARDER une image — il ne saura jamais dire si une chaussure
 * porte un swoosh. Ce test garde donc les deux seules choses vérifiables par machine,
 * et ce sont précisément les deux qui ont lâché :
 *
 *  1. UNE PHOTO RETIRÉE POUR MOTIF DOIT DISPARAÎTRE PARTOUT. Le 20/08/2026, la photo
 *     aux trois bandes Adidas a été retirée de la carte « 10 km » de la landing… et
 *     elle est restée en ligne sur le blog (page PUBLIQUE), dans le fil Communauté et
 *     dans deux viviers de la boutique. Même histoire pour la photo au swoosh Nike.
 *     Un identifiant banni ici ne doit plus apparaître nulle part dans `src/`.
 *
 *  2. UNE SURFACE PUBLIQUE NE DOIT AFFICHER QUE DES PHOTOS AUDITÉES. Ajouter une carte
 *     à la landing ou un article au blog ne doit pas pouvoir se faire en silence :
 *     tout identifiant qui y apparaît doit figurer dans AUDITEES ci-dessous, ce qui
 *     force à ouvrir l'image et à la regarder avant de l'expédier.
 *
 * ⚠️ NE JAMAIS « réparer » un échec en ajoutant l'identifiant à AUDITEES sans avoir
 * regardé l'image. Ce serait reproduire le défaut d'origine : le fil Communauté portait
 * un commentaire affirmant « ~100 photos vérifiées, AUCUN logo de marque » alors que la
 * liste contenait les trois pires images du projet. Un commentaire — ou une entrée de
 * tableau — n'est pas une vérification.
 *
 *   npx tsx tests/photos.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

let passed = 0;
const fails: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { fails.push(`${name} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${name}`); }
}

// ── 1. Les bannies ───────────────────────────────────────────────────────────
// Chacune a été REGARDÉE, au format réellement servi, et rejetée pour le motif indiqué.
// Cette liste ne peut que grandir : on n'en retire une que si l'image elle-même change.
const BANNIES: Record<string, string> = {
  "photo-1571008887538-b36bb32f4571": "trois bandes Adidas nettes, au centre du cadre",
  "photo-1461896836934-ffe607ba8211": "swoosh Nike au centre optique + « BROO(KS) » derrière",
  "photo-1542291026-7eec264c27ff":    "photo PRODUIT Nike plein cadre, logotype ET swoosh",
  "photo-1667781838690-5f32ea0ccea6": "dossard 21221 lisible + TCS New York — donnée nominative",
  "photo-1480179087180-d9f0ec044897": "visage de profil net (les lunettes ne masquent pas un profil)",
  "photo-1544717305-2782549b5136":    "portrait studio, visage de face identifiable",
  "photo-1559839734-2b71ea197ec2":    "blouse blanche + visage identifiable — autorité médicale implicite",
  "photo-1486739985386-d4fae04ca6f7": "visage net et identifiable",
  "photo-1704265586142-db3e17d0dea0": "chronomètre HEUER, logotype lisible sur le cadran",
  "photo-1683860296286-6fd067d4a4a6": "semelle : trois bandes Adidas moulées",
  "photo-1475274110913-480c45d0e873": "swoosh Nike + « Dri-Fit » + écusson FC Barcelone",
  "photo-1613936360976-8f35cf0e5461": "dossards 452/461/327 lisibles + « JOMA »",
  "photo-1772867692023-e66c1997f0e8": "Converse (et baskets de ville, pas de course)",
  "photo-1519703936-c4a3b3eb88e4":    "dossards lisibles + visages de spectateurs nets",
};

// ── 2. Les auditées, par surface PUBLIQUE ────────────────────────────────────
// Regardées une par une le 20/08/2026, au recadrage exact servi par la page.
const AUDITEES: Record<string, string> = {
  // Landing — les 9 cartes de PROGRAMS + le hero.
  "photo-1502904550040-7534597429ae": "hero : piste vue de haut, aucun visage lisible",
  "photo-1560052767-406e947cc273":    "10 km : coureur de dos, petit dans le cadre, t-shirt uni",
  "photo-1590333748338-d629e4564ad9": "semi : peloton de dos, aucun dossard visible",
  "photo-1682367905664-e36b30f15b19": "marathon : foule vue de haut, visages et dossards illisibles",
  "photo-1504025468847-0e438279542c": "trail : coureur de dos, aucune marque",
  "photo-1645238426817-8c3e7d1396cf": "débuter : groupe de dos, aucun visage",
  "photo-1744060204728-f68e434a3edf": "vitesse : contre-jour, visage en ombre, chaussures sans logo",
  "photo-1646867802148-b3ccd7ebf76d": "endurance : de dos ; « SUPER… » petit, sous le seuil de proéminence",
  "photo-1600712662084-e54770a9668e": "blessure : mains et chaussure, aucun visage",
  "photo-1516398810565-0cb4310bb8ea": "perte de poids : silhouette pleine, aucun trait discernable",
  // Blog — les 8 tuiles.
  "photo-1485827404703-89b55fcc595e": "IA : robot Pepper — produit de marque, discret",
  "photo-1762281429414-5ee5f2dbb243": "IA : motif d'onde abstrait, ni personne ni marque",
  "photo-1526676537331-7747bf8278fc": "entraînement : jambes sur piste, aucun visage ni marque lisible",
  "photo-1560233026-ad254fa8da38":    "santé : silhouette d'étirement, aucun trait discernable",
  "photo-1761078739194-75cccb8e3195": "IA : motif abstrait, ni personne ni marque",
  "photo-1490645935967-10de6ba17061": "nutrition : assiette, rien à signaler",
  "photo-1555972635-8a10402b49b2":    "matériel : chaussure dans l'herbe ; petit drapeau de marque au talon (~30 px)",
};

// ── 3. Les Pexels validées du fil Communauté ─────────────────────────────────
// Les 154 identifiants Pexels ont été regardés le 20/08/2026 en planches-contacts ;
// 74 ont été retirés (dossards lisibles, athlètes élite identifiables — dont KIPLIMO
// nommé sur son dossard —, bandeaux sponsors EDP/Adidas, visages nets). Voici les 80
// qui restent. Tout PX() absent d'ici fait échouer la suite : c'est le but.
const PEXELS_VALIDEES = new Set<string>([
  "2402734", "3763869", "4348640", "4422913", "4606708", "4920448", "5198385", "5319325",
  "6455591", "6455667", "6778610", "7026516", "7879913", "8454900", "8454901", "8454904",
  "8456074", "8497536", "8533790", "9207813", "9563709", "9790261", "10168171", "10516108",
  "10615641", "10615645", "12360284", "12562821", "12698200", "13631464", "16949283",
  "16980804", "19439272", "19783892", "19881117", "20789142", "23857950", "25078526",
  "28768323", "29116008", "30144519", "30416813", "30652598", "30932855", "30932860",
  "31238485", "31675724", "31805881", "32130258", "32145212", "32381195", "32798744",
  "32798745", "32798746", "32798754", "32798757", "32962276", "33076361", "33284135",
  "33284136", "33378482", "33491424", "33522755", "33874843", "34210063", "34730429",
  "35115744", "35206081", "35425192", "35527724", "35684458", "35718700", "35765666",
  "36645343", "36665709", "36732202", "37046063", "37718409", "37993134", "38074682",
]);

// ── Lecture du source ────────────────────────────────────────────────────────
function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/**
 * Retire les commentaires — un identifiant CITÉ dans une explication est inoffensif.
 * ⚠️ On ne coupe PAS sur un « // » précédé de « : » : sinon `https://images.unsplash…`
 * serait tronqué et l'assertion ne pourrait plus jamais échouer.
 */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

const TOUS = fichiers(SRC).map((p) => ({ p, code: sansCommentaires(readFileSync(p, "utf8")) }));
const idsDe = (code: string) => code.match(/photo-\d{10,}-[0-9a-z]+/g) ?? [];

// ── Garde-fous du garde-fou ──────────────────────────────────────────────────
// Sans ça, une erreur de chemin ou de regex rendrait le test VERT SUR RIEN : c'est le
// piège qui a déjà coûté cinq fois au projet.
test("le scanner voit réellement le source", () => {
  assert.ok(TOUS.length > 100, `seulement ${TOUS.length} fichiers scannés`);
  for (const attendu of [
    "app/page.tsx", "app/blog/page.tsx",
    "components/community/CommunityFeed.tsx", "components/shop/ShoppingHub.tsx",
  ]) {
    assert.ok(
      TOUS.some((f) => relative(SRC, f.p).replace(/\\/g, "/") === attendu),
      `${attendu} n'a pas été scanné`,
    );
  }
  const total = TOUS.reduce((n, f) => n + idsDe(f.code).length, 0);
  assert.ok(total > 40, `seulement ${total} identifiants de photo trouvés — la regex ne mord plus`);
});

test("le retrait des commentaires ne casse pas les URL", () => {
  const t = sansCommentaires('const u = "https://images.unsplash.com/photo-1234567890-abc"; // photo-9999999999-zzz');
  assert.ok(t.includes("photo-1234567890-abc"), "une URL a été tronquée sur son « // »");
  assert.ok(!t.includes("photo-9999999999-zzz"), "le commentaire n'a pas été retiré");
});

// ── 1. Aucune bannie nulle part ──────────────────────────────────────────────
test("aucune photo bannie ne réapparaît dans le source", () => {
  assert.ok(Object.keys(BANNIES).length > 0, "la liste des bannies est vide");
  const vus: string[] = [];
  for (const { p, code } of TOUS) {
    for (const id of idsDe(code)) {
      if (BANNIES[id]) vus.push(`${relative(ROOT, p)} → ${id} (${BANNIES[id]})`);
    }
  }
  assert.equal(vus.length, 0, `photo(s) bannie(s) réapparue(s) :\n    ${vus.join("\n    ")}`);
});

// ── 2. Les surfaces publiques n'affichent que de l'audité ────────────────────
const PUBLIQUES = ["app/page.tsx", "app/blog/page.tsx"];

test("toute photo d'une page publique a été auditée", () => {
  const inconnus: string[] = [];
  for (const rel of PUBLIQUES) {
    const f = TOUS.find((x) => relative(SRC, x.p).replace(/\\/g, "/") === rel);
    assert.ok(f, `${rel} introuvable`);
    for (const id of new Set(idsDe(f.code))) {
      if (!AUDITEES[id]) inconnus.push(`${rel} → ${id}`);
    }
  }
  assert.equal(
    inconnus.length, 0,
    `photo(s) jamais regardée(s) sur une page publique :\n    ${inconnus.join("\n    ")}\n` +
    `    → ouvrir l'image au format servi, la REGARDER, puis l'ajouter à AUDITEES avec son motif.`,
  );
});

test("le fil Communauté n'utilise que des Pexels validées", () => {
  assert.ok(PEXELS_VALIDEES.size > 50, `seulement ${PEXELS_VALIDEES.size} Pexels validées`);
  const f = TOUS.find((x) => relative(SRC, x.p).replace(/\\/g, "/") === "components/community/CommunityFeed.tsx");
  assert.ok(f, "CommunityFeed.tsx introuvable");
  const px = f!.code.match(/PX\((\d+)\)/g) ?? [];
  assert.ok(px.length > 50, `seulement ${px.length} appels PX() vus — la regex ne mord plus`);
  const inconnus = [...new Set(px.map((m) => m.replace(/\D/g, "")))].filter((id) => !PEXELS_VALIDEES.has(id));
  assert.equal(
    inconnus.length, 0,
    `photo(s) Pexels jamais regardée(s) : ${inconnus.join(", ")}\n` +
    `    → ouvrir https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg , la REGARDER,\n` +
    `      puis l'ajouter à PEXELS_VALIDEES. Ne jamais l'ajouter sans l'avoir vue.`,
  );
});

test("la liste des Pexels validées ne contient rien de périmé", () => {
  const f = TOUS.find((x) => relative(SRC, x.p).replace(/\\/g, "/") === "components/community/CommunityFeed.tsx");
  const utilises = new Set((f!.code.match(/PX\((\d+)\)/g) ?? []).map((m) => m.replace(/\D/g, "")));
  const morts = [...PEXELS_VALIDEES].filter((id) => !utilises.has(id));
  assert.equal(morts.length, 0, `Pexels validée(s) mais plus utilisée(s) : ${morts.join(", ")}`);
});

test("la liste des auditées ne contient rien de périmé", () => {
  const utilises = new Set(TOUS.flatMap((f) => idsDe(f.code)));
  const morts = Object.keys(AUDITEES).filter((id) => !utilises.has(id));
  assert.equal(morts.length, 0, `identifiant(s) audité(s) mais plus utilisé(s) : ${morts.join(", ")}`);
});

// ── 4. Le catalogue SIMULÉ ne peut pas être rebranché ────────────────────────
// `ShoppingHub` affiche 1 167 références aux prix INVENTÉS attribuées à de vraies
// enseignes, et ses ~36 images n'ont jamais été auditées (on y a trouvé une Apple Watch,
// une enceinte JBL, du vin, une Tesla, une raquette de tennis et un mouton). La page
// boutique le rendait dès que `product_offers` cessait d'être vide — donc importer un
// vrai flux aurait allumé les faux prix. Cette page doit rester sur l'écran d'attente.
test("la page boutique ne rend pas le catalogue simulé", () => {
  const f = TOUS.find((x) => relative(SRC, x.p).replace(/\\/g, "/") === "app/dashboard/shop/page.tsx");
  assert.ok(f, "app/dashboard/shop/page.tsx introuvable");
  assert.ok(f!.code.includes("ShopComingSoon"), "la page ne rend plus l'écran d'attente");
  assert.ok(
    !f!.code.includes("ShoppingHub"),
    "la page boutique référence à nouveau ShoppingHub — elle afficherait des prix inventés",
  );
});

test("une photo ne peut pas être à la fois bannie et auditée", () => {
  const deux = Object.keys(AUDITEES).filter((id) => BANNIES[id]);
  assert.equal(deux.length, 0, `contradiction : ${deux.join(", ")}`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
