/**
 * LE CONTRASTE DU TEXTE — mesuré, pas jugé à l'œil.
 *
 * Relevé sur la production le 04/09/2026 avec la formule de la WCAG : 23 échecs sur la
 * seule page d'accueil. Le plus net : `text-zinc-400` sur blanc à 2,56:1 quand la règle
 * en demande 4,5 — sur du texte de 10 à 14 px (« Gratuit », « Aucune carte bancaire »,
 * « coaching audio en direct »).
 *
 * ⚠️ CE QUI REND CE SUJET PIÉGEUX : la même classe est PARFAITEMENT lisible sur fond
 * sombre. Remplacer `text-zinc-400` partout aurait RÉDUIT le contraste là où il était
 * bon. Seules les branches claires ont été touchées ; les variantes `text-white/45` des
 * cartes sombres sont restées telles quelles.
 *
 * ⚠️ ET LA MESURE ELLE-MÊME SE TROMPE. Le mot « Evolution » du slogan est ressorti à
 * 1,92:1 — mais il est posé sur une PHOTO sombre, avec une ombre portée : le détecteur
 * remontait jusqu'au fond blanc de la page faute de voir l'image. Un faux positif qu'il
 * fallait écarter à la main plutôt que « corriger ».
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/** Luminance relative, définition WCAG 2.x. */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const v = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contraste(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const BLANC = "#ffffff", ZINC100 = "#f4f4f5";

test("la formule de contraste est juste", () => {
  // ⚠️ SANS CE TEST, TOUT LE RESTE EST UNE OPINION. On l'ancre sur des couples dont le
  // rapport est connu et publié : noir sur blanc vaut exactement 21.
  assert.equal(Math.round(contraste("#000000", "#ffffff")), 21);
  assert.equal(Math.round(contraste("#ffffff", "#ffffff")), 1);
  assert.ok(Math.abs(contraste("#767676", BLANC) - 4.54) < 0.05,
    `#767676 sur blanc devrait valoir ~4,54 : la formule rend ${contraste("#767676", BLANC).toFixed(2)}`);
});

test("les couleurs de petit texte passent le seuil de 4,5", () => {
  for (const [nom, couleur, fond] of [
    ["zinc-500 (texte secondaire)", "#71717a", BLANC],
    ["zinc-600 (pastilles de filtre)", "#52525b", ZINC100],
    ["emerald-700 (surtitres et liens)", "#047857", BLANC],
  ] as [string, string, string][]) {
    const c = contraste(couleur, fond);
    assert.ok(c >= 4.5, `${nom} : ${c.toFixed(2)}:1, il en faut 4,5`);
  }
});

test("les couleurs écartées échouaient bien — la correction avait une raison", () => {
  // Le contre-exemple : si ces couples passaient, le changement n'aurait servi à rien.
  assert.ok(contraste("#a1a1aa", BLANC) < 4.5, "zinc-400 sur blanc passerait le seuil : rien ne justifiait de le changer");
  assert.ok(contraste("#71717a", ZINC100) < 4.5, "zinc-500 sur zinc-100 passerait : la correction des pastilles était inutile");
  assert.ok(contraste("#059669", BLANC) < 4.5, "emerald-600 sur blanc passerait : la correction des surtitres était inutile");
});

test("la page d'accueil n'emploie plus de gris illisible sur fond clair", () => {
  const src = readFileSync("src/app/page.tsx", "utf8");
  assert.equal([...src.matchAll(/text-zinc-400/g)].length, 0,
    "text-zinc-400 est revenu sur la page d'accueil : 2,56:1 sur blanc");
  /**
   * ⚠️ UNE ICÔNE N'EST PAS DU TEXTE, et la règle n'est pas la même : un objet graphique
   * demande 3:1 (WCAG 1.4.11), pas 4,5. L'émeraude `#059669` atteint 3,77 sur blanc —
   * elle ÉCHOUE pour du texte et PASSE pour une icône. Ma première version de ce test
   * les comptait ensemble et signalait trois `<Icon>` parfaitement conformes.
   */
  const lignesEmeraude = src.split("\n")
    .filter((l) => /text-\[#059669\]/.test(l) && !/hover:text-\[#059669\]/.test(l))
    .filter((l) => !/<(Icon|Check|[A-Z]\w+)\s[^>]*className/.test(l) || !/\bh-\S+\s+w-\S+|h-\[\d+px\]/.test(l));
  assert.deepEqual(lignesEmeraude, [],
    `emerald-600 sert de nouveau à du TEXTE (3,77:1 sur blanc) :\n    ${lignesEmeraude.map((l) => l.trim().slice(0, 90)).join("\n    ")}`);
});

test("le surtitre partagé garde la couleur lisible", () => {
  // `Container` porte ce surtitre sur quatre écrans : la régression y serait multipliée.
  const src = readFileSync("src/components/ui/Container.tsx", "utf8");
  assert.ok(/tracking-\[0\.18em\] text-\[#047857\]/.test(src),
    "le surtitre de Container est repassé à une couleur sous le seuil");
});

test("le pied de page et l'avertissement médical restent lisibles", () => {
  // ⚠️ CES DEUX-LÀ PORTENT DU CONTENU À PORTÉE LÉGALE : « Mentions légales »,
  // « Confidentialité », « CGU », et l'avertissement de santé. Ils étaient à 2,56:1 sur
  // fond blanc — et ils vivent dans des composants distincts de la page d'accueil, donc
  // la correction de celle-ci ne les avait pas atteints. Mesuré APRÈS coup en
  // production : c'est ce second relevé qui les a fait apparaître.
  for (const f of ["src/components/layout/SiteFooter.tsx", "src/components/layout/MedicalDisclaimer.tsx"]) {
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
    const fondClair = /bg-white/.test(src);
    const grisFaible = [...src.matchAll(/(?<!hover:)text-zinc-400/g)].length;
    assert.ok(!(fondClair && grisFaible > 0),
      `${f} : ${grisFaible} usage(s) de zinc-400 sur fond blanc, soit 2,56:1`);
  }
});

test("les écrans CONNECTÉS aussi", () => {
  // ⚠️ MESURÉS SEULEMENT APRÈS COUP. La première passe n'avait porté que sur les pages
  // publiques : les écrans où l'athlète passe son temps n'avaient jamais été relevés.
  // Deux défauts y dormaient, dont un à 1,48:1 — les intitulés de section de la barre
  // latérale (« ENTRAÎNEMENT », « SUIVI »), en zinc-300 sur blanc, à la limite de
  // l'invisible. Ils servent pourtant à se repérer dans la navigation.
  for (const [f, interdit] of [
    ["src/components/layout/Sidebar.tsx", "text-zinc-300"],
    ["src/components/layout/TopBar.tsx", "text-[11px] text-zinc-400"],
  ] as [string, string][]) {
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
    assert.ok(!src.includes(interdit), `${f} : « ${interdit} » est revenu, sous le seuil de lisibilité`);
  }
  // Et les couleurs retenues doivent bien passer, sinon on a déplacé le problème.
  assert.ok(contraste("#71717a", BLANC) >= 4.5, "zinc-500 sur blanc ne passe plus");
  assert.ok(contraste("#71717a", "#fafafa") >= 4.5, "zinc-500 sur zinc-50 ne passe plus");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
