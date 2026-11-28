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
import { nouveauJeton, empreinteJeton, jetonDuChemin, adresseFlux, jetonDe, jetonRetrouve } from "../src/lib/calendrier/jeton";
import { lireFlux, versSeanceFlux } from "../src/lib/calendrier/flux";
import { lienDuCompte } from "../src/lib/calendrier/abonnement";
import { ouvertureNavigateur, reponseNavigateur } from "../src/lib/calendrier/navigateur";
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

await test("le jeton DÉRIVÉ se recalcule à l'identique, et change avec le compte, la date ou la clé", () => {
  // 28/11/2026 : réaffichable pour que les boutons marchent à chaque visite, sur chaque appareil.
  const U = "7c0d5d1e-0000-4000-8000-000000000001", V = "7c0d5d1e-0000-4000-8000-000000000002", M = "cle-de-test";
  const a = jetonDe(U, "2026-11-28T08:26:26.146Z", M);
  assert.equal(jetonDuChemin(`${a}.ics`), a, "pas la forme d'un jeton de flux");
  // La base rend la date sous une autre écriture (PostgREST) : le même instant, le même jeton.
  assert.equal(jetonDe(U, "2026-11-28T08:26:26.146+00:00", M), a);
  assert.equal(jetonDe(U, "2026-11-28T08:26:26.146000+00:00", M), a, "microsecondes PostgREST");
  assert.equal(jetonDe(U, "2026-11-28T08:26:26+00:00", M), jetonDe(U, "2026-11-28T08:26:26.000Z", M), "milliseconde nulle");
  assert.notEqual(jetonDe(V, "2026-11-28T08:26:26.146Z", M), a, "deux comptes, un même lien");
  assert.notEqual(jetonDe(U, "2026-11-28T08:26:26.147Z", M), a, "changer de lien ne changerait rien");
  assert.notEqual(jetonDe(U, "2026-11-28T08:26:26.146Z", "autre-cle"), a, "la clé du serveur ne compte pas");
  assert.ok(!a.includes(U.slice(0, 8)));
  assert.throws(() => jetonDe(U, "2026-11-28T08:26:26.146Z", ""), /clé du serveur absente/);
  assert.throws(() => jetonDe(U, "pas une date", M), /illisible/);
  assert.throws(() => jetonDe("", "2026-11-28T08:26:26.146Z", M), /illisible/);
});

await test("le lien se retrouve depuis la ligne en base ; un lien tiré au hasard (avant le 28/11) ne se retrouve pas", () => {
  const U = "7c0d5d1e-0000-4000-8000-000000000001", M = "cle-de-test", quand = "2026-11-28T08:26:26.146+00:00";
  const j = jetonDe(U, quand, M);
  assert.equal(jetonRetrouve(U, { cree_le: quand, jeton_empreinte: empreinteJeton(j) }, M), j);
  assert.equal(jetonRetrouve(U, { cree_le: quand, jeton_empreinte: empreinteJeton(nouveauJeton()) }, M), null);
  assert.equal(jetonRetrouve("7c0d5d1e-0000-4000-8000-000000000002", { cree_le: quand, jeton_empreinte: empreinteJeton(j) }, M), null, "le lien d'un autre compte");
  assert.equal(jetonRetrouve(U, { cree_le: null, jeton_empreinte: empreinteJeton(j) }, M), null);
});

