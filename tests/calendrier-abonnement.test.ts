/**
 * MES SÉANCES DANS MON AGENDA (27/11/2026) — l'abonnement iCalendar (Apple, Google, Outlook).
 *
 * Demande de Cyprien : « quand la personne a une séance, la séance peut s'afficher dans le
 * calendrier Apple etc. ; mets les séances à midi ». Ce que ce fichier garde :
 *   - midi EN HEURE FLOTTANTE (12:00 chez le coureur, où qu'il soit), 18:00 pour le soir d'un jour doublé ;
 *   - la durée lue dans le texte du plan ; les jours de repos absents ;
 *   - rien de santé chez Apple ou Google (ni le « pourquoi », ni « ⚠️ DOULEUR SIGNALÉE ») ;
 *   - un format que les agendas lisent (CRLF, lignes pliées à 75 octets sans couper un accent) ;
 *   - un jeton secret dont seule l'empreinte est gardée, et une lecture ratée qui ne vide JAMAIS l'agenda.
 *
 *   npx tsx tests/calendrier-abonnement.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { construireIcs, dureeEvenementMin, heureDebut, plierLigne, seanceExportee, titreEvenement, ICS_T, type SeanceFlux } from "../src/lib/calendrier/ics";
import { nouveauJeton, empreinteJeton, jetonDuChemin, adresseFlux } from "../src/lib/calendrier/jeton";
import { lireFlux, versSeanceFlux } from "../src/lib/calendrier/flux";
import { PLAN_T } from "../src/lib/ai/planI18n";
import { QUALITE_T } from "../src/lib/ai/qualityI18n";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const LANGUES = ["fr", "en", "de", "es", "pt"] as const;

// Textes RÉELS du plan (relus en base le 27/11/2026).
const FOOTING = "Échauffement 6 min progressif FC Z1→Z2 → Corps : ~3,5 km (environ 17 min) en Z2 (~4'48/km), tu dois pouvoir tenir une conversation → Retour au calme 5 min FC Z1.\n\n4 °C : échauffement rallongé et couvre-toi.";
const TEST_VMA = "Échauffe-toi 15 min en footing facile, puis cours 6 min À FOND (l'allure la plus rapide que tu tiens), sur du plat — une piste est idéale. Retour au calme 10 min.";
const RENFO = "20 à 25 min, ENTRETIEN seulement : gainage 3×45 s, montées de mollets 2×15, proprioception 2×30 s par jambe.";
const LONGUE_SANS_ALLURE = "Échauffement 5 min progressif FC Z1→Z2 → Corps : ~4 km en Z2, allure conversationnelle du début à la fin → Retour au calme 20 min FC Z1.";
const SEUIL_EN_KM = "Échauffement 15 min → Corps : 3×2 km à 4'10/km, récup 2 min → Retour au calme 10 min.";

const seance = (p: Partial<SeanceFlux>): SeanceFlux => ({ date: "2026-11-28", moment: null, type: "Endurance", titre: "Footing en endurance", texte: FOOTING, tags: [], ...p });
const MAINTENANT = new Date("2026-11-27T21:30:00Z");
const ics = (s: SeanceFlux[], lang: (typeof LANGUES)[number] = "fr") => construireIcs(s, { graine: "user-123", lang, maintenant: MAINTENANT });
const evenements = (txt: string) => txt.split("BEGIN:VEVENT").slice(1);
/** Le texte d'un calendrier, lignes dépliées et échappements retirés : ce que l'agenda affiche. */
const lisible = (txt: string) => txt.replace(/\r\n /g, "").replace(/\\n/g, "\n").replace(/\\([,;\\])/g, "$1");
/** Une propriété d'un événement, lignes dépliées. */
const prop = (ev: string, nom: string) => ev.replace(/\r\n /g, "").split("\r\n").find((l) => l.startsWith(nom + ":") || l.startsWith(nom + ";"));

