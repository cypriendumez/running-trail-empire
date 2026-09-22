/**
 * LE COURS DU COUREUR — parité des cinq langues, sources vérifiables, page qui tient.
 *
 * Refonte du 22/09/2026 (Cyprien : « le cours est le meilleur que tu penses faire ? améliore-
 * le ») : 15 chapitres (3 de plus : le coach Pacevo, femmes & course, chaleur/froid/altitude),
 * et par chapitre un objectif, des erreurs classiques, une action DANS l'app et des sources
 * PubMed vérifiées par l'API NCBI.
 *
 * Ce que ce fichier garde :
 *  1. Les cinq langues ont la MÊME structure (ids, nombre de notions, quiz, index des
 *     bonnes réponses) — une langue qui décroche affiche un cours amputé sans erreur.
 *  2. Chaque action mène à une route qui existe, chaque source a un PMID de forme valide,
 *     et — quand le réseau est là — NCBI confirme le titre de chaque PMID.
 *  3. La page ne déborde plus sur téléphone (grille à 12 colonnes et 32 px de gouttière
 *     = 352 px de vide dans 287 : mesuré) et rend les nouveaux blocs.
 *
 *   npx tsx tests/cours.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getCoursContent } from "../src/data/cours";
import { SOURCES_COURS } from "../src/data/cours/sources";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void | Promise<void>) {
  return Promise.resolve().then(fn).then(() => { passed++; console.log("  OK " + nom); }, (e) => { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); });
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const LANGUES = ["fr", "en", "de", "es", "pt"] as const;
const FR = getCoursContent("fr");

(async () => {
  console.log("\n=== LE COURS DU COUREUR ===\n");

  await test("15 chapitres, 90+ notions, et les cinq langues ont exactement la même structure", () => {
    assert.equal(FR.chapters.length, 15, `${FR.chapters.length} chapitres en français`);
    assert.deepEqual(FR.chapters.map((c) => c.id).slice(-3), ["coach", "femmes", "milieu"], "les trois chapitres ajoutés le 22/09/2026 manquent ou ne sont pas en dernier");
    const notions = FR.chapters.reduce((s, c) => s + c.concepts.length, 0);
    assert.ok(notions >= 90, `${notions} notions seulement`);
    for (const lg of LANGUES) {
      const c = getCoursContent(lg);
      assert.deepEqual(c.chapters.map((x) => x.id), FR.chapters.map((x) => x.id), `${lg} : chapitres ≠ fr`);
      assert.deepEqual(c.chapters.map((x) => x.concepts.length), FR.chapters.map((x) => x.concepts.length), `${lg} : nombre de notions par chapitre ≠ fr`);
      assert.equal(c.quiz.length, FR.quiz.length, `${lg} : ${c.quiz.length} questions de quiz, fr en a ${FR.quiz.length}`);
      assert.deepEqual(c.quiz.map((q) => q.answer), FR.quiz.map((q) => q.answer), `${lg} : l'index des bonnes réponses diffère du français`);
      assert.deepEqual(c.quiz.map((q) => q.anchor), FR.quiz.map((q) => q.anchor), `${lg} : les ancres du quiz diffèrent`);
      for (const q of c.quiz) assert.equal(q.options.length, 3, `${lg} : une question n'a pas 3 options`);
      // Le titre de chaque chapitre commence par son numéro, dans l'ordre.
      c.chapters.forEach((x, i) => assert.ok(x.title.startsWith(`${i + 1} · `), `${lg} : « ${x.title} » devrait commencer par « ${i + 1} · »`));
    }
  });

  await test("chaque chapitre, dans chaque langue, a un objectif, 2-3 erreurs classiques et une action vers une route qui existe", () => {
    const routes = (href: string) => existsSync(`src/app${href}/page.tsx`);
    for (const lg of LANGUES) {
      for (const ch of getCoursContent(lg).chapters) {
        assert.ok(ch.objectif && ch.objectif.length > 30, `${lg}/${ch.id} : objectif manquant ou trop court`);
        assert.ok(ch.erreurs && ch.erreurs.length >= 2 && ch.erreurs.length <= 3, `${lg}/${ch.id} : ${ch.erreurs?.length ?? 0} erreur(s) classique(s), il en faut 2 à 3`);
        assert.ok(ch.action && ch.action.text.length > 20 && ch.action.label.length > 2, `${lg}/${ch.id} : action manquante`);
        assert.ok(routes(ch.action!.href), `${lg}/${ch.id} : l'action mène à ${ch.action!.href}, qui n'existe pas`);
      }
    }
  });

  await test("chaque chapitre cite au moins une source PubMed de forme valide, sans doublon dans un chapitre", () => {
    for (const ch of FR.chapters) {
      const s = SOURCES_COURS[ch.id];
      assert.ok(s && s.length >= 1, `${ch.id} : aucune source`);
      const pmids = s.map((x) => x.pmid);
      assert.equal(new Set(pmids).size, pmids.length, `${ch.id} : PMID en double`);
      for (const src of s) {
        assert.match(src.pmid, /^\d{7,8}$/, `${ch.id} : PMID « ${src.pmid} » mal formé`);
        assert.match(src.label, /\d{4}/, `${ch.id} : le libellé « ${src.label} » ne porte pas d'année`);
        assert.ok(src.titre.length > 15, `${ch.id} : titre de source trop court`);
      }
      // Et les sources sont bien jointes au chapitre assemblé.
      assert.equal(ch.sources?.length, s.length, `${ch.id} : sources non jointes au chapitre`);
    }
  });

  await test("les libellés d'interface ajoutés existent dans les cinq langues, avec leurs paramètres", () => {
    for (const lg of LANGUES) {
      const ui = getCoursContent(lg).ui;
      for (const k of ["objectifLabel", "erreursLabel", "actionLabel", "sourcesLabel"] as const) assert.ok(ui[k] && ui[k].length > 3, `${lg} : ${k} manquant`);
      assert.ok(ui.progression.compteur.includes("{n}") && ui.progression.compteur.includes("{total}"), `${lg} : progression.compteur sans {n}/{total}`);
      assert.ok(ui.progression.marquer && ui.progression.marque, `${lg} : libellés « marquer comme lu » manquants`);
    }
  });

  await test("la page : une colonne sur téléphone, sommaire mobile, progression, blocs du chapitre, liens PubMed sûrs", () => {
    const src = codeNu("src/app/dashboard/cours/page.tsx");
    assert.ok(!/className="grid grid-cols-12 gap-8"/.test(src), "la grille à 12 colonnes et 32 px de gouttière est revenue : 65 px de débordement sur téléphone");
    assert.match(src, /className="grid grid-cols-1 gap-0 lg:grid-cols-12 lg:gap-8"/, "la grille du cours n'est plus à une colonne sous lg");
    assert.match(src, /<CoursSommaireMobile items=/, "le sommaire du téléphone a disparu");
    assert.match(src, /<CoursBarreProgression ids=\{chapters\.map\(\(c\) => c\.id\)\}/, "la barre de progression a disparu du héros");
    assert.match(src, /<CoursMarquerLu id=\{ch\.id\}/, "le bouton « marquer comme lu » a disparu des chapitres");
    for (const bloc of ["ch.objectif", "ch.erreurs", "ch.action", "ch.sources"]) assert.ok(src.includes(bloc), `la page ne rend plus ${bloc}`);
    assert.match(src, /href=\{`https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\$\{src\.pmid\}\/`\} target="_blank" rel="noopener noreferrer"/, "les liens PubMed ne sont plus des liens externes sûrs");
    for (const id of ["coach", "femmes", "milieu"]) assert.match(src, new RegExp(`^\\s*${id}:\\s*\\{ icon:`, "m"), `pas d'icône/couleur pour le chapitre « ${id} »`);
    // La progression vit dans le navigateur, remplie APRÈS le montage (pas au rendu serveur).
    const prog = codeNu("src/components/cours/CoursProgression.tsx");
    assert.match(prog, /useState<Set<string>>\(new Set\(\)\)/, "la progression est lue au rendu (désynchronisation serveur/navigateur)");
    assert.match(prog, /useEffect\(\(\) => \{\s*setLus\(lire\(\)\)/, "la progression n'est plus lue au montage");
  });

  // ── Vérification en ligne des sources : NCBI confirme chaque PMID ────────────
  const enLigne = await fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi?retmode=json", { signal: AbortSignal.timeout(4000) }).then((r) => r.ok).catch(() => false);
  if (!enLigne) {
    console.log("  (NCBI injoignable : vérification des PMID ignorée)");
  } else {
    await test("NCBI confirme chaque PMID cité : l'article existe et son titre est celui qu'on cite", async () => {
      // TOUTES les citations (un même PMID cité dans deux chapitres est vérifié deux fois :
      // c'est le titre écrit dans CHAQUE chapitre qui doit être juste).
      const toutes = Object.values(SOURCES_COURS).flat();
      const ids = [...new Set(toutes.map((s) => s.pmid))].join(",");
      const r = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids}&retmode=json`, { signal: AbortSignal.timeout(15000) });
      const j = await r.json() as { result: Record<string, { title?: string; pubdate?: string }> };
      const ecarts: string[] = [];
      for (const s of toutes) {
        const art = j.result[s.pmid];
        if (!art || !art.title) { ecarts.push(`${s.pmid} : introuvable`); continue; }
        // Le titre cité est un préfixe (ou l'intégralité) du titre NCBI, à la ponctuation près.
        const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (!norm(art.title).startsWith(norm(s.titre).slice(0, 40))) ecarts.push(`${s.pmid} : titre cité « ${s.titre.slice(0, 50)} » ≠ NCBI « ${art.title.slice(0, 60)} »`);
        const annee = s.label.match(/\d{4}/)?.[0];
        if (annee && art.pubdate && !art.pubdate.startsWith(annee)) ecarts.push(`${s.pmid} : année ${annee} ≠ NCBI ${art.pubdate}`);
      }
      assert.deepEqual(ecarts, [], ecarts.join("\n      "));
    });
  }

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) process.exit(1);
})();
