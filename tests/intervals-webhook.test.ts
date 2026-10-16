/**
 * LES ALERTES D'intervals.icu (webhooks de l'application OAuth n° 1331) — figées le 16/10/2026.
 *
 * L'ancienne route attendait `?secret=` dans l'adresse et `athlete_id` à la racine du corps :
 * le format réel (guide d'intégration, forum.intervals.icu, sujet 80090) met le secret DANS le
 * corps et les alertes dans `events`. Elle n'aurait donc jamais accepté une alerte réelle. Ce
 * qui est vérifié ici, et pourquoi :
 *  · la lecture : le format du guide passe tel quel, un identifiant d'athlète forgé non ;
 *  · le secret : comparé à temps constant, lu dans le corps et nulle part ailleurs ;
 *  · le tri : le calendrier, que Pacevo écrit lui-même, ne relance jamais de synchro (boucle) ;
 *  · la fenêtre : la séance annoncée entre TOUJOURS dans la synchro, minuit compris ;
 *  · la réponse : une alerte non acquittée est RENVOYÉE par intervals.icu, donc on n'échoue
 *    que si réessayer peut réussir.
 * Le comportement de la route elle-même, devant une base et un intervals.icu simulés, est
 * éprouvé dans `tests/synchro.crash.test.ts` (le banc des vraies routes).
 *
 *   npx tsx tests/intervals-webhook.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  JOURS_DEFAUT, JOURS_MAX, RAISONS_IGNOREES, TYPES_SYNCHRO, fenetre, issueDe, lireLivraison, lotsATraiter,
  secretAttendu, secretValide, statutHttp, type Alerte,
} from "../src/lib/intervals/webhook";

const ROOT = join(import.meta.dirname, "..");

let passed = 0;
const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  ✗ ${nom}`); }
}

/** Le code sans ses commentaires ni ses imports — sans couper les `://` des adresses. */
const codeSeul = (chemin: string): string =>
  readFileSync(join(ROOT, chemin), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !/^\s*(import\b|\/\/)/.test(l))
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");

function fichiersSrc(dir = join(ROOT, "src"), out: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) fichiersSrc(chemin, out);
    else if (/\.tsx?$/.test(nom)) out.push(chemin.slice(ROOT.length + 1));
  }
  return out;
}

const ROUTE = "src/app/api/webhooks/intervals/route.ts";
/** Midi UTC, le 16/10/2026 : le jour est PASSÉ aux fonctions fenêtrées, jamais lu sur l'horloge. */
const MIDI = Date.parse("2026-10-16T12:00:00Z");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📨 LA LIVRAISON — le format du guide passe, un identifiant forgé non\n");
// ─────────────────────────────────────────────────────────────────────────────

test("la livraison du guide d'intervals.icu se lit telle quelle", () => {
  // L'exemple du guide (sujet 80090), activité comprise.
  const l = lireLivraison({
    secret: "ooKeodacie8I",
    events: [{ athlete_id: "2049151", type: "ACTIVITY_UPLOADED", timestamp: "2024-12-06T06:40:47.011+00:00",
      activity: { id: "i55751783", start_date_local: "2024-11-20T07:35:18", type: "Ride" } }],
  });
  assert.ok(l, "la livraison du guide est refusée");
  assert.equal(l.secret, "ooKeodacie8I");
  assert.deepEqual(l.alertes, [{ athleteId: "2049151", type: "ACTIVITY_UPLOADED", jour: "2024-11-20" }]);
  assert.equal(l.rejetees, 0);
});

test("l'ANCIEN format (secret dans l'adresse, athlete_id à la racine) n'est pas une livraison", () => {
  // C'est ce que lisait la route jusqu'au 16/10/2026 — et qu'intervals.icu n'envoie pas.
  assert.equal(lireLivraison({ athlete_id: "i1", event: "activity_updated" }), null);
  for (const corps of [null, undefined, "texte", 42, [], {}, { events: "x" }, { events: { 0: {} } }]) {
    assert.equal(lireLivraison(corps), null, `${JSON.stringify(corps)} lu comme une livraison`);
  }
  assert.deepEqual(lireLivraison({ secret: "s", events: [] })?.alertes, [], "une livraison vide est une livraison");
});

