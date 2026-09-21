/**
 * L'ESPACE CONNECTÉ SUR UN TÉLÉPHONE.
 *
 * Mesuré en production sur un écran de 375 px : la barre latérale restait à 232 px DANS
 * LE FLUX. Il ne restait donc que 143 px à toutes les pages du tableau de bord, 95 px
 * une fois les marges retirées — 62 % de l'écran mangés par la navigation. Deuxième
 * version : un tiroir hors-champ ouvert par un bouton ☰. Troisième, depuis le 21/09/2026
 * et à la demande de Cyprien : une BARRE D'ONGLETS en bas d'écran, façon Strava —
 * Accueil · Carte · Enregistrer · Calendrier · Plus.
 *
 * Ce que ce fichier garde n'a pas changé de nature : sur téléphone, la navigation ne
 * vole AUCUNE largeur au contenu, elle est atteignable, nommée, et elle mène PARTOUT.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NAV_GROUPES, ONGLETS_MOBILE, resteMobile } from "../src/components/layout/navigation";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const SIDEBAR = "src/components/layout/Sidebar.tsx";
const BARRE = "src/components/layout/MobileTabBar.tsx";
const LAYOUT = "src/app/dashboard/layout.tsx";

test("sur mobile, la barre latérale ne prend AUCUNE largeur au contenu", () => {
  const src = codeNu(SIDEBAR);
  assert.ok(/"hidden md:flex h-screen/.test(src),
    "la colonne latérale n'est plus `hidden md:flex` : elle reprend de la largeur au téléphone");
  // ⚠️ LE POINT QUI COMPTE : les largeurs doivent être PRÉFIXÉES. Une largeur nue
  // s'applique aussi au téléphone et rétablit exactement le défaut.
  assert.ok(/collapsed \? "md:w-\[76px\]" : "md:w-\[232px\]"/.test(src),
    "les largeurs de la barre ne sont plus réservées au bureau : elles volent la place sur mobile");
  assert.ok(!/\bcn\([^)]*"w-\[232px\]"/.test(src), "une largeur nue de 232px est revenue");
});

test("la barre d'onglets est montée dans le layout du tableau de bord, et ne vit que sur mobile", () => {
  const layout = codeNu(LAYOUT);
  assert.ok(/<MobileTabBar\b/.test(layout), "le layout ne monte plus la barre d'onglets : plus de navigation sur téléphone");
  const src = codeNu(BARRE);
  const nav = src.slice(src.indexOf("<nav"), src.indexOf(">", src.indexOf("className", src.indexOf("<nav"))) + 1);
  assert.ok(/md:hidden/.test(nav), "la barre d'onglets s'affiche aussi sur bureau, où la colonne est déjà là");
});

test("les cinq onglets, dans l'ordre demandé : Accueil · Carte · Enregistrer · Calendrier · Plus", () => {
  assert.deepEqual([...ONGLETS_MOBILE],
    ["/dashboard", "/dashboard/trail", "/dashboard/ghost-runner", "/dashboard/calendrier"],
    "l'ordre ou le contenu des onglets a changé");
  const src = codeNu(BARRE);
  // « Plus » est un bouton nommé qui annonce son état ; il ferme la marche.
  const i = src.indexOf("setOuvert((v) => !v)");
  assert.ok(i > 0, "le bouton « Plus » a disparu : tout ce qui n'a pas d'onglet devient inatteignable");
  const debut = src.lastIndexOf("<button", i);
  const bouton = src.slice(debut, src.indexOf(">", src.indexOf("className", debut)) + 1);
  assert.ok(/aria-label=\{d\.plus\}/.test(bouton), "le bouton « Plus » n'a pas de nom accessible");
  assert.ok(/aria-expanded=\{ouvert\}/.test(bouton), "l'état ouvert/fermé de « Plus » n'est pas annoncé");
});

test("« Plus » mène à TOUT ce que la colonne du bureau connaît — calculé, jamais recopié", () => {
  // ⚠️ C'est le risque inverse qu'on écarte : une page atteignable sur bureau et
  // introuvable sur téléphone, parce qu'une liste recopiée à la main aurait été oubliée.
  const toutes = NAV_GROUPES.flatMap((g) => g.items.map((d) => d.href));
  const reste = resteMobile().map((d) => d.href);
  for (const href of toutes) {
    const attendu = !(ONGLETS_MOBILE as readonly string[]).includes(href);
    assert.equal(reste.includes(href), attendu, `${href} ${attendu ? "manque dans" : "ne devrait pas être dans"} « Plus »`);
  }
  assert.ok(reste.length >= 8, `« Plus » ne contient que ${reste.length} destination(s)`);
  // Et le composant n'écrit AUCUNE destination du tableau de bord en dur, hormis les
  // trois entrées de compte qui n'ont jamais été dans la liste (profil, réglages, coach).
  const src = codeNu(BARRE);
  const enDur = [...src.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1])
    .filter((h) => !["/dashboard/profile", "/dashboard/settings", "/admin"].includes(h));
  assert.deepEqual(enDur, [], `destinations écrites en dur dans la barre : ${enDur.join(", ")}`);
  assert.ok(/resteMobile\(\)/.test(src), "la barre ne calcule plus « Plus » depuis la liste partagée");
});

test("naviguer referme la feuille « Plus »", () => {
  // Sans cela, toucher une tuile laisse la feuille ouverte PAR-DESSUS la page demandée :
  // l'athlète croit que rien ne s'est passé et appuie à nouveau.
  const src = codeNu(BARRE);
  assert.ok(/useEffect\(\(\) => \{ setOuvert\(false\); \}, \[pathname\]\)/.test(src),
    "la feuille ne se referme plus au changement de page");
  assert.ok(/onClick=\{\(\) => setOuvert\(false\)\}/.test(src), "le voile ne referme plus la feuille");
});

test("la barre réserve sa place : le pied de page ne finit pas derrière elle", () => {
  // La barre est `fixed` ; une cale EN FLUX de la même hauteur doit exister sous le
  // contenu, sinon l'avertissement médical et les liens légaux sont recouverts.
  const src = codeNu(BARRE);
  assert.ok(/const HAUTEUR = "4rem"/.test(src), "la hauteur de la barre n'est plus une constante partagée");
  assert.ok(/style=\{\{ height: `calc\(\$\{HAUTEUR\} \+ env\(safe-area-inset-bottom\)\)` \}\}/.test(src),
    "la cale ne réserve plus la hauteur de la barre (ni la zone de sécurité iPhone)");
  assert.ok(/style=\{\{ height: HAUTEUR \}\}/.test(src), "la barre n'a plus la hauteur que la cale réserve");
});

test("la bulle d'aide remonte au-dessus de la barre sur mobile, et retrouve son coin sur bureau", () => {
  const src = codeNu("src/components/support/SupportBubble.tsx");
  assert.ok(/fixed bottom-20 right-5 [^"]*md:bottom-5/.test(src),
    "la bulle d'aide se pose sur l'onglet « Plus » (ou ne retrouve pas bottom-5 sur bureau)");
});

test("les libellés de la barre existent dans les cinq langues", () => {
  const src = readFileSync(BARRE, "utf8");
  for (const cle of ["accueil", "carte", "enregistrer", "calendrier", "plus", "tout", "fermer"]) {
    assert.equal([...src.matchAll(new RegExp(`\\b${cle}: "`, "g"))].length, 5, `« ${cle} » manque à une langue`);
  }
});

test("le service worker ne s'installe pas en développement", () => {
  // ⚠️ Il sert /_next/static/ CACHE D'ABORD : juste en production (URL hachées), faux
  // avec `next dev` où la feuille de style garde la même URL. Cinq fois en deux jours,
  // des classes présentes dans le DOM sans règle CSS — un faux bogue Tailwind.
  const src = codeNu("src/components/pwa/PwaClient.tsx");
  const i = src.indexOf('serviceWorker.register("/sw.js")');
  assert.ok(i > 0, "l'enregistrement du service worker a disparu");
  assert.ok(/process\.env\.NODE_ENV !== "production"/.test(src.slice(Math.max(0, i - 400), i)),
    "le service worker s'enregistre aussi en développement : le cache resservira du CSS périmé");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
