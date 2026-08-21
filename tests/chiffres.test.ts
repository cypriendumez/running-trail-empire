/**
 * L'APP N'AFFICHE QUE DES CHIFFRES QUI SE RECOMPTENT.
 *
 * Trois chiffres inventés — « 10k+ coureurs », « 4.9★ de note moyenne », « 98 % de
 * satisfaction » — avaient été retirés de la page d'accueil : la base compte UN profil,
 * et il n'existe ni note ni enquête de satisfaction. Personne n'était venu les retirer
 * du panneau des pages de CONNEXION et d'INSCRIPTION, qui portaient leur propre copie.
 * Ils y sont donc restés affichés, sur la page même où l'on demande une adresse et un
 * mot de passe, jusqu'au 20/08/2026.
 *
 * Deuxième défaut de la même famille : la durée de l'essai était recopiée à la main et
 * avait divergé en TROIS valeurs contradictoires — « 30 jours » à l'inscription,
 * « 7 jours » sur l'accueil, « 14 jours » dans les réglages. Seul `JOURS_ESSAI` fait foi.
 *
 * Ce test importe les sources plutôt que de les greper quand il le peut, et vérifie que
 * rien ne recopie ce qui doit venir d'un seul endroit.
 *
 *   npx tsx tests/chiffres.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CHIFFRES, CHIFFRES_LANDING, CHIFFRES_AUTH } from "../src/lib/brand/stats";
import { JOURS_ESSAI } from "../src/lib/billing/access";
import { ARTICLES } from "../src/app/blog/articles";
import { ARTICLES_I18N } from "../src/app/blog/articlesI18n";
import { LEGAL } from "../src/app/legalI18n";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

let passed = 0;
const fails: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { fails.push(`${name} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${name}`); }
}

function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}
/** ⚠️ On ne coupe pas un « // » précédé de « : » — sinon les URL seraient tronquées. */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}
const TOUS = fichiers(SRC).map((p) => ({
  rel: relative(SRC, p).replace(/\\/g, "/"),
  code: sansCommentaires(readFileSync(p, "utf8")),
}));

// ── Garde-fou du garde-fou ───────────────────────────────────────────────────
test("le scanner voit réellement le source", () => {
  assert.ok(TOUS.length > 100, `seulement ${TOUS.length} fichiers scannés`);
  for (const f of ["app/page.tsx", "components/auth/AuthShell.tsx", "components/auth/authI18n.ts"]) {
    assert.ok(TOUS.some((x) => x.rel === f), `${f} n'a pas été scanné`);
  }
});

// ── 1. Les chiffres inventés ne peuvent pas revenir ──────────────────────────
// Motifs volontairement larges : c'est la FORME du chiffre inventé qu'on interdit,
// pas une chaîne exacte qu'il suffirait de réécrire « 10 000+ » pour contourner.
const INVENTES: [RegExp, string][] = [
  [/\b10k\+/i,                         "« 10k+ coureurs » — la base compte UN profil"],
  [/\b4[.,]9\s*★/,                     "« 4,9 ★ » — aucune note n'existe dans l'app"],
  [/\b98\s*%/,                         "« 98 % de satisfaction » — aucune enquête n'existe"],
  [/\b\d[\d\s]*\+?\s*(coureurs actifs|active runners)\b/i, "un nombre d'utilisateurs inventé"],
];

test("aucun chiffre inventé n'est affiché", () => {
  const vus: string[] = [];
  for (const { rel, code } of TOUS) {
    for (const [motif, motif_txt] of INVENTES) {
      if (motif.test(code)) vus.push(`${rel} → ${motif_txt}`);
    }
  }
  assert.equal(vus.length, 0, `chiffre(s) invérifiable(s) affiché(s) :\n    ${vus.join("\n    ")}`);
});

// ── 2. Une seule source pour les chiffres vérifiables ────────────────────────
test("l'accueil et les pages d'auth lisent la MÊME source", () => {
  for (const f of ["app/page.tsx", "components/auth/AuthShell.tsx"]) {
    const x = TOUS.find((t) => t.rel === f)!;
    assert.ok(
      /from "@\/lib\/brand\/stats"/.test(x.code),
      `${f} n'importe plus lib/brand/stats — il a sûrement recopié les valeurs`,
    );
  }
});

test("les chiffres publiés sont ceux de la source", () => {
  assert.equal(CHIFFRES_LANDING.length, 4);
  assert.equal(CHIFFRES_AUTH.length, 3);
  for (const v of [...CHIFFRES_LANDING, ...CHIFFRES_AUTH]) {
    assert.ok(Object.values(CHIFFRES).includes(v as never), `« ${v} » ne vient pas de CHIFFRES`);
  }
});

// ── 3. La durée d'essai ne se recopie pas ────────────────────────────────────
test("JOURS_ESSAI reste la seule définition de la durée d'essai", () => {
  assert.equal(typeof JOURS_ESSAI, "number");
  assert.ok(JOURS_ESSAI > 0 && JOURS_ESSAI < 60, `valeur improbable : ${JOURS_ESSAI}`);
});

