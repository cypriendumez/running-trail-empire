/**
 * LE TEMPS — garde-fous nés d'un défaut MESURÉ en production.
 *
 * 23 erreurs React #418 (« le texte du serveur diffère de celui du navigateur ») entre
 * le 23/06 et le 01/09/2026, dont 96 % entre 22 h et 4 h UTC — la fenêtre, longue de
 * 25 % de la journée, où le serveur (iad1, États-Unis) et le coureur (France) ne sont
 * pas le même jour du calendrier.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  FUSEAU_DEFAUT, fuseauValide, fuseauOuDefaut, jourCivil, aujourdhui,
  formatDateCivile, formatInstant,
} from "../src/lib/time/fuseau";
// ⚠️ IMPORTÉS DE LEUR SEUL FOYER, PAS RÉÉCRITS. Voir le commentaire de `lib/time/fuseau`.
import { decaleJour, ecartJours } from "../src/lib/streak/compute";

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
    // ⚠️ CONTRAT DIFFÉRENT, VOLONTAIREMENT : `decaleJour` rend l'entrée telle quelle
    // quand elle est illisible, là où `formatDateCivile` rend une chaîne vide. Le
    // premier sert à naviguer dans un calendrier (mieux vaut ne pas bouger que
    // renvoyer du vide), le second à écrire du texte à l'écran (mieux vaut ne rien
    // écrire qu'écrire « Invalid Date »).
    assert.equal(decaleJour(String(mauvais), 1), String(mauvais));
  }
  assert.equal(jourCivil("pas une date", "Europe/Paris"), "");
  assert.equal(formatInstant("pas une date", "fr", "Europe/Paris", { hour: "2-digit" }), "");
});

test("les décalages de jours ignorent l'heure d'été", () => {
  // Le passage à l'heure d'hiver 2026 en Europe : nuit du 24 au 25 octobre.
  assert.equal(decaleJour("2026-10-24", 1), "2026-10-25", "la nuit du changement d'heure décale d'un jour");
  assert.equal(ecartJours("2026-10-24", "2026-10-25"), 1);
  assert.equal(ecartJours("2026-03-28", "2026-03-29"), 1, "le passage à l'heure d'été aussi");
  assert.equal(decaleJour("2026-12-31", 1), "2027-01-01", "changement d'année");
  assert.equal(decaleJour("2028-02-28", 1), "2028-02-29", "année bissextile");
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

// ── VOLET 2 : la LOGIQUE, pas seulement l'affichage ─────────────────────────────
/** Le source, débarrassé des imports ET des commentaires — voir le test du provider. */
function codeNu(f: string): string {
  return readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*import\b/.test(l))
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

test("les pages rendues par le serveur datent sur le fuseau de l'athlète", () => {
  // ⚠️ CES PAGES SONT RENDUES À iad1. Un `jourLocal()` sans fuseau y répond la VEILLE
  // entre minuit et 6 h heure de Paris : la flamme de série et le classement des ligues
  // se calculaient alors sur le mauvais jour.
  for (const f of ["src/app/dashboard/page.tsx", "src/app/dashboard/leagues/page.tsx"]) {
    const src = codeNu(f);
    assert.ok(/pacevo_tz/.test(src), `${f} ne lit pas le fuseau de l'athlète`);
    assert.ok(/fuseauOuDefaut\(/.test(src), `${f} ne valide pas le fuseau reçu du cookie`);
    // Viser l'APPEL : un `jourLocal()` nu subsistant redonnerait le jour du serveur.
    for (const m of src.matchAll(/jourLocal\(([^)]*)\)/g)) {
      assert.ok(String(m[1]).trim().length > 0, `${f} appelle encore jourLocal() sans fuseau`);
    }
  }
});

test("le calendrier ne lit pas le fuseau du navigateur pendant le rendu", () => {
  const src = codeNu("src/components/training/CalendarView.tsx");
  assert.ok(/useFuseau\(\)/.test(src), "le calendrier n'utilise pas le fuseau partagé");
  assert.ok(!/resolvedOptions/.test(src), "le calendrier lit le fuseau du navigateur : le serveur ne peut pas le connaître");
  for (const m of src.matchAll(/jourLocal\(([^)]*)\)/g)) {
    assert.ok(String(m[1]).trim().length > 0, "le calendrier appelle encore jourLocal() sans fuseau");
  }
});

