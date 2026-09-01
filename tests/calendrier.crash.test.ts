/**
 * CRASH-TESTS DU CALENDRIER — ce que l'athlète LIT dans une case.
 *
 * Le calendrier affichait la prose entière d'une séance, coupée à trois lignes. Or toute
 * séance de course commence par le même échauffement reconstruit : les trois lignes
 * visibles étaient donc identiques d'une case à l'autre, et la coupure tombait juste
 * avant ce qui les distingue. Mesuré sur la page : 369 des 798 mots dans huit blocs dont
 * aucun n'était lisible jusqu'au bout.
 *
 * Ces deux fonctions décident maintenant de ce qui reste visible. Elles ne peuvent pas
 * planter — elles peuvent afficher la mauvaise moitié d'une séance, ce qui est pire,
 * parce que rien ne le signale.
 *
 *   npx tsx tests/calendrier.crash.test.ts
 */
import assert from "node:assert/strict";
import { extractBody, stripBodyLabel, premierePhrase } from "../src/lib/calendar/texte";
import { readFileSync } from "node:fs";

let passed = 0;
const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  KO ${nom}`); }
}

/** Séances réelles, telles que le coach les écrit (relevées sur le compte de test). */
const SEANCES: [string, string][] = [
  ["seuil",
   "Échauffement 20 min progressif FC Z1→Z2 + 3 à 5 lignes droites de 80 m → Corps : Seuil long (SOUS-seuil) : 2×10 min à ~3'59/km, récup 3 min → Retour au calme 10 min FC Z1."],
  ["endurance",
   "Échauffement 15 min progressif FC Z1→Z2 → Corps : ~11 km (environ 58 min) en Z2 (~5'15/km), tu dois pouvoir tenir une conversation → Retour au calme 10 min FC Z1."],
  ["sortie longue",
   "Échauffement 15 min progressif FC Z1→Z2 → Corps : ~22 km (environ 2 h) en Z2, dernier tiers légèrement plus soutenu → Retour au calme 10 min FC Z1."],
];

console.log("\nCORPS DE SÉANCE — retirer l'échauffement, pas le contenu");

test("l'échauffement et le retour au calme disparaissent, le corps reste", () => {
  for (const [nom, brut] of SEANCES) {
    const corps = extractBody(brut);
    assert.ok(!/Échauffement/i.test(corps), `${nom} : l'échauffement est resté`);
    assert.ok(!/Retour au calme/i.test(corps), `${nom} : le retour au calme est resté`);
    assert.ok(corps.length > 10, `${nom} : le corps est vide (« ${corps} »)`);
  }
});

test("deux séances différentes donnent deux corps différents", () => {
  // C'EST LE DÉFAUT D'ORIGINE : avec la prose entière, deux séances de seuil affichaient
  // exactement le même texte visible. Le corps est la seule partie qui les distingue.
  const a = extractBody("Échauffement 20 min progressif FC Z1→Z2 + 3 à 5 lignes droites de 80 m → Corps : Seuil : 2×5 min à ~3'55/km → Retour au calme 10 min FC Z1.");
  const b = extractBody("Échauffement 20 min progressif FC Z1→Z2 + 3 à 5 lignes droites de 80 m → Corps : Seuil : 2×10 min à ~3'59/km → Retour au calme 10 min FC Z1.");
  assert.notEqual(a, b, "deux séances de seuil différentes produisent le même texte");
  assert.ok(a.includes("2×5") && b.includes("2×10"), `les répétitions ont disparu : « ${a} » / « ${b} »`);
});

test("le mot « Corps : » n'est pas réaffiché — c'est du balisage, pas du contenu", () => {
  for (const [, brut] of SEANCES) {
    assert.ok(!/^corps\s*:/i.test(extractBody(brut)), "le libellé « Corps : » reste visible");
  }
  assert.equal(stripBodyLabel("Corps : 10 km"), "10 km");
  assert.equal(stripBodyLabel("Main set: 10 km"), "10 km");
  assert.equal(stripBodyLabel("Hauptteil : 10 km"), "10 km");
});

test("une séance SANS échauffement n'est pas amputée", () => {
  // Repos, renfo, séance libre : il n'y a pas de structure à retirer. Tout doit rester.
  for (const brut of [
    "Repos complet. Marche, étirements doux ou mobilité si tu en ressens le besoin.",
    "30 à 40 min de gainage, squats, fentes.",
    "10 km à ton allure.",
  ]) {
    assert.equal(extractBody(brut), brut, `« ${brut.slice(0, 30)}… » a été amputée`);
  }
});

test("les progressions de zone ne sont pas prises pour des étapes", () => {
  // « FC Z1 → Z2 » est une progression INTERNE à l'échauffement. Si on la compte comme
  // une étape, le « Z2 » devient le corps de la séance et l'athlète lit « Z2 ».
  const corps = extractBody("Échauffement 15 min progressif FC Z1 → Z2 → Corps : 10 km en Z2 → Retour au calme 10 min.");
  assert.ok(corps.includes("10 km"), `le corps est devenu « ${corps} »`);
  assert.notEqual(corps.trim(), "Z2");
});

test("entrées hostiles : rien ne plante, rien ne devient vide sans raison", () => {
  for (const brut of ["", "   ", "→", "→→→", "Corps :", "a".repeat(3000), "Échauffement", "Retour au calme 10 min."]) {
    const r = extractBody(brut);
    assert.equal(typeof r, "string", `« ${brut.slice(0, 12)} » → ${typeof r}`);
  }
});

