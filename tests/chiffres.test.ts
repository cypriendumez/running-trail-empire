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
import { accesDe } from "../src/lib/billing/access";
import { PRIX_AFFICHES } from "../src/lib/billing/prix";
import { ATTRIBUTION_GARMIN, PAGES_ATTRIBUTION } from "../src/components/legal/attributionI18n";
import { liensStore } from "../src/lib/brand/stores";
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
  const MARQUEURS = /\[(À RENSEIGNER|TO COMPLETE|AUSZUFÜLLEN|POR COMPLETAR|A PREENCHER)[^\]]*\]/g;

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
      /particulier|individual|Privatperson|particular/i.test(restants[0]),
      `le trou restant en ${lg} n'est pas le statut juridique : ${restants[0]}`,
    );
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
  const landing = sansCommentaires(readFileSync(join(ROOT, "src/app/page.tsx"), "utf8"));
  const cites = [...landing.matchAll(/logo:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(cites.length >= 5, `seulement ${cites.length} logo(s) cité(s) — la rangée a-t-elle changé ?`);
  for (const f of cites) {
    assert.ok(
      existsSync(join(ROOT, "public/brands", f)),
      `la page d'accueil affiche « ${f} » mais le fichier n'existe pas : image cassée en production`,
    );
  }
  // ⚠️ Strava a été retiré de la rangée, et son fichier REVIENT TOUT SEUL : iCloud
  // restaure les fichiers supprimés de ce dossier (permissions `-rw-------`, taille et
  // date d'origine — vu le 21/08/2026). Ce qui compte n'est pas qu'il soit sur le disque
  // mais qu'il parte en ligne : Vercel déploie ce que git suit. On interroge donc GIT,
  // pas le système de fichiers — sinon le test rougit sur un fichier qui ne sera jamais
  // publié, et on finirait par l'ignorer.
  const suivis = execSync("git ls-files public/brands", { cwd: ROOT }).toString().trim().split("\n").filter(Boolean);
  assert.ok(!suivis.some((f) => f.includes("strava")), "strava.svg est suivi par git : il serait déployé alors que la marque a été retirée");
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

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
