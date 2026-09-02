/**
 * CRASH-TESTS DU CATALOGUE DE COURSES.
 *
 * Le catalogue affichait une carte par DISTANCE et non par ÉVÉNEMENT : « Boucles de
 * Saint-Thonan » occupait trois cartes consécutives — 10 km, 9 km, 5 km — même ville,
 * même date, même page d'inscription. Ce ne sont pas des doublons, ce sont les formats
 * d'une seule course ; mais empilés tels quels ils se lisent comme un bug et repoussent
 * les vraies courses suivantes hors de l'écran.
 *
 * Mesuré sur les 15 000 lignes rapatriées : 8 613 événements réels, dont 3 674 à
 * plusieurs distances — 43 % de lignes en moins une fois regroupées.
 *
 * Le regroupement peut se tromper de deux façons, et les deux sont graves :
 *   · fusionner deux courses DIFFÉRENTES (l'athlète en perd une) ;
 *   · séparer deux formats d'une MÊME course (le défaut d'origine revient).
 *
 *   npx tsx tests/courses.crash.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { grouperEvenements, cleEvenement, normNom } from "../src/lib/races/groupes";
import { idCourseValide } from "../src/lib/races/favoris";
import { jourFrance } from "../src/lib/races/jourFrance";
import { typeDepuisUrl, anneeDepuisUrl, choisirFiche, typeCorrige, motsCles, distancesDeFiche, distancesManquantes, typePour, segmentNom, motProche } from "../src/lib/races/leSportif";
import { joursAvant, sansAccents, correspond, domaineSource, ficheVerifiable } from "../src/lib/races/temps";
import { normaliserHeure, afficherHeure } from "../src/lib/races/heure";
import { dateDeLaFiche, doitMettreAJour } from "../src/lib/races/fiche";
import { analyserReponse, promptRecherche, promptExtraction, libelleFormat, libelleDate, MARQUEUR_INCONNU } from "../src/lib/races/heureWeb";
import { trancheAVerifier, appliquerResultats, verdictDe, estSignalee, urlsSignalees, ETAT_VIDE } from "../src/lib/races/liens";

let passed = 0;
const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  KO ${nom}`); }
}

const c = (id: string, name: string, city: string | null, date: string | null, km: number | null) =>
  ({ id, name, city, date, distance_km: km });

console.log("\nREGROUPEMENT — un événement, plusieurs distances");

test("les trois formats de Saint-Thonan font UNE carte", () => {
  const g = grouperEvenements([
    c("a", "Boucles de Saint-Thonan", "Saint-Thonan", "2026-09-01", 10),
    c("b", "Boucles de Saint-Thonan", "Saint-Thonan", "2026-09-01", 9),
    c("d", "Boucles de Saint-Thonan", "Saint-Thonan", "2026-09-01", 5),
  ]);
  assert.equal(g.length, 1, `${g.length} cartes au lieu d'une`);
  assert.deepEqual(g[0].formats.map((f) => f.distance_km), [5, 9, 10], "les distances ne sont pas triées du plus court au plus long");
  assert.equal(g[0].principale.distance_km, 10, "la carte ne porte pas le format principal");
});

test("deux ÉDITIONS d'une même course ne fusionnent jamais", () => {
  // Une course annuelle : même nom, même ville, dates différentes. Les fusionner ferait
  // disparaître une édition entière du catalogue.
  const g = grouperEvenements([
    c("a", "Corrida de Noël", "Issy", "2026-12-20", 10),
    c("b", "Corrida de Noël", "Issy", "2027-12-19", 10),
  ]);
  assert.equal(g.length, 2, "deux éditions ont été fusionnées : une disparaît du catalogue");
});

test("deux villes homonymes ne fusionnent jamais", () => {
  const g = grouperEvenements([
    c("a", "Corrida de Noël", "Issy", "2026-12-20", 10),
    c("b", "Corrida de Noël", "Lyon", "2026-12-20", 10),
  ]);
  assert.equal(g.length, 2, "deux courses de villes différentes ont fusionné");
});

test("la casse et les espaces ne créent pas de faux doublons", () => {
  const g = grouperEvenements([
    c("a", "  Boucles de Saint-Thonan ", "Saint-Thonan", "2026-09-01", 10),
    c("b", "boucles de saint-thonan", "SAINT-THONAN", "2026-09-01", 5),
  ]);
  assert.equal(g.length, 1, "une différence de casse a produit deux cartes");
});

test("l'ordre d'arrivée des événements est conservé", () => {
  // La liste est déjà triée (date, distance, nom…) : réordonner ici ferait mentir le
  // sélecteur de tri sans que rien ne le signale.
  const g = grouperEvenements([
    c("a", "Zèbre", "V", "2026-09-03", 10),
    c("b", "Alpha", "V", "2026-09-01", 10),
    c("d", "Zèbre", "V", "2026-09-03", 5),
    c("e", "Milieu", "V", "2026-09-02", 21),
  ]);
  assert.deepEqual(g.map((x) => x.principale.name), ["Zèbre", "Alpha", "Milieu"], "l'ordre a été modifié");
});

test("aucune course n'est perdue en route", () => {
  const brut = [
    c("a", "A", "V", "2026-09-01", 10), c("b", "A", "V", "2026-09-01", 5),
    c("d", "B", "W", "2026-09-02", 21), c("e", "C", null, null, null),
  ];
  const g = grouperEvenements(brut);
  const ids = g.flatMap((x) => x.formats.map((f) => f.id)).sort();
  assert.deepEqual(ids, ["a", "b", "d", "e"], "des courses ont disparu ou ont été dupliquées");
});

console.log("\nMÊME COURSE, DEUX NOMS — ce qu'on fusionne, et ce qu'on refuse de fusionner");

test("un article de tête ne crée plus deux cartes", () => {
  // ⚠️ MESURÉ SUR LE CATALOGUE : 287 groupes (même ville, même distance) portent des
  // noms différents venus de deux sources. Beaucoup ne diffèrent que d'un article —
  // « La Gambade Escalaise » et « Gambade Escalaise » le MÊME JOUR, deux cartes l'une
  // sous l'autre. Repéré par Cyprien sur les courses de Bondues.
  const g = grouperEvenements([
    c("a", "La Gambade Escalaise", "L'Escale", "2026-09-26", 5),
    c("b", "Gambade Escalaise", "L'Escale", "2026-09-26", 10),
  ]);
  assert.equal(g.length, 1, "l'article « La » suffit encore à dédoubler la carte");
  assert.deepEqual(g[0].formats.map((f) => f.distance_km), [5, 10]);
});

test("accents et ponctuation ne dédoublent pas non plus", () => {
  assert.equal(normNom("La Foulée du Madiran"), normNom("Foulée du Madiran"));
  assert.equal(normNom("Les Foulées de Bondues"), normNom("Foulées de Bondues"));
  assert.equal(normNom("Trail des Pénitents"), normNom("trail des penitents"));
  assert.equal(normNom("La Gambade-Escalaise !"), normNom("Gambade Escalaise"));
});

test("une ville accentuée ou tiretée ne dédouble pas la course", () => {
  const g = grouperEvenements([
    c("a", "Trail X", "L'Escale", "2026-09-26", 5),
    c("b", "Trail X", "l escale", "2026-09-26", 10),
  ]);
  assert.equal(g.length, 1, "la ville écrite autrement dédouble la carte");
});

test("on NE FUSIONNE PAS deux noms réellement différents", () => {
  // « Course de Bondues » et « Foulées de Bondues » sont PEUT-ÊTRE le même événement,
  // mais rien dans les données ne le prouve : sources différentes, dates différentes.
  // Fusionner deux courses distinctes en ferait disparaître une du catalogue — pire
  // que d'en montrer une de trop.
  const g = grouperEvenements([
    c("a", "Course de Bondues", "Bondues", "2027-05-23", 10),
    c("b", "Foulées de Bondues", "Bondues", "2027-05-23", 10),
  ]);
  assert.equal(g.length, 2, "deux courses différentes ont fusionné : l'une disparaît");
  assert.notEqual(normNom("Trail des Cimes"), normNom("Trail des Vignes"));
});

test("un nom réduit à un article ne devient pas une clé vide", () => {
  // « Les » ou « La » seuls : la normalisation ne doit pas produire une chaîne vide qui
  // ferait fusionner toutes ces courses entre elles.
  for (const n of ["Les", "La", "L'", "   "]) {
    const g = grouperEvenements([c("a", n, "V", "2026-01-01", 5), c("b", "Autre", "V", "2026-01-01", 5)]);
    assert.equal(g.length, 2, `« ${n} » a fusionné avec une autre course`);
  }
});

console.log("\nENTRÉES ABÎMÉES — le catalogue est importé, il contient de tout");

test("ville, date ou distance absentes ne font pas planter", () => {
  const g = grouperEvenements([
    c("a", "Sans ville", null, "2026-09-01", 10),
    c("b", "Sans date", "V", null, 10),
    c("d", "Sans distance", "V", "2026-09-01", null),
  ]);
  assert.equal(g.length, 3);
  for (const x of g) assert.ok(x.principale && x.formats.length >= 1, "un événement sans course principale");
});

test("deux courses sans ville ni date ne sont pas fusionnées par leurs trous", () => {
  // Le piège : deux clés « nom::: » identiques pour des courses différentes. C'est le
  // NOM qui doit les séparer, pas les champs vides.
  const g = grouperEvenements([c("a", "Trail X", null, null, 10), c("b", "Trail Y", null, null, 10)]);
  assert.equal(g.length, 2, "deux courses différentes ont fusionné sur leurs champs vides");
});

test("une liste vide, ou des entrées invalides, ne cassent rien", () => {
  assert.deepEqual(grouperEvenements([]), []);
  const g = grouperEvenements([
    null as never, undefined as never, { id: 1 } as never,
    c("ok", "Vraie", "V", "2026-09-01", 10),
  ]);
  assert.equal(g.length, 1, "une entrée invalide a produit une carte");
  assert.equal(g[0].principale.id, "ok");
});

test("distances corrompues : la principale reste définie", () => {
  const g = grouperEvenements([
    c("a", "T", "V", "2026-09-01", NaN as never),
    c("b", "T", "V", "2026-09-01", null),
    c("d", "T", "V", "2026-09-01", 42),
  ]);
  assert.equal(g.length, 1);
  assert.ok(g[0].principale, "aucun format principal");
  assert.equal(g[0].principale.distance_km, 42, "le format principal n'est pas le plus long");
});

test("la clé est stable d'un appel à l'autre", () => {
  const r = c("a", "Trail des Cimes", "Annecy", "2026-09-01", 21);
  assert.equal(cleEvenement(r), cleEvenement({ ...r }), "la clé change entre deux appels : React remonterait les cartes à chaque rendu");
  assert.notEqual(cleEvenement(r), cleEvenement({ ...r, city: "Chamonix" }));
});

test("un très gros catalogue reste groupé correctement", () => {
  const gros = Array.from({ length: 5000 }, (_, i) =>
    c(`id${i}`, `Course ${i % 1000}`, "V", "2026-09-01", (i % 5) + 1));
  const g = grouperEvenements(gros);
  assert.equal(g.length, 1000, `${g.length} événements au lieu de 1000`);
  assert.equal(g.reduce((s, x) => s + x.formats.length, 0), 5000, "des courses ont été perdues");
});

console.log("\nCOMPTE À REBOURS — en nuits, pas en tranches de 86 400 000 ms");

test("J−N ne dépend pas du passage à l'heure d'hiver", () => {
  // L'ancien calcul divisait des millisecondes. Une semaine fait 169 h au passage à
  // l'heure d'hiver : consulté le 20/10/2026 à 00 h 30, le catalogue affichait « J−7 »
  // pour une course à J−6, et sur 35 courses d'affilée. À 8 h du même jour, rien.
  assert.equal(joursAvant("2026-10-26", "2026-10-20"), 6);
  assert.equal(joursAvant("2026-11-01", "2026-10-20"), 12);
  // ... ni du passage à l'heure d'été.
  assert.equal(joursAvant("2026-03-30", "2026-03-20"), 10);
  assert.equal(joursAvant("2026-04-15", "2026-03-20"), 26);
});

test("le jour même vaut 0, la veille vaut 1, une date passée est négative", () => {
  assert.equal(joursAvant("2026-09-01", "2026-09-01"), 0);
  assert.equal(joursAvant("2026-09-02", "2026-09-01"), 1);
  assert.ok((joursAvant("2026-08-30", "2026-09-01") ?? 0) < 0);
});

test("le marqueur « date inconnue » ne produit aucun compte à rebours", () => {
  // 2099-01-01 signifie « Date à venir ». Afficher « J−26 780 » serait absurde.
  assert.equal(joursAvant("2099-01-01", "2026-09-01"), null);
});

test("dates absentes ou illisibles : null, jamais NaN", () => {
  for (const v of ["", "   ", "pas-une-date", "2026-13-45", null, undefined, 42 as never]) {
    const r = joursAvant(v as never, "2026-09-01");
    assert.ok(r === null || Number.isFinite(r), `${JSON.stringify(v)} → ${r}`);
  }
});

test("une année bissextile ne décale rien", () => {
  assert.equal(joursAvant("2028-03-01", "2028-02-28"), 2); // 2028 est bissextile
  assert.equal(joursAvant("2027-03-01", "2027-02-28"), 1);
});

console.log("\nRECHERCHE — un catalogue français se cherche sans accents");

test("chercher sans accent trouve les courses accentuées", () => {
  // 4 425 noms (30 %) et 3 027 villes du catalogue portent un accent.
  assert.ok(correspond("Foulées du paté aux pommes de terre", "foulees"));
  assert.ok(correspond("Pénitents Endurance", "penitents"));
  assert.ok(correspond("Trail Impérial de Bizy", "imperial"));
  assert.ok(correspond("Nîmes", "nimes"));
  assert.ok(correspond("Saint-Étienne", "saint-etienne"));
});

test("chercher AVEC l'accent fonctionne aussi", () => {
  assert.ok(correspond("Foulées du paté", "Foulées"));
  assert.ok(correspond("Nîmes", "Nîmes"));
});

test("la recherche reste discriminante — elle ne matche pas tout", () => {
  assert.equal(correspond("Trail de la Pérouse", "marathon"), false);
  assert.equal(correspond("10 Km d'Houppeville", "trail"), false);
});

test("une recherche vide laisse tout passer", () => {
  for (const q of ["", "   "]) assert.ok(correspond("n'importe quoi", q), `« ${q} » filtre alors qu'il est vide`);
});

test("champs absents : la recherche ne plante pas", () => {
  for (const v of [null, undefined, 0, {}, []]) {
    assert.equal(typeof correspond(v as never, "test"), "boolean", `${JSON.stringify(v)}`);
  }
  assert.equal(sansAccents(null), "");
  assert.equal(sansAccents(undefined), "");
});

test("la casse et les espaces de bord sont ignorés", () => {
  assert.ok(correspond("  Trail des Cimes  ", "TRAIL"));
  assert.ok(correspond("Trail des Cimes", "  cimes  "));
});

console.log("\nPROVENANCE — le catalogue est repris, pas vérifié");

test("le domaine source est extrait sans le « www. »", () => {
  assert.equal(domaineSource("https://www.finishers.com/course/x"), "finishers.com");
  assert.equal(domaineSource("https://jogging-plus.com/course/y"), "jogging-plus.com");
  assert.equal(domaineSource("https://montblanc.utmb.world/races/ccc"), "montblanc.utmb.world");
});

test("une URL absente ou invalide n'affiche AUCUNE provenance", () => {
  // Mieux vaut ne rien dire que d'afficher « Fiche reprise de  » : une mention de source
  // vide se lit comme un bug et fait douter du reste de la fiche.
  for (const v of ["", "   ", "pas une url", "javascript:alert(1)", null, undefined, 42 as never]) {
    const r = domaineSource(v as never);
    assert.ok(r === null || (typeof r === "string" && r.length > 0), `${JSON.stringify(v)} → ${JSON.stringify(r)}`);
  }
  assert.equal(domaineSource(""), null);
  assert.equal(domaineSource("pas une url"), null);
});

test("la mention de provenance ne peut pas rester à trou", () => {
  // Le libellé porte un {d} remplacé par le domaine. S'il manquait dans une langue, la
  // phrase s'afficherait sans sa source — donc sans son intérêt.
  const src = readFileSync("src/components/races/racesI18n.ts", "utf8");
  const mentions = src.match(/"source": "[^"]*"/g) ?? [];
  assert.equal(mentions.length, 5, `${mentions.length} langues au lieu de 5`);
  for (const m of mentions) assert.ok(m.includes("{d}"), `mention sans emplacement de source : ${m.slice(0, 50)}`);
});

console.log("\nCONTRÔLE DES LIENS — une fausse alerte est pire que pas d'alerte");

test("seuls 404 et 410 prouvent l'absence — 403 veut dire « bloqué »", () => {
  // 14 des 40 URL du premier contrôle manuel ont répondu 403 : le site refusait la
  // requête, pas la course. Les compter comme mortes aurait signalé 35 % du catalogue.
  assert.equal(verdictDe(404), "morte");
  assert.equal(verdictDe(410), "morte");
  assert.equal(verdictDe(403), "indetermine");
  assert.equal(verdictDe(429), "indetermine");
  assert.equal(verdictDe(500), "indetermine");
  assert.equal(verdictDe(0), "indetermine");     // délai dépassé / réseau
  assert.equal(verdictDe(200), "vivante");
  assert.equal(verdictDe(301), "vivante");
});

test("il faut DEUX échecs de suite avant de signaler", () => {
  // Un site en maintenance renvoie parfois 404 pendant une heure.
  let e = appliquerResultats(ETAT_VIDE, [{ url: "u", code: 404 }], "t1");
  assert.equal(estSignalee(e, "u"), false, "signalée dès le premier 404");
  e = appliquerResultats(e, [{ url: "u", code: 404 }], "t2");
  assert.equal(estSignalee(e, "u"), true, "toujours pas signalée après deux 404");
});

test("une page revenue en ligne cesse d'être signalée IMMÉDIATEMENT", () => {
  let e = appliquerResultats(ETAT_VIDE, [{ url: "u", code: 404 }], "t1");
  e = appliquerResultats(e, [{ url: "u", code: 404 }], "t2");
  assert.equal(estSignalee(e, "u"), true);
  e = appliquerResultats(e, [{ url: "u", code: 200 }], "t3");
  assert.equal(estSignalee(e, "u"), false, "une course remise en ligne reste signalée");
  assert.deepEqual(urlsSignalees(e), []);
});

test("un 403 entre deux 404 ne remet pas le compteur à zéro, mais ne le fait pas avancer", () => {
  let e = appliquerResultats(ETAT_VIDE, [{ url: "u", code: 404 }], "t1");
  e = appliquerResultats(e, [{ url: "u", code: 403 }], "t2");
  assert.equal(estSignalee(e, "u"), false, "un blocage a suffi à signaler la page");
  e = appliquerResultats(e, [{ url: "u", code: 404 }], "t3");
  assert.equal(estSignalee(e, "u"), true);
});

test("le balayage reprend exactement où il s'est arrêté, et boucle", () => {
  const urls = ["a", "b", "c", "d", "e"];
  const t1 = trancheAVerifier(urls, 0, 2);
  assert.deepEqual(t1.tranche, ["a", "b"]); assert.equal(t1.suivant, 2);
  const t2 = trancheAVerifier(urls, t1.suivant, 2);
  assert.deepEqual(t2.tranche, ["c", "d"]); assert.equal(t2.suivant, 4);
  const t3 = trancheAVerifier(urls, t2.suivant, 2);
  assert.deepEqual(t3.tranche, ["e", "a"], "le balayage ne reboucle pas au début");
});

test("curseur aberrant : on repart d'une position valide, jamais d'un plantage", () => {
  const urls = ["a", "b", "c"];
  for (const c of [-1, -99, 7, 1e9, NaN, 2.7]) {
    const { tranche, suivant } = trancheAVerifier(urls, c as number, 2);
    assert.equal(tranche.length, 2, `curseur ${c} → ${tranche.length} URL`);
    assert.ok(suivant >= 0 && suivant < urls.length, `curseur suivant hors bornes : ${suivant}`);
  }
});

test("catalogue vide ou lot nul : rien à faire, rien qui plante", () => {
  assert.deepEqual(trancheAVerifier([], 0, 10).tranche, []);
  assert.deepEqual(trancheAVerifier(["a"], 0, 0).tranche, []);
});

test("un lot plus grand que le catalogue ne vérifie pas deux fois la même URL", () => {
  const { tranche } = trancheAVerifier(["a", "b"], 0, 50);
  assert.equal(tranche.length, 2, `${tranche.length} URL pour un catalogue de 2`);
  assert.equal(new Set(tranche).size, 2, "la même URL est contrôlée deux fois dans le même passage");
});

test("l'état ne descend au navigateur QUE les URL confirmées", () => {
  let e = appliquerResultats(ETAT_VIDE, [{ url: "morte", code: 404 }, { url: "douteuse", code: 404 }], "t1");
  e = appliquerResultats(e, [{ url: "morte", code: 404 }], "t2");
  assert.deepEqual(urlsSignalees(e), ["morte"], "une URL à un seul échec est envoyée au navigateur");
});

test("URL vide ou absente : ignorée, jamais signalée", () => {
  const e = appliquerResultats(ETAT_VIDE, [{ url: "", code: 404 }, { url: null as never, code: 404 }], "t1");
  assert.deepEqual(urlsSignalees(e), []);
  assert.equal(estSignalee(e, undefined), false);
  assert.equal(estSignalee(e, ""), false);
});

console.log("\nPAGINATION — un range() sans ordre saute des lignes");

test("aucune requête paginée ne balaie une table sans ordre stable", () => {
  // ⚠️ DÉFAUT CONSTATÉ EN PRODUCTION, PAS THÉORIQUE. Le premier passage de la
  // maintenance des courses avait 2 956 lignes à traiter : 2 291 basculées, 665
  // OUBLIÉES — dont « 10 Km de Soustons » et « Ultra Champsaur », les deux exemples
  // que j'avais justement cités comme introuvables. Sans `order`, Postgres ne garantit
  // aucun ordre d'une page à l'autre : `range()` redécoupe un ensemble mouvant et
  // saute des lignes SANS lever la moindre erreur.
  //
  // Un tri sur une colonne non unique ne suffit pas non plus : des milliers de courses
  // partagent la même date. Il faut un départage — d'où l'`id` ajouté partout.
  const fichiers = [
    "src/app/api/cron/races-maintenance/route.ts",
    "src/app/api/races/list/route.ts",
    "src/app/api/races/dedup/route.ts",
    "src/app/api/races/sync/route.ts",
    "src/app/api/cron/races-liens/route.ts",
  ];
  for (const f of fichiers) {
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
    for (const m of src.matchAll(/\.range\(/g)) {
      const deb = src.lastIndexOf("from(", m.index);
      assert.ok(deb >= 0, `${f} : \`.range()\` sans \`from()\` identifiable`);
      const chaine = src.slice(deb, m.index);
      assert.ok(chaine.includes(".order("),
        `${f} : une pagination sans \`order\` — elle sautera des lignes en silence`);
    }
  }
});

console.log("\nHEURE DE DÉPART — refusée plutôt que devinée");

test("les formes courantes d'une affiche de course sont acceptées", () => {
  // On recopie l'heure depuis un mail d'organisateur : « 9h30 », « 9 h 30 », « 09:30 ».
  for (const [saisi, attendu] of [["9h30", "09:30"], ["9 h 30", "09:30"], ["09:30", "09:30"],
                                  ["9h", "09:00"], ["23:59", "23:59"], ["00:05", "00:05"]] as const) {
    assert.equal(normaliserHeure(saisi), attendu, `« ${saisi} »`);
  }
});

test("une heure impossible n'est JAMAIS corrigée en silence", () => {
  // Une heure de départ fausse est pire qu'une heure absente : elle se planifie, et on
  // rate son départ en s'y fiant. On refuse, on ne devine pas.
  for (const v of ["24:00", "25:00", "9h60", "-1:00", "99h99", "midi", "9h30 ou 10h"]) {
    assert.equal(normaliserHeure(v), null, `« ${v} » a été accepté`);
  }
});

test("entrées vides ou corrompues : null, jamais une chaîne bancale", () => {
  for (const v of ["", "   ", null, undefined, 42 as never, {} as never]) {
    assert.equal(normaliserHeure(v as never), null, `${JSON.stringify(v)}`);
    assert.equal(afficherHeure(v as never), null);
  }
});

test("l'affichage français ne s'applique qu'à une heure valide", () => {
  assert.equal(afficherHeure("9h30"), "9 h 30");
  assert.equal(afficherHeure("09:05"), "9 h 05");
  assert.equal(afficherHeure("24:00"), null, "une heure refusée est quand même affichée");
});

test("aucune colonne d'heure n'a été ajoutée au catalogue", () => {
  // ⚠️ VÉRIFIÉ À LA SOURCE : la fiche finishers.com du Marathon de Lille publie
  // `startDate: 2026-10-25` — une DATE, sans heure — et la page n'en contient aucune.
  // Une colonne `start_time` sur `races` serait restée vide sur 17 027 lignes : le
  // défaut « table jamais alimentée », qui finit par afficher un trou que rien ne
  // signale. L'heure vit donc dans l'objectif de l'athlète, qui la connaît vraiment.
  const src = readFileSync("src/app/api/races/sync/route.ts", "utf8");
  assert.ok(!/start_time|startTime\s*:/.test(src),
    "l'importateur écrit une heure que la source ne publie pas");
});

test("la synchronisation morte n'est plus planifiée, et DIT pourquoi", () => {
  // ⚠️ CE TEST A CHANGÉ DE SENS, ET C'EST VOULU. Il exigeait un workflow hebdomadaire.
  // Le premier passage réel a répondu 422 en 5 secondes : `{"calendar":0,"wordpress":0,
  // "ffa":0}`. jogging-plus est passé derrière un défi JavaScript anti-robot — il
  // renvoie 403 à TOUTES les requêtes, `robots.txt` compris. Un serveur ne peut pas le
  // résoudre. Planifier ça chaque dimanche aurait produit un échec hebdomadaire, et un
  // rouge récurrent apprend seulement à ignorer le rouge.
  assert.ok(!existsSync(".github/workflows/races-sync.yml"),
    "une synchronisation qui ne peut que échouer est de nouveau planifiée");
  const route = readFileSync("src/app/api/races/sync/route.ts", "utf8");
  assert.ok(/anti-robot/.test(route),
    "la route ne dit pas pourquoi elle ne ramène rien : le prochain lecteur croira à une panne");
});

test("la date des courses se rafraîchit depuis les données structurées de la fiche", () => {
  // Le vrai remplacement : on visite déjà ces pages pour contrôler les liens, on y lit
  // la date au passage. finishers.com autorise l'exploration et publie du schema.org.
  const src = readFileSync("src/app/api/cron/races-liens/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(src.includes("dateDeLaFiche("), "la date n'est plus lue sur la fiche");
  assert.ok(src.includes("doitMettreAJour("), "la date lue est écrite sans garde-fou");
  assert.ok(src.includes('method: "GET"'), "un HEAD ne renvoie aucun corps : rien à lire");
});

console.log("\nDATE LUE À LA SOURCE — seulement le balisage, jamais le texte");

test("la date sort des données structurées, pas de la prose", () => {
  const ok = `<script type="application/ld+json">{"@type":"SportsEvent","name":"X","startDate":"2026-10-25"}</script>`;
  assert.equal(dateDeLaFiche(ok), "2026-10-25");
  // Une date dans une phrase publicitaire ne doit RIEN écraser : « édition 2025 » a
  // toutes les chances d'être l'édition précédente.
  assert.equal(dateDeLaFiche("<p>Rendez-vous le 2025-06-01 pour l'édition 2025 !</p>"), null);
});

test("balisage absent, cassé ou vide : null, jamais une date inventée", () => {
  for (const h of ["", "<html></html>", '<script type="application/ld+json">pas du json</script>',
                   '<script type="application/ld+json">{"@type":"Article"}</script>']) {
    assert.equal(dateDeLaFiche(h), null, `« ${h.slice(0, 30)} »`);
  }
});

test("une date hors de tout bon sens est refusée", () => {
  for (const d of ["1899-01-01", "2099-01-01", "3000-01-01", "pas-une-date"]) {
    const h = `<script type="application/ld+json">{"@type":"Event","startDate":"${d}"}</script>`;
    assert.equal(dateDeLaFiche(h), null, `${d} accepté`);
  }
});

test("une date-heure ISO est ramenée au jour", () => {
  const h = `<script type="application/ld+json">{"@type":"Event","startDate":"2026-10-25T09:30:00+02:00"}</script>`;
  assert.equal(dateDeLaFiche(h), "2026-10-25");
});

test("on ne recule JAMAIS une course dans le passé", () => {
  // Une fiche garde parfois l'ancienne édition en ligne des semaines après la course.
  // Réécrire avec elle ferait redisparaître la course du catalogue — exactement le
  // défaut qu'on vient de réparer sur 2 956 lignes.
  assert.equal(doitMettreAJour("2026-10-25", "2026-06-01", "2026-09-01"), false);
  assert.equal(doitMettreAJour("2099-01-01", "2026-06-01", "2026-09-01"), false);
});

test("le marqueur « date à venir » est bien remplacé par une vraie date future", () => {
  assert.equal(doitMettreAJour("2099-01-01", "2026-10-25", "2026-09-01"), true);
});

test("une date identique n'écrit rien", () => {
  assert.equal(doitMettreAJour("2026-10-25", "2026-10-25", "2026-09-01"), false);
  assert.equal(doitMettreAJour(null, null, "2026-09-01"), false);
});

console.log("\nHEURE CHERCHÉE SUR LE WEB — enregistrée seulement si elle est prouvée");

test("une heure claire ET sourcée est retenue", () => {
  for (const t of ["09:30", "9h30", "8 h 30"]) {
    const v = analyserReponse(t, ["finishers.com", "lille.fr"]);
    assert.equal(v.retenue, true, `« ${t} » refusé`);
  }
});

test("une heure SANS SOURCE est refusée, même parfaitement formée", () => {
  // Une réponse sans source consultée est une réponse de mémoire — donc une invention
  // possible. Le modèle sonne aussi sûr dans les deux cas : seule la source distingue.
  assert.deepEqual(analyserReponse("09:30", []), { retenue: false, motif: "sans_source" });
  assert.deepEqual(analyserReponse("09:30", undefined), { retenue: false, motif: "sans_source" });
});

test("« INCONNU » est une réponse ACCEPTABLE, pas un échec", () => {
  // C'est le cas le plus fréquent tant que l'organisateur n'a rien publié. Essai réel
  // du 01/09/2026 : l'heure du marathon de Lille n'était pas encore communiquée.
  const v = analyserReponse(MARQUEUR_INCONNU, ["a"]);
  assert.equal(v.retenue, false);
  assert.equal((v as { motif: string }).motif, "inconnu");
});

test("une PHRASE n'est jamais enregistrée comme une heure", () => {
  // « probablement vers 9h » ne survit pas au stockage : on enregistrerait une
  // supposition comme un fait, et l'athlète planifierait dessus.
  for (const t of ["Le départ est probablement vers 9h", "vers 9h30 je pense",
                   "9h30 pour le semi, inconnu pour le marathon"]) {
    assert.equal(analyserReponse(t, ["a"]).retenue, false, `« ${t} » accepté`);
  }
});

test("une heure impossible reste refusée même sourcée", () => {
  for (const t of ["25:00", "9h60", "-1:00"]) {
    assert.equal(analyserReponse(t, ["a"]).retenue, false, `« ${t} » accepté`);
  }
});

test("la recherche est LARGE — c'est le cadrage étroit qui avait fait manquer 11h15", () => {
  // ⚠️ DÉFAUT RÉEL. Le 27/08/2026, La Voix du Nord annonçait « départ à 11h15 » pour le
  // marathon de Lille. Ma première version répondait INCONNU parce qu'elle disait au
  // modèle de chercher « en priorité le site officiel » — dont le règlement dit
  // « Horaire à venir ». Reproduit, puis corrigé : la même question posée largement
  // trouve 11h15, avec marathon-lille.com (section ACTUS) comme source.
  const p = promptRecherche({ race: "Marathon de Lille", raceDate: "2026-10-25", distanceKm: 42.195 });
  assert.ok(/ACTUALIT/i.test(p), "les actualités de l'organisateur sont de nouveau hors du champ");
  assert.ok(/presse locale/i.test(p), "la presse locale est de nouveau exclue : c'est elle qui publie en premier");
  assert.ok(/n'invente jamais/i.test(p), "l'interdiction d'inventer a disparu");
  // Formulée comme un coureur, pas comme une machine : « 42.2 km » produisait des
  // requêtes que personne n'écrirait.
  assert.ok(p.includes("42,195 km (le marathon)"), "la distance est reformulée en machine");
  assert.ok(p.includes("25 octobre 2026"), "la date est en ISO : une recherche web ne se formule pas ainsi");
});

test("l'extraction vise le format demandé, pas la première heure venue", () => {
  // Le texte trouvé contient presque toujours plusieurs départs. Vérifié en vrai sur
  // « le marathon partira à 11h15, le semi à 8h30 » : 11:15 / 08:30 / INCONNU.
  const p = promptExtraction("le marathon à 11h15, le semi à 8h30", { race: "X", raceDate: "2026-10-25", distanceKm: 42.195 });
  assert.ok(p.includes("EXACTEMENT"), "l'extraction n'exige plus le format exact");
  assert.ok(p.includes("42,195 km (le marathon)"));
  assert.ok(p.includes(MARQUEUR_INCONNU), "le modèle n'a pas d'échappatoire : il prendra l'heure du semi");
});

test("les libellés parlent français, comme une requête réelle", () => {
  assert.equal(libelleFormat(42.195), "42,195 km (le marathon)");
  assert.equal(libelleFormat(42.2), "42,195 km (le marathon)");
  assert.equal(libelleFormat(21.1), "21,1 km (le semi-marathon)");
  assert.equal(libelleFormat(10), "10 km");
  assert.equal(libelleFormat(null), "la distance principale");
  assert.equal(libelleDate("2026-10-25"), "25 octobre 2026");
  assert.equal(libelleDate("pas-une-date"), "pas-une-date");
});

test("la recherche web est réellement activée, sinon le modèle répond de mémoire", () => {
  const src = readFileSync("src/app/api/cron/heure-depart/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(src.includes("google_search"), "sans recherche web, le modèle invente une heure plausible");
  // Les sources viennent de l'ÉTAPE 1 (celle qui a cherché), pas de l'extraction :
  // une extraction sans recherche derrière serait une réponse de mémoire.
  assert.ok(src.includes("analyserReponse(ext.text, rech.sources)"),
    "les sources de la RECHERCHE ne sont plus vérifiées : une réponse de mémoire passerait");
  assert.ok(src.includes("promptExtraction("),
    "l'extraction par format a disparu : on prendrait l'heure du semi pour celle du marathon");
  // On n'écrase jamais ce que l'athlète a saisi lui-même.
  assert.ok(src.includes("if (o.heureDepart) continue;"),
    "la recherche écrase une heure saisie par l'athlète, qui en sait plus qu'elle");
});

test("le compteur affiche le nombre de COURSES, pas le nombre de cartes", () => {
  // ⚠️ CE CHOIX A ÉTÉ REPRIS APRÈS COUP. Le regroupement des distances a fait tomber le
  // compteur de 14 071 à 8 975 : Cyprien a lu ça comme une perte de la moitié du
  // catalogue. Rien n'avait été retiré — seule la MISE EN PAGE des cartes changeait.
  // Mais pour un coureur, une « course » est un dossard : le 10 km et le 42 km d'un même
  // week-end sont deux courses, qu'on prépare différemment et qu'on ne peut pas courir
  // toutes les deux. Le grand nombre compte donc les courses, et la sous-ligne dit
  // combien d'événements cela représente — ce qui explique l'écart avec les cartes.
  const src = readFileSync("src/components/races/RacesHub.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/\(totalCount \?\? filtered\.length\) : filtered\.length\)\.toLocaleString/.test(src),
    "le grand compteur est repassé sur le nombre de cartes : le catalogue paraîtra deux fois plus pauvre");
  assert.ok(/\{evenements\.length\.toLocaleString\(lang\)\} \{d\["events"\]\}/.test(src),
    "la sous-ligne n'annonce plus le nombre d'événements : l'écart avec les cartes devient inexplicable");
  const i18n = readFileSync("src/components/races/racesI18n.ts", "utf8");
  assert.equal((i18n.match(/"events": "/g) ?? []).length, 5, "le libellé « événements » manque dans une langue");
});

console.log("\nFAVORIS — un cœur qui ment est pire qu'un cœur absent");

test("seul un identifiant de course réel est accepté", () => {
  // `raceId` part dans un filtre PostgREST (`data->>raceId`) : ce qui vient du
  // navigateur n'a rien à y faire sans contrôle.
  assert.equal(idCourseValide("1e2a5909-a771-4854-8ce5-44a32830b694"), true);
  for (const v of ["", "   ", "abc", "1e2a5909", "1e2a5909-a771-4854-8ce5-44a32830b69",
                   "'; drop table races; --", "../../etc/passwd", null, undefined, 42]) {
    assert.equal(idCourseValide(v as never), false, `${JSON.stringify(v)} accepté`);
  }
});

test("le cœur bascule TOUT DE SUITE, et revient en arrière si l'enregistrement échoue", () => {
  // Un cœur qui attend le serveur donne l'impression que le clic n'a pas pris, et on
  // reclique — ce qui l'annule. Mais mentir sur un enregistrement qui n'a pas eu lieu
  // est pire : en cas d'échec on remet l'état d'avant et on le dit.
  const src = readFileSync("src/components/races/RacesHub.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  const i = src.indexOf("const basculerFavori");
  assert.ok(i > 0, "la bascule du favori a disparu");
  const fn = src.slice(i, i + 900);
  assert.ok(fn.indexOf("setFavoris") < fn.indexOf("await fetch"),
    "le cœur attend le serveur : le clic paraîtra sans effet");
  assert.ok(/catch \{[\s\S]*setFavoris/.test(fn),
    "un échec d'enregistrement laisse un cœur rempli qui ne correspond à rien en base");
});

test("le filtre « mes favoris » existe — sans lui le cœur ne sert à rien", () => {
  const src = readFileSync("src/components/races/RacesHub.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(src.includes("const matchFavori = !filtreFavoris || favoris.has(r.id);"),
    "le filtre favoris ne s'applique plus à la liste : on marque des courses qu'on ne retrouve pas mieux qu'avant");
  assert.ok(src.includes('d["fav.filter"]'), "le bouton de filtre a disparu");
});

test("le bandeau « mes courses à venir » ne revient pas sur le catalogue", () => {
  // Une course planifiée appartient au calendrier. Répétée en tête du catalogue, elle
  // poussait la recherche de courses — seule raison de venir ici — sous la ligne de
  // flottaison.
  const src = readFileSync("src/app/dashboard/races/page.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(!src.includes("plannedDisplay"), "le bandeau des courses planifiées est revenu en tête du catalogue");
});

console.log("\nVÉRIFIABILITÉ — dire ce qu'on ne peut PAS revérifier");

test("finishers est vérifiable, jogging-plus ne l'est pas", () => {
  // 78 % du catalogue vient de finishers.com, qui autorise l'exploration et publie du
  // schema.org : le contrôle nocturne y relit la date et corrige la nôtre.
  // 22 % vient de jogging-plus, passé derrière un défi anti-robot qui répond 403 à
  // TOUTE requête automatique. Ces fiches sont figées à leur date d'import, pour
  // toujours. Laisser croire que les deux se valent se paierait en déplacement inutile.
  assert.equal(ficheVerifiable("https://www.finishers.com/course/x"), true);
  assert.equal(ficheVerifiable("https://finishers.com/course/x"), true);
  assert.equal(ficheVerifiable("https://jogging-plus.com/calendrier/"), false);
  assert.equal(ficheVerifiable("https://www.jogging-plus.com/calendrier/"), false);
});

test("un domaine inconnu est traité comme NON vérifiable", () => {
  // Le doute profite à l'avertissement : on ne prétend jamais avoir vérifié une source
  // qu'on n'a jamais réussi à lire.
  for (const u of ["https://exemple.fr/course", "https://finishers.com.faux.fr/x", "", null, undefined, 42]) {
    assert.equal(ficheVerifiable(u as never), false, `${JSON.stringify(u)} déclaré vérifiable`);
  }
});

test("la mise en garde est affichée quand la source ne peut pas être relue", () => {
  const src = readFileSync("src/components/races/RacesHub.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(src.includes("!ficheVerifiable(details[selected.id]?.registration_url)"),
    "la fiche ne dit plus quand sa source est invérifiable");
  const i18n = readFileSync("src/components/races/racesI18n.ts", "utf8");
  assert.equal((i18n.match(/"unverifiable": "/g) ?? []).length, 5, "la mise en garde manque dans une langue");
});

console.log("\nLE JOUR EN FRANCE — ni UTC, ni l'heure du serveur");

test("à 00 h 49 à Paris, le catalogue est déjà au lendemain", () => {
  // ⚠️ DÉFAUT RÉEL, REPÉRÉ PAR CYPRIEN. Le 02/09/2026 à 00 h 49 heure de Paris, le
  // catalogue proposait encore des courses du 1er septembre — déjà courues. Les trois
  // routes calculaient « aujourd'hui » en UTC, où il était 22 h 49 la veille.
  assert.equal(jourFrance(new Date("2026-09-01T22:49:00Z")), "2026-09-02");
  assert.equal(jourFrance(new Date("2026-09-01T21:00:00Z")), "2026-09-01");
});

test("le résultat ne dépend PAS du fuseau du serveur", () => {
  // Le code tourne sur un serveur Vercel à Washington : s'y fier reculerait de six
  // heures de plus qu'UTC. Les courses ont lieu en France, c'est ce calendrier qui vaut.
  const t = new Date("2026-09-01T22:49:00Z");
  const attendu = jourFrance(t);
  for (const tz of ["UTC", "America/New_York", "Pacific/Auckland"]) {
    process.env.TZ = tz;
    assert.equal(jourFrance(t), attendu, `résultat différent sous ${tz}`);
  }
  delete process.env.TZ;
});

test("le changement d'heure français est pris en compte", () => {
  // Fin octobre la France passe de UTC+2 à UTC+1 : minuit local n'est plus au même
  // instant UTC. Une bascule figée à « +2 h » se tromperait un jour sur deux en hiver.
  assert.equal(jourFrance(new Date("2026-10-24T22:30:00Z")), "2026-10-25"); // encore UTC+2
  assert.equal(jourFrance(new Date("2026-12-01T22:30:00Z")), "2026-12-01"); // UTC+1
  assert.equal(jourFrance(new Date("2026-12-01T23:30:00Z")), "2026-12-02");
});

test("les trois routes du catalogue s'en servent", () => {
  for (const f of ["src/app/dashboard/races/page.tsx", "src/app/api/races/list/route.ts",
                   "src/app/api/races/search/route.ts"]) {
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
    assert.ok(src.includes("const today = jourFrance();"),
      `${f} recalcule « aujourd'hui » autrement : des courses déjà courues réapparaîtront`);
  }
});

test("les deux compteurs de la page ne se contredisent plus", () => {
  // L'en-tête annonçait « 17 027 courses » et le bas de page « 8 860 courses » : le
  // même mot pour deux nombres, sur le même écran. Une carte regroupe les distances
  // d'un même week-end — c'est un ÉVÉNEMENT.
  const i18n = readFileSync("src/components/races/racesI18n.ts", "utf8");
  const lignes = i18n.match(/"pageInfo": "[^"]*"/g) ?? [];
  assert.equal(lignes.length, 5, "la pagination manque dans une langue");
  for (const l of lignes) {
    assert.ok(!/\{n\} (courses|races|carreras|corridas|Rennen)/.test(l),
      `la pagination compte encore des « courses » : ${l}`);
  }
});

console.log("\nTROISIÈME SOURCE — une mauvaise correspondance est pire que pas de correspondance");

test("le type se lit dans l'URL, et « trail-course-nature » n'est pas de la route", () => {
  // Piège d'ordre : « trail-course-nature » CONTIENT « course ». Testé après
  // « course-a-pied-sur-route », il serait classé route — l'inverse du bon résultat.
  assert.equal(typeDepuisUrl("/calendrier/230833/foulees-de-bondues-2027/course-a-pied-sur-route/"), "route");
  assert.equal(typeDepuisUrl("/calendrier/221154/foulees-fressinoises-2026/trail-course-nature/"), "trail");
  assert.equal(typeDepuisUrl("/calendrier/221564/les-coteaux-2026/trail-course-nature-marche/"), "trail");
  assert.equal(typeDepuisUrl("/autre/page"), "inconnu");
  assert.equal(typeDepuisUrl(""), "inconnu");
  assert.equal(typeDepuisUrl(null), "inconnu");
});

test("la fiche d'une AUTRE ANNÉE n'est jamais retenue", () => {
  // Une course annuelle a une fiche par édition. Corriger le type sur la mauvaise année
  // écrirait une donnée qui n'a rien à voir.
  const liens = ["/calendrier/230833/foulees-de-bondues-2026/course-a-pied-sur-route/"];
  assert.equal(choisirFiche(liens, { name: "Foulées de Bondues", date: "2027-05-23" }), null);
  assert.equal(anneeDepuisUrl("/calendrier/1/x-2027/route/"), "2027");
  assert.equal(anneeDepuisUrl("/calendrier/1/x/route/"), null);
});

test("un seul mot en commun ne suffit pas à apparier", () => {
  // « Foulées de Bondues » et « Foulées Argentées » partagent « foulees ». Les
  // confondre écrirait le type de l'une sur l'autre — deux courses réelles, même ville.
  const liens = ["/calendrier/1/les-foulees-argentees-2027/course-a-pied-sur-route/"];
  assert.equal(choisirFiche(liens, { name: "Foulées de Bondues", date: "2027-05-23" }), null);
});

test("deux candidates : on ne tranche pas", () => {
  const liens = [
    "/calendrier/1/trail-des-cimes-2027/trail-course-nature/",
    "/calendrier/2/trail-des-cimes-2027/course-a-pied-sur-route/",
  ];
  assert.equal(choisirFiche(liens, { name: "Trail des Cimes", date: "2027-05-23" }), null,
    "une correspondance ambiguë a été retenue");
});

test("la bonne fiche est retenue quand elle est seule et cohérente", () => {
  const liens = [
    "/calendrier/230833/foulees-de-bondues-2027/course-a-pied-sur-route/",
    "/calendrier/1/les-foulees-argentees-2027/course-a-pied-sur-route/",
  ];
  assert.equal(choisirFiche(liens, { name: "Foulées de Bondues", date: "2027-05-23" }),
    "/calendrier/230833/foulees-de-bondues-2027/course-a-pied-sur-route/");
});

test("entrées vides : aucune correspondance, aucun plantage", () => {
  for (const [l, n, d] of [[[], "X", "2027-01-01"], [["/x"], "", "2027-01-01"],
                           [["/x"], "X", ""], [["/x"], "X", "pas-une-date"]] as [string[], string, string][]) {
    assert.equal(choisirFiche(l, { name: n, date: d }), null);
  }
  assert.deepEqual(motsCles(""), []);
  assert.deepEqual(motsCles("de la du des"), [], "les mots vides comptent comme significatifs");
});

test("la correction ne touche QUE la famille route/trail, jamais la distance", () => {
  // Le cas réel : Foulées de Bondues, 10 km, classée `trail_s` par finishers alors que
  // le-sportif dit « course à pied sur route ».
  assert.equal(typeCorrige("trail_s", "route", 10), "road_10k");
  assert.equal(typeCorrige("road_10k", "trail", 10), "trail_s");
  assert.equal(typeCorrige("road_half", "trail", 21.1), "trail_s");
  assert.equal(typeCorrige("trail_l", "trail", 60), null, "un type déjà cohérent est réécrit pour rien");
  assert.equal(typeCorrige("road_10k", "route", 10), null);
});

test("on ne corrige rien quand la source ne sait pas non plus", () => {
  assert.equal(typeCorrige("trail_s", "inconnu", 10), null);
  assert.equal(typeCorrige("", "route", 10), null);
  assert.equal(typeCorrige(null, "route", 10), null);
});

test("la famille de route suit la distance, comme partout ailleurs", () => {
  assert.equal(typeCorrige("trail_s", "route", 5), "road_5k");
  assert.equal(typeCorrige("trail_s", "route", 21.1), "semi");
  assert.equal(typeCorrige("trail_s", "route", 42.195), "marathon");
  assert.equal(typeCorrige("road_10k", "trail", 100), "ultra");
});

test("les routes qui balaient la table lisent AU-DELÀ de 1 000 lignes", () => {
  // ⚠️ DÉFAUT CONSTATÉ AU PREMIER PASSAGE RÉEL. PostgREST plafonne à 1 000 lignes quel
  // que soit le `limit` demandé : la route de correction des types annonçait
  // `total: 1000` alors que le catalogue compte ~10 600 courses à venir. Le curseur
  // aurait tourné en rond sur le même millier, et 90 % du catalogue n'aurait JAMAIS été
  // examiné. Aucune erreur n'est levée — la requête réussit, elle rend moins que demandé.
  for (const f of ["src/app/api/cron/races-types/route.ts",
                   "src/app/api/cron/races-liens/route.ts",
                   "src/app/api/cron/races-maintenance/route.ts"]) {
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
    assert.ok(!/\.limit\((?:[2-9]\d{3,}|1\d{4,})\)/.test(src),
      `${f} demande plus de 1 000 lignes en un coup : il en recevra 1 000 sans le savoir`);
    assert.ok(src.includes(".range("), `${f} ne pagine pas : il ne verra qu'une partie du catalogue`);
  }
});

console.log("\nDISTANCES DE LA SOURCE — une distance inventée serait une course fantôme");

const meta = (kw: string) => `<html><head><meta name="keywords" lang="fr" content="${kw}" /></head></html>`;

test("les distances se lisent dans le champ structuré, pas dans la prose", () => {
  // Relevé sur trois vraies fiches, de familles différentes.
  assert.deepEqual(distancesDeFiche(meta("bondues, 2027, course à pied (sur route), 10 km, 5 km, 1,5 km")), [1.5, 5, 10]);
  assert.deepEqual(distancesDeFiche(meta("trail, course nature, 10 km, 5 km, 3 km, 1 km")), [1, 3, 5, 10]);
  assert.deepEqual(distancesDeFiche(meta("course à pied (sur route), 42,2 km, 21,1 km, 10 km")), [10, 21.1, 42.2]);
});

test("« 1,5 km » n'est pas coupé en deux par sa propre virgule", () => {
  // ⚠️ PREMIER JET FAUX. Je découpais la liste sur la virgule — or en français elle est
  // AUSSI la virgule décimale. « 1,5 km » devenait « 1 » et « 5 km », la lecture
  // s'arrêtait là, et Bondues ne rendait qu'UNE distance sur trois.
  assert.deepEqual(distancesDeFiche(meta("x, 10 km, 5 km, 1,5 km")), [1.5, 5, 10]);
  assert.deepEqual(distancesDeFiche(meta("x, 21,1 km")), [21.1]);
});

test("on ne remonte pas au-delà de la liste de distances", () => {
  // Un « 2026 » ou un nom de ville plus haut dans les mots-clés ne doit jamais être pris
  // pour une distance. On s'arrête au premier mot-clé qui n'en est pas une.
  assert.deepEqual(distancesDeFiche(meta("marathon, 2026, ville, 10 km")), [10]);
  assert.deepEqual(distancesDeFiche(meta("10 km de la ville, nature, trail")), []);
});

test("balisage absent ou vide : aucune distance, jamais une invention", () => {
  for (const h of ["", "<html></html>", meta(""), meta("course, trail, nature"), meta("2026, 59, nord")]) {
    assert.deepEqual(distancesDeFiche(h), [], `« ${h.slice(0, 40)} »`);
  }
});

test("les distances aberrantes sont écartées", () => {
  // Sous le kilomètre c'est une course d'enfants, au-delà de 200 km une erreur de saisie.
  assert.deepEqual(distancesDeFiche(meta("x, 0,7 km, 500 km, 10 km")), [10]);
});

test("42,2 et 42,195 sont la MÊME distance", () => {
  // Les sources arrondissent différemment. Les traiter comme deux distances créerait un
  // doublon à chaque marathon du catalogue.
  assert.deepEqual(distancesManquantes([42.2], [42.195]), []);
  assert.deepEqual(distancesManquantes([21.1], [21.097]), []);
  assert.deepEqual(distancesManquantes([10], [10.5]), [10.5], "un vrai écart de 500 m a été absorbé");
});

test("seules les distances réellement absentes sont signalées", () => {
  assert.deepEqual(distancesManquantes([10], [5, 10]), [5]);
  assert.deepEqual(distancesManquantes([5, 10], [5, 10]), []);
  assert.deepEqual(distancesManquantes([], [5, 10]), [5, 10]);
  // Des distances corrompues chez nous ne doivent pas masquer un vrai manque.
  assert.deepEqual(distancesManquantes([null, NaN as never, 0], [5]), [5]);
});

test("le type d'une distance AJOUTÉE se déduit du sport ET de la distance", () => {
  // ⚠️ DÉFAUT CONSTATÉ EN BASE. Pour créer une distance manquante j'appelais
  // `typeCorrige("road_5k", vu, d)` — or cette fonction ne répare qu'une incohérence
  // route/trail : « road_5k » face à une fiche de route lui paraissait cohérent, elle
  // rendait null, et mon repli ignorait la distance. Un semi de 21,1 km s'est retrouvé
  // enregistré en « road_5k », et un trail de 26 km aussi.
  assert.equal(typePour("route", 21.1), "semi");
  assert.equal(typePour("route", 10), "road_10k");
  assert.equal(typePour("route", 42.2), "marathon");
  assert.equal(typePour("trail", 26), "trail_s");
  assert.equal(typePour("trail", 60), "trail_l");
  assert.equal(typePour("trail", 100), "ultra");
});

test("le type produit existe DANS L'ENUM de la base, sinon rien ne s'insère", () => {
  // ⚠️ DÉFAUT SILENCIEUX MESURÉ EN BASE. `typePour` rendait « road_half » et
  // « road_marathon » : deux noms que j'ai inventés, absents de l'enum `race_type`.
  // PostgREST refusait l'insertion, le code ignorait l'erreur — donc AUCUN semi ni
  // marathon trouvé à la source n'a jamais pu être ajouté au catalogue, et le rapport
  // de fin annonçait quand même un passage réussi. Sans ce test, la seule façon de s'en
  // apercevoir était de compter les semis manquants un par un.
  const ENUM = new Set(["road_5k", "road_10k", "semi", "marathon", "trail_s", "trail_m", "trail_l", "trail_xl", "ultra"]);
  for (const vu of ["route", "trail"] as const)
    for (const d of [1, 5, 9, 15, 21.1, 30, 42.2, 55, 82, 110, 170]) {
      const t = typePour(vu, d);
      assert.ok(t && ENUM.has(t), `typePour(${vu}, ${d}) = ${t} — absent de l'enum race_type`);
    }
});

test("l'enum attendu par les tests est bien celui de la migration", () => {
  // Le test précédent compare à une liste recopiée : si la migration change, la copie
  // doit changer avec elle, sinon le garde-fou garde une porte qui n'existe plus.
  const sql = readFileSync("supabase/migrations/001_initial_schema.sql", "utf8");
  const m = sql.match(/create type race_type as enum \(([^)]*)\)/);
  assert.ok(m, "définition de race_type introuvable dans la migration");
  const vraies = m![1].split(",").map((x) => x.trim().replace(/'/g, "")).sort().join(",");
  assert.equal(vraies, "marathon,road_10k,road_5k,semi,trail_l,trail_m,trail_s,trail_xl,ultra");
});

test("un sport inconnu ne produit AUCUN type — donc aucune insertion", () => {
  // ⚠️ LE PIRE DÉFAUT DE LA SOIRÉE. le-sportif couvre aussi le vélo. « La Ronde
  // Picarde » existe en course à pied ET en cyclosportive : même nom, même ville, même
  // année. Mon appariement a pris la seconde et importé ses 41, 70, 75, 110 et 150 km
  // dans un catalogue de course à pied. Un 110 km enregistré en « road_5k ».
  assert.equal(typePour("inconnu", 10), null);
  assert.equal(typePour("inconnu", 110), null);
  // Et la route d'enrichissement doit s'arrêter AVANT de lire la fiche.
  const src = readFileSync("src/app/api/cron/races-types/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(src.includes('const fichePage = vu === "inconnu" ? null'),
    "on lit encore la fiche d'un sport inconnu : les distances d'une cyclosportive entreront dans le catalogue");
  assert.ok(src.includes("const t = typePour(vu, d);"),
    "le type inséré ne se déduit plus de la distance");
});

test("un passage long s'arrête à l'échéance en sauvant son avancement", () => {
  // ⚠️ MESURÉ EN PRODUCTION : 115 s pour 25 courses, soit ~4,6 s chacune. Demander 100
  // d'un coup dépasse les 300 s de la fonction : elle serait tuée en vol, le curseur ne
  // serait JAMAIS enregistré, et les mêmes 100 courses seraient reprises chaque nuit
  // indéfiniment — sans qu'aucune erreur ne le signale. C'est le mode de panne le plus
  // coûteux : un travail qui paraît tourner et n'avance jamais.
  const src = readFileSync("src/app/api/cron/races-types/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/const ECHEANCE_MS = \d[\d_]*;/.test(src), "l'échéance a disparu");
  const ech = Number((src.match(/const ECHEANCE_MS = ([\d_]+);/)?.[1] ?? "0").replace(/_/g, ""));
  const max = Number(src.match(/maxDuration = (\d+)/)?.[1] ?? "0");
  assert.ok(ech > 0 && max > 0, "échéance ou durée maximale illisible");
  assert.ok(ech < max * 1000 - 30_000,
    `l'échéance (${ech} ms) laisse moins de 30 s avant la coupure à ${max} s : l'enregistrement du curseur n'aura pas le temps`);
  assert.ok(src.includes("if (Date.now() - debut > ECHEANCE_MS) break;"), "la boucle ne surveille plus le temps");
  // Et le curseur doit refléter ce qui a été VRAIMENT parcouru.
  assert.ok(src.includes("trancheAVerifier(ids, etat.curseur ?? 0, traitees)"),
    "le curseur avance du lot DEMANDÉ et non du travail fait : les courses non traitées seraient sautées");
});

test("le CHEMIN DU SPORT ne fournit aucun mot à l'appariement", () => {
  // ⚠️ FAUX IMPORT PROUVÉ EN BASE. Une URL le-sportif finit par le segment du sport :
  // « /trail-course-nature/ ». En comparant l'URL ENTIÈRE, « Course Nature Via Agrippa »
  // (Saint-Auvent, 87) trouvait « course » et « nature » dans ce chemin, sur N'IMPORTE
  // quel trail. Elle a été appariée au « Saint-Jean-de-Védas Trail » (34) et en a
  // importé les 8, 16 et 32 km — trois distances d'une course à 400 km de là.
  assert.equal(segmentNom("/calendrier/230125/saint-jean-de-vedas-trail-2027/trail-course-nature/"),
    "saint-jean-de-vedas-trail-2027");
  assert.equal(choisirFiche(["/calendrier/230125/saint-jean-de-vedas-trail-2027/trail-course-nature/"],
    { name: "Course Nature Via Agrippa", date: "2027-02-22" }), null,
    "deux mots pris dans le chemin du sport ont suffi à importer les distances d'une autre course");
});

test("un mot du nom absent de la fiche interdit l'appariement", () => {
  // ⚠️ « Les Foulées Lieu Saint Amandinoises » (59) a pris ses 5 et 10 km chez les
  // « Foulées Saint-Pierroises » (58) : deux mots communs, « foulees » et « saint »,
  // suffisaient. « lieu » et « amandinoises » — les deux qui désignent la course —
  // étaient ignorés.
  assert.equal(choisirFiche(["/calendrier/227031/foulees-saint-pierroises-2026-saint-pierre-le-moutier/course-a-pied-sur-route/"],
    { name: "Les Foulées Lieu Saint Amandinoises", date: "2026-09-20" }), null);
  // Et le cas fondateur : une course d'enfants n'est pas la course adulte du même lieu.
  assert.equal(choisirFiche(["/calendrier/1/trail-d-antibes-2027/trail-course-nature/"],
    { name: "Kids trail d'Antibes", date: "2027-03-20" }), null,
    "sans le mot « kids », la fiche adulte aurait donné son 40 km à une course d'enfants");
  assert.equal(choisirFiche(["/calendrier/229310/kids-trail-antibes-2027/trail-course-nature/"],
    { name: "Kids trail d'Antibes", date: "2027-03-20" }),
    "/calendrier/229310/kids-trail-antibes-2027/trail-course-nature/");
});

test("« st » vaut « saint », et le pluriel ne casse pas l'appariement", () => {
  // Exiger le mot exact rejetait des appariements JUSTES : la source abrège
  // « Saint-Saturnin » en « st-saturnin », et écrit parfois le singulier.
  assert.ok(motProche("saint", "st") && motProche("foulee", "foulees") && motProche("amandinoise", "amandinoises"));
  // …mais la tolérance reste bornée : sans la limite de deux lettres, « mont »
  // avalerait « montigny » et l'exigence de mots entiers ne servirait plus à rien.
  assert.ok(!motProche("mont", "montigny"));
  assert.ok(!motProche("val", "vallee"), "trois lettres ne peuvent pas désigner un mot de six");
  assert.equal(choisirFiche(["/calendrier/221248/corrida-de-noel-2026-st-saturnin/course-a-pied-sur-route/"],
    { name: "Corrida de Noël de Saint-Saturnin", date: "2026-12-14" }),
    "/calendrier/221248/corrida-de-noel-2026-st-saturnin/course-a-pied-sur-route/");
});

test("un mot de GENRE peut manquer de la fiche, un mot identifiant non", () => {
  // Notre catalogue écrit « Trail La Cépienne » là où la source écrit « la-cepienne » :
  // exiger « trail » rejetait un appariement pourtant juste (même ville, même année,
  // 20 km présent à la source). Le mot de genre décrit le format, pas l'épreuve.
  assert.equal(choisirFiche(["/calendrier/222665/la-cepienne-2026-st-jean-de-la-porte/trail-course-nature/"],
    { name: "Trail La Cépienne", date: "2026-10-06" }),
    "/calendrier/222665/la-cepienne-2026-st-jean-de-la-porte/trail-course-nature/");
  // Mais un nom fait UNIQUEMENT de mots de genre n'identifie rien : on refuse plutôt
  // que d'apparier au premier trail venu de la même ville.
  assert.equal(choisirFiche(["/calendrier/9/le-grand-trail-2026-annecy/trail-course-nature/"],
    { name: "Trail Nature", date: "2026-10-06" }), null);
});

test("une annotation entre parenthèses n'empêche pas l'appariement", () => {
  // « Les Boucles Vauban (Decathlon) » : le sponsor est dans notre libellé, jamais dans
  // le slug de la source. Sans ce nettoyage, la course perdait son semi.
  assert.equal(choisirFiche(["/calendrier/9/les-boucles-vauban-2026-besancon/course-a-pied-sur-route/"],
    { name: "Les Boucles Vauban (Decathlon)", date: "2026-09-20" }),
    "/calendrier/9/les-boucles-vauban-2026-besancon/course-a-pied-sur-route/");
});

test("une insertion refusée par la base est SIGNALÉE, jamais avalée", () => {
  // Commentaires retirés : sans cela le test se contenterait de sa propre explication.
  const src = readFileSync("src/app/api/cron/races-types/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(src.includes("refusees++"), "une insertion refusée doit être comptée");
  assert.ok(src.includes("ok: refusees === 0"),
    "le rapport doit annoncer l'échec : c'est le `ok: true` inconditionnel qui a caché les types hors enum");
});

test("une randonnée n'est pas une corrida, même dans la même ville", () => {
  // ⚠️ FAUX IMPORT CONSTATÉ EN BASE le 02/09/2026. « Randonnée de Sassenage » a pris les
  // 5 km et 11 km de la « Corrida de Sassenage » : j'avais rangé « randonnée » et
  // « marche » parmi les mots de GENRE, facultatifs. Une fois « randonnee » écarté, il ne
  // restait que « sassenage » — le nom de la ville, qui est déjà la clé de recherche et
  // ne distingue donc RIEN. Une marche et une corrida ne sont pas deux façons de dire la
  // même chose : ce sont deux épreuves, deux jours, deux publics.
  assert.equal(choisirFiche(["/calendrier/222427/corrida-de-sassenage-2026/course-a-pied-sur-route/"],
    { name: "Randonnée de Sassenage", date: "2026-09-26", city: "Sassenage" }), null);
  assert.ok(choisirFiche(["/calendrier/222427/corrida-de-sassenage-2026/course-a-pied-sur-route/"],
    { name: "Corrida de Sassenage", date: "2026-09-26", city: "Sassenage" }), "la vraie corrida doit s'apparier");

  // ⚠️ CAS QUI ISOLE LA LISTE DES MOTS DE GENRE, et lui seul. Ici la commune n'est PAS le
  // seul mot identifiant (« cretes » l'est aussi), donc la règle conditionnelle ne
  // s'applique pas : si « randonnee » redevenait un mot de genre, une randonnée
  // s'apparierait à un trail portant le même nom de lieu. Sans ce cas, les deux
  // correctifs se recouvrent et aucune mutation ne les distingue.
  assert.equal(choisirFiche(["/calendrier/9/trail-des-cretes-2026-gorbio/trail-course-nature/"],
    { name: "Randonnée des Crêtes", date: "2026-10-04", city: "Gorbio" }), null,
    "une randonnée s'est appariée au trail du même lieu");
  assert.ok(choisirFiche(["/calendrier/9/trail-des-cretes-2026-gorbio/trail-course-nature/"],
    { name: "Trail des Crêtes", date: "2026-10-04", city: "Gorbio" }));
});

test("un nom réduit à sa commune reste appariable par son mot de genre", () => {
  // ⚠️ ET LE CORRECTIF NE DOIT PAS ÊTRE PIRE QUE LE DÉFAUT. Refuser tout nom dont le seul
  // mot identifiant est la commune rejetait « Trail de Gorbio », « Le Montagrier Trail »
  // et « Semi-Marathon d'Antony » — trois appariements JUSTES, vérifiés à la source. Le
  // mot de genre n'est facultatif que tant qu'autre chose identifie l'épreuve ; dès qu'il
  // est seul à le faire, il redevient obligatoire.
  for (const [nom, ville, slug] of [
    ["Trail de Gorbio", "Gorbio", "/calendrier/1/trail-de-gorbio-2026/trail-course-nature/"],
    ["Le Montagrier Trail", "Montagrier", "/calendrier/1/le-montagrier-trail-2026/trail-course-nature/"],
    ["Semi-Marathon d'Antony", "Antony", "/calendrier/1/semi-marathon-d-antony-2026/course-a-pied-sur-route/"],
  ] as const) {
    assert.ok(choisirFiche([slug], { name: nom, date: "2026-10-04", city: ville }), `${nom} rejeté à tort`);
  }
  // …et le mot de genre ne suffit évidemment pas seul.
  assert.equal(choisirFiche(["/calendrier/1/trail-de-gorbio-2026/trail-course-nature/"],
    { name: "Corrida de Gorbio", date: "2026-10-04", city: "Gorbio" }), null);

  // ⚠️ CAS QUI ISOLE LA RÈGLE CONDITIONNELLE, et elle seule. « Course » EST un mot de
  // genre ; la commune est le seul autre mot. Si le genre restait facultatif dans cette
  // situation, il ne resterait plus rien pour distinguer « Course de Gorbio » du « Trail
  // de Gorbio » — c'est exactement le mécanisme qui a fait entrer la corrida de
  // Sassenage dans une randonnée. On préfère ne pas apparier.
  assert.equal(choisirFiche(["/calendrier/1/trail-de-gorbio-2026/trail-course-nature/"],
    { name: "Course de Gorbio", date: "2026-10-04", city: "Gorbio" }), null,
    "sans mot distinctif hors la commune, le genre doit trancher");
});

test("la ville est bien transmise à l'appariement", () => {
  // Sans elle, la règle conditionnelle ne peut pas savoir qu'un mot est le nom de la
  // commune : elle retomberait sur le comportement qui a produit le faux import.
  const src = readFileSync("src/app/api/cron/races-types/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  // ⚠️ `[^)]*` s'arrêtait à la première parenthèse fermante — celle de `String(...)` —
  // et le test rougissait sur un code JUSTE. Un test faux coûte plus cher qu'un test
  // absent : il fait douter du code correct.
  assert.match(src, /choisirFiche\(liens,[\s\S]{0,240}?city:/, "la route n'envoie pas la ville à `choisirFiche`");
});

console.log(`\n${passed} crash-test(s) du catalogue passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
