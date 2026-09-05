/**
 * UN LIBELLÉ VISIBLE QUI N'EST RELIÉ À RIEN N'EN EST PAS UN.
 *
 * Constaté sur la production le 04/09/2026, sur le FORMULAIRE D'INSCRIPTION — la toute
 * première interaction d'un client avec le produit. Les libellés « Prénom & Nom »,
 * « Email », « Mot de passe » étaient bien affichés, mais reliés à aucun champ : ni
 * `htmlFor`, ni `id`, ni `<label>` englobant. Le nom accessible retombait donc sur le
 * `placeholder`, et un lecteur d'écran annonçait « Marie Dupont » au lieu de
 * « Prénom & Nom ». Quelqu'un qui n'y voit pas ne pouvait pas savoir quoi taper.
 *
 * Pour tout le monde, cliquer le libellé ne plaçait pas non plus le curseur dans le
 * champ — ce que fait tout formulaire correct.
 *
 * Relevé global : 107 `<label>` dans l'application, 7 seulement avec `htmlFor`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/**
 * Extrait une balise ENTIÈRE, en équilibrant les accolades.
 *
 * ⚠️ UNE EXPRESSION FERMÉE PAR REGEX SE TROMPE ICI. Un simple `<img[^>]*>` s'arrête au
 * premier « > » venu — y compris celui de la FLÈCHE d'une fonction placée dans un
 * attribut (`srcSet={l.map((w) => ...)}`). Le premier jet de ce test signalait ainsi une
 * image de la landing comme dépourvue de texte alternatif, alors qu'elle en a un : la
 * balise était coupée avant l'attribut `alt`. On avance donc caractère par caractère.
 */
function balises(src: string, noms: string[]): string[] {
  const out: string[] = [];
  for (const nom of noms) {
    const re = new RegExp(`<${nom}[\\s/>]`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      let profondeur = 0, guillemet = "";
      for (let i = m.index; i < src.length; i++) {
        const c = src[i];
        if (guillemet) { if (c === guillemet) guillemet = ""; continue; }
        if (c === '"' || c === "'" || c === "`") { guillemet = c; continue; }
        if (c === "{") profondeur++;
        else if (c === "}") profondeur--;
        else if (c === ">" && profondeur === 0) { out.push(src.slice(m.index, i + 1)); break; }
      }
    }
  }
  return out;
}

/** Les champs d'un fichier qui ne portent NI `id` NI `aria-label`. */
function champsOrphelins(f: string): number {
  return balises(codeNu(f), ["input", "select", "textarea"])
    .filter((b) => !/type="(hidden|submit|button)"/.test(b))
    .filter((b) => !/\bid=|aria-label/.test(b))
    .length;
}

function tousLesTsx(): string[] {
  const out: string[] = [];
  (function marche(d: string) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) marche(p);
      else if (/\.tsx$/.test(p)) out.push(p);
    }
  })("src");
  return out;
}

test("le tunnel d'acquisition relie chaque champ à son libellé", () => {
  // Inscription, connexion, questionnaire initial : les trois écrans que TOUT nouveau
  // client traverse. Le reste de l'application est une dette bornée (test suivant).
  //
  // ⚠️ LES TOLÉRANCES SONT DES CHAMPS ENVELOPPÉS DANS UN `<label>`, ce que ce test ne
  // sait pas voir depuis le source — vérifié dans le navigateur : la case de
  // consentement de l'inscription rend bien « label englobant » comme nom accessible.
  // Les cinq du questionnaire sont des cases et curseurs à l'intérieur de leur libellé.
  const TOLERE: Record<string, number> = {
    "src/app/(auth)/signup/page.tsx": 1,
    "src/app/(auth)/login/page.tsx": 0,
    "src/app/onboarding/page.tsx": 5,
  };
  for (const [f, max] of Object.entries(TOLERE)) {
    const n = champsOrphelins(f);
    assert.ok(n <= max, `${f} : ${n} champ(s) sans lien programmatique (toléré : ${max})`);
  }
  // Et la liaison doit être RÉELLE, pas seulement l'absence d'orphelins.
  for (const f of ["src/app/(auth)/signup/page.tsx", "src/app/(auth)/login/page.tsx"]) {
    const src = codeNu(f);
    const labels = [...src.matchAll(/<label\b/g)].length;
    const relies = [...src.matchAll(/<label[^>]*\bhtmlFor=/g)].length;
    assert.ok(relies >= labels - 1, `${f} : ${relies} libellé(s) reliés sur ${labels}`);
    assert.ok(/useId\(\)/.test(src),
      `${f} n'utilise plus useId : deux formulaires sur une même page entreraient en collision`);
  }
});

/**
 * ⚠️ CE PLAFOND NE PEUT QUE BAISSER.
 *
 * 87 champs, contre 130 après le tunnel d'acquisition — et le vrai chiffre est encore
 * plus bas. Un relevé PAR FORME, mené le 05/09/2026, a montré que « 130 » mélangeait
 * trois choses très différentes :
 *   · 27 champs ENVELOPPÉS dans leur `<label>` — déjà conformes, jamais une dette ;
 *   · 27 paires libellé/champ simplement non reliées — corrigées par `htmlFor`/`id` ;
 *   · le reste, dont 49 champs nommés par leur seul `placeholder` (annoncé par les
 *     lecteurs d'écran : imparfait, pas bloquant), 5 champs `type="file"` MASQUÉS et
 *     déclenchés par un bouton qui porte un `title` — donc nommés — et 3 listes
 *     déroulantes dans /admin.
 *
 * Ce plafond compte donc large : il inclut des faux positifs que ce test, qui lit le
 * source ligne à ligne, ne sait pas distinguer. Il ne peut que baisser. Le
 * reste est une dette réelle, pas un choix : l'écrire ici la rend visible et empêche
 * qu'elle grandisse. Quand tu en corriges, baisse ce nombre — le test t'y oblige en
 * n'acceptant jamais plus que lui.
 *
 * Le corriger partout demande d'introduire un composant de champ partagé et de vérifier
 * vingt écrans un par un : c'est un chantier, pas une retouche, et le faire à l'aveugle
 * sur 130 sites casserait des mises en page que rien ici ne sait contrôler.
 */
const PLAFOND_ORPHELINS = 87;

test("la dette d'accessibilité ne grandit pas", () => {
  const fichiers = tousLesTsx();
  const total = fichiers.reduce((n, f) => n + champsOrphelins(f), 0);
  if (process.env.DETTE_A11Y === "1") console.log(`        [mesure] ${total} champs orphelins`);
  assert.ok(total <= PLAFOND_ORPHELINS,
    `${total} champs sans lien programmatique, contre ${PLAFOND_ORPHELINS} tolérés : un nouvel écran a été écrit sans relier ses libellés`);
  // ⚠️ Un balayage qui ne parcourt rien passe toujours.
  assert.ok(fichiers.length > 100, `seulement ${fichiers.length} fichiers .tsx parcourus`);
});

test("aucune image ne part sans texte alternatif", () => {
  // Zéro au relevé — ce test empêche la première.
  const sans: string[] = [];
  for (const f of tousLesTsx())
    for (const b of balises(codeNu(f), ["img", "Image"]))
      if (!/\balt\s*=/.test(b)) sans.push(`${f}  ${b.slice(0, 60).replace(/\s+/g, " ")}`);
  assert.deepEqual(sans, [], `ces images n'ont pas de texte alternatif :\n    ${sans.join("\n    ")}`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
