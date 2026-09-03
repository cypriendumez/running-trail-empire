/**
 * LE TEMPS — garde-fous nés d'un défaut MESURÉ en production.
 *
 * 23 erreurs React #418 (« le texte du serveur diffère de celui du navigateur ») entre
 * le 23/06 et le 01/09/2026, dont 96 % entre 22 h et 4 h UTC — la fenêtre, longue de
 * 25 % de la journée, où le serveur (iad1, États-Unis) et le coureur (France) ne sont
 * pas le même jour du calendrier.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  FUSEAU_DEFAUT, fuseauValide, fuseauOuDefaut, jourCivil, aujourdhui,
  formatDateCivile, formatInstant, decalerJour, ecartJours,
} from "../src/lib/time/fuseau";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

// L'instant exact du défaut : 4 septembre 2026, 00 h 30 à Paris.
const NUIT = new Date("2026-09-03T22:30:00Z");

test("le jour du coureur n'est pas le jour du serveur américain", () => {
  assert.equal(jourCivil(NUIT, "Europe/Paris"), "2026-09-04", "le coureur parisien est déjà le 4");
  assert.equal(jourCivil(NUIT, "America/New_York"), "2026-09-03", "le serveur, lui, est encore le 3");
  // C'est exactement ce que renvoyait `toISOString().slice(0, 10)`, utilisé à 64 endroits.
  assert.equal(NUIT.toISOString().slice(0, 10), "2026-09-03");
  assert.notEqual(jourCivil(NUIT, "Europe/Paris"), NUIT.toISOString().slice(0, 10),
    "le jour UTC et le jour de l'athlète doivent pouvoir diverger, sinon le test ne prouve rien");
});

test("les DOM-TOM ne sont pas Paris", () => {
  // ⚠️ POURQUOI ON NE FIGE PAS « Europe/Paris ». Le site se vend partout en France.
  assert.equal(jourCivil(NUIT, "Indian/Reunion"), "2026-09-04");
  assert.equal(jourCivil(NUIT, "America/Guadeloupe"), "2026-09-03", "la Guadeloupe est encore la veille");
  assert.equal(jourCivil(new Date("2026-09-03T13:00:00Z"), "Pacific/Noumea"), "2026-09-04",
    "la Nouvelle-Calédonie est déjà le lendemain");
});

test("une date civile s'écrit pareil partout — c'est le cœur du correctif", () => {
  // Une course le 3 septembre a lieu le 3 septembre, à Brest comme à Nouméa. Le texte
  // rendu par le serveur et par le navigateur DOIT être identique, sinon React #418.
  const attendu = formatDateCivile("2026-09-03", "fr");
  assert.ok(attendu.includes("3"), `date civile illisible : ${attendu}`);
  // ⚠️ LA PREUVE, PAS L'INTENTION : on relance la fonction dans un processus réglé sur
  // un fuseau à l'ouest de Greenwich. C'est la situation exacte du serveur de production
  // (iad1). Si la sortie diffère de celle obtenue ici, le texte du serveur diffère de
  // celui du navigateur — et React #418 revient.
  const ailleurs = execFileSync("npx", ["--yes", "tsx", "-e",
    'import { formatDateCivile } from "./src/lib/time/fuseau"; process.stdout.write(formatDateCivile("2026-09-03", "fr"));'],
    { env: { ...process.env, TZ: "America/Los_Angeles" }, encoding: "utf8" });
  assert.equal(ailleurs, attendu,
    `sous TZ=America/Los_Angeles la date s'écrit « ${ailleurs} » au lieu de « ${attendu} »`);
  // Et l'ancrage à MIDI est ce qui l'empêche de basculer d'un jour.
  assert.equal(jourCivil(new Date("2026-09-03T12:00:00Z"), "America/Los_Angeles"), "2026-09-03");
  assert.equal(jourCivil(new Date("2026-09-03T00:00:00Z"), "America/Los_Angeles"), "2026-09-02",
    "ancrée à minuit, la date bascule dès qu'on regarde depuis l'ouest — c'est l'ancien défaut");
});

test("un instant s'écrit dans le fuseau du coureur", () => {
  const paris = formatInstant(NUIT, "fr", "Europe/Paris", { hour: "2-digit", minute: "2-digit" });
  const ny = formatInstant(NUIT, "fr", "America/New_York", { hour: "2-digit", minute: "2-digit" });
  assert.notEqual(paris, ny, "l'heure affichée ne dépend pas du fuseau");
  assert.ok(paris.startsWith("00"), `à Paris il est 00 h 30, pas ${paris}`);
});

test("un fuseau venu d'un cookie ne fait pas tomber la page", () => {
  // ⚠️ IL ARRIVE DE L'EXTÉRIEUR. `Intl` lève `RangeError` sur une valeur inconnue — au
  // milieu d'un rendu, cela emporte la page entière.
  for (const mauvais of ["", "   ", "Mars/Olympus", "'; drop table", "Europe/Paris; rm", "x".repeat(200), null, undefined, 42, {}]) {
    assert.equal(fuseauValide(mauvais), false, `« ${String(mauvais)} » est accepté comme fuseau`);
    assert.equal(fuseauOuDefaut(mauvais), FUSEAU_DEFAUT);
    assert.doesNotThrow(() => jourCivil(NUIT, String(mauvais)), `« ${String(mauvais)} » fait lever jourCivil`);
  }
  for (const bon of ["Europe/Paris", "Indian/Reunion", "America/Guadeloupe", "UTC", "Pacific/Noumea"]) {
    assert.equal(fuseauValide(bon), true, `« ${bon} » est refusé à tort`);
  }
});

test("une date invalide rend une chaîne vide, jamais « Invalid Date »", () => {
  for (const mauvais of ["", "pas une date", "2026-13-45", "0000", null, undefined]) {
    assert.equal(formatDateCivile(mauvais as string, "fr"), "", `« ${String(mauvais)} » produit du texte`);
    assert.equal(decalerJour(mauvais as string, 1), "");
  }
  assert.equal(jourCivil("pas une date", "Europe/Paris"), "");
  assert.equal(formatInstant("pas une date", "fr", "Europe/Paris", { hour: "2-digit" }), "");
});

test("les décalages de jours ignorent l'heure d'été", () => {
  // Le passage à l'heure d'hiver 2026 en Europe : nuit du 24 au 25 octobre.
  assert.equal(decalerJour("2026-10-24", 1), "2026-10-25", "la nuit du changement d'heure décale d'un jour");
  assert.equal(ecartJours("2026-10-24", "2026-10-25"), 1);
  assert.equal(ecartJours("2026-03-28", "2026-03-29"), 1, "le passage à l'heure d'été aussi");
  assert.equal(decalerJour("2026-12-31", 1), "2027-01-01", "changement d'année");
  assert.equal(decalerJour("2028-02-28", 1), "2028-02-29", "année bissextile");
  assert.equal(ecartJours("2026-09-03", "2026-09-03"), 0);
  assert.equal(ecartJours("2026-09-04", "2026-09-03"), -1);
});

test("aujourd'hui se calcule pour l'athlète, à un instant injectable", () => {
  assert.equal(aujourdhui("Europe/Paris", NUIT), "2026-09-04");
  assert.equal(aujourdhui("America/Guadeloupe", NUIT), "2026-09-03");
  // Sans instant fourni, le résultat doit rester une date bien formée.
  assert.match(aujourdhui("Europe/Paris"), /^\d{4}-\d{2}-\d{2}$/);
});

test("le fuseau du rendu vient du cookie, jamais du navigateur", () => {
  // ⚠️ LIRE `resolvedOptions()` PENDANT LE RENDU RÉTABLIRAIT LE DÉFAUT : le serveur ne
  // connaît pas cette valeur, il écrirait un autre texte, et #418 reviendrait. Le
  // navigateur ne fait que DÉPOSER le cookie, dans un effet, après le montage.
  // ⚠️ VISER L'APPEL, PAS L'IMPORT. Premier jet : ce test cherchait « useEffect » avant
  // le premier `resolvedOptions` — et le trouvait dans la LIGNE D'IMPORT, en position 50.
  // Il restait donc vert alors que le fuseau était relu pendant le rendu. Trouvé par
  // mutation ; défaut déjà commis plusieurs fois sur ce dépôt.
  // ⚠️ RETIRER LES IMPORTS **ET** LES COMMENTAIRES. Deux faux résultats successifs sur ce
  // seul test : « useEffect » trouvé dans la ligne d'import, puis « resolvedOptions »
  // trouvé dans le COMMENTAIRE qui explique justement qu'on ne doit pas l'appeler là.
  // Un test qui lit la documentation valide la documentation. On coupe sans casser sur
  // le « :// » d'une URL.
  const src = readFileSync("src/lib/time/FuseauProvider.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*import\b/.test(l))
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
  const effet = src.indexOf("useEffect(");
  assert.ok(effet > 0, "le provider n'a plus d'effet : le fuseau réel n'est jamais appris");
  const lectures = [...src.matchAll(/resolvedOptions/g)].map((m) => m.index ?? -1);
  assert.ok(lectures.length > 0, "le fuseau réel n'est plus jamais appris");
  for (const i of lectures) {
    assert.ok(i > effet,
      "resolvedOptions() est lu en dehors de l'effet, donc pendant le rendu — le serveur ne peut pas le connaître et #418 revient");
  }
  assert.ok(/value=\{tz\}/.test(src), "la valeur diffusée n'est plus celle reçue du serveur");
  // Et le layout doit vraiment lire le cookie, pas seulement importer le provider.
  const layout = readFileSync("src/app/dashboard/layout.tsx", "utf8");
  assert.ok(/cookies\(\)\)\.get\("pacevo_tz"\)/.test(layout), "le layout ne lit pas le cookie de fuseau");
  assert.ok(/<FuseauProvider fuseau=\{fuseau\}>/.test(layout), "le fuseau lu n'est pas descendu dans l'arbre");
});

console.log(`\n${passed} test(s) du temps passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
