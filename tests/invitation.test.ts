/**
 * INVITER SES AMIS (29/09/2026) — « fais fonctionner le bouton inviter, sur Messages,
 * Instagram, etc., comme la plupart des applications ».
 *
 * Constaté sur la capture de Cyprien : la feuille du système s'ouvrait sur Mac, puis
 * « Partage impossible » ; Instagram n'y figurait pas.
 *
 *   npx tsx tests/invitation.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { actionPartage, CIBLES, estAnnulation, estMobile, type Invitation } from "../src/lib/social/invitation";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const INV: Invitation = { texte: "Rejoins-moi sur Pacevo & cours !", url: "https://pacevo.fr/amis/abc", sujet: "Rejoins-moi sur Pacevo" };

console.log("\n=== ADRESSES DE PARTAGE ===\n");

test("Messages et WhatsApp reçoivent le texte ET le lien, encodés", () => {
  const sms = actionPartage("messages", INV, { mobile: true });
  assert.equal(sms.href, `sms:?&body=${encodeURIComponent("Rejoins-moi sur Pacevo & cours ! https://pacevo.fr/amis/abc")}`);
  assert.ok(!sms.href.includes(" & "), "un « & » non encodé couperait le message en deux");
  assert.equal(actionPartage("whatsapp", INV, { mobile: false }).href.startsWith("https://wa.me/?text="), true);
  assert.ok(decodeURIComponent(actionPartage("whatsapp", INV, { mobile: false }).href).includes(INV.url));
});

test("Instagram n'accepte aucun texte : on COPIE le lien puis on ouvre la messagerie", () => {
  const a = actionPartage("instagram", INV, { mobile: true });
  assert.equal(a.copier, true);
  assert.equal(a.href, "https://www.instagram.com/direct/inbox/");
});

test("Messenger : l'application sur téléphone, la copie sur ordinateur", () => {
  assert.deepEqual(actionPartage("messenger", INV, { mobile: true }), { href: `fb-messenger://share/?link=${encodeURIComponent(INV.url)}`, copier: false });
  assert.equal(actionPartage("messenger", INV, { mobile: false }).copier, true);
});

test("Telegram, X, Facebook, e-mail : chacun son adresse, le lien toujours dedans", () => {
  for (const c of ["telegram", "x", "facebook", "email"] as const) {
    const h = decodeURIComponent(actionPartage(c, INV, { mobile: false }).href);
    assert.ok(h.includes(INV.url), `${c} : le lien manque`);
  }
  assert.ok(actionPartage("email", INV, { mobile: false }).href.startsWith("mailto:?subject=Rejoins-moi%20sur%20Pacevo&body="));
});

test("les applications les plus utilisées pour écrire à un ami viennent d'abord", () => {
  assert.deepEqual(CIBLES.slice(0, 3), ["messages", "whatsapp", "instagram"]);
  assert.equal(new Set(CIBLES).size, CIBLES.length);
});

test("fermer la feuille du système n'est pas un échec ; le reste retombe sur la copie", () => {
  assert.equal(estAnnulation({ name: "AbortError" }), true);
  assert.equal(estAnnulation({ name: "NotAllowedError" }), false);
  assert.equal(estAnnulation(null), false);
  assert.equal(estMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), true);
  assert.equal(estMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140"), false);
});

console.log("\n=== BRANCHEMENTS ===\n");

test("le bouton Inviter et « Partager mon lien » ouvrent la feuille — plus de navigator.share nu", () => {
  const src = codeNu("src/components/social/AjouterAmis.tsx");
  assert.ok(!/navigator\.share|nav\.share/.test(src), "le partage nu du navigateur est revenu (« Partage impossible » sur Mac)");
  assert.match(src, /<FeuilleInvitation ouverte=\{feuille\} onFermer=\{\(\) => setFeuille\(false\)\} invitation=\{invitation\} \/>/);
  assert.match(src, /onPartager=\{inviter\}/, "le bouton du QR code ne passe plus par la feuille");
  assert.match(src, /url: origine \? lienAmi\(origine, moi\.id\) : ""/, "l'invitation n'envoie plus le lien PERSONNEL");
});

test("la feuille : copie et ouverture dans le MÊME geste, et « Plus » retombe sur la copie", () => {
  const src = codeNu("src/components/social/FeuilleInvitation.tsx");
  // Un `await` avant `window.open` ferait bloquer la fenêtre par le navigateur.
  assert.match(src, /const copieEnCours = a\.copier \? lancerCopie\(\) : null;\s*if \(\/\^https\?:\/\.test\(a\.href\)\) window\.open\(/);
  assert.match(src, /if \(!estAnnulation\(e\)\) await copier\(\);/);
  assert.match(src, /<input readOnly value=\{invitation\.url\}/, "le lien n'est plus visible et copiable à la main");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
