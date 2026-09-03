/**
 * SUPERVISION DE L'AUTOMATISATION — née d'un défaut qu'aucun écran ne montrait.
 *
 * Le 03/09/2026, il a fallu interroger l'API de GitHub à la main pour découvrir que
 * `sync-coach`, déclaré 48 fois par jour, ne tournait que 6 fois ; que la newsletter
 * avait échoué le 31/08 sans que personne le sache ; et que deux tâches n'avaient
 * jamais tourné. Huit tâches automatisées, aucune trace, rien dans l'administration.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { TACHES, constater, pire, type Execution } from "../src/lib/cron/supervision";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const MAINTENANT = new Date("2026-09-03T14:00:00Z");
/** n exécutions, la plus récente il y a `depuis` heures, espacées de `pas` heures. */
const runs = (n: number, depuis: number, pas: number, ok = true): Execution[] =>
  Array.from({ length: n }, (_, i) => ({
    created_at: new Date(MAINTENANT.getTime() - (depuis + i * pas) * 3600000).toISOString(),
    conclusion: ok ? "success" : "failure",
  }));
const parNom = (f: string) => TACHES.find((t) => t.fichier === f)!;

test("les cadences déclarées correspondent aux fichiers réels", () => {
  // ⚠️ RECOPIÉ À LA MAIN, CE TABLEAU AURAIT DÉRIVÉ au premier changement de cadence, et
  // la supervision aurait comparé le réel à une attente imaginaire — un écran qui ment
  // en vert. On le confronte donc aux fichiers `.github/workflows/*.yml`.
  const fichiers = readdirSync(".github/workflows").filter((f) => f.endsWith(".yml"));
  const planifies = fichiers.filter((f) => /^\s*-\s*cron:/m.test(readFileSync(`.github/workflows/${f}`, "utf8")));
  assert.ok(planifies.length > 0, "aucun fichier de workflow planifié n'a été trouvé");

  const declares = new Set(TACHES.map((t) => `${t.fichier}.yml`));
  for (const f of planifies) {
    assert.ok(declares.has(f), `« ${f} » est planifié mais absent de la supervision : sa panne serait invisible`);
  }
  for (const t of TACHES) {
    assert.ok(planifies.includes(`${t.fichier}.yml`), `« ${t.fichier} » est supervisé mais n'existe plus`);
  }

  // Et le NOMBRE d'exécutions attendues doit correspondre aux lignes `cron:` du fichier.
  for (const t of TACHES) {
    const src = readFileSync(`.github/workflows/${t.fichier}.yml`, "utf8");
    const crons = [...src.matchAll(/^\s*-\s*cron:\s*"([^"]+)"/gm)].map((m) => m[1]);
    assert.ok(crons.length > 0, `${t.fichier} n'a plus de planification`);
    // « 7,37 * * * * » = 2 par heure = 48 par jour ; « 40 2 * * * » ×3 = 3 par jour ;
    // « 30 6 * * 1 » = 1 par semaine.
    let parJour = 0;
    for (const c of crons) {
      const [minutes, heures, , , jours] = c.split(/\s+/);
      const nMin = minutes.includes(",") ? minutes.split(",").length : 1;
      const nHeures = heures === "*" ? 24 : heures.split(",").length;
      const parSemaine = jours === "*" ? 7 : jours.split(",").length;
      parJour += (nMin * nHeures * parSemaine) / 7;
    }
    assert.ok(Math.abs(parJour - t.parJour) < 0.01,
      `${t.fichier} : le fichier déclare ${parJour.toFixed(2)}/jour, la supervision attend ${t.parJour}`);
  }
});

test("« jamais lancée » n'est pas « en retard »", () => {
  // ⚠️ UNE TÂCHE SANS AUCUNE EXÉCUTION EST UNE PANNE TOTALE, souvent parce que son
  // fichier n'a jamais été pris en compte. La ranger parmi les petits retards
  // reviendrait à la noyer. C'est arrivé pour deux tâches de ce dépôt.
  const c = constater(parNom("sync-coach"), [], MAINTENANT);
  assert.equal(c.etat, "jamais lancée");
  assert.equal(c.derniere, null);
  assert.equal(c.ilYaHeures, null, "un délai est affiché alors qu'il n'y a jamais eu d'exécution");
});

