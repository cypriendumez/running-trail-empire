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
import { readFileSync } from "node:fs";
import { suggestionDomaine, distance, domaineRecoitDuCourrier, FOURNISSEURS_COURANTS } from "../src/lib/auth/domaineCourrier";
import { AUTH } from "../src/components/auth/authI18n";

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

// ── Le domaine de l'adresse reçoit-il du courrier ? ─────────────────────────
// ⚠️ L'inscription répondait « c'est envoyé » à N'IMPORTE QUELLE adresse bien formée :
// « marie@gmial.com » créait un compte et la personne attendait devant « Vérifiez votre
// email » un message parti vers un domaine qui n'existe pas. Personne ne peut savoir si
// une BOÎTE existe (les fournisseurs ne répondent pas), mais un DOMAINE sans serveur de
// courrier, si — et c'est là que tombent les fautes de frappe.
(async () => {
  let n = 0;
  const attendu: [string, string | null][] = [
    ["gmial.com", "gmail.com"], ["gmal.com", "gmail.com"], ["outlok.fr", "outlook.fr"], ["hotmal.fr", "hotmail.fr"],
    ["yaho.fr", "yahoo.fr"], ["orang.fr", "orange.fr"], ["icloud.co", "icloud.com"],
    // Pas de suggestion : le domaine est exact, ou trop loin pour être une faute de frappe.
    ["gmail.com", null], ["outlook.fr", null], ["pacevo.fr", null], ["exemple.org", null], ["", null],
    // ⚠️ outlook.fr et outlook.com sont à trois lettres : deux adresses légitimes, on ne
    // « corrige » pas quelqu'un qui a bien tapé la sienne.
    ["outlook.com", null],
    // ⚠️ À trois lettres, une adresse LÉGITIME hors de la liste (« orange.com » est le
    // domaine de l'entreprise, pas des boîtes « orange.fr ») serait « corrigée » à tort.
    // C'est ce cas qui garde le seuil à deux : la mutation « dist <= 3 » le rougit.
    ["orange.com", null], ["gmail.fr", null],
  ];
  for (const [d, s] of attendu) {
    n++;
    const got = suggestionDomaine(d);
    if (got !== s) fail(`suggestion pour « ${d} »`, `attendu ${s}, obtenu ${got}`);
  }
  if (distance("gmail.com", "gmial.com") !== 2) fail("distance de Levenshtein", `gmail/gmial = ${distance("gmail.com", "gmial.com")}`);
  if (distance("abc", "abc") !== 0) fail("distance nulle", "");
  for (const f of FOURNISSEURS_COURANTS) if (suggestionDomaine(f) !== null) fail(`un fournisseur courant se voit suggérer autre chose : ${f}`, "");

  // Le DNS, en vrai : un domaine qui reçoit, un qui n'existe pas, un délai qui ne bloque pas.
  const oui = await domaineRecoitDuCourrier("gmail.com");
  if (oui !== "oui") fail("gmail.com devrait recevoir du courrier", `obtenu ${oui}`);
  const non = await domaineRecoitDuCourrier("ce-domaine-n-existe-vraiment-pas-8f3a2.fr");
  if (non !== "non") fail("un domaine inexistant devrait rendre « non »", `obtenu ${non}`);
  const mal = await domaineRecoitDuCourrier("pas un domaine");
  if (mal !== "non") fail("une chaîne qui n'est pas un domaine devrait rendre « non »", `obtenu ${mal}`);
  const t0 = Date.now(); const lent = await domaineRecoitDuCourrier("gmail.com", 1); const dt = Date.now() - t0;
  if (lent === "non" || dt > 500) fail("le délai ne borne pas la requête DNS", `${lent} en ${dt} ms`);
  n += 4;

  // La route s'en sert AVANT de créer le compte, et l'écran affiche la réponse.
  const route = readFileSync("src/app/api/auth/confirmation/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  const iCtrl = route.indexOf("domaineRecoitDuCourrier("), iCreer = route.indexOf("generateLink(");
  if (iCtrl < 0) fail("la route d'inscription ne contrôle plus le domaine", "");
  else if (iCreer > 0 && iCtrl > iCreer) fail("la route crée le compte AVANT de contrôler le domaine", "un compte fantôme par faute de frappe");
  if (!/domaine_sans_courrier/.test(route)) fail("la route ne nomme pas l'erreur de domaine", "l'écran ne peut pas la distinguer d'un mot de passe trop court");
  const page = readFileSync("src/app/(auth)/signup/page.tsx", "utf8");
  if (!/domaine_sans_courrier/.test(page)) fail("la page d'inscription ignore l'erreur de domaine", "l'athlète verrait « mot de passe trop court »");
  if (!/L\.didYouMean/.test(page) || !/L\.wrongEmail/.test(page)) fail("la page n'offre ni la correction en un clic ni « mauvaise adresse »", "");
  // Les quatre libellés existent dans les cinq langues, avec leurs jetons.
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    const s = AUTH[lg].signup;
    if (!s.domainDead?.includes("{domain}")) fail(`${lg} : domainDead sans {domain}`, s.domainDead ?? "(absent)");
    if (!s.didYouMean?.includes("{suggestion}")) fail(`${lg} : didYouMean sans {suggestion}`, s.didYouMean ?? "(absent)");
    if (!s.wrongEmail || !s.notArriving) fail(`${lg} : wrongEmail / notArriving absents`, "");
  }
  n += 3;
  console.log(`  ✓ domaine de l'adresse : ${n} cas (suggestions, DNS réel, route, écran, 5 langues)`);

  console.log(`\n${NON.length + rendus + n} cas hostiles · ${ko} problème(s)`);
  process.exit(ko ? 1 : 0);
})();
