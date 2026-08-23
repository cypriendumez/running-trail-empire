/**
 * L'APP N'AFFICHE QUE DES CHIFFRES QUI SE RECOMPTENT.
 *
 * Trois chiffres inventés — « 10k+ coureurs », « 4.9★ de note moyenne », « 98 % de
 * satisfaction » — avaient été retirés de la page d'accueil : la base compte UN profil,
 * et il n'existe ni note ni enquête de satisfaction. Personne n'était venu les retirer
 * du panneau des pages de CONNEXION et d'INSCRIPTION, qui portaient leur propre copie.
 * Ils y sont donc restés affichés, sur la page même où l'on demande une adresse et un
 * mot de passe, jusqu'au 20/08/2026.
 *
 * Deuxième défaut de la même famille : la durée de l'essai était recopiée à la main et
 * avait divergé en TROIS valeurs contradictoires — « 30 jours » à l'inscription,
 * « 7 jours » sur l'accueil, « 14 jours » dans les réglages. Seul `JOURS_ESSAI` fait foi.
 *
 * Ce test importe les sources plutôt que de les greper quand il le peut, et vérifie que
 * rien ne recopie ce qui doit venir d'un seul endroit.
 *
 *   npx tsx tests/chiffres.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { CHIFFRES, CHIFFRES_LANDING, CHIFFRES_AUTH } from "../src/lib/brand/stats";
import { JOURS_ESSAI } from "../src/lib/billing/access";
import { ARTICLES } from "../src/app/blog/articles";
import { ARTICLES_I18N } from "../src/app/blog/articlesI18n";
import { LEGAL } from "../src/app/legalI18n";
import { accesDe, peut, JOURS_APERCU } from "../src/lib/billing/access";
import { PRIX_AFFICHES } from "../src/lib/billing/prix";
import { ATTRIBUTION_GARMIN, PAGES_ATTRIBUTION } from "../src/components/legal/attributionI18n";
import { liensStore } from "../src/lib/brand/stores";
import { estAdmin, adminsAutorises, emailEditeur, ADMIN_PAR_DEFAUT } from "../src/lib/admin/acces";
import { EDITEUR, HEBERGEUR_APP, PAYS_APP, SOUS_TRAITANTS } from "../src/lib/brand/editeur";
import { fournisseursActifs } from "../src/lib/auth/fournisseurs";
import { nomAffiche, refusDe, avisDe, litAvis, TEXTE_MIN } from "../src/lib/avis/store";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

let passed = 0;
const fails: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { fails.push(`${name} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${name}`); }
}

function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}
/** ⚠️ On ne coupe pas un « // » précédé de « : » — sinon les URL seraient tronquées. */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}
const TOUS = fichiers(SRC).map((p) => ({
  rel: relative(SRC, p).replace(/\\/g, "/"),
  code: sansCommentaires(readFileSync(p, "utf8")),
}));

// ── Garde-fou du garde-fou ───────────────────────────────────────────────────
test("le scanner voit réellement le source", () => {
  assert.ok(TOUS.length > 100, `seulement ${TOUS.length} fichiers scannés`);
  for (const f of ["app/page.tsx", "components/auth/AuthShell.tsx", "components/auth/authI18n.ts"]) {
    assert.ok(TOUS.some((x) => x.rel === f), `${f} n'a pas été scanné`);
  }
});

// ── 1. Les chiffres inventés ne peuvent pas revenir ──────────────────────────
// Motifs volontairement larges : c'est la FORME du chiffre inventé qu'on interdit,
// pas une chaîne exacte qu'il suffirait de réécrire « 10 000+ » pour contourner.
const INVENTES: [RegExp, string][] = [
  [/\b10k\+/i,                         "« 10k+ coureurs » — la base compte UN profil"],
  [/\b4[.,]9\s*★/,                     "« 4,9 ★ » — aucune note n'existe dans l'app"],
  [/\b98\s*%/,                         "« 98 % de satisfaction » — aucune enquête n'existe"],
  [/\b\d[\d\s]*\+?\s*(coureurs actifs|active runners)\b/i, "un nombre d'utilisateurs inventé"],
];

test("aucun chiffre inventé n'est affiché", () => {
  const vus: string[] = [];
  for (const { rel, code } of TOUS) {
    for (const [motif, motif_txt] of INVENTES) {
      if (motif.test(code)) vus.push(`${rel} → ${motif_txt}`);
    }
  }
  assert.equal(vus.length, 0, `chiffre(s) invérifiable(s) affiché(s) :\n    ${vus.join("\n    ")}`);
});

// ── 2. Une seule source pour les chiffres vérifiables ────────────────────────
test("l'accueil et les pages d'auth lisent la MÊME source", () => {
  for (const f of ["app/page.tsx", "components/auth/AuthShell.tsx"]) {
    const x = TOUS.find((t) => t.rel === f)!;
    assert.ok(
      /from "@\/lib\/brand\/stats"/.test(x.code),
      `${f} n'importe plus lib/brand/stats — il a sûrement recopié les valeurs`,
    );
  }
});

test("les chiffres publiés sont ceux de la source", () => {
  assert.equal(CHIFFRES_LANDING.length, 4);
  assert.equal(CHIFFRES_AUTH.length, 3);
  for (const v of [...CHIFFRES_LANDING, ...CHIFFRES_AUTH]) {
    assert.ok(Object.values(CHIFFRES).includes(v as never), `« ${v} » ne vient pas de CHIFFRES`);
  }
});

// ── 3. La durée d'essai ne se recopie pas ────────────────────────────────────
test("JOURS_ESSAI reste la seule définition de la durée d'essai", () => {
  assert.equal(typeof JOURS_ESSAI, "number");
  assert.ok(JOURS_ESSAI > 0 && JOURS_ESSAI < 60, `valeur improbable : ${JOURS_ESSAI}`);
});

