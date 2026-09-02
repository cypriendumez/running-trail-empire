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
import { budget, estTronquee, messageLisible } from "../src/lib/ai/gemini";
import { analyserJson } from "../src/app/api/ai/journal-analyze/route";

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

// ── Budget de génération ────────────────────────────────────────────────────────
test("le raisonnement ne mange plus le budget de la réponse", () => {
  // ⚠️ MESURÉ EN PRODUCTION LE 02/09/2026 SUR LE COMPTE DE L'ÉDITEUR : réglé à
  // `maxOutputTokens: 1600` avec `thinkingBudget: 1536`, le modèle a dépensé 1 534
  // jetons à réfléchir et il ne lui en restait 62 pour répondre. La consultation
  // s'arrêtait au milieu d'une question posée à l'athlète — en `ok: true`.
  const b = budget(512, 1600) as { maxOutputTokens: number; thinkingConfig: { thinkingBudget: number } };
  assert.equal(b.thinkingConfig.thinkingBudget, 512);
  assert.equal(b.maxOutputTokens, 2112, "le budget de réponse n'est pas AJOUTÉ à celui du raisonnement");
  assert.equal(b.maxOutputTokens - b.thinkingConfig.thinkingBudget, 1600, "la réponse n'a pas le budget annoncé");
});

test("aucun appel IA de l'athlète ne laisse la réponse à l'étroit", () => {
  // Le garde-fou vise les routes que l'ATHLÈTE déclenche : c'est là qu'une réponse
  // coupée se lit comme un avis terminé. `budget(r, n)` rend l'erreur impossible ;
  // un réglage écrit à la main doit prouver qu'il laisse de la place.
  const MINIMUM = 600;
  for (const f of ["src/app/api/ai/physio/route.ts", "src/app/api/ai/cours/route.ts"]) {
    const src = readFileSync(f, "utf8")
      .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
    const parBudget = /\.\.\.budget\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(src);
    if (parBudget) {
      assert.ok(Number(parBudget[2]) >= MINIMUM, `${f} ne laisse que ${parBudget[2]} jetons de réponse`);
      continue;
    }
    const max = /maxOutputTokens:\s*(\d+)/.exec(src), pense = /thinkingBudget:\s*(\d+)/.exec(src);
    assert.ok(max, `${f} n'a plus de budget de sortie lisible`);
    const reste = Number(max![1]) - Number(pense?.[1] ?? 0);
    assert.ok(reste >= MINIMUM, `${f} ne laisse que ${reste} jetons à la réponse (raisonnement compris)`);
  }
});

test("une réponse coupée est signalée, jamais servie comme une conclusion", () => {
  assert.equal(estTronquee({ finishReason: "MAX_TOKENS" }), true);
  for (const c of [{ finishReason: "STOP" }, {}, null, undefined, "MAX_TOKENS"]) {
    assert.equal(estTronquee(c), false, `${JSON.stringify(c)} est pris pour une troncature`);
  }
  // Et le kiné doit RÉAGIR au drapeau : le détecter sans rien en faire ne change rien
  // pour l'athlète, qui lirait toujours une demi-phrase comme un avis terminé.
  const src = readFileSync("src/app/api/ai/physio/route.ts", "utf8");
  const i = src.indexOf("out.tronquee");
  assert.ok(i > 0, "le kiné ignore le drapeau de troncature");
  assert.ok(/Réponse interrompue/.test(src.slice(i, i + 300)), "le kiné ne dit pas que la réponse est incomplète");
});

// ── Erreurs du fournisseur ──────────────────────────────────────────────────────
test("l'erreur brute de Google n'atteint jamais l'écran", () => {
  // ⚠️ MESURÉ EN PRODUCTION LE 02/09/2026 : le coach a renvoyé au client le JSON de
  // Google, avec le nom de la métrique de quota, le modèle appelé et des liens de
  // facturation. `lastErr` recevait le corps brut de la réponse, et trois routes le
  // transmettaient tel quel (coach, journal-analyze, training-plan).
  for (const st of [400, 429, 500, 502, 503]) {
    const m = messageLisible(st);
    assert.ok(!/quota|metric|generativelanguage|http|billing|limit/i.test(m),
      `le message pour ${st} décrit notre infrastructure : ${m}`);
    assert.ok(m.length > 20, `le message pour ${st} est trop maigre : ${m}`);
  }
  // Un quota JOURNALIER ne se dissipe pas « dans quelques secondes ».
  assert.ok(/demain|cette nuit/i.test(messageLisible(429, true)));
  assert.ok(!/demain/i.test(messageLisible(429, false)), "un ralentissement passager renvoie à demain");

  // Et les routes qui transmettent `error` doivent recevoir un message, pas le corps brut.
  const src = readFileSync("src/lib/ai/gemini.ts", "utf8")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  const i = src.lastIndexOf("return {");
  assert.ok(/error: messageLisible\(/.test(src.slice(i)), "le corps brut du fournisseur repart vers l'appelant");
  assert.ok(/detail: lastErr/.test(src.slice(i)), "le corps brut n'est plus conservé pour les journaux du serveur");
});

test("une analyse de journal vide n'est pas servie comme un succès", () => {
  // ⚠️ MESURÉ : cette route a répondu HTTP 200 avec `{}`. Le journal affichait une
  // analyse « réussie » sans un seul indicateur, et l'entrée partait ainsi en base.
  assert.equal(analyserJson('{"mental_fatigue":5,"sentiment":"neutral"}')?.mental_fatigue, 5);
  // JSON coupé net : pas d'accolade fermante, donc rien de récupérable.
  assert.equal(analyserJson('{"mental_fatigue": 5, "motiv'), null, "un JSON tronqué produit une analyse");
  for (const brut of ["", "{}", "   ", "pas du json", "[]", '{"autre_chose": 1}', "null"]) {
    assert.equal(analyserJson(brut), null, `« ${brut} » a produit une analyse exploitable`);
  }
  // Un objet enrobé de texte reste récupérable : c'est le cas courant, il ne faut pas
  // le perdre en corrigeant le cas vide.
  assert.equal(analyserJson('Voici :\n{"stress_level":3}\nvoilà')?.stress_level, 3);

  // ⚠️ RETIRER LES COMMENTAIRES AVANT D'ASSERTIR. Premier jet : ce test restait VERT
  // quand on supprimait le réglage, parce qu'il trouvait « thinkingBudget: 0 » dans le
  // COMMENTAIRE qui explique pourquoi il est là. Un test qui lit la documentation valide
  // la documentation. Trouvé par mutation. On coupe sans casser sur le « :// » d'une URL.
  const src = readFileSync("src/app/api/ai/journal-analyze/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/thinkingBudget: 0/.test(src),
    "sans thinkingConfig explicite, le raisonnement de Gemini 2.5 mange les 500 jetons et coupe le JSON");
  const i = src.indexOf("if (!analysis)");
  assert.ok(i > 0 && /status: 502/.test(src.slice(i, i + 300)), "une analyse absente repart en succès");
});

console.log(`\n${passed} crash-test(s) du kiné passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
