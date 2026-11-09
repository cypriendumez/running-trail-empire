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
import { derniereAnalyse, lienSeance } from "../src/lib/dashboard/derniereAnalyse";
import { zoneDominante } from "../src/lib/dashboard/zones";
import { etapesSeance } from "../src/lib/dashboard/etapes";
import { seancesSansRessenti } from "../src/lib/dashboard/ressenti";
import { computeDistancePRs, NOMS_DISTANCE } from "../src/lib/dashboard/records";
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

console.log("\nLA CARTE « ANALYSE IA »");

test("elle montre l'analyse mémorisée de la dernière séance, la vraie (le marathon, pas le retour au calme)", () => {
  // Le compte réel : le 25/10, le marathon (analysé) et 2,1 km de retour au calme.
  const seances = [
    { id: "retour", date: "2026-10-25", distance_km: 2.1, title: "Retour au calme" },
    { id: "lille", date: "2026-10-25", distance_km: 42.47, title: "Marathon de Lille" },
    { id: "veille", date: "2026-10-24", distance_km: 5.3, title: "Veille" },
  ];
  const analyses = [{ body: "Le 25 octobre, tu as couru 42.47 km en 162 min…", data: { workout_id: "lille", date: "2026-10-25" } }];
  const a = derniereAnalyse(seances, analyses);
  assert.equal(a?.seance.id, "lille");
  assert.match(a?.texte ?? "", /^Le 25 octobre/);
  // Sans analyse : la séance la plus longue du dernier jour, et pas de texte inventé.
  const b = derniereAnalyse(seances, []);
  assert.equal(b?.seance.id, "lille", "sans analyse, la carte propose les 2 km de retour au calme");
  assert.equal(b?.texte, null);
  // Une analyse d'une séance PLUS ANCIENNE ne passe pas pour celle de la dernière séance.
  const c = derniereAnalyse([{ id: "neuf", date: "2026-11-06", distance_km: 8 }, ...seances], analyses);
  assert.equal(c?.seance.id, "neuf");
  assert.equal(c?.texte, null, "l'analyse du marathon est présentée comme celle de la séance du 06/11");
  assert.equal(derniereAnalyse([], analyses), null);
  assert.equal(lienSeance(seances[1]), "/dashboard/activite?date=2026-10-25&dist=42.47&title=Marathon%20de%20Lille");
});

test("le tableau de bord lit les analyses mémorisées et n'en déclenche aucune", () => {
  assert.match(BENTO, /const analyse = derniereAnalyse\(runs, analyses\);/);
  assert.doesNotMatch(BENTO, /api\/ai\/analyse-seance/, "le tableau de bord déclenche un appel payant au modèle");
  assert.match(codeNu("src/app/dashboard/page.tsx"), /\.eq\("type", "seance_analyse"\)\.order\("created_at", \{ ascending: false \}\)\.limit\(20\)/,
    "la page ne charge plus les analyses mémorisées");
  assert.match(codeNu("src/app/dashboard/page.tsx"), /analyses=\{\(analysesRes\.data \?\? \[\]\) as AnalyseMemorisee\[\]\}/);
});

console.log("\nAUDIT DU 06/11/2026 — LANGUES, TÉLÉPHONE, AUTRES PROFILS");

test("les nombres s'écrivent à la langue : « 11,4 km/h », pas « 11.4 »", () => {
  assert.doesNotMatch(BENTO, /\.toFixed\([12]\)/, "une décimale s'affiche de nouveau avec un point, quelle que soit la langue");
  assert.match(BENTO, /const nf = \(v: number, d = 1\) => \(Number\.isFinite\(v\) \? v : 0\)\.toLocaleString\(lang,/);
  assert.equal((11.4).toLocaleString("de", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), "11,4");
});

test("« 7 j » et « Base : » suivent la langue", () => {
  assert.doesNotMatch(BENTO, /km · 7 j/, "« 7 j » écrit en dur revient (affiché tel quel en allemand, anglais…)");
  for (const [lang, v] of [["fr", "7 j"], ["en", "7 d"], ["de", "7 T"], ["es", "7 d"], ["pt", "7 d"]]) {
    assert.match(BENTO, new RegExp(`\\n  ${lang}: \\{[^}]*sept: "${v}"`), `${lang} : « ${v} » manque`);
  }
  assert.doesNotMatch(BENTO, /\)\} : </, "un « : » à la française écrit en dur revient (« Basis : 43 ms »)");
  assert.match(BENTO, /const deuxPoints = lang === "fr" \? "\\u00a0: " : ": ";/);
});