(async () => {
console.log("\nMIDI, HEURE LOCALE DU COUREUR");

await test("une séance commence à 12:00 en heure FLOTTANTE : ni Z, ni TZID, ni X-WR-TIMEZONE", () => {
  const txt = ics([seance({})]);
  const [ev] = evenements(txt);
  assert.equal(prop(ev, "DTSTART"), "DTSTART:20261128T120000");
  assert.ok(!/TZID|X-WR-TIMEZONE/.test(txt), "un fuseau ferait lire midi à Paris pour tout le monde");
});

await test("jour doublé : le matin à 12:00, le soir à 18:00 — jamais superposés", () => {
  assert.deepEqual(heureDebut("matin"), { h: 12, m: 0 });
  assert.deepEqual(heureDebut(null), { h: 12, m: 0 });
  assert.deepEqual(heureDebut("soir"), { h: 18, m: 0 });
  const evs = evenements(ics([seance({ moment: "matin" }), seance({ moment: "soir", type: "Renfo", titre: "Renforcement musculaire", texte: RENFO })]));
  assert.equal(evs.length, 2);
  assert.deepEqual(evs.map((e) => prop(e, "DTSTART")), ["DTSTART:20261128T120000", "DTSTART:20261128T180000"]);
});

await test("la fin de l'événement suit la durée, y compris au passage de minuit", () => {
  const [ev] = evenements(ics([seance({})]));
  assert.equal(prop(ev, "DTEND"), "DTEND:20261128T123000", "6 + 17 + 5 min → 30 min");
  const [soir] = evenements(ics([seance({ date: "2026-12-31", moment: "soir", type: "Sortie longue", texte: "Corps : 6 h 30 en Z2" })]));
  assert.equal(prop(soir, "DTEND"), "DTEND:20261231T230000", "plafonné à 5 h, sans déborder sur une date fausse");
});

console.log("\nLA DURÉE, LUE DANS LE PLAN (EN FRANÇAIS)");

await test("échauffement + corps + retour au calme, arrondi aux 5 min", () => {
  assert.equal(dureeEvenementMin(seance({})), 30);
});
await test("un corps donné en km avec son allure se convertit ; une « récup » n'est pas le corps", () => {
  // 15 + (3 × 2 km × 4'10 = 25 min, + 2 récups de 2 min) + 10 = 54 → 55. La « récup 2 min »
  // n'est PAS le corps : la lire ainsi donnait 15 + 2 + 10 = 30 min pour une heure de seuil.
  assert.equal(dureeEvenementMin(seance({ type: "Seuil", texte: SEUIL_EN_KM })), 55);
  assert.equal(dureeEvenementMin(seance({ type: "Endurance", texte: "Échauffement 10 min → Corps : 8 km à 5'00/km → Retour au calme 5 min" })), 55);
});
await test("des durées écrites à la suite s'additionnent (test VMA : 15 + 6 + 10)", () => {
  assert.equal(dureeEvenementMin(seance({ type: "Test", texte: TEST_VMA })), 35);
});
await test("les VRAIS gabarits de séance de qualité : répétitions, récupérations et blocs comptés", () => {
  // Relecture du 27/11/2026 : « 3×15 min » se lisait 15 min — 40 min d'agenda pour une séance d'1 h 15.
  // Échauffement 15 + corps + retour au calme 10, arrondi aux 5 min ; attendu calculé à la main.
  const Q = QUALITE_T.fr, p = "4'10", g = "4'30";
  const cas: [string, string, number][] = [
    ["seuil 3×8 min, récup 2", Q.seuilFractionne(3, 8, p), 55],          // 15 + 24 + 4 + 10 = 53
    ["seuil 2×10 min", Q.seuilReference(2, 10, p), 50],                  // 15 + 20 + 2 + 10 = 47
    ["sous-seuil 2×13 min, récup 3", Q.seuilLongSous(13, p), 55],         // 15 + 26 + 3 + 10 = 54
    ["over-under 3×6 min", Q.overUnder(3, 6, p, "4'00"), 50],             // 15 + 18 + 6 + 10 = 49
    ["marathon 3×15 min", Q.maraBloc15(g), 80],                           // 15 + 45 + 6 + 10 = 76
    ["marathon 2×20 min", Q.maraBloc20(g), 70],                           // 15 + 40 + 4 + 10 = 69
    ["30/30 ×12", Q.trenteTrente(12, p), 40],                             // 15 + 12 + 10 = 37
    ["fartlek 8×1/1", Q.fartlek(8), 45],                                  // 15 + 16 + 10 = 41
    ["2 blocs de 5×300 m", Q.vmaDeuxBlocs(5, p), 50],                     // 15 + 2×(6,25 + 3) + 3 + 10 ≈ 46,5
    ["VMA 10×400 m", Q.vmaCourte(10, p), 50],                             // 15 + 16,7 + 6,75 + 10 ≈ 48
    ["côtes 8×30 s, récup descente", Q.cotesCourtes(8), 35],              // la descente vaut l'effort : 15 + 4 + 3,5 + 10
    ["seuil continu 21 min", Q.seuilContinuSous(21, p), 50],              // 15 + 21 + 10 = 46
  ];
  for (const [nom, corps, attendu] of cas) {
    const texte = PLAN_T.fr.qualiteDetail(15, corps, 10, false, false, false);
    assert.equal(dureeEvenementMin(seance({ type: "Seuil", texte })), attendu, nom);
  }
});

await test("sortie longue spécifique : les morceaux « …, puis … » s'additionnent, chacun à son allure", () => {
  // 15 + 16 km × 5'10 (82,7) + 4 km × 4'20 (17,3) + 10 = 125 min.
  const texte = PLAN_T.fr.longSpecDetail(15, "16 km", " (~5'10/km)", "4", "4'20", 10, "");
  assert.equal(dureeEvenementMin(seance({ type: "Sortie longue", texte })), 125);
});

await test("marche-course SANS étiquette (conseillée après coup) : le corps en alternances, et la marche finale", () => {
  // `walkRunAdvised` n'écrit pas « N min » dans ses étiquettes : 5 + 8 × (2 + 1) + 5 = 34 → 35, pas 15.
  assert.equal(dureeEvenementMin(seance({ type: "Marche/course", texte: PLAN_T.fr.mcAlternance(8, 2, 1), tags: [] })), 35);
});

await test("une fourchette compte pour sa borne haute (vélo « 1h30 à 2h » : 2 h 20, pas 3 h 50)", () => {
  assert.equal(dureeEvenementMin(seance({ type: "Vélo", texte: PLAN_T.fr.veloLongDetail(10, "1h30", "") })), 140);
});

await test("le jour de course est une JOURNÉE ENTIÈRE : ni midi ni durée inventée", () => {
  const [ev] = evenements(ics([seance({ type: "Course", titre: "Marathon de Lille", texte: PLAN_T.fr.courseDetail("4'30") })]));
  assert.equal(prop(ev, "DTSTART"), "DTSTART;VALUE=DATE:20261128");
  assert.equal(prop(ev, "DTEND"), "DTEND;VALUE=DATE:20261129");
  assert.equal(prop(ev, "TRANSP"), "TRANSP:TRANSPARENT");
  assert.match(lisible(prop(ev, "DESCRIPTION")!), /^DESCRIPTION:Jour de course : le programme de la journée est dans Pacevo/);
  const [fin] = evenements(ics([seance({ date: "2026-12-31", type: "Course" })]));
  assert.equal(prop(fin, "DTEND"), "DTEND;VALUE=DATE:20270101", "le lendemain du 31 décembre");
});

await test("« poids du corps » n'est pas le corps de séance (renfo débutant : 20 min, pas 50)", () => {
  assert.equal(dureeEvenementMin(seance({ type: "Renfo", texte: PLAN_T.fr.renfoDebutant })), 20);
});
await test("« 20 à 25 min » : la borne haute ; « 5' /km » n'est pas une durée", () => {
  assert.equal(dureeEvenementMin(seance({ type: "Renfo", texte: RENFO })), 25);
  assert.equal(dureeEvenementMin(seance({ type: "Test", texte: "Cours 10 min à 5' /km, puis 5 min facile." })), 15);
});
await test("marche-course : la durée totale de l'étiquette", () => {
  // Le type RÉEL du plan s'écrit « Marche/course » (autoPlan) — relecture du 27/11/2026.
  // Et sur les VRAIS gabarits (« Corps : 8 × (1 min … / 2 min …) ») : lus par le corps, 15 min.
  assert.equal(dureeEvenementMin(seance({ type: "Marche/course", texte: PLAN_T.fr.mcAlternance(8, 1, 2), tags: ["Marche/course", "32 min"] })), 35);
  assert.equal(dureeEvenementMin(seance({ type: "Marche/course", texte: PLAN_T.fr.mcContinu(20), tags: ["Marche/course", "30 min"] })), 30);
});
await test("sans durée lisible : la durée par défaut du type, la même que la montre", () => {
  // Échauffement 5 + retour au calme 20 = 25 min : la séance elle-même aurait disparu.
  assert.equal(dureeEvenementMin(seance({ type: "Sortie longue", texte: LONGUE_SANS_ALLURE })), 90);
  assert.equal(dureeEvenementMin(seance({ type: "Endurance", texte: "Footing tranquille." })), 50);
});
await test("les conseils ajoutés après la séance ne s'ajoutent pas à sa durée", () => {
  assert.equal(dureeEvenementMin(seance({ type: "Test", texte: `${TEST_VMA}\n\nBois 50 cl dans les 30 min qui suivent.` })), 35);
});
await test("la durée est la MÊME dans les cinq langues : elle se lit sur le français, pas sur la traduction", () => {
  // Relecture du 27/11/2026 : lue sur le texte anglais, cette séance durait 30 min au lieu de 60.
  const fr = "Échauffement 15 min → Corps : 6×1000 m à 3'40/km (récup 2 min) → Retour au calme 10 min";
  const ligne = { title: "Séance au seuil", body: fr, data: { date: "2026-11-28", sessionType: "Seuil", subtitle: fr, tags: [],
    i18n: { en: { title: "Threshold", subtitle: "Warm-up 15 min → Main set: 6×1000 m at 3'40/km (recovery 2 min) → Cool-down 10 min" } } } };
  const s = versSeanceFlux(ligne);
  assert.equal(dureeEvenementMin(s), 60);
  for (const l of LANGUES) assert.equal(prop(evenements(ics([s], l))[0], "DTEND"), "DTEND:20261128T130000", l);
});

console.log("\nLISTE BLANCHE : AUCUN TEXTE DU PLAN NE PART CHEZ APPLE OU GOOGLE");

await test("le titre est le libellé du TYPE, construit — jamais le titre du plan", () => {
  assert.equal(titreEvenement("Endurance", "fr"), "Pacevo · Footing");
  assert.equal(titreEvenement("Endurance", "en"), "Pacevo · Easy run");
  assert.equal(titreEvenement("Type-inconnu", "de"), "Pacevo · Einheit", "un type nouveau ne recopie pas son titre libre");
  const [ev] = evenements(ics([seance({ titre: "Footing encadré par ton kiné" })]));
  assert.equal(prop(ev, "SUMMARY"), "SUMMARY:Pacevo · Footing");
});

await test("chaque type RÉELLEMENT émis par le plan a son libellé, dans les cinq langues", () => {
  // Relecture du 27/11/2026 : la table disait « Marche-course », le plan écrit « Marche/course » —
  // la séance principale des débutants sortait en « Pacevo · Séance ». On lit donc les types
  // dans le code qui les émet, pas dans la table qu'on veut vérifier.
  const emis = new Set<string>();
  for (const f of ["src/lib/ai/autoPlan.ts", "src/lib/ai/coachContext.ts", ...readdirSync("src/lib/coach").filter((x) => x.endsWith(".ts")).map((x) => `src/lib/coach/${x}`)]) {
    for (const m of codeNu(f).matchAll(/\btype: "([^"]+)"/g)) emis.add(m[1]);
  }
  // Vus en base le 27/11/2026, écrits par d'autres chemins (tests VMA, qualité) ; `race_objective` n'est pas une séance.
  for (const t of ["VMA", "Spécifique", "Test"]) emis.add(t);
  emis.delete("race_objective"); emis.delete("Repos");
  assert.ok(emis.has("Marche/course") && emis.has("Endurance"), `lecture des types émis cassée : ${[...emis].join(", ")}`);
  for (const l of LANGUES) for (const t of emis) assert.ok(ICS_T[l].types[t], `${l} : aucun libellé pour « ${t} »`);
  assert.equal(titreEvenement("Marche/course", "fr"), "Pacevo · Marche-course");
});

await test("la description : la durée et le lien, rien d'autre", () => {
  const [ev] = evenements(ics([seance({})]));
  assert.equal(lisible(prop(ev, "DESCRIPTION")!), "DESCRIPTION:Durée prévue : environ 30 min.\n\nLe détail et les allures de la séance : https://pacevo.fr/dashboard/calendrier");
});

await test("AUCUN des textes de santé repérés en relecture n'atteint le calendrier, dans aucune langue", () => {
  // Les cinq fuites trouvées le 27/11/2026 par trois relecteurs, sur un filtre « couper au ⚠️ ».
  const KINE_TITRE = ["Footing encadré par ton kiné", "Run within your physio's limits", "Lauf im Rahmen deiner Physiotherapie", "Rodaje dentro de las indicaciones de tu fisio", "Corrida dentro das indicações do teu fisio"];
  const KINE_RENFO = ["Consigne de ton kiné : aucun saut ni bondissement.", "Your physio's instruction: no jumps or bounds.", "Vorgabe deiner Physiotherapie: keine Sprünge.", "Indicación de tu fisio: ningún salto ni bote.", "Indicação do teu fisio: nenhum salto."];
  LANGUES.forEach((l, i) => {
    const P = PLAN_T[l];
    const fuites = [
      seance({ type: "Récup", titre: KINE_TITRE[i], texte: FOOTING }),
      seance({ date: "2026-11-29", type: "Renfo", titre: `Renfo adapté ${KINE_RENFO[i]}`, texte: `${RENFO} ${KINE_RENFO[i]}${P.renfoDouleur}` }),
      seance({ date: "2026-11-30", type: "Course", titre: "Marathon", texte: P.courseDetailControle }),
      seance({ date: "2026-12-01", type: "Seuil", titre: `Seuil${P.suffixeReprise}`, texte: SEUIL_EN_KM }),
      seance({ date: "2026-12-02", type: "Endurance", titre: `Footing${P.suffixeAllegee}`, texte: FOOTING }),
    ];
    const lu = lisible(ics(fuites, l));
    for (const f of fuites) {
      assert.ok(!lu.includes(f.titre), `${l} : le titre « ${f.titre} » est parti`);
      for (const morceau of f.texte.split(/[.:→]/).map((x) => x.trim()).filter((x) => x.length > 12)) {
        assert.ok(!lu.includes(morceau), `${l} : « ${morceau} » est parti`);
      }
    }
    assert.ok(!/kiné|physio|fisio|poitrine|chest|Brust|pecho|peito|douleur|pain|Schmerz|dolor|\bdor\b|4'48|4'10/i.test(lu), `${l} : un mot de santé ou une allure est parti`);
  });
});

await test("le « pourquoi » et les traductions du plan ne sont même pas lus", () => {
  const s = versSeanceFlux({ title: "Footing", body: "court", data: { date: "2026-11-28", sessionType: "Endurance", subtitle: FOOTING, why: "POURQUOI_SECRET", tags: [], i18n: { en: { title: "TRADUCTION_SECRETE", subtitle: "x", why: "y" } } } });
  assert.ok(!JSON.stringify(s).includes("SECRET"));
});

await test("les jours de repos ne sont pas exportés", () => {
  assert.equal(seanceExportee({ type: "Repos", titre: "Repos complet" }), false);
  assert.equal(seanceExportee({ type: "", titre: "Repos" }), false);
  assert.equal(seanceExportee({ type: "Renfo", titre: "Renforcement musculaire" }), true);
  assert.equal(evenements(ics([seance({ type: "Repos", titre: "Repos", texte: "Repos." }), seance({ date: "2026-11-29" })])).length, 1);
});

await test("la langue du coureur : libellés traduits, français à défaut", () => {
  assert.match(ics([seance({})], "en"), /X-WR-CALNAME:Pacevo · sessions/);
  assert.match(ics([seance({})], "en"), /SUMMARY:Pacevo · Easy run/);
  assert.match(ics([seance({})], "de"), /Geplante Dauer: etwa 30 min/);
});

await test("un même jour et créneau n'apparaît qu'une fois, la dernière séance écrite l'emporte", () => {
  assert.equal(evenements(ics([seance({ type: "Seuil" }), seance({ type: "Endurance" })])).length, 1);
  assert.match(ics([seance({ type: "Seuil" }), seance({ type: "Endurance" })]), /SUMMARY:Pacevo · Footing/);
});

await test("UID stable d'une lecture à l'autre (une séance replanifiée se DÉPLACE), sans l'identifiant du compte", () => {
  const uid = (s: SeanceFlux) => prop(evenements(ics([s]))[0], "UID");
  assert.equal(uid(seance({ type: "Seuil" })), uid(seance({ type: "Endurance", texte: TEST_VMA })), "un changement de séance garde l'événement");
  assert.notEqual(uid(seance({})), uid(seance({ date: "2026-11-29" })));
  assert.notEqual(uid(seance({ moment: "matin" })), uid(seance({ moment: "soir" })));
  assert.ok(!ics([seance({})]).includes("user-123"), "l'identifiant du compte part chez Apple ou Google");
});

console.log("\nUN FORMAT QUE LES AGENDAS LISENT");

await test("CRLF partout, enveloppe VCALENDAR complète", () => {
  const txt = ics([seance({})]);
  assert.ok(txt.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(txt.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(txt), "un saut de ligne sans CR");
  assert.match(txt, /DTSTAMP:20261127T213000Z/);
});

await test("virgules, points-virgules et sauts de ligne échappés", () => {
  assert.equal(plierLigne("x"), "x");
  const [ev] = evenements(ics([seance({})]));
  assert.match(prop(ev, "DESCRIPTION")!, /^DESCRIPTION:Durée prévue : environ 30 min\.\\n\\nLe détail/);
  assert.equal(ICS_T.fr.nom.includes(","), false);
  assert.match(ics([seance({})]), /X-WR-CALDESC:Tes séances Pacevo\\, mises à jour par le coach\./, "la virgule n'est pas échappée");
});

await test("lignes pliées à 75 octets, sans jamais couper un accent ou un emoji", () => {
  // Le portugais et l'espagnol ont les descriptions les plus longues, accentuées.
  for (const l of LANGUES) {
    const txt = ics([seance({ type: "Spécifique" })], l);
    for (const ligne of txt.split("\r\n")) {
      assert.ok(Buffer.byteLength(ligne, "utf8") <= 75, `${l} : ligne de ${Buffer.byteLength(ligne, "utf8")} octets`);
      assert.ok(!ligne.includes("\uFFFD"));
    }
    assert.ok(lisible(txt).includes(ICS_T[l].detail.replace("{url}", "https://pacevo.fr/dashboard/calendrier")), `${l} : le pliage a abîmé le texte`);
  }
  assert.equal(plierLigne("x".repeat(75)), "x".repeat(75));
  assert.equal(plierLigne("x".repeat(76)), `${"x".repeat(75)}\r\n x`);
  const accents = "é".repeat(60);
  const plie = plierLigne(accents);
  for (const ligne of plie.split("\r\n")) assert.ok(Buffer.byteLength(ligne, "utf8") <= 75);
  assert.equal(plie.replace(/\r\n /g, ""), accents, "un « é » coupé en deux");
});

console.log("\nLE JETON");

await test("43 caractères base64url, différents à chaque fois, empreinte ≠ jeton", () => {
  const a = nouveauJeton(), b = nouveauJeton();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.match(empreinteJeton(a), /^[0-9a-f]{64}$/);
  assert.notEqual(empreinteJeton(a), a);
});

await test("le chemin n'est accepté qu'avec la forme exacte du jeton", () => {
  const j = nouveauJeton();
  assert.equal(jetonDuChemin(`${j}.ics`), j);
  assert.equal(jetonDuChemin(j), j);
  for (const faux of ["", "abc.ics", `${j}x.ics`, `${j.slice(1)}.ics`, `${j.slice(0, 42)}'.ics`, "../../etc/passwd", null, undefined]) {
    assert.equal(jetonDuChemin(faux as string), null, String(faux));
  }
});

await test("les liens d'ajout : webcal pour Apple, page d'ajout pour Google", () => {
  const u = adresseFlux("https://pacevo.fr/", "J".repeat(43));
  assert.equal(u.https, `https://pacevo.fr/api/calendrier/flux/${"J".repeat(43)}.ics`);
  assert.equal(u.webcal, `webcal://pacevo.fr/api/calendrier/flux/${"J".repeat(43)}.ics`);
  assert.equal(u.google, `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(u.webcal)}`);
  assert.match(codeNu("src/app/api/calendrier/abonnement/route.ts"), /adresseFlux\(ORIGINE_FLUX, jeton\)/, "l'adresse suit l'hôte de la requête (aperçu, localhost)");
  assert.match(codeNu("src/app/api/calendrier/abonnement/route.ts"), /const ORIGINE_FLUX = "https:\/\/pacevo\.fr";/);
});

console.log("\nLE FLUX : UNE LECTURE RATÉE NE VIDE JAMAIS L'AGENDA");

type Op = { table: string; action: string; filtres: [string, unknown][]; valeur?: unknown };
function faux(repondre: (op: Op) => { data?: unknown; error?: { code?: string; message: string } | null }) {
  const ops: Op[] = [];
  const client = {
    from(table: string) {
      const op: Op = { table, action: "select", filtres: [] };
      ops.push(op);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "order", "limit", "maybeSingle", "single"]) b[m] = () => b;
      for (const m of ["eq", "gte"]) b[m] = (c: string, v: unknown) => { op.filtres.push([c, v]); return b; };
      for (const a of ["insert", "update", "upsert", "delete"]) b[a] = (v?: unknown) => { op.action = a; op.valeur = v; return b; };
      b.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...repondre(op) }).then(ok);
      return b;
    },
  };
  return { client: client as never, ops };
}
const JETON = nouveauJeton();
const ABO = { user_id: "u-1", derniere_lecture: null };
const LIGNES = [
  { title: "Footing en endurance", body: "…", data: { date: "2026-11-28", sessionType: "Endurance", subtitle: FOOTING, why: "SECRET", tags: [] } },
  { title: "Repos", body: "Repos.", data: { date: "2026-11-29", sessionType: "Repos", subtitle: "Repos." } },
];

