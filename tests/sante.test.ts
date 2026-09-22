/**
 * SANTÉ & KINÉ IA — la consultation laisse quelque chose, et l'onglet Sécurité ne ment plus.
 *
 * Refonte du 22/09/2026 (Cyprien : « améliore le design et la puissance »). Deux défauts
 * trouvés en LISANT le code, pas en le supposant :
 *
 *  1. L'onglet « Guardian » annonçait quatre fonctions de SÉCURITÉ qui n'existaient
 *     nulle part : détection de chute (accéléromètre + gyroscope), arrêt cardiaque via
 *     la montre, position GPS partagée automatiquement, « SMS + appel si pas de réponse
 *     en 2 min ». Aucune ligne de code ne les implémentait, et le bouton « Enregistrer
 *     le contact » affichait un succès sans rien écrire. Quelqu'un pouvait partir seul
 *     en montagne en se croyant surveillé.
 *  2. La consultation vivait dans l'état du composant : changer d'onglet suffisait à la
 *     perdre, et rien n'en sortait — ni bilan, ni exercices programmés.
 *
 *   npx tsx tests/sante.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extraireBilan, validerBilan, noteProtocole, datesProtocole } from "../src/lib/health/bilan";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const CENTRE = "src/components/health/HealthCenter.tsx";
const LANGUES = ["fr", "en", "de", "es", "pt"] as const;

console.log("\n=== SANTÉ & KINÉ IA ===\n");

test("l'onglet Sécurité ne promet plus ce qui n'existe pas", () => {
  // Le code NU : le commentaire qui raconte ces fausses promesses doit rester lisible
  // (c'est la mémoire du défaut), seul l'affichage est contrôlé.
  const src = codeNu(CENTRE);
  // Les quatre fausses promesses, dans les cinq langues : elles ne doivent plus exister.
  for (const faux of [/détection de chute/i, /fall detection/i, /Sturzerkennung/i, /detección de caídas/i, /deteção de quedas/i,
    /arrêt cardiaque/i, /cardiac arrest/i, /Herzstillstand/i, /paro cardíaco/i, /paragem cardíaca/i,
    /SMS \+ (appel|call|Anruf|llamada|chamada)/i, /alerte automatique/i, /automatic alert/i]) {
    assert.ok(!faux.test(src), `l'onglet Sécurité annonce à nouveau « ${faux} » — aucune ligne de code ne le fait`);
  }
  // Et il dit explicitement ce qu'il ne fait pas.
  const codeSrc = src;
  assert.match(codeSrc, /"sec\.honest"/, "la phrase qui dit ce que Pacevo NE fait PAS a disparu");
  assert.ok(!/guardianEnabled/.test(codeSrc), "l'interrupteur « Guardian » (qui n'allumait rien) est revenu");
  // Ce qui reste existe vraiment : le partage live (page /dashboard/trail) et l'appel direct.
  assert.match(codeSrc, /href="\/dashboard\/trail"/, "le lien vers le partage de position en direct a disparu");
  assert.match(codeSrc, /href=\{`tel:\$\{emergencyPhone/, "le contact d'urgence n'est plus appelable");
});

test("le contact d'urgence est VRAIMENT enregistré, et l'échec est dit", () => {
  const src = codeNu(CENTRE);
  assert.match(src, /fetch\("\/api\/settings"[\s\S]{0,200}contactUrgenceNom/, "le contact n'est plus envoyé aux réglages");
  assert.match(src, /if \(r\.ok\) toast\.success\(tr\("gd\.savedContact"\)\);\s*else toast\.error\(tr\("sec\.saveFail"\)\)/,
    "un enregistrement refusé s'annoncerait encore comme réussi");
  const api = codeNu("src/app/api/settings/route.ts");
  assert.match(api, /body\.contactUrgenceNom === "string"/, "/api/settings n'accepte plus le nom du contact");
  assert.match(api, /body\.contactUrgenceTel[\s\S]{0,120}replace\(/, "le numéro n'est plus nettoyé avant écriture");
  // Et il est relu côté serveur, sinon le champ repart vide à chaque visite.
  assert.match(codeNu("src/app/dashboard/health/page.tsx"), /contactUrgenceNom/, "la page ne relit plus le contact enregistré");
});

test("la consultation survit à un rechargement, et peut être remise à zéro", () => {
  const page = codeNu("src/app/dashboard/health/page.tsx");
  assert.match(page, /\.eq\("type", "kine_chat"\)/, "la page ne relit plus le fil de consultation");
  assert.match(page, /filInitial=\{fil\}/, "le fil relu n'est plus passé au composant");
  const src = codeNu(CENTRE);
  assert.match(src, /filInitial\.length > 0 \? filInitial : \[\{ role: "model", text: tr\("chat\.seed"\) \}\]/, "le composant repart d'un fil vide");
  assert.match(src, /fetch\("\/api\/health\/consultation", \{ method: "DELETE" \}\)/, "« Nouvelle consultation » n'efface plus rien côté serveur");
  const route = codeNu("src/app/api/ai/physio/route.ts");
  assert.match(route, /type: "kine_chat"/, "la route n'écrit plus la mémoire de consultation");
  assert.match(route, /console\.error\("\[kiné\] consultation non mémorisée/, "un échec d'écriture de la mémoire passerait inaperçu");
  // Les photos ne partent JAMAIS dans la mémoire : seul le texte est conservé.
  const iFil = route.indexOf("const fil =");
  assert.ok(iFil > 0, "le bloc de mémoire de consultation a disparu");
  const bloc = route.slice(iFil, route.indexOf("return NextResponse.json({ reply"));
  assert.ok(!/photo/.test(bloc), "la mémoire de consultation embarque la photo, qui ne doit RIEN laisser derrière elle");
});

test("le bilan structuré : extrait, validé, borné — et un bloc coupé n'atterrit pas à l'écran", () => {
  const ok = `Voici mon analyse.\n\n\`\`\`bilan\n{"hypotheses":[{"nom":"Syndrome de l'essuie-glace","probabilite":"haute"},{"nom":"Tendinopathie","probabilite":"FAIBLE"}],"urgence":false,"exercices":[{"nom":"Side-plank","dosage":"3 × 30 s","frequence":"1 j/2"}],"charge":"−30 % cette semaine","reprise":"quand la descente est indolore"}\n\`\`\``;
  const r = extraireBilan(ok);
  assert.ok(!r.texte.includes("```"), "le bloc technique reste visible dans le texte lu par l'athlète");
  assert.equal(r.bilan?.hypotheses.length, 2);
  assert.equal(r.bilan?.hypotheses[1].probabilite, "faible", "la probabilité n'est pas normalisée");
  assert.equal(r.bilan?.exercices[0].nom, "Side-plank");
  // Réponse coupée en plein bilan : le fragment JSON ne doit pas s'afficher.
  const coupe = `Mon analyse.\n\n\`\`\`bilan\n{"hypotheses":[{"nom":"Syndrome de la Bandelette`;
  const rc = extraireBilan(coupe);
  assert.equal(rc.bilan, null);
  assert.ok(!rc.texte.includes("hypotheses"), "un bilan coupé s'affiche en JSON brut à l'athlète");
  assert.equal(rc.texte, "Mon analyse.");
  // Pas de bloc du tout : le texte passe entier.
  assert.equal(extraireBilan("Juste du texte.").texte, "Juste du texte.");
  // Et les entrées absurdes ne produisent jamais de bilan.
  for (const junk of [null, undefined, 42, "x", [], {}, { hypotheses: "non" }, { exercices: [{ nom: "a" }] }]) {
    assert.equal(validerBilan(junk), null, `bilan accepté à tort : ${JSON.stringify(junk)}`);
  }
  // Bornes : 3 hypothèses, 4 exercices, textes tronqués.
  const gros = validerBilan({ hypotheses: Array.from({ length: 9 }, (_, i) => ({ nom: `hypothèse ${i}`, probabilite: "haute" })), exercices: Array.from({ length: 9 }, (_, i) => ({ nom: `exercice ${i}`, dosage: "3 × 10" })), charge: "x".repeat(900), urgence: "oui" });
  assert.equal(gros?.hypotheses.length, 3); assert.equal(gros?.exercices.length, 4);
  assert.ok((gros?.charge.length ?? 0) <= 220, "la consigne de charge n'est plus bornée");
  assert.equal(gros?.urgence, false, "« urgence » n'est vrai que pour le booléen true");
});

test("le protocole part dans le calendrier : 6 notes, un jour sur deux, jamais aujourd'hui", () => {
  const dates = datesProtocole("2026-09-22");
  assert.deepEqual(dates, ["2026-09-23", "2026-09-25", "2026-09-27", "2026-09-30", "2026-10-02", "2026-10-04"]);
  assert.ok(!dates.includes("2026-09-22"), "le protocole commence le jour même de la consultation");
  assert.deepEqual(datesProtocole("pas une date"), [], "une date invalide produit des notes invalides");
  const note = noteProtocole("Genou droit", [{ nom: "Side-plank", dosage: "3 × 30 s", frequence: "1 j/2" }]);
  assert.match(note, /^Protocole kiné — Genou droit\n• Side-plank : 3 × 30 s \(1 j\/2\)$/);
  assert.ok(noteProtocole(null, Array.from({ length: 9 }, () => ({ nom: "x".repeat(200), dosage: "y".repeat(200), frequence: "" }))).length <= 1000, "la note de calendrier n'est plus bornée");
  // La route revalide ce que le navigateur envoie, et lit son erreur.
  const api = codeNu("src/app/api/health/protocole/route.ts");
  assert.match(api, /validerBilan\(\{ exercices: corps\.exercices/, "la route écrit dans le calendrier sans revalider les exercices");
  assert.match(api, /type: "client_note"/, "les notes ne sont plus des notes de calendrier");
  assert.match(api, /if \(error\) return NextResponse\.json\(\{ error: "Le calendrier n'a pas pu être écrit" \}/, "une écriture refusée passerait pour un succès");
  assert.match(codeNu(CENTRE), /fetch\("\/api\/health\/protocole"/, "le bouton « programmer » n'appelle plus la route");
});

test("le kiné réclame le bilan, avec assez de jetons pour l'écrire", () => {
  const route = codeNu("src/app/api/ai/physio/route.ts");
  assert.match(route, /BILAN STRUCTURÉ \(OBLIGATOIRE/, "l'invite ne demande plus de bilan structuré");
  assert.match(route, /extraireBilan\(out\.text\)/, "la réponse n'est plus découpée");
  assert.match(route, /NextResponse\.json\(\{ reply, bilan \}\)/, "le bilan n'est plus renvoyé au navigateur");
  // ⚠️ Le bilan vient EN DERNIER : mesuré le 22/09/2026, 1900 jetons de réponse le
  // coupaient en plein JSON. Le budget de réponse doit rester large.
  const m = route.match(/budget\((\d+), (\d+)\)/);
  assert.ok(m, "le budget de jetons du kiné a disparu");
  assert.ok(Number(m![2]) >= 2400, `budget de réponse ${m![2]} : trop court, le bilan sera coupé`);
});

test("sur téléphone : la consultation d'abord, le schéma corporel repliable, les onglets qui défilent", () => {
  const src = codeNu(CENTRE);
  assert.ok(!/className="grid grid-cols-12 gap-4">\s*\n\s*\{\/\* Schéma corporel/.test(src), "la grille à 12 colonnes est revenue sur l'onglet Kiné");
  assert.match(src, /className="grid grid-cols-1 gap-4 lg:grid-cols-12"/, "l'onglet Kiné n'est plus sur une colonne sous lg");
  assert.match(src, /className="order-1 bento-card flex flex-col lg:order-none lg:col-span-7"/, "le chat n'est plus en premier sur téléphone");
  assert.match(src, /className="order-2 space-y-4 lg:order-none lg:col-span-5"/, "le schéma corporel n'est plus en second sur téléphone");
  assert.match(src, /setSchemaOuvert\(\(v\) => !v\)/, "le schéma corporel ne se replie plus");
  assert.match(src, /schemaOuvert \? "" : "hidden lg:block"/, "le schéma reste déplié sur téléphone (un écran entier avant le chat)");
  assert.match(src, /overflow-x-auto rounded-2xl bg-zinc-100\/80/, "les cinq onglets ne défilent plus (ils se cassaient sur deux lignes)");
});

test("plus aucun « Guardian » à l'écran — ni onglet, ni titre, ni réponse du support", () => {
  // Le ménage du 22/09 avait laissé trois survivances, trouvées le 23/09 en ouvrant la
  // vraie page : le TITRE D'ONGLET du navigateur disait encore « Santé & Guardian »,
  // l'assistant de support promettait toujours « détection de chute, alerte GPS
  // automatique », et le Profil portait un interrupteur « Mode Guardian ».
  const vus: string[] = [];
  for (const f of ["src/app/dashboard/health/page.tsx", "src/data/helpKb.ts",
                   "src/components/profile/ProfileSettings.tsx", "src/components/health/HealthCenter.tsx"]) {
    if (/Guardian/.test(codeNu(f))) vus.push(f);
  }
  assert.deepEqual(vus, [], `« Guardian » revient à l'écran dans : ${vus.join(", ")}`);
  // Et le support ne promet plus ce qui n'existe pas ; il dit la limite.
  const kb = readFileSync("src/data/helpKb.ts", "utf8");
  assert.ok(!/détection de chute|alerte GPS automatique/.test(kb), "l'assistant de support promet de nouveau une détection de chute et une alerte GPS automatique");
  const secu = kb.split("\n").find((l) => l.includes("SÉCURITÉ EN COURSE"));
  assert.ok(secu, "l'entrée « sécurité en course » a disparu de la base de connaissances");
  assert.match(secu!, /ÉCRAN ALLUMÉ/, "le support ne dit plus que la veille s'arrête écran verrouillé");
  assert.match(secu!, /n'appelle et n'écrit à personne/, "le support laisse croire que Pacevo alerte tout seul");
});

test("le Profil n'a plus d'interrupteur qui ne commande rien", () => {
  // ⚠️ `guardian_mode_enabled` était ÉCRIT en base et relu seulement pour se dessiner :
  // aucun autre fichier ne le lisait. Il annonçait « bloque automatiquement les séances à
  // haute intensité » et, allumé, « votre santé est protégée ». L'allègement existe —
  // `lib/coach/qualityBudget` — mais il n'est PAS optionnel, donc l'interrupteur laissait
  // aussi croire qu'éteint, on n'était pas protégé.
  const prof = codeNu("src/components/profile/ProfileSettings.tsx");
  assert.ok(!/guardian_mode_enabled/.test(prof), "le réglage fantôme est revenu dans le formulaire du Profil");
  assert.ok(!/guard\.active/.test(prof), "« votre santé est protégée » est revenu");
  // Ce qui le remplace doit RENVOYER vers la preuve, pas se contenter d'affirmer.
  assert.match(prof, /href="\/dashboard\/calendrier"[^>]*>\s*\n?\s*\{tr\("guard\.voir"\)\}/, "l'encart ne renvoie plus au calendrier, où les allègements sont motivés");
  // …et la protection annoncée doit exister pour de vrai, à ces conditions-là.
  const qb = codeNu("src/lib/coach/qualityBudget.ts");
  assert.match(qb, /if \(i\.hrvDown\) \{ qBudget -= 1;/, "la VFC en baisse ne retire plus d'intensité : l'encart du Profil ment");
  assert.match(qb, /if \(i\.pains\.length\) \{ qBudget -= 1;/, "une douleur signalée ne retire plus d'intensité : l'encart du Profil ment");
  assert.match(qb, /if \(i\.rpeHigh\) \{ qBudget -= 1;/, "un ressenti élevé ne retire plus d'intensité : l'encart du Profil ment");
  const n = [...readFileSync("src/components/profile/ProfileSettings.tsx", "utf8").matchAll(/"guard\.voir":/g)].length;
  assert.equal(n, 5, `« guard.voir » présent ${n} fois, attendu 5`);
});

test("les libellés Santé ajoutés existent dans les cinq langues", () => {
  const src = readFileSync(CENTRE, "utf8");
  const cles = ["sec.title", "sec.sub", "sec.live", "sec.liveDesc", "sec.liveBtn", "sec.contact", "sec.contactDesc", "sec.honest", "sec.kit", "sec.k1", "sec.k5", "sec.call", "sec.saveFail",
    "chat.new", "chat.newConfirm", "chat.resumed", "chat.newFail", "bilan.title", "bilan.hyp", "bilan.urgent", "bilan.exos", "bilan.charge", "bilan.reprise", "bilan.plan", "bilan.planned", "bilan.planFail", "bilan.voirCal",
    "bilan.proba.haute", "bilan.proba.moyenne", "bilan.proba.faible"];
  for (const k of cles) {
    const n = [...src.matchAll(new RegExp(`"${k.replace(/\./g, "\\.")}":`, "g"))].length;
    assert.equal(n, LANGUES.length, `« ${k} » présent ${n} fois, attendu ${LANGUES.length}`);
  }
  assert.ok(src.includes('"bilan.planned": "{n}') || /"bilan\.planned": "[^"]*\{n\}/.test(src), "« bilan.planned » ne porte plus le nombre de séances");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
