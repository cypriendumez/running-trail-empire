/**
 * LE TABLEAU DE BORD DIT CE QUI EST VRAI, ET NE SE MASQUE PAS LUI-MÊME (05/11/2026).
 *
 * Relu sur le compte de Cyprien (J+11 du marathon de Lille, plus de VFC depuis le 30/10) :
 *  · « 189 bpm — Fréquence cardiaque » dans la carte VFC : la FC MOYENNE du marathon,
 *    reprise faute de FC de repos, lue comme une donnée du jour ;
 *  · « Connecte ta montre » en tête, alors qu'elle est reliée et qu'une récupération
 *    était en cours (la seule consigne qui valait ce jour-là) ;
 *  · l'âge de la VFC calculé sur l'horloge de la machine : rendu serveur (UTC) et
 *    navigateur (Paris) différaient entre minuit et 1 h → erreur React #418 ;
 *  · la pastille « Détails » posée sur le contenu de cinq cartes.
 * Crash-test des calculs : une VFC datée dans le futur passait pour « fraîche », un
 * score de sommeil NaN pour de la fatigue.
 *
 *   npx tsx tests/tableau-de-bord-coherence.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { statsVfc, etatDuJour, etatPhysiologique, computeDiscipline } from "../src/lib/dashboard/discipline";
import { computeForme } from "../src/lib/dashboard/forme";
import { T } from "../src/lib/i18n/translations";
import { computeStreak } from "../src/lib/streak/compute";
import { PLAN_T } from "../src/lib/ai/planI18n";
import { validerConseils, appliquerConseils, inviteRelecture } from "../src/lib/ai/relectureSemaine";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
/** Le source sans ses commentaires — sans couper les `://` des adresses. */
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const BENTO = codeNu("src/components/dashboard/BentoDashboard.tsx");

console.log("\nÂGE DE LA VFC : LE JOUR DE L'ATHLÈTE, PAS L'HORLOGE DE LA MACHINE");

test("même jour civil, même âge, quelle que soit l'heure de la machine", () => {
  const hrv = [{ date: "2026-10-30", hrv_ms: 87 }];
  // 23 h 30 UTC le 05/11 (serveur) = 00 h 30 le 06/11 à Paris (navigateur) : le jour
  // de l'athlète est le 06/11 des deux côtés, l'âge doit l'être aussi.
  const serveur = statsVfc(hrv, Date.parse("2026-11-05T23:30:00Z"), "2026-11-06");
  const navigateur = statsVfc(hrv, Date.parse("2026-11-05T23:30:00Z") + 3_600_000, "2026-11-06");
  assert.equal(serveur.jours, 7);
  assert.equal(navigateur.jours, serveur.jours);
});

test("le tableau de bord passe son jour à statsVfc et à etatPhysiologique", () => {
  assert.match(BENTO, /statsVfc\(hrv, Date\.now\(\), jour\)/, "l'âge de la VFC suit de nouveau l'horloge de la machine (#418 la nuit)");
  assert.match(BENTO, /etatPhysiologique\(hrv, Date\.now\(\), jour\)/, "l'état physiologique suit de nouveau l'horloge de la machine");
});

test("une VFC datée APRÈS aujourd'hui n'est pas la mesure du matin", () => {
  const s = statsVfc([{ date: "2027-01-10", hrv_ms: 250 }], Date.now(), "2026-11-05");
  assert.equal(s.fraiche, false, `âge ${s.jours} jugé frais`);
  assert.equal(etatPhysiologique([{ date: "2027-01-10", hrv_ms: 250, physiological_state: "recovery" }], Date.now(), "2026-11-05"), "optimal",
    "un état venu du futur décide encore de la séance");
});

test("un âge négatif ne s'affiche jamais (« vieille de -57 jours »)", () => {
  assert.match(BENTO, /hrvJours != null && hrvJours > 0 &&/);
});

console.log("\nLA PHRASE DU JOUR");

test("un score de sommeil invalide n'est pas un signal de fatigue", () => {
  assert.equal(etatDuJour(null, null, Number.NaN), "aucun");
  assert.equal(etatDuJour(Number.NaN, 90, 80), "top");
});