test("aucune durée d'essai n'est écrite en dur dans un écran", () => {
  // Formulations d'essai des 5 langues, avec un nombre COLLÉ à la place du gabarit {n}.
  // ⚠️ Ne PAS accepter un simple « N jours de … » : « 4 jours de repos » n'est pas une
  // durée d'essai. Premier jet du test, trois faux positifs — c'était le test qui avait tort.
  const ecrit = /\b(\d+)[\s-]*(jours? (?:gratuits?|d'essai)|day[\s-]*free|days? free|Tage kostenlos|días? (?:gratis|de (?:prueba|la prueba))|dias? (?:grátis|do teste|de teste))/i;
  const vus: string[] = [];
  for (const { rel, code } of TOUS) {
    if (rel.startsWith("lib/billing/")) continue; // c'est LÀ que la durée se définit
    const m = code.match(ecrit);
    if (m) vus.push(`${rel} → « ${m[0].trim()} » (utiliser le gabarit {n} + JOURS_ESSAI)`);
  }
  assert.equal(vus.length, 0, `durée(s) d'essai recopiée(s) :\n    ${vus.join("\n    ")}`);
});

// ── 4. Aucune ancre interne ne vise le vide ──────────────────────────────────
// La barre et le menu mobile pointaient sur « #features » alors qu'aucune section ne
// portait cet identifiant : le clic changeait l'URL et ne défilait nulle part. Rien ne
// pouvait le voir — une ancre morte est du HTML parfaitement valide, le typage et le
// build passent. Seul un test qui CONFRONTE les deux listes l'attrape.
test("toute ancre interne vise un id qui existe", () => {
  const ancres = new Map<string, Set<string>>();
  const ids = new Set<string>();
  for (const { rel, code } of TOUS) {
    for (const m of code.matchAll(/href="#([A-Za-z][\w-]*)"/g)) {
      ancres.set(m[1], (ancres.get(m[1]) ?? new Set()).add(rel));
    }
    for (const m of code.matchAll(/\bid="([A-Za-z][\w-]*)"/g)) ids.add(m[1]);
  }
  assert.ok(ancres.size > 0, "aucune ancre trouvée — la regex ne mord plus");
  assert.ok(ids.size > 0, "aucun id trouvé — la regex ne mord plus");
  const mortes = [...ancres.entries()]
    .filter(([a]) => !ids.has(a))
    .map(([a, fs]) => `#${a} → ${[...fs].join(", ")}`);
  assert.equal(mortes.length, 0, `ancre(s) qui ne mènent nulle part :\n    ${mortes.join("\n    ")}`);
});

// ── 5. Aucune traduction d'article ne vise un slug inexistant ────────────────
// Le repli du blog est `trad ?? a` : une traduction dont le slug est mal orthographié
// n'est jamais trouvée, donc jamais affichée — et le bandeau « pas encore traduit »
// reste, alors que le texte existe. Rien ne le signale : ni le typage (les clés d'un
// Record sont des chaînes), ni le build, ni l'écran. C'est un travail perdu en silence.
test("chaque traduction d'article correspond à un article réel", () => {
  const slugs = new Set(ARTICLES.map((a) => a.slug));
  assert.ok(slugs.size >= 8, `seulement ${slugs.size} articles — la source ne se lit plus`);
  const orphelines: string[] = [];
  let total = 0;
  for (const [lg, parSlug] of Object.entries(ARTICLES_I18N)) {
    for (const slug of Object.keys(parSlug ?? {})) {
      total++;
      if (!slugs.has(slug)) orphelines.push(`${lg} → « ${slug} »`);
    }
  }
  assert.ok(total > 0, "aucune traduction trouvée — l'import ne mord plus");
  assert.equal(
    orphelines.length, 0,
    `traduction(s) rattachée(s) à un slug qui n'existe pas :\n    ${orphelines.join("\n    ")}\n` +
    `    → elles ne s'afficheront JAMAIS et le bandeau « pas encore traduit » restera.`,
  );
});

test("les mentions légales disent la même chose dans les 5 langues", () => {
  // ⚠️ Une page légale se remplit langue par langue, et c'est exactement là qu'on
  // s'arrête au milieu : j'ai renseigné l'hébergeur en fr/en/de, puis j'ai failli
  // publier es et pt avec leur marqueur « [POR COMPLETAR] » encore en place. Un visiteur
  // portugais aurait lu, sur la page qui l'informe de ses droits, une consigne interne
  // non remplie.
  //
  // La LCEN impose de nommer l'hébergeur. Vercel Inc. est vérifié dans la politique de
  // confidentialité de Vercel elle-même — pas déduit du fait qu'on déploie chez eux.
  // Les anciens marqueurs restent listés : réintroduire un trou à l'ancienne mode doit
  // encore être détecté, même si la fiche unique n'en produit plus qu'un seul.
  const MARQUEURS = /\[(À COMPLÉTER|TO BE COMPLETED|À RENSEIGNER|TO COMPLETE|AUSZUFÜLLEN|POR COMPLETAR|A PREENCHER)[^\]]*\]/g;

  for (const [lg, doc] of Object.entries(LEGAL)) {
    const tout = JSON.stringify(doc);
    assert.ok(tout.includes("Vercel Inc."), `l'hébergeur n'est pas nommé en ${lg}`);
    assert.ok(tout.includes("Covina, CA 91723"), `l'adresse de l'hébergeur manque en ${lg}`);
    assert.ok(tout.includes("cypriendumez@outlook.fr"), `aucun contact d'éditeur en ${lg}`);

    // Il RESTE un marqueur légitime — le statut juridique, que seul l'éditeur connaît.
    // Le test ne l'interdit pas ; il interdit tout AUTRE trou, et vérifie que le trou
    // connu est bien le même dans chaque langue.
    const restants = tout.match(MARQUEURS) ?? [];
    assert.equal(restants.length, 1, `${restants.length} mentions à compléter en ${lg} : ${restants.join(" | ")}`);
    assert.ok(
      /statut juridique|SIREN/i.test(restants[0]),
      `le trou restant en ${lg} n'est pas le statut juridique : ${restants[0]}`,
    );
    // Le repère vient maintenant d'UNE fiche : il doit être identique partout. Deux
    // formulations différentes voudraient dire que quelqu'un l'a recopié.
    assert.equal(restants[0], EDITEUR.statut, `le repère à compléter diverge en ${lg}`);
  }
});

test("chaque palier que la BASE accepte a un sens pour le code", () => {
  // ⚠️ DÉFAUT RÉEL, trouvé le 21/08/2026 en cherchant pourquoi le coach s'était tu.
  // `profiles.subscription_tier` n'est pas du texte libre : c'est un ENUM Postgres,
  // `create type subscription_tier as enum ('free', 'pro', 'elite')`. Le code, lui,
  // tenait sa propre liste de paliers payants — et `elite`, la valeur la plus haute du
  // schéma, n'y figurait pas. Un compte porté à ce palier retombait donc sur
  // « gratuit » : plus de plan, plus d'IA, et pour tout message « essai_expire ».
  //
  // Deux listes dans deux fichiers, aucune ne connaissant l'autre. Ce test les relie.
  const sql = readFileSync(join(ROOT, "supabase/migrations/001_initial_schema.sql"), "utf8");
  const m = sql.match(/create type subscription_tier as enum \(([^)]*)\)/i);
  assert.ok(m, "l'enum subscription_tier n'est plus déclaré là où ce test le cherche");
  const valeurs = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.ok(valeurs.length >= 2, `enum illisible : ${m[1]}`);

  // ⚠️ L'ASSERTION INVERSE, ajoutée le 21/08/2026 une fois le SQL passé. Le webhook Stripe
  // écrit le nom COMMERCIAL du palier (« starter », « premium »). Tant qu'ils manquaient
  // à l'enum, la base les refusait (22P02) : un client aurait payé, et son abonnement
  // n'aurait JAMAIS été enregistré — il serait resté verrouillé après paiement. Rien dans
  // le code ne reliait la liste des tarifs à celle des valeurs stockables.
  for (const formule of Object.keys(PRIX_AFFICHES)) {
    if (formule === "gratuit") continue; // « gratuit » se stocke sous le nom « free ».
    assert.ok(
      valeurs.includes(formule),
      `le palier VENDABLE « ${formule} » n'existe pas dans l'enum : un client le paierait sans que la base puisse l'enregistrer`,
    );
  }

  // Un compte assez ancien pour que l'essai soit fini : seul le palier décide encore.
  const vieux = "2020-01-01T00:00:00.000Z";
  for (const v of valeurs) {
    const etat = accesDe({ created_at: vieux, subscription_tier: v }).etat;
    if (v === "free") {
      assert.equal(etat, "gratuit", "« free » doit rester le palier gratuit");
    } else {
      assert.notEqual(
        etat, "gratuit",
        `le palier « ${v} » existe en base mais le code le traite comme gratuit — un compte porté à ce palier serait verrouillé`,
      );
    }
  }
});

