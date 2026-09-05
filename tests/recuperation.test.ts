/**
 * LE COACH DISAIT « FONCE » LES MATINS OÙ IL FALLAIT LEVER LE PIED.
 *
 * Deux angles morts, mesurés sur 55 nuits et 55 mesures de VFC réelles :
 *
 *  1. La règle de sommeil ne regardait QUE la nuit dernière (son propre commentaire le
 *     disait). Une série 3 h 23 / 5 h 13 / 6 h 51 se termine sur une nuit « correcte » :
 *     aucun signal, 4,4 h de sommeil manquantes. 2 cas sur 55 jours.
 *  2. La VFC n'était jugée qu'en moyenne 7 j contre 7 j précédents. Une seule matinée
 *     effondrée ne déplace pas une moyenne de 7 jours : le 17/06, VFC à 76 pour une base
 *     à 103, et la tendance hebdomadaire était EN HAUSSE — feu vert le pire matin du mois.
 *
 * Et un troisième défaut trouvé en chemin : les fenêtres n'étaient pas des fenêtres.
 * « Les 14 dernières lignes » de VFC couvraient 19 jours, « les 7 dernières nuits » 12.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  dureeHabituelle, detteSommeil, chuteVfc, ecartJours,
  DETTE_MIN, NUITS_HABITUDE_MIN, CHUTE_VFC_PCT, BASE_VFC_MIN,
} from "../src/lib/coach/recuperation";

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
const nuit = (date: string, min: number | null) => ({ date, total_sleep_min: min });
const vfc = (date: string, ms: number | null) => ({ date, hrv_ms: ms });

console.log("\nDURÉE HABITUELLE — la sienne, pas une norme de 8 h");

test("médiane des nuits mesurées", () => {
  const n = [480, 300, 400, 390, 420, 360, 396].map((m, i) => nuit(`2026-06-0${i + 1}`, m));
  assert.equal(dureeHabituelle(n), 396);
});

test("aucune habitude sous 7 nuits : on ne conclut pas", () => {
  const n = [400, 390, 420].map((m, i) => nuit(`2026-06-0${i + 1}`, m));
  assert.equal(dureeHabituelle(n), null, `${NUITS_HABITUDE_MIN} nuits sont exigées`);
  assert.equal(dureeHabituelle([]), null);
});

test("les nuits sans durée ne comptent pas comme zéro", () => {
  const mesurees = [400, 390, 420, 396, 380, 410, 402].map((m, i) => nuit(`2026-06-1${i}`, m));
  assert.equal(dureeHabituelle(mesurees), 400, "médiane des 7 nuits réellement mesurées");
  // La même série avec une nuit non mesurée doit donner LE MÊME chiffre : une durée
  // absente comptée 0 ferait glisser la médiane (398) et sous-estimerait la dette.
  assert.equal(dureeHabituelle([nuit("2026-06-01", null), ...mesurees]), 400);
});

console.log("\nDETTE DE SOMMEIL — le cas réel du 14/06 que rien ne signalait");

test("3 h 23 + 5 h 13 + 6 h 51 déclenche, alors que la dernière nuit est correcte", () => {
  const n = [nuit("2026-06-14", 411), nuit("2026-06-13", 313), nuit("2026-06-12", 203)];
  const d = detteSommeil(n, "2026-06-14", 396);
  assert.ok(d, "la dette du 14/06 n'est pas vue");
  assert.equal(d!.manqueMin, 261, "4 h 21 de manque attendues");
  assert.ok(411 >= 360, "la nuit du jour est bonne : l'ancienne règle ne pouvait pas s'allumer");
});

test("trois nuits conformes à l'habitude ne déclenchent rien", () => {
  const n = [nuit("2026-06-14", 396), nuit("2026-06-13", 390), nuit("2026-06-12", 400)];
  assert.equal(detteSommeil(n, "2026-06-14", 396), null);
});

test("une nuit manquante sur trois : on ne conclut pas", () => {
  // Ces deux nuits dépassent DÉJÀ le seuil à elles seules (276 min de manque) : si la
  // fonction répondait, ce serait en extrapolant une nuit qu'elle n'a jamais vue.
  const n = [nuit("2026-06-14", 313), nuit("2026-06-13", 203)];
  assert.ok((396 - 313) + (396 - 203) >= DETTE_MIN, "le fixture doit dépasser le seuil");
  assert.equal(detteSommeil(n, "2026-06-14", 396), null, "deux nuits ne disent rien de la troisième");
  const avecTrou = [...n, nuit("2026-06-12", null)];
  assert.equal(detteSommeil(avecTrou, "2026-06-14", 396), null, "un trou n'est pas une nuit courte");
});

test("les nuits hors fenêtre sont ignorées", () => {
  const n = [nuit("2026-06-14", 396), nuit("2026-06-13", 390), nuit("2026-06-12", 400), nuit("2026-06-05", 120)];
  assert.equal(detteSommeil(n, "2026-06-14", 396), null, "une nuit blanche d'il y a 9 jours ne pèse plus");
});

test("le seuil est bien celui annoncé", () => {
  const juste = [nuit("2026-06-14", 396 - DETTE_MIN), nuit("2026-06-13", 396), nuit("2026-06-12", 396)];
  assert.ok(detteSommeil(juste, "2026-06-14", 396), "à DETTE_MIN pile, la dette doit compter");
  const dessous = [nuit("2026-06-14", 396 - DETTE_MIN + 1), nuit("2026-06-13", 396), nuit("2026-06-12", 396)];
  assert.equal(detteSommeil(dessous, "2026-06-14", 396), null);
});

console.log("\nCHUTE AIGUË DE VFC — le matin du 17/06, feu vert donné à −26 %");

const base103 = [98, 105, 101, 107, 99, 110, 101].map((ms, i) => vfc(`2026-06-${String(16 - i).padStart(2, "0")}`, ms));

test("76 contre une base à 103 est signalé", () => {
  const c = chuteVfc([vfc("2026-06-17", 76), ...base103], "2026-06-17");
  assert.ok(c, "la chute du 17/06 n'est pas vue");
  assert.equal(c!.valeur, 76);
  assert.equal(c!.base, 103);
  assert.equal(c!.chutePct, 26);
});

test("une VFC dans sa base ne déclenche rien", () => {
  assert.equal(chuteVfc([vfc("2026-06-17", 101), ...base103], "2026-06-17"), null);
});

test("le jour jugé est EXCLU de sa propre base", () => {
  // Sinon la mauvaise matinée tire vers le bas la référence qui doit la juger.
  const c = chuteVfc([vfc("2026-06-17", 76), ...base103], "2026-06-17")!;
  assert.equal(c.base, 103, "76 s'est glissé dans sa propre base");
});

test("une base trop maigre ne permet aucun verdict", () => {
  const maigre = base103.slice(0, BASE_VFC_MIN - 1);
  assert.equal(chuteVfc([vfc("2026-06-17", 76), ...maigre], "2026-06-17"), null);
});

test("une mesure vieille de 5 jours ne décrit pas aujourd'hui", () => {
  assert.equal(chuteVfc([vfc("2026-06-17", 76), ...base103], "2026-06-22"), null);
});

test("le seuil est bien celui annoncé", () => {
  const pile = Math.round(103 * (1 - CHUTE_VFC_PCT / 100));
  assert.ok(chuteVfc([vfc("2026-06-17", pile), ...base103], "2026-06-17"), "à -20 % pile, la chute doit compter");
  assert.equal(chuteVfc([vfc("2026-06-17", pile + 2), ...base103], "2026-06-17"), null);
});

test("une valeur absurde n'est pas prise pour une donnée", () => {
  assert.equal(chuteVfc([vfc("2026-06-17", Number.NaN), ...base103], "2026-06-17"), null);
  assert.equal(chuteVfc([vfc("2026-06-17", 0), ...base103], "2026-06-17"), null);
  assert.equal(ecartJours("pas-une-date", "2026-06-17"), null);
});

console.log("\nBRANCHEMENT — un calcul juste qui n'est appelé nulle part ne sert à rien");

test("le contexte du coach APPELLE les deux signaux", () => {
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /detteSommeil\(sleep, todayStr\)/, "la dette n'est pas calculée");
  assert.match(src, /chuteVfc\(hrv, todayStr\)/, "la chute aiguë n'est pas calculée");
});

test("les deux signaux lèvent un drapeau", () => {
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /if \(dette\) orangeFlags\.push/, "la dette ne remonte à personne");
  assert.match(src, /if \(badNight \|\| dette\) redFlags\.push\(motif\); else orangeFlags\.push\(motif\)/,
    "la chute aiguë doit passer au rouge quand le sommeil la confirme");
});

test("les fenêtres sont en JOURS, plus en nombre de lignes", () => {
  const src = codeOf("src/lib/ai/coachContext.ts");
  assert.match(src, /dansLesJours\(h\.date, 14\)/, "la base de VFC dépend encore du nombre de lignes");
  assert.match(src, /dansLesJours\(d\.date, 7\)/, "la moyenne de sommeil dépend encore du nombre de lignes");
  assert.doesNotMatch(src, /sleep\.reduce\(\(s, d\) => s \+ \(d\.sleep_score \?\? 0\)/,
    "un score absent est de nouveau compté comme un 0/100");
  assert.ok(/hrv_data[\s\S]{0,220}?\.limit\(30\)/.test(src), "trop peu de lignes pour couvrir 14 jours de VFC");
  assert.ok(/sleep_data[\s\S]{0,260}?\.limit\(30\)/.test(src), "trop peu de lignes pour couvrir l'habitude de sommeil");
});

test("les deux motifs existent dans les cinq langues", () => {
  const src = readFileSync("src/lib/coach/reasonsI18n.ts", "utf8");
  for (const cle of ["detteSommeil", "vfcChute"]) {
    const n = src.split(new RegExp(`\\n\\s+${cle}: `)).length - 1;
    assert.equal(n, 6, `${cle} : ${n} occurrences au lieu de 6 (le type + 5 langues)`);
  }
});

console.log("\nLA SUITE ELLE-MÊME — un test non enregistré ne tourne jamais");

test("tous les fichiers de test sont dans la chaîne npm test", () => {
  // La chaîne est écrite à la main dans package.json : un fichier oublié reste vert
  // pour toujours sans que personne le sache. Ce garde-fou-ci l'aurait attrapé.
  const chaine = JSON.parse(readFileSync("package.json", "utf8")).scripts.test as string;
  const fichiers = readdirSync("tests").filter((f) => f.endsWith(".test.ts"));
  const oublies = fichiers.filter((f) => !chaine.includes(`tests/${f}`));
  assert.deepEqual(oublies, [], `test(s) jamais exécuté(s) : ${oublies.join(", ")}`);
  assert.ok(fichiers.length >= 30, `${fichiers.length} fichiers seulement : la suite a-t-elle été amputée ?`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
