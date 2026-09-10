/**
 * LA BARRE DE NAVIGATION NE DOIT RIEN POSER SUR LA TOUR EIFFEL.
 *
 * ⚠️ DÉFAUT SIGNALÉ PAR CYPRIEN LE 10/09/2026 : « Notre histoire » tombait pile sur la
 * tour. Mesuré à 1 280 × 900 : les liens s'étalaient de 30,0 % à 70,0 % de la largeur, la
 * tour occupait 63,4 % à 70,1 %. Recouvrement direct.
 *
 * ⚠️ ET LA CIBLE BOUGEAIT. `object-cover` rogne la photo sur les côtés quand la fenêtre est
 * plus « haute » que l'image, en gardant le centre : un point de la photo se DÉPLACE à
 * l'écran selon le format de la fenêtre. La tour glissait de 68,1 % (1920×1080) à 76,3 %
 * (1100×900) — c'est-à-dire jusque SOUS les boutons de droite. Aucun agencement de la
 * barre ne pouvait y répondre tant que la cible se déplaçait.
 *
 * Trois décisions, et ce fichier vérifie qu'aucune ne disparaît :
 *
 *   1. `lg:object-[65%_50%]` ancre la photo sur la fraction où vit la tour (65 %), ce qui
 *      la rend IMMOBILE à l'écran : un point à la fraction X reste à X quel que soit le
 *      rognage. Seulement à partir de `lg` — plus bas, le rognage est si fort que la tour
 *      viendrait au milieu de l'écran du téléphone.
 *   2. Les liens sont ANCRÉS À GAUCHE contre le logo, plus centrés sur la fenêtre.
 *   3. La barre complète n'apparaît qu'à `xl` (1 280 px). Entre 1 024 et 1 279, même sans
 *      aucun lien, le groupe de droite débordait sur la tour : c'est le menu déroulant qui
 *      s'affiche.
 *
 * ⚠️ CE QUE CE FICHIER NE PEUT PAS FAIRE, ET IL FAUT LE SAVOIR. Il ne mesure AUCUN pixel :
 * la largeur d'un texte dépend de la police, de la langue et du navigateur, choses qu'un
 * test Node ne connaît pas. Il verrouille les trois décisions ci-dessus, pas leur résultat.
 * Les marges, elles, ont été mesurées dans un vrai navigateur, aux tailles courantes et
 * dans les cinq langues (pire cas : allemand, 5,1 points de marge à 1 280 × 900).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

/** ⚠️ Les commentaires CITENT les classes surveillées : sans ce nettoyage, le test se
 *  satisferait de sa propre explication. On ne coupe pas sur `://` (les URL). */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SRC = sansCommentaires(readFileSync("src/app/page.tsx", "utf8"));

console.log("\n=== BARRE DE NAVIGATION : rien sur la tour Eiffel ===\n");

test("le fichier du hero est bien lu et contient la barre", () => {
  assert.ok(SRC.includes("<nav"), "aucune balise nav trouvée dans page.tsx");
  assert.ok(SRC.length > 5000, `page.tsx anormalement court après nettoyage : ${SRC.length}`);
});

/**
 * ⚠️ ON VISE LA CLASSE, PAS LA BALISE. Mon premier jet capturait `<img …/>` sur 900
 * caractères et ÉCHOUAIT sur du code correct : le nettoyage des commentaires remplace
 * chaque caractère par une espace pour préserver les numéros de ligne, si bien que la
 * balise dépasse largement cette fenêtre. Le `className` qui porte `object-cover` est la
 * cible réelle — sans ambiguïté et sans longueur arbitraire.
 */
const CLASSE_IMG = (() => {
  const m = SRC.match(/className="([^"]*object-cover[^"]*)"/);
  return m ? m[1] : null;
})();

test("la photo est ancrée à 65 % à partir de lg (la tour cesse de dériver)", () => {
  assert.ok(CLASSE_IMG, "aucune classe contenant object-cover trouvée dans le hero");
  assert.match(CLASSE_IMG!, /lg:object-\[65%_50%\]/,
    "l'ancrage lg:object-[65%_50%] a disparu : la tour se déplacera avec le format de la fenêtre");
});

test("l'ancrage ne s'applique PAS sous lg (sinon la tour arrive au milieu du téléphone)", () => {
  assert.ok(CLASSE_IMG, "aucune classe contenant object-cover trouvée dans le hero");
  // Un `object-[65%_50%]` sans préfixe s'appliquerait dès le plus petit écran.
  assert.ok(!/(?<![a-z:])object-\[65%_50%\]/.test(CLASSE_IMG!),
    "l'ancrage est appliqué sans condition de taille : sur téléphone la tour passerait au centre");
});

/**
 * Le bloc de liens est repéré par sa classe, pas par un ordre de mots : les utilitaires
 * Tailwind se réordonnent au moindre remaniement.
 */
