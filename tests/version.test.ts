/**
 * TAMPON DE VERSION — garde-fous d'un défaut de PROCÉDURE, pas de code.
 *
 * Le 04/09/2026, le correctif de sécurité du journal d'erreurs était écrit, testé,
 * commité et poussé sur GitHub — et absent de la production. `git push` ne déploie
 * rien ici. L'écart n'était visible nulle part : il a fallu envoyer un corps de 20 Ko
 * à la route en ligne, constater qu'il était accepté et stocké entier, pour découvrir
 * que la production tournait encore sur l'ancien code.
 *
 * Ces tests protègent le mécanisme qui rend l'écart visible.
 */
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tamponner, commitLocal, commitHebergeur } from "../scripts/version";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ver-")), "version.json");

test("le tampon écrit le commit courant quand git répond", () => {
  const f = tmp();
  const r = tamponner(f, { commit: "abc1234", date: "2026-09-04T11:45:57+02:00", source: "git" });
  assert.equal(r, "ecrit");
  const j = JSON.parse(fs.readFileSync(f, "utf8")) as { commit: string; date: string };
  assert.equal(j.commit, "abc1234");
  assert.equal(j.date, "2026-09-04T11:45:57+02:00");
});

test("SANS dépôt git, le tampon existant est PRÉSERVÉ, jamais remplacé", () => {
  // ⚠️ LE PIÈGE CENTRAL. Vercel reconstruit sur SA machine, à partir du disque
  // téléversé, où il n'y a pas de dépôt git. Si le tampon s'écrasait alors avec une
  // valeur de repli (« inconnu », la date du jour, une chaîne vide), la production
  // s'auto-déclarerait sans version et la comparaison ne pourrait PLUS JAMAIS
  // signaler un retard : le garde-fou serait désarmé exactement là où il sert.
  const f = tmp();
  fs.writeFileSync(f, JSON.stringify({ commit: "2016650", date: "2026-09-04T11:45:57+02:00" }));
  const r = tamponner(f, null);
  assert.equal(r, "preserve", "le tampon a été réécrit alors que git était absent");
  const j = JSON.parse(fs.readFileSync(f, "utf8")) as { commit: string };
  assert.equal(j.commit, "2016650", "le commit déployé a été écrasé par un repli");
});

test("la machine qui CONSTRUIT a le dernier mot sur le dépôt local", () => {
  // ⚠️ CE N'EST PAS UNE PRÉFÉRENCE DE STYLE, C'EST LE DÉFAUT CONSTATÉ LE 04/09/2026.
  // Le tampon n'était écrit que par `prebuild`, en local : construire, PUIS commiter,
  // PUIS déployer sans reconstruire téléverse un disque portant l'ancien tampon. Vercel
  // rebâtit sans dépôt git, donc le préserve — et `npm run enligne` a annoncé « la
  // production est en retard » alors que le bon code était en ligne. Un vérificateur
  // qui crie au loup s'apprend à être ignoré.
  const v = commitHebergeur({ VERCEL_GIT_COMMIT_SHA: "0123456789abcdef0123456789abcdef01234567" });
  assert.equal(v?.commit, "0123456");
  assert.equal(v?.source, "vercel");

  // Et une valeur qui n'est pas un commit ne doit RIEN tamponner : mieux vaut retomber
  // sur le dépôt local que publier un identifiant inventé.
  for (const faux of ["", "   ", "HEAD", "refs/heads/main", "zzzzzzz", "abc"]) {
    assert.equal(commitHebergeur({ VERCEL_GIT_COMMIT_SHA: faux }), null, `« ${faux} » a été accepté comme commit`);
  }

  // ⚠️ ET L'ORDRE DOIT TENIR DANS `tamponner` LUI-MÊME, pas seulement dans les briques :
  // c'est la source par défaut qui décide de ce qui part en ligne. Ici, un dépôt git est
  // bel et bien présent — c'est donc l'hébergeur qui doit l'emporter.
  const avant = process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    process.env.VERCEL_GIT_COMMIT_SHA = "fedcba9876543210fedcba9876543210fedcba98";
    const f = tmp();
    tamponner(f);
    const j = JSON.parse(fs.readFileSync(f, "utf8")) as { commit: string; source: string };
    assert.equal(j.source, "vercel", "le dépôt local a pris le pas sur la machine de build");
    assert.equal(j.commit, "fedcba9", "ce n'est pas le commit annoncé par la machine de build");
  } finally {
    if (avant === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = avant;
  }
});

