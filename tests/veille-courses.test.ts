/**
 * LA VEILLE DES PAGES OFFICIELLES — résultats, dates, inscriptions, parcours (01/10/2026).
 *
 * Cyprien : « ajoute les liens pour Lambersart, fais bien pour toutes les courses, et aussi
 * les parcours ; crée des sortes de bots qui mettent instantanément les liens, les dates,
 * les résultats quand ça sort ». La page de la ville de Lambersart publie « Résultats 10km »
 * puis un lien « Télécharger » : le lien seul ne disait rien, il était ignoré.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { libelleDuLien, distancesNommees, choisirParDistance, liensResultatsCandidats } from "../src/lib/races/resultatsSite";
import { liensParcours, parcoursPour } from "../src/lib/races/parcoursSite";
import { lirePage, deciderVeille, pageDediee, sansMenus, motsCourse } from "../src/lib/races/veille";
import { fraicheurVeille, aRelire } from "../src/lib/races/veilleCourse";
import { lienSortantPropre } from "../src/lib/races/lienPropre";
import { LiensCourse } from "../src/components/races/LiensCourse";
import { RX } from "../src/components/races/racesI18n";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:"'])\/\/.*$/, "$1")).join("\n");
const AUJ = "2026-10-01";
const TOUT = { confirmee: true, parcours: true };

// La page réelle, réduite à l'essentiel (lambersart.fr, lue le 01/10/2026).
const LAMBERSART = `<html><head><title>40e Foulées lambersartoises : retrouvez les résultats | Ville de Lambersart</title></head><body>
<nav><a href="/billetterie">Billetterie</a><a href="/inscriptions-cafe-des-parents">Inscriptions Café des Parents</a></nav>
<h1>40e Foulées lambersartoises : retrouvez les résultats et le retour en images</h1>
<p>Dimanche 27 septembre, Lambersart a vibré au rythme de la course à pied à l'occasion de la 40e édition des Foulées lambersartoises.</p>
<div class="document"><div class="document__text"> Résultats 10km</div><a href="/download/file/24071?key=a%3D">Télécharger</a> Taille : 422 Ko · pdf · Publié le 27 Sep. 2026</div>
<div class="document"><div class="document__text"> Résultats 5km</div><a href="/download/file/24069?key=b%3D">Télécharger</a> Publié le 27 Sep. 2026</div>
<div class="document"><div class="document__text"> Résultats 2km</div><a href="/download/file/24070?key=c%3D">Télécharger</a> Publié le 27 Sep. 2026</div>
<footer><a href="/sinscrire-la-newsletter">Je m'abonne</a></footer></body></html>`;
const URL_L = "https://lambersart.fr/foulees-lambersartoises";
const course = (x: Partial<Parameters<typeof deciderVeille>[0]>) => ({ id: "x", name: "Foulées Lambersartoises 10 km", date: "2027-09-26", date_confirmee: false, distance_km: 10, ...x });

test("un lien MUET (« Télécharger ») prend le libellé écrit juste avant lui", () => {
  const i = LAMBERSART.indexOf('<a href="/download/file/24071');
  assert.equal(libelleDuLien(LAMBERSART, i, "Télécharger"), "Résultats 10km");
  assert.equal(libelleDuLien(LAMBERSART, i, "Classement général"), "Classement général", "un vrai libellé est remplacé");
  // La coupe tombée au milieu d'une balise ne laisse pas de déchet (« …ument__text"> »).
  assert.ok(!/["<>=]/.test(libelleDuLien(LAMBERSART, i, "PDF")));
  for (const h of ["", "<a", "x".repeat(10)]) assert.equal(typeof libelleDuLien(h, h.length, "ici"), "string");
  // Un attribut démesuré : la fenêtre de 500 caractères commence AU MILIEU de la balise.
  const long = `<div class="${"x".repeat(600)}">Résultats 10km</div><a href="/r.pdf">Télécharger</a>`;
  assert.equal(libelleDuLien(long, long.indexOf("<a href"), "Télécharger"), "Résultats 10km", "un morceau de balise coupée entre dans le libellé");
});

test("chaque distance reçoit SON classement ; une autre distance n'est jamais prise", () => {
  const c = liensResultatsCandidats(LAMBERSART, URL_L, 2026, undefined);
  assert.equal(c.length, 3, "les trois PDF de résultats ne sont pas tous lus");
  assert.ok(c.every((x) => x.annee === 2026), "« Publié le 27 Sep. 2026 » ne date plus le document");
  assert.equal(choisirParDistance(c, 10)?.texte, "Résultats 10km");
  assert.ok(choisirParDistance(c, 5)?.texte.endsWith("Résultats 5km"), "le 5 km ne reçoit pas son classement");
  assert.equal(choisirParDistance(c, 21.1), null, "le semi reçoit le classement d'une autre distance");
  // Sans distance nommée, le meilleur lien ; sans distance de course, le meilleur aussi.
  assert.equal(choisirParDistance([{ texte: "Résultats", url: "https://x.fr/r", score: 1 }], 10)?.url, "https://x.fr/r");
  assert.equal(choisirParDistance(c, null)?.texte.startsWith("Résultats"), true);
  assert.deepEqual(distancesNommees("Résultats 10km"), [10]);
  assert.deepEqual(distancesNommees("classement-semi-marathon"), [21.1], "un semi est lu comme un marathon");
  assert.deepEqual(distancesNommees("Marathon de Lille"), [42.195]);
  assert.deepEqual(distancesNommees("Trail 25 K et 12,5 km"), [25, 12.5]);
  assert.deepEqual(distancesNommees("2025 kilos de bonbons"), [], "une année passe pour une distance");
});

test("les parcours : fichier, service de tracés ou page « Parcours » — jamais un parcours santé", () => {
  const html = `<a href="/docs/trace-25km.gpx">Télécharger</a><a href="https://www.openrunner.com/route-details/123">Parcours 10 km</a>
    <a href="/le-parcours">Le parcours</a><a href="/parcours-sante">Parcours santé de la ville</a><a href="/inscription">Parcours d'inscription</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=x">Partager le parcours</a>
    <a href="/actu">Le parcours de cette année passera par la forêt communale et le bord du canal, nouveauté appréciée</a>`;
  const p = liensParcours(html, "https://trail-x.fr/");
  const urls = p.map((x) => x.url);
  assert.ok(urls.includes("https://trail-x.fr/docs/trace-25km.gpx") && urls.includes("https://www.openrunner.com/route-details/123") && urls.includes("https://trail-x.fr/le-parcours"));
  assert.ok(!urls.some((u) => /parcours-sante|inscription|facebook|actu/.test(u)), `lien écarté retenu : ${urls.join(", ")}`);
  assert.equal(p[0].url, "https://trail-x.fr/docs/trace-25km.gpx", "le fichier du tracé ne passe plus devant une page qui en parle");
  assert.equal(parcoursPour(p, 10)?.url, "https://www.openrunner.com/route-details/123", "le 10 km reçoit le tracé du 25 km");
  assert.equal(parcoursPour(p, 25)?.url, "https://trail-x.fr/docs/trace-25km.gpx");
  // Une page partagée : le lien doit nommer la course.
  assert.deepEqual(liensParcours(`<a href="/parcours-corrida">Parcours</a>`, "https://club.fr/", { mots: ["coudous"] }), []);
  for (const h of ["", "<a href=", "<a href=\"javascript:alert(1)\">Parcours</a>"]) assert.deepEqual(liensParcours(h, "https://x.fr/"), [], h);
});

test("page DÉDIÉE au site ou à la page seulement : les menus d'une mairie ne parlent pas de la course", () => {
  assert.equal(pageDediee("https://www.letraildubuis.fr/", "", "Trail du Buis"), "site");
  assert.equal(pageDediee(URL_L, "", "Foulées Lambersartoises 10 km"), "page");
  assert.equal(pageDediee("https://club.fr/agenda", "Agenda du club", "Trail du Buis"), null);
  assert.equal(pageDediee("pas une adresse", "", "Trail du Buis"), null);
  assert.ok(!sansMenus(LAMBERSART).includes("billetterie") && sansMenus(LAMBERSART).includes("download/file/24071"));
});

test("LAMBERSART : le 10 km et le 5 km reçoivent leur classement 2026 — pas la billetterie de la mairie", () => {
  const p = lirePage(LAMBERSART, URL_L, AUJ);
  const dix = deciderVeille(course({}), p, AUJ, TOUT);
  assert.equal(dix.resultats_url, "https://lambersart.fr/download/file/24071?key=a%3D");
  assert.equal(dix.resultats_annee, 2026);
  assert.ok(!("inscription_url" in dix), "le menu « Billetterie » de la ville devient l'inscription à la course");
  const cinq = deciderVeille(course({ name: "Foulées Lambersartoises 5 km", distance_km: 5 }), p, AUJ, TOUT);
  assert.equal(cinq.resultats_url, "https://lambersart.fr/download/file/24069?key=b%3D");
  // Une course « à venir » dont la page raconte le dimanche 27/09 : l'édition suivante estimée.
  const avenir = deciderVeille(course({ date: "2099-01-01", date_confirmee: null }), p, AUJ, TOUT);
  assert.deepEqual([avenir.date, avenir.date_confirmee], ["2027-09-26", false]);
});

test("ce qu'on ne remplace PAS, et ce qu'on remplace", () => {
  const p = lirePage(LAMBERSART, URL_L, AUJ);
  // Un classement plus ANCIEN ne remplace pas le plus récent ; un plus récent, si.
  assert.ok(!("resultats_url" in deciderVeille(course({ resultats_url: "https://chrono.fr/2027", resultats_annee: 2027 }), p, AUJ, TOUT)), "un classement plus ancien écrase le plus récent");
  assert.equal(deciderVeille(course({ resultats_url: "https://chrono.fr/2025", resultats_annee: 2025 }), p, AUJ, TOUT).resultats_url, "https://lambersart.fr/download/file/24071?key=a%3D",
    "le classement 2026 qui sort ne remplace pas celui de 2025");
  // Le classement d'une édition PAS ENCORE COURUE n'existe pas.
  assert.ok(!("resultats_url" in deciderVeille(course({ date: "2026-12-06" }), p, AUJ, TOUT)), "le classement « 2026 » est proposé avant la course 2026");
  // Une page qui ne nomme pas la course ne la touche pas.
  assert.deepEqual(deciderVeille(course({ name: "Trail des Coudous" }), p, AUJ, TOUT), {});
  // Inscription et parcours : jamais à la place de ceux qu'on a.
  const html = `<title>Trail du Buis</title><a href="/inscriptions">S'inscrire au Trail du Buis</a><a href="/trace.gpx">Tracé</a>`;
  const pb = lirePage(html, "https://letraildubuis.fr/", AUJ);
  const neuf = deciderVeille({ id: "b", name: "Trail du Buis", date: "2027-10-10", distance_km: 25 }, pb, AUJ, TOUT);
  assert.equal(neuf.parcours_url, "https://letraildubuis.fr/trace.gpx");
  assert.ok(neuf.inscription_url, "le lien d'inscription du site de la course n'est pas repris");
  const deja = deciderVeille({ id: "b", name: "Trail du Buis", date: "2027-10-10", distance_km: 25, parcours_url: "https://a.fr/p", inscription_url: "https://a.fr/i" }, pb, AUJ, TOUT);
  assert.ok(!("parcours_url" in deja) && !("inscription_url" in deja), "un lien existant est remplacé");
  // Sans la colonne (migration 034 non passée), le parcours n'est pas écrit.
  assert.ok(!("parcours_url" in deciderVeille({ id: "b", name: "Trail du Buis", date: "2027-10-10", distance_km: 25 }, pb, AUJ, { confirmee: true, parcours: false })));
});

test("une MAIRIE n'est pas dédiée à la course qui porte son nom ; ni école ni page « toutes les courses »", () => {
  // Le nom de la VILLE ne désigne pas la course : « Trail des Vignes de Rochegude » → « vignes ».
  assert.deepEqual(motsCourse("Trail des Vignes de Rochegude", "Rochegude"), ["vignes"]);
  assert.deepEqual(motsCourse("10 km de Rochegude", "Rochegude"), ["rochegude"], "une course qui ne porte que le nom de sa ville n'a plus de nom");
  assert.equal(pageDediee("https://www.rochegude.fr/", "Bienvenue à Rochegude", "Trail des Vignes de Rochegude", "Rochegude"), null, "le site de la ville passe pour celui de la course");
  assert.equal(pageDediee("https://www.trail-des-vignes.fr/", "", "Trail des Vignes de Rochegude", "Rochegude"), "site");
  // Rochegude en Rose sur mairie-rochegude.fr : le menu « Inscription scolaire » était repris.
  assert.equal(pageDediee("https://www.mairie-rochegude.fr/", "", "Rochegude en Rose", "Rochegude"), null);
  assert.equal(pageDediee("https://www.mairie-rochegude.fr/rochegude-en-rose", "", "Rochegude en Rose", "Rochegude"), "page");
  const mairie = `<title>Mairie de Rochegude</title><nav><a href="/enfance/inscription-scolaire">Inscription scolaire</a></nav><p>Rochegude en Rose, le dimanche 11 octobre 2026 : course solidaire.</p>`;
  const r = deciderVeille({ id: "r", name: "Rochegude en Rose", city: "Rochegude", date: "2026-10-11", distance_km: 10 }, lirePage(mairie, "https://www.mairie-rochegude.fr/", AUJ), AUJ, TOUT);
  assert.ok(!("inscription_url" in r), "l'inscription scolaire de la mairie devient l'inscription à la course");
  // Même un site dédié : « inscription scolaire » n'est pas une inscription à une course.
  const dedie = lirePage(`<title>Trail du Buis</title><p>Trail du Buis</p><a href="/inscription-scolaire">Inscription scolaire</a>`, "https://letraildubuis.fr/", AUJ);
  assert.ok(!("inscription_url" in deciderVeille({ id: "b", name: "Trail du Buis", date: "2027-10-10" }, dedie, AUJ, TOUT)));
  // La page d'une plateforme qui liste TOUTES ses courses n'est l'inscription d'aucune.
  const liste = lirePage(`<title>Cap sur Grenade</title><p>Cap sur Grenade</p><a href="https://chrono-start.com/inscriptions-listing/">S'inscrire</a>`, "https://capsurgrenade.fr/", AUJ);
  assert.ok(!("inscription_url" in deciderVeille({ id: "g", name: "Cap Sur Grenade", city: "Grenade", date: "2027-03-07" }, liste, AUJ, TOUT)), "la liste de toutes les courses d'une plateforme devient l'inscription");
});

test("la veille à la consultation : au plus une lecture par fenêtre, plus serrée autour de la course", () => {
  const H = 3600_000, maintenant = Date.parse("2026-10-01T12:00:00Z");
  assert.equal(fraicheurVeille("2026-09-27", AUJ), 6 * H, "une course qui vient d'avoir lieu n'est pas relue souvent");
  assert.equal(fraicheurVeille("2026-11-15", AUJ), 6 * H);
  assert.equal(fraicheurVeille("2099-01-01", AUJ), 72 * H);
  assert.equal(fraicheurVeille("2027-09-26", AUJ), 72 * H);
  assert.equal(aRelire(null, "2026-09-27", maintenant, AUJ), true, "une course jamais vue n'est pas relue");
  assert.equal(aRelire(new Date(maintenant - 2 * H).toISOString(), "2026-09-27", maintenant, AUJ), false, "relue toutes les 2 h");
  assert.equal(aRelire(new Date(maintenant - 7 * H).toISOString(), "2026-09-27", maintenant, AUJ), true);
  assert.equal(aRelire("pas une date", null, maintenant, AUJ), true);
  const route = codeNu("src/app/api/races/detail/route.ts");
  assert.ok(/if \("veille_at" in d && aRelire\(d\.veille_at, d\.date, Date\.now\(\), jourFrance\(\)\)\) \{\s*after\(/.test(route),
    "la fiche relance la veille à chaque ouverture, ou plus du tout");
  const v = codeNu("src/lib/races/veilleCourse.ts");
  assert.ok(/if \(reponseIncertaine\(code\)\) return null;/.test(v), "une panne compte comme une lecture");
  assert.ok(/if \(!robotsAutorise\(rb, u\.pathname \+ u\.search\)\)/.test(v), "robots.txt n'est plus respecté à la consultation");
});

test("le lien du parcours s'affiche, s'ouvre dans un NOUVEL ONGLET, et rien d'hostile ne passe", () => {
  const html = renderToStaticMarkup(createElement(LiensCourse, { detail: { parcours_url: "https://www.openrunner.com/route-details/1" } as never, course: { name: "X" }, d: RX.fr }));
  assert.ok(/<a href="https:\/\/www\.openrunner\.com\/route-details\/1" target="_blank" rel="noopener noreferrer nofollow"/.test(html) && html.includes(RX.fr["parcours"]));
  for (const h of ["javascript:alert(1)", "https://www.linkedin.com/shareArticle?x", "", null]) {
    const r = renderToStaticMarkup(createElement(LiensCourse, { detail: { parcours_url: h } as never, course: { name: "X" }, d: RX.fr }));
    assert.ok(!r.includes(RX.fr["parcours"]), `lien de parcours hostile affiché : ${h}`);
  }
  assert.equal(lienSortantPropre("https://x.fr/p?a=1&amp;b=2"), "https://x.fr/p?a=1&b=2");
  for (const l of Object.keys(RX)) assert.ok(RX[l]["parcours"], `libellé du parcours absent en ${l}`);
  const page = codeNu("src/app/courses/[slug]/page.tsx");
  assert.ok(/const parcours = lienSortantPropre\(\(c as \{ parcours_url\?: unknown \}\)\.parcours_url\);/.test(page) && /\{parcours && \(\s*<a href=\{parcours\} target="_blank"/.test(page),
    "la page publique n'affiche plus le parcours, ou hors d'un nouvel onglet");
  const sql = readFileSync("supabase/migrations/034_courses_parcours_veille.sql", "utf8").replace(/--.*$/gm, "");
  assert.ok(/add column if not exists parcours_url text/.test(sql) && /add column if not exists veille_at timestamptz/.test(sql) && !/\bdrop\b/i.test(sql));
});

console.log(`\n${passed} test(s) de la veille passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