test("montre reliée mais muette : on ne lui demande pas de connecter sa montre", () => {
  assert.match(BENTO, /cle === "dash\.ready\.none" && montreReliee \? "dash\.ready\.muette" : cle/);
  assert.match(codeNu("src/app/dashboard/page.tsx"), /montreReliee=\{!!\(profileRes\.data as \{ intervals_api_key\?: string \| null \} \| null\)\?\.intervals_api_key\}/,
    "la page ne dit plus au tableau de bord qu'une montre est reliée");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const dico = T[lang] as Record<string, string>;
    assert.ok(dico["dash.ready.muette"], `dash.ready.muette manque en ${lang}`);
    assert.doesNotMatch(dico["dash.ready.muette"], /connect|verbind|liga/i, `${lang} demande encore de connecter la montre`);
  }
});

console.log("\nCE QUE LES CARTES AFFICHENT");

test("la vignette de FC ne montre que la FC de repos, jamais la FC moyenne d'une séance", () => {
  const ligne = BENTO.split("\n").find((l) => /const restingHr =/.test(l)) ?? "";
  assert.ok(ligne, "restingHr introuvable");
  assert.doesNotMatch(ligne, /avg_hr|workouts/, "la FC moyenne de la dernière séance repasse pour la FC du jour");
  assert.match(BENTO, /fr: \{ hr: "FC de repos" \}/);
});

test("l'en-tête dit sur quelle distance porte l'objectif", () => {
  assert.match(BENTO, /objective\.distanceKm > 0 && <>\{objective\.distanceKm\.toLocaleString\(lang\)\} km · <\/>/);
});

test("aucune pastille flottante ne se pose sur le contenu des cartes", () => {
  const vers = BENTO.slice(BENTO.indexOf("function VersPage("), BENTO.indexOf("function VersFiche("));
  assert.ok(vers.length > 0);
  assert.doesNotMatch(vers, /<span[^>]*absolute/, "une pastille positionnée en absolu revient dans les cartes");
  assert.match(vers, /title=\{l\}/, "le lien de la carte n'annonce plus « Détails »");
});

test("libellé et pourcentage des barres de forme ne se collent plus", () => {
  assert.match(BENTO, /mb-1 flex justify-between gap-2 text-xs/);
});

console.log("\nLA CARTE DU RAIL (score discipline)");

test("« Voir les recommandations » ouvre les conseils de CE score, pas le Kiné IA", () => {
  // Constaté le 06/11/2026 : le bouton menait à /dashboard/health (Kiné IA), sans rapport
  // avec le score, alors que la carte entière ouvrait déjà sa page détaillée.
  assert.match(BENTO, /<Link href="\/dashboard\/indicateurs\/discipline#conseils" className="relative z-\[3\]/);
  assert.doesNotMatch(BENTO, /href="\/dashboard\/health"/, "un lien du tableau de bord renvoie de nouveau au Kiné IA");
  assert.match(codeNu("src/components/indicateurs/FicheIndicateur.tsx"), /<Section id="conseils" icone=\{Lightbulb\} titre=\{c\.conseils\}>/,
    "la section Conseils n'a plus d'ancre : le bouton tombe en haut de page");
});

test("la carte du rail montre les trois composantes, plus la phrase de l'en-tête", () => {
  // 06/11/2026 : elle répétait mot pour mot « Récupération après Marathon… » du haut de page,
  // et rien n'y expliquait le pourcentage.
  const rail = BENTO.slice(BENTO.indexOf('<VersFiche cle="discipline"'), BENTO.indexOf("{rl.recommend}"));
  assert.ok(rail.length > 0, "carte du rail introuvable");
  assert.doesNotMatch(rail, /readiness\.tagline/, "la carte répète de nouveau la phrase de l'en-tête");
  for (const c of ["precision", "consistency", "recovery"]) assert.ok(rail.includes(`["dash.discipline.${c}", disc.${c}]`), `composante ${c} absente de la carte`);
  assert.match(rail, /valeur == null \? "—" : `\$\{valeur\} %`/, "une composante sans mesure s'affiche comme un nombre");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) assert.ok((T[lang] as Record<string, string>)["dash.discipline.absent"], `dash.discipline.absent manque en ${lang}`);
});

console.log("\nLA SÉRIE");

