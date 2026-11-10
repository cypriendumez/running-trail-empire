/**
 * LA MONTRE RELIÉE, SANS RIEN REDEMANDER (09/11/2026).
 *
 * Le soir du 09/11, le frère de Cyprien relie sa COROS. Deux défauts constatés :
 *
 *  1. il crée son compte intervals.icu et y relie sa montre, revient sur le questionnaire…
 *     qui lui repose « Créer mon compte / J'ai déjà un compte », comme si rien ne s'était
 *     passé. L'étape avance maintenant seule au retour d'intervals.icu ;
 *  2. arrivé dans l'application, la liste de ses séances est vide : il doit trouver le
 *     bouton « Synchroniser ». La synchronisation automatique ne tirait que 3 jours, et la
 *     liste ne se relisait jamais. L'historique s'importe maintenant seul, en le disant.
 *
 *   npx tsx tests/premier-import.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { etapeAuRetour } from "../src/lib/intervals/connexionMontre";
import {
  CLE_PREMIER_IMPORT, ESSAIS_RAPPROCHES, MARQUE_DEMANDEE, PAUSE_LONGUE_MS, decisionPremierImport,
  demanderPremierImport, lireMarque, marqueApres, marqueAuLancement, premierImportDu,
  tranchesPremierImport, type Marque,
} from "../src/lib/intervals/premierImport";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
// Commentaires retirés SANS couper sur `://` (sinon une URL disparaît du code lu).
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

const MIN = 60_000, H = 3_600_000, JOUR = 86_400_000;
// Un instant FIGÉ, passé aux fonctions : le test ne dépend pas du jour où il tourne.
const T0 = Date.parse("2026-11-09T21:30:00Z");

console.log("\nL'ÉTAPE MONTRE AVANCE SEULE AU RETOUR D'intervals.icu");

test("revenu de « Créer mon compte », on ouvre l'étape 2 ; revenu des Connexions, l'étape 3", () => {
  assert.equal(etapeAuRetour(0, 0), 1);
  assert.equal(etapeAuRetour(1, 1), 2);
});

test("si l'athlète a changé d'étape entre-temps, on ne le déplace pas", () => {
  assert.equal(etapeAuRetour(2, 1), 2, "revenu des Connexions alors qu'il est déjà à l'étape 3");
  assert.equal(etapeAuRetour(1, 0), 1, "revenu de la création de compte alors qu'il est déjà à l'étape 2");
  assert.equal(etapeAuRetour(0, 1), 0, "« Revoir » l'étape 1 pendant l'absence : on y reste");
});

test("la troisième étape EST la connexion : aucun retour ne la passe", () => {
  assert.equal(etapeAuRetour(2, 2), 2);
  for (const [s, e] of [[0, -1], [0, 3], [0, Number.NaN], [Number.NaN, 0], [0.5, 0]] as const) {
    assert.equal(Object.is(etapeAuRetour(s, e), s), true, `etapeAuRetour(${s}, ${e}) a bougé`);
  }
});

test("l'écran arme le retour sur ses deux liens intervals.icu, pas sur celui de l'App Store", () => {
  const src = code("src/app/onboarding/EtapeMontre.tsx");
  assert.ok(/href="https:\/\/intervals\.icu\/signup"[^>]*onClick=\{\(\) => partir\(0\)\}/.test(src), "« Créer mon compte » n'arme plus le retour");
  assert.ok(/href="https:\/\/intervals\.icu\/settings\/connections"[^>]*onClick=\{\(\) => partir\(1\)\}/.test(src), "« Ouvrir les Connexions » n'arme plus le retour");
  // Apple Watch : ses réglages se lisent sur Pacevo PENDANT qu'on les fait dans l'app.
  assert.equal((src.match(/partir\(\d\)/g) ?? []).length, 2, "un autre lien fait avancer l'étape au retour");
  assert.ok(!/href=\{APP_STORE_COMPANION\}[^>]*partir\(/.test(src), "le lien de l'App Store fait avancer l'étape");
  assert.ok(/setSous\(\(s\) => etapeAuRetour\(s, p\.etape\)\)/.test(src), "le retour ne passe plus par etapeAuRetour");
  // Un onglet ouvert en arrière-plan n'est pas un départ : il faut avoir quitté la page.
  assert.ok(/if \(!p \|\| !p\.absent\) return;/.test(src), "l'étape avance sans que l'athlète soit parti");
  assert.ok(/addEventListener\("visibilitychange", visibilite\)/.test(src) && /addEventListener\("focus", retour\)/.test(src), "le retour sur l'onglet n'est plus écouté");
});

console.log("\nCE QUE DIT LE SERVEUR : UN IMPORT EST-IL DÛ ?");

test("montre reliée et aucune séance de montre en base : oui", () => {
  assert.equal(premierImportDu(true, { count: 0, error: null }), true);
});

test("des séances déjà là, ou pas de montre : non", () => {
  assert.equal(premierImportDu(true, { count: 41, error: null }), false);
  assert.equal(premierImportDu(false, null), false);
  assert.equal(premierImportDu(false, { count: 0, error: null }), false, "sans montre, il n'y a rien à importer");
});

test("une panne n'est ni « rien en base » ni « tout est là » : on ne sait pas", () => {
  assert.equal(premierImportDu(true, { count: null, error: { message: "timeout" } }), null);
  assert.equal(premierImportDu(true, { count: 0, error: { message: "timeout" } }), null, "une erreur avec un compte à 0 passe pour « rien en base »");
  assert.equal(premierImportDu(true, { count: null, error: null }), null);
  assert.equal(premierImportDu(true, null), null);
});

test("la route de statut compte les séances de MONTRE et lit l'erreur", () => {
  const src = code("src/app/api/intervals/status/route.ts");
  assert.ok(/from\("workouts"\)\.select\("id", \{ count: "exact", head: true \}\)\s*\.eq\("user_id", user\.id\)\.not\("external_id", "is", null\)/.test(src), "le compte ne porte plus sur les séances de montre de l'athlète connecté");
  assert.ok(/const premierImport = premierImportDu\(configured, seances\)/.test(src), "la route décide seule, sans premierImportDu");
  assert.ok(/NextResponse\.json\(\{ configured, [^}]*premierImport \}\)/.test(src), "la réponse ne porte plus premierImport");
});

console.log("\nLES TRANCHES : UNE ANNÉE, LA PLUS RÉCENTE D'ABORD");

test("cinq tranches, des 30 derniers jours jusqu'à un an", () => {
  const t = tranchesPremierImport(T0);
  assert.deepEqual(t, [
    { oldest: "2026-10-10", newest: "2026-11-10" },
    { oldest: "2026-07-12", newest: "2026-10-10" },
    { oldest: "2026-04-13", newest: "2026-07-12" },
    { oldest: "2026-01-13", newest: "2026-04-13" },
    { oldest: "2025-11-09", newest: "2026-01-13" },
  ]);
});

test("la première tranche va jusqu'à demain (les dates sont en UTC)", () => {
  // 23 h 30 à Paris le 9 : il est déjà le 10 pour un coureur de Tokyo.
  assert.equal(tranchesPremierImport(T0)[0].newest, "2026-11-10");
});

test("aucun jour oublié entre deux tranches, et aucune tranche à l'envers", () => {
  for (const depart of [T0, T0 + 17 * H, Date.parse("2028-02-29T12:00:00Z"), Date.parse("2027-01-01T00:00:00Z")]) {
    const t = tranchesPremierImport(depart);
    for (let i = 0; i < t.length; i++) {
      assert.ok(t[i].oldest < t[i].newest, `tranche ${i} à l'envers`);
      if (i > 0) assert.equal(t[i].newest, t[i - 1].oldest, `trou entre les tranches ${i - 1} et ${i}`);
    }
    assert.equal(t[t.length - 1].oldest, new Date(depart - 365 * JOUR).toISOString().slice(0, 10));
  }
});

console.log("\nLA DÉCISION : QUAND IMPORTER, ET QUAND SE TAIRE");

test("première arrivée, montre tout juste reliée : on importe, et on le dit", () => {
  assert.deepEqual(decisionPremierImport(true, null, T0), { lancer: true, annoncer: true });
});

test("rien à importer : on ne lance rien", () => {
  assert.deepEqual(decisionPremierImport(false, null, T0), { lancer: false, annoncer: false });
  assert.deepEqual(decisionPremierImport(false, { dernier: T0 - H, essais: 2, enCours: false }, T0), { lancer: false, annoncer: false });
});

test("le serveur ne sait pas : on ne lance rien sur un « je ne sais pas »", () => {
  assert.equal(decisionPremierImport(null, null, T0).lancer, false);
});

test("une montre vient d'être reliée (navigateur) : l'import est dû même si la base a des séances", () => {
  assert.deepEqual(decisionPremierImport(false, MARQUE_DEMANDEE, T0), { lancer: true, annoncer: true });
  assert.deepEqual(decisionPremierImport(null, MARQUE_DEMANDEE, T0), { lancer: true, annoncer: true });
});

test("un import interrompu (onglet fermé) reprend, sans le réannoncer", () => {
  const m: Marque = { dernier: T0 - 5 * MIN, essais: 1, enCours: true };
  assert.deepEqual(decisionPremierImport(false, m, T0), { lancer: true, annoncer: false });
});

test("jamais deux essais à moins de 100 secondes", () => {
  const m: Marque = { dernier: T0 - 30_000, essais: 1, enCours: false };
  assert.equal(decisionPremierImport(true, m, T0).lancer, false);
  assert.equal(decisionPremierImport(true, { ...m, dernier: T0 - 2 * MIN }, T0).lancer, true);
});

test("après cinq essais sans rien trouver, on attend six heures", () => {
  const m: Marque = { dernier: T0 - 2 * MIN, essais: ESSAIS_RAPPROCHES, enCours: false };
  assert.equal(decisionPremierImport(true, m, T0).lancer, false);
  assert.equal(decisionPremierImport(true, { ...m, dernier: T0 - PAUSE_LONGUE_MS + 1 }, T0).lancer, false);
  assert.deepEqual(decisionPremierImport(true, { ...m, dernier: T0 - PAUSE_LONGUE_MS }, T0), { lancer: true, annoncer: true });
});

test("une marque « du futur » (horloge reculée) ne bloque pas l'import", () => {
  assert.equal(decisionPremierImport(true, { dernier: T0 + JOUR, essais: ESSAIS_RAPPROCHES, enCours: false }, T0).lancer, true);
});

test("un compte intervals.icu VIDE : 24 h d'onglet ouvert, une poignée d'essais, pas 720", () => {
  // AutoSync passe toutes les 2 minutes. Un vrai débutant n'a rien à importer : on ne doit
  // ni l'interroger sans fin, ni lui afficher « import en cours » à chaque passage.
  let marque: Marque | null = null, lances = 0, annonces = 0;
  for (let t = T0; t <= T0 + 24 * H; t += 2 * MIN) {
    const d = decisionPremierImport(true, marque, t);
    if (!d.lancer) continue;
    lances++; if (d.annoncer) annonces++;
    const m = marqueAuLancement(marque, t);
    marque = marqueApres(m, { complet: true, ecrites: 0 });
    assert.ok(marque && !marque.enCours, "un import complet et vide reste « en cours »");
  }
  assert.equal(lances, 5 * 4, `${lances} imports lancés en 24 h`);
  assert.equal(annonces, 4, `${annonces} annonces en 24 h`);
});

console.log("\nLA MARQUE : REPRENDRE CE QUI N'EST PAS ALLÉ AU BOUT");

test("la marque est écrite « en cours » au lancement, et compte les essais", () => {
  assert.deepEqual(marqueAuLancement(null, T0), { dernier: T0, essais: 1, enCours: true });
  assert.deepEqual(marqueAuLancement(MARQUE_DEMANDEE, T0), { dernier: T0, essais: 1, enCours: true });
  assert.deepEqual(marqueAuLancement({ dernier: T0 - 2 * MIN, essais: 3, enCours: false }, T0), { dernier: T0, essais: 4, enCours: true });
});

test("après la longue pause, une nouvelle série repart de 1", () => {
  const m: Marque = { dernier: T0 - PAUSE_LONGUE_MS, essais: ESSAIS_RAPPROCHES, enCours: false };
  assert.equal(marqueAuLancement(m, T0).essais, 1);
});

test("tout importé : la marque s'efface ; coupé en route : elle reste « en cours »", () => {
  const m: Marque = { dernier: T0, essais: 1, enCours: true };
  assert.equal(marqueApres(m, { complet: true, ecrites: 212 }), null);
  assert.deepEqual(marqueApres(m, { complet: false, ecrites: 40 }), m);
  assert.deepEqual(marqueApres({ ...m, enCours: false }, { complet: false, ecrites: 0 }), m, "une coupure n'est plus reprise");
});

test("complet mais rien d'écrit : ce n'est pas « fini », on regardera de nouveau", () => {
  const m: Marque = { dernier: T0, essais: 1, enCours: true };
  assert.deepEqual(marqueApres(m, { complet: true, ecrites: 0 }), { dernier: T0, essais: 1, enCours: false });
});

test("une marque abîmée dans le navigateur est ignorée, jamais suivie", () => {
  for (const brut of [null, undefined, "", "oui", "{", "null", "[]", "42", '{"dernier":"hier","essais":1}', '{"dernier":-5,"essais":1}',
    '{"dernier":1,"essais":1.5}', '{"dernier":1,"essais":-1}', '{"dernier":1}', '{"essais":1}']) {
    assert.equal(lireMarque(brut), null, `marque acceptée : ${brut}`);
  }
  assert.deepEqual(lireMarque('{"dernier":12,"essais":2,"enCours":true}'), { dernier: 12, essais: 2, enCours: true });
  assert.deepEqual(lireMarque('{"dernier":12,"essais":2,"enCours":"oui"}'), { dernier: 12, essais: 2, enCours: false });
});

test("« une montre vient d'être reliée » se note, et un stockage refusé ne casse rien", () => {
  const ecrit: Record<string, string> = {};
  demanderPremierImport({ setItem: (k, v) => { ecrit[k] = v; } });
  assert.deepEqual(lireMarque(ecrit[CLE_PREMIER_IMPORT]), MARQUE_DEMANDEE);
  demanderPremierImport({ setItem: () => { throw new Error("QuotaExceededError"); } });
  demanderPremierImport(null);
});

console.log("\nL'ÉCRAN : PLUS DE BOUTON À TROUVER");

test("AutoSync décide par decisionPremierImport, et note la marque AVANT le premier appel", () => {
  const src = code("src/components/AutoSync.tsx");
  assert.ok(/const decision = decisionPremierImport\(premier\.current, lire\(\), Date\.now\(\)\);\s*if \(decision\.lancer\) \{ await premierImport\(decision\.annoncer\); return; \}/.test(src), "AutoSync ne lance plus l'import sur la décision partagée");
  const corps = src.slice(src.indexOf("const premierImport = async"), src.indexOf("const trigger = async"));
  const iMarque = corps.indexOf("ecrire(marque)"), iAppel = corps.indexOf("/api/intervals/sync?oldest=");
  assert.ok(iMarque > 0 && iAppel > iMarque, "la marque est écrite après le premier appel : un onglet fermé ne reprendrait pas");
  assert.ok(/ecrire\(marqueApres\(marque, \{ complet, ecrites \}\)\)/.test(corps), "le bilan de l'import n'est plus noté");
  assert.ok(/for \(const t of tranches\) \{\s*if \(stopped\) break;/.test(corps), "l'import continue après avoir quitté le tableau de bord");
});

test("le verrou « synchro en cours » est propre à chaque montage", () => {
  // Constaté dans le navigateur le 10/11/2026 : en mode strict (dev), React monte, démonte,
  // remonte. Avec un verrou partagé (`useRef`), le second montage trouvait le premier encore
  // en train de lire le statut, et renonçait : aucune synchronisation au chargement.
  const src = code("src/components/AutoSync.tsx");
  assert.ok(/useEffect\(\(\) => \{\s*let stopped = false;\s*const busy = \{ current: false \};/.test(src), "le verrou n'est plus créé dans l'effet");
  assert.ok(!/busy = useRef/.test(src), "le verrou est de nouveau partagé entre deux montages");
});

test("une réponse « je ne sais pas » du serveur n'est pas retenue comme « rien à importer »", () => {
  const src = code("src/components/AutoSync.tsx");
  assert.ok(/premier\.current = typeof s\.premierImport === "boolean" \? s\.premierImport : null/.test(src), "un premierImport absent ou nul est pris pour un booléen");
  assert.ok(/if \(r\.ok\) configured\.current = /.test(src), "AutoSync met en cache une réponse ratée");
});

test("des séances inédites : l'écran se relit, la liste de Sync Montre aussi, et le plan est refait", () => {
  const src = code("src/components/AutoSync.tsx");
  assert.ok(/const seancesInedites = \(\) => \{\s*router\.refresh\(\);\s*window\.dispatchEvent\(new Event\(EVENEMENT_SYNCHRO\)\);/.test(src), "AutoSync ne prévient plus les listes chargées par le navigateur");
  assert.ok(/if \(n > 0\) seancesInedites\(\);/.test(src), "l'écran ne se remplit plus tranche après tranche");
  // Le plan a été construit AVANT la montre : sans cet appel, il ignore l'historique jusqu'à la nuit.
  assert.ok(/if \(inedites > 0\) \{[\s\S]{0,200}void replanifier\(false\);/.test(src), "le plan n'est plus refait après l'import");
  assert.ok(/fetch\("\/api\/coach\/generate", \{ method: "POST" \}\)/.test(src), "la replanification ne passe plus par la route protégée");
  const page = code("src/app/dashboard/sync/page.tsx");
  assert.ok(/const relire = \(\) => \{ loadData\(\); \};\s*window\.addEventListener\(EVENEMENT_SYNCHRO, relire\);/.test(page), "la liste de Sync Montre ne se relit plus seule");
});

test("un import annoncé ne s'éteint jamais sans un mot", () => {
  const src = code("src/components/AutoSync.tsx");
  assert.ok(/\} else if \(annoncer && complet && ecrites === 0\) \{\s*setBandeau\(\{ phase: "vide" \}\);/.test(src), "un compte vide n'est plus dit à l'écran");
  for (const lang of ["fr", "en", "de", "es", "pt"]) {
    const ligne = src.split("\n").find((l) => l.trimStart().startsWith(`${lang}: { enCours: "`));
    assert.ok(ligne, `${lang} : textes du bandeau absents`);
    for (const k of ["enCours", "fini", "fini1", "vide"]) assert.ok(new RegExp(`${k}: "[^"]{8,}"`).test(ligne), `${lang}.${k} manque`);
    assert.ok(/fini: "[^"]*\{n\}[^"]*"/.test(ligne), `${lang}.fini ne porte plus le nombre de séances`);
  }
});

test("chaque porte d'entrée de la montre demande l'import complet", () => {
  const page = code("src/app/dashboard/sync/page.tsx");
  // Retour de l'autorisation en un clic — sauf si l'accès aux activités a été décoché.
  assert.ok(/if \(statut === "ok" \|\| \(statut === "partiel" && !manque\.includes\("activity"\)\)\) demanderPremierImport\(window\.localStorage\);/.test(page), "le retour d'intervals.icu ne demande plus l'import");
  // Clé collée dans Sync Montre : pas de rechargement, AutoSync avait retenu « pas de montre ».
  assert.ok(/demanderPremierImport\(window\.localStorage\);\s*window\.dispatchEvent\(new Event\(EVENEMENT_MONTRE_RELIEE\)\);/.test(page), "la clé collée ne réveille plus AutoSync");
  const auto = code("src/components/AutoSync.tsx");
  assert.ok(/const onReliee = \(\) => \{ configured\.current = null; premier\.current = null; questions\.current = 0; trigger\(\); \};\s*window\.addEventListener\(EVENEMENT_MONTRE_RELIEE, onReliee\);/.test(auto), "AutoSync n'écoute plus « montre reliée »");
  // Clé collée dans le questionnaire : le suivi ne tire que 7 jours.
  assert.ok(/demanderPremierImport\(window\.localStorage\);\s*setSuivi\("checking"\);/.test(code("src/app/onboarding/EtapeMontre.tsx")), "le questionnaire ne demande plus l'import complet");
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
