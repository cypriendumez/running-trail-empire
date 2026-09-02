/**
 * CRASH-TESTS DU KINÉ IA — mise en forme des réponses et mémoire des douleurs.
 *
 * Deux défauts réels sont gardés ici :
 *  1. l'invite demandait une réponse structurée et l'interface l'affichait brute ;
 *  2. le kiné ne relisait jamais les douleurs qu'il avait lui-même enregistrées.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyser, segments, texteNu } from "../src/lib/ui/richText";
import { suiviParZone, resumeDouleurs, ECART_SIGNIFICATIF, type Signalement } from "../src/lib/health/douleurs";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

// ── Mise en forme ───────────────────────────────────────────────────────────────
test("la structure demandée au modèle est réellement interprétée", () => {
  // Réponse réelle relevée le 02/09/2026 en sondant le modèle sur une tendinopathie.
  const reel = [
    "Bonjour ! Merci pour ces précisions.",
    "",
    "Ces symptômes sont très évocateurs d'une **tendinopathie d'Achille**.",
    "",
    "### Pour mieux comprendre :",
    "",
    "*   **Déclencheur :** Y a-t-il eu un changement récent ?",
    "*   **Douleur :** Quand est-elle la plus forte ?",
  ].join("\n");
  const blocs = analyser(reel);
  assert.equal(blocs.filter((b) => b.type === "titre").length, 1, "le titre ### n'est pas reconnu");
  const liste = blocs.find((b) => b.type === "liste");
  assert.ok(liste && liste.type === "liste" && liste.items.length === 2, "les puces ne sont pas regroupées");
  // ⚠️ LE CŒUR DU DÉFAUT : plus AUCUN marqueur ne doit atteindre l'écran.
  const affiche = texteNu(reel);
  for (const marqueur of ["**", "###", "*   "]) {
    assert.ok(!affiche.includes(marqueur), `« ${marqueur} » s'affiche encore en clair`);
  }
  assert.ok(affiche.includes("tendinopathie d'Achille"), "le texte mis en gras a disparu du rendu");
  assert.ok(affiche.includes("Pour mieux comprendre"), "le titre a disparu du rendu");
});

test("le gras est isolé du texte qui l'entoure", () => {
  const s = segments("avant **milieu** après");
  assert.deepEqual(s, [
    { gras: false, texte: "avant " },
    { gras: true, texte: "milieu" },
    { gras: false, texte: " après" },
  ]);
  // Une étoile isolée n'est pas du gras et ne doit pas manger la fin de la ligne.
  assert.deepEqual(segments("2 * 3 = 6"), [{ gras: false, texte: "2 * 3 = 6" }]);
});

test("une ligne en gras n'est pas prise pour une puce", () => {
  // ⚠️ SANS L'ESPACE EXIGÉE APRÈS LE MARQUEUR, « **Attention** » commence par une étoile :
  // la ligne deviendrait une puce et le gras d'ouverture serait avalé.
  const blocs = analyser("**Attention** : consulte un médecin.");
  assert.equal(blocs.length, 1);
  assert.equal(blocs[0]!.type, "paragraphe", "une ligne en gras a été prise pour une puce");
  assert.ok(texteNu("**Attention** : consulte un médecin.").startsWith("Attention"));
});

test("puces et numérotation ne se mélangent pas", () => {
  // ⚠️ AUCUNE LIGNE VIDE ENTRE LES DEUX : une ligne vide vide déjà la liste, la garde
  // testée ici ne serait jamais atteinte et la mutation resterait invisible.
  const blocs = analyser("1. premier\n2. second\n* puce\n* autre");
  const listes = blocs.filter((b) => b.type === "liste");
  assert.equal(listes.length, 2, "les deux listes ont fusionné");
  assert.ok(listes[0]!.type === "liste" && listes[0]!.ordonnee, "la liste numérotée a perdu sa numérotation");
  assert.ok(listes[1]!.type === "liste" && !listes[1]!.ordonnee, "les puces sont devenues numérotées");
});

test("aucun HTML n'est fabriqué à partir du texte du modèle", () => {
  // Une réponse contenant du balisage doit rester du TEXTE. Le rendu passe par React,
  // jamais par `dangerouslySetInnerHTML` — sinon une réponse deviendrait du code de page.
  const blocs = analyser("<img src=x onerror=alert(1)>");
  assert.equal(blocs[0]!.type, "paragraphe");
  assert.equal(texteNu("<img src=x onerror=alert(1)>"), "<img src=x onerror=alert(1)>");
  for (const f of ["src/components/ui/RichText.tsx", "src/components/health/HealthCenter.tsx"]) {
    assert.ok(!readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"), `${f} injecte du HTML`);
  }
});

test("le texte vide ou absent ne fait pas tomber le rendu", () => {
  for (const v of ["", "   ", "\n\n\n"]) assert.deepEqual(analyser(v), [], `« ${JSON.stringify(v)} » produit un bloc fantôme`);
  assert.deepEqual(analyser(null as unknown as string), []);
});

// ── Mémoire des douleurs ────────────────────────────────────────────────────────
const AUJ = "2026-09-02";

test("le kiné relit l'évolution d'une zone, pas seulement son dernier niveau", () => {
  const rows: Signalement[] = [
    { zone: "Genou droit", cle: "face:kneeR", level: 7, date: "2026-08-28" },
    { zone: "Genou droit", cle: "face:kneeR", level: 4, date: "2026-09-01" },
  ];
  const [z] = suiviParZone(rows, AUJ);
  assert.equal(z!.premier, 7); assert.equal(z!.dernier, 4);
  assert.equal(z!.tendance, "amelioration", "une douleur qui passe de 7 à 4 n'est pas vue comme s'améliorant");
  assert.equal(z!.depuisJours, 5, "l'ancienneté de la douleur est fausse");
  assert.equal(z!.derniereIlYaJours, 1);
  assert.ok(resumeDouleurs([z!]).includes("7/10 → 4/10"), "l'évolution n'atteint pas l'invite");
});

test("une seule déclaration n'invente pas de tendance", () => {
  // ⚠️ Annoncer « stable » sur un point unique inventerait une comparaison qui n'a jamais
  // eu lieu — et le modèle la répéterait à l'athlète comme un constat.
  const [z] = suiviParZone([{ zone: "Mollet gauche", cle: "dos:shinL", level: 6, date: AUJ }], AUJ);
  assert.equal(z!.tendance, "inconnue");
  assert.ok(!resumeDouleurs([z!]).includes("stable"), "une seule déclaration est annoncée comme stable");
  assert.ok(resumeDouleurs([z!]).includes("pas d'évolution mesurable"));
});

test("un écart d'un point reste du bruit, pas une évolution", () => {
  // ⚠️ L'ÉCART EST ÉCRIT EN DUR, PAS DÉDUIT DE `ECART_SIGNIFICATIF`. Calculé depuis la
  // constante, le test l'aurait suivie : abaisser le seuil à 1 point l'aurait laissé au
  // vert, alors que c'est précisément le réglage qu'il doit contraindre. Vérifié par
  // mutation — la première version ne rougissait pas.
  assert.ok(ECART_SIGNIFICATIF >= 2, "un seul point d'écart ne peut pas valoir une évolution");
  const [z] = suiviParZone([
    { zone: "Talon", cle: "face:footR", level: 5, date: "2026-08-20" },
    { zone: "Talon", cle: "face:footR", level: 4, date: "2026-09-01" },
  ], AUJ);
  assert.equal(z!.tendance, "stable", "un écart d'un point est annoncé comme une évolution");
});

test("l'historique survit à un changement de langue", () => {
  // ⚠️ LE LIBELLÉ EST ENREGISTRÉ DANS LA LANGUE DU MOMENT. Regrouper dessus voulait dire
  // qu'un athlète passant en anglais repartait de zéro, avec un kiné qui ne savait plus rien.
  const rows: Signalement[] = [
    { zone: "Genou droit", cle: "face:kneeR", level: 7, date: "2026-08-25" },
    { zone: "Right knee", cle: "face:kneeR", level: 3, date: "2026-09-01" },
  ];
  const suivi = suiviParZone(rows, AUJ);
  assert.equal(suivi.length, 1, "le changement de langue a coupé l'historique en deux");
  assert.equal(suivi[0]!.zone, "Right knee", "le libellé affiché n'est pas celui de la déclaration la plus récente");
  assert.equal(suivi[0]!.tendance, "amelioration");
});

test("une face ne peut pas être confondue avec l'autre", () => {
  // `kneeL` est le genou de face et le creux poplité de dos : la vue fait partie de la clé.
  const suivi = suiviParZone([
    { zone: "Genou gauche", cle: "face:kneeL", level: 5, date: "2026-08-30" },
    { zone: "Creux poplité gauche", cle: "dos:kneeL", level: 8, date: "2026-09-01" },
  ], AUJ);
  assert.equal(suivi.length, 2, "deux zones distinctes ont été fusionnées");
});

test("une ligne inexploitable ne devient pas une donnée", () => {
  // `Number(null)` vaut 0 : sans contrôle de type, une ligne vide serait devenue « 0/10 ».
  const rows = [
    { zone: "", cle: null, level: 5, date: AUJ },
    { zone: "Genou", cle: "face:kneeR", level: Number(null), date: AUJ },
    { zone: "Genou", cle: "face:kneeR", level: NaN, date: AUJ },
    { zone: "Genou", cle: "face:kneeR", level: 5, date: "pas une date" },
  ] as Signalement[];
  assert.deepEqual(suiviParZone(rows, AUJ), [], "une ligne inexploitable est entrée dans le suivi");
  assert.equal(resumeDouleurs([]), "", "un suivi vide produit du texte au lieu de rien");
});

test("le kiné IA lit vraiment l'historique et le garage", () => {
  // ⚠️ ON VISE LES SITES QUI PRODUISENT L'EFFET, PAS LES IMPORTS. Une fonction importée
  // mais jamais appelée laisserait ce test au vert avec un kiné toujours amnésique.
  const src = readFileSync("src/app/api/ai/physio/route.ts", "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
  assert.ok(/from\("notifications"\)[\s\S]{0,400}?"pain_report"[\s\S]{0,200}?gte\(/.test(src),
    "la route ne lit plus les douleurs passées (seulement celles du jour)");
  assert.ok(src.includes("suiviParZone("), "le suivi n'est pas calculé");
  const iSuivi = src.indexOf("resumeSuivi");
  const iInvite = src.indexOf("const systemPrompt");
  assert.ok(iSuivi > 0 && src.indexOf("resumeSuivi", iInvite) > iInvite, "le suivi n'est pas repris dans l'invite");
  assert.ok(/from\("shoes"\)/.test(src), "le garage n'est pas lu");
  assert.ok(src.indexOf("chaussures", iInvite) > iInvite, "les chaussures n'atteignent pas l'invite");
  // Et l'absence de donnée doit être DITE, pas comblée.
  assert.ok(src.includes("aucun antécédent enregistré"), "un historique vide laisse un blanc dans l'invite");
  assert.ok(src.includes("kilométrage non renseigné"), "un kilométrage absent serait lu comme une paire neuve");
});

console.log(`\n${passed} crash-test(s) du kiné passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
