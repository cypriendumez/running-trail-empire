/**
 * LA UNE DE LA LETTRE DU LUNDI — la backyard de Clem qui court était absente (09/11/2026).
 *
 * Cyprien : « pourquoi dans la newsletter il n'y a pas la backyard de Clem qui court alors que
 * c'était l'événement français du weekend ». La une prenait les 5 articles les plus RÉCENTS
 * d'un fil coupé à 48 : Wiz Khalifa, un fait divers à Brooklyn, un guide de chaussures, tous
 * publiés dans la demi-heure avant l'envoi. La backyard (26 médias en une semaine) n'existait
 * déjà plus dans le fil : Marathon Handbook avait publié sept articles le dimanche à 17 h 20.
 *
 * Les titres ci-dessous sont repris de la semaine réelle.
 *
 *   npx tsx tests/newsletter-une.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classerALaUne, motsDuTitre, texteDuSujet, POLITIQUE, type ArticleSemaine } from "../src/lib/news/alaune";
import { FILTRES, PAS_ELITE, PAS_CONSEIL, CONTEXTE_COURSE, COURSE_A_PIED, PROMO, TEST_MATERIEL, HORS_COURSE, RUBRIQUES_LETTRE } from "../src/lib/news/rubriques";
import { fusionnerListes, lienGoogleNews } from "../src/lib/news/actualites";
import { chiffresVerifies, chiffresIntrus } from "../src/lib/newsletter/resume";
import { construireEmail, LANGS, libellesSections } from "../src/lib/newsletter/email";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}\n      ${(e as Error).message}`); }
}
const sansCommentaires = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let n = 0;
const art = (source: string, title: string, date: string, texte?: string): ArticleSemaine =>
  ({ source, title, date, link: `https://exemple.fr/${++n}`, texte });

// ── La semaine du 9 novembre 2026, en réduction ────────────────────────────────
const BACKYARD = [
  art("Le Monde", "« Les 25 heures qui courent » : avec sa Backyard caritative, l'influenceur Clem qui court veut réunir stars du trail et d'Internet", "2026-11-06T07:00:00Z"),
  art("L'Équipe", "Date, heure, diffusion... Tout savoir sur la Backyard de Clem Qui Court", "2026-11-04T13:00:00Z"),
  // Le titre qui énumère les coureurs AVANT le départ : le plus long, donc le plus « central ».
  art("stadion.com", "Mathieu Blanchard, Blandine L'Hirondel, Théo Detienne, Aurélien Sanchez… Qui sont les traileurs à suivre sur la backyard de Clem Qui Court ?", "2026-11-05T19:10:00Z"),
  art("u-Trail", "EN DIRECT – Backyard de Clemquicourt : Mathieu Blanchard abandonne après 4 boucles", "2026-11-06T19:50:00Z"),
  art("20 Minutes", "Le classement final avec le nombre de boucles du Backyard de Clem Qui Court", "2026-11-07T16:08:00Z"),
  art("Ouest-France", "ENTRETIEN. Clem qui court : « Je veux qu'on reparte de ma backyard avec les yeux humides »", "2026-11-06T06:00:00Z"),
  art("stadion.com", "Les 25 heures qui courent : On fait le bilan de la backyard de Clem Qui Court", "2026-11-09T17:21:00Z"),
];
// Un AUTRE événement qui partage le mot « backyard », et rien d'autre.
const BREIZH = art("Le Télégramme", "Pierre Mathieux remporte la première édition de la Breizh Backyard Odyssée", "2026-11-07T20:20:00Z");
// Le même sujet, sans le mot « backyard ».
const EQUIPE_SANS_MOT = art("L'Équipe", "Théo Detienne vainqueur, Mathieu Blanchard abandonne, Clem qui court récolte 1,5 million d'euros", "2026-11-07T16:38:00Z");
const BORDEAUX = [
  art("Sud Ouest", "Marathon de Bordeaux 2026 : sept coureurs évacués à l'hôpital", "2026-11-08T18:36:00Z"),
  art("France 3 Régions", "Avec plus de 30 000 participants, le Marathon de Bordeaux fait son grand retour", "2026-11-08T15:11:00Z"),
  art("u-Trail", "Résultat du Marathon de Bordeaux 2026 : Jason Pointeau gagne", "2026-11-08T09:47:00Z"),
];
const NEW_YORK = [
  art("Libération", "Marathon de New York : qu'est-ce que la rhabdomyolyse ?", "2026-11-05T13:54:00Z"),
  art("Sud Ouest", "Marathon de New York : une jeune femme s'effondre", "2026-11-04T17:01:00Z"),
];
// Un éditeur prolifique : SEPT articles sur un même sujet, à la même minute.
const HANDBOOK = ["Find Your Race in the", "Where the Course Got Most Crowded at the", "Where Runners' Pace Broke at the",
  "The Field by Age, Gender and Country at the", "Who Passed the Most Runners at the", "The Push to Finish Under 3 Hours at the",
  "The Runners Who Finished After Dark at the"].map((t) => art("Marathon Handbook", `${t} Chicago Lakefront Marathon`, "2026-11-08T17:20:00Z"));
// Les articles qui faisaient la une : uniques, mais publiés dans la dernière demi-heure.
const RECENTS = [
  art("Runner's World", "From the Brooks Ghost 18 to Adidas Adizero Evo SL, These Are the 10 Best Men's Running Shoes", "2026-11-09T16:43:00Z"),
  art("Runner's World", "Wiz Khalifa Just Ran His First 5K—and His Time Was Surprisingly Fast", "2026-11-09T16:33:00Z"),
  art("Canadian Running", "The easy way to find your easy pace", "2026-11-09T16:30:00Z"),
  art("Marathon Handbook", "Man Charged With Murder in Killing of Brooklyn Runner Katie Suarez", "2026-11-09T16:34:00Z"),
  art("Ouest-France", "Running. «Il y a tellement de coureurs qu'on peut innover» : comment se créent des nouveaux concepts de course ?", "2026-11-09T16:42:00Z"),
];
// Du bruit : quarante articles isolés de quarante médias locaux, sans mot commun (sinon
// « boucle » ou « ronde » deviendraient des sujets de dix médias, ce qu'ils ne sont pas).
const BRUIT = Array.from({ length: 40 }, (_, i) => art(`Média local ${i}`, `Course à pied à Bourg${i}`, "2026-11-08T10:00:00Z"));

const SEMAINE = [...RECENTS, ...BACKYARD, BREIZH, EQUIPE_SANS_MOT, ...BORDEAUX, ...NEW_YORK, ...HANDBOOK, ...BRUIT];

console.log("\nLa une de la lettre du lundi");

test("la backyard couverte par sept médias passe AVANT les articles les plus récents", () => {
  const une = classerALaUne(SEMAINE, 5);
  assert.equal(une[0].mot, "backyard", `en tête : « ${une[0].article.title} » (sujet ${une[0].mot})`);
  assert.equal(une[0].medias, 7, "Le Monde, L'Équipe, stadion, u-Trail, 20 Minutes, Ouest-France et Le Télégramme : 7 médias");
  const titres = une.map((s) => s.article.title);
  assert.ok(une.slice(0, 3).every((s) => s.medias >= 2), `les trois premiers doivent être des sujets : ${titres.join(" / ")}`);
  assert.ok(!titres.slice(0, 3).some((t) => /Wiz Khalifa/.test(t)), "Wiz Khalifa repasse devant les événements de la semaine");
});

test("l'événement qui écrase la semaine n'est pas écarté comme « mot trop commun »", () => {
  // Un plafond compté en ARTICLES (12 %) aurait jugé « backyard » trop commun dès que
  // l'événement dépasse un article sur huit : la une aurait perdu son sujet n° 1
  // précisément la semaine où il était le plus gros.
  const suivis = Array.from({ length: 30 }, (_, i) => art("stadion.com", `Backyard de Clem Qui Court : point après ${i + 1} heures`, "2026-11-07T10:00:00Z"));
  const pool = [...SEMAINE, ...suivis];
  const part = (BACKYARD.length + suivis.length + 1) / pool.length;
  assert.ok(part > 0.3, `la fixture doit dépasser 30 % d'articles (${Math.round(part * 100)} %)`);
  const [premier] = classerALaUne(pool, 1);
  // Le MOT et le NOMBRE de médias, pas seulement le titre : sous un plafond en articles,
  // « blanchard » (3 médias) prenait la tête avec un titre qui contient lui aussi
  // « Backyard », et une assertion sur le titre restait verte (vu par mutation).
  assert.equal(premier.mot, "backyard", `en tête : « ${premier.article.title} » (sujet ${premier.mot}, ${premier.medias} médias)`);
  assert.equal(premier.medias, 7);
  // Et les Trail Blazers de Portland ne sont pas de la course à pied.
  const nba = ["ESPN", "BFM", "L'Équipe"].map((m) => art(m, "NBA : les Portland Trail Blazers battent les Lakers", "2026-11-09T10:00:00Z"));
  assert.ok(!classerALaUne([...nba, ...BRUIT], 3).some((s) => /Blazers/.test(s.article.title)), "la NBA fait la une de la lettre running");
});

test("un éditeur qui publie sept articles sur un sujet compte pour UN média", () => {
  const une = classerALaUne(SEMAINE, 5);
  const chicago = une.find((s) => s.mot === "chicago" || s.mot === "lakefront");
  assert.ok(!chicago || chicago.medias === 0, `Marathon Handbook seul fait un sujet de ${chicago?.medias} médias`);
  // Bordeaux (3 médias) passe devant ; Chicago (1 média, 7 articles) n'est pas un sujet.
  assert.ok(une.some((s) => s.mot === "bordeaux" && s.medias === 3), "Bordeaux, trois médias, a disparu de la une");
});

test("un sujet n'occupe qu'une place, même quand un titre n'emploie pas son mot", () => {
  // Toute la semaine (`max` = tout) : le complément par récence ne doit pas ramener non
  // plus un article du sujet. Avec 8 places, L'Équipe (samedi) n'était jamais atteinte et
  // le test restait vert sans le rattrapage (vu par mutation).
  const une = classerALaUne(SEMAINE, SEMAINE.length);
  const backyard = une.filter((s) => /backyard|clem|detienne/i.test(s.article.title));
  assert.equal(backyard.length, 1, `la backyard occupe ${backyard.length} places : ${backyard.map((s) => s.article.title).join(" / ")}`);
  assert.ok(!une.some((s) => s.article === BREIZH), "la Breizh Backyard Odyssée doit être absorbée par le sujet backyard, pas revenir seule");
});

test("« marathon » ne réunit pas Bordeaux et New York en un seul sujet", () => {
  const une = classerALaUne(SEMAINE, 5);
  assert.ok(une.some((s) => s.mot === "bordeaux"), "Bordeaux absent");
  assert.ok(une.some((s) => s.mot === "york"), "New York absent");
  assert.ok(!motsDuTitre("Marathon de Bordeaux : résultats du semi et du 10 km").includes("marathon"));
});

test("l'article retenu pour un sujet est le bilan, pas l'annonce au titre le plus long", () => {
  const [sujet] = classerALaUne(SEMAINE, 1);
  assert.match(sujet.article.title, /bilan/, `retenu : « ${sujet.article.title} »`);
});

test("à égalité de place au cœur du sujet, l'article dont le flux donne le texte est préféré (il sera résumé)", () => {
  const texte = "x".repeat(400);
  const a = [
    art("Média A", "Backyard de Clem Qui Court : le récit", "2026-11-09T10:00:00Z"),
    art("Média B", "Backyard de Clem Qui Court : le classement", "2026-11-08T10:00:00Z", texte),
  ];
  const [s] = classerALaUne([...a, ...BRUIT], 1);
  assert.equal(s.article.source, "Média B");
});

test("une semaine sans sujet commun : les plus récents complètent, comme avant", () => {
  const une = classerALaUne([...RECENTS, ...BRUIT.slice(0, 5)], 5);
  assert.equal(une.length, 5);
  assert.ok(une.every((s) => s.medias === 0 && s.mot === ""), "un article isolé ne doit pas se présenter comme un sujet");
  assert.match(une[0].article.title, /Brooks Ghost/, "le plus récent d'abord");
});

test("la lettre lit TOUTE la semaine pour sa une, sans le plafond de 48 du fil", () => {
  const act = sansCommentaires("src/lib/news/actualites.ts");
  const debut = act.indexOf("export async function collecterSemaine");
  const semaine = act.slice(debut, act.indexOf("\n}\n", debut));
  assert.ok(semaine.length > 50, "collecterSemaine a disparu");
  assert.doesNotMatch(semaine, /slice\(/, "la semaine est de nouveau coupée");
  assert.match(act, /export const REQUETES_SEMAINE = \[[\s\S]*?\]\.map\(\(q\) => `\$\{q\} when:7d`\)/, "les requêtes ne sont plus bornées à la semaine");
  const nb = (act.match(/export const REQUETES_SEMAINE = \[([\s\S]*?)\]/)?.[1].match(/"/g) ?? []).length / 2;
  assert.ok(nb >= 4, `${nb} requête(s) : une seule voit 1 article sur la backyard, « trail » en voit 12`);

  const route = sansCommentaires("src/app/api/newsletter/weekly/route.ts");
  assert.match(route, /classerALaUne\(semaine, maxUne\)/, "la une ne passe plus par le classement par médias");
  assert.match(route, /parRubrique\[0\] = une\.map\(\(s\) => s\.article\)/, "le classement est calculé mais la une ne l'utilise pas");
  assert.match(route, /if \(n > 0 && \(dejaALaUne\.has\(it\.link\) \|\| motsDuTitre\(it\.title\)\.some\(\(m\) => sujetsUne\.has\(m\)\)\)\) continue;/,
    "un sujet de la une peut revenir dans une autre rubrique");
});

// ── 10/11 : Élites vide, une sans résumé, et aucune façon de voir la lettre sans l'envoyer ──

test("un sujet garde TOUS ses articles, y compris ceux rattrapés sans son mot", () => {
  const [backyard] = classerALaUne(SEMAINE, 1);
  assert.ok(backyard.membres.includes(EQUIPE_SANS_MOT), "l'article de L'Équipe sans « backyard » n'est pas rattaché au sujet");
  assert.ok(backyard.membres.includes(BREIZH));
  for (const b of BACKYARD) assert.ok(backyard.membres.includes(b), `« ${b.title} » manque au sujet`);
  assert.ok(!backyard.membres.some((m) => BORDEAUX.includes(m)), "Bordeaux s'est glissé dans la backyard");
});

test("le texte d'un sujet = les titres de ses médias, bornés, et le garde-fou des chiffres s'y applique", () => {
  const [backyard] = classerALaUne(SEMAINE, 1);
  const t = texteDuSujet(backyard);
  assert.match(t, /^Ce texte n'est pas un article/, "le modèle doit savoir que ce ne sont que des titres");
  assert.match(t, /Théo Detienne vainqueur, Mathieu Blanchard abandonne.*\(L'Équipe\)/, "un titre rattaché manque, ou sa source");
  assert.match(t, /Le classement final avec le nombre de boucles du Backyard de Clem Qui Court \(20 Minutes\)/);
  assert.ok(t.length >= 320, "trop court : le résumeur irait chercher la page Google News, qui ne donne rien");
  assert.ok(texteDuSujet(backyard, 400).length <= 400, "la borne n'est pas tenue");
  // Le 9/11, le modèle a ajouté « 200 000 spectateurs » : le contrôle doit le refuser.
  assert.equal(chiffresVerifies("Théo Detienne a gagné devant 200 000 spectateurs.", t), false);
  assert.equal(chiffresVerifies("Mathieu Blanchard a abandonné après 4 boucles.", t), true);
  // Un article isolé n'a rien de plus que son titre.
  const seul = classerALaUne([...RECENTS, ...BRUIT.slice(0, 5)], 1)[0];
  assert.equal(texteDuSujet(seul), "");
  // Deux médias au titre identique ne comptent qu'une ligne.
  const doublon = [art("A", "Backyard de Clem Qui Court : Detienne gagne", "2026-11-08T10:00:00Z"), art("B", "Backyard de Clem Qui Court : Detienne gagne", "2026-11-08T11:00:00Z")];
  const td = texteDuSujet(classerALaUne([...doublon, ...BRUIT], 1)[0]);
  assert.equal((td.match(/Detienne gagne/g) ?? []).length, 1, "un titre repris deux fois occupe deux lignes");
});

test("Élites reconnaît un résultat, en français comme en anglais, mais pas une affluence record", () => {
  const elite = FILTRES.elite!;
  for (const t of ["Habtom Samuel and Fentaye Belayneh Win the 2026 Boston Half", "Rachid Habbaz s'impose au semi-marathon de Dreux",
    "Pierrick Renault et Virginie Alleaud remportent les Foulées coursoises", "Jason Pointeau gagne le marathon de Bordeaux"]) {
    assert.ok(elite.test(t) && !PAS_ELITE.test(t), `résultat non reconnu : ${t}`);
  }
  for (const t of ["Boeschepe : la 25e édition bat son record de participants", "Une troisième édition record pour le Trail nocturne des Lacs"]) {
    assert.ok(PAS_ELITE.test(t), `une affluence passe pour un résultat : ${t}`);
  }
});

test("la lettre puise Élites dans la semaine entière, sans les sujets de la une", () => {
  const route = sansCommentaires("src/app/api/newsletter/weekly/route.ts");
  const bloc = route.slice(route.indexOf("const iElite"), route.indexOf("const texteUne"));
  assert.ok(bloc.length > 50, "le bloc Élites a disparu");
  assert.match(bloc, /semaine\.filter\(/, "Élites ne lit plus la semaine");
  assert.match(bloc, /FILTRES\.elite!\.test\(it\.title\)/);
  assert.match(bloc, /!PAS_ELITE\.test\(it\.title\)/, "les affluences record reviennent en Élites");
  assert.match(bloc, /!dejaALaUne\.has\(it\.link\)/, "un sujet de la une revient en Élites (Le Parisien sur la backyard, 9/11)");
  assert.match(bloc, /parRubrique\[iElite\] = sujetsElites\.map\(\(s\) => s\.article\)/, "le choix est calculé mais pas utilisé");
  // Et le texte du sujet arrive bien jusqu'au résumeur.
  assert.match(route, /texte: texteUne\.get\(it\.link\) \?\? it\.texte,/, "les sujets de la une repartent sans texte à résumer");
  assert.match(route, /medias: mediasUne\.get\(it\.link\),/);
});

test("un sujet de la une cite le nombre d'autres médias, dans les cinq langues", () => {
  const base = { title: "Backyard", link: "https://exemple.fr/b", resume: "Un résumé." };
  const attendu: Record<string, RegExp> = { fr: /stadion\.com · et 25 autres médias/, en: /and 25 other outlets/, de: /und 25 weitere Medien/, es: /y 25 medios más/, pt: /e mais 25 meios/ };
  for (const lg of LANGS) {
    const m = construireEmail(lg, [{ cle: "une", articles: [{ ...base, source: "stadion.com", medias: 26 }] }], [], "https://exemple.fr/d", "https://exemple.fr");
    assert.match(m.texte, attendu[lg], `${lg} : texte`);
    assert.match(m.html, attendu[lg], `${lg} : html`);
  }
  const seul = construireEmail("fr", [{ cle: "une", articles: [{ ...base, source: "Le Monde", medias: 1 }] }], [], "https://exemple.fr/d", "https://exemple.fr");
  assert.doesNotMatch(seul.texte, /autre/, "un article seul se dit repris par d'autres médias");
});

test("l'aperçu construit la lettre sans lire les abonnés ni rien envoyer", () => {
  const route = sansCommentaires("src/app/api/newsletter/weekly/route.ts");
  // Le secret d'abord : l'aperçu n'est pas une porte ouverte sur les résumés et le quota.
  assert.ok(route.indexOf("CRON_SECRET") < route.indexOf('searchParams.get("apercu")'), "l'aperçu passe avant le contrôle du secret");
  assert.match(route, /if \(!apercu && !essai\) \{\s*const avecLangue = await admin/, "l'aperçu lit la liste des abonnés");
  const boucle = route.slice(route.indexOf("for (const { email, lang } of abonnes)"));
  const iApercu = boucle.indexOf("if (apercu) {"), iEnvoi = boucle.indexOf('envoyerEmail("newsletter"');
  assert.ok(iApercu > 0 && iApercu < iEnvoi, "l'aperçu n'est pas rendu AVANT l'appel d'envoi");
  assert.match(boucle.slice(iApercu, iEnvoi), /return NextResponse\.json\(\{[\s\S]*envoye: 0/, "l'aperçu ne s'arrête pas avant l'envoi");
});

// ── 10/11 (suite) : Nutrition vide, et le sujet n° 1 parti sans résumé ─────────────────

test("Nutrition garde la nutrition du COUREUR, pas la charcuterie ni les promotions", () => {
  const garde = (t: string) => FILTRES.nutrition!.test(t) && CONTEXTE_COURSE.test(t) && !PROMO.test(t);
  // Titres réels de la semaine du 9/11/2026.
  for (const t of ["Marathon de La Baule. Régularité, nutrition, confiance… les trois conseils d'un coach spécialisé dans la course à pied",
    "« Ils ne viennent plus simplement acheter une paire de chaussures » : de la foulée à la nutrition, ces boutiques qui accompagnent les coureurs",
    "Carbohydrate intake during endurance exercise"]) assert.ok(garde(t), `écarté à tort : ${t}`);
  for (const t of ["Alimentation : jambon, lardons, bacon… 450 produits de charcuterie seront bientôt moins gras et moins salés",
    "« Limiter les féculents et apporter des protéines » : les conseils simples d'une nutritionniste pour bien vivre sa ménopause",
    "Les experts en nutrition le confirment, pour conserver la fraîcheur des pommes de terre il faut les stocker au réfrigérateur",
    "Trail : ce gilet Salomon ultra-léger conçu pour faciliter l'hydratation perd 50 €"]) assert.ok(!garde(t), `gardé à tort : ${t}`);
});

test("la lettre cherche la nutrition de la SEMAINE et la classe par date", () => {
  const act = sansCommentaires("src/lib/news/actualites.ts");
  const req = act.match(/export const REQUETES_NUTRITION = \[([\s\S]*?)\]\.map\(\(q\) => `\$\{q\} when:7d`\)/);
  assert.ok(req, "les requêtes nutrition ne sont plus bornées à la semaine");
  assert.doesNotMatch(req![1], /nutrition sportive/, "« nutrition sportive » remonte l'industrie, pas les coureurs");
  const route = sansCommentaires("src/app/api/newsletter/weekly/route.ts");
  const bloc = route.slice(route.indexOf("const iNutrition"), route.indexOf("const texteUne"));
  assert.ok(bloc.length > 50, "le bloc Nutrition a disparu");
  assert.match(bloc, /nutritionSemaine\s*\.filter\(\(it\) => FILTRES\.nutrition!\.test\(it\.title\) && CONTEXTE_COURSE\.test\(it\.title\) && !PROMO\.test\(it\.title\) && !dejaALaUne\.has\(it\.link\)\)/);
  // Résumable d'abord, puis par date (10/11/2026) ; jamais par regroupement de mots.
  assert.match(bloc, /\.sort\(parInteret\)/, "Nutrition n'est plus classée par intérêt puis par date");
  assert.match(route, /const parInteret = \(a: Item, b: Item\) => resumable\(b\) - resumable\(a\) \|\| tempsDe\(b\) - tempsDe\(a\);/);
  assert.doesNotMatch(bloc, /classerALaUne/, "le regroupement par mot réduirait la rubrique à un article (« nutrition » est son thème)");
  assert.match(bloc, /parRubrique\[iNutrition\] = nutrition/);
  assert.match(route, /collecterNutritionSemaine\(\)\.catch\(/, "une panne de la collecte nutrition ferait tomber la lettre");
});

test("un résumé rejeté a UNE seconde chance, sous le même contrôle", () => {
  assert.deepEqual(chiffresIntrus("Un pic à 200 000 spectateurs et 1,5 million d'euros.", "1,5 million d'euros récoltés"), ["200000"]);
  assert.deepEqual(chiffresIntrus("Detienne gagne après 25 boucles.", "25 boucles"), []);
  // ⚠️ Le contournement réel du 10/11/2026 : refusé pour « 200 000 », le modèle a écrit
  // « 200.000 », lu comme « 200 » et « 000 » — deux nombres présents partout.
  const source = "Detienne gagne après 25 boucles, 200 km de route, 0 abandon chez les 1,5 million de spectateurs.";
  assert.equal(chiffresVerifies("Un pic de 200.000 spectateurs.", source), false, "« 200.000 » passe le contrôle");
  assert.equal(chiffresVerifies("Un pic de 200,000 spectateurs.", source), false, "« 200,000 » passe le contrôle");
  assert.equal(chiffresVerifies("Un pic de 200 000 spectateurs.", source), false);
  assert.ok(chiffresVerifies("Plus de 1,5 million de spectateurs.", source), "une décimale courte doit rester acceptée");
  assert.ok(chiffresVerifies("30.000 participants", "plus de 30 000 participants"), "1.500 et 1 500 sont le même nombre");
  assert.ok(chiffresVerifies("30 000 participants", "plus de 30.000 participants"));
  const src = sansCommentaires("src/lib/newsletter/resume.ts");
  const fn = src.slice(src.indexOf("export async function resumerArticles"), src.indexOf("const LANGUES"));
  const relance = fn.slice(fn.indexOf("if (rejetes.length) {"));
  assert.ok(fn.indexOf("if (rejetes.length) {") > 0, "plus de seconde tentative");
  assert.match(fn, /if \(!chiffresVerifies\(r, x\.src\)\) \{ rejetes\.push\(\{ x, intrus: chiffresIntrus\(r, x\.src\) \}\); continue; \}/, "un rejet n'est plus noté avec ses nombres fautifs");
  assert.match(relance, /intrus\.join\(", "\)/, "la relance ne dit pas au modèle quels nombres retirer");
  assert.match(relance, /!chiffresVerifies\(r, cible\.src\)\) continue;/, "la seconde version échappe au contrôle des chiffres");
  assert.match(relance, /const lot = rejetes\.slice\(0, TAILLE_LOT\);/, "la relance n'est plus bornée à un lot");
  assert.equal((fn.match(/generateContent\(/g) ?? []).length, 2, "un seul appel de relance, pas une boucle : le quota Gemini est partagé");
});

// ── 10/11 (fin) : promotions partout, matériel français, Élites résumé, envoi d'essai ──

test("aucune promotion n'entre dans la lettre, quelle que soit sa forme", () => {
  // Titres réels des requêtes de la semaine du 9/11/2026.
  for (const t of ["Traileuses longue distance, -26% sur la chaussure de trail Asics Trabuco Max 5",
    "Garmin Forerunner 265 à 323,74 € : montre running AMOLED", "11.11 d'AliExpress : la Garmin Forerunner 255 tombe à 228,93€",
    "Ces baskets Mizuno dérapent de 270 à 120 € ce dimanche 8 novembre", "Garmin Forerunner 165 à 199 € : -29 % sur la montre GPS",
    "Les réserves s'épuisent ce lundi : top 5 des chaussures de course adidas à saisir cette semaine de novembre",
    "Vous ne trouverez pas de Garmin moins cher que sur cette page (offre spéciale Single Day)",
    "Chaussures de trail : les meilleures Hoka en promotion en novembre",
    // Chaque forme seule, sans autre indice dans le titre (vu par mutation : les titres
    // réels cumulaient plusieurs indices et masquaient la perte de l'un d'eux).
    "Top 5 des chaussures de course adidas à saisir cette semaine", "La montre Garmin la moins chère du moment"]) assert.ok(PROMO.test(t), `promotion admise : ${t}`);
  // Une SOMME n'est pas un PRIX : elle reste à la une.
  for (const t of ["Résultat des 25 heures qui courent : la cagnotte atteint 1 500 000 €", "près d'1,5 million d'euros de dons",
    "Chaussures de running : pourquoi les prix s'envolent et comment acheter au meilleur prix ?",
    "Test Kailas Fuga EX 330 : L'arme ultime pour l'ultra-trail ?"]) assert.ok(!PROMO.test(t), `écarté à tort : ${t}`);
  const route = sansCommentaires("src/app/api/newsletter/weekly/route.ts");
  assert.match(route, /const publiable = \(it: Item\) => !PROMO\.test\(it\.title\) && !HORS_COURSE\.test\(it\.title\);/);
  assert.match(route, /const semaine = semaineBrute\.filter\(publiable\);/, "une promotion peut faire la une ou Élites");
  const boucle = route.slice(route.indexOf("for (const it of parRubrique[n])"));
  assert.match(boucle.slice(0, 400), /if \(!publiable\(it\)\) continue;/, "les rubriques lues sur le fil (Trail, Matériel) gardent leurs promotions");
});

test("Matériel : des TESTS en français d'abord, puis les tests anglophones résumables", () => {
  for (const t of ["Test Kailas Fuga EX 330 : L'arme ultime pour l'ultra-trail ?", "Test Shokz OpenFit Air 2 : notre avis après plusieurs sorties en trail",
    "Hoka Carbon X 3 vs Nike Alphafly 4 (comparatif 2026)", "Test Suunto Run 2 : la cartographie change-t-elle la donne ?"]) {
    assert.ok(FILTRES.gear!.test(t) && TEST_MATERIEL.test(t) && !PROMO.test(t) && !HORS_COURSE.test(t), `test écarté : ${t}`);
  }
  assert.ok(!TEST_MATERIEL.test("Quelle montre Garmin choisir en 2026 ? Le guide des meilleurs modèles"), "une sélection n'est pas un test");
  assert.ok(HORS_COURSE.test("Test Columbia Titanium Platinum Peak II 3L : un ensemble de ski technique"), "le ski entre dans Matériel");
  const act = sansCommentaires("src/lib/news/actualites.ts");
  assert.match(act, /export const REQUETES_MATERIEL = \[[\s\S]*?\]\.map\(\(q\) => `\$\{q\} when:7d`\)/, "les requêtes matériel ne sont plus bornées à la semaine");
  const route = sansCommentaires("src/app/api/newsletter/weekly/route.ts");
  const bloc = route.slice(route.indexOf("const iMateriel"), route.indexOf("const texteUne"));
  assert.match(bloc, /FILTRES\.gear!\.test\(it\.title\) && TEST_MATERIEL\.test\(it\.title\) && publiable\(it\) && !dejaALaUne\.has\(it\.link\)/);
  assert.match(bloc, /\.slice\(0, RUBRIQUES_LETTRE\[iMateriel\]\.max - 1\)/, "le français prend toutes les places : plus aucun test résumable");
  assert.match(bloc, /parRubrique\[iMateriel\] = \[\.\.\.francais, \.\.\.parRubrique\[iMateriel\]\.filter/, "le français ne passe plus devant");
  assert.match(route, /collecterMaterielSemaine\(\)\.catch\(/);
});

test("les résultats d'Élites repris par plusieurs médias sont résumés, comme la une", () => {
  const route = sansCommentaires("src/app/api/newsletter/weekly/route.ts");
  assert.match(route, /sujetsElites = classerALaUne\(resultats,/);
  assert.match(route, /for \(const s of \[\.\.\.une, \.\.\.sujetsElites\]\) \{/, "Élites repart en titres seuls");
});

test("l'essai envoie la vraie lettre à la SEULE adresse de l'éditeur", () => {
  const route = sansCommentaires("src/app/api/newsletter/weekly/route.ts");
  assert.ok(route.indexOf("CRON_SECRET") < route.indexOf('searchParams.get("essai")'), "l'essai passe avant le contrôle du secret");
  assert.match(route, /if \(essai\) abonnes = \[\{ email: EDITEUR\.email, lang: "fr" \}\];/, "l'essai n'écrit plus à l'éditeur seul");
  assert.match(route, /if \(!apercu && !essai\) \{\s*const avecLangue = await admin/, "l'essai lit la liste des abonnés");
  // L'adresse ne vient JAMAIS de la requête : sinon ce mode écrirait à n'importe qui.
  const lus = [...route.matchAll(/searchParams\.get\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(lus)].sort(), ["apercu", "avecTexte", "cat", "essai"].filter((p) => lus.includes(p)).sort());
  assert.ok(!lus.some((p) => /mail|to|dest/i.test(p)), `un paramètre d'adresse est lu : ${lus.join(", ")}`);
  // Et l'abonné d'essai est remplacé APRÈS le filtre, juste avant l'envoi.
  assert.ok(route.indexOf("if (essai) abonnes =") > route.indexOf("abonnes = abonnes.filter((a) => a.email);"));
});

// ── 10/11 (pertinence) : « ça concerne vraiment mon type de client ? » ───────────────────

test("une rubrique Conseils d'entraînement, juste après la une, annoncée dans les cinq langues", () => {
  assert.equal(RUBRIQUES_LETTRE[1].cle, "conseils", "Conseils n'est plus juste après la une");
  const attendu: Record<string, string> = { fr: "Conseils d'entraînement", en: "Training tips", de: "Trainingstipps", es: "Consejos de entrenamiento", pt: "Dicas de treino" };
  for (const lg of LANGS) assert.equal(libellesSections(lg)[1], attendu[lg], `${lg} : libellé`);
  const m = construireEmail("fr", [{ cle: "conseils", articles: [{ title: "Trouver son allure facile", source: "Canadian Running", link: "https://x.fr/a", resume: "R." }] }], [], "https://x.fr/d", "https://x.fr");
  assert.match(m.texte, /CONSEILS D'ENTRAÎNEMENT/);
});

test("Conseils garde les conseils, pas le sport voisin ni les classements de produits", () => {
  const garde = (t: string, gn: boolean) => FILTRES.conseils!.test(t) && !PAS_CONSEIL.test(t) && (!gn || COURSE_A_PIED.test(t)) && !PROMO.test(t) && !HORS_COURSE.test(t);
  // Titres réels de la semaine du 9/11/2026.
  for (const [t, gn] of [["The easy way to find your easy pace", false], ["How to Master the Run/Walk Method: Training Principles for Consistent Success", false],
    ["Marathon de La Baule. Régularité, nutrition, confiance… les trois conseils d'un coach spécialisé dans la course à pied", true]] as const) {
    assert.ok(garde(t, gn), `écarté à tort : ${t}`);
  }
  for (const [t, gn] of [["The Best Heart Rate Monitors Give You the Most Accurate Training Data", false], ["Where Runners' Pace Broke at the 2026 New York City Marathon", false],
    ["Football : absent des terrains depuis la Coupe du monde, William Saliba de retour à l'entraînement", true],
    ["XV de France : le Rochelais Paul Boudehent ménagé à l'entraînement", true], ["Codes Speed Training (Septembre 2026)", true],
    // « pace » seul n'est pas un conseil (une allure FACILE, de COURSE, de MARATHON, oui).
    ["Strava Pace Charts Get a Redesign", false]] as const) {
    assert.ok(!garde(t, gn), `gardé à tort : ${t}`);
  }
  // Le contexte de course de la presse générale : l'entraînement d'un autre sport n'en est pas.
  // Même sans la liste HORS_COURSE, le football doit rester dehors (deux protections).
  assert.ok(!COURSE_A_PIED.test("William Saliba de retour à l'entraînement après la Coupe du monde"));
  // HORS_COURSE garde AUSSI la une et Élites, qui n'ont pas COURSE_A_PIED.
  for (const t of ["Football : William Saliba de retour", "XV de France : Paul Boudehent ménagé", "Rugby : le Stade toulousain s'impose"]) assert.ok(HORS_COURSE.test(t), t);
  assert.ok(CONTEXTE_COURSE.test("William Saliba de retour à l'entraînement"), "CONTEXTE_COURSE contient bien « entraînement » : d'où COURSE_A_PIED");
  for (const t of ["La course de Saint-Pol", "Les coureuses du dimanche", "Courir en hiver", "Réussir son premier 10 km"]) assert.ok(COURSE_A_PIED.test(t), t);
});

test("la route remplit Conseils : français résumable d'abord, un article par média", () => {
  const route = sansCommentaires("src/app/api/newsletter/weekly/route.ts");
  const bloc = route.slice(route.indexOf("const iConseils"), route.indexOf("const texteUne"));
  assert.ok(bloc.length > 50, "le bloc Conseils a disparu");
  assert.match(bloc, /FILTRES\.conseils!\.test\(it\.title\) && !PAS_CONSEIL\.test\(it\.title\)/);
  assert.match(bloc, /\(!lienGoogleNews\(it\.link\) \|\| COURSE_A_PIED\.test\(it\.title\)\) && publiable\(it\) && !dejaALaUne\.has\(it\.link\)/);
  assert.match(bloc, /\.sort\(parInteretFr\)/);
  assert.match(bloc, /parRubrique\[iConseils\] = unParMedia\(conseils\)/, "Runner's World peut occuper toute la rubrique");
  assert.match(route, /const interetFr = \(it: Item\) => resumable\(it\) \* 2 \+ \(it\.langue === "en" \? 0 : 1\);/, "l'ordre français résumable > anglais résumable > titre seul a changé");
  assert.match(route, /const resumable = \(it: Item\) => \(\(it\.texte \?\? ""\)\.trim\(\)\.length >= 320 \|\| !lienGoogleNews\(it\.link\) \? 1 : 0\);/);
  assert.match(route, /collecterConseilsSemaine\(\)\.catch\(/);
  // Nutrition et Matériel trient aussi par intérêt, et Matériel ne prend que du français.
  assert.match(route.slice(route.indexOf("const nutrition = nutritionSemaine")), /^[\s\S]{0,300}\.sort\(parInteret\)/);
  assert.match(route, /\.filter\(\(it\) => it\.langue !== "en" && FILTRES\.gear!\.test\(it\.title\)/);
  assert.match(route, /const francais = unParMedia\(materielSemaine/, "Run Actu peut occuper toutes les places françaises de Matériel");
});

test("entre deux copies d'un article, on garde celle qu'on pourra résumer (lien direct)", () => {
  const gn = { title: "Test On Cloudsurfer 3 : la révolution de la mousse", source: "Run Actu", link: "https://news.google.com/rss/articles/CBMi123", date: "2026-11-08T10:00:00Z", domain: "", favicon: "", langue: "fr" as const };
  const direct = { ...gn, link: "https://runactu.com/test-on-cloudsurfer-3/" };
  for (const ordre of [[[gn], [direct]], [[direct], [gn]]]) {
    const r = fusionnerListes(ordre);
    assert.equal(r.length, 1, "un même article compté deux fois");
    assert.equal(r[0].link, direct.link, "la copie Google News (non résumable) est gardée");
  }
  assert.ok(lienGoogleNews(gn.link) && !lienGoogleNews(direct.link));
  const act = sansCommentaires("src/lib/news/actualites.ts");
  for (const f of ["runactu.com/feed", "montre-cardio-gps.fr/feed"]) assert.ok(act.includes(f), `flux à lien direct retiré : ${f}`);
});

test("un sujet n'est pas représenté par un titre politique quand il en a un autre", () => {
  const nice = [
    art("ladepeche.fr", "David Lisnard et Christian Estrosi courent sur le marathon Nice-Cannes, le candidat à l'élection présidentielle boucle 21,1 km", "2026-11-09T12:00:00Z"),
    art("Jogging International", "Marathon des Alpes-Maritimes Nice-Cannes : 25 000 participants pour une 18e édition", "2026-11-09T08:00:00Z"),
    art("u-Trail", "Manon Gras remporte le Marathon Nice-Cannes", "2026-11-08T10:00:00Z"),
  ];
  // Et à place égale au cœur du sujet, le lien direct (résumable) passe devant Google News,
  // même plus récent.
  const gn = art("Média X", "Backyard de Clem Qui Court : le bilan", "2026-11-09T12:00:00Z");
  gn.link = "https://news.google.com/rss/articles/CBMiXYZ";
  const direct = art("Média Y", "Backyard de Clem Qui Court : le classement", "2026-11-08T12:00:00Z");
  assert.equal(classerALaUne([gn, direct, ...BRUIT], 1)[0].article, direct, "un lien Google News (titre seul) représente le sujet");
  const [s] = classerALaUne([...nice, ...BRUIT], 1);
  assert.equal(s.medias, 3, `le sujet Nice-Cannes n'est pas formé (${s.mot})`);
  assert.ok(!POLITIQUE.test(s.article.title), `représenté par : « ${s.article.title} »`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
