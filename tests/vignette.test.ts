/**
 * LE FIL D'ACTIVITÉS MONTRE LA FORME DU PARCOURS — ENCORE FAUT-IL QU'ELLE SOIT VRAIE.
 *
 * Un degré de longitude ne vaut un degré de latitude qu'à l'équateur. Sans correction
 * en cos(latitude), une boucle courue à Rouen serait étirée horizontalement de 35 % :
 * le tracé cesserait d'être reconnaissable, ce qui est TOUT ce qu'on lui demande.
 *
 * Le reste du fichier garde les deux autres promesses de la page : les traces sont
 * demandées en UNE requête (le défaut qui avait mis la carte de chaleur à 12 s), et
 * un chiffre absent ne devient jamais un zéro.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { planCarte, mondePx, urlTuile, tailleTuileDe, attributionCarte, ZOOM_MAX } from "../src/lib/activities/tuiles";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}
/** Relit le chemin dessiné pour juger la GÉOMÉTRIE, pas la chaîne de caractères. */
function points(d: string): { x: number; y: number }[] {
  return [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
}
const segment = (n: number, f: (i: number) => { lat: number; lon: number }) => Array.from({ length: n }, (_, i) => f(i));


console.log("\nLE FIL — une requête, et aucun zéro inventé");

test("les traces sont demandées en UNE fois", () => {
  const src = codeOf("src/app/dashboard/activites/page.tsx");
  assert.match(src, /\.in\("workout_id"/, "une requête par carte ferait revenir le défaut des 12 s");
  assert.doesNotMatch(src, /for\s*\(\s*const\s+\w+\s+of\s+seances\s*\)\s*\{[\s\S]{0,200}await sb/,
    "une requête est repartie dans une boucle sur les séances");
});

test("une valeur absente reste absente", () => {
  const src = codeOf("src/app/dashboard/activites/page.tsx");
  assert.match(src, /Number\.isFinite\(v\) && v > 0 \? v : null/, "le garde « absent ≠ zéro » a disparu");
  assert.match(src, /SANS_VALEUR/, "une distance manquante doit s'afficher « — », pas « 0,0 km »");
});

test("une lecture EN PANNE ne se lit pas « aucune sortie »", () => {
  const src = codeOf("src/app/dashboard/activites/page.tsx");
  assert.match(src, /estUnePanne\(lecture\)/, "une panne serveur passerait pour un historique vide");
  assert.match(src, /d\["feed\.panne"\]/, "le message de panne doit être traduit, pas écrit en dur");
});

console.log("\nRETRAITS DEMANDÉS — vérifiés, pas supposés");

test("la carte de chaleur ne laisse aucun reste", () => {
  assert.ok(!existsSync("src/app/dashboard/heatmap/page.tsx"), "la page existe encore");
  assert.ok(!existsSync("src/lib/segments/heatmap.ts"), "le module de calcul existe encore");
  assert.doesNotMatch(codeOf("src/components/segments/PerfTabs.tsx"), /heatmap|Carte de chaleur/,
    "l'onglet est encore dans la barre");
  assert.doesNotMatch(readFileSync("src/data/helpKb.ts", "utf8"), /dashboard\/heatmap/,
    "l'aide envoie encore vers un écran supprimé");
  assert.doesNotMatch(readFileSync("src/lib/i18n/translations.ts", "utf8"), /"nav\.heatmap"/,
    "une entrée de menu traduite promet toujours cet écran");
});

test("le survol 3D n'annonce plus « Inclus, sans abonnement »", () => {
  assert.doesNotMatch(readFileSync("src/lib/i18n/translations.ts", "utf8"), /"fly\.free"/,
    "la clé est encore là : elle réapparaîtra au premier réemploi");
  assert.doesNotMatch(codeOf("src/app/dashboard/survol/page.tsx"), /fly\.free/,
    "la page l'affiche encore");
});

test("l'onglet Activités est bien branché", () => {
  const src = codeOf("src/components/segments/PerfTabs.tsx");
  assert.match(src, /href: "\/dashboard\/activites"/, "l'onglet n'existe pas");
  assert.ok(existsSync("src/app/dashboard/activites/page.tsx"), "l'onglet pointe vers une page absente");
});

test("tous les fichiers de test sont dans la chaîne npm test", () => {
  const chaine = JSON.parse(readFileSync("package.json", "utf8")).scripts.test as string;
  const oublies = readdirSync("tests").filter((f) => f.endsWith(".test.ts")).filter((f) => !chaine.includes(`tests/${f}`));
  assert.deepEqual(oublies, [], `test(s) jamais exécuté(s) : ${oublies.join(", ")}`);
});

console.log("\nLA VRAIE CARTE — des tuiles derrière le tracé, pas un fond gris");

const boucle = (n: number, r: number, lat = 49.44, lon = 1.10) =>
  segment(n, (i) => ({ lat: lat + Math.sin(i / (n / 6)) * r, lon: lon + Math.cos(i / (n / 6)) * r * 1.5 }));

test("la projection de Mercator est celle qu'on croit", () => {
  // Repère vérifiable à la main : la longitude 0 tombe au MILIEU du monde, et
  // l'équateur aussi. Une erreur ici décale toutes les tuiles sans rien casser.
  const t = 512, monde = t * Math.pow(2, 3);
  const zero = mondePx(0, 0, 3, t);
  assert.ok(Math.abs(zero.x - monde / 2) < 0.001, `longitude 0 mal placée : ${zero.x}`);
  assert.ok(Math.abs(zero.y - monde / 2) < 0.001, `équateur mal placé : ${zero.y}`);
  assert.ok(mondePx(0, 180, 3, t).x > monde - 0.001, "la longitude 180 est le bord du monde");
  // Le nord est en haut : plus la latitude monte, plus y descend.
  assert.ok(mondePx(60, 0, 3, t).y < mondePx(0, 0, 3, t).y);
  // Au pôle, Mercator diverge. ⚠️ `Number.isFinite` ne suffit PAS à le voir : en JS
  // `Math.tan(Math.PI/2)` vaut 1,6e16, pas l'infini — la valeur reste finie tout en
  // étant absurde (y très négatif, donc hors du monde). On exige donc le bornage.
  assert.equal(mondePx(90, 0, 3, t).y, mondePx(85.05112878, 0, 3, t).y,
    "la latitude n'est pas ramenée à la limite de Mercator");
  assert.ok(mondePx(90, 0, 3, t).y >= 0, "le pôle sort du monde par le haut");
  assert.ok(mondePx(-90, 0, 3, t).y <= monde, "le pôle sud sort du monde par le bas");
});

test("la taille des tuiles suit le FOURNISSEUR, pas une hypothèse", () => {
  // Mesuré le 05/09/2026 : MapTiler sert du 512, OpenStreetMap du 256. Confondre les
  // deux décale la mosaïque d'un demi-écran.
  assert.equal(tailleTuileDe("une-cle"), 512);
  assert.equal(tailleTuileDe(""), 256);
  assert.match(urlTuile({ z: 12, x: 2050, y: 1400, gauche: 0, haut: 0 }, "abc"), /api\.maptiler\.com\/maps\/[a-z0-9-]+\/12\/2050\/1400\.png\?key=abc/);
  assert.match(urlTuile({ z: 12, x: 2050, y: 1400, gauche: 0, haut: 0 }, ""), /tile\.openstreetmap\.org\/12\/2050\/1400\.png/);
});

test("l'attribution suit le fournisseur réellement utilisé", () => {
  assert.equal(attributionCarte("cle"), "© MapTiler © OpenStreetMap");
  assert.equal(attributionCarte(""), "© OpenStreetMap");
});

test("le zoom est le plus SERRÉ où le parcours tient encore", () => {
  const petit = planCarte(boucle(60, 0.002), { largeur: 176, hauteur: 96 })!;
  const grand = planCarte(boucle(60, 0.05), { largeur: 176, hauteur: 96 })!;
  assert.ok(petit.zoom > grand.zoom, "une petite boucle doit être vue de plus près qu'une grande");
  assert.ok(petit.zoom <= ZOOM_MAX, "au-delà on voit les pavés, plus le parcours");
});

test("le parcours tient DANS la vignette, marges comprises", () => {
  for (const rayon of [0.001, 0.01, 0.08]) {
    const p = planCarte(boucle(80, rayon), { largeur: 176, hauteur: 96, marge: 8 })!;
    const xs = [...p.chemin.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    for (const [x, y] of xs) {
      assert.ok(x >= -0.6 && x <= 176.6, `rayon ${rayon} : x hors cadre (${x})`);
      assert.ok(y >= -0.6 && y <= 96.6, `rayon ${rayon} : y hors cadre (${y})`);
    }
  }
});

test("les tuiles couvrent toute la vignette, sans trou", () => {
  const p = planCarte(boucle(80, 0.01), { largeur: 176, hauteur: 96, tailleTuile: 512 })!;
  assert.ok(p.tuiles.length >= 1 && p.tuiles.length <= 6, `${p.tuiles.length} tuiles : trop, ou pas assez`);
  const gauche = Math.min(...p.tuiles.map((t) => t.gauche));
  const droite = Math.max(...p.tuiles.map((t) => t.gauche + p.tailleTuile));
  const haut = Math.min(...p.tuiles.map((t) => t.haut));
  const bas = Math.max(...p.tuiles.map((t) => t.haut + p.tailleTuile));
  assert.ok(gauche <= 0 && droite >= 176, `bande verticale non couverte : ${gauche}…${droite}`);
  assert.ok(haut <= 0 && bas >= 96, `bande horizontale non couverte : ${haut}…${bas}`);
});

test("aucune tuile n'est demandée hors du monde", () => {
  // Un y négatif ou trop grand donne un 404 que le navigateur affiche en image cassée.
  // ⚠️ Il faut que la vignette DÉBORDE vraiment du monde pour éprouver le garde-fou.
  // À un zoom élevé, la latitude 84,9° est encore à des milliers de pixels du bord :
  // le cas ne se présentait jamais. Au zoom 0, le monde entier fait une tuile, donc
  // une vignette de 96 px de haut mord forcément au-delà du pôle.
  for (const [lat, zoomMax] of [[84.9, 0], [-84.9, 0], [84.9, 2], [0, 15]] as [number, number][]) {
    const p = planCarte(boucle(40, 0.01, lat, 179.9), { largeur: 176, hauteur: 96, zoomMax });
    if (!p) continue;
    const dernier = Math.pow(2, p.zoom) - 1;
    for (const t of p.tuiles) {
      assert.ok(t.y >= 0 && t.y <= dernier, `tuile y=${t.y} hors du monde à la latitude ${lat}`);
      assert.ok(t.x >= 0 && t.x <= dernier, `tuile x=${t.x} hors du monde (l'enroulement en longitude a sauté)`);
    }
  }
});

test("une trace inexploitable ne fabrique pas de carte", () => {
  assert.equal(planCarte(segment(7, (i) => ({ lat: 49 + i * 0.001, lon: 1 })), { largeur: 176, hauteur: 96 }), null);
  assert.equal(planCarte(segment(30, () => ({ lat: 49.1, lon: 1.1 })), { largeur: 176, hauteur: 96 }), null);
  assert.equal(planCarte(boucle(40, 0.01), { largeur: 10, hauteur: 10, marge: 8 }), null);
});

test("la carte remplace le tracé nu dans le fil", () => {
  const src = codeOf("src/app/dashboard/activites/page.tsx");
  assert.match(src, /planCarte\(allege, \{/, "la vignette ne compose plus de carte");
  assert.match(src, /tailleTuileDe\(CLE_CARTE\)/, "la taille des tuiles n'est plus déduite du fournisseur");
  assert.match(src, /attributionCarte\(CLE_CARTE\)/, "les tuiles seraient affichées sans être créditées");
  const carte = codeOf("src/components/activity/FeedCard.tsx");
  // La garantie a CHANGÉ avec le passage au SVG : `loading="lazy"` n'existe pas sur
  // `<image>`, donc ce n'est plus le différé qui borne la facture mais la pagination.
  // Ce qui doit être garanti désormais, c'est que la carte SE METTE À L'ÉCHELLE —
  // sans `viewBox`, on revient à une largeur figée et à un tracé minuscule sur grand
  // écran, exactement le défaut signalé.
  assert.match(carte, /<svg viewBox=\{`0 0 \$\{plan\.largeur\} \$\{plan\.hauteur\}`\}/,
    "la carte n'a plus de viewBox : elle cessera de s'adapter à la largeur du cadre");
  assert.match(carte, /className="block h-auto w-full/, "la carte ne remplit plus la largeur du cadre");
  const parPage = Number(codeOf("src/app/dashboard/activites/page.tsx").match(/const PAR_PAGE = (\d+);/)?.[1]);
  assert.ok(parPage >= 1 && parPage <= 15,
    `PAR_PAGE = ${parPage} : les tuiles n'étant plus différées, c'est la pagination qui borne le poids de la page`);
  // On vise la PROPRIÉTÉ, pas le nombre de balises : rendre le liseré transparent
  // laissait deux <path> en place et ce test au vert (trouvé par mutation).
  const blanc = carte.match(/stroke="#ffffff"[^/]*?strokeWidth=\{([\d.]+)\}/);
  const couleur = carte.match(/stroke="#059669"[^/]*?strokeWidth=\{([\d.]+)\}/);
  assert.ok(blanc, "le liseré blanc a disparu : le tracé s'effacera sur les zones claires de la carte");
  assert.ok(couleur, "le tracé coloré a disparu");
  assert.ok(Number(blanc![1]) > Number(couleur![1]),
    `le liseré (${blanc![1]}) doit être PLUS LARGE que le tracé (${couleur![1]}), sinon il ne le borde pas`);
});

test("le parcours REMPLIT le cadre, il ne flotte pas au milieu", () => {
  // Le défaut signalé le 06/09/2026 : « l'encadré est trop petit ». La cause n'était pas
  // la taille du cadre mais la marge — le tracé était confiné dans une bande centrale
  // (pour qu'un téléphone ne le coupe pas) et n'occupait plus que 45 % de la largeur.
  const src = codeOf("src/app/dashboard/activites/page.tsx");
  assert.match(src, /margeX: MARGE_X, margeY: MARGE_Y/,
    "le cadrage n'utilise plus les marges nommées : une valeur en dur peut reconfiner le tracé");
  const n = (cle: string) => Number(src.match(new RegExp(`${cle} = (\\d+)`))?.[1]);
  const [L, H, mx, my] = [n("LARGEUR"), n("HAUTEUR"), n("MARGE_X"), n("MARGE_Y")];
  for (const [nom, v] of [["LARGEUR", L], ["HAUTEUR", H], ["MARGE_X", mx], ["MARGE_Y", my]] as const)
    assert.ok(Number.isFinite(v) && v > 0, `${nom} illisible dans la page`);
  assert.ok((L - 2 * mx) / L >= 0.85,
    `le tracé n'occupe que ${Math.round((L - 2 * mx) / L * 100)} % de la largeur du cadre`);
  assert.ok((H - 2 * my) / H >= 0.75,
    `le tracé n'occupe que ${Math.round((H - 2 * my) / H * 100)} % de la hauteur du cadre`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
