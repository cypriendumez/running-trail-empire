/**
 * CRASH-TESTS DE LA PWA (installation, hors-ligne, service worker).
 *
 * ── LE SERVICE WORKER EST LA SURFACE DANGEREUSE ──────────────────────────────
 * Une fois installé chez un visiteur, un service worker persiste et intercepte CHAQUE
 * requête. S'il met en cache une route liée à la session (/api, /auth), il peut servir les
 * données d'un athlète à un autre, ou une session périmée. Ce test verrouille les garde-fous :
 * jamais /api ni /auth en cache, réseau d'abord pour les pages, page hors-ligne en secours,
 * cache versionné et nettoyé. Une mutation qui affaiblit l'un de ces points doit rougir.
 *
 *   npx tsx tests/pwa.crash.test.ts
 */
import { readFileSync } from "node:fs";
import { PWA_I18N } from "../src/components/pwa/pwaI18n";

let ko = 0;
const fail = (quoi: string, detail = "") => { ko++; console.log(`  ✗ ${quoi}${detail ? "\n      " + detail : ""}`); };
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

// ── 1. Le manifest décrit bien une app installable ───────────────────────────
let n = 0;
const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
if (!manifest.name) fail("manifest sans nom");
if (manifest.display !== "standalone") fail("manifest : display n'est pas standalone", "sans ça, pas d'effet « app »");
if (!Array.isArray(manifest.icons) || manifest.icons.length < 3) fail("manifest : moins de 3 icônes");
if (!manifest.icons?.some((i: { sizes?: string }) => i.sizes === "512x512")) fail("manifest : pas d'icône 512x512", "requise pour l'installation");
n += 4;
console.log(`  ✓ manifest : ${n} contrôles (nom, standalone, icônes)`);

// ── 2. Le service worker ne met JAMAIS l'auth ni les API en cache ────────────
let s = 0;
const sw = sansCommentaires(readFileSync("public/sw.js", "utf8"));
// Le cœur : le garde-fou qui exclut /api et /auth doit exister ET précéder toute mise en cache.
if (!/startsWith\("\/api\/"\)/.test(sw) || !/startsWith\("\/auth\/"\)/.test(sw)) {
  fail("le SW ne protège pas /api et /auth", "il pourrait mettre en cache une réponse liée à la session");
}
// Les écritures ne sont jamais interceptées.
if (!/method\s*!==\s*"GET"/.test(sw)) fail("le SW n'exclut pas les écritures (méthode ≠ GET)");
// Les domaines tiers (Supabase, Resend, cartes) ne sont jamais touchés.
if (!/origin\s*!==\s*self\.location\.origin/.test(sw)) fail("le SW ne se limite pas à son propre domaine");
// Navigations : réseau d'abord + repli hors-ligne.
if (!/mode\s*===\s*"navigate"/.test(sw)) fail("le SW ne traite pas les navigations à part");
// ⚠️ RÉSEAU D'ABORD = `fetch(req)` PRÉCÈDE toute lecture du cache dans la branche des
// navigations. Depuis le 21/09/2026, la page « Enregistrer » est gardée en cache APRÈS un
// succès (`.then`) pour s'ouvrir sans réseau : la forme est `fetch(req).then(…).catch(…)`.
{
  const nav = sw.slice(sw.indexOf('mode === "navigate"'));
  const iFetch = nav.indexOf("fetch(req)");
  const iCache = nav.indexOf("caches.match(req)");
  if (iFetch < 0 || !/fetch\(req\)[\s\S]{0,600}?\.catch\(/.test(nav)) fail("le SW ne fait pas réseau-d'abord sur les navigations", "risque de page périmée");
  if (iCache >= 0 && iCache < iFetch) fail("le SW lit le cache AVANT le réseau sur une navigation", "page périmée servie alors que le réseau est là");
}
if (!/\/offline/.test(sw)) fail("le SW n'a pas de page hors-ligne de secours");
// Cache versionné + nettoyage à l'activation.
if (!/caches\.delete/.test(sw)) fail("le SW ne supprime pas les anciens caches", "un mauvais cache resterait coincé");
if (!/skipWaiting/.test(sw) || !/clients\.claim/.test(sw)) fail("le SW ne prend pas la main après mise à jour");
// ⚠️ Preuve d'ordre : le garde /api-/auth doit venir AVANT le bloc de mise en cache des assets.
const iGarde = sw.indexOf('startsWith("/api/")');
const iCache = sw.indexOf("caches.match(req)");
if (iGarde < 0 || (iCache >= 0 && iGarde > iCache)) fail("le garde /api-/auth ne précède pas la mise en cache", "une route de session pourrait être cachée");
s += 8;
console.log(`  ✓ service worker : ${s} garde-fous (jamais /api ni /auth, réseau d'abord, versionné)`);

// ── 3. Le composant d'installation : deux chemins, et pas de mensonge sur iPhone ─
let c = 0;
const pwa = sansCommentaires(readFileSync("src/components/pwa/PwaClient.tsx", "utf8"));
if (!/beforeinstallprompt/.test(pwa)) fail("PwaClient n'écoute pas beforeinstallprompt (Android)");
if (!/display-mode: standalone/.test(pwa)) fail("PwaClient ne détecte pas l'app déjà installée", "il harcèlerait un utilisateur qui l'a déjà");
if (!/iphone\|ipad\|ipod/i.test(pwa)) fail("PwaClient ne détecte pas iOS", "un bouton « installer » y serait un mensonge (Safari n'a pas d'API)");
if (!/serviceWorker/.test(pwa) || !/register\("\/sw\.js"\)/.test(pwa)) fail("PwaClient n'enregistre pas le service worker");
// Tout accès au stockage doit être protégé (navigation privée lève une exception).
const acces = (pwa.match(/localStorage/g) ?? []).length;
const catchs = (pwa.match(/catch/g) ?? []).length;
if (acces > 0 && catchs < 1) fail("PwaClient touche localStorage sans try/catch", "plante en navigation privée");
c += 5;
// Monté dans le layout racine, dans le contexte de langue.
const layout = sansCommentaires(readFileSync("src/app/layout.tsx", "utf8"));
if (!/<PwaClient/.test(layout)) fail("le layout racine ne monte pas PwaClient");
if (!/manifest: "\/manifest\.json"/.test(layout)) fail("le layout ne lie plus le manifest");
c += 2;
console.log(`  ✓ installation : ${c} contrôles (Android, iOS, déjà installée, SW, montage)`);

// ── 4. Textes : cinq langues, aucune clé vide, page hors-ligne branchée ───────
let t = 0;
const CLES: (keyof typeof PWA_I18N["fr"])[] = [
  "installTitle", "installBody", "installBtn", "later", "iosTitle", "iosBody",
  "offlineTitle", "offlineBody", "offlineRetry", "pushTitle", "pushBody", "pushEnable", "pushEnabled", "pushBlocked", "pushInstallFirst",
];
for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
  const b = PWA_I18N[lg];
  if (!b) { fail(`langue ${lg} absente de PWA_I18N`); continue; }
  for (const k of CLES) if (!b[k] || b[k].trim().length < 2) fail(`${lg} : clé ${k} vide`);
  t++;
}
const offline = sansCommentaires(readFileSync("src/app/offline/page.tsx", "utf8"));
if (!/PWA_I18N/.test(offline)) fail("la page hors-ligne n'est pas traduite (PWA_I18N)");
if (!/window\.location\.reload/.test(offline)) fail("la page hors-ligne n'a pas de bouton « réessayer »");
t += 2;
console.log(`  ✓ textes : ${t} contrôles (5 langues × ${CLES.length} clés, page hors-ligne)`);