test("l'attribution Garmin ne peut pas disparaître d'une vue de données", () => {
  // ⚠️ CE N'EST PAS UNE POLITESSE, C'EST UNE OBLIGATION CONTRACTUELLE. Pacevo lit tout
  // via l'API d'intervals.icu, dont les conditions (publiées le 23/10/2025) autorisent
  // explicitement l'usage COMMERCIAL — et posent une contrepartie à l'article 1.1 :
  // toute application qui affiche des informations dérivées de données Garmin doit
  // afficher l'attribution correspondante.
  //
  // Presque chaque activité de Pacevo vient d'une Garmin, et RIEN ne l'attribuait nulle
  // part. Le produit tournait donc hors des conditions du seul service dont il dépend —
  // exactement ce qu'un acheteur relève en due diligence.
  for (const lang of ["fr", "en", "de", "es", "pt"]) {
    const t = ATTRIBUTION_GARMIN[lang];
    assert.ok(t && t.length > 20, `mention absente ou trop courte en ${lang}`);
    // Le mot « Garmin » EST l'attribution : une phrase qui ne le nomme pas n'attribue rien.
    assert.match(t, /Garmin/, `la mention en ${lang} ne nomme pas Garmin`);
  }

  for (const rel of PAGES_ATTRIBUTION) {
    const src = readFileSync(join(ROOT, rel), "utf8");
    assert.match(src, /<AttributionGarmin/, `${rel} affiche des données sans attribution Garmin`);
  }
});

