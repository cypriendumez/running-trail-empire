/**
 * LA CONNEXION intervals.icu EN UN CLIC (OAuth) — figée par des tests (12/10/2026).
 *
 * L'application « Pacevo » (n° 1331) a été approuvée par intervals.icu le 12/10/2026. Ce qui
 * est vérifié ici, et pourquoi :
 *  · l'en-tête : une clé part en `Basic`, un jeton en `Bearer` — un jeton envoyé en `Basic`
 *    répond 401 et ressemble à une panne d'intervals.icu, sans rien signaler ;
 *  · le `state` : contrôlé AVANT l'échange du code, sinon un tiers peut relier le compte
 *    Pacevo d'un athlète à SON compte intervals.icu (séances sur la montre d'un inconnu) ;
 *  · les portées : l'athlète peut en décocher, on doit le voir au lieu d'un 403 plus tard ;
 *  · les secrets : ni le code, ni le secret de l'application, ni le jeton dans un journal.
 *
 *   npx tsx tests/intervals-oauth.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { enteteIntervals, estJetonOAuth, jetonDe, secretOAuth, PREFIXE_OAUTH } from "../src/lib/intervals/auth";
import {
  PORTEES, URL_DECONNEXION, URL_JETON, codeManquantes, configurationOAuth, echangerCode, etatsEgaux,
  lireCookie, lireReponseJeton, nouvelEtat, portesManquantes, revoquer, urlAutorisation, valeurCookie,
  adresseRetour,
} from "../src/lib/intervals/oauth";
import { stripProfileSecrets } from "../src/lib/profile/safe";

const ROOT = join(import.meta.dirname, "..");

let passed = 0;
const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${nom}`); }
}
async function testA(nom: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${nom}`); }
}

/** Le code sans ses commentaires ni ses imports — sans couper les `://` des adresses. */
const codeSeul = (chemin: string): string =>
  readFileSync(join(ROOT, chemin), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !/^\s*(import\b|\/\/)/.test(l))
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");

function fichiersSrc(dir = join(ROOT, "src"), out: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) fichiersSrc(chemin, out);
    else if (/\.tsx?$/.test(nom)) out.push(chemin.slice(ROOT.length + 1));
  }
  return out;
}

const CALLBACK = "src/app/api/intervals/oauth/callback/route.ts";
const START = "src/app/api/intervals/oauth/start/route.ts";
const CREDENTIALS = "src/app/api/intervals/credentials/route.ts";