const CLASSE_LIENS = (() => {
  for (const m of SRC.matchAll(/className=\{`([^`]*)`\}/g)) {
    if (m[1].includes("xl:flex") && m[1].includes("right-[")) return m[1];
  }
  return null;
})();

/**
 * ⚠️ LE BLOC EST ALIGNÉ SUR UNE FRONTIÈRE FIXE, PAS CENTRÉ — et c'est ce qui le rend
 * indépendant de la langue. Un bloc centré s'étend des DEUX côtés : « Unsere Geschichte »
 * finit 4 points plus à droite que « Notre histoire », si bien qu'un réglage juste en
 * français devenait faux en allemand. Sorti du flux et posé par son bord DROIT sur une
 * frontière en `vw`, il grandit uniquement vers la gauche — du côté où il y a la place.
 *
 * Vérifié dans un navigateur : le bord droit tombe à 59,5 % en français, en allemand ET en
 * portugais, à 1 280, 1 512 et 1 920 px de large.
 */
test("le bloc de liens est posé sur une frontière fixe, hors du flux", () => {
  assert.ok(CLASSE_LIENS, "le bloc de liens (xl:flex + right-[…]) est introuvable");
  assert.match(CLASSE_LIENS!, /\babsolute\b/,
    "le bloc est revenu dans le flux : sa position dépendrait à nouveau de la longueur des libellés");
  assert.ok(!/grid-cols-\[1fr_auto_1fr\]/.test(SRC),
    "la grille qui centre les liens SUR LA FENÊTRE est revenue : c'est elle qui posait « Notre histoire » sur la tour");
});

/**
 * ⚠️ LA FRONTIÈRE SE MET EN `vw`, JAMAIS EN PIXELS. La tour est à un POURCENTAGE de la
 * largeur : une frontière en pixels serait juste à une seule taille d'écran et fausse
 * partout ailleurs. C'est exactement le défaut du vieux `mr-6` posé sur « Connexion » pour
 * écarter le bras d'un coureur, dont le commentaire admettait déjà qu'il ne valait « que
 * pour une fenêtre large ».
 */
test("la frontière est exprimée en vw, pas en pixels", () => {
  const bornes = [...CLASSE_LIENS!.matchAll(/right-\[([^\]]+)\]/g)].map((m) => m[1]);
  assert.ok(bornes.length >= 1, "aucune frontière right-[…] sur le bloc de liens");
  for (const b of bornes) {
    assert.match(b, /vw$/, `frontière « ${b} » : une valeur en pixels ne suit pas la largeur de l'écran`);
  }
});

/**
 * ⚠️ DEUX FRONTIÈRES, PARCE QUE LA TOUR BOUGE AVEC LA FORME DE LA FENÊTRE. Sur une fenêtre
 * large la tour reste à 62 % ; sur une fenêtre HAUTE, le rognage la tire jusqu'à 60,0 %.
 * La frontière de base doit donc être la PRUDENTE, et celle sous condition de format la
 * généreuse — l'inverse laisserait les liens sur la tour précisément là où elle avance.
 */
test("une frontière de base sans condition, et une plus généreuse sur fenêtre large", () => {
  const base = CLASSE_LIENS!.match(/(?:^|\s)right-\[([\d.]+)vw\]/);
  const large = CLASSE_LIENS!.match(/min-aspect-ratio[^\]]*\]:right-\[([\d.]+)vw\]/);
  assert.ok(base, "aucune frontière de base (sans préfixe) : sur une fenêtre haute, rien ne retient les liens");
  assert.ok(large, "la frontière conditionnée au format de fenêtre a disparu");
  assert.ok(Number(base![1]) > Number(large![1]),
    `la base (${base![1]}vw) doit être plus PRUDENTE que la version fenêtre large (${large![1]}vw) : ici c'est l'inverse`);
});

test("la barre complète n'apparaît qu'à partir de xl (1 280 px)", () => {
  assert.ok(!/\bmd:flex\b/.test(CLASSE_LIENS ?? ""),
    "les liens réapparaissent dès md : entre 1 024 et 1 279 px ils débordent sur la tour");
  assert.match(CLASSE_LIENS!, /\bxl:flex\b/, "le seuil xl des liens a disparu");
  assert.match(CLASSE_LIENS!, /\bhidden\b/, "les liens ne sont plus masqués sous le seuil");
  assert.match(SRC, /xl:hidden inline-flex h-9 w-9/, "le bouton du menu déroulant n'est plus en xl:hidden");
});

test("le menu déroulant reste atteignable sous xl et contient Connexion", () => {
  assert.match(SRC, /<div className="xl:hidden border-t/, "le panneau du menu n'est plus en xl:hidden");
  // « Connexion » sort de la barre sous xl : il DOIT donc rester dans le menu.
  const menu = SRC.match(/\{\[\s*\{ href: "#programmes"[\s\S]*?\]\}/);
  assert.ok(menu, "la liste du menu déroulant est introuvable");
  assert.match(menu![0], /href: "\/login"/,
    "Connexion a disparu du menu alors qu'il est masqué de la barre sous xl : plus aucun accès");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
for (const f of fails) console.log(`  ✗ ${f}`);
if (fails.length) process.exit(1);
