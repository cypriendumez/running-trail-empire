/**
 * CRASH-TESTS DES ÉDITIONS PASSÉES — « que ça envoie dans les bons liens » (30/09/2026).
 *
 * Cyprien : « mets encore plus d'éditions et vérifie que pour chaque course il y a les
 * anciennes éditions et que ça envoie dans les bons liens, fais plein de crash tests ».
 *
 * Chaque piège ci-dessous a été LU sur un vrai site pendant la collecte :
 *   - « /wp-content/uploads/2026/02/resultats-editions-precedentes.xls » rangé en 2026 ;
 *   - deux courses sur un même site (Trail des Lions Nocturne 2023-2026 et 5/10 km 2015-2019) ;
 *   - un lien « Résultats 2017 » vers la page générale, des tableurs qui se téléchargent.
 * Et des entrées hostiles à la chaîne : rien ne plante, rien d'inventé ne s'affiche.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  adressesEditions, pageTrouvee, editionsAAfficher, fusionEditions, editionsDuSite, editionSiteVerifiee,
  sansPagePartagee, sansDossierDePublication, memesEditions, reponseIncertaine, EDITIONS_MAX, ANNEE_PLANCHER, type EditionResultats,
} from "../src/lib/races/editionsResultats";
import { liensResultatsParAnnee, pageArchivesResultats, lienResultats } from "../src/lib/races/resultatsSite";
import { LiensCourse } from "../src/components/races/LiensCourse";
import { lienClassementPropre } from "../src/lib/races/lienPropre";
import { editionsPropres } from "../scripts/nettoyer-liens-classement";
import { RX } from "../src/components/races/racesI18n";
import { jourFrance } from "../src/lib/races/jourFrance";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:"'])\/\/.*$/, "$1")).join("\n");

// Générateur déterministe : un échec se rejoue à l'identique.
function alea(graine: number) { let s = graine >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const AUJ = "2026-09-30";

// ── Lecture des pages d'organisateurs ───────────────────────────────────────
const accueil = (liens: string) => `<html><head><title>Trail des Coudous</title></head><body><nav>${liens}</nav></body></html>`;
const ev = { noms: ["Trail des Coudous"] };

test("une adresse par année, lue sans ambiguïté", () => {
  const html = accueil(`
    <a href="/resultats-2025/">Résultats 2025</a>
    <a href="/resultats-2024/">Résultats 2024</a>
    <a href="/resultats-2023/">Classement 2023</a>
    <a href="/archives/">Résultats 2019 à 2022</a>
    <a href="/tirage-2024/">Résultats du tirage au sort 2024</a>`);
  const r = liensResultatsParAnnee(html, "https://trail-des-coudous.fr/", 2026, ev);
  assert.deepEqual(r.map((e) => e.annee), [2025, 2024, 2023], "« 2019 à 2022 » est rangé, ou le tirage au sort passe pour un classement");
  assert.equal(r.find((e) => e.annee === 2024)!.url, "https://trail-des-coudous.fr/resultats-2024/", "le tirage au sort 2024 l'emporte sur le classement 2024");
});

test("le dossier de PUBLICATION n'est pas l'année de la course", () => {
  assert.equal(sansDossierDePublication("/wp-content/uploads/2026/02/resultats.xls"), "/wp-content/uploads/resultats.xls");
  assert.equal(sansDossierDePublication("/blog/2024/10/05/resultats-trail/"), "/blog/05/resultats-trail/");
  assert.equal(sansDossierDePublication("/resultats/2024/10km/"), "/resultats/2024/10km/", "« 10km » pris pour un mois");
  assert.equal(sansDossierDePublication("/resultats/2024/13/"), "/resultats/2024/13/", "13 n'est pas un mois");
  const html = accueil(`<a href="https://trail-des-coudous.fr/wp-content/uploads/2026/02/resultats-editions-precedentes.pdf">Résultats éditions précédentes</a>
    <a href="https://trail-des-coudous.fr/wp-content/uploads/2024/12/classement.pdf">Classement 2024</a>`);
  assert.deepEqual(liensResultatsParAnnee(html, "https://trail-des-coudous.fr/", 2026, ev).map((e) => e.annee), [2024],
    "l'année du dossier d'envoi fabrique une édition");
  // Le lien principal non plus : « Classement 2026 » envoyé par e-mail pour le fichier des éditions passées.
  const l = lienResultats(accueil(`<a href="https://trail-des-coudous.fr/wp-content/uploads/2026/02/resultats-editions-precedentes.pdf">Résultats éditions précédentes</a>`),
    "https://trail-des-coudous.fr/", 2026, ev);
  assert.equal(l?.annee ?? null, null, "le dossier d'envoi date le lien principal");
});

test("jamais l'année du nom de domaine, jamais une année future ou d'avant 2005", () => {
  const html = accueil(`<a href="https://trail2024.fr/resultats/">Résultats</a>
    <a href="/resultats-2031/">Résultats 2031</a><a href="/resultats-2003/">Résultats 2003</a>`);
  assert.deepEqual(liensResultatsParAnnee(html, "https://trail-des-coudous.fr/", 2026, ev), []);
});

test("une AUTRE course de l'organisateur n'est pas rangée sous celle-ci", () => {
  const html = accueil(`<a href="https://club-athle.fr/corrida-2024/resultats">Résultats Corrida 2024</a>
    <a href="https://club-athle.fr/coudous-2024/resultats">Résultats Coudous 2024</a>`);
  const r = liensResultatsParAnnee(html, "https://club-athle.fr/", 2026, ev);
  assert.deepEqual(r, [{ annee: 2024, url: "https://club-athle.fr/coudous-2024/resultats" }], "la corrida du club devient le classement du trail");
});

test("la page « Résultats » du même site, sans année, est la page d'archives", () => {
  const html = accueil(`<a href="https://www.wiclax-results.com/coudous-2025/">Résultats 2025</a>
    <a href="https://autre-site.fr/coudous/resultats/">Résultats</a><a href="/">Accueil</a><a href="/resultats/">Résultats</a>`);
  assert.equal(pageArchivesResultats(html, "https://trail-des-coudous.fr/", 2026, ev), "https://trail-des-coudous.fr/resultats/",
    "le chronométreur, l'accueil ou un autre site est pris pour la page d'archives");
  assert.equal(pageArchivesResultats(accueil(`<a href="/resultats-2025/">Résultats 2025</a>`), "https://trail-des-coudous.fr/", 2026, ev), null, "une page DATÉE n'est pas l'archive");
  assert.equal(pageArchivesResultats(accueil(`<a href="/">Résultats</a>`), "https://trail-des-coudous.fr/", 2026, ev), null, "l'accueil se relit lui-même");
  assert.equal(pageArchivesResultats(accueil(`<a href="https://autre-site.fr/coudous/resultats/">Résultats</a>`), "https://trail-des-coudous.fr/", 2026, ev), null, "un AUTRE site devient la page d'archives");
  // Un organisateur hébergé chez un chronométreur : sa page « résultats » EST le classement, pas une archive.
  assert.equal(pageArchivesResultats(accueil(`<a href="https://www.klikego.com/resultats/trail-des-coudous/1-1">Résultats</a>`),
    "https://www.klikego.com/inscription/trail-des-coudous/1-1", 2026, ev), null, "une page de chronométreur est relue comme archive");
});

test("HTML hostile ou démesuré : rien ne plante, rien ne traîne", () => {
  const hostiles = ["", "<a", "<a href=", "<a href=\"javascript:alert(2025)\">Résultats 2025</a>", "<a href=\"mailto:x@y.fr\">Résultats 2025</a>",
    "<a href=\"http://[::1\">Résultats 2025</a>", "<a href=\"%E0%A4%A\">Résultats 2025</a>", "\u0000\uFFFF<a href='/r-2025'>Résultats 2025</a>",
    "<a href=\"/r?x=&amp;y=2025\">Résultats 2025</a>"];
  for (const h of hostiles) {
    const r = liensResultatsParAnnee(h, "https://trail-des-coudous.fr/", 2026, ev);
    assert.ok(Array.isArray(r) && r.every((e) => /^https?:\/\//.test(e.url)), h);
    pageArchivesResultats(h, "https://trail-des-coudous.fr/", 2026, ev);
  }
  // 2 Mo de liens : une expression qui s'emballe gèlerait tout le relevé hebdomadaire.
  const gros = "<a href=\"/resultats-2024/\">Résultats 2024</a>".repeat(20000) + "<a " + "x".repeat(500000);
  const t0 = Date.now();
  liensResultatsParAnnee(gros, "https://trail-des-coudous.fr/", 2026, ev);
  assert.ok(Date.now() - t0 < 4000, `lecture trop lente : ${Date.now() - t0} ms`);
});

// ── Ce qu'on retient d'un site ──────────────────────────────────────────────
test("deux familles d'adresses = deux courses : on ne garde RIEN (plauzatsportnature.fr)", () => {
  const trail = [2026, 2025, 2024, 2023].map((a) => ({ annee: a, url: `https://p.fr/trail-des-lions-nocturne/resultats/resultat-${a}/` }));
  const cinq = [2019, 2018, 2017].map((a) => ({ annee: a, url: `https://p.fr/5-km-et-10-km-des-lions/resultats-${a}/` }));
  assert.deepEqual(editionsDuSite([...trail, ...cinq]), [], "les classements d'une autre course sont proposés");
  assert.deepEqual(editionsDuSite(trail), trail);
});

test("une famille et une adresse isolée : on garde la famille (« Résultats 2017 » → page générale)", () => {
  const fam = [2025, 2024, 2023].map((a) => ({ annee: a, url: `https://l.fr/resultats-${a}/` }));
  assert.deepEqual(editionsDuSite([...fam, { annee: 2017, url: "https://l.fr/resultats/" }]).map((e) => e.annee), [2025, 2024, 2023]);
  // Que des adresses isolées (PDF nommés à la main) : on les garde toutes.
  const pdf = [{ annee: 2019, url: "https://s.fr/2019HERMES22KM.pdf" }, { annee: 2016, url: "https://s.fr/CLASSEMENTSHERMES2016.pdf" }];
  assert.deepEqual(editionsDuSite(pdf), pdf);
});

test("un tableur ou une archive qui se TÉLÉCHARGE n'est pas une page de classement", () => {
  for (const ext of ["xls", "xlsx", "XLSX", "ods", "csv", "docx", "zip", "rar"]) {
    assert.deepEqual(editionsDuSite([{ annee: 2024, url: `https://c.fr/RESULTATS-2024.${ext}` }]), [], ext);
    assert.deepEqual(editionsDuSite([{ annee: 2024, url: `https://c.fr/RESULTATS-2024.${ext}?dl=1` }]), [], `${ext} avec requête`);
  }
  assert.equal(editionsDuSite([{ annee: 2024, url: "https://c.fr/RESULTATS-2024.pdf" }]).length, 1, "un PDF s'affiche dans le navigateur");
});

test("entrées hostiles pour editionsDuSite et fusionEditions", () => {
  for (const h of [null, undefined, 3, "x", {}, [null], [{}], [{ annee: "2024", url: "https://a" }], [{ annee: 2024, url: "javascript:alert(1)" }], [{ annee: 2024.5, url: "https://a/2024" }]]) {
    assert.deepEqual(editionsDuSite(h), [], JSON.stringify(h));
  }
  assert.deepEqual(fusionEditions(), []);
  assert.deepEqual(fusionEditions([], []), []);
  // À année égale, la PREMIÈRE source (le chronométreur) l'emporte ; tri du plus récent.
  assert.deepEqual(fusionEditions([{ annee: 2023, url: "chrono/2023" }], [{ annee: 2023, url: "site/2023" }, { annee: 2025, url: "site/2025" }]),
    [{ annee: 2025, url: "site/2025" }, { annee: 2023, url: "chrono/2023" }]);
});

// ── Vérification d'une page ouverte ─────────────────────────────────────────
const page = (titre: string, corps: string) => `<html><head><title>${titre}</title><script>var y="2023";</script></head><body><h1>${titre}</h1>${corps}</body></html>`;
const r = (x: Partial<{ code: number; demandee: string; finale: string; type: string; html: string | null }>) =>
  ({ code: 200, demandee: "https://o.fr/resultats-2024/", finale: "https://o.fr/resultats-2024/", type: "text/html; charset=utf-8", html: page("Résultats", "Classement général 2024"), ...x });

test("une page d'édition n'est vérifiée que si elle EXISTE et parle de cette année", () => {
  assert.equal(editionSiteVerifiee(r({}), 2024), true);
  for (const code of [0, 199, 301, 403, 404, 410, 500]) assert.equal(editionSiteVerifiee(r({ code }), 2024), false, String(code));
  // Renvoyée à l'accueil : un lien mort « redirigé vers / » répond 200.
  assert.equal(editionSiteVerifiee(r({ finale: "https://o.fr/" }), 2024), false, "une redirection vers l'accueil est acceptée");
  assert.equal(editionSiteVerifiee(r({ finale: "https://o.fr/index.php" }), 2024), false);
  // Une page d'erreur servie en 200.
  assert.equal(editionSiteVerifiee(r({ html: page("Page introuvable", "2024") }), 2024), false, "« Page introuvable » servie en 200 passe");
  assert.equal(editionSiteVerifiee(r({ html: page("Erreur 404", "2024") }), 2024), false);
  // L'année : dans l'adresse (hors dossier de publication) ou dans le TEXTE (pas dans un script).
  const sansAnnee = { demandee: "https://o.fr/resultats/", finale: "https://o.fr/resultats/" };
  assert.equal(editionSiteVerifiee(r({ ...sansAnnee, html: page("Résultats", "Classement 2024") }), 2024), true);
  assert.equal(editionSiteVerifiee(r({ ...sansAnnee, html: page("Résultats", "Classement 2022") }), 2023), false, "l'année d'un script suffit");
  assert.equal(editionSiteVerifiee(r({ demandee: "https://o.fr/wp-content/uploads/2024/12/c.html", finale: "https://o.fr/wp-content/uploads/2024/12/c.html", html: page("C", "rien") }), 2024), false,
    "le dossier d'envoi prouve l'année");
});

test("un PDF : servi tel quel, sans redirection", () => {
  const pdf = { type: "application/pdf", html: null, demandee: "https://o.fr/c-2024.pdf", finale: "https://o.fr/c-2024.pdf" };
  assert.equal(editionSiteVerifiee(r(pdf), 2024), true);
  assert.equal(editionSiteVerifiee(r({ ...pdf, finale: "https://o.fr/autre.pdf" }), 2024), false, "un PDF redirigé ailleurs est accepté");
  assert.equal(editionSiteVerifiee(r({ ...pdf, type: "application/zip" }), 2024), false, "une archive est acceptée");
  assert.equal(editionSiteVerifiee(r({ ...pdf, type: "" }), 2024), false);
});

test("adresses illisibles à la vérification : non, jamais d'exception", () => {
  for (const x of [{ demandee: "" }, { finale: "pas une adresse" }, { demandee: "http://[::1" }, { html: "" }, { html: "<title>" }]) {
    assert.equal(typeof editionSiteVerifiee(r(x), 2024), "boolean", JSON.stringify(x));
  }
});

test("deux années qui mènent à la même page : aucune des deux", () => {
  const l = [{ annee: 2024, finale: "https://o.fr/resultats/" }, { annee: 2023, finale: "https://O.fr/resultats#haut" }, { annee: 2022, finale: "https://o.fr/r-2022/" }];
  assert.deepEqual(sansPagePartagee(l).map((x) => x.annee), [2022], "la barre finale, la casse ou l'ancre cachent le doublon");
  assert.deepEqual(sansPagePartagee([]), []);
});

// ── Ce qui s'affiche ────────────────────────────────────────────────────────
test("À L'ÉCRAN, 5 000 listes aléatoires : chaque pastille respecte toutes les règles", () => {
  const rnd = alea(20260930);
  const pioche = <T,>(t: T[]) => t[Math.floor(rnd() * t.length)];
  const urls = ["https://a.fr/2024", "http://b.fr/x", "javascript:alert(1)", "data:text/html,x", "", "//c.fr", "ftp://d.fr", "HTTPS://E.FR/2020", "https://a.fr/2024 "];
  const annees: unknown[] = [2026, 2025, 2024, 2019, 2005, 2004, 1999, 2027, 2099, NaN, Infinity, -1, 2024.5, "2024", null];
  for (let i = 0; i < 5000; i++) {
    const liste = Array.from({ length: Math.floor(rnd() * 14) }, () => rnd() < 0.08 ? pioche([null, 3, "x", [], {}]) : { annee: pioche(annees), url: pioche(urls) + (rnd() < 0.5 ? String(Math.floor(rnd() * 9)) : "") });
    const date = pioche([null, "", "2026-09-30", "2026-10-15", "2025-06-01", "2099-01-01", "pas une date", "2027-03-01"]);
    const principal = pioche([null, "https://a.fr/2024", { url: "https://a.fr/2024", annee: 2024 }, { url: "x", annee: null }]);
    const aff = editionsAAfficher(liste, principal, { date }, AUJ);
    const vues = new Set<number>();
    aff.forEach((e, k) => {
      assert.ok(/^https?:\/\//i.test(e.url), `adresse non http : ${e.url}`);
      assert.ok(Number.isInteger(e.annee) && e.annee >= ANNEE_PLANCHER && e.annee <= 2026, `année hors bornes : ${e.annee}`);
      assert.ok(!vues.has(e.annee), "deux pastilles pour une même année"); vues.add(e.annee);
      if (k > 0) assert.ok(aff[k - 1].annee > e.annee, "ordre décroissant rompu");
      if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= AUJ) assert.ok(e.annee < Number(date.slice(0, 4)), `édition à venir proposée : ${e.annee} pour ${date}`);
      const p = typeof principal === "string" ? principal : principal?.url;
      assert.notEqual(e.url, p, "le lien principal est répété");
      if (principal && typeof principal === "object" && principal.annee != null) assert.notEqual(e.annee, principal.annee, "l'année du lien principal est répétée");
    });
    assert.ok(aff.length <= EDITIONS_MAX);
  }
});

test("la chaîne complète : devinées, retenues, réunies, affichées — cohérentes", () => {
  const rnd = alea(7);
  for (let i = 0; i < 2000; i++) {
    const annee = 2006 + Math.floor(rnd() * 21);
    const tri = Math.floor(rnd() * 5);
    const vers = (a: number) => `https://chrono.fr/evt/Course%20${a}/?an=${a}&tri=${tri}`;
    const url = vers(annee);
    const c = adressesEditions(url, annee, Math.floor(rnd() * 14));
    assert.ok(c, url);
    for (const x of c.candidates) {
      assert.ok(x.annee < annee && x.annee >= ANNEE_PLANCHER, "candidate hors bornes");
      assert.equal(x.url, vers(x.annee), "la candidate diffère d'autre chose que de l'année");
      assert.ok(pageTrouvee(200, x.url, x.annee), "une candidate ne se reconnaît pas elle-même");
    }
    const aff = editionsAAfficher(fusionEditions(c.candidates, editionsDuSite(c.candidates)), url, { date: `${annee}-06-01` }, AUJ);
    assert.ok(aff.every((e) => e.annee < annee));
  }
});

test("LE RENDU : chaque pastille ouvre un NOUVEL ONGLET, rien d'hostile n'atteint le HTML", () => {
  const detail = {
    resultats_url: "https://chrono.fr/coudous-2025/", resultats_annee: 2025,
    resultats_editions: [
      { annee: 2025, url: "https://site.fr/resultats-2025/" }, { annee: 2024, url: "https://chrono.fr/coudous-2024/" },
      { annee: 2023, url: "javascript:alert(document.cookie)" }, { annee: 2022, url: "https://chrono.fr/coudous-2022/\"><script>alert(1)</script>" },
      { annee: 2999, url: "https://chrono.fr/coudous-2999/" }, { annee: 2021, url: "data:text/html,<script>alert(1)</script>" },
    ],
  };
  for (const lang of Object.keys(RX)) {
    const html = renderToStaticMarkup(createElement(LiensCourse, { detail: detail as never, course: { name: "Trail des Coudous", date: "2026-05-01" }, d: RX[lang] }));
    const liens = [...html.matchAll(/<a ([^>]*)>/g)].map((m) => m[1]);
    assert.ok(liens.length >= 3, lang);
    for (const a of liens) {
      assert.ok(/target="_blank"/.test(a) && /rel="noopener noreferrer nofollow"/.test(a), `${lang} : un lien s'ouvre dans l'onglet de l'app — ${a}`);
      assert.ok(/href="https?:\/\//.test(a), `${lang} : lien non http — ${a}`);
    }
    assert.ok(!/<script>/i.test(html) && !/javascript:/i.test(html) && !/data:text/i.test(html), `${lang} : contenu hostile dans le rendu`);
    assert.ok(!/>2999</.test(html), `${lang} : une année future`);
    assert.equal((html.match(/>2025</g) ?? []).length, 0, `${lang} : pastille 2025 à côté de « Classement 2025 »`);
    assert.ok(html.includes(">2024<") && html.includes(RX[lang]["res.editions"]), `${lang} : l'édition 2024 ou son libellé manque`);
  }
});

test("LE RENDU, course à venir cette année : ni classement ni pastille de l'édition pas encore courue", () => {
  const Y = Number(jourFrance().slice(0, 4));
  const detail = { resultats_url: `https://chrono.fr/coudous-${Y}/`, resultats_annee: Y,
    resultats_editions: [{ annee: Y, url: `https://chrono.fr/coudous-${Y}/` }, { annee: Y - 1, url: `https://chrono.fr/coudous-${Y - 1}/` }] };
  const html = renderToStaticMarkup(createElement(LiensCourse, { detail: detail as never, course: { name: "X", date: `${Y}-12-31` }, d: RX.fr }));
  assert.ok(!html.includes(`coudous-${Y}/`), "la page (vide) de l'édition pas encore courue est proposée");
  assert.ok(html.includes(`>${Y - 1}<`), "l'édition passée disparaît");
  // Données absentes ou corrompues : le bloc se rend sans rien inventer.
  for (const d of [null, undefined, {}, { resultats_editions: "x" }, { resultats_editions: [null] }, { resultats_editions: [{ annee: Y - 1, url: "javascript:x" }] }]) {
    const h = renderToStaticMarkup(createElement(LiensCourse, { detail: d as never, course: {}, d: RX.fr }));
    assert.ok(!h.includes(RX.fr["res.editions"]), JSON.stringify(d));
  }
});

test("la page publique utilise la MÊME règle et ouvre chaque édition dans un nouvel onglet", () => {
  const src = codeNu("src/app/courses/[slug]/page.tsx");
  assert.ok(/editionsAAfficher\([^;]*classement\?\.direct \? classement : null, c\)/.test(src), "la page publique ne passe plus le lien principal ou la course");
  const bloc = src.slice(src.indexOf("{editions.length > 0 &&"), src.indexOf("{editions.length > 0 &&") + 900);
  assert.ok(/editions\.map\(/.test(bloc) && /target="_blank"/.test(bloc) && /rel="noopener noreferrer nofollow"/.test(bloc), "une édition s'ouvre dans l'onglet de l'app");
  const composant = codeNu("src/components/races/LiensCourse.tsx");
  assert.ok(/editionsAAfficher\(detail\?\.resultats_editions, classement\?\.direct \? classement : null, course\)/.test(composant));
});

// ── Le lien PRINCIPAL : la porte unique ─────────────────────────────────────
test("les mauvais liens relevés dans l'inventaire du 30/09 sont corrigés ou refusés", () => {
  const cas: [string, string | null, string][] = [
    ["https://www.sport-info.com/i_liste_resultats.php?id=318&amp;general=1&amp;epreuve=3689", "https://www.sport-info.com/i_liste_resultats.php?id=318&general=1&epreuve=3689", "« &amp; » non décodé"],
    ["https://www.athle.fr/bases/liste.aspx?frmbase=resultats&#038;frmmode=1&#038;frmcompetition=306225", "https://www.athle.fr/bases/liste.aspx?frmbase=resultats&frmmode=1&frmcompetition=306225", "« &#038; » non décodé"],
    ["https://bases.athle.fr/asp.net/accueil.aspx?frmbase=resultats&frmtype1=Stade", null, "la page d'accueil des résultats FFA passe pour un classement"],
    ["https://x.fr/r?a=1&amp;amp;b=2", "https://x.fr/r?a=1&b=2", "entité encodée deux fois"],
    ["https://www.linkedin.com/shareArticle?mini=true&url=https%3A%2F%2Fx.fr&title=classement", null, "un bouton de partage LinkedIn"],
    ["https://www.facebook.com/sharer/sharer.php?u=https://x.fr/resultats", null, "un bouton de partage Facebook"],
    ["https://twitter.com/intent/tweet?text=resultats", null, "un partage Twitter"],
    ["https://dicodusport.fr/blog/resultats-et-classement-marathon-de-la-rochelle-2025/", null, "un blog tiers qui résume le podium"],
    ["https://www.ecotrailparis.com/actualites/bug-resultats-livetrail", null, "un article sur une panne"],
    ["https://livetrail.net/histo/grandraid-reunion_2025/coureur.php?rech=2728", "https://livetrail.net/histo/grandraid-reunion_2025/classement.php", "la fiche du vainqueur prise pour le classement"],
    ["https://ultra.v3.livetrail.net/fr/2026/ranking?raceId=170&amp;gender=MALE", "https://ultra.v3.livetrail.net/fr/2026/ranking?raceId=170", "le classement des seuls hommes"],
    ["https://www.klikego.com/resultats/x-2026/1-1?heat=27-km&search=&sexe=F", "https://www.klikego.com/resultats/x-2026/1-1?heat=27-km&search=", "le classement des seules femmes"],
  ];
  for (const [entree, attendu, pourquoi] of cas) assert.equal(lienClassementPropre(entree), attendu, pourquoi);
  // Un bon lien n'est PAS touché : ni réencodé, ni amputé.
  for (const bon of ["https://resultats-live.com/course/2025?q=Coudous%202025&tri=temps", "http://inscriptionsenligne.fr.wiclax-results.com/La%20Ronda%20des%20Coudous%202025/",
    "https://www.facebook.com/trailcoudous/posts/123", "https://sportips.fr/plateformeResultats/#/epreuve?id=1963", "https://x.fr/debug-des-coureurs/resultats"]) {
    assert.equal(lienClassementPropre(bon), bon, bon);
  }
  // Retirer un filtre ne RÉENCODE pas le reste (« %20 » ne devient pas « + »).
  assert.equal(lienClassementPropre("https://x.fr/r?q=Coudous%202025&sexe=F&t=a%2Fb"), "https://x.fr/r?q=Coudous%202025&t=a%2Fb", "la requête est réencodée");
  // « genre=trail » est le TYPE de course ; « sexe= » vide ne filtre rien ; « essex=F » n'est pas « sex » ;
  // « gendarmerie=1 » non plus ; « bugey » n'est pas un « bug ».
  for (const garde of ["https://x.fr/r?genre=trail", "https://x.fr/r?sexe=", "https://x.fr/r?essex=F", "https://x.fr/r?gendarmerie=1"]) {
    assert.equal(lienClassementPropre(garde), garde, garde);
  }
  assert.equal(lienClassementPropre("https://x.fr/r?genre=Femmes&c=1"), "https://x.fr/r?c=1", "« genre=Femmes » est bien un filtre");
  assert.equal(lienClassementPropre("https://x.fr/trail-du-bugey/resultats"), "https://x.fr/trail-du-bugey/resultats");
  for (const h of [null, undefined, 42, "", "  ", "javascript:alert(1)", "ftp://x.fr/r", "mailto:a@b.fr", "http://[::1", "//x.fr/r", {}, []]) {
    assert.equal(lienClassementPropre(h), null, String(h));
  }
});

test("la porte est appliquée PARTOUT : écriture, collecte, affichage, e-mail, éditions", () => {
  const sites: [string, RegExp][] = [
    ["src/lib/races/majFinishers.ts", /const classement = lienClassementPropre\(fiche\.resultats\?\.classement\);\s*const resultats = classement \?\? lienClassementPropre\(fiche\.resultats\?\.page\);/],
    ["src/lib/races/resultatsSite.ts", /const propre = lienClassementPropre\(url\);\s*if \(!propre\) continue;/],
    ["src/lib/races/liensCourse.ts", /const direct = lienClassementPropre\(d\?\.resultats_url\);/],
    ["src/lib/notify/resultatsCourse.ts", /const propre = lienClassementPropre\(l\?\.resultats_url\);\s*if \(propre && l\?\.resultats_annee === annee\) return \{ url: propre, direct: true \};/],
    ["src/lib/races/editionsResultats.ts", /\.map\(\(e\) => \(\{ annee: e\.annee, url: lienClassementPropre\(e\.url\) \}\)\)\s*\.filter\(\(e\): e is EditionResultats => e\.url != null\)/],
    ["scripts/audit-editions.ts", /const cible = lienClassementPropre\(e\.url\);/],
  ];
  for (const [f, re] of sites) assert.ok(re.test(codeNu(f)), `${f} : la porte unique n'est plus appliquée`);
  // Et à l'affichage, pour de vrai : un lien de partage en base ne devient pas « Classement 2025 ».
  const html = renderToStaticMarkup(createElement(LiensCourse, {
    detail: { resultats_url: "https://www.linkedin.com/shareArticle?mini=true&url=x", resultats_annee: 2025 } as never, course: { name: "Trail des Coudous", date: "2025-05-01" }, d: RX.fr }));
  assert.ok(!/linkedin/i.test(html) && html.includes(RX.fr["res.chercher"]), "le partage LinkedIn s'affiche comme classement");
  const html2 = renderToStaticMarkup(createElement(LiensCourse, {
    detail: { resultats_url: "https://x.fr/r?id=1&amp;b=2", resultats_annee: 2025, resultats_editions: [{ annee: 2024, url: "https://livetrail.net/histo/grr_2024/coureur.php?rech=1" }] } as never,
    course: { name: "X", date: "2025-05-01" }, d: RX.fr }));
  assert.ok(html2.includes('href="https://x.fr/r?id=1&amp;b=2"') && !html2.includes("&amp;amp;"), "l'entité n'est pas décodée à l'affichage");
  assert.ok(html2.includes("grr_2024/classement.php") && !html2.includes("coureur.php"), "une édition mène à la fiche d'un coureur");
});

test("un libellé LONG (accroche d'article) sans « résultats » dans l'adresse n'est pas un classement", () => {
  const html = accueil(`<a href="/actualite/des-arbitrages-hauteur-de-30-millions-euros">Des arbitrages à hauteur de 30 M€ 25/09/2026 Entre le compte administratif, qui scelle les résultats de l'exercice</a>`);
  assert.equal(lienResultats(html, "https://trail-des-coudous.fr/", 2026, ev), null, "un article du conseil municipal devient le classement");
  const ok = accueil(`<a href="/resultats-2025/">Les résultats complets de l'édition 2025 du Trail des Coudous sont en ligne, bravo à tous</a>`);
  assert.equal(lienResultats(ok, "https://trail-des-coudous.fr/", 2026, ev)?.url, "https://trail-des-coudous.fr/resultats-2025/", "un long libellé dont l'ADRESSE dit « résultats » est refusé");
});

test("vérification : XML mis en page (livetrail) accepté, PDF passé en https accepté", () => {
  const xml = '<?xml version="1.0"?><?xml-stylesheet type="text/xsl" href="classement.xsl.php"?><d><c n="Diagonale des fous"/></d>';
  const base = { code: 200, demandee: "https://livetrail.net/histo/grandraid-reunion_2024/classement.php", finale: "https://livetrail.net/histo/grandraid-reunion_2024/classement.php" };
  assert.equal(editionSiteVerifiee({ ...base, type: "text/xml; charset=utf-8", html: xml }, 2024), true, "une ancienne édition livetrail est rejetée");
  assert.equal(editionSiteVerifiee({ ...base, type: "text/xml", html: "<d><c/></d>" }, 2024), false, "du XML brut (données) passe pour une page");
  assert.equal(editionSiteVerifiee({ code: 200, demandee: "http://www.b.com/r/2024/s.pdf", finale: "https://b.com/r/2024/s.pdf", type: "application/pdf", html: null }, 2024), true,
    "le passage http → https d'un PDF le fait rejeter");
});

test("l'ancre suit l'année ; une année SEULEMENT dans l'ancre ne fait pas une édition", () => {
  assert.equal(adressesEditions("https://isnorun.fr/evenements/10km-2026/#resultats2026", 2026)!.candidates[0].url, "https://isnorun.fr/evenements/10km-2025/#resultats2025",
    "la page 2025 garde l'ancre « #resultats2026 »");
  assert.equal(adressesEditions("https://isnorun.fr/evenements/10km/#resultats2026", 2026), null, "une ancre seule fabrique des éditions");
});

test("comparer des éditions relues de Postgres : l'ordre des CLÉS ne compte pas, le reste si", () => {
  const ecrit = [{ annee: 2024, url: "https://o.fr/2024" }, { annee: 2023, url: "https://o.fr/2023" }];
  const relu = JSON.parse('[{"url":"https://o.fr/2024","annee":2024},{"url":"https://o.fr/2023","annee":2023}]');
  assert.ok(memesEditions(ecrit, relu), "chaque passage réécrit toutes les lignes");
  assert.ok(!memesEditions(ecrit, [ecrit[0]]), "une édition retirée passe inaperçue");
  assert.ok(!memesEditions(ecrit, [{ annee: 2024, url: "https://o.fr/2024b" }, ecrit[1]]), "une adresse changée passe inaperçue");
  assert.ok(memesEditions(null, undefined) && !memesEditions(null, []), "« rien » et « liste vide » confondus");
});

test("le nettoyage des éditions EN BASE : même porte, une par année, null si plus rien", () => {
  assert.deepEqual(editionsPropres([{ url: "https://livetrail.net/histo/g_2024/coureur.php?rech=9", annee: 2024 }, { url: "https://www.linkedin.com/shareArticle?x", annee: 2023 },
    { url: "https://o.fr/2022?a=1&amp;b=2", annee: 2022 }, { url: "https://o.fr/2022-bis", annee: 2022 }]),
    [{ annee: 2024, url: "https://livetrail.net/histo/g_2024/classement.php" }, { annee: 2022, url: "https://o.fr/2022?a=1&b=2" }]);
  assert.equal(editionsPropres([{ url: "https://www.linkedin.com/shareArticle?x", annee: 2023 }]), null, "une liste vidée reste « [] » au lieu de null");
  for (const h of [null, "x", 3, {}, [null], [{ annee: "2024", url: "https://o.fr" }]]) assert.ok(editionsPropres(h) === null, JSON.stringify(h));
  const src = codeNu("scripts/nettoyer-liens-classement.ts");
  assert.ok(/if \(p == null\) \{ maj\.resultats_annee = null;/.test(src), "un lien effacé garde son année : « Classement 2025 » sans lien");
  assert.ok(src.indexOf("if (!ECRIRE)") < src.indexOf(".update(g.maj)"), "le nettoyage écrit à blanc");
});

// ── Les scripts ─────────────────────────────────────────────────────────────
test("le script d'écriture : sites partagés écartés, familles, vérification, pages partagées", () => {
  const src = codeNu("scripts/resultats-editions.ts");
  assert.ok(/if \(coursesDuSite\.get\(site\)!\.size > 1\) \{ sitesPartages\+\+; continue; \}/.test(src), "un site de plusieurs courses donne ses éditions à toutes");
  assert.ok(src.indexOf("editionsDuSite(eds)") > 0 && src.indexOf("editionsDuSite(eds)") < src.indexOf("const aLireB"), "les familles ne sont plus triées avant d'ouvrir les liens");
  assert.ok(/ok = editionSiteVerifiee\(\{ \.\.\.o, demandee: e\.url \}, e\.annee\)/.test(src), "un lien d'organisateur est écrit sans avoir été ouvert");
  assert.ok(/sansPagePartagee\(/.test(src.slice(src.indexOf("const verifieesB"))), "deux années menant à la même page sont écrites");
  assert.ok(/filter\(\(x\) => x\.v\?\.ok\)/.test(src), "une édition refusée à la vérification est écrite");
  assert.ok(/if \(\+\+trous >= TROUS_MAX\) break/.test(src) && /const PROFONDEUR = 10;/.test(src), "la recherche par l'année ne remonte plus dix ans, ou ne s'arrête plus");
  assert.ok(/robotsAutorise\(rb, u\.pathname \+ u\.search\)/.test(src) && /robotsAutorise\(rb, u\.pathname\)/.test(src), "robots.txt n'est plus respecté");
  // Les deux caches voyagent d'une semaine à l'autre (sinon chaque lien est rouvert chaque semaine).
  assert.ok(/join\(dirname\(cache\), "editions-sites-verifiees\.jsonl"\)/.test(src), "le cache des liens d'organisateurs a changé de nom");
  const yml = readFileSync(".github/workflows/courses-rafraichissement.yml", "utf8");
  const etat = yml.slice(yml.indexOf("name: etat-courses"), yml.indexOf("retention-days", yml.indexOf("name: etat-courses")));
  assert.ok(etat.includes(".cache-courses/editions-sites-verifiees.jsonl") && etat.includes(".cache-courses/editions-resultats.jsonl"), "un cache des éditions n'est plus gardé");
});

test("une panne n'est JAMAIS mémorisée comme un verdict (coupure réseau du 30/09)", () => {
  for (const c of [0, 403, 429, 500, 502, 503]) assert.equal(reponseIncertaine(c), true, String(c));
  for (const c of [200, 301, 404, 410, 400]) assert.equal(reponseIncertaine(c), false, String(c));
  const src = codeNu("scripts/resultats-editions.ts");
  assert.ok(/if \(!incertain\) appendFileSync\(cache, /.test(src), "une exploration interrompue par une panne est mise en cache");
  assert.ok(/if \(!incertain\) appendFileSync\(cacheB, /.test(src), "un lien refusé pendant une panne est mis en cache comme refusé");
  assert.ok(/if \(reponseIncertaine\(o\.code\)\) \{ incertain = true; break; \}/.test(src), "trois pannes de suite passent pour trois années introuvables");
  assert.ok(/if \(!ok && reponseIncertaine\(o\.code\)\) incertain = true;/.test(src));
});

test("l'audit : ne retire que les échecs PROUVÉS, et seulement avec --ecrire", () => {
  const src = codeNu("scripts/audit-editions.ts");
  assert.ok(/const ECRIRE = process\.argv\.includes\("--ecrire"\)/.test(src) && src.indexOf("if (!ECRIRE)") < src.indexOf(".update({ resultats_editions"), "l'audit écrit à blanc");
  assert.ok(/INCERTAIN/.test(src) && /const incertain = reponseIncertaine;/.test(src), "une panne passagère retire une édition");
  assert.ok(/sansPagePartagee\(/.test(src), "l'audit ne voit plus deux années sur la même page");
  assert.ok(/for \(const c of g\) \{ echecs\.add\(`\$\{c\.annee\}\|\$\{c\.url\}`\); c\.motif \|\|= "contenu-identique"; \}/.test(src), "deux années au texte identique restent en base");
});

console.log(`\n${passed} crash-test(s) des éditions passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