await test("jeton mal formé : 404, sans même interroger la base", async () => {
  const { client, ops } = faux(() => ({}));
  assert.deepEqual(await lireFlux(client, "abc.ics", MAINTENANT), { statut: 404 });
  assert.equal(ops.length, 0);
});

await test("jeton inconnu ou révoqué : 404, cherché par son EMPREINTE", async () => {
  const { client, ops } = faux(() => ({ data: null }));
  assert.deepEqual(await lireFlux(client, `${JETON}.ics`, MAINTENANT), { statut: 404 });
  assert.deepEqual(ops[0].filtres, [["jeton_empreinte", empreinteJeton(JETON)]]);
  assert.ok(!ops.some((o) => o.table === "notifications"), "aucune séance lue sans abonnement");
});

await test("abonnement illisible : 503 (l'agenda garde ses séances) et l'échec est journalisé", async () => {
  const { client, ops } = faux((op) => op.table === "calendrier_abonnements" ? { error: { code: "57014", message: "timeout" } } : {});
  assert.deepEqual(await lireFlux(client, JETON, MAINTENANT), { statut: 503 });
  assert.ok(ops.some((o) => o.table === "error_logs" && o.action === "insert"));
});

await test("séances illisibles : 503, JAMAIS un calendrier vide servi en 200", async () => {
  const { client, ops } = faux((op) => op.table === "calendrier_abonnements" ? { data: ABO }
    : op.table === "notifications" ? { error: { code: "57014", message: "timeout" } } : { data: { preferred_language: "fr" } });
  assert.deepEqual(await lireFlux(client, JETON, MAINTENANT), { statut: 503 });
  assert.ok(ops.some((o) => o.table === "error_logs" && o.action === "insert"));
});