test("aucune durée d'essai n'est écrite en dur dans un écran", () => {
  // Formulations d'essai des 5 langues, avec un nombre COLLÉ à la place du gabarit {n}.
  // ⚠️ Ne PAS accepter un simple « N jours de … » : « 4 jours de repos » n'est pas une
  // durée d'essai. Premier jet du test, trois faux positifs — c'était le test qui avait tort.
  const ecrit = /\b(\d+)[\s-]*(jours? (?:gratuits?|d'essai)|day[\s-]*free|days? free|Tage kostenlos|días? (?:gratis|de (?:prueba|la prueba))|dias? (?:grátis|do teste|de teste))/i;
  const vus: string[] = [];
  for (const { rel, code } of TOUS) {
    if (rel.startsWith("lib/billing/")) continue; // c'est LÀ que la durée se définit
    const m = code.match(ecrit);
    if (m) vus.push(`${rel} → « ${m[0].trim()} » (utiliser le gabarit {n} + JOURS_ESSAI)`);
  }
  assert.equal(vus.length, 0, `durée(s) d'essai recopiée(s) :\n    ${vus.join("\n    ")}`);
});

// ── 4. Aucune ancre interne ne vise le vide ──────────────────────────────────
// La barre et le menu mobile pointaient sur « #features » alors qu'aucune section ne
// portait cet identifiant : le clic changeait l'URL et ne défilait nulle part. Rien ne
// pouvait le voir — une ancre morte est du HTML parfaitement valide, le typage et le
// build passent. Seul un test qui CONFRONTE les deux listes l'attrape.
test("toute ancre interne vise un id qui existe", () => {
  const ancres = new Map<string, Set<string>>();
  const ids = new Set<string>();
  for (const { rel, code } of TOUS) {
    for (const m of code.matchAll(/href="#([A-Za-z][\w-]*)"/g)) {
      ancres.set(m[1], (ancres.get(m[1]) ?? new Set()).add(rel));
    }
    for (const m of code.matchAll(/\bid="([A-Za-z][\w-]*)"/g)) ids.add(m[1]);
  }
  assert.ok(ancres.size > 0, "aucune ancre trouvée — la regex ne mord plus");
  assert.ok(ids.size > 0, "aucun id trouvé — la regex ne mord plus");
  const mortes = [...ancres.entries()]
    .filter(([a]) => !ids.has(a))
    .map(([a, fs]) => `#${a} → ${[...fs].join(", ")}`);
  assert.equal(mortes.length, 0, `ancre(s) qui ne mènent nulle part :\n    ${mortes.join("\n    ")}`);
});

// ── 5. Aucune traduction d'article ne vise un slug inexistant ────────────────
// Le repli du blog est `trad ?? a` : une traduction dont le slug est mal orthographié
// n'est jamais trouvée, donc jamais affichée — et le bandeau « pas encore traduit »
// reste, alors que le texte existe. Rien ne le signale : ni le typage (les clés d'un
// Record sont des chaînes), ni le build, ni l'écran. C'est un travail perdu en silence.
test("chaque traduction d'article correspond à un article réel", () => {
  const slugs = new Set(ARTICLES.map((a) => a.slug));
  assert.ok(slugs.size >= 8, `seulement ${slugs.size} articles — la source ne se lit plus`);
  const orphelines: string[] = [];
  let total = 0;
  for (const [lg, parSlug] of Object.entries(ARTICLES_I18N)) {
    for (const slug of Object.keys(parSlug ?? {})) {
      total++;
      if (!slugs.has(slug)) orphelines.push(`${lg} → « ${slug} »`);
    }
  }
  assert.ok(total > 0, "aucune traduction trouvée — l'import ne mord plus");
  assert.equal(
    orphelines.length, 0,
    `traduction(s) rattachée(s) à un slug qui n'existe pas :\n    ${orphelines.join("\n    ")}\n` +
    `    → elles ne s'afficheront JAMAIS et le bandeau « pas encore traduit » restera.`,
  );
});

test("les mentions légales disent la même chose dans les 5 langues", () => {
  // ⚠️ Une page légale se remplit langue par langue, et c'est exactement là qu'on
  // s'arrête au milieu : j'ai renseigné l'hébergeur en fr/en/de, puis j'ai failli
  // publier es et pt avec leur marqueur « [POR COMPLETAR] » encore en place. Un visiteur
  // portugais aurait lu, sur la page qui l'informe de ses droits, une consigne interne
  // non remplie.
  //
  // La LCEN impose de nommer l'hébergeur. Vercel Inc. est vérifié dans la politique de
  // confidentialité de Vercel elle-même — pas déduit du fait qu'on déploie chez eux.
  const MARQUEURS = /\[(À RENSEIGNER|TO COMPLETE|AUSZUFÜLLEN|POR COMPLETAR|A PREENCHER)[^\]]*\]/g;

  for (const [lg, doc] of Object.entries(LEGAL)) {
    const tout = JSON.stringify(doc);
    assert.ok(tout.includes("Vercel Inc."), `l'hébergeur n'est pas nommé en ${lg}`);
    assert.ok(tout.includes("Covina, CA 91723"), `l'adresse de l'hébergeur manque en ${lg}`);
    assert.ok(tout.includes("cypriendumez@outlook.fr"), `aucun contact d'éditeur en ${lg}`);

    // Il RESTE un marqueur légitime — le statut juridique, que seul l'éditeur connaît.
    // Le test ne l'interdit pas ; il interdit tout AUTRE trou, et vérifie que le trou
    // connu est bien le même dans chaque langue.
    const restants = tout.match(MARQUEURS) ?? [];
    assert.equal(restants.length, 1, `${restants.length} mentions à compléter en ${lg} : ${restants.join(" | ")}`);
    assert.ok(
      /particulier|individual|Privatperson|particular/i.test(restants[0]),
      `le trou restant en ${lg} n'est pas le statut juridique : ${restants[0]}`,
    );
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
