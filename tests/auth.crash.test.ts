/**
 * CRASH-TESTS DE L'AUTHENTIFICATION.
 *
 * Deux surfaces, et la seconde est la plus dangereuse du projet.
 *
 * ── 1. LES FOURNISSEURS ──────────────────────────────────────────────────────
 * Ni Google ni Apple n'étaient activés côté Supabase le 22/08/2026, et leurs deux
 * boutons trônaient en haut de la page de connexion. Ils ne s'affichent plus que
 * déclarés. Ce qu'on vérifie ici : qu'une variable d'environnement mal recopiée — casse,
 * espaces, nom inconnu, ponctuation — ne fasse pas réapparaître un bouton mort.
 *
 * ── 2. L'E-MAIL DE CONFIRMATION ──────────────────────────────────────────────
 * ⚠️ IL PORTE UN LIEN À USAGE UNIQUE, INJECTÉ DANS DU HTML, et il part vers une boîte
 * qu'on ne contrôle pas. C'est exactement la forme d'une faille d'injection : une
 * apostrophe mal échappée dans un attribut `href` et le lien casse ; un chevron non
 * échappé et on colle du balisage arbitraire dans un message signé de notre nom.
 * Le lien vient de Supabase, donc d'une source de confiance — mais un jour il viendra
 * d'ailleurs, et ce test sera là.
 *
 *   npx tsx tests/auth.crash.test.ts
 */
import { fournisseursActifs } from "../src/lib/auth/fournisseurs";
import { emailInscription } from "../src/lib/auth/emailConfirmation";
import { ech } from "../src/lib/newsletter/gabarit";

let ko = 0;
const fail = (quoi: string, detail: string) => { ko++; console.log(`  ✗ ${quoi}\n      ${detail}`); };

// ── 1. Fournisseurs : ce qui ne doit JAMAIS produire de bouton ───────────────
const NON: [string, string][] = [
  ["absent", ""],
  ["espaces seuls", "   "],
  ["virgules seules", ",,,"],
  ["fournisseur inconnu", "github"],
  ["presque bon", "googl"],
  ["injection", "google'; DROP TABLE users;--"],
  ["chevrons", "<script>alert(1)</script>"],
  ["très long", "x".repeat(5000)],
  ["saut de ligne", "google\nfacebook"],
];
for (const [nom, v] of NON) {
  const r = fournisseursActifs(v);
  const inattendus = r.filter((p) => p !== "google" && p !== "apple");
  if (inattendus.length) fail(`fournisseur fabriqué depuis « ${nom} »`, inattendus.join(", "));
  if (nom !== "saut de ligne" && r.length) fail(`bouton affiché pour « ${nom} »`, r.join(", "));
}
// Ce qui DOIT marcher, malgré une saisie humaine.
for (const [v, attendu] of [["google", 1], ["GOOGLE", 1], [" google , apple ", 2], ["apple,google", 2]] as [string, number][]) {
  if (fournisseursActifs(v).length !== attendu) fail(`« ${v} » devrait donner ${attendu} fournisseur(s)`, String(fournisseursActifs(v)));
}
console.log(`  ✓ fournisseurs : ${NON.length} entrées hostiles, aucun bouton fabriqué`);

// ── 2. E-mail de confirmation : rien ne s'échappe du gabarit ────────────────
const LIENS: [string, string][] = [
  ["normal", "https://x.supabase.co/auth/v1/verify?token=abc&type=signup&redirect_to=https://pacevo.app"],
  ["guillemet", 'https://x.fr/verify?t=a"onload="alert(1)'],
  ["chevrons", "https://x.fr/verify?t=<script>alert(1)</script>"],
  ["esperluette", "https://x.fr/verify?a=1&b=2&c=3"],
  ["apostrophe", "https://x.fr/verify?t=a'b"],
  ["très long", "https://x.fr/verify?t=" + "z".repeat(4000)],
  ["vide", ""],
];
const LANGS = ["fr", "en", "de", "es", "pt", "xx", ""];
let rendus = 0;
for (const lg of LANGS) {
  for (const [nom, lien] of LIENS) {
    let e: ReturnType<typeof emailInscription>;
    try { e = emailInscription(lg, "https://pacevo.app", lien); }
    catch (err) { fail(`exception sur ${lg}/${nom}`, String((err as Error).message).slice(0, 90)); continue; }
    rendus++;

    // ⚠️ LE CŒUR : aucun balisage exécutable ne doit survivre au gabarit.
    if (/<script/i.test(e.html)) fail(`balise script injectée (${lg}/${nom})`, "le lien n'est pas échappé");

    // ⚠️ MA PREMIÈRE ASSERTION ÉTAIT FAUSSE, et il vaut la peine de dire pourquoi : elle
    // cherchait le motif `on…=` dans le HTML brut. Or un lien contenant `"onload="`
    // ressort en `&quot;onload=&quot;` — le texte « onload= » est bien là, mais les
    // guillemets sont échappés, donc l'attribut ne se ferme pas et rien ne s'exécute.
    // Le test criait à l'injection sur un gabarit parfaitement sûr. Ce qu'il faut
    // vérifier n'est pas l'ABSENCE d'un mot, c'est que l'échappement a EU LIEU : la
    // chaîne brute ne doit pas apparaître, sa version échappée doit.
    if (lien && /["<>&]/.test(lien)) {
      if (e.html.includes(lien)) fail(`lien inséré SANS échappement (${lg}/${nom})`, lien.slice(0, 60));
      if (!e.html.includes(ech(lien))) fail(`lien absent après échappement (${lg}/${nom})`, lien.slice(0, 60));
    }

    // Le gabarit doit rester complet quoi qu'on lui donne.
    if (!e.objet.trim()) fail(`objet vide (${lg}/${nom})`, "un e-mail sans objet part en indésirable");
    if (e.html.includes("undefined")) fail(`« undefined » dans le message (${lg}/${nom})`, "une clé manque");
    if (!e.html.includes("/icon.png")) fail(`logo absent (${lg}/${nom})`, "");
    if (!e.texte.trim()) fail(`version texte vide (${lg}/${nom})`, "certains clients n'affichent pas le HTML");

    // Une langue inconnue retombe sur le français, jamais sur du vide.
    if (!["fr", "en", "de", "es", "pt"].includes(lg) && e.objet !== emailInscription("fr", "https://pacevo.app", lien).objet) {
      fail(`langue inconnue « ${lg} » sans repli français`, e.objet);
    }
  }
}
console.log(`  ✓ e-mail : ${rendus} rendus (${LANGS.length} langues × ${LIENS.length} liens), aucune injection`);

console.log(`\n${NON.length + rendus} cas hostiles · ${ko} problème(s)`);
process.exit(ko ? 1 : 0);
