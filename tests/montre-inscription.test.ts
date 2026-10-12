/**
 * L'ÉTAPE MONTRE DU QUESTIONNAIRE, PAR MARQUE (12/10/2026).
 *
 * Demande de Cyprien : proposer les marques de montre, parce que l'Apple Watch demande
 * d'installer une autre application, et que le client doit pouvoir brancher sa montre
 * « très très rapidement ». Ce qui est garanti ici :
 *  · on choisit sa marque, et l'Apple Watch a son propre chemin (app iPhone + QR code) ;
 *  · Polar dit la vérité : ses sorties arrivent, aucune séance ne part vers la montre ;
 *  · UN SEUL code à coller : l'Athlete ID se lit sur la clé (`GET /athlete/0`) ;
 *  · chaque texte existe dans les cinq langues.
 *
 *   npx tsx tests/montre-inscription.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { compteDeLaCle } from "../src/lib/intervals/compteDeLaCle";
import { MARQUES, APP_STORE_COMPANION, marqueDe } from "../src/app/onboarding/marquesMontre";
import { OB } from "../src/app/onboarding/onboardingI18n";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
// Commentaires retirés SANS couper sur `://` (sinon une URL disparaît du code lu).
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/** Un faux `fetch` : répond `status` + `corps`, et retient l'adresse appelée. */
function fauxFetch(status: number, corps: unknown, appels: string[] = []): typeof fetch {
  return (async (url: string | URL | Request) => {
    appels.push(String(url));
    return new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

async function main() {
  console.log("\nLA CLÉ SEULE DÉSIGNE LE COMPTE");

  await test("sans identifiant, on interroge /athlete/0 et on récupère l'identifiant et le nom", async () => {
    const appels: string[] = [];
    const r = await compteDeLaCle("cle0123456789abcdef", null, fauxFetch(200, { id: "i564686", name: "Paul" }, appels));
    assert.deepEqual(r, { ok: true, athleteId: "i564686", nom: "Paul" });
    assert.match(appels[0], /\/api\/v1\/athlete\/0$/);
  });

  await test("un identifiant saisi (page Sync Montre) est celui qu'on interroge", async () => {
    const appels: string[] = [];
    await compteDeLaCle("cle0123456789abcdef", "i42", fauxFetch(200, { id: "i42", name: null }, appels));
    assert.match(appels[0], /\/athlete\/i42$/);
  });

  await test("clé refusée (401) : un code que l'écran sait traduire, jamais un succès", async () => {
    const r = await compteDeLaCle("mauvaise", null, fauxFetch(401, {}));
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.code, "cle_refusee");
    assert.equal(!r.ok && r.status, 422);
  });

  await test("intervals.icu injoignable : « indisponible », pas une clé « invalide »", async () => {
    const enPanne = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    const r = await compteDeLaCle("cle0123456789abcdef", null, enPanne);
    assert.equal(!r.ok && r.code, "indisponible");
    assert.equal(!r.ok && r.status, 503);
  });

  await test("panne 5xx : on enregistre avec l'identifiant SAISI, jamais sans en avoir un", async () => {
    const avec = await compteDeLaCle("cle0123456789abcdef", "i42", fauxFetch(502, {}));
    assert.deepEqual(avec, { ok: true, athleteId: "i42", nom: null });
    const sans = await compteDeLaCle("cle0123456789abcdef", null, fauxFetch(502, {}));
    assert.equal(!sans.ok && sans.code, "indisponible");
  });

  await test("une réponse sans identifiant valide n'est jamais enregistrée", async () => {
    for (const corps of [{}, { id: 564686 }, { id: "abc" }, { id: "" }, null]) {
      const r = await compteDeLaCle("cle0123456789abcdef", null, fauxFetch(200, corps));
      assert.equal(!r.ok && r.code, "reponse_invalide", JSON.stringify(corps));
    }
  });

  await test("la route n'exige plus l'Athlete ID et rend le nom du compte", () => {
    const src = code("src/app/api/intervals/credentials/route.ts");
    assert.ok(!/if \(!athleteId \|\| !apiKey\)/.test(src), "la route exige encore l'Athlete ID");
    assert.ok(/await compteDeLaCle\(apiKey, idSaisi \|\| null\)/.test(src), "la route ne déduit plus le compte de la clé");
    assert.ok(/NextResponse\.json\(\{ ok: true, athleteId, nom: compte\.nom/.test(src), "la route ne rend plus le nom du compte");
    assert.ok(/code: compte\.code/.test(src), "les refus ne portent plus de code traduisible");
  });

  console.log("\nLES MARQUES — chacune son chemin");

  await test("les identifiants sont uniques et chaque logo existe dans public/", () => {
    assert.equal(new Set(MARQUES.map((m) => m.id)).size, MARQUES.length);
    for (const m of MARQUES) if (m.logo) assert.ok(existsSync(`public${m.logo}`), `logo absent : ${m.logo}`);
  });

  await test("l'Apple Watch passe par l'app iPhone, les autres par la page Connexions", () => {
    assert.equal(marqueDe("apple")?.chemin, "companion");
    for (const id of ["garmin", "coros", "suunto", "polar", "autre"] as const) assert.equal(marqueDe(id)?.chemin, "connexion", id);
    assert.equal(marqueDe("aucune")?.chemin, "aucun");
    assert.equal(APP_STORE_COMPANION, "https://apps.apple.com/app/id6739638454");
  });

  await test("Polar ne promet aucune séance au poignet ; les autres montres, si", () => {
    assert.equal(marqueDe("polar")?.recoit, false);
    for (const id of ["garmin", "apple", "coros", "suunto", "autre"] as const) assert.equal(marqueDe(id)?.recoit, true, id);
    const src = code("src/app/onboarding/EtapeMontre.tsx");
    assert.ok(/\.\.\.\(m\.recoit \? \[tr\("w1Perm4"\)\] : \[\]\)/.test(src), "la case « envoyer les entraînements » s'affiche aussi pour Polar");
    assert.ok(/\{!m\.recoit && \([\s\S]{0,200}tr\("mPolar"\)/.test(src), "Polar ne dit plus que la montre ne reçoit pas les séances");
  });

  console.log("\nL'ÉCRAN — un seul code, un QR code pour l'iPhone");

  await test("le questionnaire n'envoie que la clé, et n'a plus de champ Athlete ID", () => {
    const src = code("src/app/onboarding/EtapeMontre.tsx");
    assert.ok(/body: JSON\.stringify\(\{ apiKey: cleNette \}\)/.test(src), "le questionnaire envoie autre chose que la clé seule");
    assert.ok(!/athleteId|Athlete ID|w3IdNote/.test(src), "un champ Athlete ID est revenu dans l'étape Montre");
    assert.ok(!/watchAthleteId|w3IdNote/.test(code("src/app/onboarding/page.tsx")), "la page garde un reste de l'ancien formulaire à deux codes");
  });

  await test("l'Apple Watch a un bouton App Store ET un QR code (ordinateur seulement)", () => {
    const src = code("src/app/onboarding/EtapeMontre.tsx");
    assert.ok(/<QrSvg texte=\{APP_STORE_COMPANION\}/.test(src), "le QR code ne mène plus à l'app");
    assert.ok(/hidden items-center gap-3 sm:flex">\s*<QrSvg/.test(src), "le QR code s'affiche aussi sur téléphone, où il ne sert à rien");
    for (const k of ["mApple1", "mApple2", "mApple3", "mApple4"]) assert.ok(src.includes(`tr("${k}")`), `réglage Companion absent : ${k}`);
  });

  await test("la page délègue l'étape à EtapeMontre et propose « Terminer » sans montre", () => {
    const src = code("src/app/onboarding/page.tsx");
    assert.ok(/<EtapeMontre tr=\{tr\} cid=\{cid\} marque=\{marque\}/.test(src), "la page n'affiche plus l'étape par marque");
    assert.ok(/watchSaved \|\| marque === "aucune" \? \(/.test(src), "« Je n'ai pas de montre » ne mène plus à « Terminer »");
    // Une phrase peut citer deux fois la même variable (« ton compte {m} ») : toutes remplacées.
    assert.ok(/s\.split\(`\{\$\{key\}\}`\)\.join\(String\(v\[key\]\)\)/.test(src), "tr() ne remplace plus qu'une occurrence");
  });

  await test("l'envoi Apple Watch est expliqué AVANT et APRÈS la connexion, avec la recette d'automatisation", () => {
    // Cyprien, 12/10/2026 : « est-ce que tu lui expliques bien ça ? » — la séance ne part que
    // quand l'app Companion tourne, iPhone déverrouillé. Une phrase grise en fin de parcours
    // ne suffisait pas.
    const src = code("src/app/onboarding/EtapeMontre.tsx");
    const i2b = src.indexOf('m.chemin === "companion" && (');
    const iBouton = src.indexOf('tr("w1Done")', i2b);
    const iEncadre = src.indexOf('tr("mAppleEnvoiTitre")', i2b);
    assert.ok(i2b > 0 && iEncadre > i2b && iEncadre < iBouton, "l'encadré « c'est l'app qui envoie tes séances » n'est plus dans l'étape Apple, avant « C'est fait »");
    for (const k of ["mAppleEnvoiTxt", "mAuto1", "mAuto2", "mAuto3", "mAuto4"]) assert.ok(src.includes(`tr("${k}")`), `${k} n'est plus affiché`);
    assert.ok(/m\.chemin === "companion" && \(\s*<p[^>]*>\{tr\("mAppleApres"\)\}/.test(src), "le rappel après la connexion a disparu");
  });

  await test("le déclencheur porte le nom EXACT qu'Apple lui donne, dans chaque langue", () => {
    // Relevés sur support.apple.com (guide Raccourcis, déclencheurs) le 12/10/2026.
    const NOMS: Record<string, string> = {
      fr: "Exercice Apple Watch", en: "Apple Watch Workout", de: "Apple Watch-Training",
      es: "Entreno con el Apple Watch", pt: "Treino com o Apple Watch",
    };
    const sync = readFileSync("src/app/dashboard/sync/syncI18n.tsx", "utf8");
    const lignesSync = sync.split("\n").filter((l) => l.includes('"s1.appleEnvoi": '));
    assert.equal(lignesSync.length, 5, "« s1.appleEnvoi » manque dans une langue de la page Sync Montre");
    for (const [lang, nom] of Object.entries(NOMS)) {
      assert.ok(OB[lang as keyof typeof OB].mAuto2.includes(nom), `${lang} : le questionnaire ne nomme pas « ${nom} »`);
      assert.ok(lignesSync.some((l) => l.includes(nom)), `${lang} : la page Sync Montre ne nomme pas « ${nom} »`);
    }
    assert.ok(/\{d\["s1\.appleEnvoi"\]\}/.test(code("src/app/dashboard/sync/page.tsx")), "la page Sync Montre n'affiche plus la recette");
    assert.ok(readFileSync("src/data/helpKb.ts", "utf8").includes("Ma séance Apple Watch n'arrive pas dans l'app"), "l'assistant ne sait plus répondre");
  });

  console.log("\nLES TEXTES — cinq langues, aucune clé orpheline");

  await test("chaque texte de l'étape existe dans les cinq langues, variables comprises", () => {
    const src = code("src/app/onboarding/EtapeMontre.tsx");
    const cles = [...new Set([...src.matchAll(/tr\(\s*"([A-Za-z0-9]+)"/g)].map((m) => m[1]))];
    // Les clés choisies à la volée : tr(x.id === "autre" ? "mAutre" : "mAucune").
    for (const k of ["mAutre", "mAucune"]) if (!cles.includes(k)) cles.push(k);
    assert.ok(cles.length > 30, `seulement ${cles.length} clés relevées : le relevé est cassé`);
    for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
      for (const k of cles) {
        const v = OB[lang][k];
        assert.ok(typeof v === "string" && v.trim(), `${lang}.${k} manque`);
        for (const variable of ["{m}", "{nom}"]) {
          assert.equal(v.split(variable).length, OB.fr[k].split(variable).length, `${lang}.${k} : ${variable} mal recopiée`);
        }
      }
    }
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main();
