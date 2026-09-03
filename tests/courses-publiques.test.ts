/**
 * LES COURSES EN PAGES PUBLIQUES — garde-fous d'un chantier né d'une MESURE.
 *
 * Constat du 03/09/2026 : le sitemap déclarait 7 adresses. Les 17 113 courses vivaient
 * sous `/dashboard/races`, derrière l'authentification ET derrière notre propre
 * `Disallow: /dashboard/`. Le principal actif du site était invisible sur Google.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  estPubliable, estPubliableSansDate, aUneDate, motsUrl, slugCourse, idDepuisSlug, bornesId,
  titrePage, descriptionPage,
  dateEnClair, DATE_INCONNUE,
} from "../src/lib/races/publique";
import { C } from "../src/app/courses/coursesI18n";
import { nomRegion, regionCanonique, regionAvecPreposition, nomAffichable, ECRITURES_REGION } from "../src/lib/races/libelles";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const AUJ = "2026-09-03";
const base = {
  id: "a1b2c3d4-1111-2222-3333-444455556666",
  name: "Trail des Crêtes", city: "Épinal", distance_km: 21.4,
  date: "2026-10-12", registration_url: "https://exemple.fr/inscription",
};

test("une course sans vraie date n'est PAS publiée", () => {
  // ⚠️ 6 411 courses portent « 2099-01-01 », qui ne veut pas dire « en 2099 » mais
  // « date encore inconnue ». Les publier comme des événements datés mentirait au
  // lecteur ET au moteur, qui traite une date d'événement comme une donnée vérifiable.
  assert.equal(estPubliable({ ...base, date: DATE_INCONNUE }, AUJ), false, "la date « à venir » est publiée comme une vraie date");
  assert.equal(estPubliable({ ...base, date: "2099-06-01" }, AUJ), false);
  assert.equal(estPubliable({ ...base, date: "2026-09-02" }, AUJ), false, "une course déjà courue reste en ligne");
  assert.equal(estPubliable({ ...base, date: AUJ }, AUJ), true, "la course du jour est exclue à tort");
  assert.equal(estPubliable(base, AUJ), true);
});

test("on ne publie pas une page qui ne répond à aucune question", () => {
  // Quoi, où, quand, comment s'inscrire. Sans l'un des quatre, la page est creuse —
  // et un moteur classe le remplissage comme tel, pour tout le domaine.
  assert.equal(estPubliable({ ...base, name: "" }, AUJ), false, "sans nom");
  assert.equal(estPubliable({ ...base, name: "AB" }, AUJ), false, "un nom de deux lettres n'est pas un nom");
  assert.equal(estPubliable({ ...base, city: null }, AUJ), false, "sans ville");
  assert.equal(estPubliable({ ...base, registration_url: null }, AUJ), false, "sans lien d'inscription");
  assert.equal(estPubliable({ ...base, registration_url: "   " }, AUJ), false, "un lien vide n'est pas un lien");
  assert.equal(estPubliable({}, AUJ), false);
});

test("l'adresse est lisible mais c'est l'identifiant qui désigne la course", () => {
  // ⚠️ DEUX COURSES PEUVENT PARTAGER NOM ET VILLE (deux distances d'un même événement),
  // et un nom peut être corrigé après coup. Une adresse bâtie sur le seul nom donnerait
  // des collisions aujourd'hui et des liens morts demain.
  const s = slugCourse(base);
  assert.ok(s.startsWith("trail-des-cretes-epinal-21km"), `adresse illisible : ${s}`);
  assert.ok(s.endsWith("a1b2c3d4"), "l'identifiant ne termine pas l'adresse");
  assert.equal(idDepuisSlug(s), "a1b2c3d4");

  const jumelle = slugCourse({ ...base, id: "99998888-0000-0000-0000-000000000000", distance_km: 10 });
  assert.notEqual(s, jumelle, "deux courses de même nom et même ville partagent une adresse");

  // Un nom corrigé ne casse pas le lien déjà indexé : l'identifiant reste le même.
  assert.equal(idDepuisSlug(slugCourse({ ...base, name: "Trail des Crêtes vosgiennes" })), "a1b2c3d4");
});

test("une adresse sans identifiant n'ouvre aucune page", () => {
  for (const mauvais of ["", "trail-des-cretes", "../../etc/passwd", "zzzzzzzz-", "a1b2c3", "GGGGGGGG"]) {
    assert.equal(idDepuisSlug(mauvais), null, `« ${mauvais} » est accepté comme adresse de course`);
  }
  // Huit caractères hexadécimaux, et rien d'autre.
  assert.equal(idDepuisSlug("nom-ville-A1B2C3D4"), "a1b2c3d4", "la casse doit être tolérée");
});

test("les accents et les apostrophes ne cassent pas les adresses", () => {
  assert.equal(motsUrl("Trail de l'Aiguille — Été 2026"), "trail-de-l-aiguille-ete-2026");
  assert.equal(motsUrl("Saint-Étienne-de-Maurs"), "saint-etienne-de-maurs");
  assert.equal(motsUrl("   "), "");
  assert.equal(motsUrl("///"), "");
  // Une adresse ne doit jamais finir par un tiret, même quand le nom est tronqué.
  assert.ok(!motsUrl("a".repeat(80) + " suite").endsWith("-"));
});

test("rien n'est inventé pour remplir un titre ou une description", () => {
  // ⚠️ UNE DISTANCE ABSENTE NE DEVIENT PAS « 10 km » PARCE QUE ÇA SONNERAIT MIEUX.
  const sansDistance = titrePage({ ...base, distance_km: null });
  assert.ok(!/\bkm\b/.test(sansDistance), `une distance a été inventée : ${sansDistance}`);
  assert.ok(sansDistance.includes("Trail des Crêtes") && sansDistance.includes("Épinal"));

  const t = titrePage(base);
  assert.ok(t.includes("21 km") && t.includes("2026"), `titre incomplet : ${t}`);
  // L'année « 2099 » est un repère interne, elle n'a rien à faire dans un titre.
  assert.ok(!titrePage({ ...base, date: DATE_INCONNUE }).includes("2099"));

  const d = descriptionPage({ ...base, elevation_gain_m: 850, department: "Vosges" });
  assert.ok(d.includes("12 octobre 2026") && d.includes("Épinal") && d.includes("850 m D+"), d);
  const sansDplus = descriptionPage({ ...base, elevation_gain_m: null });
  assert.ok(!sansDplus.includes("D+"), "un dénivelé absent est affiché");
  // ⚠️ ET LA PHRASE DE FIN NE DOIT PAS LE PROMETTRE NON PLUS. Une formule figée
  // annonçait « dénivelé » sur des milliers de courses qui n'en ont pas : la promesse
  // est rompue dès le résultat de recherche, avant même le clic.
  assert.ok(!/dénivelé/.test(sansDplus), `la description promet un dénivelé absent : ${sansDplus}`);
  assert.ok(/dénivelé/.test(descriptionPage({ ...base, elevation_gain_m: 850 })), "un dénivelé présent n'est pas annoncé");
  assert.ok(!/distance/.test(descriptionPage({ ...base, distance_km: null, elevation_gain_m: null })),
    "la description promet une distance absente");
  assert.ok(!/undefined|null|NaN/.test(d), `la description laisse fuiter une valeur technique : ${d}`);
});

test("une date se lit en français sans dépendre du fuseau du serveur", () => {
  assert.equal(dateEnClair("2026-10-12"), "12 octobre 2026");
  assert.equal(dateEnClair("2026-01-01"), "1 janvier 2026");
  assert.equal(dateEnClair("2026-08-31"), "31 août 2026");
  for (const mauvais of ["", "pas une date", "2026-13-01", "2026-1-1"]) {
    assert.equal(dateEnClair(mauvais), "", `« ${mauvais} » produit une date`);
  }
});

test("le sitemap et les pages appliquent le MÊME filtre", () => {
  // ⚠️ DÉCLARER UNE ADRESSE QUI RÉPOND 404 FAIT PERDRE LA CONFIANCE DU MOTEUR pour tout
  // le domaine. Le sitemap ne doit donc jamais être plus large que ce que les pages
  // acceptent d'afficher.
  const nu = (f: string) => readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

  const sm = nu("src/app/sitemap.ts");
  assert.ok(/DATE_INCONNUE/.test(sm), "le sitemap ne connaît pas la date « à venir » : il publierait des courses non datées");
  assert.ok(/gte\("date", auj\)/.test(sm), "le sitemap déclare des courses déjà courues");
  assert.ok(/registration_url", "is", null/.test(sm), "le sitemap déclare des courses sans inscription");
  assert.ok(/\/courses\//.test(sm), "les courses ne sont pas déclarées au sitemap");

  const page = nu("src/app/courses/[slug]/page.tsx");
  assert.ok(/estPubliable\(c, jourFrance\(\)\)/.test(page), "la page de détail ne filtre pas comme le sitemap");
  assert.ok(/notFound\(\)/.test(page), "une course non publiable rendrait quand même une page");

  // Le filtre a quitté la page pour le module de catalogue, où il est mis en cache.
  const cat = nu("src/lib/races/catalogue.ts");
  assert.ok(/DATE_INCONNUE/.test(cat), "le catalogue publierait des courses non datées");
  assert.ok(/gte\("date", jourFrance\(\)\)/.test(cat), "le catalogue renverrait vers des courses déjà courues");
  assert.ok(/registration_url", "is", null/.test(cat), "le catalogue renverrait vers des courses sans inscription");
});

test("la page de course se déclare honnêtement", () => {
  const page = readFileSync("src/app/courses/[slug]/page.tsx", "utf8");
  // Le lien sort du site : il ne doit pas transmettre notre réputation ni laisser
  // croire que nous sommes l'organisateur.
  assert.ok(/rel="noopener noreferrer nofollow"/.test(page), "le lien sortant n'est pas marqué");
  // ⚠️ L'AVERTISSEMENT VIT DANS LE DICTIONNAIRE depuis que ces pages sont traduites :
  // on vise donc l'APPEL qui l'affiche, plus la présence du texte dans les 5 langues.
  // Chercher la phrase française dans la page validerait l'ancienne version.
  assert.ok(/t\("cta\.avertissement"\)/.test(page), "la page n'affiche plus l'avertissement de source");
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    const txt = C[lg]["cta.avertissement"] ?? "";
    assert.ok(txt.length > 60, `l'avertissement manque ou est trop court en ${lg}`);
  }
  // Données structurées : uniquement des champs qu'on possède.
  assert.ok(/"@type": "SportsEvent"/.test(page), "aucune donnée structurée : le moteur n'affichera ni date ni lieu");
  assert.ok(/c\.latitude != null && c\.longitude != null/.test(page),
    "les coordonnées sont déclarées même quand elles manquent");
  // Le robots.txt ne doit pas interdire ce qu'on vient d'ouvrir.
  // robots.txt est GÉNÉRÉ (`src/app/robots.ts`), il n'existe pas en fichier statique.
  const robots = readFileSync("src/app/robots.ts", "utf8");
  assert.ok(!/"\/courses/.test(robots), "robots.txt interdit les pages qu'on vient de publier");
  // ⚠️ ET LE DOMAINE DE REPLI DOIT ÊTRE CELUI QU'ON SERT. Il pointait vers
  // « running-trail-empire.vercel.app », qui répond 404 : sans NEXT_PUBLIC_APP_URL, on
  // annonçait aux moteurs un domaine inexistant.
  for (const f of ["src/app/robots.ts", "src/app/sitemap.ts"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(/running-trail-empire-woad\.vercel\.app/.test(src), `${f} a un domaine de repli qui n'est pas servi`);
  }
});

test("une fiche se retrouve par un INTERVALLE d'identifiants, pas par `like`", () => {
  // ⚠️ DÉFAUT CONSTATÉ EN PRODUCTION LE 03/09/2026 : `ilike` sur une colonne `uuid`
  // lève « operator does not exist: uuid ~~* unknown ». L'erreur était avalée et TOUTES
  // les fiches répondaient 404 — alors que le sitemap les déclarait. C'est exactement
  // ce qui fait perdre la confiance d'un moteur pour tout le domaine.
  const b = bornesId("45fb0540");
  assert.ok(b, "un préfixe valide ne produit pas de bornes");
  assert.equal(b!.bas, "45fb0540-0000-0000-0000-000000000000");
  assert.equal(b!.haut, "45fb0540-ffff-ffff-ffff-ffffffffffff");
  // Un identifiant réel doit tomber DANS l'intervalle, bornes comprises.
  const reel = "45fb0540-a488-431f-a24c-59dc5a452f75";
  assert.ok(reel >= b!.bas && reel <= b!.haut, "l'identifiant réel sort de l'intervalle");
  // Un préfixe voisin ne doit PAS l'attraper.
  const voisin = bornesId("45fb0541")!;
  assert.ok(!(reel >= voisin.bas && reel <= voisin.haut), "deux préfixes voisins se recouvrent");
  for (const mauvais of ["", "45fb054", "45fb05400", "zzzzzzzz", "45fb0540'", null, undefined]) {
    assert.equal(bornesId(mauvais as string), null, `« ${String(mauvais)} » produit des bornes`);
  }
  assert.deepEqual(bornesId("45FB0540"), bornesId("45fb0540"), "la casse change les bornes");

  const page = readFileSync("src/app/courses/[slug]/page.tsx", "utf8");
  assert.ok(!/\.ilike\("id"/.test(page), "la recherche par `like` sur un uuid est revenue : toutes les fiches feraient 404");
  assert.ok(/gte\("id", bornes\.bas\)[\s\S]{0,60}lte\("id", bornes\.haut\)/.test(page),
    "la fiche ne se cherche plus par intervalle d'identifiants");
});

test("le sitemap dépasse le plafond de 1 000 lignes de la base", () => {
  // ⚠️ CONSTATÉ EN PRODUCTION : le premier sitemap déployé annonçait 1 022 adresses au
  // lieu de 10 700. PostgREST plafonne une réponse à 1 000 lignes QUEL QUE SOIT le
  // `limit` demandé, et sans message d'erreur — 90 % du catalogue restait invisible.
  const sm = readFileSync("src/app/sitemap.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/\.range\(/.test(sm), "le sitemap ne pagine pas : il s'arrêtera à 1 000 courses");
  // `range` sans `order` explicite fait glisser la pagination d'une page à l'autre.
  assert.ok(/\.order\([\s\S]{0,80}\.order\(/.test(sm), "la pagination n'est pas ordonnée de façon stable");
  assert.ok(/lot\.length < PAS/.test(sm), "la boucle ne s'arrête jamais sur un lot incomplet");
});

// ── LIBELLÉS : ce que lisent Google et les coureurs ─────────────────────────────
test("une région s'écrit en français, pas en identifiant technique", () => {
  // ⚠️ MESURÉ : les 10 700 pages affichaient « Courses et trails en
  // auvergne-rhone-alpes » en titre, en description et dans le fil d'Ariane de chaque
  // fiche. Personne ne cherche ça, et c'est la seule ligne qu'un humain lit dans une
  // liste de résultats.
  assert.equal(nomRegion("auvergne-rhone-alpes"), "Auvergne-Rhône-Alpes");
  assert.equal(nomRegion("ile-de-france"), "Île-de-France");
  assert.equal(nomRegion("provence-alpes-cote-d-azur"), "Provence-Alpes-Côte d'Azur");
  assert.equal(nomRegion("la-reunion"), "La Réunion");
  // Une région inconnue est RENDUE, pas effacée : mieux vaut la voir que faire
  // disparaître des courses parce qu'un libellé manquait à la table.
  assert.equal(nomRegion("region-inventee"), "region-inventee");
  assert.equal(nomRegion(null), "");
});

test("les deux écritures de PACA désignent la même région", () => {
  // ⚠️ MESURÉ : « provence-alpes-cote-azur » (33 courses) et
  // « provence-alpes-cote-d-azur » (1 088) produisaient DEUX filtres, dont un quasi
  // vide — et 33 courses étaient pratiquement introuvables.
  assert.equal(regionCanonique("provence-alpes-cote-azur"), "provence-alpes-cote-d-azur");
  assert.equal(regionCanonique("provence-alpes-cote-d-azur"), "provence-alpes-cote-d-azur");
  assert.equal(nomRegion("provence-alpes-cote-azur"), nomRegion("provence-alpes-cote-d-azur"));
  // Et le filtre doit chercher les DEUX écritures, sinon les 33 restent perdues.
  const e = ECRITURES_REGION["provence-alpes-cote-d-azur"] ?? [];
  assert.ok(e.includes("provence-alpes-cote-azur") && e.includes("provence-alpes-cote-d-azur"),
    `le filtre ne couvre pas les deux écritures : ${JSON.stringify(e)}`);
});

test("un nom de course est écrit comme un titre français, sans abîmer les sigles", () => {
  // 295 noms portaient une majuscule sur un mot-outil — recapitalisation mot à mot
  // d'une source anglophone, pas du français.
  assert.equal(nomAffichable("Ultra Tour Du Mont Ventoux"), "Ultra Tour du Mont Ventoux");
  assert.equal(nomAffichable("Triathlon Saint-Gilles Croix De Vie"), "Triathlon Saint-Gilles Croix de Vie");
  // 89 noms criaient en capitales : illisible en titre de page.
  assert.equal(nomAffichable("LE BERGANTY CHALLENGE"), "Le Berganty Challenge");
  assert.equal(nomAffichable("LA RÉMI CAVAGNA"), "La Rémi Cavagna");
  // ⚠️ ET SURTOUT : 155 SIGLES ATTESTÉS DANS LE CATALOGUE. Une mise en forme mot à mot
  // écrirait « Vtt », « Edf », « Ag2R ».
  // ⚠️ LE SIGLE N'EST EN DANGER QUE DANS UN NOM QUI CRIE : ailleurs, la fonction ne
  // touche à rien de toute façon. Le premier jet testait « Trail VTT 2026 » — casse
  // mixte, donc rien n'était transformé et la garde n'était jamais atteinte. Aucune
  // mutation ne le faisait rougir. Trouvé en supprimant la garde.
  for (const sigle of ["VTT", "EDF", "AG2R", "UCI", "EDHEC", "TERREX"]) {
    const crie = `TRAIL ${sigle} DE MONTAGNE`;
    const sortie = nomAffichable(crie);
    assert.ok(sortie.includes(sigle), `le sigle ${sigle} a été abîmé : ${sortie}`);
    assert.ok(sortie.startsWith("Trail "), `le nom qui crie n'a pas été apaisé : ${sortie}`);
    assert.ok(sortie.includes(" de "), `le mot-outil garde sa majuscule : ${sortie}`);
  }
  // Un nom déjà bien écrit n'est jamais touché : quelqu'un l'a écrit exprès.
  for (const n of ["Trail de l'Aiguille", "10 km de Vouneuil", "SaintéLyon", "EcoTrail Paris"]) {
    assert.equal(nomAffichable(n), n, `« ${n} » a été modifié alors qu'il était correct`);
  }
  assert.equal(nomAffichable(null), "");
  assert.equal(nomAffichable("   "), "");
});

test("chaque région porte SA préposition, pas un « en » universel", () => {
  // ⚠️ UN MODÈLE FIGÉ « en {région} » écrivait « en Grand Est », « en Hauts-de-France »
  // et « en La Réunion » dans le TITRE DE PAGE — la ligne qu'un lecteur français voit
  // dans sa liste de résultats, et ce qui distingue à l'œil nu un site rédigé d'un site
  // généré à la chaîne.
  assert.equal(regionAvecPreposition("bretagne"), "en Bretagne");
  assert.equal(regionAvecPreposition("grand-est"), "dans le Grand Est");
  assert.equal(regionAvecPreposition("hauts-de-france"), "dans les Hauts-de-France");
  assert.equal(regionAvecPreposition("pays-de-la-loire"), "dans les Pays de la Loire");
  assert.equal(regionAvecPreposition("centre-val-de-loire"), "dans le Centre-Val de Loire");
  assert.equal(regionAvecPreposition("la-reunion"), "à La Réunion");
  // La forme fautive ne doit apparaître nulle part.
  for (const r of ["grand-est", "hauts-de-france", "la-reunion", "centre-val-de-loire", "pays-de-la-loire"]) {
    assert.ok(!regionAvecPreposition(r).startsWith("en "), `« en ${nomRegion(r)} » ne se dit pas`);
  }
  assert.equal(regionAvecPreposition(null), "", "une région absente produit une préposition orpheline");
  // Le modèle français ne doit plus porter le « en » : il arrive avec la région.
  assert.ok(!/en \{region\}/.test(C.fr["index.titreRegion"] ?? ""),
    "le modèle français a repris un « en » figé : la préposition serait écrite deux fois");
  assert.ok(/\{region\}/.test(C.en["index.titreRegion"] ?? ""), "le modèle anglais a perdu son paramètre");
});

test("les pages publiques emploient bien ces libellés", () => {
  // Viser les SITES qui produisent l'effet, pas les imports.
  const nu = (f: string) => readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !/^\s*import\b/.test(l))
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  const fiche = nu("src/app/courses/[slug]/page.tsx");
  assert.ok(/nomAffichable\(c\.name\)/.test(fiche), "le titre de la fiche n'est pas mis en forme");
  assert.ok(/nomRegion\(c\.region\)/.test(fiche), "le fil d'Ariane affiche encore l'identifiant technique");
  const rendu = nu("src/app/courses/Liste.tsx");
  assert.ok(/nomAffichable\(c\.name\)/.test(rendu), "la liste affiche les noms bruts");
  const cat = nu("src/lib/races/catalogue.ts");
  assert.ok(/regionCanonique\)/.test(cat), "le catalogue ne regroupe pas les écritures d'une région");
  assert.ok(/\.in\("region", ECRITURES_REGION\[canonique\]/.test(cat), "le filtre ne cherche qu'une seule écriture");
  // ⚠️ LA NAVIGATION PAR RÉGION NE S'ÉCHANTILLONNE PAS. Un `limit(1000)` sans ordre
  // rendait 1 000 lignes arbitraires sur 10 700 : La Réunion, une seule course, en
  // tombait et disparaissait — et la liste changeait d'un déploiement à l'autre.
  assert.ok(!/select\("region"\)[\s\S]{0,200}\.limit\(/.test(cat),
    "la liste des régions est de nouveau un échantillon de 1 000 lignes");
  assert.ok(/select\("region"\)[\s\S]{0,300}\.range\(/.test(cat),
    "la liste des régions ne parcourt pas tout le catalogue");
  const sm = nu("src/app/sitemap.ts");
  assert.ok(/regionCanonique\(/.test(sm), "le sitemap déclare deux adresses pour une même région");
});

test("les pages de région sont engendrées une fois, pas à chaque visite", () => {
  // ⚠️ MESURÉ EN PRODUCTION : `/courses` répondait en 2,45 s (TTFB) contre 0,41 s pour
  // une fiche. La page lisait `searchParams`, ce qui la rend DYNAMIQUE dans Next —
  // `revalidate` ne s'y applique pas — et elle repayait à chaque visite les onze
  // allers-retours servant à construire la liste des régions. Sur les pages qui
  // reçoivent le trafic de recherche, c'est un temps que Google mesure.
  const nu = (f: string) => readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !/^\s*import\b/.test(l))
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

  const region = nu("src/app/courses/region/[slug]/page.tsx");
  // ⚠️ CE TEST EXIGEAIT `generateStaticParams`, ET C'ÉTAIT UNE ERREUR : le build a montré
  // que ces pages restent DYNAMIQUES, parce que `getPublicLang()` lit les cookies. Le
  // pré-rendu n'avait donc jamais lieu, et le test certifiait une optimisation
  // inexistante. Ce qui enlève réellement les 2,45 s, c'est le cache des lectures.
  assert.ok(!/generateStaticParams/.test(region),
    "generateStaticParams est revenu alors que la page lit les cookies : il n'a aucun effet");
  assert.ok(!/searchParams/.test(region), "la page de région lit searchParams : elle repaierait la base par visite");
  assert.ok(/revalidate = \d+/.test(region), "la page de région n'a plus de durée de fraîcheur");

  // Les lectures doivent passer par le cache, pas être refaites dans la page.
  // ⚠️ CHAQUE LECTEUR EXPORTÉ, PAS « AU MOINS UN ». Le premier jet exigeait la présence
  // du motif : muter un seul des deux lecteurs le laissait vert, puisque l'autre le
  // portait encore. Un motif présent N fois ne rougit que si on exige les N.
  const cat = nu("src/lib/races/catalogue.ts");
  const lecteurs = [...cat.matchAll(/export const (\w+) = ([\w.]+)\(/g)];
  assert.ok(lecteurs.length >= 2, `le catalogue n'expose que ${lecteurs.length} lecteur(s)`);
  for (const [, nom, enveloppe] of lecteurs) {
    assert.equal(enveloppe, "unstable_cache",
      `« ${nom} » n'est plus mis en cache : la page repaierait la base à chaque visite`);
  }

  // ⚠️ ET L'ANCIENNE ADRESSE DOIT REDIRIGER. `?region=` a été déclarée au sitemap et
  // soumise aux moteurs : la laisser sans destination transformerait des adresses déjà
  // connues en pages orphelines.
  const index = nu("src/app/courses/page.tsx");
  assert.ok(/permanentRedirect\(`\/courses\/region\/\$\{regionCanonique\(brut\)\}`\)/.test(index),
    "l'ancienne adresse ?region= ne redirige pas DÉFINITIVEMENT : en 307, un moteur garde l'ancienne indexée et ne transmet rien à la nouvelle");
  // Et le sitemap ne doit plus déclarer que la nouvelle forme.
  const sm = nu("src/app/sitemap.ts");
  assert.ok(!/courses\?region=/.test(sm), "le sitemap déclare encore des adresses qui redirigent");
  assert.ok(/\/courses\/region\/\$\{r\}/.test(sm), "le sitemap ne déclare plus les pages de région");
});

// ── LES ÉPREUVES SANS DATE ANNONCÉE ────────────────────────────────────────────
test("une course sans date annoncée obtient une page, mais jamais une fausse date", () => {
  // ⚠️ 6 401 COURSES (37 % DU CATALOGUE) NE PRODUISAIENT AUCUNE PAGE. Leur date porte
  // « 2099-01-01 », qui signifie « prochaine édition non annoncée ». Elles ont pourtant
  // un nom, une ville, une distance et le lien officiel — la réponse à « où et comment
  // courir le Trail des Galopins ? », que des coureurs cherchent toute l'année.
  const sd = { ...base, date: DATE_INCONNUE };
  assert.equal(estPubliableSansDate(sd), true, "une course non datée reste sans page");
  assert.equal(aUneDate(sd), false);
  assert.equal(estPubliable(sd, AUJ), false, "elle ne doit PAS passer par le chemin des courses datées");

  // Les deux prédicats ne doivent jamais se recouvrir : une course a UN statut.
  assert.equal(estPubliableSansDate(base), false, "une course datée passe aussi par le chemin « sans date »");
  assert.equal(aUneDate(base), true);

  // Mêmes exigences de fond : sans quoi, où, ni comment s'inscrire, pas de page.
  for (const manque of [{ name: "" }, { name: "AB" }, { city: null }, { registration_url: "  " }]) {
    assert.equal(estPubliableSansDate({ ...sd, ...manque }), false, `publiée malgré ${JSON.stringify(manque)}`);
  }

  // ⚠️ ET AUCUNE DATE N'APPARAÎT NULLE PART. « 2099 » ne doit jamais devenir
  // « 1 janvier 2099 », ni dans le titre, ni dans la description.
  const t = titrePage(sd), d = descriptionPage(sd);
  assert.ok(!/2099/.test(t + d), `le repère interne fuit à l'écran : ${t} / ${d}`);
  assert.ok(!/janvier 2099|le 1 /.test(d), `une fausse date est écrite : ${d}`);
  assert.ok(!/^.*\bdate\b/i.test(d.split(".").slice(1).join(".")) || !/Date,/.test(d),
    `la description promet une date absente : ${d}`);
});

test("aucune donnée structurée d'événement sans date", () => {
  // ⚠️ `SportsEvent` EXIGE `startDate`. En déclarer un sans date produit une donnée
  // invalide ; en inventer une serait pire, car un moteur affiche cette date dans ses
  // résultats comme un fait vérifié.
  const page = readFileSync("src/app/courses/[slug]/page.tsx", "utf8");
  assert.ok(/!aUneDate\(c\) \? null :/.test(page),
    "les données structurées d'événement sont émises même sans date");
  assert.ok(/\{jsonLd && <script/.test(page), "le bloc est rendu même quand il vaut null");
  // Et la page doit DIRE que la date manque, au lieu de laisser un blanc.
  assert.ok(/sansDate\.titre/.test(page) && /sansDate\.texte/.test(page),
    "la page ne dit pas que la date n'est pas annoncée");
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    assert.ok((C[lg]["sansDate.texte"] ?? "").length > 40, `l'explication manque en ${lg}`);
  }
});

test("le sitemap déclare ces pages, avec une priorité moindre", () => {
  const sm = readFileSync("src/app/sitemap.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/parcourir\(false\)/.test(sm), "les épreuves sans date ne sont pas déclarées au sitemap");
  assert.ok(/gte\("date", DATE_INCONNUE\)/.test(sm), "le sitemap ne sait pas les sélectionner");
  // ⚠️ VISER LE BLOC, PAS LE FICHIER. Le premier jet cherchait « 0.4 » n'importe où :
  // la page de contact en porte déjà un, donc remonter la priorité des épreuves sans
  // date laissait le test vert. Trouvé par mutation.
  const iDatees = sm.indexOf("lignes.filter(exploitable)");
  const iSansDate = sm.indexOf("sansDate.filter(exploitable)");
  assert.ok(iDatees > 0 && iSansDate > iDatees, "les deux blocs d'adresses ne sont plus identifiables");
  const prioDe = (i: number) => {
    const m = /priority: (0\.\d+)/.exec(sm.slice(i, i + 400));
    assert.ok(m, "aucune priorité déclarée dans ce bloc");
    return Number(m![1]);
  };
  assert.ok(prioDe(iSansDate) < prioDe(iDatees),
    `les pages sans date (${prioDe(iSansDate)}) sont annoncées comme équivalentes aux datées (${prioDe(iDatees)})`);
});

console.log(`\n${passed} test(s) des courses publiques passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
