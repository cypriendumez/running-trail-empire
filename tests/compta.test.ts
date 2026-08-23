/**
 * COMPTABILITÉ — les règles qui doivent tenir.
 *
 * Un outil de comptabilité a une exigence que les autres écrans n'ont pas : un chiffre
 * faux y est INDISCERNABLE d'un chiffre juste. Personne ne « voit » que le résultat est
 * décalé de trois centimes, ni qu'un taux de cotisations a été deviné. Ces tests visent
 * donc les endroits où un chiffre peut devenir faux sans que rien ne se casse.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enCentimes, euros, valider, totaux, tvaDe, cotisationsEstimees, soldeCumule, versCSV,
  CATEGORIES, categorieDe, type Ecriture,
} from "../src/lib/compta/model";
import { ecrituresDeLEvenement, dateParis, type EvenementStripe } from "../src/lib/compta/stripe";

const ROOT = join(__dirname, "..");
let passed = 0;
const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/**
 * Le code SANS ses commentaires ni ses imports.
 *
 * ⚠️ DEUX TESTS DE CE FICHIER ONT VALIDÉ MA PROPRE DOCUMENTATION. Commenter l'appel
 * `await comptabiliser(event, req)` laissait le motif intact dans la ligne commentée ;
 * remplacer `idEditeur()` par le compte connecté laissait le nom dans le commentaire
 * qui l'explique. Les deux mutations sont restées VERTES sur du code cassé. On vise le
 * site qui produit l'effet — jamais une déclaration, jamais une phrase.
 */
