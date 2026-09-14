/**
 * LISTE D'ATTENTE (avant-lancement).
 *
 * Elle doit : bâtir une audience SANS rien encaisser (aucune société requise), afficher une
 * offre fondateur dont les chiffres viennent d'UNE seule source (jamais recopiés), exister
 * dans les cinq langues, et être réellement montée sur la landing en réutilisant la capture
 * d'e-mails existante.
 *
 *   npx tsx tests/waitlist.test.ts
 */
import { readFileSync } from "node:fs";
import { WAITLIST_I18N } from "../src/components/landing/waitlistI18n";
import { OFFRE_FONDATEUR } from "../src/lib/brand/waitlist";

let ko = 0;
const fail = (q: string, d = "") => { ko++; console.log(`  ✗ ${q}${d ? "\n      " + d : ""}`); };
const sansComm = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

// ── 1. L'offre est bornée = rentable ─────────────────────────────────────────
let n = 0;
if (!(OFFRE_FONDATEUR.places > 0 && OFFRE_FONDATEUR.places <= 1000)) fail("nombre de places fondateur hors bornes", String(OFFRE_FONDATEUR.places));
// ⚠️ Une remise « à vie » ou ≥ 50 % saignerait la marge. On borne à moins de 50 %.
if (!(OFFRE_FONDATEUR.remisePct > 0 && OFFRE_FONDATEUR.remisePct < 50)) fail("remise fondateur trop élevée (marge)", `${OFFRE_FONDATEUR.remisePct}%`);
n += 2;
console.log(`  ✓ offre bornée : ${OFFRE_FONDATEUR.places} places, −${OFFRE_FONDATEUR.remisePct}% 1ʳᵉ année`);

// ── 2. Cinq langues, placeholders présents (chiffres jamais écrits en dur) ────
let l = 0;
for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
  const b = WAITLIST_I18N[lg];
  if (!b) { fail(`langue ${lg} absente`); continue; }
  for (const k of ["eyebrow", "title", "subtitle", "offer", "b1", "b2", "b3", "note"] as const) {
    if (!b[k] || b[k].trim().length < 2) fail(`${lg} : clé ${k} vide`);
  }
  // Les chiffres doivent venir de la source unique : le texte porte les gabarits, pas les nombres.
  if (!b.offer.includes("{places}") || !b.offer.includes("{remise}")) fail(`${lg} : l'offre n'utilise pas {places}/{remise}`, "chiffres recopiés en dur = dérive garantie");
  if (!b.b2.includes("{remise}")) fail(`${lg} : b2 n'utilise pas {remise}`);
  // Et surtout : la valeur en dur ne doit PAS apparaître (sinon changer la constante ne suffit plus).
  if (new RegExp(`\\b${OFFRE_FONDATEUR.remisePct}\\b`).test(b.offer)) fail(`${lg} : le % est écrit en dur dans l'offre`, b.offer);
  l++;
}
console.log(`  ✓ textes : ${l} langues, offre paramétrée par la source unique`);

// ── 3. Le composant injecte la source unique et réutilise la capture existante ─
let c = 0;
const sec = sansComm(readFileSync("src/components/WaitlistSection.tsx", "utf8"));
if (!/OFFRE_FONDATEUR\.places/.test(sec) || !/OFFRE_FONDATEUR\.remisePct/.test(sec)) fail("la section n'injecte pas les valeurs de la source unique OFFRE_FONDATEUR");
// ⚠️ Le texte affiché DOIT passer par l'injection, sinon le visiteur lit « {places} » brut.
if (!/injecte\(L\.offer\)/.test(sec)) fail("l'offre affichée n'est pas passée par l'injection des chiffres", "le visiteur verrait « {places} »/« {remise} » en clair");
if (!/replace\([^)]*\{places\\?\}?/.test(sec) && !sec.includes("{places}")) fail("l'injection ne remplace pas le gabarit {places}");
if (!/NewsletterSignup/.test(sec)) fail("la section ne réutilise pas la capture d'e-mails existante", "elle réinventerait le stockage/l'accusé");
c += 4;

// ── 4. Réellement montée sur la landing ──────────────────────────────────────
const landing = sansComm(readFileSync("src/app/page.tsx", "utf8"));
if (!/<WaitlistSection\s*\/>/.test(landing)) fail("la liste d'attente n'est pas montée sur la landing");
if (!/import \{ WaitlistSection \}/.test(landing)) fail("WaitlistSection n'est pas importée dans la landing");
c += 2;

// ── 5. La capture reste GRATUITE : elle poste vers /subscribe, pas vers un paiement ─
const capture = sansComm(readFileSync("src/components/NewsletterSignup.tsx", "utf8"));
if (!/\/api\/newsletter\/subscribe/.test(capture)) fail("la capture ne vise plus /api/newsletter/subscribe");
if (/stripe|checkout|payment|paiement/i.test(sec)) fail("la liste d'attente touche au paiement", "elle ne doit QUE collecter des e-mails avant le lancement");
c += 2;
console.log(`  ✓ montage & réutilisation : ${c} contrôles (source unique, landing, capture gratuite)`);

console.log(`\n${n + l + c} contrôles liste d'attente · ${ko} problème(s)`);
process.exit(ko ? 1 : 0);
