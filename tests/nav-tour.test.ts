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
 * ⚠️ CENTRÉS DANS L'ESPACE DISPONIBLE, PAS SUR LA FENÊTRE — et la distinction est
 * arithmétique. Le bord gauche de la tour est à ~60 % dans le pire cas. Un bloc centré sur
 * 50 % étant symétrique, il devrait faire moins de 20 % de large pour finir avant : les six
 * liens en font 42 % en allemand, quatre liens en feraient encore 26 %. Il faudrait
 * descendre à TROIS liens. Le centrage sur la fenêtre est donc exclu, pas arbitré.
 *
 * La réserve `pr-[…vw]` retient la bande de la tour et décale le centrage vers la gauche.
 */
test("les liens sont centrés dans l'espace libre, avec une réserve pour la tour", () => {
  const bloc = SRC.match(/hidden xl:flex[^`"]*/);
  assert.ok(bloc, "le bloc de liens en `hidden xl:flex` est introuvable");
  assert.match(bloc![0], /justify-center/, "les liens ne sont plus centrés");
  // ⚠️ ON EXIGE LA RÉSERVE DE BASE, SANS PRÉFIXE DE TAILLE. Mon premier jet acceptait
  // n'importe quel `pr-[…vw]` : retirer la réserve de base le laissait VERT, parce que le
  // `2xl:pr-[8vw]` suffisait à satisfaire le motif. Or c'est justement la réserve de base
  // qui protège la plage 1 280–1 535 px, la plus serrée de toutes.
  assert.match(bloc![0], /(?:^|\s)pr-\[\d+vw\]/,
    "la réserve de base (sans préfixe) a disparu : entre 1 280 et 1 535 px, les liens recouvrent la tour");
  assert.ok(!/grid-cols-\[1fr_auto_1fr\]/.test(SRC),
    "la grille qui centre les liens SUR LA FENÊTRE est revenue : c'est elle qui posait « Notre histoire » sur la tour");
});

/**
 * ⚠️ LA RÉSERVE DOIT ÊTRE EN `vw`, JAMAIS EN PIXELS. La tour est à un POURCENTAGE de la
 * largeur : une réserve en pixels serait juste à une seule taille d'écran et fausse
 * partout ailleurs. C'est très exactement le défaut du vieux `mr-6` posé sur « Connexion »
 * pour écarter le bras d'un coureur, dont le commentaire admettait déjà qu'il ne valait
 * « que pour une fenêtre large ».
 */
test("la réserve est exprimée en vw, pas en pixels", () => {
  const bloc = SRC.match(/hidden xl:flex[^`"]*/)![0];
  const reserves = [...bloc.matchAll(/(?:^|[\s:])pr-\[([^\]]+)\]/g)].map((m) => m[1]);
  assert.ok(reserves.length > 0, "aucune réserve pr-[…] trouvée sur le bloc de liens");
  for (const r of reserves) {
    assert.match(r, /vw$/, `réserve « ${r} » : une valeur en pixels ne suit pas la largeur de l'écran`);
  }
});

test("la barre complète n'apparaît qu'à partir de xl (1 280 px)", () => {
  assert.ok(!/hidden md:flex items-center/.test(SRC),
    "les liens réapparaissent dès md : entre 1 024 et 1 279 px ils débordent sur la tour");
  assert.match(SRC, /hidden xl:flex items-center/, "le seuil xl des liens a disparu");
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
