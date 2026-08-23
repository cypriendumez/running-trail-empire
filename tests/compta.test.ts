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

const ROOT = join(__dirname, "..");
let passed = 0;
const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

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

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