void (async () => {

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔑 L'EN-TÊTE — une clé en Basic, un jeton en Bearer\n");
// ─────────────────────────────────────────────────────────────────────────────

test("une clé API garde exactement l'en-tête Basic d'avant", () => {
  const attendu = "Basic " + Buffer.from("API_KEY:a1b2c3d4e5f6").toString("base64");
  assert.equal(enteteIntervals("a1b2c3d4e5f6"), attendu);
  assert.equal(enteteIntervals("  a1b2c3d4e5f6\n"), attendu, "une clé collée avec un retour à la ligne doit être rognée");
});

test("un jeton OAuth part en Bearer, sans son préfixe", () => {
  assert.equal(enteteIntervals(secretOAuth("d842c1fc25f241e5ae440d09756448a9")), "Bearer d842c1fc25f241e5ae440d09756448a9");
  assert.equal(secretOAuth("  tok1234567890abcdef "), `${PREFIXE_OAUTH}tok1234567890abcdef`);
  assert.equal(jetonDe("oauth:abc"), "abc");
  assert.ok(estJetonOAuth("oauth:abc") && !estJetonOAuth("a1b2c3") && !estJetonOAuth(null) && !estJetonOAuth(42));
});

test("aucun fichier de src/ ne fabrique son propre en-tête Basic", () => {
  // Seize fichiers le recopiaient à la main le 12/10/2026. Un seul oubli enverrait un jeton
  // OAuth en Basic : 401, « intervals.icu ne répond pas », et rien d'autre.
  const coupables = fichiersSrc()
    .filter((f) => f !== "src/lib/intervals/auth.ts")
    .filter((f) => /API_KEY:/.test(codeSeul(f)));
  assert.deepEqual(coupables, [], `en-tête Basic recopié dans : ${coupables.join(", ")}`);
});

test("le jeton vit dans la colonne déjà retirée de tout profil envoyé au navigateur", () => {
  const p = stripProfileSecrets({ id: "x", intervals_athlete_id: "i1", intervals_api_key: "oauth:secret-du-jeton" });
  assert.ok(!("intervals_api_key" in p), "le jeton OAuth partirait vers le navigateur");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🧭 LE DÉPART — l'adresse d'autorisation et le state\n");
// ─────────────────────────────────────────────────────────────────────────────

test("la demande porte nos quatre portées, l'adresse de retour déclarée et le state", () => {
  const u = new URL(urlAutorisation({ clientId: "1331", redirectUri: adresseRetour("https://pacevo.fr/"), etat: "e".repeat(48) }));
  assert.equal(u.origin + u.pathname, "https://intervals.icu/oauth/authorize");
  assert.equal(u.searchParams.get("client_id"), "1331");
  assert.equal(u.searchParams.get("redirect_uri"), "https://pacevo.fr/api/intervals/oauth/callback");
  assert.equal(u.searchParams.get("scope"), "ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE,SETTINGS:WRITE");
  assert.equal(u.searchParams.get("state"), "e".repeat(48));
});

test("le state est imprévisible et se compare à temps constant", () => {
  const a = nouvelEtat(), b = nouvelEtat();
  assert.match(a, /^[0-9a-f]{48}$/);
  assert.notEqual(a, b);
  assert.ok(etatsEgaux(a, a));
  assert.ok(!etatsEgaux(a, b));
  assert.ok(!etatsEgaux("", ""), "deux state vides ne doivent pas valoir accord");
  assert.ok(!etatsEgaux(a, a.slice(1)), "longueurs différentes");
});

test("le cookie ne se lit que s'il a exactement la forme posée au départ", () => {
  const e = nouvelEtat();
  assert.deepEqual(lireCookie(valeurCookie(e, "sync")), { etat: e, retour: "sync" });
  assert.deepEqual(lireCookie(valeurCookie(e, "inscription")), { etat: e, retour: "inscription" });
  for (const forge of [undefined, "", "abc.sync", `${e}.ailleurs`, `${e}.https://evil.example`, `${e}`]) {
    assert.equal(lireCookie(forge), null, `cookie forgé accepté : ${String(forge)}`);
  }
});

test("le départ exige une session et pose un cookie httpOnly, Lax, limité au chemin OAuth", () => {
  const code = codeSeul(START);
  assert.ok(/getUser\s*\(/.test(code) && /\/login/.test(code), "un visiteur anonyme ne doit pas partir vers intervals.icu");
  assert.ok(/httpOnly:\s*true/.test(code), "cookie lisible par le JavaScript de la page");
  // ⚠️ Lax et pas Strict : le retour vient d'un AUTRE site ; un cookie Strict n'y serait
  // pas joint et chaque connexion échouerait.
  assert.ok(/sameSite:\s*"lax"/.test(code), "cookie hors Lax");
  assert.ok(/path:\s*CHEMIN_COOKIE/.test(code) && /maxAge:\s*DUREE_COOKIE_S/.test(code));
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n↩️  LE RETOUR — state, échange, enregistrement\n");
// ─────────────────────────────────────────────────────────────────────────────

test("le state est contrôlé AVANT l'échange du code", () => {
  const code = codeSeul(CALLBACK);
  const controle = code.search(/etatsEgaux\s*\(/);
  const echange = code.search(/echangerCode\s*\(/);
  assert.ok(controle >= 0 && echange >= 0, "contrôle ou échange introuvable");
  assert.ok(controle < echange, "le code est échangé avant d'avoir vérifié le state");
});

test("le cookie est effacé à chaque sortie, et la sortie ne va que vers une page fixe", () => {
  const code = codeSeul(CALLBACK);
  assert.ok(/COOKIE_ETAT,\s*""\s*,\s*\{[^}]*maxAge:\s*0/.test(code), "le state resterait réutilisable");
  // Aucune adresse de destination lue dans l'URL : seuls error, code et state y sont lus.
  const lus = [...code.matchAll(/searchParams\.get\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(lus)].sort(), ["code", "error", "state"], `paramètre inattendu lu dans l'URL : ${lus}`);
  assert.ok(/new URL\(\s*PAGE_RETOUR/.test(code), "la sortie doit viser PAGE_RETOUR");
});

test("le jeton est rangé préfixé, avec la session de l'athlète", () => {
  const code = codeSeul(CALLBACK);
  assert.ok(/intervals_api_key:\s*secretOAuth\(\s*r\.jeton\s*\)/.test(code), "jeton rangé sans son préfixe : il partirait en Basic");
  assert.ok(/intervals_athlete_id:\s*r\.athleteId/.test(code));
  assert.ok(!/createAdminClient\(\)\s*\.from\(\s*"profiles"/.test(code), "le profil doit s'écrire avec la session de l'athlète (RLS)");
});

test("ni le code, ni le secret, ni le jeton n'entrent dans un journal", () => {
  const code = codeSeul(CALLBACK);
  const appels = [...code.matchAll(/(journaliser|console\.\w+)\(([^;]*)\)/g)].map((m) => m[2]);
  assert.ok(appels.length > 0, "aucune journalisation trouvée : le test ne vise plus rien");
  // ⚠️ On vise les VARIABLES, pas les mots : « échange du code refusé » est un message, pas
  // une fuite. Le texte des chaînes est retiré, seules les interpolations `${…}` restent.
  const sansTextes = (a: string) => a
    .replace(/`(?:[^`\\]|\\.)*`/g, (t) => (t.match(/\$\{[^}]*\}/g) ?? []).join(" "))
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  // `code` seul = le code d'autorisation ; `r.code` et `error.code` sont des catégories d'échec.
  const fuites = appels.map(sansTextes)
    .filter((a) => /(^|[^.\w])code\b|\bjeton\b|\bconf\b|clientSecret|client_secret|access_token/.test(a));
  assert.deepEqual(fuites, [], `un secret part au journal : ${fuites.join(" | ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📜 LES PORTÉES — ce que l'athlète a vraiment accordé\n");
// ─────────────────────────────────────────────────────────────────────────────

test("une portée WRITE couvre la READ de la même famille, jamais l'inverse", () => {
  assert.deepEqual(portesManquantes("ACTIVITY:WRITE,WELLNESS:WRITE"), ["CALENDAR:WRITE", "SETTINGS:WRITE"]);
  assert.deepEqual(portesManquantes("CALENDAR:READ,ACTIVITY:READ,WELLNESS:READ,SETTINGS:WRITE"), ["CALENDAR:WRITE"],
    "CALENDAR:READ ne permet pas d'écrire les séances");
});

test("contre-poids : tout accordé, rien ne manque (casse et espaces compris)", () => {
  assert.deepEqual(portesManquantes(PORTEES.join(",")), []);
  assert.deepEqual(portesManquantes(" activity:read, wellness:read ,calendar:write,settings:write "), []);
  assert.deepEqual(portesManquantes(undefined), [], "sans champ scope, on ne peut rien conclure");
  assert.equal(codeManquantes(["CALENDAR:WRITE", "SETTINGS:WRITE"]), "calendar,settings");
});

test("la réponse du jeton est vérifiée champ par champ", () => {
  // L'exemple exact de la documentation (forum intervals.icu, sujet 2759).
  const doc = { token_type: "Bearer", access_token: "d842c1fc25f241e5ae440d09756448a9", scope: "ACTIVITY:WRITE,WELLNESS:WRITE",
    athlete: { id: "2049151", name: "David (intervals.icu)" } };
  const r = lireReponseJeton(doc);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.jeton, "d842c1fc25f241e5ae440d09756448a9");
    assert.equal(r.athleteId, "2049151", "un compte ancien a un identifiant sans « i »");
    assert.equal(r.nom, "David (intervals.icu)");
    assert.deepEqual(r.manquantes, ["CALENDAR:WRITE", "SETTINGS:WRITE"]);
  }
  const r2 = lireReponseJeton({ ...doc, athlete: { id: " I564686 " } });
  assert.ok(r2.ok && r2.athleteId === "i564686", "identifiant normalisé en minuscules");
  const r3 = lireReponseJeton({ ...doc, athlete: { id: 2049151 } });
  assert.ok(r3.ok && r3.athleteId === "2049151", "identifiant numérique accepté");
  for (const [nom, corps] of [
    ["identifiant qui sort du chemin", { ...doc, athlete: { id: "../i1" } }],
    ["identifiant vide", { ...doc, athlete: {} }],
    ["jeton absent", { ...doc, access_token: undefined }],
    ["jeton trop court", { ...doc, access_token: "abc" }],
    ["jeton avec espace", { ...doc, access_token: "d842c1fc 25f241e5ae440d09756448a9" }],
    ["autre type de jeton", { ...doc, token_type: "mac" }],
    ["corps vide", null],
  ] as const) {
    assert.equal(lireReponseJeton(corps).ok, false, `accepté à tort : ${nom}`);
  }
});

test("l'application n'est proposée qu'avec son identifiant ET son secret", () => {
  assert.equal(configurationOAuth({}), null);
  assert.equal(configurationOAuth({ INTERVALS_OAUTH_CLIENT_ID: "1331" }), null);
  assert.equal(configurationOAuth({ INTERVALS_OAUTH_CLIENT_SECRET: "s" }), null);
  assert.equal(configurationOAuth({ INTERVALS_OAUTH_CLIENT_ID: " ", INTERVALS_OAUTH_CLIENT_SECRET: "s" }), null);
  assert.deepEqual(configurationOAuth({ INTERVALS_OAUTH_CLIENT_ID: " 1331 ", INTERVALS_OAUTH_CLIENT_SECRET: " s " }), { clientId: "1331", clientSecret: "s" });
  assert.ok(/oauth:\s*!!configurationOAuth\(\)/.test(codeSeul("src/app/api/intervals/status/route.ts")),
    "la route d'état doit dire si le bouton peut être proposé");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔌 L'ÉCHANGE ET LA RÉVOCATION — ce qui part vers intervals.icu\n");
// ─────────────────────────────────────────────────────────────────────────────

type Appel = { url: string; init?: RequestInit };
const faux = (reponse: () => Response | Error) => {
  const appels: Appel[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    appels.push({ url: String(url), init });
    const r = reponse();
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { f, appels };
};
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
const CONF = { clientId: "1331", clientSecret: "le-secret", code: "3983ed415f66413c890ca48b7cce59e4" };

await testA("le code s'échange en formulaire, avec l'identifiant et le secret de l'application", async () => {
  const { f, appels } = faux(() => json({ token_type: "Bearer", access_token: "d842c1fc25f241e5ae440d09756448a9",
    scope: PORTEES.join(","), athlete: { id: "i564686", name: "Cyprien" } }));
  const r = await echangerCode(CONF, f);
  assert.ok(r.ok && r.manquantes.length === 0);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, URL_JETON);
  assert.equal(appels[0].init?.method, "POST");
  assert.equal((appels[0].init?.headers as Record<string, string>)["Content-Type"], "application/x-www-form-urlencoded");
  const corps = new URLSearchParams(String(appels[0].init?.body));
  assert.equal(corps.get("client_id"), "1331");
  assert.equal(corps.get("client_secret"), "le-secret");
  assert.equal(corps.get("code"), "3983ed415f66413c890ca48b7cce59e4");
});

await testA("un refus ne se confond pas avec une panne", async () => {
  for (const [status, attendu] of [[400, "refuse"], [401, "refuse"], [403, "refuse"], [429, "indisponible"], [408, "indisponible"], [500, "indisponible"], [503, "indisponible"]] as const) {
    const r = await echangerCode(CONF, faux(() => json({ error: "x" }, status)).f);
    assert.ok(!r.ok && r.code === attendu, `HTTP ${status} → ${r.ok ? "ok" : r.code}, attendu ${attendu}`);
  }
  const reseau = await echangerCode(CONF, faux(() => new Error("ECONNRESET")).f);
  assert.ok(!reseau.ok && reseau.code === "indisponible");
  const illisible = await echangerCode(CONF, faux(() => new Response("<html>", { status: 200 })).f);
  assert.ok(!illisible.ok && illisible.code === "reponse_invalide");
});

await testA("la déconnexion révoque l'autorisation chez intervals.icu", async () => {
  const { f, appels } = faux(() => new Response(null, { status: 200 }));
  assert.equal(await revoquer("d842c1fc25f241e5ae440d09756448a9", f), true);
  assert.equal(appels[0].url, URL_DECONNEXION);
  assert.equal(appels[0].init?.method, "DELETE");
  assert.equal((appels[0].init?.headers as Record<string, string>).Authorization, "Bearer d842c1fc25f241e5ae440d09756448a9");
  assert.equal(await revoquer("x", faux(() => new Response(null, { status: 500 })).f), false);
  assert.equal(await revoquer("x", faux(() => new Error("panne")).f), false, "une panne ne doit pas lever d'exception");
  const code = codeSeul(CREDENTIALS);
  assert.ok(/estJetonOAuth\([^)]*\)\)\s*\{\s*await revoquer\(/.test(code), "DELETE ne révoque pas un jeton OAuth");
});

test("la route des identifiants ne montre jamais un jeton, même tronqué", () => {
  const code = codeSeul(CREDENTIALS);
  assert.ok(/apiKeyMasked:\s*profile\?\.intervals_api_key\s*&&\s*!oauth/.test(code), "« oaut●●●● » s'afficherait");
  assert.ok(/mode:\s*oauth\s*\?\s*"oauth"/.test(code), "l'écran ne saurait pas dire « autorisation intervals.icu »");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`   · ${f}`); process.exit(1); }
})();
