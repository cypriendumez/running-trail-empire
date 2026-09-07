/**
 * LA BULLE D'AIDE ÉCHAPPAIT AU PARTAGE DES FORMULES.
 *
 * `/api/ai/support` n'exigeait que d'être connecté : ni capacité, ni plafond. Un compte
 * à 0 € obtenait donc une réponse ÉCRITE PAR LE MODÈLE — vérifié en production, « c'est
 * quoi le seuil ? » répondait en 3,5 s — et rien ne bornait le nombre d'appels. C'était
 * la seule porte de l'application par laquelle un compte gratuit pouvait consommer sans
 * limite, alors que `aiQuota` existe précisément pour empêcher la boucle et le script.
 *
 * ⚠️ TROIS DÉCISIONS QUE CES TESTS VERROUILLENT :
 * 1. Le gratuit garde des questions (5/jour) : l'assistant explique le produit à
 *    quelqu'un qui hésite à le payer, le fermer serait s'amputer d'une conversion.
 * 2. Le compteur est SÉPARÉ de celui du coach : un client à 9,99 € qui demande où
 *    changer sa langue ne doit pas y perdre un appel au coach.
 * 3. Une réponse tirée de la base de connaissances ne consomme RIEN : elle ne passe par
 *    aucun modèle (32 % des questions).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLAFOND_JOUR, PLAFOND_SUPPORT_JOUR } from "../src/lib/billing/aiQuota";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}

console.log("\nLES PLAFONDS");

test("le gratuit garde des questions, mais un nombre fini", () => {
  // Nombres écrits en dur : les déduire de la constante rendrait le test aveugle.
  assert.equal(PLAFOND_SUPPORT_JOUR.gratuit, 5, "plafond du gratuit : décision commerciale, à changer sciemment");
  assert.ok(PLAFOND_SUPPORT_JOUR.gratuit > 0,
    "la bulle d'aide fermée au gratuit : c'est elle qui explique le produit à qui hésite à le payer");
  assert.ok(PLAFOND_SUPPORT_JOUR.gratuit < 10, "un plafond trop haut ne borne plus la boucle");
});

test("un compte qui paie n'est jamais bloqué sur une question d'interface", () => {
  assert.equal(PLAFOND_SUPPORT_JOUR.starter, 20);
  assert.equal(PLAFOND_SUPPORT_JOUR.premium, 30);
  for (const f of ["starter", "premium", "essai"] as const) {
    assert.ok(PLAFOND_SUPPORT_JOUR[f] > PLAFOND_SUPPORT_JOUR.gratuit,
      `${f} n'a pas plus de questions que le gratuit : la formule n'apporte rien ici`);
  }
  // Starter a 10 appels coach et 20 questions d'aide : bloquer le support d'un client
  // qui paie est le pire endroit où économiser.
  assert.ok(PLAFOND_SUPPORT_JOUR.starter > PLAFOND_JOUR.starter);
});

test("la hiérarchie des formules tient aussi sur l'aide", () => {
  assert.ok(PLAFOND_SUPPORT_JOUR.premium > PLAFOND_SUPPORT_JOUR.starter,
    "le plus cher n'est plus le plus servi");
  assert.ok(PLAFOND_JOUR.gratuit === 0, "le gratuit ne doit toujours consommer AUCUN appel coach");
});

console.log("\nLES DEUX COMPTEURS NE SE MARCHENT PAS DESSUS");

test("chaque compteur a son champ, et l'autre est préservé", () => {
  // ⚠️ LE PIÈGE DE CE MONTAGE. Les deux compteurs vivent dans la MÊME ligne. Écrire
  // `{ jour, n }` en dur effacerait `nSupport` à chaque appel au coach — et
  // réciproquement, la bulle d'aide remettrait le compteur du coach à zéro, ce qui
  // ouvrirait le plafond en grand à chaque question posée.
  const src = codeOf("src/lib/billing/aiQuota.ts");
  assert.match(src, /const CHAMP: Record<Compteur, "n" \| "nSupport"> = \{ ia: "n", support: "nSupport" \}/,
    "les deux compteurs ne sont plus distingués");
  assert.match(src, /\[CHAMP\[autre\]\]: memeJour \? Number\(precedent\?\.\[CHAMP\[autre\]\] \?\? 0\) : 0/,
    "l'autre compteur n'est plus préservé à l'écriture : un appel en remettrait un autre à zéro");
  assert.match(src, /\.select\("id,data"\)/, "la ligne existante est relue sans ses données : l'autre compteur sera perdu");
});

test("un compteur d'hier ne compte pas, pour les deux", () => {
  const src = codeOf("src/lib/billing/aiQuota.ts");
  assert.match(src, /d\?\.jour === aujourdhui \? Number\(d\?\.\[CHAMP\[compteur\]\] \?\? 0\) : 0/,
    "la remise à zéro quotidienne ne suit plus le compteur demandé");
});

console.log("\nLA ROUTE");

test("le plafond est consommé, et au bon endroit", () => {
  const src = codeOf("src/app/api/ai/support/route.ts");
  assert.match(src, /consommerAppelIA\(sb, user\.id, etatAcces\.etat, undefined, "support"\)/,
    "la bulle d'aide ne consomme plus de plafond : elle redevient sans limite");
  // ⚠️ L'ORDRE EST LA MOITIÉ DU CORRECTIF. Avant `reponseImmediate`, on ferait payer un
  // crédit pour une réponse qui ne coûte pas un jeton ; après `generateContent`, on ne
  // bornerait rien du tout, puisque c'est l'appel qui coûte.
  const iImmediate = src.indexOf("reponseImmediate(message, lang)");
  const iQuota = src.indexOf('consommerAppelIA(sb, user.id, etatAcces.etat, undefined, "support")');
  const iModele = src.indexOf("await generateContent(contents");
  assert.ok(iImmediate >= 0 && iQuota >= 0 && iModele >= 0, "un des trois jalons a disparu");
  assert.ok(iImmediate < iQuota,
    "le plafond est consommé AVANT la base de connaissances : une réponse gratuite coûterait un crédit");
  assert.ok(iQuota < iModele,
    "le plafond est consommé APRÈS l'appel au modèle : il ne borne plus rien");
});

test("plafond atteint : on répond quand même, et on dit pourquoi", () => {
  const src = codeOf("src/app/api/ai/support/route.ts");
  assert.match(src, /const secours = fallbackAnswer\(message, lang\)/,
    "l'athlète est laissé sans rien alors que la base de connaissances répond gratuitement");
  // « plafond atteint » et « service en panne » ne se résolvent pas du même geste :
  // attendre demain, ou réessayer dans un instant.
  assert.match(src, /quota\.indisponible\s*\n?\s*\?/,
    "les deux situations sont confondues : l'athlète ne sait plus quoi faire");
  for (const lg of ["fr", "en", "de", "es", "pt"]) {
    assert.ok(new RegExp(`\\n  ${lg}: "`).test(readFileSync("src/app/api/ai/support/route.ts", "utf8")),
      `le message de plafond manque en « ${lg} »`);
  }
});

console.log(`\n${passed} test(s) de plafond passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