test("l'étranglement de GitHub ne fait pas crier l'écran tous les jours", () => {
  // Réel, mesuré : sync-coach est déclaré 48 fois par jour et n'en obtient que 6. Le
  // déclarer en panne quotidiennement rendrait l'écran inutile — on cesserait de le lire.
  const c = constater(parNom("sync-coach"), runs(6, 1, 4), MAINTENANT);
  assert.equal(c.etat, "à l'heure");
  // Mais l'écart RESTE VISIBLE : on ne le masque pas, on refuse juste d'en faire une alarme.
  assert.equal(c.observees, 6);
  assert.equal(c.attendues, 48);
});

test("un vrai silence est signalé, à toutes les cadences", () => {
  assert.equal(constater(parNom("sync-coach"), runs(3, 8, 4), MAINTENANT).etat, "en retard",
    "une tâche bihoraire muette depuis 8 h passe pour normale");
  assert.equal(constater(parNom("heure-depart"), runs(2, 72, 24), MAINTENANT).etat, "en retard",
    "une tâche quotidienne muette depuis 3 jours passe pour normale");
  // ⚠️ CE CAS ÉTAIT FAUX AU PREMIER ESSAI : avec une tolérance de trois fois
  // l'intervalle, une newsletter hebdomadaire muette depuis TROIS SEMAINES était
  // déclarée « à l'heure » — trois fois 168 heures font 21 jours.
  assert.equal(constater(parNom("newsletter-weekly"), runs(1, 504, 0), MAINTENANT).etat, "en retard",
    "une newsletter muette depuis 3 semaines passe pour normale");
  assert.equal(constater(parNom("newsletter-weekly"), runs(1, 192, 0), MAINTENANT).etat, "à l'heure",
    "une newsletter d'il y a 8 jours est déclarée en retard : l'écran crierait chaque semaine");
});

test("un échec prime sur tout le reste", () => {
  // La newsletter a échoué le 31/08 sans que personne le sache. Une exécution récente
  // mais ratée ne doit jamais compter comme « à l'heure ».
  const c = constater(parNom("newsletter-weekly"), runs(1, 2, 0, false), MAINTENANT);
  assert.equal(c.etat, "en échec");
  assert.equal(c.echecs, 1);
  assert.equal(pire([
    constater(parNom("sync-coach"), runs(6, 1, 4), MAINTENANT),
    c,
  ]), "en échec", "l'échec est noyé par les tâches en bonne santé");
  assert.equal(pire([constater(parNom("sync-coach"), [], MAINTENANT), c]), "jamais lancée",
    "une panne totale doit primer sur un échec ponctuel");
});

test("GitHub injoignable ne se lit pas « tout va bien »", () => {
  // ⚠️ LE PIRE MENSONGE EST CELUI QUI RASSURE. `lireRuns` rend `null` quand l'appel
  // échoue, et la tâche est alors listée comme INCONNUE — jamais comme « jamais lancée »,
  // ce qui serait un faux diagnostic, ni comme « à l'heure », ce qui serait pire.
  // ⚠️ VISER LE BLOC `catch`, PAS LE FICHIER. Le premier jet cherchait « return null »
  // n'importe où : la branche `!r.ok` en porte un aussi, donc muter le `catch` laissait
  // le test vert. Un motif présent deux fois ne rougit que si on vise le bon.
  const src = readFileSync("src/lib/cron/github.ts", "utf8");
  const iCatch = src.indexOf("} catch {");
  assert.ok(iCatch > 0, "l'appel réseau n'est plus protégé : une panne de GitHub ferait tomber l'écran");
  assert.ok(/return null;/.test(src.slice(iCatch, iCatch + 500)),
    "une erreur réseau ne rend plus « on ne sait pas » : elle se confondrait avec zéro exécution");
  assert.ok(/if \(!r\.ok\) return null;/.test(src), "une réponse d'erreur de GitHub est prise pour une liste vide");
  assert.ok(/runs === null/.test(src), "l'appelant ne distingue plus l'ignorance de l'absence");
  const vue = readFileSync("src/components/admin/Automatisation.tsx", "utf8");
  assert.ok(/État indisponible/.test(vue), "l'écran ne dit pas quand il ne sait pas");
  assert.ok(/inconnues\.length > 0/.test(vue), "les tâches sans réponse sont passées sous silence");
});

test("une exécution illisible ne fait pas tomber le calcul", () => {
  const hostiles = [
    { created_at: "pas une date", conclusion: "success" },
    { created_at: "", conclusion: null },
    ...runs(1, 2, 0),
  ] as Execution[];
  const c = constater(parNom("sync-coach"), hostiles, MAINTENANT);
  assert.equal(c.etat, "à l'heure", "une date illisible fausse le constat");
  assert.ok(Number.isFinite(c.ilYaHeures ?? NaN));
});

console.log(`\n${passed} test(s) de supervision passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