await test("abonnement valide : les séances DU coureur, sans le repos ni le pourquoi, et la lecture datée", async () => {
  const { client, ops } = faux((op) => op.table === "calendrier_abonnements" && op.action === "select" ? { data: ABO }
    : op.table === "notifications" ? { data: LIGNES } : op.table === "profiles" ? { data: { preferred_language: "fr" } } : {});
  const r = await lireFlux(client, `${JETON}.ics`, MAINTENANT);
  assert.equal(r.statut, 200);
  if (r.statut !== 200) return;
  assert.equal(evenements(r.ics).length, 1);
  assert.ok(!r.ics.includes("SECRET"));
  const lecture = ops.find((o) => o.table === "notifications")!;
  assert.deepEqual(lecture.filtres.slice(0, 2), [["user_id", "u-1"], ["type", "coach_session"]], "les séances d'un autre coureur");
  assert.deepEqual(lecture.filtres[2], ["data->>date", "2026-09-28"], "60 jours d'historique");
  const maj = ops.find((o) => o.table === "calendrier_abonnements" && o.action === "update");
  assert.deepEqual(maj?.valeur, { derniere_lecture: MAINTENANT.toISOString() });
  assert.deepEqual(maj?.filtres, [["user_id", "u-1"]]);
});

await test("doublon d'un jour : la séance écrite en DERNIER l'emporte (la base les rend des plus récentes aux plus anciennes)", async () => {
  // `order(created_at, desc)` + `limit` : une borne coupe l'ancien, jamais le plan à venir.
  const recente = { title: "Footing", body: "", data: { date: "2026-11-28", sessionType: "Endurance", subtitle: FOOTING } };
  const ancienne = { title: "Seuil", body: "", data: { date: "2026-11-28", sessionType: "Seuil", subtitle: SEUIL_EN_KM } };
  const { client, ops } = faux((op) => op.table === "calendrier_abonnements" && op.action === "select" ? { data: ABO }
    : op.table === "notifications" ? { data: [recente, ancienne] } : { data: null });
  const r = await lireFlux(client, JETON, MAINTENANT);
  assert.equal(r.statut, 200);
  if (r.statut === 200) assert.match(r.ics, /SUMMARY:Pacevo · Footing/, "l'ancienne version du jour a gagné");
  assert.ok(ops.some((o) => o.table === "notifications"));
  assert.match(codeNu("src/lib/calendrier/flux.ts"), /\.order\("created_at", \{ ascending: false \}\)\.limit\(500\)/);
});

