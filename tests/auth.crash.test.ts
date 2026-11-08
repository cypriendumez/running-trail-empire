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
import { emailInscription, emailReinitialisation } from "../src/lib/auth/emailConfirmation";
import { statutDepuisUtilisateur, sansMotDePasse, fournisseurDe } from "../src/lib/auth/statut";
import { autoriser } from "../src/lib/auth/limiteur";
import { aConsenti, champsConsentement, CONSENTEMENT_EFFACE, COOKIE_ACCORD } from "../src/lib/auth/consentement";
import { ech } from "../src/lib/newsletter/gabarit";
import { readFileSync } from "node:fs";
import { suggestionDomaine, distance, domaineRecoitDuCourrier, FOURNISSEURS_COURANTS } from "../src/lib/auth/domaineCourrier";
import { AUTH } from "../src/components/auth/authI18n";
import { messageErreurConnexion } from "../src/lib/auth/messageErreur";

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
  // ⚠️ « gmial.com » et « outlok.fr » EXISTENT (squatteurs de fautes de frappe, l'un avec
  // un serveur de courrier) : le DNS les laisse passer. La suggestion doit donc parler
  // AVANT le DNS, et pouvoir être confirmée si l'adresse était voulue.
  const iSugg = route.indexOf("suggestionDomaine("), iDns = route.indexOf("domaineRecoitDuCourrier(");
  if (iSugg < 0 || iSugg > iDns) fail("la suggestion de domaine ne précède pas le DNS", "un domaine squatté passerait sans question");
  if (!/domaine_douteux/.test(route) || !/domaineConfirme/.test(route)) fail("la route ne sait pas demander confirmation d'un domaine douteux", "");
  const page = readFileSync("src/app/(auth)/signup/page.tsx", "utf8");
  if (!/domaine_sans_courrier/.test(page)) fail("la page d'inscription ignore l'erreur de domaine", "l'athlète verrait « mot de passe trop court »");
  if (!/domaine_douteux/.test(page) || !/L\.keepEmail/.test(page)) fail("la page ne propose pas de garder l'adresse douteuse", "quelqu'un dont le domaine ressemble à gmail.com ne pourrait plus s'inscrire");
  if (!/L\.didYouMean/.test(page) || !/L\.wrongEmail/.test(page)) fail("la page n'offre ni la correction en un clic ni « mauvaise adresse »", "");
  // Les quatre libellés existent dans les cinq langues, avec leurs jetons.
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    const s = AUTH[lg].signup;
    if (!s.domainDead?.includes("{domain}")) fail(`${lg} : domainDead sans {domain}`, s.domainDead ?? "(absent)");
    if (!s.didYouMean?.includes("{suggestion}")) fail(`${lg} : didYouMean sans {suggestion}`, s.didYouMean ?? "(absent)");
    if (!s.wrongEmail || !s.notArriving) fail(`${lg} : wrongEmail / notArriving absents`, "");
    if (!s.domainDoubt?.includes("{domain}") || !s.keepEmail?.includes("{email}")) fail(`${lg} : domainDoubt / keepEmail sans jeton`, "");
  }
  n += 3;
  console.log(`  ✓ domaine de l'adresse : ${n} cas (suggestions, DNS réel, route, écran, 5 langues)`);

  // ── LE LIEN DE L'E-MAIL DOIT VISER NOTRE ROUTE, AVEC LE JETON ────────────────────────
  // ⚠️ Le 13/09/2026, une inscription RÉUSSIE affichait « lien invalide ». La route
  // envoyait `action_link`, qui passe par `supabase.co/auth/v1/verify` : Supabase consomme
  // le jeton, confirme, connecte… puis renvoie sur `/auth/confirm` avec la session dans un
  // `#fragment` que le serveur ne voit pas. Sans `token_hash`, `/auth/confirm` répond
  // `/login?error=confirm` ; le second clic, logique après ce message, tombe sur
  // `otp_expired`. Le lien doit se construire sur `hashed_token`, et le bouton « Renvoyer »
  // doit produire le même lien (pas le gabarit Supabase, invisible aux tests).
  let m = 0;
  if (/action_link/.test(route)) fail("la route envoie encore `action_link` (passe par supabase.co/verify)", "confirmation réussie → « lien invalide »");
  if (!/hashed_token/.test(route)) fail("la route ne lit pas `hashed_token`", "sans lui, pas de lien vérifiable par /auth/confirm");
  const lien = route.match(/`\$\{BASE\}\/auth\/confirm\?([^`]*)`/);
  if (!lien) fail("le lien de confirmation ne vise pas `${BASE}/auth/confirm?…`", "");
  else {
    for (const attendu of ["token_hash=", "type=signup", "next=/onboarding"]) {
      if (!lien[1].includes(attendu)) fail(`le lien de confirmation n'a pas \`${attendu}\``, lien[1]);
    }
  }
  // `/auth/confirm` accepte bien `type=signup` (il déclenche aussi l'alerte « nouvel inscrit »).
  const confirm = readFileSync("src/app/auth/confirm/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  if (!/verifyOtp\(\{ type, token_hash \}\)/.test(confirm)) fail("/auth/confirm ne vérifie plus le token_hash", "");
  if (!/type === "signup"/.test(confirm)) fail("/auth/confirm n'alerte plus l'éditeur pour `type=signup`", "");
  const pageSansComm = page.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  if (/supabase\.auth\.resend\(/.test(pageSansComm)) fail("« Renvoyer » passe par le gabarit Supabase", "un lien différent de celui de l'inscription, jamais testé");
  if ((pageSansComm.match(/fetch\("\/api\/auth\/confirmation"/g) ?? []).length < 2) fail("« Renvoyer » ne repasse pas par /api/auth/confirmation", "");
  m += 7;
  console.log(`  ✓ lien de confirmation : ${m} cas (hashed_token, forme du lien, /auth/confirm, renvoi)`);

  // ── L'ÉCHEC DE CONNEXION DOIT PARLER FRANÇAIS, PAS JARGON ANGLAIS ─────────────────────
  // ⚠️ Le 13/09/2026, un mauvais mot de passe affichait le toast « Invalid login
  // credentials » (chaîne brute de Supabase) : un coureur francophone ne sait pas si son
  // mot de passe est faux ou si le site est cassé. Chaque cause réelle rend un libellé
  // TRADUIT, et rien ne laisse repasser l'anglais brut (repli générique traduit).
  let c = 0;
  const Lfr = AUTH.fr.login;
  const cas: [string, string][] = [
    ["Invalid login credentials", Lfr.errBadCredentials],
    ["Email not confirmed", Lfr.errUnconfirmed],
    ["Request rate limit reached", Lfr.errRate],
    ["Too many requests", Lfr.errRate],
    ["Something exploded on our side", Lfr.errGeneric],
    ["", Lfr.errGeneric],
  ];
  for (const [brut, attendu] of cas) {
    const rendu = messageErreurConnexion(brut, Lfr);
    if (rendu !== attendu) fail(`« ${brut || "(vide)"} » mal traduit`, `obtenu « ${rendu} », attendu « ${attendu} »`);
    if (/invalid login|not confirmed|rate limit/i.test(rendu)) fail(`« ${brut} » laisse passer l'anglais brut`, rendu);
    c++;
  }
  // Les trois libellés existent dans les cinq langues, distincts du générique.
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    const l = AUTH[lg].login;
    for (const k of ["errBadCredentials", "errUnconfirmed", "errRate"] as const) {
      if (!l[k] || l[k].length < 8) fail(`${lg} : ${k} absent`, l[k] ?? "(absent)");
    }
    if (l.errBadCredentials === l.errGeneric) fail(`${lg} : errBadCredentials identique au générique`, "un mot de passe faux serait indiscernable d'une panne");
    c++;
  }
  // La page de connexion appelle le traducteur, et n'affiche plus jamais error.message brut.
  const loginPage = readFileSync("src/app/(auth)/login/page.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  // Depuis le 11/10/2026, l'échec OAuth vit dans le composant partagé `BoutonsOAuth` (mêmes
  // boutons sur la connexion et l'inscription) : le traducteur doit y être, ET dans la page.
  const boutonsOAuth = readFileSync("src/components/auth/BoutonsOAuth.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  if (!/messageErreurConnexion\(/.test(loginPage)) fail("la page de connexion n'appelle pas le traducteur après un échec", "");
  if (!/messageErreurConnexion\(/.test(boutonsOAuth)) fail("les boutons Google/Apple n'appellent pas le traducteur", "l'anglais de Supabase reviendrait sur un échec OAuth");
  if (/toast\.error\(error\.message\)/.test(boutonsOAuth)) fail("les boutons OAuth affichent error.message brut", "");
  if (/toast\.error\(error\.message\)/.test(loginPage)) fail("la page de connexion affiche encore error.message brut", "l'anglais de Supabase reviendrait");
  c += 2;
  console.log(`  ✓ échec de connexion traduit : ${c} cas (6 causes, 5 langues, page)`);

  // ── LA RÉINITIALISATION DOIT ÊTRE NOTRE E-MAIL FRANÇAIS, PAS CELUI DE SUPABASE ────────
  // ⚠️ Le 13/09/2026, `resetPasswordForEmail()` envoyait le gabarit anglais sans logo de
  // Supabase (« Reset Your Password »), tombé dans les indésirables. Comme l'inscription,
  // le reset passe par NOTRE route (`/api/auth/reset`) : e-mail français avec logo, lien
  // `token_hash` de type `recovery` vers /reset-password.
  let z = 0;
  for (const lg of ["fr", "en", "de", "es", "pt", "xx"] as const) {
    let e: ReturnType<typeof emailReinitialisation>;
    try { e = emailReinitialisation(lg, "https://pacevo.fr", 'https://x.fr/c?t=<a"&b'); }
    catch (err) { fail(`reset : exception sur ${lg}`, String((err as Error).message).slice(0, 90)); continue; }
    if (/<script/i.test(e.html) || e.html.includes('t=<a"&b')) fail(`reset : lien non échappé (${lg})`, "");
    if (!e.html.includes("/icon.png")) fail(`reset : logo absent (${lg})`, "");
    if (!e.objet.trim() || !e.texte.trim()) fail(`reset : objet ou texte vide (${lg})`, "");
    z++;
  }
  // Le message de reset ne doit pas être celui d'inscription (sinon on a copié la mauvaise clé).
  if (emailReinitialisation("fr", "https://pacevo.fr", "https://x.fr/c").objet === emailInscription("fr", "https://pacevo.fr", "https://x.fr/c").objet) {
    fail("reset : objet identique à l'inscription", "un coureur qui réinitialise lirait « Confirme ton adresse »");
  }
  // Une langue inconnue retombe sur le français.
  if (emailReinitialisation("xx", "https://pacevo.fr", "https://x.fr/c").objet !== emailReinitialisation("fr", "https://pacevo.fr", "https://x.fr/c").objet) {
    fail("reset : langue inconnue sans repli français", "");
  }
  // La route : lien recovery sur hashed_token, jamais action_link, vers /reset-password.
  const reset = readFileSync("src/app/api/auth/reset/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  if (/action_link/.test(reset)) fail("la route de reset envoie `action_link` (passe par supabase.co/verify)", "");
  if (!/hashed_token/.test(reset)) fail("la route de reset ne lit pas `hashed_token`", "");
  if (!/type:\s*"recovery"/.test(reset)) fail("la route de reset ne génère pas un lien `recovery`", "");
  if (!/envoyerEmail\("reinitialisation"/.test(reset)) fail("la route de reset ne passe pas par la porte unique d'envoi", "");
  const lienReset = reset.match(/`\$\{BASE\}\/auth\/confirm\?([^`]*)`/);
  if (!lienReset) fail("le lien de reset ne vise pas `${BASE}/auth/confirm?…`", "");
  else for (const attendu of ["token_hash=", "type=recovery", "next=/reset-password"]) {
    if (!lienReset[1].includes(attendu)) fail(`le lien de reset n'a pas \`${attendu}\``, lienReset[1]);
  }
  // ⚠️ RÈGLE CHANGÉE LE 11/10/2026 (décision de Cyprien, voir lib/auth/statut) : une adresse
  // SANS compte est dite à l'écran, au lieu d'un « envoyé » qui laissait attendre en vain.
  // En échange, la route est bornée par le limiteur de débit.
  if (!/error:\s*"aucun_compte"/.test(reset)) fail("la route de reset ne dit pas « aucun compte »", "l'écran afficherait « envoyé » pour une adresse inconnue");
  if (!/autoriser\w*\([^`]*`reset:/.test(reset)) fail("la route de reset n'est pas bornée par le limiteur", "on pourrait tester des milliers d'adresses");
  if (!/if \(!envoi\.ok\)/.test(reset)) fail("la route de reset répond « envoyé » même quand Resend refuse", "");
  // /auth/confirm : une récupération ne doit PAS passer par /onboarding (nested sous signup/email).
  // (`confirm` est déjà lu plus haut, dans le bloc « lien de confirmation ».)
  const iGarde = confirm.indexOf('type === "signup"'), iOnb = confirm.indexOf("/onboarding");
  if (iGarde < 0) fail("/auth/confirm ne distingue plus le type d'OTP", "");
  if (iOnb >= 0 && iOnb < iGarde) fail("/auth/confirm envoie une récupération vers /onboarding", "un reset n'atteindrait jamais /reset-password");
  // La page mot-de-passe-oublié appelle notre route, plus le gabarit Supabase.
  const forgot = readFileSync("src/app/(auth)/forgot-password/page.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  if (/resetPasswordForEmail\(/.test(forgot)) fail("« mot de passe oublié » passe encore par le gabarit Supabase", "e-mail anglais sans logo, en indésirable");
  if (!/fetch\("\/api\/auth\/reset"/.test(forgot)) fail("« mot de passe oublié » n'appelle pas /api/auth/reset", "");
  z += 8;
  console.log(`  ✓ réinitialisation : ${z} cas (e-mail 6 langues, route recovery, /auth/confirm, page)`);

  // ── L'ALERTE « NOUVEL INSCRIT » NE DOIT SONNER QU'UNE FOIS, ET POUR UN VRAI NOUVEAU ──
  // ⚠️ Le commentaire d'origine affirmait qu'on ne pouvait pas prévenir deux fois « le
  // lien étant à usage unique ». C'est faux : chaque lien REGÉNÉRÉ est un nouveau jeton.
  // Cyprien a reçu plusieurs « nouvel inscrit : Cyprien Dumez » pour son propre compte,
  // créé des mois plus tôt (23/09/2026) — une connexion par lien suffisait.
  let a = 0;
  const conf = readFileSync("src/app/auth/confirm/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  if (!/const creeA = Date\.parse\(String\(profil\?\.created_at \?\? ""\)\)/.test(conf))
    fail("l'âge du compte n'est plus lu", "une connexion des mois plus tard repasserait pour une inscription");
  if (!/Date\.now\(\) - creeA > FENETRE_INSCRIPTION_MS\) return;/.test(conf))
    fail("la fenêtre d'inscription ne borne plus l'alerte", "tout lien de connexion réveillerait l'alerte");
  if (!/\.eq\("type", "alerte_inscription"\)/.test(conf))
    fail("la trace d'alerte n'est plus relue", "un renvoi de confirmation referait sonner l'alerte");
  if (!/if \(dejaDit\) return;/.test(conf))
    fail("la trace est lue mais pas utilisée", "calculer un garde-fou sans s'en servir ne change rien");
  // ⚠️ La trace s'écrit AVANT l'envoi : après, un envoi lent puis rejoué laisserait
  // passer un doublon.
  const iTrace = conf.indexOf('type: "alerte_inscription", title:');
  const iEnvoi = conf.indexOf('await envoyerEmail("inscription"');
  if (iTrace < 0) fail("la trace d'alerte n'est plus écrite", "l'alerte pourrait sonner à chaque confirmation");
  else if (iEnvoi > 0 && iTrace > iEnvoi) fail("la trace s'écrit APRÈS l'envoi", "un envoi rejoué passerait deux fois");
  // Et le lien d'inscription de l'application reste un vrai lien d'inscription.
  if (!/type=signup&next=\/onboarding/.test(readFileSync("src/app/api/auth/confirmation/route.ts", "utf8")))
    fail("le lien de confirmation ne porte plus type=signup", "");
  a += 6;
  console.log(`  ✓ alerte nouvel inscrit : ${a} cas (âge du compte, trace unique, ordre d'écriture)`);

  // ── L'ÉCRAN DIT LA VÉRITÉ SUR LE COMPTE (décision du 11/10/2026) ──────────────────────
  // ⚠️ Le 11/10/2026, Cyprien s'inscrit avec une adresse déjà ouverte par Google : écran
  // « Vérifiez votre email », rien n'arrive ; puis la connexion par mot de passe répond
  // « e-mail ou mot de passe incorrect » sans dire que ce compte n'a PAS de mot de passe.
  // Désormais, comme dans les applications courantes : l'inscription dit « cette adresse a
  // déjà un compte » (+ Google / se connecter), la connexion dit la vraie cause, et les deux
  // pages offrent les mêmes boutons.
  let ex = 0;
  // a) Lecture d'un compte GoTrue → ce que l'écran peut dire.
  const comptes: [string, Parameters<typeof statutDepuisUtilisateur>[0], string, string][] = [
    ["aucun compte", null, "aucun", ""],
    ["Google seul (le cas de Cyprien)", { email_confirmed_at: "2026-08-23", app_metadata: { provider: "google", providers: ["google"] } }, "actif", "google"],
    ["mot de passe jamais confirmé", { email_confirmed_at: null, app_metadata: { provider: "email", providers: ["email"] } }, "a_confirmer", "mot_de_passe"],
    ["mot de passe + Google", { email_confirmed_at: "2026-06-01", app_metadata: { providers: ["email", "google"] } }, "actif", "mot_de_passe,google"],
    ["fournisseur inconnu ignoré", { confirmed_at: "2026-06-01", app_metadata: { providers: ["github", "email", "email"] } }, "actif", "mot_de_passe"],
    ["providers absent → provider", { email_confirmed_at: "2026-06-01", app_metadata: { provider: "apple" } }, "actif", "apple"],
  ];
  for (const [nom, u, compte, methodes] of comptes) {
    const st = statutDepuisUtilisateur(u);
    if (st.compte !== compte || st.methodes.join(",") !== methodes) fail(`statut « ${nom} »`, `obtenu ${st.compte} [${st.methodes}] , attendu ${compte} [${methodes}]`);
    ex++;
  }
  if (!sansMotDePasse(["google"]) || sansMotDePasse(["mot_de_passe", "google"]) || sansMotDePasse([])) fail("sansMotDePasse se trompe", "un compte Google se verrait proposer « mot de passe incorrect »");
  if (fournisseurDe(["apple", "google"]) !== "google" || fournisseurDe(["mot_de_passe"]) !== null) fail("fournisseurDe se trompe", "");
  // b) Le limiteur borne vraiment, puis oublie.
  const tLim = 1_000_000;
  const k = `test:${Math.random()}`;
  const passes = [0, 1, 2, 3].map((d) => autoriser(k, 3, 60_000, tLim + d));
  if (passes.join() !== "true,true,true,false") fail("le limiteur ne bloque pas au-delà du maximum", passes.join());
  if (!autoriser(k, 3, 60_000, tLim + 60_001)) fail("le limiteur ne libère pas après la fenêtre", "");
  if (!autoriser(`${k}:autre`, 3, 60_000, tLim + 3)) fail("le limiteur mélange deux adresses IP", "");
  ex += 4;
  // c) La route d'inscription DIT « compte existant », avec les méthodes, et ne ment plus.
  if (!/statut\?\.compte === "actif"[\s\S]{0,160}error: "compte_existant", methodes: statut\.methodes/.test(route)) fail("l'inscription ne dit pas « compte existant » avec ses méthodes", "écran « vérifiez votre email », boîte vide");
  if (!/error\?\.code === "email_exists"[\s\S]{0,120}"compte_existant"/.test(route)) fail("le refus `email_exists` de Supabase n'est pas traduit en « compte existant »", "");
  if (/return ok\(\)/.test(route)) fail("la route d'inscription a encore une sortie « ok » muette", "");
  if (!/if \(!envoi\.ok\)/.test(route)) fail("l'inscription répond « vérifiez votre email » même quand Resend refuse", "");
  if (!/autoriser\w*\([^`]*`inscription:/.test(route)) fail("l'inscription n'est pas bornée par le limiteur", "");
  // Le renvoi depuis la connexion ne touche ni au nom ni au mot de passe d'un compte existant.
  if (!/envoyerConfirmation\(adresse, null, null,/.test(route)) fail("le renvoi transmet un nom ou un mot de passe", "il écraserait le nom du compte");
  if (!/statut\.compte !== "a_confirmer"/.test(route)) fail("le renvoi ne se limite pas aux comptes à confirmer", "");
  // La recherche passe par la route dédiée, bornée elle aussi, et ne rend que l'état.
  const routeStatut = readFileSync("src/app/api/auth/statut/route.ts", "utf8");
  if (!/autoriser\w*\([^`]*`statut:/.test(routeStatut)) fail("/api/auth/statut n'est pas bornée par le limiteur", "un script listerait les inscrits");
  const chercheur = readFileSync("src/lib/auth/statutCompte.ts", "utf8");
  if (!/toLowerCase\(\) === cible/.test(chercheur)) fail("la recherche n'exige pas l'égalité EXACTE de l'adresse", "le filtre LIKE de GoTrue ramène aussi « xcyprien@… »");
  ex += 9;
  // d) Les pages : mêmes boutons des deux côtés, l'encadré qui dit quoi faire, pas d'adresse dans l'URL.
  const lire = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  const [pLogin, pSignup, pForgot, pAide] = ["src/app/(auth)/login/page.tsx", "src/app/(auth)/signup/page.tsx", "src/app/(auth)/forgot-password/page.tsx", "src/components/auth/AideCompte.tsx"].map(lire);
  if (!/<BoutonsOAuth/.test(pLogin) || !/<BoutonsOAuth/.test(pSignup)) fail("la connexion et l'inscription n'offrent pas les mêmes boutons", "« fais vraiment les mêmes modes » (Cyprien, 11/10/2026)");
  if (!/<BoutonsOAuth[^>]*avant=\{accordDonne\}/.test(pSignup)) fail("« Continuer avec Google » sur l'inscription contourne la case d'accord", "consentement aux données de santé non recueilli");
  if (!/fetch\("\/api\/auth\/statut"/.test(pLogin)) fail("la connexion ne cherche pas la vraie cause de l'échec", "« incorrect » pour un compte qui s'ouvre avec Google");
  if (!/onBlur=\{verifierAdresse\}/.test(pSignup)) fail("l'inscription n'avertit pas dès la saisie de l'adresse", "");
  if (!/"compte_existant"/.test(pSignup) || !/<AideCompte/.test(pSignup)) fail("l'inscription n'affiche pas « compte existant »", "");
  if (!/"aucun_compte"/.test(pForgot) || !/<AideCompte/.test(pForgot)) fail("« mot de passe oublié » n'affiche pas « aucun compte »", "");
  for (const c of ["compte_existant", "aucun_compte", "via_oauth", "mauvais_mot_de_passe", "a_confirmer"]) {
    if (!new RegExp(`case "${c}"`).test(pAide)) fail(`l'encadré ne sait pas dire « ${c} »`, "");
  }
  for (const [nom, src] of [["connexion", pLogin], ["inscription", pSignup], ["oubli", pForgot], ["encadré", pAide]] as const) {
    if (/[?&]email=/.test(src)) fail(`${nom} : l'adresse passe dans l'URL`, "historique, journaux, Referer — voir lib/auth/emailMemorise");
  }
  ex += 11;
  // e) Les textes existent dans les 5 langues, avec les mêmes jetons que le français.
  const jetons = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
  for (const lg of ["en", "de", "es", "pt"] as const) {
    for (const [cle, fr] of Object.entries(AUTH.fr.aide)) {
      const v = (AUTH[lg].aide as Record<string, string>)[cle];
      if (!v || v.length < 3) fail(`${lg} : aide.${cle} absent`, "");
      else if (jetons(v) !== jetons(fr)) fail(`${lg} : aide.${cle} n'a pas les jetons du français`, `${jetons(v)} ≠ ${jetons(fr)}`);
    }
  }
  ex++;
  // f) Le premier mot de passe d'un compte Google : un e-mail qui ne parle pas de « réinitialiser ».
  for (const lg of ["fr", "en", "de", "es", "pt", "xx"]) {
    const e = emailReinitialisation(lg, "https://pacevo.fr", 'https://x.fr/c?t=<a"&b', "google");
    if (e.html.includes('t=<a"&b') || /<script/i.test(e.html)) fail(`premier mot de passe : lien non échappé (${lg})`, "");
    if (!e.texte.includes("Google") || /\{fournisseur\}/.test(e.html + e.texte)) fail(`premier mot de passe : fournisseur absent ou jeton brut (${lg})`, e.texte.slice(0, 120));
    ex++;
  }
  if (emailReinitialisation("fr", "https://pacevo.fr", "https://x.fr/c", "google").objet === emailReinitialisation("fr", "https://pacevo.fr", "https://x.fr/c").objet) {
    fail("premier mot de passe : même objet que « réinitialise »", "faux pour qui n'en a jamais eu");
  }
  if (!/sansMotDePasse\(methodes\) \? fournisseurDe\(methodes\)/.test(reset)) fail("la route de reset n'envoie pas la variante « premier mot de passe »", "");
  console.log(`  ✓ l'écran dit la vérité sur le compte : ${ex} cas (statut, limiteur, routes, pages, 5 langues, e-mail)`);

  // ── PRÉ-INSCRIPTION ET ACCORD AUX DONNÉES DE SANTÉ (11/10/2026) ──────────────────────
  // ⚠️ 1. GoTrue garde le PREMIER mot de passe d'un compte non confirmé qu'on réinscrit :
  // quiconque inscrivait l'adresse d'un autre récupérait le compte au clic du titulaire.
  // ⚠️ 2. « Continuer avec Google » depuis la connexion créait un compte sans jamais montrer
  // la case des données de santé, et l'accord n'était enregistré nulle part.
  let pc = 0;
  const lireC = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  // a) L'accord : présent seulement s'il est daté ; effacer met chaque champ à null.
  if (aConsenti(undefined) || aConsenti({}) || aConsenti({ consentement_sante_le: "" }) || aConsenti({ consentement_sante_le: null })) fail("aConsenti accepte un accord absent", "");
  if (!aConsenti(champsConsentement("ecran"))) fail("aConsenti refuse un accord enregistré", "");
  const ch = champsConsentement("google", new Date("2026-10-11T12:00:00Z"));
  if (ch.consentement_sante_via !== "google" || ch.consentement_sante_le !== "2026-10-11T12:00:00.000Z" || !ch.consentement_version) fail("champsConsentement incomplet", JSON.stringify(ch));
  if (Object.values(CONSENTEMENT_EFFACE).some((v) => v !== null) || Object.keys(CONSENTEMENT_EFFACE).sort().join() !== Object.keys(ch).sort().join()) fail("CONSENTEMENT_EFFACE n'efface pas tous les champs", "");
  pc += 4;
  // b) La route d'inscription : accord exigé et enregistré ; réinscription = mot de passe
  // neutralisé AVANT tout envoi, et aucun lien si la neutralisation échoue.
  const rC = lireC("src/app/api/auth/confirmation/route.ts");
  if (!/if \(accord !== true\)[\s\S]{0,120}"accord_requis"/.test(rC)) fail("l'inscription n'exige pas l'accord côté serveur", "un appel direct créerait un compte sans accord");
  if (!/champsConsentement\("inscription"\)/.test(rC)) fail("l'accord donné à l'inscription n'est pas enregistré", "");
  if (!/statut\?\.compte === "a_confirmer" \? "conteste"/.test(rC)) fail("une réinscription d'un compte non confirmé n'est pas « contestée »", "pré-inscription ouverte");
  if (!/motDePasseConnu === false \? "conteste"/.test(rC)) fail("le renvoi sans mot de passe connu ne neutralise rien", "pré-inscription par « renvoyer l'e-mail »");
  if (!/password: randomBytes\(/.test(rC) || !/mdp_a_choisir: true, \.\.\.CONSENTEMENT_EFFACE/.test(rC)) fail("le mot de passe contesté n'est pas rendu aléatoire, ou la marque/l'accord manquent", "");
  const iNeutre = rC.indexOf("password: randomBytes("), iEnvoiLien = rC.indexOf('envoyerEmail("confirmation"');
  if (iNeutre < 0 || iNeutre > iEnvoiLien) fail("la neutralisation vient APRÈS l'envoi du lien", "le lien confirmerait le mot de passe de l'intrus");
  if (!/if \(e\) \{[\s\S]{0,200}return NextResponse\.json\(\{ ok: false, error: "envoi_impossible" \}/.test(rC)) fail("un échec de neutralisation laisse partir le lien", "");
  // ⚠️ Changer le mot de passe REMET À ZÉRO tous les jetons (GoTrue `UpdatePassword`) : le
  // lien doit être regénéré APRÈS la neutralisation, sinon le titulaire reçoit un lien mort
  // (vu sur un essai réel le 11/10/2026).
  const iRegen = rC.indexOf("({ data, error } = await generer())");
  if (iRegen < iNeutre || iRegen > iEnvoiLien) fail("le lien n'est pas regénéré entre la neutralisation et l'envoi", "le titulaire recevrait un lien « invalide ou expiré »");
  const iLien = rC.indexOf("const lien = `${BASE}/auth/confirm");
  if (iLien < iRegen) fail("le lien envoyé est construit AVANT la regénération", "");
  if (!/Date\.parse\(String\(compte\?\.created_at/.test(rC)) fail("un compte préexistant n'est pas détecté quand la recherche est en panne", "");
  pc += 10;
  // c) La confirmation fait choisir le mot de passe à celui qui clique.
  const rConf = lireC("src/app/auth/confirm/route.ts");
  if (!/user\.app_metadata\?\.mdp_a_choisir/.test(rConf) || !/lienChoixMotDePasse\(/.test(rConf)) fail("/auth/confirm ignore la marque « mot de passe à choisir »", "");
  if (!/type=recovery&next=\$\{encodeURIComponent\("\/reset-password\?apres=inscription"\)\}/.test(rConf)) fail("le lien de choix ne mène pas à /reset-password?apres=inscription", "");
  if (!/apres"\) === "inscription"/.test(lireC("src/app/(auth)/reset-password/page.tsx"))) fail("/reset-password n'explique pas pourquoi on choisit un mot de passe", "");
  pc += 3;
  // d) L'accord : enregistré au retour de Google si coché à l'inscription, sinon demandé ;
  // aucune page de l'application sans accord.
  const rCb = lireC("src/app/auth/callback/route.ts");
  if (!/!aConsenti\(user\.app_metadata\)/.test(rCb) || !/\/consentement\?next=/.test(rCb)) fail("le retour de Google ne demande pas l'accord", "compte Google ouvert depuis la connexion sans accord");
  if (!/COOKIE_ACCORD/.test(rCb) || !/champsConsentement\("google"\)/.test(rCb)) fail("l'accord coché avant Google n'est pas enregistré au retour", "");
  for (const f of ["src/app/dashboard/layout.tsx", "src/app/onboarding/layout.tsx"]) {
    if (!/if \([^)]*!aConsenti\(user\.app_metadata\)\) redirect\("\/consentement/.test(lireC(f))) fail(`${f} s'ouvre sans accord enregistré`, "");
  }
  const rApi = lireC("src/app/api/auth/consentement/route.ts");
  if (!/if \(!user\) return NextResponse\.json\(\{ ok: false, error: "non_connecte" \}/.test(rApi)) fail("/api/auth/consentement accepte un visiteur anonyme", "");
  if (!/accord !== true/.test(rApi) || !/updateUserById\(user\.id,/.test(rApi)) fail("/api/auth/consentement écrit sans geste explicite, ou pour un autre compte", "");
  const pCons = lireC("src/app/(auth)/consentement/page.tsx");
  if (!/useState\(false\)/.test(pCons) || !/disabled=\{!accord \|\| loading\}/.test(pCons)) fail("la case d'accord est pré-cochée ou le bouton passe sans elle", "un accord explicite est un geste");
  const pS = lireC("src/app/(auth)/signup/page.tsx");
  if (!/domaineConfirme, accord \}/.test(pS)) fail("l'inscription n'envoie pas l'accord au serveur", "");
  if (!/document\.cookie = `\$\{COOKIE_ACCORD\}=1/.test(pS)) fail("« Continuer avec Google » à l'inscription ne transmet pas la case cochée", "l'accord serait redemandé");
  if (!/renvoi: true, motDePasseConnu: true/.test(pS)) fail("« Renvoyer » de l'inscription repasse par la réinscription", "un simple renvoi imposerait de rechoisir le mot de passe");
  if (!/motDePasseConnu: false/.test(lireC("src/app/(auth)/login/page.tsx"))) fail("la connexion ne signale pas un mot de passe inconnu au renvoi", "");
  if (COOKIE_ACCORD !== "pacevo_accord") fail("le nom du cookie d'accord a changé sans la page", "");
  pc += 11;
  // e) Les textes, dans les 5 langues.
  for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
    const cs = AUTH[lg].consentement;
    if (!cs?.title || !cs.intro || !cs.submit || !cs.logout || !cs.erreur) fail(`${lg} : textes de /consentement incomplets`, "");
    if (!AUTH[lg].reset.apresInscription) fail(`${lg} : reset.apresInscription absent`, "");
  }
  pc++;
  console.log(`  ✓ pré-inscription & accord santé : ${pc} cas (neutralisation avant envoi, choix au clic, accord exigé/enregistré/redemandé)`);

  console.log(`\n${NON.length + rendus + n + m + c + z + a + ex + pc} cas hostiles · ${ko} problème(s)`);
  process.exit(ko ? 1 : 0);
})();
