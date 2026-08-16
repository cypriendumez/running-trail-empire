/**
 * AUCUN NOUVEAU TEXTE FRANÇAIS EN DUR DANS UN ÉCRAN ATHLÈTE.
 *
 * L'app traduit en 5 langues par TROIS mécanismes (dictionnaire `T` + `useT()`, tables
 * `*I18n.ts` par domaine, tables `Record<Lang,…>` déclarées dans le composant). Aucun des
 * trois n'empêche d'écrire simplement « Aucune notification » dans le JSX — et c'est
 * exactement comme ça qu'un audit du 16/08/2026 a retrouvé une cinquantaine de chaînes
 * françaises en dur, dont la barre du haut, affichée sur CHAQUE page.
 *
 * Ce test fige l'état : la dette connue est listée nommément ci-dessous, et TOUTE chaîne
 * française qui n'y figure pas fait échouer la suite. La liste ne peut que rétrécir — une
 * entrée qui a disparu du code doit être retirée d'ici, sinon le test échoue aussi.
 *
 *   npx tsx tests/i18n.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { T, LANGS, type Lang } from "../src/lib/i18n/translations";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

let passed = 0;
const fails: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { fails.push(`${name} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${name}`); }
}

// ── Ce qu'on inspecte ────────────────────────────────────────────────────────
// L'espace admin est HORS PÉRIMÈTRE : il a un seul utilisateur, francophone.
// Les fichiers `*I18n.*` SONT la traduction — leur entrée `fr` n'est pas un oubli.
// Les routes `preview-*` sont des bancs d'essai jetables.
const HORS_PERIMETRE = /\/admin\/|I18n\.tsx?$|\/preview-|\/api\//;

function fichiersEcrans(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiersEcrans(p, out);
    else if (p.endsWith(".tsx") && !HORS_PERIMETRE.test(p)) out.push(p);
  }
  return out;
}

// ── Détection du français ────────────────────────────────────────────────────
const ACCENTS = /[àâäéèêëîïôöùûüçœÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒ]/;
const MOTS_FR = /\b(le|la|les|un|une|des|du|de|au|aux|ton|ta|tes|mon|ma|mes|son|sa|ses|pour|avec|sur|dans|par|sans|sous|est|sont|tu|vous|nous|plus|moins|tous|toutes|chaque|cette|ces|qui|que|dont|donc|mais|encore|jamais|toujours|aucun|aucune|voir|nom|rien|tout|toute|chargement|parcours|courses|partager|chercher|joindre|choisir|retour|semaine|jour|jours|allure|objectif|profil|donnees)\b/i;
/** Signes que la « chaîne » capturée est en réalité du code (génériques TS, expressions). */
const CODE = /[;{}]|=>|\bconst\b|\buseState\b|\bnull\b|\breturn\b|==|&&|\|\||\?\.|<|>/;

