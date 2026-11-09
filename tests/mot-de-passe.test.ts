/**
 * GARDE — les mots de passe CHOISIS sur Pacevo (inscription, lien « oublié », réglages).
 *
 * Défauts réels constatés le 08/11/2026 (audit du PDF « Ton app est une passoire ») :
 * - la seule règle était « 8 caractères », vérifiée par la page ; « password1 » passait ;
 * - aucun mot de passe déjà fuité n'était refusé : la protection de Supabase est réservée à
 *   l'offre Pro (alerte `auth_leaked_password_protection` du Security Advisor), et l'inscription
 *   passe par `generateLink`, que GoTrue v2.197 ne soumet à AUCUNE règle de mot de passe ;
 * - réinitialisation et réglages écrivaient le mot de passe depuis le navigateur, et les réglages
 *   ne demandaient pas le mot de passe actuel : une session laissée ouverte suffisait ;
 * - « mot de passe oublié » n'était limité que par adresse IP : une boîte pouvait être inondée.
 *
 *   npx tsx tests/mot-de-passe.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { verifierRegles, famillesDe, longueurDe } from "../src/lib/auth/reglesMotDePasse";
import { motDePasseFuite, controlerNouveauMotDePasse, empreinteSha1 } from "../src/lib/auth/motDePasseFuite";
import { sessionDeLienRecente } from "../src/lib/auth/sessionLien";
import { changerMotDePasse, type DependancesChangement } from "../src/lib/auth/changerMotDePasse";
import { cleParAdresse } from "../src/lib/auth/limiteur";
import { AUTH } from "../src/components/auth/authI18n";

let passes = 0;
const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(nom); console.log(`  ✗ ${nom}\n      ${e instanceof Error ? e.message : String(e)}`); }
}

/** Le source sans ses commentaires — sans couper les « :// » des URL. */
function code(f: string): string {
  return readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1")).join("\n");
}

/** Un faux service Have I Been Pwned : enregistre l'appel, répond le corps donné. */
function fauxHibp(corps: string | Error, statut = 200) {
  const appels: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), init });
    if (corps instanceof Error) throw corps;
    return new Response(corps, { status: statut });
  }) as typeof fetch;
  return { f, appels };
}