test("chaque logo annoncé par la page existe vraiment", () => {
  // ⚠️ CE TEST DISAIT L'INVERSE PENDANT UNE HEURE. Il interdisait tout logo de marque —
  // les fichiers avaient été retirés parce que citer un NOM est un usage nominatif admis
  // alors que reproduire un LOGO est encadré par la charte de chaque titulaire, Apple
  // étant le plus strict des sept. Cyprien a été informé du risque et a choisi de les
  // remettre : c'est son produit et sa décision, et le commentaire dans `app/page.tsx`
  // le dit pour que personne ne les retire « pour bien faire » sans lui en reparler.
  //
  // Ce qui reste utile à garder, en revanche : un `logo` qui pointe vers un fichier
  // absent n'échoue nulle part — il affiche une image cassée sur la page d'accueil, en
  // production, sans que rien ne bronche. Amazfit et Huawei n'ont volontairement pas de
  // fichier : la pastille affiche alors leur nom, ce qui est le comportement voulu.
  //
  // ⚠️ LE SEUIL EST DESCENDU DE 5 À 4 LE 23/08/2026, avec Polar. Ce n'est pas un seuil
  // qu'on rabote à chaque retrait : il ne sert plus qu'à détecter une rangée qui se VIDE
  // (une regex cassée, un tableau écrasé). La composition exacte, elle, est figée ailleurs,
  // par `tests/synchro.crash.test.ts` — c'est LUI qui rougit si une marque entre ou sort.
  const landing = sansCommentaires(readFileSync(join(ROOT, "src/app/page.tsx"), "utf8"));
  const cites = [...landing.matchAll(/logo:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(cites.length >= 4, `seulement ${cites.length} logo(s) cité(s) — la rangée s'est-elle vidée ?`);
  for (const f of cites) {
    assert.ok(
      existsSync(join(ROOT, "public/brands", f)),
      `la page d'accueil affiche « ${f} » mais le fichier n'existe pas : image cassée en production`,
    );
  }
  // ⚠️⚠️ CE TEST A ÉTÉ VERT SUR UN FICHIER EN LIGNE. Il affirmait « Vercel déploie ce que
  // git suit » et n'interrogeait donc que git. C'est FAUX pour la commande de déploiement
  // réellement utilisée sur ce projet : `vercel deploy --prod` téléverse le CONTENU DU
  // DISQUE, pas le contenu du dépôt.
  //
  // Mesuré en production le 23/08/2026, juste après avoir retiré Polar de la vitrine et
  // sorti son logo du suivi git :
  //     /brands/polar.svg  → HTTP 200   (non suivi par git, mais PRÉSENT sur le disque)
  //     /brands/strava.svg → HTTP 404   (non suivi ET absent du disque)
  // Le test était vert, et le logo d'une marque déposée qu'on n'affiche plus était servi
  // par le site. Sortir un fichier de git ne le retire PAS de la production : il faut le
  // supprimer du disque. (Et il ne revient pas tout seul — la crainte iCloud notée le
  // 21/08/2026 ne s'est pas vérifiée : strava.svg est bel et bien resté absent.)
  //
  // On vérifie donc les DEUX, puisque les deux chemins de déploiement existent : un build
  // Vercel depuis GitHub publie ce que git suit, la commande locale publie le disque.
  const suivis = execSync("git ls-files public/brands", { cwd: ROOT }).toString().trim().split("\n").filter(Boolean);
  // ⚠️ GÉNÉRALISÉ AU-DELÀ DE STRAVA le 23/08/2026, quand Polar a quitté la vitrine. Un
  // logo de marque retirée est un fichier de MARQUE DÉPOSÉE qu'on déploierait sans plus
  // rien afficher avec : aucun bénéfice, un risque inutile sur un site mis en vente. La
  // liste est nommée pour que le test reste lisible en cas d'échec.
  const RETIREES = ["strava", "polar"];
  for (const marque of RETIREES) {
    assert.ok(!suivis.some((f) => f.includes(marque)),
      `${marque}.svg est suivi par git : un build Vercel depuis GitHub le publierait alors que la marque a été retirée`);
    // LA MOITIÉ QUI MANQUAIT, et qui est celle qui compte pour `vercel deploy --prod`.
    const surLeDisque = readdirSync(join(ROOT, "public/brands")).filter((f) => f.includes(marque));
    assert.deepEqual(surLeDisque, [],
      `${marque}.svg est sur le disque : \`vercel deploy\` le téléverse, et il redevient accessible en ligne`);
  }
  for (const f of cites) {
    assert.ok(suivis.includes(`public/brands/${f}`), `« ${f} » n'est pas suivi par git : absent du déploiement`);
  }
});

test("aucun avis de consommateur n'est fabriqué", () => {
  // ⚠️ LE DÉFAUT LE PLUS GRAVE TROUVÉ SUR CE SITE, et il était en ligne. La page /avis
  // publiait VINGT-SIX témoignages entièrement inventés — prénoms, dates, notes, et des
  // faits chiffrés dans le corps du texte (« m'a fait gagner 4 minutes sur mon semi »,
  // « il m'a prédit 48:23, j'ai fini en 48:41 ») — surmontés de quatre compteurs du même
  // bois : 4,9 de note moyenne, 26 avis, 92 % de 5 étoiles. Le titre promettait « leurs
  // retours, sans filtre ».
  //
  // Publier de faux avis de consommateurs est une pratique commerciale réputée trompeuse
  // EN TOUTES CIRCONSTANCES depuis la directive (UE) 2019/2161, transposée à l'article
  // L121-4 du code de la consommation. Ce n'est pas une zone grise : la pratique est
  // listée, et la sanction relève de l'article L132-2.
  //
  // Les mêmes trois chiffres — « 4,9 ★ », « 98 % de satisfaction » — avaient DÉJÀ été
  // retirés de la page d'accueil et des pages d'auth. Personne n'était allé voir /avis.
  const avis = sansCommentaires(readFileSync(join(ROOT, "src/app/avis/page.tsx"), "utf8"));

  // La forme d'un témoignage noté : un nom, une note, un texte. Interdite tant qu'aucun
  // avis réel n'est stocké — le jour où il y en aura, ils viendront de la base, pas d'un
  // tableau écrit à la main dans le source.
  assert.ok(!/\bstars\s*:/.test(avis), "des témoignages notés sont revenus dans le source de /avis");
  assert.ok(!/\bname\s*:\s*"[^"]+"\s*,\s*(stars|rating)/.test(avis), "un avis nominatif est écrit en dur");

  // Et les agrégats qui les accompagnaient : une note moyenne suppose des notes.
  for (const [motif, quoi] of [
    [/note moyenne|average rating|nota media|nota média|Bewertung\b/i, "une note moyenne"],
    [/\bavis publiés|published reviews|opiniones publicadas/i, "un compteur d'avis publiés"],
    [/\d\s*%\s*(de\s*)?5\s*étoiles|5\s*stars/i, "un pourcentage de 5 étoiles"],
  ] as [RegExp, string][]) {
    assert.ok(!motif.test(avis), `${quoi} est affiché alors qu'aucun avis n'existe en base`);
  }
});

test("aucun badge ne promet une application qui n'existe pas", () => {
  // ⚠️ MÊME FAUTE QUE LES FAUX AVIS, sous une autre forme : un badge « Télécharger dans
  // l'App Store » affiché avant publication mène à une page d'erreur. Il ne s'affiche
  // donc que si l'adresse est renseignée, et chaque boutique est indépendante — publier
  // d'abord sur Google Play doit montrer le badge Google seul.
  assert.deepEqual(liensStore({}), { ios: null, android: null }, "sans adresse, aucun badge");
  assert.deepEqual(liensStore({ NEXT_PUBLIC_APP_STORE_URL: "" }), { ios: null, android: null });
  // Une valeur qui n'est pas une adresse ne doit pas produire un lien : un `href` vide
  // ou relatif renverrait le visiteur sur le site lui-même, ce qui est pire que rien.
  assert.equal(liensStore({ NEXT_PUBLIC_APP_STORE_URL: "bientôt" }).ios, null, "un texte n'est pas un lien");
  assert.equal(liensStore({ NEXT_PUBLIC_PLAY_STORE_URL: "/telecharger" }).android, null, "un chemin relatif n'est pas un lien");

  const l = liensStore({
    NEXT_PUBLIC_APP_STORE_URL: "https://apps.apple.com/app/id123",
    NEXT_PUBLIC_PLAY_STORE_URL: "https://play.google.com/store/apps/details?id=app.pacevo",
  });
  assert.equal(l.ios, "https://apps.apple.com/app/id123");
  assert.equal(l.android, "https://play.google.com/store/apps/details?id=app.pacevo");
  // Indépendance des deux boutiques.
  assert.equal(liensStore({ NEXT_PUBLIC_PLAY_STORE_URL: "https://play.google.com/x" }).ios, null);
});

test("écrire un avis exige un compte, et rien ne le vérifiait", () => {
  // ⚠️ CE GARDE-FOU N'ÉTAIT PROTÉGÉ PAR AUCUN TEST — trouvé le 23/08/2026 en répondant à
  // « il faut bien un compte pour publier un avis ? ». Oui : `/api/avis` refuse toute
  // soumission anonyme (vérifié en production, HTTP 401 sur GET comme sur POST). Mais les
  // tests existants ne couvraient que la VALIDATION du contenu — note bornée, texte
  // détouré, `publie` forcé à faux. Supprimer les trois lignes qui exigent une session
  // les aurait tous laissés au vert, et ouvert la page d'avis à n'importe qui.
  //
  // Ce que ça coûterait : la page promet « n'afficher que des avis de personnes ayant
  // réellement un compte ». Publier de faux avis de consommateurs est une pratique
  // commerciale trompeuse EN TOUTES CIRCONSTANCES depuis la directive (UE) 2019/2161 —
  // c'est le défaut le plus grave jamais trouvé sur ce site, et il y était déjà une fois.
  //
  // ⚠️ ANCRAGE : on isole le CORPS de chaque méthode, pas le fichier. Un `if (!user)`
  // présent dans le GET aurait sinon couvert un POST laissé ouvert — c'est exactement
  // l'erreur « un motif présent N fois ne rougit que si les N disparaissent ».
  const corpsDe = (code: string, methode: string): string => {
    const i = code.indexOf(`export async function ${methode}(`);
    if (i < 0) return "";
    const j = code.indexOf("\nexport async function", i + 1);
    return code.slice(i, j < 0 ? undefined : j);
  };
  // Les DEUX portes : les témoignages du site, et les avis sur les parcours.
  const PORTES: [string, string[]][] = [
    ["src/app/api/avis/route.ts", ["GET", "POST"]],
    ["src/app/api/community/reviews/route.ts", ["POST"]],
  ];
  for (const [chemin, methodes] of PORTES) {
    const code = sansCommentaires(readFileSync(join(ROOT, chemin), "utf8"));
    for (const m of methodes) {
      const corps = corpsDe(code, m);
      assert.ok(corps, `${m} introuvable dans ${chemin}`);
      assert.match(corps, /auth\.getUser\(\)/, `${chemin} · ${m} ne lit pas la session`);
      assert.match(corps, /if\s*\(!user\)/, `${chemin} · ${m} ne refuse pas un visiteur anonyme`);
      assert.match(corps, /401/, `${chemin} · ${m} ne répond pas 401 sans session`);
    }
  }
  // Et l'écran doit dire la même chose que le serveur : sans session, le formulaire cède
  // la place à une invitation à se connecter. Sinon on laisse quelqu'un écrire 40
  // caractères pour se prendre une erreur au moment de publier.
  //
  // ⚠️ ON VISE LE COUPLAGE, PAS LES DEUX MOTIFS SÉPARÉMENT. Première version de ce test :
  // `assert.match(form, /setEtat\("anonyme"\)/)`. Elle est restée VERTE quand j'ai remplacé
  // le `setEtat("anonyme")` de la branche 401 par `setEtat("pret")` — parce que l'appel
  // subsiste dans le `.catch()` juste en dessous. Un motif présent deux fois ne rougit que
  // si les deux disparaissent. Ce qui compte, c'est que le 401 MÈNE à l'invitation.
  const form = sansCommentaires(readFileSync(join(ROOT, "src/components/avis/AvisForm.tsx"), "utf8"));
  assert.match(form, /r\.status === 401\)\s*return setEtat\("anonyme"\)/,
    "un refus du serveur (401) ne mène plus à l'invitation à se connecter : le visiteur anonyme verrait le formulaire");
});

test("un avis ne peut pas être fabriqué depuis le navigateur", () => {
  // La page promet « n'afficher que des avis de personnes ayant réellement un compte »
  // et « ne jamais en écrire nous-mêmes ». Ce qui rend la promesse tenable, c'est que
  // RIEN de ce que le client envoie n'atteint la base tel quel.
  //
  // ⚠️ LE POINT CRITIQUE : `publie` est forcé à faux à la construction. Un client qui
  // enverrait `{publie: true}` publierait sinon directement sur la page d'accueil du
  // site, sans relecture.
  const a = avisDe(5, "  Un avis assez long pour franchir la validation du serveur.  ", "Cyprien Dumez");
  assert.equal(a.publie, false, "un avis ne doit JAMAIS naître publié");
  assert.equal(a.auteur, "Cyprien D.", "le nom complet ne doit pas être publié");
  assert.equal(a.texte, "Un avis assez long pour franchir la validation du serveur.", "le texte doit être détouré");

  // Le nom vient du profil ; sans profil, on n'invente pas d'identité.
  assert.equal(nomAffiche(""), "Un coureur");
  assert.equal(nomAffiche("Kilian"), "Kilian");

  // Bornes du texte : trop court ce n'est pas un avis, trop long c'est un vecteur d'abus.
  assert.ok(refusDe(5, "trop court"), "un texte trop court doit être refusé");
  assert.ok(refusDe(5, "x".repeat(5000)), "un texte démesuré doit être refusé");
  assert.equal(refusDe(5, "x".repeat(TEXTE_MIN)), null);
  // La note est bornée AUSSI À LA LECTURE : une ligne écrite avant une correction, ou à
  // la main dans la base, ne doit pas afficher onze étoiles.
  assert.ok(refusDe(0, "x".repeat(TEXTE_MIN)), "la note 0 doit être refusée");
  assert.ok(refusDe(6, "x".repeat(TEXTE_MIN)), "la note 6 doit être refusée");
  assert.equal(litAvis({ note: 11, texte: "ok" })?.note, 5, "une note aberrante doit être ramenée à 5");
});

test("ce que la page des tarifs promet, le verrou l'accorde vraiment", () => {
  // ⚠️ LA PAGE ET LE CODE SONT DEUX SOURCES, et c'est le défaut le plus cher d'un site
  // qui vend : promettre une fonction dans une formule qui ne l'ouvre pas, ou la
  // fermer dans une formule qui la facture. Ce test relie les deux là où c'est
  // vérifiable — les capacités, pas la prose.
  assert.ok(!peut("gratuit", "ia"), "le gratuit ne doit RIEN consommer en IA");
  assert.ok(!peut("gratuit", "plan"), "le gratuit ne doit pas avoir le plan complet");
  assert.ok(!peut("gratuit", "gpx"), "le gratuit ne doit pas avoir l'export GPX");
  assert.ok(peut("gratuit", "apercu"), "le gratuit doit voir un aperçu, sinon il ne peut pas juger le produit");
  assert.ok(peut("gratuit", "lecture"), "l'historique reste ouvert : on ne prend personne en otage");

  assert.ok(peut("starter", "plan") && peut("starter", "ia"), "Starter, c'est le coach complet");

  // ⚠️ TROIS PROMESSES « PREMIUM » N'ÉTAIENT VERROUILLÉES NULLE PART. La page réservait
  // les plans IA à la demande, le Smart Journal et les analyses détaillées à Premium
  // dans les cinq langues ; les routes n'exigeaient que `ia`, que Starter possède aussi.
  // Un client à 14,99 € recevait donc ce qu'un client à 9,99 € avait déjà, et la seule
  // différence réelle était le volume d'appels. Une formule qui ne verrouille rien n'est
  // pas une formule — et c'est le genre d'écart qu'un acheteur vérifie ligne à ligne.
  for (const c of ["plan_ia", "journal", "analyse_longue"] as const) {
    assert.ok(!peut("starter", c), `« ${c} » est annoncé Premium mais ouvert à Starter`);
    assert.ok(peut("premium", c), `« ${c} » est annoncé Premium mais fermé à Premium`);
    assert.ok(peut("essai", c), `l'essai doit montrer « ${c} », sinon il fait choisir par méconnaissance`);
    assert.ok(!peut("gratuit", c), `« ${c} » est ouvert au palier gratuit`);
  }
  // ⚠️ CE QUI SÉPARE LES DEUX FORMULES PAYANTES. Si Starter gagnait le GPX, Premium ne
  // se distinguerait plus que par un volume d'IA — trop peu pour justifier 5 € de plus.
  assert.ok(!peut("starter", "gpx"), "le GPX doit rester à Premium");
  assert.ok(peut("premium", "gpx") && peut("premium", "plan") && peut("premium", "ia"));
  // L'essai doit montrer le niveau le PLUS HAUT, sinon il fait choisir par méconnaissance.
  for (const c of ["apercu", "plan", "ia", "gpx"] as const) {
    assert.ok(peut("essai", c), `l'essai doit ouvrir « ${c} »`);
  }

  // L'aperçu doit rester un aperçu : sept jours, et il n'y a plus rien à vendre.
  assert.ok(JOURS_APERCU >= 1 && JOURS_APERCU <= 3, `aperçu de ${JOURS_APERCU} jours — trop généreux ou vide`);

  // Et la page ne doit pas annoncer le GPX dans le gratuit, dans AUCUNE langue.
  const tarifs = readFileSync(join(ROOT, "src/components/landing/landingI18n.ts"), "utf8");
  for (const m of tarifs.matchAll(/cle: "gratuit"[^}]*?features: \[([^\]]*)\]/g)) {
    assert.ok(!/GPX|Trail Builder/i.test(m[1]), `le gratuit annonce le GPX : ${m[1].slice(0, 70)}`);
  }
  let premiumAvecGpx = 0;
  for (const m of tarifs.matchAll(/cle: "premium"[^}]*?features: \[([^\]]*)\]/g)) {
    if (/GPX/i.test(m[1])) premiumAvecGpx++;
  }
  assert.equal(premiumAvecGpx, 5, `le GPX n'est annoncé dans Premium que pour ${premiumAvecGpx} langue(s) sur 5`);
});

