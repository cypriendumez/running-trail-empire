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
import { quotaDuJour, consommerAppelIA } from "../src/lib/billing/aiQuota";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/**
 * ⚠️ UN TEST ASYNCHRONE A BESOIN D'UN HARNAIS ASYNCHRONE.
 *
 * Rendre une promesse à `test()` ci-dessus ne prouve RIEN : le harnais ne l'attend pas,
 * une assertion qui échoue part en rejet non traité, et le test est compté RÉUSSI. Les
 * deux tests de quota ci-dessous ont d'abord été écrits ainsi — ils sont restés VERTS
 * face au code fautif remis en place. Seules les mutations l'ont montré.
 */
const enAttente: Promise<void>[] = [];
function testAsync(nom: string, fn: () => Promise<void>) {
  enAttente.push(fn().then(
    () => { passed++; console.log(`  OK ${nom}`); },
    (e: Error) => { fails.push(`${nom} — ${e.message}`); console.log(`  ✗ ${nom}`); },
  ));
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

test("une pesée enregistrée ne laisse pas le profil sur l'ancien poids", () => {
  // Le commentaire du code dit lui-même ce que coûte ce poids : il alimente le calcul
  // de charge, les zones et la dépense des séances. Son échec était pourtant muet.
  const src = codeNu("src/app/api/weight/route.ts");
  assert.ok(/const\s*\{\s*error:\s*eProfil\s*\}\s*=\s*await\s+sb\.from\("profiles"\)\.update\(\{\s*weight_kg/.test(src),
    "la mise à jour du poids du profil ne lit plus son erreur");
  assert.ok(/profilAJour/.test(src),
    "la réponse ne distingue plus « pesée enregistrée » de « profil à jour »");
});

test("les réglages ne s'écrasent pas eux-mêmes quand la lecture échoue", () => {
  // ⚠️ LE PIÈGE N'EST PAS L'ÉCRITURE, C'EST LA LECTURE. Son échec rendait `existing`
  // indéfini, ce que la suite lisait comme « aucun réglage existant » : on repartait
  // d'un objet vide et on insérait. Une coupure d'une seconde effaçait tout le reste,
  // en répondant `ok: true`.
  const src = codeNu("src/app/api/settings/route.ts");
  assert.ok(/const\s*\{\s*data:\s*existing,\s*error:\s*eLecture\s*\}/.test(src),
    "la lecture des réglages ne rend plus son erreur");
  const iLecture = src.search(/if\s*\(\s*eLecture\s*\)/);
  const iMerge = src.indexOf("const merged");
  assert.ok(iLecture > 0 && iMerge > iLecture,
    "la fusion se fait AVANT le contrôle de lecture : les réglages existants seraient écrasés");
  assert.ok(/if\s*\(\s*eEcriture\s*\)[\s\S]{0,240}status:\s*500/.test(src),
    "un échec d'écriture des réglages répond encore ok: true");
});

test("l'inscription ne génère pas un plan sur des données qu'elle n'a pas pu écrire", () => {
  // Le plan est bâti JUSTE APRÈS, à partir des disponibilités déclarées. Les écrire en
  // silence, c'est calibrer la première semaine d'un athlète sur autre chose que ce
  // qu'il vient de dire.
  const src = codeNu("src/app/onboarding/page.tsx");
  const i = src.indexOf("const echecs");
  assert.ok(i > 0, "l'inscription ne collecte plus les échecs d'écriture");
  const bloc = src.slice(i, i + 2600);
  assert.equal([...bloc.matchAll(/noter\(/g)].length, 4,
    "les quatre écritures isolées de l'inscription ne sont plus toutes contrôlées");
  assert.ok(/if\s*\(\s*profileError\s*\|\|\s*echecs\.length\s*\)/.test(src),
    "un échec partiel laisse l'inscription se poursuivre comme si tout allait bien");
});

/**
 * Une base d'essai réduite au nécessaire : elle sait refuser une LECTURE ou une
 * ÉCRITURE, séparément. La distinction n'est pas cosmétique — une première version
 * refusait « à partir du deuxième appel », ce qui faisait échouer la relecture avant
 * d'atteindre l'écriture : le test passait par un autre chemin et restait vert quand on
 * retirait le contrôle qu'il prétendait garder.
 */
function baseFactice(opts: { erreurLecture?: boolean; erreurEcriture?: boolean; n?: number; jour?: string }) {
  const err = (m: string) => ({ message: m, code: "XX000" });
  const ok = () => ({ data: { data: { jour: opts.jour, n: opts.n ?? 0 }, id: "x" }, error: null });
  const chaine = (ecrit: boolean): Record<string, unknown> => {
    const o: Record<string, unknown> = {};
    o.select = () => chaine(ecrit);
    o.eq = () => chaine(ecrit);
    for (const m of ["update", "insert", "upsert"]) o[m] = () => chaine(true);
    const resoudre = () => {
      if (ecrit) return opts.erreurEcriture ? { data: null, error: err("écriture refusée") } : ok();
      return opts.erreurLecture ? { data: null, error: err("lecture refusée") } : ok();
    };
    o.maybeSingle = resoudre;
    // Une écriture s'attend directement, sans `maybeSingle` : le maillon doit donc
    // être « thenable » lui-même.
    o.then = (r: (v: unknown) => unknown) => Promise.resolve(resoudre()).then(r);
    return o;
  };
  return { from: () => chaine(false) } as never;
}

testAsync("le plafond de dépense IA se FERME quand il ne sait pas", async () => {
  // ⚠️ IL CÉDAIT DANS LE MAUVAIS SENS. L'erreur de lecture n'étant pas lue, `utilises`
  // retombait à 0 et l'appel était accordé : une base illisible OUVRAIT le plafond.
  // Sur une clé Gemini payante, Google ne borne rien — c'est la facture qui monte.
  const r = await quotaDuJour(baseFactice({ erreurLecture: true }), "u1", "premium", "2026-09-04");
  assert.equal(r.accorde, false, "une base illisible accorde encore l'appel : le plafond est ouvert");
  assert.equal(r.indisponible, true, "le refus ne se distingue plus d'un plafond réellement atteint");
});

testAsync("un appel qui n'a pas pu être COMPTÉ n'est pas accordé", async () => {
  // Sinon le compteur n'avance jamais : l'appel suivant relit l'ancienne valeur, et le
  // seul verrou qui borne la facture devient décoratif. Ici les LECTURES réussissent —
  // c'est bien l'écriture, et elle seule, qui échoue.
  const r = await consommerAppelIA(baseFactice({ erreurEcriture: true, jour: "2026-09-04", n: 1 }), "u1", "premium", "2026-09-04");
  assert.equal(r.accorde, false, "un appel non compté est accordé : le plafond ne montera jamais");
  assert.equal(r.indisponible, true, "l'échec d'écriture se fait passer pour un plafond atteint");
});

testAsync("un compteur lisible et inscriptible accorde bien l'appel", async () => {
  // ⚠️ LE CONTRE-EXEMPLE, sans quoi les deux tests ci-dessus seraient satisfaits par un
  // quota qui refuse TOUT. Ils vérifieraient alors une panne, pas un garde-fou.
  const r = await consommerAppelIA(baseFactice({ jour: "2026-09-04", n: 1 }), "u1", "premium", "2026-09-04");
  assert.equal(r.accorde, true, "un quota sain refuse l'appel : le module est cassé, pas prudent");
  assert.equal(r.utilises, 2, "le compteur n'a pas avancé");
  assert.equal(r.indisponible, undefined, "un quota sain se déclare indisponible");
});

test("« compteur illisible » et « plafond atteint » ne se disent pas pareil", () => {
  // Le premier se résout dans une minute, le second demain : les confondre envoie
  // l'athlète attendre vingt-quatre heures pour une panne de quelques secondes.
  const src = codeNu("src/lib/billing/guard.ts");
  assert.ok(/q\.indisponible/.test(src), "le garde ne distingue plus les deux refus");
  assert.ok(/quota_indisponible[\s\S]{0,160}status:\s*503/.test(src),
    "le refus pour cause d'indisponibilité ne répond pas 503");
  assert.ok(/quota_ia_atteint[\s\S]{0,160}status:\s*429/.test(src),
    "le vrai plafond ne répond plus 429");
});

test("la synchronisation signale une VFC ou un sommeil non enregistrés", () => {
  // Le fichier portait déjà la règle « ne JAMAIS avaler une erreur d'écriture » — mais
  // elle ne s'appliquait qu'aux séances. Un refus sur le bien-être laissait le coach
  // raisonner sur une fenêtre vide, et « pas de VFC » se lit comme « aucune mesure ».
  const src = codeNu("src/lib/intervals/syncUser.ts");
  assert.ok(/const\s*\{\s*error:\s*eHrv\s*\}/.test(src) && /failures\.push\(`VFC/.test(src),
    "l'écriture de la VFC ne signale plus son échec");
  assert.ok(/const\s*\{\s*error:\s*eSommeil\s*\}/.test(src) && /failures\.push\(`sommeil/.test(src),
    "l'écriture du sommeil ne signale plus son échec");
});

test("un objectif de course non écrit ne se déclare pas enregistré", () => {
  // ⚠️ LE PIRE N'EST PAS LA PERTE, C'EST LE DOUBLON. L'erreur de lecture n'étant pas
  // lue, `existing` restait indéfini — lu comme « pas encore d'objectif » — et on
  // insérait une SECONDE ligne `race_objective`. Tout le reste de l'application lit cet
  // objectif par `maybeSingle()`, qui échoue dès qu'il y a deux lignes : l'objectif
  // devenait définitivement illisible, sans autre issue qu'une intervention en base.
  const src = codeNu("src/lib/coach/objective.ts");
  assert.ok(/const\s*\{\s*data:\s*existing,\s*error:\s*eLecture\s*\}/.test(src),
    "la lecture de l'objectif ne rend plus son erreur");
  const iLecture = src.search(/if\s*\(\s*eLecture\s*\)\s*throw/);
  const iInsert = src.indexOf('type: "race_objective"');
  assert.ok(iLecture > 0 && iInsert > iLecture,
    "l'insertion peut encore se produire sans que la lecture ait été validée : doublon garanti");
  assert.ok(/if\s*\(\s*eEcriture\s*\)\s*throw/.test(src),
    "l'écriture de l'objectif ne signale plus son échec");

  // Et la route doit TRADUIRE cette levée, pas la laisser filer en 500 opaque.
  const route = codeNu("src/app/api/objective/route.ts");
  assert.ok(/catch[\s\S]{0,200}status:\s*500/.test(route),
    "la route ne rattrape plus l'échec d'enregistrement de l'objectif");
});

Promise.all(enAttente).then(() => {
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
});