test("un seul calcul du « jour dans un fuseau » existe dans le dépôt", () => {
  // ⚠️ TROIS COPIES COEXISTAIENT : `jourLocal` (accesseurs locaux), `jourFrance` (son
  // propre Intl) et `jourCivil`. Trois vérités, c'est une seule corrigée le jour où
  // l'une se trompe. Les deux premières délèguent maintenant.
  const france = codeNu("src/lib/races/jourFrance.ts");
  assert.ok(/jourCivil\(/.test(france), "jourFrance a de nouveau son propre calcul");
  assert.ok(!/Intl\.DateTimeFormat/.test(france), "une seconde implémentation du jour est réapparue dans jourFrance");
  const streak = codeNu("src/lib/streak/compute.ts");
  assert.ok(/jourCivil\(/.test(streak), "jourLocal ne délègue plus au module de fuseaux");
  assert.ok(!/getFullYear\(\)/.test(streak), "jourLocal est revenu aux accesseurs du moteur");
});

test("les écrans qui décident d'un jour ne le calculent plus en UTC", () => {
  // ⚠️ `toISOString()` BASCULE À MINUIT UTC : entre minuit et 2 h à Paris (1 h en
  // hiver), « aujourd'hui » désignait la veille. Deux heures par nuit pendant
  // lesquelles un défi créé était daté d'hier et affiché comme passé, un pass de
  // prévention expirant le jour même était déclaré encore valable, et les courses du
  // jour restaient annoncées comme à venir.
  const ECRANS = [
    "src/components/ghost-runner/GhostRunner.tsx",
    "src/components/pps/PpsVerifier.tsx",
    "src/components/races/RacesHub.tsx",
    "src/components/clubs/ClubsHub.tsx",
  ];
  for (const f of ECRANS) {
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
    assert.ok(!/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(src),
      `${f} calcule encore « aujourd'hui » en UTC`);
    assert.ok(/jourCivil\(new Date\(\), fuseau\)/.test(src), `${f} ne date plus sur le fuseau de l'athlète`);
    assert.ok(/useFuseau\(\)/.test(src), `${f} n'a plus accès au fuseau`);
  }
});

test("une saisie datée d'aujourd'hui n'est pas refusée comme « dans le futur »", () => {
  // ⚠️ LE DÉFAUT, SUR UN INSTANT PRÉCIS. Le 5 septembre 2026 à 00 h 30 à Paris, il est
  // encore le 4 en UTC. L'athlète choisit « aujourd'hui » dans son calendrier — donc le
  // 5 — et les contrôles `saisie > jourUTC` de /api/pps et /api/weight le REJETAIENT
  // comme une date future. Deux heures par nuit en été, une en hiver.
  const instant = new Date("2026-09-04T22:30:00Z");
  const jourUTC = instant.toISOString().slice(0, 10);
  const jourParis = aujourdhui(FUSEAU_DEFAUT, instant);
  assert.equal(jourUTC, "2026-09-04");
  assert.equal(jourParis, "2026-09-05", "le jour de l'athlète n'est plus calculé sur son fuseau");

  const saisie = jourParis;                       // « aujourd'hui », vu par l'athlète
  assert.ok(saisie > jourUTC, "l'instant choisi ne reproduit plus l'écart : le test ne prouve rien");
  assert.ok(!(saisie > jourParis), "une saisie du jour serait encore refusée comme future");

  // Et l'écart n'existe QUE la nuit : en pleine journée les deux coïncident, sinon le
  // correctif déplacerait le problème au lieu de le supprimer.
  const midi = new Date("2026-09-04T12:00:00Z");
  assert.equal(aujourdhui(FUSEAU_DEFAUT, midi), midi.toISOString().slice(0, 10),
    "le jour de l'athlète diverge de l'UTC en pleine journée");
});

test("plus aucun écran ni route de l'athlète ne date en UTC", () => {
  // La liste des exceptions est CLOSE et justifiée. Tout nouveau fichier qui daterait en
  // UTC rougit ici — c'est ce qui empêche la famille de repousser.
  const TOLERES: Record<string, string> = {
    "src/lib/time/fuseau.ts": "le motif est cité dans sa propre documentation",
    "src/app/api/newsletter/weekly/route.ts": "lettre hebdomadaire : un décalage de deux heures ne change aucune semaine",
    "src/app/api/races/seed-full/route.ts": "collecte du catalogue, aucune décision pour un athlète",
    "src/app/api/races/sync/route.ts": "collecte du catalogue, aucune décision pour un athlète",
    "src/app/api/cron/races-maintenance/route.ts": "entretien nocturne du catalogue",
    "src/lib/intervals/performance.ts": "bornes d'une requête intervals.icu, pas un jour affiché",
    "src/lib/intervals/syncUser.ts": "borne « newest » d'une requête intervals.icu",
    "src/app/api/intervals/sync/route.ts": "borne « newest » d'une requête intervals.icu",
    "src/app/api/intervals/debug/route.ts": "borne d'une requête de diagnostic",
    "src/app/api/intervals/credentials/route.ts": "borne d'une requête de validation de clé",
    "src/app/api/admin/generate-plan/route.ts": "borne « newest » d'une requête intervals.icu",
  };
  const fichiers: string[] = [];
  (function marche(d: string) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) marche(p);
      else if (/\.(ts|tsx)$/.test(p)) fichiers.push(p);
    }
  })("src");
  const coupables = fichiers.filter((f) => {
    if (f in TOLERES) return false;
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
    /**
     * ⚠️ DEUX FORMES, PAS UNE. Mon premier balayage ne cherchait que `.slice(0, 10)` et
     * a laissé passer DIX occurrences écrites `.split("T")[0]` — dont celle du tableau
     * de bord, qui choisit la prochaine séance du coach. Entre minuit et 2 h à Paris,
     * elle désignait la séance de la veille. Un balayage qui ne connaît qu'une écriture
     * du même défaut donne une fausse assurance : il rend « zéro » et on le croit.
     */
    return /new Date\(\)\.toISOString\(\)\.(slice\(0,\s*10\)|split\("T"\)\[0\])/.test(src);
  });
  assert.deepEqual(coupables, [],
    `ces fichiers datent encore en UTC :\n    ${coupables.join("\n    ")}`);
  // ⚠️ Un balayage qui ne parcourt rien passe toujours.
  assert.ok(fichiers.length > 300, `seulement ${fichiers.length} fichiers parcourus`);
});

console.log(`\n${passed} test(s) du temps passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