test("le détail d'une séance nomme l'appareil, jamais le canal de synchro", () => {
  // ⚠️ OBLIGATION ÉCRITE, pas une préférence. L'article 1.1 des conditions d'API
  // d'intervals.icu impose d'attribuer les données Garmin, et David Tinker a précisé par
  // e-mail le 22/08/2026 : « If you have an activity detail page somewhere, it should
  // include the device name. » L'écran de détail l'affiche donc — sur le chemin
  // principal il vient tel quel d'intervals.icu (« Garmin Forerunner 165 »).
  //
  // ⚠️ CE QUE CE TEST EMPÊCHE : que le REPLI recolle le canal d'entrée dans ce champ.
  // Il valait `w.source`, ce qui affichait « Appareil : GARMIN_CONNECT » — le nom
  // d'aucune montre. Mieux vaut ne rien dire que nommer un appareil qui n'existe pas.
  const route = sansCommentaires(readFileSync(join(ROOT, "src/app/api/activity-detail/route.ts"), "utf8"));
  assert.match(route, /device_name:/, "le détail d'activité n'expose plus l'appareil");
  assert.ok(
    !/device_name:[^,\n]*w\.source \?\?/.test(route),
    "le canal de synchronisation est renvoyé comme s'il était un nom d'appareil",
  );

  // Et l'écran doit toujours l'afficher : l'exposer sans le rendre ne vaut rien.
  const ecran = sansCommentaires(readFileSync(join(ROOT, "src/components/admin/SessionDetail.tsx"), "utf8"));
  assert.match(ecran, /a\.device_name/, "l'écran de détail n'affiche plus l'appareil");
});

