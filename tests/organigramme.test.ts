/**
 * L'ORGANIGRAMME DE L'ÉQUIPE D'AGENTS — né d'un brouillon qui ne collait pas au dépôt (09/11/2026).
 *
 * Le document de départ affirmait que les agents n°2 à 70 étaient « déjà codés » dans des fichiers
 * (il n'en existe aucun : ils vivent dans le tableau de `ops/CONSTITUTION.md`), déclarait onze
 * directeurs « ACTIFS » sans qu'aucune routine ne les appelle, donnait à chacun sa routine (dont
 * trois quotidiennes, sur un quota déjà saturé) et voulait un registre TypeScript dans l'application.
 * Une hiérarchie recopiée à plusieurs endroits dérive à la première modification. Ce test impose UNE
 * source (`ops/direction/README.md`), la confronte aux numéros et aux noms gelés de la constitution,
 * et vérifie que chaque fiche de direction existe au format des sous-agents du dépôt, nomme chacun de
 * ses agents et garde sa règle d'arrêt (« Rien ne part sans le GO de Cyprien Dumez. »).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const README = readFileSync("ops/direction/README.md", "utf8");
const CONSTITUTION = readFileSync("ops/CONSTITUTION.md", "utf8");
const EN_TETE = "| n° | Agent | Pôle | Rend compte à | Statut réel (09/11/2026) | Où il s'exécute |";
const SENTINELLE = "Rien ne part sans le GO de Cyprien Dumez.";
const STATUTS = ["ACTIF", "VAGUE 2", "EN ATTENTE", "APP", "FUSIONNÉ", "DÉFINI"];
const FUSIONS: Record<number, string> = {
  38: "@ToolBuilder → @Magnet", 43: "@StravaGhost → @Trophy", 54: "@B2BCoachLink → @PacerB2B",
  56: "@PromptOptimizer → @PromptEvolver", 57: "@LocaleLocalization → @Polyglot", 60: "@RefundBot → @Percepteur",
};
const DIRECTEURS: Array<[number, string, string]> = [
  [72, "@Strategos", "A"], [73, "@Chancelier", "B"], [74, "@HeadCoach", "C"], [75, "@Architect", "D"],
  [76, "@Maestro", "E"], [77, "@Mercator", "F"], [78, "@Alliance", "G"], [79, "@Trésorier", "H"],
  [80, "@Oracle", "I"], [81, "@Conductor", "J"],
];

type Ligne = { numero: number | null; agent: string; pole: string; rendCompteA: string; statut: string; ou: string };

/** Le tableau des 81 numéros + @Vigie, tel que le README l'écrit. Une colonne de plus ou de moins = défaut. */
function lireTableau(): Ligne[] {
  const lignes = README.split("\n");
  const debut = lignes.indexOf(EN_TETE);
  assert.ok(debut >= 0, "l'en-tête du tableau des 81 numéros a changé : ce test ne le lit plus");
  const out: Ligne[] = [];
  for (let i = debut + 2; i < lignes.length && lignes[i].startsWith("|"); i++) {
    const c = lignes[i].split("|").slice(1, -1).map((s) => s.trim());
    assert.equal(c.length, 6, `ligne ${i + 1} du tableau : ${c.length} colonnes au lieu de 6`);
    const numero = c[0] === "—" ? null : Number(c[0]);
    assert.ok(numero === null || Number.isInteger(numero), `ligne ${i + 1} : numéro « ${c[0]} » illisible`);
    out.push({ numero, agent: c[1], pole: c[2], rendCompteA: c[3], statut: c[4], ou: c[5] });
  }
  return out;
}
const TABLEAU = lireTableau();
const numerotees = TABLEAU.filter((l) => l.numero !== null);
const parNumero = new Map(numerotees.map((l) => [l.numero as number, l]));
/** « A. Direction et amélioration » → « A » ; les deux lignes de direction générale gardent « Direction ». */
const lettre = (pole: string) => (pole === "Direction" ? "Direction" : pole[0]);
/** « @Trésorier » → « tresorier » : le nom de fichier du sous-agent. */
const slug = (handle: string) => handle.replace("@", "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nomme = (texte: string, handle: string) => new RegExp(`${handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9À-ÿ])`).test(texte);

test("81 numéros, de 1 à 81, chacun une fois, et aucun handle en double", () => {
  const nums = numerotees.map((l) => l.numero as number).sort((a, b) => a - b);
  assert.deepEqual(nums, Array.from({ length: 81 }, (_, i) => i + 1), "numérotation incomplète ou en double");
  const handles = TABLEAU.map((l) => l.agent);
  assert.equal(new Set(handles).size, handles.length, "un agent apparaît deux fois");
});

test("les numéros et les noms de 1 à 70 sont ceux de l'index de la constitution (texte gelé)", () => {
  // L'index de la section 8 (« 01 `@Nexus` (V1) · 02 `@Cortex` (V2) · … ») est la liste de référence du
  // fondateur. Les STATUTS y sont figés au 08/11 et vivent désormais dans le README ; les NUMÉROS et les
  // NOMS, eux, ne bougent jamais : le README ne peut pas s'en écarter.
  const index = CONSTITUTION.split("### Index séquentiel complet")[1];
  assert.ok(index, "l'index séquentiel de la constitution a disparu");
  const entrees = [...index.matchAll(/(?:^|· )(\d{2}) `(@[^`]+)` \(([^)]+)\)/gm)];
  assert.equal(entrees.length, 70, `${entrees.length} entrées lues dans l'index au lieu de 70`);
  for (const [, n, handle] of entrees) {
    const ligne = parNumero.get(Number(n));
    assert.ok(ligne, `n°${n} absent du README`);
    assert.equal(ligne.agent, handle.replace("->", " → "), `n°${n} : « ${ligne.agent} » dans le README, « ${handle} » dans la constitution`);
  }
});

test("les six fusions de la constitution, et aucune autre", () => {
  const fusionnees = numerotees.filter((l) => l.statut.startsWith("FUSIONNÉ"));
  assert.deepEqual(fusionnees.map((l) => l.numero).sort(), Object.keys(FUSIONS).map(Number).sort());
  for (const l of fusionnees) {
    assert.equal(l.agent, FUSIONS[l.numero as number], `n°${l.numero}`);
    assert.equal(l.rendCompteA, "(fusion)", `n°${l.numero} : un numéro fusionné ne rend compte à personne`);
    const cible = l.agent.split("→")[1].trim();
    const ligneCible = numerotees.find((x) => x.agent === cible);
    assert.ok(ligneCible, `${cible}, cible de la fusion n°${l.numero}, est absent du tableau`);
    assert.equal(lettre(ligneCible.pole), lettre(l.pole), `n°${l.numero} et ${cible} ne sont pas dans le même pôle`);
  }
});

test("chaque statut commence par l'un des six statuts connus", () => {
  for (const l of TABLEAU) {
    assert.ok(STATUTS.some((s) => l.statut.startsWith(s)), `${l.agent} : statut « ${l.statut} » inconnu`);
  }
});

test("la chaîne de direction : n°1 → Cyprien Dumez, n°71 → @Nexus, n°72 à 81 → @Atlas", () => {
  assert.equal(parNumero.get(1)!.agent, "@Nexus");
  assert.equal(parNumero.get(1)!.rendCompteA, "Cyprien Dumez");
  assert.equal(parNumero.get(71)!.agent, "@Atlas");
  assert.equal(parNumero.get(71)!.rendCompteA, "@Nexus");
  for (let n = 72; n <= 81; n++) assert.equal(parNumero.get(n)!.rendCompteA, "@Atlas", `n°${n} ne rend pas compte à @Atlas`);
});

test("les dix directeurs portent les pôles A à J, dans l'ordre des numéros", () => {
  for (const [n, handle, pole] of DIRECTEURS) {
    const l = parNumero.get(n)!;
    assert.equal(l.agent, handle, `n°${n}`);
    assert.equal(lettre(l.pole), pole, `${handle} : pôle « ${l.pole} » au lieu de ${pole}`);
  }
});

test("tout agent numéroté rend compte au directeur de son pôle, et à lui seul", () => {
  const directeurParPole = new Map(DIRECTEURS.map(([, h, p]) => [p, h]));
  let verifies = 0;
  for (const l of numerotees) {
    const n = l.numero as number;
    if (n === 1 || n >= 71 || l.statut.startsWith("FUSIONNÉ")) continue;
    const attendu = directeurParPole.get(lettre(l.pole));
    assert.ok(attendu, `${l.agent} : pôle « ${l.pole} » sans directeur`);
    assert.equal(l.rendCompteA, attendu, `${l.agent} (n°${n}) rend compte à ${l.rendCompteA}, pas à ${attendu}`);
    verifies++;
  }
  assert.equal(verifies, 63, `${verifies} agents vérifiés au lieu de 63 (64 postes moins @Nexus)`);
});

test("@Vigie, hors numérotation, rend compte à @Architect dans le pôle D", () => {
  const sansNumero = TABLEAU.filter((l) => l.numero === null);
  assert.equal(sansNumero.length, 1, "une seule unité hors numérotation : @Vigie");
  assert.equal(sansNumero[0].agent, "@Vigie");
  assert.equal(lettre(sansNumero[0].pole), "D");
  assert.equal(sansNumero[0].rendCompteA, "@Architect");
  assert.ok(sansNumero[0].statut.startsWith("ACTIF"), "@Vigie tourne (GitHub Actions + UptimeRobot)");
});

test("un directeur n'est ACTIF que dans une routine nommée ; sinon il est DÉFINI", () => {
  // ⚠️ Le brouillon d'origine déclarait les onze « ACTIFS » alors qu'aucune routine ne les appelait.
  // Un directeur actif nomme la routine qui l'exécute ; un directeur sans routine est « défini ».
  for (let n = 71; n <= 81; n++) {
    const l = parNumero.get(n)!;
    assert.match(l.statut, /^(DÉFINI|ACTIF \(dans [^)]+\))/, `${l.agent} : « ${l.statut} »`);
  }
});