test("une séance QUE d'échauffement ne disparaît pas complètement", () => {
  // Si tout est retiré il ne reste rien à afficher : mieux vaut montrer la séance telle
  // quelle qu'une case vide, qui ferait croire à un jour sans rien de prévu.
  const r = extractBody("Échauffement 20 min progressif FC Z1→Z2.");
  assert.ok(r.length > 0, "la case serait vide alors qu'une séance est prévue");
});

console.log("\nPHRASE D'AVERTISSEMENT — ce qui reste lisible sans déplier");

const AVERTISSEMENT = "Un marathon à 20 ans, c'est autorisé (catégorie Espoir / U23 et au-delà) et parfaitement faisable — mais c'est l'effort le plus exigeant de la course à pied, et rien ne presse : la plupart des coureurs atteignent leur meilleur niveau sur cette distance entre 28 et 35 ans. Le chemin le plus sûr passe par des paliers.";

test("la première phrase porte bien l'avertissement", () => {
  const p = premierePhrase(AVERTISSEMENT);
  assert.ok(p.length > 20, "la phrase visible est trop courte pour avertir de quoi que ce soit");
  assert.ok(p.length < AVERTISSEMENT.length, "rien n'a été replié");
  assert.ok(!p.endsWith("U23."), "la coupure est tombée sur une abréviation");
});

test("un avertissement court reste entier", () => {
  for (const court of ["Attention à ta charge.", "Objectif ambitieux mais tenable."]) {
    assert.equal(premierePhrase(court), court, `« ${court} » a été tronqué sans raison`);
  }
});

test("un texte sans ponctuation finale est borné, jamais rendu vide", () => {
  const sans = "un texte tres long sans aucune ponctuation ".repeat(20);
  const p = premierePhrase(sans);
  // La borne suit la fenêtre de recherche de phrase (320) : elle avait été figée à 201
  // dans le test, qui rougissait donc à l'élargissement — un test qui interdit la
  // correction qu'il a lui-même provoquée.
  assert.ok(p.length > 0 && p.length <= 321, `longueur ${p.length}`);
  assert.ok(!/\s$/.test(p), "la coupure laisse une espace en fin de phrase");
});

test("entrées vides ou corrompues : chaîne vide, jamais « undefined »", () => {
  for (const v of ["", "   ", null as never, undefined as never, 42 as never]) {
    const p = premierePhrase(v);
    assert.equal(typeof p, "string");
    assert.ok(!p.includes("undefined") && !p.includes("null"), `« ${p} »`);
  }
});

test("la coupure ne tombe jamais au milieu d'un mot", () => {
  // ⚠️ PREMIÈRE VERSION FAUSSE : elle exigeait une espace AVANT le « … », donc elle
  // rougissait sur « … la plupart des… », où « des » est pourtant un mot entier. Ce
  // qu'il faut vérifier, c'est que le texte source CONTINUE par une espace à l'endroit
  // de la coupure — sinon c'est bien un mot qu'on a scié en deux.
  for (const t of [AVERTISSEMENT, "mot ".repeat(200), "azerty ".repeat(80)]) {
    const p = premierePhrase(t);
    if (!p.endsWith("…")) continue;
    const prefixe = p.slice(0, -1);
    const suite = t.slice(prefixe.length);
    assert.ok(suite === "" || /^\s/.test(suite),
      `coupure en plein mot : « …${prefixe.slice(-20)} » puis « ${suite.slice(0, 10)} »`);
  }
});

test("l'avertissement visible se termine sur une vraie phrase", () => {
  // Le repli n'a d'intérêt que si ce qui reste se lit. « … mais c'est l'effort le p… »
  // n'avertit de rien : la fenêtre de recherche était trop courte pour atteindre la
  // première fin de phrase, située au 270ᵉ caractère de l'avertissement réel.
  const p = premierePhrase(AVERTISSEMENT);
  assert.ok(/[.!?]$/.test(p), `l'avertissement visible se coupe : « …${p.slice(-30)} »`);
});

console.log("\nBRANCHEMENT — la vue mois doit vraiment s'en servir");

test("la case de la vue mois affiche le CORPS, pas la prose entière", () => {
  // Le calcul peut être parfait sans être branché : c'est le site d'appel qui produit
  // l'effet. On retire les commentaires — celui qui documente le correctif contient
  // justement les mots qu'on cherche.
  const src = readFileSync("src/components/training/CalendarView.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(src.includes("? extractBody(s.detail) : s.detail"),
    "la vue mois réaffiche la prose entière : les cases redeviennent identiques entre elles");
  // Et deux lignes, pas trois : trois lignes de corps redeviennent un pavé.
  assert.ok(/dense \? "line-clamp-2 text-\[10px\]"/.test(src),
    "la case n'est plus bornée à deux lignes");
});

test("l'avertissement est repliable, et sa phrase clé reste visible repliée", () => {
  const src = readFileSync("src/components/training/CalendarView.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(src.includes("<details"), "l'avertissement est de nouveau déplié en permanence");
  assert.ok(src.includes("premierePhrase(warnings[0])"),
    "rien ne reste visible quand l'avertissement est replié : une mise en garde muette");
  assert.ok(src.includes("group-open:hidden"),
    "la phrase clé se répète juste au-dessus du texte complet une fois déplié");
});

console.log(`\n${passed} crash-test(s) du calendrier passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
