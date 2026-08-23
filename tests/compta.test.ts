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
  numeroter, doublonsProbables, parTrimestre, modelesRecurrents, evolution, versLivreRecettes, cotisations,
} from "../src/lib/compta/model";
import { ecrituresDeLEvenement, dateParis, type EvenementStripe } from "../src/lib/compta/stripe";
import { validerFichier, cheminDe, cheminAppartientA, BUCKET, TAILLE_MAX } from "../src/lib/compta/pieces";
import { interpreterLecture, jsonDeLaReponse, CONSIGNE_LECTURE } from "../src/lib/compta/lecture";

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

test("le taux réduit ACRE ne déborde pas sur la période suivante", () => {
  // ⚠️ L'ACRE dure une durée déterminée, puis le taux REMONTE. Appliquer le taux réduit
  // à toute l'année annoncerait des cotisations sous-évaluées pendant des mois — et
  // l'écart ne se découvre qu'à l'appel de cotisations, quand l'argent est dépensé.
  const liste = [
    ecr({ date: "2026-06-30", sens: "entree", categorie: "abonnements", montantCents: 100000 }),
    ecr({ date: "2026-07-01", sens: "entree", categorie: "abonnements", montantCents: 100000 }),
  ];
  const c = cotisations(liste, { tauxCotisations: 11, acreJusquau: "2026-06-30", tauxApresAcre: 22 });
  assert.equal(c.tranches[0].recettesCents, 100000);
  assert.equal(c.tranches[1].recettesCents, 100000, "une recette du 1er juillet est passée du mauvais côté");
  assert.equal(c.totalCents, 11000 + 22000);
  assert.deepEqual(c.manquant, []);
});

test("un taux manquant rend le total impossible, pas approximatif", () => {
  // ⚠️ Additionner ce qu'on sait calculer et taire le reste donnerait un montant plus
  // petit que la réalité — avec l'apparence d'un vrai total.
  const liste = [
    ecr({ date: "2026-06-30", sens: "entree", categorie: "abonnements", montantCents: 100000 }),
    ecr({ date: "2026-07-01", sens: "entree", categorie: "abonnements", montantCents: 100000 }),
  ];
  const c = cotisations(liste, { tauxCotisations: 11, acreJusquau: "2026-06-30" });
  assert.equal(c.totalCents, null);
  assert.deepEqual(c.manquant, ["le taux après l'ACRE"]);

  // Mais tant qu'aucune recette n'a franchi la date, réclamer le taux suivant afficherait
  // un manque permanent et inutile.
  const avantSeulement = cotisations([liste[0]], { tauxCotisations: 11, acreJusquau: "2026-06-30" });
  assert.deepEqual(avantSeulement.manquant, []);
  assert.equal(avantSeulement.totalCents, 11000);
});

test("sans date d'ACRE, un seul taux et aucune invention", () => {
  const liste = [ecr({ date: "2026-06-30", sens: "entree", categorie: "abonnements", montantCents: 100000 })];
  assert.equal(cotisations(liste, { tauxCotisations: 22 }).totalCents, 22000);
  const sansTaux = cotisations(liste, {});
  assert.equal(sansTaux.totalCents, null);
  assert.deepEqual(sansTaux.manquant, ["le taux de cotisations"]);
  assert.equal(sansTaux.joursAvantFinAcre, null, "aucune date posée : aucun compte à rebours inventé");
});