const codeSeul = (chemin: string): string =>
  readFileSync(join(ROOT, chemin), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")          // blocs /* … */
    .split("\n")
    .filter((l) => !/^\s*(import\b|\/\/)/.test(l))
    .map((l) => l.replace(/\s\/\/.*$/, ""))       // commentaire en fin de ligne
    .join("\n");

const ecr = (p: Partial<Ecriture>): Ecriture => ({
  id: Math.random().toString(36).slice(2), date: "2026-01-15", libelle: "x", sens: "sortie",
  categorie: "hebergement", montantCents: 1000, moyen: "Carte", ...p,
});

console.log("\n💶 Comptabilité\n");

test("un montant saisi devient des centimes entiers, ou rien du tout", () => {
  assert.equal(enCentimes("12,50"), 1250);
  assert.equal(enCentimes("12.50"), 1250);
  assert.equal(enCentimes("1 234,5"), 123450);
  assert.equal(enCentimes("12"), 1200);
  assert.equal(enCentimes("19,99 €"), 1999);
  assert.equal(enCentimes(19.99), 1999);
  // ⚠️ ET SURTOUT : une saisie illisible vaut `null`, JAMAIS zéro. Transformer une faute
  // de frappe en 0 € fait entrer une ligne muette dans le journal ; l'erreur doit se voir
  // à la saisie, pas se découvrir au bilan.
  assert.equal(enCentimes("douze euros"), null);
  assert.equal(enCentimes(""), null);
  assert.equal(enCentimes("12,505"), null, "trois décimales ne sont pas un montant en euros");
  assert.equal(enCentimes("1,2,3"), null);
});

test("l'affichage des montants ne perd pas de centimes", () => {
  // ⚠️ Le séparateur de milliers est une ESPACE FINE INSÉCABLE (U+202F), la typographie
  // française. Une espace ordinaire autoriserait une coupure de ligne au milieu d'un
  // nombre : « 1 » en fin de ligne et « 234,50 € » au début de la suivante. Le test
  // l'écrit en clair pour que personne ne la « corrige » en espace normale.
  assert.equal(euros(123450), "1\u202f234,50\u00a0€");
  assert.equal(euros(0), "0,00\u00a0€");
  assert.equal(euros(5), "0,05\u00a0€");
  assert.equal(euros(-1250), "−12,50\u00a0€");
  assert.equal(euros(1250, true), "+12,50\u00a0€");
  // ⚠️ Le piège classique des centimes : 0,1 + 0,2 en nombre à virgule ne vaut pas 0,3.
  // En centimes entiers, la somme retombe juste — c'est toute la raison du choix.
  assert.equal(euros(10 + 20), "0,30\u00a0€");
});

test("une écriture invalide est refusée, avec le motif", () => {
  assert.deepEqual(valider(ecr({})), []);
  assert.ok(valider(ecr({ libelle: "  " })).some((e) => /libellé/i.test(e)));
  assert.ok(valider(ecr({ date: "15/01/2026" })).some((e) => /date/i.test(e)));
  assert.ok(valider(ecr({ date: "2026-02-31" })).some((e) => /n'existe pas/i.test(e)));
  assert.ok(valider(ecr({ montantCents: 0 })).some((e) => /positif/i.test(e)));
  assert.ok(valider(ecr({ montantCents: -500 })).some((e) => /positif/i.test(e)),
    "un montant négatif doit être refusé : c'est le SENS qui porte le signe");
  assert.ok(valider(ecr({ montantCents: 12.5 })).some((e) => /entier/i.test(e)));
  // ⚠️ Une dépense classée dans un poste de recette gonfle le chiffre d'affaires.
  assert.ok(valider(ecr({ sens: "entree", categorie: "hebergement" })).some((e) => /n'est pas une catégorie/i.test(e)));
  assert.ok(valider(ecr({ categorie: "inexistante" })).some((e) => /inconnue/i.test(e)));
});

test("les totaux excluent les annulées, sans les faire disparaître", () => {
  const t = totaux([
    ecr({ sens: "entree", categorie: "abonnements", montantCents: 10000 }),
    ecr({ sens: "sortie", categorie: "hebergement", montantCents: 2000 }),
    // ⚠️ Celle-ci est annulée : la compter fausserait le résultat, la masquer ferait
    // perdre la trace. Elle sort des totaux et reste comptée à part.
    ecr({ sens: "entree", categorie: "abonnements", montantCents: 50000, annulee: true }),
  ]);
  assert.equal(t.entreesCents, 10000);
  assert.equal(t.sortiesCents, 2000);
  assert.equal(t.resultatCents, 8000);
  assert.equal(t.nbEcritures, 2);
  assert.equal(t.nbAnnulees, 1);
});

test("une charge mensuelle saisie douze fois ne vaut pas douze loyers", () => {
  // ⚠️ LE PIÈGE. Douze lignes « Vercel — 20 € » cochées « mensuelle » représentent UNE
  // charge de 20 €/mois, pas 240 €/mois. En sommant, la projection annuelle serait
  // multipliée par douze — et le montant resterait plausible, donc invisible.
  const douze = Array.from({ length: 12 }, (_, i) =>
    ecr({ date: `2026-${String(i + 1).padStart(2, "0")}-05`, libelle: "Vercel", categorie: "hebergement", montantCents: 2000, recurrente: true }));
  const t = totaux([...douze, ecr({ libelle: "Supabase", categorie: "services", montantCents: 2500, recurrente: true })]);
  assert.equal(t.chargesFixesMensuellesCents, 4500, "les occurrences d'une même charge ont été additionnées");
  assert.equal(t.sortiesCents, 12 * 2000 + 2500, "les dépenses réelles, elles, s'additionnent bien");
});

test("la répartition par mois et par poste suit la date de l'opération", () => {
  const t = totaux([
    ecr({ date: "2026-01-10", sens: "entree", categorie: "abonnements", montantCents: 3000 }),
    ecr({ date: "2026-02-10", sens: "entree", categorie: "abonnements", montantCents: 5000 }),
    ecr({ date: "2026-02-20", sens: "sortie", categorie: "ia", montantCents: 1000 }),
  ]);
  assert.deepEqual(t.parMois.map((m) => m.mois), ["2026-01", "2026-02"]);
  assert.equal(t.parMois[1].entreesCents, 5000);
  assert.equal(t.parMois[1].resultatCents, 4000);
  assert.equal(t.parCategorie.find((c) => c.id === "abonnements")?.cents, 8000);
});

test("la TVA se déduit d'un montant TTC, pas de l'inverse", () => {
  assert.equal(tvaDe(12000, 20), 2000, "20 % de TVA dans 120 € TTC, c'est 20 €");
  assert.equal(tvaDe(12000, 0), 0);
  assert.equal(tvaDe(12000, undefined), 0);
  const t = totaux([
    ecr({ sens: "entree", categorie: "abonnements", montantCents: 12000, tvaTaux: 20 }),
    ecr({ sens: "sortie", categorie: "ia", montantCents: 6000, tvaTaux: 20 }),
  ]);
  assert.equal(t.tvaCollecteeCents, 2000);
  assert.equal(t.tvaDeductibleCents, 1000);
});

test("sans taux renseigné, aucune cotisation n'est estimée", () => {
  // ⚠️ LA PROMESSE CENTRALE DE CET ÉCRAN. Une estimation calculée sur un taux inventé est
  // impossible à distinguer d'une estimation juste — c'est le pire résultat possible pour
  // un outil de comptabilité. Quand le taux manque, on le DIT.
  assert.equal(cotisationsEstimees(100000, undefined), null);
  assert.equal(cotisationsEstimees(100000, 0), null);
  assert.equal(cotisationsEstimees(100000, 23.1), 23100);
});

test("aucun taux ni seuil légal n'est écrit en dur dans le code", () => {
  // ⚠️ Les taux de cotisations et les plafonds de la micro-entreprise CHANGENT CHAQUE
  // ANNÉE. En figer un dans le code produirait, l'année suivante, un chiffre faux que
  // personne ne remettrait en cause — puisqu'il vient de l'application.
  const suspects = [/\b12[.,]3\b/, /\b21[.,][12]\b/, /\b22[.,]2\b/, /\b23[.,]1\b/, /\b77\s?700\b/, /\b188\s?700\b/, /\b36\s?800\b/, /\b91\s?900\b/];
  for (const f of ["src/lib/compta/model.ts", "src/app/api/admin/compta/route.ts"]) {
    const src = readFileSync(join(ROOT, f), "utf8")
      .split("\n").filter((l) => !/^\s*(\*|\/\/)/.test(l)).join("\n");
    for (const re of suspects) {
      assert.ok(!re.test(src), `${f} contient un taux ou un seuil légal en dur : ${re}`);
    }
  }
});

test("le solde de trésorerie se cumule dans l'ordre des opérations", () => {
  const s = soldeCumule([
    ecr({ id: "b", date: "2026-02-01", sens: "sortie", montantCents: 3000 }),
    ecr({ id: "a", date: "2026-01-01", sens: "entree", categorie: "abonnements", montantCents: 10000 }),
    ecr({ id: "z", date: "2026-03-01", sens: "entree", categorie: "abonnements", montantCents: 500, annulee: true }),
  ], 2500);
  assert.deepEqual(s.map((x) => [x.id, x.soldeCents]), [["a", 12500], ["b", 9500]]);
});

test("l'export CSV s'ouvre dans un tableur français et n'efface rien", () => {
  const csv = versCSV([
    ecr({ date: "2026-01-05", libelle: 'Abonnement "Premium"; août', sens: "entree", categorie: "abonnements", montantCents: 1499 }),
    ecr({ date: "2026-01-06", libelle: "Erreur", montantCents: 100, annulee: true, motifAnnulation: "doublon" }),
  ]);
  const lignes = csv.split("\r\n");
  // ⚠️ Point-virgule ET virgule décimale : un CSV à virgules s'ouvre dans une seule
  // colonne chez un utilisateur français, et l'export a l'air cassé alors qu'il est bon.
  assert.ok(lignes[0].startsWith("﻿Date;Libellé;Sens"), "en-tête ou séparateur inattendu");
  assert.ok(lignes[1].includes(";14,99;"), "montant non exporté en virgule décimale");
  assert.ok(lignes[1].includes('"Abonnement ""Premium""; août"'), "guillemets et point-virgule mal échappés");
  // ⚠️ Les annulées SONT exportées, marquées : un export qui les masque ne justifie rien.
  assert.ok(lignes[2].includes(";oui;doublon"), "l'écriture annulée n'apparaît pas dans l'export");
});

test("chaque catégorie a un sens, et aucun identifiant n'est en double", () => {
  const ids = CATEGORIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "deux catégories partagent le même identifiant");
  for (const c of CATEGORIES) {
    assert.ok(c.sens === "entree" || c.sens === "sortie", `${c.id} n'a pas de sens`);
    assert.equal(categorieDe(c.id)?.label, c.label);
  }
  assert.ok(CATEGORIES.some((c) => c.sens === "entree") && CATEGORIES.some((c) => c.sens === "sortie"));
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stripe → journal comptable
//  Testé avec de VRAIS événements en fixture : ce code ne s'exécutera pour de bon qu'au
//  premier encaissement, c'est-à-dire le jour où une erreur coûte de l'argent.
// ─────────────────────────────────────────────────────────────────────────────

const facturePayee = (o: Record<string, unknown> = {}): EvenementStripe => ({
  id: "evt_1", type: "invoice.paid",
  data: { object: {
    id: "in_123", number: "PACEVO-0001", amount_paid: 1499, currency: "eur",
    status_transitions: { paid_at: Math.floor(Date.UTC(2026, 7, 20, 9, 0) / 1000) },
    created: Math.floor(Date.UTC(2026, 7, 20, 9, 0) / 1000),
    customer_email: "coureur@exemple.fr", charge: "ch_1", ...o } },
});

test("un abonnement encaissé produit la recette ET la commission, séparées", () => {
  // ⚠️ LE MONTANT BRUT EST LA RECETTE, la commission est une CHARGE. N'enregistrer que ce
  // qui arrive en banque sous-estimerait le chiffre d'affaires — et c'est le CA qu'on
  // déclare, pas le solde du compte.
  const { ecritures, alerte, ignore } = ecrituresDeLEvenement(facturePayee(), 67);
  assert.equal(alerte, undefined); assert.equal(ignore, undefined);
  assert.equal(ecritures.length, 2);
  const recette = ecritures[0], frais = ecritures[1];
  assert.equal(recette.sens, "entree");
  assert.equal(recette.categorie, "abonnements");
  assert.equal(recette.montantCents, 1499);
  assert.equal(recette.piece, "PACEVO-0001");
  assert.equal(recette.origine, "stripe");
  assert.equal(frais.sens, "sortie");
  assert.equal(frais.categorie, "frais_bancaires");
  assert.equal(frais.montantCents, 67);
  // Chaque écriture doit passer la MÊME validation qu'une saisie manuelle.
  for (const e of ecritures) assert.deepEqual(valider(e), [], `écriture Stripe invalide : ${JSON.stringify(e)}`);
});

test("une commission introuvable est DITE, pas passée sous silence", () => {
  // Laisser l'écriture muette ferait croire que l'encaissement n'a rien coûté.
  const { ecritures } = ecrituresDeLEvenement(facturePayee(), null);
  assert.equal(ecritures.length, 1);
  assert.match(String(ecritures[0].note), /à saisir à la main/i);
});

test("Stripe réémet ses notifications : la clé d'unicité doit être stable", () => {
  // ⚠️ Sans elle, un abonnement de 14,99 € serait compté deux ou trois fois — et trois
  // lignes identiques ressemblent à trois vrais paiements.
  const a = ecrituresDeLEvenement(facturePayee(), 67).ecritures;
  const b = ecrituresDeLEvenement({ ...facturePayee(), id: "evt_2" }, 67).ecritures;
  assert.equal(a[0].stripeId, b[0].stripeId, "la clé change d'un renvoi à l'autre : le doublon passera");
  assert.notEqual(a[0].stripeId, a[1].stripeId, "recette et commission partagent la même clé : l'une écrasera l'autre");
});

test("le même paiement ne doit pas être compté deux fois par deux événements", () => {
  // ⚠️ Stripe émet `invoice.paid` ET `invoice.payment_succeeded` pour la MÊME facture.
  // Traiter les deux doublerait le chiffre d'affaires sans qu'aucune ligne n'ait l'air
  // anormale.
  const autre = ecrituresDeLEvenement({ ...facturePayee(), type: "invoice.payment_succeeded" }, 67);
  assert.equal(autre.ecritures.length, 0);
  assert.ok(autre.ignore, "un second événement pour la même facture a créé une écriture");
});

test("une facture à 0 € n'entre pas au journal", () => {
  const r = ecrituresDeLEvenement(facturePayee({ amount_paid: 0 }), null);
  assert.equal(r.ecritures.length, 0);
  assert.ok(r.ignore);
});

test("un paiement en devise étrangère est signalé, jamais converti en douce", () => {
  // ⚠️ Enregistrer 1499 « unités » de dollars comme 14,99 € fabriquerait une recette
  // fausse. Une ligne manquante se répare, une ligne fausse ne se voit pas.
  const r = ecrituresDeLEvenement(facturePayee({ currency: "usd" }), 67);
  assert.equal(r.ecritures.length, 0);
  assert.match(String(r.alerte), /devise|USD/i);
});

test("un remboursement est une sortie, il n'efface pas la recette d'origine", () => {
  const r = ecrituresDeLEvenement({
    id: "evt_r", type: "charge.refunded",
    data: { object: { id: "ch_1", amount_refunded: 1499, currency: "eur",
      created: Math.floor(Date.UTC(2026, 8, 1, 10, 0) / 1000),
      billing_details: { email: "coureur@exemple.fr" } } },
  });
  assert.equal(r.ecritures.length, 1);
  assert.equal(r.ecritures[0].sens, "sortie");
  assert.equal(r.ecritures[0].categorie, "remboursements_verses");
  assert.deepEqual(valider(r.ecritures[0]), []);
});

test("la date d'un encaissement est celle de Paris, pas celle d'UTC", () => {
  // ⚠️ LE CAS QUI COÛTE UN EXERCICE. Un paiement à 00 h 30 le 1ᵉʳ janvier heure de Paris
  // se produit le 31 décembre en UTC : compté en UTC, il tomberait sur l'ANNÉE
  // PRÉCÉDENTE — mauvais exercice, mauvaise déclaration.
  assert.equal(dateParis(Date.UTC(2026, 11, 31, 23, 30) / 1000), "2027-01-01");
  // Et l'heure d'été décale de deux heures, pas d'une.
  assert.equal(dateParis(Date.UTC(2026, 6, 1, 22, 30) / 1000), "2026-07-02");
  assert.equal(dateParis(Date.UTC(2026, 7, 20, 9, 0) / 1000), "2026-08-20");
});

test("le webhook Stripe branche vraiment la comptabilité", () => {
  // ⚠️ On vise l'APPEL, pas l'import : importer la conversion sans jamais l'appeler
  // laisserait le test vert alors qu'aucun encaissement n'atteindrait le journal.
  const src = codeSeul("src/app/api/stripe/webhook/route.ts");
  assert.match(src, /await comptabiliser\(/, "le webhook n'appelle pas le traitement comptable");
  assert.match(src, /ecrituresDeLEvenement\(/, "la conversion en écritures n'est pas appelée");
  assert.match(src, /enregistrerEcritures\(/, "les écritures ne sont jamais enregistrées");
  // La signature reste obligatoire : sans elle, n'importe qui pourrait écrire des
  // recettes imaginaires dans la comptabilité.
  assert.match(src, /constructEvent\(/, "la signature Stripe n'est plus vérifiée");
});

test("le journal appartient à l'entreprise, pas au compte connecté", () => {
  // ⚠️ Rattacher les écritures à la session affichait une comptabilité différente selon
  // l'adresse utilisée pour se connecter — deux journaux pour une seule entreprise.
  const src = codeSeul("src/app/api/admin/compta/route.ts");
  assert.match(src, /await idEditeur\(\)/, "le journal n'est plus rattaché à l'éditeur");
  // ⚠️ Et l'identifiant de la SESSION ne doit servir à rien d'autre qu'au contrôle
  // d'accès : `user.id` réapparaissant ailleurs, c'est le journal qui se rescinde.
  assert.ok(!/user\.id/.test(src), "une écriture est encore rattachée au compte connecté");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