test("le tampon dit d'où il vient", () => {
  // Sans `source`, une date de CONSTRUCTION passerait pour une date de COMMIT : deux
  // faits différents sous le même nom.
  const f = tmp();
  tamponner(f, { commit: "abc1234", date: "2026-09-04T00:00:00Z", source: "vercel" });
  const j = JSON.parse(fs.readFileSync(f, "utf8")) as { source?: string };
  assert.equal(j.source, "vercel", "le tampon ne dit pas d'où vient son chiffre");
});

test("le tampon est bien accroché au build, sinon il ne part jamais en ligne", () => {
  // Un script que personne n'appelle ne tamponne rien : la production n'aurait pas de
  // version.json et `npm run enligne` répondrait « impossible de conclure » à vie.
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as
    { scripts: Record<string, string> };
  assert.ok(/scripts\/version\.ts/.test(pkg.scripts.prebuild ?? ""),
    "« prebuild » n'appelle pas scripts/version.ts");
  assert.ok(/scripts\/enligne\.ts/.test(pkg.scripts.enligne ?? ""),
    "« enligne » n'appelle pas scripts/enligne.ts");
  // Le déploiement doit passer par la vérification ET par une construction fraîche :
  // c'est l'ordre « construire puis commiter puis déployer » qui avait produit le
  // tampon périmé.
  const d = pkg.scripts.deploie ?? "";
  assert.ok(/npm run verify/.test(d) && /npm run build/.test(d) && /vercel/.test(d),
    "« deploie » ne chaîne pas vérification, construction et mise en ligne");
});

test("le tampon livré avec le dépôt est lisible et daté", () => {
  const f = path.join(process.cwd(), "public", "version.json");
  assert.ok(fs.existsSync(f), "public/version.json manque : rien à téléverser");
  const j = JSON.parse(fs.readFileSync(f, "utf8")) as { commit: string; date: string };
  assert.ok(/^[0-9a-f]{7,40}$/.test(j.commit), `commit illisible : ${j.commit}`);
  assert.ok(!Number.isNaN(Date.parse(j.date)), `date illisible : ${j.date}`);
});

test("le tampon n'est pas ignoré par git", () => {
  // ⚠️ `vercel deploy` téléverse le DISQUE : un fichier ignoré partirait quand même en
  // ligne, mais disparaîtrait d'un clone frais — et le prochain build le régénérerait
  // avec le commit du moment, donc « à jour » quoi qu'il arrive.
  const ign = fs.readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");
  for (const l of ign.split("\n").map((x) => x.trim())) {
    if (!l || l.startsWith("#")) continue;
    assert.ok(!/^\/?public\/version\.json$/.test(l) && l !== "public" && l !== "/public",
      `.gitignore exclut le tampon : « ${l} »`);
  }
});

test("git rendu réellement, quand il est là", () => {
  const v = commitLocal();
  if (v === null) return; // machine sans dépôt : rien à prouver ici
  assert.ok(/^[0-9a-f]{7,40}$/.test(v.commit), `commit illisible : ${v.commit}`);
  assert.ok(!Number.isNaN(Date.parse(v.date)), `date illisible : ${v.date}`);
});

// ── `npm run enligne` : la production peut être EN AVANCE sur l'arbre local ──────────────
// ⚠️ 15/10/2026 : pacevo.fr servait 1dd3aa0 pendant que le `main` local restait à b63685c,
// un de ses ancêtres. Le script annonçait « en retard / 0 commit » et proposait de
// déployer : l'avoir suivi aurait retiré du site le correctif en ligne.
//
// Importé APRÈS avoir neutralisé le réseau : si l'appel de main() n'était plus gardé,
// l'import interrogerait la vraie production.
let appelsReseau = 0;
const fetchReel = globalThis.fetch;
globalThis.fetch = (async () => { appelsReseau++; throw new Error("réseau interdit dans les tests"); }) as typeof fetch;
const { comparer, bilan } = require("../scripts/enligne") as typeof import("../scripts/enligne");
globalThis.fetch = fetchReel;

