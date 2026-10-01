/**
 * LA PROCHAINE ÉDITION : ESTIMÉE, PUIS VÉRIFIÉE — et le GARAGE qui trouve la Gel-Nimbus 27 (30/09/2026).
 *
 * Cyprien : « pourquoi il met "Date à venir" alors que l'édition était le week-end dernier ?
 * Trouve un moyen automatique pour qu'il mette les bonnes dates, avec une vérification »
 * (Foulées Lambersartoises, courues le dimanche 27/09/2026, « Date à venir » dès le 28).
 * Et : « le garage ne trouve même pas la Gel Nimbus 27 ».
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editionSuivanteEstimee, datesAnnoncees, dateDepuisPage } from "../src/lib/races/prochaineEdition";
import { pageOfficielle, pageNommeLaCourse, datesDeLaCourse } from "../src/lib/races/veille";
import { tousLesModeles, suggererModeles, compact } from "../src/lib/gear/modelesChaussures";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:"'])\/\/.*$/, "$1")).join("\n");
const AUJ = "2026-09-30";

test("l'édition suivante : même rang du même jour, dans le même mois, l'an prochain", () => {
  assert.equal(editionSuivanteEstimee("2026-09-27", AUJ), "2027-09-26", "Lambersart : 4e et dernier dimanche de septembre");
  assert.equal(editionSuivanteEstimee("2026-03-01", AUJ), "2027-03-07", "1er dimanche de mars (+364 j donnerait le 28 février)");
  assert.equal(editionSuivanteEstimee("2026-05-31", AUJ), "2027-05-30", "dernier dimanche de mai");
  assert.equal(editionSuivanteEstimee("2026-08-29", AUJ), "2027-08-28", "dernier samedi d'août");
  // Un 5e dimanche qui n'existe pas l'année suivante : le dernier.
  assert.equal(editionSuivanteEstimee("2026-11-29", AUJ), "2027-11-28");
  // Une date ancienne saute jusqu'à la première année future — jamais une date passée.
  assert.equal(editionSuivanteEstimee("2024-09-29", AUJ), "2027-09-26");
  const e = editionSuivanteEstimee("2026-09-27", AUJ)!;
  assert.equal(new Date(`${e}T12:00:00Z`).getUTCDay(), 0, "l'estimation n'est pas un dimanche");
});

test("en semaine, ou date illisible : AUCUNE estimation (0 juste sur 28 un lundi ou un mardi)", () => {
  for (const d of ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]) assert.equal(editionSuivanteEstimee(d, AUJ), null, d);
  for (const d of [null, undefined, "", "2099-01-01", "2026-02-30", "2026-13-01", "27/09/2026", 20260927, "1999-09-26"]) assert.equal(editionSuivanteEstimee(d, AUJ), null, String(d));
});

test("5 000 dates de week-end au hasard : toujours future, même jour, même mois, ≤ 1 an", () => {
  let s = 7;
  const alea = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 5000; i++) {
    const t = Date.UTC(2020, 0, 1) + Math.floor(alea() * 2400) * 864e5;
    const d = new Date(t).toISOString().slice(0, 10);
    const e = editionSuivanteEstimee(d, AUJ);
    const js = new Date(t).getUTCDay();
    if (js !== 0 && js !== 6) { assert.equal(e, null); continue; }
    assert.ok(e && e > AUJ, `${d} → ${e}`);
    assert.equal(new Date(`${e}T00:00:00Z`).getUTCDay(), js, `${d} → ${e} : autre jour`);
    assert.equal(e!.slice(5, 7), d.slice(5, 7), `${d} → ${e} : autre mois`);
  }
});

test("lire les dates d'une page : jour nommé, année déduite, publication écartée", () => {
  const lamb = "<p>Publié le 28 septembre 2026 - Mis à jour le 30 septembre 2026</p><p>Dimanche 27 septembre, Lambersart a vibré au rythme de la course.</p>";
  assert.deepEqual(datesAnnoncees(lamb, AUJ).map(({ date, jourNomme }) => ({ date, jourNomme })), [{ date: "2026-09-27", jourNomme: true }], "la date de publication passe pour une date de course");
  assert.ok(datesAnnoncees(lamb, AUJ)[0].contextes?.[0].includes("Lambersart"), "la date perd le texte qui dit de quoi elle parle");
  const futur = "<h1>Trail des Coudous</h1><p>Prochaine édition : dimanche 26 septembre 2027 — inscriptions jusqu'au 20 septembre 2027.</p>";
  assert.deepEqual(datesAnnoncees(futur, AUJ).map((x) => x.date), ["2027-09-26"], "la clôture des inscriptions est prise pour la course");
  assert.deepEqual(datesAnnoncees("<p>le 1er mai 2027</p>", AUJ).map((x) => x.date), ["2027-05-01"]);
  // Un jour nommé qui contredit la date : coquille, on n'en tire rien.
  assert.deepEqual(datesAnnoncees("<p>samedi 26 septembre 2027</p>", AUJ), []);
  // Sans année ni jour : impossible de savoir laquelle.
  assert.deepEqual(datesAnnoncees("<p>le 26 septembre</p>", AUJ), []);
  for (const h of ["", "<script>dimanche 26 septembre 2027</script>", "31 février 2027", "dimanche 32 septembre 2027"]) assert.deepEqual(datesAnnoncees(h, AUJ), [], h);
  // La FIN d'une plage n'est pas le jour de la course (Ultra Marin, Urban Trail Chaumont).
  for (const h of ["23 &gt; 27 juin 2027", "23 > 27 juin 2027", "Rendez-vous les 10 et 11 octobre 2026", "du 22 au 23 mai 2027", "les 22 & 23 mai 2027", "22-23 mai 2027"]) {
    assert.deepEqual(datesAnnoncees(h, AUJ), [], `plage lue comme une date : ${h}`);
  }
  assert.deepEqual(datesAnnoncees("Départ à 9 h, dimanche 23 mai 2027", AUJ).map((x) => x.date), ["2027-05-23"], "une heure avant la date passe pour une plage");
});

test("décider : confirmer une date annoncée, estimer après une édition récente, sinon rien", () => {
  const avenir = { date: "2099-01-01", date_confirmee: null };
  // Lambersart : la page raconte le dimanche 27/09 → édition suivante ESTIMÉE.
  assert.deepEqual(dateDepuisPage([{ date: "2026-09-27", jourNomme: true }], avenir, AUJ), { date: "2027-09-26", confirmee: false, preuve: "2026-09-27" });
  // La page annonce la prochaine édition : CONFIRMÉE.
  assert.deepEqual(dateDepuisPage([{ date: "2027-09-26", jourNomme: true }], avenir, AUJ), { date: "2027-09-26", confirmee: true, preuve: "2027-09-26" });
  // Deux dates futures de week-end (un club, deux courses) : on ne choisit pas.
  assert.equal(dateDepuisPage([{ date: "2027-03-07", jourNomme: true }, { date: "2027-09-26", jourNomme: true }], avenir, AUJ), null);
  // Une estimation se confirme avec la date annoncée À ±45 j — pas avec une autre course.
  const estimee = { date: "2027-09-26", date_confirmee: false };
  assert.deepEqual(dateDepuisPage([{ date: "2027-10-03", jourNomme: true }], estimee, AUJ), { date: "2027-10-03", confirmee: true, preuve: "2027-10-03" });
  assert.equal(dateDepuisPage([{ date: "2027-03-07", jourNomme: true }], estimee, AUJ), null, "une date à 6 mois confirme l'estimation");
  // Une date CONFIRMÉE ne se discute pas ici.
  assert.equal(dateDepuisPage([{ date: "2027-10-03", jourNomme: true }], { date: "2027-09-26", date_confirmee: true }, AUJ), null);
  // Une vieille édition (> 120 j), ou sans jour nommé : pas d'estimation.
  assert.equal(dateDepuisPage([{ date: "2026-03-01", jourNomme: true }], avenir, AUJ), null);
  assert.equal(dateDepuisPage([{ date: "2026-09-27", jourNomme: false }], avenir, AUJ), null);
  assert.equal(dateDepuisPage([], avenir, AUJ), null);
  // Une date future EN SEMAINE (réunion, ouverture…) : la page parle du futur sans dater la
  // course — on n'estime pas pour autant depuis une édition passée.
  assert.equal(dateDepuisPage([{ date: "2026-09-27", jourNomme: true }, { date: "2027-05-12", jourNomme: true }], avenir, AUJ), null);
});

test("la page officielle : jamais un calendrier tiers ; elle doit NOMMER la course", () => {
  assert.equal(pageOfficielle({ site_officiel: "https://trail-coudous.fr", registration_url: "https://x.fr" }), "https://trail-coudous.fr");
  assert.equal(pageOfficielle({ site_officiel: null, registration_url: "https://lambersart.fr/foulees-lambersartoises" }), "https://lambersart.fr/foulees-lambersartoises");
  assert.equal(pageOfficielle({ site_officiel: null, registration_url: "https://www.finishers.com/course/x" }), null, "une fiche de calendrier passe pour la page officielle");
  assert.equal(pageOfficielle({ site_officiel: "javascript:alert(1)", registration_url: null }), null);
  assert.ok(pageNommeLaCourse("Les Foulées Lambersartoises : résultats", "https://lambersart.fr/x", "Foulées Lambersartoises 10 km"));
  assert.ok(!pageNommeLaCourse("Corrida de Noël", "https://club.fr/", "Trail des Coudous"), "la page d'une autre course date celle-ci");
  assert.equal(typeof pageNommeLaCourse("x", "https://x.fr/%E0%A4%A", "Trail des Coudous"), "boolean", "une adresse mal encodée fait planter");
  // Jamais une plateforme d'inscription ni un chronométreur : la fiche protiming du Semi de
  // la Juine (2022) annonçait dans sa marge le Cross du Val d'Essonne du 8 novembre 2026.
  assert.equal(pageOfficielle({ site_officiel: "https://www.protiming.fr/runnings/detail/6134", registration_url: null }), null, "une fiche de chronométreur passe pour la page officielle");
  assert.equal(pageOfficielle({ site_officiel: "https://resultats-live.com/course/trail-x-2025", registration_url: null }), null, "une page de chronométreur passe pour la page officielle");
  assert.equal(pageOfficielle({ site_officiel: "https://www.klikego.com/inscription/x/1", registration_url: "https://trail-x.fr" }), "https://trail-x.fr", "le repli sur la page propre de la course est perdu");
});

test("une date ne vaut que pour la course nommée à côté d'elle (sauf site à son nom)", () => {
  const juine = datesAnnoncees("Semi et Boucles de la Juine dimanche 2 octobre 2022 Saclas. " + "x ".repeat(200) + "Autres événements : Cross du Val d'Essonne dimanche 8 novembre 2026 Mennecy", AUJ);
  assert.deepEqual(datesDeLaCourse(juine, "https://club-essonne.fr/semi", "Semi de la Juine").map((x) => x.date), ["2022-10-02"], "la date d'une AUTRE course, plus bas sur la page, est retenue");
  // Un site au nom de la course : toutes ses dates parlent d'elle.
  const buis = datesAnnoncees("Accueil. " + "x ".repeat(200) + "Dimanche 11 octobre 2026", AUJ);
  assert.deepEqual(datesDeLaCourse(buis, "https://letraildubuis.fr", "Trail du Buis").map((x) => x.date), ["2026-10-11"]);
  assert.deepEqual(datesDeLaCourse(buis, "https://club.fr", "Trail du Buis"), [], "une date loin du nom, sur un site qui ne le porte pas, est retenue");
  assert.deepEqual(datesDeLaCourse(buis, "pas une adresse", "Trail du Buis"), []);
});

test("la maintenance estime au lieu de tout basculer en « Date à venir » ; Google ne voit jamais une estimation", () => {
  const cron = codeNu("src/app/api/cron/races-maintenance/route.ts");
  assert.ok(/const cible = \(colonneConfirmee && editionSuivanteEstimee\(r\.date, aujourdhui\)\) \|\| A_VENIR;/.test(cron), "la maintenance ne devine plus l'édition suivante");
  assert.ok(/\{ date: cible, date_confirmee: false,/.test(cron), "l'estimation serait écrite comme une date sûre");
  assert.ok(/if \(error\?\.code === "42703"\) \{ colonneConfirmee = false; continue; \}/.test(cron), "sans la colonne, l'estimation passerait pour sûre");
  const page = codeNu("src/app/courses/[slug]/page.tsx");
  assert.ok(/!aUneDate\(c\) \|\| c\.date_confirmee === false \? null :/.test(page), "une date estimée part dans les données structurées de Google");
  // La vérification des dates vit désormais dans la VEILLE (quotidienne et hebdomadaire).
  const wf = readFileSync(".github/workflows/courses-rafraichissement.yml", "utf8");
  assert.ok(/scripts\/veille-courses\.ts "\$ETAT\/veille-rapport\.json" --ecrire/.test(wf), "la veille hebdomadaire ne tourne plus");
  assert.ok(wf.indexOf("sauvegarder-courses.ts") < wf.indexOf("scripts/veille-courses.ts"), "la veille hebdomadaire écrit avant la sauvegarde");
  const quotidienne = readFileSync(".github/workflows/veille-courses.yml", "utf8");
  assert.ok(/cron: "40 4 \* \* \*"/.test(quotidienne) && /cron: "40 17 \* \* \*"/.test(quotidienne) && /veille-courses\.ts veille-rapport\.json --fenetre --ecrire/.test(quotidienne),
    "la veille quotidienne (deux passages) ne tourne plus");
  const lib = codeNu("src/lib/races/veille.ts");
  assert.ok(/if \(!pageNommeLaCourse\(`\$\{p\.titre\} \$\{p\.texte\}`, p\.url, c\.name\)\) return patch;/.test(lib), "une page qui ne nomme pas la course la modifie quand même");
  const script = codeNu("scripts/veille-courses.ts");
  assert.ok(/if \(reponseIncertaine\(code\)\) \{ incertaines\+\+; continue; \}/.test(script), "une panne déciderait quelque chose");
  // Dans la veille elle-même (le mode --appliquer, plus haut, écrit un rapport déjà relu).
  const veille = script.slice(script.indexOf("async function main()"));
  assert.ok(veille.indexOf("if (!ECRIRE)") > 0 && veille.indexOf("if (!ECRIRE)") < veille.indexOf(".update({ ...g.patch"), "le script écrit à blanc");
  assert.ok(/if \(patchs\.size > max\) \{[\s\S]{0,200}?process\.exit\(2\)/.test(script), "le seuil de sécurité de la veille a disparu");
});

// ── Le Garage ────────────────────────────────────────────────────────────────
const TOUS = tousLesModeles([{ marque: "Hoka", nom: "Clifton 11" }, { marque: "Asics", nom: "Gel-Nimbus 27" }]);

test("le Garage trouve la Gel-Nimbus 27, quelle que soit l'écriture", () => {
  for (const [marque, saisie] of [["Asics", "gel nimbus 27"], ["", "gel nimbus 27"], ["asics", "GEL-NIMBUS 27"], ["", "nimbus 27"], ["Asics", "gelnimbus27"]]) {
    const r = suggererModeles(TOUS, marque, saisie);
    assert.equal(`${r[0]?.marque} ${r[0]?.nom}`, "Asics Gel-Nimbus 27", `« ${marque} » + « ${saisie} » ne propose pas la Gel-Nimbus 27 en premier`);
  }
  // Toutes les générations, la plus récente d'abord.
  assert.deepEqual(suggererModeles(TOUS, "Asics", "nimbus", 3).map((x) => x.nom), ["Gel-Nimbus 28", "Gel-Nimbus 27", "Gel-Nimbus 26"]);
  assert.ok(suggererModeles(TOUS, "Asics", "nimbus 20").some((x) => x.nom === "Gel-Nimbus 20"), "les anciennes générations ont disparu");
});

test("le catalogue PROLONGE une gamme (un nouveau modèle apparaît dès qu'il y entre)", () => {
  assert.equal(suggererModeles(TOUS, "Hoka", "clifton")[0].nom, "Clifton 11", "la génération connue du catalogue n'étend pas la gamme");
  // Ce qui COMMENCE par la saisie passe avant ce qui la contient : « sky » → Skyward X,
  // pas la Wave Sky 9 de Mizuno (plus récente, mais on n'a pas tapé « wave »).
  const sky = tousLesModeles([{ marque: "Hoka", nom: "Skyward X" }, { marque: "Mizuno", nom: "Wave Sky 9" }]);
  assert.equal(suggererModeles(sky, "", "sky")[0].nom, "Skyward X", "la saisie en début de nom ne passe plus en premier");
  // Le catalogue connaît la Clifton 13 : la 12, sortie entre-temps, est proposée aussi.
  assert.ok(tousLesModeles([{ marque: "Hoka", nom: "Clifton 13" }]).some((x) => x.nom === "Clifton 12"), "une génération intermédiaire manque");
  assert.ok(TOUS.some((x) => x.marque === "Kiprun" && x.nom === "KD900X"), "les Kiprun, les plus vendues en France, manquent");
  const cles = TOUS.map((x) => `${compact(x.marque)}|${compact(x.nom)}`);
  assert.equal(new Set(cles).size, cles.length, "un modèle apparaît deux fois");
});

test("saisies hostiles : rien ne plante ; une marque inconnue n'efface pas tout", () => {
  for (const s of ["", " ", "((((", "\\", "💥", "a".repeat(5000), "%E0%A4%A"]) assert.ok(Array.isArray(suggererModeles(TOUS, s, s)), s.slice(0, 10));
  assert.ok(suggererModeles(TOUS, "Marque inconnue", "pegasus").length > 0, "une marque tapée de travers vide les suggestions");
  assert.equal(suggererModeles(TOUS, "Asics", "Gel-Nimbus 27").length, 0, "le texte déjà exact est reproposé à l'identique");
  const src = codeNu("src/components/profile/ProfileSettings.tsx");
  assert.ok(/setNewShoe\(s => \(\{ \.\.\.s, brand: m\.marque, model: m\.nom,/.test(src), "choisir un modèle ne remplit plus la marque");
  assert.ok(!/const SHOE_MODELS/.test(src), "la liste figée à la main est revenue");
});

console.log(`\n${passed} test(s) des dates et du garage passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