/** Un jeton d'accès factice portant la claim `amr` (signature non vérifiée : c'est l'appelant qui le fait). */
function jeton(amr: { method: string; timestamp: number }[]): string {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b({ alg: "HS256" })}.${b({ sub: "u1", amr })}.signature`;
}

const MDP_OK = "Foulee-Tempo-42";
const maintenant = () => Math.floor(Date.now() / 1000);

void (async () => {
  // ── 1. LES RÈGLES (le même module sert l'écran et le serveur) ─────────────────────────
  await test("règles : longueur, familles, phrase de passe, octets, adresse, marque", () => {
    assert.deepEqual(verifierRegles("Court1!"), ["longueur"], "7 caractères passent");
    assert.deepEqual(verifierRegles("password1"), ["longueur", "familles"], "« password1 » (9 caractères, 2 familles) passe");
    assert.deepEqual(verifierRegles("abcdefghijkl"), ["familles"], "12 minuscules passent sans 3 familles");
    assert.deepEqual(verifierRegles("Abcdefghijk1"), [], "12 caractères sur 3 familles refusés");
    assert.deepEqual(verifierRegles("abcdefghijklmno"), ["familles"], "15 minuscules : pas encore une phrase de passe");
    assert.deepEqual(verifierRegles("quatre mots au hasard"), [], "une phrase de passe de 21 caractères refusée");
    assert.deepEqual(verifierRegles("Abcdefgh1-".repeat(8)), ["trop_long"], "plus de 72 octets acceptés (bcrypt les ignorerait)");
    assert.deepEqual(verifierRegles("🏃🚴🏊🌲🔥🥇".repeat(4)), ["trop_long"], "24 emoji = 96 octets : la limite se compte en OCTETS");
    // Retour de la relecture du 08/11 : sans variété exigée, 16 « a » passaient pour une phrase de passe.
    assert.deepEqual(verifierRegles("a".repeat(16)), ["variete"], "16 fois la même lettre est accepté");
    assert.deepEqual(verifierRegles(" ".repeat(20)), ["variete"], "20 espaces sont acceptés");
    assert.deepEqual(verifierRegles("Aaaaaaaaaa1!"), ["variete"], "« Aaaaaaaaaa1! » (3 caractères différents) est accepté");
    assert.deepEqual(verifierRegles(""), ["longueur", "familles"], "un champ vide signale une variété manquante en plus");
    assert.equal(longueurDe("éééééééééééé"), 12, "un « é » compte pour un caractère");
    assert.equal(famillesDe("ÉCOLEécole"), 2, "les majuscules accentuées sont des majuscules");
    assert.deepEqual(verifierRegles("Cyprien-2026!", "cyprien@outlook.fr"), ["contient_email"], "l'identifiant de l'adresse est accepté");
    assert.deepEqual(verifierRegles("Abc-123456789x", "abc@x.fr"), [], "un identifiant de 3 lettres ne doit pas bloquer");
    assert.deepEqual(verifierRegles("MonPACEVO-2026"), ["contient_marque"], "« pacevo » dans le mot de passe est accepté");
  });

  // ── 2. HAVE I BEEN PWNED : k-anonymat, verdicts, panne ─────────────────────────────────
  await test("HIBP : seuls les 5 premiers caractères de l'empreinte sortent, avec remplissage", async () => {
    assert.equal(empreinteSha1("password"), "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8", "empreinte SHA-1 fausse");
    const { f, appels } = fauxHibp("1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365\r\n");
    assert.equal(await motDePasseFuite("password", { fetchImpl: f }), "fuite");
    assert.equal(appels.length, 1);
    assert.equal(appels[0].url, "https://api.pwnedpasswords.com/range/5BAA6", "l'URL interrogée n'est pas /range/<5 caractères>");
    assert.equal(new Headers(appels[0].init?.headers).get("Add-Padding"), "true", "pas de remplissage demandé");
    // Ni le mot de passe, ni la fin de son empreinte ne partent (URL, en-têtes, corps).
    const h = fauxHibp("");
    await motDePasseFuite(MDP_OK, { fetchImpl: h.f });
    const envoye = JSON.stringify({ url: h.appels[0].url, headers: [...new Headers(h.appels[0].init?.headers)], body: h.appels[0].init?.body ?? null });
    assert.ok(!envoye.includes(MDP_OK), "le mot de passe part chez Have I Been Pwned");
    assert.ok(!envoye.includes(empreinteSha1(MDP_OK).slice(5)), "la fin de l'empreinte part chez Have I Been Pwned");
    assert.ok(h.appels[0].url.endsWith(`/range/${empreinteSha1(MDP_OK).slice(0, 5)}`), "le préfixe envoyé n'est pas celui du mot de passe");
  });

  await test("HIBP : ligne de remplissage (compte 0) = sain ; absent = sain ; panne = inconnu", async () => {
    const suffixe = empreinteSha1(MDP_OK).slice(5);
    assert.equal(await motDePasseFuite(MDP_OK, { fetchImpl: fauxHibp(`${suffixe}:0\nAAAA:3`).f }), "sain", "une ligne de remplissage est prise pour une fuite");
    assert.equal(await motDePasseFuite(MDP_OK, { fetchImpl: fauxHibp(`${suffixe.toLowerCase()}:2`).f }), "fuite", "la casse du suffixe empêche la détection");
    assert.equal(await motDePasseFuite(MDP_OK, { fetchImpl: fauxHibp("0018A45C4D1DEF81644B54AB7F969B88D65:1").f }), "sain");
    assert.equal(await motDePasseFuite(MDP_OK, { fetchImpl: fauxHibp(new Error("ECONNRESET")).f }), "inconnu", "une coupure réseau n'est pas « inconnu »");
    assert.equal(await motDePasseFuite(MDP_OK, { fetchImpl: fauxHibp("", 503).f }), "inconnu", "un 503 n'est pas « inconnu »");
  });

  await test("contrôle complet : règles d'abord (sans réseau), fuite refusée, panne journalisée et dite", async () => {
    const h1 = fauxHibp("");
    const faible = await controlerNouveauMotDePasse("court", null, "/t", { fetchImpl: h1.f, journal: async () => {} });
    assert.equal(faible.ok, false);
    assert.equal(h1.appels.length, 0, "Have I Been Pwned interrogé pour un mot de passe déjà refusé par les règles");

    const fuite = await controlerNouveauMotDePasse(MDP_OK, null, "/t", { fetchImpl: fauxHibp(`${empreinteSha1(MDP_OK).slice(5)}:12`).f, journal: async () => {} });
    assert.deepEqual(fuite, { ok: false, error: "mot_de_passe_fuite" }, "un mot de passe fuité est accepté");

    const notes: string[] = [];
    const panne = await controlerNouveauMotDePasse(MDP_OK, null, "/t", { fetchImpl: fauxHibp(new Error("down")).f, journal: async (m) => { notes.push(m); } });
    assert.deepEqual(panne, { ok: true, fuiteVerifiee: false }, "service en panne : il faut accepter SANS prétendre avoir vérifié");
    assert.equal(notes.length, 1, "la panne de Have I Been Pwned n'est pas journalisée");

    const notes2: string[] = [];
    const sain = await controlerNouveauMotDePasse(MDP_OK, null, "/t", { fetchImpl: fauxHibp("").f, journal: async (m) => { notes2.push(m); } });
    assert.deepEqual(sain, { ok: true, fuiteVerifiee: true });
    assert.equal(notes2.length, 0, "un contrôle réussi écrit au journal");
  });

  // ── 3. LA SESSION NÉE D'UN LIEN E-MAIL (dispense du mot de passe actuel) ────────────────
  await test("session de lien : recovery/otp/magiclink dans l'heure seulement", () => {
    const t = maintenant();
    assert.equal(sessionDeLienRecente(jeton([{ method: "recovery", timestamp: t - 60 }]), t), true, "un lien de réinitialisation récent n'est pas reconnu");
    assert.equal(sessionDeLienRecente(jeton([{ method: "magiclink", timestamp: t - 600 }]), t), true);
    // GoTrue v2.197 (`verify.go`) marque `otp` TOUTE session née d'un lien vérifié, recovery compris :
    // c'est la méthode que porte réellement le parcours « mot de passe oublié » de Pacevo.
    assert.equal(sessionDeLienRecente(jeton([{ method: "otp", timestamp: t - 120 }]), t), true, "la session d'un lien « mot de passe oublié » (amr = otp) n'est pas reconnue");
    assert.equal(sessionDeLienRecente(jeton([{ method: "recovery", timestamp: t - 7200 }]), t), false, "un lien vieux de 2 h dispense encore du mot de passe actuel");
    assert.equal(sessionDeLienRecente(jeton([{ method: "password", timestamp: t }]), t), false, "une connexion par mot de passe dispense du mot de passe actuel");
    assert.equal(sessionDeLienRecente(jeton([{ method: "oauth", timestamp: t }]), t), false);
    assert.equal(sessionDeLienRecente("pas-un-jeton", t), false);
    assert.equal(sessionDeLienRecente(undefined, t), false);
  });

  // ── 4. LA DÉCISION DE LA ROUTE, PAR SON COMPORTEMENT ───────────────────────────────────
  const COMPTE_MDP = { id: "u1", email: "marie@exemple.fr", identities: [{ provider: "email" }] };
  const COMPTE_GOOGLE = { id: "u2", email: "jo@exemple.fr", identities: [{ provider: "google" }] };
  function deps(o: Partial<DependancesChangement> & { ecrits?: { mdp: string; actuel: string | null }[]; verifs?: string[] } = {}): DependancesChangement {
    const ecrits = o.ecrits ?? [];
    const verifs = o.verifs ?? [];
    return {
      utilisateur: async () => COMPTE_MDP,
      jetonAcces: async () => jeton([{ method: "password", timestamp: maintenant() }]),
      autoriser: async () => true,
      verifierActuel: async (_e, m) => { verifs.push(m); return m === "Ancien-Mdp-2025" ? "ok" : "faux"; },
      controler: async () => ({ ok: true, fuiteVerifiee: true }),
      ecrire: async (mdp, actuel) => { ecrits.push({ mdp, actuel }); return { error: null }; },
      journaliser: async () => {},
      ...o,
    };
  }

  await test("route : sans session → 401 ; limiteur dépassé → 429, rien d'écrit", async () => {
    const ecrits: { mdp: string; actuel: string | null }[] = [];
    assert.equal((await changerMotDePasse({ password: MDP_OK }, deps({ utilisateur: async () => null, ecrits }))).status, 401);
    const r = await changerMotDePasse({ password: MDP_OK, actuel: "Ancien-Mdp-2025" }, deps({ autoriser: async () => false, ecrits }));
    assert.equal(r.status, 429, "le limiteur n'arrête pas la route");
    assert.equal(ecrits.length, 0, "un mot de passe a été écrit malgré un refus");
  });

  await test("route : mot de passe ACTUEL exigé hors lien e-mail ; faux → refusé ; bon → écrit et transmis à GoTrue", async () => {
    const ecrits: { mdp: string; actuel: string | null }[] = [];
    const verifs: string[] = [];
    const sans = await changerMotDePasse({ password: MDP_OK }, deps({ ecrits, verifs }));
    assert.equal(sans.body.error, "actuel_requis", "une session ordinaire change le mot de passe sans l'actuel");
    const faux = await changerMotDePasse({ password: MDP_OK, actuel: "devine" }, deps({ ecrits, verifs }));
    assert.equal(faux.body.error, "actuel_faux", "un mot de passe actuel faux est accepté");
    assert.equal(ecrits.length, 0, "écrit malgré un mot de passe actuel absent ou faux");
    const bon = await changerMotDePasse({ password: MDP_OK, actuel: "Ancien-Mdp-2025" }, deps({ ecrits, verifs }));
    assert.equal(bon.status, 200);
    assert.deepEqual(ecrits, [{ mdp: MDP_OK, actuel: "Ancien-Mdp-2025" }], "le mot de passe actuel n'est pas transmis à GoTrue (réglage « Require current password »)");
    const panne = await changerMotDePasse({ password: MDP_OK, actuel: "x" }, deps({ verifierActuel: async () => "indisponible" }));
    assert.equal(panne.status, 503, "vérification impossible : il faut dire « réessaie », pas accepter");
  });

  await test("route : lien e-mail récent ou compte Google → pas de mot de passe actuel demandé", async () => {
    const verifs: string[] = [];
    const lien = await changerMotDePasse({ password: MDP_OK }, deps({ verifs, jetonAcces: async () => jeton([{ method: "otp", timestamp: maintenant() - 30 }]) }));
    assert.equal(lien.status, 200, "le lien « mot de passe oublié » ne permet plus de changer le mot de passe");
    const vieux = await changerMotDePasse({ password: MDP_OK }, deps({ jetonAcces: async () => jeton([{ method: "recovery", timestamp: maintenant() - 7200 }]) }));
    assert.equal(vieux.body.error, "actuel_requis", "un lien vieux de 2 h dispense encore du mot de passe actuel");
    const google = await changerMotDePasse({ password: MDP_OK }, deps({ verifs, utilisateur: async () => COMPTE_GOOGLE }));
    assert.equal(google.status, 200, "un compte Google sans mot de passe ne peut pas en choisir un premier");
    assert.equal(verifs.length, 0, "un mot de passe actuel a été vérifié alors qu'il n'y en a pas à fournir");
    // Relecture du 08/11 : identités absentes ou vides = donnée manquante, jamais une dispense.
    for (const identities of [undefined, null, []]) {
      const r = await changerMotDePasse({ password: MDP_OK }, deps({ utilisateur: async () => ({ id: "u3", email: "x@exemple.fr", identities }) }));
      assert.equal(r.body.error, "actuel_requis", `identities = ${JSON.stringify(identities)} dispense du mot de passe actuel`);
    }
  });

  await test("route : règles et fuite AVANT l'écriture ; erreurs GoTrue traduites", async () => {
    const ecrits: { mdp: string; actuel: string | null }[] = [];
    const faible = await changerMotDePasse({ password: "court", actuel: "Ancien-Mdp-2025" }, deps({ ecrits }));
    assert.equal(faible.body.error, "mot_de_passe_faible");
    assert.deepEqual(faible.body.raisons, ["longueur", "familles", "variete"], "les raisons du refus ne remontent pas à l'écran");
    const fuite = await changerMotDePasse({ password: MDP_OK, actuel: "Ancien-Mdp-2025" }, deps({ ecrits, controler: async () => ({ ok: false, error: "mot_de_passe_fuite" }) }));
    assert.equal(fuite.body.error, "mot_de_passe_fuite", "un mot de passe fuité est écrit");
    assert.equal(ecrits.length, 0, "écriture malgré un refus des règles ou de la fuite");
    const meme = await changerMotDePasse({ password: MDP_OK, actuel: "Ancien-Mdp-2025" }, deps({ ecrire: async () => ({ error: { message: "New password should be different from the old password.", code: "same_password", status: 422 } }) }));
    assert.deepEqual([meme.status, meme.body.error], [422, "identique"], "l'erreur anglaise de GoTrue remonte telle quelle");
    const notes: string[] = [];
    const inconnue = await changerMotDePasse({ password: MDP_OK, actuel: "Ancien-Mdp-2025" }, deps({ journaliser: async (_u, m) => { notes.push(m); }, ecrire: async () => ({ error: { message: "boom", code: "unexpected_failure", status: 500 } }) }));
    assert.equal(inconnue.status, 500);
    assert.equal(notes.length, 1, "un échec inconnu de GoTrue n'est pas journalisé");
  });

  // ── 5. LES SITES D'APPEL ───────────────────────────────────────────────────────────────
  await test("inscription : règles et contrôle de fuite AVANT la création du compte", () => {
    const src = code("src/app/api/auth/confirmation/route.ts");
    const corps = src.slice(src.indexOf("export async function POST"), src.indexOf("async function envoyerConfirmation"));
    const iRegles = corps.indexOf("verifierRegles(mdp");
    const iFuite = corps.indexOf("controlerNouveauMotDePasse(mdp");
    const iCreation = corps.lastIndexOf("return envoyerConfirmation(adresse, mdp");
    assert.ok(iRegles > 0, "l'inscription ne vérifie plus les règles");
    assert.ok(iFuite > 0, "l'inscription ne refuse plus les mots de passe fuités");
    assert.ok(iCreation > iFuite && iFuite > iRegles, "le contrôle arrive APRÈS la création du compte");
    assert.ok(!/mdp\.length\s*<\s*8/.test(src), "l'ancienne règle des 8 caractères est revenue");
  });

  await test("aucun écran n'écrit plus le mot de passe depuis le navigateur", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) parcourir(p); else if (/\.(ts|tsx)$/.test(n)) fichiers.push(p); } };
    parcourir("src");
    const fautifs = fichiers.filter((f) => /updateUser\(\s*\{[^}]*\bpassword\b/.test(code(f)) && f !== join("src", "app", "api", "auth", "mot-de-passe", "route.ts"));
    assert.deepEqual(fautifs, [], "updateUser({ password }) appelé hors de /api/auth/mot-de-passe : règles et fuite contournées");
    for (const f of ["src/app/(auth)/reset-password/page.tsx", "src/components/settings/SettingsView.tsx", "src/app/(auth)/signup/page.tsx"]) {
      const s = code(f);
      assert.ok(s.includes("<ReglesMotDePasse"), `${f} n'affiche pas les règles`);
      if (!f.includes("signup")) assert.ok(s.includes('"/api/auth/mot-de-passe"'), `${f} ne passe pas par la route serveur`);
    }
    assert.ok(code("src/components/settings/SettingsView.tsx").includes("actuel: pwdActuel"), "les réglages n'envoient pas le mot de passe actuel");
  });

  await test("Réglages → Sécurité : Chrome ne colle plus l'adresse dans la recherche du haut de page", () => {
    // Vu le 09/11/2026 : le champ « mot de passe actuel » fait chercher à Chrome un identifiant
    // juste avant ; faute d'en trouver un, il prenait la recherche de la barre du haut.
    const reglages = code("src/components/settings/SettingsView.tsx");
    const iIdentifiant = reglages.indexOf('autoComplete="username"');
    const iActuel = reglages.indexOf('autoComplete="current-password"');
    assert.ok(iActuel >= 0, "le champ du mot de passe actuel a disparu");
    assert.ok(iIdentifiant >= 0 && iIdentifiant < iActuel, 'aucun champ autoComplete="username" avant le mot de passe actuel');
    assert.ok(/autoComplete="username" value=\{email\} readOnly hidden/.test(reglages), "l'identifiant caché ne porte pas l'adresse du compte, en lecture seule et caché");
    // L'élément entier, attributs dans n'importe quel ordre (`[^>]` s'arrêterait sur le `=>` d'un gestionnaire).
    const barre = code("src/components/layout/TopBar.tsx");
    const iRecherche = barre.indexOf('name="recherche"');
    const champ = iRecherche < 0 ? "" : barre.slice(barre.lastIndexOf("<input", iRecherche), barre.indexOf("/>", iRecherche));
    assert.ok(champ.includes('autoComplete="off"'), 'la recherche du haut de page n\'est pas marquée autoComplete="off"');
  });

  await test("« mot de passe oublié » et confirmation : limités PAR ADRESSE, empreinte seule stockée", () => {
    // Fenêtre COURTE et message propre (relecture du 08/11) : un tiers peut épuiser le compteur
    // d'une adresse ; à l'heure, il privait la personne de « mot de passe oublié » pendant 1 h.
    const parAdresse = (prefixe: string) => new RegExp(`cleParAdresse\\("${prefixe}",\\s*adresse\\),\\s*3,\\s*10 \\* 60_000\\)\\)\\)\\s*\\{\\s*return NextResponse\\.json\\(\\{ ok: false, error: "trop_de_liens" \\}, \\{ status: 429 \\}\\)`);
    const reset = code("src/app/api/auth/reset/route.ts");
    assert.ok(parAdresse("reset-adresse").test(reset), "le lien de réinitialisation n'est pas limité par adresse à 3 / 10 min avec `trop_de_liens`");
    const conf = code("src/app/api/auth/confirmation/route.ts");
    const corpsEnvoi = conf.slice(conf.indexOf("async function envoyerConfirmation"));
    assert.ok(parAdresse("confirmation-adresse").test(corpsEnvoi), "l'e-mail de confirmation n'est pas limité par adresse à 3 / 10 min avec `trop_de_liens`");
    for (const f of ["src/app/(auth)/forgot-password/page.tsx", "src/app/(auth)/login/page.tsx", "src/app/(auth)/signup/page.tsx"]) {
      const n = (code(f).match(/"trop_de_liens" \? (?:D\.aide|A)\.tropDeLiens/g) ?? []).length;
      assert.ok(n >= (f.includes("signup") ? 2 : 1), `${f} ne dit pas « va voir ta boîte » quand l'adresse a reçu trop de liens`);
    }
    assert.ok(corpsEnvoi.indexOf("cleParAdresse(") < corpsEnvoi.indexOf("generateLink("), "la limite par adresse arrive après la génération du lien");
    const cle = cleParAdresse("reset-adresse", " Marie@Exemple.FR ");
    assert.equal(cle, cleParAdresse("reset-adresse", "marie@exemple.fr"), "casse ou espaces contournent la limite");
    assert.ok(!cle.includes("marie") && /^reset-adresse:[0-9a-f]{32}$/.test(cle), "l'adresse est stockée en clair dans rate_limits");
  });

  await test("les messages existent dans les cinq langues, sans l'ancienne règle des 8 caractères", () => {
    for (const lg of ["fr", "en", "de", "es", "pt"] as const) {
      const m = AUTH[lg].mdp as Record<string, string>;
      for (const [k, fr] of Object.entries(AUTH.fr.mdp)) assert.ok(m[k] && (lg === "fr" || m[k] !== fr), `${lg} : mdp.${k} absent ou non traduit`);
      assert.ok(m.longueur.includes("12") && m.longueur.includes("16"), `${lg} : la règle affichée ne dit pas 12 / 16`);
      assert.ok(!AUTH[lg].signup.passwordPh.includes("8"), `${lg} : le champ annonce encore 8 caractères`);
    }
    // Have I Been Pwned reçoit 5 caractères d'empreinte : un destinataire, déclaré dans la politique (relecture du 08/11).
    assert.equal((code("src/app/legalI18n.ts").match(/"Have I Been Pwned \(Pwned Passwords\) — /g) ?? []).length, 5,
      "Have I Been Pwned n'est pas nommé dans la politique de confidentialité des cinq langues");
  });

  console.log(`\n${passes} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) process.exit(1);
})();
