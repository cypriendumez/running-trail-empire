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
import { cheminTrace, POINTS_MIN } from "../src/lib/activities/vignette";

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

console.log("\nGÉOMÉTRIE — le tracé doit ressembler au parcours");

test("une trace trop courte ne donne pas de vignette", () => {
  // Nombres ÉCRITS EN DUR : les déduire de POINTS_MIN rendrait ce test incapable de
  // voir un changement de seuil — il suivrait le code au lieu de le juger.
  assert.equal(POINTS_MIN, 8, "seuil de points : décision d'affichage, à changer sciemment");
  assert.equal(cheminTrace(segment(7, (i) => ({ lat: 49 + i * 0.001, lon: 1 }))), null, "7 points ne font pas une forme");
  assert.ok(cheminTrace(segment(8, (i) => ({ lat: 49 + i * 0.001, lon: 1 }))), "8 points doivent suffire");
  assert.equal(cheminTrace([]), null);
});

test("la longitude est corrigée par le cosinus de la latitude", () => {
  // Carré de 0,01° de côté à 60° de latitude : 0,01° de longitude n'y vaut que la
  // MOITIÉ de 0,01° de latitude. Le dessin doit donc être deux fois plus haut que large.
  const carre = segment(40, (i) => ({ lat: 60 + (i % 20) * 0.0005, lon: 1 + Math.floor(i / 20) * 0.01 }));
  const p = points(cheminTrace(carre, 200, 200, 0)!.d);
  const largeur = Math.max(...p.map((q) => q.x)) - Math.min(...p.map((q) => q.x));
  const hauteur = Math.max(...p.map((q) => q.y)) - Math.min(...p.map((q) => q.y));
  const rapport = hauteur / largeur;
  assert.ok(Math.abs(rapport - 2) < 0.1, `sans la correction, le rapport serait 1 ; obtenu ${rapport.toFixed(2)}`);
});

test("le nord est en HAUT", () => {
  // L'axe des y d'un SVG descend : oublier l'inversion retourne la carte.
  const versLeNord = segment(20, (i) => ({ lat: 49 + i * 0.001, lon: 1 }));
  const p = points(cheminTrace(versLeNord)!.d);
  assert.ok(p[0].y > p[p.length - 1].y, "le point le plus au nord doit avoir le plus petit y");
});

test("le tracé tient dans la boîte, marges comprises", () => {
  const boucle = segment(60, (i) => ({ lat: 49 + Math.sin(i / 9) * 0.01, lon: 1 + Math.cos(i / 9) * 0.01 }));
  const v = cheminTrace(boucle, 168, 96, 6)!;
  for (const q of points(v.d)) {
    assert.ok(q.x >= 6 - 0.05 && q.x <= 168 - 6 + 0.05, `x hors marge : ${q.x}`);
    assert.ok(q.y >= 6 - 0.05 && q.y <= 96 - 6 + 0.05, `y hors marge : ${q.y}`);
  }
});

test("une trace immobile ne produit pas un faux dessin", () => {
  // GPS bloqué, séance sur tapis : il n'y a pas de forme à inventer.
  assert.equal(cheminTrace(segment(30, () => ({ lat: 49.1, lon: 1.1 }))), null);
});

test("un aller-retour parfaitement droit reste dessinable", () => {
  const droit = segment(20, (i) => ({ lat: 49, lon: 1 + i * 0.001 }));
  const v = cheminTrace(droit);
  assert.ok(v, "une ligne est une forme valable, contrairement à un point");
  assert.ok(v!.d.startsWith("M"), "un chemin SVG commence par un déplacement");
});

test("les coordonnées absurdes sont écartées, pas dessinées", () => {
  const sale = [
    ...segment(20, (i) => ({ lat: 49 + i * 0.001, lon: 1 })),
    { lat: Number.NaN, lon: 1 }, { lat: 999, lon: 1 }, { lat: 49, lon: 500 },
  ];
  const v = cheminTrace(sale)!;
  assert.ok(v, "les points valables suffisaient à dessiner");
  assert.ok(!/NaN|Infinity/.test(v.d), "une coordonnée illisible a fini dans le SVG");
  assert.equal(points(v.d).length, 20, "un point hors du globe a été dessiné");
});

test("une boîte plus petite que ses marges ne rend rien", () => {
  const nordSud = segment(20, (i) => ({ lat: 49 + i * 0.001, lon: 1 }));
  const estOuest = segment(20, (i) => ({ lat: 49, lon: 1 + i * 0.001 }));
  assert.equal(cheminTrace(nordSud, 10, 10, 6), null);
  // Cas qui distingue VRAIMENT le garde-fou : une seule dimension est écrasée. Sans
  // lui, ce tracé se dessinait sur une bande de hauteur nulle — un trait plat au
  // milieu d'un cadre vide, présenté comme le parcours de la sortie.
  assert.equal(cheminTrace(estOuest, 40, 20, 10), null, "hauteur utile nulle : rien à dessiner");
  assert.equal(cheminTrace(nordSud, 20, 40, 10), null, "largeur utile nulle : rien à dessiner");
});

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

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