test("téléphone : l'en-tête sans objectif et la carte Objectif ne s'écrasent plus", () => {
  assert.match(BENTO, /<div className="flex w-full flex-wrap gap-x-7 gap-y-4 sm:w-auto sm:gap-x-9">/,
    "les chiffres de l'en-tête restent sur la ligne du « Bonjour » et l'écrasent sur un mot de large");
  assert.match(codeNu("src/components/dashboard/ObjectiveCard.tsx"), /<div className="min-w-0 basis-full sm:basis-0 sm:flex-1">/,
    "le chrono et le bouton écrasent de nouveau la colonne de l'objectif sur téléphone");
});

test("« Forme » dans l'en-tête est le Score de forme, pas le Score discipline", () => {
  assert.match(BENTO, /\{ label: kpi\.form, value: forme\.hasData \? String\(forme\.total\) : "—"/);
});

test("la séance de repli ne propose pas d'intensité à l'aveugle", () => {
  // Constaté le 06/11/2026 : « Séries courtes 10 × 400 m » à un nouvel inscrit sans aucune donnée.
  const repli = BENTO.slice(BENTO.indexOf("function recommendSession("), BENTO.indexOf("function colorizeTag("));
  assert.match(repli, /if \(recuperation \|\| !last\) return base;/, "un nouvel inscrit ou un coureur en récupération reçoit de nouveau du fractionné");
  assert.match(repli, /if \(!mesureFraiche\) return base;/, "l'état « optimal » PAR DÉFAUT décide de nouveau d'une séance VMA");
  assert.ok(repli.indexOf("if (!mesureFraiche) return base;") < repli.indexOf('if (state === "optimal")'), "la garde passe après la séance VMA");
  assert.match(repli, /\(dow === 0 \|\| dow === 6\) && weeklyKm >= 15/, "12 km de sortie longue d'office reviennent pour un coureur à 0 km");
  assert.match(BENTO, /recommendSession\(\{ [^}]*recuperation: !!planCoach\?\.recuperation, mesureFraiche: hrvFraiche \}\)/);
});

console.log("\nCRASH-TEST AU HASARD DU RENDU (06/11/2026)");