test("l'alerte de ressenti se trie d'un coup d'œil", () => {
  // ⚠️ ELLE PARTAIT EN TEXTE BRUT — une ligne de puces, sans logo, sans hiérarchie. Or
  // ce message a une fonction précise : un coach ne LIT pas ses alertes, il les BALAIE.
  // Ce qui compte est de distinguer en une seconde « séance normale » de « douleur
  // signalée à 9/10 ». Rien dans l'ancien message ne permettait ce tri.
  const r = sansCommentaires(readFileSync(join(ROOT, "src/app/api/feedback/route.ts"), "utf8"));

  // Le logo et la mise en page viennent de la coquille COMMUNE : trois habillages écrits
  // séparément finiraient par diverger, comme l'accusé et la lettre l'avaient déjà fait.
  assert.match(r, /coquilleEmail\(/, "l'alerte n'utilise pas la coquille commune — pas de logo");
  assert.match(r, /html:/, "l'alerte repart en texte brut");
  assert.match(r, /text:/, "la version texte a disparu : certains clients n'affichent pas le HTML");

  // ⚠️ LE SEUIL EST POSÉ UNE SEULE FOIS, et il décide À LA FOIS de la couleur et de
  // l'objet. Deux seuils écrits séparément finiraient par se contredire — un objet
  // alarmant sur un message vert.
  const seuils = [...r.matchAll(/r >= 8/g)].length;
  assert.equal(seuils, 1, `le seuil d'alerte est écrit ${seuils} fois — une seule doit exister`);
  assert.match(r, /const alerte = /, "le verdict n'est pas nommé");

  // Et il doit VOYAGER JUSQU'À L'OBJET : c'est la seule partie visible dans une liste de
  // messages, donc le seul endroit où le tri se fait vraiment.
  assert.match(r, /subject: `\$\{alerte \?/, "l'objet ne porte pas le verdict");

  // Répondre à l'alerte doit écrire à l'ATHLÈTE, pas à la boîte d'envoi.
  assert.match(r, /reply_to:/, "impossible de répondre directement à l'athlète");
});

test("aucun bouton de connexion ne mène à un fournisseur éteint", () => {
  // ⚠️ VÉRIFIÉ SUR SUPABASE LE 22/08/2026 : ni Google ni Apple n'étaient activés.
  // `GET /auth/v1/authorize?provider=google` répondait « Unsupported provider: provider
  // is not enabled ». Les DEUX boutons, placés tout en haut de la page de connexion —
  // avant même le champ e-mail — échouaient à chaque clic. C'est la même faute que les
  // faux avis et que le badge App Store : proposer ce qu'on ne peut pas rendre.
  assert.deepEqual(fournisseursActifs(undefined), [], "sans déclaration, aucun bouton");
  assert.deepEqual(fournisseursActifs(""), []);

  // Chaque fournisseur est INDÉPENDANT : activer Google seul ne doit pas faire
  // réapparaître Apple, dont l'activation demande un compte développeur payant.
  assert.deepEqual(fournisseursActifs("google"), ["google"]);
  assert.deepEqual(fournisseursActifs("google,apple"), ["google", "apple"]);

  // Espaces et casse ne doivent pas décider : une variable d'environnement se recopie
  // à la main, et « Google » vaut « google ».
  assert.deepEqual(fournisseursActifs(" Apple , GOOGLE "), ["apple", "google"]);

  // ⚠️ Et un nom inconnu ne crée PAS de bouton : `handleOAuth` ne saurait pas quoi en
  // faire, et le visiteur cliquerait sur un bouton mort d'un genre nouveau.
  assert.deepEqual(fournisseursActifs("github"), [], "un fournisseur non géré ne doit rien afficher");
  assert.deepEqual(fournisseursActifs("google,github"), ["google"]);

  // La page doit VRAIMENT s'en servir : exposer la fonction sans la brancher ne vaut rien.
  const page = sansCommentaires(readFileSync(join(ROOT, "src/app/(auth)/login/page.tsx"), "utf8"));
  assert.match(page, /fournisseursActifs\(/, "la page de connexion n'utilise pas le filtre");
  assert.match(page, /oauth\.includes\("google"\)/, "le bouton Google n'est pas conditionné");
  assert.match(page, /oauth\.includes\("apple"\)/, "le bouton Apple n'est pas conditionné");
});

test("l'espace coach est atteignable, et par les seules adresses autorisées", () => {
  // ⚠️ IL EXISTAIT SANS QU'AUCUN LIEN N'Y MÈNE. Six pages fonctionnelles — clients,
  // séances, messagerie, avis, lettre — correctement protégées, et absentes de la barre
  // latérale : il fallait connaître l'adresse et la taper à la main. Une fonction qu'on
  // ne peut pas atteindre n'existe pas pour celui qui l'utilise.
  const sidebar = sansCommentaires(readFileSync(join(ROOT, "src/components/layout/Sidebar.tsx"), "utf8"));
  const posLien = sidebar.indexOf('href="/admin"');
  assert.ok(posLien > 0, "aucun lien vers l'espace coach dans la barre latérale");

  // ⚠️ ET IL DOIT RESTER CONDITIONNEL. Un lien affiché à tout le monde enverrait chaque
  // athlète sur une page qui le renvoie aussitôt — une porte peinte sur un mur. On vise
  // la condition qui ENTOURE le lien, pas la simple présence du mot ailleurs.
  assert.match(sidebar.slice(Math.max(0, posLien - 200), posLien), /estEditeur\s*&&/,
    "le lien vers l'espace coach n'est plus conditionnel");

  // ⚠️ ET LA BARRE LATÉRALE NE DOIT PAS EN DÉCIDER ELLE-MÊME. C'est un composant CLIENT :
  // dans le navigateur `process.env` est vide, donc relire la liste des administrateurs
  // sur place retombe sur le seul propriétaire historique — et masque le lien à une
  // adresse pourtant autorisée. Le serveur décide, elle affiche.
  assert.ok(!sidebar.includes("admin/acces"), "la barre latérale recalcule l'accès dans le navigateur");

  // ⚠️ UNE SEULE DÉFINITION DE L'ADRESSE. Elle était écrite en dur dans le layout ;
  // ajouter le lien ailleurs en aurait créé une deuxième copie, donc deux vérités qui
  // divergent — le défaut le plus répété de ce projet.
  const layout = sansCommentaires(readFileSync(join(ROOT, "src/app/admin/layout.tsx"), "utf8"));
  assert.ok(!layout.includes("@outlook.fr"), "l'adresse admin est recopiée dans le layout");
  assert.ok(!sidebar.includes("@outlook.fr"), "l'adresse admin est recopiée dans la barre latérale");
  assert.match(layout, /estAdmin\(/, "le layout n'utilise plus la source unique");

  // La vraie barrière reste le contrôle serveur : masquer un lien ne protège rien.
  assert.match(layout, /redirect\(/, "le layout /admin ne renvoie plus les intrus");

  // Et la comparaison ne doit pas se laisser piéger par la casse ou les espaces.
  assert.ok(estAdmin(ADMIN_PAR_DEFAUT, ""));
  assert.ok(estAdmin("  CYPRIENDUMEZ@OUTLOOK.FR  ", ""), "la casse ne doit pas fermer la porte au bon compte");
  assert.ok(!estAdmin("autre@exemple.fr", ""));
  assert.ok(!estAdmin(null, "") && !estAdmin("", ""), "une session vide n'est pas l'éditeur");
});

test("la liste des administrateurs se configure sans redéployer", () => {
  // ⚠️ L'ADRESSE ÉTAIT ÉCRITE DANS LE CODE. Un acheteur n'aurait pas eu accès à son
  // propre espace coach sans modifier les sources et redéployer — et l'ancien
  // propriétaire aurait gardé la sienne. Elle se lit maintenant dans `ADMIN_EMAILS`.
  assert.deepEqual(adminsAutorises(""), [ADMIN_PAR_DEFAUT], "sans variable, le propriétaire historique doit rester");

  // Plusieurs adresses, séparateurs et casse tolérés : on ne perd pas l'accès sur une
  // espace en trop.
  const deux = adminsAutorises("Nouveau@Acheteur.com , cyprien.dumez@gwsp.fr");
  assert.deepEqual(deux, ["nouveau@acheteur.com", "cyprien.dumez@gwsp.fr"]);
  assert.ok(estAdmin("NOUVEAU@ACHETEUR.COM", "nouveau@acheteur.com"), "l'adresse configurée n'ouvre pas la porte");

  // ⚠️ ET SURTOUT : UNE VARIABLE ILLISIBLE NE DOIT PAS ROUVRIR L'ANCIENNE PORTE. Un
  // acheteur qui écrit son adresse de travers rendrait l'accès au vendeur sans que
  // personne ne s'en aperçoive. On ferme pour tout le monde — le défaut se voit.
  assert.deepEqual(adminsAutorises("acheteur.exemple.com"), [], "une variable illisible rouvre l'accès à l'ancien propriétaire");
  assert.ok(!estAdmin(ADMIN_PAR_DEFAUT, "acheteur.exemple.com"), "le propriétaire historique garde l'accès malgré la configuration");

  // La variable ne doit JAMAIS être exposée au navigateur.
  assert.ok(!readFileSync(join(ROOT, "src/lib/admin/acces.ts"), "utf8").includes("NEXT_PUBLIC_ADMIN"),
    "la liste des administrateurs est exposée au navigateur");
});

const LANGUES = ["fr", "en", "de", "es", "pt"] as const;
const toutesLesChaines = (lg: (typeof LANGUES)[number]) => {
  const d = LEGAL[lg];
  const out: string[] = [];
  for (const page of [d.mentions, d.terms, d.privacy]) {
    out.push(page.heading, ...(page.intro ?? []));
    for (const s of page.sections) out.push(s.title, ...(s.paras ?? []), ...(s.list ?? []));
  }
  return out;
};

test("aucune page légale n'affiche un gabarit non résolu", () => {
  // ⚠️ EN SORTANT LES FAITS DANS UNE FICHE UNIQUE, TROIS LANGUES ONT AFFICHÉ
  // « Adresse: ${EDITEUR.adresse}, ${PAYS_EDITEUR.de} » EN TOUTES LETTRES. La chaîne
  // était restée entre guillemets au lieu de devenir un gabarit : le code compilait, les
  // tests passaient, et la page publiée montrait du code source à la place de l'adresse
  // légale. Seul le RENDU le montrait — c'est donc le rendu qu'on vérifie.
  const fautifs: string[] = [];
  for (const lg of LANGUES) {
    for (const c of toutesLesChaines(lg)) {
      if (c.includes("${")) fautifs.push(`${lg} : ${c.slice(0, 70)}`);
    }
  }
  assert.deepEqual(fautifs, [], `gabarit non résolu affiché : ${fautifs.join(" | ")}`);
});

test("l'identité légale de l'éditeur ne vit qu'à un endroit", () => {
  // ⚠️ ELLE ÉTAIT RECOPIÉE ~35 FOIS : mentions légales, CGU et confidentialité en cinq
  // langues, page contact, pied des lettres, texte RGPD des réglages. Une identité qui
  // vit en trente-cinq exemplaires ne se met pas à jour : elle se met à jour À MOITIÉ.
  // Le jour d'une cession, il reste des pages qui ENGAGENT l'ancien éditeur.
  //
  // Deux fichiers ont le droit de la porter, et pour des raisons différentes :
  //  - `brand/editeur.ts` : l'identité PUBLIÉE (LCEN) ;
  //  - `admin/acces.ts`   : le COMPTE qui ouvre l'espace coach, propriétaire par défaut.
  // Ce sont deux notions distinctes — un repreneur peut publier une identité et se
  // connecter avec un autre compte. On ne les fusionne pas, on les autorise séparément.
  const autorises = ["src/lib/brand/editeur.ts", "src/lib/admin/acces.ts"];
  const recopies: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const chemin = join(dir, e.name);
      if (e.isDirectory()) { parcourir(chemin); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const rel = chemin.slice(ROOT.length + 1);
      if (autorises.includes(rel)) continue;
      const src = readFileSync(chemin, "utf8");
      if (src.includes(EDITEUR.email) || src.includes(EDITEUR.adresse)) recopies.push(rel);
    }
  };
  parcourir(join(ROOT, "src"));
  assert.deepEqual(recopies, [], `identité légale recopiée : ${recopies.join(", ")}`);
});

test("tout sous-traitant déclaré est réellement appelé par le code", () => {
  // ⚠️ DÉCLARER UN TIERS QU'ON N'APPELLE JAMAIS trompe le lecteur d'une page qui engage ;
  // appeler un tiers qu'on ne déclare pas est une faute au sens du RGPD. Les deux dérives
  // se produisent en silence : personne ne relit une politique de confidentialité.
  const fichiers: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const chemin = join(dir, e.name);
      if (e.isDirectory()) { parcourir(chemin); continue; }
      // ⚠️ SAUF LA FICHE DE DÉCLARATION ELLE-MÊME. Sans cette exclusion, déclarer un
      // sous-traitant imaginaire écrivait son hôte dans `src/` — et le test en concluait
      // qu'il était appelé. Trouvé en mutant : le fantôme n'a rougi que sur la seconde
      // assertion, pas sur celle qui devait le voir.
      if (/\.tsx?$/.test(e.name) && !chemin.endsWith("brand/editeur.ts")) fichiers.push(readFileSync(chemin, "utf8"));
    }
  };
  parcourir(join(ROOT, "src"));
  const code = fichiers.join("\n");
  const fantomes = SOUS_TRAITANTS.filter((s) => s.preuve && !code.includes(s.preuve)).map((s) => s.nom);
  assert.deepEqual(fantomes, [], `sous-traitant déclaré mais jamais appelé : ${fantomes.join(", ")}`);

  // Et chacun doit être nommé dans la politique de confidentialité, dans les 5 langues.
  const absents: string[] = [];
  for (const lg of LANGUES) {
    const texte = toutesLesChaines(lg).join(" ");
    for (const st of SOUS_TRAITANTS) if (!texte.includes(st.nom)) absents.push(`${lg}/${st.nom}`);
  }
  assert.deepEqual(absents, [], `sous-traitant appelé mais non déclaré : ${absents.join(", ")}`);
});

test("les cinq langues disent où le code serveur s'exécute vraiment", () => {
  // ⚠️ LA POLITIQUE DISAIT « tes données sont hébergées dans l'Union européenne » et
  // n'évoquait, hors UE, que Google, Anthropic et Stripe. VÉRIFIÉ EN PRODUCTION :
  // l'en-tête `x-vercel-id` renvoie `cdg1::iad1::…` — `cdg1` n'est que le point d'entrée
  // parisien, `iad1` est la région où le CODE S'EXÉCUTE, en Virginie. Autrement dit,
  // toute donnée qui traverse une route de l'application est traitée aux États-Unis, et
  // la section « transferts hors UE » ne le disait pas.
  const manques: string[] = [];
  for (const lg of LANGUES) {
    const sec = LEGAL[lg].privacy.sections.find((s) => /^6\./.test(s.title));
    const texte = (sec?.paras ?? []).join(" ");
    if (!texte.includes(HEBERGEUR_APP.region)) manques.push(`${lg} : région d'exécution absente`);
    if (!texte.includes(PAYS_APP[lg])) manques.push(`${lg} : pays d'exécution absent`);
    if (!texte.includes(HEBERGEUR_APP.nom)) manques.push(`${lg} : hébergeur de l'application absent`);
  }
  assert.deepEqual(manques, [], manques.join(" | "));
});

test("les alertes suivent l'éditeur, elles ne restent pas chez l'ancien", () => {
  // ⚠️ QUATRE ROUTES REPLIAIENT SUR L'ADRESSE DU PROPRIÉTAIRE HISTORIQUE, EN DUR :
  // nouvelle inscription, message d'un athlète, ressenti douloureux, objectif de course.
  // Un acheteur qui configure `ADMIN_EMAILS` sans penser à `COACH_EMAIL` aurait continué
  // d'envoyer le nom, l'adresse et les douleurs de SES clients dans la boîte du vendeur —
  // indéfiniment, et sans qu'aucun écran ne le montre. Transmission de données
  // personnelles à un tiers, pas un défaut de confort.
  const routes = [
    "src/app/auth/confirm/route.ts",
    "src/app/api/messages/route.ts",
    "src/app/api/feedback/route.ts",
    "src/app/api/objective/route.ts",
  ];
  const replis: string[] = [];
  const sansGarde: string[] = [];
  for (const r of routes) {
    const src = sansCommentaires(readFileSync(join(ROOT, r), "utf8"));
    // On vise le GESTE : un DESTINATAIRE qui se replie sur une adresse littérale.
    // Attention à ne pas confondre avec `RESEND_FROM || "…@resend.dev"` — c'est
    // l'EXPÉDITEUR de secours de Resend, pas l'identité de l'éditeur.
    if (/\b(COACH_EMAIL|DEST|DESTINATAIRE)\b[^;\n]*\|\|\s*["'][^"']*@/i.test(src)) replis.push(r);
    // Et l'envoi doit être CONDITIONNÉ au destinataire : appeler emailEditeur() puis
    // écrire à une chaîne vide ne vaut rien.
    if (!/emailEditeur\(\)/.test(src)) sansGarde.push(`${r} (n'utilise pas la source unique)`);
    else if (!/&&\s*COACH_EMAIL|\|\|\s*!DEST/.test(src)) sansGarde.push(`${r} (envoie sans destinataire vérifié)`);
  }
  assert.deepEqual(replis, [], `repli en dur vers une adresse : ${replis.join(", ")}`);
  assert.deepEqual(sansGarde, [], `envoi non conditionné : ${sansGarde.join(", ")}`);

  // COACH_EMAIL explicite l'emporte ; sinon on suit la première adresse d'ADMIN_EMAILS.
  const avant = { c: process.env.COACH_EMAIL, a: process.env.ADMIN_EMAILS };
  try {
    process.env.COACH_EMAIL = "  Coach@Exemple.FR ";
    assert.equal(emailEditeur(), "coach@exemple.fr", "COACH_EMAIL explicite n'est pas respectée");

    delete process.env.COACH_EMAIL;
    process.env.ADMIN_EMAILS = "acheteur@exemple.com,second@exemple.com";
    assert.equal(emailEditeur(), "acheteur@exemple.com", "les alertes ne suivent pas ADMIN_EMAILS");

    // ⚠️ Rien d'exploitable → chaîne vide, donc AUCUN envoi. Ne pas prévenir se voit dans
    // les journaux ; prévenir la mauvaise personne, non.
    process.env.ADMIN_EMAILS = "pas-une-adresse";
    assert.equal(emailEditeur(), "", "une configuration illisible désigne quand même un destinataire");
  } finally {
    if (avant.c === undefined) delete process.env.COACH_EMAIL; else process.env.COACH_EMAIL = avant.c;
    if (avant.a === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = avant.a;
  }
});

test("un chemin d'API inconnu répond 404, quelle que soit la méthode", () => {
  // ⚠️ EN PRODUCTION, `POST /api/chemin-inexistant` RÉPONDAIT 200 AVEC UNE PAGE HTML.
  // En GET, 404 correctement. Les intégrations qui écrivent chez nous parlent en POST —
  // Stripe, les webhooks de montre, les notifications de boutique : un chemin mal
  // orthographié leur renvoyait « OK », elles considéraient l'événement livré et ne
  // réessayaient jamais. Un encaissement sans abonnement activé, découvert par la
  // réclamation du client.
  const attrape = join(ROOT, "src/app/api/[...inconnu]/route.ts");
  assert.ok(existsSync(attrape), "aucune route attrape-tout : les chemins d'API inconnus répondent 200 en POST");
  const src = sansCommentaires(readFileSync(attrape, "utf8"));
  assert.match(src, /status:\s*404/, "l'attrape-tout ne renvoie pas un vrai 404");
  // Toutes les méthodes qui écrivent, pas seulement GET : c'est POST qui posait problème.
  for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    assert.match(src, new RegExp(`export const ${m}\\b`), `la méthode ${m} n'est pas couverte`);
  }
});

test("aucun fichier ne redéclare l'identité de l'éditeur", () => {
  // ⚠️ SEIZE COPIES DE L'ADRESSE EXISTAIENT. Quatorze ont été unifiées hier — et j'ai
  // annoncé que c'était fini. C'ÉTAIT FAUX : le test ne regardait que `api/admin`, alors
  // que deux copies vivaient ailleurs (`lib/api/adminGuard.ts` et `api/messages/poll`).
  // Une garde qui ne couvre qu'un dossier laisse croire que le problème est réglé.
  //
  // On vise donc les DEUX gestes qui produisent le défaut, où qu'ils soient écrits :
  // déclarer une constante d'administration contenant une adresse, et comparer l'adresse
  // d'un compte connecté à une chaîne littérale.
  const declare: string[] = [];
  const compare: string[] = [];
  const parcourirSrc = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const chemin = join(dir, e.name);
      if (e.isDirectory()) { parcourirSrc(chemin); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const rel = chemin.slice(ROOT.length + 1);
      if (rel === "src/lib/admin/acces.ts") continue; // la seule définition légitime
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      if (/const\s+\w*ADMIN\w*\s*(?::[^=]+)?=\s*["'][^"']*@[^"']*["']/i.test(src)) declare.push(rel);
      if (/\.email\s*===\s*["']/.test(src)) compare.push(rel);
    }
  };
  parcourirSrc(join(ROOT, "src"));
  assert.deepEqual(declare, [], `adresse d'administration redéclarée : ${declare.join(", ")}`);
  assert.deepEqual(compare, [], `accès décidé en comparant une adresse littérale : ${compare.join(", ")}`);
});

test("aucun composant client ne décide de l'accès administrateur", () => {
  // ⚠️ DANS LE NAVIGATEUR, `process.env` EST VIDE. Un composant client qui importe la
  // source de vérité obtiendrait toujours la liste par défaut : il masquerait le lien à
  // un administrateur légitime, ou pire, servirait de base à un contrôle qui n'en est
  // pas un. Le calcul appartient au serveur, qui transmet un booléen.
  const fautifs: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const chemin = join(dir, e.name);
      if (e.isDirectory()) { parcourir(chemin); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const src = readFileSync(chemin, "utf8");
      if (/^\s*["']use client["']/m.test(src) && src.includes("admin/acces")) {
        fautifs.push(chemin.slice(ROOT.length + 1));
      }
    }
  };
  parcourir(join(ROOT, "src"));
  assert.deepEqual(fautifs, [], `composant(s) client important la source de vérité : ${fautifs.join(", ")}`);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
