/**
 * LES EN-TÊTES DE SÉCURITÉ SERVIS À CHAQUE PAGE.
 *
 * Relevés en production le 04/09/2026 : HSTS, `nosniff` et `X-Frame-Options: DENY`
 * étaient là ; `Referrer-Policy` et `Permissions-Policy` manquaient.
 *
 * ⚠️ `Content-Security-Policy` EST DÉSORMAIS SERVIE EN REPORT-ONLY (M4, 16/10/2026). En mode
 * APPLIQUÉ, une CSP casserait les scripts en ligne que Next génère lui-même — la panne serait
 * INVISIBLE depuis ici (rendu serveur OK, puis page morte chez le visiteur) et demande des nonces
 * et une vérification écran par écran. Report-only, elle, n'applique rien : elle SIGNALE les
 * violations (`report-uri` → `/api/csp-report`), le temps de mesurer avant de durcir.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lireRapportCsp, rapportLocal } from "../src/lib/csp/rapport";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

// ⚠️ On retire les commentaires SANS confondre `//` (URL) ni `/*` (URL `https://*.hote`) avec
// un commentaire : un `/*` précédé de `:` ou `/` appartient à une URL (`://*`, `//*`), pas à un
// commentaire — sinon le bloc mange jusqu'au `*/` suivant et avale de vraies lignes.
const conf = readFileSync("next.config.ts", "utf8")
  .replace(/(^|[^:/])\/\*[\s\S]*?\*\//g, "$1")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

test("les cinq en-têtes de sécurité sont déclarés", () => {
  for (const [cle, valeur] of [
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["X-XSS-Protection", "1; mode=block"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=()"],
  ]) {
    assert.ok(new RegExp(`"${cle}"[\\s\\S]{0,40}${valeur.replace(/[()[\]]/g, "\\$&")}`).test(conf),
      `l'en-tête ${cle} (${valeur}) n'est plus servi`);
  }
});

test("la géolocalisation reste ouverte à l'application elle-même", () => {
  // ⚠️ `geolocation=()` COUPERAIT UNE FONCTIONNALITÉ RÉELLE — le tri « près de moi »
  // des parcours appelle `navigator.geolocation.getCurrentPosition`. Le navigateur
  // refuserait alors sans message exploitable : une panne silencieuse causée par une
  // mesure de sécurité, ce qui est la pire façon de sécuriser.
  const pp = conf.match(/"Permissions-Policy",\s*value:\s*"([^"]+)"/);
  assert.ok(pp, "l'en-tête Permissions-Policy a disparu");
  assert.match(pp![1], /geolocation=\(self\)/, "la géolocalisation est coupée alors que l'application s'en sert");
  const usage = readFileSync("src/components/parcours/ParcoursBrowser.tsx", "utf8");
  assert.ok(/navigator\.geolocation\.getCurrentPosition/.test(usage),
    "plus personne n'utilise la géolocalisation : l'autorisation peut être retirée");
  // Et ce qu'on n'utilise pas doit rester fermé.
  for (const interdit of ["camera", "microphone", "payment"]) {
    assert.ok(new RegExp(`${interdit}=\\(\\)`).test(pp![1]), `${interdit} n'est plus fermé`);
  }
});

test("une CSP est servie en report-only, et pas (encore) appliquée", () => {
  assert.match(conf, /Content-Security-Policy-Report-Only/, "la CSP report-only n'est plus servie");
  // Les directives à forte valeur, insensibles aux nonces, doivent y figurer.
  for (const d of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "report-uri /api/csp-report"]) {
    assert.ok(conf.includes(d), `la CSP report-only ne contient pas « ${d} »`);
  }
  // ⚠️ REPORT-ONLY, PAS APPLIQUÉE : l'appliquer sans nonces rendrait les pages mortes chez le visiteur.
  assert.ok(!/"Content-Security-Policy"\s*,/.test(conf), "la CSP est passée en mode APPLIQUÉ sans nonces : risque de page morte");
});

test("un rapport CSP se lit dans ses deux formats", () => {
  assert.deepEqual(lireRapportCsp(JSON.stringify({ "csp-report": { "violated-directive": "script-src", "blocked-uri": "eval", "document-uri": "https://pacevo.fr/" } })),
    { directive: "script-src", bloque: "eval", page: "https://pacevo.fr/" });
  assert.deepEqual(lireRapportCsp(JSON.stringify([{ body: { effectiveDirective: "img-src", blockedURL: "https://x.test/a.png", documentURL: "https://pacevo.fr/dashboard" } }])),
    { directive: "img-src", bloque: "https://x.test/a.png", page: "https://pacevo.fr/dashboard" });
  assert.deepEqual(lireRapportCsp("pas du json"), { directive: "?", bloque: "?", page: "" });
});

test("les rapports d'un poste de développement n'entrent pas dans la base de production", () => {
  // 05/11/2026 : 27 lignes « http://localhost:3000/ » dans error_logs, écrites par des `next dev`
  // locaux branchés sur la base de production.
  for (const [page, hote] of [["http://localhost:3000/", "localhost:3000"], ["http://127.0.0.1:3000/dashboard", null],
    ["", "localhost:3000"], ["http://app.localhost:3000/", null], ["http://[::1]:3000/", null]] as const) {
    assert.equal(rapportLocal(page, hote), true, `${page} / ${hote}`);
  }
  assert.equal(rapportLocal("https://pacevo.fr/dashboard", "pacevo.fr"), false, "un vrai visiteur est ignoré");
  assert.equal(rapportLocal("", "pacevo.fr"), false);
  // Et la route trie AVANT d'ouvrir la base (ni écriture, ni même le comptage par minute).
  const route = readFileSync("src/app/api/csp-report/route.ts", "utf8");
  const tri = route.indexOf('if (rapportLocal(page, req.headers.get("host"))) return rien();');
  assert.ok(tri > 0 && tri < route.indexOf("const admin = createAdminClient();"), "la route écrit les rapports locaux, ou les trie trop tard");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