function estFrancaisVisible(s: string): boolean {
  const t = s.trim();
  if (t.length < 3) return false;
  if (CODE.test(t)) return false;
  if (/^[\w.\-/#[\]:]+$/.test(t)) return false;
  if (/^(https?:|\/|#|@)/.test(t)) return false;
  if (/\b(flex|grid|rounded|text-|bg-|border-|hover:|md:|sm:|lg:)\b/.test(t)) return false;
  return ACCENTS.test(t) || MOTS_FR.test(t);
}

/** Frontière posée à la place d'une interpolation. Un caractère qu'aucun texte ne contient. */
const SEP = "\u0000";

/**
 * Commentaires retirés — sinon la moitié du relevé est faite de prose française qui
 * n'atteint jamais l'écran. Même précaution que `codeOf` dans coach.test.ts, et pour la
 * même raison : on veut mesurer ce qui s'AFFICHE.
 */
function sansCommentaires(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
}

/** Un fragment qui contient un guillemet ou une affectation vient d'un littéral de code. */
const FRAGMENT_DE_CODE = /["`\\]|=/;

/**
 * Chaînes RÉELLEMENT VISIBLES d'un fichier.
 *
 * ⚠️ Les deux angles morts de l'audit initial, corrigés ici, parce qu'ils cachaient de
 * vraies chaînes : (1) le texte mêlé à une interpolation — `Aucun résultat pour {q}` —
 * était ignoré, donc on découpe sur `{…}` avant d'examiner ; (2) un mot isolé sans accent
 * — « Chargement », « Parcours » — passait au travers, d'où les mots sans accent dans
 * `MOTS_FR`.
 */
function chainesVisibles(code: string): string[] {
  const out: string[] = [];
  // Le `$` du littéral gabarit part avec l'accolade, sinon `${x} portions` laisse un « $ ».
  const sansExpr = sansCommentaires(code).replace(/\$?\{[^{}]*\}/g, SEP);
  for (const m of sansExpr.matchAll(/>([^<>]+)</g)) {
    // Le motif traverse les lignes — indispensable, une phrase JSX est souvent sur
    // plusieurs. Mais il enjambe alors des dictionnaires entiers : dès qu'un guillemet
    // apparaît dans la zone capturée, ce n'est plus du texte affiché, on jette TOUT.
    if (FRAGMENT_DE_CODE.test(m[1])) continue;
    for (const frag of m[1].split(SEP)) out.push(frag);
  }
  for (const m of code.matchAll(/\b(placeholder|title|alt|label|aria-label)\s*=\s*["']([^"']+)["']/g)) out.push(m[2]);
  // Phrases CONSTRUITES : `${n} sorties superposées · …`. Elles échappent au balayage du
  // JSX puisqu'elles vivent dans un littéral, et c'est ainsi que deux phrases entières de
  // la carte de chaleur étaient restées invisibles au premier relevé. On ne retient que
  // les gabarits INTERPOLÉS : les dictionnaires en ligne, eux, sont des chaînes simples.
  for (const m of sansCommentaires(code).matchAll(/`([^`\\]*\$\{[^`\\]*)`/g)) {
    for (const frag of m[1].replace(/\$?\{[^{}]*\}/g, SEP).split(SEP)) out.push(frag);
  }
  for (const m of code.matchAll(/(?:toast|alert|setError|setMsg|setStatus)\w*\(\s*["'`]([^"'`{]+)["'`]/g)) out.push(m[1]);
  return [...new Set(out.filter(estFrancaisVisible).map((s) => s.trim().replace(/\s+/g, " ")))];
}

/**
 * DETTE CONNUE — relevée le 16/08/2026, à résorber écran par écran.
 *
 * ⚠️ N'AJOUTE RIEN ICI pour faire passer le test. Une entrée de plus, c'est une chaîne de
 * plus qu'un athlète allemand lira en français. Traduis-la ; puis retire-la de cette
 * liste, ce que le test t'obligera de toute façon à faire.
 */
const DETTE_CONNUE: string[] = [
  "Ajouter des amis",  // src/components/social/SocialHub.tsx
  "Approfondir avec le coach",  // src/components/cours/AskCoachButton.tsx
  "Athlètes ·",  // src/components/social/SocialHub.tsx
  "Aucun athlète ne correspond à «",  // src/components/social/SocialHub.tsx
  "Aucun commentaire — sois le premier.",  // src/components/social/SocialHub.tsx
  "Carte de chaleur",  // src/app/dashboard/heatmap/page.tsx
  "Cette sortie ne contient pas assez de points GPS pour un survol.",  // src/components/segments/SurvolChoix.tsx
  "Chercher un athlète par son nom…",  // src/components/social/SocialHub.tsx
  "Chercher une notion…",  // src/components/cours/CoursSearch.tsx
  "Choisir une sortie",  // src/components/segments/SurvolChoix.tsx
  "Courez plus loin.",  // src/app/opengraph-image.tsx
  "Cours en groupe, et donne-toi des objectifs datés.",  // src/components/clubs/ClubsHub.tsx
  "Crée le premier avec le bouton en haut de page.",  // src/components/clubs/ClubsHub.tsx
  "Entraînement, trail, matériel, nutrition — dans ta boîte mail. Désinscription en un clic.",  // src/components/community/CommunityFeed.tsx
  "Inclus, sans abonnement.",  // src/app/dashboard/survol/page.tsx
  "Inscription confirmée — tu recevras nos articles par e-mail.",  // src/components/NewsletterSignup.tsx
  "Joindre une séance",  // src/components/social/SocialHub.tsx
  "L'APP RUNNING LA PLUS AVANCÉE · 2026",  // src/app/opengraph-image.tsx
  "La carte se construit à partir des traces GPS importées depuis ta montre. Lance une synchronisation, puis reviens.",  // src/app/dashboard/heatmap/page.tsx
  "Le Club",  // src/components/social/SocialHub.tsx
  "Le coach IA approfondit ce chapitre avec TES données",  // src/components/cours/AskCoachButton.tsx
  "Les sorties de ceux que tu suis, et les tiennes.",  // src/components/social/SocialHub.tsx
  "Les traces GPS ne sont pas accessibles pour le moment.",  // src/app/dashboard/heatmap/page.tsx
  "Maître du segment",  // src/components/segments/SegmentList.tsx
  "Mon temps",  // src/components/segments/SegmentList.tsx
  "Nom du club",  // src/components/clubs/ClubsHub.tsx
  "Nom du défi — ex. 100 km en janvier",  // src/components/clubs/ClubsHub.tsx
  "Ouvert à tous",  // src/components/clubs/ClubsHub.tsx
  "Pacevo · données © OpenStreetMap",  // src/components/parcours/LiveViewer.tsx
  "Partager une séance…",  // src/components/social/SocialHub.tsx
  "Rejoue ta sortie vue du ciel, relief compris.",  // src/app/dashboard/survol/page.tsx
  "Reçois nos articles & conseils course",  // src/components/community/CommunityFeed.tsx
  "Rien dans",  // src/components/social/SocialHub.tsx
  "Rien à afficher",  // src/app/dashboard/heatmap/page.tsx
  "Réservé au club",  // src/components/clubs/ClubsHub.tsx
  "Séance enregistrée sans mesure détaillée.",  // src/components/social/SocialHub.tsx
  "Temps intermédiaires",  // src/components/activity/StravaBlocks.tsx
  "Tracé © les contributeurs OpenStreetMap (ODbL)",  // src/components/parcours/ParcoursBrowser.tsx
  "Trouver des athlètes",  // src/components/social/SocialHub.tsx
  "arrêt",  // src/components/activity/StravaBlocks.tsx
  "passages au même endroit.",  // src/app/dashboard/heatmap/page.tsx
  "passages sur 90 jours",  // src/components/segments/SegmentList.tsx
  "portions détectées dans ton historique, chacune parcourue plusieurs fois.",  // src/app/dashboard/segments/page.tsx
  "portions parcourues · jusqu'à",  // src/app/dashboard/heatmap/page.tsx
  "sorties superposées ·",  // src/app/dashboard/heatmap/page.tsx
  "ton@email.com",  // src/components/NewsletterSignup.tsx
  "trophées, tous calculés sur tes séances réelles.",  // src/app/dashboard/trophees/page.tsx
  "vous@exemple.com",  // src/app/(auth)/forgot-password/page.tsx
  "· objectif",  // src/components/clubs/ClubsHub.tsx
  "Écrire un commentaire…",  // src/components/social/SocialHub.tsx
  "Élév.",  // src/components/activity/StravaBlocks.tsx
  "ᵉ sur",  // src/components/activity/SessionSegments.tsx
];

// ─────────────────────────────────────────────────────────────────────────────
console.log("\nI18N — aucun texte français en dur dans un écran athlète");

const releve = new Map<string, string[]>();   // chaîne → fichiers où elle apparaît
for (const f of fichiersEcrans(SRC)) {
  for (const s of chainesVisibles(readFileSync(f, "utf8"))) {
    releve.set(s, [...(releve.get(s) ?? []), relative(ROOT, f)]);
  }
}

// Régénérer la liste : `I18N_DUMP=1 npx tsx tests/i18n.test.ts`. Le relevé sort prêt à
// coller — sans quoi on est tenté de recopier à la main ce que le test vient de trouver.
if (process.env.I18N_DUMP) {
  for (const [s, fs] of [...releve.entries()].sort()) console.log(`  ${JSON.stringify(s)},  // ${fs[0]}`);
  process.exit(0);
}

test("aucune chaîne française en dur hors de la dette recensée", () => {
  const connues = new Set(DETTE_CONNUE);
  const nouvelles = [...releve.entries()].filter(([s]) => !connues.has(s));
  const detail = nouvelles.slice(0, 12).map(([s, fs]) => `\n    « ${s} »  →  ${fs[0]}`).join("");
  assert.equal(
    nouvelles.length, 0,
    `${nouvelles.length} chaîne(s) française(s) en dur non recensée(s) — traduis-les, ne les ajoute pas à DETTE_CONNUE :${detail}`,
  );
});

test("la dette ne contient rien de périmé (la liste ne peut que rétrécir)", () => {
  const perimees = DETTE_CONNUE.filter((s) => !releve.has(s));
  assert.equal(
    perimees.length, 0,
    `${perimees.length} entrée(s) de DETTE_CONNUE ne sont plus dans le code : retire-les.${perimees.slice(0, 8).map((s) => `\n    « ${s} »`).join("")}`,
  );
});

// ── Intégrité du dictionnaire — une clé sans traduction retombe en français ──
console.log("\nDICTIONNAIRE — les 5 langues, sans trou");

const langs = LANGS.map((l) => l.code) as Lang[];

test("toute clé française existe dans les 4 autres langues", () => {
  for (const l of langs) {
    if (l === "fr") continue;
    const manquantes = Object.keys(T.fr).filter((k) => T[l][k] === undefined);
    assert.equal(manquantes.length, 0, `${l} : ${manquantes.length} clé(s) manquante(s) → ${manquantes.slice(0, 6).join(", ")}`);
  }
});

test("aucune clé traduite ne manque au français (source de repli)", () => {
  for (const l of langs) {
    if (l === "fr") continue;
    const orphelines = Object.keys(T[l]).filter((k) => T.fr[k] === undefined);
    assert.equal(orphelines.length, 0, `${l} : ${orphelines.length} clé(s) sans équivalent français → ${orphelines.slice(0, 6).join(", ")}`);
  }
});

test("les paramètres d'une phrase sont les mêmes dans toutes les langues", () => {
  // Une traduction qui perd `{n}` affiche « il te reste jours » ; une qui invente `{jour}`
  // laisse l'accolade brute à l'écran, `interpolate` ne remplaçant que les clés fournies.
  const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const k of Object.keys(T.fr)) {
    const attendu = params(T.fr[k]);
    for (const l of langs) {
      if (l === "fr") continue;
      assert.equal(params(T[l][k] ?? ""), attendu, `${k} en ${l} : paramètres « ${params(T[l][k] ?? "")} » ≠ « ${attendu} » du français`);
    }
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
