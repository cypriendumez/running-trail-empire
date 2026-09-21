/**
 * UNE OPACITÉ TAILWIND HORS ÉCHELLE NE PRODUIT RIEN, ET NE LE DIT PAS.
 *
 * ⚠️ DÉFAUT RÉEL, TROUVÉ LE 10/09/2026 PARCE QUE CYPRIEN A VU LE HAUT DE LA PAGE DÉLAVÉ.
 * Trois voiles sombres couvrent la photo du hero. DEUX rendaient `background-image: none`
 * en production :
 *
 *   from-black/44, via-black/14   → le voile du HAUT n'existait pas : la barre de
 *                                   navigation blanche reposait sur le ciel clair.
 *   from-black/52, to-black/28    → le voile MOBILE n'existait pas : sur téléphone, le
 *                                   texte du hero se posait sur la photo nue.
 *   via-black/12                  → le voile du BAS perdait son point milieu.
 *
 * La cause : l'échelle `opacity` de Tailwind vaut exactement 0, 5, 10 … 100. Écrire `/44`
 * en clair ne lève NI ERREUR NI AVERTISSEMENT — la classe n'est simplement jamais
 * engendrée, et la règle CSS n'existe pas. Le typage n'y peut rien : `className` est une
 * chaîne. Le build passe. Les tests passaient. Seul l'œil, sur la page en ligne, voyait
 * qu'un dégradé manquait.
 *
 * Hors échelle, Tailwind exige les crochets : `from-black/[0.44]`. Cette forme est
 * acceptée ici, puisqu'elle produit bien du CSS.
 *
 * ⚠️ L'ÉCHELLE EST LUE DANS TAILWIND, PAS RECOPIÉE. Une liste écrite à la main se
 * périmerait à la première mise à jour — et une liste périmée qui dit « tout va bien » est
 * pire que pas de test du tout.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/** L'échelle réelle de l'installation, jamais une copie. */
const exiger = createRequire(import.meta.url);
const ECHELLE: Set<string> = new Set(
  Object.keys(exiger("tailwindcss/stubs/config.full.js").theme.opacity as Record<string, string>),
);

/**
 * ⚠️ LES COMMENTAIRES SONT RETIRÉS, ET C'EST INDISPENSABLE ICI : le commentaire qui
 * explique ce défaut dans `page.tsx` CITE les classes fautives. Sans ce nettoyage, le test
 * se déclencherait sur sa propre explication et deviendrait impossible à satisfaire.
 *
 * ⚠️ ET ON NE COUPE PAS SUR `://`. Une URL contient deux barres obliques ; les traiter
 * comme un commentaire amputerait des lignes de code entières.
 */
function sansCommentaires(src: string): string {
  return src
    // ⚠️ ON REMPLACE PAR AUTANT DE SAUTS DE LIGNE, PAS PAR UNE ESPACE. Écraser un bloc de
    // commentaire multi-ligne décale tout ce qui suit : le premier jet annonçait la ligne
    // 347 pour un défaut situé ligne 381. Un numéro faux fait perdre plus de temps qu'il
    // n'en fait gagner.
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");      // lignes, sauf après « : » (URL)
}

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fichiers(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(e)) acc.push(p);
  }
  return acc;
}

/** Toute classe de couleur portant un modificateur d'opacité écrit en clair. */
const MOTIF =
  /\b(?:bg|text|border|ring|divide|outline|decoration|shadow|accent|caret|fill|stroke|placeholder|from|via|to)-[a-z]+(?:-\d{2,3})?\/(\d{1,3})\b/g;

type Trouvaille = { fichier: string; ligne: number; classe: string; valeur: string };

function relever(): Trouvaille[] {
  const out: Trouvaille[] = [];
  for (const f of fichiers("src")) {
    const lignes = sansCommentaires(readFileSync(f, "utf8")).split("\n");
    lignes.forEach((l, i) => {
      for (const m of l.matchAll(MOTIF)) out.push({ fichier: f, ligne: i + 1, classe: m[0], valeur: m[1] });
    });
  }
  return out;
}

const releve = relever();

console.log("\n=== OPACITÉS TAILWIND : la classe existe-t-elle vraiment ? ===\n");

