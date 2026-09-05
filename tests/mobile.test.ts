/**
 * L'ESPACE CONNECTÉ SUR UN TÉLÉPHONE.
 *
 * Mesuré en production sur un écran de 375 px : la barre latérale restait à 232 px DANS
 * LE FLUX. Il ne restait donc que 143 px à toutes les pages du tableau de bord, 95 px
 * une fois les marges retirées — 62 % de l'écran mangés par la navigation.
 *
 * Ce qui se voyait n'était pas ça : c'était la carte du Trail Builder tombée à 93 px de
 * large, dont la barre d'attribution Leaflet (95 px de largeur minimale) débordait en
 * s'enroulant sur trois lignes. Le symptôme désignait la carte ; la cause était la
 * largeur volée à l'application entière.
 *
 * ⚠️ `collapsed` NE RÉGLAIT RIEN : il ne se déclenche qu'au clic, ne survit pas à un
 * changement de page, et même replié il occupe encore 76 px sur 375.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const SIDEBAR = "src/components/layout/Sidebar.tsx";

test("sur mobile, la barre latérale ne prend AUCUNE largeur au contenu", () => {
  const src = codeNu(SIDEBAR);
  assert.ok(/"fixed inset-y-0 left-0 z-50 w-\[264px\] -translate-x-full"/.test(src),
    "la barre n'est plus un tiroir hors-champ sur mobile : elle reprend de la largeur au contenu");
  assert.ok(/md:static/.test(src),
    "la barre ne redevient plus une colonne à partir de md : le bureau serait cassé");
  // ⚠️ LE POINT QUI COMPTE : les largeurs doivent être PRÉFIXÉES. Une largeur nue
  // s'applique aussi au téléphone et rétablit exactement le défaut.
  assert.ok(/collapsed \? "md:w-\[76px\]" : "md:w-\[232px\]"/.test(src),
    "les largeurs de la barre ne sont plus réservées au bureau : elles volent la place sur mobile");
  assert.ok(!/\bcn\([^)]*"w-\[232px\]"/.test(src), "une largeur nue de 232px est revenue");
});

test("naviguer referme le tiroir", () => {
  // Sans cela, toucher un lien laisse le tiroir ouvert PAR-DESSUS la page demandée :
  // l'athlète croit que rien ne s'est passé et appuie à nouveau.
  const src = codeNu(SIDEBAR);
  assert.ok(/useEffect\(\(\) => \{ setOuvertMobile\(false\); \}, \[pathname\]\)/.test(src),
    "le tiroir ne se referme plus au changement de page");
});

test("le bouton d'ouverture existe, est nommé, et ne vit que sur mobile", () => {
  const src = codeNu(SIDEBAR);
  const i = src.indexOf("setOuvertMobile((v) => !v)");
  assert.ok(i > 0, "le bouton d'ouverture du tiroir a disparu : la navigation devient inatteignable sur mobile");
  /**
   * ⚠️ ON DÉCOUPE LA BALISE DU BOUTON, PAS UNE FENÊTRE AUTOUR.
   *
   * Une première version prenait 300 caractères avant et 700 après — et attrapait le
   * `md:hidden` du VOILE, écrit juste au-dessus. Retirer celui du bouton laissait donc
   * le test vert : il vérifiait la présence d'une classe sur un autre élément. La
   * mutation l'a montré, rien d'autre ne l'aurait fait.
   */
  const debut = src.lastIndexOf("<button", i);
  assert.ok(debut > 0, "le déclencheur du tiroir n'est plus un <button>");
  const bouton = src.slice(debut, src.indexOf(">", src.indexOf("className", debut)) + 1);
  assert.ok(/md:hidden/.test(bouton), "le bouton s'affiche aussi sur bureau, où la barre est déjà visible");
  assert.ok(/aria-label=\{t\("nav\.menu"\)\}/.test(bouton),
    "le bouton n'a pas de nom accessible : un lecteur d'écran annonce « bouton »");
  assert.ok(/aria-expanded/.test(bouton), "l'état ouvert/fermé n'est pas annoncé");
  // Un voile doit permettre de refermer sans viser le bouton.
  assert.ok(/onClick=\{\(\) => setOuvertMobile\(false\)\}/.test(src), "le voile ne referme plus le tiroir");
});

test("le libellé du menu existe dans les cinq langues", () => {
  const i18n = readFileSync("src/lib/i18n/translations.ts", "utf8");
  assert.equal([...i18n.matchAll(/"nav\.menu"\s*:/g)].length, 5,
    "« nav.menu » manque à une langue : le bouton n'aurait pas de nom accessible");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
