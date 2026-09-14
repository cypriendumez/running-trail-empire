/**
 * MICRO-ENTREPRISE — le CA à déclarer, prêt à recopier dans l'URSSAF.
 *
 * ⚠️ Le CA micro = recettes ENCAISSÉES hors apports personnels, par date d'opération —
 * exactement la base de `cotisations()`, une seule définition dans toute l'app. Un apport
 * de trésorerie n'est pas un chiffre d'affaires : cotiser dessus ferait payer sur son
 * propre argent et rapprocherait d'un plafond sans qu'un euro ait été facturé.
 *
 * ⚠️ AUCUN taux n'est écrit dans le code : sans taux saisi, les cotisations valent `null`
 * (on ne devine pas), et pendant l'ACRE le taux réduit s'applique jusqu'à la date saisie.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { declarationsMicro, bilanAnnuel, caEncaisse } from "../src/lib/compta/micro";
import type { Ecriture, Reglages } from "../src/lib/compta/model";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const e = (p: Partial<Ecriture>): Ecriture => ({
  id: p.id ?? Math.random().toString(36).slice(2), date: p.date ?? "2026-07-15",
  libelle: p.libelle ?? "x", sens: p.sens ?? "entree", categorie: p.categorie ?? "abonnements",
  montantCents: p.montantCents ?? 0, moyen: p.moyen ?? "Stripe", annulee: p.annulee,
});

test("le CA encaissé exclut apports, sorties et lignes annulées", () => {
  const ecr = [
    e({ categorie: "abonnements", montantCents: 999, date: "2026-07-10" }),
    e({ categorie: "coaching", montantCents: 5000, date: "2026-07-20" }),
    e({ categorie: "apport", montantCents: 500000, date: "2026-07-01" }),        // apport perso → exclu
    e({ categorie: "abonnements", montantCents: 1499, date: "2026-07-05", annulee: true }), // annulée → exclue
    e({ sens: "sortie", categorie: "ia", montantCents: 3000, date: "2026-07-08" }),          // dépense → exclue
    e({ categorie: "abonnements", montantCents: 999, date: "2026-08-02" }),        // hors période
  ];
  const { caCents, nb } = caEncaisse(ecr, "2026-07-01", "2026-07-31");
  assert.equal(caCents, 999 + 5000, "seules les deux vraies recettes de juillet comptent");
  assert.equal(nb, 2);
});

test("les trimestres sont découpés et libellés, du plus récent au plus ancien", () => {
  const ecr = [
    e({ categorie: "abonnements", montantCents: 10000, date: "2026-02-10" }), // T1
    e({ categorie: "abonnements", montantCents: 20000, date: "2026-08-10" }), // T3
  ];
  const r: Reglages = { periodiciteUrssaf: "trimestriel" };
  const decs = declarationsMicro(ecr, r, 2026, "2026-09-14");
  // T1, T2, T3 commencés (T4 pas encore) ; ordre décroissant.
  assert.deepEqual(decs.map((d) => d.cle), ["2026-T3", "2026-T2", "2026-T1"]);
  assert.equal(decs.find((d) => d.cle === "2026-T3")!.caCents, 20000);
  assert.equal(decs.find((d) => d.cle === "2026-T1")!.caCents, 10000);
  assert.equal(decs.find((d) => d.cle === "2026-T2")!.caCents, 0, "un trimestre sans recette existe à 0");
  // T3 : juillet-septembre, close seulement quand sa fin (30/09) est passée.
  assert.equal(decs.find((d) => d.cle === "2026-T3")!.close, false, "au 14/09, le T3 est encore en cours");
  assert.equal(decs.find((d) => d.cle === "2026-T1")!.close, true);
  // Échéance indicative du T3 = fin octobre.
  assert.equal(decs.find((d) => d.cle === "2026-T3")!.echeanceIndicative, "2026-10-31");
});

test("le découpage mensuel n'affiche pas les mois futurs", () => {
  const decs = declarationsMicro([e({ montantCents: 999, date: "2026-03-10" })], { periodiciteUrssaf: "mensuel" }, 2026, "2026-04-15");
  assert.deepEqual(decs.map((d) => d.cle), ["2026-04", "2026-03", "2026-02", "2026-01"], "jusqu'au mois en cours seulement");
  assert.equal(decs.find((d) => d.cle === "2026-03")!.caCents, 999);
  assert.equal(decs.find((d) => d.cle === "2026-04")!.echeanceIndicative, "2026-05-31");
});

test("sans taux saisi, les cotisations valent null — jamais un montant deviné", () => {
  const decs = declarationsMicro([e({ montantCents: 100000, date: "2026-08-10" })], { periodiciteUrssaf: "trimestriel" }, 2026, "2026-09-14");
  const t3 = decs.find((d) => d.cle === "2026-T3")!;
  assert.equal(t3.cotisationsCents, null, "aucun taux → aucune estimation");
  assert.ok(t3.manquant.length > 0, "le manque de taux doit être signalé");
  // Avec un taux, l'estimation apparaît.
  const avecTaux = declarationsMicro([e({ montantCents: 100000, date: "2026-08-10" })], { periodiciteUrssaf: "trimestriel", tauxCotisations: 21.2 }, 2026, "2026-09-14");
  assert.equal(avecTaux.find((d) => d.cle === "2026-T3")!.cotisationsCents, Math.round(100000 * 21.2 / 100));
});

test("l'ACRE : le taux réduit s'applique jusqu'à la date saisie, le taux plein après", () => {
  // Deux recettes, avant et après la fin d'ACRE dans le MÊME trimestre.
  const ecr = [
    e({ montantCents: 100000, date: "2026-08-05" }), // avant fin ACRE
    e({ montantCents: 100000, date: "2026-09-20" }), // après
  ];
  const r: Reglages = { periodiciteUrssaf: "trimestriel", acreJusquau: "2026-08-31", tauxCotisations: 11, tauxApresAcre: 22 };
  const t3 = declarationsMicro(ecr, r, 2026, "2026-10-01").find((d) => d.cle === "2026-T3")!;
  assert.equal(t3.caCents, 200000);
  assert.equal(t3.cotisationsCents, Math.round(100000 * 11 / 100) + Math.round(100000 * 22 / 100), "chaque tranche à son taux");
});

test("le bilan annuel calcule la part du plafond SAISI, ou null", () => {
  const ecr = [e({ montantCents: 3_885_000, date: "2026-05-10" })]; // 38 850 €
  assert.equal(bilanAnnuel(ecr, {}, 2026).partPlafondPct, null, "sans plafond saisi, aucun pourcentage");
  const b = bilanAnnuel(ecr, { seuilCA: 77700 }, 2026);
  assert.equal(b.caCents, 3_885_000);
  assert.equal(b.partPlafondPct, 50, "38 850 € = 50 % de 77 700 €");
  assert.equal(b.seuilCents, 7_770_000);
});

test("micro.ts ne contient aucun taux ni seuil légal en dur", () => {
  const src = codeNu("src/lib/compta/micro.ts");
  // Aucun nombre à 4-5 chiffres (plafonds) ni pourcentage de cotisation codé.
  assert.ok(!/\b(77700|72600|188700|176200|18300|21[.,]1|21[.,]2|23[.,]1|12[.,]3|22\b)\b/.test(src.replace(/slice\(0, ?\d+\)/g, "")), "un taux ou un plafond légal est écrit en dur dans micro.ts");
  // Le CA passe par horsResultat + cotisations : la même définition que le reste de l'app.
  assert.ok(/horsResultat/.test(src) && /cotisations\(/.test(src), "micro.ts n'appuie plus le CA sur horsResultat/cotisations (risque de définition divergente)");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