test("une récupération remplacée par du repos tient la série ; un footing manqué la rompt", () => {
  // Constaté le 06/11/2026 : le 27/10, « Récupération… Ou repos complet si tu le sens
  // mieux » — repos pris, journée comptée « manqué ».
  const s = computeStreak({
    today: "2026-11-06", workouts: [{ date: "2026-10-20", sport: "run", duration_seconds: 3600 }],
    prescriptions: [
      { date: "2026-10-27", sessionType: "Récup", subtitle: "Échauffement 15 min très doux FC Z1 → Corps : 25 min en Z1 → Retour au calme 10 min FC Z1. Ou repos complet si tu le sens mieux." },
      { date: "2026-10-28", sessionType: "Endurance", subtitle: "Corps : ~8 km en Z2" },
      // La veille d'une course est aussi une « Récup », mais elle ne propose pas le repos.
      { date: "2026-10-29", sessionType: "Récup", subtitle: "20 min de footing très facile FC Z1 + 3 lignes droites de 80 m à l'allure de course. Rien de plus : on réveille les jambes, on ne les fatigue pas." },
      // Mentionner le repos n'est pas le proposer.
      { date: "2026-10-30", sessionType: "Endurance", subtitle: "Footing facile 40 min. Demain : repos complet." },
      // La reprise à J+2 d'une course le propose, avec d'autres mots.
      { date: "2026-10-31", sessionType: "Récup", subtitle: "20 à 30 min de footing très facile FC Z1, ou repos si les jambes sont encore lourdes." },
    ],
  });
  const jour = (d: string) => s.days.find((x) => x.date === d);
  assert.equal(jour("2026-10-27")?.verdict, "tenu", `récupération non courue : ${jour("2026-10-27")?.verdict}`);
  assert.equal(jour("2026-10-27")?.reason, "repos-respecte");
  assert.equal(jour("2026-10-28")?.verdict, "rompu", "un footing non fait n'est plus compté manqué");
  assert.equal(jour("2026-10-29")?.verdict, "rompu", "un déblocage de veille de course, non fait, passe pour un repos");
  assert.equal(jour("2026-10-30")?.verdict, "rompu", "un footing qui MENTIONNE le repos passe pour un repos");
  assert.equal(jour("2026-10-31")?.verdict, "tenu", "la reprise d'après-course « ou repos si… » n'accepte plus le repos");
});

test("« ta séance du 3 nov. » ne finit plus par deux points", () => {
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const m = (T[lang] as Record<string, string>)["streak.threat"];
    assert.ok(m?.includes("{d}"), `streak.threat manque en ${lang}`);
    assert.ok(!m.endsWith("{d}."), `${lang} : l'abréviation du mois (« nov. ») prend un second point`);
  }
});

console.log("\nL'OBJECTIF, UNE FOIS");

test("l'objectif n'est plus répété dans le rail, et sa fiche reste accessible", () => {
  // 06/11/2026 : le même objectif trois fois sur la page (en-tête, carte Objectif, carte
  // « Objectif principal » du rail). La carte du rail répétait les deux autres.
  assert.doesNotMatch(BENTO, /<VersFiche cle="objectif"/, "la carte « Objectif principal » revient dans le rail");
  assert.doesNotMatch(BENTO, /rl\.goal|rl\.progress/, "les libellés de la carte retirée reviennent");
  const carte = codeNu("src/components/dashboard/ObjectiveCard.tsx");
  assert.match(carte, /<Link href="\/dashboard\/indicateurs\/objectif"[^>]*>\s*<TrendingUp[^>]*\/> \{t\("obj\.ouJenSuis"\)\}/,
    "la page détaillée de l'objectif n'est plus reliée depuis la carte Objectif");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) assert.ok((T[lang] as Record<string, string>)["obj.ouJenSuis"], `obj.ouJenSuis manque en ${lang}`);
});

console.log("\nLE SCORE DISCIPLINE");

// Le compte réel au 06/11/2026 : séances du 24 et du 25/10 (marathon), VFC du 30/10,
// série telle que la juge lib/streak (récupérations au repos = tenues).
const SEANCES_REELLES = [
  { date: "2026-10-24", sport: "run", type: "easy", distance_km: 5.3, duration_seconds: 1740, avg_hr: 145 },
  { date: "2026-10-25", sport: "run", type: "race", distance_km: 42.47, duration_seconds: 9696, avg_hr: 189, hr_zone_seconds: [0, 0, 600, 4000, 4500, 600] },
  { date: "2026-10-25", sport: "run", type: "easy", distance_km: 2.1, duration_seconds: 900, avg_hr: 134 },
] as never[];
const VFC_PERIMEE = [87, 91, 81, 87, 84, 90, 86].map((v, i) => ({ date: `2026-10-${30 - i}`, hrv_ms: v })) as never[];
const SERIE_REELLE = [["24", "tenu"], ["25", "tenu"], ["26", "tenu"], ["27", "tenu"], ["28", "rompu"], ["29", "rompu"], ["30", "rompu"], ["31", "tenu"]]
  .map(([j, v]) => ({ date: `2026-10-${j}`, verdict: v }))
  .concat([["01", "rompu"], ["02", "rompu"], ["03", "attente"], ["04", "attente"], ["05", "tenu"], ["06", "attente"]].map(([j, v]) => ({ date: `2026-11-${j}`, verdict: v })));

