/**
 * LES EN-TÊTES DE SÉCURITÉ SERVIS À CHAQUE PAGE.
 *
 * Relevés en production le 04/09/2026 : HSTS, `nosniff` et `X-Frame-Options: DENY`
 * étaient là ; `Referrer-Policy` et `Permissions-Policy` manquaient.
 *
 * ⚠️ CE QUE `Content-Security-Policy` N'EST PAS ENCORE, ET POURQUOI. Elle manque aussi,
 * et c'est un manque réel — mais une CSP posée à l'aveugle sur une application Next.js
 * casse les scripts en ligne qu'elle génère elle-même. La panne serait INVISIBLE depuis
 * ici : la page se rendrait côté serveur, puis resterait morte chez le visiteur. Elle
 * demande des nonces et une vérification écran par écran ; l'ajouter sans cela ferait
 * plus de mal que son absence.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const conf = readFileSync("next.config.ts", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
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

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