/** Un dépôt git jetable : A ← B sur main (HEAD = B), et C ← A sur une autre branche. */
function depotJetable() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "enligne-"));
  const git = (...a: string[]) => execFileSync("git", [
    "-c", "user.name=Test", "-c", "user.email=test@exemple.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...a,
  ], { cwd: dir, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  git("init", "-q", "-b", "main");
  git("commit", "-q", "--allow-empty", "-m", "A");
  const A = git("rev-parse", "HEAD");
  git("commit", "-q", "--allow-empty", "-m", "B correctif en ligne");
  const B = git("rev-parse", "HEAD");
  git("checkout", "-q", "-b", "autre", A);
  git("commit", "-q", "--allow-empty", "-m", "C ailleurs");
  const C = git("rev-parse", "HEAD");
  git("checkout", "-q", "main");
  return { dir, git, A, B, C };
}

test("enligne : une production EN AVANCE ne passe jamais pour un retard (cas du 15/10/2026)", () => {
  const d = depotJetable();
  d.git("checkout", "-q", d.A); // ici HEAD = A ; la production sert B, son descendant
  const e = comparer(d.B.slice(0, 7), d.dir);
  assert.equal(e.etat, "en-avance", `état rendu : ${e.etat}`);
  if (e.etat === "en-avance") {
    assert.equal(e.absents.length, 1, "le commit en ligne absent d'ici n'est pas listé");
    assert.equal(e.aDeployer.length, 0, "un commit à déployer est inventé");
  }
  const b = bilan(e, d.B.slice(0, 7), d.A.slice(0, 7), "2026-10-15");
  assert.equal(b.code, 1, "une production en avance doit faire échouer la garde");
  assert.ok(!b.lignes.some((l) => /deploy --prod|vercel@/.test(l)),
    "le script propose de déployer un arbre qui retirerait des commits du site");
  assert.ok(b.lignes.some((l) => /NE PAS déployer/.test(l)), "l'interdiction de déployer n'est pas dite");
});

test("enligne : deux histoires divergentes sont dites comme telles", () => {
  const d = depotJetable(); // HEAD = B ; la production sert C
  const e = comparer(d.C, d.dir);
  assert.equal(e.etat, "en-avance", `état rendu : ${e.etat}`);
  if (e.etat === "en-avance") {
    assert.equal(e.absents.length, 1);
    assert.equal(e.aDeployer.length, 1, "le commit d'ici non déployé n'est pas compté");
  }
  assert.ok(bilan(e, d.C, d.B, "").lignes.some((l) => /divergé/.test(l)), "la divergence n'est pas dite");
});

test("enligne : un vrai retard propose toujours de déployer", () => {
  const d = depotJetable(); // HEAD = B ; la production sert A
  const e = comparer(d.A, d.dir);
  assert.equal(e.etat, "en-retard", `état rendu : ${e.etat}`);
  if (e.etat === "en-retard") assert.equal(e.aDeployer.length, 1);
  const b = bilan(e, d.A, d.B, "");
  assert.equal(b.code, 1);
  assert.ok(b.lignes.some((l) => /vercel@54\.14\.0 deploy --prod/.test(l)), "le retard ne dit plus comment déployer");
});

test("enligne : identique à HEAD, ou commit servi inconnu", () => {
  const d = depotJetable();
  assert.equal(comparer(d.B, d.dir).etat, "identique");
  assert.equal(comparer(d.B.slice(0, 7), d.dir).etat, "identique", "un commit abrégé égal à HEAD n'est pas reconnu");
  assert.equal(bilan({ etat: "identique" }, "abc1234", "abc1234", "2026-10-15").code, 0);
  assert.equal(comparer("deadbee", d.dir).etat, "inconnu");
  const b = bilan({ etat: "inconnu" }, "deadbee", "abc1234", "");
  assert.equal(b.code, 1);
  assert.ok(!b.lignes.some((l) => /deploy --prod/.test(l)), "un commit inconnu invite à déployer");
});

test("enligne : une valeur venue de version.json n'est jamais exécutée ni prise pour une référence", () => {
  const d = depotJetable();
  const temoin = path.join(d.dir, "PIRATE");
  for (const v of [`abc1234; touch ${temoin}`, `$(touch ${temoin})`, "HEAD", "main", ""]) {
    assert.equal(comparer(v, d.dir).etat, "inconnu", `« ${v} » a été accepté comme commit`);
  }
  assert.ok(!fs.existsSync(temoin), "une valeur de version.json a été exécutée par le shell");
});

test("enligne : importer le script n'interroge pas la production, et main() passe par la comparaison", () => {
  assert.equal(appelsReseau, 0, "l'import a lancé main() : l'appel n'est plus gardé");
  const src = fs.readFileSync("scripts/enligne.ts", "utf8");
  assert.ok(/bilan\(comparer\(deploye\)/.test(src), "main() ne passe plus par comparer() et bilan()");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