test("le compte réel : l'assiduité suit le plan, la VFC périmée ne compte plus, rien n'est inventé", () => {
  const d = computeDiscipline(SEANCES_REELLES, VFC_PERIMEE, null, "optimal", { aujourdhui: "2026-11-06", serie: SERIE_REELLE });
  assert.equal(d.details.jugees, 11, "les journées en attente ne se jugent pas");
  assert.equal(d.consistency, 55, `assiduité ${d.consistency} : 6 tenues sur 11 jugées`);
  assert.equal(d.recovery, null, `récupération ${d.recovery} tirée d'une VFC vieille d'une semaine`);
  assert.equal(d.precision, 71);
  assert.equal(d.total, 63, `total ${d.total} : (40 × 71 + 40 × 55) ÷ 80`);
});

test("une journée protégée tient l'assiduité ; sans plan ni mesure, on n'invente pas de composante", () => {
  const serie = [{ date: "2026-11-01", verdict: "protege" }, { date: "2026-11-02", verdict: "rompu" }, { date: "2026-11-03", verdict: "hors" }];
  assert.equal(computeDiscipline([], [], null, "optimal", { aujourdhui: "2026-11-06", serie }).consistency, 50);
  const vide = computeDiscipline([], [], null, "optimal", { aujourdhui: "2026-11-06" });
  assert.equal(vide.consistency, null, "assiduité sans plan : la cible de 8 séances est revenue");
  assert.equal(vide.recovery, null, "récupération sans mesure : la valeur par défaut est revenue");
  assert.equal(vide.hasData, false);
  assert.doesNotMatch(codeNu("src/lib/dashboard/discipline.ts"), /stateBaseline|weeklyTarget/, "une valeur par défaut revient dans le score");
});

test("la fenêtre de 14 jours se compte en jours civils de l'athlète", () => {
  const w = [{ date: "2026-10-24", sport: "run", type: "easy", duration_seconds: 1800 }, { date: "2026-10-23", sport: "run", type: "easy", duration_seconds: 1800 }] as never[];
  assert.equal(computeDiscipline(w, [], null, "optimal", { aujourdhui: "2026-11-06" }).details.seances, 1, "le 23/10 est dans la fenêtre du 06/11");
  assert.equal(computeDiscipline(w, [], null, "optimal", { aujourdhui: "2026-11-05" }).details.seances, 2);
  assert.doesNotMatch(codeNu("src/lib/dashboard/discipline.ts"), /now - new Date\(w\.date\)/, "la fenêtre suit de nouveau l'horloge de la machine");
});

