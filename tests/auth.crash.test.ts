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
  if ((loginPage.match(/messageErreurConnexion\(/g) ?? []).length < 2) fail("la page de connexion n'appelle pas le traducteur aux deux échecs", "");
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
  // Anti-annuaire : la route ne renvoie jamais autre chose que { ok: true }.
  if (/ok:\s*false/.test(reset)) fail("la route de reset révèle un cas d'échec", "le formulaire deviendrait un annuaire");
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

  console.log(`\n${NON.length + rendus + n + m + c + z + a} cas hostiles · ${ko} problème(s)`);
  process.exit(ko ? 1 : 0);
})();