test("les douze fiches de direction existent au format des sous-agents du dépôt", () => {
  for (const n of [1, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81]) {
    const l = parNumero.get(n)!;
    const chemin = `.claude/agents/${slug(l.agent)}.md`;
    assert.ok(existsSync(chemin), `${l.agent} : fiche ${chemin} absente`);
    const fiche = readFileSync(chemin, "utf8");
    assert.ok(fiche.startsWith("---\n"), `${chemin} : pas de frontmatter`);
    const frontmatter = fiche.split("\n---\n")[0];
    assert.match(frontmatter, new RegExp(`^name: ${slug(l.agent)}$`, "m"), `${chemin} : name ≠ ${slug(l.agent)}`);
    assert.match(frontmatter, /^description: \S/m, `${chemin} : description absente`);
    assert.match(frontmatter, /^tools: Read, Grep, Glob, Bash$/m, `${chemin} : un directeur lit, il n'écrit pas`);
    assert.match(frontmatter, /^model: (opus|sonnet|haiku|inherit)$/m, `${chemin} : modèle inconnu`);
    assert.ok(fiche.includes(SENTINELLE), `${chemin} : la règle d'arrêt « ${SENTINELLE} » a disparu`);
    assert.ok(fiche.includes(`n°${n}`), `${chemin} : la fiche ne porte pas son numéro n°${n}`);
  }
});

