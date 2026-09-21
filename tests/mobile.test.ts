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

test("sur mobile, l'assistant vit dans « Plus », pas en bulle flottante — et il s'ouvre vraiment", () => {
  // Cyprien, 21/09/2026 : la bulle recouvrait le contenu et l'onglet « Plus ».
  const bulle = codeNu("src/components/support/SupportBubble.tsx");
  assert.ok(/fixed bottom-5 right-5 z-50 hidden [^"]*md:flex/.test(bulle),
    "la bulle flottante s'affiche encore sur téléphone (ou a disparu du bureau)");
  // Le panneau, lui, doit se poser AU-DESSUS de la barre d'onglets (4 rem), pas dessous.
  assert.ok(/fixed bottom-20 right-5 z-50 flex w-\[min\(420px/.test(bulle),
    "le panneau d'aide ne se place plus au-dessus de la barre d'onglets sur mobile");
  // La tuile émet l'événement, le panneau l'écoute : vérifier LES DEUX bouts, sinon une
  // tuile muette (ou un panneau sourd) passerait inaperçu.
  const barre = codeNu(BARRE);
  assert.ok(/window\.dispatchEvent\(new CustomEvent\(EVENEMENT_AIDE\)\)/.test(barre), "la tuile « Assistant » n'émet plus l'événement d'ouverture");
  assert.ok(/window\.addEventListener\(EVENEMENT_AIDE, ouvrir\)/.test(bulle), "le panneau d'aide n'écoute plus l'événement de la tuile");
  // Et la tuile referme la feuille, sinon le panneau s'ouvre DERRIÈRE elle (z-[60] > z-50).
  const i = barre.indexOf("new CustomEvent(EVENEMENT_AIDE)");
  assert.ok(/setOuvert\(false\)/.test(barre.slice(Math.max(0, i - 80), i)), "la tuile « Assistant » n'referme pas la feuille avant d'ouvrir le panneau");
});

test("sur mobile, l'avertissement médical part dans « Plus » — mais la ligne Garmin reste", () => {
  // Le bas de l'écran perdait ~120 px sur téléphone (Cyprien, 21/09/2026). L'avertissement
  // et les liens légaux restent à un geste, sur chaque page, dans la feuille « Plus ».
  const layout = codeNu(LAYOUT);
  const cache = layout.indexOf('<div className="hidden shrink-0 md:block">');
  assert.ok(cache > 0, "l'avertissement médical n'est plus masqué sous md dans le layout");
  assert.ok(/<MedicalDisclaimer/.test(layout.slice(cache, layout.indexOf("</div>", cache))),
    "ce qui est masqué sous md n'est pas l'avertissement médical");
  assert.ok(/<MedicalDisclaimer lang=\{lang\} \/>/.test(codeNu(BARRE)), "la feuille « Plus » n'affiche plus l'avertissement médical : il n'est plus nulle part sur téléphone");
  // ⚠️ LA LIGNE GARMIN N'EST PAS UN TEXTE DE CONFORT : c'est l'article 1.1 des conditions
  // de l'API intervals.icu, dont dépend tout le produit. Elle reste sur téléphone —
  // donc HORS du bloc masqué, et sans `hidden` à elle.
  const garmin = layout.indexOf("<AttributionGarmin");
  assert.ok(garmin > 0 && garmin < cache, "l'attribution Garmin est masquée sur téléphone : manquement aux conditions de l'API");
  const balise = layout.slice(garmin, layout.indexOf("/>", garmin));
  assert.ok(!/\bhidden\b/.test(balise), "l'attribution Garmin porte un `hidden`");
});

test("sur téléphone, la séance du jour vient en deuxième, juste sous « Bonjour »", () => {
  // Cyprien, 21/09/2026 : « c'est ce qui est très important sur mon application ».
  // Trois variantes rendent la séance (bannière sans coach, carte compacte, carte
  // complète) : chacune porte `order-first` sous lg, et la colonne est une pile flex.
  const src = codeNu("src/components/dashboard/BentoDashboard.tsx");
  assert.ok(/<div className="flex min-w-0 flex-col lg:block">/.test(src),
    "la colonne principale n'est plus une pile flex sur mobile : `order-first` n'aurait aucun effet");
  const variantes = [...src.matchAll(/order-first[^"]*lg:order-none/g)].length;
  assert.equal(variantes, 3, `${variantes} variante(s) de la séance passent en tête, 3 attendues`);
});

test("sur téléphone, le calendrier s'ouvre en vue Agenda (verticale), décidé côté serveur", () => {
  // La grille Mois fait 700 px : sur 375 px elle se lit en défilant LATÉRALEMENT
  // (Cyprien, 21/09/2026 : « c'est mieux quand je défile »). L'Agenda défile verticalement.
  const page = codeNu("src/app/dashboard/calendrier/page.tsx");
  assert.match(page, /\/Mobi\|Android\|iPhone\|iPad\/i\.test\(\(await headers\(\)\)\.get\("user-agent"\)/,
    "le téléphone n'est plus détecté côté serveur : le premier rendu serait la grille, puis un clignotement");
  assert.match(page, /vueParDefaut=\{surTelephone \? "agenda" : "month"\}/, "la page n'ouvre plus l'Agenda sur téléphone");
  const vue = codeNu("src/components/training/CalendarView.tsx");
  assert.match(vue, /useState<"month" \| "agenda">\(vueParDefaut\)/, "la vue initiale ignore la valeur transmise par le serveur");
});

test("sur téléphone, la carte (Trail Builder) garde ses commandes sur une ligne et ses boutons dans l'écran", () => {
  // Cyprien, 21/09/2026 : « ne rend pas sur téléphone ». Mesuré à 375 px : barre de
  // commandes empilée sur 190 px, indice superposé, troisième bouton hors écran.
  const src = codeNu("src/components/trail/TrailBuilder.tsx");
  assert.match(src, /flex flex-col-reverse items-stretch gap-2 pointer-events-none sm:flex-row/, "la barre du haut n'est plus en colonne sur téléphone : elle s'empile sur la carte");
  assert.match(src, /flex-nowrap overflow-x-auto \[scrollbar-width:none\][^"]*sm:flex-wrap/, "les commandes ne défilent plus sur une ligne sous sm");
  assert.match(src, /w-full max-w-full sm:w-72 sm:max-w-\[44%\]/, "le panneau de droite garde 44 % de large sur téléphone : le troisième bouton sort de l'écran");
  assert.equal([...src.matchAll(/top-32 sm:top-20/g)].length, 2, "les indices se superposent aux commandes sur téléphone");
  // Et la navigation l'appelle « Carte », comme l'onglet du téléphone.
  const i18n = readFileSync("src/lib/i18n/translations.ts", "utf8");
  assert.equal([...i18n.matchAll(/"nav\.trail": "Trail Builder"/g)].length, 0, "l'onglet s'appelle encore « Trail Builder » dans une langue");
  assert.equal([...i18n.matchAll(/"nav\.trail": "(Carte|Map|Karte|Mapa)"/g)].length, 5, "« Carte » manque à une langue");
  // Idem pour le Ghost Runner : « Enregistrer » dans le menu, comme l'onglet central.
  assert.equal([...i18n.matchAll(/"nav\.ghost": "Ghost Runner"/g)].length, 0, "l'onglet s'appelle encore « Ghost Runner » dans une langue");
  assert.equal([...i18n.matchAll(/"nav\.ghost": "(Enregistrer|Record|Aufzeichnen|Grabar|Gravar)"/g)].length, 5, "« Enregistrer » manque à une langue");
});

test("sur téléphone, les mesures d'une activité récente passent sous le titre", () => {
  // Capture de Cyprien, 21/09/2026 : la date pliée sur trois lignes SOUS les chiffres, le
  // titre invisible. Les mesures prennent leur propre ligne (`order-last w-full`) sous sm.
  const src = codeNu("src/components/dashboard/BentoDashboard.tsx");
  assert.match(src, /className="group flex flex-wrap items-center gap-x-4 gap-y-1 p-3 rounded-2xl[^"]*sm:flex-nowrap"/,
    "la ligne d'activité ne se replie plus sur téléphone : les mesures écrasent le titre");
  assert.match(src, /className="order-last flex w-full gap-3 pl-\[52px\] text-sm text-zinc-600 sm:order-none sm:w-auto sm:flex-shrink-0/,
    "les mesures ne passent plus sur leur propre ligne sous le titre");
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