test("le compte à rebours de l'ACRE compte de vrais jours", () => {
  const c = cotisations([], { acreJusquau: "2026-09-02" }, new Date("2026-08-23T12:00:00Z"));
  assert.equal(c.joursAvantFinAcre, 11);
  // Une échéance passée doit devenir négative, pas se figer à zéro : « 0 jour » se lit
  // comme « c'est aujourd'hui », alors que la bascule a déjà eu lieu.
  const passe = cotisations([], { acreJusquau: "2026-08-01" }, new Date("2026-08-23T12:00:00Z"));
  assert.ok(passe.joursAvantFinAcre !== null && passe.joursAvantFinAcre < 0);
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

test("les numéros d'ordre sont continus, stables, et survivent à une annulation", () => {
  // ⚠️ Un livre de recettes se tient par numéros CONTINUS : sans eux, rien ne montre
  // qu'il ne manque pas une ligne au milieu. Une écriture annulée GARDE son numéro —
  // un numéro qui disparaît est un trou, et un trou se justifie.
  const liste = [
    ecr({ id: "c", date: "2026-03-01" }),
    ecr({ id: "a", date: "2026-01-01" }),
    ecr({ id: "b", date: "2026-02-01", annulee: true, motifAnnulation: "doublon" }),
  ];
  const n = numeroter(liste);
  assert.deepEqual([n.get("a"), n.get("b"), n.get("c")], [1, 2, 3]);
  // Deux affichages successifs ne doivent pas renuméroter les mêmes lignes.
  assert.deepEqual([...numeroter(liste.slice().reverse()).entries()].sort(), [...n.entries()].sort());
  // Même date : l'ordre reste total, jamais laissé au hasard du tri.
  const memeJour = numeroter([
    ecr({ id: "z", date: "2026-01-01", saisieLe: "2026-01-01T10:00:00Z" }),
    ecr({ id: "y", date: "2026-01-01", saisieLe: "2026-01-01T09:00:00Z" }),
  ]);
  assert.deepEqual([memeJour.get("y"), memeJour.get("z")], [1, 2]);
});

test("une écriture saisie deux fois est signalée, jamais bloquée", () => {
  // ⚠️ Deux abonnements identiques le même jour arrivent VRAIMENT : refuser la seconde
  // forcerait à contourner l'outil. Mais saisir deux fois la même facture est l'erreur
  // la plus banale d'une compta manuelle, et elle est invisible une fois enregistrée.
  const deja = [ecr({ id: "1", date: "2026-01-05", libelle: "Vercel", montantCents: 2000 })];
  assert.equal(doublonsProbables({ date: "2026-01-05", libelle: "vercel ", montantCents: 2000, sens: "sortie" }, deja).length, 1);
  assert.equal(doublonsProbables({ date: "2026-01-06", libelle: "Vercel", montantCents: 2000, sens: "sortie" }, deja).length, 0);
  assert.equal(doublonsProbables({ date: "2026-01-05", libelle: "Vercel", montantCents: 2500, sens: "sortie" }, deja).length, 0);
  // Une écriture déjà annulée n'est pas un doublon : la ressaisir est justement la
  // façon normale de corriger une erreur.
  const annulee = [ecr({ id: "1", date: "2026-01-05", libelle: "Vercel", montantCents: 2000, annulee: true })];
  assert.equal(doublonsProbables({ date: "2026-01-05", libelle: "Vercel", montantCents: 2000, sens: "sortie" }, annulee).length, 0);
});

test("les totaux trimestriels suivent le trimestre civil", () => {
  // ⚠️ On ne déclare pas un cumul « depuis le début », on déclare une PÉRIODE.
  const t = parTrimestre([
    ecr({ date: "2026-03-31", sens: "entree", categorie: "abonnements", montantCents: 1000 }),
    ecr({ date: "2026-04-01", sens: "entree", categorie: "abonnements", montantCents: 2000 }),
    ecr({ date: "2026-06-30", sens: "sortie", montantCents: 500 }),
    ecr({ date: "2026-07-01", sens: "entree", categorie: "abonnements", montantCents: 9999, annulee: true }),
  ]);
  assert.deepEqual(t.map((x) => x.periode), ["2026-T1", "2026-T2"]);
  assert.equal(t[0].recettesCents, 1000);
  assert.equal(t[1].recettesCents, 2000);
  assert.equal(t[1].depensesCents, 500);
});

test("une charge déjà reportée n'est pas reproposée", () => {
  // ⚠️ Reproposer un report déjà fait est la façon la plus simple de créer un doublon
  // en croyant bien faire.
  const base = [
    ecr({ date: "2026-01-05", libelle: "Vercel", categorie: "hebergement", montantCents: 2000, recurrente: true }),
    ecr({ date: "2026-01-05", libelle: "Supabase", categorie: "services", montantCents: 2500, recurrente: true }),
    ecr({ date: "2026-02-05", libelle: "Vercel", categorie: "hebergement", montantCents: 2000, recurrente: true }),
  ];
  const m = modelesRecurrents(base, "2026-02");
  assert.equal(m.length, 2, "les occurrences d'une même charge doivent être regroupées");
  assert.equal(m.find((x) => x.libelle === "Vercel")?.dejaSaisi, true);
  assert.equal(m.find((x) => x.libelle === "Supabase")?.dejaSaisi, false);
});

test("une évolution sans base de comparaison ne s'invente pas", () => {
  // ⚠️ « +∞ % » ou « +100 % » à partir de zéro ne veut rien dire : l'écran doit dire
  // qu'il n'y a pas de comparaison possible, pas afficher un pourcentage rassurant.
  assert.equal(evolution(1000, 0), null);
  assert.equal(evolution(1500, 1000), 50);
  assert.equal(evolution(500, 1000), -50);
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

// ─────────────────────────────────────────────────────────────────────────────
//  Pièces justificatives — ce sont des factures de clients payants
// ─────────────────────────────────────────────────────────────────────────────

test("une pièce n'est ni un exécutable ni une vidéo", () => {
  assert.deepEqual(validerFichier("application/pdf", 1000), []);
  assert.deepEqual(validerFichier("image/jpeg", 1000), []);
  assert.ok(validerFichier("text/html", 1000).some((e) => /format/i.test(e)));
  assert.ok(validerFichier("application/x-sh", 1000).some((e) => /format/i.test(e)));
  assert.ok(validerFichier("application/pdf", 0).some((e) => /vide/i.test(e)));
  assert.ok(validerFichier("application/pdf", TAILLE_MAX + 1).some((e) => /lourd/i.test(e)));
});

test("le nom du fichier d'origine n'est jamais repris comme chemin", () => {
  // ⚠️ « ../../avatars/moi.png » remonterait d'un dossier — vers un seau PUBLIC. Et deux
  // écritures dont la facture s'appelle « facture.pdf » s'écraseraient l'une l'autre.
  const c = cheminDe("ed-1", "application/pdf", "abc-123");
  assert.match(c, /^ed-1\/\d{4}\/abc-123\.pdf$/);
  // L'extension vient du TYPE DÉCLARÉ, pas du nom : un nom de fichier ment facilement.
  assert.match(cheminDe("ed-1", "image/png", "x"), /\.png$/);
  // Un identifiant tordu est nettoyé, jamais interpolé tel quel.
  assert.ok(!cheminDe("ed-1", "image/png", "../../evasion").includes(".."));
});

test("un chemin venu du navigateur ne donne pas accès à tout le seau", () => {
  // ⚠️ Sans ce contrôle, un administrateur — ou n'importe quoi qui emprunte sa session —
  // pourrait réclamer une URL signée pour n'importe quel objet en fabriquant l'adresse.
  assert.ok(cheminAppartientA("ed-1/2026/abc.pdf", "ed-1"));
  assert.ok(!cheminAppartientA("ed-2/2026/abc.pdf", "ed-1"), "on lit le dossier d'un autre");
  assert.ok(!cheminAppartientA("ed-1/../ed-2/abc.pdf", "ed-1"), "la remontée de dossier passe");
  assert.ok(!cheminAppartientA("/ed-1/2026/abc.pdf", "ed-1"));
  assert.ok(!cheminAppartientA("", "ed-1"));
});

test("les factures ne peuvent pas atterrir dans un espace public", () => {
  // ⚠️ LE PROJET A DEUX SEAUX, `avatars` ET `message-attachments`, ET LES DEUX SONT
  // PUBLICS. Y déposer une facture publierait le nom, l'adresse et le montant d'un
  // client payant. La route doit viser un seau dédié ET vérifier qu'il est privé À
  // CHAQUE DÉPÔT : un seau se bascule en public d'un clic, et personne ne le remarque.
  assert.equal(BUCKET, "justificatifs");
  const src = codeSeul("src/app/api/admin/compta/piece/route.ts");
  assert.ok(!/avatars|message-attachments/.test(src), "la route vise un seau public");
  assert.match(src, /await seauPrive\(\)/, "le caractère privé du seau n'est pas vérifié");
  assert.match(src, /data\.public/, "rien ne teste si le seau est public");
  assert.match(src, /cheminAppartientA\(/, "le chemin demandé n'est pas contrôlé");
});

test("aucune adresse de stockage réutilisable n'atteint le navigateur", () => {
  // ⚠️ REDIRIGER VERS UNE URL SIGNÉE ÉTAIT UNE FAILLE. L'adresse atterrit dans
  // l'historique du navigateur et reste valable POUR N'IMPORTE QUI pendant sa durée de
  // vie : copiée, partagée, ou simplement relue sur une machine partagée, elle ouvre la
  // facture d'un client sans compte ni mot de passe. Le fichier doit transiter PAR le
  // serveur, qui vérifie la session à chaque octet.
  const src = codeSeul("src/app/api/admin/compta/piece/route.ts");
  assert.ok(!/redirect\(/.test(src), "la route redirige encore vers le stockage");
  assert.ok(!/createSignedUrl\(/.test(src), "une URL signée est encore délivrée au navigateur");
  assert.match(src, /storage\.from\(BUCKET\)\.download\(/, "le fichier n'est pas servi par le serveur");
  assert.match(src, /no-store/, "une facture peut être mise en cache");
});

test("chaque consultation d'une facture laisse une trace", () => {
  // ⚠️ Sans journal d'accès, la question « quelqu'un a-t-il vu mes factures ? » n'a
  // aucune réponse possible. Et la trace ne doit jamais bloquer la lecture : une facture
  // illisible parce que le journal a échoué serait une panne causée par la sécurité.
  const src = codeSeul("src/app/api/admin/compta/piece/route.ts");
  assert.match(src, /type: "compta_acces"/, "aucune trace n'est enregistrée");
  assert.match(src, /user-agent|appareil/, "la trace ne dit pas depuis quel appareil");
  assert.match(src, /x-forwarded-for|ip:/, "la trace ne dit pas depuis quelle adresse");
  const bloc = src.slice(src.indexOf("compta_acces") - 400, src.indexOf("compta_acces") + 600);
  assert.match(bloc, /try \{/, "l'échec de la trace peut empêcher de lire la facture");

  // ⚠️ ET ELLE DOIT ÊTRE LISIBLE. Une trace enregistrée que personne ne peut consulter
  // ne répond à aucune question : « quelqu'un a-t-il vu mes factures ? » resterait sans
  // réponse alors même que la réponse est en base. Même défaut que l'espace coach sans
  // lien — une fonction qu'on ne peut pas atteindre n'existe pas.
  const lecture = codeSeul("src/app/api/admin/compta/route.ts");
  assert.match(lecture, /"compta_acces"/, "le journal d'accès n'est jamais relu");
  const ecran = codeSeul("src/components/admin/ComptaClient.tsx");
  assert.match(ecran, /acces\.slice|acces\.map/, "le journal d'accès n'est pas affiché");
});

test("le livre des recettes a la forme attendue en micro-entreprise", () => {
  // Uniquement les RECETTES, numérotées, dans l'ordre, avec la référence de la pièce,
  // le client, la nature et le mode de règlement.
  const csv = versLivreRecettes([
    ecr({ id: "b", date: "2026-02-01", sens: "entree", categorie: "abonnements", montantCents: 1499, tiers: "Client A", piece: "F-002", moyen: "Stripe" }),
    ecr({ id: "a", date: "2026-01-01", sens: "entree", categorie: "coaching", montantCents: 5000, tiers: "Client B", piece: "F-001", moyen: "Virement" }),
    ecr({ id: "c", date: "2026-03-01", sens: "sortie", categorie: "hebergement", montantCents: 2000 }),
    ecr({ id: "d", date: "2026-04-01", sens: "entree", categorie: "abonnements", montantCents: 999, annulee: true, motifAnnulation: "doublon" }),
  ]);
  const l = csv.split("\r\n");
  assert.ok(l[0].startsWith("\ufeffN°;Date;Référence de la pièce;Client;Nature"), "en-tête inattendu : " + l[0]);
  // La dépense n'y figure pas : ce livre ne recense QUE les recettes.
  assert.ok(!csv.includes("Hébergement"), "une dépense s'est glissée dans le livre des recettes");
  assert.equal(l.length, 4, "trois recettes attendues (dont l'annulée)");
  assert.ok(l[1].startsWith("1;2026-01-01;F-001;Client B"), "ordre ou colonnes incorrects : " + l[1]);
  assert.ok(l[2].startsWith("2;2026-02-01;F-002;Client A"));
  // ⚠️ L'annulée FIGURE, mentionnée. La retirer laisserait un numéro à trous sans
  // explication — exactement ce qu'un contrôle demande de justifier.
  assert.match(l[3], /oui — doublon/);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Lecture automatique d'une facture — la machine propose, l'humain confirme
// ─────────────────────────────────────────────────────────────────────────────

test("une facture bien lue pré-remplit l'écriture", () => {
  const s2 = interpreterLecture({
    date: "2026-08-20", montantTTC: 19.9, devise: "EUR", tiers: "Vercel Inc.",
    piece: "F-2026-08", sens: "sortie", categorie: "hebergement", libelle: "Abonnement Vercel",
  });
  assert.equal(s2.date, "2026-08-20");
  assert.equal(s2.montantCents, 1990);
  assert.equal(s2.categorie, "hebergement");
  assert.equal(s2.sens, "sortie");
  assert.deepEqual(s2.avertissements, []);
});

test("ce qui n'est pas lisible reste VIDE et se dit", () => {
  // ⚠️ Un champ deviné « pour rendre service » est pire qu'un champ vide : le vide se
  // voit et se remplit, l'approximation se recopie dans une comptabilité.
  const s2 = interpreterLecture({ tiers: "Boulangerie" });
  assert.equal(s2.date, undefined);
  assert.equal(s2.montantCents, undefined);
  assert.ok(s2.avertissements.some((a) => /date/i.test(a)));
  assert.ok(s2.avertissements.some((a) => /montant/i.test(a)));
});

test("une date impossible lue sur un ticket est rejetée", () => {
  // « 2026-02-31 » a la bonne FORME et n'existe pas — JavaScript la reporterait au 2 mars.
  const s2 = interpreterLecture({ date: "2026-02-31", montantTTC: 10 });
  assert.equal(s2.date, undefined);
  assert.ok(s2.avertissements.some((a) => /date/i.test(a)));
});

test("un montant en devise étrangère n'est pas repris", () => {
  // ⚠️ Même règle que pour Stripe : on ne convertit rien. 19.90 USD enregistrés en euros
  // seraient une recette fausse, et rien ne le montrerait.
  const s2 = interpreterLecture({ date: "2026-08-20", montantTTC: 19.9, devise: "USD" });
  assert.equal(s2.montantCents, undefined);
  assert.ok(s2.avertissements.some((a) => /USD|devise/i.test(a)));
});

test("une catégorie inventée ou incohérente est écartée", () => {
  // Le modèle propose parfois un libellé au lieu d'un identifiant, ou une catégorie de
  // recette pour un achat : les deux fausseraient la ventilation par poste.
  assert.equal(interpreterLecture({ categorie: "Hébergement OVH" }).categorie, undefined);
  assert.equal(interpreterLecture({ sens: "sortie", categorie: "abonnements" }).categorie, undefined,
    "une catégorie de recette a été acceptée pour une dépense");
  assert.equal(interpreterLecture({ sens: "entree", categorie: "abonnements" }).categorie, "abonnements");
});

test("un montant à trois décimales ou illisible n'entre pas", () => {
  assert.equal(interpreterLecture({ montantTTC: "12,505" }).montantCents, undefined);
  assert.equal(interpreterLecture({ montantTTC: "gratuit" }).montantCents, undefined);
  assert.equal(interpreterLecture({ montantTTC: 0 }).montantCents, undefined);
  assert.equal(interpreterLecture({ montantTTC: -10 }).montantCents, undefined);
});

test("le JSON se retrouve même enrobé de texte", () => {
  assert.deepEqual(jsonDeLaReponse('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(jsonDeLaReponse('Voici : {"a":1} — voilà.'), { a: 1 });
  assert.equal(jsonDeLaReponse("pas de json ici"), null);
  assert.equal(jsonDeLaReponse("{cassé"), null);
});

test("la consigne interdit d'inventer et ne cite que des catégories réelles", () => {
  // ⚠️ Si la consigne listait une catégorie qui n'existe pas, le modèle la proposerait et
  // l'interprétation l'écarterait en silence : on perdrait la suggestion sans savoir
  // pourquoi.
  assert.match(CONSIGNE_LECTURE, /OMETS la clé/);
  assert.match(CONSIGNE_LECTURE, /TOUTES TAXES COMPRISES/);
  for (const c of CATEGORIES) assert.ok(CONSIGNE_LECTURE.includes(c.id), `catégorie absente de la consigne : ${c.id}`);
  const listee = CONSIGNE_LECTURE.split("liste EXACTE")[1] ?? "";
  for (const mot of listee.split(/[,\s]+/).filter((m) => /^[a-z_]{4,}$/.test(m))) {
    if (["categorie", "libelle", "omets"].includes(mot)) continue;
    assert.ok(CATEGORIES.some((c) => c.id === mot), `la consigne cite une catégorie inexistante : ${mot}`);
  }
});

test("la lecture ne peut rien enregistrer", () => {
  // ⚠️ LA GARANTIE CENTRALE. Cette route propose, elle n'écrit pas : un total mal lu
  // deviendrait une ligne comptable fausse, indiscernable d'une ligne juste.
  const src = codeSeul("src/app/api/admin/compta/lire/route.ts");
  assert.ok(!/\.insert\(|\.update\(|\.upsert\(|enregistrerEcritures/.test(src),
    "la route de lecture écrit en base");
  assert.ok(!/storage\.from\([^)]*\)\.upload/.test(src), "la route de lecture conserve l'image");
  assert.match(src, /thinkingBudget: 0/, "le budget de réflexion se facture comme de la sortie");
  assert.match(src, /temperature: 0\b/, "une température non nulle sur un montant");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