await test("la dernière lecture s'écrit au plus une fois par heure", async () => {
  const { client, ops } = faux((op) => op.table === "calendrier_abonnements" && op.action === "select" ? { data: { user_id: "u-1", derniere_lecture: "2026-11-27T21:00:00Z" } }
    : op.table === "notifications" ? { data: LIGNES } : { data: null });
  assert.equal((await lireFlux(client, JETON, MAINTENANT)).statut, 200);
  assert.ok(!ops.some((o) => o.action === "update"));
});

console.log("\nLES ROUTES ET LA TABLE");

await test("la route du flux renvoie le statut de `lireFlux` (503 avec Retry-After), en text/calendar non indexé", () => {
  const src = codeNu("src/app/api/calendrier/flux/[jeton]/route.ts");
  assert.match(src, /lireFlux\(createAdminClient\(\), jeton, new Date\(\)\)/);
  assert.match(src, /status: r\.statut/);
  assert.match(src, /"Retry-After": "900"/);
  assert.match(src, /"Content-Type": "text\/calendar; charset=utf-8"/);
  assert.match(src, /"X-Robots-Tag": "noindex/);
  assert.match(src, /"Cache-Control": "private, no-store"/);
});

await test("la gestion n'agit que sur le compte de la SESSION, et lit chaque erreur", () => {
  const src = codeNu("src/app/api/calendrier/abonnement/route.ts");
  for (const m of ["GET", "POST", "DELETE"]) {
    const corps = src.split(`export async function ${m}`)[1]?.split("export async function")[0] ?? "";
    assert.match(corps, /const user = await utilisateur\(\);\s*if \(!user\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);/, `${m} sans garde`);
    assert.ok(/\{[^}]*\berror\b[^}]*\} = await/.test(corps) && /if \(error/.test(corps), `${m} ne lit pas l'erreur de la base`);
  }
  assert.match(src, /\.eq\("user_id", user\.id\)\.maybeSingle\(\)/);
  assert.match(src, /\{ user_id: user\.id, jeton_empreinte: empreinteJeton\(jeton\)/, "le jeton en clair serait écrit en base");
  assert.match(src, /\.delete\(\)\.eq\("user_id", user\.id\)/);
  assert.ok(!/jeton_empreinte: jeton\b/.test(src));
});

await test("la migration : empreinte seule, RLS sans politique, suppression avec le compte", () => {
  const sql = readFileSync("supabase/migrations/042_calendrier_abonnements.sql", "utf8").replace(/--.*$/gm, "");
  assert.match(sql, /user_id\s+uuid\s+primary key references public\.profiles\(id\) on delete cascade/);
  assert.match(sql, /jeton_empreinte\s+text\s+not null unique/);
  assert.match(sql, /alter table public\.calendrier_abonnements enable row level security/);
  assert.ok(!/create policy/i.test(sql), "une politique ouvrirait la table au navigateur");
  assert.ok(!/\bjeton\s+text/.test(sql), "le jeton en clair n'a rien à faire en base");
});

await test("l'encart est dans Paramètres → Connexions, et la politique de confidentialité nomme l'agenda (5 langues)", () => {
  assert.match(codeNu("src/components/settings/SettingsView.tsx"), /<AbonnementCalendrier lang=\{lang\} \/>/);
  const legal = readFileSync("src/app/legalI18n.ts", "utf8");
  for (const mot of ["Ton agenda (Apple", "Your calendar (Apple", "Dein Kalender (Apple", "Tu calendario (Apple", "O teu calendário (Apple"]) assert.ok(legal.includes(mot), mot);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
})();