test("le tableau de bord ne plante plus quand une seule carte d'appoint est disponible", () => {
  // 1 profil sur 300 tirés au hasard : séance du coach publiée, pas de nuit récente, aucune
  // COURSE avec une distance (cycliste). `fillers[1].node` levait : erreur 500, page entière.
  assert.doesNotMatch(BENTO, /\{fillers\[1\]\.node\}\s*<\/motion\.div>\s*<\/>/, "la seconde carte d'appoint est de nouveau lue sans garde");
  assert.match(BENTO, /\{fillers\[1\] && <motion\.div key=\{fillers\[1\]\.key\}/);
  assert.match(BENTO, /className=\{`col-span-12 bento-card \$\{fillers\[1\] \? "md:col-span-8" : ""\}`\}/, "sans seconde carte, la dernière séance ne prend pas toute la largeur");
});

test("durées, VFC et FC arrondies à l'affichage : plus de « 3h7.6699999999999875 »", () => {
  assert.doesNotMatch(BENTO, /(total_sleep_min|s\.min) % 60/, "une durée se formate de nouveau sans arrondi");
  assert.match(BENTO, /const hm = \(min: number\) => \{ const m = Math\.max\(0, Math\.round\(/);
  assert.doesNotMatch(BENTO, /\{Math\.abs\(hrvDelta\)\} ms/, "l'écart de VFC s'affiche de nouveau avec ses décimales");
  assert.match(BENTO, /\{Math\.round\(restingHr\)\}<span/);
});

console.log("\nRELECTURE COMPLÈTE DU 06/11/2026 — PAGE SERVEUR");

const PAGE = codeNu("src/app/dashboard/page.tsx");
test("la séance du coach se choisit au jour de l'athlète, et sa date voyage avec elle", () => {
  assert.match(PAGE, /const today = streakToday;/, "la séance du jour se filtre de nouveau sur le jour de Paris");
  assert.doesNotMatch(PAGE, /aujourdhui\(FUSEAU_DEFAUT\)/);
  assert.match(PAGE, /i18n: cn\.data\.i18n, date: cn\.data\.date \?\? null \}/, "la date de la séance n'est plus transmise");
  assert.match(BENTO, /dateCoach !== jour\s*\? t\("dash\.coach\.badgeLe"/, "une séance d'un autre jour est de nouveau annoncée « Séance du jour »");
  assert.equal((BENTO.match(/\{badgeCoach\}/g) ?? []).length, 2, "un badge écrit encore « Séance du jour » sans regarder la date");
});

test("le risque de charge lit un an de charge, au jour de l'athlète", () => {
  assert.match(PAGE, /const risk = loadRisk\(\(chargeRes\.data \?\? \[\]\)[\s\S]{0,200}?, streakToday\);/, "le déload se calcule de nouveau sur 40 séances et le jour de Paris");
});

console.log("\nRELECTURE COMPLÈTE — TABLEAU DE BORD");

test("la date de course vient de l'objectif ; le volume se mesure à la cible du coach", () => {
  assert.match(BENTO, /const raceDate = objective\?\.raceDate \?\? \(plan as/, "l'affûtage relit de nouveau l'ancienne table training_plans d'abord");
  assert.doesNotMatch(BENTO, /weeklyKm \/ 60\)/, "la barre de volume se mesure de nouveau à 60 km écrits en dur");
  assert.match(BENTO, /const refVolume: number \| null = cibleVolumeKm != null && cibleVolumeKm > 0 \? cibleVolumeKm : forme\.cibleVolumeKm;/);
  assert.match(BENTO, /\{refVolume != null && refVolume > 0 && \(/, "une barre de progression s'affiche sans référence");
  assert.match(PAGE, /cibleVolumeKm=\{typeof \(etatCoach as \{ targetKm\?: unknown \} \| null\)\?\.targetKm === "number"/);
  assert.match(BENTO, /Math\.abs\(volumeDelta\) >= 0\.5/, "« ↑ 0 km » peut de nouveau s'afficher");
});

test("liste des séances : vraie zone dominante, pas de « 0 » parasite, la liste des activités", () => {
  assert.doesNotMatch(BENTO, /training_effect/, "la pastille de zone relit l'effet d'entraînement (vide en base) et vaut Z2 par défaut");
  assert.match(BENTO, /const z = zoneDominante\(w\.hr_zone_seconds\);/);
  assert.doesNotMatch(BENTO, /\{w\.distance_km && <span>|\{w\.avg_hr && <span>/, "`0 && …` affiche de nouveau un « 0 »");
  assert.match(BENTO, /<Link href="\/dashboard\/activites"[^>]*>\s*\{t\("dash\.recent\.viewAll"\)\}/, "« Tout voir » mène de nouveau au calendrier");
  assert.equal(zoneDominante([600, 3000, 300, 0, 0]), 2);
  assert.equal(zoneDominante([0, 0, 0, 0, 0, 900, 1200]), 5, "les tranches au-delà de la 5e ne vont plus dans la dernière");
  assert.equal(zoneDominante(null), null);
  assert.equal(zoneDominante([Number.NaN, -3]), null);
});

test("records, dernière séance ; plus de cartes Badges ni Communauté (retirées le 09/11/2026)", () => {
  assert.match(BENTO, /\{ABREV_RECORD\[lang\] \?\? "RP"\}/, "« RP » s'affiche de nouveau dans toutes les langues");
  assert.doesNotMatch(BENTO, /plusLongueConnue|rl\.badges|rl\.community|newMembersWeek/, "une carte Badges ou Communauté est revenue dans le tableau de bord");
  assert.doesNotMatch(codeNu("src/app/dashboard/page.tsx"), /league_members|createAdminClient/, "la page relit la ligue ou compte les inscrits avec la clé de service pour une carte retirée");
  assert.match(BENTO, /if \(km != null && sec != null && isRun\(w\.sport\)\)/, "une allure au km s'affiche de nouveau pour le vélo");
  assert.match(BENTO, /value: ent\(cad\), unit: "spm"/, "la cadence n'est plus arrondie");
});

test("décimales et clés : jauge ACWR, cible, étiquettes du coach", () => {
  assert.match(BENTO, /\{ v: nf\(0\.8\), p: 23\.08 \}/, "les repères de la jauge ACWR s'écrivent de nouveau « 0.8 »");
  for (const lang of ["fr", "de", "es", "pt"] as const) assert.doesNotMatch((T[lang] as Record<string, string>)["dash.acwr.sweet"], /\d\.\d/, `${lang} : « 0.8–1.3 »`);
  assert.match(BENTO, /key=\{`\$\{i\}-\$\{t\.l\}`\}/, "deux étiquettes identiques du coach partagent de nouveau la même clé React");
});

console.log("\nRELECTURE COMPLÈTE — COMPOSANTS ENFANTS");

test("la barre de fraîcheur porte une vraie couleur", () => {
  const w = codeNu("src/components/dashboard/TaperingWidget.tsx");
  assert.doesNotMatch(w, /style=\{\{ color: tsbStatus\.color\.replace/, "un nom de classe repasse dans une propriété CSS (barre noire)");
  assert.match(w, /className=\{`h-full rounded-full \$\{tsbStatus\.bar\}`\}/);
});

test("records : la date ne recule pas d'un jour à l'ouest de Greenwich ; les distances sont traduites", () => {
  const prev = process.env.TZ;
  const lignes = computeDistancePRs([{ date: "2025-10-25", distance_km: 42.3, duration_seconds: 9696 }] as never, "fr");
  const marathon = lignes.find((l) => l.cle === "marathon");
  assert.match(marathon?.date ?? "", /^25 /, `date affichée « ${marathon?.date} » pour une course du 25`);
  assert.doesNotMatch(codeNu("src/lib/dashboard/records.ts"), /const fmtDate = \(d: string\) => new Date\(d\)\./, "la date se relit de nouveau à minuit UTC");
  for (const lang of ["fr", "en", "de", "es", "pt"]) assert.ok(NOMS_DISTANCE[lang]?.semi && NOMS_DISTANCE[lang]?.marathon, `distances manquantes en ${lang}`);
  assert.equal(computeDistancePRs([{ date: "2025-03-15", distance_km: 21.1, duration_seconds: 4500 }] as never, "es").find((l) => l.cle === "semi")?.label, "Media");
  assert.match(codeNu("src/components/dashboard/AjoutRecord.tsx"), /\(NOMS_DISTANCE\[lang\] \?\? NOMS_DISTANCE\.fr\)\[cle\]/);
  process.env.TZ = prev;
});

test("test VMA, ressenti, bandeau de profil, objectif, barres : langue et mémoire", () => {
  const v = codeNu("src/components/dashboard/TestVmaBanner.tsx");
  assert.match(v, /const nombre = \(v: string\) => parseFloat\(String\(v\)\.replace\(",", "\."\)\);/, "« 16,5 » redevient 16");
  assert.doesNotMatch(v, /placeholder="ex : 16\.5"/, "l'exemple de VMA est de nouveau en français pour toutes les langues");
  assert.match(v, /apercuVma\.toLocaleString\(lang/);
  assert.match(codeNu("src/components/dashboard/SessionFeedback.tsx"), /\$\{Math\.floor\(secKm \/ 60\)\}'\$\{String\(secKm % 60\)/, "l'allure du ressenti s'écrit de nouveau « 5:06 »");
  const p = codeNu("src/components/dashboard/ProfileCompletionBanner.tsx");
  assert.match(p, /localStorage\.setItem\(CLE_MASQUE, cle\)/, "« Masquer » ne se souvient de nouveau de rien");
  const o = codeNu("src/components/dashboard/ObjectiveCard.tsx");
  assert.doesNotMatch(o, />Source : /, "« Source : » est de nouveau écrit en français pour toutes les langues");
  assert.match(o, /p\.km === 42\.2 \? t\("obj\.presetMarathon"\)/);
  assert.match(codeNu("src/components/dashboard/MiniGraphes.tsx"), /b\.valeur\.toLocaleString\(lang,/);
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const d = T[lang] as Record<string, string>;
    for (const k of ["obj.presetMarathon", "obj.source", "dash.coach.badgeLe"]) assert.ok(d[k], `${k} manque en ${lang}`);
  }
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

console.log("\nDESIGN & ÉCRITURE (07/11/2026)");

test("la prescription du jour se lit en étapes ; « Z1→Z2 » collé ne coupe rien ; une phrase seule reste une phrase", () => {
  const e = etapesSeance("Échauffement 8 min progressif FC Z1→Z2 → Corps : ~5,5 km en Z2 (~4'36/km) → Retour au calme 6 min FC Z1");
  assert.ok(e && e.length === 3, `étapes : ${JSON.stringify(e)}`);
  assert.equal(e![0].texte, "Échauffement 8 min progressif FC Z1→Z2");
  assert.equal(e![1].libelle, "Cœur de séance", "« Corps », mot du format montre, ne s'affiche pas tel quel");
  assert.equal(e![1].texte, "~5,5 km en Z2 (~4'36/km)");
  assert.deepEqual(e!.map((x) => x.coeur), [false, true, false], "le cœur de séance n'est pas mis en avant");
  assert.equal(etapesSeance("Repos complet. Marche ou mobilité si besoin."), null);
  assert.equal(etapesSeance(""), null);
  assert.equal(etapesSeance(null), null);
  // Allemand : « Hauptteil: » est un libellé, gardé tel quel ; sans libellé, le cœur est l'étape du milieu.
  assert.equal(etapesSeance("Aufwärmen 10 min → Hauptteil: 3 × 10 min → Auslaufen 5 min")![1].libelle, "Hauptteil");
  assert.deepEqual(etapesSeance("A 10 min → B 20 min → C 5 min")!.map((x) => x.coeur), [false, true, false]);
  // Rien n'est perdu : chaque morceau se retrouve dans la phrase d'origine.
  const src = "Échauffement 20 min + 3 lignes droites → Corps : Seuil continu (SOUS-seuil) : 11 min à ~3'48/km → Retour au calme 10 min";
  for (const x of etapesSeance(src)!) assert.ok(src.includes(x.texte), `texte inventé : ${x.texte}`);
});

test("le ressenti ne propose jamais une séance à la date illisible", () => {
  const r = seancesSansRessenti([{ id: "a", date: "pas-une-date", title: "X" }, { id: "b", date: "2026-11-05", title: "Y" }], [], "2026-11-01");
  assert.deepEqual(r.map((x) => x.id), ["b"]);
});

test("écriture : pas de « point(s) », pas de durée « 0h46 », pas de « volume — km/sem », pas de clé de panne brute", () => {
  const banniere = codeNu("src/components/dashboard/ProfileCompletionBanner.tsx");
  assert.doesNotMatch(banniere, /\(s\)|à l'aveugle/, "la bannière de profil parle de nouveau en « point(s) »");
  assert.match(banniere, /missing\.length === 1 \? t\.title1/, "le singulier n'est plus distingué");
  const b = codeNu("src/components/dashboard/BentoDashboard.tsx");
  assert.match(b, /m < 60 \? `\$\{m\} min`/, "une durée de moins d'une heure s'écrit de nouveau « 0h46 »");
  assert.match(b, /duree\(Number\(w\.duration_seconds\) \/ 60\)/, "la liste des activités n'utilise plus la durée lisible");
  assert.doesNotMatch(b, /cibleVolumeKm \?\? "—"/, "« volume — km/sem » est de retour");
  assert.match(b, /filter\(\(l\) => !l\.startsWith\("dash\.inc\."\)\)/, "une panne inconnue s'affiche de nouveau en clé brute");
  for (const l of ["fr", "en", "de", "es", "pt"] as const) {
    const d = T[l] as Record<string, string>;
    for (const k of ["dash.inc.donnees", "dash.forme.refLongue", "dash.hrv.norme"]) assert.ok(d[k], `${k} manque en ${l}`);
    assert.doesNotMatch(d["tap.spark"], /TSB/, `« TSB », sigle anglais, s'affiche en ${l}`);
  }
  assert.doesNotMatch((T.fr as Record<string, string>)["dash.hrv.empty"], /\bvous\b|votre/, "la carte VFC vouvoie de nouveau");
});

test("métriques de la dernière séance : une valeur nulle ou négative n'est pas une mesure ; l'allure ne s'écrit jamais 4'60", () => {
  const b = codeNu("src/components/dashboard/BentoDashboard.tsx");
  assert.match(b, /Number\.isFinite\(n\) && n > 0 \? n : null/, "une durée négative ou une FC à 0 s'affiche de nouveau");
  assert.match(b, /const s = Math\.round\(sec \/ km\)/, "l'allure n'est plus arrondie à la seconde entière (4'60 possible)");
  assert.match(b, /sourceVma\.type === "seances" && sourceVma\.date && \(sourceVma\.km \?\? 0\) > 0/, "la VMA cite de nouveau une séance « (0 km) »");
});

// Capture de Cyprien, 09/11/2026 (J+15 du marathon, plus rien de la montre depuis le 30/10) :
// « Forme du jour » disait « Rien de récent reçu de ta montre (VFC, sommeil) » et affichait
// dessous « VFC ↑ 1 ms » (l'écart du 30/10) avec une pastille colorée ; « Dernière séance »
// montrait le footing du 25/10 sans date ; « séances récentes » ne disait pas jusqu'où.
test("section Activité : pas d'écart de VFC périmé, pastille grise sans mesure, séance datée, fenêtre des records datée", () => {
  const b = codeNu("src/components/dashboard/BentoDashboard.tsx");
  const carteForme = b.slice(b.indexOf('key: "ready"'), b.indexOf("const fillers = fillerPool"));
  assert.ok(carteForme.length > 0, "carte « Forme du jour » introuvable");
  assert.match(carteForme, /\{hrvFraiche && hrvDelta != null && hrvBaseline != null && \(/, "« Forme du jour » affiche de nouveau un écart de VFC périmé");
  assert.match(carteForme, /background: readiness\.pastille/, "la pastille de « Forme du jour » ne passe plus au gris sans mesure");
  assert.match(b, /const pastille = e === "aucun" \? "#d4d4d8" : null/, "la pastille reste colorée quand rien n'est mesuré");
  const derniere = b.slice(b.indexOf('t("dash.last.title")'), b.indexOf("lastMetrics.map"));
  assert.match(derniere, /formatDateCivile\(String\(w0\.date\)\.slice\(0, 10\)/, "« Dernière séance » ne dit plus sa date");
  assert.match(b, /t\("dash\.records\.sub", \{ date: formatDateCivile\(records\.depuis/, "« Tes meilleures sorties » ne date plus sa fenêtre");
  for (const l of ["fr", "en", "de", "es", "pt"] as const) {
    const d = T[l] as Record<string, string>;
    assert.match(d["dash.records.sub"], /\{date\}/, `dash.records.sub sans {date} en ${l}`);
    assert.doesNotMatch(d["dash.records.sub"], /récentes|recent|letzten|recientes/i, `dash.records.sub redevient vague en ${l}`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
