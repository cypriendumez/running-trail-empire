/**
 * LES ÉCRITURES QUI SE DÉCLARENT RÉUSSIES — quatre défauts d'une même famille.
 *
 * Une écriture Supabase dont on ne lit pas l'`error` ne fait pas de bruit : le code
 * continue, l'écran affiche une confirmation, et la donnée n'existe pas. C'est le motif
 * le plus coûteux du projet parce qu'il est INVISIBLE des deux côtés — l'athlète croit
 * avoir enregistré, l'éditeur ne voit aucune erreur.
 *
 * Constatés le 04/09/2026 en confrontant 72 routes d'écriture à leur code :
 *  · le webhook Stripe répondait 200 même quand l'octroi d'accès échouait — Stripe
 *    marquait l'événement livré et ne le réémettait JAMAIS : client débité, resté en
 *    « free », définitivement ;
 *  · la route de paiement n'enregistrait pas toujours le lien client Stripe, ce dont
 *    dépend tout changement de formule ultérieur ;
 *  · le journal affichait « Sauvegardé ✓ » et EFFAÇAIT le texte de l'athlète ;
 *  · les réglages perdaient bio, déclarations de santé et préférences de notification
 *    sous un « best-effort » dont la raison (colonnes absentes) n'existait plus : les
 *    dix-neuf colonnes ont été vérifiées présentes en base.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/** Sans commentaires : une explication qui décrit le défaut n'est pas le correctif. */
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

test("un échec d'octroi d'accès fait RÉÉMETTRE l'événement Stripe", () => {
  // ⚠️ RÉPONDRE 200 CLÔT L'ÉVÉNEMENT POUR TOUJOURS. C'est la seule chance qu'a un
  // paiement de se traduire en accès : sans 5xx, il n'y a pas de seconde tentative.
  const src = codeNu("src/app/api/stripe/webhook/route.ts");
  assert.ok(/const\s+echecs\s*:\s*string\[\]/.test(src), "le webhook ne collecte plus les échecs d'écriture");
  assert.ok(/if\s*\(\s*echecs\.length\s*\)[\s\S]{0,320}status:\s*500/.test(src),
    "un échec d'écriture ne renvoie plus 500 : Stripe ne réessaiera pas");
  // Les deux écritures qui donnent et retirent l'accès payé.
  assert.ok(/const\s*\{\s*error:\s*eAcces\s*\}\s*=\s*await\s+admin\s*\.from\("profiles"\)\.update/.test(src),
    "l'octroi d'accès ne lit plus son erreur");
  assert.ok(/const\s*\{\s*error:\s*eFin\s*\}\s*=\s*await\s+admin\.from\("profiles"\)\.update/.test(src),
    "la fin d'accès ne lit plus son erreur");
});

test("le paiement est refusé si le lien client Stripe ne peut pas être enregistré", () => {
  // Sans ce lien, un changement de formule depuis le portail n'emporte aucune
  // métadonnée : le webhook ne retrouve plus l'athlète et l'abonnement ne s'applique pas.
  const src = codeNu("src/app/api/stripe/checkout/route.ts");
  assert.ok(/update\(\{\s*stripe_customer_id[\s\S]{0,120}?\n\s*if\s*\(error\)\s*\{/.test(src),
    "l'enregistrement du client Stripe ne lit plus son erreur");
  assert.ok(/if\s*\(error\)\s*\{[\s\S]{0,600}?status:\s*500/.test(src),
    "l'échec n'interrompt plus le parcours : l'athlète serait envoyé payer avec un lien absent");
});

test("le journal n'efface le texte QUE si l'écriture a réussi", () => {
  // ⚠️ L'ORDRE EST TOUT. `setText("")` avant le contrôle d'erreur détruit ce que
  // l'athlète vient d'écrire, sous une confirmation. C'est ce que faisait le code.
  const src = codeNu("src/components/journal/SmartJournal.tsx");
  const i = src.indexOf('from("journal_entries").insert');
  assert.ok(i > 0, "l'insertion du journal a disparu");
  const apres = src.slice(i, i + 900);
  const posErreur = apres.search(/if\s*\(\s*error\s*\)/);
  const posEfface = apres.indexOf('setText("")');
  assert.ok(posErreur > 0, "l'insertion du journal ne lit pas son erreur");
  assert.ok(posEfface > 0, "le champ n'est plus vidé après un enregistrement réussi");
  assert.ok(posErreur < posEfface,
    "le champ est vidé AVANT le contrôle d'erreur : l'entrée de l'athlète serait perdue");
  assert.ok(/return;/.test(apres.slice(posErreur, posEfface)),
    "l'échec ne coupe pas la suite : « Sauvegardé ✓ » s'afficherait quand même");
});

test("aucune écriture du profil n'échoue en silence", () => {
  // Les cinq écritures sont volontairement SÉPARÉES (une colonne fautive n'emporte pas
  // le profil entier) — mais séparées ne veut pas dire muettes.
  const src = codeNu("src/components/profile/ProfileSettings.tsx");
  const i = src.indexOf("async function save()");
  const fin = src.indexOf("async function uploadAvatar");
  assert.ok(i > 0 && fin > i, "la fonction de sauvegarde du profil est introuvable");
  const bloc = src.slice(i, fin);
  const ecritures = [...bloc.matchAll(/from\("profiles"\)\s*\n?\s*\.update\(/g)].length;
  const lues = [...bloc.matchAll(/const\s*\{\s*error(:\s*\w+)?\s*\}\s*=\s*await\s+supabase/g)].length;
  assert.equal(lues, ecritures,
    `${ecritures} écritures du profil, seulement ${lues} dont l'erreur est lue`);
  assert.ok(/echecs\.length/.test(bloc),
    "les échecs collectés ne sont plus regardés au moment d'afficher le résultat");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
