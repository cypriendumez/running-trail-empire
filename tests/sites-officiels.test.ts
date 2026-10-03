/**
 * LES SITES OFFICIELS DES COURSES À SOURCE FERMÉE (03/10/2026).
 *
 * jogging-plus oppose un défi anti-robot : on ne le contourne pas, on va chercher la source
 * primaire — le site de l'organisateur — par une recherche web, et on ne croit AUCUN
 * candidat sur parole. Les cas viennent d'un essai réel sur 30 courses (relu à la main) :
 * 12 justes retenus, et 4 faux qu'il fallait écarter (portail d'associations, calendrier,
 * média d'agenda, page d'accueil d'une mairie).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { siteCandidatAcceptable, candidatsSite, promptSiteOfficiel, citeLeLieu, dateConcorde, dedicaceFiable, verdictSite, adresseAuNom, titreAuNom, domainesDevines, sansPistage, candidatsOuverts, indexOuvert, type EpreuveARechercher } from "../src/lib/races/siteOfficielWeb";
import { epreuvesDepuisLignes, epreuvesAChercher, chercherSiteOfficiel, chercherSansIA, patchsPourEpreuve, sitesDesJumeaux, fenetreFinDeQuota, REESSAI_JOURS, type LigneCourse } from "../src/lib/races/sitesOfficiels";
import { lirePage } from "../src/lib/races/veille";
import { SITES_EXCLUS } from "../src/lib/races/robot";

let ok = 0, ko = 0;
async function test(nom: string, f: () => void | Promise<void>) {
  try { await f(); ok++; console.log(`  ✓ ${nom}`); } catch (e) { ko++; console.error(`  ✗ ${nom}\n    ${(e as Error).message}`); }
}
const AUJ = "2026-10-03";
const ep = (x: Partial<EpreuveARechercher> & { nom: string }): EpreuveARechercher => ({ ville: null, departement: null, date: null, distances: [], ...x });
const page = (url: string, html: string) => lirePage(`<html><head><title>${html.match(/<h1>(.*?)<\/h1>/)?.[1] ?? ""}</title></head><body>${html}</body></html>`, url, AUJ);

(async () => {
  console.log("\nCANDIDATS — jamais un calendrier, une plateforme, un média ou un office de tourisme");
  await test("les familles de sites qui ne sont pas l'organisateur sont écartées d'office", () => {
    for (const u of [
      "https://www.jogging-plus.com/x", "https://www.finishers.com/course/x", "https://www.kikourou.net/x",
      "https://www.runtrail.run/", "https://unidivers.fr/x", "https://www.facebook.com/trail", "https://www.ouest-france.fr/x",
      "https://www.vendee-tourisme.com/x", "https://www.ot-provins.fr/x", "https://agenda.ville.fr/x",
      "https://www.helloasso.com/associations/x", "https://www.klikego.com/x", "ftp://club.fr/", "pas une adresse",
      // Une plateforme d'inscription et un chronométreur qu'aucune autre liste ne connaît.
      "https://www.billetweb.fr/x", "https://www.wiclax.com/x",
    ]) assert.equal(siteCandidatAcceptable(u), false, u);
    // Un site qui a demandé à ne plus être lu (liste d'opposition) n'est jamais candidat.
    (SITES_EXCLUS as string[]).push("coursedumarais.fr");
    try { assert.equal(siteCandidatAcceptable("https://www.coursedumarais.fr/"), false); }
    finally { (SITES_EXCLUS as string[]).pop(); }
    for (const u of ["https://trailporquerolles.com/", "https://www.coursedumarais.fr/", "https://athleticlondais.wixsite.com/clublam/x"]) {
      assert.equal(siteCandidatAcceptable(u), true, u);
    }
  });

  await test("les candidats : adresses de la réponse d'abord, puis domaines des sources ; un par domaine, quatre au plus", () => {
    const texte = "Le site officiel est https://www.coursedumarais.fr/inscriptions. Voir aussi https://www.coursedumarais.fr/ et https://www.finishers.com/course/x.";
    assert.deepEqual(candidatsSite(texte, ["coursedumarais.fr", "saint-omer.fr", "Article du journal", "lavoixdunord.fr"]),
      ["https://www.coursedumarais.fr/inscriptions", "https://saint-omer.fr/"]);
    assert.equal(candidatsSite("a https://a1.fr b https://a2.fr c https://a3.fr d https://a4.fr e https://a5.fr").length, 4);
    assert.deepEqual(candidatsSite("", []), []);
  });

  await test("la question est posée en clair (pas de JSON : il tue la recherche), avec lieu, date et distances", () => {
    const q = promptSiteOfficiel(ep({ nom: "Course du Marais", ville: "Saint Omer", departement: "Pas-de-Calais", date: "2026-10-04", distances: [10, 5] }));
    assert.match(q, /« Course du Marais » à Saint Omer, Pas-de-Calais/);
    assert.match(q, /édition du 04\/10\/2026/);
    assert.match(q, /Distances : 5 km, 10 km/);
    assert.doesNotMatch(q, /json/i);
    assert.doesNotMatch(promptSiteOfficiel(ep({ nom: "X", date: "2099-12-31" })), /édition du/);
  });

  console.log("\nVERDICT — nommer la course, et la situer (ville, département, ou même date)");
  await test("le bon site est retenu ; un site qui ne nomme pas la course ne l'est jamais", () => {
    const e = ep({ nom: "Course du Marais", ville: "Saint Omer", departement: "Pas-de-Calais", date: "2026-10-04" });
    const v = verdictSite(e, page("https://coursedumarais.fr/", "<h1>Course du Marais</h1><p>Rendez-vous à Saint-Omer le dimanche 4 octobre 2026.</p>"));
    assert.deepEqual(v, { ok: true, force: "site" });
    assert.equal(verdictSite(e, page("https://club-omer.fr/", "<h1>Club</h1><p>Saint-Omer, nos sorties.</p>")).ok, false);
  });

  await test("homonyme : même nom, autre ville, autre date → refusé", () => {
    const e = ep({ nom: "Foulées des Lavoirs", ville: "Montbrison", departement: "Loire", date: "2026-10-11" });
    const v = verdictSite(e, page("https://fouleesdeslavoirs.fr/", "<h1>Foulées des Lavoirs</h1><p>À Quimperlé, le dimanche 7 juin 2026.</p>"));
    assert.equal(v.ok, false);
  });

  await test("ville absente mais MÊME date : retenu (Top Porquerolles Trail, fiche à Hyères)", () => {
    const e = ep({ nom: "Top Porquerolles Trail", ville: "Hyères", departement: "Var", date: "2026-10-03" });
    const p = page("https://trailporquerolles.com/", "<h1>Trail de Porquerolles</h1><p>Le Trail de Porquerolles, samedi 3 octobre 2026 sur l'île.</p>");
    assert.equal(citeLeLieu(p, e.ville, e.departement), false);
    assert.equal(dateConcorde(e, p), true);
    assert.equal(verdictSite(e, p).ok, true);
    // À trois jours d'écart, la date ne suffit plus.
    assert.equal(dateConcorde({ ...e, date: "2026-10-07" }, p), false);
  });

  await test("une course qui ne porte que le nom de sa ville : `arlesassociations.fr` n'est pas son site", () => {
    const e = ep({ nom: "Corrida du SOA Arles", ville: "Arles", departement: "Bouches-du-Rhône", date: "2026-10-03" });
    assert.equal(dedicaceFiable(e, { url: "https://arlesassociations.fr/", titre: "Arles Associations" }), false);
    const portail = page("https://arlesassociations.fr/", "<h1>Arles Associations</h1><p>Corrida du SOA Arles, Arles.</p>");
    assert.equal(verdictSite(e, portail).ok, false, "le portail passait pour dédié");
    assert.equal(dedicaceFiable(e, { url: "https://soa-arles.fr/corrida", titre: "La corrida" }), true);
  });

  await test("page générale ou page d'accueil qui cite la course en passant : refusée", () => {
    const e = ep({ nom: "Foulées de Vertou", ville: "Vertou", departement: "Loire-Atlantique", date: "2026-10-04" });
    const accueil = page("https://vertou.fr/", "<h1>Ville de Vertou</h1><p>Actualités : Foulées de Vertou le dimanche 4 octobre 2026.</p>");
    assert.deepEqual(verdictSite(e, accueil), { ok: false, motif: "page d'accueil qui cite la course en passant" });
    const sansDate = page("https://vertou.fr/sport", "<h1>Sport</h1><p>Les associations organisent les Foulées de Vertou chaque année.</p>");
    assert.equal(verdictSite(e, sansDate).ok, false);
    // La même mention sur une page PRÉCISE, datée près du nom, est acceptée.
    const precise = page("https://vertou.fr/agenda-sportif/octobre", "<h1>Sport en octobre</h1><p>Foulées de Vertou : dimanche 4 octobre 2026.</p>");
    assert.deepEqual(verdictSite(e, precise), { ok: true, force: "texte" });
  });

  await test("une petite ville (« Eu ») ne se retrouve pas dans n'importe quel mot", () => {
    const p = { url: "https://x.fr/", titre: "", texte: "Europe, euros, Eure : rien à voir." };
    assert.equal(citeLeLieu(p, "Eu", null), false);
    assert.equal(citeLeLieu(p, "Eu", "Seine-Maritime"), false);
    assert.equal(citeLeLieu({ ...p, texte: "Seine-Maritime" }, "Eu", "Seine-Maritime"), true);
  });

  await test("l'adresse doit porter le NOM : un seul mot de lieu ne suffit pas (vincennes-hippodrome.com)", () => {
    const semi = ep({ nom: "Semi-marathon du Bois de Vincennes", ville: "Paris", departement: "Paris", date: "2026-10-18" });
    assert.equal(adresseAuNom(semi, "https://www.vincennes-hippodrome.com/fr/"), false);
    assert.equal(titreAuNom(semi, { url: "https://www.vincennes-hippodrome.com/fr/", titre: "Hippodrome de Vincennes" }), false);
    // Même datée au bon jour, la page d'accueil de l'hippodrome n'est pas le site du semi.
    const hippo = page("https://www.vincennes-hippodrome.com/fr/", "<h1>Hippodrome de Vincennes</h1><p>Paris — le 18 octobre 2026, Semi-marathon du Bois de Vincennes au départ de l'hippodrome.</p>");
    assert.equal(verdictSite(semi, hippo).ok, false, "la page d'accueil de l'hippodrome passait pour le site du semi");
    // Une page PRÉCISE qui la cite, mais à une AUTRE date que notre fiche : ni adresse au nom,
    // ni même date — refusée (sans cette règle, le passage « texte » l'aurait acceptée).
    const agenda = page("https://www.vincennes-hippodrome.com/fr/agenda-octobre", "<h1>Agenda d'octobre</h1><p>Paris : Semi-marathon du Bois de Vincennes le dimanche 25 octobre 2026.</p>");
    assert.deepEqual(verdictSite(semi, agenda), { ok: false, motif: "ni adresse au nom de la course, ni la même date sur la page" });
    assert.equal(adresseAuNom(ep({ nom: "20 km de Paris", ville: "Paris" }), "https://harmonie-mutuelle.20kmparis.com/"), true, "le nom complet, chiffres compris");
    assert.equal(adresseAuNom(ep({ nom: "Foulées des Raids Dingues", ville: "Auchay-sur-Vendée" }), "https://www.lesraidsdingues85.fr/"), true, "deux mots distinctifs");
    assert.equal(titreAuNom(ep({ nom: "Top Porquerolles Trail", ville: "Hyères" }), { url: "https://trailporquerolles.com/", titre: "Trail de Porquerolles" }), true);
  });

  await test("« /fr/ » est une page d'accueil comme « / »", () => {
    const e = ep({ nom: "Foulées de Vertou", ville: "Vertou", date: "2026-10-04" });
    const p = page("https://vertou.fr/fr/", "<h1>Ville de Vertou</h1><p>Foulées de Vertou : dimanche 4 octobre 2026.</p>");
    assert.deepEqual(verdictSite(e, p), { ok: false, motif: "page d'accueil qui cite la course en passant" });
  });

  console.log("\nSANS IA — adresses devinées et données ouvertes");
  await test("les adresses devinées : le nom collé ou à tirets, avec ou sans articles, en .fr/.com/.org", () => {
    const d = domainesDevines("Course du Marais");
    for (const u of ["https://coursedumarais.fr/", "https://course-du-marais.com/", "https://coursemarais.org/", "https://course-marais.fr/"]) assert.ok(d.includes(u), u);
    assert.ok(domainesDevines("20 km de Paris").includes("https://20kmparis.com/"));
    assert.deepEqual(domainesDevines("Eco"), [], "trop court : n'importe quel domaine répondrait");
    assert.ok(domainesDevines("Beaujol'Trail").includes("https://beaujoltrail.fr/"));
  });

  await test("les paramètres de pistage ne font pas partie d'une adresse officielle", () => {
    assert.equal(sansPistage("https://lesaiglesdegouvieux.fr/?fbclid=IwY2&utm_source=fb"), "https://lesaiglesdegouvieux.fr/");
    assert.equal(sansPistage("https://x.fr/course?annee=2026&utm_campaign=y"), "https://x.fr/course?annee=2026");
  });

  await test("DATAtourisme propose les sites d'événements de la MÊME commune au nom voisin", () => {
    const idx = indexOuvert([
      { nom: "Les Ragondins en folie", commune: "Cantenay-Épinard", site: "https://www.traildesragondins.fr/?fbclid=x" },
      { nom: "Fête des Ragondins", commune: "Angers", site: "https://angers-fete.fr/" },
      { nom: "Marché de Noël", commune: "Cantenay-Épinard", site: "https://marche.fr/" },
      { nom: "Ragondins nocturne", commune: "Cantenay-Épinard", site: "https://www.anjou-tourisme.com/x" },
    ]);
    assert.deepEqual(candidatsOuverts(ep({ nom: "Trail des Ragondins", ville: "Cantenay Epinard" }), idx), ["https://www.traildesragondins.fr/"]);
    assert.deepEqual(candidatsOuverts(ep({ nom: "Trail des Ragondins", ville: "Écouflant" }), idx), []);
  });

  await test("sans IA, de bout en bout : un domaine qui n'existe pas n'est jamais visité", async () => {
    const e = ep({ nom: "Course du Marais", ville: "Saint Omer", departement: "Pas-de-Calais", date: "2026-10-04" });
    const visites: string[] = [];
    const r = await chercherSansIA(e, AUJ, {
      existe: async (u) => u === "https://coursedumarais.org/",
      lire: async (u: string) => { visites.push(u); return new Response("<html><head><title>Course du Marais</title></head><body>Saint-Omer, dimanche 4 octobre 2026.</body></html>", { status: 200, headers: { "content-type": "text/html" } }); },
    });
    assert.equal(r.url, "https://coursedumarais.org/");
    assert.deepEqual(visites, ["https://coursedumarais.org/"], "un domaine inexistant a été visité");
  });

  console.log("\nQUOTA — la recherche IA ne prend que le reste du jour");
  await test("la fenêtre : les 35 dernières minutes avant minuit, heure du Pacifique (été comme hiver)", () => {
    assert.equal(fenetreFinDeQuota(new Date("2026-10-04T06:40:00Z")), 20, "23 h 40 en Californie (heure d'été)");
    assert.equal(fenetreFinDeQuota(new Date("2026-12-01T07:40:00Z")), 20, "23 h 40 en Californie (heure d'hiver)");
    assert.equal(fenetreFinDeQuota(new Date("2026-10-04T05:40:00Z")), null, "22 h 40 : le quota est encore aux athlètes");
    assert.equal(fenetreFinDeQuota(new Date("2026-12-01T06:40:00Z")), null);
    assert.equal(fenetreFinDeQuota(new Date("2026-10-04T07:10:00Z")), null, "juste après minuit : nouvelle journée, intouchable");
  });

  console.log("\nMOTEUR — épreuves, ordre, lecture polie, écritures");
  const L = (x: Partial<LigneCourse> & { id: string }): LigneCourse => ({ name: "Course du Marais", city: "Saint Omer", department: "Pas-de-Calais", date: "2026-10-04", distance_km: 10, registration_url: "https://www.jogging-plus.com/x/course-du-marais/", ...x });
  await test("les distances d'une même fiche forment UNE épreuve (une recherche, pas trois)", () => {
    const eps = epreuvesDepuisLignes([L({ id: "a" }), L({ id: "b", distance_km: 5, registration_url: "https://www.jogging-plus.com/x/course-du-marais/?d=5" }), L({ id: "c", name: "Autre", registration_url: "https://www.jogging-plus.com/x/autre/" })]);
    assert.equal(eps.length, 2);
    const m = eps.find((e) => e.nom === "Course du Marais")!;
    assert.deepEqual(m.distances.sort(), [10, 5].sort());
    assert.equal(m.lignes.length, 2);
  });

  await test("ordre : la plus proche d'abord, les « à venir » ensuite ; pas de course passée ; pas de re-recherche avant 45 jours", () => {
    const eps = epreuvesDepuisLignes([
      L({ id: "1", name: "Loin", date: "2027-05-01", registration_url: "u1" }),
      L({ id: "2", name: "Proche", date: "2026-10-04", registration_url: "u2" }),
      L({ id: "3", name: "Avenir", date: "2099-12-31", registration_url: "u3" }),
      L({ id: "4", name: "Passée", date: "2026-09-27", registration_url: "u4" }),
      L({ id: "5", name: "Essayée", date: "2026-10-05", registration_url: "u5" }),
    ]);
    const essais = { u5: "2026-09-20" };
    assert.deepEqual(epreuvesAChercher(eps, essais, AUJ, 10).map((e) => e.nom), ["Proche", "Loin", "Avenir"]);
    assert.ok(REESSAI_JOURS >= 30);
    assert.deepEqual(epreuvesAChercher(eps, { u5: "2026-07-01" }, AUJ, 2).map((e) => e.nom), ["Proche", "Essayée"]);
  });

  await test("de bout en bout, sans réseau : la recherche propose, la lecture polie juge, le premier bon gagne", async () => {
    const e = ep({ nom: "Course du Marais", ville: "Saint Omer", departement: "Pas-de-Calais", date: "2026-10-04" });
    const lus: string[] = [];
    const r = await chercherSiteOfficiel(e, AUJ, {
      generer: (async () => ({ ok: true, text: "Voir https://www.kikourou.net/x ou https://faux-site.fr/ ; le vrai : https://coursedumarais.fr/", model: "test", sources: ["coursedumarais.fr"] })) as never,
      lire: async (url: string) => {
        lus.push(url);
        if (url.includes("faux-site")) return new Response("<html><title>Plomberie</title>Saint-Omer</html>", { status: 200, headers: { "content-type": "text/html" } });
        return new Response("<html><head><title>Course du Marais</title></head><body>Saint-Omer, dimanche 4 octobre 2026 — inscriptions ouvertes.</body></html>", { status: 200, headers: { "content-type": "text/html" } });
      },
    });
    assert.equal(r.url, "https://coursedumarais.fr/");
    assert.deepEqual(lus, ["https://faux-site.fr/", "https://coursedumarais.fr/"], "le calendrier n'aurait même pas dû être lu");
    assert.equal(r.candidats[0].motif, "ne nomme pas la course");
    // Une adresse qui REDIRIGE vers un calendrier n'est pas l'organisateur, même si la page nomme la course.
    const redirige = await chercherSiteOfficiel(e, AUJ, {
      generer: (async () => ({ ok: true, text: "https://cdm-saint-omer.fr/", model: "test", sources: [] })) as never,
      lire: async () => ({ ok: true, status: 200, url: "https://www.kikourou.net/calendrier/course-du-marais", headers: new Headers({ "content-type": "text/html" }), text: async () => "<title>Course du Marais</title> Saint-Omer 4 octobre 2026", body: null }) as unknown as Response,
    });
    assert.equal(redirige.url, null);
    assert.match(redirige.candidats[0].motif, /^redirige vers https:\/\/www\.kikourou\.net/);
    // Modèle indisponible (quota) : on le dit, on ne conclut rien.
    const k = await chercherSiteOfficiel(e, AUJ, { generer: (async () => ({ ok: false, error: "quota" })) as never });
    assert.equal(k.indisponible, true);
    assert.equal(k.url, null);
  });

  await test("ce qui s'écrit : le site sur CHAQUE distance, plus ce que la veille tire déjà de la page", () => {
    const e = epreuvesDepuisLignes([L({ id: "a", date: "2099-12-31" }), L({ id: "b", distance_km: 5, date: "2099-12-31" })])[0];
    const p = page("https://coursedumarais.fr/", "<h1>Course du Marais</h1><p>Saint-Omer — dimanche 4 octobre 2026.</p>");
    const patchs = patchsPourEpreuve(e, "https://coursedumarais.fr/", p, AUJ);
    assert.deepEqual(patchs.map((x) => x.id), ["a", "b"]);
    for (const x of patchs) {
      assert.equal(x.patch.site_officiel, "https://coursedumarais.fr/");
      assert.equal(x.patch.date, "2026-10-04", "la date annoncée sur la page officielle n'a pas remplacé « Date à venir »");
      assert.ok(typeof x.patch.veille_at === "string");
    }
  });

  console.log("\nJUMEAUX — le site connu d'une source relue, sans aucune recherche");
  await test("même nom canonique et même ville : le site du jumeau est repris", () => {
    const fermees = [
      L({ id: "a", name: "La Gambade Escalaise", city: "L'Escale", date: "2099-12-31" }),
      L({ id: "b", name: "Trail des Ragondins", city: "Cantenay-Épinard" }),
      L({ id: "c", name: "Trail des Ragondins", city: "Angers" }),
      L({ id: "d", name: "Corrida", city: "Arles" }),
      L({ id: "e", name: "Foulées Roses", city: "" }),
    ];
    const relues = [
      { name: "Gambade Escalaise", city: "L'Escale", site_officiel: "https://gambade-escalaise.fr/" },
      { name: "Trail des Ragondins", city: "Cantenay Epinard", site_officiel: "http://www.traildesragondins.fr/" },
      // Deux jumeaux, deux sites différents : ambigu → rien.
      { name: "Corrida", city: "Arles", site_officiel: "https://corrida-arles.fr/" },
      { name: "Corrida", city: "Arles", site_officiel: "https://soa-arles.fr/" },
      { name: "Foulées Roses", city: "", site_officiel: "https://foulees-roses.fr/" },
    ];
    const s = sitesDesJumeaux(fermees, relues);
    assert.equal(s.get("a"), "https://gambade-escalaise.fr/", "l'article « La » empêche le rapprochement");
    assert.equal(s.get("b"), "http://www.traildesragondins.fr/", "les accents et tirets de la ville empêchent le rapprochement");
    assert.equal(s.has("c"), false, "même nom, AUTRE ville : ce n'est pas la même course");
    assert.equal(s.has("d"), false, "deux sites différents : on ne choisit pas au hasard");
    assert.equal(s.has("e"), false, "sans ville, aucun rapprochement");
  });

  await test("un « site » de jumeau qui est un calendrier ou une plateforme n'est jamais repris", () => {
    const s = sitesDesJumeaux([L({ id: "a" })], [{ name: "Course du Marais", city: "Saint Omer", site_officiel: "https://www.helloasso.com/associations/x" }]);
    assert.equal(s.size, 0);
  });

  await test("le moteur lit chaque erreur, s'arrête si le modèle est indisponible, et ne touche qu'aux fiches à source fermée", () => {
    const src = readFileSync("src/lib/races/sitesOfficiels.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.match(src, /\.like\("registration_url", MOTIF_SOURCE_FERMEE\)\.is\("site_officiel", null\)/);
    assert.match(src, /if \(r\.indisponible\) \{ bilan\.indisponible = true; break; \}/);
    assert.match(src, /if \(error\) \{ bilan\.erreursEcriture\+\+;/);
    assert.match(src, /const lire = deps\.lire \?\? lirePoliment;/, "la lecture ne passe plus par l'accès poli (robots.txt, opposition)");
  });

  console.log("\nAUTOMATISATION — les jumeaux chaque mardi ; la recherche web jamais planifiée en offre gratuite");
  await test("le mardi reprend les sites des jumeaux, sans clé du modèle ni compte d'administration", () => {
    const wf = readFileSync(".github/workflows/courses-rafraichissement.yml", "utf8");
    const i = wf.indexOf("scripts/finishers-appliquer.ts"), j = wf.indexOf("scripts/sites-officiels.ts --jumeaux-seulement --ecrire");
    assert.ok(i > 0 && j > i, "les jumeaux doivent passer APRÈS l'application des fiches finishers");
    const script = readFileSync("scripts/sites-officiels.ts", "utf8");
    assert.ok(script.indexOf('if (process.argv.includes("--jumeaux-seulement")) return;') < script.indexOf("await idEditeur()"),
      "le mode jumeaux exige un compte d'administration que GitHub n'a pas");
  });

  await test("la recherche IA n'est planifiée QU'EN FIN DE JOURNÉE DE QUOTA, et la route le vérifie elle-même", () => {
    const wf = readFileSync(".github/workflows/sites-officiels.yml", "utf8");
    const actif = wf.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    const crons = [...actif.matchAll(/cron: "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(crons, ["35 6 * * *", "35 7 * * *"], "un autre créneau prendrait le quota des athlètes");
    const route = readFileSync("src/app/api/cron/sites-officiels/route.ts", "utf8");
    const garde = route.indexOf("if (fenetre == null && parametres.get(\"force\") !== \"1\")");
    assert.ok(garde > 0 && garde < route.indexOf("traiterLot("), "la route cherche avant de vérifier la fenêtre");
  });

  await test("le passage sans IA tourne chaque semaine sur GitHub, sans clé du modèle", () => {
    const wf = readFileSync(".github/workflows/sites-officiels-gratuits.yml", "utf8");
    assert.match(wf, /scripts\/sites-officiels\.ts rapport-sites\.json --gratuit --fma fma\.csv --ecrire/);
    assert.doesNotMatch(wf, /GEMINI/);
    const script = readFileSync("scripts/sites-officiels.ts", "utf8");
    assert.ok(script.indexOf('if (process.argv.includes("--gratuit")) {') < script.indexOf("await idEditeur()"), "le passage gratuit exige un compte d'administration que GitHub n'a pas");
  });

  console.log(`\n${ok} test(s) des sites officiels passé(s), ${ko} échec(s)`);
  if (ko) process.exit(1);
})();