/**
 * ⚠️ SANS CE PLANCHER, LE TEST SUIVANT SERAIT TAUTOLOGIQUE. Si le motif cessait de
 * reconnaître quoi que ce soit — un renommage, une regex cassée — « aucune classe hors
 * échelle » deviendrait vrai parce qu'on n'aurait rien regardé.
 */
test("le balayage reconnaît réellement des classes à opacité", () => {
  assert.ok(releve.length >= 20, `seulement ${releve.length} classes trouvées dans src/ — le motif ne reconnaît plus rien`);
});

test("l'échelle est bien lue dans Tailwind et n'est pas vide", () => {
  assert.ok(ECHELLE.size >= 10, `échelle lue : ${ECHELLE.size} valeurs`);
  assert.ok(ECHELLE.has("50"), "l'échelle ne contient même pas 50 — lecture ratée");
});

test("aucune classe n'utilise une opacité absente de l'échelle Tailwind", () => {
  const hors = releve.filter((t) => !ECHELLE.has(t.valeur));
  const detail = hors.map((t) => `${t.fichier}:${t.ligne} ${t.classe}`);
  assert.deepEqual(detail, [], `classes qui ne produiront AUCUN CSS : ${detail.join(" ; ")}`);
});

/**
 * Les trois voiles du hero sont la raison d'être de ce fichier : on vérifie qu'ils sont
 * toujours là ET toujours valides. Un voile supprimé ne casse rien visiblement en test,
 * mais rend le texte blanc illisible sur une photo claire.
 */
