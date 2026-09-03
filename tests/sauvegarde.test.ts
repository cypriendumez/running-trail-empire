/**
 * SAUVEGARDE — garde-fous d'un chantier né d'un risque non couvert.
 *
 * Au 03/09/2026, aucune sauvegarde n'existait. Les 17 131 courses ont été bâties par des
 * mois de collecte auprès de sources qui ne sont plus accessibles à cette échelle :
 * jogging-plus refuse les automates (403 mesuré), la FFA l'interdit par robots.txt.
 * Perdue, cette table NE SE RECONSTRUIT PAS.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SAUVEGARDABLES, INTERDITES, estSauvegardable, fichierDe, verifierManifeste, type Manifeste,
} from "../src/lib/sauvegarde/tables";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

test("AUCUNE donnée personnelle ne peut entrer dans l'archive", () => {
  // ⚠️ LE DÉPÔT EST PUBLIC (vérifié : l'API GitHub répond `private: false`) et l'archive
  // part chez GitHub. Y placer profils, entraînements, journal ou messages serait une
  // DIVULGATION, pas une sauvegarde. Une erreur de copie suffirait, et elle serait
  // silencieuse — d'où ce test.
  for (const interdite of INTERDITES) {
    assert.equal(estSauvegardable(interdite), false, `« ${interdite} » est devenue sauvegardable`);
    assert.ok(!SAUVEGARDABLES.some((t) => t.nom === interdite),
      `« ${interdite} » figure dans la liste d'autorisation`);
  }
  // Les tables les plus sensibles sont nommées explicitement, pour qu'un oubli dans
  // INTERDITES ne passe pas inaperçu.
  for (const critique of ["profiles", "workouts", "journal_entries", "messages", "gps_traces"]) {
    assert.ok(INTERDITES.includes(critique), `« ${critique} » n'est plus dans la liste des interdites`);
  }
});

test("une table inconnue n'est PAS sauvegardée par défaut", () => {
  // ⚠️ AUTORISATION, PAS EXCLUSION. Une table créée demain ne doit pas partir chez
  // GitHub parce que personne n'a pensé à l'interdire.
  for (const inconnue of ["table_future", "paiements", "", "   ", null, undefined, "RACES; drop"]) {
    assert.equal(estSauvegardable(inconnue), false, `« ${String(inconnue)} » sort sans autorisation`);
  }
  assert.equal(estSauvegardable("races"), true);
  assert.equal(estSauvegardable("RACES"), true, "la casse ne doit pas contourner l'autorisation");
});

test("chaque table autorisée dit POURQUOI elle peut être publiée", () => {
  for (const t of SAUVEGARDABLES) {
    assert.ok(t.raison.length > 40, `« ${t.nom} » est autorisée sans justification lisible`);
    // ⚠️ UN ORDRE STABLE EST INDISPENSABLE : PostgREST plafonne à 1 000 lignes, et une
    // pagination sans `order` explicite saute ou répète des lignes d'une page à l'autre.
    assert.ok(t.ordre.length > 0, `« ${t.nom} » n'a pas de colonne d'ordre : la pagination dériverait`);
    assert.equal(fichierDe(t.nom), `${t.nom}.json`);
  }
});

test("une archive tronquée est refusée, pas servie comme valide", () => {
  // ⚠️ UN EXPORT INTERROMPU PRODUIT UN JSON VALIDE ET POURTANT AMPUTÉ. Seuls le compte
  // de lignes et l'empreinte le révèlent — le fichier, lui, s'ouvre parfaitement.
  const bonne: Manifeste = {
    faite: "2026-09-03T13:00:00.000Z",
    lignes: { races: 17131, product_offers: 268 },
    empreintes: { races: "aaa", product_offers: "bbb" },
  };
  const vraies = (t: string) => (t === "races" ? "aaa" : "bbb");
  assert.equal(verifierManifeste(bonne, vraies).ok, true);

  // Contenu différent de l'empreinte annoncée.
  assert.equal(verifierManifeste(bonne, (t) => (t === "races" ? "AUTRE" : "bbb")).ok, false);
  // Fichier absent.
  assert.equal(verifierManifeste(bonne, (t) => (t === "races" ? null : "bbb")).ok, false);
  // Zéro ligne annoncée : une table vide n'est pas une sauvegarde.
  assert.equal(verifierManifeste({ ...bonne, lignes: { races: 0, product_offers: 268 } }, vraies).ok, false);
  // Manifeste absent ou sans date.
  assert.equal(verifierManifeste(null, vraies).ok, false);
  assert.equal(verifierManifeste({ ...bonne, faite: "" }, vraies).ok, false);
  // Une table autorisée mais absente du manifeste doit être signalée.
  assert.equal(verifierManifeste({ ...bonne, lignes: { races: 17131 } }, vraies).ok, false);
});

test("l'export pagine et se compare au compte réel de la base", () => {
  // ⚠️ POSTGREST S'ARRÊTE À 1 000 LIGNES SANS ERREUR. Une sauvegarde écrite sans
  // pagination contiendrait 1 000 courses sur 17 131 et paraîtrait réussie.
  const src = readFileSync("scripts/sauvegarde.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/\.range\(debut, debut \+ PAS - 1\)/.test(src), "l'export ne pagine plus");
  assert.ok(/\.order\(t\.ordre/.test(src), "la pagination n'est plus ordonnée : elle sauterait des lignes");
  assert.ok(/lignes\.length !== count/.test(src),
    "l'export ne se compare plus au compte réel : une archive amputée passerait pour complète");
  assert.ok(/estSauvegardable\(t\.nom\)/.test(src), "l'export ne revérifie plus l'autorisation avant d'écrire");
});

test("restaurer SIMULE par défaut et refuse une table non autorisée", () => {
  // ⚠️ RESTAURER ÉCRASE DES DONNÉES EN PRODUCTION. Le geste doit être délibéré : la
  // simulation est le défaut, et l'écriture exige de NOMMER la table.
  const src = readFileSync("scripts/restaurer.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/iEcrire >= 0 && !estSauvegardable\(cible\)/.test(src),
    "la restauration accepte une table non autorisée");
  assert.ok(/const ecrit = iEcrire >= 0 && cible === t\.nom;/.test(src),
    "la restauration écrirait toutes les tables d'un coup");
  assert.ok(/SIMULATION/.test(src), "la simulation ne dit plus qu'elle n'a rien écrit");
  // Le cas le plus dangereux doit être ANNONCÉ : une archive plus pauvre que la base.
  assert.ok(/PLUS PAUVRE que la base/.test(src),
    "une archive plus ancienne que la base s'écrirait sans avertissement");
});

test("le workflow ne publie que le dossier d'archive, et échoue s'il est vide", () => {
  const wf = readFileSync(".github/workflows/sauvegarde.yml", "utf8");
  assert.ok(/if-no-files-found: error/.test(wf),
    "un dossier vide serait publié comme une sauvegarde réussie");
  assert.ok(/scripts\/sauvegarde\.ts --verifie/.test(wf),
    "le workflow ne relit pas ce qu'il vient d'écrire");
  assert.ok(/path: \.sauvegardes\//.test(wf), "le workflow publie autre chose que l'archive");
  // ⚠️ ET LA RÉTENTION EST FINIE : 90 jours sur l'offre gratuite. C'est écrit pour que
  // personne ne croie l'archive éternelle.
  assert.ok(/retention-days: 90/.test(wf), "la durée de conservation n'est plus déclarée");
});

console.log(`\n${passed} test(s) de sauvegarde passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
