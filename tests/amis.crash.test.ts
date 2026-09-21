/**
 * CRASH-TESTS « AJOUTER DES AMIS » (suggestions, contacts, QR code) — 22/09/2026.
 *
 * ── CE QUI PEUT FAIRE MAL ─────────────────────────────────────────────────────
 * 1. Un identifiant deviné ou mal formé : `id` est une colonne uuid, un `.eq` sur
 *    « n'importe quoi » LÈVE côté PostgREST (400) — et une page publique qui plante sur
 *    un lien tapé à la main est une page cassée pour tout le monde.
 * 2. L'appariement des contacts : sans plafond ni filtre, la route devient un annuaire
 *    (« telle adresse a un compte ») — elle ne rend JAMAIS d'adresse, borne la liste et
 *    écarte les athlètes masqués ou non inscrits jusqu'au bout.
 * 3. La visibilité « communauté » lue avec la session de l'athlète ne voyait que SES
 *    propres réglages (politique notifs_all_own) : la case décochée par quelqu'un
 *    d'autre n'avait aucun effet. Elle se lit désormais avec le client admin.
 * 4. Le lien d'un QR code scanné : seul un lien Pacevo `/amis/<uuid>` devient une
 *    navigation ; un code d'affiche, un `javascript:`, un autre domaine → rien.
 * 5. `/login?next=` : un retour APRÈS connexion ne peut pointer que sur le site.
 * 6. Trouvé en exerçant l'app : `wearable_source` n'a pas « phone_gps » → chaque
 *    course du téléphone finissait en 500. Migration 030 + repli en « manual ».
 *
 *   npx tsx tests/amis.crash.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { estUuid, idDepuisLien, lienAmi, normaliserEmails, cheminSur, CONTACTS_MAX } from "../src/lib/social/amisLiens";
import { NAV_GROUPES } from "../src/components/layout/navigation";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void | Promise<void>) {
  return Promise.resolve().then(fn).then(() => { passed++; console.log("  OK " + nom); }, (e) => { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); });
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const ID = "6e390574-3290-4882-8cd5-e3e2f8924ea1";

(async () => {
  console.log("\n=== AJOUTER DES AMIS — CRASH-TESTS ===\n");

  await test("un identifiant n'est un uuid que s'il en a la forme — rien d'autre ne passe", () => {
    assert.equal(estUuid(ID), true);
    assert.equal(estUuid(ID.toUpperCase()), true, "un uuid en majuscules est valide");
    for (const junk of ["", "junk", "6e390574", ID + "x", "'; drop table--", 42, null, undefined, {}, [ID]]) {
      assert.equal(estUuid(junk), false, `accepté à tort : ${JSON.stringify(junk)}`);
    }
  });

  await test("un lien scanné ne devient une navigation QUE s'il est un lien Pacevo /amis/<uuid>", () => {
    const o = "https://pacevo.fr";
    assert.equal(lienAmi(o + "/", ID), `${o}/amis/${ID}`, "la barre finale de l'origine doit être absorbée");
    assert.equal(idDepuisLien(lienAmi(o, ID), o), ID);
    assert.equal(idDepuisLien(`  ${o}/amis/${ID.toUpperCase()}/ `, o), ID, "espaces, barre finale, majuscules : tolérés, identifiant normalisé");
    assert.equal(idDepuisLien(`${o}/amis/${ID}`), ID, "sans origine imposée, tout domaine http(s) passe");
    assert.equal(idDepuisLien(`ftp://pacevo.fr/amis/${ID}`), null, "sans origine imposée, seul http(s) passe — pas ftp:, pas file:");
    assert.equal(idDepuisLien(`file:///amis/${ID}`), null);
    for (const junk of [
      `https://autre-site.fr/amis/${ID}`, // autre domaine que l'origine imposée
      `javascript:alert(1)`, `data:text/html,x`, `ftp://pacevo.fr/amis/${ID}`,
      `${o}/amis/junk`, `${o}/amis/`, `${o}/dashboard/communaute?suivre=${ID}`, `${o}/amis/${ID}/extra`,
      "WIFI:S:box;P:secret;;", "", "   ", 12, null, undefined, "x".repeat(400),
    ]) {
      assert.equal(idDepuisLien(junk, o), null, `navigation acceptée à tort pour ${JSON.stringify(junk)}`);
    }
  });

  await test("les adresses de contacts : nettoyées, dédoublonnées, bornées, jamais plantées", () => {
    assert.deepEqual(normaliserEmails(["  Ami@Exemple.FR ", "ami@exemple.fr", "pas-une-adresse", "", 3, null, "a@b"]), ["ami@exemple.fr"]);
    for (const junk of [null, undefined, "ami@exemple.fr", 42, {}, { length: 1e9 }]) {
      assert.deepEqual(normaliserEmails(junk), [], `entrée non-liste acceptée : ${JSON.stringify(junk)}`);
    }
    const carnet = Array.from({ length: 5000 }, (_, i) => `c${i}@exemple.fr`);
    assert.equal(normaliserEmails(carnet).length, CONTACTS_MAX, "un carnet entier doit être plafonné");
    assert.equal(CONTACTS_MAX, 100);
    assert.deepEqual(normaliserEmails(["x".repeat(250) + "@exemple.fr"]), [], "une adresse de plus de 254 caractères est écartée");
  });

  await test("`?next=` après connexion : seulement un chemin SUR le site", () => {
    assert.equal(cheminSur(`/amis/${ID}`), `/amis/${ID}`);
    assert.equal(cheminSur("/dashboard/communaute?suivre=x"), "/dashboard/communaute?suivre=x");
    for (const junk of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "evil", "", null, 7, "/a b", "/".padEnd(600, "a")]) {
      assert.equal(cheminSur(junk), "/dashboard", `retour hors site accepté : ${JSON.stringify(junk)}`);
    }
    assert.equal(cheminSur(undefined, "/x"), "/x", "le défaut est paramétrable");
  });

  await test("la route de suivi : uuid vérifié AVANT la requête, visibilité lue en admin, soi-même exclu", () => {
    const src = codeNu("src/app/api/social/follow/route.ts");
    const iGarde = src.indexOf("!estUuid(id)");
    const iEq = src.indexOf('query.eq("id", id)');
    assert.ok(iGarde > 0 && iEq > iGarde, "l'identifiant n'est pas vérifié avant le `.eq` sur la colonne uuid (PostgREST lèverait)");
    assert.match(src, /athletesMasques\(createAdminClient\(\)\)/, "la visibilité « communauté » n'est plus lue avec le client admin : la case décochée par un autre athlète serait ignorée");
    assert.ok(!/hiddenAthletes\(sb\)/.test(src), "l'ancienne lecture avec la session de l'athlète est revenue");
    assert.match(src, /a\.id !== user\.id/, "l'athlète peut se retrouver lui-même dans sa liste");
    assert.match(src, /status: 404/, "un athlète introuvable doit répondre 404, pas 200 vide");
  });

  await test("la visibilité : une lecture en échec MASQUE tout le monde plutôt que personne", () => {
    const src = codeNu("src/lib/social/visibilite.ts");
    assert.match(src, /if \(error\) return new Set\(\["\*"\]\)/, "une erreur de lecture rend un ensemble vide : tout le monde deviendrait visible");
    assert.match(src, /masques\.has\("\*"\)/, "`estMasque` ne traite pas le joker « * »");
  });

  await test("l'appariement des contacts : 401 sans session, borné, jamais d'adresse en réponse, masqués et inachevés écartés", () => {
    const src = codeNu("src/app/api/social/contacts/route.ts");
    assert.match(src, /if \(!user\) return NextResponse\.json\(\{ error: "Non authentifié" \}, \{ status: 401 \}\)/);
    assert.match(src, /normaliserEmails\(corps\.emails\)/, "les adresses ne passent plus par le nettoyage borné");
    // La réponse : identifiant, nom, avatar, état — et c'est tout.
    const iMap = src.indexOf(".map((p) => ({ id: p.id");
    const reponse = src.slice(iMap, src.indexOf("return NextResponse.json({ athletes", iMap));
    assert.ok(iMap > 0 && reponse.length > 0, "la mise en forme de la réponse a changé de forme");
    assert.ok(!/email/.test(reponse), "la réponse transporte une adresse e-mail : la route devient un annuaire");
    assert.match(src, /p\.onboarding_completed === true/, "un compte inachevé apparaît dans les contacts appariés");
    assert.match(src, /!estMasque\(masques, p\.id\)/, "un athlète masqué apparaît dans les contacts appariés");
    assert.match(src, /p\.id !== user\.id/, "l'athlète s'apparie avec lui-même");
  });

  await test("la page publique /amis/<id> : uuid vérifié avant la requête, prénom seulement, inachevés et masqués invisibles, intention retenue", () => {
    const src = codeNu("src/app/amis/[id]/page.tsx");
    const iGarde = src.indexOf("estUuid(id)");
    const iReq = src.indexOf('.eq("id", valide)');
    assert.ok(iGarde > 0 && iReq > iGarde, "la page interroge la base avec un identifiant non vérifié");
    assert.match(src, /p\.onboarding_completed === true && !estMasque\(masques, valide\)/, "un compte inachevé ou masqué serait dévoilé par son identifiant");
    assert.match(src, /full_name\?\.trim\(\)\.split\(\/\\s\+\/\)\[0\]/, "la page affiche plus que le prénom");
    assert.match(src, /<RetenirIntention id=\{valide\} \/>/, "l'intention de suivre n'est plus retenue avant la connexion");
    assert.match(src, /redirect\(`\/dashboard\/communaute\?suivre=\$\{valide\}`\)/, "un visiteur connecté n'est plus envoyé sur l'annuaire");
    assert.match(codeNu("src/app/amis/[id]/RetenirIntention.tsx"), /localStorage\.setItem\(CLE_SUIVRE, id\)/);
    // Et le moteur de recherche n'indexe pas ces pages (un prénom derrière un identifiant).
    assert.match(readFileSync("src/app/robots.ts", "utf8"), /"\/amis\/"/, "robots.txt n'exclut plus /amis/");
    // /login honore `next` — filtré.
    assert.match(codeNu("src/app/(auth)/login/page.tsx"), /router\.push\(cheminSur\(/, "/login ne filtre plus le paramètre next");
  });

  await test("l'annuaire consomme l'intention UNE fois, ignore la sienne, et nettoie l'adresse", () => {
    const src = codeNu("src/components/social/AjouterAmis.tsx");
    assert.match(src, /localStorage\.removeItem\(CLE_SUIVRE\)/, "l'intention n'est jamais effacée : la carte reviendrait à chaque visite");
    assert.match(src, /if \(!estUuid\(id\) \|\| id === moi\.id\) return/, "une intention absurde ou « me suivre moi-même » n'est pas écartée");
    assert.match(src, /router\.replace\("\/dashboard\/communaute"\)/, "`?suivre=` reste dans l'adresse : un rechargement reproposerait l'athlète");
    // Le scanner n'accepte que les liens Pacevo de CETTE origine.
    assert.match(src, /idDepuisLien\(c\.rawValue, origine\)/, "le scanner navigue sur n'importe quel QR code");
    // Le QR code est rendu en <path>, jamais en HTML injecté.
    assert.ok(!/dangerouslySetInnerHTML/.test(src), "le QR code est injecté en HTML");
    assert.match(src, /qr\.isDark\(r, c\)/);
  });

  await test("la page s'ouvre sur l'annuaire ; trois onglets ; « Clubs & Défis » retiré du menu ; « Actualité » a sa page", () => {
    const hub = codeNu("src/components/social/SocialHub.tsx");
    assert.match(hub, /useState<"feed" \| "athletes">\("athletes"\)/, "la page s'ouvre sur le fil, pas sur « Ajouter des amis »");
    const amis = codeNu("src/components/social/AjouterAmis.tsx");
    for (const k of ['k: "suggestions"', 'k: "contacts"', 'k: "qr"']) assert.ok(amis.includes(k), `onglet manquant : ${k}`);
    const hrefs = NAV_GROUPES.flatMap((g) => g.items.map((i) => i.href));
    assert.ok(!hrefs.includes("/dashboard/clubs"), "« Clubs & Défis » est revenu au menu");
    assert.ok(hrefs.includes("/dashboard/actualite"), "« Actualité » n'a plus d'entrée de menu");
    assert.ok(existsSync("src/app/dashboard/actualite/page.tsx"), "la page /dashboard/actualite n'existe pas");
    assert.ok(!existsSync("src/components/social/CommunityTabs.tsx"), "l'ancien onglet « Le Club | Actualité » existe encore");
    const dico = readFileSync("src/lib/i18n/translations.ts", "utf8");
    assert.equal((dico.match(/"nav\.news": "/g) ?? []).length, 5, "« nav.news » manque à une langue");
    assert.match(dico, /"nav\.community": "Ajouter des amis"/, "l'entrée de menu ne s'appelle plus « Ajouter des amis »");
    assert.match(dico, /"group\.club": "Communauté"/);
  });

  await test("le dictionnaire local de l'annuaire a les mêmes clés dans les cinq langues", () => {
    const src = readFileSync("src/components/social/AjouterAmis.tsx", "utf8");
    const bloc = src.slice(src.indexOf("const T: Record"), src.indexOf("const initials"));
    const cles = (lg: string) => {
      const i = bloc.indexOf(`  ${lg}: {`); const j = bloc.indexOf("\n  },", i);
      return [...bloc.slice(i, j).matchAll(/(?:^\s*|, )([a-zA-Z]+): "/gm)].map((m) => m[1]).sort();
    };
    const fr = cles("fr");
    assert.ok(fr.length >= 20, `dictionnaire fr trop court (${fr.length})`);
    for (const lg of ["en", "de", "es", "pt"]) assert.deepEqual(cles(lg), fr, `clés ${lg} ≠ fr`);
  });

  await test("les courses du téléphone ne sont plus perdues : migration 030 + repli journalisé", () => {
    const mig = readFileSync("supabase/migrations/030_source_phone_gps.sql", "utf8");
    assert.match(mig, /alter type wearable_source add value if not exists 'phone_gps'/);
    const src = codeNu("src/app/api/workouts/log/route.ts");
    assert.match(src, /if \(tentative\.error && \/wearable_source\/\.test\(tentative\.error\.message\)\)/, "le repli sur « manual » a disparu : chaque course du téléphone refinit en 500 tant que la 030 n'est pas passée");
    assert.match(src, /insert\(\{ \.\.\.row, source: "manual" \}\)/);
    assert.match(src, /from\("error_logs"\)\.insert\(/, "le repli n'est pas journalisé : une course sauvée sous une mauvaise étiquette resterait un secret");
  });

  // ── Crash-tests HTTP réels, si un serveur de développement tourne ────────────
  const vivant = await fetch("http://localhost:3000/robots.txt", { signal: AbortSignal.timeout(1500) }).then((r) => r.ok).catch(() => false);
  if (!vivant) {
    console.log("  (serveur local absent : crash-tests HTTP ignorés)");
  } else {
    await test("HTTP : /amis/<junk> et /amis/<uuid inconnu> répondent 200 « introuvable », jamais 500", async () => {
      for (const id of ["pas-un-uuid", "'; drop table--", "00000000-0000-4000-8000-000000000000"]) {
        const r = await fetch(`http://localhost:3000/amis/${encodeURIComponent(id)}`);
        assert.equal(r.status, 200, `/amis/${id} → ${r.status}`);
        assert.match(await r.text(), /Invitation introuvable/, `/amis/${id} ne dit pas « introuvable »`);
      }
    });
    await test("HTTP : les routes sociales refusent sans session (401), jamais 500", async () => {
      for (const [url, init] of [
        ["/api/social/follow?id=junk", undefined],
        ["/api/social/follow?q=%25%27", undefined],
        ["/api/social/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{pas du json" }],
        ["/api/social/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: "x" }) }],
      ] as const) {
        const r = await fetch("http://localhost:3000" + url, init as RequestInit);
        assert.equal(r.status, 401, `${url} → ${r.status}`);
      }
      const r = await fetch("http://localhost:3000/dashboard/actualite", { redirect: "manual" });
      assert.ok(r.status === 307 || r.status === 302, `/dashboard/actualite sans session → ${r.status}`);
    });
  }

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) process.exit(1);
})();