test("le fondu vert du bas du hero rend VRAIMENT quelque chose", () => {
  // ⚠️ DEUX FOIS LE MÊME PIÈGE, ET C'EST TOUTE LA RAISON D'ÊTRE DE CE FICHIER.
  // Il est né d'opacités hors échelle Tailwind qui ne produisaient aucun CSS. Le
  // 17/09/2026, le fondu du bas du hero a été réécrit en `bg-[linear-gradient(...)]` pour
  // cesser d'écraser la piste d'athlétisme : `getComputedStyle` rendait
  // `background-image: none`. La classe était bien dans le DOM, le compilateur n'en avait
  // rien fait, et rien ne le signalait. Or un fondu qui ne rend rien ne se voit pas — il
  // ramène juste la coupure nette qu'il devait supprimer.
  // D'où le style INLINE : il ne passe par aucun compilateur, donc il ne peut pas
  // disparaître en silence.
  const src = sansCommentaires(readFileSync("src/app/page.tsx", "utf8"));
  const m = src.match(/backgroundImage:\s*"linear-gradient\(to bottom,[^"]*?(#[0-9a-fA-F]{6}) 100%\)"/);
  assert.ok(m, "le fondu du bas du hero n'est plus un style inline : une classe arbitraire peut ne produire AUCUN CSS");

  // …et sa dernière étape doit valoir EXACTEMENT la couleur par laquelle commence la
  // section suivante. Sinon la bande réapparaît, à l'endroit précis qu'on voulait adoucir.
  assert.equal(m![1].toLowerCase(), "#059669", `le fondu finit sur ${m![1]} au lieu de #059669 (emerald-600)`);
  const waitlist = readFileSync("src/components/WaitlistSection.tsx", "utf8");
  assert.match(waitlist, /from-emerald-600/,
    "WaitlistSection ne commence plus par emerald-600 : le fondu du hero ne la rejoint plus, la bande revient");
});

test("les trois voiles du hero existent, chacun identifié par son ancrage", () => {
  const src = sansCommentaires(readFileSync("src/app/page.tsx", "utf8"));
  // ⚠️ ON IDENTIFIE CHAQUE VOILE PAR SON ANCRAGE, PAS PAR UN COMPTE. Mon premier jet
  // comptait « 3 dégradés from-black » et rougissait à tort : la page en contient un
  // quatrième, sans rapport, sur les cartes Programmes. Un compte global rend un test
  // sensible à du code étranger — et donc faux.
  const voiles: [string, RegExp][] = [
    ["bas (lisibilité du titre)", /absolute inset-0 bg-gradient-to-t from-black\/(\d+)/],
    ["mobile (colonne de gauche)", /absolute inset-y-0 left-0 [^"]*bg-gradient-to-r from-black\/(\d+)/],
    ["haut (barre de navigation)", /absolute inset-x-0 top-0 [^"]*bg-gradient-to-b from-black\/(\d+)/],
  ];
  for (const [nom, re] of voiles) {
    const m = src.match(re);
    assert.ok(m, `voile ${nom} : introuvable dans le hero`);
    assert.ok(ECHELLE.has(m![1]), `voile ${nom} à from-black/${m![1]} : hors échelle, ne rendra RIEN`);
  }
});


/**
 * ⚠️ QUATRIÈME PANNE SILENCIEUSE DE LA FAMILLE, TROUVÉE LE 21/09/2026 EN MESURANT.
 * `Section` vaut `py-20 sm:py-28`. Écrire `<Section className="pb-0">` retire bien le
 * padding du bas… sur TÉLÉPHONE seulement : `sm:py-28` vit dans une media query, donc
 * APRÈS `pb-0` dans la feuille de style, et l'emporte dès 640 px. Mesuré à 1024 px sur
 * /avis : padding-bottom = 112 px, soit les 224 px de vide « déjà corrigés » qui avaient
 * survécu sur ordinateur. Ni l'ordre des classes dans l'attribut ni `twMerge` (qui ne
 * voit pas de conflit entre deux variantes) n'y changent rien.
 *
 * La règle : sur une `Section`, tout padding vertical écrit en base (`pt-*`, `pb-*`,
 * `py-*`) doit être RÉÉCRIT dans la variante `sm:` — sinon il n'existe que sur téléphone.
 */
const SECTION_CLASSE = /<Section\s+className="([^"]*)"/g;
type Manque = { fichier: string; ligne: number; classe: string };

/**
 * La valeur que `Section` impose dès 640 px — LUE dans le composant, pas recopiée. Un
 * `pt-28` en base rend exactement ce que `sm:py-28` rendra ensuite : aucune différence
 * visible, donc pas une panne. Le test ne signale que ce qui CHANGE au passage du seuil.
 */
const SM_SECTION = /sm:py-(\d+)/.exec(readFileSync("src/components/ui/Container.tsx", "utf8"))?.[1];

function paddingsOrphelins(): Manque[] {
  const out: Manque[] = [];
  for (const f of fichiers("src/app")) {
    const lignes = sansCommentaires(readFileSync(f, "utf8")).split("\n");
    lignes.forEach((l, i) => {
      for (const m of l.matchAll(SECTION_CLASSE)) {
        const classes = m[1].split(/\s+/).filter(Boolean);
        const sm = new Set(classes.filter((c) => c.startsWith("sm:")).map((c) => c.slice(3).replace(/-.*$/, "")));
        for (const c of classes) {
          const [, cote, valeur] = /^(pt|pb|py)-(.+)$/.exec(c) ?? [];
          if (!cote) continue;
          if (valeur === SM_SECTION) continue;   // même valeur des deux côtés du seuil
          const couvert = sm.has(cote) || sm.has("py") || (cote === "py" && sm.has("pt") && sm.has("pb"));
          if (!couvert) out.push({ fichier: f, ligne: i + 1, classe: c });
        }
      }
    });
  }
  return out;
}

test("le balayage reconnaît réellement des <Section className> avec un padding vertical", () => {
  assert.ok(SM_SECTION, "la valeur sm: de Section n'a pas été trouvée dans Container.tsx");
  let vus = 0;
  for (const f of fichiers("src/app")) {
    for (const m of sansCommentaires(readFileSync(f, "utf8")).matchAll(SECTION_CLASSE)) {
      if (/(^|\s)(pt|pb|py)-/.test(m[1])) vus++;
    }
  }
  assert.ok(vus >= 2, `${vus} Section(s) avec padding en base — le motif ne voit plus rien`);
});

test("un padding vertical posé sur une Section est aussi posé dans la variante sm:", () => {
  const manques = paddingsOrphelins();
  assert.equal(
    manques.length, 0,
    "padding qui n'existe que sur téléphone (sm:py-28 l'emporte dès 640 px) :\n" +
      manques.map((m) => `  ${m.fichier}:${m.ligne}  ${m.classe}`).join("\n"),
  );
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
for (const f of fails) console.log(`  ✗ ${f}`);
if (fails.length) process.exit(1);