await test("les liens d'ajout : webcal pour Apple, page d'ajout pour Google", () => {
  const u = adresseFlux("https://pacevo.fr/", "J".repeat(43));
  assert.equal(u.https, `https://pacevo.fr/api/calendrier/flux/${"J".repeat(43)}.ics`);
  assert.equal(u.webcal, `webcal://pacevo.fr/api/calendrier/flux/${"J".repeat(43)}.ics`);
  assert.equal(u.google, `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(u.webcal)}`);
  assert.match(codeNu("src/app/api/calendrier/abonnement/route.ts"), /adresseFlux\(ORIGINE_FLUX, jeton\)/, "l'adresse suit l'hôte de la requête (aperçu, localhost)");
  assert.match(codeNu("src/lib/calendrier/abonnement.ts"), /export const ORIGINE_FLUX = "https:\/\/pacevo\.fr";/);
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
    if (m !== "POST") assert.ok(/\{[^}]*\berror\b[^}]*\} = await/.test(corps) && /if \(error/.test(corps), `${m} ne lit pas l'erreur de la base`);
  }
  // POST : la logique (testée plus haut contre une fausse base) sur le compte de la session ; son échec journalisé ;
  // un lien introuvable répond 409 au lieu d'être écrasé.
  const post = src.split("export async function POST")[1].split("export async function")[0];
  assert.match(post, /const remplacer = corps\?\.remplacer === true;/, "« remplacer » doit être explicite, jamais par défaut");
  assert.match(post, /const r = await lienDuCompte\(admin, user\.id, \{ remplacer \}\);/);
  assert.match(post, /if \(r\.k === "ancien"\) return NextResponse\.json\(\{ ancien: true \}, \{ status: 409 \}\);/);
  assert.match(post, /await journaliserEchec\(admin, \{ source: "calendrier", userId: user\.id, url: URL_ROUTE, message: r\.message \}\);/);
  assert.match(src, /\.eq\("user_id", user\.id\)\.maybeSingle\(\)/);
  const lib = codeNu("src/lib/calendrier/abonnement.ts");
  assert.match(lib, /\{ user_id: userId, jeton_empreinte: empreinteJeton\(jeton\)/, "le jeton en clair serait écrit en base");
  assert.ok(!/jeton_empreinte: jeton\b/.test(lib));
  assert.ok(!/\.upsert\(/.test(lib.split("if (opts.remplacer)")[1].split("const lu = await lire()")[1]), "création par upsert : deux appuis simultanés s'écraseraient");
  assert.match(src, /\.delete\(\)\.eq\("user_id", user\.id\)/);
  assert.ok(!/jeton_empreinte: jeton\b/.test(src));
});

console.log("\nLE LIEN DU COMPTE : UN APPUI NE COUPE JAMAIS UN AGENDA DÉJÀ RELIÉ");

/** Fausse table `calendrier_abonnements` qui garde ses lignes : insert refuse un doublon (23505) comme Postgres. */
function fausseTable(opts: { erreurLecture?: { code?: string; message: string }; erreurEcriture?: { code?: string; message: string } } = {}) {
  const lignes = new Map<string, Record<string, unknown>>();
  const ecritures: string[] = [];
  const client = {
    from() {
      let action = "select", valeur: Record<string, unknown> | undefined, id: unknown;
      const b: Record<string, unknown> = {};
      b.select = () => b; b.maybeSingle = () => b;
      b.eq = (_c: string, v: unknown) => { id = v; return b; };
      for (const a of ["insert", "upsert"]) b[a] = (v: Record<string, unknown>) => { action = a; valeur = v; return b; };
      b.then = (ok: (r: unknown) => unknown) => Promise.resolve().then(() => {
        if (action === "select") {
          if (opts.erreurLecture) return { data: null, error: opts.erreurLecture };
          const l = lignes.get(String(id));
          // La base rend la date à la façon de PostgREST (« +00:00 », microsecondes).
          return { data: l ? { cree_le: String(l.cree_le).replace("Z", "000+00:00"), jeton_empreinte: l.jeton_empreinte } : null, error: null };
        }
        ecritures.push(action);
        if (opts.erreurEcriture) return { data: null, error: opts.erreurEcriture };
        const cle = String(valeur!.user_id);
        if (action === "insert" && lignes.has(cle)) return { data: null, error: { code: "23505", message: "duplicate key" } };
        lignes.set(cle, { ...valeur });
        return { data: null, error: null };
      }).then(ok);
      return b;
    },
  };
  return { client: client as never, lignes, ecritures };
}
const UL = "7c0d5d1e-0000-4000-8000-0000000000aa", ML = "cle-de-test";
const T1 = new Date("2026-11-28T08:26:26.146Z"), T2 = new Date("2026-11-28T08:26:26.900Z");