test("la fiche de chaque directeur nomme chacun de ses agents, numéros fusionnés compris", () => {
  for (const [n, handle] of DIRECTEURS) {
    const fiche = readFileSync(`.claude/agents/${slug(handle)}.md`, "utf8");
    const encadres = TABLEAU.filter((l) => l.rendCompteA === handle).map((l) => l.agent);
    assert.ok(encadres.length > 0, `${handle} n'encadre personne dans le README`);
    for (const a of encadres) assert.ok(nomme(fiche, a), `${handle} (n°${n}) : sa fiche ne nomme pas ${a}`);
    for (const [numFusion, libelle] of Object.entries(FUSIONS)) {
      const [absorbe, cible] = libelle.split(" → ");
      if (encadres.includes(cible)) {
        assert.ok(nomme(fiche, absorbe), `${handle} : sa fiche ne nomme pas ${absorbe} (n°${numFusion}, absorbé par ${cible})`);
      }
    }
  }
  const atlas = readFileSync(".claude/agents/atlas.md", "utf8");
  for (const [, handle] of DIRECTEURS) assert.ok(nomme(atlas, handle), `@Atlas : sa fiche ne nomme pas ${handle}`);
  assert.ok(nomme(readFileSync(".claude/agents/nexus.md", "utf8"), "@Atlas"), "@Nexus : sa fiche ne nomme pas @Atlas");
});

test("les textes de routines appellent des sous-agents qui existent, et chaque directeur « à brancher » en a un", () => {
  const dossier = "ops/direction/routines";
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".md") && f !== "README.md");
  assert.ok(fichiers.length >= 7, `${fichiers.length} texte(s) de routine, 7 attendus au moins`);
  const appeles = new Set<string>();
  for (const f of fichiers) {
    const texte = readFileSync(`${dossier}/${f}`, "utf8");
    // Le nom peut passer à la ligne suivante d'une citation Markdown (« `subagent_type`\n> `mercator` »).
    const noms = [...texte.matchAll(/`subagent_type`\s+(?:>\s+)?`([a-z]+)`/g)].map((m) => m[1]);
    assert.ok(noms.length > 0, `${f} n'appelle aucun sous-agent`);
    for (const nom of noms) {
      assert.ok(existsSync(`.claude/agents/${nom}.md`), `${f} appelle « ${nom} », qui n'existe pas dans .claude/agents/`);
      appeles.add(nom);
    }
  }
  for (let n = 71; n <= 81; n++) {
    const l = parNumero.get(n)!;
    if (/^DÉFINI, à brancher/.test(l.statut) || /^ACTIF \(dans/.test(l.statut)) {
      assert.ok(appeles.has(slug(l.agent)), `${l.agent} est « ${l.statut} » mais aucun texte de routine n'appelle « ${slug(l.agent)} »`);
    }
  }
});

test("l'état et la constitution renvoient à l'organigramme du dépôt", () => {
  assert.ok(readFileSync("ops/STATE.md", "utf8").includes("ops/direction/README.md"), "ops/STATE.md ne renvoie pas à ops/direction/README.md");
  assert.ok(CONSTITUTION.includes("15. **Direction (09/11/2026)**"), "la correction en vigueur n°15 a disparu de la constitution");
  assert.ok(CONSTITUTION.includes("ops/direction/README.md"), "la constitution ne renvoie pas à ops/direction/README.md");
});

console.log(`\n${passed} test(s) de l'organigramme passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