// ── 5. Notifications push : jamais casser, jamais envoyer à l'aveugle ─────────
let p = 0;
if (!/addEventListener\("push"/.test(sw)) fail("le SW ne gère pas l'événement push");
if (!/addEventListener\("notificationclick"/.test(sw)) fail("le SW ne gère pas le clic sur la notification");
if (!/showNotification/.test(sw)) fail("le SW n'affiche aucune notification", "userVisibleOnly serait violé, l'abonnement révoqué");
p += 3;

const envoi = sansCommentaires(readFileSync("src/lib/push/envoyer.ts", "utf8"));
if (!/NEXT_PUBLIC_VAPID_PUBLIC_KEY/.test(envoi) || !/VAPID_PRIVATE_KEY/.test(envoi)) fail("l'envoi push ne lit pas les clés VAPID");
if (!/!configurer\(\)/.test(envoi)) fail("l'envoi push ne vérifie pas la config VAPID avant d'envoyer", "sans clés, il tenterait d'envoyer et planterait la route appelante");
if (!/404|410/.test(envoi)) fail("l'envoi push ne nettoie pas les abonnements morts (404/410)");
if (!/push_subscriptions/.test(envoi)) fail("l'envoi push ne lit pas la table des abonnements");
p += 4;

const clientPush = sansCommentaires(readFileSync("src/lib/push/client.ts", "utf8"));
if (!/userVisibleOnly:\s*true/.test(clientPush)) fail("le client push n'impose pas userVisibleOnly", "l'abonnement serait révoqué par le navigateur");
if (!/NEXT_PUBLIC_VAPID_PUBLIC_KEY/.test(clientPush)) fail("le client push n'utilise pas la clé VAPID publique");
if (!/\/api\/push\/subscribe/.test(clientPush)) fail("le client push n'enregistre pas l'abonnement côté serveur");
p += 3;

for (const [f, quoi] of [["src/app/api/push/subscribe/route.ts", "subscribe"], ["src/app/api/push/unsubscribe/route.ts", "unsubscribe"]] as const) {
  const r = sansCommentaires(readFileSync(f, "utf8"));
  if (!/getUser\(\)/.test(r) || !/status:\s*401/.test(r)) fail(`la route push ${quoi} n'exige pas d'être connecté`, "on inscrirait/supprimerait l'appareil d'un autre");
  p++;
}
const unsub = sansCommentaires(readFileSync("src/app/api/push/unsubscribe/route.ts", "utf8"));
if (!/eq\("user_id", user\.id\)/.test(unsub)) fail("unsubscribe ne se limite pas à l'utilisateur connecté", "on pourrait supprimer l'abonnement d'un autre");
p++;
const pr = sansCommentaires(readFileSync("src/lib/notify/planReady.ts", "utf8"));
if (!/envoyerPush\(/.test(pr)) fail("aucun événement réel ne déclenche de push (planReady)");
p++;
console.log(`  ✓ push : ${p} contrôles (SW, envoi sûr sans clés, auth des routes, déclencheur)`);

console.log(`\n${n + s + c + t + p} contrôles PWA · ${ko} problème(s)`);
process.exit(ko ? 1 : 0);