await test("premier appui : le lien est créé ; second appui (autre appareil) : le MÊME, sans rien écrire", async () => {
  const f = fausseTable();
  const a = await lienDuCompte(f.client, UL, { maintenant: T1, maitre: ML });
  assert.equal(a.k, "liens");
  const b = await lienDuCompte(f.client, UL, { maintenant: T2, maitre: ML });
  assert.deepEqual(b, a, "le second appui a coupé le premier lien");
  assert.deepEqual(f.ecritures, ["insert"]);
  const l = f.lignes.get(UL)!;
  assert.ok(a.k === "liens" && !String(l.jeton_empreinte).includes(a.liens.https.split("/flux/")[1].slice(0, 43)), "le jeton en clair en base");
});

await test("deux appuis SIMULTANÉS (ordinateur et téléphone) : un seul lien, rendu aux deux", async () => {
  const f = fausseTable();
  const [a, b] = await Promise.all([
    lienDuCompte(f.client, UL, { maintenant: T1, maitre: ML }),
    lienDuCompte(f.client, UL, { maintenant: T2, maitre: ML }),
  ]);
  assert.equal(a.k, "liens");
  assert.deepEqual(b, a, "le second a écrasé le premier : un agenda reste sur un lien mort");
  assert.equal(f.lignes.size, 1);
});

await test("un lien qui ne se retrouve pas (avant le 28/11, autre clé) n'est JAMAIS écrasé sans « remplacer »", async () => {
  const f = fausseTable();
  f.lignes.set(UL, { user_id: UL, cree_le: "2026-11-27T23:00:00.000Z", jeton_empreinte: empreinteJeton(nouveauJeton()) });
  assert.deepEqual(await lienDuCompte(f.client, UL, { maintenant: T1, maitre: ML }), { k: "ancien" });
  assert.deepEqual(f.ecritures, []);
  const r = await lienDuCompte(f.client, UL, { remplacer: true, maintenant: T1, maitre: ML });
  assert.equal(r.k, "liens");
  assert.deepEqual(f.ecritures, ["upsert"]);
  assert.deepEqual(await lienDuCompte(f.client, UL, { maintenant: T2, maitre: ML }), r, "le lien remplacé ne se retrouve pas");
});

await test("« Changer de lien » coupe l'ancien : le nouveau diffère", async () => {
  const f = fausseTable();
  const a = await lienDuCompte(f.client, UL, { maintenant: T1, maitre: ML });
  const b = await lienDuCompte(f.client, UL, { remplacer: true, maintenant: T2, maitre: ML });
  assert.ok(a.k === "liens" && b.k === "liens" && a.liens.https !== b.liens.https);
});