test("l'identifiant d'athlète est normalisé, et un identifiant forgé est écarté", () => {
  // Il sert ensuite à retrouver l'athlète en base ET dans chaque adresse de l'API.
  const ids = (athlete_id: unknown) => lireLivraison({ events: [{ athlete_id, type: "ACTIVITY_UPLOADED" }] })!;
  assert.equal(ids("I564686").alertes[0]?.athleteId, "i564686", "la casse doit être normalisée");
  assert.equal(ids("  i564686\n").alertes[0]?.athleteId, "i564686", "les blancs doivent être rognés");
  assert.equal(ids(2049151).alertes[0]?.athleteId, "2049151", "un identifiant numérique (comptes anciens) est valide");
  for (const forge of ["../../profiles", "", null, "i56 4686", "x123", "i1234567890123", "i564686;drop", { id: 1 }]) {
    const l = ids(forge);
    assert.equal(l.alertes.length, 0, `${JSON.stringify(forge)} accepté comme identifiant d'athlète`);
    assert.equal(l.rejetees, 1, `${JSON.stringify(forge)} écarté sans être compté`);
  }
});

test("une alerte sans type est écartée ; un type nouveau est gardé (il sera acquitté)", () => {
  const l = lireLivraison({ events: [
    { athlete_id: "i1", type: "" }, { athlete_id: "i1" }, { athlete_id: "i1", type: "nouveau_type" }, "pas un objet",
  ] })!;
  assert.deepEqual(l.alertes.map((a) => a.type), ["NOUVEAU_TYPE"]);
  assert.equal(l.rejetees, 3);
});

test("le jour de la séance est son jour LOCAL, lu sans fuseau", () => {
  const jour = (start_date_local: unknown) =>
    lireLivraison({ events: [{ athlete_id: "i1", type: "ACTIVITY_UPLOADED", activity: { start_date_local } }] })!.alertes[0].jour;
  // 0 h 30 à Paris le 17 : c'est le 17, quoi qu'en dise l'UTC (22 h 30 le 16).
  assert.equal(jour("2026-10-17T00:30:00"), "2026-10-17");
  assert.equal(jour("2026-10-17"), "2026-10-17");
  for (const v of [undefined, null, 20261017, "hier", "17/10/2026", "2026-10-1"]) assert.equal(jour(v), null, `${String(v)} lu comme un jour`);
  assert.equal(lireLivraison({ events: [{ athlete_id: "i1", type: "WELLNESS_UPDATED" }] })!.alertes[0].jour, null);
});