test("score de forme : une composante absente est écartée de la moyenne, pas comptée zéro", () => {
  const w = Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(10 + i * 2).padStart(2, "0")}`, sport: "run", distance_km: 12 }));
  const sans = computeForme(w, 18, null, null, null, "2026-11-06");
  assert.equal(sans.total, Math.round((sans.endurance + sans.speed) / 2), `total ${sans.total} : les absentes ont tiré la moyenne vers le bas`);
  const avec = computeForme(w, 18, 60, 40, null, "2026-11-06");
  assert.equal(avec.total, Math.round((avec.endurance + avec.speed + 60 + 40) / 4));
});

test("une VFC fraîche compte encore", () => {
  const fraiche = [88, 84, 86, 85].map((v, i) => ({ date: `2026-11-0${6 - i}`, hrv_ms: v })) as never[];
  const d = computeDiscipline([], fraiche, { sleep_score: 80 }, "optimal", { aujourdhui: "2026-11-06" });
  assert.ok(d.recovery != null && d.details.signalVfc != null, "une VFC du jour est ignorée");
});

console.log("\nLA SÉANCE DU JOUR ET SON POURQUOI");

test("« ~32 km cette semaine » se lit comme la cible du plan, pas comme un bilan", () => {
  // Constaté le 06/11/2026 : « tu es sur ~32 km cette semaine » chez un coureur à 0 km en 7 jours.
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const t = PLAN_T[lang].enduranceWhy("32");
    assert.ok(t.includes("32"), `${lang} : la cible a disparu`);
    assert.doesNotMatch(t, /tu es sur|you are on|liegst du|estás en|estás em/i, `${lang} : la cible se lit encore comme du couru — ${t}`);
  }
  assert.match(PLAN_T.fr.enduranceWhy("32"), /^Le socle aérobie\. Ta semaine vise ~32 km au total/);
});

test("une étiquette interne du prompt (« feu orange léger ») n'atteint jamais l'athlète", () => {
  const jours = [{ date: "2026-11-06", type: "Endurance", title: "Footing en endurance", detail: "Corps : ~5,5 km en Z2", why: "Le socle aérobie." }];
  const brut = JSON.stringify({ conseils: [{ date: "2026-11-06", conseil: "Aujourd'hui, avec ton verdict \"feu orange léger\", sois très attentif à l'échauffement. Si ça ne vient pas, ralentis." }] });
  const motifs: string[] = [];
  assert.deepEqual(validerConseils(brut, jours, "fr", "", motifs), [], "le conseil qui cite le niveau interne est accepté");
  assert.ok(motifs.includes("étiquette interne"), `motif : ${motifs.join(", ")}`);
  // Un conseil déjà MÉMORISÉ ne repasse pas par le modèle : il doit être écarté à l'application aussi.
  const memorise = [{ date: "2026-11-06", lang: "fr" as const, texte: "Avec ton verdict « feu orange léger », sois attentif à l'échauffement." }];
  assert.equal(appliquerConseils(jours, memorise)[0].why, "Le socle aérobie.", "un conseil mémorisé avec l'étiquette interne est encore affiché");
  // Chaque étiquette seule suffit à écarter le conseil.
  for (const texte of ["Feu orange léger : sois attentif à l'échauffement.", "🟡 Reste attentif à l'échauffement.", "Ton verdict du jour : prudence sur l'échauffement."]) {
    assert.equal(appliquerConseils(jours, [{ date: "2026-11-06", lang: "fr" as const, texte }])[0].why, "Le socle aérobie.", `passe encore : ${texte}`);
  }
  const propre = [{ date: "2026-11-06", lang: "fr" as const, texte: "Tu sors d'un marathon : laisse venir les sensations sur l'échauffement." }];
  assert.match(appliquerConseils(jours, propre)[0].why, /Tu sors d'un marathon/, "un conseil sain est écarté à tort");
  assert.match(inviteRelecture({ systeme: "", contexte: "", jours, lang: "fr" }), /ne les cite JAMAIS/, "l'invite n'interdit plus les étiquettes internes");
});

test("plus de carte « Analyse IA · Beta » qui répète le pourquoi de la séance", () => {
  assert.doesNotMatch(BENTO, />Beta</, "le badge « Beta » écrit en dur revient");
  assert.doesNotMatch(BENTO, /rl\.ai\b/, "la carte « Analyse IA » revient");
});

console.log("\nCRASH-TEST DU SCORE DE FORME");

test("aucune entrée absurde ne fait sortir un axe de 0–100 ni n'en fait un NaN", () => {
  const seances = [[], [{ date: "2026-11-05", sport: "run", distance_km: Number.NaN }], [{ date: "x", sport: "run", distance_km: -5 }],
    Array.from({ length: 200 }, (_, i) => ({ date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, sport: "run", distance_km: 1000 }))];
  const objectifs = [null, { distanceKm: 0, targetSeconds: 0 }, { distanceKm: 5, targetSeconds: 1 }, { distanceKm: Number.NaN, targetSeconds: Number.NaN }, { distanceKm: 1000, targetSeconds: 100 }];
  for (const w of seances) for (const vma of [0, -3, Number.NaN, 20.1, 1e9]) for (const o of objectifs) for (const r of [-50, 72, 500, Number.NaN, null]) {
    const f = computeForme(w, vma, r, r, o, "2026-11-05");
    for (const c of ["total", "endurance", "speed", "recovery", "regularity"] as const) {
      const v = f[c];
      // Absente si et seulement si elle manquait à l'entrée : jamais inventée, jamais perdue.
      if (r === null && (c === "recovery" || c === "regularity")) { assert.equal(v, null, `${c} inventée : ${v}`); continue; }
      assert.ok(v != null && v >= 0 && v <= 100, `${c} = ${v} (vma ${vma}, r ${r}, objectif ${JSON.stringify(o)})`);
    }
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