await test("base illisible : erreur, et RIEN d'écrit (créer pourrait couper un agenda relié) ; table absente : indisponible", async () => {
  const f = fausseTable({ erreurLecture: { code: "57014", message: "timeout" } });
  const r = await lienDuCompte(f.client, UL, { maintenant: T1, maitre: ML });
  assert.equal(r.k, "erreur");
  assert.deepEqual(f.ecritures, []);
  assert.deepEqual(await lienDuCompte(fausseTable({ erreurLecture: { code: "PGRST205", message: "absente" } }).client, UL, { maitre: ML }), { k: "indisponible" });
  const e = await lienDuCompte(fausseTable({ erreurEcriture: { code: "42501", message: "refus" } }).client, UL, { maintenant: T1, maitre: ML });
  assert.ok(e.k === "erreur" && /42501/.test(e.message), "l'échec d'écriture n'est pas rapporté");
  assert.equal((await lienDuCompte(fausseTable().client, UL, { maintenant: T1, maitre: "" })).k, "erreur", "sans clé, un lien quand même");
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

await test("l'encart tient en deux gros boutons, celui de l'appareil d'abord, l'aide repliée (5 langues)", () => {
  // Règle de Cyprien (28/11/2026) : « des parents qui n'y connaissent rien doivent savoir le faire ».
  const src = codeNu("src/components/settings/AbonnementCalendrier.tsx");
  const blocs = [...src.matchAll(/\n  (fr|en|de|es|pt): \{\n([\s\S]*?)\n  \},(?=\n)/g)];
  assert.equal(blocs.length, 5);
  const cles = (b: string) => [...b.matchAll(/\b(\w+): "/g)].map((m) => m[1]).sort().join(",");
  for (const [, lang, b] of blocs) {
    assert.equal(cles(b), cles(blocs[0][2]), `${lang} : clés différentes du français`);
    assert.match(b, /\bgoogleTel: "[^"]*☰[^"]*Pacevo · [^"]*Android/, `${lang} : où cocher le calendrier dans l'appli Google`);
  }
  // Plus rien à comprendre sur « un lien affiché une seule fois » : le lien se retrouve à chaque visite.
  assert.ok(!/\b(unique|perdu|nouveauLien): "/.test(src), "le texte « lien affiché une fois » est revenu");
  // Deux gros boutons, chacun rendu une fois, l'ordre selon l'appareil.
  assert.match(src, /appleDabord \? \[bouton\("webcal", true\), bouton\("google", false\), boutonOutlook\(\)\]/);
  // Tant qu'il n'y a pas de lien : un vrai <button> (lecteur d'écran, barre d'espace), jamais un <a href="#">.
  assert.ok(!/href=\{[^}]*\?\? "#"\}/.test(src), "lien vide href=\"#\"");
  assert.match(src, /return liens\s*\? <a key=\{cible\} href=\{liens\[cible\]\}[^\n]*\n\s*: <button key=\{cible\} type="button" onClick=\{\(\) => ajouter\(cible\)\} disabled=\{occupe\}/);
  assert.match(src, /setAppareil\(\/iPhone\|iPad\|Macintosh\/\.test\(ua\) \? "apple" : \/Android\/\.test\(ua\) \? "android" : "autre"\)/);
  assert.match(src, /const appleDabord = appareil === "apple";/);
  // Un bouton sans lien encore créé le crée, puis y va (un seul appui) ; « Copier le lien » reste discret.
  assert.match(src, /const liens = await obtenir\(ancien\);\s*setEnCours\(null\);[\s\S]{0,200}?if \(!liens \|\| ancien\) return;\s*window\.location\.assign\(liens\[cible\]\);/);
  // « Copier le lien » discret (autres agendas), après « Un autre agenda ? » ; le guide Outlook a le sien.
  assert.match(src, /\{t\("autres"\)\}\{" "\}\s*<button onClick=\{copier\}[^>]*><Copy className="h-3 w-3" \/> \{t\("copier"\)\}<\/button>/);
  // L'aide (délais, appli Google, Outlook) est repliée.
  const aide = src.slice(src.indexOf("<details"), src.indexOf("</details>"));
  for (const k of ["delai", "googleTel", "iphone", "ordiConfirme"]) assert.ok(aide.includes(`{t("${k}")}`), `${k} hors de l'aide repliée`);
  // Chacun ne lit que ce qui concerne son appareil ; sur Android, la parade « depuis un ordinateur » est VISIBLE.
  assert.match(aide, /\{appareil !== "autre" && <li>\{t\("googleTel"\)\}<\/li>\}/);
  assert.match(aide, /\{appareil === "apple" && <li>\{t\("iphone"\)\}<\/li>\}/);
  assert.match(aide, /\{appareil === "autre" && <li>\{t\("ordiConfirme"\)\}<\/li>\}/);
  assert.ok(!aide.includes('t("googleOrdi")'));
  assert.match(src, /\{appareil === "android" && <p className="text-sm text-zinc-600">\{t\("googleOrdi"\)\}<\/p>\}/);
  // « Changer de lien » et « Arrêter » : seulement quand un lien existe, et après confirmation.
  const fin = src.slice(src.indexOf("{etat.actif && (\n"));
  assert.ok(fin.includes('{t("changer")}') && fin.includes('{t("arreter")}'));
  assert.match(src, /if \(!window\.confirm\(t\("confirmeChanger"\)\)\) return;/);
  assert.match(src, /obtenir\(true\)/);
  // État « ancien » : rien ne remplace le lien sans confirmation ; « Copier le lien » est masqué et ne crée rien.
  assert.match(src, /async function copier\(\) \{\s*if \(etat\.k === "pret" && etat\.actif && !etat\.liens\) return;/);
  assert.match(src, /\{!\(etat\.actif && !liens\) && <p className="text-sm text-zinc-500">\s*\{t\("autres"\)\}/);
  assert.match(src, /if \(ancien && !window\.confirm\(t\("confirmeAncien"\)\)\) return;\s*setEnCours\(cible\);\s*const liens = await obtenir\(ancien\);/);
  // Après un remplacement, le rappel « supprime l'ancien calendrier » RESTE à l'écran (un toast s'effaçait
  // en quittant la page), y compris à la relecture au retour de l'agenda.
  assert.match(src, /liens: j\.liens, rappel: remplacer \}\);/);
  assert.match(src, /rappel: e\.k === "pret" && !!e\.rappel && !!j\.liens/);
  assert.match(src, /\{etat\.rappel && <p role="status"[^>]*>\{t\("rappel"\)\}<\/p>\}/);
  assert.ok(!/toast[^;]*t\("(renouvele|change)"\)/.test(src));
  // Retour de l'app Calendrier : une relecture ratée garde les boutons ; une relecture partie avant une
  // action (Arrêter, Changer, créer) et revenue après est ignorée (relecture du second tour, 28/11).
  assert.match(src, /setEtat\(\(e\) => \(e\.k === "pret" \? e : \{ k: "illisible" \}\)\)/);
  assert.ok(!/setEtat\(\{ k: "illisible" \}\)/.test(src), "une relecture ratée effacerait les boutons");
  assert.match(src, /const j = await r\.json\(\);\s*if \(g !== generation\.current\) return;/);
  for (const f of ["obtenir", "arreter"]) {
    const corps = src.split(`async function ${f}(`)[1].split("\n  }\n")[0];
    assert.match(corps, /generation\.current\+\+;/, `${f} n'invalide pas les relectures en vol`);
  }
});

console.log("\nLE LIEN OUVERT DANS UN NAVIGATEUR : L'ABONNEMENT, JAMAIS UNE COPIE FIGÉE");

const NAV = (ua: string) => new Headers({ "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "user-agent": ua });
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const deps = (existe: boolean | null, connecte: boolean) => {
  const appels: string[] = [];
  return { appels, d: { existe: async (j: string) => { appels.push(`existe:${j}`); return existe; }, connecte: async () => { appels.push("connecte"); return connecte; } } };
};

await test("ouvert dans Safari ou Chrome sur iPhone, iPad, Mac : l'abonnement webcal, pas le fichier", async () => {
  // 28/11/2026 : le lien collé dans Safari a importé une copie figée dans « Travail » (chaque séance en double).
  const j = nouveauJeton();
  for (const ua of [UA_IPHONE,
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  ]) {
    const r = await reponseNavigateur(NAV(ua), `${j}.ics`, deps(true, false).d);
    assert.equal(r?.status, 302, ua);
    assert.equal(r?.headers.get("location"), `webcal://pacevo.fr/api/calendrier/flux/${j}.ics`, ua);
    assert.equal(r?.headers.get("cache-control"), "private, no-store");
    assert.match(r?.headers.get("x-robots-tag") ?? "", /noindex/);
  }
  assert.equal(ouvertureNavigateur(new Headers({ "sec-fetch-mode": "navigate", "user-agent": "Mozilla/5.0 (iPhone)" }), `${j}.ics`)?.apple, true, "le seul mode « navigate » compte aussi");
});

await test("lien révoqué ouvert sur iPhone : 404, jamais un abonnement à un flux mort ; base illisible : 503", async () => {
  const j = nouveauJeton();
  const mort = await reponseNavigateur(NAV(UA_IPHONE), `${j}.ics`, deps(false, true).d);
  assert.equal(mort?.status, 404);
  assert.equal(mort?.headers.get("location"), null);
  const panne = await reponseNavigateur(NAV(UA_IPHONE), `${j}.ics`, deps(null, true).d);
  assert.equal(panne?.status, 503);
  assert.equal(panne?.headers.get("retry-after"), "900");
});

await test("Android, Windows : la page des boutons, par la connexion d'abord si ce navigateur n'est pas connecté", async () => {
  const j = nouveauJeton();
  const connecte = await reponseNavigateur(NAV(UA_ANDROID), `${j}.ics`, deps(true, true).d);
  assert.equal(connecte?.status, 302);
  assert.equal(connecte?.headers.get("location"), "https://pacevo.fr/dashboard/settings?onglet=connexions&agenda=lien");
  const anonyme = await reponseNavigateur(NAV("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0"), `${j}.ics`, deps(true, false).d);
  assert.equal(anonyme?.headers.get("location"), `https://pacevo.fr/login?next=${encodeURIComponent("/dashboard/settings?onglet=connexions&agenda=lien")}`);
  // Sans agent utilisateur : pas d'Apple supposé.
  assert.equal(ouvertureNavigateur(new Headers({ "sec-fetch-dest": "document" }), `${j}.ics`)?.apple, false);
});

await test("les agendas eux-mêmes (Apple, Google, Outlook) et les jetons mal formés ne sont pas détournés, ni la base lue", async () => {
  const j = nouveauJeton();
  const agendas: Record<string, string>[] = [
    { "user-agent": "macOS/15.1 (24B83) CalendarAgent/1000" },
    { "user-agent": "iOS/18.1 (22B83) dataaccessd/1.0" },
    { "user-agent": "Google-Calendar-Importer" },
    { "user-agent": "Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.17928; Pro)" },
    { "sec-fetch-dest": "empty", "sec-fetch-mode": "cors", "user-agent": "Mozilla/5.0 (iPhone)" },
  ];
  for (const h of agendas) {
    const { appels, d } = deps(true, true);
    assert.equal(await reponseNavigateur(new Headers(h), `${j}.ics`, d), null, JSON.stringify(h));
    assert.deepEqual(appels, []);
  }
  assert.equal(await reponseNavigateur(NAV(UA_IPHONE), "abc.ics", deps(true, true).d), null, "jeton mal formé : le 404 habituel");
});

await test("la route passe par `reponseNavigateur` AVANT de construire le calendrier", () => {
  const src = codeNu("src/app/api/calendrier/flux/[jeton]/route.ts");
  const i = src.indexOf("const navigateur = await reponseNavigateur(req.headers, jeton, {");
  assert.ok(i > 0 && i < src.indexOf("lireFlux(createAdminClient()"), "le fichier serait servi au navigateur");
  assert.match(src, /if \(navigateur\) return navigateur;/);
  assert.match(src, /\.eq\("jeton_empreinte", empreinteJeton\(j\)\)\.maybeSingle\(\);\s*return error \? null : !!data;/, "une base illisible prise pour « lien révoqué »");
});

await test("l'encart dit pourquoi on y arrive depuis le lien, (5 langues)", () => {
  const src = codeNu("src/components/settings/AbonnementCalendrier.tsx");
  assert.match(src, /get\("agenda"\) === "lien"\) \{\s*setDepuisLien\(true\);/);
  assert.match(src, /\{depuisLien && <p role="status"[^>]*>\{t\("depuisLien"\)\}<\/p>\}/);
});

await test("Outlook : un gros bouton qui copie, ouvre Outlook et guide en 3 étapes (5 langues)", () => {
  // 28/11/2026 : devant Outlook avec un lien copié, Cyprien « ne savait pas quoi faire avec le lien ».
  const src = codeNu("src/components/settings/AbonnementCalendrier.tsx");
  assert.match(src, /const OUTLOOK = "https:\/\/outlook\.live\.com\/calendar\/";/);
  // Le bouton existe à côté des deux autres, et ouvre le guide.
  assert.match(src, /const boutonOutlook = \(\) => \(\s*<button key="outlook" type="button" onClick=\{ouvrirGuideOutlook\}[\s\S]*?\{t\("outlookBouton"\)\}/);
  // Apple : Apple, Google, Outlook ; ailleurs (PC, Android) : Google, Outlook, puis Apple.
  assert.match(src, /appleDabord \? \[bouton\("webcal", true\), bouton\("google", false\), boutonOutlook\(\)\] : \[bouton\("google", true\), boutonOutlook\(\), bouton\("webcal", false\)\]/);
  // Lien connu : copie ET ouverture d'Outlook dans le même geste (après un await, le navigateur bloquerait l'onglet).
  const f = src.split("async function ouvrirGuideOutlook()")[1].split("\n  }\n")[0];
  assert.match(f, /if \(etat\.liens && !ancien\) \{\s*setGuide\(true\);\s*void copierLien\(etat\.liens\.https, false\);[\s\S]{0,160}?if \(!mobile\) window\.open\(OUTLOOK, "_blank", "noopener"\);\s*return;\s*\}/);
  assert.ok(f.indexOf("window.open") < f.indexOf("await"), "l'onglet Outlook s'ouvrirait après un await : bloqué");
  // Lien « ancien » : jamais remplacé sans confirmation, comme les autres boutons.
  assert.match(f, /if \(ancien && !window\.confirm\(t\("confirmeAncien"\)\)\) return;/);
  // Le guide : 1 copier, 2 ouvrir Outlook (et le compte pro), 3 la marche à suivre.
  const g = src.slice(src.indexOf("{guide && liens && ("), src.indexOf("{etat.rappel &&"));
  for (const k of ["guideTitre", "etape1", "etape2", "ouvrirOutlook", "pro", "proLien", "etape3", "outlookClassique"]) assert.ok(g.includes(`{t("${k}")}`), `${k} absent du guide`);
  assert.match(g, /onClick=\{\(\) => copierLien\(liens\.https, true\)\}/);
  assert.match(g, /\{copie \? t\("copie"\) : t\("copier"\)\}/, "l'étape 1 ne dit pas que c'est fait");
  assert.match(g, /href=\{OUTLOOK\} target="_blank"/);
  assert.match(g, /href=\{OUTLOOK_PRO\} target="_blank"/);
  // Téléphone : Outlook n'y ajoute pas de calendrier ; on le dit EN TÊTE du guide, sans bouton « Ouvrir Outlook ».
  assert.ok(g.indexOf('{t("outlookTel")}') > 0 && g.indexOf('{t("outlookTel")}') < g.indexOf('{t("guideTitre")}</p>'), "consigne téléphone pas en tête");
  assert.match(g, /\{mobile && <p[^>]*>\{t\("outlookTel"\)\}<\/p>\}/);
  assert.match(g, /\{!mobile && <a href=\{OUTLOOK\}/);
  assert.match(g, /id="guide-outlook" role="region" aria-label=\{t\("guideTitre"\)\}/);
  // Coller dans Outlook, pas dans la barre d'adresse (sinon la copie figée du 28/11), et les libellés de Microsoft.
  for (const [mot, lang] of [["« S'abonner à partir du web »", "fr"], ["“Subscribe from web”", "en"], ["„Aus dem Web abonnieren“", "de"], ["«Suscribirse desde la web»", "es"], ["«Subscrever a partir da Web»", "pt"],
    ["pas dans la barre d'adresse", "fr"], ["not into the browser's address bar", "en"], ["nicht in die Adresszeile", "de"], ["no en la barra de direcciones", "es"], ["não na barra de endereço", "pt"]])
    assert.ok(src.includes(mot), `${lang} : ${mot}`);
  // 28/11 : le bouton a ouvert la page d'accueil de Microsoft (navigateur non connecté) : l'étape 2 le prévient.
  for (const mot of ["S'il te demande de te connecter", "If it asks you to sign in", "Wenn er dich zur Anmeldung auffordert", "Si te pide iniciar sesión", "Se te pedir para iniciar sessão"]) assert.ok(src.includes(mot), mot);
  // Arrêter l'envoi referme le guide.
  assert.match(src, /rappel: false \}\);\s*setGuide\(false\);/);
  // Lien remplacé (« Changer de lien », ancien lien) : l'étape 1 ne dit plus « Lien copié » (le presse-papiers a l'ancien, mort).
  assert.match(src, /rappel: remplacer \}\);\s*(\/\/[^\n]*\n\s*)?if \(remplacer\) setCopie\(false\);/);
  // Sans lien (échec, 409 « ancien »), le guide ne s'ouvre pas, ni plus tard en secret.
  assert.match(f, /setGuide\(false\);\s*setEnCours\("outlook"\);\s*const l = await obtenir\(ancien\);\s*setEnCours\(null\);\s*setGuide\(!!l\);/);
  assert.ok(f.indexOf("setGuide(true)") > f.indexOf("if (etat.liens && !ancien)"), "guide armé avant de savoir s'il y aura un lien");
  // Copie automatique ratée : on le dit (sinon on colle un presse-papiers vide dans Outlook).
  assert.match(src, /else toast\.error\(t\("copieRatee"\)\);/);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
})();
