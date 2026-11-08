/**
 * L'AUDIT DES 60 ROUTES RESTANTES ET DES DONNÉES DE SANTÉ (08/11/2026).
 *
 * Après les 15 routes de tests/echecs-muets.test.ts, trois sous-agents
 * `chasseur-echecs-muets` ont passé les 60 autres routes d'écriture et
 * `gardien-donnees-sante` toute l'application. Chaque trouvaille a été relue dans le code
 * avant d'être corrigée ; ce fichier fige les corrections.
 *
 * D'abord la sécurité, déployée à part : une route de maintenance du catalogue des
 * courses était ouverte à toute requête anonyme, et le journal d'erreurs recevait
 * l'adresse complète des pages, y compris le lien secret du suivi GPS en direct.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { urlJournalisable } from "../src/lib/journal/urlJournal";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
const enAttente: Promise<void>[] = [];
function testAsync(nom: string, fn: () => Promise<void>) {
  enAttente.push(fn().then(
    () => { passed++; console.log(`  OK ${nom}`); },
    (e: Error) => { fails.push(`${nom} — ${e.message}`); console.log(`  ✗ ${nom}`); },
  ));
}
void testAsync;

/** Sans commentaires : une explication qui décrit le défaut n'est pas le correctif. */
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/** Le corps de chaque handler exporté d'une route : `{ GET: "...", PATCH: "..." }`. */
function handlers(f: string): Record<string, string> {
  const src = codeNu(f);
  const out: Record<string, string> = {};
  const re = /export async function (GET|POST|PUT|PATCH|DELETE)\b/g;
  const pos = [...src.matchAll(re)].map((m) => ({ meth: m[1], i: m.index! }));
  pos.forEach((p, k) => { out[p.meth] = src.slice(p.i, k + 1 < pos.length ? pos[k + 1].i : undefined); });
  return out;
}

// ── 1. Sécurité ─────────────────────────────────────────────────────────────────
test("chaque méthode des routes de maintenance du catalogue est gardée", () => {
  // Elles écrivent avec la clé de service. Le PATCH de races/dedup ne l'était pas :
  // n'importe quelle requête anonyme renommait ou redatait une course.
  const routes = ["races/dedup", "races/geocode", "races/seed", "races/seed-full", "races/sync"];
  let vues = 0;
  for (const r of routes) {
    for (const [meth, corps] of Object.entries(handlers(`src/app/api/${r}/route.ts`))) {
      vues++;
      const tete = corps.slice(0, 1600);
      const garde = /const denied = await denyIfNotAdmin\(req\);\s*if \(denied\) return/.test(tete) || /CRON_SECRET/.test(tete);
      assert.ok(garde, `${r} ${meth} n'a aucune garde`);
    }
  }
  assert.ok(vues >= 11, `seulement ${vues} méthodes trouvées : le découpage ne voit plus les routes`);
});

test("un secret absent n'ouvre pas l'import du flux de la boutique", () => {
  const src = codeNu("src/app/api/shop/import-feed/route.ts");
  assert.match(src, /const accepte = \(attendu: string \| undefined\) => !!secret && !!attendu && secret === attendu;/,
    "une variable d'environnement absente rend `undefined !== undefined` faux : la route s'ouvre");
  assert.ok(!/secret !== process\.env\./.test(src), "l'ancienne comparaison est revenue");
});

test("le journal ne reçoit jamais l'adresse complète d'une page", () => {
  // Le lien de suivi en direct : son identifiant est le seul secret de la position GPS.
  assert.equal(urlJournalisable("https://pacevo.fr/suivre/k3j9x2a7q"), "https://pacevo.fr/suivre/[id]");
  assert.equal(urlJournalisable("https://pacevo.fr/dashboard?suivre=abc&code=XYZ#token=1"), "https://pacevo.fr/dashboard");
  assert.equal(urlJournalisable("https://pacevo.fr/login?next=/dashboard/sync"), "https://pacevo.fr/login");
  assert.equal(urlJournalisable("http://localhost:3000/dashboard"), "http://localhost:3000/dashboard", "l'origine sert au tri du bruit de développement");
  assert.equal(urlJournalisable("https://pacevo.fr/api/messages/piece/123e4567-e89b-12d3-a456-426614174000"), "https://pacevo.fr/api/messages/piece/[id]");
  assert.equal(urlJournalisable("/suivre/abc?x=1"), "/suivre/[id]");
  assert.equal(urlJournalisable(""), null);
  assert.equal(urlJournalisable(42), null);
  const route = codeNu("src/app/api/log-error/route.ts");
  assert.match(route, /url: urlJournalisable\(body\.url\),/, "la route publique stocke de nouveau l'adresse telle que l'envoie le navigateur");
  assert.ok(!/url: cut\(body\.url/.test(route), "l'adresse brute est de nouveau écrite");
  assert.ok(!/url: location\.href/.test(codeNu("src/components/ErrorReporter.tsx")), "le rapporteur envoie de nouveau l'adresse complète");
});

test("l'identifiant du partage en direct est tiré au hasard cryptographique", () => {
  const src = codeNu("src/components/trail/TrailBuilder.tsx");
  assert.match(src, /const sid = idPartage\(\);/, "le partage en direct ne passe plus par idPartage");
  assert.ok(!/Math\.random\(\)\.toString\(36\)/.test(src), "un identifiant de suivi GPS tiré par Math.random est revenu");
});

Promise.all(enAttente).then(() => {
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
});