test("une livraison démesurée est lue jusqu'à une borne, le reste est compté", () => {
  const l = lireLivraison({ events: Array.from({ length: 600 }, () => ({ athlete_id: "i1", type: "ACTIVITY_UPDATED" })) })!;
  assert.equal(l.alertes.length, 500);
  assert.equal(l.rejetees, 100, "ce qui dépasse la borne doit être compté, pas perdu en silence");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔐 LE SECRET — dans le corps, comparé à temps constant\n");
// ─────────────────────────────────────────────────────────────────────────────

test("sans INTERVALS_WEBHOOK_SECRET, il n'y a pas de secret attendu", () => {
  assert.equal(secretAttendu({}), null);
  assert.equal(secretAttendu({ INTERVALS_WEBHOOK_SECRET: "  \n" }), null, "des blancs ne sont pas un secret");
  assert.equal(secretAttendu({ INTERVALS_WEBHOOK_SECRET: " s3cret-pacevo\n" }), "s3cret-pacevo");
  // L'ancien nom ne compte plus : il appartenait au mécanisme mort.
  assert.equal(secretAttendu({ WEBHOOK_SECRET: "ancien" }), null);
});

test("seul le secret exact passe", () => {
  const attendu = "q3Jv9x-Pacevo-2026";
  assert.equal(secretValide("q3Jv9x-Pacevo-2026", attendu), true);
  assert.equal(secretValide("q3Jv9x-Pacevo-2026\n", attendu), true, "un retour à la ligne collé ne doit pas tout refuser");
  for (const faux of ["q3Jv9x-Pacevo-2025", "q3Jv9x-Pacevo-202", "q3Jv9x-Pacevo-20266", "Q3JV9X-PACEVO-2026", "", "   ", undefined, null, 42, ["q3Jv9x-Pacevo-2026"]]) {
    assert.equal(secretValide(faux, attendu), false, `${JSON.stringify(faux)} accepté`);
  }
  assert.equal(secretValide("", ""), false, "deux vides ne font pas un secret partagé");
  assert.equal(secretValide("x", ""), false);
});

test("la route lit le secret dans le CORPS, à temps constant, et nulle part ailleurs", () => {
  const code = codeSeul(ROUTE);
  assert.ok(/secretValide\(\s*livraison\.secret\s*,\s*attendu\s*\)/.test(code), "le secret du corps n'est plus vérifié");
  assert.ok(!/searchParams/.test(code), "la route relit l'adresse : le secret n'y voyage pas (et finirait dans les journaux)");
  assert.ok(!/(===|!==)\s*attendu|attendu\s*(===|!==)/.test(code), "comparaison directe du secret : elle laisse mesurer ce qu'on a deviné");
  const lib = codeSeul("src/lib/intervals/webhook.ts");
  assert.ok(/timingSafeEqual\(/.test(lib), "la comparaison n'est plus à temps constant");
});

test("l'ancien mécanisme a disparu : plus de `?secret=`, plus d'enregistrement par clé API", () => {
  // `WEBHOOK_SECRET` voyageait dans une adresse envoyée à intervals.icu, sur une route qui
  // répondait 404 depuis le 06/08/2026. Seuls ses homonymes préfixés ont le droit d'exister.
  const fautes: string[] = [];
  for (const f of fichiersSrc()) {
    const code = codeSeul(f);
    if (/(?<![A-Z_])WEBHOOK_SECRET/.test(code)) fautes.push(`${f} : WEBHOOK_SECRET`);
    if (/athlete\/\$\{[^}]+\}\/webhooks/.test(code)) fautes.push(`${f} : /athlete/{id}/webhooks`);
  }
  assert.deepEqual(fautes, []);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🗂️  LE TRI — une synchro par athlète, jamais pour le calendrier\n");
// ─────────────────────────────────────────────────────────────────────────────

const alerte = (athleteId: string, type: string, jour: string | null = null): Alerte => ({ athleteId, type, jour });

test("une livraison qui annonce trois séances d'un athlète déclenche UNE synchro", () => {
  // Deux synchros parallèles du même compte se disputeraient les mêmes lignes.
  const { lots } = lotsATraiter([
    alerte("i1", "ACTIVITY_UPLOADED", "2026-10-15"), alerte("i1", "ACTIVITY_ANALYZED", "2026-10-15"),
    alerte("i1", "ACTIVITY_UPLOADED", "2026-10-12"), alerte("i2", "WELLNESS_UPDATED"),
  ], MIDI);
  assert.deepEqual(lots.map((l) => l.athleteId), ["i1", "i2"]);
  assert.deepEqual(lots[0].types, ["ACTIVITY_ANALYZED", "ACTIVITY_UPLOADED"]);
  // La fenêtre couvre la PLUS ANCIENNE séance annoncée (le 12), pas la dernière lue.
  assert.equal(lots[0].jours, fenetre("2026-10-12", MIDI));
  assert.equal(lots[1].jours, JOURS_DEFAUT);
});

test("le calendrier, écrit par Pacevo lui-même, ne relance jamais de synchro (boucle)", () => {
  // Chaque envoi vers la montre écrit le calendrier d'intervals.icu, qui émet CALENDAR_UPDATED.
  const { lots, ignorees } = lotsATraiter([alerte("i1", "CALENDAR_UPDATED"), alerte("i1", "CALENDAR_UPDATED")], MIDI);
  assert.deepEqual(lots, []);
  assert.deepEqual(ignorees, { CALENDAR_UPDATED: 2 });
  assert.ok(!TYPES_SYNCHRO.has("CALENDAR_UPDATED") && !TYPES_SYNCHRO.has("CALENDAR_EVENT_UPDATED"));
  assert.match(RAISONS_IGNOREES.CALENDAR_UPDATED, /Pacevo/);
});

test("les alertes sans objet sont acquittées sans synchro, chacune avec sa raison", () => {
  const { lots, ignorees } = lotsATraiter(
    ["ACTIVITY_DELETED", "APP_SCOPE_CHANGED", "SPORT_SETTINGS_UPDATED", "TYPE_DE_DEMAIN"].map((t) => alerte("i1", t)), MIDI);
  assert.deepEqual(lots, []);
  assert.deepEqual(Object.keys(ignorees).sort(), ["ACTIVITY_DELETED", "APP_SCOPE_CHANGED", "SPORT_SETTINGS_UPDATED", "TYPE_DE_DEMAIN"]);
  // Une suppression n'est PAS répercutée en silence : le ressenti, la trace, les segments partiraient avec.
  assert.ok(RAISONS_IGNOREES.ACTIVITY_DELETED, "la suppression doit dire pourquoi elle n'est pas répercutée");
});

test("les quatre alertes utiles déclenchent la synchro", () => {
  for (const t of ["ACTIVITY_UPLOADED", "ACTIVITY_ANALYZED", "ACTIVITY_UPDATED", "WELLNESS_UPDATED"]) {
    assert.equal(lotsATraiter([alerte("i1", t)], MIDI).lots.length, 1, `${t} ne synchronise plus`);
  }
});

test("la séance annoncée entre TOUJOURS dans la fenêtre, minuit compris", () => {
  // La borne basse de `syncIntervalsForUser` est un jour UTC ; le jour de la séance est local.
  // On rejoue exactement son calcul, à toute heure, pour chaque jour du dernier mois.
  for (const heure of ["00:05", "01:59", "12:00", "22:30", "23:59"]) {
    const maintenant = Date.parse(`2026-10-16T${heure}:00Z`);
    for (let n = -1; n < JOURS_MAX - 1; n++) {
      const jour = new Date(maintenant - n * 86_400_000).toISOString().slice(0, 10);
      const jours = fenetre(jour, maintenant);
      const oldest = new Date(maintenant - jours * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      assert.ok(oldest <= jour, `${heure} UTC, séance du ${jour} : fenêtre de ${jours} j, borne ${oldest} — séance manquée`);
    }
  }
});

test("la fenêtre est bornée : ni moins de trois jours, ni plus d'un mois", () => {
  assert.equal(fenetre(null, MIDI), JOURS_DEFAUT);
  assert.equal(fenetre("2026-10-16", MIDI), JOURS_DEFAUT);
  assert.equal(fenetre("2026-10-17", MIDI), JOURS_DEFAUT, "une séance datée du lendemain (fuseau en avance) reste couverte");
  assert.equal(fenetre("2026-10-11", MIDI), 6, "5,5 jours écoulés depuis le 11 à 0 h UTC : six jours");
  assert.equal(fenetre("2026-08-01", MIDI), JOURS_MAX, "une séance ancienne ne doit pas rapatrier des mois à chaque alerte");
  assert.equal(fenetre("2026-13-45", MIDI), JOURS_DEFAUT);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n↩️  LA RÉPONSE — une erreur fait RENVOYER l'alerte : seulement si ça peut réussir\n");
// ─────────────────────────────────────────────────────────────────────────────

test("un incident passager fait renvoyer l'alerte ; un refus définitif est acquitté", () => {
  assert.equal(issueDe({ error: "Intervals.icu 503", status: 503, passagers: 0 }), "passager");
  assert.equal(issueDe({ error: "Intervals.icu 429", status: 429, passagers: 0 }), "passager", "trop de requêtes : réessayer plus tard réussira");
  assert.equal(issueDe({ error: "fetch failed", status: null, passagers: 0 }), "passager", "une coupure réseau est passagère");
  assert.equal(issueDe({ error: "Intervals.icu 401", status: 401, passagers: 0 }), "refusé", "autorisation retirée : réessayer ne changera rien");
  assert.equal(issueDe({ error: "Intervals.icu 403", status: 403, passagers: 0 }), "refusé");
  assert.equal(issueDe({ error: "Unexpected token < in JSON", status: null, passagers: 0 }), "refusé");
  // Le statut décide, pas le texte : « 23502 » n'est pas un 502.
  assert.equal(issueDe({ error: "Intervals.icu 400 : 23502", status: 400, passagers: 0 }), "refusé");
  assert.equal(issueDe({ passagers: 0 }), "synchronisé");
  assert.equal(issueDe({ passagers: 2 }), "passager", "des écritures en échec passager doivent être reprises par le renvoi");
});

test("la livraison n'échoue que si au moins une synchro peut réussir en réessayant", () => {
  assert.equal(statutHttp([]), 200);
  assert.equal(statutHttp(["synchronisé", "inconnu", "refusé"]), 200, "un compte inconnu ou un refus ferait revenir l'alerte pour rien");
  assert.equal(statutHttp(["synchronisé", "passager"]), 503);
});

test("la route ne répond une erreur que pour un format, un secret ou un incident passager", () => {
  const code = codeSeul(ROUTE);
  const statuts = [...code.matchAll(/status:\s*(\d{3})/g)].map((m) => Number(m[1]));
  assert.deepEqual([...new Set(statuts)].sort(), [400, 401, 503], `statuts inattendus : ${statuts.join(", ")}`);
  assert.ok(/status:\s*statut\b/.test(code) && /statutHttp\(/.test(code), "le statut final ne passe plus par statutHttp");
});

test("la route passe par la chaîne partagée, sous le nom « webhook », et replanifie APRÈS la réponse", () => {
  const code = codeSeul(ROUTE);
  assert.ok(/synchroniser\(admin,[^)]*canal:\s*"webhook"/.test(code), "la synchro ne passe plus par la chaîne, ou sous un autre nom au journal");
  for (const interdit of ["syncIntervalsForUser", "autoCoachForUser", "importMissingTracks", "replanIfFresh"]) {
    assert.ok(!code.includes(interdit), `la route appelle ${interdit} elle-même au lieu de la chaîne`);
  }
  // La suite part après la réponse : intervals.icu n'attend pas la replanification.
  assert.ok(/\bafter\(/.test(code), "`after` a disparu : la réponse attendrait la replanification");
  const iSuite = code.indexOf("apresLaReponse(async");
  assert.ok(iSuite > 0 && code.indexOf("poursuivre(", iSuite) > iSuite, "la replanification n'est plus remise après la réponse");
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`   · ${f}`); process.exit(1); }
